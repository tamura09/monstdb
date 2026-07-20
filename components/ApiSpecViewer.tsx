'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import 'swagger-ui-react/swagger-ui.css'

// swagger-ui-reactはクライアントコンポーネントでのみ動作する
// (内部でdocument等のブラウザAPIに依存しているため)。
// next/dynamicでssr: falseにし、サーバー側では一切評価されないようにする。
const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false })

export default function ApiSpecViewer() {
  const [spec, setSpec] = useState<object | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/v1/openapi')
      .then(async (res) => {
        if (!res.ok) {
          // 原因の切り分けができるようステータスコードとサーバーからの
          // メッセージを表示に含める(汎用文言だけだと権限の問題なのか
          // 配備の問題なのか判別できないため)。
          const body = await res.json().catch(() => null)
          const detail = body?.error?.message

          throw new Error(
            `OpenAPI仕様の取得に失敗しました (HTTP ${res.status}${detail ? `: ${detail}` : ''})`
          )
        }
        return res.json()
      })
      .then((body) => {
        if (!cancelled) setSpec(body)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'OpenAPI仕様の取得に失敗しました')
        }
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
  }

  if (!spec) {
    return <p className="text-sm text-gray-600 dark:text-gray-400">読み込み中...</p>
  }

  return (
    // swagger-ui-react自体はダークモードに対応していないため、
    // 常に白背景のカードで囲み、周囲(ダークモード時)との境界を明確にする。
    <div className="bg-white rounded-lg shadow-md overflow-hidden p-2">
      <SwaggerUI spec={spec} docExpansion="list" />
    </div>
  )
}
