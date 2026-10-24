#!/usr/bin/env node
// The ops export for Selo Ops (docs/revamp-2.0.0/ops-export.md): one JSON file per session and one per project
// root, under ~/.claude/selo/ (SELO_OPS_DIR, else CLAUDE_CONFIG_DIR/selo). Written only by the hooks of
// hooks/hooks.json, never read back by the workflow. Every session is exported: a root with no selo.yaml up
// the tree is a plain root (its git top level, else the cwd), exported without the workflow (docs/revamp-2.0.0/ops-plugin.md §3).
// manifest.mjs, spec-check.mjs, commit-hook.mjs and slots.mjs are byte-identical copies of the selo plugin's (tests/shared.test.mjs).
// usage.mjs reads what each run consumed from the transcript (since 2.2.0: docs/revamp-2.2.0/proposal.md §3 to §5).
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
import { addUsage, readSlice, readUsage, subUsage } from "./usage.mjs";

export const SCHEMA = 1;
// The selo skills (since 2.5.0): a lane skill sets the run's `flow`, a tool skill only its `skill`.
export const SKILLS = {
  fastlane: { kind: "lane", flow: "fastlane" },
  blueprint: { kind: "lane", flow: "blueprint" },
  build: { kind: "lane", flow: "blueprint" },
  autopilot: { kind: "lane", flow: "autopilot" },
  grill: { kind: "tool" }, mockup: { kind: "tool" }, review: { kind: "tool" }, try: { kind: "tool" }, run: { kind: "tool" }, setup: { kind: "tool" },
};
const skillOf = (name) => (name && Object.hasOwn(SKILLS, name) ? SKILLS[name] : null);
// A run written before 2.5.0 has no `flow`: its lane's.
const flowOf = (run) => run?.flow ?? skillOf(run?.lane)?.flow ?? "free";
export const SUBSTEPS = ["bootstrap", "tests", "code", "suites", "review", "try", "merge", "commit"];
// shortcut: a session keeps its 100 newest runs; raise it if a dashboard needs the whole history.
const MAX_RUNS = 100;
// A subagent run keeps the start of its prompt only.
const PROMPT_CAP = 300;
// A run's trail keeps its newest entries.
const TRAIL_MAX = 50;

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
// A selo root (selo.yaml up the tree) or a plain one: the git top level of `cwd`, else `cwd` itself.
export function rootOf(cwd) {
  const selo = findRoot(cwd);
  if (selo) return { root: selo, selo: true };
  return { root: git(cwd, ["rev-parse", "--show-toplevel"])?.trim() || resolve(cwd), selo: false };
}

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

// A plain root (`selo` false): git counts only, no manifest, no `.planning`, no error.
export function scanProject(rootIn, { dir = opsDir(), selo = true } = {}) {
  const root = normRoot(rootIn);
  const out = { schemaVersion: SCHEMA, writtenAt: now(), selo: VERSION, root, repo: null, branch: null, baseBranch: "main", aheadCount: null, unpushedCount: null, changedCount: 0, manifest: null, sheets: [], blueprints: [], error: null };
  if (selo) try {
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
  if (!selo) return out;
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

export const writeProject = (root, { dir = opsDir(), selo = true } = {}) => writeJson(join(dir, "projects", `${rootKey(root)}.json`), scanProject(root, { dir, selo }));

// ---------- the session file (§5) ----------

// Wrapper tags the harness puts around a prompt: a pasted block is the person's text, any other leading
// block (a view context, a reminder) is not. Stripped before the 200-character cut, which a long block ate whole.
const UNWRAP = new Set(["pasted_content"]);
export function stripWrappers(prompt) {
  let text = String(prompt ?? "").trimStart();
  for (;;) {
    const open = /^<([a-zA-Z][\w-]*)(?:\s[^>]*)?>/.exec(text);
    if (!open) return text;
    const name = open[1];
    const rest = text.slice(open[0].length);
    const close = rest.indexOf(`</${name}>`);
    // An unclosed tag is the person's own text.
    if (close < 0) return text;
    text = (UNWRAP.has(name) ? rest.slice(0, close) + rest.slice(close + name.length + 3) : rest.slice(close + name.length + 3)).trimStart();
  }
}

// §5.2: the run a prompt opens. `root` resolves a blueprint path to read its Progress; a plain root (`selo` false) opens `free` runs only.
export function parsePrompt(prompt, root, selo = true) {
  const clean = stripWrappers(prompt);
  const m = /^\s*\/selo:([\w-]+)\b\s*([\s\S]*)$/.exec(clean);
  const skill = selo && m && skillOf(m[1]) ? m[1] : null;
  // `lane`: the reading of selo-ops 2.4.0, kept one version for older readers (`/selo:run` was `free`).
  const lane = skill && skill !== "run" ? skill : "free";
  const rest = (skill ? m[2] : clean).trim();
  const file = /(\S*\.planning\/blueprints\/[^\s/]+\.md)/.exec(slash(rest))?.[1] ?? null;
  const text = file && root && existsSync(resolve(root, file)) ? readFileSync(resolve(root, file), "utf8") : null;
  const stage = /—\s*stage\s+(\d+)/.exec(rest)?.[1];
  // `mode`: read from the whole text, before `request` is cut at 200 characters.
  const mode = skill === "fastlane" && /—\s*iterate\b/.test(rest) ? "iterate" : null;
  const run = { lane, flow: skillOf(skill)?.flow ?? "free", skill, mode, request: rest.slice(0, 200), blueprint: file ? basename(file, ".md") : null, step: null, lastStep: null };
  if (skill === "build") Object.assign(run, { step: stage ? `stage:${stage}` : text ? stepOf(text) : "stage:1", lastStep: stage ? `stage:${stage}` : null });
  else if (skill === "autopilot") run.step = file ? (text ? stepOf(text) : "stage:1") : null;
  else if (skill === "review") run.step = file ? "review" : null;
  else run.blueprint = null;
  return run;
}

const COMMIT_SUBJECT = /^[a-z]+\([^)]+\)!?: /;
// A next step of the done footer: Next: {summary} · `{prompt}`. The last ` · ` splits them.
const NEXT_LINE = /^Next:\s*(.+)\s+·\s+`([^`]+)`$/;

// §5.3: where the run stands at the end of a turn, from its last message and the turn's wrap_up ask.
export function classifyEnd(message, ask = null) {
  const text = String(message ?? "").replace(/\r\n/g, "\n").trimEnd();
  const lines = text.split("\n");
  const at = lines.findLastIndex((l) => /^##\s*✅\s*JOB DONE\s*$/.test(l.trim()));
  if (at >= 0) {
    const tail = lines.slice(at + 1).map((l) => l.trim()).filter(Boolean);
    if (tail.every((l) => l.startsWith(">") || /^`[0-9a-f]{4,40}`/.test(l) || NEXT_LINE.test(l))) {
      const recap = tail.find((l) => l.startsWith(">"))?.replace(/^>\s*/, "") ?? null;
      const commits = tail.map((l) => /^`([0-9a-f]{4,40})`\s+(.*)$/.exec(l)).filter(Boolean).map((c) => ({ sha: c[1], subject: c[2].split(" · ")[0].trim() }));
      const next = tail.map((l) => NEXT_LINE.exec(l)).filter(Boolean).map((n) => ({ text: n[1].trim(), prompt: n[2] }));
      return { phase: "job-done", recap: { text: recap, commits }, next, pendingCommit: null, question: null };
    }
  }
  if (lines.at(-1)?.trim() === "```") {
    const open = lines.slice(0, -1).findLastIndex((l) => l.trim().startsWith("```"));
    const block = open >= 0 ? lines.slice(open + 1, -1) : [];
    if (COMMIT_SUBJECT.test(block[0] ?? "")) return { phase: "awaiting-commit", pendingCommit: { subject: block[0].trim(), body: block.slice(1).join("\n").trim() }, question: null, recap: null, next: [] };
  }
  const last = lines.map((l) => l.trim()).filter(Boolean).at(-1) ?? "";
  if (ask || last.endsWith("?")) return { phase: "awaiting-answer", question: String(ask || last).slice(0, 200), pendingCommit: null, recap: null, next: [] };
  return { phase: "turn-ended", pendingCommit: null, question: null, recap: null, next: [] };
}

// §5.5: can the person close the session. A plain root has no done footer: an ended turn does not block there.
export function closeOf(s) {
  const cur = s.runs.find((r) => !r.agentId) ?? null;
  const blockers = [];
  if (cur?.phase !== "job-done" && s.selo !== false) blockers.push("not-done");
  if (cur?.pendingCommit) blockers.push("pending-commit");
  if (cur?.phase === "awaiting-answer") blockers.push("question");
  if (s.dirtyFiles.length) blockers.push("dirty-files");
  if (s.backgroundTasks.some((t) => t.status === "running")) blockers.push("background-tasks");
  if (s.runs.some((r) => r.agentId && r.phase === "working")) blockers.push("subagents");
  return { ok: blockers.length === 0, blockers };
}

export const newSession = (id, root) => ({
  schemaVersion: SCHEMA, writtenAt: now(), writtenBy: VERSION, sessionId: id, root: normRoot(root), rootKey: rootKey(root), selo: true, repo: null, startedAt: now(), status: "live",
  transcriptPath: null, model: null, permissionMode: null, effort: null, pendingAgents: [], touchedFiles: [], dirtyFiles: [], backgroundTasks: [], close: { ok: false, blockers: ["not-done"] }, runs: [], current: null, ask: null, usage: null, context: null,
});

const openRun = (s, fields, agentId = null) => {
  const since = now();
  const run = { id: `${s.sessionId}:${Date.parse(since)}`, agentId, agentType: null, lane: "free", flow: "free", skill: null, mode: null, request: "", task: null, blueprint: null, sheets: [], step: null, lastStep: null, substep: null, error: null, phase: "working", pendingCommit: null, question: null, recap: null, next: [], commits: [], resumePrompt: null, prompt: null, requestedModel: null, usage: null, transcriptFrom: null, trail: [], trailCut: false, since, updatedAt: since, ...fields };
  s.runs = [run, ...s.runs].slice(0, MAX_RUNS);
  return run;
};
const mainRun = (s) => s.runs.find((r) => !r.agentId) ?? null;
const runOf = (s, agentId) => (agentId ? s.runs.find((r) => r.agentId === agentId) ?? openRun(s, {}, agentId) : mainRun(s));
const addSheets = (run, sheets) => (run.sheets = [...new Set([...run.sheets, ...sheets.filter(Boolean)])]);

// A selo skill on a run (`p` from parsePrompt): a run with no skill yet takes it whole, as its prompt would have;
// later, `skill` is replaced, `flow` set by the first lane skill only, a build's step taken.
const setSkill = (run, p) => {
  if (!run.skill && flowOf(run) === "free") return Object.assign(run, p);
  run.skill = p.skill;
  if (flowOf(run) === "free") run.flow = p.flow;
  if (p.step) run.step = p.step;
  run.blueprint ??= p.blueprint;
  run.mode ??= p.mode;
};
// A tool skill has no end event: the run's lane skill comes back at its next mark or its done footer.
// An autopilot main run keeps its subagent's skill.
const laneBack = (run) => {
  if (skillOf(run.skill)?.kind !== "tool" || (flowOf(run) === "autopilot" && !run.agentId)) return;
  const lane = [...(run.trail ?? [])].reverse().find((x) => skillOf(x.skill)?.kind === "lane")?.skill ?? (skillOf(run.lane)?.kind === "lane" ? run.lane : null);
  if (lane) run.skill = lane;
};
// The trail: one entry at each change of skill, step, substep or phase; the flat fields are its last entry.
// A run written before 2.5.0 gets none: its history is unknown.
export const syncTrail = (run, at = now()) => {
  const trail = run.trail;
  if (!Array.isArray(trail)) return;
  const last = trail.at(-1);
  const entry = { at, skill: run.skill ?? null, step: run.step ?? null, substep: run.substep ?? null, phase: run.phase };
  run.trailCut ??= false;
  if (last && ["skill", "step", "substep", "phase"].every((k) => last[k] === entry[k])) return;
  trail.push(entry);
  if (trail.length > TRAIL_MAX) {
    trail.splice(0, trail.length - TRAIL_MAX);
    run.trailCut = true;
  }
};

// A background subagent's end comes back as a prompt holding nothing but `<task-notification>` blocks (§5.5 of the 2.2 proposal).
export const isTaskNotification = (prompt) =>
  /<task-notification>/.test(prompt ?? "") && !stripWrappers(String(prompt).replace(/<task-notification>[\s\S]*?<\/task-notification>/g, "")).trim();

// The agent a hand-back comes from, when the prompt holds nothing but `<agent-message from="…">` blocks,
// after the harness's blocks, the "Another Claude session sent a message:" preamble and the harness's trailing
// paragraph (only its own line: any text after it is the person's); else null. Read on the raw prompt:
// stripWrappers would drop a leading `<agent-message>` block whole, as the hook gets it (no preamble).
export function handBackFrom(prompt) {
  const text = String(prompt ?? "");
  const from = /<agent-message from="([^"]+)"/.exec(text)?.[1];
  if (!from) return null;
  const rest = text
    .replace(/<agent-message\b[\s\S]*?(?:<\/agent-message>|$)/g, "")
    .replace(/Another Claude session sent a message:/g, "")
    .replace(/^That "other Claude session" is an agent working inside this same session\b.*$/gm, "");
  return stripWrappers(rest).trim() ? null : from;
}

// What a prompt does to the main run: `keep` it (an answer, a hand-back, a task notification) or `open` a new one.
// Called before the lock (to read the settled run's slice) and under it (to apply the prompt), on the same rules.
export function promptAction(s, prompt, root) {
  const cur = mainRun(s);
  if (isTaskNotification(prompt)) return { kind: "keep", cur, p: null };
  // A subagent's hand-back comes as a prompt: it continues the main run, it asks nothing.
  const from = handBackFrom(prompt);
  if (from && cur && s.runs.some((r) => r.agentId === from)) return { kind: "keep", cur, p: null };
  const p = parsePrompt(prompt, root, s.selo);
  // A short `/fastlane …` comes raw: it opens a run (retagged from the transcript), it answers nothing.
  const short = s.selo && skillOf(/^\/([\w-]+)(?=\s|$)/.exec(stripWrappers(prompt))?.[1]);
  // A prompt that answers the run (a commit's yes, an answer, a word after an Esc) keeps it.
  if (!p.skill && !short && cur && ["awaiting-commit", "awaiting-answer", "working"].includes(cur.phase)) return { kind: "keep", cur, p };
  return { kind: "open", cur, p };
}

// A run's usage set, the session's totals moved by the difference: a run dropped past MAX_RUNS keeps its share.
const setUsage = (s, run, usage) => {
  s.usage = addUsage(subUsage(s.usage, run.usage), usage);
  run.usage = usage;
};

// A usage read before the lock lands only on the run it was read for: a main run by its id and transcriptFrom, a subagent run by its agent.
const applyRead = (s, read) => {
  if (!read) return;
  const run = read.runId === null
    ? s.runs.find((r) => r.agentId === read.agentId)
    : s.runs.find((r) => r.id === read.runId && (r.agentId ?? null) === read.agentId && (r.transcriptFrom ?? null) === read.from);
  if (run) setUsage(s, run, read.usage);
};

const sizeOf = (path) => {
  try {
    return path ? statSync(path).size : 0;
  } catch {
    return 0;
  }
};

// Before the lock (§5.3 of the 2.2 proposal): the slice of the run this hook reads, and the transcript's size
// at a prompt. `s` is the session file as read without the lock. Returns the `ctx` of applyHook.
// A main run's usage on its slice [transcriptFrom, to). A run written by 1.0.0 has no transcriptFrom: it gets
// no usage, never the whole transcript. An empty slice (the transcript replaced) changes nothing.
const mainRead = (path, run, to, settled) => {
  if (!run || run.transcriptFrom == null || !path) return null;
  try {
    const { text, partial } = readSlice(path, run.transcriptFrom, to);
    if (!text) return null;
    return { runId: run.id, agentId: null, from: run.transcriptFrom, usage: readUsage(text, { prompts: true, settled, partial }) };
  } catch {
    return null; // the next read catches up
  }
};

// A subagent's title and requested model from the meta file beside its transcript, its prompt from its first user row.
export function agentOf(path, text) {
  let meta = {};
  try {
    meta = JSON.parse(readFileSync(path.replace(/\.jsonl$/, ".meta.json"), "utf8"));
  } catch {
    // no meta file: the Agent call's description stays
  }
  let prompt = null;
  for (const line of text.split("\n")) {
    if (!line.includes('"user"')) continue;
    try {
      const row = JSON.parse(line);
      if (row.type !== "user") continue;
      const c = row.message?.content;
      prompt = (typeof c === "string" ? c : Array.isArray(c) ? c.filter((p) => p?.type === "text").map((p) => p.text).join("\n") : "").slice(0, PROMPT_CAP) || null;
      break;
    } catch {
      // a line being written
    }
  }
  return { task: meta.description ? String(meta.description).slice(0, 200) : null, requestedModel: meta.model ? String(meta.model) : null, prompt };
}

const ROW = /"type"\s*:\s*"(?:assistant|user)"/;

// The selo skill a run's prompt typed as a command, from the run's first user rows (before any assistant row):
// `/selo:{name}`, or a short `/{name}` whose next row's skill base directory is the selo plugin's (not a project's
// own `.claude/skills/{name}`, nor another plugin's). `seen`: the prompt's row is in the text.
export function commandOf(text) {
  let cmd = null;
  let seen = false;
  for (const line of text.split("\n")) {
    if (!ROW.test(line)) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue; // a line cut by the read
    }
    if (row.type === "assistant") break;
    if (row.type !== "user" || row.isSidechain) continue;
    const c = row.message?.content;
    const t = typeof c === "string" ? c : Array.isArray(c) ? c.filter((p) => p?.type === "text").map((p) => p.text ?? "").join("\n") : "";
    if (cmd) {
      const base = /^Base directory for this skill:\s*(.+)$/m.exec(t)?.[1].trim();
      if (base) return { seen, cmd: /[\\/]selo(?:[\\/]\d[\w.-]*)?[\\/]skills[\\/]([\w-]+)[\\/]?$/.exec(base)?.[1] === cmd.name ? cmd : null };
      continue;
    }
    if (!t.trim() || t.startsWith("<local-command-")) continue;
    seen = true;
    const name = /<command-name>\/?([^<]+)<\/command-name>/.exec(t)?.[1].trim();
    if (!name) return { seen, cmd: null };
    const args = /<command-args>([\s\S]*?)<\/command-args>/.exec(t)?.[1].trim() ?? "";
    const short = name.replace(/^selo:/, "");
    if (!skillOf(short)) return { seen, cmd: null };
    if (name.startsWith("selo:")) return { seen, cmd: { name: short, args } };
    cmd = { name: short, args };
  }
  return { seen, cmd: null };
}

// A main run opened by a raw prompt that may be a short command: read once, at its first tool hook or its Stop.
const commandPending = (s, run) => s.selo !== false && run && !run.agentId && run.flow === "free" && !run.skill && run.phase === "working" && !run.commandRead && run.transcriptFrom != null;

const commandRead = (path, run) => {
  try {
    const { text } = readSlice(path, run.transcriptFrom, run.transcriptFrom + 256 * 1024);
    return { runId: run.id, ...commandOf(text) };
  } catch {
    return null;
  }
};

export function readFor(s, e, root) {
  const path = e.transcript_path ?? s.transcriptPath;
  const main = mainRun(s);
  const command = ["PreToolUse", "PostToolUse", "Stop"].includes(e.hook_event_name) && !e.agent_id && path && commandPending(s, main) ? commandRead(path, main) : null;
  return { ...readEvent(s, e, root, path), command };
}

function readEvent(s, e, root, path) {
  const event = e.hook_event_name;
  if (event === "UserPromptSubmit") {
    const size = sizeOf(path);
    const act = promptAction(s, e.prompt, root);
    return { size, opens: act.kind === "open", read: act.kind === "open" ? mainRead(path, act.cur, size, true) : null };
  }
  // The baseline is read once, before the lock.
  if (event === "Stop") return { read: mainRead(path, mainRun(s), null, false), baseline: s.context?.baseline ?? (path ? firstContext(path) : null) };
  if (event === "SessionEnd") return { read: mainRead(path, mainRun(s), null, true) };
  if (event === "SubagentStop" && e.agent_id && e.agent_transcript_path) {
    const { text, partial } = readSlice(e.agent_transcript_path, 0, null);
    if (!text) return {};
    // Matched by its agent alone: its run may not be in the file read without the lock yet.
    return { read: { runId: null, agentId: e.agent_id, from: null, usage: readUsage(text, { prompts: false, sidechain: true, settled: true, partial }) }, agent: agentOf(e.agent_transcript_path, text) };
  }
  return {};
}

// The assistant messages of a transcript, newest first, read from its tail.
function* assistantTail(path) {
  let text;
  try {
    const size = statSync(path).size;
    const len = Math.min(size, 512 * 1024);
    const buf = Buffer.alloc(len);
    const fd = openSync(path, "r");
    readSync(fd, buf, 0, len, size - len);
    closeSync(fd);
    text = buf.toString("utf8");
  } catch {
    return; // no transcript
  }
  for (const line of text.split("\n").reverse()) {
    if (!line.includes('"assistant"')) continue;
    try {
      const e = JSON.parse(line);
      if (e.type === "assistant" && e.message && !e.isSidechain) yield e.message;
    } catch {
      // a line cut by the tail read
    }
  }
}

// The last assistant text of a transcript: for a Stop input without last_assistant_message.
export function lastAssistantText(path) {
  for (const { content } of assistantTail(path)) {
    const text = Array.isArray(content) ? content.filter((c) => c.type === "text").map((c) => c.text).join("\n") : typeof content === "string" ? content : "";
    if (text.trim()) return text;
  }
  return null;
}

// The model of the last assistant message; no hook input carries it (SessionStart rarely does).
export function lastModel(path) {
  for (const { model } of assistantTail(path)) if (model && model !== "<synthetic>") return model;
  return null;
}

const contextOf = (u) => (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0);

// The lead's context now: what its last API call sent (input, cache read, cache write), and that call's model.
export function lastContext(path) {
  for (const { model, usage: u } of assistantTail(path)) {
    if (!u || model === "<synthetic>") continue;
    return { tokens: contextOf(u), model: model ?? null };
  }
  return null;
}

// The tokens of the session's first API call: the base instructions (system prompt, tools, instruction files)
// and the first prompt, re-read on every later call. From the transcript's first 2 MB.
export function firstContext(path) {
  const { text } = readSlice(path, 0, 2 * 1024 * 1024);
  for (const line of text.split("\n")) {
    if (!line.includes('"assistant"')) continue;
    try {
      const row = JSON.parse(line);
      const u = row.message?.usage;
      if (row.type === "assistant" && !row.isSidechain && u && row.message.model !== "<synthetic>")
        return { input: u.input_tokens ?? 0, cacheRead: u.cache_read_input_tokens ?? 0, cacheWrite: u.cache_creation_input_tokens ?? 0, output: u.output_tokens ?? 0 };
    } catch {
      // a line cut by the read
    }
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

// One hook: `s` is the session (mutated), `e` the hook's input, `ctx` what readFor read before the lock
// (`size`: the transcript's size at a prompt; `read`: a run's usage). Returns true when the project needs a rescan.
export function applyHook(s, e, root, ctx = {}) {
  const rescan = applyEvent(s, e, root, ctx);
  for (const r of s.runs) syncTrail(r);
  return rescan;
}

function applyEvent(s, e, root, ctx) {
  const event = e.hook_event_name;
  // A short command read from the transcript retags its run as its `/selo:` form would have, before the event.
  const main = mainRun(s);
  if (ctx.command && main?.id === ctx.command.runId && commandPending(s, main)) {
    // The run was that skill from its prompt: its free entries leave the trail.
    if (ctx.command.cmd) Object.assign(main, parsePrompt(`/selo:${ctx.command.cmd.name} ${ctx.command.cmd.args}`, root), { trail: [] });
    if (ctx.command.seen) main.commandRead = true;
  }
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
    const { kind, cur, p } = promptAction(s, e.prompt, root);
    if (kind === "keep") {
      if (cur) {
        Object.assign(cur, { phase: "working", pendingCommit: null, question: null, error: null });
        touch(cur);
      }
      return false;
    }
    // The previous main run is settled on its slice up to now, then the new one starts where it ends.
    // When the read before the lock failed or kept the run (a prompt between the two), both are done here: rare.
    const path = e.transcript_path ?? s.transcriptPath;
    const size = ctx.size ?? sizeOf(path);
    applyRead(s, ctx.opens ? ctx.read : mainRead(path, cur, size, true));
    openRun(s, { ...p, transcriptFrom: size });
    return false;
  }
  // SubagentStart carries no prompt: the Agent call's task waits here for the subagent of its type.
  if (event === "PreToolUse" && (e.tool_name === "Agent" || e.tool_name === "Task")) {
    const i = e.tool_input ?? {};
    const task = String(i.description || i.prompt || "").slice(0, 200);
    const prompt = i.prompt ? String(i.prompt).slice(0, PROMPT_CAP) : null;
    s.pendingAgents = [...(s.pendingAgents ?? []), { type: String(i.subagent_type || "general-purpose"), task, prompt }].slice(-10);
    return false;
  }
  if (event === "PreToolUse" && e.tool_name === "Skill") {
    // `selo:fastlane`, or the short `fastlane` when it is a selo skill's name.
    const name = String(e.tool_input?.skill ?? "").replace(/^selo:/, "");
    if (!s.selo || !skillOf(name)) return false;
    const p = parsePrompt(`/selo:${name} ${e.tool_input?.args ?? ""}`, root);
    if (agentId) {
      const run = runOf(s, agentId);
      setSkill(run, p);
      touch(run);
      // An autopilot stands for its subagents: its skill and step are the ones of the subagent it spawned last.
      // A tool skill with no blueprint (a try) keeps the autopilot's step.
      if (flowOf(main) === "autopilot") Object.assign(main, { skill: p.skill, step: p.step ?? (skillOf(p.skill).kind === "tool" ? main.step : null), blueprint: main.blueprint ?? p.blueprint, updatedAt: t });
    } else if (main && main.phase === "working") {
      setSkill(main, p);
      touch(main);
    }
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
      // A plain root has no blueprints nor sheets.
      const bp = s.selo && /^\.planning\/blueprints\/([^/]+)\.md$/.exec(rel)?.[1];
      if (bp) run.blueprint = bp;
      const sheet = s.selo && specSlug(rel);
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
      if (!s.selo) return false;
      const run = runOf(s, agentId);
      if (!run) return false;
      laneBack(run);
      // An autopilot stands for its subagents: their marks are its marks too.
      const auto = agentId && flowOf(main) === "autopilot";
      if (auto && run.skill) main.skill = run.skill;
      for (const r of auto ? [run, main] : [run]) {
        if (SUBSTEPS.includes(mark[1])) r.substep = mark[1];
        addSheets(r, mark[2].trim().split(/\s+/).filter((w) => /^[\w/-]+$/.test(w)));
        touch(r);
      }
      return false;
    }
    if (!isCommit(command)) return false;
    // git prints `[branch sha] subject` on success: that sha is this command's commit, never another
    // session's that landed meanwhile. Only a quiet commit (`-q`) falls back to HEAD.
    const printed = /\[[^\]\s]+(?: \(root-commit\))? ([0-9a-f]{7,40})\]/.exec(JSON.stringify(e.tool_response ?? ""))?.[1];
    // No `[branch sha]` line in the output of a loud commit: it failed (nothing staged, a refusing hook).
    if (!printed && e.tool_response != null && !/\s(?:-q|--quiet)\b/.test(command)) return false;
    const head = git(root, ["log", "-1", "--format=%h%x09%cI%x09%s%x00%B", printed ?? "HEAD"]);
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
    const spec = specLine && s.selo ? parseSpecLine(`Spec: ${specLine}`) : null;
    if (spec?.pending) run.blueprint ??= basename(spec.pending, ".md");
    addSheets(run, Object.keys(spec?.groups ?? {}));
    if (agentId && flowOf(main) === "autopilot") main.commits.push(commit);
    s.pendingStep = { agentId, subject };
    touch(run);
    return true;
  }
  if (event === "SubagentStart") {
    const type = String(e.agent_type ?? "");
    // shortcut: two calls of one type started together may swap tasks; upgrade if a SubagentStart ever carries its prompt.
    const pending = s.pendingAgents ?? [];
    const i = pending.findIndex((p) => p.type === type);
    const { task = null, prompt = null } = i >= 0 ? pending.splice(i, 1)[0] : {};
    s.pendingAgents = pending;
    openRun(s, { agentType: type || null, request: type, task, prompt }, agentId);
    return false;
  }
  if (event === "SubagentStop") {
    const run = agentId && s.runs.find((r) => r.agentId === agentId);
    if (run) Object.assign(run, classifyEnd(e.last_assistant_message ?? lastAssistantText(e.agent_transcript_path)), { updatedAt: t });
    if (run?.phase === "job-done") laneBack(run);
    // Its own files are the truth: they fix a task swapped between two calls of one type.
    const a = ctx.agent;
    if (run && a) Object.assign(run, { task: a.task ?? run.task, prompt: a.prompt ?? run.prompt ?? null, requestedModel: a.requestedModel ?? run.requestedModel ?? null });
    applyRead(s, ctx.read);
    return false;
  }
  if (event === "Stop") {
    const cur = mainRun(s);
    if (cur) {
      Object.assign(cur, classifyEnd(e.last_assistant_message ?? lastAssistantText(e.transcript_path), s.ask), { updatedAt: t });
      if (cur.phase === "job-done") laneBack(cur);
      cur.resumePrompt = resumeOf(cur, root);
    }
    // Read at Stop, the run may lack its last message: settled at the next run's prompt or at SessionEnd.
    applyRead(s, ctx.read);
    s.ask = null;
    s.model = lastModel(e.transcript_path) ?? s.model;
    const context = lastContext(e.transcript_path);
    if (context) s.context = { ...context, baseline: s.context?.baseline ?? ctx.baseline ?? null };
    s.backgroundTasks =(e.background_tasks ?? []).map((b) => ({ id: String(b.id ?? ""), type: String(b.type ?? ""), status: String(b.status ?? ""), description: String(b.description ?? "") }));
    // A foreground subagent cannot outlive its turn: one with no SubagentStop (an Esc) is stopped.
    if (!s.backgroundTasks.some((b) => b.status === "running")) for (const r of s.runs) if (r.agentId && r.phase === "working") Object.assign(r, { phase: "stopped", updatedAt: t });
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
    applyRead(s, ctx.read);
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
  if (!run || !["blueprint", "autopilot"].includes(flowOf(run))) return;
  const step = stepAfter(run, p.subject, project);
  if (!step) return;
  run.step = step;
  if (p.agentId && flowOf(main) === "autopilot") Object.assign(main, { step, blueprint: main.blueprint ?? run.blueprint });
};

// `deadline`: when the lock must have been taken; a hook stops itself at 4.5 s.
export async function handle(e, { dir = opsDir(), deadline = Date.now() + 4000 } = {}) {
  if (!e.cwd || !e.session_id) return;
  const { root, selo } = rootOf(e.cwd);
  const file = join(dir, "sessions", `${e.session_id}.json`);
  // The transcript is read before the lock (each write is an atomic rename): a slow read never makes a
  // concurrent hook of the session wait for the lock and lose its write. Under it, only JSON is read and written.
  let ctx = {};
  try {
    ctx = readFor({ ...newSession(e.session_id, root), ...(readJson(file) ?? {}), selo }, e, root);
  } catch {
    // no usage this time: the next Stop or the settling read catches up
  }
  // The read ate the hook's time: nothing is written rather than a write cut by the 4.5 s exit.
  if (Date.now() >= deadline) return;
  await withLock(
    join(dir, "locks", String(e.session_id)),
    () => {
      const s = { ...newSession(e.session_id, root), ...(readJson(file) ?? {}), selo };
      const rescan = applyHook(s, e, root, ctx);
      const project = rescan ? scanProject(root, { dir, selo }) : null;
      moveStep(s, project);
      for (const r of s.runs) syncTrail(r);
      s.writtenAt = now();
      s.writtenBy = VERSION;
      s.current = mainRun(s);
      writeJson(file, s);
      // After the session file: the project's blueprints list the sessions working on them, this one included.
      if (project) {
        const live = liveSessions(dir, project.root);
        for (const b of project.blueprints) b.sessions = live.filter((x) => x.current?.blueprint === b.name).map((x) => x.sessionId);
        writeJson(join(dir, "projects", `${rootKey(root)}.json`), project);
      }
    },
    { timeoutMs: Math.min(2000, deadline - Date.now()), staleMs: 10000 },
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const started = Date.now();
  const [mode, ...args] = process.argv.slice(2);
  if (mode === "scan") {
    try {
      const { root, selo } = rootOf(args[0] ?? process.cwd());
      writeProject(root, { selo });
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
      // Any other tool's PreToolUse only reads a short command, once per run: checked on the file read without the lock.
      if (e.hook_event_name === "PreToolUse" && !/^(Skill|Agent|Task)$/.test(e.tool_name)) {
        const s = readJson(join(opsDir(), "sessions", `${e.session_id}.json`));
        if (e.agent_id || !s?.runs || !commandPending(s, mainRun(s))) process.exit(0);
      }
      await handle(e, { deadline: started + 4000 });
    } catch {
      // fail silent
    }
  }
  // `mark` does nothing: the PostToolUse hook reads its command.
  process.exit(0);
}
