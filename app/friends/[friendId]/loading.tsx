export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 dark:border-blue-400 mb-4"></div>
        <p className="text-xl text-gray-700 dark:text-gray-200 font-medium">読み込み中...</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">フレンドの所持状況を取得しています</p>
      </div>
    </div>
  )
}
