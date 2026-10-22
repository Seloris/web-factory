# selo-ops

The ops export for **Selo Ops**: hooks only, no skill, no agent. Enabled once at user scope, it writes what each Claude Code session is doing to `~/.claude/selo/` (`SELO_OPS_DIR` overrides it), silently, in a selo project or not. The format is `docs/revamp-2.0.0/ops-export.md` of this repository; the plugin's design is `docs/revamp-2.0.0/ops-plugin.md`.

## Install

```
claude plugin install selo-ops@selo --scope user
```

Then a new session. A selo project must be on `selo` 2.1.0 or later first: an older `selo` still carries the export's hooks, and every event would be written twice.

## What it writes

- `sessions/{sessionId}.json`: one per session, its runs (lane, step, phase at the end of each turn, proposed commit, recap, commits), the files it left uncommitted, and whether it can be closed. `selo: false` outside a selo project.
- `projects/{rootKey}.json`: one per root (a worktree is a root): git counts, and in a selo project its manifest, pages, domains and blueprints.

`node {plugin}/scripts/ops.mjs scan {root}` rescans a root with no session open.

## Layout

```
hooks/hooks.json    every hook runs scripts/ops.mjs hook: silent, exit 0, gives up after 4.5 s
scripts/ops.mjs     the export
scripts/manifest.mjs, spec-check.mjs, commit-hook.mjs, slots.mjs
                    byte-identical copies of the selo plugin's: selo is the source
tests/              node --test; shared.test.mjs fails when a copy differs from its source
CHANGELOG.md
```
