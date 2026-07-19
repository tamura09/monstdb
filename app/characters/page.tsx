import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import DownloadButton from '@/components/DownloadButton'
import CharacterSearchFilter from '@/components/CharacterSearchFilter'
import { matchesJapaneseOr } from '@/lib/string-utils'
import { elementBadgeClass, typeBadgeClass } from '@/lib/badge-styles'

export default async function CharactersPage({
  searchParams,
}: {
  searchParams: Promise<{ element?: string; type?: string; search?: string }>
}) {
  const session = await getServerSession(authOptions)
  const { element, type, search } = await searchParams

  // Admin権限チェック
  let isAdmin = false
  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    })
    isAdmin = user?.role === 'admin'
  }

  // まず基本的なフィルターでデータを取得
  let characters = await prisma.characterMaster.findMany({
    where: {
      ...(element && { element }),
      ...(type && { type }),
    },
    orderBy: {
      indexNumber: 'asc',
    },
  })

  // 検索文字列がある場合、ひらがな・カタカナを区別せずにフィルタリング
  if (search) {
    characters = characters.filter((char) =>
      matchesJapaneseOr(char.monsterName, search)
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 bg-ground">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink">
          キャラクター一覧
        </h1>
        <div className="flex gap-3">
          <DownloadButton type="characters" />
          {isAdmin && (
            <Link
              href="/admin/characters"
              className="border border-line text-ink px-4 py-2 rounded-md hover:bg-line2 text-sm font-semibold"
            >
              ⚙️ キャラ管理
            </Link>
          )}
          {session && (
            <Link
              href="/accounts"
              className="bg-ink text-paper px-4 py-2 rounded-md hover:opacity-90 text-sm font-semibold"
            >
              マイアカウント
            </Link>
          )}
        </div>
      </div>

      {/* フィルター */}
      <CharacterSearchFilter />

      {/* キャラクター一覧 */}
      <div className="bg-panel border border-line rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-line">
            <thead className="bg-ground">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-dim uppercase tracking-wider">
                  図鑑No
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-dim uppercase tracking-wider">
                  名前
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-dim uppercase tracking-wider">
                  属性
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-dim uppercase tracking-wider">
                  種類
                </th>
              </tr>
            </thead>
            <tbody className="bg-panel divide-y divide-line">
              {characters.map((character) => (
                <tr key={character.id} className="hover:bg-line2">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-ink font-mono tabular-nums">
                    {character.indexNumber}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-ink">
                    {character.monsterName}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-ink">
                    <span className={`px-2 py-1 rounded ${elementBadgeClass(character.element)}`}>
                      {character.element}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-ink">
                    <span className={`px-2 py-1 rounded ${typeBadgeClass(character.type)}`}>
                      {character.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-dim mt-4 text-center text-sm">
        全{characters.length}体のキャラクター
      </p>
    </div>
  )
}
