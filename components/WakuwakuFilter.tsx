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
        className="w-full px-3 py-2 text-left border border-gray-300 rounded-md bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
      >
        {selected.length === 0 ? (
          <span className="text-gray-500">選択してください</span>
        ) : (
          <span className="text-gray-900">
            {selected.length}個選択中
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full md:w-96 bg-white border border-gray-300 rounded-md shadow-lg max-h-96 overflow-y-auto">
          <div className="p-3 border-b border-gray-200 bg-gray-50">
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setMode('or')}
                className={`flex-1 px-3 py-1 rounded text-sm ${
                  mode === 'or'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                OR検索
              </button>
              <button
                type="button"
                onClick={() => setMode('and')}
                className={`flex-1 px-3 py-1 rounded text-sm ${
                  mode === 'and'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                AND検索
              </button>
            </div>
            <div className="text-xs text-gray-600">
              {mode === 'or' ? 
                '選択したワクワクのいずれかを持つキャラを表示' : 
                '選択したワクワクの全てを持つキャラを表示'}
            </div>
          </div>

          <div className="p-2">
            {allWakuwaku.map((w) => (
              <label
                key={w.id}
                className="flex items-center px-2 py-2 hover:bg-gray-50 rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(w.name)}
                  onChange={() => toggleWakuwaku(w.name)}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">{w.name}</span>
              </label>
            ))}
          </div>

          <div className="p-3 border-t border-gray-200 bg-gray-50 flex gap-2">
            <button
              type="button"
              onClick={applyFilter}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              適用
            </button>
            <button
              type="button"
              onClick={clearFilter}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
            >
              クリア
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
