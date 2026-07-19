import type { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ApiError } from '@/lib/api/errors'
import { verifyApiKey } from '@/lib/api/api-key'
import type { ApiKeyScope } from '@/lib/api/scopes'

export type AuthMethod = 'session' | 'apiKey'

export type AuthenticatedUser = {
  userId: string
  role: string
  authMethod: AuthMethod
  // apiKey認証の場合のみ設定される。sessionの場合はundefined
  // (セッションにはスコープの概念がなく、role相当の権限をそのまま持つため)。
  scopes?: string[]
}

// RequestのAuthorizationヘッダから `Bearer <key>` の平文キーを取り出す。
// ヘッダが無い・形式が違う場合はnullを返す(セッション認証にフォールバックする合図)。
function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization')

  if (!header) {
    return null
  }

  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}

// セッションとAPIキーの両方に対応する認証の共通処理。
// - requestが渡され、かつAuthorization: Bearer <key>ヘッダがあればAPIキー認証
// - それ以外は従来通りセッション認証
//
// requestを渡さない(=呼び出し側が意図的に省略する)場合はAuthorizationヘッダを
// 一切見ないため、必ずセッション認証になる。これはAPIキー管理API
// (app/api/v1/api-keys/*)がAPIキーによる新規APIキー発行(=権限昇格の踏み台)を
// 防ぐために利用している。
async function authenticate(request?: NextRequest): Promise<AuthenticatedUser> {
  const bearerToken = request ? extractBearerToken(request) : null

  if (bearerToken !== null) {
    const verified = await verifyApiKey(bearerToken)

    if (!verified) {
      throw ApiError.unauthorized()
    }

    // キーは発行者のユーザーとして振る舞う。role判定は都度DBを参照する
    // (requireAdminの既存方針と同じく、権限剥奪が即座に反映されるようにするため)。
    const dbUser = await prisma.user.findUnique({ where: { id: verified.userId } })

    if (!dbUser) {
      throw ApiError.unauthorized()
    }

    return {
      userId: dbUser.id,
      role: dbUser.role,
      authMethod: 'apiKey',
      scopes: verified.scopes,
    }
  }

  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw ApiError.unauthorized()
  }

  return {
    userId: session.user.id,
    role: session.user.role,
    authMethod: 'session',
  }
}

// セッションの存在のみを確認する。ログイン済みであればよい一般APIで使用する。
// 従来通りセッション専用(Authorizationヘッダは見ない)。
export async function requireUser(): Promise<AuthenticatedUser> {
  return authenticate()
}

// セッションに加え、DB上のuser.roleが'admin'であることを必ず確認する。
// JWTのroleはログイン時点の情報が固定化されうるため、権限が剥奪された
// 場合でも即座に反映されるようDBを正として都度確認する
// (app/api/admin/characters/route.tsの既存パターンを踏襲)。
//
// requestを渡した場合はAPIキー認証にも対応する。ただしAPIキー認証で
// 通す場合は、キーの所有者がadminであることに加えて、キーに
// characters:writeスコープがあることを要求する。admin本人が発行した
// read専用キーでマスターデータを書き換えられてはいけないため。
//
// requestを省略した場合は必ずセッション認証になる(Authorizationヘッダを
// 見ないため)。APIキー管理API(発行・失効)はこの省略形を使うことで、
// APIキーによる新規APIキー発行(=権限昇格の踏み台)を防いでいる。
export async function requireAdmin(request?: NextRequest): Promise<AuthenticatedUser> {
  const user = await authenticate(request)

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
  })

  if (!dbUser || dbUser.role !== 'admin') {
    throw ApiError.forbidden()
  }

  if (user.authMethod === 'apiKey' && !user.scopes?.includes('characters:write')) {
    throw ApiError.forbidden()
  }

  return {
    userId: dbUser.id,
    role: dbUser.role,
    authMethod: user.authMethod,
    scopes: user.scopes,
  }
}

// セッション・APIキーいずれの認証方式でも使える、スコープベースの認可チェック。
// /api/v1/* の各ルートはこれを使って認証・認可を行う。
//
// - APIキー認証の場合: キーのscopesに`scope`が含まれていなければforbidden。
// - セッション認証の場合: 基本的にスコープチェックは行わない
//   (ブラウザからの従来の利用を壊さないため)。ただし`characters:write`は
//   admin相当の操作であるため、従来通りDB上のroleがadminであることを要求する
//   (=requireAdminと同じ基準に委譲する。APIキー認証の場合もrequireAdminへ
//   委譲することで、「admin発行のread専用キーで書き換えられない」という
//   requireAdminの制約をそのまま引き継げる)。
//
// 所有権チェック(assertOwnedCharacterOwner等)はこの関数の責務ではない。
// スコープは「何ができるか」であって「誰のデータか」ではないため、
// 呼び出し側で別途所有権チェックを行うこと。
export async function requireScope(
  request: NextRequest,
  scope: ApiKeyScope
): Promise<AuthenticatedUser> {
  if (scope === 'characters:write') {
    return requireAdmin(request)
  }

  const user = await authenticate(request)

  if (user.authMethod === 'apiKey' && !user.scopes?.includes(scope)) {
    throw ApiError.forbidden()
  }

  return user
}
