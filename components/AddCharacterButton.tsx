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

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!confirm(`${characterName}を追加しますか？`)) {
      return
    }

    setIsAdding(true)
    try {
      const formData = new FormData(e.currentTarget)
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
    <form onSubmit={handleAdd} className="w-full">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="characterMasterId" value={characterMasterId} />
      <button
        type="submit"
        disabled={isAdding}
        className="w-full px-4 py-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 border border-dashed border-gray-300 hover:border-blue-400"
        title={`${characterName}を追加`}
      >
        {isAdding ? (
          <span className="text-xs text-gray-600">追加中...</span>
        ) : (
          <span className="text-xl font-light">+</span>
        )}
      </button>
    </form>
  )
}
