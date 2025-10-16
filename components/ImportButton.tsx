'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function ImportButton() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    successCount?: number
    errorCount?: number
    errors?: string[]
  } | null>(null)
  const [mode, setMode] = useState<'add' | 'replace'>('add')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('mode', mode)

      const response = await fetch('/api/import/my-characters', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
        // 成功時はページをリロード
        setTimeout(() => {
          router.refresh()
          setIsModalOpen(false)
          setResult(null)
        }, 3000)
      } else {
        setResult({
          success: false,
          message: data.error || 'インポートに失敗しました',
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'エラーが発生しました',
      })
    } finally {
      setIsUploading(false)
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm font-semibold"
      >
        📤 CSVインポート
      </button>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              CSVインポート
            </h2>

            {!result && (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    インポートモード
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="mode"
                        value="add"
                        checked={mode === 'add'}
                        onChange={(e) => setMode(e.target.value as 'add')}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        <strong>追加モード</strong> - 既存データに追加
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="mode"
                        value="replace"
                        checked={mode === 'replace'}
                        onChange={(e) => setMode(e.target.value as 'replace')}
                        className="mr-2"
                      />
                      <span className="text-sm">
                        <strong>置き換えモード</strong> - 既存データを削除して置き換え
                      </span>
                    </label>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-gray-600 mb-2">
                    CSVファイルをアップロードしてください。
                  </p>
                  <p className="text-xs text-red-600 mb-4">
                    ⚠️ 置き換えモードは全ての所持データが削除されます
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                  />
                </div>

                {isUploading && (
                  <div className="mb-4 text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="text-sm text-gray-600 mt-2">
                      インポート中...
                    </p>
                  </div>
                )}
              </>
            )}

            {result && (
              <div className="mb-6">
                <div
                  className={`p-4 rounded-lg ${
                    result.success
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <p
                    className={`font-semibold ${
                      result.success ? 'text-green-800' : 'text-red-800'
                    }`}
                  >
                    {result.message}
                  </p>
                  {result.successCount !== undefined && (
                    <p className="text-sm text-gray-600 mt-2">
                      成功: {result.successCount}件 / エラー: {result.errorCount}件
                    </p>
                  )}
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-semibold text-gray-700">
                        エラー詳細:
                      </p>
                      <ul className="text-xs text-gray-600 mt-1 space-y-1 max-h-32 overflow-y-auto">
                        {result.errors.map((error, idx) => (
                          <li key={idx}>• {error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.success && (
                    <p className="text-sm text-green-600 mt-2">
                      3秒後に自動的に閉じます...
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setIsModalOpen(false)
                  setResult(null)
                }}
                disabled={isUploading}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
