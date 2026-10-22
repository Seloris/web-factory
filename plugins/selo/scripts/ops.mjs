#!/usr/bin/env node
// The ops export for Selo Ops (docs/revamp-2.0.0/ops-export.md): one JSON file per session and one per project
// root, under ~/.claude/selo/ (SELO_OPS_DIR, else CLAUDE_CONFIG_DIR/selo). Written only by the hooks of
// hooks/hooks.json, never read back by the workflow.
// Usage: node ops.mjs hook                       a hook: its input on stdin; prints nothing, always exits 0
//        node ops.mjs mark {substep} [sheet …]   a skill's mark: does nothing, the PostToolUse hook reads the command
//        node ops.mjs scan {root}                rescans a project with no session
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, openSync, readSync, closeSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isCommit, parseSpecLine, specSlug } from "./commit-hook.mjs";
import { findRoot, readManifest } from "./manifest.mjs";
import { idsIn, checkSpec, parseBlueprint } from "./spec-check.mjs";
import { normRoot, withLock } from "./slots.mjs";

export const SCHEMA = 1;
export const LANES = ["fastlane", "blueprint", "build", "autopilot", "review", "try", "grill", "setup"];
export const SUBSTEPS = ["bootstrap", "tests", "code", "suites", "review", "try", "merge", "commit"];
// shortcut: a session keeps its 100 newest runs; raise it if a dashboard needs the whole history.
const MAX_RUNS = 100;

const VERSION = (() => {
  try {
    return JSON.parse(readFileSync(new URL("../.claude-plugin/plugin.json", import.meta.url), "utf8")).version;
  } catch {
    return null;
  }
})();

export const opsDir = (env = process.env) => env.SELO_OPS_DIR || join(env.CLAUDE_CONFIG_DIR || join(homedir(), ".claude"), "selo");
// As ~/.claude/projects names its folders: `C:/WS/ia-projects/selo-ops` → `C--WS-ia-projects-selo-ops`.
export const rootKey = (root) => normRoot(root).replace(/[^A-Za-z0-9]/g, "-");
const now = () => new Date().toISOString();
const slash = (p) => p.replace(/\\/g, "/");

const git = (cwd, args) => {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", timeout: 2000, stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
};

// Uncommitted paths under `root` (modified, staged, untracked), relative to it: a root may be a sub-folder of its repository.
const lines = (out) => (out ?? "").split(/\r?\n/).filter(Boolean);
const changedPaths = (root) =>
  new Set([...lines(git(root, ["ls-files", "--modified", "--others", "--exclude-standard"])), ...lines(git(root, ["diff", "--cached", "--name-only", "--relative"]))]);

// Written to a temp file of this process, then renamed: a reader never sees half a file.
export const writeJson = (file, data) => {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  for (let i = 0; i < 3; i++) {
    try {
      return renameSync(tmp, file);
    } catch {
      // Windows: a reader holding the file open makes the rename fail for a moment
    }
  }
  rmSync(tmp, { force: true });
};

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return null;
  }
};

// ---------- the project file (§4) ----------

const titleOf = (text) => /^#\s+(.+)$/m.exec(text)?.[1].trim() ?? "";
const sectionOf = (text, name) => new RegExp(`^## ${name}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m").exec(text)?.[1] ?? "";
const bullets = (section) => section.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("- ")).map((l) => l.slice(2).trim());
const ticked = (text, label) => new RegExp(`^\\s*-\\s+\\[x\\]\\s+${label}\\b`, "im").test(text);
const mtime = (file) => statSync(file).mtime.toISOString();

const walk = (dir) =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".md") ? [join(dir, e.name)] : [])) : [];

export function sheetOf(file, text) {
  const page = /^\.planning\/pages\/(?:([^/]+)\/)?([^/]+)\.md$/.exec(file);
  const slug = page ? page[2] : basename(file, ".md");
  const defined = (k) => new Set([...text.matchAll(new RegExp(`^\\s*-\\s+\\*\\*(${k}-\\d+)\\*\\*`, "gm"))].map((m) => m[1])).size;
  const next = checkSpec(text).next;
  return {
    kind: page ? "page" : slug === "app" ? "app" : "domain",
    slug,
    component: page?.[1] ?? null,
    file,
    title: titleOf(text),
    route: /^Route:\s*`?([^`·\s]+)`?/m.exec(text)?.[1] ?? null,
    ids: { fr: defined("FR"), br: defined("BR"), retired: idsIn(/^Retired:\s*(.*)$/m.exec(text)?.[1] ?? "").length, next: { fr: next.FR, br: next.BR } },
  };
}

// The step a blueprint's Progress points at: its first unticked stage, else review, else the merge.
export function stepOf(text) {
  for (const m of text.matchAll(/^\s*-\s+\[( |x)\]\s+Stage\s+(\d+)\b/gim)) if (m[1] === " ") return `stage:${m[2]}`;
  return ticked(text, "Review") ? "merge" : /^\s*-\s+\[.\]\s+Stage\s+\d+/im.test(text) ? "review" : "stage:1";
}

const scopeOf = (name) => name.replace(/^\d{4}-\d{2}-\d{2}-/, "");

// `subjects`: commit subject → short sha, newest first wins; `draft`: the file is untracked.
export function blueprintOf(file, text, { subjects = new Map(), draft = false } = {}) {
  const name = basename(file, ".md");
  const bp = parseBlueprint(text);
  const header = /^Pages:.*$/m.exec(text)?.[0] ?? "";
  const components = [...(/Components:([^·]*)/.exec(header)?.[1] ?? "").matchAll(/`([\w/-]+)`/g)].map((m) => m[1]);
  const image = /!\[[^\]]*\]\(([^)\s]+)\)/.exec(sectionOf(text, "Mockup"))?.[1] ?? null;
  const stages = bullets(sectionOf(text, "Stages").replace(/^\s*(\d+)\.\s+/gm, "- $1. ")).map((l) => {
    const m = /^(\d+)\.\s+(.+?)\s+—\s+`([^`]+)`/.exec(l);
    if (!m) return null;
    const commit = m[3];
    return { number: Number(m[1]), component: m[2], commit, sha: subjects.get(commit) ?? null, done: ticked(text, `Stage ${m[1]}`) };
  }).filter(Boolean);
  const progress = { reviewDone: ticked(text, "Review"), specMerged: bp.merged };
  const mergeSubject = `docs(${scopeOf(name)}): spec merged`;
  const mergeCommit = subjects.has(mergeSubject) ? { sha: subjects.get(mergeSubject), subject: mergeSubject } : null;
  const state = /^Legacy:/m.test(text) ? "legacy"
    : draft ? "draft"
    : progress.specMerged ? "done"
    : progress.reviewDone ? "merging"
    : stages.length && stages.every((s) => s.done) ? "review"
    : stages.some((s) => s.done || s.sha) ? "building"
    : "ready";
  const auto = `/selo:autopilot ${file}`;
  const next = state === "ready" || state === "building" || state === "merging" ? { label: "build", prompt: `/selo:build ${file}`, autopilot: auto }
    : state === "review" ? { label: "review", prompt: `/selo:review ${file}`, autopilot: auto }
    : null;
  return {
    name,
    file,
    title: titleOf(text),
    sheets: [...bp.pages, ...bp.domain],
    components,
    mockup: image && !/^[a-z]+:/i.test(image) ? slash(join(dirname(file), image)).replace(/^\.\//, "") : null,
    state,
    delta: bp.lines.filter((l) => !l.invalid).map((l) => ({ sheet: l.slug, op: l.op, id: l.id ?? "Non-goal", text: l.text })),
    decisions: bullets(sectionOf(text, "Business decisions")),
    stages,
    progress,
    mergeCommit,
    next,
    sessions: [],
  };
}

const liveSessions = (dir, root) =>
  existsSync(join(dir, "sessions"))
    ? readdirSync(join(dir, "sessions")).filter((f) => f.endsWith(".json")).map((f) => readJson(join(dir, "sessions", f))).filter((s) => s?.status === "live" && s.root === root)
    : [];

export function scanProject(rootIn, { dir = opsDir() } = {}) {
  const root = normRoot(rootIn);
  const out = { schemaVersion: SCHEMA, writtenAt: now(), selo: VERSION, root, repo: null, branch: null, baseBranch: "main", aheadCount: null, unpushedCount: null, changedCount: 0, manifest: null, sheets: [], blueprints: [], error: null };
  try {
    const m = readManifest(root);
    const { preset, ...models } = m.models;
    out.baseBranch = m.baseBranch;
    out.manifest = { name: m.name, preset, models, components: m.components.map((c) => ({ name: c.name, path: c.path, kind: c.kind })) };
  } catch (e) {
    out.error = e.message;
  }
  const common = git(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"])?.trim();
  if (common) {
    out.repo = normRoot(common);
    const branch = git(root, ["rev-parse", "--abbrev-ref", "HEAD"])?.trim();
    out.branch = branch && branch !== "HEAD" ? branch : null;
    const count = (range) => {
      const n = git(root, ["rev-list", "--count", range])?.trim();
      return n ? Number(n) : null;
    };
    out.aheadCount = out.branch && out.branch !== out.baseBranch ? count(`${out.baseBranch}..HEAD`) : null;
    out.unpushedCount = count("@{u}..HEAD");
    out.changedCount = changedPaths(root).size;
  }
  const planning = join(root, ".planning");
  if (!existsSync(planning)) {
    out.error ??= "no .planning";
    return out;
  }
  try {
    // One pass over the log: each sheet's last commit, each subject's newest sha.
    const lastCommit = new Map();
    const subjects = new Map();
    let at = null;
    for (const line of (git(root, ["log", "-2000", "--format=%x01%h%x09%cI%x09%s", "--name-only", "--relative"]) ?? "").split(/\r?\n/)) {
      if (line.startsWith("\x01")) {
        const [sha, date, ...rest] = line.slice(1).split("\t");
        at = { sha, subject: rest.join("\t"), at: date };
        if (!subjects.has(at.subject)) subjects.set(at.subject, sha);
      } else if (line && at && !lastCommit.has(line)) lastCommit.set(line, at);
    }
    const untracked = new Set((git(root, ["ls-files", "--others", "--exclude-standard", "--", ".planning/blueprints"]) ?? "").split(/\r?\n/).filter(Boolean));
    const rel = (f) => slash(relative(root, f));
    out.blueprints = walk(join(planning, "blueprints"))
      .filter((f) => dirname(f) === join(planning, "blueprints"))
      .map((f) => ({ ...blueprintOf(rel(f), readFileSync(f, "utf8"), { subjects, draft: untracked.has(rel(f)) }), modifiedAt: mtime(f) }))
      .sort((a, b) => b.name.localeCompare(a.name));
    const open = out.blueprints.filter((b) => !["done", "legacy"].includes(b.state));
    out.sheets = [...walk(join(planning, "pages")), ...walk(join(planning, "domain"))].map((f) => {
      const s = sheetOf(rel(f), readFileSync(f, "utf8"));
      const key = s.component ? `${s.component}/${s.slug}` : s.slug;
      return { ...s, modifiedAt: mtime(f), lastCommit: lastCommit.get(s.file) ?? null, openBlueprints: open.filter((b) => b.sheets.includes(key) || b.delta.some((d) => d.sheet === key)).map((b) => b.name) };
    });
    const sessions = liveSessions(dir, root);
    for (const b of out.blueprints) b.sessions = sessions.filter((s) => s.current?.blueprint === b.name).map((s) => s.sessionId);
  } catch (e) {
    out.error = e.message;
  }
  return out;
}

export const writeProject = (root, dir = opsDir()) => writeJson(join(dir, "projects", `${rootKey(root)}.json`), scanProject(root, { dir }));

// ---------- the session file (§5) ----------

// §5.2: the run a prompt opens. `root` resolves a blueprint path to read its Progress.
export function parsePrompt(prompt, root) {
  const m = /^\s*\/selo:([\w-]+)\b\s*([\s\S]*)$/.exec(prompt ?? "");
  const lane = m && LANES.includes(m[1]) ? m[1] : "free";
  const rest = (m && lane !== "free" ? m[2] : prompt ?? "").trim();
  const file = /(\S*\.planning\/blueprints\/[^\s/]+\.md)/.exec(slash(rest))?.[1] ?? null;
  const text = file && root && existsSync(resolve(root, file)) ? readFileSync(resolve(root, file), "utf8") : null;
  const stage = /—\s*stage\s+(\d+)/.exec(rest)?.[1];
  const run = { lane, request: rest.slice(0, 200), blueprint: file ? basename(file, ".md") : null, step: lane, lastStep: null };
  if (lane === "build") Object.assign(run, { step: stage ? `stage:${stage}` : text ? stepOf(text) : "stage:1", lastStep: stage ? `stage:${stage}` : null });
  else if (lane === "autopilot") run.step = file ? (text ? stepOf(text) : "stage:1") : "blueprint";
  else if (lane !== "review") run.blueprint = null;
  return run;
}

const COMMIT_SUBJECT = /^[a-z]+\([^)]+\)!?: /;

// §5.3: where the run stands at the end of a turn, from its last message and the turn's wrap_up ask.
export function classifyEnd(message, ask = null) {
  const text = String(message ?? "").replace(/\r\n/g, "\n").trimEnd();
  const lines = text.split("\n");
  const at = lines.findLastIndex((l) => /^##\s*✅\s*JOB DONE\s*$/.test(l.trim()));
  if (at >= 0) {
    const tail = lines.slice(at + 1).map((l) => l.trim()).filter(Boolean);
    if (tail.every((l) => l.startsWith(">") || /^`[0-9a-f]{4,40}`/.test(l))) {
      const recap = tail.find((l) => l.startsWith(">"))?.replace(/^>\s*/, "") ?? null;
      const commits = tail.map((l) => /^`([0-9a-f]{4,40})`\s+(.*)$/.exec(l)).filter(Boolean).map((c) => ({ sha: c[1], subject: c[2].split(" · ")[0].trim() }));
      return { phase: "job-done", recap: { text: recap, commits }, pendingCommit: null, question: null };
    }
  }
  if (lines.at(-1)?.trim() === "```") {
    const open = lines.slice(0, -1).findLastIndex((l) => l.trim().startsWith("```"));
    const block = open >= 0 ? lines.slice(open + 1, -1) : [];
    if (COMMIT_SUBJECT.test(block[0] ?? "")) return { phase: "awaiting-commit", pendingCommit: { subject: block[0].trim(), body: block.slice(1).join("\n").trim() }, question: null, recap: null };
  }
  const last = lines.map((l) => l.trim()).filter(Boolean).at(-1) ?? "";
  if (ask || last.endsWith("?")) return { phase: "awaiting-answer", question: String(ask || last).slice(0, 200), pendingCommit: null, recap: null };
  return { phase: "turn-ended", pendingCommit: null, question: null, recap: null };
}

// §5.5: can the person close the session.
export function closeOf(s) {
  const cur = s.runs.find((r) => !r.agentId) ?? null;
  const blockers = [];
  if (cur?.phase !== "job-done") blockers.push("not-done");
  if (cur?.pendingCommit) blockers.push("pending-commit");
  if (cur?.phase === "awaiting-answer") blockers.push("question");
  if (s.dirtyFiles.length) blockers.push("dirty-files");
  if (s.backgroundTasks.some((t) => t.status === "running")) blockers.push("background-tasks");
  if (s.runs.some((r) => r.agentId && r.phase === "working")) blockers.push("subagents");
  return { ok: blockers.length === 0, blockers };
}

export const newSession = (id, root) => ({
  schemaVersion: SCHEMA, writtenAt: now(), sessionId: id, root: normRoot(root), rootKey: rootKey(root), repo: null, startedAt: now(), status: "live",
  transcriptPath: null, model: null, permissionMode: null, effort: null, touchedFiles: [], dirtyFiles: [], backgroundTasks: [], close: { ok: false, blockers: ["not-done"] }, runs: [], current: null, ask: null,
});

const openRun = (s, fields, agentId = null) => {
  const since = now();
  const run = { id: `${s.sessionId}:${Date.parse(since)}`, agentId, lane: "free", request: "", blueprint: null, sheets: [], step: "free", lastStep: null, substep: null, error: null, phase: "working", pendingCommit: null, question: null, recap: null, commits: [], resumePrompt: null, since, updatedAt: since, ...fields };
  s.runs = [run, ...s.runs].slice(0, MAX_RUNS);
  return run;
};
const mainRun = (s) => s.runs.find((r) => !r.agentId) ?? null;
const runOf = (s, agentId) => (agentId ? s.runs.find((r) => r.agentId === agentId) ?? openRun(s, {}, agentId) : mainRun(s));
const addSheets = (run, sheets) => (run.sheets = [...new Set([...run.sheets, ...sheets.filter(Boolean)])]);

// The last assistant text of a transcript, read from its tail: for a Stop input without last_assistant_message.
export function lastAssistantText(path) {
  try {
    const size = statSync(path).size;
    const len = Math.min(size, 512 * 1024);
    const buf = Buffer.alloc(len);
    const fd = openSync(path, "r");
    readSync(fd, buf, 0, len, size - len);
    closeSync(fd);
    for (const line of buf.toString("utf8").split("\n").reverse()) {
      if (!line.includes('"assistant"')) continue;
      try {
        const e = JSON.parse(line);
        const content = e.type === "assistant" ? e.message?.content : null;
        const text = Array.isArray(content) ? content.filter((c) => c.type === "text").map((c) => c.text).join("\n") : typeof content === "string" ? content : "";
        if (text.trim()) return text;
      } catch {
        // a line cut by the tail read
      }
    }
  } catch {
    // no transcript
  }
  return null;
}

const dirtyOf = (root, touched) => {
  const changed = changedPaths(root);
  return touched.filter((f) => changed.has(f));
};

// A stage commit moves its run: to the next stage, the last one to review; the merge commit to `merge`.
const stepAfter = (run, subject, project) => {
  if (/^docs\([^)]+\): spec merged\b/.test(subject)) return "merge";
  const bp = project?.blueprints.find((b) => b.name === run.blueprint) ?? project?.blueprints.find((b) => b.stages.some((st) => st.commit === subject));
  const i = bp?.stages.findIndex((st) => st.commit === subject) ?? -1;
  if (i < 0) return null;
  run.blueprint ??= bp.name;
  return i + 1 < bp.stages.length ? `stage:${bp.stages[i + 1].number}` : "review";
};

const resumeOf = (run, root) => {
  if (!run?.blueprint) return null;
  const file = `.planning/blueprints/${run.blueprint}.md`;
  return existsSync(join(root, file)) ? blueprintOf(file, readFileSync(join(root, file), "utf8")).next?.prompt ?? null : null;
};

// One hook: `s` is the session (mutated), `e` the hook's input. Returns true when the project needs a rescan.
export function applyHook(s, e, root) {
  const event = e.hook_event_name;
  const agentId = e.agent_id ?? null;
  if (e.permission_mode) s.permissionMode = e.permission_mode;
  const effort = e.effort?.level ?? (typeof e.effort === "string" ? e.effort : null);
  if (effort) s.effort = effort;
  if (e.transcript_path) s.transcriptPath = slash(e.transcript_path);
  s.root = normRoot(root);
  s.rootKey = rootKey(root);
  const t = now();
  const touch = (run) => run && (run.updatedAt = t);

  if (event === "SessionStart") {
    s.status = "live";
    if (e.model) s.model = typeof e.model === "string" ? e.model : e.model.id ?? s.model;
    const common = git(root, ["rev-parse", "--path-format=absolute", "--git-common-dir"])?.trim();
    s.repo = common ? normRoot(common) : null;
    return true;
  }
  if (event === "UserPromptSubmit") {
    s.ask = null;
    const p = parsePrompt(e.prompt, root);
    const cur = mainRun(s);
    // A prompt that answers the run (a commit's yes, an answer, a word after an Esc) keeps it.
    if (p.lane === "free" && cur && ["awaiting-commit", "awaiting-answer", "working"].includes(cur.phase)) {
      Object.assign(cur, { phase: "working", pendingCommit: null, question: null, error: null });
      touch(cur);
    } else openRun(s, p);
    return false;
  }
  if (event === "PreToolUse" && e.tool_name === "Skill") {
    const name = String(e.tool_input?.skill ?? "");
    if (!name.startsWith("selo:")) return false;
    const p = parsePrompt(`/${name} ${e.tool_input?.args ?? ""}`, root);
    if (p.lane === "free") return false;
    const main = mainRun(s);
    if (agentId) {
      const run = runOf(s, agentId);
      Object.assign(run, p);
      touch(run);
      // An autopilot stands for its subagents: its step is the one of the subagent it spawned last.
      if (main?.lane === "autopilot") Object.assign(main, { step: p.step, blueprint: main.blueprint ?? p.blueprint, updatedAt: t });
    } else if (main && main.lane === "free" && main.phase === "working") Object.assign(main, p, { updatedAt: t });
    return false;
  }
  if (event === "PostToolUse") {
    const tool = e.tool_name;
    if (tool === "Edit" || tool === "Write" || tool === "NotebookEdit") {
      const path = e.tool_input?.file_path ?? e.tool_input?.notebook_path;
      if (!path) return false;
      const rel = slash(relative(root, resolve(root, path)));
      if (rel.startsWith("..")) return false;
      s.touchedFiles = [...new Set([...s.touchedFiles, rel])];
      const run = runOf(s, agentId);
      if (!run) return false;
      const bp = /^\.planning\/blueprints\/([^/]+)\.md$/.exec(rel)?.[1];
      if (bp) run.blueprint = bp;
      const sheet = specSlug(rel);
      if (sheet && !rel.startsWith(".planning/features/")) addSheets(run, [sheet]);
      touch(run);
      return false;
    }
    if (tool === "mcp__ccd_turn__wrap_up") {
      if (!agentId) s.ask = e.tool_input?.ask ? String(e.tool_input.ask) : null;
      return false;
    }
    const command = String(e.tool_input?.command ?? "");
    const mark = /ops\.mjs["']?\s+mark\s+([\w-]+)([^;&|\n]*)/.exec(command);
    if (mark) {
      const run = runOf(s, agentId);
      if (!run) return false;
      if (SUBSTEPS.includes(mark[1])) run.substep = mark[1];
      addSheets(run, mark[2].trim().split(/\s+/).filter((w) => /^[\w/-]+$/.test(w)));
      touch(run);
      return false;
    }
    if (!isCommit(command)) return false;
    const head = git(root, ["log", "-1", "--format=%h%x09%cI%x09%s%x00%B"]);
    const run = runOf(s, agentId);
    if (!head || !run) return true;
    const [meta, body = ""] = head.split("\0");
    const [sha, at, ...rest] = meta.trim().split("\t");
    const subject = rest.join("\t");
    // The command may have failed: HEAD is then a commit this session already has, or someone else's older one.
    if (s.runs.some((r) => r.commits.some((c) => c.sha === sha))) return false;
    const specLine = /^Spec:\s*(.+)$/m.exec(body)?.[1].trim() ?? null;
    const commit = { sha, subject, spec: specLine, at };
    run.commits.push(commit);
    const spec = specLine ? parseSpecLine(`Spec: ${specLine}`) : null;
    if (spec?.pending) run.blueprint ??= basename(spec.pending, ".md");
    addSheets(run, Object.keys(spec?.groups ?? {}));
    const main = mainRun(s);
    if (agentId && main?.lane === "autopilot") main.commits.push(commit);
    s.pendingStep = { agentId, subject };
    touch(run);
    return true;
  }
  if (event === "SubagentStart") {
    openRun(s, { request: String(e.agent_type ?? "") }, agentId);
    return false;
  }
  if (event === "SubagentStop") {
    const run = agentId && s.runs.find((r) => r.agentId === agentId);
    if (run) Object.assign(run, classifyEnd(e.last_assistant_message ?? lastAssistantText(e.agent_transcript_path)), { updatedAt: t });
    return false;
  }
  if (event === "Stop") {
    const cur = mainRun(s);
    if (cur) {
      Object.assign(cur, classifyEnd(e.last_assistant_message ?? lastAssistantText(e.transcript_path), s.ask), { updatedAt: t });
      cur.resumePrompt = resumeOf(cur, root);
    }
    s.ask = null;
    s.backgroundTasks = (e.background_tasks ?? []).map((b) => ({ id: String(b.id ?? ""), type: String(b.type ?? ""), status: String(b.status ?? ""), description: String(b.description ?? "") }));
    s.dirtyFiles = dirtyOf(root, s.touchedFiles);
    s.close = closeOf(s);
    return true;
  }
  if (event === "StopFailure") {
    const cur = mainRun(s);
    if (cur) Object.assign(cur, { phase: "stopped", error: String(e.error?.message ?? e.error ?? e.message ?? "API error").slice(0, 500), updatedAt: t });
    return false;
  }
  if (event === "SessionEnd") {
    s.status = "ended";
    for (const r of s.runs) if (r.phase === "working") Object.assign(r, { phase: "stopped", updatedAt: t });
    s.close = closeOf(s);
    return false;
  }
  return false;
}

// A commit's step move needs the rescanned project (its blueprints' stages): done after the scan.
const moveStep = (s, project) => {
  const p = s.pendingStep;
  delete s.pendingStep;
  if (!p) return;
  const run = p.agentId ? s.runs.find((r) => r.agentId === p.agentId) : mainRun(s);
  const main = mainRun(s);
  if (!run || !["build", "autopilot", "blueprint"].includes(run.lane)) return;
  const step = stepAfter(run, p.subject, project);
  if (!step) return;
  run.step = step;
  if (p.agentId && main?.lane === "autopilot") Object.assign(main, { step, blueprint: main.blueprint ?? run.blueprint });
};

export async function handle(e, { dir = opsDir() } = {}) {
  const root = e.cwd ? findRoot(e.cwd) : null;
  if (!root || !e.session_id) return;
  const file = join(dir, "sessions", `${e.session_id}.json`);
  await withLock(
    join(dir, "locks", String(e.session_id)),
    () => {
      const s = { ...newSession(e.session_id, root), ...(readJson(file) ?? {}) };
      const rescan = applyHook(s, e, root);
      const project = rescan ? scanProject(root, { dir }) : null;
      moveStep(s, project);
      s.writtenAt = now();
      s.current = mainRun(s);
      writeJson(file, s);
      // After the session file: the project's blueprints list the sessions working on them, this one included.
      if (project) {
        const live = liveSessions(dir, project.root);
        for (const b of project.blueprints) b.sessions = live.filter((x) => x.current?.blueprint === b.name).map((x) => x.sessionId);
        writeJson(join(dir, "projects", `${rootKey(root)}.json`), project);
      }
    },
    { timeoutMs: 2000, staleMs: 10000 },
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === "scan") {
    try {
      const root = findRoot(args[0] ?? process.cwd());
      if (root) writeProject(root);
    } catch {
      // read-only for its caller: nothing to report
    }
  } else if (mode === "hook") {
    // A hook never blocks nor slows the session: silent, exit 0, gives up after 4.5 s.
    setTimeout(() => process.exit(0), 4500).unref();
    try {
      let data = "";
      for await (const chunk of process.stdin) data += chunk;
      const e = JSON.parse(data.replace(/^\uFEFF/, "").trim() || "{}");
      const cmd = String(e.tool_input?.command ?? "");
      // Most Bash calls are neither a commit nor a mark: they leave before any git or file work.
      if (e.hook_event_name === "PostToolUse" && /^(Bash|PowerShell)$/.test(e.tool_name) && !isCommit(cmd) && !/ops\.mjs["']?\s+mark\b/.test(cmd)) process.exit(0);
      await handle(e);
    } catch {
      // fail silent
    }
  }
  // `mark` does nothing: the PostToolUse hook reads its command.
  process.exit(0);
}
