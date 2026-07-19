'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'
import ThemeToggle from './ThemeToggle'

export default function Navigation() {
  const { data: session } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <nav className="bg-panel border-b border-line text-ink">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-12">
          {/* ロゴ */}
          <Link href="/" className="text-sm font-bold tracking-tight">
            モンストDB
          </Link>

          {/* デスクトップメニュー */}
          <div className="hidden md:flex items-center gap-4 text-sm">
            <Link href="/characters" className="text-dim hover:text-ink transition-colors">
              キャラクター一覧
            </Link>
            {session ? (
              <>
                <Link href="/accounts" className="text-dim hover:text-ink transition-colors">
                  マイアカウント
                </Link>
                <Link href="/friends" className="text-dim hover:text-ink transition-colors">
                  フレンド
                </Link>
                <Link href="/profile" className="text-dim hover:text-ink transition-colors">
                  マイページ
                </Link>
                <span className="text-xs text-faint">
                  {session.user?.name}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="bg-ink text-paper hover:opacity-90 px-3 py-1 rounded-full text-xs"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-ink text-paper hover:opacity-90 px-3 py-1 rounded-full text-xs"
              >
                ログイン
              </Link>
            )}
            <ThemeToggle />
          </div>

          {/* モバイル: ハンバーガーメニューボタン */}
          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 rounded-md text-dim hover:text-ink hover:bg-line2 focus:outline-none"
              aria-label="メニュー"
            >
              {isMenuOpen ? (
                // ✕アイコン
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                // ハンバーガーアイコン
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* モバイルメニュー */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 space-y-1 text-sm border-t border-line pt-2">
            <Link
              href="/characters"
              className="block py-2 px-4 text-dim hover:text-ink hover:bg-line2 rounded-md"
              onClick={() => setIsMenuOpen(false)}
            >
              キャラクター一覧
            </Link>
            {session ? (
              <>
                <Link
                  href="/accounts"
                  className="block py-2 px-4 text-dim hover:text-ink hover:bg-line2 rounded-md"
                  onClick={() => setIsMenuOpen(false)}
                >
                  マイアカウント
                </Link>
                <Link
                  href="/friends"
                  className="block py-2 px-4 text-dim hover:text-ink hover:bg-line2 rounded-md"
                  onClick={() => setIsMenuOpen(false)}
                >
                  フレンド
                </Link>
                <Link
                  href="/profile"
                  className="block py-2 px-4 text-dim hover:text-ink hover:bg-line2 rounded-md"
                  onClick={() => setIsMenuOpen(false)}
                >
                  マイページ
                </Link>
                <div className="py-2 px-4 text-xs text-faint">
                  {session.user?.name}
                </div>
                <button
                  onClick={() => {
                    setIsMenuOpen(false)
                    signOut({ callbackUrl: '/' })
                  }}
                  className="w-full text-left py-2 px-4 bg-ink text-paper hover:opacity-90 rounded-md"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="block py-2 px-4 bg-ink text-paper hover:opacity-90 rounded-md"
                onClick={() => setIsMenuOpen(false)}
              >
                ログイン
              </Link>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
