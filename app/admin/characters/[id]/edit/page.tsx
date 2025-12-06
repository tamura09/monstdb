import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import CharacterFormEdit from '@/components/CharacterFormEdit'

export default async function EditCharacterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { id } = await params
  const { error } = await searchParams

  // Admin権限チェック
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user || user.role !== 'admin') {
    redirect('/accounts')
  }

  const character = await prisma.characterMaster.findUnique({
    where: { id },
  })

  if (!character) {
    redirect('/admin/characters')
  }

  return <CharacterFormEdit character={character} errorParam={error} />
}
