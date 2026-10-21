# Rules shared by every selo-flow skill

Every skill reads this file first.

## The project

One repository, one application: `selo-flow.yaml` at the root, a `CLAUDE.md` at the root and one per component, and `.planning/`. The session opens at the root with the plugin loaded; every skill works on that project. Paths in prompts and reports start from the root; git runs there; a component's commands run inside its path (`cd {path} && …`). The plugin's files are read from `${CLAUDE_PLUGIN_ROOT}`.

A component with a `stack` has stack skills in `${CLAUDE_PLUGIN_ROOT}/stacks/{stack}/skills/`: read the one its `CLAUDE.md` names when its step comes. A component with a `skin`: before planning, coding or reviewing its UI, read `reference/ui-design.md`, `skins/README.md`, `skins/recipes.css` and `skins/{skin}/SKIN.md`; its `## Design` section wins.

Useful to two projects or more: the plugin. Specific to one project: its `CLAUDE.md` files, its manifest, its `.claude/skills/`.

## The manifest

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs` from the root and read the JSON: `name`, `baseBranch`, `language`, `models`, `components` (name, path, kind, stack, skin, layers, commands, handoff, needs, url, logins) and `stages`. A component with `missingFile` has no `CLAUDE.md`: send the person to `/selo-flow:init component {name}`. Never parse `selo-flow.yaml` yourself. A component's `CLAUDE.md` loads when you work under its path; read it yourself when you plan for it from elsewhere.

## The spec stays in sync

Every plan and every stage on a feature (any slug but `tooling` and `shared`) leaves the feature's `00_spec.md` matching the behaviour it plans or ships. Only `write-spec` writes it, in called mode, and the spec ships in the plan's or the stage's commit.

- **No spec yet:** propose to create it, derived from the plan or from the code and the request, and draft it only on the person's yes. A no is recorded once: in the plan's Decisions, or without a plan as a `Spec: declined by the person` line in the stage commit's body.
- **A spec:** a change of business behaviour (a user story, a functional requirement, a business rule) updates it. A change with no business effect (a refactor, a fix restoring the specified behaviour, a look) leaves it as it is.

## Where commits go

Work is committed on `baseBranch`: no feature branch, no squash. Several sessions share the checkout:

- commit in one command, naming the files this work wrote: `git add {new files} && git commit --only -m "{subject}" -m "{body}" -- {files}` (a second `-m` for the body, never `-F`: the board reads the subject from the command); `--only` leaves out what other sessions staged; never `-a`, `git add -A`, `git add .` or `--amend`;
- a file you must change that holds another session's uncommitted edits: do not write it; wait up to five minutes for that session's commit, else stop and name the file;
- a dirty tree is not a blocker;
- a suite that fails outside this work's files: list the files other sessions changed (`git status` minus this work's list), mark `- [-] Tests: foreign uncommitted changes in {files}`, do not investigate, commit; the last stage's full suites re-run it.

## Subagents

The session leads: it plans, decides, writes. Each subagent is spawned with its role's model from `models`:

- `reviewer`: every review, always a subagent (it has no stake in the code);
- `runner`: a command whose output floods the context (a full suite, a build, a lint run); it returns the errors with `file:line`;
- `Explore` (`models.explorer`): a broad search; for a task that needs judgment, `general-purpose` on `models.implementer`.

Put the role first in the spawn's description (`runner · web tests`). A spec, a plan or an implementation is not a subagent's job, except under `autopilot`. A subagent without the Agent tool runs its commands itself, filtered to the errors, and says what it could not delegate.

## Autonomous mode

Only `autopilot` turns it on, by ending a step's prompt with ` — autonomous`; a person never types it. No question: each takes its recommended answer, and each is recorded in the spec's or the plan's `## Decisions taken autonomously` (`- {question} → {answer taken} ({reason})`). A question with no defensible answer stops the step, with nothing committed. The hard rules hold.

## Language

Talk to the person in `language.chat`. Write everything in the repository in `language.repo`: code, identifiers, comments, contracts, tests, commit messages, plans, specs, instruction files. User-facing strings follow the application's own rules. Messages between agents use the caveman voice (`reference/caveman.md`); rewrite in normal prose what the person reads.

## Hard rules

- **Never push.** No `git push`, no publishing a branch. A human pushes.
- **Never run `integration_tests`** or a suite calling real external systems unless the person asked, in this session, naming them. "Check" or "why does this test fail" is not such a request: give the filtered command instead.
- **Silence is not approval.** A spec or a plan written with the person is committed only after their yes.

## Commits

`{type}({slug}): {summary}`, type in `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `tools`, `ops`, `chore`; a stage commit is `{type}({slug}): {stage} — {summary}`. The project's `docs/CONTRIBUTING.md` wins.

A commit that needs the person's yes shows its exact message (subject and body) in a code block, as the last text of the turn, in the same message as the question or the call that shows it (a next-step box with a yes button is fine); never a bare "Commit?". The yes approves the commit and its message. A commit made without a question (a stage) uses the subject announced beforehand: the plan's `Commit:` line, or the one stated before coding; when the work drifted, the report says the subject used and why.

## End of turn

End each workflow step with the next prompt(s), one code block each, real paths filled in, e.g. `/selo-flow:implement .planning/features/menu/dev-plans/20261001-093000-add-cutoff/`.

When the turn committed, end with the done footer, the very last lines; the board reads it, keep its shape:

```markdown
---
## ✅ JOB DONE
> {one line in language.chat, at most 120 characters, what the turn achieved, not the commit subject again}
`{short hash}` {subject} · branch `{branch}` · not pushed
```

A free request answered without a commit ends with the footer's recap line alone. No footer when the turn stops on a question, or on a failure before any commit; a stop after commits still ends with the footer.
