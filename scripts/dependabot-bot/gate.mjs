#!/usr/bin/env node
/**
 * Dependabot 自動レビューBotの決定論的ゲート。
 *
 * Claudeに判断させる前段で、機械的に判定できる条件をここで弾く。
 * Claudeの出力（LLMの判断）だけでマージが決まらないようにするのが目的で、
 * PR本文に含まれる上流のリリースノート等でプロンプトインジェクションを
 * 受けても、ここの条件を満たさないPRは絶対にマージされない。
 *
 * 依存パッケージを増やさないために Node の標準モジュールと gh CLI だけで書く
 * (ワークフロー側で npm install を走らせずに済ませるため)。
 *
 * サブコマンド:
 *   collect <出力先.json>            候補PRを収集し、事実を JSON にまとめる
 *   merge   <verdicts.json>          Claudeの判定を読み、ゲートを再検査してマージ
 *   inspect <PR番号>                 1件だけ評価結果を表示する (デバッグ用)
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const MAX_BUFFER = 64 * 1024 * 1024;

/** 自動マージを許可する変更ファイル。これ以外が1つでも含まれたら候補から外す。 */
const ALLOWED_PATHS = [
  /^package\.json$/,
  /^package-lock\.json$/,
  /^infra\/\.terraform\.lock\.hcl$/,
  /^\.github\/workflows\/[^/]+\.ya?ml$/,
];

/**
 * メジャーバージョンがNodeランタイムに追従しなければならないパッケージ。
 * package.json の engines.node と major がズレたら自動マージしない。
 */
const RUNTIME_PINNED = ["@types/node"];

const DEP_FIELDS = ["dependencies", "devDependencies", "optionalDependencies"];

function gh(args, { json = true } = {}) {
  const out = execFileSync("gh", args, {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
  });
  return json ? JSON.parse(out) : out;
}

/**
 * 指定のcommit-ishにあるファイル内容を取得する。存在しなければ null。
 * package-lock.json は数百KBあり、contents API の base64 応答には
 * サイズ上限があるため raw で取る。
 */
function fileAtRef(path, ref) {
  try {
    return gh(
      [
        "api",
        `repos/${process.env.GITHUB_REPOSITORY}/contents/${path}?ref=${ref}`,
        "-H",
        "Accept: application/vnd.github.raw",
      ],
      { json: false },
    );
  } catch {
    return null;
  }
}

/**
 * バージョン範囲から「破壊的変更の境界」を表すキーを作る。
 * npm の caret の意味に合わせ、0.x は minor が上がると破壊的変更とみなす。
 * 解釈できない指定 (git/file/workspace など) は null を返し、手動レビュー扱いにする。
 */
function compatKey(range) {
  const text = String(range ?? "");
  if (/^(git|file|link|workspace|npm|https?):/i.test(text)) return null;
  const m = text.match(/(\d+)(?:\.(\d+|x|\*))?/);
  if (!m) return null;
  const major = Number(m[1]);
  if (major > 0) return String(major);
  const minor = m[2] && /^\d+$/.test(m[2]) ? m[2] : "0";
  return `0.${minor}`;
}

function majorOf(range) {
  const m = String(range ?? "").match(/(\d+)/);
  return m ? Number(m[1]) : null;
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** package.json の差分を解析し、メジャー更新・engines変更・ランタイム不整合を検出する。 */
function analyzeManifest(pr) {
  const result = {
    checked: false,
    majorBumps: [],
    compatibleBumps: [],
    enginesChanged: false,
    runtimeMismatch: [],
    unparsable: [],
  };

  const touchesManifest = pr.files.some((f) => f.path === "package.json");
  if (!touchesManifest) return result;

  const baseRaw = fileAtRef("package.json", pr.baseRefOid);
  const headRaw = fileAtRef("package.json", pr.headRefOid);
  const base = baseRaw && parseJsonSafe(baseRaw);
  const head = headRaw && parseJsonSafe(headRaw);
  if (!base || !head) {
    result.unparsable.push("package.json を base/head のどちらかで取得できなかった");
    return result;
  }
  result.checked = true;

  if (JSON.stringify(base.engines ?? null) !== JSON.stringify(head.engines ?? null)) {
    result.enginesChanged = true;
  }

  for (const field of DEP_FIELDS) {
    const b = base[field] ?? {};
    const h = head[field] ?? {};
    for (const name of Object.keys(h)) {
      const before = b[name];
      const after = h[name];
      if (before === undefined) {
        result.majorBumps.push({ field, name, before: null, after, reason: "新規追加" });
        continue;
      }
      if (before === after) continue;
      const kb = compatKey(before);
      const ka = compatKey(after);
      if (kb === null || ka === null) {
        result.unparsable.push(`${field}.${name}: ${before} -> ${after}`);
        continue;
      }
      if (kb !== ka) {
        result.majorBumps.push({ field, name, before, after, reason: "メジャー更新" });
      } else {
        result.compatibleBumps.push({ field, name, before, after });
      }
    }
    for (const name of Object.keys(b)) {
      if (h[name] === undefined) {
        result.majorBumps.push({
          field,
          name,
          before: b[name],
          after: null,
          reason: "削除",
        });
      }
    }
  }

  // ランタイム追従が必要なパッケージのメジャーが engines.node とズレていないか
  const enginesNodeMajor = majorOf(head.engines?.node);
  if (enginesNodeMajor !== null) {
    for (const name of RUNTIME_PINNED) {
      const bumped = [...result.majorBumps, ...result.compatibleBumps].some(
        (d) => d.name === name,
      );
      if (!bumped) continue;
      for (const field of DEP_FIELDS) {
        const range = head[field]?.[name];
        if (range === undefined) continue;
        const pkgMajor = majorOf(range);
        if (pkgMajor !== null && pkgMajor !== enginesNodeMajor) {
          result.runtimeMismatch.push(
            `${name}@${range} が engines.node="${head.engines.node}" と major 不一致`,
          );
        }
      }
    }
  }

  return result;
}

/** Claudeに渡す差分。package-lock.json はバージョン行だけに絞って量を抑える。 */
const DIFF_DIR = ".dependabot-bot";
const LOCK_DIFF_MAX_LINES = 400;

function curatedDiff(number) {
  const diff = gh(["pr", "diff", String(number)], { json: false });
  const out = [];
  let currentFile = null;
  let lockLines = 0;
  let lockTruncated = false;

  for (const line of diff.split("\n")) {
    const header = line.match(/^diff --git a\/(\S+) b\/(\S+)/);
    if (header) {
      currentFile = header[2];
      out.push("", `--- ${currentFile} ---`);
      continue;
    }
    if (currentFile === "package-lock.json") {
      if (!/^[+-]/.test(line) || /^(--- |\+\+\+ )/.test(line)) continue;
      if (!/"(version|resolved|license|deprecated)"|node_modules\//.test(line)) continue;
      if (lockLines >= LOCK_DIFF_MAX_LINES) {
        lockTruncated = true;
        continue;
      }
      lockLines += 1;
      out.push(line);
      continue;
    }
    if (/^(index |diff )/.test(line)) continue;
    out.push(line);
  }
  if (lockTruncated) {
    out.push(
      "",
      `(package-lock.json の差分は ${LOCK_DIFF_MAX_LINES} 行で打ち切り。全量は gh pr diff ${number} で確認できる)`,
    );
  }
  return out.join("\n");
}

/**
 * package-lock.json の差分を解析する。
 *
 * package.json が変わらない (＝直接依存の範囲指定はそのままの) PR でも、
 * 推移的依存のメジャーが上がることがある。analyzeManifest は package.json を
 * 見ていないためこれを検出できないので、ロックファイル側でも独立に確認する。
 */
function analyzeLockfile(pr) {
  const result = { checked: false, majorBumps: [], problems: [] };
  if (!pr.files.some((f) => f.path === "package-lock.json")) return result;

  const base = parseJsonSafe(fileAtRef("package-lock.json", pr.baseRefOid) ?? "");
  const head = parseJsonSafe(fileAtRef("package-lock.json", pr.headRefOid) ?? "");
  if (!base || !head) {
    result.problems.push("package-lock.json を base/head のどちらかで取得できなかった");
    return result;
  }
  result.checked = true;

  if (base.lockfileVersion !== head.lockfileVersion) {
    result.problems.push(
      `lockfileVersion が ${base.lockfileVersion} から ${head.lockfileVersion} に変わっている`,
    );
  }

  const basePkgs = base.packages ?? {};
  const headPkgs = head.packages ?? {};
  for (const [path, entry] of Object.entries(headPkgs)) {
    // "" はプロジェクト自身。依存の追加・削除は許容する (メジャー更新のみを見る)。
    if (path === "") continue;
    const before = basePkgs[path]?.version;
    const after = entry.version;
    if (before === undefined || after === undefined || before === after) continue;
    const kb = compatKey(before);
    const ka = compatKey(after);
    if (kb === null || ka === null) {
      result.problems.push(`${path}: ${before} -> ${after} を解釈できない`);
      continue;
    }
    if (kb !== ka) {
      result.majorBumps.push({
        name: path.replace(/^node_modules\//, ""),
        before,
        after,
      });
    }
  }

  return result;
}

/**
 * ワークフローファイルの差分が `uses:` のバージョン更新だけか、
 * かつメジャーが変わっていないかを確認する。
 */
function analyzeWorkflows(pr) {
  const result = { checked: false, problems: [] };
  const files = pr.files.filter((f) => /^\.github\/workflows\//.test(f.path));
  if (files.length === 0) return result;
  result.checked = true;

  const diff = gh(["pr", "diff", String(pr.number)], { json: false });
  let inWorkflow = false;
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      inWorkflow = /\sb\/\.github\/workflows\//.test(line);
      continue;
    }
    if (!inWorkflow) continue;
    if (/^(index |--- |\+\+\+ |@@ )/.test(line)) continue;
    if (!/^[+-]/.test(line)) continue;

    const body = line.slice(1).trim();
    const m = body.match(/^-?\s*uses:\s*(\S+)/);
    if (!m) {
      result.problems.push(`uses: 以外の行が変更されている: ${line.trim()}`);
      continue;
    }
    const ref = m[1].split("@")[1];
    if (!ref || !/^v?\d/.test(ref)) {
      result.problems.push(`バージョンタグとして解釈できない参照: ${m[1]}`);
    }
  }

  // メジャーが変わる action 更新は自動マージしない
  const usesBefore = new Map();
  const usesAfter = new Map();
  inWorkflow = false;
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      inWorkflow = /\sb\/\.github\/workflows\//.test(line);
      continue;
    }
    if (!inWorkflow || !/^[+-]/.test(line) || /^(--- |\+\+\+ )/.test(line)) continue;
    const m = line.slice(1).match(/uses:\s*([^@\s]+)@(\S+)/);
    if (!m) continue;
    (line[0] === "-" ? usesBefore : usesAfter).set(m[1], m[2]);
  }
  for (const [action, after] of usesAfter) {
    const before = usesBefore.get(action);
    if (before === undefined) continue;
    if (compatKey(before) !== compatKey(after)) {
      result.problems.push(`${action}: ${before} -> ${after} はメジャー更新`);
    }
  }

  return result;
}

/** CIチェックの集計。pending が残っていれば ready にしない。 */
function summarizeChecks(pr) {
  const rollup = pr.statusCheckRollup ?? [];
  const checks = rollup.map((c) => ({
    name: c.name ?? c.context ?? "(unnamed)",
    status: c.status ?? c.state ?? null,
    conclusion: c.conclusion ?? c.state ?? null,
  }));
  const pending = checks.filter(
    (c) =>
      ["QUEUED", "IN_PROGRESS", "PENDING", "WAITING", "REQUESTED"].includes(c.status) ||
      c.conclusion === null,
  );
  const failed = checks.filter(
    (c) =>
      c.conclusion !== null &&
      !["SUCCESS", "NEUTRAL", "SKIPPED"].includes(c.conclusion),
  );
  return { checks, pending, failed };
}

const PR_FIELDS = [
  "number",
  "title",
  "body",
  "author",
  "headRefName",
  "baseRefOid",
  "headRefOid",
  "mergeable",
  "mergeStateStatus",
  "files",
  "statusCheckRollup",
  "url",
].join(",");

/** 1件のPRを評価する。state は ready / pending / blocked のいずれか。 */
function evaluate(number) {
  // マージ可能性はGitHub側が非同期に計算するため、UNKNOWN なら少し待って取り直す。
  let pr = gh(["pr", "view", String(number), "--json", PR_FIELDS]);
  for (let i = 0; pr.mergeable === "UNKNOWN" && i < 3; i += 1) {
    execFileSync("sleep", ["3"]);
    pr = gh(["pr", "view", String(number), "--json", PR_FIELDS]);
  }

  const blockers = [];
  const notes = [];

  if (!pr.author?.is_bot || pr.author.login !== "app/dependabot") {
    blockers.push(`作成者が Dependabot ではない (${pr.author?.login})`);
  }
  if (pr.mergeable === "CONFLICTING") {
    blockers.push("ベースブランチとコンフリクトしている");
  } else if (pr.mergeable !== "MERGEABLE") {
    // UNKNOWN は「判定待ち」。次回の実行で拾い直せるよう blocked にはしない。
    notes.push(`mergeable=${pr.mergeable} (判定待ち)`);
  }

  const { checks, pending, failed } = summarizeChecks(pr);
  if (failed.length > 0) {
    blockers.push(`CI失敗: ${failed.map((c) => c.name).join(", ")}`);
  }

  const disallowed = pr.files
    .map((f) => f.path)
    .filter((p) => !ALLOWED_PATHS.some((re) => re.test(p)));
  if (disallowed.length > 0) {
    blockers.push(`許可外のファイルが変更されている: ${disallowed.join(", ")}`);
  }

  const manifest = analyzeManifest(pr);
  if (manifest.majorBumps.length > 0) {
    blockers.push(
      `メジャー更新/追加/削除を含む: ${manifest.majorBumps
        .map((d) => `${d.name} ${d.before ?? "-"} -> ${d.after ?? "-"} (${d.reason})`)
        .join(", ")}`,
    );
  }
  if (manifest.enginesChanged) {
    blockers.push("package.json の engines が変更されている");
  }
  if (manifest.runtimeMismatch.length > 0) {
    blockers.push(`ランタイムとの不整合: ${manifest.runtimeMismatch.join(", ")}`);
  }
  if (manifest.unparsable.length > 0) {
    blockers.push(`バージョン指定を解釈できない: ${manifest.unparsable.join(", ")}`);
  }

  const lockfile = analyzeLockfile(pr);
  if (lockfile.majorBumps.length > 0) {
    blockers.push(
      `ロックファイル内のメジャー更新: ${lockfile.majorBumps
        .map((d) => `${d.name} ${d.before} -> ${d.after}`)
        .join(", ")}`,
    );
  }
  if (lockfile.problems.length > 0) {
    blockers.push(`package-lock.json: ${lockfile.problems.join(", ")}`);
  }

  const workflows = analyzeWorkflows(pr);
  if (workflows.problems.length > 0) {
    blockers.push(`ワークフロー差分: ${workflows.problems.join(", ")}`);
  }

  if (pending.length > 0) {
    notes.push(`CI実行中: ${pending.map((c) => c.name).join(", ")}`);
  }
  if (pr.mergeStateStatus !== "CLEAN") {
    notes.push(`mergeStateStatus=${pr.mergeStateStatus}`);
  }

  let state = "ready";
  if (blockers.length > 0) state = "blocked";
  else if (
    pending.length > 0 ||
    pr.mergeable !== "MERGEABLE" ||
    pr.mergeStateStatus !== "CLEAN"
  ) {
    state = "pending";
  }

  return {
    number: pr.number,
    title: pr.title,
    url: pr.url,
    headRefName: pr.headRefName,
    state,
    blockers,
    notes,
    checks,
    files: pr.files.map((f) => f.path),
    manifest,
    lockfile,
    workflows,
  };
}

function listDependabotPrNumbers() {
  const prs = gh([
    "pr",
    "list",
    "--state",
    "open",
    "--json",
    "number,author",
    "--limit",
    "50",
  ]);
  return prs
    .filter((p) => p.author?.is_bot && p.author.login === "app/dependabot")
    .map((p) => p.number)
    .sort((a, b) => a - b);
}

function collect(outPath) {
  const numbers = listDependabotPrNumbers();
  const results = numbers.map(evaluate);
  const candidates = results.filter((r) => r.state === "ready");

  // Claudeにはリポジトリ内のファイルだけを読ませる (ネットワークもghも与えない)。
  if (candidates.length > 0) mkdirSync(DIFF_DIR, { recursive: true });
  for (const c of candidates) {
    const path = `${DIFF_DIR}/pr-${c.number}.diff`;
    writeFileSync(path, curatedDiff(c.number));
    c.diffPath = path;
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    repository: process.env.GITHUB_REPOSITORY,
    candidates,
    pending: results.filter((r) => r.state === "pending"),
    blocked: results.filter((r) => r.state === "blocked"),
  };
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(
    `Dependabot PR ${numbers.length}件: ` +
      `候補 ${payload.candidates.length} / 保留 ${payload.pending.length} / 除外 ${payload.blocked.length}`,
  );
  for (const r of [...payload.pending, ...payload.blocked]) {
    console.log(`  #${r.number} ${r.state}: ${[...r.blockers, ...r.notes].join(" / ")}`);
  }
  return payload;
}

function comment(number, body) {
  execFileSync("gh", ["pr", "comment", String(number), "--body", body], {
    stdio: "inherit",
  });
}

function merge(verdictPath, factsPath = "dependabot-facts.json") {
  const dryRun = process.env.DRY_RUN === "true";
  const verdicts = JSON.parse(readFileSync(verdictPath, "utf8"));
  const list = Array.isArray(verdicts) ? verdicts : (verdicts.verdicts ?? []);
  if (list.length === 0) {
    console.log("Claudeの判定が空。何もしない。");
    return;
  }

  // collect が候補にした PR 以外は触らない。ゲートは evaluate で再適用されるので
  // 安全性の問題ではないが、レビューしていない PR に判定コメントが付くのを防ぐ。
  const facts = JSON.parse(readFileSync(factsPath, "utf8"));
  const candidateNumbers = new Set(facts.candidates.map((c) => c.number));

  for (const v of list) {
    const number = Number(v.pr);
    if (!Number.isInteger(number)) {
      console.log(`不正なPR番号をスキップ: ${JSON.stringify(v.pr)}`);
      continue;
    }
    if (!candidateNumbers.has(number)) {
      console.log(`#${number} は候補一覧にないのでスキップ`);
      continue;
    }
    const reason = String(v.reason ?? "").slice(0, 1500);

    if (v.decision !== "MERGE") {
      console.log(`#${number} 見送り: ${reason}`);
      if (!dryRun) {
        comment(
          number,
          `🤖 **Dependabot 自動レビュー: 見送り**\n\n${reason}\n\n` +
            `マージするかどうかは人が判断してください。`,
        );
      }
      continue;
    }

    // Claudeが MERGE と言っても、直前にもう一度ゲートを通す。
    // 先行するマージで状態が変わっている場合はここで落ちる。
    const fresh = evaluate(number);
    if (fresh.state !== "ready") {
      console.log(
        `#${number} はゲート再検査で ${fresh.state}: ` +
          `${[...fresh.blockers, ...fresh.notes].join(" / ")}`,
      );
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] #${number} をマージするはずだった: ${reason}`);
      continue;
    }

    console.log(`#${number} をマージする: ${reason}`);
    comment(
      number,
      `🤖 **Dependabot 自動レビュー: マージ**\n\n${reason}\n\n` +
        `決定論的ゲート (Dependabot作成 / CI全green / 変更ファイル限定 / ` +
        `メジャー更新なし / ランタイム整合) を通過したうえで自動マージしました。`,
    );
    try {
      execFileSync("gh", ["pr", "merge", String(number), "--merge", "--delete-branch"], {
        stdio: "inherit",
      });
    } catch (err) {
      console.log(`#${number} のマージに失敗: ${err.message}`);
    }
  }
}

const [, , command, arg] = process.argv;
if (command === "collect") {
  collect(arg ?? "dependabot-facts.json");
} else if (command === "merge") {
  merge(arg ?? "verdicts.json", process.argv[4] ?? "dependabot-facts.json");
} else if (command === "inspect") {
  console.log(JSON.stringify(evaluate(Number(arg)), null, 2));
} else {
  console.error(
    "usage: gate.mjs collect <out.json> | gate.mjs merge <verdicts.json> | gate.mjs inspect <PR番号>",
  );
  process.exit(1);
}
