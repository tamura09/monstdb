import { prisma } from '@/lib/prisma'
import type { User } from '@prisma/client'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import FriendSearchForm from '@/components/FriendSearchForm'
import FriendRequestCard from '@/components/FriendRequestCard'
import FriendCard from '@/components/FriendCard'
import FriendIdDisplay from '@/components/FriendIdDisplay'
import SendFriendRequestButton from '@/components/SendFriendRequestButton'

export default async function FriendsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login')
  }

  const { search } = await searchParams

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      sentFriendRequests: {
        include: {
          receiver: true,
        },
        where: {
          status: 'pending',
        },
      },
      receivedFriendRequests: {
        include: {
          sender: true,
        },
        where: {
          status: 'pending',
        },
      },
      friendsInitiated: {
        include: {
          friend: {
            include: {
              gameAccounts: {
                include: {
                  _count: {
                    select: {
                      ownedCharacters: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      friendsReceived: {
        include: {
          user: {
            include: {
              gameAccounts: {
                include: {
                  _count: {
                    select: {
                      ownedCharacters: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!user) {
    redirect('/login')
  }

  // フレンドリストを統合（重複を避けるため、friendsInitiatedのみ使用）
  // Friendshipは双方向で作成されているが、片方だけを取得すれば十分
  const friends = user.friendsInitiated.map((f: any) => f.friend)

  // 検索結果
  let searchResult: any = null
  if (search) {
    searchResult = await prisma.user.findUnique({
      where: { friendId: search },
      include: {
        gameAccounts: {
          include: {
            _count: {
              select: {
                ownedCharacters: true,
              },
            },
          },
        },
      },
    })

    // 自分自身は除外
    if (searchResult?.id === user.id) {
      searchResult = null
    }

    // 既にフレンドかチェック
    if (searchResult) {
      const srId = searchResult.id as string
      const isFriend = friends.some((f) => f.id === srId)
      if (isFriend) {
        searchResult = null
      }
    }

    // 既に申請済みかチェック
    if (searchResult) {
      const existingRequest = await prisma.friendRequest.findFirst({
        where: {
          OR: [
            { senderId: user.id, receiverId: searchResult.id },
            { senderId: searchResult.id, receiverId: user.id },
          ],
        },
      })
      if (existingRequest) {
        searchResult = null
      }
    }
  }

  // Server Action: フレンド申請送信
  async function sendFriendRequest(formData: FormData) {
    'use server'

    const receiverId = formData.get('receiverId') as string

    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }

    // 既存の申請をチェック
    const existingRequest = await prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: session.user.id, receiverId },
          { senderId: receiverId, receiverId: session.user.id },
        ],
      },
    })

    if (existingRequest) {
      throw new Error('既に申請が存在します')
    }

    await prisma.friendRequest.create({
      data: {
        senderId: session.user.id,
        receiverId,
      },
    })

    revalidatePath('/friends')
  }

  // Server Action: フレンド申請承認
  async function acceptFriendRequest(formData: FormData) {
    'use server'

    const requestId = formData.get('requestId') as string

    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }

    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    })

    if (!request || request.receiverId !== session.user.id) {
      throw new Error('Unauthorized')
    }

    // フレンド関係を作成
    await prisma.$transaction([
      prisma.friendship.create({
        data: {
          userId: request.senderId,
          friendId: request.receiverId,
        },
      }),
      prisma.friendship.create({
        data: {
          userId: request.receiverId,
          friendId: request.senderId,
        },
      }),
      prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: 'accepted' },
      }),
    ])

    revalidatePath('/friends')
  }

  // Server Action: フレンド申請拒否
  async function rejectFriendRequest(formData: FormData) {
    'use server'

    const requestId = formData.get('requestId') as string

    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }

    const request = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    })

    if (!request || request.receiverId !== session.user.id) {
      throw new Error('Unauthorized')
    }

    await prisma.friendRequest.update({
      where: { id: requestId },
      data: { status: 'rejected' },
    })

    revalidatePath('/friends')
  }

  // Server Action: フレンド削除
  async function removeFriend(formData: FormData) {
    'use server'

    const friendId = formData.get('friendId') as string

    if (!session?.user?.id) {
      throw new Error('Unauthorized')
    }

    await prisma.$transaction([
      prisma.friendship.deleteMany({
        where: {
          OR: [
            { userId: session.user.id, friendId },
            { userId: friendId, friendId: session.user.id },
          ],
        },
      }),
    ])

    revalidatePath('/friends')
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/accounts"
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-2"
        >
          ← アカウント一覧に戻る
        </Link>
      </div>

      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-6">フレンド</h1>

      {/* 自分のフレンドID */}
      <FriendIdDisplay friendId={user.friendId || user.id} />

      {/* フレンド検索 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
          フレンド検索
        </h2>
        <FriendSearchForm />
        
        {search && !searchResult && (
          <div className="mt-4 text-center text-gray-500 dark:text-gray-400">
            ユーザーが見つかりませんでした、または既にフレンド・申請済みです
          </div>
        )}

        {searchResult && (
          <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {searchResult.image && (
                  <img
                    src={searchResult.image}
                    alt={searchResult.name || ''}
                    className="w-12 h-12 rounded-full"
                  />
                )}
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {searchResult.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {searchResult?.gameAccounts?.reduce(
                      (sum: number, acc: any) => sum + (acc._count?.ownedCharacters || 0),
                      0
                    ) ?? 0}
                    体所持
                  </div>
                </div>
              </div>
              <SendFriendRequestButton
                receiverId={searchResult.id}
                onSend={sendFriendRequest}
              />
            </div>
          </div>
        )}
      </div>

      {/* 受信したフレンド申請 */}
      {user.receivedFriendRequests.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
            受信したフレンド申請
          </h2>
          <div className="space-y-3">
            {user.receivedFriendRequests.map((request) => (
              <FriendRequestCard
                key={request.id}
                request={request}
                onAccept={acceptFriendRequest}
                onReject={rejectFriendRequest}
              />
            ))}
          </div>
        </div>
      )}

      {/* 送信したフレンド申請 */}
      {user.sentFriendRequests.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
            送信したフレンド申請
          </h2>
          <div className="space-y-3">
            {user.sentFriendRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-3"
              >
                {request.receiver.image && (
                  <img
                    src={request.receiver.image}
                    alt={request.receiver.name || ''}
                    className="w-10 h-10 rounded-full"
                  />
                )}
                <div className="flex-1">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {request.receiver.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">申請中...</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* フレンドリスト */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
          フレンドリスト ({friends.length})
        </h2>
        {friends.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            まだフレンドがいません
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {friends.map((friend) => (
              <FriendCard
                key={friend.id}
                friend={friend}
                onRemove={removeFriend}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
