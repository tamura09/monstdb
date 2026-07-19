import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { ZodError } from 'zod'
import { Prisma } from '@/generated/prisma/client'
import { ApiError, type ApiErrorResponseBody } from '@/lib/api/errors'

// Route Handler のシグネチャ。
// Next.js 16 では動的ルートの第2引数が { params: Promise<...> } になるため、
// Context をそのまま透過させられるようにジェネリックにしている。
export type ApiRouteHandler<Context = unknown> = (
  request: NextRequest,
  context: Context
) => Promise<NextResponse>

// Route Handler をラップし、内部でthrowされたエラーを統一レスポンスへ変換する高階関数。
// - ApiError: 保持しているコード・ステータスに変換
// - ZodError: 422 validation_error に変換し、issuesをdetailsへ格納
// - Prisma の既知エラー: P2002(一意制約違反)→409、P2025(レコード無し)→404
// - それ以外: console.errorでログしたうえで500(詳細はレスポンスに含めない)
export function withApiHandler<Context = unknown>(
  fn: ApiRouteHandler<Context>
): ApiRouteHandler<Context> {
  return async (request, context) => {
    try {
      return await fn(request, context)
    } catch (error) {
      return toErrorResponse(error)
    }
  }
}

function toErrorResponse(error: unknown): NextResponse<ApiErrorResponseBody> {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status }
    )
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: 'validation_error',
          message: 'リクエストの内容が不正です',
          details: error.issues,
        },
      },
      { status: 422 }
    )
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        {
          error: {
            code: 'conflict',
            message: '一意制約に違反しています',
            details: error.meta,
          },
        },
        { status: 409 }
      )
    }

    if (error.code === 'P2025') {
      return NextResponse.json(
        {
          error: {
            code: 'not_found',
            message: '指定されたレコードが見つかりません',
          },
        },
        { status: 404 }
      )
    }
  }

  // 想定外のエラー。スタックや詳細はレスポンスに含めず、サーバーログにのみ出力する。
  console.error('予期しないAPIエラー:', error)
  return NextResponse.json(
    {
      error: {
        code: 'internal_error',
        message: 'サーバー内部でエラーが発生しました',
      },
    },
    { status: 500 }
  )
}
