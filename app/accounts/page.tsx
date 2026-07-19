import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import CharacterTable from '@/components/CharacterTable'
import DownloadButton from '@/components/DownloadButton'
import ImportButton from '@/components/ImportButton'
import DownloadTemplateButton from '@/components/DownloadTemplateButton'
import AccountSearchFilter from '@/components/AccountSearchFilter'
import CharacterNameSearchBar from '@/components/CharacterNameSearchBar'
import { matchesJapaneseOr } from '@/lib/string-utils'

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    element?: string
    type?: string
    search?: string
    wakuwaku?: string
    wakuwakuMode?: 'and' | 'or'
    hasEL?: string
  }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { element, type, search, wakuwaku, wakuwakuMode = 'or', hasEL } = await searchParams

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      gameAccounts: {
        include: {
          ownedCharacters: {
            include: {
              characterMaster: true,
              wakuwakuSlots: {
                include: {
                  wakuwakuMaster: true,
                },
                orderBy: {
                  slotNumber: 'asc',
                },
              },
            },
          },
        },
        orderBy: {
          accountNumber: 'asc',
        },
      },
    },
  })

  if (!user) {
    redirect('/login')
  }

  // Admin権限チェック
  const isAdmin = user.role === 'admin'

  // 全ワクワクの実を取得
  const allWakuwaku = await prisma.wakuwakuMaster.findMany({
    orderBy: {
      displayOrder: 'asc',
    },
  })

  // ワクワクの実でフィルタリングする場合の処理
  const selectedWakuwaku = wakuwaku ? wakuwaku.split(',').filter(Boolean) : []

  // 全キャラクターマスターを取得（フィルタリング付き）
  let allCharacterMasters = await prisma.characterMaster.findMany({
    where: {
      ...(element && { element }),
      ...(type && { type }),
    },
    orderBy: {
      indexNumber: 'asc',
    },
  })

  // 検索文字列がある場合、ひらがな・カタカナを区別せずにフィルタリング
  if (search) {
    allCharacterMasters = allCharacterMasters.filter((char) =>
      matchesJapaneseOr(char.monsterName, search)
    )
  }

  // 各キャラクターマスターに対して、各アカウントの所持情報をマッピング
  let characterData = allCharacterMasters.map((charMaster) => {
    const accountOwnerships: Record<string, any[]> = {}
    
    user.gameAccounts.forEach((account) => {
      const ownedChars = account.ownedCharacters.filter(
        (oc) => oc.characterMaster.id === charMaster.id
      )
      if (ownedChars.length > 0) {
        accountOwnerships[account.id] = ownedChars
      }
    })

    return {
      characterMaster: charMaster,
      accountOwnerships,
    }
  })

  // ワクワクの実でフィルタリング
  if (selectedWakuwaku.length > 0) {
    characterData = characterData.filter((charData) => {
      // 全アカウントの所持キャラクターを取得
      const allOwnedChars: any[] = []
      Object.values(charData.accountOwnerships).forEach((chars) => {
        allOwnedChars.push(...chars)
      })

      if (allOwnedChars.length === 0) return false

      // 各所持キャラのワクワクの実の名前を収集
      const charWakuwakuNames = allOwnedChars.flatMap((char) =>
        char.wakuwakuSlots.map((slot: any) => slot.wakuwakuMaster.name)
      )

      if (wakuwakuMode === 'and') {
        // AND検索: 選択した全てのワクワクを持っている
        return selectedWakuwaku.every((w) => charWakuwakuNames.includes(w))
      } else {
        // OR検索: 選択したワクワクのいずれかを持っている
        return selectedWakuwaku.some((w) => charWakuwakuNames.includes(w))
      }
    })
  }

  // ELフィルタリング
  if (hasEL === 'true') {
    characterData = characterData.filter((charData) => {
      // 全アカウントの所持キャラクターを取得
      const allOwnedChars: any[] = []
      Object.values(charData.accountOwnerships).forEach((chars) => {
        allOwnedChars.push(...chars)
      })

      if (allOwnedChars.length === 0) return false

      // いずれかの所持キャラでELのわくわくを持っているかチェック
      return allOwnedChars.some((char) =>
        char.wakuwakuSlots.some((slot: any) => slot.level === 'EL')
      )
    })
  }

  // Server Action: キャラクター追加
  async function addCharacter(formData: FormData) {
    'use server'

    const gameAccountId = formData.get('accountId') as string
    const characterMasterId = formData.get('characterMasterId') as string

    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }

    // アカウントの所有者確認
    const account = await prisma.gameAccount.findUnique({
      where: { id: gameAccountId },
    })

    if (!account || account.userId !== session.user.id) {
      throw new Error('Unauthorized')
    }

    // キャラクター追加（複数体所持可能）
    await prisma.ownedCharacter.create({
      data: {
        gameAccountId,
        characterMasterId,
      },
    })

    revalidatePath('/accounts')
  }

  // Server Action: わくわくの実追加
  async function addWakuwaku(formData: FormData) {
    'use server'

    const ownedCharacterId = formData.get('ownedCharacterId') as string
    const wakuwakuMasterId = formData.get('wakuwakuMasterId') as string
    const level = (formData.get('level') as string) || 'L'

    if (!ownedCharacterId || !wakuwakuMasterId) {
      return
    }

    // 既存のわくわくの実の数を確認
    const existingSlots = await prisma.ownedCharacterWakuwaku.findMany({
      where: { ownedCharacterId },
    })

    if (existingSlots.length >= 4) {
      revalidatePath('/accounts')
      return
    }

    // 次のスロット番号を決定（仮）
    const nextSlotNumber = existingSlots.length + 1

    // わくわくの実を追加
    await prisma.ownedCharacterWakuwaku.create({
      data: {
        ownedCharacterId,
        wakuwakuMasterId,
        slotNumber: nextSlotNumber,
        level,
      },
    })

    // 追加後、displayOrderに基づいてソート
    const allSlots = await prisma.ownedCharacterWakuwaku.findMany({
      where: { ownedCharacterId },
      include: {
        wakuwakuMaster: true,
      },
    })

    // displayOrderでソート
    const sortedSlots = allSlots.sort((a, b) => 
      a.wakuwakuMaster.displayOrder - b.wakuwakuMaster.displayOrder
    )

    // スロット番号を振り直す（衝突を避けるため、まず一時的に大きな値を設定）
    for (let i = 0; i < sortedSlots.length; i++) {
      await prisma.ownedCharacterWakuwaku.update({
        where: { id: sortedSlots[i].id },
        data: { slotNumber: 100 + i },
      })
    }

    // 正しいスロット番号に設定
    for (let i = 0; i < sortedSlots.length; i++) {
      await prisma.ownedCharacterWakuwaku.update({
        where: { id: sortedSlots[i].id },
        data: { slotNumber: i + 1 },
      })
    }

    revalidatePath('/accounts')
  }

  // Server Action: わくわくの実削除
  async function deleteWakuwaku(formData: FormData) {
    'use server'

    const wakuwakuSlotId = formData.get('wakuwakuSlotId') as string

    if (!wakuwakuSlotId) {
      return
    }

    const slot = await prisma.ownedCharacterWakuwaku.findUnique({
      where: { id: wakuwakuSlotId },
    })

    if (!slot) {
      return
    }

    // 削除
    await prisma.ownedCharacterWakuwaku.delete({
      where: { id: wakuwakuSlotId },
    })

    // 残りのスロットを取得してdisplayOrderでソート
    const remainingSlots = await prisma.ownedCharacterWakuwaku.findMany({
      where: { ownedCharacterId: slot.ownedCharacterId },
      include: {
        wakuwakuMaster: true,
      },
    })

    // displayOrderでソート
    const sortedSlots = remainingSlots.sort((a, b) => 
      a.wakuwakuMaster.displayOrder - b.wakuwakuMaster.displayOrder
    )

    // スロット番号を1,2,3,4に振り直す（衝突を避けるため、まず一時的に大きな値を設定）
    for (let i = 0; i < sortedSlots.length; i++) {
      await prisma.ownedCharacterWakuwaku.update({
        where: { id: sortedSlots[i].id },
        data: { slotNumber: 100 + i },
      })
    }

    // 正しいスロット番号に設定
    for (let i = 0; i < sortedSlots.length; i++) {
      await prisma.ownedCharacterWakuwaku.update({
        where: { id: sortedSlots[i].id },
        data: { slotNumber: i + 1 },
      })
    }

    revalidatePath('/accounts')
  }

  // Server Action: わくわくの実一括更新
  async function updateWakuwakuBulk(formData: FormData) {
    'use server'

    const ownedCharacterId = formData.get('ownedCharacterId') as string
    const slotsJson = formData.get('slots') as string

    if (!ownedCharacterId || !slotsJson) {
      return
    }

    try {
      const slots = JSON.parse(slotsJson) as Array<{
        wakuwakuMasterId: string
        level: string
      }>

      // 既存のわくわくの実をすべて削除
      await prisma.ownedCharacterWakuwaku.deleteMany({
        where: { ownedCharacterId },
      })

      // 新しいわくわくの実を追加
      if (slots.length > 0) {
        // まずwakuwakuMasterの情報を取得してdisplayOrderでソート
        const wakuwakuMasters = await prisma.wakuwakuMaster.findMany({
          where: {
            id: { in: slots.map(s => s.wakuwakuMasterId) },
          },
        })

        // displayOrderでソート
        const sortedSlots = slots
          .map(slot => ({
            ...slot,
            displayOrder: wakuwakuMasters.find(w => w.id === slot.wakuwakuMasterId)?.displayOrder ?? 999,
          }))
          .sort((a, b) => a.displayOrder - b.displayOrder)

        // ソートされた順で保存
        for (let i = 0; i < sortedSlots.length; i++) {
          await prisma.ownedCharacterWakuwaku.create({
            data: {
              ownedCharacterId,
              wakuwakuMasterId: sortedSlots[i].wakuwakuMasterId,
              slotNumber: i + 1,
              level: sortedSlots[i].level,
            },
          })
        }
      }

      revalidatePath('/accounts')
    } catch (error) {
      console.error('わくわくの実一括更新エラー:', error)
      throw error
    }
  }

  // Server Action: 所持キャラ削除
  async function deleteOwnedCharacter(formData: FormData) {
    'use server'

    const ownedCharacterId = formData.get('ownedCharacterId') as string

    if (!ownedCharacterId || !session?.user?.id) {
      return
    }

    // 所持キャラの所有者確認
    const ownedChar = await prisma.ownedCharacter.findUnique({
      where: { id: ownedCharacterId },
      include: {
        gameAccount: true,
      },
    })

    if (!ownedChar || ownedChar.gameAccount.userId !== session.user.id) {
      throw new Error('Unauthorized')
    }

    // 所持キャラを削除（わくわくの実も自動で削除される）
    await prisma.ownedCharacter.delete({
      where: { id: ownedCharacterId },
    })

    revalidatePath('/accounts')
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 py-8 bg-ground">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink mb-2">マイアカウント</h1>
          <p className="text-dim text-sm">{user.name}さんのアカウント一覧</p>
        </div>
        <div className="flex gap-3">
          {/* 一時的に無効化 */}
          {/* <Link
            href="/accounts/view"
            className="bg-ink text-paper px-4 py-2 rounded-md hover:opacity-90 text-sm font-semibold flex items-center gap-2"
          >
            📖 閲覧専用モード
          </Link> */}
          <DownloadTemplateButton />
          <ImportButton />
          <DownloadButton type="my-characters" />
          {isAdmin && (
            <Link
              href="/admin/characters"
              className="border border-line text-ink px-4 py-2 rounded-md hover:bg-line2 text-sm font-semibold"
            >
              ⚙️ キャラ管理
            </Link>
          )}
        </div>
      </div>

      {/* キャラ名検索バー（独立） */}
      <div className="mb-6 bg-panel border border-line rounded-md p-5">
        <CharacterNameSearchBar basePath="/accounts" />
      </div>

      {/* フィルター・検索 */}
      <AccountSearchFilter allWakuwaku={allWakuwaku} />

      {/* キャラクター一覧テーブル */}
      <CharacterTable
        characterData={characterData}
        gameAccounts={user.gameAccounts.map(acc => ({
          id: acc.id,
          name: acc.name,
          accountNumber: acc.accountNumber,
        }))}
        allWakuwaku={allWakuwaku}
        onAddCharacter={addCharacter}
        onAddWakuwaku={addWakuwaku}
        onDeleteWakuwaku={deleteWakuwaku}
        onUpdateWakuwakuBulk={updateWakuwakuBulk}
        onDeleteOwnedCharacter={deleteOwnedCharacter}
      />

      <div className="mt-4 text-center text-dim text-sm">
        全{characterData.length}体のキャラクター
        {(element || type || search || selectedWakuwaku.length > 0) && ' (絞り込み中)'}
        {selectedWakuwaku.length > 0 && (
          <div className="mt-2 text-sm">
            ワクワク絞り込み: {selectedWakuwaku.join(', ')} ({wakuwakuMode === 'and' ? 'AND' : 'OR'}検索)
          </div>
        )}
      </div>
    </div>
  )
}
