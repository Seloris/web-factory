# Factory revamp — proposal (v5, 2026-10-21)

> This is the proposal as delivered on 2026-10-21, translated. Decisions taken after it: the five recommendations of §16 were accepted; the quick lane is named fastlane; the plugin, its board and marketplace are renamed `selo-flow` (`selo-flow.yaml` replaces `factory.yaml`); the board's "Specs of the day" panel (§13, plate 6) moved to `IDEAS.md`; worktrees and `land` come after 1.0.0. The plan that applies it is `plan.md` beside this file.

21 October 2026. Basis: the review of the day (46 claude-companion sessions), a full read of the skills, agents, rules, docs and parser, the coupling of the board (`factory-board`), the Claude Code docs (worktrees, plugin agents, hooks, skills), then five rounds of critique and real git tests (§17). The mockups are in `mockups.html`, beside this file. Four skill drafts, written to prove that the budgets hold: `drafts/workflow-rules-v2.md` (1,098 words, against 2,371), `drafts/implement-v2.md` (1,407, against 3,040), `drafts/autopilot-v2.md` (990) and `drafts/write-spec-v2.md` (1,107). They describe the final state, after 0.11.0; each version delivers its part of them (§14).

## On one page

**In one sentence:** say yes to the five recommendations (§16) and, on Monday, you type `/factory:autopilot` as before; small requests are committed in ten minutes with no spec and no plan, large ones go through spec and plan, and in the evening you approve the day's spec changes on the board.

**Your goal:** a smooth workflow that drives an application, with specs **always up to date without being a chore**, and two speeds: fast dev ("change this") and the specified feature ("we specify, we develop").

**The target system fits in three ideas.**

1. **Two lanes, the same end.** *Fastlane*: request → code + spec delta → review → commit on `develop`. *Feature*: spec (grill as multiple choice) → plan → stages → review → test on the demo. The autopilot picks the lane after it reads the code; you can force it either way.
2. **The spec follows the code, and it shows.** One spec per **area** of the application, written in the present tense. An area is a screen or a domain (`live-sessions`, `notifications`): a folder of `.planning/features/` as today, but one that grows with each request instead of a new one per request. Every code commit carries a line `Spec: live-sessions +FR-48 ~FR-13` (or `Spec: none (refactor)`). A small script checks the ids, the reviewer refuses a behaviour change without this line, and the board shows the day's spec changes with the decisions to approve. During the work, nobody asks you anything, except about a rule you did not ask for (in interactive mode); in the evening, a glance at the list, at your own pace.
3. **`develop` direct: first stop sessions from carrying each other's work, then isolate them.** First, safe commit rules ("step A"), in the project's `CLAUDE.md` so that **all** sessions follow them, skills or not. Then one worktree per piece of work, which lands on `develop` by itself: it is the only thing that really removes collisions, and a one-hour trial will tell if its cost under Windows is acceptable.

**What goes away:** `retro`, ` — with review`, ` — final review`, ` — close the branch`, the squash, the `feat/…` branches, `wt.exe`, the question "browser test?", "never restart a server", the `advisor` role, `Status` and `Updated` in the spec, "Decisions taken autonomously" in the spec, the question "do we create the spec?".

**What appears:** `factory-init update`, the area rule, the `Spec:` line on commits, `scripts/spec-check.mjs` and a commit hook that warns, `(planned)` FRs, `commands.demo`, the lane chosen by the autopilot, *Business decisions* first, `land` (last version).

**Four versions**, each delivered with its matching board, each tried on `samples/todo-app` before the companion (§14).

**Measure of success:** ≈ 10,400 words loaded before the first line of code of a web stage today → ≈ 6,200; ≈ 8,200 → ≈ 4,500 for an API stage (§10).

## What changes for you on Monday (after 0.9.0 and 0.10.0)

- You type `/factory:autopilot {your request}` as today. A small request no longer goes through spec + plan + 4 commits: it is coded, reviewed and committed in about ten minutes.
- No more branch questions, no more squash, no more `/factory:retro` at the bottom of messages.
- In the evening, the board shows you a list: "Specs changed today", area by area, with the business decisions taken alone and an ok / revisit button on each.
- Your 3 to 5 sessions each commit their own files. When two sessions change the same file at the same time, the second one waits or stops instead of carrying the other's work.
- Rollback: pin the previous version in the project's `.claude/settings.json` and `claude plugin update`.

---

## 1. What I keep from the review, and where I differ

The review is right in its diagnosis, and I keep most of its proposals. I differ on six points:

| Review | My position | Why |
|---|---|---|
| "The `react-express` pack already has the demo pattern (`npm run demo` 3101/5181)" | **Wrong.** The companion has it. The pack has neither `demo` nor a local seed (the database is empty after `migrate`). | The demo must be **added to the pack** (script + seed), not only declared in the manifest. |
| Worktree + `land` first, option `branching: worktree \| develop` | **Last, after a trial.** First, safe commit rules on `develop`. No `branching:` option. | Worktrees cost under Windows (`npm install` of 1 to 3 min and hundreds of MB per worktree, ignored files missing) and affect the board deeply. Measure before building. Two modes = twice as many rules. |
| Optional squash at landing | **No squash at all.** | You work develop-direct: it gives you nothing, costs a question, and it swallowed a foreign commit. |
| Spec and plan on the main checkout, code in the worktree | **Spec, plan and code in the same place.** On `develop`, FRs not yet built are marked `(planned)`. | A spec must not describe an absent behaviour without saying so. |
| New `final-review` skill | **No.** `/factory:review {plan}` already does it. | One skill less. |
| `write-spec — compact` on a threshold | **Once only**, to catch up `live-sessions` (251 lines) and `factory-board` (206). After that, the spec is written in the present tense: a replaced FR is deleted, not struck through. | We stop the spec from growing rather than compacting it afterwards. git keeps the history. |

At first I had added an intermediate review on plans of 3 stages or more. I removed it: a broken contract already fails the build of the stage that consumes it.

## 2. Principles

1. **The short path by default.** The long one when the request justifies it or when you ask for it.
2. **A question only when your answer changes the result.** Everything else takes the recommended value and appears in the report, business decisions first.
3. **The spec follows the code, and the proof is in the commit.** A checkable `Spec:` line, not a promise in prose.
4. **`develop` is the truth.** Nothing lingers on a branch.
5. **A rule that all sessions must follow lives in the project's `CLAUDE.md`**, not only in a skill: half of your changes happen outside a skill.
6. **One skill = one job**, readable in one go. The common rules fit in ≈ 1,100 words, against 2,371.

## 3. The two lanes

### Fastlane — "change this"

```
/factory:implement {request}        you are here, interactive
/factory:autopilot {request}        you leave; the autopilot judges it small
```

1. Read the code of the area, name the spec area touched.
2. Approach in 5 lines **only** if several components and you are here. Otherwise, code.
3. Code + tests (test-first), build / test / lint of the component.
4. Spec delta in the same commit, with no question if it rephrases your request.
5. Review (opus reviewer) on the diff.
6. Test on the demo if a touched component has a UI and a `demo` (§11).
7. Commit(s) on `develop` with the `Spec:` line. Decisions taken alone go into the commit body and at the top of the report.

No plan. One commit per touched component.

### Feature lane — "we specify and we develop"

```
/factory:write-spec {idea}          interactive, grill as multiple choice
/factory:autopilot {slug}           plan + stages + review + demo, no questions
```

or in one command: `/factory:autopilot {request}`, spec and plan included.

1. Spec: grill with the question tool, 2 rounds at most. Skipped when your request already carries its decisions (ids cited, rules stated one by one). New FRs are `(planned)`.
2. Plan: *Business decisions* (≤ 5) first, *Technical defaults* below.
3. Stages, one commit each; each stage removes `(planned)` from the FRs it builds.
4. Review of the whole plan, once, at the end.
5. Full suites (runner), test on the demo.
6. Report: the lane taken, the *Business decisions*, what did not run.

### Who picks the lane

On a free request, the autopilot first does a **read of the code, writing nothing** (an `Explore` subagent), then picks. **Fastlane** when the change touches a single component (or the api and its regenerated client) **and** creates no business rule and no entity. **Feature lane** otherwise. ` — fastlane` and ` — with plan` force it. A fastlane run that finds a new rule or entity on the way switches to the feature lane and says so in the first line of the report.

`implement {request}` is always the fastlane. `write-spec` always opens the feature lane.

## 4. Parallel work

### Step A (0.9.0): shared `develop`, with safe commits

The rules go into a tagged block of the project's `CLAUDE.md`, read by **all** sessions, including "why does the notification ring twice? → go fix".

- **No branch.** Spec, plan, stages, fixes: everything is committed on `base_branch`.
- **Commit by named files, in one command:** `git add {new files} && git commit --only -- {files of the work}`. `--only` ignores what other sessions put into the shared index. Never `-a`, `add -A`, `add .`, `--amend`.
- **File already changed by another session** (`fr.json`, the same spec): do not write it. Wait for the other session to commit (5 minutes at most), otherwise stop and say so. No hunk sorting: it cannot be done reliably.
- **Dirty tree ≠ blocker.** The autopilot no longer stops on "tree not clean".
- **Red suite outside the work.** If the failure is on files the work did not touch, list the files changed by others (`git status` minus the list of the work), mark `- [-] Tests: foreign uncommitted changes in {files}`, do not investigate, commit anyway. The final review runs the suite again.

What step A fixes: the squash that swallows a foreign commit, the blocked autopilot, the amended commits, the free session that carries the work of others. What it does not fix: a suite and a demo that run on the half-done work of another session, and two sessions that want the same file. Only step B fixes that.

### Step B (0.12.0, after the trial): one worktree per piece of work

```
main checkout (develop, your servers run there)
  ├─ .claude/worktrees/live-sessions-filters   wt/live-sessions-filters
  ├─ .claude/worktrees/header-version          wt/header-version
  └─ …                                          one per session that writes
```

- **Every skill that will commit** enters the worktree of the work, or creates it from `develop` (`EnterWorktree`). No question about the name.
- **Setup:** the ignored files listed by `worktree_setup` (`.env`, `api/.data`) are copied from the main checkout; `node_modules` is a junction (`mklink /J`) to the main checkout's one when the lockfile is identical, otherwise `npm ci`. `factory-init` sets `core.longpaths=true`.
- **A session without a skill** stays on the main checkout, with the step A rules.
- **`land`**, at the end of each lane (and a board button):
  1. lock `{git-common-dir}/factory/land.lock`: two landings do not cross;
  2. checks: clean worktree, review ticked, suites green;
  3. `git rebase develop`; conflict → stop, the worktree stays;
  4. `spec-check`: duplicate ids after rebase (two worktrees took FR-48 in two sections, with no git conflict) → renumbers those of the branch, plan and `Spec:` line included;
  5. runs build and test again only if the commits brought in touch the components of the work;
  6. `git -C {main} merge --ff-only`; if `develop` moved in the meantime, one single new attempt;
  7. removes the `node_modules` junction (`rmdir`, never recursive), then deletes the worktree without `--force` (otherwise git empties the main checkout's `node_modules`, verified §15); `git worktree prune` later if Windows holds a file;
  8. reports if the main checkout needs `npm install` or a migration; never runs them: those are your servers.

## 5. Living specs, at minimal cost

**The spec describes the current behaviour of an area** of the application (a screen, a domain), in the present tense, readable in 5 minutes. Not the history, not the decisions.

**Area, not request.** `.planning/features/{slug}/` is an area; its `dev-plans/` are the dated pieces of work on that area. The folder name does not change: the board reads it. A new request enriches the spec of its area. A new area is created only for a separate screen, route or domain, and its creation is a *Business decision* (you see it in the evening).

**The area rule: every code change names its area.**

| Case | What happens | Question? |
|---|---|---|
| Behaviour changed in an area that has its spec | Delta in the same commit as the code | No, if it rephrases your request |
| Area without a spec | Three-line spec: TL;DR, one FR per touched behaviour; it fills up as changes come | No |
| No area fits | One FR in the closest area, stated in the report | No |
| New behaviour not requested | Interactive: one grouped question at the end of the work. Autopilot: applied, at the top of the *Business decisions* | Once, grouped |
| Refactor, look, fix that restores, `tooling`, `shared` | `Spec: none ({reason})` | No |

**The proof: the `Spec:` line.** Every commit that touches code carries, in its body, a line:

```
Spec: live-sessions +FR-48 ~FR-13 -FR-07 +BR-23
Spec: none (refactor)
```

- `scripts/spec-check.mjs` (new, with its tests) checks before each commit: duplicate ids, retired id reused, id cited by the `Spec:` line or by the plan but absent from the spec, `(planned)` FRs left at the end of a plan. It also gives the next free id. **Prototype written tonight** (`proto/spec-check.mjs`, 34 lines, 3 green tests) and run on the real `live-sessions` spec of the companion: no duplicates, next ids FR-48 and BR-23.
- The **reviewer** flags any behaviour change without a `Spec:` line or with a wrong `none`.
- The **board** reads these lines (`git log --since=midnight`): "Specs of the day" panel.
- `/factory:review {slug}` compares the whole spec with the code, on request, for an in-depth check.
- **Free sessions.** A project `CLAUDE.md` does not know `${CLAUDE_PLUGIN_ROOT}`: a "go dev direct" session cannot run `spec-check` alone. So the plugin ships **a `PreToolUse` hook on `git commit`**, which has the variable and also runs in subagents. It runs `spec-check` on the specs of the commit and **warns** (added context, no refusal) when a commit that touches code has no `Spec:` line, or uses `-a`, `add -A` or `--amend`. The CHANGELOG of 16 October removed two hooks because their heuristic refusals cost a round trip on each false positive; this one refuses nothing and looks only at `git commit`. The reviewer and the "Specs of the day" panel catch what it lets through.
- The commit body goes through a second `-m`, never through `-F`: the board reads the commit scope in the command text.

**Present-tense writing.** A revised FR is revised in place. A replaced FR is deleted; its id goes on the `Retired:` line at the bottom of the spec, so it is never reused. An FR not yet built carries `(planned)`.

**Format v2:**

```markdown
# Live sessions — Spec

> **Slug**: `live-sessions` · **Tags**: #companion

## TL;DR
## Problem
## Non-goals
## Domain Glossary            (if useful)
## Functional Requirements
### Session list               ← grouped by screen or by area
- **FR-01** — …
- **FR-48** — (planned) …
### Notifications
- **FR-31** — …
## Business Rules
## UX Flow                    (if UI)
## Open Questions             (if open)

Retired: FR-07, FR-12, BR-04
```

- **Removed:** `Status` (the commit approves), `Updated` (git knows it, and two sessions fought over this line), `Decisions taken autonomously`, User Stories except for multiple roles.
- **Who writes:** the writing rules live in `write-spec`; `implement` and `write-plan` call it in called mode, in the same session. Nothing changes there.
- **Catch-up, once:** `write-spec {slug} — rewrite` rewrites an existing spec in the present tense, grouped by area, ids kept.

## 6. Plan v2

`plan.md` keeps its structure (the board reads `## Progress` and `## Validation`):

```markdown
# "Waiting for you" filter

Feature: `live-sessions` · Components: `api`, `web` · Spec: FR-13, FR-48, BR-23

## Business decisions          ← ≤ 5: a rule, a label, a scope
- An empty filter shows all sessions → yes (BR-23)
## Technical defaults          ← the rest, one line each
- Web Lock `…notifier` + AbortController (avoids two notifications)
## Context
## api
### …
## web
### …
## Tests
## Deviations
## Progress
### Stage 1 — api
Commit: `feat(live-sessions): api — …`
- [ ] …
## Validation
- [ ] Review
- [ ] Tests
- [ ] Browser test (demo)
```

- `Decisions` + `Decisions taken autonomously` → **`Business decisions` + `Technical defaults`**, in all modes.
- `Integration tests` appears only if you ask for them.
- The autopilot report shows *Business decisions*, the `[-]` and the open points; the rest stays in the plan.

## 7. `factory.yaml` v2

```yaml
factory: 0.12.0                 # version of the plugin that wrote or updated the project (example: final state)
name: claude-companion
base_branch: develop
language: { chat: fr, repo: en }
models: standard                # planner opus, implementer sonnet, reviewer opus, runner haiku, explorer haiku
worktree_setup: [.env, api/.data]   # 0.12.0 only
components:
  - name: api
    path: api
    handoff: api/openapi.json
    serve_url: http://localhost:3000
    demo_url: http://localhost:3101     # 0.11.0
  - name: web
    path: web
    needs: [api]
    url: http://localhost:5173
    demo_url: http://localhost:5181
```

In the component `CLAUDE.md` block: `commands.demo` (e.g. `npm run demo`) next to `serve`.

- **New:** `factory`, `demo_url`, `commands.demo`, `worktree_setup`.
- **Removed:** the `advisor` role (nothing applies it), in the parser's `standard` preset and in the board's copy.
- **Parser:** an unknown key is ignored today without a word, and `commands.demo` would be filtered out (`COMMAND_KEYS`). Add it with its tests, and warn on an unknown key.
- No `zones:` map: the area is decided by reading the code, and its creation shows (*Business decision*). To reconsider if guessed areas cause problems.

## 8. Skill catalogue

| Skill | Fate | One-line contract | Budget | Today |
|---|---|---|---|---|
| `autopilot` | adjusted | Request, slug or plan → finished work on `develop`, no questions; reads, then picks the lane | 990 (written) | 1,159 |
| `implement` | **slimmed** | Fastlane, or one or more stages of a plan; no final review, no squash | 1,407 (written) | 3,040 |
| `write-spec` | slimmed | Creates, updates (delta) or rewrites (`— rewrite`) the spec of an area | 1,107 (written) | 1,833 |
| `write-plan` | adjusted | The plan, *Business decisions* first | 1,000 | 1,228 |
| `review` | extended | Diff, plan, whole area (spec ↔ code), or implemented plan when the last stage left `Review` open (formerly "final review"; usually the last stage does the review) | 600 | 400 |
| `test-in-browser` | **rewritten** | Starts the demo in the background under a lock, tests, stops it | 600 | 750 |
| `grill-me` | adapted | Question tool (1 to 4 questions per call, 2 to 4 options each), recommended first; 2 rounds, the rest as `Q-NN` | 600 | 707 |
| `factory-init` | + `update` | Setup, partial modes, update of a project (§12) | 2,200 | 2,004 |
| `land` | **new (0.12.0)** | Lock, rebase, ids, fast-forward of `develop`, worktree deleted | 500 | — |
| `retro` | **removed** | — | 0 | 1,199 |

**Why remove `retro`:** zero use, 1,200 words, a section of `planning.md` and one of `workflow.md`. The lessons already exist: the *Deviations* of the plans, and the feedback you carry yourself to webapp-factory.

**Agents:** `reviewer` (700 → 500 words, without the copied rules) and `runner` (400 → 250) stay. No `planner` / `implementer` agents: the autopilot spawns `general-purpose` with the manifest's model and puts the role at the start of the description (`implementer · stage 2 web`), which the board and the companion display. The docs confirm that the `model` of the call wins over the frontmatter: the manifest stays the only source of models.

**Totals:** ≈ 12,300 words of skills today → ≈ 9,000.

## 9. `workflow-rules.md` v2: written, 1,098 words (≈ 1,100)

The full draft is in `drafts/workflow-rules-v2.md`. Sections: the project, the manifest, **the two lanes**, **the spec follows the code**, **where commits go**, subagents, autonomous mode, language, hard rules, commits, end of turn.

**Out:** "Starting a server" → `test-in-browser`; "Plan finalized" (the squash) → removed; "The retro" → removed; "Images" → `planning.md` (it is already duplicated there).

**Stay in the project's `CLAUDE.md`**, in tagged blocks that `factory-init update` rewrites (§12): the step A commit rules, the area rule and the `Spec:` line, never push, integration tests, done footer. These are the rules that free sessions must follow.

## 10. Reading budget per stage, measured

| File | Today | Target |
|---|---|---|
| `workflow-rules.md` | 2,371 | **1,098 (written)** |
| `implement/SKILL.md` | 3,040 | **1,407 (written: `drafts/implement-v2.md`)** |
| `rules/planning.md` (loaded by `paths`) | 1,767 | 900 (without retros, squash, branches) |
| `api.CLAUDE.md` / `front.CLAUDE.md` | 1,055 / 695 | unchanged |
| UI: ui-design 505 + skins README 882 + recipes 1,051 + SKIN 116 | 2,554 | 2,100 |
| **API stage** (rules + implement + planning + `api.CLAUDE.md`) | **≈ 8,230** | **≈ 4,460** |
| **Web stage** (rules + implement + planning + `front.CLAUDE.md` + UI) | **≈ 10,430** | **≈ 6,200** |

Counts made with `wc -w` on the repository files, excluding the project's root `CLAUDE.md` (it grows by about 250 words with the step A and area blocks, for all sessions).

## 11. Servers and browser test

**Finding:** three rules contradict each other (never restart, `wt.exe`, test disabled by default), and the test targets your real servers.

**Target, the simplest that works:**

- **Your servers are never touched.** The test targets the **demo**: `commands.demo` on `demo_url`, seeded demo data, separate ports.
- `test-in-browser` takes a lock `{git-common-dir}/factory/demo.lock` (pid of the session), starts the demo **in the background**, waits for it to respond, tests the scenarios, **stops it**, releases the lock. Another session waits for the lock, not for the port. A demo lives for the length of one test: no orphan server, no old code served, no corrupted Vite cache.
- **Step A:** the demo runs on the shared checkout, so on the work in progress of other sessions. The report lists the foreign uncommitted files it served.
- **By default** in both lanes when a touched component has `url` + `demo`. ` — without browser test` to skip.
- **Before the demo (0.9.0):** without `commands.demo`, `test-in-browser` starts `serve` in the background, tests it and stops it the same way; no more `wt.exe`, no more "never restart". It stays opt-in until 0.11.0.
- **`react-express` pack:** `npm run demo` (api: in-memory PGlite + `seed/demo.ts`; web: vite on the demo port, `--force`, proxy to the demo api). Vitest allowed on the pure `.ts` modules of the front (UI excluded).

## 12. Migration: `factory-init update`

Delivered **first** (0.9.0): it is what carries the new rules into the projects' `CLAUDE.md`.

- **Tagged blocks.** `factory-init` writes the parts that belong to the plugin between `<!-- factory:begin {id} -->` and `<!-- factory:end {id} -->` (root `CLAUDE.md`, `docs/CONTRIBUTING.md`). `update` rewrites these blocks from the templates, placeholders rendered from the manifest; the rest of the file is not touched.
- **100 % plugin files** (`.claude/rules/planning.md`, `test-logins.example.md`): overwritten.
- **Keys added** without touching the values: `factory.yaml`, component blocks, `.claude/settings.json` (JSON merge), `.gitignore` (lines).
- **Never touched:** skeleton, `overrides.css`, entries of `memory.md`, `ideas.md`, `technical-debt.md`, specs and plans.
- **First pass** on a project from before the tags: `update` rewrites the file from the template and sets the tags, then you read the `git diff`. git does the merge, once.
- `factory:` missing from the manifest = "before 0.9.0". One commit `chore(tooling): factory update {from} → {to}`, message shown first.

Projects:

- **samples/todo-app first**, at each version: `update`, then a trial of both lanes. It is the test bench.
- **claude-companion next:** `update`, then `write-spec — rewrite` on `live-sessions` and `factory-board` (0.10.0).
- **webapp-factory repository:** the `architect` / `senior-dev` line of the root `CLAUDE.md` is stale; the factory's `CHANGELOG.md` contains two board entries ("0.8.0", "0.9.0") that clash with the factory's numbers: the board needs its own CHANGELOG.

## 13. The board, version by version

The board changes **in the same commit** as the factory at each version: otherwise it emits prompts that the factory no longer understands. It keeps its own numbering (it is at 0.12.0).

| Factory | Board changes |
|---|---|
| 0.9.0 | Review box and `REVIEW_MARKER` removed; "Final review" button → `/factory:review {plan}`; ` — close the branch` prompts (`planning.ts:543`) and "Squash" button, `branchFeature`, `aheadCount` removed (dead without branches); `advisor` removed from the copy of the presets; `shaBySubject` reads more than 200 commits (on a busy `develop`, old stages showed as "not committed"); export `schemaVersion: 3`, companion updated first |
| 0.10.0 | "Specs of the day" panel (`Spec:` lines of `git log --since=midnight`, *Business decisions* of the day, ok / revisit); a spec without a plan is an area, with no next action (otherwise it would propose `write-plan` for every 3-line area); no more reading of `Status` |
| 0.11.0 | `BROWSER_MARKER` is inverted (` — without browser test`) |
| 0.12.0 | Scan per worktree (`readGit` per worktree), one row per worktree, export indexed by repository and cleanup of the exports of deleted worktrees, "Land" button per worktree, `land` in `RUN_SKILLS` and the steps |

## 14. Order of implementation

| Version | Content | Size |
|---|---|---|
| **0.9.0 — Cleanup and shared develop** | `factory-init update` + `factory:` key + tagged blocks. Removals: `retro`, ` — with review`, ` — final review` → `review {plan}`, ` — close the branch`, squash, branches, `advisor`, `wt.exe`, "never restart". Step A in the project's `CLAUDE.md`. Review once, at the end. Repository: the board's own CHANGELOG, `architect` / `senior-dev` line removed from the root `CLAUDE.md`. The two drafts delivered without what comes later (`Spec:` line, lanes, demo). `test-in-browser`: servers in the background, stopped afterwards. `workflow-rules` v2, `implement` slimmed. | medium |
| **0.10.0 — Living specs and two lanes** | Area rule (also in the `CLAUDE.md`), `Spec:` line, `spec-check.mjs` + tests, commit `PreToolUse` hook (warns, does not refuse), `(planned)`, `Retired:`, no `Status` and no `Updated`. *Business decisions* / *Technical defaults*. Lane chosen after reading, ` — fastlane` / ` — with plan`. Grill as multiple choice, 2 rounds. `write-spec — rewrite`, `review {slug}`. End of the question "do we create the spec?". | medium |
| **0.11.0 — The demo** | `commands.demo` / `demo_url` (parser + tests), `demo.lock`, browser test by default (end of the question "browser test?"); pack: `npm run demo`, seed, vitest on pure `.ts`. | medium |
| **0.12.0 — Worktrees** | One-hour trial right after 0.10.0, in parallel with 0.11.0 (§15); then worktree per piece of work, `land`, `worktree_setup`. | large |

**0.9.0 + 0.10.0 reach the goal** (smooth, specs up to date and visible, two speeds). 0.11.0 makes the browser test reliable. 0.12.0 removes the remaining collisions.

After each version: `claude plugin update factory@webapp-factory --scope project` in each project, `/factory:factory-init update`, then a new session.

## 15. Risks and trial before 0.12.0

### Already verified tonight, on a throwaway repository (Git Bash, Windows 11)

| Test | Result |
|---|---|
| S2 put `b.ts` into the shared index; S1 runs `git commit --only -- a.ts` | The commit contains only `a.ts`; `b.ts` stays in S2's index. **The step A commit rule holds.** |
| New file: `git add c.ts && git commit --only -- c.ts` | OK |
| `git merge --ff-only` from a worktree to the main checkout, with an **unrelated** uncommitted file in the main checkout | Fast-forward done, the uncommitted file and the others' index intact |
| Same thing with an uncommitted file **touched by the worktree** | git refuses cleanly ("Please commit your changes… Aborting"), nothing is changed: `land` stops and says so |
| Worktree `node_modules` as a junction (`mklink /J`) to the main checkout's one | `require` works; the junction is ignored by `.gitignore` (`node_modules` or `node_modules/`) |
| **`git worktree remove --force` with the junction in place** | **Empties the `node_modules` of the main checkout** (git follows the junction). |
| `rmdir` of the junction first, then `git worktree remove` | The main checkout's `node_modules` stays intact |

The last row is data loss narrowly avoided: **`land` always removes the junction (`rmdir`, never recursive) before `git worktree remove`, and never uses `--force`.** This point goes into the skill and its tests.

### Still to verify before writing step B

1. `EnterWorktree` called from a skill: does the session enter the worktree? Are the worktree's `CLAUDE.md` and `.claude/rules/` loaded? (The docs say no for an `isolation: worktree` subagent: that is why we do not use it.) Does the root that the board sees (`$.session.root()`) follow?
2. Do the autopilot's subagents inherit the worktree folder?
3. vite and tsx (not only `require`) through the junction; cost of an `npm ci` when the lockfile differs.
4. The board with 3 worktrees: time of a scan.

Plan B if (1) or (2) fails: the autopilot puts the worktree path at the top of each brief and the subagents work by `cd {worktree}`. If (3) costs too much: we stay at step A and accept that a suite sometimes runs on the work of others.

**Other risks:**
- The done footer stays a contract parsed from free text. We keep it as is. If it breaks again, a plugin `Stop` hook will write the recap to a file (the docs provide `last_assistant_message`).
- Step A asks free sessions for discipline. The `CLAUDE.md` block and the commit hook that warns (§5) carry it, but nothing enforces it. If a violation comes back despite the warning, switch the hook to refusal for `-a`, `add -A` and `--amend` only: these are cases with no false positive on a shared checkout.
- **Do not run the worktree trial on a real project.** The `node_modules` junction is a one-command data-loss path (§15); the trial runs on a throwaway repository, and `EnterWorktree` creates `.claude/worktrees/` in the repository where it is run.

## 16. What I ask of you (≤ 5 decisions)

1. **No more branches and no squash**: everything is committed on `develop`, by named files (0.9.0). *Recommended: yes.*
2. **The area rule and the `Spec:` line**: each change updates the spec of its area without asking you, and the board shows you in the evening what changed. *Recommended: yes.*
3. **`retro` removed**, not only hidden. *Recommended: yes.*
4. **The autopilot picks the lane** after reading the code, ` — fastlane` / ` — with plan` to force it. *Recommended: yes.*
5. **Worktrees** (one working copy per session, which joins `develop` by itself when everything is green): do we run the one-hour trial on a throwaway repository right after 0.10.0, or do we wait to see if the commit rules are enough? *Recommended: the trial right away.* The commit rules stop a session from carrying the work of another, but not a test suite or the demo from running on another session's half-written code; only a separate working copy avoids that. The trial costs one hour and touches no real project; it tells if the cost under Windows (dependency install, ignored files to copy) is acceptable.

---

## 17. Iteration log

- **v1 (18:02).** First proposal: two lanes, worktree per piece of work with automatic landing, living spec with compaction, server registry, `planner` / `implementer` agents, six versions.
- **Round 1 (18:03–18:06), three critiques in parallel:**
  - *Parallel sessions:* cost of a worktree under Windows (`npm install`, ignored files); two `land` runs that cross; duplicate FR ids with no git conflict; the spec of one worktree blind to that of another; your servers that reload on a changed lockfile; Windows file locks.
  - *Board and migration:* the rollout broke the board for three versions; the worktree scan took the main checkout's git; the "Land" button never appeared; one export per worktree; a "by paragraph" merge cannot be done without tags; version numbers colliding with the board.
  - *Simplicity:* server registry, named agents, compaction on a threshold and intermediate review do not serve the goal. The essential was missing: a fast change when no spec covers the area.
- **v2 (18:07).** Rollout in 3 versions with the board in the same commit; step A (`develop` direct) before worktrees; lock and id check in `land`; registry, named agents, intermediate review and compaction on a threshold removed; area rule, `Retired:`, `review {slug}`, tagged blocks.
- **Round 2 (18:08–18:10), two critiques:**
  - *Red team, 3 sessions + one autopilot simulated step by step:* a free session carries the work of others (the commit rule was only in the skills); the git index is shared; `git add -p` "by hunks" cannot be done; the rule "red suite because of another" could not be applied without a second tree; two sessions on the same spec fight over `Updated` and over the next id; the spec committed before the code contradicts principle 3; the board would propose `write-plan` for every area; `wt.exe` removed before `test-in-browser` was rewritten; two demos on the same port; the lane choice is made before knowing if the api changes.
  - *User point of view, one simulated day:* no way to see the day's spec changes in the evening; drift is checked only if one thinks of it; "go dev direct" sessions escape the area rule; areas guessed silently; the lane can be forced in one direction only; make the yes easier ("what changes on Monday", rollback, todo-app first).
- **v3 (18:11).** `update` and the commit rules in the project's `CLAUDE.md` from 0.9.0; `git commit --only`; wait or stop on a shared file instead of sorting hunks; foreign tests marked `[-]` instead of investigated; `Spec:` line + `spec-check.mjs` + "Specs of the day" panel; `(planned)` FRs; `Updated` removed; area created = *Business decision*; lane chosen after reading the code, forceable in both directions; demo lock; four versions; recommendation on worktrees reversed: run the trial right away.
- **Checks (18:12).** Drafts written to prove the budgets: `workflow-rules` v2 and `implement` v2, aligned with v3. Six git tests on a throwaway repository: `commit --only` protects the index of other sessions; `merge --ff-only` passes with unrelated foreign files and refuses cleanly on overlap; the `node_modules` junction works, but `git worktree remove --force` empties the main checkout's `node_modules` through it. So `land` removes the junction first, without `--force`.
- **Prototype (18:13).** `proto/spec-check.mjs`, 34 lines, 3 green tests, run on the real `live-sessions` spec: no duplicates, next ids FR-48 and BR-23.
- **Round 3 (18:14–18:16), consistency read:** 19 gaps, all fixed. The main ones: the drafts describe the final state (after 0.11.0) while the table delivered them in 0.9.0; `implement` had no step to remove `(planned)` and no exception for foreign failures; the total of skill words was wrong (12,300, not 13,400); the manifest example mixed versions; two announced removals were in no version; the worktree trial was not placed at the same point in §14 and §16.
- **v4 (18:16).** Consistency fixes applied.
- **Round 4 (18:16–18:20).** Drafts `autopilot` (990 words) and `write-spec` (1,107) written; they found the fastlane → feature switch missing from `implement` (added) and the overlap between the last stage's review and `review {plan}` (clarified in §8). The reviewer recalled that `${CLAUDE_PLUGIN_ROOT}` does not exist in a project's `CLAUDE.md`: free sessions cannot run `spec-check` alone, hence the commit hook that warns (§5), justified against the hook removal of 16 October. "5 minutes" test: a reader who reads only the top and §16 settles 4 decisions out of 5; the fifth (worktrees) and the word "area" were rewritten, a summary sentence added at the top.
- **Round 5 (18:20–18:22).** Audit of the four drafts against each other: 8 gaps fixed (footer after a stop with commits, spec commit that carried the whole folder, fastlane commits made before the review, question on an unrequested delta asked after the commit, fastlane decisions with no plan to hold them, spec sketch held to the full template, check of `(planned)` at the end of a plan, commit body through a second `-m`).
- **v5 (18:22).** Delivered version.
