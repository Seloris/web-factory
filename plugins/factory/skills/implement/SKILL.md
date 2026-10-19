---
name: implement
description: "Implement an approved dev-plan, or a development request directly without a plan (feature, change, bug fix): one stage per component in the manifest's order, layer by layer, test-first, one stage per session, verified by the component's build, test and lint commands and checked by the reviewer agent when asked (the review is optional per stage). Also runs a plan's final review and, once the plan is finalized, proposes the branch's squash. Use for any request to code, with a plan folder under .planning/features/{slug}/dev-plans/ or without one. With — autonomous (under autopilot): no question, the stage committed with its announced subject, the final review settled without asking, never a squash."
---

# Implement a plan or a request

Implement an approved plan, or a request directly when there is none, test-first, following each component's `CLAUDE.md` (loaded for the files you touch), the project's `.claude/rules/` and the patterns already in the code.

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first (the project, manifest, subagents, hard rules, commits, next prompts, done footer), then the manifest itself: the `stages` order, each component's `layers`, `commands` (`build`, `test`, `lint`, `prepare`, `handoff`, `integration_tests`; `serve` is for `test-in-browser`), `handoff` file and `url`. Git commands run at the project's root; every component command runs inside the component's path.

## Input

- A plan folder `.planning/features/{slug}/dev-plans/{ts}-{type}-{plan name}/`. Read `plan.md` before coding, and the feature's `00_spec.md` for the business rules. A plan whose `plan.md` is untracked is a draft not yet approved (see `planning.md`): say so and stop.
- Or a request without a plan (any size), `/factory:implement {request}`: see **Without a plan** below. Never send the person to plan first unless they explicitly ask to plan.

## Without a plan

Same stages, workflow and rules as with a plan; only the plan is replaced:

- **Approach first** when the request touches more than one component or layer: before coding, post a short approach in chat and wait for the person's ok. It lists the feature slug (existing or new, see `planning.md`) and whether it has a spec (when not, the offer to derive one, see the spec bullet of **Rules**), the branch name, the commit subject of each stage, the files per component and layer, the contract changes, the tests, whether to review after each stage (step 9: without a plan there is no final review to settle it later, so the approach always asks), and your questions. For a request spanning several stages, also ask whether to chain the stages in this session (default: stop after the first stage's commit). When a stage's component has a `url`, include the browser-test question of workflow step 4 in the approach. A single-layer change goes straight to coding.
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
A stage prompt may end with ` — with review` (the pane's review checkbox): it asks for the reviewer after each stage of the prompt (step 9). Without it, no stage is reviewed unless the person says so in this session. The marker changes nothing else: `— final review` and `— close the branch` never carry it.

## Autonomous mode

The prompt ends with ` — autonomous` (sent by `autopilot`, one subagent per stage, see the workflow rules' **Autonomous mode**): the stage, the final review or the fix of findings runs with no question to the person. The markers it carries keep their meaning (`— stage {N}`, `— with review`, `— final review`), plus ` — with browser test`, the only yes to a browser test.

- Workflow step 1: the branch is created from the base branch without validation, named as `planning.md` says. Step 4: no browser-test question; it runs only with ` — with browser test`.
- No approach to validate (without a plan: take the defaults and record them). An ambiguity is settled with the plan's and the spec's reading, recorded in the plan's `## Decisions taken autonomously` (`- {question} → {answer taken} ({reason})`), never asked; one with no defensible answer stops the step, nothing committed.
- A spec change goes through `write-spec` in called mode, autonomous: every delta applied and recorded.
- Step 12: the stage commit is made with the Progress subject, as always. Step 13: the report lists the decisions taken, the `[-]` items and what is left open; no next prompt, no squash proposal (`autopilot` reports it).
- **Final review**: no question. `Review` runs; `Tests` runs; `Browser test` runs only with ` — with browser test`, else `[-]` (not run: autopilot without browser test); `Integration tests` always `[-]` (not run: never without the person's request). Commit as step 7 says. The squash is never run: `autopilot` gives its prompt to the person.
- Never ` — close the branch` in autonomous mode: a squash rewrites history and waits for the person's yes.

## Final review

When the plan's Progress has stages, every one of them ticked, and an item of its Validation is still `[ ]`, there is no stage left: run the final review instead of the workflow below. Its next prompt is offered while `Review` is `[ ]`; once `Review` is ticked the plan is finalized, and it runs only when the person asks for an optional item left `[ ]`. It settles every Validation item left (see `planning.md`), not only `Review`. It is not a stage: it may fix findings in every component of the plan.

1. **Ask first**, in one message, which of the optional items still `[ ]` to run: `Tests`, `Browser test`, `Integration tests`. Never run one without the person's yes in this session; a yes in an earlier session does not count. A plan with no `## Validation` section, or missing an item that applies, gets it first.
2. **Review**, when `Review` is still `[ ]`: run the `reviewer` agent (on the `reviewer` model) on the whole plan, from the commit that added `plan.md` (`git log --diff-filter=A --format=%H -- {plan folder}plan.md`) to `HEAD`, plus the uncommitted changes. Consult the advisor on the findings, then fix the ones you agree with, following the workflow's rules; list the others with the reason and settle them with the person. When you changed code, verify as workflow step 7 says, and re-run every suite of a ticked `Tests` item, or untick it. Tick `Review` once no finding is left, fixed or left open with the person's agreement.
3. **Tests**, if yes: the full `test` command of every component the item lists, through `runner`, after the review's fixes. Fix whatever fails, as workflow step 7 says, and tick `Tests` once every suite passed.
4. **Browser test**, if yes: as workflow step 10 says, for the scenarios of the plan's Tests section; tick it when every scenario passed.
5. **Integration tests**, if yes: the `integration_tests` command filtered on the plan's area, as workflow step 8 says; tick it when every test passed.
6. **Declined items** are marked `[-]` with the reason (`- [-] Browser test: not run (declined by the person)`): the plan records that the check was not run.
7. Commit: `fix({slug}): review — {summary}` with the fixes and the Validation changes, or `chore({slug}): validation — {items}` for the ticks and marks alone.
8. Report, as workflow step 13 says, with the result of each item. Once `Review` is ticked the plan is finalized: propose the squash, as **Plan finalized** in `workflow-rules.md` says.

## Close the branch

The squash of `workflow-rules.md` (**Plan finalized**), run on its own when the person declined or put it off at the end of the plan: `/factory:implement {plan folder} — close the branch`, or `/factory:implement close the branch {branch}` without a plan. Never on your own. It is not a stage: no code, no review. The plan must be finalized; otherwise stop and say what is left.

## Workflow

1. **Branch.** If the current branch holds the plan's commit (`git log {base}..HEAD`), stay on it. Otherwise (on the base branch, or a request without a plan), propose a branch name (`{commit type}/{slug}-{name}`, see `planning.md`) and create it from the base branch only once the person validates the name. Never push.
2. **Resume.** Read the plan's Progress checklist, `git status` and `git log {base}..HEAD`. Start at the first unchecked step; never redo a checked one. Uncommitted work from an interrupted session is part of the current stage.
3. **Explore** the existing code of the feature area and follow its patterns. Before writing, list every place the change must reach: callers, tests, fakers and seeders, persistence configuration, contracts and mappers, translation keys, exports, generated clients. A place missed now costs a full build, fix and re-run cycle later.
4. **Stage start:** run the component's `commands.prepare` when it has one, e.g. regenerating a client from the previous stage's committed handoff file, without starting any server. When the component has a `url`, also ask the person, in every such session and before coding, whether to test the change in the real app at the end of the stage (`test-in-browser` skill, which starts the local servers that do not answer). Never run it without their yes in this session; a yes in an earlier session does not count.
5. **Implement layer by layer**, in the component's `layers` order, writing or updating the tests before the code. Tests are those in the plan's Tests section, following the component's testing conventions. A bug fix gets a test that reproduces it. A component whose `CLAUDE.md` says it has no unit tests gets none.
   While iterating, run only the relevant tests: the component's `test` command narrowed to the test classes written or modified and those of the touched feature, as its `CLAUDE.md` shows how. Never the full suite at this point.
6. **After each layer:** build and tick its steps in the Progress checklist. Do not commit yet.
7. **Verify the stage without asking** (the full suite and the build flood the context: hand them to `runner` and read its errors with `file:line`):
   - the component's `build` with zero errors and zero warnings;
   - the component's `test` in full once here (not filtered): the only safety net for regressions outside the feature;
   - the component's `lint` on the files this stage wrote or modified only (the changed and new files under the component's path, generated ones excluded, where the command says `{files}`), never the whole component: it reports, and tempts fixes in, files the stage did not touch. Fix the errors and warnings in those files only.

   On the plan's last stage, also run the full `test` of the other components the plan's `Tests` Validation item lists: once every suite passed, tick `Tests`. A code change after the tick (the review's fixes) re-runs every suite the item lists, or unticks it.

   Fix whatever fails and re-run until everything passes. Before investigating a failing test, check **Known failing tests** in `.claude/rules/memory.md`: a test listed there is not yours, just mention it in the report. A failure you prove pre-existing (it also fails without your changes) is added to that list.
8. **Integration tests are not run by default.** Give the exact `integration_tests` command filtered on the touched area (the `{filter}` placeholder), and run it only if the person explicitly asks in this session. When such a run is all green, tick `Integration tests` in the plan's Validation checklist.
9. **Review (only when asked).** Run it when the prompt carries `— with review` (the pane's review checkbox) or the person says yes to it in this session; otherwise skip it and say so in the report. When it runs, run the `reviewer` agent (on the `reviewer` model) on the stage's uncommitted changes. Fix the findings you agree with, and list the others with the reason in your report.
   On the plan's last stage, a review that runs covers the whole plan instead: from the commit that added `plan.md` to `HEAD`, plus the uncommitted changes. Findings on another component of the plan are reported, not fixed in this stage. Once no finding is left, fixed or left open with the person's agreement, tick `Review` in the plan's Validation; otherwise leave it for the final review. Skipped, `Review` stays `[ ]`: the final review runs it. The reviews of the earlier stages never tick it.
10. **Browser test (only if the person said yes at step 4):** follow the `test-in-browser` skill to check the change in the real app, using the accounts and scenarios that fit the change; it starts the component's servers and those it `needs` when they do not answer, and leaves them running. Fix what it reveals (then re-run step 7), and put the result in the report, with the servers it started. When every scenario passed, tick `Browser test` in the plan's Validation checklist. If the person said no, skip this step.
11. **Stage end:** run the component's `commands.handoff` when it has one, and tick the step. Do not run the next stage's `prepare` and do not touch the next component.
12. **Commit the stage** in one commit: code, tests, the ticked Progress checklist and Validation items, the plan's Deviations if any, the `00_spec.md` delta or new spec if any, and the handoff file or the regenerated client. Message: `{commit type}({slug}): {stage} — {summary}`, e.g. `feat(meal-order): api — cutoff time per site`: the subject announced for the stage (the plan's Progress `Commit:` line, or the approach without a plan; a single-layer change with no approach states its subject in the report). When the work drifted from it, the report gives the subject used and why it changed. Without a plan, same stages and same message format.
13. **Report and stop:** what was implemented, tests written, build and test results, whether the review ran (and its findings) or was skipped, the browser-test result (if run), the integration-test command, findings left open, then the next prompts, e.g. `/factory:implement {plan folder} — stage {N} ({component})` for the next stage (with ` — with review` appended when the stage prompts ran with it, or when the person asked for it), and when several stages remain `/factory:implement {plan folder} — stages {N}-{M} ({components}), chained` to run them all in one session, `/factory:implement {plan folder} — final review` when the last stage left `Review` `[ ]`, or without a plan `/factory:implement {next stage} stage of {slug}: {summary}`, and last the done footer. When this stage finalized the work (the plan's last stage with `Review` ticked, or the last stage without a plan), propose the squash after the stage commit, as **Plan finalized** in `workflow-rules.md` says: it takes the place of the next prompt, and the done footer waits for its answer.

## Rules

- Implement what the plan (or the agreed approach) says, nothing more: no extra features or refactors, no comments or docs on code you did not change. If the plan is wrong or incomplete, stop, say so and propose the fix instead of improvising.
- **Reuse before writing.** Stop at the first rung that works: an existing helper of the codebase, then the framework, then an installed package, and only then new code. No speculative abstraction, option or configuration. Never cut validation, error handling, authorization checks or tests to write less.
- **Deviations are recorded here**, with no round trip to planning. Once the person accepts a departure from the plan (a rename, a new error code, a dropped scope, a deployment step), add it to the `## Deviations` section of the plan being implemented (see `planning.md`); it goes in the stage commit.
- **Spec changes go through the `write-spec` skill**, in called mode, never by editing `00_spec.md` directly. When the request or the implementation changes business behaviour, run it before writing the code that depends on it: a delta that restates the person's request is applied without asking, a delta the person did not ask for waits for their yes. The updated `00_spec.md` goes into the stage commit, and the report lists the delta.
- **A feature with no spec** (not `tooling` or `shared`): before the stage commit, unless the plan's Decisions or a commit of the branch records a no, run `write-spec` in called mode to derive it from the code and the request (it asks first). The new spec goes into the stage commit; a no goes into its body as `Spec: declined by the person`.
- Save any image the person shares following the Images rule.
