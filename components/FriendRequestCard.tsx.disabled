'use client'

type FriendRequestCardProps = {
  request: {
    id: string
    sender: {
      id: string
      name: string | null
      image: string | null
    }
  }
  onAccept: (formData: FormData) => Promise<void>
  onReject: (formData: FormData) => Promise<void>
}

export default function FriendRequestCard({
  request,
  onAccept,
  onReject,
}: FriendRequestCardProps) {
  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
      <div className="flex items-center gap-3">
        {request.sender.image && (
          <img
            src={request.sender.image}
            alt={request.sender.name || ''}
            className="w-10 h-10 rounded-full"
          />
        )}
        <div>
          <div className="font-semibold text-gray-900">
            {request.sender.name}
          </div>
          <div className="text-sm text-gray-500">フレンド申請</div>
        </div>
      </div>
      <div className="flex gap-2">
        <form action={onAccept}>
          <input type="hidden" name="requestId" value={request.id} />
          <button
            type="submit"
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm font-medium"
          >
            承認
          </button>
        </form>
        <form action={onReject}>
          <input type="hidden" name="requestId" value={request.id} />
          <button
            type="submit"
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 text-sm font-medium"
          >
            拒否
          </button>
        </form>
      </div>
    </div>
  )
}
