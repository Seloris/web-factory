# selo 2.0 — the ops export (proposal, 2026-10-21)

What the `selo` plugin writes for **Selo Ops**, the dashboard that replaces Claude Companion: every session of every project that installs the plugin, where it stands in the workflow, and the project's pages, domains and blueprints. Companion to `proposal.md` (the model: §4; the board removed: §5). Nothing is implemented yet.

## 1. Principles

1. **Two sources, joined on `sessionId`.** Claude Code already publishes the liveness of a session (`~/.claude/sessions/{pid}.json`: pid, cwd, `status`, name, `hostSessionId` for the desktop link) and its activity (the transcript: last prompt, current tool, subagents, question, tokens). Companion reads both today and keeps doing so in Selo Ops. The plugin writes **only what the workflow knows**: the lane, the blueprint, the step, the phase at the end of a turn, the proposed commit, the recap, the commits. Nothing is written twice.
2. **One file per session, one file per project.** The board wrote one file per root that every session rewrote at each scan: with 3–5 sessions on one checkout, writes raced. A session file is written by that session's hooks only; a project file is a pure function of the files and git, so the last writer is always right.
3. **Pointers, not copies.** A spec or a blueprint is exported as its path, title, counts and `mtime`; Selo Ops reads the markdown under the root when the person opens it, as Companion reads `plan.md` today (factory-board FR-35, BR-05/06). The export stays small and never lags the file.
4. **Drawn as exported.** States, phases and next prompts are computed once, in the plugin, where the rules live; Selo Ops never re-derives them (factory-board BR-02 stays). What the plugin cannot know (is the process alive, what tool runs) stays Claude Code's.
5. **Shell hooks, no mod.** The board was a function-hooks mod, the one reason it shaped rules of the workflow (`proposal.md` §1.8). The export is written by `hooks/hooks.json` command hooks running `scripts/ops.mjs` (ES module, Node 20+, no dependency, tests in `tests/`), like the commit hook: stack-agnostic, same plugin, versioned with it.
6. **Atomic, versioned, forward-only.** Every file is written to `{file}.tmp` then renamed; carries `schemaVersion`; a field is added, never renamed. A reader that meets an unknown version says so and skips the file (factory-board FR-04).

## 2. Where

```
~/.claude/selo/
  projects/{rootKey}.json     one per project root (a worktree is a root), §4
  sessions/{sessionId}.json   one per session that ran a hook in a selo project, §5
```

Read, not written: `{repo}/selo/slots/{n}.json`, the app's runs, one per slot, written by `run.mjs` (proposal §4.8). Selo Ops joins a session to its run by `root`; `repo` (the git common dir) says where to look.

`rootKey` is the root with every non-alphanumeric character turned into `-`, as `~/.claude/projects` names its folders (`C--WS-ia-projects-claude-companion`). The folder is overridable by Selo Ops' configuration, as `~/.claude/factory-board` is today. The plugin never deletes a file; a session file older than 30 days with `status: ended` is Selo Ops' to ignore.

## 3. When: the hooks

| Hook | Matcher | `ops.mjs` does |
|---|---|---|
| `SessionStart` | | Writes the session file (`status: live`, root, repo, `startedAt`, `transcriptPath`, `model` when the input has it), rescans the project. |
| `UserPromptSubmit` | | A `/selo:{lane} …` prompt opens a run on its step (§5.2); any other prompt opens a `free` run, or keeps the current run when it answers its question (a commit's yes, an answer). Phase → `working`. |
| `PreToolUse` | `Skill` | Same as above for a brief-driven call: an autopilot's subagents run the skills through the Skill tool, never from a typed prompt. `agent_id` makes it a subagent run. |
| `PostToolUse` | `Bash\|PowerShell` | A `git commit` that exited 0: reads `HEAD` (sha, subject, `Spec:` line), appends it to the run; a build moves to its next stage, a last stage to `review`, a merge commit closes the blueprint; rescans the project. A `node {plugin}/scripts/ops.mjs mark …` command sets the run's `substep` and `sheets` (§5.4). |
| `PostToolUse` | `Edit\|Write\|NotebookEdit` | Adds the path to the session's `touchedFiles`. A file under `.planning/blueprints/` names the run's `blueprint` (a draft has one before its commit); a file under `.planning/pages/` or `.planning/domain/` adds its sheet to `sheets`. |
| `PostToolUse` | `mcp__ccd_turn__wrap_up` | Keeps the call's `ask` for this turn: in the desktop app the question sits in that box, not in the last line of text (§5.3). |
| `SubagentStart` / `SubagentStop` | | Opens / closes the subagent's run, from `last_assistant_message`. |
| `Stop` | | Classifies `last_assistant_message` (§5.3): `awaiting-commit` with the message of its closing code block, `job-done` with the footer's recap, `awaiting-answer`, else `turn-ended`. Copies `background_tasks`, computes `dirtyFiles` and `close` (§5.5). Rescans the project. |
| `StopFailure` | | An API error ended the turn: phase `stopped`, `error` set. |
| `SessionEnd` | | `status: ended`; a run still `working` becomes `stopped`. |

Every hook also copies the input's `permission_mode` and `effort.level`, when present, to the session file: the latest value wins.

A hook that is not in a selo project (no `selo.yaml` up the tree) exits at once. A hook never blocks, never prints to the agent except the commit hook's warnings, and gives up after 5 s. Interrupted sessions are not guessed by age any more: Selo Ops has the pid file, and a session file `live` whose pid is gone is `interrupted` for it (one rule, in one place).

**A turn the person interrupts (Esc) fires no `Stop`** (Claude Code's hooks reference: Stop "does not run if the stoppage occurred due to a user interrupt"). The phase stays `working`; Selo Ops reads `working` with Claude Code's status `idle` as `interrupted-turn` (§6). The next prompt opens or resumes a run as usual.

## 4. The project file

```ts
type SeloProject = {
  schemaVersion: 1
  /** ISO 8601, everywhere in the export. */
  writtenAt: string
  /** Which build wrote it: the plugin's version. */
  selo: string
  root: string
  /** The git common dir, absolute: the same from every worktree, joins the roots of one repository. Null without git. */
  repo: string | null
  branch: string | null
  baseBranch: string
  /** Commits on `branch` that `baseBranch` does not have; null on the base branch itself or without git. */
  aheadCount: number | null
  /** Commits on `branch` that its upstream does not have: what a human still has to push. Null without an upstream; then every commit of the branch is unpushed. */
  unpushedCount: number | null
  /** Uncommitted paths (modified, staged, untracked). */
  changedCount: number
  manifest: {
    name: string
    preset: string
    /** Role → model id, on the preset. */
    models: Record<string, string>
    /** In implementation order, as `selo.yaml` lists them. */
    components: { name: string; path: string; kind: string }[]
  }
  /** The spec sheets: `pages/**`, `domain/**`, `app`. */
  sheets: Sheet[]
  /** Every blueprint, newest first; a merged one stays (it is never edited after). */
  blueprints: Blueprint[]
  /** Why the lists are empty, when they are: no `.planning`, a read that failed. */
  error: string | null
}

type Sheet = {
  kind: 'page' | 'domain' | 'app'
  /** The file's business name: `home`, `todo`, `app`. */
  slug: string
  /** The front it belongs to, when the project has two or more (`pages/{component}/home.md`). */
  component: string | null
  /** Relative to `root`, forward slashes. Selo Ops reads it there. */
  file: string
  title: string
  /** The `Route:` header line of a page. */
  route: string | null
  /** Live ids, retired ids, and the next free ones, from spec-check. */
  ids: { fr: number; br: number; retired: number; next: { fr: string; br: string } }
  /** The file's mtime (ISO): Selo Ops re-reads the markdown when it changes. */
  modifiedAt: string
  /** The last commit that touched it: when the spec last moved, as git says. */
  lastCommit: { sha: string; subject: string; at: string } | null
  /** The blueprints not merged yet whose delta touches this sheet: the work in flight the sheet does not show (proposal §9). */
  openBlueprints: string[]
}

type Blueprint = {
  /** The file name without its extension: `2026-10-21-due-date`. The commit scope is its last part. */
  name: string
  file: string
  title: string
  modifiedAt: string
  /** The `Pages:` / `Domain:` / `Components:` header line. */
  sheets: string[]
  components: string[]
  /** The `## Mockup` image, relative to `root`, when there is one. */
  mockup: string | null
  /**
   * `draft`: untracked, a `/selo:blueprint` still iterating. `ready`: committed, no stage ticked.
   * `building`: a stage ticked or a stage commit found, some left. `review`: every stage ticked, `Review` not.
   * `merging`: `Review` ticked, `Spec merged` not. `done`: `Spec merged` ticked. `legacy`: a 1.0 plan moved by `setup update`.
   */
  state: 'draft' | 'ready' | 'building' | 'review' | 'merging' | 'done' | 'legacy'
  delta: { sheet: string; op: '+' | '~' | '-'; id: string; text: string }[]
  /** The `## Business decisions` lines: what the person can check without opening the file. */
  decisions: string[]
  stages: {
    number: number
    /** What follows the dash in `N. {component} — …`. */
    component: string
    /** The commit subject the blueprint announces. */
    commit: string
    /** Its short SHA once a commit with that subject is on the branch. */
    sha: string | null
    /** The Progress box. */
    done: boolean
  }[]
  progress: { reviewDone: boolean; specMerged: boolean }
  /** The merge commit (`Spec: home +FR-18 …`), once there is one. */
  mergeCommit: { sha: string; subject: string } | null
  /** The prompts for its next step, computed by the plugin: `/selo:build {file}` (resume included), `/selo:review {file}`; null once done. */
  next: { label: string; prompt: string; autopilot: string | null } | null
  /** The live sessions working on it, from the session files of this root (a convenience; the session files are the source). */
  sessions: string[]
}
```

The stage `sha` is found as the board finds it: a commit whose subject equals the announced one, on the last 2000 commits of the branch.

## 5. The session file

### 5.1 Shape

```ts
type SeloSession = {
  schemaVersion: 1
  writtenAt: string
  sessionId: string
  root: string
  rootKey: string
  repo: string | null
  startedAt: string
  /** `live` from SessionStart to SessionEnd. Whether the process is alive is Claude Code's pid file. */
  status: 'live' | 'ended'
  /** From the hooks' input: where Selo Ops reads the transcript, without guessing its folder from the cwd. */
  transcriptPath: string | null
  /** SessionStart's `model`, when Claude Code gives it; the transcript stays the source for the model in use. */
  model: string | null
  /** The latest `permission_mode` and `effort.level` a hook received. */
  permissionMode: string | null
  effort: string | null
  /** Every path this session wrote (Edit, Write, NotebookEdit), relative to `root`, deduplicated. */
  touchedFiles: string[]
  /** The touched files still uncommitted at the last `Stop` (`git status`): what this session leaves behind, apart from the other sessions on the checkout. */
  dirtyFiles: string[]
  /** `background_tasks` of the last `Stop`: the shells and agents still running after the turn. */
  backgroundTasks: { id: string; type: string; status: string; description: string }[]
  /** Can the person close the session? Computed at each `Stop` (§5.5). */
  close: { ok: boolean; blockers: CloseBlocker[] }
  /** Every run of the session, newest first: the main loop's and its subagents'. */
  runs: Run[]
  /** The main loop's latest run: what a tile shows. An autopilot stands for its subagents. */
  current: Run | null
}

type Run = {
  /** `{sessionId}:{since}`, stable. */
  id: string
  /** The subagent the run works in (an autopilot's build, a review); null for the main loop. */
  agentId: string | null
  lane: 'fastlane' | 'blueprint' | 'build' | 'autopilot' | 'review' | 'try' | 'grill' | 'setup' | 'free'
  /** The prompt's text after the command, shortened to 200 characters. */
  request: string
  /** The blueprint the run works on (its `name`), once known: named by the command, written by the run (a draft), or found when a stage commit lands. */
  blueprint: string | null
  /** The sheets the run works on: from `ops.mjs mark`, the spec files it writes, then its commits' `Spec:` lines. A fastlane names its page before coding. */
  sheets: string[]
  /**
   * `blueprint` (writing it), `stage:N`, `review`, `merge` (the delta merged into the sheets), `fastlane`, `try`, `grill`, `setup`, `free`.
   * Frozen at the start; moved by a build's stage commits, or, for an autopilot, by each subagent it spawns.
   */
  step: string
  /** The last stage of a `— stage N` build; null when the build runs every stage. */
  lastStep: string | null
  /** Where the step stands, set by the skill through `ops.mjs mark` (§5.4); null before the first mark. */
  substep: 'bootstrap' | 'tests' | 'code' | 'suites' | 'review' | 'try' | 'merge' | 'commit' | null
  /** The `StopFailure` error, when an API error ended the run. */
  error: string | null
  /**
   * Where the run stands for the person, from the end of the last turn:
   * `working` while a turn runs; `awaiting-commit`: the turn ended on a commit question (its message in a closing code block);
   * `awaiting-answer`: on any other question; `job-done`: on the done footer; `turn-ended`: on none of these;
   * `stopped`: the session ended, or the autopilot stopped on a blocker, before `job-done`.
   */
  phase: 'working' | 'awaiting-commit' | 'awaiting-answer' | 'job-done' | 'turn-ended' | 'stopped'
  /** The commit proposed, whole: subject and body. Selo Ops shows the subject (live-sessions FR-36). */
  pendingCommit: { subject: string; body: string } | null
  /** The question asked, shortened, while `awaiting-answer`: the last line ending with `?`. */
  question: string | null
  /** The done footer: its recap line and its commits. */
  recap: { text: string | null; commits: { sha: string; subject: string }[] } | null
  /** Every commit the run made, oldest first, with its `Spec:` line (`pending (…)` during a build). */
  commits: { sha: string; subject: string; spec: string | null; at: string }[]
  /** The prompt that resumes the run where its blueprint's Progress is; null when nothing resumes it. */
  resumePrompt: string | null
  since: string
  updatedAt: string
}

type CloseBlocker =
  | 'not-done'          // phase is not `job-done`
  | 'pending-commit'    // a commit proposed, not made
  | 'question'          // a question waits for the person
  | 'dirty-files'       // `dirtyFiles` not empty
  | 'background-tasks'  // a background shell or agent still running
  | 'subagents'         // a subagent run still open
```

### 5.2 Which run a prompt opens

| Prompt | lane | step | blueprint |
|---|---|---|---|
| `/selo:fastlane {request}` | `fastlane` | `fastlane` | null (the sheet comes with the commit) |
| `/selo:blueprint {request}` | `blueprint` | `blueprint` | null until its file is committed |
| `/selo:build {file} [— stage N]` | `build` | first unticked `stage:N` | the file |
| `/selo:autopilot {request \| file}` | `autopilot` | `blueprint` or the first unticked stage | the file, or null |
| `/selo:review [scope]` | `review` | `review` | the file when the scope is one |
| `/selo:try`, `/selo:grill`, `/selo:setup` | same word | same word | null |
| anything else | `free` | `free` | null |

A prompt that answers the current run (its phase is `awaiting-commit` or `awaiting-answer`) keeps it and sets `working`; a run `job-done` or `turn-ended` is over: the next prompt opens a new run.

### 5.3 Reading the end of a turn

From `last_assistant_message`, in this order:

1. Ends with the done footer (`## ✅ JOB DONE`, a `> ` line, zero or more commit lines) → `job-done`, `recap` filled. A free request answered without a commit ends with the footer and its recap line alone (proposal §3 Q4): it is `job-done` too, with no commits. The recap line covers the whole run, every turn since its prompt (a build resumed after a commit's yes included), not only the last turn: `recap.text` is the run's recap as written, never rebuilt from earlier turns.
2. The last fenced code block is the last text and its first line matches `{type}({scope}): ` → `awaiting-commit`, `pendingCommit` = the block.
3. A `wrap_up` call of this turn carried an `ask`, or the last non-empty line ends with `?` → `awaiting-answer`, `question` = the `ask`, else that line.
4. Otherwise `turn-ended`: the turn ended without the footer, a rule the workflow broke, shown as such.

The footer and the commit block are the only shapes the workflow rules fix for this export (proposal §3 Q4 keeps the footer, lighter): "the board reads it" becomes "Selo Ops reads it", one line in `reference/rules.md`. The footer is what flags a session done: every turn that finished its job ends with it, with or without a commit.

### 5.4 Marks: the page and the substep

A skill marks where it is with one Bash call, `node ${CLAUDE_PLUGIN_ROOT}/scripts/ops.mjs mark {substep} [sheet …]`, at each change: `bootstrap` (the spec of an empty page), `tests` (red tests written), `code`, `suites`, `review`, `try`, `merge`, `commit`. The script itself prints nothing and writes nothing: the `PostToolUse` hook reads the command with the session id the script does not have, and sets `substep`, adds the sheets. A fastlane's first mark names its page (`mark tests home`), so the tile shows the page before the commit. A skill that forgets a mark loses detail on the dashboard, never a state: phase and step do not depend on marks.

### 5.5 Can the session be closed

`close` is computed at each `Stop`, and at `SessionEnd`, on the main loop's `current` run:

- `ok` when `blockers` is empty.
- `not-done` unless `phase` is `job-done`; `pending-commit` when `pendingCommit` is set; `question` when `phase` is `awaiting-answer`.
- `dirty-files` when `dirtyFiles` is not empty: the files this session wrote and nobody committed. Files of other sessions on the checkout never block it.
- `background-tasks` when an entry of `backgroundTasks` is `running`; `subagents` when a subagent run has no `SubagentStop` yet.

A session file is written by its own hooks only (§1.2): a file another session commits later leaves `dirty-files` until this session's next `Stop`. Selo Ops shows `close` as is, and the blockers in words on the tile.

## 6. What Selo Ops derives, and from what

| On the dashboard | From |
|---|---|
| Alive, cwd, title, desktop link, origin | Claude Code's `~/.claude/sessions/{pid}.json` |
| Current tool, subagents at work, last prompt, question asked by Claude Code, tokens | The transcript, as Companion reads it |
| Column `Vous attend` | `phase` ∈ {`awaiting-commit`, `awaiting-answer`}, or Claude Code's `awaitingAnswer` |
| Pill: which source | Claude Code's status while it says `running` or `awaitingAnswer` (a turn, a dialog); the plugin's `phase` once it says `idle` (only the plugin knows why the turn ended). No timestamp comparison: at a turn's end the pid file and the session file are written within milliseconds, in either order. A stale phase goes at the next prompt (`working`). |
| Band `blueprint › étape`, stage segments | `current` of the session file + its blueprint in the project file |
| `Interrompue` | session file `live`, pid file gone, or `phase: stopped` |
| `Tour interrompu` (Esc) | `phase: working` while Claude Code says `idle`: no `Stop` fired (§3) |
| Badge `Tu peux fermer` / its blockers | `close` of the session file (§5.5) |
| Band `page · sous-étape` | `current.sheets`, `current.substep` |
| Session's technical line: model, effort, permission mode | `permissionMode`, `effort` of the session file; the model from the transcript (`model` of the file when it has none yet) |
| Project: `N non poussés` | `unpushedCount` (`aheadCount` stays the distance to the base branch) |
| Project `Activité` | Among the root's session files: `awaiting-commit`, then `awaiting-answer`, then `working`, else the latest |
| Stale project | `writtenAt` older than 60 s **and** no live session on the root (a project with no session open is simply not rescanned: it is not stale, it is quiet) |
| Specs page: pages, domains, their FR/BR counts, what is in flight on each | `sheets[]` + `openBlueprints`; the markdown read under the root on click |
| Blueprints page: state, stages, decisions, delta, next prompt | `blueprints[]`; the markdown on click |
| Session and project: worktree, branch, app's ports and links | `root` and `branch`; the slot file of `{repo}/selo/slots/` whose `root` is the same, `stoppedAt` null and `pid` alive |
| Header: plugin version | `selo` of the newest project file, or `installed_plugins.json` as today |

## 7. Example

`~/.claude/selo/sessions/59ec7eff-….json`, a build between its two stages, the person asked to commit:

```json
{
  "schemaVersion": 1,
  "writtenAt": "2026-10-21T14:02:11.000Z",
  "sessionId": "59ec7eff-18ab-44b0-829d-e33b4e8e040e",
  "root": "C:/WS/ia-projects/selo-ops",
  "rootKey": "C--WS-ia-projects-selo-ops",
  "repo": "C:/WS/ia-projects/selo-ops/.git",
  "startedAt": "2026-10-21T13:40:02.000Z",
  "status": "live",
  "transcriptPath": "C:/Users/me/.claude/projects/C--WS-ia-projects-selo-ops/59ec7eff-18ab-44b0-829d-e33b4e8e040e.jsonl",
  "model": "claude-opus-5-5",
  "permissionMode": "auto",
  "effort": "high",
  "touchedFiles": ["web/src/features/todos/TodoList.tsx", "web/src/features/todos/TodoForm.tsx"],
  "dirtyFiles": ["web/src/features/todos/TodoList.tsx", "web/src/features/todos/TodoForm.tsx"],
  "backgroundTasks": [],
  "close": { "ok": false, "blockers": ["not-done", "pending-commit", "dirty-files"] },
  "current": {
    "id": "59ec7eff-18ab-44b0-829d-e33b4e8e040e:1792598402000",
    "agentId": null,
    "lane": "build",
    "request": ".planning/blueprints/2026-10-21-due-date.md",
    "blueprint": "2026-10-21-due-date",
    "sheets": ["home", "todo"],
    "step": "stage:2",
    "lastStep": null,
    "substep": "commit",
    "error": null,
    "phase": "awaiting-commit",
    "pendingCommit": { "subject": "feat(due-date): web — due dates and late todos in the list", "body": "Spec: pending (.planning/blueprints/2026-10-21-due-date.md)" },
    "question": null,
    "recap": null,
    "commits": [{ "sha": "f677536", "subject": "feat(due-date): api — optional due date on a todo", "spec": "pending (.planning/blueprints/2026-10-21-due-date.md)", "at": "2026-10-21T13:51:40.000Z" }],
    "resumePrompt": "/selo:build .planning/blueprints/2026-10-21-due-date.md",
    "since": "2026-10-21T13:40:02.000Z",
    "updatedAt": "2026-10-21T14:02:11.000Z"
  },
  "runs": ["… the same run, then the earlier ones …"]
}
```

## 8. Decisions (2026-10-21)

1. **Tokens** → Not in the export. Selo Ops counts them from the transcript, as Companion does.
2. **Claude Code's status vs the plugin's phase** → By Claude Code's status, never by timestamps (§6, "Pill: which source"): `running` / `awaitingAnswer` are Claude Code's, `idle` reads the plugin's phase. A timestamp rule was rejected: at a turn's end both files are written within milliseconds, and the pid file winning would hide an `awaiting-commit` behind `idle`.
3. **A session with several roots** → One session file, its `root` the last root; every root it passed through gets its project file rescanned.
4. **Idle projects** → `node {plugin}/scripts/ops.mjs scan {root}` rescans a project without a session; Selo Ops may run it, read-only, on the roots `installed_plugins.json` lists for `selo`.

2026-10-22, after a challenge of the export against "can I close this session?":

5. **Closing a session** → A `close` field computed by the plugin (§5.5), with its blockers. Uncommitted work is counted per session (`touchedFiles` ∩ `git status`), not per root: with 3–5 sessions on one checkout, `changedCount` cannot say what this session left.
6. **The done footer flags the session** → `job-done` needs the footer; the recap-only footer of a free request without a commit stays (proposal §3 Q4 changed). `turn-ended` means the footer is missing.
7. **Desktop questions** → A `PostToolUse` on `mcp__ccd_turn__wrap_up` keeps its `ask`. It names one host's tool; with another host the last-line rule stays.
8. **Esc** → No `Stop` fires on an interrupt (checked in the hooks reference, 2026-10-22); Selo Ops reads `working` + `idle` as an interrupted turn.
9. **Substeps** → Marked by the skills (`ops.mjs mark`, §5.4), not guessed from the tools: only the skill knows that it moved from tests to code.
10. **Technical fields** → `transcriptPath`, `permissionMode`, `effort` come from the hooks' common input; `model` only from SessionStart, which does not always carry it. Output style is in no hook input: left out. `unpushedCount` added: under "never push", it is what the person checks before closing.
11. **The app's runs** → Not in the export: the slot files (proposal §4.8) already hold the ports and pids, written when a run starts and stops. Selo Ops reads them by `repo` and `root`; both sides use the same form of `root`.
