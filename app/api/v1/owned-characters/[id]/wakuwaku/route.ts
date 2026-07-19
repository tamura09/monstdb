import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withApiHandler } from '@/lib/api/handler'
import { requireScope } from '@/lib/api/auth'
import { assertOwnedCharacterOwner } from '@/lib/api/ownership'
import { parseJsonBody, cuidSchema } from '@/lib/api/validation'
import { wakuwakuLevelSchema } from '@/lib/api/schemas'
import { MAX_WAKUWAKU_SLOTS } from '@/lib/api/constants'
import { replaceWakuwakuSlots } from '@/lib/wakuwaku/slots'

// Next.js 16 では動的ルートの第2引数が Promise で渡ってくる
type RouteContext = { params: Promise<{ id: string }> }

// GET・PUT共通で使うselect（マスター情報も含めて返す）
const wakuwakuSlotSelect = {
  id: true,
  slotNumber: true,
  level: true,
  wakuwakuMaster: {
    select: {
      id: true,
      name: true,
      displayOrder: true,
    },
  },
} as const

// PUTのリクエストボディスキーマ。
// 上限件数・重複・存在しないマスターIDの検証はlib/wakuwaku/slots.tsの
// replaceWakuwakuSlotsに委譲するため、ここではスロット数と各フィールドの
// 形式のみを検証する。
const putWakuwakuSlotsSchema = z.object({
  slots: z
    .array(
      z.object({
        wakuwakuMasterId: cuidSchema,
        level: wakuwakuLevelSchema,
      })
    )
    .max(MAX_WAKUWAKU_SLOTS, `わくわくの実は最大${MAX_WAKUWAKU_SLOTS}個までしかセットできません`),
})

// GET /api/v1/owned-characters/{id}/wakuwaku — わくわくの実セット取得
export const GET = withApiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { userId } = await requireScope(request, 'accounts:read')
  const { id } = await context.params

  // 所有権検証（見つからない場合・他人のものである場合は一律404）
  await assertOwnedCharacterOwner(id, userId)

  const slots = await prisma.ownedCharacterWakuwaku.findMany({
    where: { ownedCharacterId: id },
    orderBy: { slotNumber: 'asc' },
    select: wakuwakuSlotSelect,
  })

  return NextResponse.json({ data: slots, maxSlots: MAX_WAKUWAKU_SLOTS })
})

// PUT /api/v1/owned-characters/{id}/wakuwaku — わくわくの実セット一括置換
// 空配列を渡した場合は「全スロット解除」として正常に受け付ける。
// 実処理（検証・削除・作成・スロット番号の正規化）はlib/wakuwaku/slots.tsの
// replaceWakuwakuSlotsに一本化されている。
export const PUT = withApiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { userId } = await requireScope(request, 'accounts:write')
  const { id } = await context.params

  // 所有権検証（見つからない場合・他人のものである場合は一律404）
  await assertOwnedCharacterOwner(id, userId)

  const { slots } = await parseJsonBody(request, putWakuwakuSlotsSchema)

  await replaceWakuwakuSlots(id, slots)

  const updatedSlots = await prisma.ownedCharacterWakuwaku.findMany({
    where: { ownedCharacterId: id },
    orderBy: { slotNumber: 'asc' },
    select: wakuwakuSlotSelect,
  })

  return NextResponse.json({ data: updatedSlots, maxSlots: MAX_WAKUWAKU_SLOTS })
})
