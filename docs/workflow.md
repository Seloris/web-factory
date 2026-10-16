# The workflow

Four phases, each a skill, chained as needed and usable in any session. The agents are thin wrappers around the skills for those who prefer a fixed role.

| Phase | Skill | Agent | Output |
|---|---|---|---|
| Spec | `write-spec` | `architect` | `.planning/features/{slug}/00_spec.md`: business-level PRD. The only writer of the spec. |
| Plan | `write-plan` | `architect` | `.planning/features/{slug}/dev-plans/{YYYYMMDD}-{HHmmss}-{type}-{name}/plan.md`, committed on the feature branch |
| Code | `implement` | `senior-dev` | from a plan or straight from a request: code + tests, verified, reviewed, one stage per session, one commit per stage |
| Review | `reviewer` | `reviewer` (always a subagent) | ranked findings on code or on a plan, no edits |

`grill-me` sits before a spec or a plan: an interview that settles every open decision, offered by `write-spec` and `write-plan`, never started on its own.

## Default path

A development request (feature, change, bug fix) goes straight to `implement` without a plan. Planning is for large, risky or multi-stage changes, and only when the person asks for it. Questions are answered directly.

## Rules that hold everywhere

- **Never push.** Agents create branches and commits locally; a human pushes. `init` writes the deny rule in `.claude/settings.json`.
- **One stage per session.** A new session starts with a clean context; the plan's Progress checklist and the branch's commits say where to resume.
- **Review before every stage commit.** The `reviewer` agent, read-only, with no stake in the code.
- **Silence is not approval.** A spec or a plan is drafted in its file, summarised in chat in a few lines, and committed only after an explicit yes.
- **Spec changes go through `write-spec`**, even from a plan or from code: a delta that restates the person's own request is applied without asking; a business change they did not ask for is proposed first.
- **Mechanical work goes to `runner`.** Builds, tests, lint, package restores and repo-wide shell searches are blocked in the lead session by a hook; the lead reads the runner's report, never the raw output.
- **Integration tests are never run unasked.** The lead gives the filtered command; it runs only on the person's explicit request, through `runner`, quoting that request.
- **Next prompts.** Every step ends with the prompt(s) of the next step, each in its own code block, real paths filled in.
- **Done footer.** A turn that committed ends with `## ✅ JOB DONE` and one line per commit: hash, subject, branch, `not pushed`.
- **Language.** Agents speak to the person in `language.chat`; everything written to the repository is in `language.repo`. Messages between agents use the caveman voice; anything the person reads is rewritten in normal prose.

## Model tiering

The session model is the lead: it plans, decides and writes the code. High-volume mechanical work goes to cheaper subagents. Which model plays which role comes from the manifest's `models` preset (see `manifest.md`). Each planning or coding skill starts with a *model guard*: if the session is not on the role's model, the skill delegates to the matching agent on that model, or asks the person to switch sessions.

## Closing a branch

A branch reaches `base_branch` as one commit. Stages keep their own commits while the work goes on; once the plan's Validation checklist is all ticked (or, without a plan, the last stage is committed), `implement … — close the branch` squashes them, on the person's yes, after checking that nothing is uncommitted, nothing is pushed and every commit is the feature's.

## Planning conventions

`.claude/rules/planning.md`, written by `init` into each project, defines the folder layout, the `plan.md` structure (one section per component touched, sub-divided by its `layers`, plus Context, Decisions, Conventions, Tests, Deviations, Progress, Validation), the reserved slugs `tooling` and `shared`, and the technical-debt file.
