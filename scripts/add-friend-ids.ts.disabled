import { prisma } from '../lib/prisma'

async function main() {
  console.log('既存ユーザーにfriendIdを付与します...')

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      friendId: true,
    },
  })

  console.log(`全ユーザー数: ${users.length}`)

  const usersWithoutFriendId = users.filter(user => !user.friendId)
  console.log(`friendIdがないユーザー数: ${usersWithoutFriendId.length}`)

  if (usersWithoutFriendId.length === 0) {
    console.log('✓ すべてのユーザーにfriendIdが付与されています')
    return
  }

  for (const user of usersWithoutFriendId) {
    await prisma.user.update({
      where: { id: user.id },
      data: { friendId: crypto.randomUUID().replace(/-/g, '').substring(0, 25) }
    })
    console.log(`✓ ${user.email} にfriendIdを付与しました`)
  }

  console.log(`\n完了: ${usersWithoutFriendId.length}人のユーザーにfriendIdを付与しました`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
