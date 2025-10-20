'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useFormStatus } from 'react-dom'

const elements = ['火', '水', '木', '光', '闇']
const types = ['恒常', '限定', 'α', 'コラボ']

type FriendSearchFilterProps = {
  allWakuwaku: Array<{ id: string; name: string }>
  friendId: string
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

export default function FriendSearchFilter({ allWakuwaku, friendId, onSearch }: FriendSearchFilterProps) {
  const searchParams = useSearchParams()

  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [element, setElement] = useState(searchParams.get('element') || '')
  const [type, setType] = useState(searchParams.get('type') || '')
  const [wakuwaku, setWakuwaku] = useState(searchParams.get('wakuwaku')?.split(',').filter(Boolean) || [])
  const [wakuwakuMode, setWakuwakuMode] = useState<'or' | 'and'>(
    (searchParams.get('wakuwakuMode') as 'or' | 'and') || 'or'
  )
  const [hasEL, setHasEL] = useState(searchParams.get('hasEL') === 'true')

  const toggleWakuwaku = (wakuwakuName: string) => {
    setWakuwaku((prev) =>
      prev.includes(wakuwakuName)
        ? prev.filter((w) => w !== wakuwakuName)
        : [...prev, wakuwakuName]
    )
  }

  const hasActiveFilters = element || type || search || wakuwaku.length > 0 || hasEL

  return (
    <form action={onSearch} className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">絞り込み・検索</h2>
      <div className="space-y-4">
        {/* Hidden inputs for selected filters */}
        <input type="hidden" name="element" value={element} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="search" value={search} />
        <input type="hidden" name="wakuwaku" value={wakuwaku.join(',')} />
        <input type="hidden" name="wakuwakuMode" value={wakuwakuMode} />
        <input type="hidden" name="hasEL" value={hasEL ? 'true' : 'false'} />
        {/* 属性フィルター */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">属性</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setElement('')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                !element ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
          <label className="block text-sm font-medium text-gray-700 mb-2">種類</label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setType('')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                !type ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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

        {/* わくわくの実フィルター */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            わくわくの実
            {wakuwaku.length > 1 && (
              <span className="ml-2 text-xs">
                <label className="inline-flex items-center mr-3">
                  <input
                    type="radio"
                    checked={wakuwakuMode === 'or'}
                    onChange={() => setWakuwakuMode('or')}
                    className="mr-1"
                  />
                  いずれか
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    checked={wakuwakuMode === 'and'}
                    onChange={() => setWakuwakuMode('and')}
                    className="mr-1"
                  />
                  すべて
                </label>
              </span>
            )}
          </label>
          <div className="flex flex-wrap gap-1 max-h-40 overflow-y-auto">
            {allWakuwaku.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => toggleWakuwaku(w.name)}
                className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                  wakuwaku.includes(w.name)
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {w.name}
              </button>
            ))}
          </div>
        </div>

        {/* 検索 */}
        <div>
          <label htmlFor="friend-search" className="block text-sm font-medium text-gray-700 mb-2">
            キャラ名検索
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="friend-search"
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

        {/* ELフィルター */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            わくわくレベル
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setHasEL(!hasEL)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                hasEL
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {hasEL ? '✓ ELのみ表示' : 'ELのみ表示'}
            </button>
          </div>
        </div>

        {/* アクティブフィルター表示 */}
        {hasActiveFilters && (
          <div className="pt-2 border-t border-gray-200">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">適用中:</span>
              {element && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  属性: {element}
                  <button type="button" onClick={() => setElement('')} className="hover:text-blue-900">
                    ✕
                  </button>
                </span>
              )}
              {type && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  種類: {type}
                  <button type="button" onClick={() => setType('')} className="hover:text-blue-900">
                    ✕
                  </button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  検索: {search}
                  <button type="button" onClick={() => setSearch('')} className="hover:text-blue-900">
                    ✕
                  </button>
                </span>
              )}
              {wakuwaku.length > 0 && (
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                  わくわく: {wakuwaku.length}個
                  <button type="button" onClick={() => setWakuwaku([])} className="hover:text-green-900">
                    ✕
                  </button>
                </span>
              )}
              {hasEL && (
                <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                  ELのみ
                  <button type="button" onClick={() => setHasEL(false)} className="hover:text-purple-900">
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
                  setWakuwaku([])
                  setHasEL(false)
                }}
                className="text-xs text-red-600 hover:text-red-800 ml-2"
              >
                すべてクリア
              </button>
              {/* 検索ボタン: フィルターの下に移動 */}
              <SearchButton />
            </div>
          </div>
        )}
      </div>
    </form>
  )
}
