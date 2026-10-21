# webapp-factory

A Claude Code plugin that runs a web-application project through one disciplined workflow: a business spec per feature, a dev-plan precise enough to implement without guessing, test-first implementation one stage per session, a read-only review on request and before the plan is finalized, and a squashed branch at the end. Stack-agnostic: the project describes itself in a `selo-flow.yaml` manifest, the workflow reads it.

This repository is the plugin and its marketplace. A project installs the plugin and uses it: the plugin is the shared base (agents, skills, templates), the project the specific context (its `CLAUDE.md` files, its manifest, its own skills). Useful to two projects or more goes to the plugin; specific to one project stays with the project.

Born from the tooling of a .NET / Angular project, rewritten generic.

## Layout

```
.claude-plugin/marketplace.json the marketplace: selo-flow, selo-flow-board
plugins/selo-flow/                the workflow plugin: agents, skills, scripts, templates, stacks, skins, docs, tests
  CHANGELOG.md                  why each rule of the process exists
plugins/selo-flow-board/          the board mod: a pane that follows the features and prepares the next prompt
samples/todo-app/               a sample project built by the workflow itself
docs/                           two HTML films: init, then the whole workflow on the todo app
CLAUDE.md                       rules for working on this repository
```

## Use it in a project

In the project's folder (an empty one is fine):

```
/plugin marketplace add C:/WS/webapp-factory
/plugin install selo-flow@selo-flow
/selo-flow:init
```

`init` interviews you (name, base branch, language, model preset, then each component: name, path, kind, stack, commands, URL) and writes the instruction layer: `selo-flow.yaml`, `CLAUDE.md`, one autonomous `CLAUDE.md` per component, `.planning/`, `.claude/settings.json` (the marketplace known, the plugin enabled, push denied), `.claude/rules/`, `docs/CONTRIBUTING.md`. No application code: that is the job of a stack pack, or yours.

Then the loop, each step ending with the prompt of the next one ready to copy:

```
/selo-flow:write-spec {feature}        business spec, .planning/features/{slug}/00_spec.md
/selo-flow:write-plan {slug}           dev-plan, committed on the feature branch
/selo-flow:implement {plan folder}     one stage per session, reviewed, one commit per stage
/selo-flow:implement {plan folder} — final review    while the plan's Review is open
```

Once every stage and the `Review` are ticked, the plan is finalized: the step that got there proposes the squash of the branch.

Or the whole loop in one command, with no question: `/selo-flow:autopilot {feature}` (the spec with `grill-me`, the plan, every stage reviewed, the final review, each a fresh subagent; the recommended answers are taken and recorded; needs the `auto` or `acceptEdits` permission mode).

Or, for a small change, straight to `/selo-flow:implement {request}`. `/selo-flow:grill-me {slug}` settles open decisions before a spec or a plan; `/selo-flow:review` reviews the branch, `/selo-flow:review plan {plan folder}` a plan; `/selo-flow:retro` draws the session's lessons into `.planning/retros/`, applied later by `/selo-flow:retro apply`.

Read `plugins/selo-flow/docs/workflow.md` for the whole loop, `docs/manifest.md` for the manifest, `docs/cheatsheet.md` for the one-page version.

## Develop the plugin

Every change to the process is committed with the case that motivated it, and `plugins/selo-flow/CHANGELOG.md` says why. The checks:

```bash
node --test "plugins/selo-flow/tests/*.test.mjs"
```

```bash
claude plugin validate plugins/selo-flow
```

```bash
node plugins/selo-flow/scripts/manifest.mjs plugins/selo-flow/examples/two-components
```

## License

MIT.
