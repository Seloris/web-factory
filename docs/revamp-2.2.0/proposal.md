# selo 2.2 — session usage in the ops export, subagent models enforced (proposal, 2026-10-22)

Working document. Two changes, released together:

- **selo-ops 1.1.0**: every run of the ops export carries what it consumed, read from the transcript: tokens per kind, per model and per prompt, the tools it called, the skills it loaded. The session carries its totals.
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

`model` (session) keeps its meaning. A subagent run's real model is `usage.byModel[0].model`; the model the call asked for is not exported (§6.4).

## 5. When it is computed (selo-ops 1.1.0)

### 5.1 The hooks

| Hook | Adds |
|---|---|
| `UserPromptSubmit`, opening a main run | First settles the previous main run (§5.2) on the slice up to the transcript's size now; then opens the new run with `transcriptFrom` = that size. In that order: once the new run is open, `mainRun(s)` is the new one. |
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
- `ops.mjs`: `applyHook` calls it in the hooks of §5.1. `newSession` gets `usage: null`, `openRun` gets `usage: null, transcriptFrom: null`.
- `tests/usage.test.mjs`: fixtures of transcript rows: one response on three rows (one call), two models, a `Skill` call, a slash command, a preloaded skill, an advisor call, a compaction summary (no prompt), a cut last line, a slice over the cap.
- `tests/ops.test.mjs`: a run read at `Stop` then settled at the next prompt; an Esc'd turn settled at the next prompt; a subagent run at `SubagentStop`; the session's totals after a run dropped past `MAX_RUNS`.

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

`updatedInput` replaces the whole input (hooks reference): the hook copies every field and changes `model` only. It prints nothing when the model is already right.

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

The ops hook and the model hook are two plugins on one `PreToolUse`: whether the ops hook sees the input before or after the rewrite is not documented. The export never relies on it: a subagent run's model is read from its own transcript (`usage.byModel`), which is the model it ran on.

### 6.4 Spike first

The hooks reference documents `updatedInput` for `PreToolUse` and lists `model` among the Agent tool's fields, but says nothing about the Agent tool in particular. Before the code:

1. A throwaway `PreToolUse` hook on `Agent` that sets `model: "haiku"`, in the terminal and in the desktop app (which runs the session through the SDK).
2. Spawn `Explore` with `model: "sonnet"`; read the subagent transcript's `message.model`.
3. Same without `permissionDecision`, then with `"allow"`: the hooks reference pairs `updatedInput` with `"allow"` (which skips the permission prompt) or `"ask"`, and does not say whether it applies alone.

4. For §5 (no code to write for it): with a throwaway `UserPromptSubmit` hook that logs the transcript's size and its last row, check whether the hook fires before or after the person's prompt row is written. Before: `transcriptFrom` is set as §5.1 says. After: `transcriptFrom` would skip the run's first prompt, so it is instead the offset where that prompt row starts (the last user row holding the prompt's text), and `tests/usage.test.mjs` gets a fixture for it.

If the rewrite is ignored on the Agent tool, §6 is dropped and selo 2.2.0 is not released; selo-ops 1.1.0 goes alone. If it needs `"allow"`, the hook sends it: the Agent tool asks for no permission in a selo project, so nothing is skipped in practice; `rules.md` says it.

### 6.5 Tests

`plugins/selo/tests/agent-model.test.mjs`: each row of §6.2; a call already on its model (no output); `Explore` with a model (no output); no `selo.yaml` (no output); a broken manifest (no output, exit 0); a `lean` preset; a map overriding one role; every other field of `tool_input` kept.

## 7. Versions and roll-out

One commit, two versions, as `ops-plugin.md` §5:

1. `selo-ops` 1.1.0: `scripts/usage.mjs`, `ops.mjs`, tests, `CHANGELOG.md`; `docs/revamp-2.0.0/ops-export.md` §3 and §5.1 get the fields of §4 and the hooks of §5.1.
2. `selo` 2.2.0: `hooks/hooks.json`, `scripts/agent-model.mjs`, tests, `docs/manifest.md`, `reference/rules.md`, `CHANGELOG.md`. `manifest.mjs` unchanged: `selo-ops`' copy stays identical (`tests/shared.test.mjs`).
3. `node --test "plugins/*/tests/*.test.mjs"`, `claude plugin validate plugins/selo`, `plugins/selo-ops`, `.`.

Then, by the person: `claude plugin update selo-ops@selo --scope user`, `claude plugin update selo@selo --scope project` in each selo project, a new session everywhere. Sessions already running keep 1.0.0's hooks: their runs get no usage until a new session.

## 8. Out of scope (settled 2026-10-22)

- **Plan windows (5 h, 7 d).** Engine only (`$.session.usage()`, else the desktop app's `get_usage`), account-wide, and empty in the desktop app for a mod. Would need a mod module in `selo-ops` and a TypeScript toolchain. Not wanted.
- **The "now / doing" line.** Engine events (`tool.call`, `turn.step`): what a session is at this second. Not wanted.
- **Compliance score**, **per-developer model choices**, **prompt-box tiles**, **prompt composition**: kookiz-helper's, not wanted in the export.

Per-call durations are not settled: they are not engine-only (§10.4).

## 9. Selo Ops' side

A blueprint in its own repository, once 1.1.0 is out: the session detail shows the session's totals and per-model split, each run's tokens, models, tools and skills, each prompt's tokens, each subagent run's real model; the export's `model` falls back to the latest `usage.byModel` when null. A session outside selo (no export file) shows none. Sessions exported by 1.0.0 have `usage` absent: shown as « — ».

## 10. Open questions

1. **Explicit model on selo's own agents**: §6.2 overrides it always (as kookiz-helper does). The alternative: only when the call names none, like `Explore`. Recommended: always; the manifest is the project's decision.
2. **`prompts` per main run, capped at 50**: enough for an autopilot run (one prompt) and a long free run? Recommended: yes; the run's totals stay exact past the cap.
3. **Read cap of 32 MB**, for a main run's slice and a subagent's transcript alike: recommended. Measured on the Kookiz transcripts (2026-10-22): the largest main transcript is 9.0 MB whole, the largest subagent transcript 4.3 MB.
4. **Per-call durations**: readable from the transcript too (each `tool_use` row and its `tool_result` row are timestamped), so 1.1.0 could add a `durationMs` per tool name in `RunUsage.tools`, or a run's working time. Left out of this proposal unless the person asks for it: Selo Ops has no view that needs it yet.
