import { prisma } from '@/lib/prisma'
import { Prisma } from '@/generated/prisma/client'
import { ApiError } from '@/lib/api/errors'
import { MAX_WAKUWAKU_SLOTS } from '@/lib/api/constants'

// スロット振り直しの際、@@unique([ownedCharacterId, slotNumber]) との衝突を
// 避けるために使う退避用オフセット。
// (app/accounts/page.tsx, app/accounts/[id]/page.tsx の既存実装と同じ値)
const SLOT_RENUMBER_OFFSET = 100

export type WakuwakuSlotInput = {
  wakuwakuMasterId: string
  level: string
}

// ownedCharacterIdをキーにしたPostgreSQLのトランザクションスコープアドバイザリロックを
// 取得する。同一キャラへのわくわくスロット操作(PUTでの全置換・DELETEでの単体解除)を
// 直列化し、以下2つの並行実行バグを防ぐ。
//   1. deleteMany→createの間に別トランザクションが割り込むことによる
//      @@unique([ownedCharacterId, slotNumber])違反(P2002→409)
//   2. normalizeSlotNumbersの「一旦SLOT_RENUMBER_OFFSET+iへ退避→1..Nへ再設定」という
//      N+N回のUPDATEを、並行トランザクションが異なる順序で行ロック取得することによる
//      デッドロック(SQLSTATE 40P01)
//
// 必ずpg_advisory_xact_lock(トランザクションスコープ)を使うこと。本番はSupabaseの
// pgBouncer(transaction pooling、DATABASE_URLに`?pgbouncer=true`)経由で接続しており、
// 1つの物理コネクションが複数のトランザクションで使い回される。セッションスコープの
// pg_advisory_lock/pg_advisory_unlockを使うと、unlockし忘れた場合はもちろん、
// 明示的にunlockしてもコネクションがpoolerに返却されるタイミング次第でロックが
// 想定外に長く保持され得り、リークの原因になる。pg_advisory_xact_lockは
// トランザクションのcommit/rollback時に自動解放されるため、pgBouncerの
// transaction poolingと組み合わせても安全。
//
// 呼び出し元がトランザクション内であることを前提とし、必ずトランザクションの
// 最初の操作として呼び出すこと(後続の処理より後に取得しても、既に割り込みが
// 発生した後になり意味がない)。
export async function acquireSlotLock(
  tx: Prisma.TransactionClient,
  ownedCharacterId: string
): Promise<void> {
  // hashtextは引数がtext型である必要があるため明示的にキャストする。
  // hashtextはint4を返すが、pg_advisory_xact_lock(bigint)へは暗黙変換される。
  // pg_advisory_xact_lockはvoidを返し、$queryRawはvoid型の結果列を
  // デシリアライズできずエラーになるため、結果行を読み取らない$executeRawを使う。
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${ownedCharacterId}::text))`
}

// 対象キャラのわくわくスロットを wakuwakuMaster.displayOrder 順に 1..N へ振り直す。
// @@unique([ownedCharacterId, slotNumber]) 制約との衝突を避けるため、
// 一旦 SLOT_RENUMBER_OFFSET+i に退避してから正しい番号へ付け直す
// (既存の app/accounts/page.tsx / app/accounts/[id]/page.tsx から抽出したロジック)。
// 呼び出し元がトランザクション内であることを前提とし、txを直接受け取る。
export async function normalizeSlotNumbers(
  tx: Prisma.TransactionClient,
  ownedCharacterId: string
): Promise<void> {
  const slots = await tx.ownedCharacterWakuwaku.findMany({
    where: { ownedCharacterId },
    include: { wakuwakuMaster: true },
  })

  const sorted = slots
    .slice()
    .sort((a, b) => a.wakuwakuMaster.displayOrder - b.wakuwakuMaster.displayOrder)

  // 一旦大きな値へ退避(unique制約との衝突回避)
  for (let i = 0; i < sorted.length; i++) {
    await tx.ownedCharacterWakuwaku.update({
      where: { id: sorted[i].id },
      data: { slotNumber: SLOT_RENUMBER_OFFSET + i },
    })
  }

  // 正しい番号(1..N)へ設定
  for (let i = 0; i < sorted.length; i++) {
    await tx.ownedCharacterWakuwaku.update({
      where: { id: sorted[i].id },
      data: { slotNumber: i + 1 },
    })
  }
}

// 指定したキャラのわくわくスロットを渡されたセットで全置換する。
// 検証・削除・作成・スロット番号の正規化を prisma.$transaction 内で
// アトミックに実行する。既存実装(app/accounts/page.tsx の
// updateWakuwakuBulk等)はトランザクション外で2N回の逐次UPDATEを
// 行っており、同時実行時に@@unique([ownedCharacterId, slotNumber])
// 制約違反を起こし得たため、それを是正する。
export async function replaceWakuwakuSlots(
  ownedCharacterId: string,
  slots: WakuwakuSlotInput[]
): Promise<void> {
  if (slots.length > MAX_WAKUWAKU_SLOTS) {
    throw ApiError.validation(
      `わくわくの実は最大${MAX_WAKUWAKU_SLOTS}個までしかセットできません`
    )
  }

  const masterIds = slots.map((slot) => slot.wakuwakuMasterId)
  const uniqueMasterIds = new Set(masterIds)

  if (uniqueMasterIds.size !== masterIds.length) {
    throw ApiError.validation('同じわくわくの実を複数スロットにセットすることはできません')
  }

  await prisma.$transaction(async (tx) => {
    // 同一ownedCharacterIdへの並行操作を直列化する。トランザクション内で
    // 最初に実行すること。
    await acquireSlotLock(tx, ownedCharacterId)

    if (uniqueMasterIds.size > 0) {
      const masters = await tx.wakuwakuMaster.findMany({
        where: { id: { in: Array.from(uniqueMasterIds) } },
      })

      if (masters.length !== uniqueMasterIds.size) {
        throw ApiError.validation('存在しないわくわくの実が指定されています')
      }
    }

    // 既存スロットを全削除してから作り直す
    await tx.ownedCharacterWakuwaku.deleteMany({
      where: { ownedCharacterId },
    })

    // この時点では displayOrder 順になっていなくてもよい
    // (全削除直後のため slotNumber の重複は発生しない)。
    // 正しい順序への並び替えは normalizeSlotNumbers に任せる。
    for (let i = 0; i < slots.length; i++) {
      await tx.ownedCharacterWakuwaku.create({
        data: {
          ownedCharacterId,
          wakuwakuMasterId: slots[i].wakuwakuMasterId,
          level: slots[i].level,
          slotNumber: i + 1,
        },
      })
    }

    await normalizeSlotNumbers(tx, ownedCharacterId)
  })
}
