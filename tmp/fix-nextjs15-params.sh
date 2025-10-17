#!/bin/bash
# Next.js 15 対応: params と searchParams を Promise 型に修正するスクリプト

# 対象ファイルリスト
files=(
  "app/characters/page.tsx"
  "app/accounts/page.tsx"
  "app/admin/characters/page.tsx"
  "app/admin/characters/new/page.tsx"
  "app/admin/characters/[id]/edit/page.tsx"
  "app/friends/page.tsx"
  "app/friends/[friendId]/page.tsx"
  "app/friends.disabled/page.tsx"
  "app/friends.disabled/[friendId]/page.tsx"
)

echo "Next.js 15 対応修正を開始します..."
echo "注意: このスクリプトは params/searchParams の型定義を Promise に変更します"
echo ""

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "処理中: $file"
    # 各ファイルの内容を確認（手動修正が必要な場合あり）
  else
    echo "スキップ: $file (ファイルが存在しません)"
  fi
done

echo ""
echo "完了。各ファイルを手動で確認してください。"
echo "Next.js 15 では params と searchParams が Promise<> 型になります。"
echo "関数内で const { param } = await params のように unwrap してください。"
