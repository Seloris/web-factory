import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { blueprintOf, classifyEnd, closeOf, newSession, parsePrompt, rootKey } from "../scripts/ops.mjs";

const script = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "ops.mjs");
const BP = ".planning/blueprints/2026-10-21-due-date.md";
const blueprint = (progress = "- [ ] Stage 1 — api\n- [ ] Stage 2 — web\n- [ ] Review\n- [ ] Browser test\n- [ ] Spec merged") => `# Due dates

Pages: \`home\` · Domain: \`todo\` · Components: \`api\`, \`web\`

## Spec delta
- home + FR-03 — A todo shows its due date.
- todo ~ BR-01 — « a todo has a title » → « a todo has a title and a due date »

## Mockup
![the list](./assets/due.png)

## Business decisions
- Late todos? → red (visible)

## Stages
1. api — \`feat(due-date): api — optional due date\`
2. web — \`feat(due-date): web — due dates in the list\`

## Progress
${progress}
`;

test("rootKey names a root as ~/.claude/projects does", () => {
  assert.equal(rootKey("C:/WS/ia-projects/selo-ops"), "C--WS-ia-projects-selo-ops");
});

test("parsePrompt opens the run of §5.2", () => {
  assert.deepEqual(parsePrompt("/selo:fastlane add a filter"), { lane: "fastlane", request: "add a filter", blueprint: null, step: "fastlane", lastStep: null });
  assert.equal(parsePrompt("/selo:blueprint due dates").blueprint, null);
  assert.equal(parsePrompt("/selo:build .planning/blueprints/x.md — stage 2").step, "stage:2");
  assert.equal(parsePrompt("/selo:build .planning/blueprints/x.md — stage 2").lastStep, "stage:2");
  assert.equal(parsePrompt("/selo:build .planning/blueprints/x.md").blueprint, "x");
  assert.equal(parsePrompt("/selo:autopilot due dates").step, "blueprint");
  assert.equal(parsePrompt("/selo:review .planning/blueprints/x.md").step, "review");
  assert.equal(parsePrompt("/selo:try").lane, "try");
  assert.equal(parsePrompt("/selo:run all").lane, "free");
  assert.equal(parsePrompt("what does this do?").lane, "free");
  assert.equal(parsePrompt("x".repeat(300)).request.length, 200);
});

test("parsePrompt strips the harness's leading blocks before the 200-character cut", () => {
  const view = `<artifact-view-context artifact="a">\n${JSON.stringify({ context: { visibleArtboards: ["x".repeat(300)] } })}\n</artifact-view-context>\n`;
  assert.equal(parsePrompt(`${view}Make the edge draggable`).request, "Make the edge draggable");
  assert.equal(parsePrompt(`${view}<system-reminder>r</system-reminder>\nfix it`).request, "fix it");
  assert.equal(parsePrompt(`<pasted_content id="1">the pasted text</pasted_content>`).request, "the pasted text");
  assert.equal(parsePrompt(`${view}/selo:fastlane add a filter`).lane, "fastlane");
  assert.equal(parsePrompt(view).request, "");
  assert.equal(parsePrompt("<unclosed tag stays").request, "<unclosed tag stays");
});

test("classifyEnd reads the end of a turn (§5.3)", () => {
  const done = classifyEnd("Report.\n\n---\n## ✅ JOB DONE\n> Due dates on todos\n`f677536` feat(due-date): api — optional due date · branch `main` · not pushed\n");
  assert.equal(done.phase, "job-done");
  assert.deepEqual(done.recap, { text: "Due dates on todos", commits: [{ sha: "f677536", subject: "feat(due-date): api — optional due date" }] });
  assert.deepEqual(classifyEnd("Answer.\n---\n## ✅ JOB DONE\n> Nothing to commit").recap, { text: "Nothing to commit", commits: [] });
  assert.equal(classifyEnd("## ✅ JOB DONE\n> x\nAnd one more thing?").phase, "awaiting-answer");

  const commit = classifyEnd("Commit?\n\n```\nfeat(due-date): web — due dates\n\nSpec: pending (x.md)\n```");
  assert.equal(commit.phase, "awaiting-commit");
  assert.deepEqual(commit.pendingCommit, { subject: "feat(due-date): web — due dates", body: "Spec: pending (x.md)" });
  assert.equal(classifyEnd("```js\nconst a = 1\n```").phase, "turn-ended");

  assert.deepEqual(classifyEnd("Which one, A or B ?"), { phase: "awaiting-answer", question: "Which one, A or B ?", pendingCommit: null, recap: null });
  assert.equal(classifyEnd("Done here.", "Commit now?").question, "Commit now?");
  assert.equal(classifyEnd("Done here.").phase, "turn-ended");
  assert.equal(classifyEnd(null).phase, "turn-ended");
});

test("closeOf lists what keeps a session open (§5.5)", () => {
  const s = newSession("s", "C:/p");
  assert.deepEqual(closeOf(s).blockers, ["not-done"]);
  s.runs = [{ agentId: "a", phase: "working" }, { agentId: null, phase: "awaiting-commit", pendingCommit: { subject: "x" } }];
  s.dirtyFiles = ["a.ts"];
  s.backgroundTasks = [{ status: "running" }];
  assert.deepEqual(closeOf(s).blockers, ["not-done", "pending-commit", "dirty-files", "background-tasks", "subagents"]);
  s.runs = [{ agentId: null, phase: "job-done", pendingCommit: null }];
  s.dirtyFiles = [];
  s.backgroundTasks = [{ status: "completed" }];
  assert.deepEqual(closeOf(s), { ok: true, blockers: [] });
});

test("blueprintOf: state, stages, next prompt", () => {
  const ready = blueprintOf(BP, blueprint());
  assert.equal(ready.name, "2026-10-21-due-date");
  assert.equal(ready.state, "ready");
  assert.deepEqual(ready.sheets, ["home", "todo"]);
  assert.deepEqual(ready.components, ["api", "web"]);
  assert.equal(ready.mockup, ".planning/blueprints/assets/due.png");
  assert.deepEqual(ready.decisions, ["Late todos? → red (visible)"]);
  assert.deepEqual(ready.delta.map((d) => `${d.sheet} ${d.op} ${d.id}`), ["home + FR-03", "todo ~ BR-01"]);
  assert.deepEqual(ready.next, { label: "build", prompt: `/selo:build ${BP}`, autopilot: `/selo:autopilot ${BP}` });

  const subjects = new Map([["feat(due-date): api — optional due date", "abc1234"]]);
  const building = blueprintOf(BP, blueprint(), { subjects });
  assert.equal(building.state, "building");
  assert.equal(building.stages[0].sha, "abc1234");

  assert.equal(blueprintOf(BP, blueprint("- [x] Stage 1 — api\n- [x] Stage 2 — web\n- [ ] Review")).next.prompt, `/selo:review ${BP}`);
  assert.equal(blueprintOf(BP, blueprint("- [x] Stage 1 — api\n- [x] Stage 2 — web\n- [x] Review\n- [ ] Spec merged")).state, "merging");
  const done = blueprintOf(BP, blueprint("- [x] Stage 1 — api\n- [x] Stage 2 — web\n- [x] Review\n- [x] Spec merged"));
  assert.equal(done.state, "done");
  assert.equal(done.next, null);
  assert.equal(blueprintOf(BP, blueprint(), { draft: true }).state, "draft");
  assert.equal(blueprintOf(BP, blueprint().replace("\n\nPages:", "\n\nLegacy: 1.0 plan, moved.\n\nPages:")).state, "legacy");
});

// A selo project in a temp git repository, its blueprint committed.
const project = () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-ops-"));
  const g = (...args) => execFileSync("git", ["-c", "core.autocrlf=false", "-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir, encoding: "utf8" });
  g("init", "-q", "-b", "main");
  writeFileSync(join(dir, "selo.yaml"), "name: p\ncomponents:\n  - {name: api, path: api}\n  - {name: web, path: web, needs: [api]}\n");
  mkdirSync(join(dir, ".planning", "pages"), { recursive: true });
  mkdirSync(join(dir, ".planning", "domain"));
  mkdirSync(join(dir, ".planning", "blueprints"));
  writeFileSync(join(dir, ".planning", "pages", "home.md"), "# Home\n\nRoute: `/` · Domain: `todo`\n\n## List\n\n- **FR-01** — Lists todos.\n- **FR-02** — Adds one.\n\nRetired: FR-00\n");
  writeFileSync(join(dir, ".planning", "domain", "todo.md"), "# Todo\n\n- **BR-01** — a todo has a title\n");
  writeFileSync(join(dir, BP), blueprint());
  g("add", ".");
  g("commit", "-q", "-m", "docs(due-date): blueprint");
  return { dir, g };
};

const hook = (env, input) => execFileSync(process.execPath, [script, "hook"], { input: JSON.stringify(input), env: { ...process.env, SELO_OPS_DIR: env }, encoding: "utf8" });

test("hooks write the session and project files of a build", () => {
  const { dir, g } = project();
  const ops = mkdtempSync(join(tmpdir(), "selo-ops-dir-"));
  const base = { session_id: "s1", cwd: dir, transcript_path: join(dir, "t.jsonl"), permission_mode: "auto", effort: { level: "high" } };
  const session = () => JSON.parse(readFileSync(join(ops, "sessions", "s1.json"), "utf8"));
  const projectFile = () => JSON.parse(readFileSync(join(ops, "projects", `${rootKey(dir)}.json`), "utf8"));

  assert.equal(hook(ops, { ...base, hook_event_name: "SessionStart", model: "claude-opus-5-5" }), "");
  assert.equal(session().status, "live");
  assert.equal(session().model, "claude-opus-5-5");
  assert.equal(session().effort, "high");

  hook(ops, { ...base, hook_event_name: "UserPromptSubmit", prompt: `/selo:build ${BP}` });
  assert.equal(session().current.lane, "build");
  assert.equal(session().current.step, "stage:1");
  assert.equal(session().current.blueprint, "2026-10-21-due-date");

  mkdirSync(join(dir, "api"));
  writeFileSync(join(dir, "api", "due.ts"), "export {};\n");
  hook(ops, { ...base, hook_event_name: "PostToolUse", tool_name: "Write", tool_input: { file_path: join(dir, "api", "due.ts") } });
  hook(ops, { ...base, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: `node "${script}" mark tests home` } });
  assert.deepEqual(session().touchedFiles, ["api/due.ts"]);
  assert.equal(session().current.substep, "tests");
  assert.deepEqual(session().current.sheets, ["home"]);

  // The model in use comes from the transcript: the last real assistant message, not a synthetic one.
  const transcript = join(ops, "t.jsonl");
  const line = (model) => JSON.stringify({ type: "assistant", message: { model, content: [{ type: "text", text: "x" }] } });
  writeFileSync(transcript, [line("claude-sonnet-5-5"), line("<synthetic>"), ""].join("\n"));
  hook(ops, { ...base, transcript_path: transcript, hook_event_name: "Stop", last_assistant_message: "Stage 1 done.\n\n```\nfeat(due-date): api — optional due date\n\nSpec: pending (.planning/blueprints/2026-10-21-due-date.md)\n```" });
  assert.equal(session().model, "claude-sonnet-5-5");
  assert.equal(session().current.phase, "awaiting-commit");
  assert.deepEqual(session().dirtyFiles, ["api/due.ts"]);
  assert.deepEqual(session().close.blockers, ["not-done", "pending-commit", "dirty-files"]);
  assert.deepEqual(projectFile().blueprints[0].sessions, ["s1"]);

  hook(ops, { ...base, hook_event_name: "UserPromptSubmit", prompt: "oui" });
  assert.equal(session().runs.length, 1, "the yes keeps the run");
  assert.equal(session().current.phase, "working");

  const cmd = 'git commit --only -m "feat(due-date): api — optional due date" -m "Spec: pending (.planning/blueprints/2026-10-21-due-date.md)" -- api/due.ts';
  g("add", "api/due.ts");
  g("commit", "-q", "-m", "feat(due-date): api — optional due date", "-m", "Spec: pending (.planning/blueprints/2026-10-21-due-date.md)");
  const sha = g("log", "-1", "--format=%h").trim();
  hook(ops, { ...base, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: cmd }, tool_response: { stdout: "nothing added to commit", stderr: "" } });
  assert.equal(session().current.commits.length, 0, "a failed commit adds nothing, whatever HEAD is");
  hook(ops, { ...base, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: cmd }, tool_response: { stdout: `[main ${sha}] feat(due-date): api — optional due date\n 1 file changed` } });
  hook(ops, { ...base, hook_event_name: "PostToolUse", tool_name: "Bash", tool_input: { command: cmd } });
  const s = session();
  assert.equal(s.current.commits[0].sha, sha);
  assert.equal(s.current.commits.length, 1, "a commit is counted once");
  assert.equal(s.current.commits[0].spec, "pending (.planning/blueprints/2026-10-21-due-date.md)");
  assert.equal(s.current.step, "stage:2");

  hook(ops, { ...base, hook_event_name: "Stop", last_assistant_message: `Done.\n---\n## ✅ JOB DONE\n> API knows due dates\n\`${s.current.commits[0].sha}\` feat(due-date): api — optional due date · branch \`main\` · not pushed` });
  assert.equal(session().current.phase, "job-done");
  assert.deepEqual(session().close, { ok: true, blockers: [] });
  assert.equal(session().current.resumePrompt, `/selo:build ${BP}`);

  const p = projectFile();
  assert.equal(p.schemaVersion, 1);
  assert.equal(p.branch, "main");
  assert.equal(p.aheadCount, null);
  assert.equal(p.unpushedCount, null);
  assert.equal(p.manifest.name, "p");
  assert.deepEqual(p.manifest.components.map((c) => c.name), ["api", "web"]);
  assert.equal(p.blueprints[0].state, "building");
  assert.equal(p.blueprints[0].stages[0].sha, s.current.commits[0].sha);
  const home = p.sheets.find((x) => x.slug === "home");
  assert.deepEqual(home.ids, { fr: 2, br: 0, retired: 1, next: { fr: "FR-03", br: "BR-01" } });
  assert.equal(home.route, "/");
  assert.equal(home.lastCommit.subject, "docs(due-date): blueprint");
  assert.deepEqual(home.openBlueprints, ["2026-10-21-due-date"]);
  assert.equal(p.sheets.find((x) => x.slug === "todo").kind, "domain");

  hook(ops, { ...base, hook_event_name: "UserPromptSubmit", prompt: "/selo:fastlane rename a label" });
  hook(ops, { ...base, hook_event_name: "SessionEnd" });
  assert.equal(session().status, "ended");
  assert.equal(session().current.phase, "stopped");
  assert.equal(session().runs.length, 2);
});

test("subagents: an autopilot stands for the runs it spawns", () => {
  const { dir } = project();
  const ops = mkdtempSync(join(tmpdir(), "selo-ops-dir-"));
  const base = { session_id: "s2", cwd: dir };
  const session = () => JSON.parse(readFileSync(join(ops, "sessions", "s2.json"), "utf8"));
  hook(ops, { ...base, hook_event_name: "UserPromptSubmit", prompt: `/selo:autopilot ${BP}` });
  hook(ops, { ...base, hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "Review the code", prompt: "p", subagent_type: "reviewer" } });
  hook(ops, { ...base, hook_event_name: "PreToolUse", tool_name: "Agent", tool_input: { description: "Build stage 1", prompt: "p" } });
  hook(ops, { ...base, hook_event_name: "SubagentStart", agent_id: "a1", agent_type: "general-purpose" });
  assert.equal(session().runs[0].task, "Build stage 1", "the task of the call of its type");
  assert.equal(session().runs[0].agentType, "general-purpose");
  assert.deepEqual(session().pendingAgents, [{ type: "reviewer", task: "Review the code" }]);
  hook(ops, { ...base, hook_event_name: "PreToolUse", tool_name: "Skill", agent_id: "a1", tool_input: { skill: "selo:build", args: `${BP} — stage 1 — autonomous` } });
  let s = session();
  assert.equal(s.runs[0].agentId, "a1");
  assert.equal(s.runs[0].lane, "build");
  assert.equal(s.runs[0].agentType, "general-purpose", "a skill keeps the subagent's type");
  assert.equal(s.current.lane, "autopilot");
  assert.equal(s.current.step, "stage:1");
  hook(ops, { ...base, hook_event_name: "PostToolUse", tool_name: "mcp__ccd_turn__wrap_up", tool_input: { recap: "r", ask: "Land it?" } });
  hook(ops, { ...base, hook_event_name: "PostToolUse", tool_name: "Bash", agent_id: "a1", tool_input: { command: "node ops.mjs mark code home" } });
  assert.equal(session().current.substep, "code", "the autopilot takes its subagent's marks");
  assert.deepEqual(session().current.sheets, ["home"]);
  const running = [{ id: "b1", type: "agent", status: "running", description: "build" }];
  hook(ops, { ...base, hook_event_name: "Stop", last_assistant_message: "Waiting.", background_tasks: running });
  s = session();
  assert.deepEqual(s.close.blockers, ["not-done", "question", "background-tasks", "subagents"]);
  assert.equal(s.current.question, "Land it?");
  hook(ops, { ...base, hook_event_name: "SubagentStop", agent_id: "a1", last_assistant_message: "## ✅ JOB DONE\n> stage 1" });
  assert.equal(session().runs[0].phase, "job-done");
  const before = session().runs.length;
  hook(ops, { ...base, hook_event_name: "UserPromptSubmit", prompt: `<agent-message from="a1">\n[Subagent hand-back] done</agent-message>` });
  s = session();
  assert.equal(s.runs.length, before, "a hand-back opens no run");
  assert.equal(s.current.lane, "autopilot");
  assert.equal(s.current.phase, "working");
  hook(ops, { ...base, hook_event_name: "SubagentStart", agent_id: "a2" });
  hook(ops, { ...base, hook_event_name: "Stop", last_assistant_message: "Stopped." });
  assert.equal(session().runs[0].phase, "stopped", "a subagent with no SubagentStop ends with its turn");
  assert.equal(session().close.blockers.includes("subagents"), false);
  hook(ops, { ...base, hook_event_name: "StopFailure", error: "overloaded" });
  assert.equal(session().current.phase, "stopped");
  assert.equal(session().current.error, "overloaded");
});

test("a hook outside a selo project writes nothing and stays silent", () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-ops-none-"));
  const ops = mkdtempSync(join(tmpdir(), "selo-ops-dir-"));
  assert.equal(hook(ops, { session_id: "s3", cwd: dir, hook_event_name: "SessionStart" }), "");
  assert.equal(existsSync(join(ops, "sessions")), false);
  assert.equal(execFileSync(process.execPath, [script, "hook"], { input: "not json", encoding: "utf8" }), "");
  assert.equal(execFileSync(process.execPath, [script, "mark", "code", "home"], { encoding: "utf8" }), "");
});

test("scan writes a project file without a session", () => {
  const { dir } = project();
  const ops = mkdtempSync(join(tmpdir(), "selo-ops-dir-"));
  execFileSync(process.execPath, [script, "scan", dir], { env: { ...process.env, SELO_OPS_DIR: ops } });
  const p = JSON.parse(readFileSync(join(ops, "projects", `${rootKey(dir)}.json`), "utf8"));
  assert.equal(p.blueprints[0].state, "ready");
  assert.equal(p.error, null);
});
