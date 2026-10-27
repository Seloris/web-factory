#!/usr/bin/env node
// PreToolUse hook on Bash / PowerShell: a `git commit` in a selo project gets warnings added to the
// agent's context, never a refusal. It warns on `-a`, `git add -A` / `git add .`, `--amend`, a commit that
// touches code without a `Spec:` line, a spec of the commit whose ids do not check (spec-check), and a
// `Spec: pending (…)` whose blueprint is missing or already merged.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findRoot } from "./manifest.mjs";
import { checkSpec, idsIn } from "./spec-check.mjs";

// The command with its quoted strings emptied: flags inside a message never count.
const bare = (command) => command.replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, '""');

// `git` then its own options (`-C dir`, `-c key=value`) then `commit`, within one shell command.
export const isCommit = (command) => /\bgit(?:\s+-[Cc]\s+\S+|\s+--?[\w-]+(?:=\S*)?)*\s+commit\b/.test(bare(command));

// A file is code unless it is planning or prose: `.planning/**` and `*.md` carry no `Spec:` line.
export const isCode = (file) => !file.replace(/\\/g, "/").startsWith(".planning/") && !/\.md$/i.test(file);

// The paths named after ` -- ` in the commit command (the `git commit --only … -- {files}` form).
// shortcut: a quoted path is dropped with the other quoted strings; the hook then misses that file.
export const namedFiles = (command) => {
  const b = bare(command);
  const m = /\s--(?:\s+([^;&|]*))?(?:[;&|]|$)/.exec(b.slice(b.search(/\bcommit\b/)));
  return m ? (m[1] ?? "").split(/\s+/).filter((f) => f && f !== '""') : null;
};

// The paths a `git add` before the commit stages in the same command: the hook runs before it, so they are not staged yet.
export const addedFiles = (command) => {
  const b = bare(command);
  const before = b.slice(0, Math.max(0, b.search(/\bcommit\b/)));
  return [...before.matchAll(/\bgit\s+add\s+([^;&|]*)/g)].flatMap((m) => m[1].split(/\s+/).filter((f) => f && f !== '""' && !f.startsWith("-")));
};

export function commitWarnings(command, files) {
  const b = bare(command);
  const warnings = [];
  const commitPart = b.slice(b.search(/\bcommit\b/));
  if (/\s(?:--all|-[A-Za-z]*a[A-Za-z]*)(?=\s|$)/.test(commitPart.split(/[;&|]/)[0])) warnings.push("`git commit -a` takes every tracked change, other sessions' included: name the files (`git commit --only -- {files}`).");
  if (/\bgit\s+add\s+(?:-A|--all|\.)(?=\s|$)/.test(b)) warnings.push("`git add -A` / `git add .` stages other sessions' files: add only the new files of this work.");
  if (/\s--amend\b/.test(commitPart)) warnings.push("`--amend` rewrites a commit another session may build on: make a new commit.");
  if (files !== null && files.some(isCode) && !/\bSpec:\s*\S/.test(command)) warnings.push("This commit touches code and has no `Spec:` line in its body: add `Spec: {slug} +FR-NN ~FR-NN · {slug} ~BR-NN`, `Spec: pending ({blueprint})` or `Spec: none ({reason})`, as a second `-m`.");
  return warnings;
}

// The `Spec:` line of a commit, from the raw command: `pending` with its blueprint, `none`, or one id group per file (` · ` between).
export const parseSpecLine = (command) => {
  const line = /\bSpec:\s*([^"'\n]*)/.exec(command)?.[1]?.trim();
  if (!line) return null;
  const pending = /^pending\s*\(([^)]+)\)/.exec(line);
  if (pending) return { pending: pending[1].trim(), groups: {} };
  if (/^none\b/.test(line)) return { none: true, groups: {} };
  const groups = {};
  for (const part of line.split("·")) {
    const [slug, ...rest] = part.trim().split(/\s+/);
    if (slug) groups[slug] = idsIn(rest.join(" "));
  }
  return { groups };
};

// The slug of a spec file: a page (`home`, `web/home`), a domain sheet, a 1.0 area; null for any other file.
export const specSlug = (file) => {
  const f = file.replace(/\\/g, "/");
  return /^\.planning\/pages\/(.+)\.md$/.exec(f)?.[1] ?? /^\.planning\/domain\/([^/]+)\.md$/.exec(f)?.[1] ?? /^\.planning\/features\/([^/]+)\/00_spec\.md$/.exec(f)?.[1] ?? null;
};

// The spec files of the commit, each checked against its group of the Spec: line; a pending blueprint must exist, not merged.
export function specWarnings(root, command, files) {
  const warnings = [];
  const spec = parseSpecLine(command);
  if (spec?.pending) {
    const bp = join(root, spec.pending);
    if (!existsSync(bp)) warnings.push(`\`Spec: pending\` names ${spec.pending}, which does not exist: name the blueprint this stage builds.`);
    else if (/^\s*-\s+\[x\]\s+Spec merged/im.test(readFileSync(bp, "utf8"))) warnings.push(`\`Spec: pending\` names ${spec.pending}, already merged: cite the final ids (\`Spec: {slug} +FR-NN\`).`);
  }
  for (const file of files ?? []) {
    const slug = specSlug(file);
    if (!slug || !existsSync(join(root, file))) continue;
    const r = checkSpec(readFileSync(join(root, file), "utf8"), spec?.groups[slug] ?? []);
    const problems = [
      r.duplicates.length && `duplicate ids ${r.duplicates.join(", ")}`,
      r.retiredReused.length && `retired ids reused ${r.retiredReused.join(", ")}`,
      r.missing.length && `ids of the Spec: line missing from the spec ${r.missing.join(", ")}`,
    ].filter(Boolean);
    if (problems.length) warnings.push(`spec-check ${slug}: ${problems.join("; ")} (next free: ${r.next.FR}, ${r.next.BR}).`);
  }
  return warnings;
}

const staged = (root) => {
  try {
    return execFileSync("git", ["diff", "--cached", "--name-only"], { cwd: root, encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
  } catch {
    return null;
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  let event = {};
  try {
    event = JSON.parse(data.replace(/^\uFEFF/, "").trim() || "{}");
  } catch {
    process.exit(0);
  }
  const command = String(event.tool_input?.command ?? "");
  const root = isCommit(command) ? findRoot(event.cwd ?? process.cwd()) : null;
  if (root === null) process.exit(0);
  const cached = namedFiles(command) === null ? staged(root) : null;
  const files = namedFiles(command) ?? (cached === null ? null : [...new Set([...cached, ...addedFiles(command)])]);
  const warnings = [...commitWarnings(command, files), ...specWarnings(root, command, files)];
  if (warnings.length === 0) process.exit(0);
  const context = `selo commit check (a warning, the commit is not blocked):\n- ${warnings.join("\n- ")}`;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", additionalContext: context } }) + "\n");
  process.exit(0);
}
