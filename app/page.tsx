import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function Home() {
  const session = await getServerSession(authOptions)
  const characterCount = await prisma.characterMaster.count()

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* ヒーローセクション */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-purple-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-20 md:py-32">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in">
              モンストDB
            </h1>
            <p className="text-xl md:text-2xl text-blue-100 mb-12 max-w-2xl mx-auto">
              あなたのモンスト所持状況を<br className="md:hidden" />スマートに管理
            </p>
            
            {session ? (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/accounts"
                  className="bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  マイアカウントへ
                </Link>
                <Link
                  href="/characters"
                  className="bg-blue-800 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-900 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  キャラクター一覧
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/login"
                  className="bg-white text-blue-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  ログイン / 新規登録
                </Link>
                <Link
                  href="/characters"
                  className="bg-blue-800 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-blue-900 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                >
                  キャラクター一覧を見る
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 機能紹介セクション */}
      <div className="max-w-7xl mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4">
            主な機能
          </h2>
          <p className="text-gray-600 text-lg">
            モンストDBで所持キャラクターを効率的に管理
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* 機能1 */}
          <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="text-5xl mb-4">📱</div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">
              複数アカウント管理
            </h3>
            <p className="text-gray-600">
              最大4つのゲームアカウントを一括管理。アカウント間での所持状況を簡単に比較できます。
            </p>
          </div>

          {/* 機能2 */}
          <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="text-5xl mb-4">🍎</div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">
              わくわくの実管理
            </h3>
            <p className="text-gray-600">
              各キャラクターに装着したわくわくの実を記録。自動ソート機能で見やすく表示。
            </p>
          </div>

          {/* 機能3 */}
          <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="text-5xl mb-4">👥</div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">
              フレンド機能
            </h3>
            <p className="text-gray-600">
              フレンドの所持状況を閲覧可能。一緒にクエストに行く前の確認に便利。
            </p>
          </div>

          {/* 機能4 */}
          <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">
              高度な検索
            </h3>
            <p className="text-gray-600">
              属性、タイプ、わくわくの実など、様々な条件で絞り込み検索が可能。
            </p>
          </div>

          {/* 機能5 */}
          <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="text-5xl mb-4">📊</div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">
              所持数ソート
            </h3>
            <p className="text-gray-600">
              名前順、No順、所持数順でソート可能。欲しいキャラがすぐに見つかります。
            </p>
          </div>

          {/* 機能6 */}
          <div className="bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="text-5xl mb-4">⚡</div>
            <h3 className="text-xl font-bold text-gray-800 mb-3">
              高速操作
            </h3>
            <p className="text-gray-600">
              インライン編集で画面遷移なし。キャラ追加もわくわく編集もその場で完結。
            </p>
          </div>
        </div>
      </div>

      {/* データ統計セクション */}
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <div className="inline-block bg-white rounded-2xl shadow-lg px-12 py-8">
              <p className="text-gray-600 text-sm uppercase tracking-wide mb-2">
                登録キャラクター数
              </p>
              <p className="text-6xl font-bold text-blue-600">{characterCount}</p>
              <p className="text-gray-500 text-sm mt-2">体のキャラクターを管理可能</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA セクション */}
      {!session && (
        <div className="bg-gradient-to-br from-purple-600 to-blue-600 text-white py-16 md:py-24">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              今すぐ始めよう
            </h2>
            <p className="text-xl text-blue-100 mb-8">
              Googleアカウントで簡単に登録できます
            </p>
            <Link
              href="/login"
              className="inline-block bg-white text-blue-600 px-10 py-4 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              無料で始める
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
