import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { withApiHandler } from '@/lib/api/handler'
import { requireScope } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/errors'
import { parseJsonBody } from '@/lib/api/validation'
import { characterMasterUpdateSchema } from '@/lib/api/schemas'
import { CHARACTER_MASTER_CACHE_TAG } from '@/lib/cache/master-data'

// Next.js 16 では動的ルートの第2引数が Promise で渡ってくる
type RouteContext = { params: Promise<{ id: string }> }

// GET /api/v1/characters/{id} — キャラクターマスター単体取得(ログイン済みユーザーなら誰でも可)
export const GET = withApiHandler<RouteContext>(async (request: NextRequest, context) => {
  await requireScope(request, 'characters:read')

  const { id } = await context.params

  const character = await prisma.characterMaster.findUnique({ where: { id } })

  if (!character) {
    throw ApiError.notFound()
  }

  return NextResponse.json(character)
})

// PATCH /api/v1/characters/{id} — キャラクターマスター部分更新(admin限定)
export const PATCH = withApiHandler<RouteContext>(async (request: NextRequest, context) => {
  await requireScope(request, 'characters:write')

  const { id } = await context.params
  const data = await parseJsonBody(request, characterMasterUpdateSchema)

  // indexNumberを変更する場合、自分以外との重複を確認する
  if (data.indexNumber !== undefined) {
    const conflicting = await prisma.characterMaster.findFirst({
      where: {
        indexNumber: data.indexNumber,
        NOT: { id },
      },
    })

    if (conflicting) {
      throw ApiError.conflict('指定されたindexNumberは既に使用されています')
    }
  }

  // 空ボディは「変更なし」として現在のリソースをそのまま返す
  if (Object.keys(data).length === 0) {
    const character = await prisma.characterMaster.findUnique({ where: { id } })

    if (!character) {
      throw ApiError.notFound()
    }

    return NextResponse.json(character)
  }

  const character = await prisma.characterMaster.update({
    where: { id },
    data,
  })

  revalidateTag(CHARACTER_MASTER_CACHE_TAG, 'max')

  return NextResponse.json(character)
})

// DELETE /api/v1/characters/{id} — キャラクターマスター削除(admin限定)
export const DELETE = withApiHandler<RouteContext>(async (request: NextRequest, context) => {
  await requireScope(request, 'characters:write')

  const { id } = await context.params

  await prisma.characterMaster.delete({ where: { id } })

  revalidateTag(CHARACTER_MASTER_CACHE_TAG, 'max')

  return new NextResponse(null, { status: 204 })
})
