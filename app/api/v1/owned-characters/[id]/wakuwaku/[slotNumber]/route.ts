import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withApiHandler } from '@/lib/api/handler'
import { requireScope } from '@/lib/api/auth'
import { ApiError } from '@/lib/api/errors'
import { assertOwnedCharacterOwner } from '@/lib/api/ownership'
import { MAX_WAKUWAKU_SLOTS } from '@/lib/api/constants'
import { acquireSlotLock, normalizeSlotNumbers } from '@/lib/wakuwaku/slots'

// Next.js 16 では動的ルートの第2引数が Promise で渡ってくる
type RouteContext = { params: Promise<{ id: string; slotNumber: string }> }

// slotNumberは1〜MAX_WAKUWAKU_SLOTSの整数のみ許可する。範囲外・非数値は422。
const slotNumberParamSchema = z.coerce.number().int().min(1).max(MAX_WAKUWAKU_SLOTS)

// DELETE /api/v1/owned-characters/{id}/wakuwaku/{slotNumber} — スロット1個解除
// 削除後は残りのスロットを1..Nへ詰め直す必要があるため、削除と正規化を
// 同一トランザクション内でlib/wakuwaku/slots.tsのnormalizeSlotNumbersに委譲する。
export const DELETE = withApiHandler<RouteContext>(async (request: NextRequest, context) => {
  const { userId } = await requireScope(request, 'accounts:write')
  const { id, slotNumber: slotNumberParam } = await context.params

  // 所有権検証（見つからない場合・他人のものである場合は一律404）
  await assertOwnedCharacterOwner(id, userId)

  const slotNumber = await slotNumberParamSchema.parseAsync(slotNumberParam)

  await prisma.$transaction(async (tx) => {
    // 同一ownedCharacterIdへの並行操作(このDELETEおよびPUT)を直列化する。
    // トランザクション内で最初に実行すること。
    await acquireSlotLock(tx, id)

    const slot = await tx.ownedCharacterWakuwaku.findUnique({
      where: {
        ownedCharacterId_slotNumber: {
          ownedCharacterId: id,
          slotNumber,
        },
      },
    })

    if (!slot) {
      throw ApiError.notFound()
    }

    await tx.ownedCharacterWakuwaku.delete({ where: { id: slot.id } })

    await normalizeSlotNumbers(tx, id)
  })

  return new NextResponse(null, { status: 204 })
})
