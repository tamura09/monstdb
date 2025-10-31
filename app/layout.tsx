import './globals.css'
import AuthProvider from '@/components/AuthProvider'
import Navigation from '@/components/Navigation'
import { LoadingProvider } from '@/components/LoadingProvider'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'

export const metadata = {
  title: 'モンストDB - キャラクター管理アプリ',
  description: 'モンスターストライクのキャラクター所持状況管理アプリ',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <LoadingProvider>
              <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
                <Navigation />
                <main>{children}</main>
              </div>
            </LoadingProvider>
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
