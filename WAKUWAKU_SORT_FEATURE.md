# わくわくの実の自動ソート機能

## 実装内容

わくわくの実を追加または削除した時に、データベースの`displayOrder`に基づいて自動的にソートされるようにしました。

## 変更されたファイル

### `app/accounts/[id]/page.tsx`

#### 1. `addWakuwaku` 関数の改善

**Before（修正前）:**
```typescript
// わくわくの実を追加
await prisma.ownedCharacterWakuwaku.create({
  data: {
    ownedCharacterId,
    wakuwakuMasterId,
    slotNumber: nextSlotNumber,
  },
})

redirect(`/accounts/${params.id}`)
```

追加した順番でスロット番号が割り当てられていました。

**After（修正後）:**
```typescript
// わくわくの実を追加
await prisma.ownedCharacterWakuwaku.create({
  data: {
    ownedCharacterId,
    wakuwakuMasterId,
    slotNumber: nextSlotNumber,
  },
})

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

// スロット番号を振り直す
for (let i = 0; i < sortedSlots.length; i++) {
  await prisma.ownedCharacterWakuwaku.update({
    where: { id: sortedSlots[i].id },
    data: { slotNumber: i + 1 },
  })
}

redirect(`/accounts/${params.id}`)
```

追加後に`displayOrder`でソートし、スロット番号を振り直します。

#### 2. `deleteWakuwaku` 関数の改善

**Before（修正前）:**
```typescript
// 残りのスロット番号を詰める
const remainingSlots = await prisma.ownedCharacterWakuwaku.findMany({
  where: { ownedCharacterId: slot.ownedCharacterId },
  orderBy: { slotNumber: 'asc' },
})

// スロット番号を1,2,3に振り直す
for (let i = 0; i < remainingSlots.length; i++) {
  await prisma.ownedCharacterWakuwaku.update({
    where: { id: remainingSlots[i].id },
    data: { slotNumber: i + 1 },
  })
}
```

削除後、既存のスロット番号順で詰めていました。

**After（修正後）:**
```typescript
// 残りのスロットを取得してdisplayOrderでソート
const remainingSlots = await prisma.ownedCharacterWakuwaku.findMany({
  where: { ownedCharacterId: slot.ownedCharacterId },
  include: {
    wakuwakuMaster: true,
  },
})

// displayOrderでソート
const sortedSlots = remainingSlots.sort((a, b) => 
  a.wakuwakuMaster.displayOrder - b.wakuwakuMaster.displayOrder
)

// スロット番号を1,2,3に振り直す
for (let i = 0; i < sortedSlots.length; i++) {
  await prisma.ownedCharacterWakuwaku.update({
    where: { id: sortedSlots[i].id },
    data: { slotNumber: i + 1 },
  })
}
```

削除後、`displayOrder`でソートしてからスロット番号を振り直します。

## 動作説明

### わくわくの実の追加時

1. ユーザーがわくわくの実を選択して追加
2. データベースに新しいわくわくの実を登録
3. **そのキャラクターの全わくわくの実を取得**
4. **`wakuwakuMaster.displayOrder`でソート**
5. **スロット番号を1, 2, 3と振り直す**
6. ページをリダイレクトして表示を更新

### わくわくの実の削除時

1. ユーザーがわくわくの実を削除
2. データベースからわくわくの実を削除
3. **残りのわくわくの実を取得**
4. **`wakuwakuMaster.displayOrder`でソート**
5. **スロット番号を詰めて1, 2, 3と振り直す**
6. ページをリダイレクトして表示を更新

## ユーザーへのメリット

### Before（修正前）
- わくわくの実が追加した順番で表示される
- 例: 「獣神化」「熱き友撃」「速必殺」の順で追加すると、この順番で表示される
- ユーザーが意図した順番と異なる可能性がある

### After（修正後）
- わくわくの実が常にデータベースで定義された順番で表示される
- 追加・削除の順番に関係なく、一貫した順序で表示される
- 視覚的に分かりやすく、管理しやすい

## 例

### displayOrderの定義（データベース）
```
1. 速必殺
2. 熱き友撃
3. 獣神化
4. 同族加撃
...
```

### シナリオ1: わくわくの実を順不同で追加

**操作:**
1. 「獣神化」を追加
2. 「速必殺」を追加
3. 「熱き友撃」を追加

**結果（修正前）:**
```
1. 獣神化
2. 速必殺
3. 熱き友撃
```

**結果（修正後）:**
```
1. 速必殺
2. 熱き友撃
3. 獣神化
```

→ displayOrderに従って自動的にソートされる！

### シナリオ2: わくわくの実を削除

**初期状態:**
```
1. 速必殺
2. 熱き友撃
3. 獣神化
```

**操作:** 「熱き友撃」を削除

**結果（修正前）:**
```
1. 速必殺
2. 獣神化
```

**結果（修正後）:**
```
1. 速必殺
2. 獣神化
```

→ どちらも同じですが、内部的に`displayOrder`でソートしてから番号を振り直している

## 技術的な詳細

### ソートロジック

```typescript
const sortedSlots = allSlots.sort((a, b) => 
  a.wakuwakuMaster.displayOrder - b.wakuwakuMaster.displayOrder
)
```

- `displayOrder`の小さい順（昇順）でソート
- JavaScriptの`Array.sort()`を使用
- 数値の差分を返すことで安定したソート

### データベース構造

**WakuwakuMaster テーブル:**
- `id`: わくわくの実のID
- `name`: わくわくの実の名前
- `displayOrder`: 表示順序（整数）

**OwnedCharacterWakuwaku テーブル:**
- `id`: レコードID
- `ownedCharacterId`: 所持キャラクターID
- `wakuwakuMasterId`: わくわくの実マスターID
- `slotNumber`: スロット番号（1-3）

### パフォーマンス考慮

- わくわくの実の追加・削除は頻繁に行われる操作ではない
- 最大でも3個までなので、ソート処理は軽量
- データベースへの追加クエリ（UPDATE）は3回まで

## テスト方法

1. アカウント詳細ページ（`/accounts/{id}`）にアクセス
2. 任意のキャラクターにわくわくの実を追加
3. 異なるわくわくの実を追加順に関係なく追加
4. 表示が`displayOrder`の順番になっていることを確認
5. わくわくの実を削除
6. 残りのわくわくの実が正しい順序で表示されることを確認

## 今後の拡張案

1. **ドラッグ&ドロップでの順番変更**
   - ユーザーが手動で順番を変更できるようにする
   - カスタムソート順を保存する機能

2. **お気に入り順でのソート**
   - よく使うわくわくの実を上位に表示

3. **効果別グルーピング**
   - 攻撃系、防御系、サポート系などでグループ化

## 注意事項

- `displayOrder`が正しく設定されている必要があります
- 同じ`displayOrder`を持つわくわくの実がある場合、順序は不定です
- スロット番号は追加・削除のたびに振り直されるため、固定的な意味は持ちません

## まとめ

わくわくの実の表示順序が常に一貫性を持つようになり、ユーザー体験が向上しました。追加・削除の順番に関係なく、データベースで定義された論理的な順序で表示されます。
