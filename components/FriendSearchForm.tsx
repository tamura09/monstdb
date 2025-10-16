'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function FriendSearchForm() {
  const router = useRouter()
  const [friendId, setFriendId] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (friendId.trim()) {
      router.push(`/friends?search=${encodeURIComponent(friendId.trim())}`)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={friendId}
        onChange={(e) => setFriendId(e.target.value)}
        placeholder="フレンドIDを入力..."
        className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="submit"
        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 font-medium"
      >
        検索
      </button>
    </form>
  )
}
