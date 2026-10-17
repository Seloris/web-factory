# factory-board

A Claude Code mod (function hooks) for projects that use the factory. It opens a pane headed by the project, its branch and the live sessions, four tiles (features, without a plan, in progress, stages left), then one row per feature: its state, its stage bar and the button that prepares the next `/factory:` prompt. Each feature is a card, framed in the colour of its state; a card unfolds into its stages and the prompt itself. A band above the prompt names what this session does (`Stage 2 — web · demo`, `Plan · tags`, `Spec · tags`, `Revue · …`, `Revue finale`, `Fermeture de la branche`) with its run status, counts the other live sessions, and carries the button that opens or closes the pane.

## What it shows

| Column | Source |
|---|---|
| Feature slug and title | `.planning/features/{slug}/00_spec.md` (title, status), else the plan's title |
| State | `spec seule`, `plan prêt`, `en cours`, `à valider`, `à fermer`, from the latest `dev-plans/*/plan.md`: its Progress ticks and its Validation checklist |
| Stages | One line per `### Stage N — …` of the plan's Progress, with the short SHA of the stage's commit once its subject (`Commit:` line) is on the branch |
| Draft | `(brouillon)` while `plan.md` is untracked, as the planning rule defines a draft |
| Spec | `spec brouillon` (`Draft`) or `spec validée` (`Approved`), from the spec header, for a feature with no plan yet |
| Runs | `● en cours`, `○ attend une réponse` or `✓ terminé`, per session that submitted a `/factory:` prompt on the feature, with the session id and the age |

The source of truth stays the files and git. The board is rescanned every 10 seconds, after each `git commit` run through Bash, and at the end of each turn. A stage whose commit reaches the branch, or a Validation checklist that becomes complete, raises a toast.

## The one thing the mod keeps

The runs live in the mod's own store (`$.store`, a JSON file under the user's Claude Code directory, shared by every session, never in the repository). A run is written when a prompt starting with `/factory:implement`, `/factory:write-plan`, `/factory:write-spec` or `/factory:review` names a feature (a `.planning/features/{slug}` path, or a bare slug for `write-plan` and `write-spec`), set to `running` at each turn start, `waiting` at each turn end, `done` once the session's main loop runs a successful `git commit` (every factory skill ends its job with its commit), dropped when the session ends. A `done` run stays done until the session submits a new `/factory:` prompt. A run nobody touched for a day is dropped as a dead session. A prompt typed without the `/factory:` command records nothing: use the pane's button, which prepares the exact command.

## Buttons

- The feature row unfolds its plan folder, its stages (the active one marked `◉`), its Validation count and the prepared prompt.
- The row's primary button fills the prompt box with the next command: `write-spec` for an empty feature, `write-plan` for a spec alone or a draft plan, `implement {plan folder}` for the next stage, `… — final review` once every stage is ticked, `… — close the branch` once the Validation is complete. Enter sends it. Where no prompt box takes it, the prompt is copied instead.
- `Copier` copies that prompt; `Revue du plan` prepares `/factory:review plan {plan folder}`.
- `⟳` rescans now.
- The band’s `Ouvrir le tableau` / `Fermer le tableau` toggles the pane; closing it from the engine’s own mark flips the button too.
- Under 72 cells the row's columns wrap under the feature name and the column header is dropped.

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
