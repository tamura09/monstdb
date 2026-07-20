'use client'

import { useEffect, useRef, useState } from 'react'
import 'swagger-ui-dist/swagger-ui.css'
import './ApiSpecViewer.dark.css'

export default function ApiSpecViewer() {
  const [spec, setSpec] = useState<object | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch('/api/v1/openapi')
      .then(async (res) => {
        if (!res.ok) {
          throw new Error('OpenAPI仕様の取得に失敗しました')
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
    // ./ApiSpecViewer.dark.css で `html.dark .swagger-ui ...` 配下のスタイルを
    // 上書きしている。カード自体もページ他部分と同じ dark:bg-gray-800 に揃える。
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden p-2">
      <div ref={containerRef} />
    </div>
  )
}
