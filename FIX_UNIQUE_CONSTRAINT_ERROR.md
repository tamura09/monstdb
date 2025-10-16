# Unique Constraint エラーの修正

## 発生したエラー

```
Unhandled Runtime Error

Error: 
Invalid `prisma.ownedCharacterWakuwaku.update()` invocation:

Unique constraint failed on the fields: (`ownedCharacterId`,`slotNumber`)
```

## 原因

わくわくの実のスロット番号を振り直す際に、以下のような問題が発生していました：

### 例
既存のスロット:
```
ID: 1, slotNumber: 1
ID: 2, slotNumber: 2
ID: 3, slotNumber: 3
```

ソート後の新しい順序:
```
ID: 3 → slotNumber: 1 にしたい
ID: 1 → slotNumber: 2 にしたい
ID: 2 → slotNumber: 3 にしたい
```

### 問題の発生
```
1. ID: 3 を slotNumber: 1 に更新しようとする
   → 既に ID: 1 が slotNumber: 1 を使用しているため、Unique制約違反！
```

データベースには `@@unique([ownedCharacterId, slotNumber])` という制約があり、同じキャラクターに対して同じスロット番号を持つレコードが複数存在できません。

## 解決策

スロット番号を2段階で更新する方法を採用しました：

### ステップ1: 一時的な値に変更
まず、すべてのスロット番号を一時的に大きな値（100以上）に設定して、既存の1-3の範囲から外します。

```typescript
// ステップ1: 衝突を避けるため、一時的に大きな値を設定
for (let i = 0; i < sortedSlots.length; i++) {
  await prisma.ownedCharacterWakuwaku.update({
    where: { id: sortedSlots[i].id },
    data: { slotNumber: 100 + i }, // 100, 101, 102
  })
}
```

### ステップ2: 正しい値に変更
次に、正しいスロット番号（1-3）に設定します。この時点では衝突しません。

```typescript
// ステップ2: 正しいスロット番号に設定
for (let i = 0; i < sortedSlots.length; i++) {
  await prisma.ownedCharacterWakuwaku.update({
    where: { id: sortedSlots[i].id },
    data: { slotNumber: i + 1 }, // 1, 2, 3
  })
}
```

## 修正されたコード

### `addWakuwaku` 関数

```typescript
// 追加後、displayOrderに基づいてソート
const allSlots = await prisma.ownedCharacterWakuwaku.findMany({
  where: { ownedCharacterId },
  include: {
    wakuwakuMaster: true,
  },
})

// displayOrderでソート
const sortedSlots = allSlots.sort((a, b) => 
  a.wakuwakuMaster.displayOrder - b.wakuwakuMaster.displayOrder
)

// スロット番号を振り直す（衝突を避けるため、まず一時的に大きな値を設定）
for (let i = 0; i < sortedSlots.length; i++) {
  await prisma.ownedCharacterWakuwaku.update({
    where: { id: sortedSlots[i].id },
    data: { slotNumber: 100 + i },
  })
}

// 正しいスロット番号に設定
for (let i = 0; i < sortedSlots.length; i++) {
  await prisma.ownedCharacterWakuwaku.update({
    where: { id: sortedSlots[i].id },
    data: { slotNumber: i + 1 },
  })
}
```

### `deleteWakuwaku` 関数

同様の2段階更新を実装しました。

## なぜこれで解決するのか

### Before（1段階更新）
```
既存: [1, 2, 3]
↓ 直接更新しようとする
目標: [2, 3, 1] (ID: 3 → 1, ID: 1 → 2, ID: 2 → 3)

❌ ID: 3 を 1 に更新 → エラー！（ID: 1が既に1を使用中）
```

### After（2段階更新）
```
既存: [1, 2, 3]
↓ ステップ1: 一時的な値に変更
一時: [100, 101, 102]
↓ ステップ2: 正しい値に変更
目標: [1, 2, 3] (ソート後の正しい順序)

✅ 衝突なし！
```

## パフォーマンスへの影響

- 更新クエリが2倍になる（各スロットにつき2回の更新）
- 最大でも3個のスロットなので、6回の更新クエリ
- わくわくの実の追加・削除は頻繁な操作ではないため、許容範囲内

## 代替案（検討したが採用しなかった方法）

### 1. トランザクションで一括削除→再作成
```typescript
await prisma.$transaction([
  // 全削除
  prisma.ownedCharacterWakuwaku.deleteMany({
    where: { ownedCharacterId }
  }),
  // 正しい順序で再作成
  ...sortedSlots.map((slot, i) => 
    prisma.ownedCharacterWakuwaku.create({
      data: { ...slot, slotNumber: i + 1 }
    })
  )
])
```

**問題点:**
- レコードIDが変わってしまう
- 外部キー参照がある場合に問題が発生する可能性
- より複雑

### 2. スロット番号を負の値にする
```typescript
// 一時的に負の値を使用
data: { slotNumber: -(i + 1) }
```

**問題点:**
- データベースのスキーマによっては負の値を許可しない可能性
- 意図しない副作用のリスク

## テスト方法

1. アカウント詳細ページでキャラクターにわくわくの実を追加
2. 異なるわくわくの実を複数追加
3. エラーが発生しないことを確認
4. displayOrderの順序で表示されることを確認
5. わくわくの実を削除
6. 残りのわくわくの実が正しくソートされることを確認

## まとめ

Unique制約による衝突を避けるため、スロット番号の更新を2段階で行うようにしました：
1. 一時的に大きな値（100以上）に設定
2. 正しいスロット番号（1-3）に設定

これにより、わくわくの実の追加・削除時に安全にソートできるようになりました。
