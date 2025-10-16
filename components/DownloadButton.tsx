'use client'

import { useSearchParams } from 'next/navigation'

interface DownloadButtonProps {
  type: 'characters' | 'my-characters'
  className?: string
}

export default function DownloadButton({ type, className = '' }: DownloadButtonProps) {
  const searchParams = useSearchParams()

  const handleDownload = () => {
    // 現在のクエリパラメータを取得
    const params = new URLSearchParams(searchParams.toString())
    
    // APIエンドポイントを構築
    const endpoint = type === 'characters' 
      ? '/api/export/characters'
      : '/api/export/my-characters'
    
    const url = `${endpoint}?${params.toString()}`
    
    // ダウンロードを実行
    window.location.href = url
  }

  const buttonText = type === 'characters' 
    ? '📥 CSVダウンロード'
    : '📥 所持データCSV'

  return (
    <button
      onClick={handleDownload}
      className={`bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-semibold flex items-center gap-2 ${className}`}
    >
      {buttonText}
    </button>
  )
}
