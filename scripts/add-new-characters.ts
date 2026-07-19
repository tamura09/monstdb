import { prisma } from '../lib/prisma'
import characterMasters from '../character_masters_export.json'

async function main() {
  console.log('🔍 Checking for new characters...')

  // 既存のキャラクターの図鑑Noを取得
  const existingCharacters = await prisma.characterMaster.findMany({
    select: { indexNumber: true },
  })
  const existingIndexNumbers = new Set(
    existingCharacters.map((c) => c.indexNumber)
  )

  // 新規キャラクターをフィルタリング
  const newCharacters = characterMasters.filter(
    (char) => !existingIndexNumbers.has(char.indexNumber)
  )

  if (newCharacters.length === 0) {
    console.log('✅ No new characters to add.')
    return
  }

  console.log(`📚 Adding ${newCharacters.length} new characters...`)

  // 新規キャラクターのみを追加
  for (const character of newCharacters) {
    await prisma.characterMaster.create({
      data: {
        indexNumber: character.indexNumber,
        element: character.element,
        type: character.type,
        monsterName: character.monsterName,
      },
    })
    console.log(`  ✓ Added: ${character.indexNumber} - ${character.monsterName}`)
  }

  console.log('🎉 New characters added successfully!')
  console.log(`📊 Summary:`)
  console.log(`   - Existing: ${existingCharacters.length}`)
  console.log(`   - New: ${newCharacters.length}`)
  console.log(`   - Total: ${existingCharacters.length + newCharacters.length}`)
}

main()
  .catch((e) => {
    console.error('❌ Error during import:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
