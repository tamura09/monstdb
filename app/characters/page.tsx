import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import DownloadButton from '@/components/DownloadButton'
import CharacterSearchFilter from '@/components/CharacterSearchFilter'
import { matchesJapanese } from '@/lib/string-utils'

export default async function CharactersPage({
  searchParams,
}: {
  searchParams: Promise<{ element?: string; type?: string; search?: string; hasEL?: string }>
}) {
  const session = await getServerSession(authOptions)
  const { element, type, search, hasEL } = await searchParams

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
      matchesJapanese(char.monsterName, search)
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">
          キャラクター一覧
        </h1>
        <div className="flex gap-3">
          <DownloadButton type="characters" />
          {isAdmin && (
            <Link
              href="/admin/characters"
              className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 text-sm font-semibold"
            >
              ⚙️ キャラ管理
            </Link>
          )}
          {session && (
            <Link
              href="/accounts"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold"
            >
              マイアカウント
            </Link>
          )}
        </div>
      </div>

      {/* フィルター */}
      <CharacterSearchFilter />

      {/* キャラクター一覧 */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  図鑑No
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  名前
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  属性
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  種類
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {characters.map((character) => (
                <tr key={character.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {character.indexNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {character.monsterName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span
                      className={`px-2 py-1 rounded ${
                        character.element === '火'
                          ? 'bg-red-100 text-red-800'
                          : character.element === '水'
                          ? 'bg-blue-100 text-blue-800'
                          : character.element === '木'
                          ? 'bg-green-100 text-green-800'
                          : character.element === '光'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {character.element}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span
                      className={`px-2 py-1 rounded ${
                        character.type === '限定'
                          ? 'bg-pink-100 text-pink-800'
                          : 'bg-gray-100 text-gray-800'
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

      <p className="text-gray-600 mt-4 text-center">
        全{characters.length}体のキャラクター
      </p>
    </div>
  )
}
