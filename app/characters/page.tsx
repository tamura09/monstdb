import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import DownloadButton from '@/components/DownloadButton'

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

  const characters = await prisma.characterMaster.findMany({
    where: {
      ...(element && { element }),
      ...(type && { type }),
      ...(search && {
        monsterName: {
          contains: search,
        },
      }),
    },
    orderBy: {
      indexNumber: 'asc',
    },
  })

  const elements = ['火', '水', '木', '光', '闇']
  const types = ['限定', '恒常', 'α', 'コラボ']

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
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              属性
            </label>
            <div className="flex flex-wrap gap-2">
              <a
                href="/characters"
                className={`px-3 py-1 rounded ${
                  !element
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                全て
              </a>
              {elements.map((el) => (
                <a
                  key={el}
                  href={`/characters?element=${el}${type ? `&type=${type}` : ''}${
                    search ? `&search=${search}` : ''
                  }`}
                  className={`px-3 py-1 rounded ${
                    element === el
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {el}
                </a>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              種類
            </label>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/characters${element ? `?element=${element}` : ''}${
                  search ? `${element ? '&' : '?'}search=${search}` : ''
                }`}
                className={`px-3 py-1 rounded ${
                  !type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                全て
              </a>
              {types.map((t) => (
                <a
                  key={t}
                  href={`/characters?type=${t}${
                    element ? `&element=${element}` : ''
                  }${search ? `&search=${search}` : ''}`}
                  className={`px-3 py-1 rounded ${
                    type === t
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {t}
                </a>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              検索
            </label>
            <form action="/characters" method="get">
              {element && <input type="hidden" name="element" value={element} />}
              {type && <input type="hidden" name="type" value={type} />}
              <input
                type="text"
                id="search"
                name="search"
                defaultValue={search}
                placeholder="キャラ名で検索..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </form>
          </div>
        </div>
      </div>

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
