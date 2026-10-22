---
name: autopilot
description: "Take a free request, or a committed blueprint, to finished work with no question asked. Reads the code, then picks the fastlane (one fastlane run) or the blueprint lane (blueprint, then build: stages, review, browser test, spec merged), each step a fresh subagent. — fastlane / — blueprint force the lane; — until blueprint stops once the blueprint is committed; — no browser skips the browser test. In a worktree, stops ready to land and asks the one yes of the landing."
---

# Autopilot

The session is the orchestrator: it runs the steps one after another, each as a fresh subagent, and reads only their reports. It never reads or writes the project's code, never asks the person (the landing of a worktree aside), and stops only on a real blocker.

Read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` first, then the manifest: `models` (one per role), `stages`, `baseBranch`, each component's `url` and `commands.demo`.

## Input

`/selo:autopilot {input}`:

- **A free request**: the lane is chosen first.
- **A blueprint** `.planning/blueprints/{file}`: the blueprint lane from its build, resumed at Progress. An untracked one is a draft: committed as it stands (`docs({name}): blueprint — {summary}`), then built. `Spec merged` ticked: done, say so and stop. A `Legacy:` line: a 1.0 plan, never built: say so and stop.
- **A 1.0 project** (the rules' **A 1.0 project**): say so and give `/selo:setup update`.

Options, at the end of the prompt:

- ` — fastlane` / ` — blueprint`: force the lane of a free request.
- ` — until blueprint`: stop once the blueprint is committed. Implies the blueprint lane.
- ` — no browser`: passed on to every `fastlane` and `build` step. Otherwise the last stage runs the browser test, as the rules' **Three lanes** says.

## Prerequisites

- **Permissions.** The session runs in the `auto` or `acceptEdits` permission mode with a Bash allowlist covering `git`, `node ${CLAUDE_PLUGIN_ROOT}/scripts/*` and the components' commands (`build`, `test`, `lint`, `prepare`, `handoff`, `demo`, `serve`). Otherwise every subagent stops at its first prompt: say so and stop before the first step.
- **A manifest** with every role's model and a `CLAUDE.md` per component (no `missingFile`).

A dirty working tree is not a blocker (**Where commits go**).

## Lane choice

On a free request with no lane forced, spawn one `Explore` subagent (`models.explorer`, description `explorer · lane {short request}`), read-only: the pages, domain sheets and components touched, any new page, entity or business rule. Then, as the rules' **Three lanes** says:

- **Fastlane** when it touches one page or one component **and** adds no page, entity or business rule.
- **Blueprint** otherwise.

Its reason, in one line, opens the report.

## Pipeline

Every step is one call of the Agent tool: `subagent_type: general-purpose`, `run_in_background: false`, `model:` the role's model, a description starting with the role and the step (`planner · blueprint due-date`, `implementer · build due-date`). The prompt, in the caveman voice: read `${CLAUDE_PLUGIN_ROOT}/skills/{skill}/SKILL.md` and follow it as if the person had typed the prompt given, ending with ` — autonomous`; end with this report:

- commits made (hash, subject);
- the `Spec:` line of each;
- Business decisions (question, answer, reason), those taken during the build first;
- the number of Technical defaults;
- what was not run, and why;
- blockers and points left open.

The orchestrator never opens the files a report names, the blueprint's Progress aside.

### Fastlane

1. One subagent (`models.implementer`): `/selo:fastlane {request} — autonomous` (plus ` — no browser`). It codes, updates the spec, runs the full suites and the browser test, and commits.
2. When it says it skipped the review (no Agent tool): spawn `reviewer` (`models.reviewer`) on the commits it made, and on findings one more subagent: `/selo:fastlane fix findings of the review of {commits}: {findings} — autonomous`, committed as `fix({page}): review — {summary}`.

When it finds a new page, entity or business rule the lane choice missed, it stops before committing and says so: run the blueprint lane on the same request, and say it in the report's first line.

### Blueprint lane

1. **Blueprint** (`models.planner`): `/selo:blueprint {request} — autonomous`. It runs `grill` in autonomous mode, skipped when the request already carries its decisions. Ends with the blueprint committed; its report gives the path and the stages. Stop here on ` — until blueprint`.
2. **Build** (`models.implementer`): `/selo:build {blueprint} — autonomous` (plus ` — no browser`): every stage chained, one commit each. When it reports `review needed` (no Agent tool): spawn `reviewer` (`models.reviewer`) on the blueprint's work, as `review` scopes it, then run the build again with ` — review: {findings}` (` — review: none` for a clean review): it fixes, runs the full suites and the browser test, and merges the delta.

## Worktree landing

On a branch other than `baseBranch`, the last step stops ready to land (synced; for a blueprint, the delta merged and the full suites run again). The orchestrator ends its turn with the landing of the rules' **Where commits go**, step 3: the branch and its commits, the decisions taken during the build first, the Business decisions, the final `Spec:` line, and the exact message of the one commit in a code block, as the last text of the turn. On the person's yes, it runs step 4 itself (the squash from the checkout that holds `baseBranch`), then the done footer.

## Report

To the person, in `language.chat`, normal prose:

1. The lane and why, one line (and the switch, if any).
2. **Business decisions**, at most five, from the reports, those taken during the build first.
3. The `Spec:` lines of the run's commits, from the reports (other sessions may share the branch: no `git log` range).
4. What was not run, and why.
5. The points left open.
6. The landing question in a worktree; else the done footer, one line per commit of the run.

After ` — until blueprint`, the next prompt: `/selo:autopilot {blueprint}`.

## Stop

The run stops only on a real blocker reported by a subagent: a suite still red after its fix attempt, a broken build, a question with no defensible answer, a merge `conflict` or `missing` line, a blueprint that contradicts its Progress, a file held by another session past the five-minute wait. No second subagent on the same step.

On a stop: report the step and the error or open questions as given; revert nothing; say that `/selo:autopilot {blueprint}` resumes at Progress once the blueprint exists (a fastlane stop: the same request again). The done footer lists the commits made before the stop; none if nothing was committed.

## Rules

- Never a question to the person, the landing's yes aside: every decision belongs to a subagent.
- The hard rules hold through every subagent: never push, never run `integration_tests`.
- A report that pastes a file is summarised, never acted on line by line.
