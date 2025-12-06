import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CharacterFormNew from '@/components/CharacterFormNew'

export default async function NewCharacterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; indexNumber?: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { error, indexNumber } = await searchParams

  // Admin権限チェック
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user || user.role !== 'admin') {
    redirect('/accounts')
  }

  return <CharacterFormNew errorParam={error} indexNumberParam={indexNumber} />
}
