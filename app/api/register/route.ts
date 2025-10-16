import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'すべてのフィールドを入力してください' },
        { status: 400 }
      )
    }

    // メールアドレスの重複チェック
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'このメールアドレスは既に登録されています' },
        { status: 400 }
      )
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10)

    // ユーザーを作成
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      },
    })

    // 4つのアカウントを自動作成
    await prisma.gameAccount.createMany({
      data: [
        {
          userId: user.id,
          accountNumber: 1,
          name: '1',
        },
        {
          userId: user.id,
          accountNumber: 2,
          name: '2',
        },
        {
          userId: user.id,
          accountNumber: 3,
          name: '3',
        },
        {
          userId: user.id,
          accountNumber: 4,
          name: '4',
        },
      ],
    })

    return NextResponse.json(
      { message: 'ユーザー登録が完了しました' },
      { status: 201 }
    )
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: '登録中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
