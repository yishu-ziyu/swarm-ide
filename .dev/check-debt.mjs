#!/usr/bin/env node
// 架构技术债清偿验收脚本（acceptance-debt.md D7）
// 用法：node .dev/check-debt.mjs   （任一 FAIL exit 1，全 PASS exit 0）
// 真 grep：所有检查都读取真实文件内容，输出 JSON 数字。

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const BACKEND = join(ROOT, "backend");

function read(p) {
  return existsSync(p) ? readFileSync(p, "utf8") : null;
}

/** 递归收集目录下所有 .ts/.tsx 文件路径 */
function walkTsFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTsFiles(full, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

/** 在 dir 下 grep 引用某组件名的 import 语句，返回引用计数 */
function countImports(importName, dirs) {
  const re = new RegExp(
    `from ["'](\\./|@/app/im/|\\.\\./im/)[^"']*\\b${importName}\\b["']`,
  );
  let count = 0;
  const files = dirs.flatMap((d) => walkTsFiles(d));
  for (const f of files) {
    const src = read(f);
    if (!src) continue;
    for (const line of src.split("\n")) {
      if (re.test(line)) count += 1;
    }
  }
  return count;
}

const checks = [];
function check(name, pass, evidence) {
  checks.push({ name, pass: !!pass, evidence: String(evidence) });
}

// ---------------------------------------------------------------------------
// D1 — tsconfig exclude 无源码路径 + 被删文件不存在
// ---------------------------------------------------------------------------
const tsconfigRaw = read(join(BACKEND, "tsconfig.json"));
const tsconfig = tsconfigRaw ? JSON.parse(tsconfigRaw) : {};
const excludes = Array.isArray(tsconfig.exclude) ? tsconfig.exclude : [];
const badExcludes = excludes.filter((e) => e.includes("src"));
check(
  "D1.tsconfig_exclude_no_source_paths",
  badExcludes.length === 0,
  badExcludes.length === 0
    ? `exclude = ${JSON.stringify(excludes)}`
    : `exclude 含源码路径: ${badExcludes.join(", ")}`
);

const D1_DEAD_PATHS = [
  "src/agents/memory.ts",
  "src/agents/director.ts",
  "src/lib/index.ts",
  "src/lib/context",
  "src/lib/runtime",
];
const stillAlive = D1_DEAD_PATHS.filter((p) => existsSync(join(BACKEND, p)));
check(
  "D1.dead_modules_deleted",
  stillAlive.length === 0,
  stillAlive.length === 0
    ? `${D1_DEAD_PATHS.join(", ")} 均不存在`
    : `仍存在: ${stillAlive.join(", ")}`
);

// ---------------------------------------------------------------------------
// D2 — tools/registry.ts 死链已删
// ---------------------------------------------------------------------------
check(
  "D2.registry_deleted",
  !existsSync(join(BACKEND, "src/lib/tools/registry.ts")),
  existsSync(join(BACKEND, "src/lib/tools/registry.ts"))
    ? "src/lib/tools/registry.ts 仍存在"
    : "src/lib/tools/registry.ts 不存在"
);

// ---------------------------------------------------------------------------
// D3 — app/im 无零引用组件 + page.tsx 无注释 import
// ---------------------------------------------------------------------------
const imDir = join(BACKEND, "app", "im");
const imFiles = existsSync(imDir)
  ? readdirSync(imDir).filter((n) => n.endsWith(".tsx"))
  : [];
const zeroRef = [];
for (const file of imFiles) {
  const name = file.replace(/\.tsx$/, "");
  if (name === "page") continue; // 页面入口本身不要求被引用
  const count = countImports(name, [join(BACKEND, "app")]);
  if (count === 0) zeroRef.push(file);
}
check(
  "D3.im_no_zero_ref_components",
  zeroRef.length === 0,
  zeroRef.length === 0
    ? `app/im/*.tsx 共 ${imFiles.length} 个文件，全部 import 计数 > 0`
    : `零引用组件: ${zeroRef.join(", ")}`
);

const pageSrc = read(join(imDir, "page.tsx")) ?? "";
const commentedImports = pageSrc
  .split("\n")
  .map((line, i) => ({ line, i }))
  .filter(({ line }) => /^\s*\/\/\s*import\b/.test(line));
check(
  "D3.page_no_commented_imports",
  commentedImports.length === 0,
  commentedImports.length === 0
    ? "page.tsx 无被注释的组件 import"
    : commentedImports.map(({ line, i }) => `page.tsx:${i + 1} ${line.trim()}`).join("; ")
);

// ---------------------------------------------------------------------------
// D4 — CanvasView 无 "TODO: Integrate" + 发送走真实 API + 有错误反馈
// ---------------------------------------------------------------------------
const canvasSrc = read(join(imDir, "CanvasView.tsx")) ?? "";
check(
  "D4.no_todo_integrate",
  !canvasSrc.includes("TODO: Integrate"),
  canvasSrc.includes("TODO: Integrate") ? 'CanvasView.tsx 仍含 "TODO: Integrate"' : "无 TODO: Integrate"
);
const hasApiPath = canvasSrc.includes("/api/groups/${groupId}/messages");
const hasPost = /method:\s*"POST"/.test(canvasSrc);
const hasErrorFeedback = canvasSrc.includes("setError(");
check(
  "D4.real_api_call_with_error_feedback",
  hasApiPath && hasPost && hasErrorFeedback,
  `api path=${hasApiPath}, POST=${hasPost}, error feedback=${hasErrorFeedback}`
);

// ---------------------------------------------------------------------------
// D5 — 消息 route 透传 limit/beforeTime
// ---------------------------------------------------------------------------
const routeSrc =
  read(join(BACKEND, "app/api/groups/[groupId]/messages/route.ts")) ?? "";
const readsLimit = /searchParams\.get\("limit"\)/.test(routeSrc);
const readsBeforeTime = /searchParams\.get\("beforeTime"\)/.test(routeSrc);
const passesToStore = /listMessages\(\{[\s\S]*?beforeTime/.test(routeSrc) && /listMessages\(\{[\s\S]*?limit/.test(routeSrc);
check(
  "D5.route_passthrough_limit_beforeTime",
  readsLimit && readsBeforeTime && passesToStore,
  `reads limit=${readsLimit}, reads beforeTime=${readsBeforeTime}, passes both to listMessages=${passesToStore}`
);

// ---------------------------------------------------------------------------
// D6 — .gitignore 含 dev-log 忽略行
// ---------------------------------------------------------------------------
const ignoreSrc = read(join(ROOT, ".gitignore")) ?? "";
check(
  "D6.gitignore_dev_log",
  /\*\.dev-log\.json/.test(ignoreSrc) || /backend\/src\/lib\/\.dev-log\.json/.test(ignoreSrc),
  ignoreSrc
    .split("\n")
    .filter((l) => l.includes("dev-log"))
    .join(" | ") || ".gitignore 无 dev-log 忽略行"
);

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------
const passed = checks.filter((c) => c.pass).length;
const failed = checks.length - passed;
const result = {
  total_checks: checks.length,
  passed,
  failed,
  checks,
};
console.log(JSON.stringify(result, null, 2));
process.exit(failed > 0 ? 1 : 0);
