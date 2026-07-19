import { z } from 'zod'
import { ApiError } from '@/lib/api/errors'

// リクエストボディをJSONとしてパースし、指定したzodスキーマで検証する。
// JSON自体が不正な場合はApiError.validation()をthrowする。
// スキーマに一致しない場合はzodのparseAsyncがZodErrorをthrowし、
// それをwithApiHandler(lib/api/handler.ts)が422へ変換する。
export async function parseJsonBody<Schema extends z.ZodType>(
  request: Request,
  schema: Schema
): Promise<z.infer<Schema>> {
  let body: unknown

  try {
    body = await request.json()
  } catch {
    throw ApiError.validation('リクエストボディが不正なJSONです')
  }

  return schema.parseAsync(body)
}

// URLSearchParamsを対象にクエリパラメータを検証する。
// スキーマに一致しない場合はZodErrorをthrowする(parseJsonBodyと同様)。
export async function parseQuery<Schema extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: Schema
): Promise<z.infer<Schema>> {
  const query = Object.fromEntries(searchParams.entries())
  return schema.parseAsync(query)
}

// ページネーション共通スキーマ。
// クエリパラメータは常に文字列で渡ってくるため z.coerce.number() で数値化する。
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(50),
})

// ID用の非空文字列スキーマ(cuid形式のID共通バリデーション)
export const cuidSchema = z.string().min(1, 'IDを指定してください')
