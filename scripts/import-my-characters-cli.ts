import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function parseCSV(text: string) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (lines.length <= 1) return []
  const dataLines = lines.slice(1)
  const rows = dataLines.map((line) => {
    const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || []
    return {
      indexNumber: values[0],
      monsterName: values[1],
      element: values[2],
      type: values[3],
      accountName: values[4],
      wakuwaku1: values[5] || '',
      level1: values[6] || 'L',
      wakuwaku2: values[7] || '',
      level2: values[8] || 'L',
      wakuwaku3: values[9] || '',
      level3: values[10] || 'L',
      wakuwaku4: values[11] || '',
      level4: values[12] || 'L',
    }
  })
  return rows
}

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length < 2) {
    console.error('Usage: tsx scripts/import-my-characters-cli.ts <csvPath> <userId> [mode=add] [batchSize=200]')
    process.exit(1)
  }

  const csvPath = path.resolve(process.cwd(), argv[0])
  const userId = argv[1]
  const mode = (argv[2] as 'add' | 'replace') || 'add'
  const batchSize = parseInt(argv[3] || '200', 10)

  if (!fs.existsSync(csvPath)) {
    console.error('CSV file not found:', csvPath)
    process.exit(1)
  }

  console.log(`読み込み: ${csvPath}`)
  const text = fs.readFileSync(csvPath, 'utf8')
  const rows = parseCSV(text)

  console.log(`パース完了: ${rows.length} 行`) 
  if (rows.length === 0) process.exit(0)

  // ユーザーのゲームアカウントを取得
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { gameAccounts: true } })
  if (!user) {
    console.error('User not found:', userId)
    process.exit(1)
  }

  const accountMap = new Map<string, string>()
  for (const account of user.gameAccounts) {
    const displayName = account.name || `垢${account.accountNumber}`
    accountMap.set(displayName, account.id)
  }

  // 置換モードなら既存データを削除
  if (mode === 'replace') {
    const accountIds = user.gameAccounts.map((a) => a.id)
    console.log('replace モード: 既存の所持キャラを削除します...')
    await prisma.ownedCharacter.deleteMany({ where: { gameAccountId: { in: accountIds } } })
  }

  // 参照される図鑑No と わくわく名を事前取得
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

  // バッチ処理
  let processed = 0
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    for (const row of batch) {
      try {
        const accountId = accountMap.get(row.accountName)
        if (!accountId) {
          console.warn('アカウントが見つかりません:', row.accountName)
          errorCount++
          continue
        }

        const characterMaster = characterMap.get(row.indexNumber)
        if (!characterMaster) {
          console.warn('キャラクターが見つかりません:', row.indexNumber)
          errorCount++
          continue
        }

        // トランザクションで処理: 常に新しい所持キャラを作成する
        await prisma.$transaction(async (tx) => {
          const ownedCharacter = await tx.ownedCharacter.create({ data: { gameAccountId: accountId, characterMasterId: characterMaster.id } })

          const wakuwakuSlots = [
            { name: row.wakuwaku1, level: row.level1 || 'L' },
            { name: row.wakuwaku2, level: row.level2 || 'L' },
            { name: row.wakuwaku3, level: row.level3 || 'L' },
            { name: row.wakuwaku4, level: row.level4 || 'L' },
          ].filter((slot) => Boolean(slot.name))

          const wakuwakuMastersForChar = (
            wakuwakuSlots.map((slot) => ({ master: wakuwakuMap.get(slot.name), level: slot.level })).filter((item) => Boolean(item.master)) as any[]
          ).sort((a, b) => a.master.displayOrder - b.master.displayOrder)

          for (let j = 0; j < wakuwakuMastersForChar.length; j++) {
            const item = wakuwakuMastersForChar[j]
            if (!item.master) continue
            await tx.ownedCharacterWakuwaku.create({ 
              data: { 
                ownedCharacterId: ownedCharacter.id, 
                wakuwakuMasterId: item.master.id, 
                slotNumber: j + 1,
                level: item.level,
              } 
            })
          }
        })

        successCount++
      } catch (e) {
        console.error('行処理エラー:', e)
        errorCount++
      } finally {
        processed++
      }
    }

    console.log(`進捗: ${processed}/${rows.length} (成功:${successCount} エラー:${errorCount})`)
  }

  console.log(`完了: 成功 ${successCount} 件, エラー ${errorCount} 件`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
