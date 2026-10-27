---
name: blueprint
description: "Write a blueprint under .planning/blueprints/: the page and domain spec delta, the Business decisions, the Technical defaults, the stages and their commit subjects, the tests, on one screen; a short grill first unless the request carries its decisions; one yes, one commit. Use for a new page, a new entity or business rule, or a change across several pages. Never code, never edits a page or domain spec, except a page stub it touches: that one's spec is written from the code first and committed before the blueprint. With — autonomous (from pilot): no question."
argument-hint: "{request} [— mockup {file}] [— autonomous]"
---

# Write a blueprint

One intention, one yes: the "what" (the spec delta) and the "how, in short" (decisions, stages, tests) approved together, committed once. Writes `.planning/blueprints/{date}-{name}.md` and its assets, never code, never a page or domain spec (`build` merges the delta at the end), except the bootstrap of a page stub it touches (step 1).

Read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` first (**Specs: pages and domains**, **Blueprints**, **Decisions**), then the manifest, then `${CLAUDE_PLUGIN_ROOT}/templates/planning/blueprint.md`.

`/selo:blueprint {request}`, optionally ending with ` — mockup .planning/mockups/{file}` (from `/selo:mockup`), ` — autonomous`, or both in that order (from `pilot`). `/selo:blueprint revise {file}: {changes or review findings}` edits a draft, or a committed blueprint whose build has not started (no stage ticked), and goes to step 5; a blueprint being built or built is never revised: a new iteration is a new blueprint. A 1.0 project (the rules' **A 1.0 project**): say so and give `/selo:setup update`.

## Procedure

1. **Context.** List `.planning/pages/` and `.planning/domain/`; read the specs the request touches, the open blueprints of the same pages (`- [ ] Spec merged`: their deltas take ids too), the `CLAUDE.md` of every component in scope, then the code of those pages. A broad sweep goes to an `Explore` subagent. Facts are looked up, never asked. A page the request touches that is still a page stub (`Status: to bootstrap`) is bootstrapped now, as the rules' **A spec written from code** say: its spec of what the page does today, written uncommitted before the draft, so the delta's `+` ids and "before" texts come from it; it is shown and committed at step 6.
2. **Name it.** The blueprint's name is kebab-case, short, about the result (`due-date`, `todo-detail`): it is the scope of every commit of the work. The pages touched, the new ones with their slug and route (a business name, Business decision), the domain sheets, the components in `stages` order.
3. **Grill**, unless the request already carries its decisions (rules stated one by one, ids cited): run `grill` on the request (target **Blueprint**: its answers go to the delta, the Business decisions and the Technical defaults), two rounds at most. What stays open becomes a `Q-NN` line of the delta, or stops the blueprint when it blocks the stages.
4. **Draft** the file, uncommitted, from the template, in one pass. The date: `node ${CLAUDE_PLUGIN_ROOT}/scripts/timestamp.mjs` gives `YYYYMMDD-HHmmss`; the file is `{YYYY}-{MM}-{DD}-{name}.md`.
   - **Spec delta:** one line per change, the grammar of the rules' **Blueprints**; a `+` id is the file's next free one (`spec-check {slug}`, past the `+` ids of the open blueprints of that file); a `~` or `-` copies its "before" text exactly. Each line obeys **Writing a spec**: one checkable sentence, the right file (one page, several pages or none → the domain sheet).
   - **Business decisions** (at most five) and **Technical defaults** (one line each): the grill's answers and the choices a reviewer would otherwise question (a route, a storage type, a contract rule). No file paths, signatures, schemas or code: the implementer reads the code.
   - **Stages:** one per component touched, in `stages` order, each with its commit subject `{type}({name}): {component} — {summary}`.
   - **Tests:** per component, the cases, or "none" with the reason (the component's `CLAUDE.md` rules); `browser:` the scenarios on the touched front, its widths.
   - **Progress:** one line per stage, then `Review`, `Browser test` when a front is touched, `Spec merged`.
   - **Mockup:** a mockup from ` — mockup {file}`, cited `[{what it shows}](../mockups/{file})`; else an image the person gave, saved at once under `.planning/blueprints/assets/{name}-{what}.png`, cited there; else none.
   - A section with nothing to say is left out. The whole file stays on one screen (about 40 lines); longer means file-level detail crept in, or the work is two blueprints.
5. **Show it**, never pasted whole: a link to the file, the delta lines in full, the Business decisions, the stages with their subjects, the open questions. Offer in one line a review of the draft by the `reviewer` (blueprint review) before the commit. Iterate with targeted `Edit`s; a renamed blueprint moves its file.
6. **One yes.** Ask with the commit message in a code block: subject `docs({name}): blueprint — {summary}`, body the pages and domain sheets touched and the stages. The yes approves the delta, the decisions and the stage subjects at once. With a bootstrap from step 1, shown at step 5 too (a link to each file, its FRs counted by zone, its BRs and `Q-NN` in full), its message comes first in its own code block (`docs({page}): bootstrap spec`, its `Spec:` line with every new id, checked with `spec-check {slug} --cite`), and the same yes makes both commits, the bootstrap first, alone. On yes, commit the blueprint, its assets and its mockup alone, as **Where commits go** says (on `baseBranch`: `git add {files} && git commit --only -m "{subject}" -m "{body}" -- {files}`; in a worktree, on its branch). On no: back to step 5; dropped: delete the draft and say so.
7. **Stop** with the path and the next prompt, a `Next:` line of the done footer: `/selo:build .planning/blueprints/{file}`, best in a new session.

## Autonomous mode

` — autonomous` (from `pilot`): no question. `grill` runs in autonomous mode; its answers go into Business decisions and Technical defaults; a question with no defensible answer stops the step, nothing written. When `models.implementer` is `sonnet` (the `lean` preset), the Technical defaults also settle the detail choices each stage would otherwise take (routes, storage, the split into components, the contract rules), so the build decides less. No review offer, no yes: commit with the subject of step 6 (a bootstrap first, in its own commit, listed in the report). The report gives the path and the stages; no next prompt.
