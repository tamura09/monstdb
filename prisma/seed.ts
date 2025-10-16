import { PrismaClient } from '@prisma/client'
import characterMasters from '../character_masters_export.json'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // キャラクターマスターデータをインポート
  console.log('📚 Importing character masters...')
  for (const character of characterMasters) {
    await prisma.characterMaster.upsert({
      where: { indexNumber: character.indexNumber },
      update: {
        element: character.element,
        type: character.type,
        monsterName: character.monsterName,
      },
      create: {
        indexNumber: character.indexNumber,
        element: character.element,
        type: character.type,
        monsterName: character.monsterName,
      },
    })
  }
  console.log(`✅ Imported ${characterMasters.length} characters`)

  // わくわくの実マスターデータを作成
  console.log('🍎 Creating wakuwaku masters...')
  const wakuwakuList = [
    { name: '同族・加撃', description: '攻撃力+3000' },
    { name: '同族・加撃速', description: '攻撃力+2000、スピード+26.6' },
    { name: '同族・加命撃', description: '攻撃力+2000、HP+2000' },
    { name: '同族・加速', description: 'スピード+33.3' },
    { name: '同族・加命', description: 'HP+2500' },
    { name: '同族・加速命', description: 'スピード+26.6、HP+2000' },
    { name: '撃種・加撃', description: '攻撃力+1500' },
    { name: '撃種・加撃速', description: '攻撃力+1000、スピード+13.2' },
    { name: '撃種・加命撃', description: '攻撃力+1000、HP+1000' },
    { name: '撃種・加速', description: 'スピード+16.6' },
    { name: '撃種・加命', description: 'HP+1250' },
    { name: '撃種・加速命', description: 'スピード+13.2、HP+1000' },
    { name: '戦型・加撃', description: '攻撃力+1500' },
    { name: '戦型・加撃速', description: '攻撃力+1000、スピード+13.2' },
    { name: '戦型・加命撃', description: '攻撃力+1000、HP+1000' },
    { name: '戦型・加速', description: 'スピード+16.6' },
    { name: '戦型・加命', description: 'HP+1250' },
    { name: '戦型・加速命', description: 'スピード+13.2、HP+1000' },
    { name: '熱き友撃', description: '友情25%' },
    { name: 'ケガ減り', description: '被ダメ25%' },
    { name: '将命削り', description: 'ボスHP16%削り' },
    { name: '兵命削り', description: 'ボス以外のHP16%削り' },
    { name: '一撃失心', description: '確率気絶' },
    { name: '速必殺', description: 'SS5ターン短縮' },
    { name: '毒がまん', description: '毒ダメ99%カット' },
    { name: 'ちび癒し', description: '毎ターンHP1000回復' },
    { name: 'ハート', description: 'ハート回復量+15%' },
    { name: '学び', description: '経験値+60%' },
    { name: '荒稼ぎ', description: 'ゴールド+60%' },
    { name: 'スピクリ', description: 'スピクリ+9ターン' },
    { name: 'Sランク', description: 'Sランク+120秒' },
    { name: 'スコア稼ぎ', description: 'スコア+100pt' },
  ]

  for (const wakuwaku of wakuwakuList) {
    await prisma.wakuwakuMaster.upsert({
      where: { name: wakuwaku.name },
      update: { displayOrder: wakuwakuList.indexOf(wakuwaku) },
      create: {
        ...wakuwaku,
        displayOrder: wakuwakuList.indexOf(wakuwaku),
      },
    })
  }
  console.log(`✅ Created ${wakuwakuList.length} wakuwaku types`)

  console.log('🎉 Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
