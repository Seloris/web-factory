# The manifest

The factory knows nothing about a project's stack. Everything it needs is declared in two places, both read by `plugins/factory/scripts/manifest.mjs` (the single parser used by the skills, the hooks and the helper pane):

1. the **root `CLAUDE.md`**, which holds a fenced `factory` block describing the repository;
2. one **`CLAUDE.md` per component**, which holds a fenced `component` block describing that component. Claude Code loads a subfolder's `CLAUDE.md` when it works on files under it, so a component is autonomous: it can move to its own repository and keep its instructions.

Both blocks are YAML (a small subset: maps, lists, scalars, inline `[a, b]` and `{a: b}`, `#` comments). The rest of each file is free Markdown: conventions, glossary, hard rules.

## Root block: ` ```factory `

```yaml
name: my-app
base_branch: main              # the branch features are cut from and squashed into
language:
  chat: fr                     # what agents speak to the user
  repo: en                     # everything written to the repository
models: standard               # a preset name, or a map of roles (below)
components:                    # the order is the order of the stages
  - name: api
    path: src/api
    handoff: src/api/openapi.json     # file the stage leaves for the next ones (optional)
  - name: web
    path: src/web
    needs: [api]                      # stages that must be committed first (optional)
    url: http://localhost:4200        # enables the "Browser test" validation item (optional)
hooks:                         # optional, all default to true
  require_runner: true         # builds/tests/lint denied in the lead session
  delegate_exploration: true   # long inline exploration bursts denied
  exploration_limit: 4
```

### Models

A preset name or an explicit map. Roles: `planner` (spec, plan), `implementer` (code), `advisor` (consulted by the implementer at decision points), `reviewer`, `runner` (mechanical work), `explorer` (code searches).

| Role | `standard` | `premium` |
|---|---|---|
| planner | opus | fable |
| implementer | sonnet | opus |
| advisor | opus | fable |
| reviewer | opus | fable |
| runner | haiku | haiku |
| explorer | haiku | haiku |

An explicit map overrides roles one by one:

```yaml
models:
  preset: standard
  reviewer: fable
```

Agents in the plugin carry no `model` in their frontmatter: the skill that spawns one passes the role's model, and the helper pane's `agent.spawn` hook enforces it. A session's own model is picked by the person when creating the session; the skills check it against the role they need (the *model guard*) and delegate to the matching agent when it does not fit.

## Component block: ` ```component `

```yaml
kind: api                      # api | front | db | worker | lib
stack: dotnet                  # free text; matches a stacks/{stack}/ pack when one exists
layers: [Domain, Application, Infrastructure, Api]   # the plan's sections for this component
commands:
  build: dotnet build
  test: dotnet test MyApp.UnitTests          # the fast suite, run in full at the end of a stage
  lint: npx eslint {files}                   # {files} = the files the stage changed
  handoff: npm run export-openapi            # produces the manifest's handoff file (api stage end)
  prepare: npm run generate-client           # front stage start, from the previous handoff
  integration_tests: dotnet test MyApp.IntegrationTests --filter "{filter}"   # never run unasked
logins: .claude/local/test-logins.md         # accounts for test-in-browser (git-ignored)
```

Only `kind` and `commands.build` are required. A component without `test` gets no test step; one without `lint` gets no lint step.

## Stages

One stage per component, in the manifest's order, honouring `needs`. A stage:

1. starts with its `commands.prepare` when it has one (the front regenerates its client from the API's handoff);
2. implements the component's layers in order, tests first;
3. verifies: `build`, `test` in full, `lint` on the changed files, all through the `runner` agent;
4. is reviewed by the `reviewer` agent;
5. ends with `commands.handoff` when it has one, and one commit.

A project with one component has one stage; nothing in the plugin knows the words "API" or "front".

## Reading the manifest from a script

```js
import { readManifest } from "./scripts/manifest.mjs";
const m = readManifest(process.cwd());   // walks up to the root CLAUDE.md
m.name; m.baseBranch; m.models.planner; m.components[0].commands.build;
```

`node plugins/factory/scripts/manifest.mjs [dir]` prints the resolved manifest as JSON, which is how a skill reads it without parsing YAML itself.
