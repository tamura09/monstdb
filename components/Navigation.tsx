'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useState } from 'react'
import ThemeToggle from './ThemeToggle'

export default function Navigation() {
  const { data: session } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <nav className="bg-blue-600 dark:bg-gray-800 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* ロゴ */}
          <Link href="/" className="text-xl font-bold">
            モンストDB
          </Link>

          {/* デスクトップメニュー */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/characters" className="hover:text-blue-200 dark:hover:text-gray-300">
              キャラクター一覧
            </Link>
            {session ? (
              <>
                <Link href="/accounts" className="hover:text-blue-200 dark:hover:text-gray-300">
                  マイアカウント
                </Link>
                <Link href="/friends" className="hover:text-blue-200 dark:hover:text-gray-300">
                  フレンド
                </Link>
                <Link href="/profile" className="hover:text-blue-200 dark:hover:text-gray-300">
                  マイページ
                </Link>
                <span className="text-sm text-blue-200 dark:text-gray-300">
                  {session.user?.name}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="bg-blue-700 hover:bg-blue-800 dark:bg-gray-700 dark:hover:bg-gray-600 px-3 py-1 rounded text-sm"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-blue-700 hover:bg-blue-800 dark:bg-gray-700 dark:hover:bg-gray-600 px-3 py-1 rounded"
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
              className="p-2 rounded-md hover:bg-blue-700 dark:hover:bg-gray-700 focus:outline-none"
              aria-label="メニュー"
            >
              {isMenuOpen ? (
                // ✕アイコン
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                // ハンバーガーアイコン
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* モバイルメニュー */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link
              href="/characters"
              className="block py-2 px-4 hover:bg-blue-700 dark:hover:bg-gray-700 rounded"
              onClick={() => setIsMenuOpen(false)}
            >
              キャラクター一覧
            </Link>
            {session ? (
              <>
                <Link
                  href="/accounts"
                  className="block py-2 px-4 hover:bg-blue-700 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  マイアカウント
                </Link>
                <Link
                  href="/friends"
                  className="block py-2 px-4 hover:bg-blue-700 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  フレンド
                </Link>
                <Link
                  href="/profile"
                  className="block py-2 px-4 hover:bg-blue-700 dark:hover:bg-gray-700 rounded"
                  onClick={() => setIsMenuOpen(false)}
                >
                  マイページ
                </Link>
                <div className="py-2 px-4 text-sm text-blue-200 dark:text-gray-300">
                  {session.user?.name}
                </div>
                <button
                  onClick={() => {
                    setIsMenuOpen(false)
                    signOut({ callbackUrl: '/' })
                  }}
                  className="w-full text-left py-2 px-4 bg-blue-700 hover:bg-blue-800 dark:bg-gray-700 dark:hover:bg-gray-600 rounded"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="block py-2 px-4 bg-blue-700 hover:bg-blue-800 dark:bg-gray-700 dark:hover:bg-gray-600 rounded"
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
