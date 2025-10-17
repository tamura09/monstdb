import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function NewCharacterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; indexNumber?: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { error, indexNumber } = await searchParams

  // Admin権限チェック
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  })

  if (!user || user.role !== 'admin') {
    redirect('/accounts')
  }

  // Server Action: キャラクター作成
  async function createCharacter(formData: FormData) {
    'use server'

    const indexNumber = parseInt(formData.get('indexNumber') as string)
    const monsterName = formData.get('monsterName') as string
    const element = formData.get('element') as string
    const type = formData.get('type') as string

    // インデックス番号の重複チェック
    const existing = await prisma.characterMaster.findUnique({
      where: { indexNumber },
    })

    if (existing) {
      redirect(`/admin/characters/new?error=duplicate&indexNumber=${indexNumber}`)
    }

    await prisma.characterMaster.create({
      data: {
        indexNumber,
        monsterName,
        element,
        type,
      },
    })

    redirect('/admin/characters?success=created')
  }

  const elements = ['火', '水', '木', '光', '闇']
  const types = ['限定', '恒常', 'α', 'コラボ']

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          キャラクター新規追加
        </h1>
      </div>

      <div className="mb-6">
        <Link
          href="/admin/characters"
          className="text-blue-600 hover:underline"
        >
          ← キャラクター管理に戻る
        </Link>
      </div>

      {/* エラーメッセージ */}
      {error === 'duplicate' && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          <strong className="font-bold">エラー: </strong>
          <span>図鑑No. {indexNumber} は既に登録されています。別の番号を入力してください。</span>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md p-6">
        <form action={createCharacter}>
          <div className="space-y-6">
            {/* インデックス番号 */}
            <div>
              <label
                htmlFor="indexNumber"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                図鑑No. <span className="text-red-600">*</span>
              </label>
              <input
                type="number"
                id="indexNumber"
                name="indexNumber"
                required
                min="1"
                defaultValue={indexNumber || ''}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                  error === 'duplicate'
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                }`}
                placeholder="例: 1234"
              />
            </div>

            {/* キャラクター名 */}
            <div>
              <label
                htmlFor="monsterName"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                キャラクター名 <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                id="monsterName"
                name="monsterName"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="例: オラゴン"
              />
            </div>

            {/* 属性 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                属性 <span className="text-red-600">*</span>
              </label>
              <div className="flex gap-3">
                {elements.map((el) => (
                  <label key={el} className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="element"
                      value={el}
                      required
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span
                      className={`px-3 py-1 rounded text-sm ${
                        el === '火'
                          ? 'bg-red-100 text-red-700'
                          : el === '水'
                          ? 'bg-blue-100 text-blue-700'
                          : el === '木'
                          ? 'bg-green-100 text-green-700'
                          : el === '光'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {el}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* 種類 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                種類 <span className="text-red-600">*</span>
              </label>
              <div className="flex gap-3">
                {types.map((t) => (
                  <label key={t} className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="type"
                      value={t}
                      required
                      className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{t}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ボタン */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-semibold"
              >
                作成
              </button>
              <Link
                href="/admin/characters"
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300 font-semibold text-center"
              >
                キャンセル
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
