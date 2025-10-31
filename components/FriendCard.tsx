'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

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
  const [isPending, startTransition] = useTransition()
  const [isNavigating, setIsNavigating] = useState(false)

  const totalCharacters = friend.gameAccounts.reduce(
    (sum, acc) => sum + acc._count.ownedCharacters,
    0
  )

  async function handleRemove(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await onRemove(formData)
    })
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
      <div className="flex items-start gap-3">
        {friend.image && (
          <img
            src={friend.image}
            alt={friend.name || ''}
            className="w-12 h-12 rounded-full"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
            {friend.name}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {totalCharacters}体所持
          </div>
          <div className="flex gap-2">
            <Link
              href={`/friends/${friend.id}`}
              onClick={() => setIsNavigating(true)}
              className={`text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium inline-flex items-center gap-1 ${
                isNavigating ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              {isNavigating ? (
                <>
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  読み込み中...
                </>
              ) : (
                '所持状況を見る'
              )}
            </Link>
          </div>
        </div>
        {!showConfirm ? (
          <button
            onClick={() => setShowConfirm(true)}
            disabled={isPending}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            削除
          </button>
        ) : (
          <div className="flex flex-col gap-1">
            <form onSubmit={handleRemove}>
              <input type="hidden" name="friendId" value={friend.id} />
              <button
                type="submit"
                disabled={isPending}
                className="bg-red-600 dark:bg-red-700 text-white px-3 py-1 rounded hover:bg-red-700 dark:hover:bg-red-600 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? '削除中...' : '削除確定'}
              </button>
            </form>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={isPending}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 text-xs disabled:opacity-50"
            >
              キャンセル
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
