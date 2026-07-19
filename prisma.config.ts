import "dotenv/config";
import { defineConfig } from "prisma/config";

// prisma.config.ts が存在すると Prisma CLI は .env を自動読み込みしなくなるため、
// 上記の dotenv/config で明示的に読み込む（DATABASE_URL / DIRECT_URL を解決するため）。
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
