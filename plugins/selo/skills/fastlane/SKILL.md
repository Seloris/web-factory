---
name: fastlane
description: "Implement a development request directly (feature, change, bug fix) on one page or one component, no blueprint: each component touched in the manifest's order, layer by layer, test-first, verified by build, full test and lint through runner; the page or domain spec delta in the same commit; one review, the full suites and the browser test at the end; one commit per component. Stops and proposes a blueprint when the change needs a new page, entity or business rule. — no browser skips the browser test; — autonomous under autopilot."
---

# Fastlane

Read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` first, then the manifest: the `stages` order, each component's `layers`, `commands` (`build`, `test`, `lint`, `prepare`, `handoff`, `integration_tests`, `demo`, `serve`), `handoff` file, `url`, `serveUrl`, `demoUrl`.

## Input

`/selo:fastlane {request}`, of any size, optionally ending with ` — no browser` or ` — autonomous`.

- **A blueprint** `.planning/blueprints/{file}`: this skill does not build it; give `/selo:build {file}` instead.
- **A 1.0 project** (the rules' **A 1.0 project**): say so and give `/selo:setup update`.
- **A request:** never send the person to plan first unless they ask. Before coding, state the commit subject of each component touched. When the request touches several components and the person is here, post a five-line approach first (page, components and files, contract changes, tests, subjects) and wait for their ok. Ask only when the answer changes the result (a business rule, a contract, the scope); never guess.

## Stages

One stage per component touched, in `stages` order, chained in this session. The commits wait until steps 7 to 9 have run, then one commit per component. A stage with a `handoff` runs its `commands.handoff` before the next stage runs its `prepare`. The last component's stage also runs steps 7 to 9.

A change that turns out to need a new page, entity or business rule stops before any commit and says so: it needs a blueprint, `/selo:blueprint {same request}` (under autopilot, the blueprint lane on the same request).

## Workflow

1. **Resume.** `git status`, `git log`. Uncommitted changes of this request after an interrupted session are part of the work; files you cannot attribute belong to another session.
2. **Explore** the page's code and follow its patterns, the component's `CLAUDE.md` and `.claude/rules/`. Before writing, list every place the change must reach: callers, tests, fakers and seeders, persistence configuration, contracts and mappers, translation keys, exports, generated clients. Keep the list of files this work writes: the commits name them.
3. **Spec.** Edit the page or domain spec yourself, as the rules' **The spec follows the code** says; each commit's `Spec:` line names each file (`Spec: home +FR-18 · todo ~BR-06`).
4. **Prepare.** Run the component's `commands.prepare` when it has one (e.g. regenerate a client from the handoff file), without starting a server.
5. **Implement layer by layer**, in the component's `layers` order, writing or updating the tests before the code: the tests the change needs, following the component's testing conventions. A bug fix gets a test that reproduces it. A component whose `CLAUDE.md` says it has no unit tests gets none. While iterating, run only the relevant tests (the `test` command narrowed as the component's `CLAUDE.md` shows), never the full suite. Build after each layer.
6. **Verify the stage**, through `runner`, reading its errors with `file:line`:
   - `build` with zero errors and zero warnings;
   - `test` in full, once: the only net for regressions outside the page;
   - `lint` on the files this stage wrote or modified only (generated files excluded, `{files}` placeholder), never the whole component; fix those files only.

   Fix and re-run until green; a failure outside this work's files follows **Where commits go**. Before investigating a failure, check **Known failing tests** in `.claude/rules/memory.md`: a test listed there is not yours, mention it in the report. A failure you prove pre-existing goes on that list.
7. **Review, on the last stage.** Run the `reviewer` on the whole work: its uncommitted files (and, in a worktree, `{baseBranch}..HEAD`). Fix the findings you agree with, then re-run step 6 for each component you changed. List the others with the reason. Without the Agent tool (a subagent under `autopilot`): skip it and say so in the report; `autopilot` reviews the commits.
8. **Full suites, on the last stage.** The full `test` of every component touched, through `runner`, after the review's fixes.
9. **Browser test, on the last stage, by default** when a touched component has a `url`: follow `try` with the scenarios the change needs, on the demo when the component has `commands.demo`, else on its dev server: never skipped for want of a demo. Fix what it reveals, then re-run step 6. ` — no browser` skips it: say `not run (no browser)` in the report.
10. **Integration tests are never run** unless the person asks, naming them, in this session: give the `integration_tests` command filtered on the page (`{filter}`).
11. **Commit**, one per component, as **Where commits go** says, naming the files: code, tests, the spec delta, the handoff file or the regenerated client. Message: the announced subject (rules' **Commits**: `{type}({page}): {summary}`, `{type}({page}): {component} — {summary}` when several components), and in the body the Business decisions, the Technical defaults and the `Spec:` line, checked with `spec-check {slug} --cite "…"` first. Review fixes in a component already committed go in their own commit, `fix({page}): review — {summary}`, with its own `Spec:` line. An unasked spec delta is asked (one grouped question) before this commit, never after.
12. **Worktree.** On a branch other than `baseBranch`, the fastlane ends with the landing of the rules' **Where commits go** (sync, then the recap and the one commit's message, the squash on the person's yes); it has no delta to merge.
13. **Report and stop:** what was implemented, the tests written, the verify results, the review findings (fixed and open), the spec delta, the browser-test result, the integration-test command, then the done footer. Next prompt: `/selo:fastlane fix findings {numbers} of the review` when findings stay open; none otherwise.

## Autonomous mode

The prompt ends with ` — autonomous` (sent by `autopilot`). As the rules' **Autonomous mode** says, plus:

- No approach to validate.
- An ambiguity or an unasked spec delta is settled without asking and recorded in the commit body and the report (Business decisions or Technical defaults). One with no defensible answer stops the work, nothing committed.
- Review findings not fixed are listed as open, never asked. Integration tests are never run.
- In a worktree the fastlane stops ready to land: synced, the landing's recap and message in the report, no squash (the person gives that yes).
- The report lists the Business decisions first, then what is left open; no next prompt (`autopilot` gives it).

## Rules

- Implement what the request says, nothing more: no extra feature, refactor, comment or doc on code you did not change.
- **Reuse before writing:** an existing helper, then the framework, then an installed package, then new code. No speculative abstraction or option. Never cut validation, error handling, authorization checks or tests to write less.
- Save an image the person shares as `planning.md`'s **Images** says.
