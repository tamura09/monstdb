import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import DownloadButton from '@/components/DownloadButton'
import CharacterSearchFilter from '@/components/CharacterSearchFilter'
import { matchesJapaneseOr } from '@/lib/string-utils'

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
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
          キャラクター一覧
        </h1>
        <div className="flex gap-3">
          <DownloadButton type="characters" />
          {isAdmin && (
            <Link
              href="/admin/characters"
              className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-sm font-semibold"
            >
              ⚙️ キャラ管理
            </Link>
          )}
          {session && (
            <Link
              href="/accounts"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-sm font-semibold"
            >
              マイアカウント
            </Link>
          )}
        </div>
      </div>

      {/* フィルター */}
      <CharacterSearchFilter />

      {/* キャラクター一覧 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  図鑑No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  名前
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  属性
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  種類
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
              {characters.map((character) => (
                <tr key={character.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                    {character.indexNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-200">
                    {character.monsterName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                    <span
                      className={`px-2 py-1 rounded ${
                        character.element === '火'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          : character.element === '水'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                          : character.element === '木'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : character.element === '光'
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                          : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                      }`}
                    >
                      {character.element}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-200">
                    <span
                      className={`px-2 py-1 rounded ${
                        character.type === '限定'
                          ? 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {character.type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-gray-600 dark:text-gray-400 mt-4 text-center">
        全{characters.length}体のキャラクター
      </p>
    </div>
  )
}
