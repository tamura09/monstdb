'use client'

import { useState } from 'react'

export default function AddCharacterButton({
  accountId,
  characterMasterId,
  characterName,
  onAdd,
}: {
  accountId: string
  characterMasterId: string
  characterName: string
  onAdd: (formData: FormData) => Promise<void>
}) {
  const [isAdding, setIsAdding] = useState(false)

  async function handleAdd() {
    if (!confirm(`${characterName}を追加しますか？`)) {
      return
    }

    setIsAdding(true)
    try {
      const formData = new FormData()
      formData.append('accountId', accountId)
      formData.append('characterMasterId', characterMasterId)
      await onAdd(formData)
      // 成功後は親コンポーネントがrevalidateするので、状態はそのままでOK
      // ページがリロードされるため、setIsAdding(false)は不要
    } catch (error) {
      console.error('キャラクター追加エラー:', error)
      alert('キャラクターの追加に失敗しました')
      setIsAdding(false)
    }
  }

  return (
    <button
      onClick={handleAdd}
      disabled={isAdding}
      className="w-full px-4 py-2 text-faint hover:text-ink hover:bg-line2 rounded-md transition-colors disabled:opacity-50 border border-dashed border-line hover:border-ink"
      title={`${characterName}を追加`}
    >
      {isAdding ? (
        <span className="text-xs text-dim">追加中...</span>
      ) : (
        <span className="text-xl font-light">+</span>
      )}
    </button>
  )
}
