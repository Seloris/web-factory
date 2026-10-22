# The manifest

selo knows nothing about a project's stack. Everything it needs is declared in two places, inside the project, both read by the plugin's `scripts/manifest.mjs` (the single parser used by the skills):

1. the project's **`selo.yaml`**, at its root beside `CLAUDE.md`, which describes the application: name, base branch, languages, models, components in implementation order;
2. one **`CLAUDE.md` per component**, which holds a fenced `component` block describing that component. Claude Code loads a subfolder's `CLAUDE.md` when it works on files under it, so a component is autonomous: it can move to its own repository and keep its instructions.

Both are YAML (a small subset: maps, lists, scalars, inline `[a, b]` and `{a: b}`, `#` comments). The rest of each `CLAUDE.md` is free Markdown: conventions, glossary, hard rules.

The parser walks up from the folder it is given to the nearest `selo.yaml`, so a component's folder finds the project's manifest; it never walks past a `.git` folder, so a nested repository never inherits the manifest around it.

## `selo.yaml`

```yaml
selo: 2.0.0                    # the plugin version that wrote or last updated the project (setup, setup update)
name: my-app
base_branch: main              # the branch every session commits on
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
    port: 4200                        # the dev server's port: a front with a port is browser-tested (optional)
    demo_port: 5181                   # where its demo answers (optional; also allowed in the component block)
```

A key the parser does not know (at the top level, in a component, its `commands`, `models` or `language`) is ignored and reported in the resolved manifest's `warnings`, as is a `demo` command without its `demo_port`; a skill tells the person.

### Models

One model per role, any model Claude Code accepts as a subagent's `model:` (`opus`, `sonnet`, `haiku`, `fable`). Roles: `planner` (spec, plan), `implementer` (code), `reviewer`, `runner` (mechanical work), `explorer` (code searches). The one preset, `standard`, is the recommended set; `setup` asks for each role with it as the answer, and writes the map only for the roles the person changed:

| Role | `standard` |
|---|---|
| planner | opus |
| implementer | sonnet |
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
  serve: npm run dev                         # starts the local dev server, when a test needs it and it does not answer
  demo: npm run demo                         # starts the demo: seeded data on its own port, what the browser test runs on
port: 3000                                   # the dev server's base port; a front with a port is browser-tested
demo_port: 3101                              # the demo's base port
logins: .claude/local/test-logins.md         # accounts for try (git-ignored)
```

Only `kind` and `commands.build` are required. A component without `test` gets no test step; one without `lint` gets no lint step.

`demo` and `demo_url` are what `try` runs on: the demo of the tested component and of those it `needs`, in stage order, each started in the background and awaited on its `demo_url`, under a lock (`{git-common-dir}/selo/demo.lock`) so two sessions never share one, and stopped after the test. The person's dev servers and local data are never touched. With a `url` and a `demo`, the browser test runs by default on a plan's last stage. Without a demo, `serve` and `serve_url` start the dev servers that do not answer, stopped after the test the same way; a server that already answers is left as it is. `serve` runs only when its server is down, so it can chain a prerequisite that needs the server stopped (`npm run db:migrate && npm run dev`). `serve_url` is separate from `url` because `url` makes a component browser-tested; any HTTP status on either counts as answering. The parser returns them as `url` (a front with a `port`), `serveUrl` and `demoUrl`, `http://localhost:{port}`. `port` and `demo_port` sit in the component block or in its `components` entry of `selo.yaml`; the 1.0 keys `url`, `serve_url` and `demo_url` are still read, and `/selo:setup update` turns them into ports.

## Stages

One stage per component, in the manifest's order, honouring `needs`. A stage:

1. starts with its `commands.prepare` when it has one (the front regenerates its client from the API's handoff);
2. implements the component's layers in order, tests first;
3. verifies: `build`, `test` in full, `lint` on the changed files;
4. ends with `commands.handoff` when it has one, and one commit on the base branch.

The last stage also runs the `reviewer` agent on the whole work, the full suites of every touched component and the browser test on the demo.

A project with one component has one stage; nothing in the plugin's skills knows the words "API" or "front".

## Reading the manifest from a script

```js
import { readManifest } from "<plugin root>/scripts/manifest.mjs";
const m = readManifest(process.cwd());   // walks up to the nearest selo.yaml, stopping at a .git folder
m.selo; m.name; m.baseBranch; m.models.planner; m.components[0].commands.build; m.warnings;
```

`node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs` from the project's root prints the resolved manifest as JSON, which is how a skill reads it without parsing YAML itself.
