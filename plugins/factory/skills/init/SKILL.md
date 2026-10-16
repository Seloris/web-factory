---
name: init
description: "Set up a repository as a factory project: interview the person (name, base branch, language, model preset, then each component: name, path, kind, stack, commands, url), write the root CLAUDE.md with the manifest, one autonomous CLAUDE.md per component (from the stack pack when one exists), .planning/, .claude/settings.json, the planning and memory rules and docs/CONTRIBUTING.md. Also adds a component (init component {name}), switches the model preset (init models {preset}) or re-applies a stack pack (init stack {component} {stack}). Writes the instruction layer only, never application code."
---

# Init a factory project

Turns the current repository into a project the `factory` workflow can run on. It writes instructions, never application code: the code skeleton is the person's, or a future stack pack's.

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first (language, hard rules, commits). Talk to the person in their language from the first message (ask in the language they used).

## Modes

- `/factory:init` with no manifest in the repository: full setup (below).
- `/factory:init` with a manifest: say what exists and offer the three partial modes.
- `/factory:init component {name}`: interview for one component, write its `CLAUDE.md`, add it to the manifest's `components`.
- `/factory:init models {preset|role=model …}`: change the manifest's `models` and the `env.CLAUDE_CODE_SUBAGENT_MODEL` of `.claude/settings.json` (the `runner` model).
- `/factory:init stack {component} {stack}`: re-apply a stack pack's template and skills to an existing component (its `CLAUDE.md` is rewritten: ask first, and keep its Conventions section).

## Full setup

### 1. Look around first

Facts you collect yourself, never ask: `git rev-parse --abbrev-ref HEAD` and `git branch -a` (base branch candidates), the top-level folders and the obvious component roots (a `*.sln`, `package.json`, `angular.json`, `nx.json`, `pyproject.toml`, `go.mod`… under a folder), existing `CLAUDE.md`, `AGENTS.md`, `.claude/`, `docs/CONTRIBUTING.md` (never overwrite them silently: show what you would change). List the stack packs available: the folders of `${CLAUDE_PLUGIN_ROOT}/stacks/`, each with the `README.md` first line as its description.

### 2. Interview

In the `grill-me` format (numbered questions, each with a recommended answer phrased so that "yes" accepts it, at most 7 per round, in the person's language). Round 1, the project:

1. **Name** (recommended: the repository folder name) and a one-line description.
2. **Base branch** (recommended: the current one if it is `main`, `master` or `develop`, else `main`).
3. **Languages**: chat (recommended: the one they are writing in) and repository (recommended: `en`); the application's own UI language.
4. **Model preset**: `standard` (planner/reviewer Opus, implementer Sonnet with Opus advisor, runner Haiku) or `premium` (planner/reviewer Fable, implementer Opus with Fable advisor, runner Haiku); recommended: `standard`.
5. **Components**: the list, from what you found (recommended: one per detected root, named `api`, `web`, `db`, `worker`… by kind), with their order of implementation (which needs which).

Round 2, one round per component (merge small ones):

1. **Path** and **kind** (`api`, `front`, `db`, `worker`, `lib`).
2. **Stack**: one of the packs, or free text for a stack with no pack.
3. **Layers**, in implementation order (recommended from the pack, else a sensible default for the kind: `[Domain, Application, Infrastructure, Api]` for an API, `[data, pages, ui]` for a front).
4. **Commands**: `build`, `test`, `lint` (with `{files}` where the changed files go), and when relevant `prepare`, `handoff` with the handoff file, `integration_tests` with `{filter}`; recommended from the pack, else from the detected tool (`dotnet build`, `npm run build`…). Leave out what the component does not have (a front with no unit tests has no `test`).
5. **Url** for a front (recommended: the one its dev server uses) and the **logins** file (recommended: `.claude/local/test-logins.md`).
6. **Local run**: how to start it and its dependencies, for the component's `CLAUDE.md`.

Stop asking when every value is known. Offer the `grill-me` skill once, in one line, for a project with many open choices; never start it unasked.

### 3. Write

From `${CLAUDE_PLUGIN_ROOT}/templates/`, filling the `{{placeholders}}` and dropping the lines of empty optional values:

| File | From | Notes |
|---|---|---|
| `CLAUDE.md` | `templates/CLAUDE.md` | the manifest block, hard rules, glossary table (empty), local development. An existing `CLAUDE.md` or `AGENTS.md`: keep its content below the manifest, and show the merge before writing. |
| `{path}/CLAUDE.md` per component | the pack's `templates/{kind}.CLAUDE.md` when the stack has a pack and a template for that kind, else `templates/component/CLAUDE.md` | the `component` block, structure, conventions, testing, local run. |
| `.claude/settings.json` | `templates/settings.json` | push denied, timestamp and manifest scripts allowed, `CLAUDE_CODE_SUBAGENT_MODEL` = the preset's runner model. Merge into an existing file, never replace it. |
| `.claude/rules/planning.md`, `.claude/rules/memory.md` | `templates/rules/` | as is. |
| `.claude/skills/{name}/` | the pack's `skills/` | copied for each component whose stack has a pack; a pack skill already present is updated only on a yes. |
| `.planning/technical-debt.md`, `.planning/features/.gitkeep` | `templates/technical-debt.md` | |
| `docs/CONTRIBUTING.md` | `templates/docs/CONTRIBUTING.md` | base branch filled in. An existing one is kept and shown for the person to reconcile. |
| `.claude/local/test-logins.example.md` | `templates/test-logins.example.md` | only when a component has a `url`; `.claude/local/` is added to `.gitignore`. |
| `.gitignore` | | adds `.claude/local/` and `.factory-state/` when missing. |

Write each file with the Write tool; never with shell heredocs.

### 4. Verify

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs"` and show the resolved manifest's summary (name, base branch, preset, stages with their commands). Fix whatever it reports. Check that the plugin's hooks are active (`/hooks` lists `require-runner` and `delegate-exploration`); if the plugin is not enabled for the project, say how (`/plugin`).

### 5. Commit

Propose one commit of the files written, `tools(tooling): factory init`, and make it on the person's yes. Never push. Then the next prompts:

```
/factory:write-spec {first feature}
```
```
/factory:implement {a small change to try the loop}
```

And, when a component's stack has no pack, say in one line that its `CLAUDE.md` Conventions section is the place to grow its rules, and that a pack can be made from it later (`${CLAUDE_PLUGIN_ROOT}/stacks/README.md`).
