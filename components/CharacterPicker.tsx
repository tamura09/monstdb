'use client'

import { useMemo, useState } from 'react'
import { matchesJapaneseOr } from '@/lib/string-utils'

type CharacterOption = {
  id: string
  monsterName: string
  element: string
  type: string
  indexNumber: number
}

type CharacterPickerProps = {
  characters: CharacterOption[]
  name: string
  submitLabel?: string
  placeholder?: string
}

const MAX_RESULTS = 30

// 約1000件を素の <select><option> で全展開すると、特に Windows のネイティブ
// ドロップダウンで顕著に重くなるため、検索して絞り込んでから選ぶ方式にしている。
export default function CharacterPicker({
  characters,
  name,
  submitLabel = '追加',
  placeholder = 'キャラ名で検索...',
}: CharacterPickerProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selected, setSelected] = useState<CharacterOption | null>(null)

  const matches = useMemo(() => {
    if (!query.trim()) return []
    return characters
      .filter((c) => matchesJapaneseOr(c.monsterName, query))
      .slice(0, MAX_RESULTS)
  }, [characters, query])

  function handleSelect(character: CharacterOption) {
    setSelected(character)
    setQuery(character.monsterName)
    setIsOpen(false)
  }

  function handleQueryChange(value: string) {
    setQuery(value)
    setIsOpen(true)
    if (selected && value !== selected.monsterName) {
      setSelected(null)
    }
  }

  return (
    <div className="flex gap-4">
      <div className="relative flex-1">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-hidden focus:ring-2 focus:ring-blue-500"
        />
        <input type="hidden" name={name} value={selected?.id ?? ''} />

        {isOpen && query.trim() && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-72 overflow-y-auto">
            {matches.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500">
                該当するキャラクターがありません
              </div>
            ) : (
              matches.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelect(c)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 flex items-center justify-between gap-2"
                >
                  <span>
                    {c.monsterName} ({c.element} / {c.type})
                  </span>
                  <span className="text-gray-400 text-xs whitespace-nowrap">
                    No.{c.indexNumber}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      <button
        type="submit"
        disabled={!selected}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitLabel}
      </button>
    </div>
  )
}
