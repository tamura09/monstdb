import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { parse as parseYaml } from 'yaml'
import { withApiHandler } from '@/lib/api/handler'
import { requireAdmin } from '@/lib/api/auth'

// docs/openapi.yaml をJSONへ変換して配信する。
//
// docs/openapi.yamlをpublic/配下に置かず専用エンドポイントを設けているのは、
// このAPI仕様自体は機密ではないものの、社内向けの管理画面(/admin/api-docs)以外に
// 公開する理由が無いため。管理画面と同じくadmin限定にしている。
//
// requireAdmin()はrequestを渡さずに呼ぶ(=常にセッション認証限定)。
// このエンドポイントは/admin/api-docsページがブラウザから読む専用の内部APIであり、
// app/api/v1/api-keys/*と同じ理由でAPIキー認証を許可する必要が無いため。
export const GET = withApiHandler(async () => {
  await requireAdmin()

  const filePath = path.join(process.cwd(), 'docs', 'openapi.yaml')

  let yamlContent: string
  try {
    yamlContent = await readFile(filePath, 'utf8')
  } catch (error) {
    // 実行時にファイルを読むため、デプロイ環境でのみ落ちる形の事故が起きやすい。
    // 汎用の500に潰してしまうと原因の特定が難しいので、配備上の問題だと
    // 分かるログを残す。過去に .vercelignore の docs/ で実際に踏んでいる。
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      console.error(
        `OpenAPI仕様が見つかりません: ${filePath}\n` +
          'デプロイ成果物に docs/openapi.yaml が含まれているか確認してください。' +
          '(.vercelignore で docs/ を除外していないか、next.config.js の ' +
          'outputFileTracingIncludes に docs/openapi.yaml があるか)'
      )
    }

    throw error
  }

  const spec = parseYaml(yamlContent)

  return NextResponse.json(spec)
})
