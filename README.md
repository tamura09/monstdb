# モンストDB

モンスターストライクのキャラクター所持状況とわくわくの実を管理するWebアプリケーション

## 機能

- Googleアカウントでのログイン(Google SSOのみ)
- 一人につき4つのゲームアカウントまで管理可能
- 同じキャラを複数所持可能
- 各キャラにわくわくの実を最大3個装着可能
- アカウント間での所持状況を簡単に確認
- 属性・種類でのフィルタリング、キャラクター名での検索
- フレンド機能(フレンドIDで検索・申請し、お互いの所持状況をRead Onlyで閲覧)
- 新キャラの一括インポート・CSVエクスポート/インポート
- 管理者による キャラクターマスターの追加・編集(`/admin/characters`)

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **言語**: TypeScript
- **データベース**: PostgreSQL (Prisma ORM)
- **認証**: NextAuth.js (Google OAuth)
- **スタイリング**: Tailwind CSS
- **ホスティング**: Vercel(プロジェクト設定は[infra/](infra/)でTerraform管理)

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env.example`を`.env`にコピーして値を埋めてください。

```bash
cp .env.example .env
```

| 変数名 | 説明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL接続文字列(アプリ実行時に使用) |
| `DIRECT_URL` | PostgreSQL直接接続文字列(マイグレーション実行時に使用。pgBouncer等のコネクションプーラー経由でない接続) |
| `NEXTAUTH_URL` | アプリのベースURL(開発時は`http://localhost:3000`) |
| `NEXTAUTH_SECRET` | NextAuthのセッション暗号化用シークレット(`openssl rand -base64 32`で生成) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuthクライアント情報。取得手順は[GOOGLE_SSO_SETUP.md](GOOGLE_SSO_SETUP.md)参照 |

### 3. データベースのセットアップ

```bash
# Prismaクライアントを生成
npm run prisma:generate

# データベーススキーマをプッシュ
npm run prisma:push

# シードデータを投入(キャラクターマスターデータをインポート)
npm run seed
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## スクリプト

| コマンド | 説明 |
| --- | --- |
| `npm run dev` | 開発サーバー起動 |
| `npm run build` / `npm run start` | 本番ビルド / 起動 |
| `npm run lint` | ESLint実行 |
| `npm run prisma:generate` | Prisma Client生成 |
| `npm run prisma:push` | スキーマをDBへ反映(マイグレーションファイルを作らない) |
| `npm run prisma:studio` | Prisma StudioでDBの中身を確認 |
| `npm run seed` | `character_masters_export.json`からキャラクターマスターを投入 |
| `npm run add-characters` | 新キャラクターの追加を取り込み |
| `npm run fix-wakuwaku-order` | わくわくの実の表示順を修正 |
| `npm run export-csv -- <accountId>` | 指定アカウントの所持状況をCSVエクスポート |
| `npm run import-csv -- <csvPath> <accountId> [replace]` | CSVから所持状況をインポート |

### 新しいキャラクターの追加

1. `character_masters_export.json`にキャラクター情報を追加
   ```json
   {
     "indexNumber": 9999,
     "element": "火",
     "type": "限定",
     "monsterName": "新キャラ名"
   }
   ```
2. `npm run seed`を再実行

## プロジェクト構造

```
monstdb/
├── app/                      # Next.js App Router
│   ├── page.tsx              # トップページ
│   ├── login/                # ログイン
│   ├── accounts/              # ゲームアカウント別の所持状況
│   ├── characters/            # キャラクター一覧
│   ├── friends/               # フレンド機能
│   ├── profile/                # プロフィール
│   ├── admin/                  # キャラクターマスター管理(管理者)
│   └── api/                    # Route Handlers (auth/register/import/export等)
├── components/                # Reactコンポーネント
├── lib/                       # Prismaクライアント・認証設定など
├── prisma/
│   ├── schema.prisma          # データベーススキーマ
│   └── seed.ts                # シードスクリプト
├── scripts/                   # 運用スクリプト(CSV入出力など)
├── infra/                     # Vercelプロジェクト設定のTerraform構成
├── docs/                      # APIドキュメント(api-v1.md, openapi.yaml)
├── character_masters_export.json  # キャラクターマスターデータ
└── package.json
```

## データベーススキーマ

- **User**: ユーザー情報(NextAuth管理下)。フレンド検索用の`friendId`を持つ
- **Account / Session / VerificationToken**: NextAuth(Prisma Adapter)標準テーブル
- **GameAccount**: 各ユーザーが持つゲーム内アカウント(最大4つ)
- **CharacterMaster**: 全キャラクターのマスターデータ(JSONから取り込み)
- **OwnedCharacter**: アカウントごとの所持キャラクター(同キャラ複数所持可能)
- **WakuwakuMaster**: わくわくの実のマスターデータ
- **OwnedCharacterWakuwaku**: 所持キャラクターに装着されたわくわくの実(1キャラにつき最大3個)
- **FriendRequest / Friendship**: フレンド申請・フレンド関係

## API

`/api/v1/...` 配下に、キャラクターマスター・所持キャラクター・わくわくの実の装着状態をJSONベースのRESTインターフェースで操作できるAPIがあります。認証はNextAuth.jsのセッションクッキーを使用し、ブラウザから同一オリジンで呼び出す前提です。エンドポイント一覧・エラー仕様・リクエスト/レスポンス例などの詳細は[docs/api-v1.md](docs/api-v1.md)を、機械可読なOpenAPI 3.1仕様は[docs/openapi.yaml](docs/openapi.yaml)を参照してください。

既存の`/api/register` `/api/import/*` `/api/export/*` `/api/admin/characters`は、後方互換のため引き続きそのまま提供されています。

## デプロイ

VercelのGit連携により`main`ブランチへのマージで自動デプロイされます。プロジェクト設定(ビルドコマンド・Git連携など)は[infra/](infra/)のTerraformで管理しているため、Vercelダッシュボードを直接変更せず`infra/main.tf`をPR経由で変更してください。

DBマイグレーション(`prisma migrate deploy`)を手動で実行する場合は、`DIRECT_URL`(pgBouncer等のプーラーを経由しない接続)を使用してください。ランタイム側の`DATABASE_URL`でコネクションプーラーを使う場合は、`?pgbouncer=true`をクエリパラメータに追加するとPrismaのprepared statementの衝突(`prepared statement "sX" already exists`)を回避できます。
