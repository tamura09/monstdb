'use client'

import { useCallback, useEffect, useState } from 'react'
import { API_KEY_SCOPES, API_KEY_SCOPE_DESCRIPTIONS, type ApiKeyScope } from '@/lib/api/scopes'

type ApiKeySummary = {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

type ApiErrorResponse = {
  error?: { message?: string }
}

function formatDateTime(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleString('ja-JP')
}

function getStatus(key: ApiKeySummary): { label: string; className: string } {
  if (key.revokedAt) {
    return {
      label: '失効済み',
      className: 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
    }
  }

  if (key.expiresAt && new Date(key.expiresAt).getTime() <= Date.now()) {
    return {
      label: '期限切れ',
      className: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200',
    }
  }

  return {
    label: '有効',
    className: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200',
  }
}

// 有効期限の選択肢。日数で持ち、発行時に「現在時刻 + 日数」のISO 8601文字列へ
// 変換して送る。null は無期限(expiresAtを送らない)。
const EXPIRY_OPTIONS = [
  { value: '1', label: '1日', days: 1 },
  { value: '7', label: '7日', days: 7 },
  { value: '30', label: '30日', days: 30 },
  { value: '180', label: '180日', days: 180 },
  { value: 'never', label: '無期限', days: null },
] as const

type ExpiryValue = (typeof EXPIRY_OPTIONS)[number]['value']

// 選択値から送信用のISO 8601文字列を作る。無期限の場合は undefined を返し、
// 呼び出し側でリクエストボディから expiresAt ごと省く。
function resolveExpiresAt(value: ExpiryValue): string | undefined {
  const option = EXPIRY_OPTIONS.find((candidate) => candidate.value === value)

  if (!option || option.days === null) {
    return undefined
  }

  const expiry = new Date()
  expiry.setDate(expiry.getDate() + option.days)

  return expiry.toISOString()
}

export default function ApiKeyManager() {
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // 発行フォームの状態
  const [name, setName] = useState('')
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>([])
  const [expiry, setExpiry] = useState<ExpiryValue>('30')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // 発行直後の平文キー。ページ内のstateにのみ保持し、リロードすれば必ず消える
  // (サーバー側もkeyHashしか保持していないため、二度と取得できない)。
  const [issuedKey, setIssuedKey] = useState<{ plaintextKey: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const [revokingId, setRevokingId] = useState<string | null>(null)

  const loadApiKeys = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/v1/api-keys')
      if (!res.ok) {
        const body: ApiErrorResponse = await res.json().catch(() => ({}))
        throw new Error(body.error?.message ?? 'APIキー一覧の取得に失敗しました')
      }
      const body = (await res.json()) as { data: ApiKeySummary[] }
      setApiKeys(body.data)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'APIキー一覧の取得に失敗しました')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadApiKeys()
  }, [loadApiKeys])

  function toggleScope(scope: ApiKeyScope) {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)

    if (!name.trim()) {
      setFormError('名前を入力してください')
      return
    }

    if (selectedScopes.length === 0) {
      setFormError('スコープを1つ以上選択してください')
      return
    }

    setIsSubmitting(true)
    try {
      const resolvedExpiresAt = resolveExpiresAt(expiry)

      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scopes: selectedScopes,
          // 無期限の場合は expiresAt ごと省く(nullを送ると型が合わない)
          ...(resolvedExpiresAt && { expiresAt: resolvedExpiresAt }),
        }),
      })

      if (!res.ok) {
        const body: ApiErrorResponse = await res.json().catch(() => ({}))
        throw new Error(body.error?.message ?? 'APIキーの発行に失敗しました')
      }

      const body = (await res.json()) as { key: string; apiKey: ApiKeySummary }

      setIssuedKey({ plaintextKey: body.key, name: body.apiKey.name })
      setCopied(false)
      setName('')
      setSelectedScopes([])
      setExpiry('30')
      await loadApiKeys()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'APIキーの発行に失敗しました')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCopy() {
    if (!issuedKey) return
    try {
      await navigator.clipboard.writeText(issuedKey.plaintextKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // クリップボードAPIが使えない環境向けのフォールバックは不要
      // (手動選択でコピーしてもらう)
    }
  }

  async function handleRevoke(key: ApiKeySummary) {
    if (
      !confirm(
        `「${key.name}」(${key.keyPrefix}...)を失効させますか？\n※この操作は取り消せません。失効後はこのキーで認証できなくなります。`
      )
    ) {
      return
    }

    setRevokingId(key.id)
    try {
      const res = await fetch(`/api/v1/api-keys/${key.id}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 204) {
        const body: ApiErrorResponse = await res.json().catch(() => ({}))
        throw new Error(body.error?.message ?? 'APIキーの失効に失敗しました')
      }
      await loadApiKeys()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'APIキーの失効に失敗しました')
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* 発行直後の平文キー表示 */}
      {issuedKey && (
        <div className="bg-red-50 dark:bg-red-950 border-2 border-red-400 dark:border-red-700 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden="true">
              ⚠️
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-red-800 dark:text-red-200 mb-1">
                APIキーを発行しました:「{issuedKey.name}」
              </h3>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-3">
                このキーは今だけ表示されます。この画面を閉じる・リロードすると二度と表示できません。今すぐコピーして安全な場所に保管してください。
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <code className="flex-1 min-w-0 break-all bg-white dark:bg-gray-900 border border-red-300 dark:border-red-700 rounded px-3 py-2 text-sm text-gray-800 dark:text-gray-100">
                  {issuedKey.plaintextKey}
                </code>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 font-semibold text-sm"
                >
                  {copied ? 'コピーしました！' : 'コピー'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setIssuedKey(null)}
                className="mt-3 text-sm text-red-700 dark:text-red-300 hover:underline"
              >
                閉じる(控えたことを確認しました)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 発行フォーム */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          新しいAPIキーを発行
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="api-key-name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              名前 <span className="text-red-600 dark:text-red-400">*</span>
            </label>
            <input
              id="api-key-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 集計バッチ"
              className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              スコープ <span className="text-red-600 dark:text-red-400">*</span>
            </span>
            <div className="space-y-2">
              {API_KEY_SCOPES.map((scope) => (
                <label key={scope} className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-mono text-gray-800 dark:text-gray-100">{scope}</span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {' '}
                      — {API_KEY_SCOPE_DESCRIPTIONS[scope]}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="api-key-expiry"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              有効期限
            </label>
            <select
              id="api-key-expiry"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value as ExpiryValue)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              {EXPIRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              発行時点からの期間です。無期限のキーは漏洩時の影響が大きいため、用途が
              限定されるなら期限付きを選んでください。
            </p>
          </div>

          {formError && (
            <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 font-semibold disabled:opacity-50"
          >
            {isSubmitting ? '発行中...' : 'APIキーを発行'}
          </button>
        </form>
      </div>

      {/* 一覧 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <div className="p-6 pb-0">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            発行済みAPIキー
          </h3>
        </div>
        <div className="p-6">
          {isLoading ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">読み込み中...</p>
          ) : loadError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>
          ) : apiKeys.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              まだAPIキーを発行していません。
            </p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full min-w-[720px]">
                <thead className="bg-gray-50 dark:bg-gray-700 border-b-2 border-gray-200 dark:border-gray-600">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      名前
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      キー
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      スコープ
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      最終使用
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      有効期限
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      状態
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      作成日時
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                  {apiKeys.map((key) => {
                    const status = getStatus(key)
                    const isRevoked = Boolean(key.revokedAt)
                    return (
                      <tr key={key.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
                          {key.name}
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">
                          {key.keyPrefix}...
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex flex-wrap gap-1">
                            {key.scopes.map((scope) => (
                              <span
                                key={scope}
                                className="inline-block px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-700 font-mono"
                              >
                                {scope}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {formatDateTime(key.lastUsedAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {formatDateTime(key.expiresAt)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-3 py-1 rounded text-xs ${status.className}`}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          {formatDateTime(key.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleRevoke(key)}
                            disabled={isRevoked || revokingId === key.id}
                            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 text-sm disabled:opacity-50"
                          >
                            {revokingId === key.id ? '失効中...' : '失効'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
