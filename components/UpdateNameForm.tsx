'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function UpdateNameForm({
  currentName,
  updateNameAction,
}: {
  currentName: string | null
  updateNameAction: (formData: FormData) => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const { update } = useSession()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const formData = new FormData(e.currentTarget)
      const name = formData.get('name') as string

      // Server Actionを実行
      await updateNameAction(formData)

      // セッションを更新してヘッダーの名前を即座に更新
      await update({
        name: name.trim(),
      })

      setSuccess(true)
      router.refresh()

      // 成功メッセージを3秒後に消す
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || '更新中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          表示名
        </label>
        <input
          type="text"
          id="name"
          name="name"
          defaultValue={currentName || ''}
          required
          maxLength={50}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          placeholder="表示名を入力"
          disabled={loading}
        />
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          この名前はアプリ内で表示されます
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-200 px-4 py-3 rounded">
          表示名を更新しました
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white px-6 py-2 rounded-md font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {loading ? '保存中...' : '保存'}
      </button>
    </form>
  )
}
