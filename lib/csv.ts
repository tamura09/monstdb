/**
 * RFC 4180 準拠の CSV パーサ/シリアライザ。
 *
 * - BOM (U+FEFF) を先頭から除去する
 * - 改行は CRLF / LF / CR のいずれも受け付ける
 * - ダブルクォートで囲まれたフィールド内のカンマ・改行を値の一部として保持する
 * - `""` は `"` にアンエスケープする
 * - 空フィールドは保持する (`a,,b` -> `['a', '', 'b']`)
 * - 末尾の空行は無視する
 */
export function parseCsv(text: string): string[][] {
  // 先頭の BOM を除去
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1)
  }

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const pushField = () => {
    row.push(field)
    field = ''
  }

  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }

  const len = text.length
  let i = 0

  while (i < len) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          // エスケープされたダブルクォート
          field += '"'
          i += 2
          continue
        }
        // クォート終了
        inQuotes = false
        i += 1
        continue
      }
      // クォート内の文字（カンマ・改行含む）はそのまま値に含める
      field += char
      i += 1
      continue
    }

    if (char === '"') {
      inQuotes = true
      i += 1
      continue
    }

    if (char === ',') {
      pushField()
      i += 1
      continue
    }

    if (char === '\r') {
      pushRow()
      i += 1
      if (text[i] === '\n') {
        i += 1
      }
      continue
    }

    if (char === '\n') {
      pushRow()
      i += 1
      continue
    }

    field += char
    i += 1
  }

  // 末尾に改行がない最終行のフィールド/行を確定する
  if (field.length > 0 || row.length > 0 || inQuotes) {
    pushRow()
  }

  // 末尾の空行（単一の空文字フィールドのみの行）を無視する
  while (rows.length > 0) {
    const last = rows[rows.length - 1]
    if (last.length === 1 && last[0] === '') {
      rows.pop()
    } else {
      break
    }
  }

  return rows
}

/**
 * 値の配列を 1 行分の CSV 文字列にエンコードする。
 * カンマ・ダブルクォート・改行を含む値はダブルクォートで囲み、
 * 内部のダブルクォートは `""` にエスケープする。
 */
export function toCsvRow(values: string[]): string {
  return values.map(escapeCsvField).join(',')
}

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
