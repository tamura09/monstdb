import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api/errors'

export type AuthenticatedUser = {
  userId: string
  role: string
}

// セッションの存在のみを確認する。ログイン済みであればよい一般APIで使用する。
export async function requireUser(): Promise<AuthenticatedUser> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw ApiError.unauthorized()
  }

  return {
    userId: session.user.id,
    role: session.user.role,
  }
}

// セッションに加え、DB上のuser.roleが'admin'であることを必ず確認する。
// JWTのroleはログイン時点の情報が固定化されうるため、権限が剥奪された
// 場合でも即座に反映されるようDBを正として都度確認する
// (app/api/admin/characters/route.tsの既存パターンを踏襲)。
export async function requireAdmin(): Promise<AuthenticatedUser> {
  const { userId } = await requireUser()

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!dbUser || dbUser.role !== 'admin') {
    throw ApiError.forbidden()
  }

  return {
    userId: dbUser.id,
    role: dbUser.role,
  }
}
