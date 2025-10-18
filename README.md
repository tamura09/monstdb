# モンストDB

モンスターストライクのキャラクター所持状況とわくわくの実を管理するWebアプリケーション

## 機能

- ✅ 一人につき4アカウントまで管理可能
- ✅ 同じキャラを複数所持可能
- ✅ 各キャラにわくわくの実を最大3個装着可能
- ✅ アカウント間での所持状況を簡単に確認
- ✅ 新キャラの追加が容易（JSONファイルから自動インポート）
- ✅ 属性・種類でフィルタリング可能
- ✅ キャラクター名で検索可能

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **データベース**: SQLite (Prisma ORM)
- **スタイリング**: Tailwind CSS

## セットアップ

### 1. 依存関係のインストール

\`\`\`bash
npm install
\`\`\`

### 2. データベースのセットアップ

\`\`\`bash
# Prismaクライアントを生成
npx prisma generate

# データベーススキーマをプッシュ
npx prisma db push

# シードデータを投入（キャラクターマスターデータをインポート）
npm run seed
\`\`\`

### 3. 開発サーバーの起動

\`\`\`bash
npm run dev
\`\`\`

ブラウザで [http://localhost:3000](http://localhost:3000) を開いてください。

## データベース管理

### Prisma Studioでデータを確認

\`\`\`bash
npx prisma studio
\`\`\`

ブラウザで [http://localhost:5555](http://localhost:5555) を開いてデータベースの内容を確認できます。

### 新しいキャラクターの追加

1. `character_masters_export.json` にキャラクター情報を追加
   \`\`\`json
   {
     "indexNumber": 9999,
     "element": "火",
     "type": "限定",
     "monsterName": "新キャラ名"
   }
   \`\`\`

2. シードコマンドを再実行
   \`\`\`bash
   npm run seed
   \`\`\`

## プロジェクト構造

\`\`\`
monstdb/
├── app/                      # Next.js App Router
│   ├── page.tsx             # ホームページ
│   ├── layout.tsx           # レイアウト
│   ├── globals.css          # グローバルスタイル
│   ├── characters/          # キャラクター一覧
│   │   └── page.tsx
│   └── accounts/            # アカウント管理
│       └── page.tsx
├── lib/
│   └── prisma.ts            # Prismaクライアント
├── prisma/
│   ├── schema.prisma        # データベーススキーマ
│   └── seed.ts              # シードスクリプト
├── character_masters_export.json  # キャラクターマスターデータ
└── package.json
\`\`\`

## データベーススキーマ

### User
ユーザー情報を管理

### Account
各ユーザーが持つ4つのアカウント（1、2、3、4）

### CharacterMaster
全キャラクターのマスターデータ（JSONから取り込み）

### OwnedCharacter
アカウントごとの所持キャラクター（同キャラ複数所持可能）

### WakuwakuMaster
わくわくの実のマスターデータ

### OwnedCharacterWakuwaku
所持キャラクターに装着されたわくわくの実（1キャラにつき最大3個）

## 今後の拡張予定

- [ ] ユーザー登録・ログイン機能
- [ ] キャラクターの詳細情報表示
- [ ] わくわくの実の装着・変更機能
- [ ] アカウント間の所持状況比較機能
- [ ] キャラクターの所持/未所持の一括確認
- [ ] データのエクスポート機能


npm run add-characters