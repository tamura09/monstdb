import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiHandler } from '@/lib/api/handler'
import { requireScope } from '@/lib/api/auth'

// GET /api/v1/wakuwaku-masters — わくわくの実マスター一覧取得
// PUT /api/v1/owned-characters/{id}/wakuwaku に渡すwakuwakuMasterIdを
// クライアントが引くためのエンドポイント。ログイン済みユーザーなら誰でも可。
export const GET = withApiHandler(async (request: NextRequest) => {
  await requireScope(request, 'characters:read')

  const wakuwakuMasters = await prisma.wakuwakuMaster.findMany({
    orderBy: { displayOrder: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      displayOrder: true,
    },
  })

  return NextResponse.json({ data: wakuwakuMasters })
})
