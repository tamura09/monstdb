'use client'

import { useState } from 'react'

export default function DeleteCharacterButton({
  ownedCharacterId,
  characterName,
  onDelete,
}: {
  ownedCharacterId: string
  characterName: string
  onDelete: (formData: FormData) => Promise<void>
}) {
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    if (!confirm(`${characterName}を削除しますか？`)) {
      return
    }

    setIsDeleting(true)
    const formData = new FormData(e.currentTarget)
    await onDelete(formData)
  }

  return (
    <form onSubmit={handleDelete}>
      <input type="hidden" name="ownedCharacterId" value={ownedCharacterId} />
      <button
        type="submit"
        disabled={isDeleting}
        className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm disabled:bg-gray-400"
      >
        {isDeleting ? '削除中...' : '削除'}
      </button>
    </form>
  )
}
