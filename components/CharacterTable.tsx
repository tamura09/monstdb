'use client'

import { useState } from 'react'
import AddCharacterButton from './AddCharacterButton'
import OwnedCharacterCard from './OwnedCharacterCard'

type WakuwakuSlot = {
  id: string
  level: string
  wakuwakuMaster: {
    id: string
    name: string
  }
}

type OwnedCharacter = {
  id: string
  wakuwakuSlots: WakuwakuSlot[]
}

type CharacterMaster = {
  id: string
  monsterName: string
  element: string
  indexNumber: number
}

type GameAccount = {
  id: string
  name: string
  accountNumber: number
}

type CharacterData = {
  characterMaster: CharacterMaster
  accountOwnerships: Map<string, OwnedCharacter[]>
}

type CharacterTableProps = {
  characterData: Array<{
    characterMaster: CharacterMaster
    accountOwnerships: Record<string, OwnedCharacter[]>
  }>
  gameAccounts: GameAccount[]
  allWakuwaku: Array<{ id: string; name: string }>
  onAddCharacter: (formData: FormData) => Promise<void>
  onAddWakuwaku: (formData: FormData) => Promise<void>
  onDeleteWakuwaku: (formData: FormData) => Promise<void>
  onUpdateWakuwakuBulk?: (formData: FormData) => Promise<void>
  onDeleteOwnedCharacter?: (formData: FormData) => Promise<void>
  readOnly?: boolean
}

type SortKey = 'name' | 'no' | 'total'
type SortOrder = 'asc' | 'desc'

export default function CharacterTable({
  characterData,
  gameAccounts,
  allWakuwaku,
  onAddCharacter,
  onAddWakuwaku,
  onDeleteWakuwaku,
  onUpdateWakuwakuBulk,
  onDeleteOwnedCharacter,
  readOnly = false,
}: CharacterTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('no')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  // ソート処理
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      // 同じキーをクリックした場合は昇順/降順を切り替え
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      // 異なるキーをクリックした場合は昇順から開始
      setSortKey(key)
      setSortOrder('asc')
    }
  }

  // ソート用のアイコン
  const SortIcon = ({ currentKey }: { currentKey: SortKey }) => {
    if (sortKey !== currentKey) {
      return <span className="text-gray-400 ml-1">⇅</span>
    }
    return sortOrder === 'asc' ? (
      <span className="text-blue-600 ml-1">↑</span>
    ) : (
      <span className="text-blue-600 ml-1">↓</span>
    )
  }

  // 所持数トータルを計算
  const getTotal = (charData: typeof characterData[0]) => {
    let total = 0
    gameAccounts.forEach((account) => {
      const owned = charData.accountOwnerships[account.id] || []
      total += owned.length
    })
    return total
  }

  // データをソート
  const sortedData = [...characterData].sort((a, b) => {
    let comparison = 0

    switch (sortKey) {
      case 'name':
        comparison = a.characterMaster.monsterName.localeCompare(
          b.characterMaster.monsterName,
          'ja'
        )
        break
      case 'no':
        comparison = a.characterMaster.indexNumber - b.characterMaster.indexNumber
        break
      case 'total':
        comparison = getTotal(a) - getTotal(b)
        break
    }

    return sortOrder === 'asc' ? comparison : -comparison
  })

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-700 z-10">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center hover:text-blue-600 dark:hover:text-blue-400"
                >
                  キャラクター
                  <SortIcon currentKey="name" />
                </button>
                <button
                  onClick={() => handleSort('no')}
                  className="flex items-center hover:text-blue-600 dark:hover:text-blue-400 mt-1"
                >
                  <span className="text-[10px]">No順</span>
                  <SortIcon currentKey="no" />
                </button>
              </th>
              {gameAccounts.map((account) => (
                <th
                  key={account.id}
                  className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider"
                >
                  <div>{account.name}</div>
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">
                <button
                  onClick={() => handleSort('total')}
                  className="flex items-center justify-center hover:text-blue-600 dark:hover:text-blue-400 mx-auto"
                >
                  所持数
                  <SortIcon currentKey="total" />
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            {sortedData.map((charData) => {
              const total = getTotal(charData)
              return (
                <tr key={charData.characterMaster.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  {/* キャラクター名 */}
                  <td className="px-4 py-3 sticky left-0 bg-white dark:bg-gray-800 z-10 border-r border-gray-200 dark:border-gray-600">
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                          {charData.characterMaster.monsterName}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              charData.characterMaster.element === '火'
                                ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200'
                                : charData.characterMaster.element === '水'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                                : charData.characterMaster.element === '木'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200'
                                : charData.characterMaster.element === '光'
                                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200'
                                : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200'
                            }`}
                          >
                            {charData.characterMaster.element}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            No.{charData.characterMaster.indexNumber}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* 各アカウントの所持状況 */}
                  {gameAccounts.map((account) => {
                    const ownedChars =
                      charData.accountOwnerships[account.id] || []
                    return (
                      <td key={account.id} className="px-2 py-2 text-center align-middle dark:bg-gray-800">
                        <div className="space-y-2">
                          {/* 所持済みキャラクター */}
                          {ownedChars.map((ownedChar) => (
                            <OwnedCharacterCard
                              key={ownedChar.id}
                              ownedCharacterId={ownedChar.id}
                              wakuwakuSlots={ownedChar.wakuwakuSlots}
                              allWakuwaku={allWakuwaku}
                              onAddWakuwaku={onAddWakuwaku}
                              onDeleteWakuwaku={onDeleteWakuwaku}
                              onUpdateWakuwakuBulk={onUpdateWakuwakuBulk}
                              onDeleteOwnedCharacter={onDeleteOwnedCharacter}
                              readOnly={readOnly}
                            />
                          ))}
                          
                          {/* 追加ボタン（readOnlyでない場合のみ表示） */}
                          {!readOnly && (
                            <div className={ownedChars.length === 0 ? "min-h-[60px] flex items-center justify-center" : ""}>
                              <AddCharacterButton
                                key={`add-${account.id}-${charData.characterMaster.id}-${ownedChars.length}`}
                                accountId={account.id}
                                characterMasterId={charData.characterMaster.id}
                                characterName={charData.characterMaster.monsterName}
                                onAdd={onAddCharacter}
                              />
                            </div>
                          )}
                          
                          {/* readOnlyで所持がない場合 */}
                          {readOnly && ownedChars.length === 0 && (
                            <div className="min-h-[60px] flex items-center justify-center text-gray-400 text-xs">
                              未所持
                            </div>
                          )}
                        </div>
                      </td>
                    )
                  })}

                  {/* 所持数トータル */}
                  <td className="px-4 py-3 text-center align-middle bg-gray-50 dark:bg-gray-700 border-l border-gray-200 dark:border-gray-600">
                    <div className="font-bold text-lg text-gray-800 dark:text-gray-200">{total}</div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
