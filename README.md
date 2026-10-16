# webapp-factory

A Claude Code marketplace that turns any repository into a disciplined web-application workshop: a business spec per feature, a dev-plan precise enough to implement without guessing, test-first implementation one stage per session, a read-only review before every commit, and a squashed branch at the end. Stack-agnostic: the project describes itself in a manifest, the workflow reads it.

Born from the tooling of a .NET / Angular project, rewritten generic.

## What you get

| Plugin | Contents |
|---|---|
| `factory` | The workflow. Skills `init`, `write-spec`, `write-plan`, `implement`, `grill-me`, `reviewer`, `test-in-browser`, `caveman`; agents `architect`, `senior-dev`, `reviewer`, `runner`; hooks that keep builds and broad searches out of the lead session; the manifest parser; the templates `init` writes into a project. |
| `factory-helper` | A pane following the workflow (plan timeline, next prompt, live sessions, compliance score). **Not implemented yet**: its spec and first dev-plan live under `.planning/`, to be built with the factory's own workflow. |

Plus `plugins/factory/stacks/` (per-stack skills and component templates that `init` copies into a project when that stack is chosen; one pack today: `dotnet-angular`), `examples/` (a minimal two-component project used to test the plugin) and `docs/`.

## Install

Anywhere, once per machine. In Claude Code (2.1.275 or later), one step:

```
/plugin install factory --marketplace <github-user>/webapp-factory
```

Or from a terminal:

```bash
claude plugin marketplace add <github-user>/webapp-factory
claude plugin install factory@webapp-factory
```

From a local clone instead: `claude plugin marketplace add ./path/to/webapp-factory`.

Update later with `claude plugin marketplace update webapp-factory` then `claude plugin update factory@webapp-factory`.

## Start a project

In an empty (or existing) repository, in Claude Code:

```
/factory:init
```

It interviews you (name, base branch, language, model preset, then each component: name, path, kind, stack, commands, URL) and writes the instruction layer: the root `CLAUDE.md` with the manifest, one autonomous `CLAUDE.md` per component, `.planning/`, `.claude/settings.json` (push denied, hooks on), `.claude/rules/planning.md` and `memory.md`, `docs/CONTRIBUTING.md`. No application code: that is the job of a stack pack, or yours.

Then the loop, each step ending with the prompt of the next one ready to copy:

```
/factory:write-spec {feature}        business spec, .planning/features/{slug}/00_spec.md
/factory:write-plan {slug}           dev-plan, committed on the feature branch
/factory:implement {plan folder}     one stage per session, reviewed, one commit per stage
/factory:implement {plan folder} — close the branch
```

Or, for a small change, straight to `/factory:implement {request}`. `/factory:grill-me` settles open decisions before a spec or a plan; `/factory:reviewer` reviews any branch or plan.

Read `docs/workflow.md` for the whole loop, `docs/manifest.md` for the manifest, `docs/cheatsheet.md` for the one-page version.

## Repository layout

```
.claude-plugin/marketplace.json
plugins/factory/            the workflow plugin
  skills/ agents/ hooks/ scripts/ reference/ templates/ tests/
  stacks/dotnet-angular/    stack pack: component templates + skills
plugins/factory-helper/     the pane (to build)
examples/two-components/    test project (echo commands)
docs/
.planning/                  this repository's own specs and plans (it uses its own workflow)
CLAUDE.md                   this repository's own manifest
```

## Develop the factory

This repository is its own first project: `CLAUDE.md` holds a manifest with one component per plugin, and changes go through `write-spec` / `write-plan` / `implement` like anywhere else. Install the plugin from the local clone to work on it, and run the checks:

```bash
node --test "plugins/factory/tests/*.test.mjs"
claude plugin validate plugins/factory
```

## License

MIT.
