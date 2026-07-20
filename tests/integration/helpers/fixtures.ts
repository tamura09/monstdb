import { randomUUID } from 'node:crypto'
import { encode } from 'next-auth/jwt'
import type { CharacterMaster, GameAccount, WakuwakuMaster } from '@/generated/prisma/client'
import { testPrisma } from './db'
import { createApiClient, type ApiClient } from './client'

// テストで作成したユーザーを一括削除できるようにするための識別子。
// global-setup.ts のクリーンアップがこのドメインを目印に前回実行分を消す。
export const TEST_EMAIL_DOMAIN = 'vitest.local'
export const TEST_USER_ID_PREFIX = 'vitest-'

// テストが新規作成するキャラクターマスターの indexNumber の下限。
// seed データの最大値(8772)より十分大きい値にして衝突を避ける。
// global-setup.ts はこの値以上のレコードを前回実行分として削除する。
export const TEST_INDEX_NUMBER_MIN = 500_000

// 移植元スクリプト(特に keytest.sh)は固定の indexNumber を使っていたため
// 2回目の実行で 409 になっていた。テストごとにユニークな値を採番することで
// 何度実行しても通るようにする。
let indexNumberCursor = TEST_INDEX_NUMBER_MIN + Math.floor(Math.random() * 100_000)

export function uniqueIndexNumber(): number {
  indexNumberCursor += 1
  return indexNumberCursor
}

export type TestUser = {
  id: string
  role: string
  // ログイン時に自動作成される4つのゲームアカウント(accountNumber昇順)
  accounts: GameAccount[]
  // NextAuth のセッションクッキー(`next-auth.session-token=...`)
  cookie: string
  // このユーザーとして /api/v1 を叩くクライアント
  client: ApiClient
}

// NextAuth(JWT戦略)のセッションクッキーを組み立てる。
// lib/auth.ts の session コールバックが token.id / token.role を参照するため、
// その2つを必ず含める。
export async function createSessionCookie(
  userId: string,
  role: string,
  name: string
): Promise<string> {
  const token = await encode({
    token: { id: userId, role, name, email: `${userId}@${TEST_EMAIL_DOMAIN}`, sub: userId },
    secret: process.env.NEXTAUTH_SECRET!,
  })

  // NEXTAUTH_URL が http のため、NextAuth が読むクッキー名は
  // `__Secure-` 接頭辞なしの `next-auth.session-token` になる。
  return `next-auth.session-token=${token}`
}

// テスト用ユーザーを新規作成する。
//
// 移植元スクリプトは 'test-admin' / 'test-alice' / 'test-bob' という固定IDを
// upsert していたため、前回実行の残骸(所持キャラなど)が次の実行に影響し得た。
// ここでは実行ごとにユニークなIDでユーザーを作り、テストの独立性を確保する。
export async function createTestUser(role: 'user' | 'admin' = 'user'): Promise<TestUser> {
  const prisma = testPrisma()
  const id = `${TEST_USER_ID_PREFIX}${randomUUID()}`

  await prisma.user.create({
    data: {
      id,
      email: `${id}@${TEST_EMAIL_DOMAIN}`,
      name: id,
      role,
      friendId: `friend-${id}`,
    },
  })

  // 本番では Google 初回ログイン時に lib/auth.ts が4つ作成する。
  // テストでも同じ状態を再現する。
  await prisma.gameAccount.createMany({
    data: [1, 2, 3, 4].map((accountNumber) => ({
      userId: id,
      accountNumber,
      name: String(accountNumber),
    })),
  })

  const accounts = await prisma.gameAccount.findMany({
    where: { userId: id },
    orderBy: { accountNumber: 'asc' },
  })

  const cookie = await createSessionCookie(id, role, id)

  return { id, role, accounts, cookie, client: createApiClient({ cookie }) }
}

export type MasterFixtures = {
  // seed 済みのキャラクターマスター(indexNumber昇順の先頭3件)
  characters: CharacterMaster[]
  // seed 済みのわくわくの実マスター(displayOrder昇順の先頭6件)
  wakuwaku: WakuwakuMaster[]
}

// seed データからマスターを読み出す。テストはこれらを作成せず参照のみ行う。
export async function loadMasterFixtures(): Promise<MasterFixtures> {
  const prisma = testPrisma()

  const characters = await prisma.characterMaster.findMany({
    where: { indexNumber: { lt: TEST_INDEX_NUMBER_MIN } },
    orderBy: { indexNumber: 'asc' },
    take: 3,
  })

  const wakuwaku = await prisma.wakuwakuMaster.findMany({
    orderBy: { displayOrder: 'asc' },
    take: 6,
  })

  if (characters.length < 3 || wakuwaku.length < 6) {
    throw new Error(
      'seed データが不足しています。`npm run seed` を実行してからテストしてください。'
    )
  }

  return { characters, wakuwaku }
}
