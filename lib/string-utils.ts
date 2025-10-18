/**
 * ひらがなをカタカナに変換する
 */
export function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (match) => {
    const chr = match.charCodeAt(0) + 0x60
    return String.fromCharCode(chr)
  })
}

/**
 * カタカナをひらがなに変換する
 */
export function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30a1-\u30f6]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60
    return String.fromCharCode(chr)
  })
}

/**
 * 文字列を正規化（ひらがな・カタカナを統一）
 * 検索時の比較に使用
 */
export function normalizeJapanese(str: string): string {
  // カタカナに統一
  return hiraganaToKatakana(str.toLowerCase())
}

/**
 * ひらがな・カタカナを区別せずに部分一致検索
 */
export function matchesJapanese(text: string, query: string): boolean {
  const normalizedText = normalizeJapanese(text)
  const normalizedQuery = normalizeJapanese(query)
  return normalizedText.includes(normalizedQuery)
}
