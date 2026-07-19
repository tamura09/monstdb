import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export default async function Home() {
  const session = await getServerSession(authOptions)
  const characterCount = await prisma.characterMaster.count()

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-ground">
      {/* ヒーローセクション */}
      <div className="bg-panel border-b border-line">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6 text-ink animate-fade-in tracking-tight">
              モンストDB
            </h1>
            <p className="text-lg md:text-xl text-dim mb-10 max-w-2xl mx-auto">
              あなたのモンスト所持状況を<br className="md:hidden" />スマートに管理
            </p>

            {session ? (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/accounts"
                  className="bg-ink text-paper px-6 py-3 rounded-md font-bold text-sm hover:opacity-90 transition-opacity"
                >
                  マイアカウントへ
                </Link>
                <Link
                  href="/characters"
                  className="border border-line text-ink px-6 py-3 rounded-md font-bold text-sm hover:bg-line2 transition-colors"
                >
                  キャラクター一覧
                </Link>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/login"
                  className="bg-ink text-paper px-6 py-3 rounded-md font-bold text-sm hover:opacity-90 transition-opacity"
                >
                  ログイン / 新規登録
                </Link>
                <Link
                  href="/characters"
                  className="border border-line text-ink px-6 py-3 rounded-md font-bold text-sm hover:bg-line2 transition-colors"
                >
                  キャラクター一覧を見る
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 機能紹介セクション */}
      <div className="max-w-7xl mx-auto px-4 py-14 md:py-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-ink mb-3">
            主な機能
          </h2>
          <p className="text-dim">
            モンストDBで所持キャラクターを効率的に管理
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 機能1 */}
          <div className="bg-panel border border-line rounded-lg p-6">
            <div className="text-4xl mb-3">📱</div>
            <h3 className="text-base font-bold text-ink mb-2">
              複数アカウント管理
            </h3>
            <p className="text-sm text-dim">
              最大4つのゲームアカウントを一括管理。アカウント間での所持状況を簡単に比較できます。
            </p>
          </div>

          {/* 機能2 */}
          <div className="bg-panel border border-line rounded-lg p-6">
            <div className="text-4xl mb-3">🍎</div>
            <h3 className="text-base font-bold text-ink mb-2">
              わくわくの実管理
            </h3>
            <p className="text-sm text-dim">
              各キャラクターに装着したわくわくの実を記録。自動ソート機能で見やすく表示。
            </p>
          </div>

          {/* 機能3 */}
          <div className="bg-panel border border-line rounded-lg p-6">
            <div className="text-4xl mb-3">👥</div>
            <h3 className="text-base font-bold text-ink mb-2">
              フレンド機能
            </h3>
            <p className="text-sm text-dim">
              フレンドの所持状況を閲覧可能。一緒にクエストに行く前の確認に便利。
            </p>
          </div>

          {/* 機能4 */}
          <div className="bg-panel border border-line rounded-lg p-6">
            <div className="text-4xl mb-3">🔍</div>
            <h3 className="text-base font-bold text-ink mb-2">
              高度な検索
            </h3>
            <p className="text-sm text-dim">
              属性、タイプ、わくわくの実など、様々な条件で絞り込み検索が可能。
            </p>
          </div>

          {/* 機能5 */}
          <div className="bg-panel border border-line rounded-lg p-6">
            <div className="text-4xl mb-3">📊</div>
            <h3 className="text-base font-bold text-ink mb-2">
              所持数ソート
            </h3>
            <p className="text-sm text-dim">
              名前順、No順、所持数順でソート可能。欲しいキャラがすぐに見つかります。
            </p>
          </div>

          {/* 機能6 */}
          <div className="bg-panel border border-line rounded-lg p-6">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="text-base font-bold text-ink mb-2">
              高速操作
            </h3>
            <p className="text-sm text-dim">
              インライン編集で画面遷移なし。キャラ追加もわくわく編集もその場で完結。
            </p>
          </div>
        </div>
      </div>

      {/* データ統計セクション */}
      <div className="bg-panel border-y border-line py-14">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center">
            <div className="inline-block border border-line rounded-lg px-10 py-7">
              <p className="text-dim text-xs uppercase tracking-wide mb-2">
                登録キャラクター数
              </p>
              <p className="text-5xl font-bold text-ink font-mono tabular-nums">{characterCount}</p>
              <p className="text-faint text-xs mt-2">体のキャラクターを管理可能</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA セクション */}
      {!session && (
        <div className="bg-ground py-14 md:py-20">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-5 text-ink">
              今すぐ始めよう
            </h2>
            <p className="text-dim mb-7">
              Googleアカウントで簡単に登録できます
            </p>
            <Link
              href="/login"
              className="inline-block bg-ink text-paper px-8 py-3 rounded-md font-bold text-sm hover:opacity-90 transition-opacity"
            >
              無料で始める
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
