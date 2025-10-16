'use client'

import Link from 'next/link'
import { useState } from 'react'

type FriendCardProps = {
  friend: {
    id: string
    name: string | null
    image: string | null
    gameAccounts: Array<{
      _count: {
        ownedCharacters: number
      }
    }>
  }
  onRemove: (formData: FormData) => Promise<void>
}

export default function FriendCard({ friend, onRemove }: FriendCardProps) {
  const [showConfirm, setShowConfirm] = useState(false)

  const totalCharacters = friend.gameAccounts.reduce(
    (sum, acc) => sum + acc._count.ownedCharacters,
    0
  )

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-start gap-3">
        {friend.image && (
          <img
            src={friend.image}
            alt={friend.name || ''}
            className="w-12 h-12 rounded-full"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 mb-1">
            {friend.name}
          </div>
          <div className="text-sm text-gray-500 mb-2">
            {totalCharacters}体所持
          </div>
          <div className="flex gap-2">
            <Link
              href={`/friends/${friend.id}`}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              所持状況を見る
            </Link>
          </div>
        </div>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            削除
          </button>
        ) : (
          <div className="flex flex-col gap-1">
            <form action={onRemove}>
              <input type="hidden" name="friendId" value={friend.id} />
              <button
                type="submit"
                className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-xs"
              >
                削除確定
              </button>
            </form>
            <button
              onClick={() => setShowConfirm(false)}
              className="text-gray-600 hover:text-gray-800 text-xs"
            >
              キャンセル
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
