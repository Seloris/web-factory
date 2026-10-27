# Changelog

Why each change to the ops export exists. Newest first. The export's history before this plugin is in `plugins/selo/CHANGELOG.md` (2.0.0 to 2.0.3).

## 2026-10-27 — selo-ops 2.12.0: the changelog entry in the recap

selo 2.13.0 adds `.planning/changelog.md` and a `Changelog: {entry}` line to the done footer, after its commit lines. `classifyEnd` accepts that line in the footer and reads it into `recap.changelogEntry` (the entry as written in the file, `null` when the footer has none), so Selo Ops can show what the run brought in the project's own words. A run written before 2.12.0 has no such key.

## 2026-10-27 — selo-ops 2.11.0: `--{name}` options read

selo 2.12.0 writes a prompt's options as `--{name}` (` --autonomous`, ` --iterate`, ` --stage N`) instead of ` — {name}`. `parsePrompt` reads both forms for a run's `mode` and `step`, so a session started by an older Selo Ops or before selo 2.12.0 still gets its mode; a blueprint's `pilot` prompt is now written `--autonomous`.

## 2026-10-26 — selo-ops 2.10.0: the models from the person's settings

selo 2.8.0 moves the models out of `selo.yaml` into the person's `SELO_MODELS` and `SELO_MODEL_{ROLE}`; `scripts/manifest.mjs` is its copy. The project file's `manifest.preset` and `manifest.models` keep their shape and now carry the person's settings as the exporting process sees them: the hooks run with the session's `env`, but `ops.mjs scan` from a bare terminal sees the defaults unless the shell has them. `docs/revamp-2.0.0/ops-export.md` (§4) says so.

## 2026-10-26 — selo-ops 2.9.0: each checkout's mockups

Selo Ops' new « Nouvelle session » window offers to build a validated mockup (`/selo:pilot {request} — mockup {file}`, selo 2.7.0). It never runs git and reads only the export, so it cannot tell a mockup waiting to be built from one already built and committed.

- **`mockups: [{ file, title, validated, committed }]`** in the project file, one per `.planning/mockups/*.html` of the checkout, sorted by name; a worktree gets its own list, as blueprints do. `title` is the `<title>` text, else the file name; `validated` is selo's mark, `<meta name="selo:mockup" content="validated">`, looked for in the first 8 KB only (where selo 2.7.0 puts it); `committed` is false when git lists the file untracked, modified or staged (the same `changedPaths` that counts `changedCount`). Selo Ops shows `validated && !committed` as « maquettes à construire ».
- Read on every rescan (a commit, a `Stop`, `ops.mjs scan`), so a validation is seen at the end of its turn. A new field read leniently: `schemaVersion` stays 1.
- `docs/revamp-2.0.0/ops-export.md` (§4, the `Mockup` type) follows.

## 2026-10-25 — selo-ops 2.8.0: `pilot` replaces `autopilot`, its mode as the prompt says it

selo 2.6.0 replaces `/selo:autopilot` with `/selo:pilot`: interactive without a suffix, the old autopilot with ` — autonomous` (`docs/revamp-2.6.0/proposal.md` §3.2). The export carries the prompt's facts, nothing derived (the person: « toutes les données telles quelles, pas d'interprétation »).

- **`SKILLS.pilot`**, a lane skill, `flow: "pilot"`; `autopilot` is no longer a selo skill, so `/selo:autopilot` opens a `free` run. A run exported before keeps `flow`/`lane` `autopilot`, and is still read as an orchestrator (forward-only: `schemaVersion` stays 1).
- **`mode: "autonomous"`** when a selo skill's prompt carries ` — autonomous` (a `pilot` run, and a subagent's step); `iterate` stays the fastlane's.
- **The orchestrator rules** (« it stands for its subagents »: their skill, step, marks and commits taken by the main run) key on `flow === "pilot" && mode === "autonomous"`, or the old `autopilot` flow. An interactive pilot runs its lane in the main run: `flow: "pilot"`, `skill: "fastlane"`, no takeover; its build's stage commits still move its step.
- **`next.autopilot` becomes `next.pilot`**: `/selo:pilot {file} — autonomous`.
- `scripts/manifest.mjs` copied over: selo 2.6.0 removes the `routing` key. `docs/revamp-2.0.0/ops-export.md` (§5.1 `lane`, `flow`, `skill`, `mode`, `next`; §5.2) follows.

## 2026-10-24 — selo-ops 2.7.1: the manifest's routing key

selo 2.5.0 adds `routing` to `selo.yaml`: `scripts/manifest.mjs` is copied over (it knows the key, so a project that sets it gets no unknown-key warning). Nothing the export writes changes: a fastlane started by the session under `routing: auto` is read through the Skill tool, as before.

## 2026-10-24 — selo-ops 2.7.0: a fastlane's iterate mode, as a field

Selo Ops showed a `/selo:fastlane … — iterate` run as iterating only when `request` held ` — iterate`, and `request` is cut at 200 characters: a long request lost it and showed as a plain fastlane. A run now has `mode`: `iterate` when a fastlane's prompt carries ` — iterate`, read from the whole text before the cut, else null; set with the run's first fastlane (the prompt, the Skill tool, a short command), then fixed. `docs/revamp-2.0.0/ops-export.md` gets `mode`, the `mockup` skill in §5.1 and §5.2, and decision 32. Forward-only: `schemaVersion` stays 1; a run written before has no `mode`.

## 2026-10-24 — selo-ops 2.6.0: the mockup skill

selo 2.4.0 adds `/selo:mockup`: `SKILLS` gets it as a tool skill (`skill: "mockup"`, `flow` stays `free`), so a session started with it is no longer read as a free prompt. `/selo:fastlane … — iterate` is a fastlane: `flow: "fastlane"`, nothing new to read.

## 2026-10-23 — selo-ops 2.5.0: flow, skill and trail on each run; the short command read

A run's `lane` mixed how the work is driven with the skill running, and its `step` a skill's name with a build's position, so Selo Ops derived both. And a session started with the short `/fastlane …` was exported `free`: the hook gets the prompt raw, `parsePrompt` only matched `/selo:`, and a skill loaded as a command fires no Skill tool. The hook now computes the properties Selo Ops reads as is (`docs/revamp-2.0.0/ops-export.md` §5.1, decision 31): `flow` (`free`, `fastlane`, `blueprint`, `autopilot`; set by the run's first lane skill, then fixed: a blueprint then its build in two runs are both `blueprint`), `skill` (the selo skill running now, an autopilot's being its subagent's; a tool skill replaces a lane's until the run's next mark or done footer), `step` (`stage:N`, `review`, `merge`, else null: no lane name any more), and `trail`, an entry `{ at, skill, step, substep, phase }` at each change of one of the four, 50 kept, `trailCut` once some were dropped. One map, `SKILLS`, replaces `LANES`. A short command is read from the run's first transcript rows at its first tool call (the `PreToolUse` matcher is now every tool, any other call leaving on the session file before the lock) or at its `Stop`; `/selo:{name}` is taken, `/{name}` only when the skill's base directory is the selo plugin's: a project's own `.claude/skills/fastlane` stays `free`. A short `/{name}` prompt no longer answers the run it follows. The Skill tool's short name (`fastlane`) counts too. `/selo:run` is `skill: "run"`. `lane` is still written, deprecated, for one version. Forward-only: `schemaVersion` stays 1; a run written before has no `flow`, `skill` nor `trail`.

## 2026-10-23 — selo-ops 2.4.0: subagent usage read, their title and prompt, the lead's context, the breakdown's figures

Every subagent run had a zero usage, `settled: true`: in session 0d213aa8, an Explore run on Haiku (3 calls over 15 rows) read `calls: 0`, `byModel: []`, `tools: []`, and the session's `usage` counted the lead only. `readUsage` skips sidechain rows, meant for a main slice; every row of a subagent's own transcript is one. The SubagentStop read now passes `sidechain: true`; the test fixture had no `isSidechain`, so it never caught it. Selo Ops' usage panel also needs what a subagent was asked: its run gets `prompt` (300 characters) and `requestedModel`, and `task` is set from its `agent-{id}.meta.json` `description` (which also fixes two calls of one type swapping tasks). The session gets `context` (`tokens`: the last call's context; `model`; `baseline`: the first call's four token kinds), and each main run and the session's totals get `usage.sizes`, the characters each group added (conversation, shell, files, web, agents, skills, app, `mcp:{server}`, other): the raw input of the kookiz-usage mod's « Répartition », which Selo Ops weights itself (the export keeps raw counts only). Forward-only: `schemaVersion` stays 1; a session written before keeps its zero subagent runs.

## 2026-10-23 — selo-ops 2.3.0: the next steps a turn proposes, in the export

A step's next prompts lived in code blocks above the done footer: the export did not keep them, and `resumePrompt` only covers a selo blueprint. In session db28073d (a project with no `selo.yaml`), the `/build` of the blueprint just committed was lost: `resumePrompt: null`. selo 2.3.0 moves them into the footer, one `` Next: {summary} · `{prompt}` `` line each; `classifyEnd` now reads them into the run's new field `next`, `[{ text, prompt }]`, in order (`[]` outside `job-done`). A `Next:` line without its prompt in backticks is no footer line. `resumePrompt` is unchanged. Forward-only: `schemaVersion` stays 1, a run written before has no `next`.

## 2026-10-23 — selo-ops 2.2.3: no empty run on a hand-back as the hook gets it

The UserPromptSubmit hook gets a hand-back as the queued block alone (`<agent-message from="…">…</agent-message>`, no `Another Claude session sent a message:` preamble), not as the transcript shows it. `handBackFrom` stripped the prompt's leading wrapper tags first, and so dropped that block whole: no `from`, no hand-back. After the run's Stop (`turn-ended`), the prompt then opened an empty `free` run that became `current` (`request: ""`, « Demande non lisible dans l'export »), in session 7ef9eb1e of an autopilot waiting on a background Explore agent. 2.2.2's test passed a working run, kept by the answer rule. `handBackFrom` now finds the block on the raw prompt and strips the wrappers only from what is left. Sessions written by 2.2.2 and earlier keep their empty runs.

## 2026-10-23 — selo-ops 2.2.2: no empty run on a hand-back with the harness's trailing paragraph

Claude Code now follows a subagent's `<agent-message>` hand-back with a paragraph of its own (`That "other Claude session" is an agent working inside this same session…`). 2.2.1 read it as the person's text and opened an empty `free` run (`request: ""`, shown as « Demande non lisible dans l'export ») at each hand-back of a runner or a reviewer. `handBackFrom` now drops that paragraph too, only its own line: any text after it still makes the prompt the person's. Sessions written by 2.2.1 and earlier keep their empty runs.

## 2026-10-23 — selo-ops 2.2.1: the session file says which version wrote it

A session file carried no version: a reader could not tell a file of 1.0.0 from one of 2.2.0. Its new field `writtenBy` is the version of `selo-ops` that wrote it, set at every write (null if `plugin.json` is unreadable). Forward-only: `schemaVersion` stays 1. The project file already has it, as `selo`.

## 2026-10-22 — selo-ops 2.2.0: what each run consumed, and no empty run on a background subagent's end

Selo Ops showed what a session does, not what it costs nor on which models it ran (`docs/revamp-2.2.0/proposal.md`). The version jumps from 1.0.0 to 2.2.0 to align with `selo`, released with it. Forward-only: `schemaVersion` stays 1, a 1.0.0 reader ignores the new fields.

- **Run usage.** Each run gets `usage`: API calls (deduplicated by message id), tokens per kind (`input`, `cacheRead`, `cacheWrite`, `output`), per model (`byModel`, most tokens first: a subagent run's real model is its first row), tools called by name (the advisor as `advisor`), skills loaded and how (`tool`, `command`, `preloaded`), and for a main run one row per prompt the person typed (the latest 50). Read from the transcript by `scripts/usage.mjs`, ported from the session-debug mod's aggregate, raw counts only. Null until the run's first `Stop` (main run) or `SubagentStop` (subagent run).
- **Settling.** A main run read at `Stop` may miss its last message (`settled: false`); it is read again when the next main run opens and at `SessionEnd` (`settled: true`). A turn stopped by Esc fires no `Stop`: the same read catches it. Each main run keeps `transcriptFrom`, the transcript's size at its prompt, and reads its own slice only; a run of 1.0.0 has none and gets no usage.
- **Session totals.** `usage` of the session sums every run's, subagents included, moved by the difference at each read; a run dropped past the 100 kept still counts.
- **Cost.** The slice is read before the session's lock, then applied under it only to the run it was read for (same id and `transcriptFrom`): a concurrent hook never waits on a read. Only `"type":"assistant"` and `"type":"user"` lines are parsed; a slice over 32 MB is read from its last 32 MB, flagged `partial: true`. A hook whose read used up its time writes nothing; a read that failed before the lock is done under it, so a new run always gets its `transcriptFrom`.
- **What is no prompt, no skill.** An Esc marker (`[Request interrupted by user…`), a subagent's hand-back and a built-in or local command (`/compact`, `/model`, `/clear`: after a `<local-command-caveat>` row or before a `<local-command-stdout>` row) are not prompts; such a command is no skill either. A row written twice (same `uuid`) is read once.
- **Fix: a background subagent's end opens no run.** Its result comes back as a prompt holding nothing but `<task-notification>` blocks: 1.0.0 opened an empty `free` run (`request: ""`, shown as « Demande non lisible dans l'export ») and the person's run lost its place as `current`. It now keeps the main run, as a subagent's `<agent-message>` hand-back does. A hand-back is now recognised after the harness's blocks and its `Another Claude session sent a message:` preamble too: 1.0.0 matched it only at the start of the prompt, and opened a run after a `Stop`. Sessions written by 1.0.0 keep their empty runs.

## 2026-10-22 — selo-ops 1.0.0: the ops export in its own plugin, every session exported

The export left `selo` (2.1.0) for this plugin, enabled once at user scope, so that every Claude Code session reaches Selo Ops, in a selo project or not (`docs/revamp-2.0.0/ops-plugin.md`).

- **Plain roots.** A `cwd` with no `selo.yaml` up the tree has its git top level as its root (a worktree is its own), else the `cwd` itself. Its session file carries `selo: false` (`true` in a selo project; a new field). Its runs are all `free`, a `/selo:` prompt included; marks, blueprint paths, sheets and `Spec:` lines are ignored. A prompt that answers the run (a commit's yes) still keeps it.
- **Closing a plain root.** No done footer there: `not-done` is never a blocker; `pending-commit`, `question`, `dirty-files`, `background-tasks` and `subagents` stay.
- **Plain root's project file.** Git counts only (`repo`, `branch`, `aheadCount` against `main`, `unpushedCount`, `changedCount`), `manifest: null`, empty `sheets` and `blueprints`, and `error: null`: a repository without selo is not a broken project.
- **Header field `selo`** of a project file: the version of the plugin that wrote it, `selo-ops`' from now on. Selo Ops reads `selo`'s version from `installed_plugins.json`.
- `scan {root}` works on a plain root too.
