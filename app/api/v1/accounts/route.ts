import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiHandler } from '@/lib/api/handler'
import { requireUser } from '@/lib/api/auth'

// GET /api/v1/accounts — 自分のゲームアカウント一覧取得
// GameAccountの作成・削除はこのAPIでは行わない（ログイン時に自動作成される）
export const GET = withApiHandler(async (request: NextRequest) => {
  const { userId } = await requireUser()

  // 他人のアカウントを絶対に返さないよう、必ずuserIdで絞り込む
  const gameAccounts = await prisma.gameAccount.findMany({
    where: { userId },
    select: {
      id: true,
      accountNumber: true,
      name: true,
      _count: {
        select: { ownedCharacters: true },
      },
    },
    orderBy: { accountNumber: 'asc' },
  })

  const data = gameAccounts.map((account) => ({
    id: account.id,
    accountNumber: account.accountNumber,
    name: account.name,
    ownedCharacterCount: account._count.ownedCharacters,
  }))

  return NextResponse.json({ data })
})
