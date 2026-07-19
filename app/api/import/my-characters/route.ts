import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { parseCsv } from '@/lib/csv'

interface CSVRow {
  indexNumber: string
  monsterName: string
  element: string
  type: string
  accountName: string
  wakuwaku1: string
  level1?: string
  wakuwaku2: string
  level2?: string
  wakuwaku3: string
  level3?: string
  wakuwaku4: string
  level4?: string
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const mode = formData.get('mode') as string // 'add' or 'replace'

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // CSVファイルを読み込む（BOM除去・CRLF・クォート内カンマ/改行・エスケープに対応したRFC 4180準拠パーサ）
    const text = await file.text()
    const allRows = parseCsv(text)

    // ヘッダー行をスキップ
    const dataRows = allRows.slice(1)

    // CSVをパース
    const rows: CSVRow[] = []
    for (const values of dataRows) {
      const trimmed = values.map(v => v.trim())

      if (trimmed.length >= 5) {
        rows.push({
          indexNumber: trimmed[0],
          monsterName: trimmed[1],
          element: trimmed[2],
          type: trimmed[3],
          accountName: trimmed[4],
          wakuwaku1: trimmed[5] || '',
          level1: trimmed[6] || 'L',
          wakuwaku2: trimmed[7] || '',
          level2: trimmed[8] || 'L',
          wakuwaku3: trimmed[9] || '',
          level3: trimmed[10] || 'L',
          wakuwaku4: trimmed[11] || '',
          level4: trimmed[12] || 'L',
        })
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid data in CSV' }, { status: 400 })
    }

    // ユーザーのゲームアカウントを取得
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        gameAccounts: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // 'replace'モードの場合、既存のデータを削除
    if (mode === 'replace') {
      // 全てのゲームアカウントの所持キャラを削除
      for (const account of user.gameAccounts) {
        await prisma.ownedCharacter.deleteMany({
          where: { gameAccountId: account.id },
        })
      }
    }

    // 全てのキャラクターマスターとわくわくマスターを事前に取得
    const allCharacterMasters = await prisma.characterMaster.findMany()
    const allWakuwakuMasters = await prisma.wakuwakuMaster.findMany()

    const characterMap = new Map(
      allCharacterMasters.map(c => [c.indexNumber.toString(), c])
    )
    const wakuwakuMap = new Map(
      allWakuwakuMasters.map(w => [w.name, w])
    )

    // アカウント名からアカウントIDへのマッピングを作成
    const accountMap = new Map<string, string>()
    for (const account of user.gameAccounts) {
      const displayName = account.name || `垢${account.accountNumber}`
      accountMap.set(displayName, account.id)
    }

    // 各行の処理をひとつのトランザクションにまとめて原子性を確保しつつ、
    // わくわくの実は createMany でまとめて挿入しラウンドトリップを削減する
    const { successCount, errorCount, errors } = await prisma.$transaction(async (tx) => {
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []

      for (const row of rows) {
        try {
          // アカウントを取得
          const accountId = accountMap.get(row.accountName)
          if (!accountId) {
            errors.push(`アカウント "${row.accountName}" が見つかりません`)
            errorCount++
            continue
          }

          // キャラクターマスターを取得
          const characterMaster = characterMap.get(row.indexNumber)
          if (!characterMaster) {
            errors.push(`図鑑No ${row.indexNumber} のキャラクターが見つかりません`)
            errorCount++
            continue
          }

          // 所持キャラを作成
          const ownedCharacter = await tx.ownedCharacter.create({
            data: {
              gameAccountId: accountId,
              characterMasterId: characterMaster.id,
            },
          })

          // わくわくの実を追加
          // わくわくを displayOrder 順に並べ替えて slotNumber を割り当てる
          const wakuwakuSlots = [
            { name: row.wakuwaku1, level: row.level1 || 'L' },
            { name: row.wakuwaku2, level: row.level2 || 'L' },
            { name: row.wakuwaku3, level: row.level3 || 'L' },
            { name: row.wakuwaku4, level: row.level4 || 'L' },
          ].filter((slot) => Boolean(slot.name))

          const wakuwakuMastersForChar = (
            wakuwakuSlots
              .map((slot) => ({ master: wakuwakuMap.get(slot.name), level: slot.level }))
              .filter((item) => Boolean(item.master)) as any[]
          ).sort((a, b) => a.master.displayOrder - b.master.displayOrder)

          if (wakuwakuMastersForChar.length > 0) {
            await tx.ownedCharacterWakuwaku.createMany({
              data: wakuwakuMastersForChar.map((item, i) => ({
                ownedCharacterId: ownedCharacter.id,
                wakuwakuMasterId: item.master.id,
                slotNumber: i + 1,
                level: item.level,
              })),
            })
          }

          successCount++
        } catch (error) {
          console.error('Error processing row:', row, error)
          errors.push(`行の処理エラー: ${row.monsterName} (${row.accountName})`)
          errorCount++
        }
      }

      return { successCount, errorCount, errors }
    })

    return NextResponse.json({
      success: true,
      message: `インポート完了: ${successCount}件成功, ${errorCount}件エラー`,
      successCount,
      errorCount,
      errors: errors.slice(0, 10), // 最初の10件のエラーのみ返す
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Import failed', details: String(error) },
      { status: 500 }
    )
  }
}
