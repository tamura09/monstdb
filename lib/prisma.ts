import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// Prisma 7 では PrismaClient の生成に driver adapter が必須になったため、
// 既存の pg パッケージを使う @prisma/adapter-pg 経由で接続する。
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// アプリ全体で `@/lib/prisma` から型もまとめて re-export し、生成先パスの
// 変更（`@prisma/client` → `../generated/prisma`）を各利用箇所から隠蔽する。
export type { User } from '../generated/prisma/client'
