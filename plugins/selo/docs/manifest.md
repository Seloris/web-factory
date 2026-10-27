# The manifest

selo knows nothing about a project's stack. Everything it needs is declared in two places, inside the project, both read by the plugin's `scripts/manifest.mjs` (the single parser used by the skills):

1. the project's **`selo.yaml`**, at its root beside `CLAUDE.md`, which describes the application: name, base branch, languages, components in implementation order;
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

A key the parser does not know (at the top level, in a component, its `commands` or `language`) is ignored and reported in the resolved manifest's `warnings`, as is a `demo` command without its `demo_port`; a skill tells the person.

### Models

Not in `selo.yaml`: the models are the person's setting, not the project's (two people on one repository pick their own), read from the environment, the `env` block of `~/.claude/settings.json` (a new session after a change). The resolved manifest's `models` holds them, so a skill reads them there. One model per role, any model Claude Code accepts as a subagent's `model:` (`opus`, `sonnet`, `haiku`, `fable`). Roles: `planner` (spec, plan), `implementer` (code), `reviewer`, `runner` (mechanical work), `explorer` (code searches). Two presets: `standard`, the default, and `lean`, sonnet as implementer for the person who wants it (a more detailed blueprint under `pilot --autonomous` only):

| Role | `standard` | `lean` |
|---|---|---|
| planner | opus | opus |
| implementer | opus | sonnet |
| reviewer | opus | opus |
| runner | haiku | haiku |
| explorer | haiku | haiku |

`SELO_MODELS` picks the preset (absent: `standard`); `SELO_MODEL_{ROLE}` overrides one role, the others keep the preset:

```json
{
  "env": {
    "SELO_MODELS": "standard",
    "SELO_MODEL_PLANNER": "fable",
    "SELO_MODEL_REVIEWER": "fable"
  }
}
```

An unknown preset reads as `standard` and is reported in the resolved manifest's `warnings`. A `models` key left in `selo.yaml` (before 2.8.0) is an unknown key: `setup update` removes it and gives its roles as these lines.

The plugin's agents carry no `model` in their frontmatter: the skill that spawns one passes the role's model. The plugin's `PreToolUse` hook on `Agent|Task` (`scripts/agent-model.mjs`) is the guard, not the source: it rewrites the call's `model` to its role's when they differ, every other field kept, and prints nothing when the model is already right, outside a selo project, or on a manifest that fails to parse:

| `subagent_type` | Role | When |
|---|---|---|
| `selo:reviewer`, `reviewer` | `reviewer` | always |
| `selo:runner`, `runner` | `runner` | always |
| `Explore` | `explorer` | only when the call names no `model` |
| `Plan` | `planner` | only when the call names no `model` |
| any other | — | untouched: its frontmatter, or `CLAUDE_CODE_SUBAGENT_MODEL` |

The lead's transcript keeps the call as written; the subagent's own transcript shows the model it ran on. A session's own model is picked by the person when creating the session.

## Component block: ` ```component `

```yaml
kind: api                      # api | front | db | worker | lib
stack: react-express           # free text; matches a stacks/{stack}/ pack when one exists
skin: modern                   # a front's look: one of the plugin's skins/ (optional; an unknown name is an error)
layers: [db, services, routes] # the order a stage implements this component in
commands:
  build: npm run build
  test: npm test                             # the fast suite, run in full at the end of a stage
  lint: npx eslint {files}                   # {files} = the files the stage changed
  handoff: npm run export-openapi            # produces the manifest's handoff file (api stage end)
  prepare: npm run generate-client           # front stage start, from the previous handoff
  integration_tests: npm run test:integration -- --filter "{filter}"   # never run unasked
  serve: npm run dev                         # starts the dev server on PORT (a run of the app, scripts/run.mjs)
  demo: npm run demo                         # starts the demo on PORT: seeded data, what the browser test runs on
port: 3000                                   # the dev server's base port; a front with a port is browser-tested
demo_port: 3101                              # the demo's base port
logins: .claude/local/test-logins.md         # accounts for try (git-ignored)
```

Only `kind` and `commands.build` are required. A component without `test` gets no test step; one without `lint` gets no lint step.

`port` and `demo_port` are base ports. A run of the app (`scripts/run.mjs`, behind `/selo:run`, `try` and the project's `selo-run.mjs`) takes a slot, one per worktree that runs at the same time, and every component of slot n listens on its base port + 10 × n: slot 0 is the base ports. The parser returns `port` and `demoPort` as written, and the urls computed for a slot: `url` (a front with a `port`: it is browser-tested), `serveUrl` and `demoUrl`, `http://localhost:{port + 10 × slot}`. The CLI computes them for this root's slot (its live run, else the slot it had last, else 0), `--slot N` for another; `readManifest(dir, { slot })` from a script. `port` and `demo_port` sit in the component block or in its `components` entry of `selo.yaml`.

`serve` and `demo` are what a run starts: `serve` on the dev port, `demo` (seeded data, in memory) on the demo port. Each command runs in the component's path with `PORT` (its port on the slot), `SELO_SLOT` and, for each component it `needs`, `{NAME}_URL` (`API_URL`): the stack pack's scripts read them (its `## Ports` section). `try` runs on the demo when every component it needs has one, else on the dev servers; a run's demo is held by one session at a time (`{git-common-dir}/selo/slots/{n}.demo.lock`), so two worktrees test side by side and two sessions on one worktree wait for each other. `serve` runs only when its component is not already running on the slot, so it can chain a prerequisite that needs the server stopped (`npm run db:migrate && npm run dev`).

The 1.0 keys `url`, `serve_url` and `demo_url` are still read: a `http://localhost:{port}` one gives its port, which shifts with the slot; any other url is returned as it is. `/selo:setup update` turns them into ports.

## Stages

One stage per component, in the manifest's order, honouring `needs`. A stage:

1. starts with its `commands.prepare` when it has one (the front regenerates its client from the API's handoff);
2. implements the component's layers in order, tests first;
3. verifies: `build`, `test` in full, `lint` on the changed files;
4. ends with `commands.handoff` when it has one, and one commit on the base branch.

The last stage also runs the `reviewer` agent on the whole work, the full suites of every touched component and the browser test (the demo, else the dev servers), on this worktree's slot.

A project with one component has one stage; nothing in the plugin's skills knows the words "API" or "front".

## Reading the manifest from a script

```js
import { readManifest } from "<plugin root>/scripts/manifest.mjs";
const m = readManifest(process.cwd());   // walks up to the nearest selo.yaml, stopping at a .git folder
m.selo; m.name; m.baseBranch; m.models.planner; m.components[0].commands.build; m.warnings;
readManifest(process.cwd(), { slot: 1 }).components[0].serveUrl;   // the urls of slot 1 (base port + 10)
```

`node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs` from the project's root prints the resolved manifest as JSON, which is how a skill reads it without parsing YAML itself.
