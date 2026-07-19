'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition, useState, useEffect, useCallback } from 'react'
import { useDebounce } from '@/hooks/useDebounce'

const elements = ['火', '水', '木', '光', '闇']
const types = ['恒常', '限定', 'α', 'コラボ']

const elementDotClass: Record<string, string> = {
  火: 'bg-fire',
  水: 'bg-water',
  木: 'bg-wood',
  光: 'bg-light',
  闇: 'bg-yami',
}

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
      router.push(`/characters${queryString ? `?${queryString}` : ''}`, { scroll: false })
    })
  }, [router])

  // リアルタイム検索
  useEffect(() => {
    updateURL(debouncedSearch, element, type)
  }, [debouncedSearch, element, type, updateURL])

  return (
    <div className="bg-panel border border-line rounded-md p-5 mb-5">
      <h2 className="text-sm font-semibold text-ink mb-3">フィルター</h2>
      <div className="space-y-4">
        {/* 属性フィルター */}
        <div>
          <label className="block text-xs font-medium text-dim mb-2">
            属性
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setElement('')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                !element
                  ? 'bg-ink text-paper border-ink'
                  : 'border-line text-dim hover:text-ink hover:bg-line2'
              }`}
            >
              すべて
            </button>
            {elements.map((el) => (
              <button
                key={el}
                onClick={() => setElement(el === element ? '' : el)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                  element === el
                    ? 'bg-ink text-paper border-ink'
                    : 'border-line text-dim hover:text-ink hover:bg-line2'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${elementDotClass[el]}`} />
                {el}
              </button>
            ))}
          </div>
        </div>

        {/* タイプフィルター */}
        <div>
          <label className="block text-xs font-medium text-dim mb-2">
            種類
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setType('')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                !type
                  ? 'bg-ink text-paper border-ink'
                  : 'border-line text-dim hover:text-ink hover:bg-line2'
              }`}
            >
              すべて
            </button>
            {types.map((t) => (
              <button
                key={t}
                onClick={() => setType(t === type ? '' : t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                  type === t
                    ? 'bg-ink text-paper border-ink'
                    : 'border-line text-dim hover:text-ink hover:bg-line2'
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
            className="block text-xs font-medium text-dim mb-2"
          >
            検索 {isPending && <span className="text-xs text-faint ml-2">検索中...</span>}
          </label>
          <div className="relative">
            <input
              type="text"
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="キャラ名で検索..."
              className="w-full px-3 py-2 border border-line rounded-md focus:outline-none focus:ring-1 focus:ring-ink pr-10 bg-ground text-ink text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-ink"
                title="クリア"
              >
                ✕
              </button>
            )}
          </div>
          <p className="text-xs text-faint mt-1">
            {search ? (
              <>「{search}」で検索中 - スペース区切りで複数検索可能</>
            ) : (
              <>スペース区切りで複数のキャラ名を同時検索できます</>
            )}
          </p>
        </div>

        {/* アクティブフィルター表示 */}
        {(element || type || search) && (
          <div className="pt-2 border-t border-line">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-dim">適用中:</span>
              {element && (
                <span className="inline-flex items-center gap-1 bg-line2 text-ink px-2 py-1 rounded text-xs">
                  属性: {element}
                  <button
                    onClick={() => setElement('')}
                    className="hover:text-dim"
                  >
                    ✕
                  </button>
                </span>
              )}
              {type && (
                <span className="inline-flex items-center gap-1 bg-line2 text-ink px-2 py-1 rounded text-xs">
                  種類: {type}
                  <button
                    onClick={() => setType('')}
                    className="hover:text-dim"
                  >
                    ✕
                  </button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1 bg-line2 text-ink px-2 py-1 rounded text-xs">
                  検索: {search}
                  <button
                    onClick={() => setSearch('')}
                    className="hover:text-dim"
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
                className="text-xs text-dim hover:text-ink ml-2"
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
