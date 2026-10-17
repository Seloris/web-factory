# The manifest

The factory knows nothing about a project's stack. Everything it needs is declared in two places, inside the project, both read by the plugin's `scripts/manifest.mjs` (the single parser used by the skills):

1. the project's **`factory.yaml`**, at its root beside `CLAUDE.md`, which describes the application: name, base branch, languages, models, components in implementation order;
2. one **`CLAUDE.md` per component**, which holds a fenced `component` block describing that component. Claude Code loads a subfolder's `CLAUDE.md` when it works on files under it, so a component is autonomous: it can move to its own repository and keep its instructions.

Both are YAML (a small subset: maps, lists, scalars, inline `[a, b]` and `{a: b}`, `#` comments). The rest of each `CLAUDE.md` is free Markdown: conventions, glossary, hard rules.

The parser walks up from the folder it is given to the nearest `factory.yaml`, so a component's folder finds the project's manifest; it never walks past a `.git` folder, so a nested repository never inherits the manifest around it.

## `factory.yaml`

```yaml
name: my-app
base_branch: main              # the branch features are cut from and squashed into
language:
  chat: fr                     # what agents speak to the user
  repo: en                     # everything written to the repository
models: standard               # a preset name, or a map of roles (below)
components:                    # the order is the order of the stages; paths relative to this file
  - name: api
    path: src/api
    handoff: src/api/openapi.json     # file the stage leaves for the next ones (optional)
  - name: web
    path: src/web
    needs: [api]                      # stages that must be committed first (optional)
    url: http://localhost:4200        # enables the "Browser test" validation item (optional)
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

The plugin's agents carry no `model` in their frontmatter: the skill that spawns one passes the role's model. A session's own model is picked by the person when creating the session.

## Component block: ` ```component `

```yaml
kind: api                      # api | front | db | worker | lib
stack: dotnet                  # free text; matches a stacks/{stack}/ pack when one exists
skin: modern                   # a front's look: one of the plugin's skins/ (optional; an unknown name is an error)
layers: [Domain, Application, Infrastructure, Api]   # the plan's sections for this component
commands:
  build: dotnet build
  test: dotnet test MyApp.UnitTests          # the fast suite, run in full at the end of a stage
  lint: npx eslint {files}                   # {files} = the files the stage changed
  handoff: npm run export-openapi            # produces the manifest's handoff file (api stage end)
  prepare: npm run generate-client           # front stage start, from the previous handoff
  integration_tests: dotnet test MyApp.IntegrationTests --filter "{filter}"   # never run unasked
logins: .claude/local/test-logins.md         # accounts for test-in-browser (git-ignored); absent when the application has no sign-in
```

Only `kind` and `commands.build` are required. A component without `test` gets no test step; one without `lint` gets no lint step.

`skin` sits in the component block, not in `factory.yaml`, so that a front keeps its look when it moves to its own repository. The skin's tokens are copied into the component by `factory-init`; the application overrides its variables in its own `overrides.css` and its rules in the `## Design` section of the component's `CLAUDE.md` (see `skins/README.md`).

## Stages

One stage per component, in the manifest's order, honouring `needs`. A stage:

1. starts with its `commands.prepare` when it has one (the front regenerates its client from the API's handoff);
2. implements the component's layers in order, tests first;
3. verifies: `build`, `test` in full, `lint` on the changed files;
4. is reviewed by the `reviewer` agent when asked (` — with review` in its prompt);
5. ends with `commands.handoff` when it has one, and one commit.

A project with one component has one stage; nothing in the plugin's skills knows the words "API" or "front".

## Reading the manifest from a script

```js
import { readManifest } from "<plugin root>/scripts/manifest.mjs";
const m = readManifest(process.cwd());   // walks up to the nearest factory.yaml, stopping at a .git folder
m.name; m.baseBranch; m.models.planner; m.components[0].commands.build;
```

`node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs` from the project's root prints the resolved manifest as JSON, which is how a skill reads it without parsing YAML itself.
