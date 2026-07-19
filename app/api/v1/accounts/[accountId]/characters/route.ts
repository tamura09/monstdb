import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withApiHandler } from '@/lib/api/handler'
import { requireScope } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/errors'
import { assertGameAccountOwner } from '@/lib/api/ownership'
import { parseJsonBody, parseQuery, paginationSchema, cuidSchema } from '@/lib/api/validation'
import { elementSchema, characterTypeSchema } from '@/lib/api/schemas'
import { matchesJapaneseOr } from '@/lib/string-utils'

// Next.js 16 では動的ルートの第2引数が Promise で渡ってくる
type RouteContext = { params: Promise<{ accountId: string }> }

// 一覧取得のクエリパラメータ。/api/v1/characters と同じ流儀でページング・絞り込みを受け付ける
const listQuerySchema = paginationSchema.extend({
  element: elementSchema.optional(),
  type: characterTypeSchema.optional(),
  search: z.string().optional(),
})

// 所持キャラ登録のリクエストボディスキーマ
const createOwnedCharacterSchema = z.object({
  characterMasterId: cuidSchema,
})

// 一覧・詳細取得時に共通で使う include（characterMasterとwakuwakuSlotsを展開する）
const ownedCharacterInclude = {
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
    orderBy: { slotNumber: 'asc' as const },
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
}

// GET /api/v1/accounts/{accountId}/characters — 指定アカウントの所持キャラ一覧取得
export const GET = withApiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { userId } = await requireScope(request, 'accounts:read')
  const { accountId } = await context.params

  // 所有権検証（見つからない場合・他人のものである場合は一律404）
  await assertGameAccountOwner(accountId, userId)

  const { searchParams } = new URL(request.url)
  const { page, perPage, element, type, search } = await parseQuery(searchParams, listQuerySchema)

  // element/typeはDBレベルで絞り込む
  let ownedCharacters = await prisma.ownedCharacter.findMany({
    where: {
      gameAccountId: accountId,
      characterMaster: {
        ...(element && { element }),
        ...(type && { type }),
      },
    },
    include: ownedCharacterInclude,
    orderBy: { characterMaster: { indexNumber: 'asc' } },
  })

  // searchはひらがな・カタカナを区別しないJS側の照合のためDBでは絞り込めない。
  // ページングは必ずこのフィルタ後の結果に対して適用する(順序を誤ると件数がずれる)。
  if (search) {
    ownedCharacters = ownedCharacters.filter((ownedCharacter) =>
      matchesJapaneseOr(ownedCharacter.characterMaster.monsterName, search)
    )
  }

  const total = ownedCharacters.length
  const totalPages = Math.ceil(total / perPage)
  const data = ownedCharacters.slice((page - 1) * perPage, page * perPage)

  return NextResponse.json({
    data,
    pagination: { page, perPage, total, totalPages },
  })
})

// POST /api/v1/accounts/{accountId}/characters — 所持キャラ登録
// OwnedCharacterは同キャラを複数所持できる（ユニーク制約なし）ため、
// 呼び出すたびに常に新規レコードを作成する（冪等ではない）
export const POST = withApiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { userId } = await requireScope(request, 'accounts:write')
  const { accountId } = await context.params

  // 所有権検証（見つからない場合・他人のものである場合は一律404）
  await assertGameAccountOwner(accountId, userId)

  const { characterMasterId } = await parseJsonBody(request, createOwnedCharacterSchema)

  const characterMaster = await prisma.characterMaster.findUnique({
    where: { id: characterMasterId },
  })

  if (!characterMaster) {
    throw ApiError.validation('指定されたcharacterMasterIdは存在しません')
  }

  const ownedCharacter = await prisma.ownedCharacter.create({
    data: {
      gameAccountId: accountId,
      characterMasterId,
    },
    include: ownedCharacterInclude,
  })

  return NextResponse.json(ownedCharacter, {
    status: 201,
    headers: { Location: `/api/v1/owned-characters/${ownedCharacter.id}` },
  })
})
