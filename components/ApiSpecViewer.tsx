'use client'

import { useEffect, useRef, useState } from 'react'
import 'swagger-ui-dist/swagger-ui.css'

export default function ApiSpecViewer() {
  const [spec, setSpec] = useState<object | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    if (!spec || !containerRef.current) return

    let disposed = false
    const domNode = containerRef.current

    // swagger-ui-distはブラウザ専用のバンドルであり、window/document等の
    // ブラウザAPIに依存している。SSR時に評価されないよう、動的importで
    // クライアント側(このuseEffect内)でのみ読み込む。
    import('swagger-ui-dist').then(({ SwaggerUIBundle }) => {
      if (disposed) return

      SwaggerUIBundle({
        domNode,
        spec,
        presets: [SwaggerUIBundle.presets.apis],
        plugins: [SwaggerUIBundle.plugins.DownloadUrl],
        layout: 'BaseLayout',
        docExpansion: 'list',
      })
    })

    return () => {
      disposed = true
      domNode.replaceChildren()
    }
  }, [spec])

  if (error) {
    return <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
  }

  if (!spec) {
    return <p className="text-sm text-gray-600 dark:text-gray-400">読み込み中...</p>
  }

  return (
    // swagger-ui-dist自体はダークモードに対応していないため、
    // 常に白背景のカードで囲み、周囲(ダークモード時)との境界を明確にする。
    <div className="bg-white rounded-lg shadow-md overflow-hidden p-2">
      <div ref={containerRef} />
    </div>
  )
}
