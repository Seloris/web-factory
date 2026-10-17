# The workflow

`flow.md` draws the whole path in one diagram.

Four phases, each a skill, chained as needed and usable in any session opened at a project's root with the plugin loaded (see `reference/workflow-rules.md`). The agents are thin wrappers around the skills for those who prefer a fixed role.

| Phase | Skill | Agent | Output |
|---|---|---|---|
| Spec | `write-spec` | `architect` | `.planning/features/{slug}/00_spec.md`: business-level PRD. The only writer of the spec. |
| Plan | `write-plan` | `architect` | `.planning/features/{slug}/dev-plans/{YYYYMMDD}-{HHmmss}-{type}-{name}/plan.md`, committed on the feature branch |
| Code | `implement` | `senior-dev` | from a plan or straight from a request: code + tests, verified, reviewed, one stage per session, one commit per stage |
| Review | `review` | `reviewer` (always a subagent) | ranked findings on code or on a plan, no edits |

`factory-init` comes first, once per project: it writes the manifest and the instruction files and, for a component whose stack pack ships a code skeleton, copies that skeleton into the empty folder so the first stage starts on green `build` and `test` commands. A front component gets a skin (`modern` by default, one of the plugin's `skins/`): its tokens copied into the component, its design rules read in place by every skill that plans, implements or reviews its UI, and the component's `## Design` section and `overrides.css` above both; `/factory:factory-init skin {component} {skin}` switches it. `grill-me` sits before a spec or a plan: an interview that settles every open decision, offered by `write-spec` and `write-plan`, never started on its own. The skills are invoked under the plugin's prefix: `/factory:write-spec`, `/factory:implement`…

## Default path

A development request (feature, change, bug fix) goes straight to `implement` without a plan. Planning is for large, risky or multi-stage changes, and only when the person asks for it. Questions are answered directly.

## Rules that hold everywhere

- **Never push.** Agents create branches and commits locally; a human pushes. `factory-init` writes the deny rule in the project's `.claude/settings.json`.
- **One stage per session.** A new session starts with a clean context; the plan's Progress checklist and the branch's commits say where to resume. The prompt names the stage (`/factory:implement {plan folder} — stage 2 (web)`); chaining the remaining stages in one session is asked in the prompt (`— stages 2-3 (web, e2e), chained`), still one commit per stage.
- **Review before every stage commit.** The `reviewer` agent, read-only, with no stake in the code.
- **Silence is not approval.** A spec or a plan is drafted in its file, summarised in chat in a few lines, and committed only after an explicit yes. That yes approves it: a spec is `Draft` until its first commit and `Approved` from then on.
- **Spec changes go through `write-spec`**, even from a plan or from code, and ship in the plan's or the stage's commit: a delta that restates the person's own request is applied without asking; a business change they did not ask for is proposed first.
- **Subagents are the lead's choice.** `runner` for a command whose output would flood the context (a full suite, a build), `Explore` for a broad search, inline for a quick command or a single read. Nothing blocks the lead; it reads a short report instead of raw output when that is cheaper.
- **Integration tests are never run unasked.** The lead gives the filtered command; it runs only on the person's explicit request, in the session.
- **Next prompts.** Every step ends with the prompt(s) of the next step, each in its own code block, real paths filled in.
- **Commit messages proposed before the commit.** Every request to approve a commit shows its exact message; a stage commit, made without asking, uses the subject the plan's Progress (or the approach) announced.
- **Done footer.** A turn that committed ends with `## ✅ JOB DONE` and one line per commit: hash, subject, branch, `not pushed`.
- **Language.** Agents speak to the person in `language.chat`; everything written to the repository is in `language.repo`. Messages between agents use the caveman voice; anything the person reads is rewritten in normal prose.

## Model tiering

The session model is the lead: it plans, decides and writes the code. High-volume mechanical work goes to cheaper subagents when the lead judges it worth it. Which model plays which role comes from the manifest's `models` preset (see `manifest.md`): a subagent is spawned with its role's model. The session's own model is the person's choice; the preset says which one each role is meant for.

## Validation of a plan

The plan's Validation checklist records the checks run on the finished implementation: `Review` (always), `Tests` (the full `test` command of every touched component that has one), `Browser test`, `Integration tests`. The last stage ticks what it ran: the whole-plan review, the full suites, the browser test if the person said yes. `implement … — final review` settles what is left: the review if still open, then the optional items, each run only on the person's yes in the session; a declined one is marked `[-]` with the reason. An unticked item means the check was not run.

## Closing a branch

A branch reaches `base_branch` as one commit. Stages keep their own commits while the work goes on; once every item of the plan's Validation checklist is ticked or marked `[-]` (or, without a plan, the last stage is committed), `implement … — close the branch` squashes them, on the person's yes, after checking that nothing is uncommitted, nothing is pushed and every commit is the feature's.

## Planning conventions

`.claude/rules/planning.md` (the project's, written by `factory-init` from the plugin's `templates/rules/`) defines the folder layout, the `plan.md` structure (one section per component touched, sub-divided by its `layers`, plus Context, Decisions, Conventions, Tests, Deviations, Progress, Validation), the reserved slugs `tooling` and `shared`, and the technical-debt file.
