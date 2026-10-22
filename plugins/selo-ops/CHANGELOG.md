# Changelog

Why each change to the ops export exists. Newest first. The export's history before this plugin is in `plugins/selo/CHANGELOG.md` (2.0.0 to 2.0.3).

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
