import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withApiHandler } from '@/lib/api/handler'
import { requireAdmin } from '@/lib/api/auth'
import { parseJsonBody } from '@/lib/api/validation'
import { apiKeyScopeSchema } from '@/lib/api/scopes'
import { generateApiKey } from '@/lib/api/api-key'

// keyHashを絶対に含めない一覧・単体表示用のselect
const apiKeyPublicSelect = {
  id: true,
  name: true,
  keyPrefix: true,
  scopes: true,
  lastUsedAt: true,
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
} as const

const createApiKeySchema = z.object({
  name: z.string().min(1, '名前を入力してください'),
  scopes: z
    .array(apiKeyScopeSchema)
    .min(1, 'スコープを1つ以上指定してください'),
  // z.coerce.date() は内部で new Date() を呼ぶため、boolean や数値まで
  // 日時に変換してしまう(new Date(true) === 1970-01-01T00:00:00.001Z)。
  // その結果 expiresAt: true で「発行直後に期限切れの使えないキー」が
  // 黙って作られてしまうため、ISO 8601 の文字列のみを受け付ける。
  expiresAt: z
    .string()
    .datetime({ message: 'expiresAtはISO 8601形式の日時文字列で指定してください' })
    .transform((value) => new Date(value))
    .optional(),
})

// GET /api/v1/api-keys — 自分が発行したAPIキーの一覧取得
// requireAdmin()はrequestを渡さず呼ぶことで、必ずセッション認証に限定する
// (APIキーでこのエンドポイントを叩けてしまうと、キーの一覧を取得したり
//  権限昇格の足がかりになったりするため)。
export const GET = withApiHandler(async () => {
  const { userId } = await requireAdmin()

  const apiKeys = await prisma.apiKey.findMany({
    where: { userId },
    select: apiKeyPublicSelect,
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ data: apiKeys })
})

// POST /api/v1/api-keys — APIキー発行(admin限定・セッション認証限定)
// 平文キーはこのレスポンスでのみ返す。以降は二度と取得できない
// (DBにはkeyHashのみ保存されるため)。
// requireAdmin()はrequestを渡さず呼ぶ(GETと同じ理由。APIキーを使って
// 新しいAPIキーを発行できると権限昇格の踏み台になるため、常にセッション認証を要求する)。
export const POST = withApiHandler(async (request: NextRequest) => {
  const { userId } = await requireAdmin()

  const { name, scopes, expiresAt } = await parseJsonBody(request, createApiKeySchema)

  const { plaintextKey, keyPrefix, keyHash } = generateApiKey()

  const apiKey = await prisma.apiKey.create({
    data: {
      userId,
      name,
      keyPrefix,
      keyHash,
      scopes: Array.from(new Set(scopes)),
      expiresAt,
    },
    select: apiKeyPublicSelect,
  })

  return NextResponse.json({ key: plaintextKey, apiKey }, { status: 201 })
})
