'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'

const elements = ['火', '水', '木', '光', '闇']
const types = ['恒常', '限定', 'α', 'コラボ']

type CharacterSearchFilterProps = {
  onSearch: (formData: FormData) => Promise<void>
}

function SearchButton() {
  const { pending } = useFormStatus()
  
  return (
    <div className="w-full mt-3">
      <button
        type="submit"
        disabled={pending}
        className="w-full px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {pending ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            検索中...
          </>
        ) : (
          '検索'
        )}
      </button>
    </div>
  )
}

export default function CharacterSearchFilter({ onSearch }: CharacterSearchFilterProps) {
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [element, setElement] = useState(searchParams.get('element') || '')
  const [type, setType] = useState(searchParams.get('type') || '')

  return (
    <form action={onSearch} className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">フィルター</h2>
      <div className="space-y-4">
        {/* Hidden inputs for selected filters */}
        <input type="hidden" name="element" value={element} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="search" value={search} />

        {/* 属性フィルター */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            属性
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
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
                type="button"
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
              type="button"
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
                type="button"
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
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-2">
            キャラ名検索
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="キャラ名で検索..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="px-3 py-2 rounded-md bg-gray-100 text-gray-700 text-sm hover:bg-gray-200"
                title="クリア"
              >
                ✕
              </button>
            )}
          </div>
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
                    type="button"
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
                    type="button"
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
                    type="button"
                    onClick={() => setSearch('')}
                    className="hover:text-blue-900"
                  >
                    ✕
                  </button>
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  setElement('')
                  setType('')
                  setSearch('')
                }}
                className="text-xs text-red-600 hover:text-red-800 ml-2"
              >
                すべてクリア
              </button>
              {/* 検索ボタン：フィルター領域の一番下に移動 */}
              <SearchButton />
            </div>
          </div>
        )}
      </div>
    </form>
  )
}
