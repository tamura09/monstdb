import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// テストからDBを直接検証・準備するための PrismaClient。
// アプリ本体の lib/prisma.ts とは別インスタンスにしている。lib/prisma.ts は
// モジュール読み込み時に DATABASE_URL を固定してしまうため、テスト側で
// 環境変数の読み込み順に依存しないようにするのが狙い。
let client: PrismaClient | undefined

export function testPrisma(): PrismaClient {
  if (!client) {
    const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
    client = new PrismaClient({ adapter })
  }

  return client
}

export async function disconnectTestPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect()
    client = undefined
  }
}
