'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition, useState, useEffect, useCallback } from 'react'

const elements = ['火', '水', '木', '光', '闇']
const types = ['恒常', '限定', 'α', 'コラボ']

type AccountSearchFilterProps = {
  allWakuwaku: Array<{ id: string; name: string }>
  basePath?: string
}

export default function AccountSearchFilter({ allWakuwaku, basePath = '/accounts' }: AccountSearchFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [element, setElement] = useState(searchParams.get('element') || '')
  const [type, setType] = useState(searchParams.get('type') || '')
  const [wakuwaku, setWakuwaku] = useState(searchParams.get('wakuwaku')?.split(',') || [])
  const [wakuwakuMode, setWakuwakuMode] = useState<'or' | 'and'>(
    (searchParams.get('wakuwakuMode') as 'or' | 'and') || 'or'
  )
  const [hasEL, setHasEL] = useState(searchParams.get('hasEL') === 'true')

  // 検索パラメータは表示用に取得するのみ（更新はしない）
  const search = searchParams.get('search') || ''

  const updateURL = useCallback(
    (
      newElement: string,
      newType: string,
      newWakuwaku: string[],
      newWakuwakuMode: 'or' | 'and',
      newHasEL: boolean
    ) => {
      const params = new URLSearchParams(searchParams.toString())
      
      // 既存のsearchパラメータを保持
      if (newElement) {
        params.set('element', newElement)
      } else {
        params.delete('element')
      }
      
      if (newType) {
        params.set('type', newType)
      } else {
        params.delete('type')
      }
      
      if (newWakuwaku.length > 0) {
        params.set('wakuwaku', newWakuwaku.join(','))
      } else {
        params.delete('wakuwaku')
      }
      
      if (newWakuwaku.length > 1) {
        params.set('wakuwakuMode', newWakuwakuMode)
      } else {
        params.delete('wakuwakuMode')
      }
      
      if (newHasEL) {
        params.set('hasEL', 'true')
      } else {
        params.delete('hasEL')
      }

      const queryString = params.toString()
      startTransition(() => {
        router.push(`${basePath}${queryString ? `?${queryString}` : ''}`)
      })
    },
    [router, basePath, searchParams]
  )

  // リアルタイム検索（searchは除外）
  useEffect(() => {
    updateURL(element, type, wakuwaku, wakuwakuMode, hasEL)
  }, [element, type, wakuwaku, wakuwakuMode, hasEL, updateURL])

  const toggleWakuwaku = (wakuwakuName: string) => {
    setWakuwaku((prev) =>
      prev.includes(wakuwakuName)
        ? prev.filter((w) => w !== wakuwakuName)
        : [...prev, wakuwakuName]
    )
  }

  const hasActiveFilters = element || type || search || wakuwaku.length > 0 || hasEL

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        絞り込み・検索 {isPending && <span className="text-xs text-gray-500 ml-2">更新中...</span>}
      </h2>
      <div className="space-y-4">
        {/* 属性フィルター */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">属性</label>
          <div className="flex flex-wrap gap-2">
            <button
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

        {/* 検索バーはここから削除 - 別コンポーネントで実装 */}

        {/* ELフィルター */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            わくわくレベル
          </label>
          <div className="flex gap-2">
            <button
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
                  <button onClick={() => setElement('')} className="hover:text-blue-900">
                    ✕
                  </button>
                </span>
              )}
              {type && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  種類: {type}
                  <button onClick={() => setType('')} className="hover:text-blue-900">
                    ✕
                  </button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                  検索: {search}
                  <span className="text-xs text-gray-500">(別の検索バーで変更)</span>
                </span>
              )}
              {wakuwaku.length > 0 && (
                <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                  わくわく: {wakuwaku.length}個
                  <button onClick={() => setWakuwaku([])} className="hover:text-green-900">
                    ✕
                  </button>
                </span>
              )}
              {hasEL && (
                <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                  ELのみ
                  <button onClick={() => setHasEL(false)} className="hover:text-purple-900">
                    ✕
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setElement('')
                  setType('')
                  setWakuwaku([])
                  setHasEL(false)
                  // searchは別コンポーネントで管理されているため、ここでは削除しない
                }}
                className="text-xs text-red-600 hover:text-red-800 ml-2"
              >
                フィルタークリア
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
