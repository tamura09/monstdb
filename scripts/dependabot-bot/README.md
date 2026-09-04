# Claude によるPRレビュー

PR のレビューは2本のワークフローに分かれている。**自動マージするのは Dependabot の
PR だけ**で、人間が作った PR はレビューを投稿するだけ。マージするかどうかは人間が決める。

| 対象 | ワークフロー | トリガー | 自動マージ |
| --- | --- | --- | --- |
| 人間の PR | [`pr-review.yml`](../../.github/workflows/pr-review.yml) → [tamura09/claude-pr-review](https://github.com/tamura09/claude-pr-review) | PR の作成・更新時 | しない |
| Dependabot の PR | [`dependabot-auto-review.yml`](../../.github/workflows/dependabot-auto-review.yml) | 毎日 10:00 JST + 手動 | 条件を満たせばする |

分かれている理由は Secrets の制約。**Dependabot が作成した PR の `pull_request`
イベントで走るワークフローは、リポジトリの Actions Secrets を読めない**ため、
Claude の認証情報を渡せない。そのため Dependabot の分だけ main 上での定期実行にしている。
人間の PR (同一リポジトリのブランチ) は `pull_request` で Secrets を読めるので、
PR を作った時点で即レビューが走る。

以下は Dependabot 側の詳細。

---

# Dependabot 自動レビューBot

Dependabot が作った PR を定期的に走査し、安全と判断できるものだけを自動マージする。

- ワークフロー: [`.github/workflows/dependabot-auto-review.yml`](../../.github/workflows/dependabot-auto-review.yml)
- ゲート: [`gate.mjs`](./gate.mjs)

## 仕組み

判断を2段構えにして、LLM の出力だけではマージが起きないようにしている。

1. **決定論的ゲート** (`gate.mjs collect`)
   OPEN な Dependabot PR を全件評価し、次の条件を満たすものだけを候補にする。
   - 作成者が `dependabot[bot]`
   - CI が全て成功、コンフリクトなし
   - 変更ファイルが `package.json` / `package-lock.json` /
     `infra/.terraform.lock.hcl` / `.github/workflows/*.yml` のみ
   - メジャー更新・依存の追加/削除・`engines` の変更を含まない
     (`0.x` 系は minor 更新も破壊的変更として扱う)
   - `@types/node` のメジャーが `engines.node` と一致している
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

### 2. リポジトリの Secret に登録する

**トークンは自分で登録すること。** GitHub の
Settings > Secrets and variables > Actions > New repository secret から、
名前を `CLAUDE_CODE_OAUTH_TOKEN` として値を貼り付ける。

Dependabot Secrets ではなく **Actions Secrets** に入れる。このワークフローは
`pull_request` ではなく `schedule` で main 上から走るため、通常の Actions Secrets を読む。

このトークンは両方のワークフローが使う。

### 3. 動作確認

まず dry-run で判定だけ実行し、マージ対象と理由が妥当か確認する。

```bash
gh workflow run dependabot-auto-review.yml -f dry_run=true
```

実行後、Actions のログと `dependabot-auto-review` アーティファクト
(`dependabot-facts.json` / `verdicts.json` / 差分) を確認する。

## ローカルでのデバッグ

```bash
export GITHUB_REPOSITORY=tamura09/monstdb

# 候補の収集結果を見る
node scripts/dependabot-bot/gate.mjs collect /tmp/facts.json

# 1件だけ詳しく評価する
node scripts/dependabot-bot/gate.mjs inspect 66

# 判定ファイルを渡してマージ経路を空実行する
DRY_RUN=true node scripts/dependabot-bot/gate.mjs merge /tmp/verdicts.json
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

`contents: read` しか与えていないため、Claude はコードを push できない。
編集系ツールも `--disallowedTools` で落としてある。
draft の PR、fork からの PR、Dependabot の PR はスキップする。

観点を変えたい場合やリポジトリ固有の指示を足したい場合は、呼び出し側に `with:` を
書く。入力の一覧は切り出し先の README を参照。

## 既知の制約

- **自動マージ後に main の CI は走らない。** `GITHUB_TOKEN` による push は
  他のワークフローをトリガーしないという GitHub の仕様による。PR 時点で CI は
  通っているが、main で改めて走らせたい場合は `contents: write` を持つ PAT を
  Secret に入れ、`merge` ステップの `GH_TOKEN` をそれに差し替える。
- **メジャー更新は常に人間が判断する。** ゲートで機械的に除外され、Claude には
  渡らない。PR にはコメントも付かないので、Dependabot の PR 一覧を定期的に見ること。
- **OAuth トークンは失効する。** 失効するとワークフローが認証エラーで落ちるので、
  `claude setup-token` で再発行して Secret を更新する。
- **消費するのはサブスクリプションの利用枠。** Dependabot 側は候補が0件のときは
  Claude を呼ばない。人間の PR 側は push のたびに走るので (同じ PR への連続 push は
  `concurrency` で古い実行をキャンセルする)、利用枠の消費はこちらの方が大きい。
  モデルを固定したい場合は `claude_args` に `--model` を追加する。
- **Secret を登録する前にこの2本を main に入れると、PR のチェックが赤くなる。**
  `CLAUDE_CODE_OAUTH_TOKEN` が無い状態で `pr-review.yml` が走ると認証エラーで
  落ちるため、Secret の登録を先に済ませること。
- **fork からの PR はスキップされる。** Secrets を読めないため。外部から PR を
  受ける運用にする場合は `pull_request_target` への切り替えと権限の見直しが必要。
