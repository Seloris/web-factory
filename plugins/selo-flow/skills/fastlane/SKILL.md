---
name: fastlane
description: "Implement a development request directly (feature, change, bug fix) on one page or one component, no blueprint: each component touched in the manifest's order, layer by layer, test-first, verified by build, full test and lint through runner; the page or domain spec delta in the same commit (a page stub's spec written from the code first, in its own commit); one review, the full suites and the browser test at the end; one commit per component, on the base branch on the person's one yes (no yes with SELO_COMMIT=auto). Stops and proposes a blueprint when the change needs a new page, entity or business rule. --iterate: the person drives a loop of changes on the running app, no test, review or commit until they validate, then the fastlane's end once; --mockup {file}: built after a /selo-flow:mockup, compared with it; --no-browser skips the browser test; --worktree [name] runs it in a new or an existing worktree; --autonomous from pilot."
argument-hint: "{request} [--iterate] [--mockup {file}] [--no-browser] [--worktree [{name}]] [--autonomous]"
---

# Fastlane

Read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` first, then the manifest: the `stages` order, each component's `layers`, `commands` (`build`, `test`, `lint`, `prepare`, `handoff`, `integration_tests`, `demo`, `serve`), `handoff` file, `url`, `serveUrl`, `demoUrl`.

## Input

`/selo-flow:fastlane {request}`, of any size, optionally ending with ` --iterate` (**Iterate mode**), ` --mockup .planning/mockups/{file}`, ` --no-browser`, ` --worktree [{name}]` or ` --autonomous`, combined in that order (`pilot` sends ` --mockup {file} --worktree {name} --autonomous`).

- **A blueprint** `.planning/blueprints/{file}`: this skill does not build it; give `/selo-flow:build {file}` instead.
- **A 1.0 project** (the rules' **A 1.0 project**): say so and give `/selo-flow:setup update`.
- **A worktree** (` --worktree [{name}]`): the rules' **Choosing the checkout**, before step 1: a new worktree, or the existing one of that name, entered, the uncommitted mockup of ` --mockup` copied there, said in one line (`Worktree {name} · branch {branch} · slot …`). Already there: nothing to do.
- **A mockup** (` --mockup {file}`, from `/selo-flow:mockup`): read it at step 2 and build to it; a missing file was drawn in another checkout: say so and stop, naming the worktrees that hold it when `git worktree list` and a `git -C {path} log -- {file}` find one (its `Next:` line carried ` --worktree {name}`); it is committed with the front's component when it is not yet (in a worktree, `mockup` already committed it on the branch), and the browser test compares the page with it (`try` step 6).
- **A request:** never send the person to plan first unless they ask. Before coding, state the commit subject of each component touched. When the request touches several components and the person is here, post a five-line approach first (page, components and files, contract changes, tests, subjects) and wait for their ok. Ask only when the answer changes the result (a business rule, a contract, the scope); never guess.

## Stages

One stage per component touched, in `stages` order, chained in this session. The commits wait until steps 7 to 9 have run, then one commit per component. A stage with a `handoff` runs its `commands.handoff` before the next stage runs its `prepare`. The last component's stage also runs steps 7 to 9.

A change that turns out to need a new page, entity or business rule stops before any commit and says so: it needs a blueprint, `/selo-flow:blueprint {same request}` (from `pilot`, the blueprint lane on the same request).

Each step below that changes the substep marks it, as the rules' **Marks** say (step 3 `bootstrap`, step 5 `tests` then `code`, steps 7 to 9 `review`, `suites`, `try`, step 11 `commit`); the first mark names the page.

## Workflow

1. **Resume.** `git status`, `git log`. Uncommitted changes of this request after an interrupted session are part of the work; files you cannot attribute belong to another session.
2. **Explore** the page's code and follow its patterns, the component's `CLAUDE.md` and `.claude/rules/`. Before writing, list every place the change must reach: callers, tests, fakers and seeders, persistence configuration, contracts and mappers, translation keys, exports, generated clients. Keep the list of files this work writes: the commits name them.
3. **Spec.** A page the request touches that is still a page stub (`Status: to bootstrap`) is bootstrapped first, as the rules' **A spec written from code** say: its spec of what the page does today, from the code read at step 2 (an `Explore` subagent for a large page), shown with its commit message in a code block, committed alone on the person's yes (`docs({page}): bootstrap spec`, its `Spec:` line with every new id), before any code; a reading the person corrects is fixed with targeted edits before that yes. On a worktree's branch it is committed without a question: the landing shows it and its one yes covers it. Then edit the page or domain spec yourself, as the rules' **The spec follows the code** says; each commit's `Spec:` line names each file (`Spec: home +FR-18 · todo ~BR-06`).
4. **Prepare.** Run the component's `commands.prepare` when it has one (e.g. regenerate a client from the handoff file), without starting a server.
5. **Implement layer by layer**, in the component's `layers` order, writing or updating the tests before the code: the tests the change needs, following the component's testing conventions. A bug fix gets a test that reproduces it. A component whose `CLAUDE.md` says it has no unit tests gets none. While iterating, run only the relevant tests (the `test` command narrowed as the component's `CLAUDE.md` shows), never the full suite. Build after each layer.
6. **Verify the stage**, through `runner`, reading its errors with `file:line`:
   - `build` with zero errors and zero warnings;
   - `test` in full, once: the only net for regressions outside the page;
   - `lint` on the files this stage wrote or modified only (generated files excluded, `{files}` placeholder), never the whole component; fix those files only.

   Fix and re-run until green; a failure outside this work's files follows **Where commits go**. Before investigating a failure, check **Known failing tests** in `.claude/rules/memory.md`: a test listed there is not yours, mention it in the report. A failure you prove pre-existing goes on that list.
7. **Review, on the last stage.** Run the `reviewer` on the whole work: its uncommitted files (and, in a worktree, `{baseBranch}..HEAD`). Fix the findings you agree with, then re-run step 6 for each component you changed. List the others with the reason. Without the Agent tool (a subagent of `pilot --autonomous`): skip it and say so in the report; `pilot` reviews the commits.
8. **Full suites, on the last stage.** The full `test` of every component touched, through `runner`, after the review's fixes.
9. **Browser test, on the last stage, by default** when a touched component has a `url`: follow `try` with the scenarios the change needs, on the demo when the component has `commands.demo`, else on its dev server: never skipped for want of a demo; with a mockup, compared with it. Fix what it reveals, then re-run step 6. ` --no-browser` skips it: say `not run (no browser)` in the report.
10. **Integration tests are never run** unless the person asks, naming them, in this session: give the `integration_tests` command filtered on the page (`{filter}`).
11. **Commit**, one per component, as **Where commits go** says, naming the files: code, tests, the spec delta, the handoff file or the regenerated client, the mockup (with the front's component), and in the last commit the work's entry of `.planning/changelog.md` (the rules' **The changelog**: a `feat` or `fix`, or a change the user sees; none for a refactor, tests, tooling or docs), shown with the messages. Message: the announced subject (rules' **Commits**: `{type}({page}): {summary}`, `{type}({page}): {component} — {summary}` when several components), and in the body the Business decisions, the Technical defaults and the `Spec:` line, checked with `spec-check {slug} --cite "…"` first. Review fixes in a component already committed go in their own commit, `fix({page}): review — {summary}`, with its own `Spec:` line. On `baseBranch`, first read the person's setting: `node ${CLAUDE_PLUGIN_ROOT}/scripts/settings.mjs` (never guess it): unless its `commit` is `auto`, show every commit's message in a code block and commit them all on the person's one yes; an unasked spec delta is asked in that same question. With `commit: auto`, commit without showing the messages; an unasked spec delta is still asked (one grouped question) before this commit, never after. In a worktree the commits go on its branch without a question (step 12's landing is the yes).
12. **Worktree.** On a branch other than `baseBranch`, the fastlane ends with the landing of the rules' **Where commits go** (sync, then the recap and the one commit's message, the squash on the person's yes); it has no delta to merge.
13. **Report and stop:** what was implemented, the tests written, the verify results, the review findings (fixed and open), the spec delta, the browser-test result, the integration-test command, then the done footer. Next prompt: `/selo-flow:fastlane fix findings {numbers} of the review` when findings stay open (with ` --worktree {name}` when the work is still on a worktree's branch, not yet landed: autonomous mode's stop ready to land; after a landing, without: the rules' **The next steps**); none otherwise.

## Iterate mode

The prompt ends with ` --iterate`: the person tries changes on the running app, one per turn, and validates the whole once. Nothing is tested, reviewed or committed before that validation. Never in autonomous mode: ` --iterate` with ` --autonomous` is refused.

1. **Where.** On `baseBranch`, with no ` --worktree` on the prompt, ask once, before any change: move to a worktree (the rules' **Choosing the checkout**, as ` --worktree` alone would), or stay on the shared checkout, saying the risk: other sessions that touch these files wait for this work's commit (**Where commits go**). Moving to a worktree copies this work's uncommitted files there (the mockup, a bootstrap already written). In a worktree, or with ` --worktree` given (the move was made at **Input**), no question.
2. **Steps 1, 2 and 4**, as above, without stating the commit subjects yet; of step 3, only a page stub's bootstrap, written now, uncommitted (the delta's "before" texts come from it), and committed first at the validation, alone. The spec delta waits for the validation.
3. **Start the app** the change touches: `node ${CLAUDE_PLUGIN_ROOT}/scripts/run.mjs {component}` as a background command, its dev servers (they reload on save; a demo holds the slot), as `try` step 2 says. Give the person its url from the `SELO_RUN` line.
4. **Each turn:** the change asked, layer by layer, building after each layer, no test written or run, no lint, no review; mark `code` once, at the first change. Say in a few lines what changed and where to look; the turn's last line is the question `Autre chose, ou on valide ?` (in `language.chat`, bare, ending with `?`: Selo Ops reads it as a question), its `Status:` line right above it (the rules' **End of turn**), never a footer. A change that needs a new page, entity or business rule: say so at once and stop the loop, the code left uncommitted, with `/selo-flow:blueprint {request}`. A change the person drops is reverted at once, so only the kept state reaches the validation.
5. **Validation** (the person says so): stop what step 3 started (`try` step 5), then:
   - state the commit subject of each component touched;
   - step 3's spec delta, written from the final state against the spec as it was at the start, never from the turns' history;
   - step 5's tests for the final behaviour, the tests the loop broke fixed (mark `tests`);
   - steps 6 to 10 as above;
   - step 11: the bootstrap first, then the components' commits, their messages shown in code blocks, all made on the person's one yes, whatever `SELO_COMMIT` says (this yes is the validation); in a worktree, committed on its branch without a question, then step 12's landing and its one yes.

## Autonomous mode

The prompt ends with ` --autonomous` (sent by `pilot`). As the rules' **Autonomous mode** says, plus:

- No approach to validate. A page stub's bootstrap is committed without a question and listed in the report.
- Step 11 commits with no yes and no read of the person's settings, on `baseBranch` too.
- An ambiguity or an unasked spec delta is settled without asking and recorded in the commit body and the report (Business decisions or Technical defaults). One with no defensible answer stops the work, nothing committed.
- Review findings not fixed are listed as open, never asked. Integration tests are never run.
- In a worktree the fastlane stops ready to land: synced, the landing's recap and message in the report, no squash (the person gives that yes).
- The report lists the Business decisions first, then what is left open; no next prompt (`pilot` gives it).

## Rules

- Implement what the request says, nothing more: no extra feature, refactor, comment or doc on code you did not change.
- **Reuse before writing:** an existing helper, then the framework, then an installed package, then new code. No speculative abstraction or option. Never cut validation, error handling, authorization checks or tests to write less.
- Save an image the person shares as `planning.md`'s **Images** says.
