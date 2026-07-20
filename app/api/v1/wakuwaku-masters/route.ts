import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { withApiHandler } from '@/lib/api/handler'
import { requireScope } from '@/lib/api/auth'
import { getCachedWakuwakuMasters } from '@/lib/cache/master-data'

// GET /api/v1/wakuwaku-masters — わくわくの実マスター一覧取得
// PUT /api/v1/owned-characters/{id}/wakuwaku に渡すwakuwakuMasterIdを
// クライアントが引くためのエンドポイント。ログイン済みユーザーなら誰でも可。
export const GET = withApiHandler(async (request: NextRequest) => {
  await requireScope(request, 'characters:read')

  const allWakuwakuMasters = await getCachedWakuwakuMasters()
  const wakuwakuMasters = allWakuwakuMasters.map(({ id, name, description, displayOrder }) => ({
    id,
    name,
    description,
    displayOrder,
  }))

  return NextResponse.json({ data: wakuwakuMasters })
})
