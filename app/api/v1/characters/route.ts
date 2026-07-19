import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withApiHandler } from '@/lib/api/handler'
import { requireScope } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/errors'
import { parseJsonBody, parseQuery, paginationSchema } from '@/lib/api/validation'
import { elementSchema, characterTypeSchema, characterMasterCreateSchema } from '@/lib/api/schemas'
import { matchesJapaneseOr } from '@/lib/string-utils'

// 一覧取得のクエリパラメータ。ページングに加え、element/typeでの絞り込みと
// モンスター名でのあいまい検索(search)を受け付ける。
const listQuerySchema = paginationSchema.extend({
  element: elementSchema.optional(),
  type: characterTypeSchema.optional(),
  search: z.string().optional(),
})

// GET /api/v1/characters — キャラクターマスター一覧取得(ログイン済みユーザーなら誰でも可)
export const GET = withApiHandler(async (request: NextRequest) => {
  await requireScope(request, 'characters:read')

  const { searchParams } = new URL(request.url)
  const { page, perPage, element, type, search } = await parseQuery(searchParams, listQuerySchema)

  // element/typeはDBレベルで絞り込む(app/accounts/page.tsxと同じ方針)
  let characters = await prisma.characterMaster.findMany({
    where: {
      ...(element && { element }),
      ...(type && { type }),
    },
    select: {
      id: true,
      indexNumber: true,
      monsterName: true,
      element: true,
      type: true,
      createdAt: true,
    },
    orderBy: { indexNumber: 'asc' },
  })

  // searchはひらがな・カタカナを区別しないJS側の照合のためDBでは絞り込めない。
  // ページングは必ずこのフィルタ後の結果に対して適用する(順序を誤ると件数がずれる)。
  if (search) {
    characters = characters.filter((character) => matchesJapaneseOr(character.monsterName, search))
  }

  const total = characters.length
  const totalPages = Math.ceil(total / perPage)
  const data = characters.slice((page - 1) * perPage, page * perPage)

  return NextResponse.json({
    data,
    pagination: { page, perPage, total, totalPages },
  })
})

// POST /api/v1/characters — キャラクターマスター新規作成(admin限定)
export const POST = withApiHandler(async (request: NextRequest) => {
  await requireScope(request, 'characters:write')

  const data = await parseJsonBody(request, characterMasterCreateSchema)

  // indexNumberの重複チェック
  const existing = await prisma.characterMaster.findUnique({
    where: { indexNumber: data.indexNumber },
  })

  if (existing) {
    throw ApiError.conflict('指定されたindexNumberは既に使用されています')
  }

  const character = await prisma.characterMaster.create({ data })

  return NextResponse.json(character, {
    status: 201,
    headers: { Location: `/api/v1/characters/${character.id}` },
  })
})
