'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition, useState, useEffect, useCallback } from 'react'

const elements = ['火', '水', '木', '光', '闇']
const types = ['恒常', '限定', 'α', 'コラボ']

const elementDotClass: Record<string, string> = {
  火: 'bg-fire',
  水: 'bg-water',
  木: 'bg-wood',
  光: 'bg-light',
  闇: 'bg-yami',
}

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
      const params = new URLSearchParams()

      // searchパラメータを保持
      const currentSearch = searchParams.get('search')
      if (currentSearch) {
        params.set('search', currentSearch)
      }

      // 既存のsearchパラメータを保持
      if (newElement) {
        params.set('element', newElement)
      }

      if (newType) {
        params.set('type', newType)
      }

      if (newWakuwaku.length > 0) {
        params.set('wakuwaku', newWakuwaku.join(','))
      }

      if (newWakuwaku.length > 1) {
        params.set('wakuwakuMode', newWakuwakuMode)
      }

      if (newHasEL) {
        params.set('hasEL', 'true')
      }

      const queryString = params.toString()
      startTransition(() => {
        router.push(`${basePath}${queryString ? `?${queryString}` : ''}`, { scroll: false })
      })
    },
    [router, basePath, searchParams]
  )

  // リアルタイム検索（searchは除外）
  useEffect(() => {
    // 初期化時はスキップ
    const currentElement = searchParams.get('element') || ''
    const currentType = searchParams.get('type') || ''
    const currentWakuwaku = searchParams.get('wakuwaku')?.split(',').filter(Boolean) || []
    const currentWakuwakuMode = (searchParams.get('wakuwakuMode') as 'or' | 'and') || 'or'
    const currentHasEL = searchParams.get('hasEL') === 'true'

    // 値が実際に変更された場合のみ更新
    const hasChanged =
      element !== currentElement ||
      type !== currentType ||
      JSON.stringify(wakuwaku) !== JSON.stringify(currentWakuwaku) ||
      wakuwakuMode !== currentWakuwakuMode ||
      hasEL !== currentHasEL

    if (hasChanged) {
      updateURL(element, type, wakuwaku, wakuwakuMode, hasEL)
    }
  }, [element, type, wakuwaku, wakuwakuMode, hasEL])

  const toggleWakuwaku = (wakuwakuName: string) => {
    setWakuwaku((prev) =>
      prev.includes(wakuwakuName)
        ? prev.filter((w) => w !== wakuwakuName)
        : [...prev, wakuwakuName]
    )
  }

  const hasActiveFilters = element || type || search || wakuwaku.length > 0 || hasEL

  return (
    <div className="bg-panel border border-line rounded-md p-5 mb-5">
      <h2 className="text-sm font-semibold text-ink mb-3">
        絞り込み・検索 {isPending && <span className="text-xs text-faint ml-2">更新中...</span>}
      </h2>
      <div className="space-y-4">
        {/* 属性フィルター */}
        <div>
          <label className="block text-xs font-medium text-dim mb-2">属性</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setElement('')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                !element ? 'bg-ink text-paper border-ink' : 'border-line text-dim hover:text-ink hover:bg-line2'
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
          <label className="block text-xs font-medium text-dim mb-2">種類</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setType('')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                !type ? 'bg-ink text-paper border-ink' : 'border-line text-dim hover:text-ink hover:bg-line2'
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

        {/* わくわくの実フィルター */}
        <div>
          <label className="block text-xs font-medium text-dim mb-2">
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
                className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                  wakuwaku.includes(w.name)
                    ? 'bg-ink text-paper border-ink'
                    : 'border-line text-dim hover:text-ink hover:bg-line2'
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
          <label className="block text-xs font-medium text-dim mb-2">
            わくわくレベル
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setHasEL(!hasEL)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                hasEL
                  ? 'bg-ink text-paper border-ink'
                  : 'border-line text-dim hover:text-ink hover:bg-line2'
              }`}
            >
              {hasEL ? '✓ ELのみ表示' : 'ELのみ表示'}
            </button>
          </div>
        </div>

        {/* アクティブフィルター表示 */}
        {hasActiveFilters && (
          <div className="pt-2 border-t border-line">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-dim">適用中:</span>
              {element && (
                <span className="inline-flex items-center gap-1 bg-line2 text-ink px-2 py-1 rounded text-xs">
                  属性: {element}
                  <button onClick={() => setElement('')} className="hover:text-dim">
                    ✕
                  </button>
                </span>
              )}
              {type && (
                <span className="inline-flex items-center gap-1 bg-line2 text-ink px-2 py-1 rounded text-xs">
                  種類: {type}
                  <button onClick={() => setType('')} className="hover:text-dim">
                    ✕
                  </button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1 bg-line2 text-ink px-2 py-1 rounded text-xs">
                  検索: {search}
                  <span className="text-xs text-faint">(別の検索バーで変更)</span>
                </span>
              )}
              {wakuwaku.length > 0 && (
                <span className="inline-flex items-center gap-1 bg-line2 text-ink px-2 py-1 rounded text-xs">
                  わくわく: {wakuwaku.length}個
                  <button onClick={() => setWakuwaku([])} className="hover:text-dim">
                    ✕
                  </button>
                </span>
              )}
              {hasEL && (
                <span className="inline-flex items-center gap-1 bg-line2 text-ink px-2 py-1 rounded text-xs">
                  ELのみ
                  <button onClick={() => setHasEL(false)} className="hover:text-dim">
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
                className="text-xs text-dim hover:text-ink ml-2"
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
