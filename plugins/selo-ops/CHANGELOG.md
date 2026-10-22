# Changelog

Why each change to the ops export exists. Newest first. The export's history before this plugin is in `plugins/selo/CHANGELOG.md` (2.0.0 to 2.0.3).

## 2026-10-22 — selo-ops 1.0.0: the ops export in its own plugin, every session exported

The export left `selo` (2.1.0) for this plugin, enabled once at user scope, so that every Claude Code session reaches Selo Ops, in a selo project or not (`docs/revamp-2.0.0/ops-plugin.md`).

- **Plain roots.** A `cwd` with no `selo.yaml` up the tree has its git top level as its root (a worktree is its own), else the `cwd` itself. Its session file carries `selo: false` (`true` in a selo project; a new field). Its runs are all `free`, a `/selo:` prompt included; marks, blueprint paths, sheets and `Spec:` lines are ignored. A prompt that answers the run (a commit's yes) still keeps it.
- **Closing a plain root.** No done footer there: `not-done` is never a blocker; `pending-commit`, `question`, `dirty-files`, `background-tasks` and `subagents` stay.
- **Plain root's project file.** Git counts only (`repo`, `branch`, `aheadCount` against `main`, `unpushedCount`, `changedCount`), `manifest: null`, empty `sheets` and `blueprints`, and `error: null`: a repository without selo is not a broken project.
- **Header field `selo`** of a project file: the version of the plugin that wrote it, `selo-ops`' from now on. Selo Ops reads `selo`'s version from `installed_plugins.json`.
- `scan {root}` works on a plain root too.
