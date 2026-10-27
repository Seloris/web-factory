---
name: build
description: "Build a committed blueprint (.planning/blueprints/{file}): every stage chained in this session by default, one per component in the manifest's order, test-first, verified through runner, one commit each with Spec: pending; the decisions it takes recorded under Decided during build; then one review, the full suites, the browser test (demo, else the dev server), and the spec delta merged with spec-check --merge. In a worktree, ends with the landing on the base branch: one squashed commit on the person's yes. — stage N runs one stage; — no browser skips the browser test; — autonomous from pilot."
argument-hint: "{blueprint} [— stage N] [— no browser] [— autonomous]"
---

# Build a blueprint

Read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` first (**Blueprints** and **Where commits go** above all), then the manifest: `stages`, each component's `layers`, `commands` (`build`, `test`, `lint`, `prepare`, `handoff`, `integration_tests`, `demo`, `serve`), `handoff` file, `url`, `serveUrl`, `demoUrl`.

## Input

`/selo:build .planning/blueprints/{file}`, optionally with ` — stage {N}`, ` — no browser`, ` — autonomous`, ` — review: {findings}` (from `pilot`, step 9).

- The blueprint must be committed (`git log -- {file}`): an untracked one is a draft, say so and stop. `Spec merged` ticked: the work is done, say so and stop. A `Legacy:` line under its title: a 1.0 plan moved by `setup update`, history, never built: say so and stop.
- Read it whole, then the page and domain specs it names (the `BR` ids it cites are resolved there), then a `## Mockup` image or HTML mockup if any.
- A 1.0 project (the rules' **A 1.0 project**): say so and give `/selo:setup update`.
- Note the variant (**Where commits go**): on `baseBranch`, or on a worktree's branch.

## Stages

One per line of the blueprint's `## Stages`, in that order, each one commit. The first stage to run is the first unticked line of Progress. By default every remaining stage runs, chained in this session; ` — stage {N}` runs that one and stops, and must be the one Progress picks (otherwise stop before coding and say where Progress is). Never skip or redo a stage; every stage ticked and `Review` not: go to **End of the work**. A stage with a `handoff` is committed with its handoff file before the next stage runs its `prepare`.

Each step that changes the substep marks it, as the rules' **Marks** say: step 4 `tests` then `code`, step 8 `commit`; at the end of the work `review`, `suites`, `try`, `merge`.

For each stage:

1. **Resume.** Progress, `git status`, `git log`. Uncommitted changes in this stage's component after an interrupted session are part of the stage; files you cannot attribute belong to another session.
2. **Explore** the code the stage touches and follow its patterns, the component's `CLAUDE.md` and `.claude/rules/`. Before writing, list every place the change must reach: callers, tests, fakers and seeders, persistence, contracts and mappers, translation keys, exports, generated clients. Keep the list of files this work writes: the commit names them.
3. **Prepare:** the component's `commands.prepare`, when it has one, without starting a server.
4. **Implement layer by layer**, in the component's `layers` order, tests first: the blueprint's Tests line for this component, following its testing conventions (a component whose `CLAUDE.md` says it has no unit tests gets none). While iterating, run only the relevant tests, never the full suite. Build after each layer.
5. **Record the decisions** the blueprint left open as they are taken: one line each under `### Decided during build` at the end of Business decisions (what the person would want to check) or of Technical defaults (the rest), `- {question} → {answer} ({reason})`. A decision that refines or contradicts an FR or a BR of a spec also adds its `~` line to the Spec delta, with the exact "before" text. A departure from an approved decision or from the delta is asked first (under ` — autonomous`: recorded, listed first in the report).
6. **Verify**, through `runner`, reading its errors with `file:line`: `build` with zero errors and zero warnings; `test` in full, once; `lint` on the files this stage wrote only (`{files}` placeholder). Fix and re-run until green. Before investigating a failure, check **Known failing tests** in `.claude/rules/memory.md`; a failure outside this work's files on `baseBranch` follows **Where commits go**.
7. **Handoff:** the component's `commands.handoff`, when it has one.
8. **Commit the stage** without a question, as **Where commits go** says, naming the files (code, tests, the handoff file or regenerated client, the blueprint with its tick and its new decisions): subject the Stages line, body the decisions this stage recorded and `Spec: pending (.planning/blueprints/{file})`. On the last stage, steps 9 to 11 run before this commit (without the Agent tool: after it, step 9).

## End of the work (last stage)

9. **Review.** Spawn the `reviewer` (`models.reviewer`) on the whole work, naming the blueprint: on `baseBranch`, the commits with the scope `({name})` from the one that added the blueprint, plus this work's uncommitted files; in a worktree, `{baseBranch}..HEAD` plus the uncommitted files. Fix the findings you agree with, re-run step 6 for each component changed, list the others with the reason. Fixes in a component already committed go in their own commit, `fix({name}): review — {summary}`, `Spec: pending (…)`. Tick `Review` once every finding is fixed or listed. Without the Agent tool (a subagent of `pilot — autonomous`): commit the last stage first, then take the findings the prompt gives (` — review: {findings}`, `none` for a clean review) instead of spawning; with none given, stop and report `review needed`: `pilot` spawns the reviewer and runs this skill again with its findings.
10. **Full suites:** the full `test` of every touched component, through `runner`, after the fixes.
11. **Browser test**, when a touched front has a `url`, unless ` — no browser`: follow `try` with the blueprint's `browser:` scenarios, on the front's demo when it has `commands.demo`, else on its dev server (`commands.serve`, or its `CLAUDE.md` "Local run"): never skipped for want of a demo. With a `## Mockup`, take a screenshot of the page and compare it in the report. Fix what it reveals, re-run step 6. Tick `Browser test` when every scenario passed; ` — no browser`: `- [-] Browser test: not run (no browser)`.
12. **Integration tests** are never run unless the person asks, naming them, in this session: give the `integration_tests` command filtered on the work.
13. **Merge the spec delta.**
    - **On `baseBranch`:** the rules' **Blueprints** lifecycle, steps 1 to 3: `spec-check --merge`; a `conflict` or `missing` line stops and asks (show the line, the stored "before", the spec's current text; the person decides the new wording); then the specs edited, the provisional ids rewritten in the blueprint, `Spec merged` ticked, one commit `docs({name}): spec merged` with the printed `specLine`, without a question (the delta was approved with the blueprint).
    - **In a worktree:** the landing of **Where commits go**, steps 1 to 4: sync, merge the delta (the same steps, against `baseBranch`'s specs, then the full suites again), show the landing with its message, and squash on the person's yes.
14. **Report and stop:** the stages committed, the tests written, the verify results, the review findings (fixed and open), the decisions taken during the build (first), the browser-test result (and the mockup comparison), the final `Spec:` line, the integration-test command, then the done footer of the rules' **End of turn**. Next prompt: `/selo:build {file}` when stages remain (after ` — stage N`), `/selo:review {file}` when `Review` stays `[ ]`; none once `Spec merged` is ticked (in a worktree: once the landing is done).

## Autonomous mode

` — autonomous` (from `pilot`), as the rules' **Autonomous mode** says, plus: every open point is settled and recorded (**Decided during build**); a review finding not fixed is listed as open; `Integration tests` is never run. A merge `conflict` or `missing` stops the step, the stage commits left as they are. In a worktree the build stops ready to land: sync and delta merged, the landing's recap and message in the report, no squash (the person gives that yes). The report lists the decisions taken during the build first; no next prompt.

## Rules

- Build what the blueprint says, nothing more: no extra feature, refactor, comment or doc on code you did not change. A blueprint that is wrong or incomplete: stop, say so, propose the fix (a new line in the delta or the decisions, asked).
- **Reuse before writing:** an existing helper, then the framework, then an installed package, then new code. No speculative abstraction or option. Never cut validation, error handling, authorization checks or tests to write less.
- Never edit a page or domain spec before step 13; never edit the blueprint after `Spec merged`.
