import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CharacterTable from '@/components/CharacterTable'
import WakuwakuFilter from '@/components/WakuwakuFilter'

export default async function FriendAccountsPage({
  params,
  searchParams,
}: {
  params: { friendId: string }
  searchParams: {
    element?: string
    type?: string
    search?: string
    wakuwaku?: string
    wakuwakuMode?: 'and' | 'or'
  }
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { element, type, search, wakuwaku, wakuwakuMode = 'or' } = searchParams

  // フレンド関係を確認
  const friendship = await prisma.friendship.findFirst({
    where: {
      userId: session.user.id,
      friendId: params.friendId,
    },
  })

  if (!friendship) {
    redirect('/friends')
  }

  // フレンド情報を取得
  const friend = await prisma.user.findUnique({
    where: { id: params.friendId },
    include: {
      gameAccounts: {
        include: {
          ownedCharacters: {
            include: {
              characterMaster: true,
              wakuwakuSlots: {
                include: {
                  wakuwakuMaster: true,
                },
                orderBy: {
                  slotNumber: 'asc',
                },
              },
            },
          },
        },
        orderBy: {
          accountNumber: 'asc',
        },
      },
    },
  })

  if (!friend) {
    redirect('/friends')
  }

  // 全ワクワクの実を取得
  const allWakuwaku = await prisma.wakuwakuMaster.findMany({
    orderBy: {
      displayOrder: 'asc',
    },
  })

  // ワクワクの実でフィルタリングする場合の処理
  const selectedWakuwaku = wakuwaku ? wakuwaku.split(',').filter(Boolean) : []

  // 全キャラクターマスターを取得（フィルタリング付き）
  const allCharacterMasters = await prisma.characterMaster.findMany({
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

  // 各キャラクターマスターに対して、各アカウントの所持情報をマッピング
  let characterData = allCharacterMasters.map((charMaster) => {
    const accountOwnerships: Record<string, any[]> = {}

    friend.gameAccounts.forEach((account) => {
      const ownedChars = account.ownedCharacters.filter(
        (oc) => oc.characterMaster.id === charMaster.id
      )
      if (ownedChars.length > 0) {
        accountOwnerships[account.id] = ownedChars
      }
    })

    return {
      characterMaster: charMaster,
      accountOwnerships,
    }
  })

  // ワクワクの実でフィルタリング
  if (selectedWakuwaku.length > 0) {
    characterData = characterData.filter((charData) => {
      // 全アカウントの所持キャラクターを取得
      const allOwnedChars: any[] = []
      Object.values(charData.accountOwnerships).forEach((chars) => {
        allOwnedChars.push(...chars)
      })

      if (allOwnedChars.length === 0) return false

      // 各所持キャラのワクワクの実の名前を収集
      const charWakuwakuNames = allOwnedChars.flatMap((char) =>
        char.wakuwakuSlots.map((slot: any) => slot.wakuwakuMaster.name)
      )

      if (wakuwakuMode === 'and') {
        // AND検索: 選択した全てのワクワクを持っている
        return selectedWakuwaku.every((w) => charWakuwakuNames.includes(w))
      } else {
        // OR検索: 選択したワクワクのいずれかを持っている
        return selectedWakuwaku.some((w) => charWakuwakuNames.includes(w))
      }
    })
  }

  const elements = ['火', '水', '木', '光', '闇']
  const types = ['限定', '恒常', 'α', 'コラボ']

  // Read-only用のダミー関数
  async function dummyAction() {
    'use server'
    // 何もしない
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/friends"
          className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          ← フレンドリストに戻る
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          {friend.image && (
            <img
              src={friend.image}
              alt={friend.name || ''}
              className="w-12 h-12 rounded-full"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold text-gray-800">{friend.name}さんの所持状況</h1>
            <p className="text-gray-600 text-sm">閲覧専用モード</p>
          </div>
        </div>
      </div>

      {/* フィルター・検索 */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          絞り込み・検索
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              属性
            </label>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/friends/${params.friendId}`}
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
                  href={`/friends/${params.friendId}?element=${el}${type ? `&type=${type}` : ''}${
                    search ? `&search=${search}` : ''
                  }${wakuwaku ? `&wakuwaku=${wakuwaku}` : ''}${wakuwakuMode ? `&wakuwakuMode=${wakuwakuMode}` : ''}`}
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
              タイプ
            </label>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/friends/${params.friendId}${
                  element ? `?element=${element}` : ''
                }${search ? `${element ? '&' : '?'}search=${search}` : ''}${wakuwaku ? `${element || search ? '&' : '?'}wakuwaku=${wakuwaku}` : ''}${wakuwakuMode ? `${element || search || wakuwaku ? '&' : '?'}wakuwakuMode=${wakuwakuMode}` : ''}`}
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
                  href={`/friends/${params.friendId}?type=${t}${
                    element ? `&element=${element}` : ''
                  }${search ? `&search=${search}` : ''}${wakuwaku ? `&wakuwaku=${wakuwaku}` : ''}${wakuwakuMode ? `&wakuwakuMode=${wakuwakuMode}` : ''}`}
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
            <form action={`/friends/${params.friendId}`} method="get">
              {element && <input type="hidden" name="element" value={element} />}
              {type && <input type="hidden" name="type" value={type} />}
              {wakuwaku && <input type="hidden" name="wakuwaku" value={wakuwaku} />}
              {wakuwakuMode && <input type="hidden" name="wakuwakuMode" value={wakuwakuMode} />}
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ワクワクの実
            </label>
            <div className="text-xs text-gray-500 mb-2">
              複数選択可能（{wakuwakuMode === 'and' ? 'AND' : 'OR'}検索）
            </div>
            <WakuwakuFilter
              allWakuwaku={allWakuwaku}
              selectedWakuwaku={selectedWakuwaku}
              wakuwakuMode={wakuwakuMode}
              element={element}
              type={type}
              search={search}
              basePath={`/friends/${params.friendId}`}
            />
          </div>
        </div>
      </div>

      {/* キャラクター一覧テーブル（Read-only） */}
      <CharacterTable
        characterData={characterData}
        gameAccounts={friend.gameAccounts.map((acc) => ({
          id: acc.id,
          name: acc.name,
          accountNumber: acc.accountNumber,
        }))}
        allWakuwaku={allWakuwaku}
        onAddCharacter={dummyAction}
        onAddWakuwaku={dummyAction}
        onDeleteWakuwaku={dummyAction}
        readOnly={true}
      />

      <div className="mt-4 text-center text-gray-600">
        全{characterData.length}体のキャラクター
        {(element || type || search || selectedWakuwaku.length > 0) && ' (絞り込み中)'}
        {selectedWakuwaku.length > 0 && (
          <div className="mt-2 text-sm">
            ワクワク絞り込み: {selectedWakuwaku.join(', ')} ({wakuwakuMode === 'and' ? 'AND' : 'OR'}検索)
          </div>
        )}
      </div>
    </div>
  )
}
