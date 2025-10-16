import Link from 'next/link'

export default function ResetPasswordPage() {
	return (
		<div className="max-w-2xl mx-auto px-4 py-12">
			<h1 className="text-2xl font-bold mb-4">パスワードのリセット</h1>
			<p className="text-gray-600 mb-6">
				パスワードリセット機能は現在提供されていません。パスワードをお忘れの場合は
				Googleログインをお試しいただくか、管理者にお問い合わせください。
			</p>
			<div className="flex gap-3">
				<Link
					href="/login"
					className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-medium"
				>
					ログインに戻る
				</Link>
			</div>
		</div>
	)
}

