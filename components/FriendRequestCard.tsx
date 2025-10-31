'use client'

import { useState, useTransition } from 'react'

type FriendRequestCardProps = {
  request: {
    id: string
    sender: {
      id: string
      name: string | null
      image: string | null
    }
  }
  onAccept: (formData: FormData) => Promise<void>
  onReject: (formData: FormData) => Promise<void>
}

export default function FriendRequestCard({
  request,
  onAccept,
  onReject,
}: FriendRequestCardProps) {
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState<'accept' | 'reject' | null>(null)

  async function handleAccept(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAction('accept')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await onAccept(formData)
    })
  }

  async function handleReject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setAction('reject')
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await onReject(formData)
    })
  }

  return (
    <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
      <div className="flex items-center gap-3">
        {request.sender.image && (
          <img
            src={request.sender.image}
            alt={request.sender.name || ''}
            className="w-10 h-10 rounded-full"
          />
        )}
        <div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">
            {request.sender.name}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">フレンド申請</div>
        </div>
      </div>
      <div className="flex gap-2">
        <form onSubmit={handleAccept}>
          <input type="hidden" name="requestId" value={request.id} />
          <button
            type="submit"
            disabled={isPending}
            className="bg-green-600 dark:bg-green-700 text-white px-4 py-2 rounded hover:bg-green-700 dark:hover:bg-green-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            {isPending && action === 'accept' && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isPending && action === 'accept' ? '処理中...' : '承認'}
          </button>
        </form>
        <form onSubmit={handleReject}>
          <input type="hidden" name="requestId" value={request.id} />
          <button
            type="submit"
            disabled={isPending}
            className="bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 px-4 py-2 rounded hover:bg-gray-400 dark:hover:bg-gray-500 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
          >
            {isPending && action === 'reject' && (
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isPending && action === 'reject' ? '処理中...' : '拒否'}
          </button>
        </form>
      </div>
    </div>
  )
}
