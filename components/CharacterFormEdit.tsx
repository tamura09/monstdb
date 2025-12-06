'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const elements = ['火', '水', '木', '光', '闇']
const types = ['限定', '恒常', 'α', 'コラボ']

type Character = {
  id: string
  indexNumber: number
  monsterName: string
  element: string
  type: string
}

export default function CharacterFormEdit({
  character,
  errorParam,
}: {
  character: Character
  errorParam?: string
}) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(errorParam)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(undefined)

    const formData = new FormData(e.currentTarget)
    const data = {
      characterId: character.id,
      indexNumber: formData.get('indexNumber'),
      monsterName: formData.get('monsterName'),
      element: formData.get('element'),
      type: formData.get('type'),
    }

    try {
      const response = await fetch('/api/admin/characters', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()

      if (!response.ok) {
        if (result.error === 'duplicate') {
          setError('duplicate')
          setIsSubmitting(false)
          return
        }
        throw new Error(result.error || 'エラーが発生しました')
      }

      // 成功したら一覧ページにリダイレクト
      router.refresh()
      router.push('/admin/characters?success=updated')
    } catch (err) {
      console.error('更新エラー:', err)
      alert('キャラクターの更新に失敗しました')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          キャラクター編集
        </h1>
      </div>

      <div className="mb-6">
        <Link
          href="/admin/characters"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← キャラクター管理に戻る
        </Link>
      </div>

      {/* エラーメッセージ */}
      {error === 'duplicate' && (
        <div className="bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 px-4 py-3 rounded mb-6">
          <strong className="font-bold">エラー: </strong>
          <span>入力された図鑑No.は既に他のキャラクターで使用されています。別の番号を入力してください。</span>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* インデックス番号 */}
            <div>
              <label
                htmlFor="indexNumber"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                図鑑No. <span className="text-red-600 dark:text-red-400">*</span>
              </label>
              <input
                type="number"
                id="indexNumber"
                name="indexNumber"
                required
                min="1"
                defaultValue={character.indexNumber}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 ${
                  error === 'duplicate'
                    ? 'border-red-500 dark:border-red-400 focus:ring-red-500 dark:focus:ring-red-400'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 dark:focus:ring-blue-400'
                }`}
                disabled={isSubmitting}
              />
            </div>

            {/* キャラクター名 */}
            <div>
              <label
                htmlFor="monsterName"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                キャラクター名 <span className="text-red-600 dark:text-red-400">＊</span>
              </label>
              <input
                type="text"
                id="monsterName"
                name="monsterName"
                required
                defaultValue={character.monsterName}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                disabled={isSubmitting}
              />
            </div>

            {/* 属性 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                属性 <span className="text-red-600 dark:text-red-400">＊</span>
              </label>
              <div className="flex gap-3">
                {elements.map((el) => (
                  <label key={el} className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="element"
                      value={el}
                      required
                      defaultChecked={character.element === el}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500"
                      disabled={isSubmitting}
                    />
                    <span
                      className={`px-3 py-1 rounded text-sm ${
                        el === '火'
                          ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
                          : el === '水'
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'
                          : el === '木'
                          ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200'
                          : el === '光'
                          ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200'
                          : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200'
                      }`}
                    >
                      {el}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 種類 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                種類 <span className="text-red-600 dark:text-red-400">＊</span>
              </label>
              <div className="flex gap-3 flex-wrap">
                {types.map((t) => (
                  <label key={t} className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value={t}
                      required
                      defaultChecked={character.type === t}
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500"
                      disabled={isSubmitting}
                    />
                    <span className={`px-3 py-1 rounded text-sm font-medium ${
                      t === '限定'
                        ? 'bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-200'
                        : t === 'α'
                        ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200'
                        : t === 'コラボ'
                        ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                    }`}>{t}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ボタン */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '更新中...' : '更新'}
              </button>
              <Link
                href="/admin/characters"
                className={`flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-3 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold text-center ${
                  isSubmitting ? 'pointer-events-none opacity-50' : ''
                }`}
              >
                キャンセル
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
