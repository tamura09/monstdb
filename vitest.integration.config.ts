import path from 'node:path'
import { defineConfig } from 'vitest/config'

// 統合テスト(実DB + 実HTTPサーバー)専用の設定。
//
// ルートハンドラを直接importして呼ぶのではなく、globalSetup で起動した
// 実際の Next サーバーへ HTTP リクエストを投げる。ハンドラ直呼びだと
// Next.js のルーティングや認証の経路を迂回してしまい、これまで実際に
// 見つかったクラスのバグ(認可漏れ・パラメータ検証漏れ)を検出できないため。
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './') },
  },
  test: {
    name: 'integration',
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    // Next サーバーの起動・テストデータのクリーンアップを行う
    globalSetup: ['tests/integration/global-setup.ts'],
    // 各ワーカープロセスでも .env.test を読み込む
    setupFiles: ['tests/integration/setup-env.ts'],
    // 同じDBを共有するため、ファイル間の干渉を避けて直列実行する。
    // (テスト内の並行性検証は Promise.all による同時HTTPリクエストで行う)
    fileParallelism: false,
    // next dev は初回リクエスト時にルートをコンパイルするため余裕を持たせる
    testTimeout: 60_000,
    // サーバー起動 + ウォームアップの待ち時間
    hookTimeout: 300_000,
    teardownTimeout: 30_000,
  },
})
