// わくわくの実の装着上限。
// schemaコメント(prisma/schema.prisma の OwnedCharacterWakuwaku「最大4個」)・
// 既存ガード式(app/accounts/page.tsx, app/accounts/[id]/page.tsx の
// `existingSlots.length >= 4`)・CSVインポート(scripts/import-my-characters-cli.ts の
// wakuwaku1〜wakuwaku4)と同じ 4 を正とする。
export const MAX_WAKUWAKU_SLOTS = 4
