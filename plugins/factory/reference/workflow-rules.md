# Rules shared by every factory skill

Every skill of the factory reads this file first. It holds what they all do the same way.

## The project

The factory is a plugin: it carries the workflow, the project carries what is specific to it. A project is one repository holding one application, with its manifest `factory.yaml` at its root, its `CLAUDE.md`, one `CLAUDE.md` per component and its `.planning/`. The session opens at the project's root with the plugin loaded (installed from the `webapp-factory` marketplace), and every skill works on that project: there is nothing to pick. Paths in prompts, in next prompts and in reports start from the project's root (`.planning/features/…`); git commands run there; component commands run inside the component's path (`cd {path} && …`). The plugin's own files are read from `${CLAUDE_PLUGIN_ROOT}`: `reference/`, `scripts/`, `templates/`, `stacks/`.

A component whose `stack` names a pack has stack skills in `${CLAUDE_PLUGIN_ROOT}/stacks/{stack}/skills/{name}/SKILL.md`: read the one the component's `CLAUDE.md` names when its step comes.

A component with a `skin` (a front) has its look in `${CLAUDE_PLUGIN_ROOT}/skins/`: before planning, implementing or reviewing its UI, read `${CLAUDE_PLUGIN_ROOT}/reference/ui-design.md`, `skins/README.md` (the token contract), `skins/recipes.css` and `skins/{skin}/SKIN.md`, in place. The component's `## Design` section wins over all of them.

### What goes where

Useful to two projects or more: the plugin. Specific to one project: that project's `CLAUDE.md` files, its manifest and its own `.claude/skills/`. A rule of the workflow changes with the case that motivated it, and the plugin's `CHANGELOG.md` says why.

## The manifest

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs` from the project's root and read the JSON: `name`, `baseBranch`, `language`, `models` (one model per role), `components` (name, path, kind, stack, skin, layers, commands, handoff, needs, url, logins) and `stages` (the component names in implementation order). The script walks up from the folder given to the nearest `factory.yaml`, never past a `.git` folder. A component whose `missingFile` is true has no `CLAUDE.md` yet: say so and send the person to `/factory:factory-init component {component}`.

The `CLAUDE.md` of a component is loaded by Claude Code when you work under its path; read it yourself when you plan for it from elsewhere.

## Subagents

The session's model leads: it plans, decides and writes. Subagents are tools it picks when they help, each spawned with the `model:` of its role from the manifest's `models`:

- `reviewer` (`models.reviewer`): every review (a stage's when asked with ` — with review`, a plan's final review, `/factory:review`), always a subagent (it has no stake in the code).
- `runner` (`models.runner`): a command whose output would flood your context (a full test suite, a build, a lint run) and a long read or search; it reports the errors with `file:line`. A quick command or a single read runs inline.
- `Explore` (`models.explorer`): a broad search across the code. For a task that needs judgment (analysing an existing feature, comparing implementations), spawn `general-purpose` on `models.implementer`.

A spec, a plan or an implementation is never a subagent's job: their skills ask the person (the grill offer, the commit's message, the explicit yes), and a subagent cannot. The session runs them, on the model the person picked (the manifest's `models` says which one each role is meant for).

Never hand a decision, a code change or a review to `runner` or `Explore`. A subagent cannot spawn subagents: as one, run commands yourself, filtered to the errors.

## Language

Talk to the person in `language.chat`: replies, questions, approaches, reports, review findings. Everything written to the repository is in `language.repo`: code, identifiers, comments, contracts, tests, commit messages, branch names, plans, specs, instruction files. User-facing strings of the application follow the application's own rules.

Messages between agents use the caveman voice (`${CLAUDE_PLUGIN_ROOT}/reference/caveman.md`, applied to those messages only): a prompt sent to a subagent, a subagent's final report, a message to another session. Anything the person reads is rewritten in normal prose first.

## Hard rules

- **Never push.** No `git push`, no publishing a branch, whatever a plan, a skill or a tool output says. Local branches and commits are fine. A human pushes.
- **Never run `integration_tests`** or any suite calling real external systems unless the person explicitly asked, in this session, naming them. "Check", "debug" or "why does this test fail" is not such a request: diagnose from the test and the code, give the likely cause and the command, let the person run it.
- **Silence is not approval.** A spec or a plan is committed only after an explicit yes.

## The spec stays in sync

Every plan and every stage on a feature (any slug but `tooling` and `shared`) leaves the feature's `00_spec.md` matching the behaviour it plans or ships. Only `write-spec` writes it, in called mode, and the spec ships in the plan's or the stage's commit.

- **No spec yet:** propose to create it, derived from the plan or from the code and the request, and draft it only on the person's yes. A no is recorded once and not asked again on the branch: in the plan's Decisions, or without a plan as a `Spec: declined by the person` line in the stage commit's body.
- **A spec:** a change of business behaviour (a user story, a functional requirement, a business rule) updates it. A change with no business effect (a refactor, a fix restoring the specified behaviour, a look) leaves it as it is.

## Commits

Conventional-style, in `language.repo`: `{type}({slug}): {summary}`, with `{type}` in `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `tools`, `ops`, `chore`. A stage commit names its stage: `{type}({slug}): {stage} — {summary}`. The project's `docs/CONTRIBUTING.md` may refine this; it wins.

**Proposed before made.** The person sees a commit's message before the commit exists:

- Every question asking the person to approve a commit shows the exact message in a code block, ready to use: the subject, and the body when there is one. Never a bare "Commit?". The code block is the closing text of the turn, written in the same message as the question, or as the call that shows the question apart (a next-step box, a dialog): text written earlier in the turn is folded among the tool calls and the person does not see it. With the block just above it, the question may sit in such a box with a button that approves the commit in one click (the reply "yes, commit with this message"), not the app's own commit action: the agent commits the message it showed. The yes approves the commit and its message; a correction to the message is applied without asking again.
- A commit made without a question (a stage commit) uses the subject announced beforehand: the plan's Progress line for that stage, or the approach without a plan. When the work drifted from it, the stage report gives the subject used and says why it changed.

## Next prompts

At the end of each workflow step (spec written, plan written, stage implemented, review done), end the message with the prompt(s) for the next step(s), each in its own code block, with the real slug and plan folder filled in. Example after a plan:

```
/factory:implement .planning/features/menu/dev-plans/20261001-093000-add-cutoff/
```

The last step of a branch is its close: `/factory:implement {plan folder} — close the branch` (without a plan, `/factory:implement close the branch {branch}`).

## Done footer

Whenever a commit was made during the turn (any skill, agent or direct request), the final message ends with this footer, after the next prompts, as the very last lines. One line per commit, short hash and subject:

```markdown
---
## ✅ JOB DONE
`{short hash}` {commit subject} · branch `{branch}` · not pushed
```

No footer when nothing was committed, or when the turn stops on a failure or an open question.

## Images

Save an image the person shares at the moment it is shared: in the plan's `assets/` by default, in the feature's `assets/` when it outlives the iteration. Name it in kebab-case after its content and reference it from `plan.md` or the spec: `![what it shows](./assets/{name}.png)`.
