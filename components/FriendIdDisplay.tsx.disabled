'use client'

type FriendIdDisplayProps = {
  friendId: string
}

export default function FriendIdDisplay({ friendId }: FriendIdDisplayProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(friendId)
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
      <div className="text-sm text-blue-800 font-medium mb-2">
        あなたのフレンドID
      </div>
      <div className="flex items-center gap-3">
        <code className="text-lg font-mono bg-white px-4 py-2 rounded border border-blue-300 flex-1">
          {friendId}
        </code>
        <button
          onClick={handleCopy}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium"
        >
          コピー
        </button>
      </div>
      <div className="text-xs text-blue-600 mt-2">
        このIDを友達に教えてフレンド申請してもらいましょう
      </div>
    </div>
  )
}
