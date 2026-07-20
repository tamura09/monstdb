import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'

// 統合テストが接続してよいDBホストのホワイトリスト。
// 'postgres' は docker-compose / GitHub Actions の service コンテナ名を想定。
const ALLOWED_DB_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres'])

// テスト用の環境変数を読み込む。
//
// 優先順位は「既に process.env にある値」が最優先(dotenv は既存値を上書きしない)。
// CI では GitHub Actions の env: で直接渡すため .env.test は存在しなくてよい。
// ローカルでは .env.test を置いておくと `npm run test` だけで実行できる。
//
// 注意: リポジトリ直下の .env はアプリの本番設定が入り得るため、ここでは
// 絶対に読み込まない。読み込むのは .env.test のみ。
export function loadTestEnv(): void {
  const envTestPath = path.resolve(process.cwd(), '.env.test')

  if (fs.existsSync(envTestPath)) {
    dotenv.config({ path: envTestPath, override: false, quiet: true })
  }
}

// テストが本番DBへ接続してしまう事故を防ぐためのガード。
// DATABASE_URL のホストがローカル/CI用でない場合は即座に失敗させる。
export function assertLocalTestDatabase(): void {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error(
      '統合テストには DATABASE_URL が必要です。\n' +
        '.env.test を用意するか、環境変数で渡してください。\n' +
        '例: DATABASE_URL="postgresql://postgres:postgres@localhost:5432/monstdb_test"'
    )
  }

  let host: string

  try {
    host = new URL(databaseUrl).hostname
  } catch {
    throw new Error(`DATABASE_URL をURLとして解釈できません: ${databaseUrl}`)
  }

  if (!ALLOWED_DB_HOSTS.has(host)) {
    throw new Error(
      `統合テストはローカル/CIのDBに対してのみ実行できます(接続先ホスト: ${host})。\n` +
        '本番DBへ接続してデータを破壊するのを防ぐためのガードです。\n' +
        `許可されているホスト: ${Array.from(ALLOWED_DB_HOSTS).join(', ')}`
    )
  }

  if (!process.env.NEXTAUTH_SECRET) {
    throw new Error(
      '統合テストには NEXTAUTH_SECRET が必要です(セッションJWTの署名に使用します)。\n' +
        'CI・ローカルともにダミー値で構いません。'
    )
  }
}
