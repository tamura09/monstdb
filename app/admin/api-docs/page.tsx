import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { API_KEY_SCOPES, API_KEY_SCOPE_DESCRIPTIONS } from '@/lib/api/scopes'
import ApiSpecViewer from '@/components/ApiSpecViewer'
import ApiKeyManager from '@/components/ApiKeyManager'

export default async function AdminApiDocsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  // Admin権限チェック
  // JWTのroleはログイン時点の情報が固定化されうるため、DB上のroleを都度確認する
  // (app/admin/characters/page.tsxと同じ方針)。
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user || user.role !== 'admin') {
    redirect('/accounts')
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          APIドキュメント・APIキー管理
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          外部連携・サーバー間連携で利用する REST API (<code>/api/v1/...</code>) の仕様とAPIキーの発行・管理を行います。
        </p>
      </div>

      {/* 戻るリンク */}
      <div className="mb-6">
        <Link href="/accounts" className="text-blue-600 dark:text-blue-400 hover:underline">
          ← アカウント一覧に戻る
        </Link>
      </div>

      {/* APIの使い方 */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
          APIの使い方
        </h2>

        <div className="space-y-5 text-sm text-gray-700 dark:text-gray-300">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">ベースURL</h3>
            <p>
              すべてのエンドポイントは <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-sm">/api/v1/...</code>{' '}
              配下にあります。呼び出し元と同一オリジンに対する相対パスとして呼び出してください。
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">認証方式</h3>
            <p className="mb-2">2つの認証方式に対応しています。</p>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <span className="font-medium">セッションCookie</span>
                （ブラウザからの利用） — Google
                OAuthでログイン後に付与される <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-sm">next-auth.session-token</code>{' '}
                Cookieで認証します。同一オリジンからの呼び出しが前提で、サーバー間連携には使えません。
              </li>
              <li>
                <span className="font-medium">APIキー</span>
                （サーバー間連携） — <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-sm">Authorization: Bearer &lt;key&gt;</code>{' '}
                ヘッダで認証します。下記の「APIキー管理」から発行できます。キーは
                <span className="font-medium">発行者(admin)として振る舞います</span>
                が、発行時に指定したスコープの範囲でしか操作できません(最小権限の原則)。
              </li>
            </ul>
            <p className="mt-2">
              エンドポイントによってはセッションに加えて、DB上の <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-sm">User.role</code>{' '}
              が <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-sm">admin</code> であることを要求します。
              APIキー管理API(<code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-sm">/api/v1/api-keys/*</code>)は
              権限昇格を防ぐため、常にセッション認証限定です(APIキーでは呼び出せません)。
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">共通エラー形式</h3>
            <p className="mb-2">エラー時は常に以下の形式のJSONを返します。</p>
            <pre className="bg-gray-100 dark:bg-gray-900 rounded-sm p-3 overflow-x-auto text-xs">
{`{
  "error": {
    "code": "validation_error",
    "message": "リクエストの内容が不正です",
    "details": null
  }
}`}
            </pre>
            <div className="overflow-x-auto mt-2">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-left border-b border-gray-200 dark:border-gray-600">
                    <th className="py-1 pr-4">code</th>
                    <th className="py-1 pr-4">HTTPステータス</th>
                    <th className="py-1">意味</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  <tr>
                    <td className="py-1 pr-4 font-mono">unauthorized</td>
                    <td className="py-1 pr-4">401</td>
                    <td className="py-1">ログインしていない、またはセッション/APIキーが無効</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 font-mono">forbidden</td>
                    <td className="py-1 pr-4">403</td>
                    <td className="py-1">ログインはしているが、その操作に必要な権限がない</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 font-mono">not_found</td>
                    <td className="py-1 pr-4">404</td>
                    <td className="py-1">指定されたリソースが存在しない、または自分の所有物ではない</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 font-mono">validation_error</td>
                    <td className="py-1 pr-4">422</td>
                    <td className="py-1">リクエストの内容が不正</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 font-mono">conflict</td>
                    <td className="py-1 pr-4">409</td>
                    <td className="py-1">一意制約に違反する</td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-4 font-mono">internal_error</td>
                    <td className="py-1 pr-4">500</td>
                    <td className="py-1">サーバー内部エラー</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">ページング</h3>
            <p>
              一覧取得系のエンドポイントは <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-sm">page</code>{' '}
              (既定値1) / <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-sm">perPage</code>{' '}
              (既定値50、上限100) のクエリパラメータでページングでき、レスポンスには{' '}
              <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-sm">{'{ page, perPage, total, totalPages }'}</code>{' '}
              が含まれます。詳細・エンドポイント一覧・curl実行例は下記のSwagger UI、または{' '}
              <a
                href="/api/v1/docs"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                APIリファレンス(Markdown)をダウンロード
              </a>{' '}
              して参照してください。
            </p>
          </div>
        </div>
      </section>

      {/* スコープ一覧 */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
          APIキーのスコープ一覧
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  スコープ
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  説明
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {API_KEY_SCOPES.map((scope) => (
                <tr key={scope}>
                  <td className="px-4 py-2 font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap">
                    {scope}
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                    {API_KEY_SCOPE_DESCRIPTIONS[scope]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Swagger UI */}
      <section className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
          APIリファレンス (Swagger UI)
        </h2>
        <ApiSpecViewer />
      </section>

      {/* APIキー管理 */}
      <section>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
          APIキー管理
        </h2>
        <ApiKeyManager />
      </section>
    </div>
  )
}
