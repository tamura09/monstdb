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

// PostgreSQLのSQLSTATEのうち、競合として409へ変換すべきもの。
// 40P01: deadlock_detected（同時実行時の行ロック取得順序の食い違い）
// 40001: serialization_failure（SERIALIZABLE分離レベルでの書き込み競合）
// いずれもクライアントがリトライすれば成功し得る一時的な競合であり、
// サーバー内部エラー(500)として扱うべきではない。
const RETRYABLE_POSTGRES_SQLSTATES = new Set(['40P01', '40001'])

// Prisma 7 + @prisma/adapter-pg構成では、PostgreSQLが返したエラーは
// Prisma.PrismaClientKnownRequestErrorではなく@prisma/driver-adapter-utilsの
// DriverAdapterErrorとしてスローされる。DriverAdapterErrorはプロジェクトの
// 直接依存ではない（Prisma内部の間接依存）ため、bundlerの解決状況によっては
// `instanceof DriverAdapterError`が偽になり得る。そのため型ではなく
// error.cause（さらにその先のcause）を辿り、SQLSTATEを持つプロパティを
// ダックタイピングで探す。
//
// DriverAdapterError.cause の実際の形（ローカルPostgresでの実測）:
//   { kind: 'postgres', code: '40P01', originalCode: '40P01', ... }  (40P01の場合)
//   { kind: 'TransactionWriteConflict', originalCode: '40001', ... } (40001の場合)
// kindが既知のエラー種別にマップされるとcodeが省略されることがあるため、
// 常に存在するoriginalCodeを優先しつつ、codeもフォールバックとして見る。
function findPostgresSqlState(error: unknown, depth = 0): string | undefined {
  if (!error || typeof error !== 'object' || depth > 5) {
    return undefined
  }

  const record = error as Record<string, unknown>
  const sqlState = record.originalCode ?? record.code

  if (typeof sqlState === 'string') {
    return sqlState
  }

  if ('cause' in record) {
    return findPostgresSqlState(record.cause, depth + 1)
  }

  return undefined
}

// Route Handler をラップし、内部でthrowされたエラーを統一レスポンスへ変換する高階関数。
// - ApiError: 保持しているコード・ステータスに変換
// - ZodError: 422 validation_error に変換し、issuesをdetailsへ格納
// - Prisma の既知エラー: P2002(一意制約違反)→409、P2025(レコード無し)→404
// - PostgreSQLのデッドロック(40P01)・シリアライズ失敗(40001)→409
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

  const postgresSqlState = findPostgresSqlState(error)
  if (postgresSqlState && RETRYABLE_POSTGRES_SQLSTATES.has(postgresSqlState)) {
    return NextResponse.json(
      {
        error: {
          code: 'conflict',
          message: '一時的な競合が発生しました。もう一度お試しください',
        },
      },
      { status: 409 }
    )
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
