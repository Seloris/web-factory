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
models: standard               # the preset, or a map with one model per role (below)
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

One model per role, any model Claude Code accepts as a subagent's `model:` (`opus`, `sonnet`, `haiku`, `fable`). Roles: `planner` (spec, plan), `implementer` (code), `advisor` (consulted by the implementer at decision points), `reviewer`, `runner` (mechanical work), `explorer` (code searches). The one preset, `standard`, is the recommended set; `factory-init` asks for each role with it as the answer, and writes the map only for the roles the person changed:

| Role | `standard` |
|---|---|
| planner | opus |
| implementer | sonnet |
| advisor | opus |
| reviewer | opus |
| runner | haiku |
| explorer | haiku |

```yaml
models:
  preset: standard
  planner: fable
  reviewer: fable
```

The plugin's agents carry no `model` in their frontmatter: the skill that spawns one passes the role's model. A session's own model is picked by the person when creating the session.

## Component block: ` ```component `

```yaml
kind: api                      # api | front | db | worker | lib
stack: react-express           # free text; matches a stacks/{stack}/ pack when one exists
skin: modern                   # a front's look: one of the plugin's skins/ (optional; an unknown name is an error)
layers: [db, services, routes] # the plan's sections for this component
commands:
  build: npm run build
  test: npm test                             # the fast suite, run in full at the end of a stage
  lint: npx eslint {files}                   # {files} = the files the stage changed
  handoff: npm run export-openapi            # produces the manifest's handoff file (api stage end)
  prepare: npm run generate-client           # front stage start, from the previous handoff
  integration_tests: npm run test:integration -- --filter "{filter}"   # never run unasked
  serve: npm run dev                         # starts the local server, run in the background by test-in-browser
serve_url: http://localhost:3000             # where the server answers once started (default: the component's url)
logins: .claude/local/test-logins.md         # accounts for test-in-browser (git-ignored)
```

Only `kind` and `commands.build` are required. A component without `test` gets no test step; one without `lint` gets no lint step.

`serve` and `serve_url` let `test-in-browser` start, without asking, the servers that do not answer: the tested component's and those of the components it `needs`, in stage order, each awaited on its `serve_url` before the next starts. A server that already answers is left as it is. `serve` runs only when its server is down, so it can chain a prerequisite that needs the server stopped (`npm run db:migrate && npm run dev`). `serve_url` is separate from `url` because `url` makes a component browser-tested; any HTTP status on it counts as answering. The parser returns it as `serveUrl`, falling back to `url`.

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
