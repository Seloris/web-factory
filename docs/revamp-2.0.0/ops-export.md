# selo 2.0 — the ops export (proposal, 2026-10-21)

What the `selo` plugin writes for **Selo Ops**, the dashboard that replaces Claude Companion: every session of every project that installs the plugin, where it stands in the workflow, and the project's pages, domains and blueprints. Companion to `proposal.md` (the model: §4; the board removed: §5). Implemented at step 7 (2026-10-22): `plugins/selo/scripts/ops.mjs`, its hooks in `hooks/hooks.json`, tests in `tests/ops.test.mjs`; the choices the text left open are §8, 12 to 22. **Since selo 2.1.0 the export is the `selo-ops` plugin's** (`plugins/selo-ops/`, enabled at user scope) and covers every session, a selo project or a plain root: `ops-plugin.md`. Where this text says "the plugin" or `{plugin}`, read `selo-ops`.

## 1. Principles

1. **Two sources, joined on `sessionId`.** Claude Code already publishes the liveness of a session (`~/.claude/sessions/{pid}.json`: pid, cwd, `status`, name, `hostSessionId` for the desktop link) and its activity (the transcript: last prompt, current tool, subagents, question, tokens). Companion reads both today and keeps doing so in Selo Ops. The plugin writes **only what the workflow knows**: the lane, the blueprint, the step, the phase at the end of a turn, the proposed commit, the recap, the commits. Nothing is written twice. Since selo-ops 2.2.0 it also writes what each run consumed, read from the transcript once, where the runs are known (§5.6).
2. **One file per session, one file per project.** The board wrote one file per root that every session rewrote at each scan: with 3–5 sessions on one checkout, writes raced. A session file is written by that session's hooks only; a project file is a pure function of the files and git, so the last writer is always right.
3. **Pointers, not copies.** A spec or a blueprint is exported as its path, title, counts and `mtime`; Selo Ops reads the markdown under the root when the person opens it, as Companion reads `plan.md` today (factory-board FR-35, BR-05/06). The export stays small and never lags the file.
4. **Drawn as exported.** States, phases and next prompts are computed once, in the plugin, where the rules live; Selo Ops never re-derives them (factory-board BR-02 stays). What the plugin cannot know (is the process alive, what tool runs) stays Claude Code's.
5. **Shell hooks, no mod.** The board was a function-hooks mod, the one reason it shaped rules of the workflow (`proposal.md` §1.8). The export is written by `hooks/hooks.json` command hooks running `scripts/ops.mjs` (ES module, Node 20+, no dependency, tests in `tests/`), like the commit hook: stack-agnostic, same plugin, versioned with it.
6. **Atomic, versioned, forward-only.** Every file is written to `{file}.{pid}.tmp` then renamed (the pid: two hooks of one session may run at once); carries `schemaVersion`; a field is added, never renamed. A reader that meets an unknown version says so and skips the file (factory-board FR-04).

## 2. Where

```
~/.claude/selo/
  projects/{rootKey}.json     one per project root (a worktree is a root), §4
  sessions/{sessionId}.json   one per session that ran a hook, §5 (a plain root too since selo-ops 1.0.0: ops-plugin.md §3)
```

Read, not written: `{repo}/selo/slots/{n}.json`, the app's runs, one per slot, written by `run.mjs` (proposal §4.8). Selo Ops joins a session to its run by `root`; `repo` (the git common dir) says where to look.

`rootKey` is the root with every non-alphanumeric character turned into `-`, as `~/.claude/projects` names its folders (`C--WS-ia-projects-claude-companion`). The folder is overridable by Selo Ops' configuration, as `~/.claude/factory-board` is today. The plugin never deletes a file; a session file older than 30 days with `status: ended` is Selo Ops' to ignore.

## 3. When: the hooks

| Hook | Matcher | `ops.mjs` does |
|---|---|---|
| `SessionStart` | | Writes the session file (`status: live`, root, repo, `startedAt`, `transcriptPath`, `model` when the input has it), rescans the project. |
| `UserPromptSubmit` | | A `/selo:{lane} …` prompt opens a run on its step (§5.2); any other prompt opens a `free` run, or keeps the current run when it answers its question (a commit's yes, an answer). A subagent's hand-back (nothing but `<agent-message from="{agent_id}">` blocks of a known subagent run, after the harness's blocks and the `Another Claude session sent a message:` preamble) keeps the main run too, and so does a prompt holding nothing but `<task-notification>` blocks (a background subagent's end; selo-ops 1.0.0 opened an empty `free` run there). Phase → `working`, `pendingCommit`, `question` and `error` cleared. Opening a main run first settles the previous one's `usage` on its slice up to the transcript's size now (§5.6), then sets the new run's `transcriptFrom` to that size (0 when the transcript does not exist yet). |
| `PreToolUse` | `Skill` | Same as above for a brief-driven call: an orchestrator's subagents, and an interactive pilot's lane, run the skills through the Skill tool, never from a typed prompt. `agent_id` makes it a subagent run. The skill is named `selo:{name}` or by its short `{name}` (selo-ops 2.5.0). |
| `PreToolUse` | any other tool (selo-ops 2.5.0) | Only for a main run still `free`, with no `skill`, `working`, not read yet: reads the run's first transcript rows for a short command (decision 31) and retags the run. Any other call leaves after reading the session file, without the lock. |
| `PostToolUse` | `Bash\|PowerShell` | A `git commit` that exited 0: reads `HEAD` (sha, subject, `Spec:` line), appends it to the run; a build moves to its next stage, a last stage to `review`, a merge commit closes the blueprint; rescans the project. A `node {plugin}/scripts/ops.mjs mark …` command sets the run's `substep` and `sheets` (§5.4). |
| `PostToolUse` | `Edit\|Write\|NotebookEdit` | Adds the path to the session's `touchedFiles`. A file under `.planning/blueprints/` names the run's `blueprint` (a draft has one before its commit); a file under `.planning/pages/` or `.planning/domain/` adds its sheet to `sheets`. |
| `PostToolUse` | `mcp__ccd_turn__wrap_up` | Keeps the call's `ask` for this turn: in the desktop app the question sits in that box, not in the last line of text (§5.3). |
| `PreToolUse` | `Agent\|Task` | Queues the call's task (`description`, else `prompt`) and its `prompt` (300 characters) in `pendingAgents`, under its `subagent_type`. |
| `SubagentStart` / `SubagentStop` | | Opens the subagent's run, its `task` and `prompt` taken from the oldest queued call of its `agent_type` / closes it, from `last_assistant_message`; sets its `usage` from `agent_transcript_path` read whole, `settled: true` (§5.6); sets its `task` and `requestedModel` from the `description` and `model` of the meta file beside it (`agent-{id}.meta.json`), its `prompt` from the transcript's first user row: its own files, so a task swapped between two calls of one type is set right. |
| `Stop` | | Classifies `last_assistant_message` (§5.3): `awaiting-commit` with the message of its closing code block, `job-done` with the footer's recap, `awaiting-answer`, else `turn-ended`. Copies `background_tasks`, computes `dirtyFiles` and `close` (§5.5). Sets `model` and `context` from the transcript's last assistant message (`context.baseline` from its first one, once). A main run still `free` that called no tool is first read for a short command, as at `PreToolUse` (selo-ops 2.5.0). Sets the current main run's `usage` from its slice (`transcriptFrom` to the end), `settled: false` (§5.6). Rescans the project. |
| `StopFailure` | | An API error ended the turn: phase `stopped`, `error` set. |
| `SessionEnd` | | `status: ended`; a run still `working` becomes `stopped`. Settles the current main run's `usage` (§5.6). |

Every hook also copies the input's `permission_mode` and `effort.level`, when present, to the session file: the latest value wins.

A hook that is not in a selo project (no `selo.yaml` up the tree) exits at once. A hook never blocks, never prints to the agent except the commit hook's warnings, and gives up after 5 s. Interrupted sessions are not guessed by age any more: Selo Ops has the pid file, and a session file `live` whose pid is gone is `interrupted` for it (one rule, in one place).

**A turn the person interrupts (Esc) fires no `Stop`** (Claude Code's hooks reference: Stop "does not run if the stoppage occurred due to a user interrupt"). The phase stays `working`; Selo Ops reads `working` with Claude Code's status `idle` as `interrupted-turn` (§6). The next prompt opens or resumes a run as usual.

## 4. The project file

```ts
type SeloProject = {
  schemaVersion: 1
  /** ISO 8601, everywhere in the export. */
  writtenAt: string
  /** Which build wrote it: the plugin's version (`selo-ops`' since its 1.0.0; `selo`'s version is in `installed_plugins.json`). */
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
    /** Role → model id, on the preset: the person's settings (`SELO_MODELS`, `SELO_MODEL_{ROLE}`, selo 2.8.0) as the exporting process sees them. */
    models: Record<string, string>
    /** In implementation order, as `selo.yaml` lists them. */
    components: { name: string; path: string; kind: string }[]
  }
  /** The spec sheets: `pages/**`, `domain/**`, `app`. */
  sheets: Sheet[]
  /** Every blueprint, newest first; a merged one stays (it is never edited after). */
  blueprints: Blueprint[]
  /** Every `.planning/mockups/*.html` of this checkout, by file name (selo-ops 2.9.0). Selo Ops offers `validated && !committed`: validated, waiting to be built. */
  mockups: Mockup[]
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

type Mockup = {
  /** Relative to `root`, forward slashes: `.planning/mockups/2026-10-26-new-session-modes.html`. */
  file: string
  /** The text of its `<title>`, else the file name without `.html`. */
  title: string
  /** Its first 8 KB carry `<meta name="selo:mockup" content="validated">`, written by `/selo:mockup` on validation (selo's rules, **Mockup first**). */
  validated: boolean
  /** False when git lists it untracked, modified or staged. */
  committed: boolean
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
  /** The prompts for its next step, computed by the plugin: `/selo:build {file}` (resume included), `/selo:review {file}`; `pilot`: the same step with no question, `/selo:pilot {file} — autonomous` (`autopilot`, `/selo:autopilot {file}`, before selo-ops 2.8.0); null once done. */
  next: { label: string; prompt: string; pilot: string | null } | null
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
  /** The version of `selo-ops` that wrote the file, at every write; null if its `plugin.json` is unreadable. Added by selo-ops 2.2.1. */
  writtenBy: string | null
  sessionId: string
  root: string
  rootKey: string
  /** True in a selo project; false in a plain root (no `selo.yaml` up the tree: ops-plugin.md §3), whose runs are all `free`. Added by selo-ops 1.0.0. */
  selo: boolean
  repo: string | null
  startedAt: string
  /** Every run's usage summed, the main loop's and the subagents', including runs dropped past the 100 kept (§5.6). Null before the first one. Added by selo-ops 2.2.0. */
  usage: Usage | null
  /** The lead's context window as its last API call sent it, set at each `Stop`. Null before the first one, and in a session file older than selo-ops 2.4.0. The window's size is not exported: no hook input nor transcript row gives it. Added by selo-ops 2.4.0. */
  context: {
    /** input + cacheRead + cacheWrite of the main transcript's last assistant row with a usage (not `<synthetic>`, not a sidechain row). */
    tokens: number
    /** That call's model. */
    model: string | null
    /** The session's first call, its four token kinds: the base instructions (system prompt, tools, instruction files) plus the first prompt, re-read on every call. Kinds, not a sum: a first call that hits a warm cache weighs far less than one that writes it. Read before the lock, from the transcript's first 2 MB, until found; null when none is there yet. */
    baseline: Tokens | null
  } | null
  /** `live` from SessionStart to SessionEnd. Whether the process is alive is Claude Code's pid file. */
  status: 'live' | 'ended'
  /** From the hooks' input: where Selo Ops reads the transcript, without guessing its folder from the cwd. */
  transcriptPath: string | null
  /** The model of the transcript's last assistant message, set at each `Stop`; SessionStart's `model` before the first one, when Claude Code gives it. */
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
  /** Agent calls whose subagent has not started yet: SubagentStart carries no prompt. At most 10. */
  pendingAgents: { type: string; task: string; prompt: string | null }[]
  /** Can the person close the session? Computed at each `Stop` (§5.5). */
  close: { ok: boolean; blockers: CloseBlocker[] }
  /** Every run of the session, newest first: the main loop's and its subagents'. */
  runs: Run[]
  /** The main loop's latest run: what a tile shows. An orchestrator (`pilot — autonomous`, or a run of the old `autopilot`) stands for its subagents. */
  current: Run | null
}

type Run = {
  /** `{sessionId}:{since}`, stable. */
  id: string
  /** The subagent the run works in (an orchestrator's build, a review); null for the main loop. */
  agentId: string | null
  /** The subagent's `agent_type`, from `SubagentStart`; kept when a skill names its lane. Null for the main loop. */
  agentType: string | null
  /** Deprecated since selo-ops 2.5.0, kept one version for older readers: read `flow` and `skill`. The `/selo:{name}` that opened the run, `free` for none and for `/selo:run`. */
  lane: 'fastlane' | 'blueprint' | 'build' | 'pilot' | 'autopilot' | 'review' | 'try' | 'grill' | 'setup' | 'free'
  /**
   * How the work is driven, set by the run's first lane skill (`fastlane`; `blueprint` and `build` → `blueprint`; `pilot`), then fixed: an interactive pilot that calls the fastlane stays `pilot`. `autopilot` is no longer written (selo-ops 2.8.0); a run exported before keeps it.
   * A tool skill alone (`grill`, `mockup`, `review`, `try`, `run`, `setup`) and no skill leave `free`. Added by selo-ops 2.5.0.
   */
  flow: 'free' | 'fastlane' | 'blueprint' | 'pilot' | 'autopilot'
  /**
   * The selo skill running now, null for none. From the `/selo:{name}` prompt, a short `/{name}` command (read from the transcript),
   * or the Skill tool. An orchestrator's main run (`flow: 'pilot'` with `mode: 'autonomous'`) takes its subagents' skill (`pilot` until its first one); an interactive pilot's takes the lane skill it calls. A tool skill called during a lane
   * replaces the lane's skill; the lane's comes back at the run's next mark or its done footer (no event says a skill ended). Added by selo-ops 2.5.0.
   */
  skill: 'fastlane' | 'blueprint' | 'build' | 'pilot' | 'autopilot' | 'grill' | 'mockup' | 'review' | 'try' | 'run' | 'setup' | null
  /**
   * The prompt's suffix, as it says it: `iterate` when a fastlane's prompt carries ` — iterate` (a loop of changes, no test, review or commit until
   * the person validates; the fastlane's end follows, from its `tests` mark on); `autonomous` when a selo skill's prompt carries ` — autonomous`
   * (a `pilot` run: the orchestrator; a subagent's step: run with no question); else null. Read from the whole prompt, before `request` is cut;
   * set with the run's first skill that carries one, then fixed. Added by selo-ops 2.7.0; `autonomous` by 2.8.0.
   */
  mode: 'iterate' | 'autonomous' | null
  /** The prompt's text after the command, shortened to 200 characters once the harness's leading blocks are gone (a `<pasted_content>` unwrapped, any other closed block such as `<artifact-view-context>` dropped); a subagent's `agent_type` until a skill names its lane. */
  request: string
  /** A subagent's title: its Agent call's `description` (else its `prompt`), 200 characters, then at `SubagentStop` the `description` of its meta file (set right if two calls of one type swapped); null for the main loop. */
  task: string | null
  /** A subagent's prompt, its first 300 characters: its Agent call's `prompt`, then at `SubagentStop` its transcript's first user row. Null for the main loop, and on a run written before selo-ops 2.4.0. Added by selo-ops 2.4.0. */
  prompt: string | null
  /** The model a subagent was asked for, as its meta file says it (`haiku`, `opus`…; the real one is `usage.byModel`); null when none was asked, for the main loop, and before selo-ops 2.4.0. Added by selo-ops 2.4.0. */
  requestedModel: string | null
  /** The blueprint the run works on (its `name`), once known: named by the command, written by the run (a draft), or found when a stage commit lands. */
  blueprint: string | null
  /** The sheets the run works on: from `ops.mjs mark`, the spec files it writes, then its commits' `Spec:` lines. A fastlane names its page before coding. */
  sheets: string[]
  /**
   * Where a blueprint's build stands: `stage:N`, `review`, `merge` (the delta merged into the sheets); null otherwise.
   * Set at the start (a build, a pilot on a file, a review of a blueprint); moved by a build's stage commits, or, for an orchestrator, by each subagent it spawns.
   * Before selo-ops 2.5.0 it also held the lane's name (`blueprint`, `fastlane`, `try`, `grill`, `setup`, `free`).
   */
  step: string | null
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
   * `stopped`: the session ended, or the orchestrator stopped on a blocker, before `job-done`.
   */
  phase: 'working' | 'awaiting-commit' | 'awaiting-answer' | 'job-done' | 'turn-ended' | 'stopped'
  /** The commit proposed, whole: subject and body. Selo Ops shows the subject (live-sessions FR-36). */
  pendingCommit: { subject: string; body: string } | null
  /** The question asked, shortened, while `awaiting-answer`: the last line ending with `?`. */
  question: string | null
  /** The done footer: its recap line and its commits. */
  recap: { text: string | null; commits: { sha: string; subject: string }[] } | null
  /** The next steps the done footer proposes, its `Next:` lines in order: a summary in the chat language, and the prompt to run. [] outside `job-done`; missing on a run written before selo-ops 2.3.0. Unlike `resumePrompt`, it is what the turn said, in any project, selo or not. Added by selo-ops 2.3.0. */
  next: { text: string; prompt: string }[]
  /** Every commit the run made, oldest first, with its `Spec:` line (`pending (…)` during a build). */
  commits: { sha: string; subject: string; spec: string | null; at: string }[]
  /** The prompt that resumes the run where its blueprint's Progress is; null when nothing resumes it. */
  resumePrompt: string | null
  /** What the run consumed (§5.6). Null until its first `Stop` (main run) or `SubagentStop` (subagent run); stays null for a subagent stopped by Esc, which fires no `SubagentStop`, and for a run written by 1.0.0. Added by selo-ops 2.2.0. */
  usage: RunUsage | null
  /** Main run: the transcript's size in bytes when the run opened, where its slice starts. Subagent run: null. Internal to the export; Selo Ops does not read it. Added by selo-ops 2.2.0. */
  transcriptFrom: number | null
  /** True once the run's first rows were read for a short command. Internal to the export; absent until then. Added by selo-ops 2.5.0. */
  commandRead?: boolean
  /**
   * The run's history, oldest first: one entry each time `skill`, `step`, `substep` or `phase` changes (none when all four equal the previous entry's);
   * the flat fields always equal its last entry. `flow` is not in it. A short command's retag replaces the entries before it. Added by selo-ops 2.5.0.
   */
  trail: { at: string; skill: string | null; step: string | null; substep: string | null; phase: string }[]
  /** True once `trail` went over its 50 entries and its oldest were dropped. Added by selo-ops 2.5.0. */
  trailCut: boolean
  since: string
  updatedAt: string
}

type Tokens = { input: number; cacheRead: number; cacheWrite: number; output: number }

type Usage = {
  /** API calls, deduplicated by message id; a `<synthetic>` row is none. */
  calls: number
  tokens: Tokens
  /** One row per model the calls ran on (`message.model` of assistant rows), most tokens first. A subagent run's real model is its first row. */
  byModel: { model: string; calls: number; tokens: Tokens }[]
  /** The breakdown's raw input (the kookiz-usage mod's « Répartition »): characters each group added to the main conversation, most first. `conversation`: the person's text, Claude's text and Claude's tool inputs; a tool group: the results of its tools — `shell` (Bash, PowerShell), `files` (Read, Write, Edit, Glob, Grep, NotebookEdit), `web` (WebSearch, WebFetch), `agents` (Agent, SendMessage), `skills` (Skill), `app` (an `mcp__ccd_…` tool), `mcp:{server}` (any other MCP server, named as in the tool name), `other` (any other tool, or a result whose call is outside the slice). Main runs only, and the session's sum of them: a subagent run has none (its share is its own `usage`). Absent before selo-ops 2.4.0. Characters, not tokens: Selo Ops shares the lead's input beyond `context.baseline` by them. Added by selo-ops 2.4.0. */
  sizes?: Record<string, number>
}

type RunUsage = Usage & {
  /** Tool calls by name, most first; the advisor as `advisor`. */
  tools: { name: string; count: number }[]
  /** Skills loaded, without a leading slash: `tool` (the Skill tool), `command` (typed as `/{name}`), `preloaded` (an agent's frontmatter). */
  skills: { name: string; count: number; how: 'tool' | 'command' | 'preloaded' }[]
  /** Main runs only: one row per prompt the person typed in the run, oldest first, at most 50 (the latest kept). A subagent run has []. */
  prompts: { at: string | null; calls: number; tokens: Tokens }[]
  /** False while read at a `Stop`, whose transcript may lack the turn's last message; true once settled (§5.6). */
  settled: boolean
  /** True when the slice was over the read cap (32 MB): the figures cover its last 32 MB only. */
  partial: boolean
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

| Prompt | flow | skill | step | blueprint |
|---|---|---|---|---|
| `/selo:fastlane {request}` | `fastlane` | `fastlane` | null | null (the sheet comes with the commit) |
| `/selo:fastlane {request} — iterate` | `fastlane` | `fastlane` | null | null; `mode: "iterate"` |
| `/selo:blueprint {request}` | `blueprint` | `blueprint` | null | null until its file is committed |
| `/selo:build {file} [— stage N]` | `blueprint` | `build` | first unticked `stage:N` | the file |
| `/selo:pilot {request \| file}` | `pilot` | `pilot` | null, or the first unticked stage | the file, or null; `mode: "autonomous"` with ` — autonomous` |
| `/selo:review [scope]` | `free` | `review` | `review` when the scope is a blueprint, else null | the file when the scope is one |
| `/selo:try`, `/selo:grill`, `/selo:mockup`, `/selo:setup`, `/selo:run` | `free` | same word | null | null |
| anything else | `free` | null | null | null |

The short `/{name}` comes to the hook raw: it opens a `free` run, retagged as its `/selo:{name}` form at the run's first tool call or its `Stop` (decision 31). The deprecated `lane` is the `/selo:` word, `free` for `/selo:run` and anything else.

A prompt that answers the current run (its phase is `awaiting-commit` or `awaiting-answer`; neither a `/selo:` command nor a short `/{name}` of a selo skill) keeps it and sets `working`; a run `job-done` or `turn-ended` is over: the next prompt opens a new run.

### 5.3 Reading the end of a turn

From `last_assistant_message`, in this order:

1. Ends with the done footer (`## ✅ JOB DONE`, a `> ` line, zero or more commit lines, zero or more `` Next: {summary} · `{prompt}` `` lines) → `job-done`, `recap` and `next` filled. A free request answered without a commit ends with the footer and its recap line alone (proposal §3 Q4): it is `job-done` too, with no commits. The recap line covers the whole run, every turn since its prompt (a build resumed after a commit's yes included), not only the last turn: `recap.text` is the run's recap as written, never rebuilt from earlier turns.
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

### 5.6 Usage (selo-ops 2.2.0)

Read from the transcript by `scripts/usage.mjs` (`docs/revamp-2.2.0/proposal.md` §3 to §5): an API call is an `assistant` row with `message.usage` and `message.id`, deduplicated by id; only `message.model` of assistant rows names a model (an `attachment` row naming one is no call); a tool call is a `tool_use` part, the advisor a `server_tool_use` part named `advisor`; a skill is a `Skill` call, a typed `<command-name>`, or a meta row holding `<skill-format>true</skill-format>` that no Skill call or command just announced (a preload); a built-in or local command (`/compact`, `/model`, `/clear`, a mod's command: its row comes after a meta `<local-command-caveat>` row, or is followed by a `<local-command-stdout>` row) is neither a skill nor a prompt; a prompt is a user row that is not meta, not a compaction summary, holds no `tool_result`, and is neither `<local-command-…>`, `<task-notification>`, an Esc marker (`[Request interrupted by user…`) nor a subagent's hand-back (`<agent-message from=…`). A row written twice (same `uuid`, a transcript replaying its history) is read once; in a main slice, a sidechain row is its subagent's and is skipped; a subagent's own transcript (`subagents/agent-{id}.jsonl`), where every row is a sidechain row, is read with them (selo-ops 2.3.0 skipped them there too: every subagent run read zero).

- **A main run reads its slice**: from its `transcriptFrom` (the size at its `UserPromptSubmit`, which fires before the prompt's row is written) to the end at `Stop` (`settled: false`: the last message may be missing), to the next main run's `transcriptFrom` when that run opens, or to the end at `SessionEnd` (`settled: true`). An Esc'd turn is caught by the settling read. A subagent run reads its own transcript whole at `SubagentStop`.
- **The session's totals** move by the difference: `usage += new − previous` for the run read. A run dropped past the 100 kept keeps its last contribution.
- **Cost**: only lines holding `"type":"assistant"` or `"type":"user"` are parsed (a request shape naming a role is not); a cut line is skipped; a slice over 32 MB is read from its last 32 MB, `partial: true`. The slice is read before the session's lock, from the session file read without it, and set under the lock only on a main run whose `id` and `transcriptFrom` are unchanged (a subagent run: on its `agentId`); an empty slice changes nothing: under the lock only JSON is read and written. When the read before the lock failed, or decided the prompt kept the run while it opens one under the lock, the transcript's size and the settling read are taken under the lock instead (rare). The lock wait is shortened so the hook stays inside its 4.5 s, and a hook whose read used up its time writes nothing; the next read catches up.

## 6. What Selo Ops derives, and from what

| On the dashboard | From |
|---|---|
| Alive, cwd, title, desktop link, origin | Claude Code's `~/.claude/sessions/{pid}.json` |
| Current tool, subagents at work, last prompt, question asked by Claude Code | The transcript, as Companion reads it |
| Tokens per run, per model, per prompt; tools, skills; a subagent's real model; session totals | `usage` of each run and of the session (§5.6, selo-ops 2.2.0); « — » for a session file of 1.0.0 |
| A subagent's title, prompt, requested model | `task`, `prompt`, `requestedModel` of its run (selo-ops 2.4.0) |
| Current context | `context.tokens` of the session file (selo-ops 2.4.0) |
| « Répartition » | Selo Ops' own estimate from raw figures: base instructions from `context.baseline`, Claude's output from `usage.tokens.output`, the rest of the lead's input shared by `usage.sizes`, one bar per subagent type from its runs' `usage` (selo-ops 2.4.0) |
| Column `Vous attend` | `phase` ∈ {`awaiting-commit`, `awaiting-answer`}, or Claude Code's `awaitingAnswer` |
| Pill: which source | Claude Code's status while it says `running` or `awaitingAnswer` (a turn, a dialog); the plugin's `phase` once it says `idle` (only the plugin knows why the turn ended). No timestamp comparison: at a turn's end the pid file and the session file are written within milliseconds, in either order. A stale phase goes at the next prompt (`working`). |
| Band `blueprint › étape`, stage segments | `current` of the session file (`blueprint`, `step`) + its blueprint in the project file |
| How the run is driven, the skill running, its timeline (blueprint then build…) | `flow`, `skill` and `trail` of the run, read as is, no derivation (selo-ops 2.5.0); a run written before has `lane` only |
| `Interrompue` | session file `live`, pid file gone, or `phase: stopped` |
| `Tour interrompu` (Esc) | `phase: working` while Claude Code says `idle`: no `Stop` fired (§3) |
| Badge `Tu peux fermer` / its blockers | `close` of the session file (§5.5) |
| Band `page · sous-étape` | `current.sheets`, `current.substep` |
| Session's technical line: model, effort, permission mode | `permissionMode`, `effort`, `model` of the session file |
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
  "writtenBy": "2.2.1",
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
  "pendingAgents": [],
  "close": { "ok": false, "blockers": ["not-done", "pending-commit", "dirty-files"] },
  "current": {
    "id": "59ec7eff-18ab-44b0-829d-e33b4e8e040e:1792598402000",
    "agentId": null,
    "lane": "build",
    "flow": "blueprint",
    "skill": "build",
    "request": ".planning/blueprints/2026-10-21-due-date.md",
    "task": null,
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
    "next": [],
    "commits": [{ "sha": "f677536", "subject": "feat(due-date): api — optional due date on a todo", "spec": "pending (.planning/blueprints/2026-10-21-due-date.md)", "at": "2026-10-21T13:51:40.000Z" }],
    "resumePrompt": "/selo:build .planning/blueprints/2026-10-21-due-date.md",
    "since": "2026-10-21T13:40:02.000Z",
    "trail": [
      { "at": "2026-10-21T13:40:02.000Z", "skill": "build", "step": "stage:1", "substep": null, "phase": "working" },
      { "at": "2026-10-21T13:51:40.000Z", "skill": "build", "step": "stage:2", "substep": "commit", "phase": "working" },
      { "at": "2026-10-21T14:02:11.000Z", "skill": "build", "step": "stage:2", "substep": "commit", "phase": "awaiting-commit" }
    ],
    "trailCut": false,
    "updatedAt": "2026-10-21T14:02:11.000Z"
  },
  "runs": ["… the same run, then the earlier ones …"]
}
```

## 8. Decisions (2026-10-21)

1. **Tokens** → Not in the export. Selo Ops counts them from the transcript, as Companion does. Superseded by 23 (selo-ops 2.2.0).
2. **Claude Code's status vs the plugin's phase** → By Claude Code's status, never by timestamps (§6, "Pill: which source"): `running` / `awaitingAnswer` are Claude Code's, `idle` reads the plugin's phase. A timestamp rule was rejected: at a turn's end both files are written within milliseconds, and the pid file winning would hide an `awaiting-commit` behind `idle`.
3. **A session with several roots** → One session file, its `root` the last root; every root it passed through gets its project file rescanned.
4. **Idle projects** → `node {selo-ops}/scripts/ops.mjs scan {root}` rescans a project without a session; Selo Ops may run it, read-only, on the roots `installed_plugins.json` lists for `selo` (selo's own `ops.mjs` is a stub since 2.1.0).

2026-10-22, after a challenge of the export against "can I close this session?":

5. **Closing a session** → A `close` field computed by the plugin (§5.5), with its blockers. Uncommitted work is counted per session (`touchedFiles` ∩ `git status`), not per root: with 3–5 sessions on one checkout, `changedCount` cannot say what this session left.
6. **The done footer flags the session** → `job-done` needs the footer; the recap-only footer of a free request without a commit stays (proposal §3 Q4 changed). `turn-ended` means the footer is missing.
7. **Desktop questions** → A `PostToolUse` on `mcp__ccd_turn__wrap_up` keeps its `ask`. It names one host's tool; with another host the last-line rule stays.
8. **Esc** → No `Stop` fires on an interrupt (checked in the hooks reference, 2026-10-22); Selo Ops reads `working` + `idle` as an interrupted turn.
9. **Substeps** → Marked by the skills (`ops.mjs mark`, §5.4), not guessed from the tools: only the skill knows that it moved from tests to code.
10. **Technical fields** → `transcriptPath`, `permissionMode`, `effort` come from the hooks' common input; `model` from the transcript at each `Stop` (SessionStart carries it in neither print mode nor the desktop app, 2026-10-22), SessionStart's when it has one before. Output style is in no hook input: left out. `unpushedCount` added: under "never push", it is what the person checks before closing.
11. **The app's runs** → Not in the export: the slot files (proposal §4.8) already hold the ports and pids, written when a run starts and stops. Selo Ops reads them by `repo` and `root`; both sides use the same form of `root`.

2026-10-22, at implementation (step 7):

12. **The folder** → `SELO_OPS_DIR`, else `CLAUDE_CONFIG_DIR/selo`, else `~/.claude/selo`. The tests write to a temp folder through `SELO_OPS_DIR`; Selo Ops' configuration points at the same folder.
13. **Concurrent hooks** → Parallel tool calls and parallel subagents fire hooks of one session at the same time: each read-modify-write of a session file runs under a lock (`locks/{sessionId}/`, the mkdir lock of `slots.mjs`, 2 s wait, stale after 10 s). A hook that cannot take it gives up silently: one event lost, never a blocked turn. A project file needs no lock: it is a pure function, the last writer is right.
14. **Time and silence** → Each hook exits 0 and prints nothing whatever happens (`UserPromptSubmit` and `SessionStart` output would reach the agent's context), stops itself at 4.5 s (the hook's timeout is 5 s), each git call at 2 s. A `PostToolUse` on a Bash command that is neither a commit nor a mark leaves before any git or file work; the Edit hook touches no git. The project is rescanned on `SessionStart`, `Stop` and a commit only.
15. **Commit detection** → No reliance on an exit-code field of the tool's response: after a command that `isCommit` (the commit hook's test) recognizes, the commit is the sha of git's `[branch sha]` line in the tool's response, so another session's commit on a shared checkout is never taken for this one. No such line in a loud commit's output: it failed, nothing is added. A quiet commit (`-q`), or a response the hook did not get, falls back to `HEAD`. A sha already in a run of the session is never added twice.
16. **The last message** → `last_assistant_message` of `Stop` / `SubagentStop` when the input has it, else the last assistant text read from the tail of `transcript_path` (`agent_transcript_path` for a subagent).
17. **What answers a run** (changed by 31: `/selo:run` is the `run` skill, and a short `/{name}` opens a run) → A prompt that is not a `/selo:{lane}` command keeps the main run when its phase is `awaiting-commit`, `awaiting-answer` or `working` (a word typed after an Esc continues the same job); a `/selo:{lane}` prompt always opens a run. A `/selo:` command outside the lanes (`/selo:run`) is `free`.
18. **A skill the main loop picks itself** (changed by 31: `flow`, `skill`, and a skill named short) → A `PreToolUse` on `Skill` without `agent_id`, naming a `selo:` lane, turns the current run into that lane when it is a `free` run still `working` (the model chose the skill from a free sentence). With `agent_id`, it sets the subagent's run, and an `autopilot` main run takes that run's step (and blueprint). A subagent's commits and marks are added to the autopilot run too: its footer lists the commits, its tile shows the page and the substep. A subagent run still `working` at a `Stop` with no background task running is `stopped`: a foreground subagent cannot outlive its turn, and one interrupted by Esc gets no `SubagentStop`.
19. **The wrap_up ask** → Kept in the session file's `ask` field from the `PostToolUse` to the turn's `Stop`, cleared by the next prompt; a reader ignores it.
20. **Steps moved by a commit** → A commit whose subject is a stage line of the run's blueprint (or of any blueprint, which then names the run's) moves the run to the next stage, the last to `review`; `docs({name}): spec merged` moves it to `merge`. `resumePrompt` is the blueprint's `next.prompt` at each `Stop`.
21. **Marks** → `reference/rules.md` **Marks** says when `fastlane` and `build` mark; `templates/settings.json` allows `node *scripts/ops.mjs* mark*` (the script's path may be quoted), so a mark prompts nobody; a project set up before must run `setup update`, which adds the missing allow, or an autopilot in `acceptEdits` stops at the first mark. A session keeps its 100 newest runs.
22. **Checked live** (2026-10-22, Claude Code 2.1.303, `claude -p --plugin-dir` in `examples/two-components`): the hooks load and write; `transcript_path`, `permission_mode`, `effort.level` arrive as named; a last line ending with `?` gives `awaiting-answer`. `SessionStart` carried no `model` in print mode: `model` stays null there.

2026-10-22, selo-ops 2.2.0 (`docs/revamp-2.2.0/proposal.md` §10):

23. **Usage in the export** → Each run carries `usage`, the session its totals (§5.6), read from the transcript by the plugin: the raw counts only, no weighted estimate. `prompts` capped at 50 per main run, the latest kept; read cap 32 MB, flagged `partial`. Per-call durations and the plan windows are out.
24. **A `<task-notification>` prompt** → Keeps the main run (§3), as a hand-back does: no settling, no new run.
25. **Edge rows** → A `<synthetic>` assistant row is no call. A call with no `message.model` counts in the totals, not in `byModel`. `byModel` is sorted by the sum of the four token kinds, then by name. A skill's `name` has no leading slash; `how` tells the sources apart, one row per (name, how). A prompt row with no timestamp has `at: null`.

2026-10-23, selo-ops 2.3.0:

26. **The next steps in the export** → The rules put a step's next prompts in the done footer, one `` Next: {summary} · `{prompt}` `` line each, instead of code blocks above it; `classifyEnd` reads them into the run's `next`. A `Next:` line without its prompt in backticks is no footer line: the turn reads as `turn-ended`. `resumePrompt` stays: computed from the blueprint, it holds even when a footer forgot its `Next:` line.

2026-10-23, selo-ops 2.4.0:

27. **A subagent run's usage** → Its own transcript is read with its sidechain rows: a main slice skips them, so 2.3.0 read every subagent as zero, and the session's `usage` counted the lead only. The session's `usage` stays every run summed, subagents included, as §5.1 says: no lead-only sibling (the lead is its main runs' `usage`).
28. **A subagent's title and prompt** → `task` stays the title, now from its meta file's `description` at `SubagentStop`; `prompt` (300 characters) and `requestedModel` are new. No separate `description` key: it would repeat `task`.
29. **The lead's context** → `context`: the last call's input, cache read and cache write, its model, and the first call's four token kinds as `baseline` (kinds, not a sum, so Selo Ops weights a warm-cache first call right). No window size: nothing the plugin reads gives it.
30. **The breakdown** → The export carries raw figures only (decision 23): `usage.sizes`, the characters each group added, on main runs and summed in the session, and `context.baseline`. The weighted estimate is Selo Ops' own. A session file written before keeps no `sizes` on its earlier runs.
31. **Flow, skill and trail** (selo-ops 2.5.0) → `lane` mixed how the work is driven with the skill running, and `step` a skill's name with a build's position; a session started with the short `/fastlane …` was exported `free` (`parsePrompt` matched `/selo:` only, and a skill loaded as a command fires no Skill tool). The hook now computes everything and Selo Ops reads properties: `flow` (set by the run's first lane skill, then fixed), `skill` (the one running now), `step` (build positions only), `substep`, and `trail`, their dated history (50 entries, `trailCut`). One map, `SKILLS` in `ops.mjs`, says which skill is a lane and its flow. A short command is read from the run's first transcript rows at its first tool call (the `PreToolUse` matcher is now every tool; any other call leaves on the session file, without the lock) or at its `Stop`: `<command-name>/selo:{name}</command-name>`, or `/{name}` whose next row's `Base directory for this skill:` is the selo plugin's `…/selo/{version}/skills/{name}`, so a project's own `.claude/skills/fastlane` and another plugin's `/review` stay `free`. A tool skill has no end event: it replaces the lane's skill until the run's next mark or its done footer. `lane` stays one version for older readers.
32. **Mockup and iterate** (selo-ops 2.6.0 and 2.7.0) → selo 2.4.0 adds `/selo:mockup`, a tool skill (`SKILLS`), and the fastlane's ` — iterate`. Each turn of either loop ends on the bare question `Autre chose, ou on valide ?`, so the run reads `awaiting-answer` (§5.3); a validated mockup ends with a footer of `Next:` lines only. The iterate mode is a field, `mode`, not a flow: the run is a fastlane, and its end is the fastlane's. It is read from the whole prompt because `request` keeps 200 characters, which a long request's ` — iterate` falls past. Selo Ops tells the loop from the end by the substep: null or `code` in the loop, `tests` onward at the validation.
