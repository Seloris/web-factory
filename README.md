# webapp-factory

A Claude Code plugin that runs a web-application project through one disciplined workflow: a fastlane for small changes and a blueprint (one screen: spec delta, decisions, stages) built in one go for the rest, test-first, one read-only review at the end, a browser test, and every page's spec kept current by the commits that change it. Several sessions commit side by side on the base branch, each naming its files, or each in its own worktree, landed as one squashed commit. Stack-agnostic: the project describes itself in a `selo.yaml` manifest, the workflow reads it.

This repository is the plugin and its marketplace. A project installs the plugin and uses it: the plugin is the shared base (agents, skills, templates), the project the specific context (its `CLAUDE.md` files, its manifest, its own skills). Useful to two projects or more goes to the plugin; specific to one project stays with the project.

Born from the tooling of a .NET / Angular project, rewritten generic.

## Layout

```
.claude-plugin/marketplace.json the marketplace: selo
plugins/selo/                   the workflow plugin: agents, skills, scripts, templates, stacks, skins, docs, tests
  CHANGELOG.md                  why each rule of the process exists
samples/todo-app/               a sample project built by the workflow itself
docs/                           two HTML films: init, then the whole workflow on the todo app
CLAUDE.md                       rules for working on this repository
```

## Use it in a project

In the project's folder (an empty one is fine):

```
/plugin marketplace add C:/WS/webapp-factory
/plugin install selo@selo
/selo:setup
```

`setup` interviews you (name, base branch, language, model preset, then each component: name, path, kind, stack, commands, URL) and writes the instruction layer: `selo.yaml`, `CLAUDE.md`, one autonomous `CLAUDE.md` per component, `.planning/`, `.claude/settings.json` (the marketplace known, the plugin enabled, push denied), `.claude/rules/`, `docs/CONTRIBUTING.md`. No application code: that is the job of a stack pack, or yours.

Then three lanes, each step ending with the prompt of the next one ready to copy:

```
/selo:fastlane  {request}     "change this": code + page spec delta, one review, commit(s)
/selo:blueprint {request}     grill → page spec delta + brief, one yes, one commit
/selo:build     {blueprint}   every stage chained, one commit each, review, delta merged
/selo:autopilot {request}     no question: picks Fastlane or Blueprint → Build
```

Or in one command, with no question: `/selo:autopilot {request}` reads the code, picks the lane and runs it, each step a fresh subagent; the recommended answers are taken and listed as Business decisions and Technical defaults (needs the `auto` or `acceptEdits` permission mode).

Every code commit carries a `Spec:` line (`Spec: home +FR-12 ~FR-03 · todo +BR-06`, or `Spec: none (refactor)`): the page and domain specs follow the code, `spec-check` keeps its ids straight and the plugin's commit hook warns when the line is missing. `/selo:grill` settles open decisions; `/selo:review` reviews recent work, a blueprint or a page against its spec; `/selo:setup update` brings a project up to date with the plugin.

Read `plugins/selo/docs/cheatsheet.md` for the commands and the flow, `plugins/selo/reference/rules.md` for every rule, `plugins/selo/docs/manifest.md` for the manifest.

## Develop the plugin

Every change to the process is committed with the case that motivated it, and `plugins/selo/CHANGELOG.md` says why. The checks:

```bash
node --test "plugins/*/tests/*.test.mjs"
```

```bash
claude plugin validate plugins/selo
```

```bash
node plugins/selo/scripts/manifest.mjs plugins/selo/examples/two-components
```

## License

MIT.
