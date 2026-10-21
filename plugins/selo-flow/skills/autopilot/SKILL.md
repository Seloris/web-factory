---
name: autopilot
description: "Take a free request, an area slug or a plan folder to finished work on the base branch, no question asked. Reads the code, then picks the fastlane (one implement run) or the feature lane (spec, plan, stages, review, demo browser test), each step a fresh subagent. — fastlane / — with plan force the lane; — until spec / — until plan stop early."
---

# Autopilot

The session is the orchestrator: it runs the steps one after another, each as a fresh subagent, and reads only their reports. It never reads or writes the project's code, never asks the person, and stops only on a real blocker.

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first, then the manifest: `models` (one per role), `stages`, `baseBranch`, each component's `url` and `commands.demo`.

## Input

`/selo-flow:autopilot {input}`:

- **A free request**: the lane is chosen first.
- **A slug** (an area) with its `00_spec.md`: the feature lane from the plan; with an unfinished committed plan, that plan folder (the most recent).
- **A plan folder** `.planning/features/{slug}/dev-plans/{…}/`: the stages, resumed at Progress. An untracked `plan.md` is a draft: committed as it stands, then implemented.

Options, at the end of the prompt:

- ` — fastlane` / ` — with plan`: force the lane of a free request.
- ` — until spec`: stop once the spec is committed. ` — until plan`: stop once the plan is committed. Both imply the feature lane.
- ` — without browser test`: passed on to every `implement` step. Otherwise the last stage runs the browser test on the demo, as `implement` says.

## Prerequisites

- **Permissions.** The session runs in the `auto` or `acceptEdits` permission mode with a Bash allowlist covering `git`, `node ${CLAUDE_PLUGIN_ROOT}/scripts/*` and the components' commands (`build`, `test`, `lint`, `prepare`, `handoff`, `demo`). Otherwise every subagent stops at its first prompt: say so and stop before the first step.
- **A manifest** with every role's model and a `CLAUDE.md` per component (no `missingFile`).

A dirty working tree is not a blocker (**Where commits go**).

## Lane choice

On a free request with no lane forced, spawn one `Explore` subagent (`models.explorer`, description `explorer · lane {short request}`), read-only: the area, the components and files touched, any new business rule or entity. Then:

- **Fastlane** when it touches one component (or the api and its regenerated client) **and** adds no business rule or entity.
- **Feature** otherwise.

Its reason, in one line, opens the report.

## Pipeline

Every step is one call of the Agent tool: `subagent_type: general-purpose`, `run_in_background: false`, `model:` the role's model, a description starting with the role and the step (`planner · spec live-sessions`, `implementer · stage 2 web`). The prompt, in the caveman voice: read `${CLAUDE_PLUGIN_ROOT}/skills/{skill}/SKILL.md` and follow it as if the person had typed the prompt given, ending with ` — autonomous`; end with this report:

- commits made (hash, subject);
- the `Spec:` line of each;
- Business decisions (question, answer, reason);
- the number of Technical defaults;
- the items marked `[-]`;
- blockers and points left open.

The orchestrator never opens the files a report names.

### Fastlane

One subagent (`models.implementer`): `/selo-flow:implement {request} — autonomous` (plus ` — without browser test`). It codes, updates the spec, reviews, runs the full suites and the demo browser test, and commits.

When it finds a business rule or an entity the lane choice missed, it stops before committing and says so: run the feature lane on the same request, and say it in the report's first line.

### Feature lane

1. **Spec** (`models.planner`): `/selo-flow:write-spec {request} — autonomous`. The subagent runs `grill-me`, skipped when the request already carries its decisions (ids cited, rules stated one by one). Ends with the spec committed, new FRs `(planned)`. Stop here on ` — until spec`.
2. **Plan** (`models.planner`): `/selo-flow:write-plan {slug} — autonomous`. Ends with the plan committed; its report gives the plan folder and the stages. Stop here on ` — until plan`.
3. **Stages** (`models.implementer`), one subagent per stage, in `stages` order, starting at the first stage of Progress with unchecked steps: `/selo-flow:implement {plan folder} — stage {N} ({component}) — autonomous` (plus ` — without browser test`). The next starts only once the report names the stage's commit (with its handoff file, if any). The last stage also runs the review, the full suites and the demo browser test, as `implement` says.

A subagent that had no Agent tool skipped the review: spawn `reviewer` (`models.reviewer`) on the work's commits, and on findings one more `implement` subagent: `/selo-flow:implement fix findings of the review of {commits} — autonomous`, committed as `fix({slug}): review — {summary}`.

## Report

To the person, in `language.chat`, normal prose:

1. The lane and why, one line (and the switch, if any).
2. **Business decisions**, at most five, from the reports.
3. The `Spec:` lines of the run's commits, from the reports (other sessions share the branch: no `git log` range).
4. The items marked `[-]`.
5. The points left open.
6. The done footer, one line per commit of the run.

After ` — until spec` or ` — until plan`, the next prompt: `/selo-flow:autopilot {slug}`.

## Stop

The run stops only on a real blocker reported by a subagent: a suite still red after its fix attempt (foreign failures are `[-]`), a broken build, a question with no defensible answer, a plan that contradicts its Progress, a file held by another session past the five-minute wait. No second subagent on the same step.

On a stop: report the step and the error or open questions as given; revert nothing; say that the same command resumes at Progress (`/selo-flow:autopilot {plan folder}`, or the slug once the spec exists). The done footer lists the commits made before the stop; none if nothing was committed.

## Rules

- Never a question to the person: every decision belongs to a subagent.
- The hard rules hold through every subagent: never push, never run `integration_tests`.
- A report that pastes a file is summarised, never acted on line by line.
