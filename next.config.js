/** @type {import('next').NextConfig} */
const nextConfig = {
  // 本番環境での最適化
  // Dockerデプロイ用。ただしVercel上では無効にする。
  // Next.js 16.3 の Turbopack はアダプタ構成時に next-server.js.nft.json を
  // 出力しなくなった (vercel/next.js#93684) 一方、Vercel の onBuildComplete と
  // standalone の copyTracedFiles は従来どおりこのファイルを読むため、
  // output: 'standalone' のままだとVercelのビルドが ENOENT で必ず失敗する。
  // 16.2系では発生しない。修正され次第この分岐は削除してよい。
  // 参考: https://github.com/vercel/next.js/issues/96646
  output: process.env.VERCEL ? undefined : 'standalone',
  
  // Next.js 16のパフォーマンス最適化
  reactStrictMode: true,
  
  // ビルド高速化（Next.js 15ではSWCがデフォルト）
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production', // 本番環境でconsole.log削除
  },
  
  // /api/v1/openapi, /api/v1/docs は実行時にそれぞれ docs/openapi.yaml,
  // docs/api-v1.md を読み込むため、サーバーレス環境（Vercel）のバンドルに
  // 同梱されるよう明示的に指定する。
  // 指定しないとファイルトレースから漏れ、本番でのみ ENOENT になる。
  outputFileTracingIncludes: {
    '/api/v1/openapi': ['./docs/openapi.yaml'],
    '/api/v1/docs': ['./docs/api-v1.md'],
  },

  // 実験的な機能（パフォーマンス改善）
  experimental: {
    // Next.js 16.3 の既定は tsc の CLI を起動する方式（useTypeScriptCli: true）だが、
    // それは typescript パッケージが bin.tsc を持つ前提になっている。
    // 本プロジェクトは TypeScript 公式の side-by-side 構成を採っており、
    // typescript = @typescript/typescript6（bin 名は tsc6 / TS7 未対応の
    // typescript-eslint 用に JS API を提供）、tsc = TypeScript 7 という配置のため、
    // CLI 方式では tsc が見つからずビルドが落ちる。JS API 方式に固定する。
    // typescript-eslint が TS7 に対応したら（TS 7.1 の新API待ち）この設定は不要になる。
    useTypeScriptCli: false,
    optimizePackageImports: ['next-auth', 'react-icons'],
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  
  // 画像最適化設定
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com', // Google OAuth画像
      },
    ],
  },
  
  // TypeScript/ESLintエラーを無視（ビルドを継続）
  typescript: {
    ignoreBuildErrors: false, // 本番では false 推奨
  },
  // Next.js 16では eslint 設定は next.config.js から削除され、
  // ESLint設定は .eslintrc.json または eslint.config.mjs で管理
  
  // セキュリティヘッダー
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig

