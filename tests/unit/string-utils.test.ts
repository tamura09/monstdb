import { describe, it, expect } from 'vitest'
import {
  hiraganaToKatakana,
  katakanaToHiragana,
  normalizeJapanese,
  matchesJapanese,
  matchesJapaneseOr,
} from '@/lib/string-utils'

// lib/string-utils.ts のテスト。
// /api/v1/characters?search= の「ひらがな・カタカナを区別しない検索」は
// matchesJapaneseOr に依存しているため、その挙動を固定する。

describe('hiraganaToKatakana / katakanaToHiragana', () => {
  it('ひらがなをカタカナへ変換する', () => {
    expect(hiraganaToKatakana('すさのお')).toBe('スサノオ')
    expect(hiraganaToKatakana('ぱぴぷぺぽ')).toBe('パピプペポ')
  })

  it('カタカナをひらがなへ変換する', () => {
    expect(katakanaToHiragana('スサノオ')).toBe('すさのお')
  })

  it('日本語以外の文字はそのまま残す', () => {
    expect(hiraganaToKatakana('abc123-火')).toBe('abc123-火')
    expect(katakanaToHiragana('abc123-火')).toBe('abc123-火')
  })
})

describe('normalizeJapanese', () => {
  it('ひらがな・カタカナをカタカナへ統一する', () => {
    expect(normalizeJapanese('すさのお')).toBe(normalizeJapanese('スサノオ'))
  })

  it('英字は小文字へ揃える', () => {
    expect(normalizeJapanese('ABC')).toBe('abc')
  })
})

describe('matchesJapanese', () => {
  it('ひらがなのクエリでカタカナの本文にマッチする', () => {
    expect(matchesJapanese('スサノオ', 'すさのお')).toBe(true)
  })

  it('カタカナのクエリでひらがなの本文にマッチする', () => {
    expect(matchesJapanese('すさのお', 'スサノオ')).toBe(true)
  })

  it('部分一致する', () => {
    expect(matchesJapanese('超絶スサノオ改', 'すさのお')).toBe(true)
  })

  it('含まれない場合は false', () => {
    expect(matchesJapanese('アグナムート', 'すさのお')).toBe(false)
  })
})

describe('matchesJapaneseOr — かな非区別', () => {
  it('ひらがな・カタカナを区別しない', () => {
    expect(matchesJapaneseOr('スサノオ', 'すさのお')).toBe(true)
    expect(matchesJapaneseOr('すさのお', 'スサノオ')).toBe(true)
    expect(matchesJapaneseOr('スサノオ', 'スサノオ')).toBe(true)
    expect(matchesJapaneseOr('すさのお', 'すさのお')).toBe(true)
  })

  it('濁点・半濁点付きのかなも区別しない', () => {
    expect(matchesJapaneseOr('パンドラ', 'ぱんどら')).toBe(true)
    expect(matchesJapaneseOr('ぱんどら', 'パンドラ')).toBe(true)
  })

  it('部分一致で判定する', () => {
    expect(matchesJapaneseOr('超絶スサノオ改', 'さのお')).toBe(true)
  })

  it('英字の大文字小文字を区別しない', () => {
    expect(matchesJapaneseOr('Lucifer', 'lucifer')).toBe(true)
    expect(matchesJapaneseOr('lucifer', 'LUCIFER')).toBe(true)
  })
})

describe('matchesJapaneseOr — 複数キーワードのOR検索', () => {
  it('半角スペース区切りのいずれかにマッチすれば true', () => {
    expect(matchesJapaneseOr('スサノオ', 'あぐな すさのお')).toBe(true)
    expect(matchesJapaneseOr('アグナムート', 'あぐな すさのお')).toBe(true)
  })

  it('全角スペース区切りにも対応する', () => {
    expect(matchesJapaneseOr('スサノオ', 'あぐな　すさのお')).toBe(true)
  })

  it('どのキーワードにもマッチしなければ false', () => {
    expect(matchesJapaneseOr('ルシファー', 'あぐな すさのお')).toBe(false)
  })

  it('連続したスペースがあっても空キーワードで全件ヒットしない', () => {
    expect(matchesJapaneseOr('ルシファー', 'あぐな   すさのお')).toBe(false)
  })
})

describe('matchesJapaneseOr — 空クエリ', () => {
  it('空文字は絞り込みなし(true)として扱う', () => {
    expect(matchesJapaneseOr('スサノオ', '')).toBe(true)
  })

  it('空白のみのクエリも絞り込みなし(true)として扱う', () => {
    expect(matchesJapaneseOr('スサノオ', '   ')).toBe(true)
    expect(matchesJapaneseOr('スサノオ', '　')).toBe(true)
  })
})
