/** @type {import('next').NextConfig} */
const nextConfig = {
  // 本番環境での最適化
  output: 'standalone', // Dockerデプロイ用
  
  // ビルド高速化（Next.js 15ではSWCがデフォルト）
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production', // 本番環境でconsole.log削除
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
  eslint: {
    ignoreDuringBuilds: true, // ビルド時のLintチェックをスキップして高速化
  },
  
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
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig

