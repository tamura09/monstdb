import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import CharacterTable from '@/components/CharacterTable'
import FriendSearchFilter from '@/components/FriendSearchFilter'
import { matchesJapaneseOr } from '@/lib/string-utils'
import { getCachedCharacterMasters, getCachedWakuwakuMasters } from '@/lib/cache/master-data'

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
            select: {
              id: true,
              characterMasterId: true,
              wakuwakuSlots: {
                select: {
                  id: true,
                  level: true,
                  slotNumber: true,
                  wakuwakuMaster: {
                    select: { id: true, name: true },
                  },
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
  const allWakuwaku = await getCachedWakuwakuMasters()

  // ワクワクの実でフィルタリングする場合の処理
  const selectedWakuwaku = wakuwaku ? wakuwaku.split(',').filter(Boolean) : []

  // 全キャラクターマスターを取得（フィルタリング付き）
  let allCharacterMasters = (await getCachedCharacterMasters()).filter((character) => {
    if (element && character.element !== element) return false
    if (type && character.type !== type) return false
    return true
  })

  // 検索文字列がある場合、ひらがな・カタカナを区別せずにフィルタリング
  if (search) {
    allCharacterMasters = allCharacterMasters.filter((char) =>
      matchesJapaneseOr(char.monsterName, search)
    )
  }

  // 所持情報を「アカウント → 図鑑IDごとの所持配列」に事前インデックス化
  // （1000体 × アカウント × 所持の総当たりフィルタを避け、O(1)ルックアップにする）
  const ownedByAccount = new Map<string, Map<string, typeof friend.gameAccounts[number]['ownedCharacters']>>()
  for (const account of friend.gameAccounts) {
    const byMaster = new Map<string, typeof account.ownedCharacters>()
    for (const oc of account.ownedCharacters) {
      const arr = byMaster.get(oc.characterMasterId)
      if (arr) {
        arr.push(oc)
      } else {
        byMaster.set(oc.characterMasterId, [oc])
      }
    }
    ownedByAccount.set(account.id, byMaster)
  }

  // 各キャラクターマスターに対して、各アカウントの所持情報をマッピング
  let characterData = allCharacterMasters.map((charMaster) => {
    const accountOwnerships: Record<string, any[]> = {}

    for (const account of friend.gameAccounts) {
      const ownedChars = ownedByAccount.get(account.id)?.get(charMaster.id)
      if (ownedChars && ownedChars.length > 0) {
        accountOwnerships[account.id] = ownedChars
      }
    }

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
            <Image
              src={friend.image}
              alt={friend.name || ''}
              width={48}
              height={48}
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
