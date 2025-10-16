'use client'

import { useState } from 'react'

export default function DeleteCharacterMasterButton({
  characterId,
  characterName,
  onDelete,
}: {
  characterId: string
  characterName: string
  onDelete: (formData: FormData) => Promise<void>
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!confirm(`${characterName}を削除しますか？\n※関連する所持データも全て削除されます`)) {
      return
    }

    setIsDeleting(true)
    try {
      const formData = new FormData(e.currentTarget)
      await onDelete(formData)
    } catch (error) {
      console.error('削除エラー:', error)
      alert('削除に失敗しました')
      setIsDeleting(false)
    }
  }

  return (
    <form onSubmit={handleDelete} className="inline">
      <input type="hidden" name="characterId" value={characterId} />
      <button
        type="submit"
        disabled={isDeleting}
        className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm disabled:opacity-50"
      >
        {isDeleting ? '削除中...' : '削除'}
      </button>
    </form>
  )
}
