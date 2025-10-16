import './globals.css'
import AuthProvider from '@/components/AuthProvider'
import Navigation from '@/components/Navigation'

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
    <html lang="ja">
      <body>
        <AuthProvider>
          <div className="min-h-screen bg-gray-50">
            <Navigation />
            <main>{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
