# factory-board

A Claude Code mod (function hooks) for projects that use the factory. It opens a pane headed by the project, its branch and the live sessions, four tiles (features, without a plan, in progress, stages left), the live sessions (one card each: its step, its status, the session, the skill and the duration; a click unfolds its feature), then one card per feature, framed in the colour of its state: its slug and title, its state, its stage bar and the button that prepares the next `/factory:` prompt. A card unfolds into its vertical timeline: Spec, Plan, one row per stage, Revue finale, Clôture de la branche, each with its marker on a rail (on the desktop and the mobile app, vector circles: green ticked when done, orange filled while a live session works on it, orange ring for the step at hand, grey ring later; on the terminal, `✓ ◉ ○` glyphs on a `│` rail). Under the step at hand stand its buttons and its prompt in a frame, and under each row the sessions that worked on it (date, skill, duration, status). A band above the prompt names what this session does (`Stage 2 — web · demo`, `Plan · tags`, `Spec · tags`, `Revue du plan · …`, `Revue finale · …`, `Clôture de la branche · …`), always the step its run was started on, never the plan's next stage (a stage whose boxes are all ticked is still that session's until its commit), with its run status, counts the other live sessions, and carries the button that opens or closes the pane.

## What it shows

| Column | Source |
|---|---|
| Feature slug and title | `.planning/features/{slug}/00_spec.md` (title, status), else the plan's title |
| State | `spec seule`, `plan prêt`, `en cours`, `à valider`, `à fermer`, from the latest `dev-plans/*/plan.md`: its Progress ticks and its Validation checklist |
| Stages | One line per `### Stage N — …` of the plan's Progress, with the short SHA of the stage's commit once its subject (`Commit:` line) is on the branch |
| Draft | `(brouillon)` while `plan.md` is untracked, as the planning rule defines a draft |
| Spec | `spec brouillon` (`Draft`) or `spec validée` (`Approved`), from the spec header, for a feature with no plan yet |
| Timeline | `Spec` (`brouillon`, `validée`, `absente`), `Plan` (`brouillon`, `commité`), one `Stage N — …` per stage (its count, then its short SHA), `Revue finale` (the Validation count, a declined item `[-]` counted as settled), `Clôture de la branche`; the step at hand is the one the primary button prepares |
| Runs | Under each step, newest first: `✓ 16/10 00:21 · Implémentation · 14 min · session 7f0772df`, with `en cours`, `attend une réponse` or `interrompue` when not done. The live ones are also listed above the cards, in a block that unfolds the feature on a click |

The source of truth stays the files and git. The board is rescanned every 10 seconds, after each `git commit` run through Bash, and at the end of each turn. A stage whose commit reaches the branch, or a Validation checklist that becomes complete, raises a toast.

## The one thing the mod keeps

The runs live in the mod's own store (`$.store`, a JSON file under the user's Claude Code directory, shared by every session, never in the repository). A run is written when a prompt starting with `/factory:implement`, `/factory:write-plan`, `/factory:write-spec` or `/factory:review` names a feature (a `.planning/features/{slug}` path, or a bare slug for `write-plan` and `write-spec`), with the timeline step it lands on, frozen at that moment (`spec`, `plan`, `stage:N` the stage the prompt names (`— stage 2 (web)`), else the next stage of the plan, `review` for `— final review`, `close` for `— close the branch`). It is set to `running` at each turn start, `waiting` at each turn end, `done` once the session's main loop runs a successful `git commit` (every factory skill ends its job with its commit); a chained run (`— stages 2-3 (web, e2e), chained`) moves to its next stage at each stage commit instead, and is done at its last one; `interrupted` when the session ends before that or goes silent for a day. A finished run stays as history under its step; a run older than a month is dropped. Each `/factory:` prompt of a session starts a new run. A prompt typed without the `/factory:` command records nothing: use the pane's button, which prepares the exact command.

## Buttons

- The feature row unfolds its timeline; a line of the live sessions block unfolds the feature it works on.
- The row's primary button fills the prompt box with the next command: `write-spec` for an empty feature, `write-plan` for a spec alone or a draft plan, `implement {plan folder} — stage {N} ({title})` for the next stage, `… — final review` once every stage is ticked, `… — close the branch` once the Validation is complete. Enter sends it. Where no prompt box takes it, the prompt is copied instead.
- In the framed step: `Tout d'un coup (stages N–M)`, when several stages remain, prepares `implement {plan folder} — stages N-M (…), chained`, every remaining stage in one session, one commit each; `Copier` copies the step's prompt; `Nouvelle session` submits a request in this session asking the model to start a new desktop session (the `start_session` tool, same folder, no worktree) whose prompt is the step's, and the app asks "New session" or "Do it here" before anything starts (desktop app only); `Revue du plan` prepares `/factory:review plan {plan folder}`.
- `⟳` rescans now.
- The band’s `Ouvrir le tableau` / `Fermer le tableau` toggles the pane; closing it from the engine’s own mark flips the button too.

## Running it

- `/factory-board` opens the pane in any session; on the desktop and in an IDE it opens by itself when the project has `.planning/features`.
- While developing: `claude --plugin-dir C:\WS\webapp-factory\plugins\factory-board` in a project, or the folder in `CLAUDE_CODE_PLUGIN_DIRS` for a session the desktop app starts. The engine then lays its type declarations in `.claude-plugin/types/` (ignored by git).
- Installed: `/plugin install factory-board --marketplace <the webapp-factory marketplace>`.

## Checks

```bash
claude plugin validate plugins/factory-board
```

```bash
claude plugin test plugins/factory-board
```

The tests cover the parser (`hooks/planning.ts`) directly and the hooks through the engine's test kit, with the project, git and the store answered from memory, on the terminal and desktop surfaces.

## Limits

- Draft detection relies on `git status` paths relative to the repository root: a project rooted in a sub-folder of its repository shows no draft.
- The stage SHA is matched on the commit subject the plan announces; a stage committed under another subject shows `non committé` until the branch is squashed.
- Only one plan per feature is shown: the latest by folder name (its timestamp).
