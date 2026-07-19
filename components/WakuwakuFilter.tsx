'use client'

import { useState } from 'react'

type WakuwakuMaster = {
  id: string
  name: string
}

export default function WakuwakuFilter({
  allWakuwaku,
  selectedWakuwaku,
  wakuwakuMode,
  element,
  type,
  search,
  basePath = '/accounts',
}: {
  allWakuwaku: WakuwakuMaster[]
  selectedWakuwaku: string[]
  wakuwakuMode: 'and' | 'or'
  element?: string
  type?: string
  search?: string
  basePath?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [selected, setSelected] = useState<string[]>(selectedWakuwaku)
  const [mode, setMode] = useState<'and' | 'or'>(wakuwakuMode)

  function toggleWakuwaku(name: string) {
    if (selected.includes(name)) {
      setSelected(selected.filter((w) => w !== name))
    } else {
      setSelected([...selected, name])
    }
  }

  function applyFilter() {
    const params = new URLSearchParams()
    if (element) params.set('element', element)
    if (type) params.set('type', type)
    if (search) params.set('search', search)
    if (selected.length > 0) {
      params.set('wakuwaku', selected.join(','))
      params.set('wakuwakuMode', mode)
    }
    window.location.href = `${basePath}?${params.toString()}`
  }

  function clearFilter() {
    setSelected([])
    const params = new URLSearchParams()
    if (element) params.set('element', element)
    if (type) params.set('type', type)
    if (search) params.set('search', search)
    window.location.href = `${basePath}?${params.toString()}`
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left border border-line rounded-md bg-ground hover:bg-line2 focus:outline-none focus:ring-1 focus:ring-ink text-sm"
      >
        {selected.length === 0 ? (
          <span className="text-faint">選択してください</span>
        ) : (
          <span className="text-ink">
            {selected.length}個選択中
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full md:w-96 bg-panel border border-line rounded-md max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-line bg-ground">
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setMode('or')}
                className={`flex-1 px-3 py-1 rounded text-sm border ${
                  mode === 'or'
                    ? 'bg-ink text-paper border-ink'
                    : 'border-line text-dim hover:bg-line2'
                }`}
              >
                OR検索
              </button>
              <button
                type="button"
                onClick={() => setMode('and')}
                className={`flex-1 px-3 py-1 rounded text-sm border ${
                  mode === 'and'
                    ? 'bg-ink text-paper border-ink'
                    : 'border-line text-dim hover:bg-line2'
                }`}
              >
                AND検索
              </button>
            </div>
            <div className="text-xs text-dim">
              {mode === 'or' ?
                '選択したワクワクのいずれかを持つキャラを表示' :
                '選択したワクワクの全てを持つキャラを表示'}
            </div>
          </div>

          <div className="p-2">
            {allWakuwaku.map((w) => (
              <label
                key={w.id}
                className="flex items-center px-2 py-2 hover:bg-line2 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(w.name)}
                  onChange={() => toggleWakuwaku(w.name)}
                  className="mr-2 h-4 w-4 text-ink focus:ring-ink border-line rounded"
                />
                <span className="text-sm text-ink">{w.name}</span>
              </label>
            ))}
          </div>

          <div className="p-3 border-t border-line bg-ground flex gap-2">
            <button
              type="button"
              onClick={applyFilter}
              className="flex-1 px-4 py-2 bg-ink text-paper rounded-md hover:opacity-90 text-sm font-medium"
            >
              適用
            </button>
            <button
              type="button"
              onClick={clearFilter}
              className="px-4 py-2 border border-line text-dim rounded-md hover:bg-line2 text-sm"
            >
              クリア
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
