# 本番環境デプロイチェックリスト

## セキュリティ

- [ ] `NEXTAUTH_SECRET`を強力なランダム文字列に設定
- [ ] 本番用の`GOOGLE_CLIENT_ID`と`GOOGLE_CLIENT_SECRET`を設定
- [ ] `NEXTAUTH_URL`を本番ドメインに設定
- [ ] HTTPSを有効化
- [ ] データベースのバックアップ設定

## 環境変数

- [ ] `.env.production`ファイル作成
- [ ] 全ての必須環境変数を設定
- [ ] `.env`ファイルをGitに含めない（`.gitignore`確認）

## データベース

- [ ] `npx prisma migrate deploy`実行
- [ ] シードデータ投入（必要な場合）
- [ ] データベースファイルのバックアップ設定

## ビルド

- [ ] `npm ci`で依存関係をクリーンインストール
- [ ] `npx prisma generate`でPrisma Client生成
- [ ] `npm run build`でエラーなくビルド完了

## パフォーマンス

- [ ] 画像最適化設定
- [ ] キャッシュ設定
- [ ] CDN設定（静的アセット）

## モニタリング

- [ ] エラーログ設定
- [ ] アクセスログ設定
- [ ] パフォーマンス監視

## 起動

```bash
# 通常起動
npm start

# PM2使用（推奨）
pm2 start npm --name "monstdb" -- start
pm2 startup
pm2 save

# Docker使用
docker-compose up -d
```

## 環境変数テンプレート

```env
# データベース
DATABASE_URL="file:./prod.db"

# NextAuth
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Google OAuth
GOOGLE_CLIENT_ID="your-production-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-production-client-secret"
```

## トラブルシューティング

### ビルドエラー
```bash
rm -rf .next node_modules
npm ci
npx prisma generate
npm run build
```

### データベースエラー
```bash
npx prisma migrate deploy
npx prisma generate
```

### 権限エラー
```bash
chmod 755 .
chmod 644 prisma/prod.db
```

## GitHub Actionsでマイグレーションとシードを実行する

リポジトリに含めたワークフロー `.github/workflows/prisma-migrate-deploy.yml` を使うと、`main` ブランチへ push した際に CI 上でマイグレーションとシードを実行できます。

手順:
1. Supabase の「Direct DB connection（ポート5432）」の接続文字列をコピーします。
2. GitHub リポジトリの Settings → Secrets → Actions に `PROD_DATABASE_URL` として貼り付けます。
3. `main` に push すると workflow が起動し、`npx prisma migrate deploy` と `npx prisma db seed` が実行されます。

注意:
- CI では Direct 接続（5432）を使ってください。Pooler（pgBouncer）エンドポイントは DDL 操作で問題を起こす場合があります。
- Vercel のランタイム環境では接続プーラーを利用しても構いませんが、マイグレーションは CI 側で Direct を使って行うのが安全です。

## Vercel で pgBouncer を使う場合の設定

Supabase の pgBouncer（または接続プーラー）を使う場合、Prisma の prepared statement 衝突を防ぐため、**環境変数に `?pgbouncer=true` パラメータを追加**してください。

手順:
1. Vercel の Project Settings → Environment Variables
2. `DATABASE_URL` を編集し、末尾に `?pgbouncer=true` を追加
   ```
   例: postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres?pgbouncer=true
   ```
3. Production, Preview, Development すべての環境に適用
4. 再デプロイを実行

これにより Prisma が prepared statement を無効化し、pgBouncer との互換モードで動作します。エラー「prepared statement "sX" already exists (42P05)」が解消されます。

