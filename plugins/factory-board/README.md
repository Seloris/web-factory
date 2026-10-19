# factory-board

A Claude Code mod (function hooks) for projects that use the factory. It opens a pane headed by the project and the live sessions, then the branch (its commits since the base branch, its uncommitted files, a `Squasher` button), four tiles (features, without a plan, in progress, stages left), the live sessions (one card each, the pane's full width: its step and that step's count, its status, the feature (slug, title, state), the plan it works on (folder name, title, stages done), the session, the skill, its start and its duration; a click unfolds its feature on that plan), then one card per feature, framed in the colour of its state: its slug and title, its state, its stage bar and the button that prepares the next `/factory:` prompt. A card unfolds into two parts: its spec (a feature has one), then its plans (a spec may have several), with a picker of the plans, newest first, when there are two or more, and the vertical timeline of the picked plan (the latest by default): Plan, one row per stage, Revue finale, Clôture de la branche, each with its marker on a rail (on the desktop and the mobile app, vector circles: green ticked when done, orange filled while a live session works on it, orange ring for the step at hand, grey ring later; on the terminal, `✓ ◉ ○` glyphs on a `│` rail). Under the step at hand stand its buttons and its prompt in a frame, and under each row the sessions that worked on it (date, skill, duration, status). A band above the prompt names what this session does (`Stage 2 — web · demo`, `Plan · tags`, `Spec · tags`, `Revue du plan · …`, `Revue finale · …`, `Clôture de la branche · …`), always the step its run was started on, never the plan's next stage (a stage whose boxes are all ticked is still that session's until its commit), with its run status, counts the other live sessions, and carries the button that opens or closes the pane.

## What it shows

| Column | Source |
|---|---|
| Branch | `git rev-parse --abbrev-ref HEAD`; its commits `git log --format=%s {base}..HEAD` (`origin/{base}` without a local one), `{base}` the `base_branch` of `factory.yaml` (`main` without one); its uncommitted files, every line of `git status --porcelain` |
| Feature slug and title | `.planning/features/{slug}/00_spec.md` (title, status), else the plan's title |
| Plans | Every `dev-plans/*/plan.md`, newest first by folder name (its timestamp); the card, its state and the tiles follow the plan picked in the card, the latest until another is picked (kept for the session). While a live `write-plan {slug}` session writes a new plan whose folder is not there yet (the latest plan is committed), the card shows that plan on its way instead: `nouveau plan en cours`, its `Plan` row running, no picker and no prompt to prepare. A plan that appears is followed at once, whatever plan was picked |
| State | `spec seule`, `plan prêt`, `en cours`, `à valider`, `plan finalisé` (every stage and the Validation's `Review` ticked, the optional items left as they are), from the followed plan: its Progress ticks and its Validation checklist |
| Stages | One line per `### Stage N — …` of the plan's Progress, with the short SHA of the stage's commit once its subject (`Commit:` line) is on the branch |
| Draft | `(brouillon)` while `plan.md` is untracked, as the planning rule defines a draft |
| Spec | `spec brouillon` (`Draft`) or `spec validée` (`Approved`), from the spec header, for a feature with no plan yet |
| Timeline | `Spec` (`brouillon`, `validée`, `absente`), `Plan` (`brouillon`, `commité`), one `Stage N — …` per stage (its count, then its short SHA), `Revue finale` (the Validation count, a declined item `[-]` counted as settled; done once `Review` is ticked); the step at hand is the one the primary button prepares |
| Runs | Under each step, newest first: `✓ 16/10 00:21 · Implémentation · 14 min · session 7f0772df`, with `en cours`, `attend une réponse` or `interrompue` when not done. The live ones are also listed above the cards, one full-width card each, which unfolds the feature on the run's plan on a click |

The source of truth stays the files and git. The board is rescanned every 10 seconds, after each `git commit` run through Bash, and at the end of each turn. A stage whose commit reaches the branch, or a Validation checklist that becomes complete, raises a toast.

## The one thing the mod keeps

The runs live in the mod's own store (`$.store`, a JSON file under the user's Claude Code directory, shared by every session, never in the repository). A run is written when a prompt starting with `/factory:implement`, `/factory:write-plan`, `/factory:write-spec` or `/factory:review`, or a call of one of these skills through the `Skill` tool from the session's main loop (a session driven by a brief calls them that way, never from a typed prompt), names a feature (a `.planning/features/{slug}` path, or a bare slug for `write-plan` and `write-spec`), with the timeline step it lands on, frozen at that moment (`spec`, `plan`, `stage:N` the stage the prompt names (`— stage 2 (web)`), else the next stage of the plan, `review` for `— final review`). It is set to `running` at each turn start, `waiting` at each turn end, `done` once the session's main loop runs a successful `git commit` (every factory skill ends its job with its commit); a chained run (`— stages 2-3 (web, e2e), chained`) moves to its next stage at each stage commit instead, and is done at its last one; `interrupted` when the session ends before that or goes silent for a day. A finished run stays as history under its step; a run older than a month is dropped. Each `/factory:` prompt or skill call of a session starts a new run. A prompt typed without the `/factory:` command records nothing: use the pane's button, which prepares the exact command. A run carries the repository's git common dir (`git rev-parse --git-common-dir`, absolute), and the board lists the runs of its repository whatever the worktree each session runs in: a session working in a worktree shows on the board opened at the main checkout. The plan folder itself lives on the worktree's branch, so that board may not have the feature's row yet: the run is then listed with the live sessions only, until the branch is merged.

## Buttons

- The feature row unfolds its timeline; a line of the live sessions block unfolds the feature it works on.
- The row's primary button fills the prompt box with the next command: `write-spec` for an empty feature, `write-plan` for a spec alone or a draft plan, `implement {plan folder} — stage {N} ({title})` for the next stage, `… — final review` once every stage is ticked, none once the plan is finalized (the step that finalized it proposes the squash, which the board does not track; one put off runs from the branch line's `Squasher`). Enter sends it. Where no prompt box takes it, the prompt is copied instead. On a stage row, the `☐ Revue après chaque stage` button ticks the review: when on (`☑`), the stage prompts (`— stage N`, `— stages N-M, chained`) end with ` — with review`, in the prompt box and the copy alike.
- In the framed step: `Tout d'un coup (stages N–M)`, when several stages remain, prepares `implement {plan folder} — stages N-M (…), chained`, every remaining stage in one session, one commit each; `Copier` copies the step's prompt; on `Revue finale`, `Marquer comme fait` ticks the Validation's `Review` item in `plan.md` without running the review (a `[-]` too): the plan is finalized, the tick is left uncommitted and no squash is proposed; `Revue du plan` prepares `/factory:review plan {plan folder}`.
- Above the plan's timeline: the picker of the plans (two or more), and `Nouveau plan`, which prepares `/factory:write-plan {slug}` (a new plan folder of the same spec).
- `Squasher`, on the branch line, when the branch holds two commits or more since the base branch (never on the base branch itself). The branch's feature is the newest commit scope (`{type}({slug}): …`) that names a feature of the board. That feature has a plan: the button waits for its latest plan to be finalized (`squash une fois le plan finalisé` until then), then prepares `/factory:implement {plan folder} — close the branch`. No such feature, or one without a plan: `/factory:implement close the branch {branch}`. The skill runs the squash's checks (nothing pushed or staged, every commit the feature's), proposes the message and waits for a yes: the button runs nothing.
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
- The branch line counts the whole repository: in a project rooted in a sub-folder, the uncommitted files and the commits outside the project count too.
- `base_branch` is read with a line match on `factory.yaml`, not a YAML parse: a nested or multi-line value falls back to `main`.
- The mobile app draws no picker: there a card shows the latest plan.
- A `write-plan {slug}` run names no plan folder: once over, it is listed under the latest plan.
