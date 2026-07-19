import "dotenv/config";
import { defineConfig } from "prisma/config";

// prisma.config.ts が存在すると Prisma CLI は .env を自動読み込みしなくなるため、
// 上記の dotenv/config で明示的に読み込む（DATABASE_URL / DIRECT_URL を解決するため）。
//
// Prisma 7 では schema.prisma の datasource ブロックに url / directUrl を
// 書けなくなったため、マイグレーション・イントロスペクション用の接続先を
// ここで指定する。従来 directUrl が担っていた「プーラーを経由しない直接接続」
// の役割を引き継ぎ、DIRECT_URL を使う。アプリ実行時の PrismaClient は
// lib/prisma.ts で driver adapter 経由で DATABASE_URL に接続する。
// `prisma/config` の env() ヘルパーは変数が未設定だと即座に例外を投げてしまい
// `prisma generate`（DB接続不要のコマンド）まで失敗するため、ここでは
// process.env を直接参照して未設定時は undefined を許容する。
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
