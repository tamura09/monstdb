'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition, useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/hooks/useDebounce'

const elements = ['火', '水', '木', '光', '闇']
const types = ['恒常', '限定', 'α', 'コラボ']

export default function CharacterSearchFilter() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [element, setElement] = useState(searchParams.get('element') || '')
  const [type, setType] = useState(searchParams.get('type') || '')

  const debouncedSearch = useDebounce(search, 300)

  const updateURL = useCallback((newSearch: string, newElement: string, newType: string) => {
    const params = new URLSearchParams()
    if (newElement) params.set('element', newElement)
    if (newType) params.set('type', newType)
    if (newSearch) params.set('search', newSearch)

    const queryString = params.toString()
    startTransition(() => {
      router.push(`/characters${queryString ? `?${queryString}` : ''}`)
    })
  }, [router])

  // リアルタイム検索
  useEffect(() => {
    updateURL(debouncedSearch, element, type)
  }, [debouncedSearch, element, type, updateURL])

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">フィルター</h2>
      <div className="space-y-4">
        {/* 属性フィルター */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            属性
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setElement('')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                !element
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              すべて
            </button>
            {elements.map((el) => (
              <button
                key={el}
                onClick={() => setElement(el === element ? '' : el)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  element === el
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {el}
              </button>
            ))}
          </div>
        </div>

        {/* タイプフィルター */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            種類
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setType('')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                !type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              すべて
            </button>
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setType(t === type ? '' : t)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  type === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* 検索 */}
        <div>
          <label
            htmlFor="search"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            検索 {isPending && <span className="text-xs text-gray-500 ml-2">検索中...</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="キャラ名で検索..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="クリア"
              >
                ✕
              </button>
            )}
          </div>
          {search && (
            <p className="text-xs text-gray-500 mt-1">
              「{search}」で検索中
            </p>
          )}
        </div>

        {/* アクティブフィルター表示 */}
        {(element || type || search) && (
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">適用中:</span>
              {element && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  属性: {element}
                  <button
                    onClick={() => setElement('')}
                    className="hover:text-blue-900"
                  >
                    ✕
                  </button>
                </span>
              )}
              {type && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  種類: {type}
                  <button
                    onClick={() => setType('')}
                    className="hover:text-blue-900"
                  >
                    ✕
                  </button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  検索: {search}
                  <button
                    onClick={() => setSearch('')}
                    className="hover:text-blue-900"
                  >
                    ✕
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setElement('')
                  setType('')
                  setSearch('')
                }}
                className="text-xs text-red-600 hover:text-red-800 ml-2"
              >
                すべてクリア
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
