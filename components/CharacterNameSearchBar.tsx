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
    router.push(`${basePath}${queryString ? `?${queryString}` : ''}`, { scroll: false })
  }

  const handleClear = () => {
    setSearch('')
    const params = new URLSearchParams(searchParams.toString())
    params.delete('search')
    const queryString = params.toString()
    router.push(`${basePath}${queryString ? `?${queryString}` : ''}`, { scroll: false })
  }

  return (
    <div>
      <label htmlFor="char-name-search" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        キャラ名検索
      </label>
      <div className="relative">
        <input
          type="text"
          id="char-name-search"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 pr-10 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          autoComplete="off"
          data-form-type="other"
          data-lpignore="true"
          data-1p-ignore="true"
        />
        {search && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            title="クリア"
          >
            ✕
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {search ? (
          <>「{search}」で検索中 - スペース区切りで複数キャラ検索可能</>
        ) : (
          <>スペース区切りで複数のキャラ名を同時検索できます（例: ルシファー モーセ）</>
        )}
      </p>
    </div>
  )
}
