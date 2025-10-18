'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export default function LoadingOverlay() {
  const [isLoading, setIsLoading] = useState(false)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    setIsLoading(false)
  }, [pathname, searchParams])

  // ナビゲーション開始をキャッチするため、グローバルな状態を利用
  useEffect(() => {
    const handleStart = () => setIsLoading(true)
    const handleComplete = () => setIsLoading(false)

    // Next.js App Routerのナビゲーションイベントを監視
    // 注: App Routerではルーターイベントが限定的なため、
    // より良いUXのためにはサーバーアクション実行中の状態を親から渡す方が良い
    
    return () => {
      // クリーンアップ
    }
  }, [])

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg p-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="text-gray-700 font-medium">読み込み中...</p>
        </div>
      </div>
    </div>
  )
}
