import { defineConfig } from 'vitest/config'

// `npm run test` 用のルート設定。ユニットテストと統合テストの両方を実行する。
// 個別に走らせたい場合はそれぞれの設定ファイルを直接指定する:
//   npm run test:unit         (DB・サーバー不要)
//   npm run test:integration  (実DB + 実Nextサーバーが必要)
export default defineConfig({
  test: {
    projects: ['vitest.unit.config.ts', 'vitest.integration.config.ts'],
  },
})
