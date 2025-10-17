import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import DeleteCharacterMasterButton from '@/components/DeleteCharacterMasterButton'

export default async function AdminCharactersPage({
  searchParams,
}: {
  searchParams: Promise<{ element?: string; type?: string; search?: string; success?: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { element, type, search, success } = await searchParams

  // Admin権限チェック
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user || user.role !== 'admin') {
    redirect('/accounts')
  }

  // 全キャラクターマスターを取得
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

  // Server Action: キャラクター削除
  async function deleteCharacter(formData: FormData) {
    'use server'

    const characterId = formData.get('characterId') as string

    await prisma.characterMaster.delete({
      where: { id: characterId },
    })

    revalidatePath('/admin/characters')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            キャラクター管理
          </h1>
          <p className="text-gray-600">
            全{characters.length}体のキャラクター
          </p>
        </div>
        <Link
          href="/admin/characters/new"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-semibold"
        >
          + 新規追加
        </Link>
      </div>

      {/* 戻るリンク */}
      <div className="mb-6">
        <Link href="/accounts" className="text-blue-600 hover:underline">
          ← アカウント一覧に戻る
        </Link>
      </div>

      {/* 成功メッセージ */}
      {success === 'created' && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
          <strong className="font-bold">成功: </strong>
          <span>キャラクターを作成しました。</span>
        </div>
      )}

      {/* フィルター・検索 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          絞り込み・検索
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              属性
            </label>
            <div className="flex flex-wrap gap-2">
              <a
                href="/admin/characters"
                className={`px-3 py-1 rounded text-sm ${
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
                  href={`/admin/characters?element=${el}${
                    type ? `&type=${type}` : ''
                  }${search ? `&search=${search}` : ''}`}
                  className={`px-3 py-1 rounded text-sm ${
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
                href={`/admin/characters${element ? `?element=${element}` : ''}${
                  search ? `${element ? '&' : '?'}search=${search}` : ''
                }`}
                className={`px-3 py-1 rounded text-sm ${
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
                  href={`/admin/characters?type=${t}${
                    element ? `&element=${element}` : ''
                  }${search ? `&search=${search}` : ''}`}
                  className={`px-3 py-1 rounded text-sm ${
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
              キャラ名検索
            </label>
            <form action="/admin/characters" method="get">
              {element && <input type="hidden" name="element" value={element} />}
              {type && <input type="hidden" name="type" value={type} />}
              <input
                type="text"
                id="search"
                name="search"
                defaultValue={search}
                placeholder="キャラ名で検索..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </form>
          </div>
        </div>
      </div>

      {/* キャラクター一覧 */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b-2 border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                No.
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                キャラクター名
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                属性
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                種類
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                操作
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {characters.map((character) => (
              <tr key={character.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-600">
                  {character.indexNumber}
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-800">
                    {character.monsterName}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block px-3 py-1 rounded text-xs ${
                      character.element === '火'
                        ? 'bg-red-100 text-red-700'
                        : character.element === '水'
                        ? 'bg-blue-100 text-blue-700'
                        : character.element === '木'
                        ? 'bg-green-100 text-green-700'
                        : character.element === '光'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {character.element}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm text-gray-600">{character.type}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Link
                      href={`/admin/characters/${character.id}/edit`}
                      className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
                    >
                      編集
                    </Link>
                    <DeleteCharacterMasterButton
                      characterId={character.id}
                      characterName={character.monsterName}
                      onDelete={deleteCharacter}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
