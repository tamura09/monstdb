import { z } from 'zod'

// APIキーに付与できるスコープの一覧。
// 「最小権限の原則」に基づき、read/writeを分離し、かつ
// キャラクターマスター（全体で共有されるマスターデータ）と
// アカウント（ユーザー個別の所持データ）を別カテゴリとして分離している。
//
// characters:write は admin相当の操作（マスターデータの作成・更新・削除）を
// 許可するため、要求箇所ではAPIキーの発行者自身がadminであることも
// 別途確認する必要がある(lib/api/auth.tsのrequireAdmin参照)。
export const API_KEY_SCOPES = [
  'characters:read',
  'characters:write',
  'accounts:read',
  'accounts:write',
] as const

export const apiKeyScopeSchema = z.enum(API_KEY_SCOPES)

export type ApiKeyScope = z.infer<typeof apiKeyScopeSchema>

// APIキー発行フォーム・ドキュメントで表示する日本語の説明文
export const API_KEY_SCOPE_DESCRIPTIONS: Record<ApiKeyScope, string> = {
  'characters:read': 'キャラクターマスターの参照（一覧・詳細取得）',
  'characters:write': 'キャラクターマスターの作成・更新・削除（admin相当の操作）',
  'accounts:read': '自分のゲームアカウント・所持キャラ・わくわくの実の参照',
  'accounts:write': '所持キャラの登録・削除、わくわくの実のセット・解除',
}
