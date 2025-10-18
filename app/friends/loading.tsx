export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
        <p className="text-xl text-gray-700 font-medium">読み込み中...</p>
        <p className="text-sm text-gray-500 mt-2">フレンド情報を取得しています</p>
      </div>
    </div>
  )
}
