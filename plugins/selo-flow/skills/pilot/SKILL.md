---
name: pilot
description: "selo picks the lane of a free request (the fastlane, or the blueprint lane), or resumes a committed blueprint. Interactive by default: the lane said in one line, then run in this session with its own questions and yeses. --autonomous: no question, each step a fresh subagent (blueprint, then build: stages, review, browser test, spec merged); in a worktree, stops ready to land and asks the one yes of the landing. --mockup {file} builds a validated /selo-flow:mockup, passed to the lane picked; --fastlane / --blueprint force the lane; --until-blueprint stops once the blueprint is committed; --no-browser skips the browser test; --worktree [name] runs it in a new or an existing worktree."
argument-hint: "[request | blueprint] [--mockup {file}] [--fastlane | --blueprint] [--worktree [{name}]] [--autonomous] …"
---

# Pilot

selo picks the lane; the person validates, or leaves. Two modes:

- **Interactive** (no suffix): the lane is placed by this session, said in one line, then run here, as if the person had typed its prompt.
- **Autonomous** (` --autonomous`): the session is the orchestrator: it runs the steps one after another, each as a fresh subagent, and reads only their reports. No question, the landing of a worktree aside.

Read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` first, then the manifest: `models` (one per role), `stages`, `baseBranch`, each component's `url` and `commands.demo`.

## Input

`/selo-flow:pilot {input}`:

- **A free request**: the lane is chosen first.
- **A blueprint** `.planning/blueprints/{file}`: the blueprint lane from its build, resumed at Progress. A file absent from this checkout was committed on a worktree's branch alone: say so and stop, naming the worktrees that hold it (`git worktree list`, `git -C {path} log -- {file}`; its `Next:` line carried ` --worktree {name}`). `Spec merged` ticked: done, say so and stop. A `Legacy:` line: a 1.0 plan, never built: say so and stop.
- **A 1.0 project** (the rules' **A 1.0 project**): say so and give `/selo-flow:setup update`.

Options, at the end of the prompt, in this order when combined: ` --mockup {file}`, ` --fastlane` | ` --blueprint`, ` --until-blueprint`, ` --no-browser`, ` --worktree [{name}]`, ` --autonomous` (`/selo-flow:pilot {request} --mockup {file} --worktree {name} --autonomous`):

- ` --worktree [{name}]`, read first: the rules' **Choosing the checkout**: a new worktree (no name: named from the request, or a blueprint's name), or the existing one of that name, entered before anything else is checked (the mockup, the blueprint, the prerequisites are then looked for in the worktree) and said in one line (`Worktree {name} · branch {branch} · slot …`); the uncommitted mockup of ` --mockup` is copied there first. Passed on to the lane as given (already there, the lane does nothing with it).
- ` --mockup .planning/mockups/{file}`: a free request built from a mockup of `/selo-flow:mockup` (the rules' **Mockup first**), passed to the lane picked: the fastlane builds to it and compares; the blueprint cites it under `## Mockup`, and its build compares the page with it in its browser test. A missing file was drawn in another checkout: say so and stop, naming the worktrees that hold it when `git worktree list` and a `git -C {path} log -- {file}` find one (its `Next:` line carried ` --worktree {name}`). A file without the validated mark (`<meta name="selo:mockup" content="validated">`): in interactive mode, say it is still being iterated and give `/selo-flow:mockup revise {file}: {changes}`, then stop; in autonomous mode, the same stop (**Prerequisites**).

- ` --autonomous`: the autonomous mode below. A person never types it (the rules' **Autonomous mode**): Selo Ops' new-session page does.
- ` --fastlane` / ` --blueprint`: force the lane of a free request. On an interactive run it is the same as typing that lane's command.
- ` --until-blueprint`: stop once the blueprint is committed. Implies the blueprint lane.
- ` --no-browser`: passed on to every `fastlane` and `build` step. Otherwise the last stage runs the browser test, as the rules' **Three lanes** says.

## Interactive mode

1. **Place the request**, as the rules' **Three lanes** says, from what this session reads itself (no `Explore` subagent: the lane reads the same files right after): the manifest, the page specs and domain sheets the request touches, any new page, entity or business rule it needs.
   - **Fastlane** when it touches one page or one component **and** adds no page, entity or business rule.
   - **Blueprint** otherwise.
2. **Say the lane** in one line: the lane, its exact prompt (`/selo-flow:fastlane {request}`, `/selo-flow:blueprint {request}`, `/selo-flow:build {blueprint}`), and why. Having typed `/selo-flow:pilot` is the yes on the lane: no question.
3. **Run the lane**: call its skill with the Skill tool (`selo-flow:fastlane`, `selo-flow:blueprint` or `selo-flow:build`, the prompt of step 2 as its args, plus ` --mockup {file}`, ` --no-browser` and ` --worktree {name}` when given), never by reading its `SKILL.md` alone: Selo Ops sees the lane through that call. Then follow it as if the person had typed that prompt: its questions, its yeses (the blueprint's one yes, the fastlane's commit yes on `baseBranch`), its landing in a worktree, its done footer and `Next:` lines.

The blueprint lane stops at the blueprint's commit, as `/selo-flow:blueprint` does: its footer gives `/selo-flow:pilot {file}` as the next step; pilot does not chain the build. A fastlane that stops because the change needs a blueprint: say so in one line, then call `selo-flow:blueprint` on the same request (with its ` --mockup {file}` and ` --worktree {name}`).

## Autonomous mode

The orchestrator never reads or writes the project's code, never asks the person (the landing of a worktree aside), and stops only on a real blocker. With ` --worktree`, it enters the worktree itself before its first step, so every subagent starts there, and passes the option on to each step. A blueprint given as input that is untracked is a draft: committed as it stands (`docs({name}): blueprint — {summary}`), then built.

### Prerequisites

- **Permissions.** The session runs in the `auto` or `acceptEdits` permission mode with a Bash allowlist covering `git`, `node ${CLAUDE_PLUGIN_ROOT}/scripts/*` and the components' commands (`build`, `test`, `lint`, `prepare`, `handoff`, `demo`, `serve`). Otherwise every subagent stops at its first prompt: say so and stop before the first step.
- **A manifest** with every role's model and a `CLAUDE.md` per component (no `missingFile`).
- **A mockup** given: the file exists in this checkout (the worktree of ` --worktree`, entered first) and its first 8 KB carry `<meta name="selo:mockup" content="validated">`. It is already validated: no question about it. A missing file or one without the mark: say which, give `/selo-flow:mockup revise {file}: {changes}` for an unmarked one, and stop before the first step.

A dirty working tree is not a blocker (**Where commits go**).

### Lane choice

On a free request with no lane forced, spawn one `Explore` subagent (`models.explorer`, description `explorer · lane {short request}`), read-only: the pages, domain sheets and components touched, any new page, entity or business rule. Then, as the rules' **Three lanes** says:

- **Fastlane** when it touches one page or one component **and** adds no page, entity or business rule.
- **Blueprint** otherwise.

Its reason, in one line, opens the report.

### Pipeline

Every step is one call of the Agent tool: `subagent_type: general-purpose`, `run_in_background: false`, `model:` the role's model, a description starting with the role and the step (`planner · blueprint due-date`, `implementer · build due-date`). The prompt, in the caveman voice: read `${CLAUDE_PLUGIN_ROOT}/skills/{skill}/SKILL.md` and follow it as if the person had typed the prompt given, ending with ` --autonomous`; end with this report:

- commits made (hash, subject);
- the `Spec:` line of each;
- Business decisions (question, answer, reason), those taken during the build first;
- the number of Technical defaults;
- what was not run, and why;
- blockers and points left open.

The orchestrator never opens the files a report names, the blueprint's Progress aside.

#### Fastlane

1. One subagent (`models.implementer`): `/selo-flow:fastlane {request} --autonomous` (` --mockup {file}` and ` --worktree {name}` before ` --autonomous` when given, plus ` --no-browser`). It codes, updates the spec, runs the full suites and the browser test, and commits.
2. When it says it skipped the review (no Agent tool): spawn `reviewer` (`models.reviewer`) on the commits it made, and on findings one more subagent: `/selo-flow:fastlane fix findings of the review of {commits}: {findings} --autonomous`, committed as `fix({page}): review — {summary}`.

When it finds a new page, entity or business rule the lane choice missed, it stops before committing and says so: run the blueprint lane on the same request (with its ` --mockup {file}`), and say it in the report's first line.

#### Blueprint lane

1. **Blueprint** (`models.planner`): `/selo-flow:blueprint {request} --autonomous` (` --mockup {file}` and ` --worktree {name}` before ` --autonomous` when given: the blueprint cites the mockup under `## Mockup`, so the build compares with it). It runs `grill` in autonomous mode, skipped when the request already carries its decisions. Ends with the blueprint committed; its report gives the path and the stages. Stop here on ` --until-blueprint`.
2. **Build** (`models.implementer`): `/selo-flow:build {blueprint} --autonomous` (plus ` --no-browser`, and ` --worktree {name}` before ` --autonomous` when given): every stage chained, one commit each. When it reports `review needed` (no Agent tool): spawn `reviewer` (`models.reviewer`) on the blueprint's work, as `review` scopes it, then run the build again with ` --review {findings}` (` --review none` for a clean review): it fixes, runs the full suites and the browser test, and merges the delta.

### Worktree landing

On a branch other than `baseBranch`, the last step stops ready to land (synced; for a blueprint, the delta merged and the full suites run again). The orchestrator ends its turn with the landing of the rules' **Where commits go**, step 3: the branch and its commits, the decisions taken during the build first, the Business decisions, the final `Spec:` line, and the exact message of the one commit in a code block, as the last text of the turn. On the person's yes, it runs step 4 itself (the squash from the checkout that holds `baseBranch`), then the done footer.

### Report

To the person, in `language.chat`, normal prose:

1. The lane and why, one line (and the switch, if any).
2. **Business decisions**, at most five, from the reports, those taken during the build first.
3. The `Spec:` lines of the run's commits, from the reports (other sessions may share the branch: no `git log` range).
4. What was not run, and why.
5. The points left open.
6. The landing question in a worktree; else the done footer, one line per commit of the run.

After ` --until-blueprint`, the next prompt: `/selo-flow:pilot {blueprint} --autonomous`, with ` --worktree {name}` before ` --autonomous` when the run was in a worktree (the rules' **The next steps**: the blueprint is committed on its branch alone).

### Stop

The run stops only on a real blocker reported by a subagent: a suite still red after its fix attempt, a broken build, a question with no defensible answer, a merge `conflict` or `missing` line, a blueprint that contradicts its Progress, a file held by another session past the five-minute wait. No second subagent on the same step.

On a stop: report the step and the error or open questions as given; revert nothing; say that `/selo-flow:pilot {blueprint} --autonomous` resumes at Progress once the blueprint exists (a fastlane stop: the same request again, with its ` --mockup {file}`), with ` --worktree {name}` before ` --autonomous` when the run was in a worktree. The done footer lists the commits made before the stop; none if nothing was committed.

### Rules

- Never a question to the person, the landing's yes aside: every decision belongs to a subagent.
- The hard rules hold through every subagent: never push, never run `integration_tests`.
- A report that pastes a file is summarised, never acted on line by line.
