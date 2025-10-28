'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

type CharacterNameSearchBarProps = {
  basePath?: string
  placeholder?: string
}

export default function CharacterNameSearchBar({ 
  basePath = '/accounts',
  placeholder = 'キャラ名で検索...'
}: CharacterNameSearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('search') || '')

  const handleSearch = (value: string) => {
    setSearch(value)
    
    // 既存のパラメータを保持
    const params = new URLSearchParams(searchParams.toString())
    
    if (value) {
      params.set('search', value)
    } else {
      params.delete('search')
    }

    const queryString = params.toString()
    // useTransitionを使わず直接遷移
    router.push(`${basePath}${queryString ? `?${queryString}` : ''}`)
  }

  const handleClear = () => {
    setSearch('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('search')
    const queryString = params.toString()
    router.push(`${basePath}${queryString ? `?${queryString}` : ''}`)
  }

  return (
    <div>
      <label htmlFor="char-name-search" className="block text-sm font-medium text-gray-700 mb-2">
        キャラ名検索
      </label>
      <div className="relative">
        <input
          type="text"
          id="char-name-search"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
        />
        {search && (
          <button
            onClick={handleClear}
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
  )
}
