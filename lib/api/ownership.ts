import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api/errors'
import type { GameAccount, OwnedCharacter } from '@/generated/prisma/client'

// GameAccountの所有者を検証する。
// 「存在しない」場合と「他人のものである」場合を区別せず一律 not_found を
// throwすることで、レスポンスからIDの存在有無を推測されないようにする。
export async function assertGameAccountOwner(
  gameAccountId: string,
  userId: string
): Promise<GameAccount> {
  const gameAccount = await prisma.gameAccount.findUnique({
    where: { id: gameAccountId },
  })

  if (!gameAccount || gameAccount.userId !== userId) {
    throw ApiError.notFound()
  }

  return gameAccount
}

// OwnedCharacterの所有者を、紐づくGameAccountを辿って検証する。
// assertGameAccountOwnerと同様、存在しない場合・他人のものである場合を
// 区別せず一律 not_found をthrowする。
export async function assertOwnedCharacterOwner(
  ownedCharacterId: string,
  userId: string
): Promise<OwnedCharacter> {
  const ownedCharacter = await prisma.ownedCharacter.findUnique({
    where: { id: ownedCharacterId },
    include: { gameAccount: true },
  })

  if (!ownedCharacter || ownedCharacter.gameAccount.userId !== userId) {
    throw ApiError.notFound()
  }

  return ownedCharacter
}
