import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CharacterTable from '@/components/CharacterTable'
import FriendSearchFilter from '@/components/FriendSearchFilter'
import { matchesJapaneseOr } from '@/lib/string-utils'

export default async function FriendAccountsPage({
  params,
  searchParams,
}: {
  params: Promise<{ friendId: string }>
  searchParams: Promise<{
    element?: string
    type?: string
    search?: string
    wakuwaku?: string
    wakuwakuMode?: 'and' | 'or'
    hasEL?: string
  }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { friendId } = await params
  const { element, type, search, wakuwaku, wakuwakuMode = 'or', hasEL } = await searchParams

  // フレンド関係を確認
  const friendship = await prisma.friendship.findFirst({
    where: {
      userId: session.user.id,
      friendId,
    },
  })

  if (!friendship) {
    redirect('/friends')
  }

  // フレンド情報を取得
  const friend = await prisma.user.findUnique({
    where: { id: friendId },
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
  let allCharacterMasters = await prisma.characterMaster.findMany({
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
    allCharacterMasters = allCharacterMasters.filter((char) =>
      matchesJapaneseOr(char.monsterName, search)
    )
  }

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

  // ELフィルタリング
  if (hasEL === 'true') {
    characterData = characterData.filter((charData) => {
      // 全アカウントの所持キャラクターを取得
      const allOwnedChars: any[] = []
      Object.values(charData.accountOwnerships).forEach((chars) => {
        allOwnedChars.push(...chars)
      })

      if (allOwnedChars.length === 0) return false

      // いずれかの所持キャラでELのわくわくを持っているかチェック
      return allOwnedChars.some((char) =>
        char.wakuwakuSlots.some((slot: any) => slot.level === 'EL')
      )
    })
  }

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
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-2"
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
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">{friend.name}さんの所持状況</h1>
            <p className="text-gray-600 dark:text-gray-400 text-sm">閲覧専用モード</p>
          </div>
        </div>
      </div>

      {/* フィルター・検索 */}
      <FriendSearchFilter allWakuwaku={allWakuwaku} friendId={friendId} />

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

      <div className="mt-4 text-center text-gray-600 dark:text-gray-400">
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
