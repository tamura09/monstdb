export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-20 w-20 border-b-4 border-blue-600 dark:border-blue-400 mb-6"></div>
        <p className="text-2xl text-gray-700 dark:text-gray-200 font-medium">読み込み中...</p>
      </div>
    </div>
  )
}
