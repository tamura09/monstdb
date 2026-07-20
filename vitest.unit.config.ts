import path from 'node:path'
import { defineConfig } from 'vitest/config'

// ユニットテスト(DB・HTTPサーバー不要)専用の設定。
// 純粋関数のみを対象とするため、globalSetup や外部プロセスの起動は一切行わない。
// `npm run test:unit` からこの設定単体で実行できる。
export default defineConfig({
  resolve: {
    // アプリ本体と同じ `@/` エイリアスを解決できるようにする(tsconfig.json の paths 相当)
    alias: { '@': path.resolve(import.meta.dirname, './') },
  },
  test: {
    name: 'unit',
    environment: 'node',
    // tests/unit 配下にファイルを追加するだけで自動的に対象になる。
    // (例: lib/csv.ts のテストは tests/unit/csv.test.ts を置けばよい)
    include: ['tests/unit/**/*.test.ts'],
  },
})
