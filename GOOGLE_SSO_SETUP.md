# Google SSO 設定手順

このドキュメントでは、Google SSOを有効にするための設定手順を説明します。

## 1. Google Cloud Console でOAuth 2.0 クライアントIDを作成

### 1.1 Google Cloud Console にアクセス
https://console.cloud.google.com/ にアクセスしてログインします。

### 1.2 プロジェクトを作成または選択
- 新しいプロジェクトを作成するか、既存のプロジェクトを選択します。

### 1.3 OAuth同意画面を設定
1. サイドバーから「APIとサービス」→「OAuth同意画面」を選択
2. ユーザータイプで「外部」を選択して「作成」をクリック
3. アプリ情報を入力:
   - **アプリ名**: Monster Strike 管理アプリ（任意の名前）
   - **ユーザーサポートメール**: あなたのメールアドレス
   - **デベロッパーの連絡先情報**: あなたのメールアドレス
4. 「保存して次へ」をクリック
5. スコープは設定不要なので「保存して次へ」をクリック
6. テストユーザーを追加（開発中は必要に応じて）
7. 「保存して次へ」をクリック

### 1.4 OAuth 2.0 クライアントIDを作成
1. サイドバーから「APIとサービス」→「認証情報」を選択
2. 「+ 認証情報を作成」をクリックし、「OAuth 2.0 クライアント ID」を選択
3. アプリケーションの種類で「ウェブアプリケーション」を選択
4. 名前を入力（例: Monster Strike Web Client）
5. **承認済みのリダイレクト URI** に以下を追加:
   - 開発環境: `http://localhost:3000/api/auth/callback/google`
   - 本番環境: `https://yourdomain.com/api/auth/callback/google`（デプロイ時）
6. 「作成」をクリック

### 1.5 クライアントIDとシークレットを取得
- 作成されたクライアントIDとクライアントシークレットが表示されます
- これらの値を安全な場所にコピーしておきます

## 2. 環境変数の設定

`.env` ファイルを開き、以下の値を更新します:

```env
# Google OAuth
GOOGLE_CLIENT_ID="あなたのクライアントID"
GOOGLE_CLIENT_SECRET="あなたのクライアントシークレット"
```

**重要**: `.env` ファイルは Git にコミットしないでください。機密情報が含まれています。

## 3. アプリケーションの起動

環境変数を設定したら、開発サーバーを再起動します:

```bash
npm run dev
```

## 4. Googleログインのテスト

1. ブラウザで `http://localhost:3000` にアクセス
2. ログインページで「Googleでログイン」ボタンをクリック
3. Googleアカウントでログイン
4. 初回ログイン時は、アプリケーションへのアクセス許可を求められるので「許可」をクリック
5. ログインに成功すると、アカウント一覧ページにリダイレクトされます

## 5. 管理者権限の設定

Google SSOでログインした新規ユーザーは、デフォルトで通常ユーザー（role = "user"）として登録されます。

管理者権限を付与するには、データベースを直接編集します:

```bash
# Prisma Studioを起動
npm run prisma:studio
```

1. `User` テーブルを開く
2. 対象のユーザーを選択
3. `role` フィールドを `"admin"` に変更
4. 保存

または、`psql`などでPostgreSQLを直接編集:

```sql
-- メールアドレスでユーザーを検索
SELECT id, name, email, role FROM "User" WHERE email = 'your-email@example.com';

-- 管理者権限を付与
UPDATE "User" SET role = 'admin' WHERE email = 'your-email@example.com';
```

## 6. トラブルシューティング

### ログインボタンをクリックしても反応しない
- ブラウザのコンソールでエラーを確認してください
- GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET が正しく設定されているか確認してください

### "redirect_uri_mismatch" エラーが出る
- Google Cloud Console で設定したリダイレクトURIと、アプリケーションのURLが一致しているか確認してください
- 開発環境では `http://localhost:3000/api/auth/callback/google` を使用します

### ログイン後にエラーが出る
- データベースが正しく設定されているか確認してください: `npx prisma db push`
- Prisma Clientが最新か確認してください: `npx prisma generate`

## 7. 本番環境へのデプロイ

本番環境にデプロイする際は、以下の手順を実行してください:

1. Google Cloud Console で本番環境のリダイレクトURIを追加
   - 例: `https://yourdomain.com/api/auth/callback/google`

2. 本番環境の環境変数に GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET を設定

3. NEXTAUTH_URL を本番環境のURLに設定
   ```env
   NEXTAUTH_URL=https://yourdomain.com
   ```

4. NEXTAUTH_SECRET を強力なランダム文字列に変更
   ```bash
   openssl rand -base64 32
   ```

## 参考リンク

- [NextAuth.js Google Provider](https://next-auth.js.org/providers/google)
- [Google OAuth 2.0 設定](https://developers.google.com/identity/protocols/oauth2)
- [Prisma Adapter for NextAuth](https://authjs.dev/reference/adapter/prisma)
