import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const element = searchParams.get('element')
  const type = searchParams.get('type')
  const search = searchParams.get('search')

  try {
    const characters = await prisma.characterMaster.findMany({
      where: {
        ...(element && { element }),
        ...(type && { type }),
        ...(search && {
          monsterName: {
            contains: search,
          },
        }),
      },
      orderBy: {
        indexNumber: 'asc',
      },
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
