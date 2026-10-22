# selo 2.2 — session usage in the ops export, subagent models enforced (proposal, 2026-10-22)

Working document. Two changes, released together:

- **selo-ops 1.1.0**: every run of the ops export carries what it consumed, read from the transcript: tokens per kind, per model and per prompt, the tools it called, the skills it loaded. The session carries its totals. It also fixes a bug of 1.0.0 found on the way: a background subagent's end opened an empty run (§5.5).
- **selo 2.2.0**: a `PreToolUse` hook puts selo's subagents on their role's model from `selo.yaml`, whatever the call names.

Basis: a read of the Kookiz repository's `session-debug` and `kookiz-helper` mods (`ELI-FR-KOOKIZ/.claude/plugins/`), of `plugins/selo-ops/scripts/ops.mjs`, and of Claude Code's hooks reference (2026-10-22).

## 1. Why

Selo Ops shows what each session does (its runs, phase, commits, blockers) but not what it costs nor on which models it ran: the export's `model` is the lead's last one, often `null` before the first `Stop`. The Kookiz mods show it in their pane (session-debug: tokens per prompt and per actor, models, skills, subagent runs; kookiz-helper: runs and their models), but only inside the session, and only in that repository.

Both mods read most of it from the transcript, which the export already points to (`transcriptPath`). What they read from the engine instead (the "now" line, the 5-hour and 7-day plan windows) is out of scope here (§8).

The subagents' models: today a selo skill passes the role's model when it spawns `reviewer` or `runner` (`docs/manifest.md`, "Models"). A skill that forgets, a model that names another, or an `Explore` spawned with no model all run off the manifest, silently. kookiz-helper enforces the models from its `agent.spawn` hook; selo can do the same with a command hook.

## 2. Scope

| In | Out |
|---|---|
| Tokens per run (input, cache read, cache write, output), per model, per prompt | The plan windows (5 h, 7 d): engine only, account-wide |
| The session's totals, subagents included | The "now / doing" line (live), and per-call durations (§10.4) |
| Tools called per run (the advisor included), skills loaded and how | A compliance score (kookiz-helper's `Conformité`): a project of its own |
| The real model of each subagent run | Per-developer model choices (kookiz-helper's store) |
| Subagent models enforced from `selo.yaml` (selo) | Filling the prompt box, prompt composition: engine only |

## 3. The source: the transcript

Claude Code writes one JSONL per session (`transcriptPath`) and one per subagent (`{session}/subagents/agent-{id}.jsonl`, given to `SubagentStop` as `agent_transcript_path`). The rows read:

- **An API call**: a row `type: "assistant"` with `message.usage` and `message.id`. One response spans several rows with the same `message.id` and the same `usage`: deduplicated by `message.id`. `message.model` is the call's model; `<synthetic>` is no model.
- **A tool call**: a `tool_use` part of an assistant row (`name`, `input`); the advisor is a `server_tool_use` part named `advisor` (no `tool_use`, no result row).
- **A skill**: a `Skill` tool call (`input.skill`); a slash command (`<command-name>/{name}</command-name>` in a user row); a skill an agent's frontmatter preloads (a meta user row holding `<skill-format>true</skill-format>` and its `<command-name>`).
- **A prompt the person typed**: a user row that is not meta, not a compaction summary, holds no `tool_result`, and is neither `<local-command-…>` nor `<task-notification>`. session-debug's `promptText()` is the reference.

The code is ported from session-debug's `scripts/aggregate.mjs` (pure, no I/O, same author), cut to what §4 needs: no weighted "effective" figure, which is an estimate and not a price; the raw counts only.

## 4. Export format (selo-ops 1.1.0)

Forward-only (`ops-export.md` §1.6): fields added, none renamed, `schemaVersion` stays `1`. A reader of 1.0.0 ignores them.

```ts
type Tokens = { input: number; cacheRead: number; cacheWrite: number; output: number }

type Usage = {
  /** API calls, deduplicated by message id. */
  calls: number
  tokens: Tokens
  /** One row per model the calls ran on, most tokens first. */
  byModel: { model: string; calls: number; tokens: Tokens }[]
}

type RunUsage = Usage & {
  /** Tool calls by name, most first; the advisor as `advisor`. */
  tools: { name: string; count: number }[]
  /** Skills loaded: `tool` (the Skill tool), `command` (typed as `/{name}`), `preloaded` (an agent's frontmatter). */
  skills: { name: string; count: number; how: 'tool' | 'command' | 'preloaded' }[]
  /** Main runs only: one row per prompt the person typed in the run, oldest first, at most 50 (the latest kept). A subagent run has []. */
  prompts: { at: string; calls: number; tokens: Tokens }[]
  /** False while read at a `Stop`, whose transcript may lack the turn's last message (§5.2); true once settled. */
  settled: boolean
  /** True when the run's slice was over the read cap (§5.3): the figures cover its last 32 MB only. */
  partial: boolean
}

// Added to Run:
type Run = {
  // …the 1.0.0 fields…
  /** What the run consumed. Null until its first `Stop` (main run) or `SubagentStop` (subagent run); stays null for a subagent stopped by Esc, which fires no `SubagentStop`. */
  usage: RunUsage | null
  /** Main run: the byte offset of the transcript when the run opened. Subagent run: null. Internal to the export; Selo Ops does not read it. */
  transcriptFrom: number | null
}

// Added to SeloSession:
type SeloSession = {
  // …the 1.0.0 fields…
  /** Every run's usage summed, the main loop's and the subagents', including runs dropped past MAX_RUNS. Null before the first one. */
  usage: Usage | null
}
```

`model` (session) keeps its meaning. A subagent run's real model is `usage.byModel[0].model`. The model the call asked for is not exported: it stays in the lead's `tool_use` row, which keeps the call as the model wrote it, before any rewrite of §6 (§11).

## 5. When it is computed (selo-ops 1.1.0)

### 5.1 The hooks

| Hook | Adds |
|---|---|
| `UserPromptSubmit`, opening a main run | First settles the previous main run (§5.2) on the slice up to the transcript's size now; then opens the new run with `transcriptFrom` = that size (0 when the file does not exist yet, on the session's first prompt). In that order: once the new run is open, `mainRun(s)` is the new one. The hook fires before the prompt's row is written (§11): the slice starts with the run's own prompt. |
| `UserPromptSubmit`, a `<task-notification>` | Keeps the main run (§5.5): no settling, no new run. |
| `UserPromptSubmit`, keeping the run (a commit's yes, an answer) | Nothing: the run's slice grows, its `prompts` gets the new row at the next read. |
| `Stop` | Reads the current main run's slice (`transcriptFrom` to the end), sets `usage` with `settled: false`, updates the session's totals. |
| `SubagentStop` | Reads `agent_transcript_path` whole (under the cap of §5.3), sets the subagent run's `usage` with `settled: true`, updates the session's totals. |
| `SessionEnd` | Settles the current main run. |

No new matcher: these hooks already run. The `PreToolUse` `Skill` hook keeps its job (a selo skill names the lane) and adds nothing: the skills are read from the transcript, every skill, selo or not.

### 5.2 Settling

Claude Code's hooks reference: at `Stop`, "the transcript file isn't guaranteed to include the final message". So a run read at `Stop` may miss its last call. And a turn the person interrupts (Esc) fires no `Stop` at all (`ops-export.md` §3).

- A main run is read again when the next main run opens and at `SessionEnd`, on the slice from its `transcriptFrom` to the new run's: by then its rows are written. That read sets `settled: true`.
- An Esc'd turn is caught by the same read: its run gets its usage at the next prompt.
- The session's totals take the difference: `session.usage += new − previous` for the run read. A run dropped past `MAX_RUNS` (100) keeps its last contribution in the totals.

### 5.3 Cost

- A hook gives up after 4.5 s. The slice of one run is read, never the whole transcript: a run of a long autopilot is a few MB, a plain turn a few hundred KB.
- The rows are filtered before `JSON.parse`: only lines holding `"assistant"` or `"user"` are parsed (the same filter as `assistantTail`).
- **Read cap**: a slice over 32 MB is read from its last 32 MB only, and the usage says `partial: true`. Nothing is skipped silently.
- **Outside the lock.** `withLock` waits up to 2 s (`timeoutMs`) for the session's lock, then the hook gives up and its update is lost. A slow read under the lock would make a concurrent hook of the same session (a background subagent's `SubagentStop` during the lead's `Stop`) wait and lose its write. So the usage is computed before the lock: the hook reads the session file without it (each write is an atomic rename), takes the run's `transcriptFrom` and the paths, reads the slice; then it takes the lock, reads the session file again, applies the hook's own changes as today, and sets the usage only on a run whose `id` and `transcriptFrom` are unchanged. Under the lock nothing but JSON is read and written, as in 1.0.0.
- If the hook times out, it writes nothing that turn; the next `Stop` or the settling read catches up.

### 5.4 Code

- `plugins/selo-ops/scripts/usage.mjs`: pure functions (`readUsage(text, { prompts })` → `RunUsage`, `addUsage`, `subUsage`) and `readSlice(path, from, to, cap)`. Imported by `ops.mjs`.
- `ops.mjs`: `applyHook` calls it in the hooks of §5.1. `newSession` gets `usage: null`, `openRun` gets `usage: null, transcriptFrom: null`. The `UserPromptSubmit` branch gets the `<task-notification>` case of §5.5.
- `tests/usage.test.mjs`: fixtures of transcript rows: one response on three rows (one call), two models, a `Skill` call, a slash command, a preloaded skill, an advisor call, a compaction summary (no prompt), a `<task-notification>` user row (no prompt), an `attachment` row naming a model (no call), a cut last line, a slice over the cap.
- `tests/ops.test.mjs`: a run read at `Stop` then settled at the next prompt; an Esc'd turn settled at the next prompt; the first prompt of a session whose transcript does not exist yet (`transcriptFrom: 0`); a subagent run at `SubagentStop`; the session's totals after a run dropped past `MAX_RUNS`; a `<task-notification>` prompt that keeps the main run, its request and its phase.

### 5.5 Fix: a background subagent's end opens no run

Found by the spike (§11). When a background subagent ends, Claude Code hands its result to the lead as a prompt, `<task-notification>…</task-notification>`, which fires `UserPromptSubmit`. 1.0.0 treats it as a typed prompt: `stripWrappers` drops the block, `parsePrompt` gets an empty text, and a new `free` run opens with `request: ""`. Selo Ops shows it as « Demande non lisible dans l'export » (`sessions-live` FR-24), and the run the person started loses its place as `current`.

1.1.0: a prompt that holds nothing but `<task-notification>` blocks keeps the main run, as a subagent's `<agent-message>` hand-back already does (`ops-export.md` §3, the `UserPromptSubmit` row): phase back to `working`, `pendingCommit`, `question` and `error` cleared, `updatedAt` moved; no new run. Sessions written by 1.0.0 keep their empty runs.

## 6. Subagent models (selo 2.2.0)

### 6.1 The hook

`plugins/selo/hooks/hooks.json` gets a `PreToolUse` hook on `Agent|Task`, running `scripts/agent-model.mjs`. It reads the call's `tool_input`, finds the project's `selo.yaml` up the `cwd` and resolves its models with `manifest.mjs` (`resolveModels`, presets included). Outside a selo project, or on a manifest that fails to parse, it exits 0 and prints nothing.

When the role's model differs from the call's `model`, it prints:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "updatedInput": { "...every field of tool_input...": "…", "model": "{role's model}" }
  }
}
```

`updatedInput` replaces the whole input (hooks reference): the hook copies every field and changes `model` only. It prints nothing when the model is already right. No `permissionDecision`: the spike shows `updatedInput` alone applies (§11), so no permission prompt is skipped.

### 6.2 Which agent, which role

| `subagent_type` | Role | When |
|---|---|---|
| `selo:reviewer`, `reviewer` | `reviewer` | always |
| `selo:runner`, `runner` | `runner` | always |
| `Explore` | `explorer` | only when the call names no `model` (a lead may want a stronger search on purpose) |
| `Plan` | `planner` | only when the call names no `model` |
| any other | — | untouched: `general-purpose` and the project's own agents follow their frontmatter, or `CLAUDE_CODE_SUBAGENT_MODEL` |

The skills keep passing the role's model: the hook is the guard, not the source. `docs/manifest.md` ("Models") and `reference/rules.md` say so.

### 6.3 What the export sees

The ops hook and the model hook are two plugins on one `PreToolUse`: whether the ops hook sees the input before or after the rewrite is not documented, and the lead's transcript keeps the model as asked (§11). The export never relies on either: a subagent run's model is read from its own transcript (`usage.byModel`), which is the model it ran on.

### 6.4 Spike (done, §11)

The hooks reference documents `updatedInput` for `PreToolUse` and lists `model` among the Agent tool's fields, but says nothing about the Agent tool in particular, nor whether `updatedInput` applies without `permissionDecision`. The spike of §11 settled both, headless: the rewrite applies to the Agent tool, `updatedInput` alone.

Still to check, before the release: the same in the desktop app, which runs its sessions through the SDK. A session there on a folder with the throwaway hook, `Explore` asked on one model, the subagent's `.meta.json` read. If the desktop app ignores the rewrite, §6 is dropped and selo 2.2.0 is not released; selo-ops 1.1.0 goes alone.

### 6.5 Tests

`plugins/selo/tests/agent-model.test.mjs`: each row of §6.2; a call already on its model (no output); `Explore` with a model (no output); no `selo.yaml` (no output); a broken manifest (no output, exit 0); a `lean` preset; a map overriding one role; every other field of `tool_input` kept.

## 7. Versions and roll-out

One commit, two versions, as `ops-plugin.md` §5:

0. The desktop check of §6.4.
1. `selo-ops` 1.1.0: `scripts/usage.mjs`, `ops.mjs`, tests, `CHANGELOG.md` (the usage, and the fix of §5.5); `docs/revamp-2.0.0/ops-export.md` §3 and §5.1 get the fields of §4 and the hooks of §5.1, the `<task-notification>` case of §5.5 included.
2. `selo` 2.2.0: `hooks/hooks.json`, `scripts/agent-model.mjs`, tests, `docs/manifest.md`, `reference/rules.md`, `CHANGELOG.md`. `manifest.mjs` unchanged: `selo-ops`' copy stays identical (`tests/shared.test.mjs`).
3. `node --test "plugins/*/tests/*.test.mjs"`, `claude plugin validate plugins/selo`, `plugins/selo-ops`, `.`.

Then, by the person: `claude plugin update selo-ops@selo --scope user`, `claude plugin update selo@selo --scope project` in each selo project, a new session everywhere. Sessions already running keep 1.0.0's hooks: their runs get no usage until a new session.

## 8. Out of scope (settled 2026-10-22)

- **Plan windows (5 h, 7 d).** Engine only (`$.session.usage()`, else the desktop app's `get_usage`), account-wide, and empty in the desktop app for a mod. Would need a mod module in `selo-ops` and a TypeScript toolchain. Not wanted.
- **The "now / doing" line.** Engine events (`tool.call`, `turn.step`): what a session is at this second. Not wanted.
- **Compliance score**, **per-developer model choices**, **prompt-box tiles**, **prompt composition**: kookiz-helper's, not wanted in the export.

Per-call durations are not settled: they are not engine-only (§10.4).

## 9. Selo Ops' side

A blueprint in its own repository, once 1.1.0 is out: the session detail shows the session's totals and per-model split, each run's tokens, models, tools and skills, each prompt's tokens, each subagent run's real model; the export's `model` falls back to the latest `usage.byModel` when null. A session outside selo (no export file) shows none. Sessions exported by 1.0.0 have `usage` absent: shown as « — ». With the fix of §5.5, a new session no longer gets the empty runs that show « Demande non lisible dans l'export »; FR-24 stays for those already written.

## 10. Open questions

1. **Explicit model on selo's own agents**: §6.2 overrides it always (as kookiz-helper does). The alternative: only when the call names none, like `Explore`. Recommended: always; the manifest is the project's decision.
2. **`prompts` per main run, capped at 50**: enough for an autopilot run (one prompt) and a long free run? Recommended: yes; the run's totals stay exact past the cap.
3. **Read cap of 32 MB**, for a main run's slice and a subagent's transcript alike: recommended. Measured on the Kookiz transcripts (2026-10-22): the largest main transcript is 9.0 MB whole, the largest subagent transcript 4.3 MB.
4. **Per-call durations**: readable from the transcript too (each `tool_use` row and its `tool_result` row are timestamped), so 1.1.0 could add a `durationMs` per tool name in `RunUsage.tools`, or a run's working time. Left out of this proposal unless the person asks for it: Selo Ops has no view that needs it yet.

## 11. Spike (2026-10-22)

Run headless (`claude -p`, Claude Code 2.1.303, lead on Haiku) in a throwaway folder, with a `PreToolUse` hook on `Agent|Task` that sets `model: "sonnet"` and a `UserPromptSubmit` hook that logs the transcript's state; `SELO_OPS_DIR` pointed away from `~/.claude/selo`, so the runs never reached Selo Ops. The call asked for `Explore` on `haiku`. Two runs: the hook's output without `permissionDecision`, then with `"allow"`. The desktop app is not tested yet (§6.4).

- **The rewrite works, without `permissionDecision`.** In both runs the subagent ran on `claude-sonnet-5-5` (its transcript's assistant rows), and its `.meta.json` says `"model": "sonnet"`. §6.1's output, `updatedInput` alone, is the one to ship; no permission prompt is skipped.
- **The lead's transcript keeps the call as the model wrote it.** The `tool_use` row of the Agent call still holds `"model": "haiku"`: a reader of the lead's transcript sees the asked model, not the one used. The real one is in the subagent's `.meta.json` (`model`) and in its assistant rows (§6.3 holds).
- **`UserPromptSubmit` fires before the prompt row is written.** On the first prompt the transcript does not exist yet; on a later one its last row is a `queue-operation`, not the prompt. So `transcriptFrom` = the transcript's size at `UserPromptSubmit` (0 when the file is missing), as §5.1 says, and the run's slice starts with its own prompt row.
- **`UserPromptSubmit` input** carries `prompt_id`, beside `session_id`, `transcript_path`, `cwd`, `permission_mode`, `prompt`.
- **Assistant rows carry more than `message.model`**: `requestedModel`, `advisorModel`, `effort` and `perTurnEffort`. Not exported by this proposal; noted for a later field. A model named in an `attachment` row (the session's context) is no call: §3 reads `message.model` of `assistant` rows only.
- **Side finding, a bug of 1.0.0.** In the second run the model sent the subagent to the background; its end came back as a `<task-notification>` prompt, and the spike's session file shows a third run with `request: ""`. Fixed in 1.1.0 (§5.5).
