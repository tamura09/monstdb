# Claude によるPRレビュー

PR のレビューは2本のワークフローに分かれている。**自動マージするのは Renovate の
PR だけ**で、人間が作った PR はレビューを投稿するだけ。マージするかどうかは人間が決める。

| 対象 | ワークフロー | トリガー | 自動マージ |
| --- | --- | --- | --- |
| 人間の PR | [`pr-review.yml`](../../.github/workflows/pr-review.yml) → [tamura09/claude-pr-review](https://github.com/tamura09/claude-pr-review) | PR の作成・更新時 | しない |
| Renovate の PR | [`renovate-auto-review.yml`](../../.github/workflows/renovate-auto-review.yml) | 毎日 10:00 JST + 手動 | 条件を満たせばする |

分かれている理由は **CI の完了を待つ必要があるから**。ゲートは CI が全て成功して
いることを条件にするが、`pull_request` で走らせると CI はまだ動き出したところで、
判定できない。main 上の定期実行にして、結果が出揃った PR だけを見ている。

以前は Secrets の制約が理由だった。Dependabot が作成した PR の `pull_request`
イベントでは Actions Secrets を読めず、Claude の認証情報を渡せなかった。Renovate は
GitHub App ではなく PAT で動かしているので、作られるのは通常の PR で、この制約は無い。
そのため `pr-review.yml` の方も Renovate の PR で走ってしまう。Claude が二重に走るのを
避けるため、あちらは `renovate/` で始まるブランチをスキップしている。

以下は Renovate 側の詳細。

---

# Renovate 自動レビューBot

Renovate が作った PR を定期的に走査し、安全と判断できるものだけを自動マージする。

- ワークフロー: [`.github/workflows/renovate-auto-review.yml`](../../.github/workflows/renovate-auto-review.yml)
- ゲート: [`gate.mjs`](./gate.mjs)

## 仕組み

判断を2段構えにして、LLM の出力だけではマージが起きないようにしている。

1. **決定論的ゲート** (`gate.mjs collect`)
   OPEN な Renovate PR を全件評価し、次の条件を満たすものだけを候補にする。
   - 作成者がリポジトリの持ち主で、ブランチが `renovate/` で始まる
     (自前ホストの Renovate は PAT で動かしているので `renovate[bot]` にはならない)
   - CI が全て成功、コンフリクトなし
   - 変更ファイルが `package.json` / `package-lock.json` /
     `infra/.terraform.lock.hcl` / `.github/workflows/*.yml` のみ
   - メジャー更新・依存の追加/削除・`engines` の変更を含まない
     (`0.x` 系は minor 更新も破壊的変更として扱う)
   - `@types/node` のメジャーが `engines.node` と一致している
   - **`package-lock.json` 内のどのパッケージもメジャーが上がっていない。**
     `package.json` を変更しない PR (推移的依存だけの更新) では直接依存の範囲指定が
     変わらないため、manifest 側の検査だけでは素通りしてしまう。ロックファイルを
     独立に解析して塞いでいる
   - `lockfileVersion` が変わっていない
   - ワークフローの差分が `uses:` のバージョン更新のみで、メジャーが変わらない

2. **Claude によるレビュー**
   候補について、ゲートでは判定できない観点をレビューする。
   同一 PR 内のバージョン整合 (`@prisma/client` と `prisma` など)、
   推移的依存の影響範囲、リポジトリ固有の制約 (`CLAUDE.md`) との整合など。
   `verdicts.json` に `MERGE` / `HOLD` を書き出す。

   Claude にはネットワークも `gh` も渡さず、`Read` / `Grep` / `Glob` / `Write`
   だけを許可している。判断材料は `collect` が書き出したファイルとリポジトリ本体のみ。

3. **マージ直前の再検査** (`gate.mjs merge`)
   `MERGE` と判定された PR について、もう一度 1 のゲートを通してからマージする。
   先行するマージでベースが進んで状態が変わっていれば、そこで止まって次回に回る。

この構造なので、上流のリリースノート等を経由したプロンプトインジェクションで
Claude の判定が歪められても、ゲートの条件を満たさない PR はマージされない。

## セットアップ

### 1. Claude の OAuth トークンを発行する

ローカルで実行する。ブラウザが開いて認証したあと、トークンが1度だけ表示される。

```bash
claude setup-token
```

API キーではなく、Claude の Pro / Max サブスクリプションの枠を使う。

### 2. SSM に登録する

**このリポジトリの Secret には置かない。** トークンは AWS の SSM Parameter Store に
1本だけ置いてあり、両方のワークフローが OIDC で読む。

```bash
aws ssm put-parameter --region ap-northeast-1 \
  --name /claude-pr-review/oauth-token \
  --type SecureString --overwrite --value "$(pbpaste)"
```

`--region` を省くと CLI の既定リージョンに同名のパラメータが新しく作られて成功する
ので、必ず付けること。

読むのは `github-actions-claude-pr-review` ロール経由で、定義は
[tamura09/aws-terraform](https://github.com/tamura09/aws-terraform) の `base/iam.tf`。
このパラメータ1本の `ssm:GetParameter` と、SSM 経由に限定した `kms:Decrypt` しか
持っていない。ワークフロー側は `permissions` に `id-token: write` が要る。

トークンを再発行したときに更新するのはこのパラメータ1本だけで、使っている
リポジトリの数には依らない。

### 3. 動作確認

まず dry-run で判定だけ実行し、マージ対象と理由が妥当か確認する。

```bash
gh workflow run renovate-auto-review.yml -f dry_run=true
```

実行後、Actions のログと `renovate-auto-review` アーティファクト
(`renovate-facts.json` / `verdicts.json` / 差分) を確認する。

## ローカルでのデバッグ

```bash
export GITHUB_REPOSITORY=tamura09/monstdb

# 候補の収集結果を見る
node scripts/renovate-bot/gate.mjs collect /tmp/facts.json

# 1件だけ詳しく評価する
node scripts/renovate-bot/gate.mjs inspect 66

# 判定ファイルを渡してマージ経路を空実行する
DRY_RUN=true node scripts/renovate-bot/gate.mjs merge /tmp/verdicts.json
```

## 人間のPRのレビュー

[`pr-review.yml`](../../.github/workflows/pr-review.yml) が担当する。
他のリポジトリでも使い回せるよう、実体は再利用可能ワークフローとして
[tamura09/claude-pr-review](https://github.com/tamura09/claude-pr-review)
に切り出してあり、このリポジトリのファイルは呼び出すだけ。

PR の作成・更新・再オープン・draft解除で走り、次の観点でレビューを投稿する。

1. バグ・不具合 (ロジックの誤り、境界条件、非同期の競合、エラーハンドリング漏れ)
2. セキュリティ (認証・認可の抜け、シークレット混入、入力検証漏れ)
3. 設計・簡潔性 (重複、既存ユーティリティの再実装、不要な複雑さ)

結果は **PR のチェック一覧の `claude-review` 行**で一目で分かる。

- 指摘なし → 緑 / `指摘なし`
- 指摘あり → 赤 / `指摘 3件: <最も重いものの要約>`
- レビュー失敗 → 赤 / `レビューを完了できませんでした`

コメント本文の1行目も `**✅ 指摘なし**` / `**⚠️ 指摘 N件** — 要約` に固定してある。
指摘があっても PR を赤くしたくない場合は呼び出し側で `findings_state: success` にする。

`contents: read` しか与えていないため、Claude はコードを push できない。
既存ファイルの編集系ツールも `--disallowedTools` で落としてある
(判定ファイルの書き出しに `Write` だけ許可)。
draft の PR、fork からの PR、`renovate/` で始まるブランチの PR はスキップする。
Renovate の PR をスキップするのは、こちらでレビューすると
[`renovate-auto-review.yml`](../../.github/workflows/renovate-auto-review.yml) と
二重になるため。呼び出し側のジョブに `if:` を書いて止めている。

観点を変えたい場合やリポジトリ固有の指示を足したい場合は、呼び出し側に `with:` を
書く。入力の一覧は切り出し先の README を参照。

## 既知の制約

- **自動マージ後に main の CI は走らない。** `GITHUB_TOKEN` による push は
  他のワークフローをトリガーしないという GitHub の仕様による。PR 時点で CI は
  通っているが、main で改めて走らせたい場合は `contents: write` を持つ PAT を
  Secret に入れ、`merge` ステップの `GH_TOKEN` をそれに差し替える。
- **メジャー更新は常に人間が判断する。** ゲートで機械的に除外され、Claude には
  渡らない。PR にはコメントも付かないので、Renovate の PR 一覧を定期的に見ること。
- **OAuth トークンは失効する。** 失効するとワークフローが認証エラーで落ちるので、
  `claude setup-token` で再発行して SSM パラメータを上書きする。
- **消費するのはサブスクリプションの利用枠。** Renovate 側は候補が0件のときは
  Claude を呼ばない。人間の PR 側は push のたびに走るので (同じ PR への連続 push は
  `concurrency` で古い実行をキャンセルする)、利用枠の消費はこちらの方が大きい。
  どちらも `claude-sonnet-5` を使う。変更する場合、Renovate 側は `claude_args` の
  `--model`、人間の PR 側は呼び出し側の `with: model:` で指定する。
- **SSM にトークンを入れる前にこの2本を main に入れると、PR のチェックが赤くなる。**
  パラメータがプレースホルダのままだとその旨のエラーで落ちるため、投入を先に
  済ませること。
- **再利用可能ワークフローは `@v1` の可変タグで参照している。** 参照先で `v1` が
  指す内容が変わると、次の PR イベントで新しいコードが `pull-requests: write` /
  `issues: write` / `statuses: write` / `id-token: write` を持った状態で実行される。
  同一オーナーのリポジトリで、タグを書き換えられる相手はこのファイル自体も書き換え
  られるため許容しているが、厳密に固定したい場合はコミット SHA を指定する。
- **fork からの PR はスキップされる。** Secrets も id-token も渡されないため。外部
  から PR を受ける運用にする場合は `pull_request_target` への切り替えと権限の
  見直しが必要。
