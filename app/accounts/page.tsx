import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import CharacterTable from '@/components/CharacterTable'
import DownloadButton from '@/components/DownloadButton'
import ImportButton from '@/components/ImportButton'
import DownloadTemplateButton from '@/components/DownloadTemplateButton'
import AccountSearchFilter from '@/components/AccountSearchFilter'
import CharacterNameSearchBar from '@/components/CharacterNameSearchBar'
import { matchesJapaneseOr } from '@/lib/string-utils'
import {
  addWakuwakuSlot,
  removeWakuwakuSlotById,
  replaceWakuwakuSlotsUnchecked,
} from '@/lib/wakuwaku/slots'
import { getCachedCharacterMasters, getCachedWakuwakuMasters } from '@/lib/cache/master-data'

export default async function AccountsPage({
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

  if (!user) {
    redirect('/login')
  }

  // Admin権限チェック
  const isAdmin = user.role === 'admin'

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

  // 所持情報を「アカウント → (図鑑IDごとの所持キャラ配列)」で事前にインデックス化
  // （1000体 × アカウント × 所持の総当たりフィルタを避け、O(1)ルックアップにする）
  const ownedByAccount = new Map<string, Map<string, typeof user.gameAccounts[number]['ownedCharacters']>>()
  for (const account of user.gameAccounts) {
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

    for (const account of user.gameAccounts) {
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

  // Server Action: キャラクター追加
  async function addCharacter(formData: FormData) {
    'use server'

    const gameAccountId = formData.get('accountId') as string
    const characterMasterId = formData.get('characterMasterId') as string

    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }

    // アカウントの所有者確認
    const account = await prisma.gameAccount.findUnique({
      where: { id: gameAccountId },
    })

    if (!account || account.userId !== session.user.id) {
      throw new Error('Unauthorized')
    }

    // キャラクター追加（複数体所持可能）
    await prisma.ownedCharacter.create({
      data: {
        gameAccountId,
        characterMasterId,
      },
    })

    revalidatePath('/accounts')
  }

  // Server Action: わくわくの実追加
  async function addWakuwaku(formData: FormData) {
    'use server'

    const currentSession = await getServerSession(authOptions)

    if (!currentSession?.user?.id) {
      throw new Error('Unauthorized')
    }

    const ownedCharacterId = formData.get('ownedCharacterId') as string
    const wakuwakuMasterId = formData.get('wakuwakuMasterId') as string
    const level = (formData.get('level') as string) || 'L'

    if (!ownedCharacterId || !wakuwakuMasterId) {
      return
    }

    // 所持キャラの所有者確認
    const ownedCharForAdd = await prisma.ownedCharacter.findUnique({
      where: { id: ownedCharacterId },
      include: {
        gameAccount: true,
      },
    })

    if (!ownedCharForAdd || ownedCharForAdd.gameAccount.userId !== currentSession.user.id) {
      throw new Error('Unauthorized')
    }

    await addWakuwakuSlot(ownedCharacterId, wakuwakuMasterId, level)

    revalidatePath('/accounts')
  }

  // Server Action: わくわくの実削除
  async function deleteWakuwaku(formData: FormData) {
    'use server'

    const currentSession = await getServerSession(authOptions)

    if (!currentSession?.user?.id) {
      throw new Error('Unauthorized')
    }

    const wakuwakuSlotId = formData.get('wakuwakuSlotId') as string

    if (!wakuwakuSlotId) {
      return
    }

    const slot = await prisma.ownedCharacterWakuwaku.findUnique({
      where: { id: wakuwakuSlotId },
      include: {
        ownedCharacter: {
          include: {
            gameAccount: true,
          },
        },
      },
    })

    if (!slot) {
      return
    }

    if (slot.ownedCharacter.gameAccount.userId !== currentSession.user.id) {
      throw new Error('Unauthorized')
    }

    await removeWakuwakuSlotById(wakuwakuSlotId)

    revalidatePath('/accounts')
  }

  // Server Action: わくわくの実一括更新
  async function updateWakuwakuBulk(formData: FormData) {
    'use server'

    const currentSession = await getServerSession(authOptions)

    if (!currentSession?.user?.id) {
      throw new Error('Unauthorized')
    }

    const ownedCharacterId = formData.get('ownedCharacterId') as string
    const slotsJson = formData.get('slots') as string

    if (!ownedCharacterId || !slotsJson) {
      return
    }

    // 所持キャラの所有者確認
    const ownedCharForBulk = await prisma.ownedCharacter.findUnique({
      where: { id: ownedCharacterId },
      include: {
        gameAccount: true,
      },
    })

    if (!ownedCharForBulk || ownedCharForBulk.gameAccount.userId !== currentSession.user.id) {
      throw new Error('Unauthorized')
    }

    try {
      const slots = JSON.parse(slotsJson) as Array<{
        wakuwakuMasterId: string
        level: string
      }>

      await replaceWakuwakuSlotsUnchecked(ownedCharacterId, slots)

      revalidatePath('/accounts')
    } catch (error) {
      console.error('わくわくの実一括更新エラー:', error)
      throw error
    }
  }

  // Server Action: 所持キャラ削除
  async function deleteOwnedCharacter(formData: FormData) {
    'use server'

    const ownedCharacterId = formData.get('ownedCharacterId') as string

    if (!ownedCharacterId || !session?.user?.id) {
      return
    }

    // 所持キャラの所有者確認
    const ownedChar = await prisma.ownedCharacter.findUnique({
      where: { id: ownedCharacterId },
      include: {
        gameAccount: true,
      },
    })

    if (!ownedChar || ownedChar.gameAccount.userId !== session.user.id) {
      throw new Error('Unauthorized')
    }

    // 所持キャラを削除（わくわくの実も自動で削除される）
    await prisma.ownedCharacter.delete({
      where: { id: ownedCharacterId },
    })

    revalidatePath('/accounts')
  }

  return (
    <div className="max-w-[1800px] mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">マイアカウント</h1>
          <p className="text-gray-600 dark:text-gray-400">{user.name}さんのアカウント一覧</p>
        </div>
        <div className="flex gap-3">
          {/* 一時的に無効化 */}
          {/* <Link
            href="/accounts/view"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-sm font-semibold flex items-center gap-2"
          >
            📖 閲覧専用モード
          </Link> */}
          <DownloadTemplateButton />
          <ImportButton />
          <DownloadButton type="my-characters" />
          {isAdmin && (
            <Link
              href="/admin/characters"
              className="bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-sm font-semibold"
            >
              ⚙️ キャラ管理
            </Link>
          )}
        </div>
      </div>

      {/* キャラ名検索バー（独立） */}
      <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <CharacterNameSearchBar basePath="/accounts" />
      </div>

      {/* フィルター・検索 */}
      <AccountSearchFilter allWakuwaku={allWakuwaku} />

      {/* キャラクター一覧テーブル */}
      <CharacterTable
        characterData={characterData}
        initialSortKey="no"
        initialSortOrder="desc"
        gameAccounts={user.gameAccounts.map(acc => ({
          id: acc.id,
          name: acc.name,
          accountNumber: acc.accountNumber,
        }))}
        allWakuwaku={allWakuwaku}
        onAddCharacter={addCharacter}
        onAddWakuwaku={addWakuwaku}
        onDeleteWakuwaku={deleteWakuwaku}
        onUpdateWakuwakuBulk={updateWakuwakuBulk}
        onDeleteOwnedCharacter={deleteOwnedCharacter}
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
