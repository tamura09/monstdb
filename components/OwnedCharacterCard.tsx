'use client'

import { useState } from 'react'

type WakuwakuSlot = {
  id: string
  wakuwakuMaster: {
    id: string
    name: string
  }
}

type WakuwakuMaster = {
  id: string
  name: string
}

type OwnedCharacterCardProps = {
  ownedCharacterId: string
  wakuwakuSlots: WakuwakuSlot[]
  allWakuwaku: WakuwakuMaster[]
  onAddWakuwaku: (formData: FormData) => Promise<void>
  onDeleteWakuwaku: (formData: FormData) => Promise<void>
  onDeleteOwnedCharacter?: (formData: FormData) => Promise<void>
  readOnly?: boolean
}

export default function OwnedCharacterCard({
  ownedCharacterId,
  wakuwakuSlots,
  allWakuwaku,
  onAddWakuwaku,
  onDeleteWakuwaku,
  onDeleteOwnedCharacter,
  readOnly = false,
}: OwnedCharacterCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  async function handleAddWakuwaku(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    setIsAdding(true)
    try {
      const formData = new FormData(form)
      await onAddWakuwaku(formData)
      // リセット後、フォームをクリア
      form.reset()
    } finally {
      setIsAdding(false)
    }
  }

  async function handleDeleteWakuwaku(slotId: string) {
    if (!confirm('このわくわくの実を削除しますか？')) {
      return
    }

    const formData = new FormData()
    formData.append('wakuwakuSlotId', slotId)
    
    try {
      await onDeleteWakuwaku(formData)
    } catch (error) {
      console.error('わくわくの実削除エラー:', error)
      alert('わくわくの実の削除に失敗しました')
    }
  }

  async function handleDeleteOwnedCharacter() {
    if (!confirm('この所持キャラクターを削除しますか？\nわくわくの実も全て削除されます。')) {
      return
    }

    if (!onDeleteOwnedCharacter) return

    const formData = new FormData()
    formData.append('ownedCharacterId', ownedCharacterId)
    
    try {
      await onDeleteOwnedCharacter(formData)
    } catch (error) {
      console.error('所持キャラ削除エラー:', error)
      alert('所持キャラクターの削除に失敗しました')
    }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-left relative">
      {/* 所持キャラ削除ボタン（readOnlyでない場合のみ表示） */}
      {!readOnly && onDeleteOwnedCharacter && (
        <button
          onClick={handleDeleteOwnedCharacter}
          className="absolute top-1 right-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs"
          title="この所持キャラを削除"
        >
          ×
        </button>
      )}

      {/* 所持バッジ（readOnlyでない場合のみクリック可能） */}
      <div className="flex items-center justify-center mb-1">
        {!readOnly ? (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-0.5 rounded-full font-semibold transition-colors cursor-pointer"
          >
            所持 {isOpen ? '▲' : '▼'}
          </button>
        ) : (
          <div className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
            所持
          </div>
        )}
      </div>

      {/* ドロップダウンコンテンツ（readOnlyでない場合のみ） */}
      {!readOnly && isOpen && (
        <div className="mt-2 space-y-2 border-t border-blue-300 pt-2">
          {/* わくわくの実一覧 */}
          {wakuwakuSlots.length > 0 && (
            <div className="space-y-1 text-xs">
              {wakuwakuSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="bg-green-100 text-green-800 px-2 py-1 rounded flex items-center justify-between"
                >
                  <span>{slot.wakuwakuMaster.name}</span>
                  <button
                    onClick={() => handleDeleteWakuwaku(slot.id)}
                    className="text-red-600 hover:text-red-800 ml-1 font-bold"
                    title="削除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* わくわくの実が0個の場合 */}
          {wakuwakuSlots.length === 0 && (
            <div className="text-xs text-gray-500 text-center py-1">
              わくわくの実なし
            </div>
          )}

          {/* わくわくの実追加フォーム（3個未満の場合） */}
          {wakuwakuSlots.length < 3 && (
            <form onSubmit={handleAddWakuwaku} className="space-y-1">
              <input type="hidden" name="ownedCharacterId" value={ownedCharacterId} />
              <select
                name="wakuwakuMasterId"
                required
                disabled={isAdding}
                className="w-full text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500"
              >
                <option value="">実を追加...</option>
                {allWakuwaku.map((wakuwaku) => (
                  <option key={wakuwaku.id} value={wakuwaku.id}>
                    {wakuwaku.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={isAdding}
                className="w-full bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 rounded font-semibold disabled:bg-gray-400"
              >
                {isAdding ? '追加中...' : '+ 追加'}
              </button>
            </form>
          )}

          {/* 3個満タンの場合 */}
          {wakuwakuSlots.length >= 3 && (
            <div className="text-xs text-gray-500 text-center py-1">
              わくわくの実は最大3個です
            </div>
          )}
        </div>
      )}

      {/* 閉じている時またはreadOnlyの時のわくわくの実表示 */}
      {(!isOpen || readOnly) && wakuwakuSlots.length > 0 && (
        <div className="space-y-1 text-xs">
          {wakuwakuSlots.map((slot) => (
            <div
              key={slot.id}
              className="bg-green-100 text-green-800 px-2 py-1 rounded"
            >
              {slot.wakuwakuMaster.name}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
