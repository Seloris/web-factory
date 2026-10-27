# selo-feed

The ops export for **Selo Ops**, and the session's recap in Claude Code: no skill, no agent. Enabled once at user scope, its hooks write what each Claude Code session is doing to `~/.claude/selo/` (`SELO_OPS_DIR` overrides it), silently, in a selo project or not; since 2.14.0 a hooks module draws a band above the prompt and a pane (`/recap`) from those files. The format is `docs/revamp-2.0.0/ops-export.md` of this repository; the plugin's design is `docs/revamp-2.0.0/ops-plugin.md`.

## Install

```
claude plugin install selo-feed@selo --scope user
```

Then a new session. A selo project must be on `selo` 2.1.0 or later first: an older `selo` still carries the export's hooks, and every event would be written twice.

## What it writes

- `sessions/{sessionId}.json`: one per session, its runs (lane, step, phase at the end of each turn, proposed commit, recap (since 2.12.0 with its changelog entry), the turn's one-line status (since 2.13.0), commits, and since 2.2.0 what each consumed: tokens per kind, per model and per prompt, tools, skills), the session's token totals, the files it left uncommitted, whether it can be closed, and since 2.13.0 the session's recap. `selo: false` outside a selo project.
- `projects/{rootKey}.json`: one per root (a worktree is a root): git counts, and in a selo project its manifest, pages, domains and blueprints.

`node {plugin}/scripts/ops.mjs scan {root}` rescans a root with no session open.

## What it shows (2.14.0)

- **The band**, above the prompt: the toggles `--autonomous`, `--worktree`, `--no-browser`; the actions Autopilot, Mockup, Fastlane, the next step, and the pane's toggle, each filling the prompt box (never sending it); then the figures: the current flow, the session's diff, commits, tokens, the context window, the duration, the state.
- **The pane**, `/recap` or the band's toggle: **Session**, the timeline of the session's prompts and recaps, newest first; **Plans**, the project's blueprints and mockups, each with its next prompt and a button that copies `--blueprint {file}` or `--mockup {file}`.

Nothing of it reaches the model: Claude Code draws it from the export's files.

## Layout

```
hooks/hooks.json    every hook runs scripts/ops.mjs hook: silent, exit 0, gives up after 4.5 s;
                    "modules" loads hooks/register.tsx, the band and the pane
hooks/register.tsx, helper.tsx, svg.ts
                    the band and the pane (helper: the Plans tab; svg: their drawings)
types/index.d.ts    the module's state, as Claude Code checks it
scripts/ops.mjs     the export
scripts/usage.mjs   a run's usage, read from its slice of the transcript
scripts/manifest.mjs, spec-check.mjs, commit-hook.mjs, slots.mjs
                    byte-identical copies of the selo plugin's: selo is the source
tests/              node --test (*.test.mjs); shared.test.mjs fails when a copy differs from its source;
                    claude plugin test (*.test.tsx): the band and the pane
CHANGELOG.md
```
