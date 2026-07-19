import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiHandler } from '@/lib/api/handler'
import { requireUser } from '@/lib/api/auth'
import { assertOwnedCharacterOwner } from '@/lib/api/ownership'

// Next.js 16 では動的ルートの第2引数が Promise で渡ってくる
type RouteContext = { params: Promise<{ id: string }> }

// GET /api/v1/owned-characters/{id} — 所持キャラ単体取得
export const GET = withApiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { userId } = await requireUser()
  const { id } = await context.params

  // 所有権検証（見つからない場合・他人のものである場合は一律404）
  await assertOwnedCharacterOwner(id, userId)

  const ownedCharacter = await prisma.ownedCharacter.findUnique({
    where: { id },
    include: {
      characterMaster: {
        select: {
          id: true,
          indexNumber: true,
          monsterName: true,
          element: true,
          type: true,
        },
      },
      wakuwakuSlots: {
        orderBy: { slotNumber: 'asc' },
        select: {
          id: true,
          slotNumber: true,
          level: true,
          wakuwakuMaster: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  return NextResponse.json(ownedCharacter)
})

// DELETE /api/v1/owned-characters/{id} — 所持キャラ削除
// OwnedCharacterWakuwakuはonDelete: Cascadeのため明示的な削除は不要
export const DELETE = withApiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { userId } = await requireUser()
  const { id } = await context.params

  // 所有権検証（見つからない場合・他人のものである場合は一律404）
  await assertOwnedCharacterOwner(id, userId)

  await prisma.ownedCharacter.delete({ where: { id } })

  return new NextResponse(null, { status: 204 })
})
