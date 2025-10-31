'use client'

import { useState, useTransition } from 'react'
import WakuwakuEditModal from './WakuwakuEditModal'

type WakuwakuSlot = {
  id: string
  level: string
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
  onUpdateWakuwakuBulk?: (formData: FormData) => Promise<void>
  onDeleteOwnedCharacter?: (formData: FormData) => Promise<void>
  readOnly?: boolean
}

export default function OwnedCharacterCard({
  ownedCharacterId,
  wakuwakuSlots,
  allWakuwaku,
  onAddWakuwaku,
  onDeleteWakuwaku,
  onUpdateWakuwakuBulk,
  onDeleteOwnedCharacter,
  readOnly = false,
}: OwnedCharacterCardProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [deletingSlotId, setDeletingSlotId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

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

    setDeletingSlotId(slotId)
    const formData = new FormData()
    formData.append('wakuwakuSlotId', slotId)
    
    try {
      startTransition(async () => {
        await onDeleteWakuwaku(formData)
        setDeletingSlotId(null)
      })
    } catch (error) {
      console.error('わくわくの実削除エラー:', error)
      alert('わくわくの実の削除に失敗しました')
      setDeletingSlotId(null)
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
      startTransition(async () => {
        await onDeleteOwnedCharacter(formData)
      })
    } catch (error) {
      console.error('所持キャラ削除エラー:', error)
      alert('所持キャラクターの削除に失敗しました')
    }
  }

  async function handleSaveBulk(formData: FormData) {
    if (!onUpdateWakuwakuBulk) return
    await onUpdateWakuwakuBulk(formData)
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-2 text-left relative">
      {/* 所持キャラ削除ボタン（readOnlyでない場合のみ表示） */}
      {!readOnly && onDeleteOwnedCharacter && (
        <button
          onClick={handleDeleteOwnedCharacter}
          disabled={isPending}
          className="absolute top-1 right-1 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900 rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          title="この所持キャラを削除"
        >
          {isPending ? '...' : '×'}
        </button>
      )}

      {/* 所持バッジ（readOnlyでない場合のみクリック可能） */}
      <div className="flex items-center justify-center mb-1">
        {!readOnly ? (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full font-semibold transition-colors cursor-pointer"
          >
            所持 {isOpen ? '▲' : '▼'}
          </button>
        ) : (
          <div className="bg-blue-600 dark:bg-blue-700 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
            所持
          </div>
        )}
      </div>

      {/* ドロップダウンコンテンツ（readOnlyでない場合のみ） */}
      {!readOnly && isOpen && (
        <div className="mt-2 space-y-2 border-t border-blue-300 dark:border-blue-600 pt-2">
          {/* わくわくの実一覧 */}
          {wakuwakuSlots.length > 0 && (
            <div className="space-y-1 text-xs">
              {wakuwakuSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded flex items-center justify-between"
                >
                  <span>
                    {slot.wakuwakuMaster.name}
                    {slot.level && (
                      <span className="ml-1 text-[10px] font-semibold bg-green-200 dark:bg-green-800 px-1 rounded">
                        {slot.level}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* わくわくの実が0個の場合 */}
          {wakuwakuSlots.length === 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-1">
              わくわくの実なし
            </div>
          )}

          {/* 一括編集ボタン */}
          {onUpdateWakuwakuBulk && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="w-full bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-white text-xs px-2 py-1 rounded font-semibold"
            >
              わくわくの実を編集
            </button>
          )}
        </div>
      )}

      {/* 閉じている時またはreadOnlyの時のわくわくの実表示 */}
      {(!isOpen || readOnly) && wakuwakuSlots.length > 0 && (
        <div className="space-y-1 text-xs">
          {wakuwakuSlots.map((slot) => (
            <div
              key={slot.id}
              className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded"
            >
              {slot.wakuwakuMaster.name}
              {slot.level && (
                <span className="ml-1 text-[10px] font-semibold bg-green-200 dark:bg-green-800 px-1 rounded">
                  {slot.level}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* わくわくの実編集モーダル */}
      {onUpdateWakuwakuBulk && (
        <WakuwakuEditModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          ownedCharacterId={ownedCharacterId}
          currentSlots={wakuwakuSlots}
          allWakuwaku={allWakuwaku}
          onSave={handleSaveBulk}
        />
      )}
    </div>
  )
}
