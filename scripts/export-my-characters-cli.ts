import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const argv = process.argv.slice(2)
  if (argv.length < 1) {
    console.error('Usage: tsx scripts/export-my-characters-cli.ts <userId> [outputPath]')
    console.error('Example: tsx scripts/export-my-characters-cli.ts cmgukoi410000l104f42wqkl8 ./export.csv')
    process.exit(1)
  }

  const userId = argv[0]
  const outputPath = argv[1] || path.resolve(process.cwd(), `my_characters_${new Date().toISOString().split('T')[0]}.csv`)

  console.log(`ユーザー取得中: ${userId}`)

  const user = await prisma.user.findUnique({
    where: { id: userId },
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
    console.error('User not found:', userId)
    process.exit(1)
  }

  console.log(`ユーザー名: ${user.name || 'N/A'}`)
  console.log(`ゲームアカウント数: ${user.gameAccounts.length}`)

  // 全キャラクターマスターを取得
  const allCharacterMasters = await prisma.characterMaster.findMany({
    orderBy: {
      indexNumber: 'asc',
    },
  })

  // 各キャラクターマスターに対して、各アカウントの所持情報をマッピング
  const characterData = allCharacterMasters.map((charMaster) => {
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

  // CSV生成
  const bom = '\uFEFF'
  const header = '図鑑No,名前,属性,種類,アカウント,わくわく1,レベル1,わくわく2,レベル2,わくわく3,レベル3,わくわく4,レベル4\n'

  const rows: string[] = []
  
  for (const charData of characterData) {
    const char = charData.characterMaster
    
    // 各アカウントの所持キャラを展開
    for (const account of user.gameAccounts) {
      const ownedChars = charData.accountOwnerships[account.id] || []
      
      // 各所持キャラを1行ずつ出力
      for (const ownedChar of ownedChars) {
        const accountName = account.name || `垢${account.accountNumber}`
        const wakuwaku1 = ownedChar.wakuwakuSlots[0]?.wakuwakuMaster.name || ''
        const level1 = ownedChar.wakuwakuSlots[0]?.level || ''
        const wakuwaku2 = ownedChar.wakuwakuSlots[1]?.wakuwakuMaster.name || ''
        const level2 = ownedChar.wakuwakuSlots[1]?.level || ''
        const wakuwaku3 = ownedChar.wakuwakuSlots[2]?.wakuwakuMaster.name || ''
        const level3 = ownedChar.wakuwakuSlots[2]?.level || ''
        const wakuwaku4 = ownedChar.wakuwakuSlots[3]?.wakuwakuMaster.name || ''
        const level4 = ownedChar.wakuwakuSlots[3]?.level || ''
        
        rows.push(
          `${char.indexNumber},"${char.monsterName}",${char.element},${char.type},"${accountName}",${wakuwaku1},${level1},${wakuwaku2},${level2},${wakuwaku3},${level3},${wakuwaku4},${level4}`
        )
      }
    }
  }

  const csv = bom + header + rows.join('\n')

  // ファイルに書き込み
  fs.writeFileSync(outputPath, csv, 'utf8')

  console.log(`✅ エクスポート完了: ${outputPath}`)
  console.log(`   出力行数: ${rows.length} 行`)
}

main()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
