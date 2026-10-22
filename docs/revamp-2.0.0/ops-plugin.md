# selo 2.0 — the ops export in its own plugin (proposal, 2026-10-22; implemented: selo 2.1.0, selo-ops 1.0.0)

The ops export (`ops-export.md`) leaves the `selo` plugin for a plugin of its own, `selo-ops`, in the same marketplace, enabled once at user scope. Every Claude Code session then reaches Selo Ops, in a selo project or not: the person adds a workspace without thinking about it. Implemented on 2026-10-22; §9 records what the implementation settled.

## 1. Why

- Today the export exists only where `selo` is enabled, and `handle` leaves at once without a `selo.yaml` (`scripts/ops.mjs`, `findRoot`). A session in any other workspace never reaches the dashboard.
- Enabling `selo` at user scope was rejected: every `/selo:*` skill would be listed in every session (context spent, and a model may start one where it fails for lack of a manifest).
- A user-level hook in `~/.claude/settings.json` pointing at this repository's `ops.mjs` was rejected: it runs the working copy (any branch, any half-done edit), bypasses "a change reaches the projects only through its version", and works on one machine only.
- A plugin carries only hooks and scripts: enabled at user scope, it adds nothing to a session's context.

## 2. What moves, what stays

| Piece | `selo` | `selo-ops` |
|---|---|---|
| Ops hooks (`SessionStart`, `UserPromptSubmit`, `PreToolUse` on `Skill\|Agent\|Task`, `PostToolUse` on `Bash\|PowerShell`, `Edit\|Write\|NotebookEdit`, `mcp__ccd_turn__wrap_up`, `SubagentStart`, `SubagentStop`, `Stop`, `StopFailure`, `SessionEnd`) | removed | `hooks/hooks.json`, same matchers |
| Commit hook (`PreToolUse` on `Bash\|PowerShell`, `commit-hook.mjs`) | stays | — |
| `scripts/ops.mjs` (hook, scan) | a stub: `mark` only, prints nothing | the whole script, `mark` included |
| `scripts/manifest.mjs`, `spec-check.mjs`, `commit-hook.mjs`, `slots.mjs` | stay, the source | byte-identical copies (§4) |
| `tests/ops.test.mjs` | moves | `plugins/selo-ops/tests/` |
| Marks in the skills (`node ${CLAUDE_PLUGIN_ROOT}/scripts/ops.mjs mark …`), `reference/rules.md` **Marks**, the allow `Bash(node *scripts/ops.mjs* mark*)` of `templates/settings.json` | unchanged | the `PostToolUse` hook reads the command by its regex, whatever the plugin's path |
| `docs/cheatsheet.md` line on Selo Ops, `README.md` | says the export needs `selo-ops` | its own `README.md` |

The stub keeps the name `ops.mjs`: the skills, the allow and the hook's regex stay as they are. The export's format (`ops-export.md` §4, §5) does not change, except the fields of §3.

## 3. Outside a selo project

A root with no `selo.yaml` up the tree is a **plain root**. The hook no longer leaves there:

- **Root**: `git rev-parse --show-toplevel` of the `cwd` (a worktree is its own root, as in a selo project), else the `cwd` itself.
- **Session file**: written as in a selo project, with a new field `selo: false` (`true` in a selo project; forward-only, `ops-export.md` §1.6). Every prompt opens a `free` run; a `/selo:` prompt is `free` too. Marks and blueprint paths are ignored.
- **End of a turn** (`ops-export.md` §5.3): the same reading. Without the workflow's footer, a plain root's turn ends `awaiting-commit`, `awaiting-answer` or `turn-ended`, never `job-done`.
- **Closing** (`ops-export.md` §5.5): in a plain root `turn-ended` does not block, `not-done` is never a blocker there; `dirty-files`, `background-tasks`, `subagents`, `pending-commit`, `question` stay.
- **Project file**: `scanProject` already tolerates a missing manifest (`manifest: null`, `error` set). It is written for a plain root too: `repo`, `branch`, `unpushedCount`, `changedCount`; `aheadCount` against `main`, the default `baseBranch`; empty `sheets` and `blueprints`.
- **Header field `selo`** of a project file: the version of the plugin that wrote it, so `selo-ops`' from now on. Selo Ops' header reads the `selo` version from `installed_plugins.json`, as it may already (`ops-export.md` §6).

## 4. The shared scripts

`ops.mjs` imports `manifest.mjs`, `spec-check.mjs`, `commit-hook.mjs` (`isCommit`, `parseSpecLine`, `specSlug`) and `slots.mjs` (`normRoot`, `withLock`): about 740 lines. A plugin cannot import another plugin's files: each is installed into its own versioned cache folder (`~/.claude/plugins/cache/selo/{plugin}/{version}`).

- `plugins/selo-ops/scripts/` holds byte-identical copies of the four. `selo` stays their source.
- A test of `selo-ops` (`tests/shared.test.mjs`) fails when a copy differs from its source: the fix is a copy, in the same commit as the change to the source.
- No symbolic link: the plugin cache copies a plugin's folder, and links on Windows are not reliable there.

## 5. Versions and roll-out

One commit, two versions:

1. `selo` 2.1.0: ops hooks removed from `hooks/hooks.json`, `ops.mjs` reduced to its stub, `tests/ops.test.mjs` moved; `CHANGELOG.md` says why and that a selo project needs `selo-ops` to reach Selo Ops.
2. `selo-ops` 1.0.0: `plugins/selo-ops/` (`.claude-plugin/plugin.json`, `hooks/hooks.json`, `scripts/`, `tests/`, `README.md`, `CHANGELOG.md`), the plain root of §3, its entry in `.claude-plugin/marketplace.json`.
3. Repository `CLAUDE.md`: the second plugin, its update command (`claude plugin update selo-ops@selo --scope user`), the copies of §4. The test command (`node --test "plugins/*/tests/*.test.mjs"`) already covers both.

Then, by the person, in this order (a project still on `selo` 2.0.x with `selo-ops` installed would write every event twice):

1. `claude plugin update selo@selo --scope project` in each selo project (today `C:/WS/ia-projects/selo-ops`).
2. `claude plugin install selo-ops@selo --scope user`.
3. A new session everywhere.

## 6. Selo Ops' side

Changes to the dashboard, by a blueprint in its own repository:

- A session with `selo: false` shows the type « hors selo »; its project is named after its root's folder (the project file has no manifest).
- `node {selo-ops}/scripts/ops.mjs scan {root}` replaces the `selo` path of `ops-export.md` §8.4; the roots to rescan stay those of `installed_plugins.json` for `selo`.
- The dashboard's « hors selo » request built on Claude Code's pid files and transcripts alone (drafted on 2026-10-22, not sent) is dropped: the export now covers these sessions with their phase and `close`.

## 7. Risks

- **Every session, everywhere.** Each hook starts `node` (the Bash hook leaves before any git work when the command is neither a commit nor a mark); it already did in selo projects. Sessions started by scripts (`claude -p`) are exported too; Selo Ops can tell them apart by the pid file's `kind` and `entrypoint`.
- **Prompts on disk.** A run's `request` and `recap` of every workspace land in `~/.claude/selo/`, beside the transcripts Claude Code already keeps in `~/.claude/projects/`: local, not new in kind, wider in reach.
- **Version skew.** `selo-ops` parses `selo.yaml` and the blueprints with its copies of `manifest.mjs` and `spec-check.mjs`; a project pinned to an older `selo` may differ in format. Both plugins are released from one commit; a project that stays behind gets `error` on its project file, never a failing hook.

## 8. Open questions (settled)

1. `baseBranch` of a plain root → `main`. A repository without it gets `aheadCount: null`, harmless; no extra git call.
2. A `/selo:` prompt in a plain root → `free`.
3. `claude plugin validate` → passes on `plugins/selo`, `plugins/selo-ops` and the marketplace (`.`).

## 9. Settled at implementation

- **§3 "every prompt opens a `free` run"** is read as: the lane is always `free`, and the continuation rule of `ops-export.md` §5.2 stays. A "oui" to a proposed commit keeps the run (and its `pendingCommit` clears), as in a selo project.
- **`job-done` in a plain root** needs no code: no footer there, so `classifyEnd` never reads one. The change is `closeOf` only: `not-done` is skipped when `selo` is false.
- **A plain root's project file has `error: null`**: no `readManifest`, no `.planning` read. A repository without selo is not a broken project; `manifest: null` with `error: null` is how Selo Ops tells it.
- **Root**: `findRoot` stops at the first `.git` without a `selo.yaml`; the plain root is then `git rev-parse --show-toplevel`, else the `cwd`. A selo project in a sub-folder of a repository stays a selo root from inside it.
- **The two `selo` fields**: the session's `selo` is a boolean (new); the project header's `selo` stays "the writer's version", now `selo-ops`'. Different files, different meanings, both in `ops-export.md`.
- **The stub** is a comment-only module: any mode exits 0 and prints nothing, so an older `scan` caller on `selo`'s path stays silent (and writes nothing).
- **Marketplace source** is a local directory: no push is needed for `install selo-ops@selo`; `claude plugin marketplace update selo` may be needed first for the new entry to be seen.
