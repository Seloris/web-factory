# Rules shared by every selo-flow skill

Every skill of selo-flow reads this file first. It holds what they all do the same way.

## The project

selo-flow is a plugin: it carries the workflow, the project carries what is specific to it. A project is one repository holding one application, with its manifest `selo-flow.yaml` at its root, its `CLAUDE.md`, one `CLAUDE.md` per component and its `.planning/`. The session opens at the project's root with the plugin loaded (installed from the `selo-flow` marketplace), and every skill works on that project: there is nothing to pick. Paths in prompts, in next prompts and in reports start from the project's root (`.planning/features/…`); git commands run there; component commands run inside the component's path (`cd {path} && …`). The plugin's own files are read from `${CLAUDE_PLUGIN_ROOT}`: `reference/`, `scripts/`, `templates/`, `stacks/`.

A component whose `stack` names a pack has stack skills in `${CLAUDE_PLUGIN_ROOT}/stacks/{stack}/skills/{name}/SKILL.md`: read the one the component's `CLAUDE.md` names when its step comes.

A component with a `skin` (a front) has its look in `${CLAUDE_PLUGIN_ROOT}/skins/`: before planning, implementing or reviewing its UI, read `${CLAUDE_PLUGIN_ROOT}/reference/ui-design.md`, `skins/README.md` (the token contract), `skins/recipes.css` and `skins/{skin}/SKIN.md`, in place. The component's `## Design` section wins over all of them.

### What goes where

Useful to two projects or more: the plugin. Specific to one project: that project's `CLAUDE.md` files, its manifest and its own `.claude/skills/`. A rule of the workflow changes with the case that motivated it, and the plugin's `CHANGELOG.md` says why.

## The manifest

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs` from the project's root and read the JSON: `name`, `baseBranch`, `language`, `models` (one model per role), `components` (name, path, kind, stack, skin, layers, commands, handoff, needs, url, logins) and `stages` (the component names in implementation order). The script walks up from the folder given to the nearest `selo-flow.yaml`, never past a `.git` folder. A component whose `missingFile` is true has no `CLAUDE.md` yet: say so and send the person to `/selo-flow:init component {component}`.

The `CLAUDE.md` of a component is loaded by Claude Code when you work under its path; read it yourself when you plan for it from elsewhere.

## Starting a server

A component that runs a server (an API, a front) is started with its `commands.serve`, else the start its `CLAUDE.md` "Local run" gives, inside its path. The person watches every server in one place:

- **`wt.exe` on the PATH (Windows Terminal):** start it in a tab of the `selo-flow` window, titled after the component, from PowerShell: `wt -w selo-flow nt --title {component} -d {absolute component path} cmd /k "{serve}"`. In Git Bash, prefix it with `MSYS_NO_PATHCONV=1`. Escape a `;` in the command as `\;` (it separates `wt` commands). The call returns at once; `cmd /k` keeps the tab open when the server exits, so its error stays readable. The tab outlives the session. You cannot read its output: poll the server's address to know it is up, and when it does not answer, send the person to the tab titled `{component}`.
- **Otherwise:** run it as a background command (the session's background-command tool, never a blocking call), and keep its output.

A server that already answers on its address is used as it is: never restart, stop or kill it.

## Subagents

The session's model leads: it plans, decides and writes. Subagents are tools it picks when they help, each spawned with the `model:` of its role from the manifest's `models`:

- `reviewer` (`models.reviewer`): every review (a stage's when asked with ` — with review`, a plan's final review, `/selo-flow:review`), always a subagent (it has no stake in the code).
- `runner` (`models.runner`): a command whose output would flood your context (a full test suite, a build, a lint run) and a long read or search; it reports the errors with `file:line`. A quick command or a single read runs inline.
- `Explore` (`models.explorer`): a broad search across the code. For a task that needs judgment (analysing an existing feature, comparing implementations), spawn `general-purpose` on `models.implementer`.

A spec, a plan or an implementation is never a subagent's job: their skills ask the person (the grill offer, the commit's message, the explicit yes), and a subagent cannot. The session runs them, on the model the person picked (the manifest's `models` says which one each role is meant for). The one exception is **Autonomous mode** below, where nobody is asked.

Never hand a decision, a code change or a review to `runner` or `Explore`. A subagent without the Agent tool cannot spawn subagents: as one, run commands yourself, filtered to the errors, and say in your report what you could not delegate.

## Autonomous mode

Only `autopilot` turns it on, by ending the prompt of a step's subagent with ` — autonomous`; a person never types it, and a skill never assumes it. In this mode a skill asks nothing: every question takes its recommended answer, every default of the skill is taken, and each is recorded in a `## Decisions taken autonomously` section of the spec or the plan (`- {question} → {answer taken} ({reason})`), the person's record of what was decided without them. A question with no defensible answer stops the step, and the pipeline with it, with nothing written. The hard rules do not move: never push, never `integration_tests` (marked `[-]`), never a squash (its prompt is proposed, not run), commits made with the subject announced beforehand (the skill's own subject for a spec or a plan, the Progress line for a stage).

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
/selo-flow:implement .planning/features/menu/dev-plans/20261001-093000-add-cutoff/
```

A finalized plan needs no next prompt: its squash is proposed in the same turn (see **Plan finalized**). Only a squash the person declined or put off gets one: `/selo-flow:implement {plan folder} — close the branch` (without a plan, `/selo-flow:implement close the branch {branch}`).

**The retro.** The last next prompt of every workflow step is `/selo-flow:retro`, for the person to run in the same session, when the session taught something: it writes the session's lessons to `.planning/retros/` and applies none (`/selo-flow:retro apply` does, later). A turn that ends on a commit question gives it in the turn that answers it. In autonomous mode the steps leave it out; `autopilot` gives it in its report.

## Plan finalized

A plan is **finalized** once every stage of its Progress is ticked and its Validation's `Review` is ticked. The optional items (`Tests`, `Browser test`, `Integration tests`) do not hold it back: each may stay `[ ]` (not run), be ticked (run and green) or be marked `[-]` (declined, with the reason). Without a plan, the work is finalized once its last stage is committed.

Whichever step finalizes it (the last stage, the final review, `/selo-flow:review {plan folder}`) proposes the squash at the end of its turn, after its own commit. A branch reaches the base branch as **one commit**: the stages keep their own commits while the work goes on (a new session resumes from them), the squash folds them. The board does not track it. The same squash runs later on the prompt above.

1. **Range.** `base=$(git merge-base {baseBranch} HEAD)` (`origin/{baseBranch}` when there is no local one), never the base branch itself: if it moved since the branch was cut, a reset onto it would revert its new commits. List `git log --oneline $base..HEAD`.
2. **Check, and stop on any failure, saying why:**
   - the working tree is clean of the branch's own work (`git status`): every change to squash is committed. Unrelated uncommitted files stay as they are and stay out of the commit;
   - nothing is staged (`git diff --cached --quiet`): the reset keeps the index, and a staged file would land in the squash;
   - nothing of the range is pushed: when `git rev-parse @{u}` succeeds, `git log @{u}..HEAD` must list every commit of the range. A pushed commit means a force push, a human's call;
   - every commit of the range belongs to the feature (`{type}({slug}): …`, the plan's slug, or without a plan the one the branch's commits name): a branch carrying another feature's commits is not squashed; list them and let the person decide;
   - the range holds more than one commit. One alone is already squashed: propose nothing and say nothing.
3. **Propose** the commit, its full message (subject and body) in a code block, and wait for the person's explicit yes, in this session, every time: it rewrites the branch's history. Message: `{type}({slug}): {summary}`, with no stage marker, the type the plan's (see `planning.md`) or without a plan the stage commits' (`feat` over `fix` over `refactor` over `chore`), the summary the plan's title or the request, and a body listing the squashed subjects, one per line. The turn ends on this question: the done footer of the turn's own commit waits for the squash's report, or for the no. A no leaves the branch as it is.
4. **Squash:** note the current `HEAD` hash, then `git reset --soft $base` and `git commit` of the index as it stands, never `git add -A` or `git add .`: an unrelated uncommitted file stays out.
5. **Report:** the new commit, the squashed subjects, and the old `HEAD` hash to get the branch back (`git reset --hard {old hash}`) if needed; then the done footer. The branch is ready for the human to push.

## Done footer

Whenever a commit was made during the turn (any skill, agent or direct request), the final message ends with this footer, after the next prompts, as the very last lines. First the recap: one line in `language.chat`, 120 characters at most, what the turn achieved for the person (not the commit subject again). Then one line per commit, short hash and subject:

```markdown
---
## ✅ JOB DONE
> {recap}
`{short hash}` {commit subject} · branch `{branch}` · not pushed
```

The footer is read by tools (the board and its companion apps show the recap): keep its shape.

A free request (no skill) answered without a commit (a question answered, an analysis, a change left uncommitted) ends with the footer too, the recap line alone, no commit line: the board shows what the session achieved. No footer otherwise when nothing was committed, nor when the turn stops on a commit question, a failure or an open question.

## Images

Save an image the person shares at the moment it is shared: in the plan's `assets/` by default, in the feature's `assets/` when it outlives the iteration. Name it in kebab-case after its content and reference it from `plan.md` or the spec: `![what it shows](./assets/{name}.png)`.
