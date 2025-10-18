import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Fixing wakuwaku slot order for all owned characters...')

  // 全ての所持キャラを取得（スロットと wakuwakuMaster を含む）
  const ownedCharacters = await prisma.ownedCharacter.findMany({
    include: {
      wakuwakuSlots: {
        include: { wakuwakuMaster: true },
      },
    },
  })

  let fixedCount = 0

  for (const oc of ownedCharacters) {
    const slots = (oc as any).wakuwakuSlots as any[]
    if (!slots || slots.length <= 1) continue

    // displayOrder でソート
    const sorted = slots.slice().sort((a: any, b: any) => (a.wakuwakuMaster?.displayOrder ?? 0) - (b.wakuwakuMaster?.displayOrder ?? 0))

    // 既に正しい順序ならスキップ
    let alreadyOrdered = true
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].slotNumber !== i + 1) {
        alreadyOrdered = false
        break
      }
    }
    if (alreadyOrdered) continue

    // 更新: 一時的に大きな番号を振ってから正しい番号にする（ユニーク制約回避）
    try {
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < sorted.length; i++) {
          await tx.ownedCharacterWakuwaku.update({
            where: { id: sorted[i].id },
            data: { slotNumber: 100 + i },
          })
        }
        for (let i = 0; i < sorted.length; i++) {
          await tx.ownedCharacterWakuwaku.update({
            where: { id: sorted[i].id },
            data: { slotNumber: i + 1 },
          })
        }
      })
      fixedCount++
    } catch (e) {
      console.error(`Failed to fix ownedCharacter ${oc.id}:`, e)
    }
  }

  console.log(`✅ Fixed ${fixedCount} owned characters' wakuwaku order`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
