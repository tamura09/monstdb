'use client'

import { useState } from 'react'

type UpdateGameAccountNameFormProps = {
  accountId: string
  currentName: string
  updateNameAction: (formData: FormData) => Promise<void>
}

export default function UpdateGameAccountNameForm({
  accountId,
  currentName,
  updateNameAction,
}: UpdateGameAccountNameFormProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(currentName)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setMessage(null)

    try {
      const formData = new FormData()
      formData.append('accountId', accountId)
      formData.append('name', name)
      
      await updateNameAction(formData)
      
      setMessage({ type: 'success', text: 'アカウント名を更新しました' })
      setIsEditing(false)
    } catch (error) {
      setMessage({ type: 'error', text: 'アカウント名の更新に失敗しました' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancel = () => {
    setName(currentName)
    setIsEditing(false)
    setMessage(null)
  }

  if (!isEditing) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-900 dark:text-gray-100">{currentName}</div>
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
        >
          編集
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={1}
          maxLength={50}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600 text-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100"
          placeholder="アカウント名"
        />
      </div>
      
      {message && (
        <div
          className={`text-sm p-2 rounded ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isLoading || name.trim().length === 0}
          className="flex-1 bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:bg-gray-400 disabled:dark:bg-gray-600 text-sm font-medium"
        >
          {isLoading ? '更新中...' : '保存'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={isLoading}
          className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 disabled:bg-gray-100 disabled:dark:bg-gray-700 text-sm font-medium"
        >
          キャンセル
        </button>
      </div>
    </form>
  )
}
