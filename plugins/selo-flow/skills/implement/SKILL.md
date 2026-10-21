---
name: implement
description: "Implement a plan's stages, or a development request directly (the fastlane: feature, change, bug fix). One stage per component in the manifest's order, layer by layer, test-first, verified by build, full test and lint through runner; the spec updated in the same commit; one review and the demo browser test at the end. Use for any request to code, with a plan folder under .planning/features/{slug}/dev-plans/ or without one. With — autonomous (autopilot): no question."
---

# Implement a plan or a request

Read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` first, then the manifest: the `stages` order, each component's `layers`, `commands` (`build`, `test`, `lint`, `prepare`, `handoff`, `integration_tests`, `demo`), `handoff` file, `url`, `demoUrl`.

## Input

- **A blueprint** `.planning/blueprints/{file}`: this skill does not build it; give `/selo-flow:build {file}` instead.
- **A plan folder** `.planning/features/{slug}/dev-plans/{ts}-{type}-{name}/` (1.0 layout, the rules' **Legacy layout**): read `plan.md`, and the area's `00_spec.md` for the business rules. A plan whose `plan.md` is untracked is a draft: say so and stop.
- **A request** without a plan, of any size (`/selo-flow:implement {request}`): the **fastlane**; never send the person to plan first unless they ask. Before coding, state the commit subject of each component touched. When the request touches several components and the person is here, post a five-line approach first (area, components and files, contract changes, tests, subjects) and wait for their ok. Ask only when the answer changes the result (a business rule, a contract, the scope); never guess.

## Stages

One stage per component touched, in `stages` order; each stage is one commit.

| Stage | Starts with | Ends with |
|---|---|---|
| one per component | its `commands.prepare`, when it has one | its `commands.handoff`, when it has one; the stage committed |

- **With a plan:** the stage is the first one of Progress with unchecked steps. The prompt may name it: `— stage {N} ({component})` runs that stage and stops; `— stages {N}-{M} ({components}), chained` runs them in order in this session. The named stage, or the range's first, must be the one Progress picks: otherwise stop before coding and say where Progress is. Never skip or redo a stage. No marker: one stage.
- **Fastlane:** every component of the request, chained in this session; its commits wait until steps 7 to 9 have run, then one commit per component. A fastlane change that turns out to create a business rule or an entity stops before any commit and says so: it needs a blueprint (`/selo-flow:blueprint {same request}`; on the 1.0 layout, the feature lane, which `autopilot` then runs).
- **Chaining:** a stage with a `handoff` is committed with its handoff file before the next stage runs its `prepare`.
- **Last stage:** the plan's, or the fastlane's last component: it also runs steps 7 to 9.

## Workflow

1. **Resume.** Read Progress, `git status` and `git log`. Start at the first unchecked step. Uncommitted ticks mean an interrupted session: the changed files of this stage's component are part of the stage; files you cannot attribute belong to another session.
2. **Explore** the area's code and follow its patterns, the component's `CLAUDE.md` and `.claude/rules/`. Before writing, list every place the change must reach: callers, tests, fakers and seeders, persistence configuration, contracts and mappers, translation keys, exports, generated clients. Keep the list of files this work writes: the commit names them.
3. **Spec.** On the pages layout (no `.planning/features/*/00_spec.md`), the fastlane edits the page or domain spec itself, as the rules' **The spec follows the code** says, and its commit's `Spec:` line names each file (`Spec: home +FR-18 · todo ~BR-06`); a change that needs a new page, entity or business rule stops here and proposes `/selo-flow:blueprint {same request}`. On the 1.0 layout: name the area this change belongs to. When it changes behaviour, run `write-spec` in called mode before writing the code that depends on it; the spec cases are those of **The spec follows the code**. Before the commit, it also drops `(planned)` from the FRs this stage built. Never edit `00_spec.md` yourself.
4. **Prepare.** Run the component's `commands.prepare` when it has one (e.g. regenerate a client from the committed handoff file), without starting a server.
5. **Implement layer by layer**, in the component's `layers` order, writing or updating the tests before the code: the plan's Tests section, or the tests the change needs, following the component's testing conventions. A bug fix gets a test that reproduces it. A component whose `CLAUDE.md` says it has no unit tests gets none. While iterating, run only the relevant tests (the `test` command narrowed as the component's `CLAUDE.md` shows), never the full suite. After each layer: build, tick its steps in Progress.
6. **Verify the stage**, through `runner`, reading its errors with `file:line`:
   - `build` with zero errors and zero warnings;
   - `test` in full, once: the only net for regressions outside the area;
   - `lint` on the files this stage wrote or modified only (generated files excluded, `{files}` placeholder), never the whole component; fix those files only.

   Fix and re-run until green; a failure outside this work's files follows **Where commits go**. Before investigating a failure, check **Known failing tests** in `.claude/rules/memory.md`: a test listed there is not yours, mention it in the report. A failure you prove pre-existing goes on that list.
7. **Review, on the last stage only.** Run the `reviewer` on the whole work: with a plan, the plan's commits (**Where commits go**) plus this work's uncommitted files; in the fastlane, the commits this work made (their hashes) plus its uncommitted files. Fix the findings you agree with, then re-run step 6 for each component you changed. List the others with the reason. Tick `Review` once every finding is fixed or listed.
8. **Full suites, on the last stage.** The full `test` of every component the plan's `Tests` item lists (in the fastlane, every component touched), through `runner`, after the review's fixes; tick `Tests` when all pass.
9. **Browser test, on the last stage, by default** when a touched component has a `url`: follow `test-in-browser`, on the demo when the component has `commands.demo`, else on its dev server, with the scenarios of the plan's Tests section, or those the change needs. Fix what it reveals, then re-run step 6. Tick `Browser test` when every scenario passed. ` — without browser test` skips it: `[-] Browser test: not run (without browser test)`. A front with no demo is still tested, on its dev server.
10. **Integration tests are never run** unless the person asks, naming them, in this session: give the `integration_tests` command filtered on the area (`{filter}`). Tick the item only after such a green run.
11. **Handoff.** Run the component's `commands.handoff` when it has one, and tick its step. Do not run the next stage's `prepare` unless the stages are chained.
12. **Commit the stage** as **Where commits go** says, naming the files: code, tests, Progress and Validation ticks, the plan's Deviations, the spec delta, the handoff file or the regenerated client. Message: the announced subject (`{type}({slug}): {stage} — {summary}`, e.g. `feat(meal-order): api — cutoff time per site`), and in the body the `Spec:` line, checked with `spec-check` first (on the plan's last stage with `--plan {plan folder} --done`), and in the fastlane the Business decisions and Technical defaults. Review fixes in a component already committed go in their own commit, `fix({slug}): review — {summary}`, with its own `Spec:` line. An unasked spec delta is asked (one grouped question) before this commit, never after.
13. **Worktree.** On a branch other than `baseBranch`, the fastlane ends with the landing of the rules' **Where commits go** (sync, then the recap and the one commit's message, the squash on the person's yes); it has no delta to merge.
14. **Report and stop:** what was implemented, the tests written, the verify results, the review findings (fixed and open), the spec delta, the browser-test result, the integration-test command, then the next prompt and the done footer. Next prompt: `/selo-flow:implement {plan folder} — stage {N} ({component})`, or `— stages {N}-{M} ({components}), chained` when several remain; `/selo-flow:review {plan folder}` when the last stage left `Review` `[ ]`; none once the last stage committed with `Review` ticked.

## Autonomous mode

The prompt ends with ` — autonomous` (sent by `autopilot`). As the workflow rules' **Autonomous mode** says, plus:

- No approach to validate.
- An ambiguity, a departure from the plan or an unasked spec delta is settled without asking and recorded (Business decisions or Technical defaults in the plan; in the fastlane, in the commit body and the report). One with no defensible answer stops the stage, nothing committed.
- Review findings not fixed are listed as open, never asked. `Integration tests` is `[-]` (not run: never without the person's request).
- The report lists the Business decisions first, then the `[-]` items and what is left open; no next prompt (`autopilot` gives it).

## Rules

- Implement what the plan or the stated request says, nothing more: no extra feature, refactor, comment or doc on code you did not change. A plan that is wrong or incomplete: stop, say so, propose the fix.
- **Reuse before writing:** an existing helper, then the framework, then an installed package, then new code. No speculative abstraction or option. Never cut validation, error handling, authorization checks or tests to write less.
- **Deviations** are recorded in the plan's `## Deviations` (`- {what the plan said} → {what was done} ({reason})`) once the person accepts them, and go in the stage commit.
- Save an image the person shares as `planning.md`'s **Images** says.
