import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import type { ApiKey } from '@/generated/prisma/client'

// 表示・検索用に保存するプレフィックスの長さ(平文キーの先頭N文字)
const KEY_PREFIX_LENGTH = 12

// lastUsedAtの更新間隔。検証は認証つきリクエストのたびに走るため、
// 毎回UPDATEすると書き込み負荷になる。前回更新から一定時間経っていない
// 場合は更新をスキップする。
const LAST_USED_UPDATE_INTERVAL_MS = 60 * 1000 // 1分

// キーの環境識別子。Stripeのsk_live_/sk_test_と同様の考え方で、
// 本番発行のキーと検証・プレビュー環境で発行したキーを見分けられるようにする。
// VERCEL_ENVが取得できない(ローカル開発など)場合はNODE_ENVで代用する。
function getEnvIdentifier(): 'live' | 'test' {
  const vercelEnv = process.env.VERCEL_ENV

  if (vercelEnv === 'production') {
    return 'live'
  }

  if (vercelEnv) {
    // preview / development (Vercel)
    return 'test'
  }

  return process.env.NODE_ENV === 'production' ? 'live' : 'test'
}

export function hashApiKeyPlaintext(plaintextKey: string): string {
  return crypto.createHash('sha256').update(plaintextKey, 'utf8').digest('hex')
}

export type GeneratedApiKey = {
  // 発行レスポンスで一度だけ返す平文キー。DBには保存しない。
  plaintextKey: string
  keyPrefix: string
  keyHash: string
}

// 新規APIキーを生成する。
// - キー形式: `mdb_` + 環境識別子 + `_` + ランダム部
// - ランダム部はcrypto.randomBytes(32)をbase64urlエンコードしたもの。
//   Math.random()は暗号論的に安全ではないため絶対に使わない。
export function generateApiKey(): GeneratedApiKey {
  const randomPart = crypto.randomBytes(32).toString('base64url')
  const plaintextKey = `mdb_${getEnvIdentifier()}_${randomPart}`

  return {
    plaintextKey,
    keyPrefix: plaintextKey.slice(0, KEY_PREFIX_LENGTH),
    keyHash: hashApiKeyPlaintext(plaintextKey),
  }
}

// SHA-256ハッシュ(hex文字列, 常に64文字)同士をタイミング攻撃に強い方法で比較する。
// crypto.timingSafeEqualは長さが異なるBufferを渡すと例外を投げるため、
// 比較前に必ず長さを揃える(一致しなければ即falseを返す)。
function timingSafeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')

  if (bufA.length !== bufB.length) {
    return false
  }

  return crypto.timingSafeEqual(bufA, bufB)
}

export type VerifiedApiKey = {
  id: string
  userId: string
  scopes: string[]
}

// Authorizationヘッダから取り出した平文キーを検証する。
// 手順:
//   1. keyPrefixで対象レコードを1件引く(keyPrefixは@uniqueなので高々1件)
//   2. 平文キーをハッシュ化し、保存されているkeyHashとcrypto.timingSafeEqualで比較
//      (===での文字列比較はタイミング攻撃に晒されるため使わない)
//   3. revokedAtが設定済み、またはexpiresAtを過ぎていれば無効
//   4. 検証成功時はlastUsedAtを更新する(前回更新から1分未満なら更新しない)
// 無効な場合はnullを返す。呼び出し側(lib/api/auth.ts)でApiError.unauthorized()に変換する。
export async function verifyApiKey(plaintextKey: string): Promise<VerifiedApiKey | null> {
  if (!plaintextKey.startsWith('mdb_')) {
    return null
  }

  const keyPrefix = plaintextKey.slice(0, KEY_PREFIX_LENGTH)

  const apiKey = await prisma.apiKey.findUnique({ where: { keyPrefix } })

  if (!apiKey) {
    return null
  }

  const candidateHash = hashApiKeyPlaintext(plaintextKey)

  if (!timingSafeHexEqual(candidateHash, apiKey.keyHash)) {
    return null
  }

  if (apiKey.revokedAt) {
    return null
  }

  if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
    return null
  }

  await touchLastUsedAt(apiKey)

  return {
    id: apiKey.id,
    userId: apiKey.userId,
    scopes: apiKey.scopes,
  }
}

// lastUsedAtを更新する。負荷軽減のため、前回更新から
// LAST_USED_UPDATE_INTERVAL_MS未満の場合は何もしない。
// この更新はベストエフォートであり、認証結果そのものには影響しないため
// 失敗してもリクエスト処理は継続してよい。
async function touchLastUsedAt(apiKey: ApiKey): Promise<void> {
  const now = Date.now()

  if (apiKey.lastUsedAt && now - apiKey.lastUsedAt.getTime() < LAST_USED_UPDATE_INTERVAL_MS) {
    return
  }

  await prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date(now) },
    })
    .catch((error) => {
      console.error('APIキーのlastUsedAt更新に失敗しました:', error)
    })
}
