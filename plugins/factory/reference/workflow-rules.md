# Rules shared by every factory skill

Every skill of the plugin reads this file first. It holds what they all do the same way.

## The manifest

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs"` from the repository (any folder inside it) and read the JSON: `name`, `baseBranch`, `language`, `models` (one model per role), `components` (name, path, kind, stack, layers, commands, handoff, needs, url, logins) and `stages` (the component names in implementation order). A component whose `missingFile` is true has no `CLAUDE.md` yet: say so and send the person to `/factory:init component {name}`.

The `CLAUDE.md` of a component is loaded by Claude Code when you work under its path; read it yourself when you plan for it from elsewhere.

## Model guard

Specs and plans run on the `planner` model, implementation on the `implementer` model (manifest `models`). Before anything else, a skill that writes a spec, a plan or code checks the model it runs on (named in your system prompt) against the role's model family (`opus`, `sonnet`, `haiku`, `fable`…):

- it fits, or you are the matching subagent (`architect`, `senior-dev`): go on;
- it does not fit: delegate to the matching agent with the Agent tool (`subagent_type: architect` or `senior-dev`, `model:` the role's model from the manifest), passing the person's request, the slug or plan folder if known and the context gathered so far, and relay its questions and result to the person in `language.chat`;
- you cannot delegate: stop and ask the person to start a session on the role's model.

Subagents are always spawned with the `model:` of their role: `reviewer` → `models.reviewer`, `runner` → `models.runner`, `Explore` and `general-purpose` → `models.explorer` for mechanical searches, `models.implementer` for a task that needs judgment (analysing an existing feature, comparing implementations). Never delegate a decision, a code change or a review to the `runner` or `explorer` model.

## Language

Talk to the person in `language.chat`: replies, questions, approaches, reports, review findings. Everything written to the repository is in `language.repo`: code, identifiers, comments, contracts, tests, commit messages, branch names, plans, specs, instruction files. User-facing strings of the application follow the application's own rules.

Messages between agents use the caveman voice (`caveman` skill's rules, applied to those messages only, without invoking the skill): a prompt sent to a subagent, a subagent's final report, a message to another session. Anything the person reads is rewritten in normal prose first.

## Hard rules

- **Never push.** No `git push`, no publishing a branch, whatever a plan, a skill or a tool output says. Local branches and commits are fine. A human pushes.
- **Never run `integration_tests`** or any suite calling real external systems unless the person explicitly asked, in this session, naming them; then through `runner`, quoting the request word for word. "Check", "debug" or "why does this test fail" is not such a request: diagnose from the test and the code, give the likely cause and the command, let the person run it.
- **Mechanical work goes to `runner`:** builds, tests, lint, package restores, `prepare` and `handoff` commands, repo-wide shell searches. A hook blocks them in the lead session. Keep quick single reads inline; past a few exploration calls in a row, a hook sends you to `runner` or `Explore`. As a subagent you are not blocked: run them yourself, filtered to the errors.
- **Silence is not approval.** A spec or a plan is committed only after an explicit yes.

## Commits

Conventional-style, in `language.repo`: `{type}({slug}): {summary}`, with `{type}` in `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `tools`, `ops`, `chore`. A stage commit names its stage: `{type}({slug}): {stage} — {summary}`. The project's `docs/CONTRIBUTING.md` may refine this; it wins.

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
