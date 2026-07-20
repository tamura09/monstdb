import { NextRequest, NextResponse } from 'next/server'
import { getCachedCharacterMasters } from '@/lib/cache/master-data'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const element = searchParams.get('element')
  const type = searchParams.get('type')
  const search = searchParams.get('search')

  try {
    const characters = (await getCachedCharacterMasters()).filter((character) => {
      if (element && character.element !== element) return false
      if (type && character.type !== type) return false
      if (search && !character.monsterName.includes(search)) return false
      return true
    })

    // CSV形式に変換（BOM付きUTF-8でExcel対応）
    const bom = '\uFEFF'
    const header = '図鑑No,名前,属性,種類\n'
    const rows = characters.map(char => 
      `${char.indexNumber},"${char.monsterName}",${char.element},${char.type}`
    ).join('\n')
    
    const csv = bom + header + rows

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="characters_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error('CSV export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
