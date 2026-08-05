import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { withApiHandler } from '@/lib/api/handler'
import { requireAdmin } from '@/lib/api/auth'

// docs/api-v1.md をダウンロード用に配信する。
//
// /admin/api-docs の Swagger UI (docs/openapi.yaml の info.description) には
// もともと `[docs/api-v1.md](./api-v1.md)` という相対リンクを置いていたが、
// このパスを実際に配信するルートが無く、Swagger UI上でクリックしても
// 404になっていた(Markdownとしてもレンダリングされない)。
// このエンドポイントへの絶対パスに差し替え、ダウンロードリンクとして機能させる。
//
// app/api/v1/openapi/route.ts と同じ理由でadmin限定にしている
// (requireAdmin()はrequestを渡さず呼び、常にセッション認証限定にする)。
export const GET = withApiHandler(async () => {
  await requireAdmin()

  const filePath = path.join(process.cwd(), 'docs', 'api-v1.md')

  let content: string
  try {
    content = await readFile(filePath, 'utf8')
  } catch (error) {
    // app/api/v1/openapi/route.ts と同じ理由(実行時にファイルを読むため
    // デプロイ環境でのみ落ちる事故が起きやすい)でログを残す。
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      console.error(
        `APIリファレンスが見つかりません: ${filePath}\n` +
          'デプロイ成果物に docs/api-v1.md が含まれているか確認してください。' +
          '(.vercelignore で docs/ を除外していないか、next.config.js の ' +
          'outputFileTracingIncludes に docs/api-v1.md があるか)'
      )
    }

    throw error
  }

  return new NextResponse(content, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="api-v1.md"',
    },
  })
})
