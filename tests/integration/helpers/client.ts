import { inject } from 'vitest'

// 認証方法。cookie(NextAuthセッション) と bearer(APIキー) のいずれか。
// 両方 undefined の場合は未認証リクエストになる。
export type Auth = {
  cookie?: string
  bearer?: string
}

export type ApiResponse<T = any> = {
  status: number
  body: T
  headers: Headers
}

export type RequestOptions = {
  // JSON.stringify してボディにする値
  json?: unknown
  // 壊れたJSONなど、生の文字列をそのまま送りたい場合に使う
  raw?: string
  // クライアント既定の認証情報を上書きする(未認証にしたい場合は {} を渡す)
  auth?: Auth
  // クエリ文字列(エンコード済みの生文字列)
  query?: string
}

export function baseUrl(): string {
  return inject('baseUrl')
}

// /api/v1 配下へHTTPリクエストを投げる薄いクライアント。
// 移植元のシェルスクリプトが curl で行っていたことをそのまま置き換える。
export function createApiClient(defaultAuth?: Auth) {
  async function request(
    method: string,
    path: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse> {
    const auth = options.auth !== undefined ? options.auth : defaultAuth
    const headers: Record<string, string> = {}

    if (auth?.cookie) {
      headers['Cookie'] = auth.cookie
    }

    if (auth?.bearer !== undefined) {
      headers['Authorization'] = `Bearer ${auth.bearer}`
    }

    let body: string | undefined

    if (options.raw !== undefined) {
      body = options.raw
      headers['Content-Type'] = 'application/json'
    } else if (options.json !== undefined) {
      body = JSON.stringify(options.json)
      headers['Content-Type'] = 'application/json'
    }

    const url = `${baseUrl()}/api/v1${path}${options.query ?? ''}`
    const response = await fetch(url, { method, headers, body })
    const text = await response.text()

    let parsed: unknown = undefined

    if (text) {
      try {
        parsed = JSON.parse(text)
      } catch {
        // JSON以外(想定外のHTMLエラーページなど)は生文字列のまま返し、
        // 失敗時のメッセージで中身が分かるようにする
        parsed = text
      }
    }

    return { status: response.status, body: parsed, headers: response.headers }
  }

  return {
    request,
    get: (path: string, options?: RequestOptions) => request('GET', path, options),
    post: (path: string, options?: RequestOptions) => request('POST', path, options),
    patch: (path: string, options?: RequestOptions) => request('PATCH', path, options),
    put: (path: string, options?: RequestOptions) => request('PUT', path, options),
    delete: (path: string, options?: RequestOptions) => request('DELETE', path, options),
  }
}

export type ApiClient = ReturnType<typeof createApiClient>

// 未認証クライアント
export const anonymousClient = () => createApiClient(undefined)
