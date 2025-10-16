# フレンド機能実装ガイド

## 概要
ユーザー同士がフレンドになり、お互いの所持キャラクターとわくわくの実を閲覧できる機能を実装しました。

## 機能詳細

### 1. ユーザーID
- 新規登録時に自動でユニークなフレンドIDを生成
- このIDを友達に教えてフレンド検索に使用

### 2. フレンド申請
- フレンドIDで完全一致検索
- フレンド申請を送信
- 相手が承認するとフレンドになる

### 3. フレンド閲覧
- フレンドの所持キャラクター一覧を閲覧可能（Read Onlyモード）
- わくわくの実の情報も閲覧可能
- 編集・追加・削除はできない

## データベーススキーマ変更

### Userモデルに追加
```prisma
friendId      String    @unique @default(cuid()) // フレンド検索用ID
```

### 新規テーブル

#### FriendRequest (フレンド申請)
- id: 申請ID
- senderId: 送信者ID
- receiverId: 受信者ID
- status: ステータス (pending/accepted/rejected)
- createdAt, updatedAt

#### Friendship (フレンド関係)
- id: 関係ID
- userId: ユーザーID
- friendId: フレンドID
- createdAt

フレンド関係は双方向で作成されます（2レコード）

## マイグレーション実行手順

### 1. データベースマイグレーション
```bash
npx prisma migrate dev --name add_friend_features
```

### 2. 既存ユーザーへのfriendID付与
既存ユーザーにはfriendIdが付与されていないため、以下のスクリプトを実行:

```typescript
// scripts/add-friend-ids.ts
import { prisma } from '../lib/prisma'

async function main() {
  const users = await prisma.user.findMany({
    where: {
      friendId: null
    }
  })

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { friendId: cuid() }
    })
  }

  console.log(`Updated ${users.length} users with friendId`)
}

main()
```

または、Prisma Studioで手動更新:
```bash
npx prisma studio
```

## 実装ファイル

### ページ
- `/app/friends/page.tsx` - フレンドリスト・検索・申請管理
- `/app/friends/[friendId]/page.tsx` - フレンドの所持状況閲覧

### コンポーネント
- `/components/FriendSearchForm.tsx` - フレンド検索フォーム
- `/components/FriendRequestCard.tsx` - フレンド申請カード
- `/components/FriendCard.tsx` - フレンドカード
- `/components/CharacterTable.tsx` - readOnlyプロップ対応
- `/components/OwnedCharacterCard.tsx` - readOnlyプロップ対応
- `/components/WakuwakuFilter.tsx` - basePathプロップ対応

### Server Actions
- `sendFriendRequest` - フレンド申請送信
- `acceptFriendRequest` - フレンド申請承認
- `rejectFriendRequest` - フレンド申請拒否
- `removeFriend` - フレンド削除

## 使用方法

### 1. フレンドIDの確認
1. `/friends`ページにアクセス
2. 上部に表示されている自分のフレンドIDを確認
3. 「コピー」ボタンでクリップボードにコピー

### 2. フレンド追加
1. 友達からフレンドIDを教えてもらう
2. 「フレンド検索」欄にIDを入力して検索
3. ユーザーが見つかったら「フレンド申請」ボタンをクリック

### 3. フレンド申請の承認
1. `/friends`ページで「受信したフレンド申請」セクションを確認
2. 「承認」または「拒否」ボタンをクリック

### 4. フレンドの所持状況閲覧
1. フレンドリストから閲覧したいフレンドの「所持状況を見る」をクリック
2. Read Onlyモードで所持キャラクターとわくわくの実を閲覧
3. フィルター・検索機能も利用可能

## セキュリティ

- フレンド関係の確認を各ページで実施
- Server Actionで権限チェック
- 自分自身へのフレンド申請は不可
- 既存の申請・フレンド関係の重複チェック

## 今後の拡張可能性

- フレンド申請時のメッセージ機能
- フレンドのオンライン状態表示
- フレンドのアカウント更新通知
- フレンドグループ機能
- フレンド間のキャラクター交換メモ機能
