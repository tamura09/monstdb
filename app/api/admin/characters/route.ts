import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Admin権限チェック
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { indexNumber, monsterName, element, type } = body

    // インデックス番号の重複チェック
    const existing = await prisma.characterMaster.findUnique({
      where: { indexNumber: parseInt(indexNumber) },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'duplicate', indexNumber },
        { status: 400 }
      )
    }

    const character = await prisma.characterMaster.create({
      data: {
        indexNumber: parseInt(indexNumber),
        monsterName,
        element,
        type,
      },
    })

    return NextResponse.json({ success: true, character })
  } catch (error) {
    console.error('キャラクター作成エラー:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Admin権限チェック
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { characterId, indexNumber, monsterName, element, type } = body

    // インデックス番号の重複チェック（自分以外）
    const existing = await prisma.characterMaster.findFirst({
      where: {
        indexNumber: parseInt(indexNumber),
        NOT: {
          id: characterId,
        },
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'duplicate', indexNumber },
        { status: 400 }
      )
    }

    const character = await prisma.characterMaster.update({
      where: { id: characterId },
      data: {
        indexNumber: parseInt(indexNumber),
        monsterName,
        element,
        type,
      },
    })

    return NextResponse.json({ success: true, character })
  } catch (error) {
    console.error('キャラクター更新エラー:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Admin権限チェック
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const characterId = searchParams.get('id')

    if (!characterId) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 })
    }

    await prisma.characterMaster.delete({
      where: { id: characterId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('キャラクター削除エラー:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
