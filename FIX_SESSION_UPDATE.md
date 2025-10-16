# ユーザー名変更時のヘッダー更新対応

## 問題

ユーザー名を変更した後、ヘッダー（ナビゲーションバー）に表示されているユーザー名が更新されない問題がありました。

### 原因

- サーバー側でデータベースのユーザー名は更新されていた
- しかし、NextAuthのセッション（JWT）は古い名前を保持したまま
- クライアント側のコンポーネント（Navigation）は古いセッション情報を表示し続けていた

## 解決策

### 1. クライアント側でセッション更新を実装

**新規作成**: `components/UpdateNameForm.tsx`

```typescript
// useSession()のupdate()メソッドを使用
const { update } = useSession()

// 名前変更後にセッションを更新
await update({
  name: name.trim(),
})
```

このコンポーネントは以下の機能を提供：
- フォームの送信処理
- Server Actionの実行
- セッションの即座更新
- 成功/エラーメッセージの表示
- ローディング状態の管理

### 2. NextAuth設定の更新

**変更**: `lib/auth.ts`

```typescript
callbacks: {
  async jwt({ token, user, account, trigger, session }) {
    // セッション更新時（クライアントからupdate()が呼ばれた時）
    if (trigger === 'update' && session) {
      if (session.name) {
        token.name = session.name
      }
    }
    // ...
  },
  async session({ session, token, user }) {
    // トークンから名前を取得（更新された場合はこちらが優先される）
    if (token.name) {
      session.user.name = token.name as string
    }
    // ...
  },
}
```

重要なポイント：
- `trigger === 'update'`: クライアント側から`update()`が呼ばれたときを検知
- JWTトークンに新しい名前を保存
- セッションコールバックでトークンから名前を取得

### 3. プロフィールページの更新

**変更**: `app/profile/page.tsx`

- 従来のServer Actionフォームから、クライアントコンポーネント`UpdateNameForm`に変更
- Server Actionはそのまま保持し、プロップスとして渡す

## 動作フロー

1. ユーザーがマイページで名前を変更して「保存」ボタンをクリック
2. `UpdateNameForm`がServer Action（`updateName`）を実行
3. データベースのユーザー名が更新される
4. クライアント側で`update({ name: newName })`を実行
5. NextAuthの`jwt`コールバックが`trigger === 'update'`を検知
6. JWTトークンに新しい名前を保存
7. セッションが更新され、新しい名前がトークンから取得される
8. `router.refresh()`でページをリフレッシュ
9. ヘッダーの`Navigation`コンポーネントが更新されたセッションを受け取る
10. ヘッダーに新しい名前が即座に表示される

## ユーザー体験の改善

### Before（修正前）
- 名前を変更しても、ヘッダーは古い名前のまま
- ページをリロードするまで変更が反映されない
- ユーザーが混乱する可能性

### After（修正後）
- 名前を変更すると、ヘッダーが即座に更新される
- 「表示名を更新しました」という成功メッセージが表示される
- ローディング状態が表示されるため、処理中であることが明確
- エラーが発生した場合も適切に表示される

## テスト方法

1. http://localhost:3000/profile にアクセス
2. 「表示名の変更」セクションで新しい名前を入力
3. 「保存」ボタンをクリック
4. ヘッダー（右上）のユーザー名が即座に更新されることを確認
5. 成功メッセージが表示されることを確認
6. 他のページに移動してもヘッダーの名前が更新されていることを確認

## 技術的な詳細

### NextAuth v4のセッション更新

NextAuth v4では、`useSession()`フックから`update()`メソッドを使用できます：

```typescript
const { data: session, update } = useSession()

// セッションを更新
await update({
  name: 'New Name',
  // 他のフィールドも更新可能
})
```

この機能により、ページ全体をリロードすることなく、クライアント側でセッション情報を更新できます。

### JWT戦略でのセッション管理

この実装では`session.strategy = 'jwt'`を使用しています。JWTトークンはクライアント側にCookieとして保存され、サーバーリクエストごとに送信されます。

`trigger`パラメータを使用することで、セッション更新のタイミングを検知し、適切にトークンを更新できます。

## その他の利点

この実装パターンは、他のユーザー情報の更新にも応用できます：
- プロフィール画像の変更
- メールアドレスの変更（要検証）
- 権限の変更（管理者が他のユーザーの権限を変更した場合など）

## 注意事項

- `update()`は非同期処理なので、必ず`await`を使用する
- Server Actionとセッション更新の順序が重要（まずDBを更新してから、セッションを更新）
- エラーハンドリングを適切に行う（DB更新が失敗した場合はセッション更新をスキップ）

## 参考リンク

- [NextAuth.js - Updating Session](https://next-auth.js.org/getting-started/client#updating-the-session)
- [NextAuth.js - JWT Callback](https://next-auth.js.org/configuration/callbacks#jwt-callback)
- [NextAuth.js - Session Callback](https://next-auth.js.org/configuration/callbacks#session-callback)
