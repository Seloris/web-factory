# webapp-factory

A Claude Code plugin that runs a web-application project through one disciplined workflow: a business spec per feature, a dev-plan precise enough to implement without guessing, test-first implementation one stage per session, a read-only review on request and before the plan is finalized, and a squashed branch at the end. Stack-agnostic: the project describes itself in a `factory.yaml` manifest, the workflow reads it.

This repository is the plugin and its marketplace. A project installs the plugin and uses it: the plugin is the shared base (agents, skills, templates), the project the specific context (its `CLAUDE.md` files, its manifest, its own skills). Useful to two projects or more goes to the plugin; specific to one project stays with the project.

Born from the tooling of a .NET / Angular project, rewritten generic.

## Layout

```
.claude-plugin/marketplace.json the marketplace: factory, factory-board
plugins/factory/                the workflow plugin: agents, skills, scripts, templates, stacks, skins, docs, tests
  CHANGELOG.md                  why each rule of the process exists
plugins/factory-board/          the board mod: a pane that follows the features and prepares the next prompt
samples/todo-app/               a sample project built by the workflow itself
docs/                           two HTML films: factory-init, then the whole workflow on the todo app
CLAUDE.md                       rules for working on this repository
```

## Use it in a project

In the project's folder (an empty one is fine):

```
/plugin marketplace add C:/WS/webapp-factory
/plugin install factory@webapp-factory
/factory:factory-init
```

`factory-init` interviews you (name, base branch, language, model preset, then each component: name, path, kind, stack, commands, URL) and writes the instruction layer: `factory.yaml`, `CLAUDE.md`, one autonomous `CLAUDE.md` per component, `.planning/`, `.claude/settings.json` (the marketplace known, the plugin enabled, push denied), `.claude/rules/`, `docs/CONTRIBUTING.md`. No application code: that is the job of a stack pack, or yours.

Then the loop, each step ending with the prompt of the next one ready to copy:

```
/factory:write-spec {feature}        business spec, .planning/features/{slug}/00_spec.md
/factory:write-plan {slug}           dev-plan, committed on the feature branch
/factory:implement {plan folder}     one stage per session, reviewed, one commit per stage
/factory:implement {plan folder} — final review    while the plan's Review is open
```

Once every stage and the `Review` are ticked, the plan is finalized: the step that got there proposes the squash of the branch.

Or the whole loop in one command, with no question: `/factory:autopilot {feature}` (the spec with `grill-me`, the plan, every stage reviewed, the final review, each a fresh subagent; the recommended answers are taken and recorded; needs the `auto` or `acceptEdits` permission mode).

Or, for a small change, straight to `/factory:implement {request}`. `/factory:grill-me {slug}` settles open decisions before a spec or a plan; `/factory:review` reviews the branch, `/factory:review plan {plan folder}` a plan.

Read `plugins/factory/docs/workflow.md` for the whole loop, `docs/manifest.md` for the manifest, `docs/cheatsheet.md` for the one-page version.

## Develop the plugin

Every change to the process is committed with the case that motivated it, and `plugins/factory/CHANGELOG.md` says why. The checks:

```bash
node --test "plugins/factory/tests/*.test.mjs"
```

```bash
claude plugin validate plugins/factory
```

```bash
node plugins/factory/scripts/manifest.mjs plugins/factory/examples/two-components
```

## License

MIT.
