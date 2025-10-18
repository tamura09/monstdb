import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // 全キャラクターマスターを取得
    const characters = await prisma.characterMaster.findMany({
      orderBy: {
        indexNumber: 'asc',
      },
    })

    // 全ワクワクマスターを取得
    const wakuwakus = await prisma.wakuwakuMaster.findMany({
      orderBy: {
        displayOrder: 'asc',
      },
    })

    // ワクワク名のリストを作成（最大4個分）
    const wakuwakuNames = wakuwakus.map((w) => w.name)

    // CSVヘッダー（BOM付き）
    const bom = '\uFEFF'
    const header = [
      '図鑑No',
      '名前',
      '属性',
      '種類',
      'アカウント',
      'わくわく1',
      'レベル1',
      'わくわく2',
      'レベル2',
      'わくわく3',
      'レベル3',
      'わくわく4',
      'レベル4',
    ].join(',')

    // テンプレート行を生成（全キャラクター分の空行）
    const rows = characters.map((char) => {
      return [
        char.indexNumber,
        `"${char.monsterName}"`,
        char.element,
        char.type,
        '', // アカウント（空）
        '', // わくわく1（空）
        '', // レベル1（空）
        '', // わくわく2（空）
        '', // レベル2（空）
        '', // わくわく3（空）
        '', // レベル3（空）
        '', // わくわく4（空）
        '', // レベル4（空）
      ].join(',')
    })

    // ワクワクの選択肢をコメント行として追加
    const wakuwakuOptions = `# 利用可能なワクワくの実: ${wakuwakuNames.join(', ')}`
    const instructions = [
      '# インポート用テンプレート',
      '# 使い方:',
      '#   1. ワクワク列に利用可能なワクワくの実の名前を入力してください',
      '#   2. 不要な行は削除してください',
      '#   3. 保存後、アカウントページの「インポート」ボタンからアップロードしてください',
      wakuwakuOptions,
      '',
    ].join('\n')

    const csv = bom + instructions + header + '\n' + rows.join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="import-template.csv"',
      },
    })
  } catch (error) {
    console.error('CSV template generation error:', error)
    return NextResponse.json(
      { error: 'CSV template generation failed' },
      { status: 500 }
    )
  }
}
