# Rules shared by every factory skill

Every skill reads this file first.

## The project

One repository, one application: `factory.yaml` at the root, a `CLAUDE.md` at the root and one per component, and `.planning/`. Paths in prompts and reports start from the root; git runs there; a component's commands run inside its path (`cd {path} && …`). The plugin's files are read from `${CLAUDE_PLUGIN_ROOT}`.

A component with a `stack` has stack skills in `${CLAUDE_PLUGIN_ROOT}/stacks/{stack}/skills/`: read the one its `CLAUDE.md` names when its step comes. A component with a `skin`: before planning, coding or reviewing its UI, read `reference/ui-design.md`, `skins/README.md`, `skins/recipes.css` and `skins/{skin}/SKIN.md`; its `## Design` section wins.

## The manifest

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs` from the root and read the JSON: `name`, `baseBranch`, `language`, `models`, `components` (name, path, kind, stack, skin, layers, commands, handoff, needs, url, demoUrl, logins) and `stages`. A component with `missingFile` has no `CLAUDE.md`: send the person to `/factory:factory-init component {name}`. Never parse `factory.yaml` yourself.

## Two lanes

- **Fastlane:** a request without a plan. `implement {request}`, or `autopilot {request}` when the request touches one component (or the api and its regenerated client) and creates no business rule or entity. One commit per component touched.
- **Feature:** spec, plan, stages, one review at the end. `write-spec`, `write-plan`, then `implement` or `autopilot`. `autopilot` reads the code before choosing; `— fastlane` or `— with plan` forces the lane. A fastlane that finds a new rule or entity switches to the feature lane and says so.

Both lanes end the same way: the review, the full suites of the touched components (through `runner`), the browser test on the demo when a touched component has `url` and `commands.demo` (`— without browser test` skips it), the commit(s).

## The spec follows the code

`.planning/features/{slug}/` is an **area** of the application; its `00_spec.md` says how that area behaves today, in the present tense. Only `write-spec` writes it.

Every change of behaviour names its area and updates its spec in the same commit as the code:

- a delta that restates the person's request: applied, no question;
- an area with no spec: a three-line spec is created (TL;DR, one FR per behaviour touched), no question;
- no area fits: one FR in the nearest area, said in the report;
- a behaviour the person did not ask for: interactive, one grouped question at the end of the work; autonomous, applied and listed first under Business decisions;
- a refactor, a look, a fix restoring the specified behaviour, `tooling`, `shared`: no spec change.

A new FR not built yet is marked `(planned)`; the stage that builds it removes the mark. A replaced FR is deleted and its id added to the `Retired:` line. Every commit that touches code carries a `Spec:` line in its body, `Spec: {slug} +FR-48 ~FR-13 -FR-07` or `Spec: none ({reason})`; run `node ${CLAUDE_PLUGIN_ROOT}/scripts/spec-check.mjs {slug}` before the commit (duplicate, retired or missing ids; at the end of a plan, FRs still `(planned)`) and use the next free id it gives.

## Where commits go

Work is committed on `baseBranch`; no feature branch, no squash. Several sessions share the checkout:

- commit in one command, naming the files this work wrote: `git add {new files} && git commit --only -m "{subject}" -m "{body}" -- {files}` (a second `-m` for the body, never `-F`: the board reads the subject from the command); `--only` leaves out what other sessions staged; never `-a`, `git add -A`, `git add .` or `--amend`;
- a file you must change that holds another session's uncommitted edits: do not write it; wait up to five minutes for that session's commit, else stop and name the file;
- a dirty tree is not a blocker;
- a suite that fails outside this work's files: list the files other sessions changed (`git status` minus this work's list), mark `- [-] Tests: foreign uncommitted changes in {files}`, do not investigate, commit; the last stage's full suites re-run it.

## Subagents

The session leads: it plans, decides, writes. Each subagent is spawned with its role's model from `models`:

- `reviewer`: every review, always a subagent;
- `runner`: a command whose output floods the context (a full suite, a build, a lint run); it returns the errors with `file:line`;
- `Explore` (`models.explorer`): a broad search.

Put the role first in the spawn's description (`runner · web tests`). A spec, a plan or an implementation is not a subagent's job, except under `autopilot`.

## Autonomous mode

Only `autopilot` turns it on, by ending a step's prompt with ` — autonomous`. No question: each takes its recommended answer. In every mode, decisions are recorded in two lists, in the plan (in the fastlane, in the commit body and the report): **Business decisions** (at most five: a rule, a label, a scope the person would want to check) and **Technical defaults** (the rest, one line each). A question with no defensible answer stops the step, with nothing committed. The hard rules hold.

## Language

Talk to the person in `language.chat`. Write everything in the repository in `language.repo`. Messages between agents use the caveman voice (`reference/caveman.md`); rewrite in normal prose what the person reads.

## Hard rules

- **Never push.** No `git push`, no publishing a branch. A human pushes.
- **Never run `integration_tests`** unless the person asked, in this session, naming them. Give the filtered command instead.
- **Silence is not approval.** A spec or a plan written with the person is committed only after their yes.

## Commits

`{type}({slug}): {summary}`, type in `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `tools`, `ops`, `chore`; a stage commit is `{type}({slug}): {stage} — {summary}`. The project's `docs/CONTRIBUTING.md` wins.

A commit that needs the person's yes shows its exact message (subject and body) in a code block, as the last text of the turn, with the question. A commit made without a question (a stage, the fastlane) uses the subject announced beforehand: the plan's `Commit:` line, or the one stated before coding.

## End of turn

End each workflow step with the next prompt(s), one code block each, real paths filled in.

When the turn committed, end with the done footer, the very last lines; the board reads it, keep its shape:

```markdown
---
## ✅ JOB DONE
> {one line, at most 120 characters, what the turn achieved}
`{short hash}` {subject} · `{branch}` · not pushed
```

A free request answered without a commit ends with the footer's recap line alone. No footer when the turn stops on a question, or on a failure before any commit; a stop after commits still ends with the footer.
