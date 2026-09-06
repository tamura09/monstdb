- package-lock.json は node_modules ごとクリーンに再生成します(node_modules残存下での再生成はプラットフォーム別依存欠落を招くため)。

## ローカルデバッグ環境

- **リポジトリ直下の `.env` は本番のSupabase(pgBouncer経由)を指しているので、デバッグ・検証で絶対に使わないこと。** 必ずローカルPostgreSQLに別DBを作り、`.env.test` のようなファイルで接続先を切り替える(`.env.test` は `.gitignore` の `.env*` で除外済み)。
- ローカルPostgreSQLは Homebrew の `postgresql@17` を使う(`export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"`、`brew services start postgresql@17`)。検証用DBは `createdb <名前>` で都度作成し、終わったら `dropdb` で消す。
- スキーマ投入は `npx prisma db push --schema=prisma/schema.prisma` → `npm run seed`(`character_masters_export.json` から994キャラ・32わくわくを投入)。
- **Google OAuthはこの環境では使えないため、NextAuthのセッションをJWTとして直接生成してブラウザ/curlに注入する。**
  ```ts
  import { encode } from 'next-auth/jwt'
  const token = await encode({
    token: { id: 'test-admin', role: 'admin', sub: 'test-admin', name: 'admin', email: 'admin@example.com' },
    secret: process.env.NEXTAUTH_SECRET!, // .env.test のものと必ず一致させる
  })
  ```
  ブラウザなら `document.cookie = "next-auth.session-token=<token>; path=/"`、curlなら `-H "Cookie: next-auth.session-token=<token>"`。
- テスト用ユーザー(admin役1人以上・一般ユーザー複数)は `prisma.user.upsert` で固定IDを指定して作り、`gameAccount.createMany` で `accountNumber: 1〜4` の4アカウントを紐付ける(本番のログイン時自動作成ロジックと同じ形)。使い捨てスクリプトとして書き、コミットしないこと。
- **本番相当の挙動(特に `unstable_cache`/Data Cacheの挙動)を確認したい場合は `npm run dev` ではなく `npm run build && npm run start -- -p <port>` を使うこと。** devモードとはキャッシュの効き方が異なり、devで確認すると誤った結論になる。
- キャッシュが実際にDBへ問い合わせているか(ヒット/ミス)は、ソースを変更せずに `pg_stat_user_tables` の `seq_scan`/`idx_scan` の増分で確認できる(統計のフラッシュに数百ms遅延することがあるので、直後に0でも少し待って再確認すること)。
- `npm run build` はビルド時点のDBの状態をキャッシュに焼き付けることがあるため、**DBを作り直す/シードし直す場合は、それを終えてから `npm run build` すること。** 順序を間違えると古いDB状態がキャッシュされたまま検証してしまい、結果が食い違う。
- 他のClaude Codeサブエージェントが同じリポジトリで並行して worktree 作業をしていることがある。`npx eslint app components lib` のように対象を明示的に絞らずに `npm run lint`(`eslint .`)を実行すると、他のworktree内の `.next` ビルド成果物まで拾って無関係な大量エラーが出ることがある。
- `npm run build`/`next dev` は `tsconfig.json` を自動整形することがある。コミット前に `git diff tsconfig.json` を確認し、意図しない変更なら `git checkout -- tsconfig.json` で戻すこと。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
