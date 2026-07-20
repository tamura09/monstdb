import { describe, it, expect } from 'vitest'
import {
  elementSchema,
  characterTypeSchema,
  wakuwakuLevelSchema,
  characterMasterCreateSchema,
  characterMasterUpdateSchema,
} from '@/lib/api/schemas'

// lib/api/schemas.ts の zod スキーマのテスト。
//
// 特に indexNumber は、旧実装(app/api/admin/characters/route.ts)が
// parseInt(indexNumber) を未検証で使っていたため "abc" が NaN として
// すり抜けていた。その回帰を防ぐケースを重点的に置いている。

const validBody = {
  indexNumber: 12345,
  monsterName: 'テストモンスター',
  element: '火',
  type: '恒常',
}

describe('characterMasterCreateSchema — indexNumber (parseIntのNaN素通りバグの回帰防止)', () => {
  it('非数値の文字列を拒否する', () => {
    const result = characterMasterCreateSchema.safeParse({ ...validBody, indexNumber: 'abc' })

    expect(result.success).toBe(false)
  })

  it('数字を含むが数値でない文字列を拒否する', () => {
    for (const indexNumber of ['12abc', 'abc12', '1.2.3', '', ' ', '--1']) {
      const result = characterMasterCreateSchema.safeParse({ ...validBody, indexNumber })

      expect(result.success, `indexNumber=${JSON.stringify(indexNumber)} は拒否されるべき`).toBe(
        false
      )
    }
  })

  it('小数を拒否する', () => {
    expect(characterMasterCreateSchema.safeParse({ ...validBody, indexNumber: 1.5 }).success).toBe(
      false
    )
    expect(
      characterMasterCreateSchema.safeParse({ ...validBody, indexNumber: '1.5' }).success
    ).toBe(false)
  })

  it('負数と0を拒否する', () => {
    expect(characterMasterCreateSchema.safeParse({ ...validBody, indexNumber: -1 }).success).toBe(
      false
    )
    expect(characterMasterCreateSchema.safeParse({ ...validBody, indexNumber: 0 }).success).toBe(
      false
    )
  })

  it('NaN / Infinity / null / undefined / false / 空配列 / オブジェクトを拒否する', () => {
    for (const indexNumber of [NaN, Infinity, -Infinity, null, undefined, false, [], {}]) {
      const result = characterMasterCreateSchema.safeParse({ ...validBody, indexNumber })

      expect(result.success, `indexNumber=${String(indexNumber)} は拒否されるべき`).toBe(false)
    }
  })

  // ここは「現在の挙動を固定するテスト」であって、望ましい仕様を表明するものではない。
  //
  // z.coerce.number() は内部で Number(value) を呼ぶため、JSONの true や [5] が
  // それぞれ 1 / 5 に変換され、int().positive() を通過してしまう。
  // つまり `{"indexNumber": true}` は 422 ではなく indexNumber=1 として
  // 受理される。実装を変更しない方針のため、まずは実挙動を記録しておく。
  //
  // 直す場合は z.coerce.number() を
  //   z.union([z.number(), z.string().regex(/^\d+$/).transform(Number)])
  // のような「文字列と数値のみを受け付ける」形にするのが素直。
  it('【既知の緩さ】真偽値 true / 単一要素配列は数値へ強制変換されて通過する', () => {
    expect(characterMasterCreateSchema.safeParse({ ...validBody, indexNumber: true })).toMatchObject(
      { success: true, data: { indexNumber: 1 } }
    )
    expect(characterMasterCreateSchema.safeParse({ ...validBody, indexNumber: [5] })).toMatchObject(
      { success: true, data: { indexNumber: 5 } }
    )
  })

  it('正の整数を受け入れる', () => {
    const result = characterMasterCreateSchema.safeParse({ ...validBody, indexNumber: 191 })

    expect(result.success).toBe(true)
    expect(result.data?.indexNumber).toBe(191)
  })

  it('整数を表す文字列は数値へ強制変換して受け入れる(z.coerce の想定挙動)', () => {
    const result = characterMasterCreateSchema.safeParse({ ...validBody, indexNumber: '191' })

    expect(result.success).toBe(true)
    expect(result.data?.indexNumber).toBe(191)
    expect(typeof result.data?.indexNumber).toBe('number')
  })
})

describe('characterMasterCreateSchema — monsterName', () => {
  it('空文字を拒否する', () => {
    expect(
      characterMasterCreateSchema.safeParse({ ...validBody, monsterName: '' }).success
    ).toBe(false)
  })

  it('数値など文字列以外を拒否する', () => {
    expect(
      characterMasterCreateSchema.safeParse({ ...validBody, monsterName: 123 }).success
    ).toBe(false)
  })

  it('1文字以上の文字列を受け入れる', () => {
    expect(
      characterMasterCreateSchema.safeParse({ ...validBody, monsterName: 'あ' }).success
    ).toBe(true)
  })
})

describe('elementSchema', () => {
  it('火・水・木・光・闇のみを受け入れる', () => {
    for (const element of ['火', '水', '木', '光', '闇']) {
      expect(elementSchema.safeParse(element).success, element).toBe(true)
    }
  })

  it('定義されていない属性(雷など)を拒否する', () => {
    for (const element of ['雷', 'fire', '', '火水', null]) {
      expect(elementSchema.safeParse(element).success, String(element)).toBe(false)
    }
  })
})

describe('characterTypeSchema', () => {
  it('限定・恒常のみを受け入れる', () => {
    expect(characterTypeSchema.safeParse('限定').success).toBe(true)
    expect(characterTypeSchema.safeParse('恒常').success).toBe(true)
  })

  it('それ以外を拒否する', () => {
    for (const type of ['通常', 'limited', '', null]) {
      expect(characterTypeSchema.safeParse(type).success, String(type)).toBe(false)
    }
  })
})

describe('wakuwakuLevelSchema', () => {
  it('L と EL を受け入れる', () => {
    expect(wakuwakuLevelSchema.parse('L')).toBe('L')
    expect(wakuwakuLevelSchema.parse('EL')).toBe('EL')
  })

  it('未指定の場合は L を既定値とする', () => {
    expect(wakuwakuLevelSchema.parse(undefined)).toBe('L')
  })

  it('XL など未定義のレベルを拒否する', () => {
    for (const level of ['XL', 'l', 'el', '', 1, null]) {
      expect(wakuwakuLevelSchema.safeParse(level).success, String(level)).toBe(false)
    }
  })
})

describe('characterMasterUpdateSchema (PATCH用のpartial版)', () => {
  it('空オブジェクトを受け入れる(変更なし)', () => {
    const result = characterMasterUpdateSchema.safeParse({})

    expect(result.success).toBe(true)
  })

  it('一部フィールドのみの指定を受け入れる', () => {
    const result = characterMasterUpdateSchema.safeParse({ monsterName: '改名後' })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ monsterName: '改名後' })
  })

  it('partial版でも indexNumber の型検証は維持される', () => {
    expect(characterMasterUpdateSchema.safeParse({ indexNumber: 'abc' }).success).toBe(false)
    expect(characterMasterUpdateSchema.safeParse({ indexNumber: -5 }).success).toBe(false)
    expect(characterMasterUpdateSchema.safeParse({ indexNumber: 1.5 }).success).toBe(false)
  })

  it('partial版でも element の enum 検証は維持される', () => {
    expect(characterMasterUpdateSchema.safeParse({ element: '雷' }).success).toBe(false)
    expect(characterMasterUpdateSchema.safeParse({ element: '闇' }).success).toBe(true)
  })
})
