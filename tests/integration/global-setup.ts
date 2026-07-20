import { spawn, type ChildProcess } from 'node:child_process'
import net from 'node:net'
import type { TestProject } from 'vitest/node'
import { loadTestEnv, assertLocalTestDatabase } from './helpers/env'

// サーバー起動を待つ上限。CI の初回起動 + Next のコンパイルを見込んで長めに取る。
const SERVER_READY_TIMEOUT_MS = 240_000
const SERVER_POLL_INTERVAL_MS = 500

// next dev は初回リクエスト時に該当ルートをコンパイルするため、
// テスト本体の前に主要ルートを1回ずつ叩いて温めておく。
// (これをやらないと最初のテストだけ極端に遅くなり、タイムアウトの原因になる)
const WARMUP_PATHS = [
  '/api/v1/characters',
  '/api/v1/characters/warmup',
  '/api/v1/accounts',
  '/api/v1/accounts/warmup/characters',
  '/api/v1/owned-characters/warmup',
  '/api/v1/owned-characters/warmup/wakuwaku',
  '/api/v1/owned-characters/warmup/wakuwaku/1',
  '/api/v1/wakuwaku-masters',
  '/api/v1/api-keys',
  '/api/v1/api-keys/warmup',
]

declare module 'vitest' {
  export interface ProvidedContext {
    baseUrl: string
  }
}

let serverProcess: ChildProcess | undefined

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()

      if (typeof address === 'object' && address !== null) {
        const { port } = address
        server.close(() => resolve(port))
      } else {
        server.close(() => reject(new Error('空きポートを取得できませんでした')))
      }
    })
  })
}

// 前回実行分のテストデータを削除する。
//
// テストごとにユニークなIDを使っていても、失敗して中断した場合などに
// レコードが残る。実行のたびにここで掃除することで、同じDBに対して
// 何度実行しても同じ結果になるようにする。
// seed 由来のマスターデータ(CharacterMaster / WakuwakuMaster)は消さない。
async function cleanupPreviousTestData(): Promise<void> {
  const { testPrisma, disconnectTestPrisma } = await import('./helpers/db')
  const { TEST_EMAIL_DOMAIN, TEST_INDEX_NUMBER_MIN } = await import('./helpers/fixtures')

  const prisma = testPrisma()

  try {
    // User の削除で GameAccount → OwnedCharacter → OwnedCharacterWakuwaku、
    // および ApiKey は onDelete: Cascade により連鎖削除される。
    const { count: deletedUsers } = await prisma.user.deleteMany({
      where: { email: { endsWith: `@${TEST_EMAIL_DOMAIN}` } },
    })

    // テストが作成したキャラクターマスター(seed の最大値より大きい範囲)
    const { count: deletedCharacters } = await prisma.characterMaster.deleteMany({
      where: { indexNumber: { gte: TEST_INDEX_NUMBER_MIN } },
    })

    if (deletedUsers > 0 || deletedCharacters > 0) {
      console.log(
        `[global-setup] 前回実行分を削除しました (user=${deletedUsers}, characterMaster=${deletedCharacters})`
      )
    }
  } finally {
    await disconnectTestPrisma()
  }
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown

  while (Date.now() < deadline) {
    if (serverProcess?.exitCode !== null && serverProcess?.exitCode !== undefined) {
      throw new Error(
        `Nextサーバーが起動前に終了しました (exit code: ${serverProcess.exitCode})`
      )
    }

    try {
      // 認証していないので 401 が返るのが正常。応答さえ返ればサーバーは生きている。
      const response = await fetch(url)

      if (response.status > 0) {
        return
      }
    } catch (error) {
      lastError = error
    }

    await new Promise((resolve) => setTimeout(resolve, SERVER_POLL_INTERVAL_MS))
  }

  throw new Error(
    `Nextサーバーが ${timeoutMs}ms 以内に起動しませんでした: ${String(lastError)}`
  )
}

async function warmupRoutes(base: string): Promise<void> {
  for (const path of WARMUP_PATHS) {
    // 認証していないため 401 等が返るが、ルートのコンパイルはこれで走る。
    await fetch(`${base}${path}`, { method: 'GET' }).catch(() => undefined)
  }
}

export default async function setup(project: TestProject) {
  loadTestEnv()
  assertLocalTestDatabase()

  await cleanupPreviousTestData()

  const port = await findFreePort()
  const base = `http://127.0.0.1:${port}`

  console.log(`[global-setup] Nextサーバーを起動します: ${base}`)

  serverProcess = spawn('npx', ['next', 'dev', '--port', String(port), '--hostname', '127.0.0.1'], {
    // 明示的に環境変数を渡す。Next は既に process.env にある値を
    // .env / .env.local で上書きしないため、テスト用のDBが確実に使われる。
    env: {
      ...process.env,
      NODE_ENV: 'development',
      NEXTAUTH_URL: base,
      // OAuth は使わないが、lib/auth.ts の GoogleProvider が非空を要求するため
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? 'dummy-client-id',
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? 'dummy-client-secret',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  // サーバーのログはテストが落ちたときの原因調査に必要なので握りつぶさない
  serverProcess.stdout?.on('data', (chunk: Buffer) => {
    process.stdout.write(`[next] ${chunk.toString()}`)
  })
  serverProcess.stderr?.on('data', (chunk: Buffer) => {
    process.stderr.write(`[next] ${chunk.toString()}`)
  })

  await waitForServer(`${base}/api/v1/wakuwaku-masters`, SERVER_READY_TIMEOUT_MS)

  console.log('[global-setup] サーバー起動完了。ルートをウォームアップします')
  await warmupRoutes(base)
  console.log('[global-setup] 準備完了')

  project.provide('baseUrl', base)

  return async () => {
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill('SIGTERM')

      // SIGTERM で落ちない場合に備えて猶予後に SIGKILL
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          serverProcess?.kill('SIGKILL')
          resolve()
        }, 5_000)

        serverProcess?.once('exit', () => {
          clearTimeout(timer)
          resolve()
        })
      })
    }
  }
}
