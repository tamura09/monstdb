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
