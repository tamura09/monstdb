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

// キャラクターマスター作成用スキーマ
// indexNumberは必ず整数として検証する。
// (既存の app/api/admin/characters/route.ts は parseInt(indexNumber) を
//  未検証で使っており、非数値文字列がNaNとしてすり抜け得たための是正)
export const characterMasterCreateSchema = z.object({
  indexNumber: z.coerce.number().int().positive(),
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
