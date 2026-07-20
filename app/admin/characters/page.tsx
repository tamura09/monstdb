import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath, revalidateTag } from 'next/cache'
import AdminCharacterTable from '@/components/AdminCharacterTable'
import { getCachedCharacterMasters, CHARACTER_MASTER_CACHE_TAG } from '@/lib/cache/master-data'

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

  // 全キャラクターマスターを取得（キャッシュから全件取得し、絞り込みはJS側で行う）
  const allCharacterMasters = await getCachedCharacterMasters()
  const characters = allCharacterMasters.filter((character) => {
    if (element && character.element !== element) return false
    if (type && character.type !== type) return false
    if (search && !character.monsterName.includes(search)) return false
    return true
  })

  const elements = ['火', '水', '木', '光', '闇']
  const types = ['限定', '恒常', 'α', 'コラボ']

  // Server Action: キャラクター削除
  async function deleteCharacter(formData: FormData) {
    'use server'

    const session = await getServerSession(authOptions)

    if (!session) {
      throw new Error('Unauthorized')
    }

    // Admin権限チェック
    const actingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    })

    if (!actingUser || actingUser.role !== 'admin') {
      throw new Error('Unauthorized')
    }

    const characterId = formData.get('characterId') as string

    await prisma.characterMaster.delete({
      where: { id: characterId },
    })

    revalidateTag(CHARACTER_MASTER_CACHE_TAG, 'max')
    revalidatePath('/admin/characters')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
            キャラクター管理
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            全{characters.length}体のキャラクター
          </p>
        </div>
        <Link
          href="/admin/characters/new"
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 font-semibold"
        >
          + 新規追加
        </Link>
      </div>

      {/* 戻るリンク */}
      <div className="mb-6">
        <Link href="/accounts" className="text-blue-600 dark:text-blue-400 hover:underline">
          ← アカウント一覧に戻る
        </Link>
      </div>

      {/* 成功メッセージ */}
      {success === 'created' && (
        <div className="bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-700 text-green-700 dark:text-green-200 px-4 py-3 rounded mb-6">
          <strong className="font-bold">成功: </strong>
          <span>キャラクターを作成しました。</span>
        </div>
      )}

      {/* フィルター・検索 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          絞り込み・検索
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              属性
            </label>
            <div className="flex flex-wrap gap-2">
              <a
                href="/admin/characters"
                className={`px-3 py-1 rounded text-sm ${
                  !element
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
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
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {el}
                </a>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
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
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
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
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </form>
          </div>
        </div>
      </div>

      {/* キャラクター一覧 */}
      <AdminCharacterTable characters={characters} onDelete={deleteCharacter} />
    </div>
  )
}
