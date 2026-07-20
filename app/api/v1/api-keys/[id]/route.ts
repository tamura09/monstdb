import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiHandler } from '@/lib/api/handler'
import { requireAdmin } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/errors'

// Next.js 16 では動的ルートの第2引数が Promise で渡ってくる
type RouteContext = { params: Promise<{ id: string }> }

// DELETE /api/v1/api-keys/{id} — APIキーの失効(admin限定・セッション認証限定)
// 物理削除はせず、revokedAtを立てるのみ(監査目的で発行履歴を残す)。
// requireAdmin()はrequestを渡さず呼ぶ(POST /api/v1/api-keysと同じ理由で、
// APIキーによる操作を許さずセッション認証のみに限定する)。
// 他人のキーは「存在しない」場合と区別せず一律404にする
// (lib/api/ownership.tsの所有権チェックと同じ設計方針)。
export const DELETE = withApiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { userId } = await requireAdmin()
  const { id } = await context.params

  const apiKey = await prisma.apiKey.findUnique({ where: { id } })

  if (!apiKey || apiKey.userId !== userId) {
    throw ApiError.notFound()
  }

  if (!apiKey.revokedAt) {
    await prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    })
  }

  return new NextResponse(null, { status: 204 })
})
