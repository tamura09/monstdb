'use client'

import { useEffect, useRef, useState } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import Link from 'next/link'
import DeleteCharacterMasterButton from './DeleteCharacterMasterButton'

type CharacterMaster = {
  id: string
  indexNumber: number
  monsterName: string
  element: string
  type: string
}

type AdminCharacterTableProps = {
  characters: CharacterMaster[]
  onDelete: (formData: FormData) => Promise<void>
}

export default function AdminCharacterTable({
  characters,
  onDelete,
}: AdminCharacterTableProps) {
  // 仮想スクロール: 画面内の行だけを実際に描画する（約1000体でも初期表示を軽く保つ）
  const tbodyRef = useRef<HTMLTableSectionElement>(null)
  const totalColumns = 5

  const [scrollMargin, setScrollMargin] = useState(0)
  useEffect(() => {
    const measure = () => {
      if (tbodyRef.current) {
        setScrollMargin(tbodyRef.current.getBoundingClientRect().top + window.scrollY)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  const rowVirtualizer = useWindowVirtualizer({
    count: characters.length,
    estimateSize: () => 53,
    overscan: 10,
    scrollMargin,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()
  const paddingTop =
    virtualItems.length > 0 ? virtualItems[0].start - scrollMargin : 0
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - (virtualItems[virtualItems.length - 1].end - scrollMargin)
      : 0

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              No.
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              キャラクター名
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              属性
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              種類
            </th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
              操作
            </th>
          </tr>
        </thead>
        <tbody
          ref={tbodyRef}
          className="divide-y divide-gray-200 dark:divide-gray-600"
        >
          {paddingTop > 0 && (
            <tr aria-hidden="true">
              <td colSpan={totalColumns} className="p-0 border-0" style={{ height: paddingTop }} />
            </tr>
          )}
          {virtualItems.map((virtualRow) => {
            const character = characters[virtualRow.index]
            return (
              <tr
                key={character.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                  {character.indexNumber}
                </td>
                <td className="px-4 py-3">
                  <div className="font-semibold text-gray-800 dark:text-gray-200">
                    {character.monsterName}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`inline-block px-3 py-1 rounded-sm text-xs ${
                      character.element === '火'
                        ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200'
                        : character.element === '水'
                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'
                        : character.element === '木'
                        ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200'
                        : character.element === '光'
                        ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200'
                        : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200'
                    }`}
                  >
                    {character.element}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{character.type}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Link
                      href={`/admin/characters/${character.id}/edit`}
                      className="bg-green-600 text-white px-3 py-1 rounded-sm hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600 text-sm"
                    >
                      編集
                    </Link>
                    <DeleteCharacterMasterButton
                      characterId={character.id}
                      characterName={character.monsterName}
                      onDelete={onDelete}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
          {paddingBottom > 0 && (
            <tr aria-hidden="true">
              <td colSpan={totalColumns} className="p-0 border-0" style={{ height: paddingBottom }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
