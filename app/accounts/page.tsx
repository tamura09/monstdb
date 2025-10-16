import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import WakuwakuFilter from '@/components/WakuwakuFilter'
import CharacterTable from '@/components/CharacterTable'
import DownloadButton from '@/components/DownloadButton'
import ImportButton from '@/components/ImportButton'

export default async function AccountsPage({
  searchParams,
}: {
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

  const elements = ['火', '水', '木', '光', '闇']
  const types = ['限定', '恒常', 'α', 'コラボ']

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

    const ownedCharacterId = formData.get('ownedCharacterId') as string
    const wakuwakuMasterId = formData.get('wakuwakuMasterId') as string

    if (!ownedCharacterId || !wakuwakuMasterId) {
      return
    }

    // 既存のわくわくの実の数を確認
    const existingSlots = await prisma.ownedCharacterWakuwaku.findMany({
      where: { ownedCharacterId },
    })

    if (existingSlots.length >= 3) {
      revalidatePath('/accounts')
      return
    }

    // 次のスロット番号を決定（仮）
    const nextSlotNumber = existingSlots.length + 1

    // わくわくの実を追加
    await prisma.ownedCharacterWakuwaku.create({
      data: {
        ownedCharacterId,
        wakuwakuMasterId,
        slotNumber: nextSlotNumber,
      },
    })

    // 追加後、displayOrderに基づいてソート
    const allSlots = await prisma.ownedCharacterWakuwaku.findMany({
      where: { ownedCharacterId },
      include: {
        wakuwakuMaster: true,
      },
    })

    // displayOrderでソート
    const sortedSlots = allSlots.sort((a, b) => 
      a.wakuwakuMaster.displayOrder - b.wakuwakuMaster.displayOrder
    )

    // スロット番号を振り直す（衝突を避けるため、まず一時的に大きな値を設定）
    for (let i = 0; i < sortedSlots.length; i++) {
      await prisma.ownedCharacterWakuwaku.update({
        where: { id: sortedSlots[i].id },
        data: { slotNumber: 100 + i },
      })
    }

    // 正しいスロット番号に設定
    for (let i = 0; i < sortedSlots.length; i++) {
      await prisma.ownedCharacterWakuwaku.update({
        where: { id: sortedSlots[i].id },
        data: { slotNumber: i + 1 },
      })
    }

    revalidatePath('/accounts')
  }

  // Server Action: わくわくの実削除
  async function deleteWakuwaku(formData: FormData) {
    'use server'

    const wakuwakuSlotId = formData.get('wakuwakuSlotId') as string

    if (!wakuwakuSlotId) {
      return
    }

    const slot = await prisma.ownedCharacterWakuwaku.findUnique({
      where: { id: wakuwakuSlotId },
    })

    if (!slot) {
      return
    }

    // 削除
    await prisma.ownedCharacterWakuwaku.delete({
      where: { id: wakuwakuSlotId },
    })

    // 残りのスロットを取得してdisplayOrderでソート
    const remainingSlots = await prisma.ownedCharacterWakuwaku.findMany({
      where: { ownedCharacterId: slot.ownedCharacterId },
      include: {
        wakuwakuMaster: true,
      },
    })

    // displayOrderでソート
    const sortedSlots = remainingSlots.sort((a, b) => 
      a.wakuwakuMaster.displayOrder - b.wakuwakuMaster.displayOrder
    )

    // スロット番号を1,2,3に振り直す（衝突を避けるため、まず一時的に大きな値を設定）
    for (let i = 0; i < sortedSlots.length; i++) {
      await prisma.ownedCharacterWakuwaku.update({
        where: { id: sortedSlots[i].id },
        data: { slotNumber: 100 + i },
      })
    }

    // 正しいスロット番号に設定
    for (let i = 0; i < sortedSlots.length; i++) {
      await prisma.ownedCharacterWakuwaku.update({
        where: { id: sortedSlots[i].id },
        data: { slotNumber: i + 1 },
      })
    }

    revalidatePath('/accounts')
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
          <h1 className="text-3xl font-bold text-gray-800 mb-2">マイアカウント</h1>
          <p className="text-gray-600">{user.name}さんのアカウント一覧</p>
        </div>
        <div className="flex gap-3">
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
                href="/accounts"
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
                  href={`/accounts?element=${el}${type ? `&type=${type}` : ''}${
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
              種類
            </label>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/accounts${element ? `?element=${element}` : ''}${
                  search ? `${element ? '&' : '?'}search=${search}` : ''
                }${wakuwaku ? `${element || search ? '&' : '?'}wakuwaku=${wakuwaku}` : ''}${wakuwakuMode ? `${element || search || wakuwaku ? '&' : '?'}wakuwakuMode=${wakuwakuMode}` : ''}`}
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
                  href={`/accounts?type=${t}${
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
            <form action="/accounts" method="get">
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
            />
          </div>
        </div>
      </div>

      {/* キャラクター一覧テーブル */}
      <CharacterTable
        characterData={characterData}
        gameAccounts={user.gameAccounts.map(acc => ({
          id: acc.id,
          name: acc.name,
          accountNumber: acc.accountNumber,
        }))}
        allWakuwaku={allWakuwaku}
        onAddCharacter={addCharacter}
        onAddWakuwaku={addWakuwaku}
        onDeleteWakuwaku={deleteWakuwaku}
        onDeleteOwnedCharacter={deleteOwnedCharacter}
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
