import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import CharacterTable from '@/components/CharacterTable'
import DownloadButton from '@/components/DownloadButton'
import ImportButton from '@/components/ImportButton'
import DownloadTemplateButton from '@/components/DownloadTemplateButton'
import AccountSearchFilter from '@/components/AccountSearchFilter'
import CharacterNameSearchBar from '@/components/CharacterNameSearchBar'
import { matchesJapaneseOr } from '@/lib/string-utils'

export default async function AccountsViewPage({
  searchParams,
}: {
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

  const { element, type, search, wakuwaku, wakuwakuMode = 'or', hasEL } = await searchParams

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
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

  if (!user) {
    redirect('/login')
  }

  // Admin権限チェック
  const isAdmin = user.role === 'admin'

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
    
    user.gameAccounts.forEach((account) => {
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
            マイアカウント
            <span className="text-sm font-normal bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
              📖 閲覧専用モード
            </span>
          </h1>
          <p className="text-gray-600">{user.name}さんのアカウント一覧</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/accounts"
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-semibold flex items-center gap-2"
          >
            ✏️ 編集モードに切り替え
          </Link>
          <DownloadTemplateButton />
          <ImportButton />
          <DownloadButton type="my-characters" />
          {isAdmin && (
            <Link
              href="/admin/characters"
              className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 text-sm font-semibold"
            >
              ⚙️ キャラ管理
            </Link>
          )}
        </div>
      </div>

      {/* 説明文 */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>💡 ヒント：</strong>閲覧専用モードでは編集操作ができない代わりに、検索やフィルタリングがより安定して動作します。
          キャラ名検索が正常に動作しない場合は、このモードをお試しください。
        </p>
      </div>

      {/* キャラ名検索バー（独立） */}
      <div className="mb-6 bg-white rounded-lg shadow-md p-6">
        <CharacterNameSearchBar basePath="/accounts/view" />
      </div>

      {/* フィルター・検索 */}
      <AccountSearchFilter allWakuwaku={allWakuwaku} basePath="/accounts/view" />

      {/* キャラクター一覧テーブル（Read-only） */}
      <CharacterTable
        characterData={characterData}
        gameAccounts={user.gameAccounts.map(acc => ({
          id: acc.id,
          name: acc.name,
          accountNumber: acc.accountNumber,
        }))}
        allWakuwaku={allWakuwaku}
        onAddCharacter={dummyAction}
        onAddWakuwaku={dummyAction}
        onDeleteWakuwaku={dummyAction}
        onDeleteOwnedCharacter={dummyAction}
        readOnly={true}
      />

      <div className="mt-4 text-center text-gray-600">
        全{characterData.length}体のキャラクター
        {(element || type || search || selectedWakuwaku.length > 0 || hasEL) && ' (絞り込み中)'}
        {selectedWakuwaku.length > 0 && (
          <div className="mt-2 text-sm">
            ワクワク絞り込み: {selectedWakuwaku.join(', ')} ({wakuwakuMode === 'and' ? 'AND' : 'OR'}検索)
          </div>
        )}
      </div>
    </div>
  )
}
