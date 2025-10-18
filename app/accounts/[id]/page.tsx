import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import DeleteCharacterButton from '@/components/DeleteCharacterButton'

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const account = await prisma.gameAccount.findUnique({
    where: { id },
    include: {
      user: true,
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
        orderBy: {
          characterMaster: {
            indexNumber: 'asc',
          },
        },
      },
    },
  })

  if (!account) {
    notFound()
  }

  // アクセス制御: 自分のアカウントのみアクセス可能
  if (account.userId !== session.user.id) {
    redirect('/accounts')
  }

  async function addCharacter(formData: FormData) {
    'use server'

    const characterMasterId = formData.get('characterMasterId') as string

    if (!characterMasterId) {
      return
    }

    await prisma.ownedCharacter.create({
      data: {
        gameAccountId: id,
        characterMasterId,
      },
    })

    redirect(`/accounts/${id}`)
  }

  async function deleteCharacter(formData: FormData) {
    'use server'

    const ownedCharacterId = formData.get('ownedCharacterId') as string

    if (!ownedCharacterId) {
      return
    }

    await prisma.ownedCharacter.delete({
      where: { id: ownedCharacterId },
    })

    redirect(`/accounts/${id}`)
  }

  async function addWakuwaku(formData: FormData) {
    'use server'

    const ownedCharacterId = formData.get('ownedCharacterId') as string
    const wakuwakuMasterId = formData.get('wakuwakuMasterId') as string
    const level = (formData.get('level') as string) || 'L'

    if (!ownedCharacterId || !wakuwakuMasterId) {
      return
    }

    // 既存のわくわくの実の数を確認
    const existingSlots = await prisma.ownedCharacterWakuwaku.findMany({
      where: { ownedCharacterId },
    })

    if (existingSlots.length >= 4) {
      // 既に4個ついている場合は追加しない
      redirect(`/accounts/${id}`)
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
        level,
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

    redirect(`/accounts/${id}`)
  }

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

    // スロット番号を1,2,3,4に振り直す（衝突を避けるため、まず一時的に大きな値を設定）
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

    redirect(`/accounts/${id}`)
  }

  const allCharacters = await prisma.characterMaster.findMany({
    orderBy: {
      indexNumber: 'asc',
    },
  })

  const allWakuwaku = await prisma.wakuwakuMaster.findMany({
    orderBy: {
      displayOrder: 'asc',
    },
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/accounts"
          className="text-blue-600 hover:text-blue-800 flex items-center gap-2"
        >
          ← アカウント一覧に戻る
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              {account.name}
            </h1>
            <p className="text-gray-600 mt-2">
              ユーザー: {account.user.name} | アカウント {account.accountNumber}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">所持キャラ数</p>
            <p className="text-4xl font-bold text-blue-600">
              {account.ownedCharacters.length}
            </p>
          </div>
        </div>
      </div>

      {/* キャラクター追加フォーム */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          キャラクターを追加
        </h2>
        <form action={addCharacter} className="flex gap-4">
          <select
            name="characterMasterId"
            required
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">キャラクターを選択...</option>
            {allCharacters.map((char) => (
              <option key={char.id} value={char.id}>
                {char.monsterName} ({char.element} / {char.type}) - No.
                {char.indexNumber}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-semibold"
          >
            追加
          </button>
        </form>
      </div>

      {/* 所持キャラクター一覧 */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">
          所持キャラクター一覧
        </h2>

        {account.ownedCharacters.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            まだキャラクターが登録されていません
          </p>
        ) : (
          <div className="space-y-4">
            {account.ownedCharacters.map((ownedChar) => (
              <div
                key={ownedChar.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-800">
                        {ownedChar.characterMaster.monsterName}
                      </h3>
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          ownedChar.characterMaster.element === '火'
                            ? 'bg-red-100 text-red-800'
                            : ownedChar.characterMaster.element === '水'
                            ? 'bg-blue-100 text-blue-800'
                            : ownedChar.characterMaster.element === '木'
                            ? 'bg-green-100 text-green-800'
                            : ownedChar.characterMaster.element === '光'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {ownedChar.characterMaster.element}
                      </span>
                      <span className="text-sm text-gray-500">
                        No.{ownedChar.characterMaster.indexNumber}
                      </span>
                    </div>

                    {/* わくわくの実 */}
                    <div className="mt-4 border-t pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-700">
                          わくわくの実 ({ownedChar.wakuwakuSlots.length}/3)
                        </span>
                      </div>

                      {/* わくわくの実一覧 */}
                      {ownedChar.wakuwakuSlots.length === 0 ? (
                        <div className="text-sm text-gray-400 mb-3">
                          まだわくわくの実がついていません
                        </div>
                      ) : (
                        <div className="space-y-2 mb-3">
                          {ownedChar.wakuwakuSlots.map((slot, index) => (
                            <div
                              key={slot.id}
                              className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="bg-green-600 text-white text-xs px-2 py-1 rounded-full font-semibold">
                                  {index + 1}
                                </span>
                                <span className="text-sm text-green-800 font-medium">
                                  {slot.wakuwakuMaster.name}
                                </span>
                              </div>
                              <form action={deleteWakuwaku}>
                                <input
                                  type="hidden"
                                  name="wakuwakuSlotId"
                                  value={slot.id}
                                />
                                <button
                                  type="submit"
                                  className="text-red-600 hover:text-red-800 text-xs font-semibold"
                                >
                                  削除
                                </button>
                              </form>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* わくわくの実追加フォーム */}
                      {ownedChar.wakuwakuSlots.length < 3 && (
                        <form action={addWakuwaku} className="flex gap-2">
                          <input
                            type="hidden"
                            name="ownedCharacterId"
                            value={ownedChar.id}
                          />
                          <select
                            name="wakuwakuMasterId"
                            required
                            className="flex-1 text-sm px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                          >
                            <option value="">わくわくの実を選択...</option>
                            {allWakuwaku.map((wakuwaku) => (
                              <option key={wakuwaku.id} value={wakuwaku.id}>
                                {wakuwaku.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md font-semibold text-sm whitespace-nowrap"
                          >
                            + 追加
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  <DeleteCharacterButton
                    ownedCharacterId={ownedChar.id}
                    characterName={ownedChar.characterMaster.monsterName}
                    onDelete={deleteCharacter}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
