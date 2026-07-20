import { z } from 'zod'

// prisma/schema.prisma の CharacterMaster.element コメント
// 「火、水、木、光、闇」に準拠した属性のenum
export const elementSchema = z.enum(['火', '水', '木', '光', '闇'])

// prisma/schema.prisma の CharacterMaster.type コメント
// 「限定、恒常」に準拠したキャラ種別のenum
export const characterTypeSchema = z.enum(['限定', '恒常'])

// prisma/schema.prisma の OwnedCharacterWakuwaku.level コメント
// 「"L" or "EL"」に準拠したわくわくの実のレベル。既定値は'L'
export const wakuwakuLevelSchema = z.enum(['L', 'EL']).default('L')

// JSONボディ用の厳格な正の整数スキーマ。
//
// z.coerce.number() は内部で Number() を呼ぶため、boolean や要素1つの配列まで
// 数値に変換してしまう(Number(true) === 1、Number([5]) === 5)。
// クエリパラメータのように必ず文字列で渡ってくる入力なら問題にならないが、
// JSONボディでは true や [5] がそのまま型として渡り得るため、これらを
// 弾く必要がある。
//
// そこで文字列のときだけ数値化し、それ以外の型は変換せず後段の z.number() に
// 委ねることで、number と数値文字列のみを受け付ける。
export const strictPositiveIntSchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    // number はそのまま、boolean/配列/オブジェクト等は変換せず z.number() で弾く
    return value
  }

  const trimmed = value.trim()

  // Number('') === 0 になってしまうため、空文字は数値化しない
  if (trimmed === '') {
    return value
  }

  const parsed = Number(trimmed)

  return Number.isNaN(parsed) ? value : parsed
}, z.number().int().positive())

// キャラクターマスター作成用スキーマ
// indexNumberは必ず整数として検証する。
// (既存の app/api/admin/characters/route.ts は parseInt(indexNumber) を
//  未検証で使っており、非数値文字列がNaNとしてすり抜け得たための是正)
export const characterMasterCreateSchema = z.object({
  indexNumber: strictPositiveIntSchema,
  monsterName: z.string().min(1, 'モンスター名を入力してください'),
  element: elementSchema,
  type: characterTypeSchema,
})

// キャラクターマスター更新(PATCH)用スキーマ。作成用スキーマのpartial版。
export const characterMasterUpdateSchema = characterMasterCreateSchema.partial()

export type Element = z.infer<typeof elementSchema>
export type CharacterType = z.infer<typeof characterTypeSchema>
export type WakuwakuLevel = z.infer<typeof wakuwakuLevelSchema>
export type CharacterMasterCreateInput = z.infer<typeof characterMasterCreateSchema>
export type CharacterMasterUpdateInput = z.infer<typeof characterMasterUpdateSchema>
