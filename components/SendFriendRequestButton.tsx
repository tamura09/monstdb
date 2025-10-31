'use client'

import { useTransition } from 'react'

type SendFriendRequestButtonProps = {
  receiverId: string
  onSend: (formData: FormData) => Promise<void>
}

export default function SendFriendRequestButton({
  receiverId,
  onSend,
}: SendFriendRequestButtonProps) {
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      await onSend(formData)
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="receiverId" value={receiverId} />
      <button
        type="submit"
        disabled={isPending}
        className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-700 dark:hover:bg-blue-600 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
      >
        {isPending && (
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {isPending ? '送信中...' : 'フレンド申請'}
      </button>
    </form>
  )
}
