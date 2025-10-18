'use client'

import { useState } from 'react'

interface Props {
  mode?: 'add' | 'replace'
}

export default function ImportChunkUploader({ mode = 'add' }: Props) {
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState<string | null>(null)

  const parseCSV = (text: string) => {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length <= 1) return []
    const dataLines = lines.slice(1)
    const rows = dataLines.map((line) => {
      const values = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || []
      return {
        indexNumber: values[0],
        monsterName: values[1],
        element: values[2],
        type: values[3],
        accountName: values[4],
        wakuwaku1: values[5] || '',
        level1: values[6] || 'L',
        wakuwaku2: values[7] || '',
        level2: values[8] || 'L',
        wakuwaku3: values[9] || '',
        level3: values[10] || 'L',
        wakuwaku4: values[11] || '',
        level4: values[12] || 'L',
      }
    })
    return rows
  }

  const uploadInBatches = async (rows: any[], batchSize = 200) => {
    setStatus('開始')
    const total = rows.length
    let processed = 0

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      const isFirstBatch = i === 0

      // 簡易再試行ロジック
      let attempts = 0
      const maxAttempts = 3
      let ok = false
      let lastError: any = null

      while (attempts < maxAttempts && !ok) {
        try {
          const res = await fetch('/api/import/chunks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rows: batch, mode, isFirstBatch }),
          })
          if (!res.ok) throw new Error(await res.text())
          const data = await res.json()
          processed += batch.length
          setProgress(Math.round((processed / total) * 100))
          ok = true
        } catch (e) {
          attempts++
          lastError = e
          await new Promise((r) => setTimeout(r, 500 * attempts))
        }
      }

      if (!ok) {
        setStatus('失敗')
        console.error('Batch upload failed:', lastError)
        // 失敗時でもページをリロードして状態を更新
        try {
          window.location.reload()
        } catch (e) {
          /* noop */
        }
        return { success: false, error: String(lastError) }
      }
    }

    setStatus('完了')
    setProgress(100)
    return { success: true }
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setProgress(0)
    setStatus(null)

    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length === 0) {
      setStatus('CSVに有効なデータがありません')
      return
    }

    setStatus('アップロード中...')
    const result = await uploadInBatches(rows)
    if (result.success) setStatus('インポート完了')
    // 成功時にもページをリロードして最新状態へ
    try {
      window.location.reload()
    } catch (e) {
      /* noop */
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2">
        <input 
          type="file" 
          accept=".csv,text/csv" 
          onChange={handleFile}
          disabled={progress > 0 && progress < 100}
          className="disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </label>
      {progress > 0 && (
        <>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
            <div 
              className="bg-gradient-to-r from-green-500 to-green-600 h-full transition-all duration-300 ease-out flex items-center justify-center text-white text-xs font-semibold"
              style={{ width: `${progress}%` }}
            >
              {progress > 10 && `${progress}%`}
            </div>
          </div>
          {status && (
            <p className={`text-sm font-medium ${
              status.includes('完了') ? 'text-green-600' : 
              status.includes('失敗') ? 'text-red-600' : 
              'text-blue-600 animate-pulse'
            }`}>
              {status.includes('アップロード中') && (
                <span className="inline-block mr-2">
                  <svg className="animate-spin h-4 w-4 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </span>
              )}
              {status}
            </p>
          )}
        </>
      )}
    </div>
  )
}
