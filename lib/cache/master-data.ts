import { unstable_cache } from 'next/cache'
import { prisma } from '@/lib/prisma'

// キャラクターマスター（994件）・わくわくの実マスター（32件）は
// admin編集時以外ほぼ変化しないマスターデータなので、Next.jsのData Cacheで
// キャッシュし、リクエストのたびにPostgreSQLへ問い合わせるのを避ける。
//
// キャッシュ関数は常に「全カラム・全件」を返す。呼び出し元ごとに必要な
// カラム・絞り込みが異なるため、select/whereは呼び出し元でJS側に行う
// （994件・32件を毎回JSでmap/filterするコストは無視できる）。
export const CHARACTER_MASTER_CACHE_TAG = 'character-master'
export const WAKUWAKU_MASTER_CACHE_TAG = 'wakuwaku-master'

// revalidate: 300 (5分) は、Next.jsのリクエストコンテキスト外で動く
// scripts/add-new-characters.ts のようなCLIスクリプト経由の書き込みが
// revalidateTag() を呼べないことに対する時間ベースの安全網。
export const getCachedCharacterMasters = unstable_cache(
  async () => prisma.characterMaster.findMany({ orderBy: { indexNumber: 'asc' } }),
  ['character-masters-all'],
  { tags: [CHARACTER_MASTER_CACHE_TAG], revalidate: 300 }
)

export const getCachedWakuwakuMasters = unstable_cache(
  async () => prisma.wakuwakuMaster.findMany({ orderBy: { displayOrder: 'asc' } }),
  ['wakuwaku-masters-all'],
  { tags: [WAKUWAKU_MASTER_CACHE_TAG], revalidate: 300 }
)
