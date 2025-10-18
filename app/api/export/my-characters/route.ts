import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const element = searchParams.get('element')
  const type = searchParams.get('type')
  const search = searchParams.get('search')
  const wakuwaku = searchParams.get('wakuwaku')
  const wakuwakuMode = searchParams.get('wakuwakuMode') || 'or'

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        gameAccounts: {
          include: {
            ownedCharacters: {
              include: {
                characterMaster: true,
                wakuwakuSlots: {
                  include: {
                    wakuwakuMaster: true,
                  },
                  orderBy: {
                    slotNumber: 'asc',
                  },
                },
              },
            },
          },
          orderBy: {
            accountNumber: 'asc',
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const selectedWakuwaku = wakuwaku ? wakuwaku.split(',').filter(Boolean) : []

    // 全キャラクターマスターを取得（フィルタリング付き）
    const allCharacterMasters = await prisma.characterMaster.findMany({
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

    // 各キャラクターマスターに対して、各アカウントの所持情報をマッピング
    let characterData = allCharacterMasters.map((charMaster) => {
      const accountOwnerships: Record<string, any[]> = {}
      
      user.gameAccounts.forEach((account) => {
        const ownedChars = account.ownedCharacters.filter(
          (oc) => oc.characterMaster.id === charMaster.id
        )
        if (ownedChars.length > 0) {
          accountOwnerships[account.id] = ownedChars
        }
      })

      return {
        characterMaster: charMaster,
        accountOwnerships,
      }
    })

    // ワクワクの実でフィルタリング
    if (selectedWakuwaku.length > 0) {
      characterData = characterData.filter((charData) => {
        const allOwnedChars: any[] = []
        Object.values(charData.accountOwnerships).forEach((chars) => {
          allOwnedChars.push(...chars)
        })

        if (allOwnedChars.length === 0) return false

        const charWakuwakuNames = allOwnedChars.flatMap((char) =>
          char.wakuwakuSlots.map((slot: any) => slot.wakuwakuMaster.name)
        )

        if (wakuwakuMode === 'and') {
          return selectedWakuwaku.every((w) => charWakuwakuNames.includes(w))
        } else {
          return selectedWakuwaku.some((w) => charWakuwakuNames.includes(w))
        }
      })
    }

    // CSV形式に変換（BOM付きUTF-8でExcel対応）
    // 各所持キャラを1行ずつ出力
    const bom = '\uFEFF'
    const header = '図鑑No,名前,属性,種類,アカウント,わくわく1,レベル1,わくわく2,レベル2,わくわく3,レベル3,わくわく4,レベル4\n'

    // データ行を作成（各所持キャラごとに1行）
    const rows: string[] = []
    
    for (const charData of characterData) {
      const char = charData.characterMaster
      
      // 各アカウントの所持キャラを展開
      for (const account of user.gameAccounts) {
        const ownedChars = charData.accountOwnerships[account.id] || []
        
        // 各所持キャラを1行ずつ出力
        for (const ownedChar of ownedChars) {
          const accountName = account.name || `垢${account.accountNumber}`
          const wakuwaku1 = ownedChar.wakuwakuSlots[0]?.wakuwakuMaster.name || ''
          const level1 = ownedChar.wakuwakuSlots[0]?.level || ''
          const wakuwaku2 = ownedChar.wakuwakuSlots[1]?.wakuwakuMaster.name || ''
          const level2 = ownedChar.wakuwakuSlots[1]?.level || ''
          const wakuwaku3 = ownedChar.wakuwakuSlots[2]?.wakuwakuMaster.name || ''
          const level3 = ownedChar.wakuwakuSlots[2]?.level || ''
          const wakuwaku4 = ownedChar.wakuwakuSlots[3]?.wakuwakuMaster.name || ''
          const level4 = ownedChar.wakuwakuSlots[3]?.level || ''
          
          rows.push(
            `${char.indexNumber},"${char.monsterName}",${char.element},${char.type},"${accountName}",${wakuwaku1},${level1},${wakuwaku2},${level2},${wakuwaku3},${level3},${wakuwaku4},${level4}`
          )
        }
      }
    }

    const csv = bom + header + rows.join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="my_characters_${new Date().toISOString().split('T')[0]}.csv"`,
      },
    })
  } catch (error) {
    console.error('CSV export error:', error)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
