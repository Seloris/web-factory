---
name: implement
description: "Implement an approved dev-plan, or a development request directly without a plan (feature, change, bug fix): one stage per component in the manifest's order, layer by layer, test-first, one stage per session, verified by the component's build, test and lint commands and checked by the reviewer agent. Also runs a plan's final review and closes a branch (squash). Use for any request to code, with a plan folder under .planning/features/{slug}/dev-plans/ or without one."
---

# Implement a plan or a request

Implement an approved plan, or a request directly when there is none, test-first, following each component's `CLAUDE.md` (loaded for the files you touch), the project's `.claude/rules/` and the patterns already in the code.

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first (the project, manifest, subagents, hard rules, commits, next prompts, done footer), then the manifest itself: the `stages` order, each component's `layers`, `commands` (`build`, `test`, `lint`, `prepare`, `handoff`, `integration_tests`), `handoff` file and `url`. Git commands run at the project's root; every component command runs inside the component's path.

## Input

- A plan folder `.planning/features/{slug}/dev-plans/{ts}-{type}-{plan name}/`. Read `plan.md` before coding, and the feature's `00_spec.md` for the business rules. A plan whose `plan.md` is untracked is a draft not yet approved (see `planning.md`): say so and stop.
- Or a request without a plan (any size), `/factory:implement {request}`: see **Without a plan** below. Never send the person to plan first unless they explicitly ask to plan.

## Without a plan

Same stages, workflow and rules as with a plan; only the plan is replaced:

- **Approach first** when the request touches more than one component or layer: before coding, post a short approach in chat and wait for the person's ok. It lists the feature slug (existing or new, see `planning.md`), the branch name, the commit subject of each stage, the files per component and layer, the contract changes, the tests, and your questions. For a request spanning several stages, also ask whether to chain the stages in this session (default: stop after the first stage's commit). When a stage's component has a `url`, include the browser-test question of workflow step 4 in the approach. A single-layer change goes straight to coding.
- **Ask whenever something is ambiguous**, whatever the size: a business rule, a contract, the scope. Do not guess.
- **Progress** is tracked with `git status` and `git log {base}..HEAD` instead of a checklist; skip the tick steps.
- **Reviewer:** give it the agreed approach as the reference, along with the conventions.

## Advisor

When the advisor tool is available (the `advisor` model of the manifest), consult it: after reading the plan or the request and before writing code, when a build or test failure keeps coming back, when you consider departing from the plan, and before running the reviewer. Without it, carry on.

## Stages

A plan is implemented in stages, **one stage per session**. Stop at the end of each stage, even if the next one looks small: a new session starts with a clean context. Only exception: the person explicitly asked to chain the stages, upfront without a plan, or in the prompt that starts a plan's implementation. The stages then still run in order, one commit per stage: a stage with a `handoff` is committed with its handoff file before the next stage runs its `prepare`.

| Stage | Starts with | Ends with |
|---|---|---|
| one per component in `stages` order | the component's `commands.prepare`, when it has one | the component's `commands.handoff`, when it has one; the stage committed |

Each stage is **one commit**, made at the end of the stage. A plan or request touching one component has a single stage. Pick the stage from the plan's **Progress** checklist (the first stage with unchecked steps), or without a plan from the commits already on the branch.

The prompt may name what it runs, after the plan folder: `— stage {N} ({component})` for one stage, `— stages {N}-{M} ({component}, {component}), chained` for several in one session (that is the explicit request to chain). The named stage must be the one Progress picks, or the range must start there: otherwise stop before coding and say which stage Progress is at, never skip or redo a stage.

## Final review

When the plan's Progress has stages, every one of them ticked, and `Review` is not ticked in its Validation, there is no stage left: run the final review instead of the workflow below. It is not a stage: it may fix findings in every component of the plan.

1. Run the `reviewer` agent (on the `reviewer` model) on the whole plan: from the commit that added `plan.md` (`git log --diff-filter=A --format=%H -- {plan folder}plan.md`) to `HEAD`, plus the uncommitted changes.
2. Consult the advisor on the findings, then fix the ones you agree with, following the workflow's rules; list the others with the reason and settle them with the person.
3. When you changed code, verify as workflow step 7 says.
4. Tick `Review` in the plan's Validation once no finding is left, fixed or left open with the person's agreement. A plan with no `## Validation` section gets one first, with the items that apply (see `planning.md`).
5. Commit: `fix({slug}): review — {summary}` with the fixes and the tick, or `chore({slug}): validation — review` for the tick alone.
6. Report and stop, as workflow step 13 says; the next prompts are the plan's remaining Validation items (browser test, integration tests), if any, then the branch close (`/factory:implement {plan folder} — close the branch`).

## Close the branch

A branch reaches the base branch as **one commit**. The stages keep their own commits while the work goes on (a new session resumes from them, and nothing is lost between sessions); closing the branch squashes them, once nothing is left to commit: the plan's Validation all ticked (the browser-test and integration-test ticks add commits), or without a plan the last stage committed. Run it when the prompt asks for it (`/factory:implement {plan folder} — close the branch`, or `/factory:implement close the branch {branch}` without a plan), never on your own. It is not a stage: no code, no review.

1. **Range.** `base=$(git merge-base {baseBranch} HEAD)` (`origin/{baseBranch}` when there is no local one), never the base branch itself: if it moved since the branch was cut, a reset onto it would revert its new commits. List `git log --oneline $base..HEAD`.
2. **Check, and stop on any failure, saying why:**
   - the working tree is clean of the branch's own work (`git status`): every change to squash is committed. Unrelated uncommitted files stay as they are and stay out of the commit;
   - nothing is staged (`git diff --cached --quiet`): the reset keeps the index, and a staged file would land in the squash;
   - nothing of the range is pushed: when `git rev-parse @{u}` succeeds, `git log @{u}..HEAD` must list every commit of the range. A pushed commit means a force push, a human's call;
   - every commit of the range belongs to the feature (`{type}({slug}): …`, the plan's slug, or without a plan the one the branch's commits name): a branch carrying another feature's commits is not squashed; list them and let the person decide;
   - the range holds more than one commit (one alone is already closed).
3. **Propose** the commit, its full message (subject and body) in a code block, and wait for the person's explicit yes, in this session, every time: it rewrites the branch's history. Message: `{type}({slug}): {summary}`, with no stage marker, the type the plan's (see `planning.md`) or without a plan the stage commits' (`feat` over `fix` over `refactor` over `chore`), the summary the plan's title or the request, and a body listing the squashed subjects, one per line.
4. **Squash:** note the current `HEAD` hash, then `git reset --soft $base` and `git commit` of the index as it stands, never `git add -A` or `git add .`: an unrelated uncommitted file stays out.
5. **Report:** the new commit, the squashed subjects, and the old `HEAD` hash to get the branch back (`git reset --hard {old hash}`) if needed; then the done footer. The branch is ready for the human to push.

## Workflow

1. **Branch.** If the current branch holds the plan's commit (`git log {base}..HEAD`), stay on it. Otherwise (on the base branch, or a request without a plan), propose a branch name (`{commit type}/{slug}-{name}`, see `planning.md`) and create it from the base branch only once the person validates the name. Never push.
2. **Resume.** Read the plan's Progress checklist, `git status` and `git log {base}..HEAD`. Start at the first unchecked step; never redo a checked one. Uncommitted work from an interrupted session is part of the current stage.
3. **Explore** the existing code of the feature area and follow its patterns. Before writing, list every place the change must reach: callers, tests, fakers and seeders, persistence configuration, contracts and mappers, translation keys, exports, generated clients. A place missed now costs a full build, fix and re-run cycle later.
4. **Stage start:** run the component's `commands.prepare` when it has one, e.g. regenerating a client from the previous stage's committed handoff file, without starting any server. When the component has a `url`, also ask the person, in every such session and before coding, whether to test the change in the real app at the end of the stage (`test-in-browser` skill). Never run it without their yes in this session; a yes in an earlier session does not count.
5. **Implement layer by layer**, in the component's `layers` order, writing or updating the tests before the code. Tests are those in the plan's Tests section, following the component's testing conventions. A bug fix gets a test that reproduces it. A component whose `CLAUDE.md` says it has no unit tests gets none.
   While iterating, run only the relevant tests: the component's `test` command narrowed to the test classes written or modified and those of the touched feature, as its `CLAUDE.md` shows how. Never the full suite at this point.
6. **After each layer:** build and tick its steps in the Progress checklist. Do not commit yet.
7. **Verify the stage without asking** (the full suite and the build flood the context: hand them to `runner` and read its errors with `file:line`):
   - the component's `build` with zero errors and zero warnings;
   - the component's `test` in full once here (not filtered): the only safety net for regressions outside the feature;
   - the component's `lint` on the files this stage wrote or modified only (the changed and new files under the component's path, generated ones excluded, where the command says `{files}`), never the whole component: it reports, and tempts fixes in, files the stage did not touch. Fix the errors and warnings in those files only.

   Fix whatever fails and re-run until everything passes. Before investigating a failing test, check **Known failing tests** in `.claude/rules/memory.md`: a test listed there is not yours, just mention it in the report. A failure you prove pre-existing (it also fails without your changes) is added to that list.
8. **Integration tests are not run by default.** Give the exact `integration_tests` command filtered on the touched area (the `{filter}` placeholder), and run it only if the person explicitly asks in this session. When such a run is all green, tick `Integration tests` in the plan's Validation checklist.
9. **Review.** Run the `reviewer` agent (on the `reviewer` model) on the stage's uncommitted changes. Fix the findings you agree with, and list the others with the reason in your report.
   On the plan's last stage, the review covers the whole plan instead: from the commit that added `plan.md` to `HEAD`, plus the uncommitted changes. Findings on another component of the plan are reported, not fixed in this stage. Once no finding is left, fixed or left open with the person's agreement, tick `Review` in the plan's Validation; otherwise leave it for the final review. The reviews of the earlier stages never tick it.
10. **Browser test (only if the person said yes at step 4):** follow the `test-in-browser` skill to check the change in the real app, using the accounts and scenarios that fit the change. Fix what it reveals (then re-run step 7), and put the result in the report. When every scenario passed, tick `Browser test` in the plan's Validation checklist. If the person said no, skip this step.
11. **Stage end:** run the component's `commands.handoff` when it has one, and tick the step. Do not run the next stage's `prepare` and do not touch the next component.
12. **Commit the stage** in one commit: code, tests, the ticked Progress checklist and Validation items, the plan's Deviations if any, the `00_spec.md` delta if any, and the handoff file or the regenerated client. Message: `{commit type}({slug}): {stage} — {summary}`, e.g. `feat(meal-order): api — cutoff time per site`: the subject announced for the stage (the plan's Progress `Commit:` line, or the approach without a plan; a single-layer change with no approach states its subject in the report). When the work drifted from it, the report gives the subject used and why it changed. Without a plan, same stages and same message format.
13. **Report and stop:** what was implemented, tests written, build and test results, the browser-test result (if run), the integration-test command, findings left open, then the next prompts, e.g. `/factory:implement {plan folder} — stage {N} ({component})` for the next stage, and when several stages remain `/factory:implement {plan folder} — stages {N}-{M} ({components}), chained` to run them all in one session, `/factory:implement {plan folder} — final review` when the last stage left `Review` unticked, `/factory:implement {plan folder} — close the branch` once the Validation is all ticked, or without a plan `/factory:implement {next stage} stage of {slug}: {summary}` and, after the last stage, `/factory:implement close the branch {branch}`, and last the done footer.

## Rules

- Implement what the plan (or the agreed approach) says, nothing more: no extra features or refactors, no comments or docs on code you did not change. If the plan is wrong or incomplete, stop, say so and propose the fix instead of improvising.
- **Reuse before writing.** Stop at the first rung that works: an existing helper of the codebase, then the framework, then an installed package, and only then new code. No speculative abstraction, option or configuration. Never cut validation, error handling, authorization checks or tests to write less.
- **Deviations are recorded here**, with no round trip to planning. Once the person accepts a departure from the plan (a rename, a new error code, a dropped scope, a deployment step), add it to the `## Deviations` section of the plan being implemented (see `planning.md`); it goes in the stage commit.
- **Spec changes go through the `write-spec` skill**, in called mode, never by editing `00_spec.md` directly. When the request or the implementation changes business behaviour, run it before writing the code that depends on it: a delta that restates the person's request is applied without asking, a delta the person did not ask for waits for their yes. The updated `00_spec.md` goes into the stage commit, and the report lists the delta.
- Save any image the person shares following the Images rule.
