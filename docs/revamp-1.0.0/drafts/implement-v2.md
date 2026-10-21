---
name: implement
description: "Implement a plan's stages, or a development request directly (the fastlane: feature, change, bug fix). One stage per component in the manifest's order, layer by layer, test-first, verified by build, full test and lint through runner; the spec updated in the same commit; one review and the demo browser test at the end. Use for any request to code. With — autonomous (autopilot): no question."
---

# Implement a plan or a request

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first, then the manifest: the `stages` order, each component's `layers`, `commands` (`build`, `test`, `lint`, `prepare`, `handoff`, `integration_tests`, `demo`), `handoff` file, `url`.

## Input

- **A plan folder** `.planning/features/{slug}/dev-plans/{ts}-{type}-{name}/`: read `plan.md`, and the area's `00_spec.md` for the business rules. A plan whose `plan.md` is untracked is a draft: say so and stop.
- **A request** without a plan, of any size: the **fastlane**. Before coding, state the commit subject of each component touched. When the request touches several components and the person is here, post a five-line approach first (area, components and files, contract changes, tests, subjects) and wait for their ok. Ask only when the answer changes the result (a business rule, a contract, the scope); never guess.

## Stages

One stage per component touched, in `stages` order; each stage is one commit.

| Stage | Starts with | Ends with |
|---|---|---|
| one per component | its `commands.prepare`, when it has one | its `commands.handoff`, when it has one; the stage committed |

- **With a plan:** the stage is the first one of Progress with unchecked steps. The prompt may name it: `— stage {N} ({component})` runs that stage and stops; `— stages {N}-{M} ({components}), chained` runs them in order in this session. The named stage, or the range's first, must be the one Progress picks: otherwise stop before coding and say where Progress is. Never skip or redo a stage. No marker: one stage.
- **Fastlane:** every component of the request, chained in this session; its commits wait until steps 7 to 9 have run, then one commit per component. A fastlane change that turns out to create a business rule or an entity stops before any commit and says so: it needs the feature lane (`autopilot` then runs it).
- **Chaining:** a stage with a `handoff` is committed with its handoff file before the next stage runs its `prepare`.
- **Last stage:** the plan's, or the fastlane's last component: it also runs steps 7 to 9.

## Workflow

1. **Resume.** Read Progress, `git status` and `git log`. Start at the first unchecked step. Uncommitted ticks mean an interrupted session: the changed files of this stage's component are part of the stage; files you cannot attribute belong to another session.
2. **Explore** the area's code and follow its patterns, the component's `CLAUDE.md` and `.claude/rules/`. Before writing, list every place the change must reach: callers, tests, fakers and seeders, persistence configuration, contracts and mappers, translation keys, exports, generated clients. Keep the list of files this work writes: the commit names them.
3. **Spec.** Name the area this change belongs to. When it changes behaviour, run `write-spec` in called mode before writing the code that depends on it; the spec cases are those of **The spec follows the code**. Before the commit, it also drops `(planned)` from the FRs this stage built. Never edit `00_spec.md` yourself.
4. **Prepare.** Run the component's `commands.prepare` when it has one (e.g. regenerate a client from the committed handoff file), without starting a server.
5. **Implement layer by layer**, in the component's `layers` order, writing or updating the tests before the code: the plan's Tests section, or the tests the change needs, following the component's testing conventions. A bug fix gets a test that reproduces it. A component whose `CLAUDE.md` says it has no unit tests gets none. While iterating, run only the relevant tests (the `test` command narrowed as the component's `CLAUDE.md` shows), never the full suite. After each layer: build, tick its steps in Progress.
6. **Verify the stage**, through `runner`, reading its errors with `file:line`:
   - `build` with zero errors and zero warnings;
   - `test` in full, once: the only net for regressions outside the area;
   - `lint` on the files this stage wrote or modified only (generated files excluded, `{files}` placeholder), never the whole component; fix those files only.

   Fix and re-run until green; a failure outside this work's files follows **Where commits go**. Before investigating a failure, check **Known failing tests** in `.claude/rules/memory.md`: a test listed there is not yours, mention it in the report. A failure you prove pre-existing goes on that list.
7. **Review, on the last stage only.** Run the `reviewer` on the whole work: with a plan, from the commit that added `plan.md` (`git log --diff-filter=A --format=%H -- {plan folder}plan.md`) to `HEAD`, plus the uncommitted changes; in the fastlane, the commits this work made (their hashes) plus its uncommitted files. Fix the findings you agree with, then re-run step 6 for each component you changed. List the others with the reason. Tick `Review` once every finding is fixed or listed.
8. **Full suites, on the last stage.** The full `test` of every component the plan's `Tests` item lists (in the fastlane, every component touched), through `runner`, after the review's fixes; tick `Tests` when all pass.
9. **Browser test, on the last stage, by default** when a touched component has a `url` and `commands.demo`: follow `test-in-browser` on the demo with the scenarios of the plan's Tests section, or those the change needs. Fix what it reveals, then re-run step 6. Tick `Browser test` when every scenario passed. ` — without browser test` skips it: `[-] Browser test: not run (without browser test)`; a component with no `demo` gets `[-] … (no demo)`.
10. **Integration tests are never run** unless the person asks, naming them, in this session: give the `integration_tests` command filtered on the area (`{filter}`). Tick the item only after such a green run.
11. **Handoff.** Run the component's `commands.handoff` when it has one, and tick its step. Do not run the next stage's `prepare` unless the stages are chained.
12. **Commit the stage** as **Where commits go** says, naming the files: code, tests, Progress and Validation ticks, the plan's Deviations, the spec delta, the handoff file or the regenerated client. Message: the announced subject (`{type}({slug}): {stage} — {summary}`), and in the body the `Spec:` line and, in the fastlane, the decisions taken alone. When the work drifted from it, the report says the subject used and why. Review fixes in a component already committed go in their own commit, `fix({slug}): review — {summary}`. When the person is here, an unasked spec delta is asked (one grouped question) before this commit, never after.
13. **Report and stop:** what was implemented, the tests written, the verify results, the review findings (fixed and open), the spec delta (an unasked behaviour first, as one grouped question), the browser-test result, the integration-test command, then the next prompt and the done footer. Next prompt: `/factory:implement {plan folder} — stage {N} ({component})`, or `— stages {N}-{M} ({components}), chained` when several remain; none once the last stage committed.

## Autonomous mode

The prompt ends with ` — autonomous` (sent by `autopilot`). As the workflow rules' **Autonomous mode** says, plus:

- An ambiguity, a departure from the plan or an unasked spec delta is settled without asking and recorded (Business decisions or Technical defaults in the plan; in the fastlane, in the report). One with no defensible answer stops the stage, nothing committed.
- Review findings not fixed are listed as open, never asked.
- The report lists the Business decisions first, then the `[-]` items and what is left open; no next prompt (`autopilot` gives it).

## Rules

- Implement what the plan or the stated request says, nothing more: no extra feature, refactor, comment or doc on code you did not change. A plan that is wrong or incomplete: stop, say so, propose the fix.
- **Reuse before writing:** an existing helper, then the framework, then an installed package, then new code. No speculative abstraction or option. Never cut validation, error handling, authorization checks or tests to write less.
- **Deviations** are recorded in the plan's `## Deviations` (`- {what the plan said} → {what was done} ({reason})`) once the person accepts them, and go in the stage commit.
- Save an image the person shares as `planning.md`'s **Images** says.
