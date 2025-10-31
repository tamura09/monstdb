import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import UpdateNameForm from '@/components/UpdateNameForm'
import UpdateGameAccountNameForm from '@/components/UpdateGameAccountNameForm'

export default async function ProfilePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      accounts: {
        select: {
          provider: true,
        },
      },
      gameAccounts: {
        include: {
          _count: {
            select: {
              ownedCharacters: true,
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
    redirect('/login')
  }

  // Server Action: ユーザー名変更
  async function updateName(formData: FormData) {
    'use server'

    const name = formData.get('name') as string

    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }

    if (!name || name.trim().length === 0) {
      throw new Error('名前を入力してください')
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { name: name.trim() },
    })

    revalidatePath('/profile')
    revalidatePath('/accounts')
  }

  // Server Action: ゲームアカウント名変更
  async function updateGameAccountName(formData: FormData) {
    'use server'

    const accountId = formData.get('accountId') as string
    const name = formData.get('name') as string

    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }

    if (!name || name.trim().length === 0) {
      throw new Error('アカウント名を入力してください')
    }

    // アカウントの所有者確認
    const account = await prisma.gameAccount.findUnique({
      where: { id: accountId },
    })

    if (!account || account.userId !== session.user.id) {
      throw new Error('Unauthorized')
    }

    await prisma.gameAccount.update({
      where: { id: accountId },
      data: { name: name.trim() },
    })

    revalidatePath('/profile')
    revalidatePath('/accounts')
  }

  const totalCharacters = user.gameAccounts.reduce(
    (sum, account) => sum + account._count.ownedCharacters,
    0
  )

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/accounts"
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-2"
        >
          ← アカウント一覧に戻る
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">マイページ</h1>

        {/* プロフィール情報 */}
        <div className="space-y-6">
          {/* Googleアカウント情報 */}
          <div className="border-b border-gray-200 dark:border-gray-600 pb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
              アカウント情報
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                {user.image && (
                  <img
                    src={user.image}
                    alt="プロフィール画像"
                    className="w-16 h-16 rounded-full"
                  />
                )}
                <div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">ログイン方法</div>
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                    <span className="text-gray-900 dark:text-gray-100 font-medium">
                      Googleアカウント
                    </span>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">メールアドレス</div>
                <div className="text-gray-900 dark:text-gray-100">{user.email}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 dark:text-gray-400">権限</div>
                <div>
                  {user.role === 'admin' ? (
                    <span className="bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 px-3 py-1 rounded-full text-sm font-semibold">
                      管理者
                    </span>
                  ) : (
                    <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-3 py-1 rounded-full text-sm font-semibold">
                      一般ユーザー
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ユーザー名変更 */}
          <div className="border-b border-gray-200 dark:border-gray-600 pb-6">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
              表示名の変更
            </h2>
            <UpdateNameForm
              currentName={user.name}
              updateNameAction={updateName}
            />
          </div>

          {/* 統計情報 */}
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
              統計情報
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4">
                <div className="text-sm text-blue-600 dark:text-blue-200 font-medium">
                  ゲームアカウント数
                </div>
                <div className="text-3xl font-bold text-blue-900 dark:text-blue-100 mt-2">
                  {user.gameAccounts.length}
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900 rounded-lg p-4">
                <div className="text-sm text-green-600 dark:text-green-200 font-medium">
                  総所持キャラ数
                </div>
                <div className="text-3xl font-bold text-green-900 dark:text-green-100 mt-2">
                  {totalCharacters}
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900 rounded-lg p-4">
                <div className="text-sm text-purple-600 dark:text-purple-200 font-medium">
                  平均所持数/垢
                </div>
                <div className="text-3xl font-bold text-purple-900 dark:text-purple-100 mt-2">
                  {user.gameAccounts.length > 0
                    ? Math.round(totalCharacters / user.gameAccounts.length)
                    : 0}
                </div>
              </div>
            </div>

            {/* ゲームアカウント詳細 */}
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
                ゲームアカウント詳細
              </h3>
              <div className="space-y-2">
                {user.gameAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-600 dark:bg-blue-700 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 mt-1">
                        {account.accountNumber}
                      </div>
                      <div className="flex-1 min-w-0">
                        <UpdateGameAccountNameForm
                          accountId={account.id}
                          currentName={account.name}
                          updateNameAction={updateGameAccountName}
                        />
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm text-gray-500 dark:text-gray-400">所持キャラ</div>
                        <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {account._count.ownedCharacters}体
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
