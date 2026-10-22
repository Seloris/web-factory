# webapp-factory

A Claude Code plugin that runs a web-application project through one disciplined workflow: a fastlane for small changes and a feature lane (spec, plan, stages) for the rest, test-first, one read-only review at the end, a browser test on a seeded demo, and every area's spec kept current by the commits that change it. Several sessions commit side by side on the base branch, each naming its files. Stack-agnostic: the project describes itself in a `selo-flow.yaml` manifest, the workflow reads it.

This repository is the plugin and its marketplace. A project installs the plugin and uses it: the plugin is the shared base (agents, skills, templates), the project the specific context (its `CLAUDE.md` files, its manifest, its own skills). Useful to two projects or more goes to the plugin; specific to one project stays with the project.

Born from the tooling of a .NET / Angular project, rewritten generic.

## Layout

```
.claude-plugin/marketplace.json the marketplace: selo-flow
plugins/selo-flow/                the workflow plugin: agents, skills, scripts, templates, stacks, skins, docs, tests
  CHANGELOG.md                  why each rule of the process exists
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

Then two lanes, each step ending with the prompt of the next one ready to copy, every commit on the base branch:

```
/selo-flow:implement {request}         the fastlane: code, spec delta, review, demo test, one commit per component
/selo-flow:write-spec {request}        the feature lane: the area's spec, .planning/features/{slug}/00_spec.md
/selo-flow:write-plan {slug}           the plan, Business decisions first
/selo-flow:implement {plan folder}     one stage per session, one commit each; the last reviews the whole plan
```

Or in one command, with no question: `/selo-flow:autopilot {request}` reads the code, picks the lane and runs it, each step a fresh subagent; the recommended answers are taken and listed as Business decisions and Technical defaults (needs the `auto` or `acceptEdits` permission mode).

Every code commit carries a `Spec:` line (`Spec: orders +FR-12 ~FR-03`, or `Spec: none (refactor)`): the area's spec follows the code, `spec-check` keeps its ids straight and the plugin's commit hook warns when the line is missing. `/selo-flow:grill-me {slug}` settles open decisions before a spec or a plan; `/selo-flow:review` reviews recent work, `/selo-flow:review plan {plan folder}` a plan, `/selo-flow:review {slug}` a whole area against its spec; `/selo-flow:init update` brings a project up to date with the plugin.

Read `plugins/selo-flow/docs/workflow.md` for the whole loop, `docs/manifest.md` for the manifest, `docs/cheatsheet.md` for the one-page version.

## Develop the plugin

Every change to the process is committed with the case that motivated it, and `plugins/selo-flow/CHANGELOG.md` says why. The checks:

```bash
node --test "plugins/*/tests/*.test.mjs"
```

```bash
claude plugin validate plugins/selo-flow
```

```bash
node plugins/selo-flow/scripts/manifest.mjs plugins/selo-flow/examples/two-components
```

## License

MIT.
