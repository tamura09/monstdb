'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'

export default function Navigation() {
  const { data: session } = useSession()

  return (
    <nav className="bg-blue-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="text-xl font-bold">
            モンストDB
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/characters" className="hover:text-blue-200">
              キャラクター一覧
            </Link>
            {session ? (
              <>
                <Link href="/accounts" className="hover:text-blue-200">
                  マイアカウント
                </Link>
                <Link href="/friends" className="hover:text-blue-200">
                  フレンド
                </Link>
                <Link href="/profile" className="hover:text-blue-200">
                  マイページ
                </Link>
                <span className="text-sm text-blue-200">
                  {session.user?.name}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded text-sm"
                >
                  ログアウト
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded"
              >
                ログイン
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
