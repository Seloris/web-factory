---
name: autopilot
description: "Run a feature from any point to developed code with no question to the person: spec (grill-me included), plan, every stage in the manifest's order, the final review, each as a fresh-context subagent on its role's model, each step committed. Starts from a free request, a feature slug with a spec, or a plan folder (resumed at its Progress). Stops only on a real blocker. Use when the person wants to launch one command and come back to a finished branch; stops after the spec or the plan with — until spec / — until plan."
---

# Autopilot

One command, no click until the feature is developed. The session is the orchestrator: it runs the workflow's steps one after another, each as a subagent with a fresh context, and reads only their reports. It never reads or writes the project's code itself, never asks the person, and stops only on a real blocker.

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first (the project, manifest, subagents, language, hard rules, autonomous mode), then the manifest: `models` (one per role), `stages`, `baseBranch`, each component's `url`.

## Input

`/selo-flow:autopilot {input}`, where what exists under `.planning/features/{slug}/` says where to start:

- **A free request** (text): spec → plan → stages → final review.
- **A slug** (or a feature folder) whose `00_spec.md` exists and has no plan folder yet: plan → stages → final review. A slug with a committed plan whose Progress is not finalized is that plan folder (the most recent one).
- **A plan folder** `.planning/features/{slug}/dev-plans/{…}/`: stages → final review, resumed at the plan's Progress: a ticked stage is never redone. An untracked `plan.md` is a draft: in autonomous mode it is committed as it stands, then implemented.

Options, at the end of the prompt, in the style of ` — with review`:

- ` — until spec`: stop once the spec is committed. ` — until plan`: stop once the plan is committed.
- ` — with browser test`: the stages of a component with a `url` and the final review run `test-in-browser`; without it, `Browser test` is marked `[-]` (not run: autopilot without browser test).

## Prerequisites

- **Permissions.** The session runs with the `auto` or `acceptEdits` permission mode and a Bash allowlist covering the components' commands (`build`, `test`, `lint`, `prepare`, `handoff`, `serve` with ` — with browser test`) and `git`. Otherwise every subagent stops at its first prompt: say so to the person before the first step and stop.
- **Branch.** `implement`'s rule, taken without asking: the current branch when it holds the feature's commits; otherwise a new `{type}/{slug}-{name}` (`feat/{slug}` for a spec started first, see `planning.md`) cut from the base branch. A dirty working tree on the base branch stops the pipeline before the first step.
- **A manifest** with every role's model and a `CLAUDE.md` per component (no `missingFile`).

## Pipeline

Every step is one call of the Agent tool, `subagent_type: general-purpose`, `run_in_background: false`, `model:` the role's model from the manifest. The prompt is in the caveman voice and tells the subagent to read the skill's `SKILL.md` under `${CLAUDE_PLUGIN_ROOT}/skills/` and follow it as if the person had typed the prompt given, with ` — autonomous`, and to end with its report: the commit made (hash, subject), the branch, the paths written, its `Decisions taken autonomously`, the items marked `[-]`, and what is left open or blocked. The orchestrator keeps the reports only; it never opens the files a report names.

1. **Spec** (`models.planner`): `/selo-flow:write-spec {request} — autonomous` (the subagent runs `grill-me` itself, in autonomous mode). Ends with `docs({slug}): spec — {summary}` committed on the feature branch. Stop here on ` — until spec`.
2. **Plan** (`models.planner`): `/selo-flow:write-plan {slug} — autonomous`. Ends with `docs({slug}): plan {type}-{name}` committed; its report gives the plan folder and the stages. Stop here on ` — until plan`.
3. **Stages** (`models.implementer`), one subagent per stage, in the manifest's order, starting at the first stage of Progress with unchecked steps: `/selo-flow:implement {plan folder} — stage {N} ({component}) — with review — autonomous`, plus ` — with browser test` when the pipeline carries it. Each ends with its stage commit, the subject of the plan's Progress. The next subagent starts only once the report names that commit: a stage with a `handoff` is committed with its file before the next stage runs its `prepare`.
4. **Final review** (`models.implementer`): `/selo-flow:implement {plan folder} — final review — autonomous` (same ` — with browser test`): the review by `reviewer`, the full suites by `runner`, `Browser test` per the option, `Integration tests` always `[-]`. Ends with `fix({slug}): review — …` or `chore({slug}): validation — …`. Skipped when the last stage already finalized the plan with every Validation item settled.
5. **Report** to the person, in `language.chat`, normal prose: the branch; the commits (`git log {base}..HEAD --oneline`, with `base=$(git merge-base {baseBranch} HEAD)`); the spec and plan paths; every decision taken alone, gathered from the reports' `Decisions taken autonomously` (question, answer, reason); the items marked `[-]`; the points left open. Then the squash as a next prompt, never run: `/selo-flow:implement {plan folder} — close the branch`, and `/selo-flow:retro` (the pipeline's lessons, from the reports). Then the done footer, one line per commit of the pipeline. Never push.

The subagents spawn `reviewer` and `runner` themselves (they are spawned with the full tool set). A subagent whose report says it had no Agent tool ran its commands itself and skipped the review: the orchestrator then spawns `reviewer` (`models.reviewer`) on that stage's commit, and on findings one more subagent, `/selo-flow:implement fix findings of the review of {commit} on {plan folder} — autonomous` (`models.implementer`), committed as `fix({slug}): review — {summary}`.

## Stop

The pipeline stops only on a real blocker reported by a subagent: a suite still red after its one fix attempt, a broken build, a `grill-me` question with no recommendation possible, a plan that contradicts its Progress, a working tree it cannot commit. No retry beyond the subagent's own fix attempt, no second subagent on the same step.

On a stop: report the step, the error or the open questions as the subagent gave them, in normal prose; leave the branch as it is (the commits made stay, nothing is reverted); say that the same command resumes where the Progress is (`/selo-flow:autopilot {plan folder}`, or the slug once the spec exists). No done footer on a stop that followed no commit; otherwise one line per commit made before it.

## Rules

- Never a question to the person, never a `Decisions` round in this session: every decision belongs to the step's subagent, recorded in its `Decisions taken autonomously`.
- The hard rules hold through every subagent: never push, never run `integration_tests`, never squash (proposed as a prompt only), commits with the subject announced beforehand.
- One subagent at a time: a stage reads the previous stage's commit and handoff file.
- The orchestrator's context holds reports, not code: a report that pastes a file is summarised, never acted on line by line.
