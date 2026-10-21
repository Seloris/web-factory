/selo-flow:implement .planning/blueprints/2026-10-22-todo-detail.md — stages 1-2 (api, web), chained — autonomous

Prototype of selo 2.0: this blueprint replaces a 1.0.0 plan folder. Follow the implement skill with these overrides, and only these:

- Input: `.planning/blueprints/2026-10-22-todo-detail.md` is the committed, approved plan. Its Progress has one line per stage; tick a stage's line in its commit. The area spec is `.planning/pages/home.md` with `.planning/domain/todo.md` (shared rules); the old `.planning/features/home/00_spec.md` is gone.
- Spec: never run `write-spec`, never edit `.planning/pages/` or `.planning/domain/`. The blueprint's Spec delta stays in the blueprint; leave `Spec merged` unticked.
- Commits: on the current branch (`proto/blueprint-v2`), not `main`. Each body carries `Spec: pending (.planning/blueprints/2026-10-22-todo-detail.md)`; skip `spec-check`. The plan's commits are those with scope `(todo-detail)` from the one that added the blueprint.
- Decisions the blueprint leaves open: append each one to the blueprint's Technical defaults (one line, `- {question} → {answer} ({reason})`), or to its Business decisions when it is one. Departures from the blueprint go in a `## Deviations` section of the blueprint.
- Review: the `reviewer` on model `opus`. Tick `Review` in the blueprint.
