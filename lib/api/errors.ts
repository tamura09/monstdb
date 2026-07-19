// REST API共通のエラー型とヘルパー
//
// Route Handler 内でこれをthrowすると、lib/api/handler.ts の withApiHandler が
// 捕捉して統一されたエラーレスポンス
//   { "error": { "code": "...", "message": "...", "details": ... } }
// に変換する。

export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation_error'
  | 'conflict'
  | 'internal_error'

// エラーコードからHTTPステータスコードへの対応表
const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  validation_error: 422,
  conflict: 409,
  internal_error: 500,
}

export class ApiError extends Error {
  readonly code: ApiErrorCode
  readonly status: number
  readonly details?: unknown

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = API_ERROR_STATUS[code]
    this.details = details
  }

  static unauthorized(message = '認証が必要です', details?: unknown): ApiError {
    return new ApiError('unauthorized', message, details)
  }

  static forbidden(message = 'この操作を行う権限がありません', details?: unknown): ApiError {
    return new ApiError('forbidden', message, details)
  }

  static notFound(message = '指定されたリソースが見つかりません', details?: unknown): ApiError {
    return new ApiError('not_found', message, details)
  }

  static validation(message = 'リクエストの内容が不正です', details?: unknown): ApiError {
    return new ApiError('validation_error', message, details)
  }

  static conflict(message = '既存のデータと競合しています', details?: unknown): ApiError {
    return new ApiError('conflict', message, details)
  }
}

// エラーレスポンスのボディ形式。handler.ts がこの形でJSONを返す。
export type ApiErrorResponseBody = {
  error: {
    code: ApiErrorCode
    message: string
    details?: unknown
  }
}
