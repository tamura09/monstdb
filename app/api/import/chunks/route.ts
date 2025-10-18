import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

interface CSVRow {
  indexNumber: string
  monsterName?: string
  element?: string
  type?: string
  accountName: string
  wakuwaku1?: string
  level1?: string
  wakuwaku2?: string
  level2?: string
  wakuwaku3?: string
  level3?: string
  wakuwaku4?: string
  level4?: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const rows: CSVRow[] = Array.isArray(body.rows) ? body.rows : []
    const mode: 'add' | 'replace' = body.mode === 'replace' ? 'replace' : 'add'
    const isFirstBatch: boolean = Boolean(body.isFirstBatch)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 })
    }

    // 最悪でも一度に受け取る行数に上限を設ける
    if (rows.length > 1000) {
      return NextResponse.json({ error: 'Too many rows in one batch' }, { status: 400 })
    }

    // ユーザーとアカウント取得
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { gameAccounts: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const accountMap = new Map<string, string>()
    for (const account of user.gameAccounts) {
      const displayName = account.name || `垢${account.accountNumber}`
      accountMap.set(displayName, account.id)
    }

    // 参照されている図鑑No と わくわく名を絞って取得
    const indexNumbers = Array.from(new Set(rows.map((r) => Number(r.indexNumber)).filter(Boolean)))
  const wakuwakuNames = Array.from(new Set(rows.flatMap((r) => [r.wakuwaku1, r.wakuwaku2, r.wakuwaku3, r.wakuwaku4]).filter((v): v is string => Boolean(v))))

    const characterMasters = indexNumbers.length > 0
      ? await prisma.characterMaster.findMany({ where: { indexNumber: { in: indexNumbers } } })
      : []
    const wakuwakuMasters = wakuwakuNames.length > 0
      ? await prisma.wakuwakuMaster.findMany({ where: { name: { in: wakuwakuNames as string[] } } })
      : []

    const characterMap = new Map(characterMasters.map((c) => [c.indexNumber.toString(), c]))
    const wakuwakuMap = new Map(wakuwakuMasters.map((w) => [w.name, w]))

    // 置換モードの初回バッチで既存データを削除
    if (isFirstBatch && mode === 'replace') {
      const accountIds = user.gameAccounts.map((a) => a.id)
      // ownedCharacter とそれに紐づく wakuwaku は cascade or explicit delete
      await prisma.ownedCharacter.deleteMany({ where: { gameAccountId: { in: accountIds } } })
    }

    // 小さいトランザクションで各行を処理
    const result = await prisma.$transaction(async (tx) => {
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      for (const row of rows) {
        try {
          const accountId = accountMap.get(row.accountName)
          if (!accountId) {
            errors.push(`アカウント "${row.accountName}" が見つかりません`)
            errorCount++
            continue
          }

          const characterMaster = characterMap.get(row.indexNumber)
          if (!characterMaster) {
            errors.push(`図鑑No ${row.indexNumber} のキャラクターが見つかりません`)
            errorCount++
            continue
          }

          // 常に新しい所持キャラを作成（同じアカウントで同図鑑Noを複数所持できるようにする）
          const ownedCharacter = await tx.ownedCharacter.create({
            data: {
              gameAccountId: accountId,
              characterMasterId: characterMaster.id,
            },
          })

          // 既存のわくわくは上書き（重複防止のため一旦削除）
          await tx.ownedCharacterWakuwaku.deleteMany({ where: { ownedCharacterId: ownedCharacter.id } })

          // CSVで与えられたわくわく名を displayOrder 順に並べ替えてスロット割当
          const wakuwakuSlots = [
            { name: row.wakuwaku1, level: row.level1 || 'L' },
            { name: row.wakuwaku2, level: row.level2 || 'L' },
            { name: row.wakuwaku3, level: row.level3 || 'L' },
            { name: row.wakuwaku4, level: row.level4 || 'L' },
          ].filter((slot): slot is { name: string; level: string } => Boolean(slot.name))

          const wakuwakuMastersForChar = (
            wakuwakuSlots
              .map((slot) => ({ master: wakuwakuMap.get(slot.name), level: slot.level }))
              .filter((item) => Boolean(item.master)) as any[]
          ).sort((a, b) => a.master.displayOrder - b.master.displayOrder)

          for (let i = 0; i < wakuwakuMastersForChar.length; i++) {
            const item = wakuwakuMastersForChar[i]
            if (!item.master) continue
            await tx.ownedCharacterWakuwaku.create({
              data: {
                ownedCharacterId: ownedCharacter.id,
                wakuwakuMasterId: item.master.id,
                slotNumber: i + 1,
                level: item.level,
              },
            })
          }

          successCount++
        } catch (e) {
          console.error('Row processing error:', e)
          errors.push(`行処理エラー: ${JSON.stringify(row)}`)
          errorCount++
        }
      }

      return { successCount, errorCount, errors }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error('Chunk import error:', error)
    return NextResponse.json({ error: 'Chunk import failed', details: String(error) }, { status: 500 })
  }
}
