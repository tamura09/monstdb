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
  const yamlContent = await readFile(filePath, 'utf8')
  const spec = parseYaml(yamlContent)

  return NextResponse.json(spec)
})
