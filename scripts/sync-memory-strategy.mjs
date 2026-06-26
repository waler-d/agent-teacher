#!/usr/bin/env node
/**
 * 将个人 memory-strategy skill 同步到项目 .cursor/skills/
 * 用法: npm run sync:skill
 *       npm run sync:skill -- --check   # 仅检查是否有差异
 */

import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const projectRoot = resolve(import.meta.dirname, "..");
const defaultSource = join(homedir(), ".cursor", "skills", "memory-strategy");
const sourceDir = resolve(process.env.MEMORY_STRATEGY_SOURCE ?? defaultSource);
const targetDir = join(projectRoot, ".cursor", "skills", "memory-strategy");
const checkOnly = process.argv.includes("--check");

function hashFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(full));
    else files.push(full);
  }
  return files;
}

function ensureSource() {
  if (!existsSync(sourceDir)) {
    console.error(`源目录不存在: ${sourceDir}`);
    console.error("可通过环境变量 MEMORY_STRATEGY_SOURCE 指定路径。");
    process.exit(1);
  }
}

function compareTrees() {
  const sourceFiles = listFiles(sourceDir);
  const changes = [];

  for (const file of sourceFiles) {
    const rel = relative(sourceDir, file);
    const target = join(targetDir, rel);
    if (!existsSync(target) || hashFile(file) !== hashFile(target)) {
      changes.push(rel);
    }
  }

  return changes;
}

function sync() {
  mkdirSync(targetDir, { recursive: true });
  cpSync(sourceDir, targetDir, { recursive: true, force: true });
}

ensureSource();

if (checkOnly) {
  if (!existsSync(targetDir)) {
    console.log("项目内尚无 memory-strategy，需要同步。");
    process.exit(2);
  }
  const changes = compareTrees();
  if (changes.length === 0) {
    console.log("memory-strategy 已是最新，无需同步。");
    process.exit(0);
  }
  console.log("以下文件与源 skill 不一致：");
  for (const file of changes) console.log(`  - ${file}`);
  process.exit(2);
}

const before = existsSync(targetDir) ? compareTrees() : listFiles(sourceDir).map((f) => relative(sourceDir, f));
sync();

console.log(`已同步: ${sourceDir}`);
console.log(`    → ${targetDir}`);
if (before.length > 0) {
  console.log("\n更新文件：");
  for (const file of before) console.log(`  - ${file}`);
} else {
  console.log("\n所有文件已复制。");
}
console.log("\n下一步（若需让 Cloud Agent 生效）：");
console.log("  git add .cursor/skills/memory-strategy");
console.log("  git commit -m \"chore: sync memory-strategy skill\"");
console.log("  git push");
