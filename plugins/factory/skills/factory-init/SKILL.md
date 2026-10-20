---
name: factory-init
description: "Set up the current repository as a factory project: interview the person (name, base branch, language, one model per role, sign-in, then each component: name, path, kind, description, stack, commands, skin, url, the stack pack's placeholders), write its factory.yaml manifest and CLAUDE.md, one autonomous CLAUDE.md per component (from the stack pack when one exists), .planning/, .claude/settings.json (the plugin enabled, push denied), the planning and memory rules and docs/CONTRIBUTING.md. Also adds a component (factory-init component {component}), changes the models (factory-init models {role=model …}), switches a front component's skin (factory-init skin {component} {skin}) or re-applies a stack pack (factory-init stack {component} {stack}). Writes no application code of its own: a component whose stack pack ships a code skeleton gets it copied, installed and checked (build and test green) when its folder is empty, and a front gets its skin's tokens copied and, when its pack has a font table, the skin's fonts installed."
---

# Init a project

Turns the repository the session opened into a project the factory workflow can run on. It writes instructions and, for a component whose stack pack ships a code skeleton, copies that skeleton into its empty folder so the first stage starts on green commands; it writes no application code of its own.

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first (the project, language, hard rules, commits). Talk to the person in their language from the first message (ask in the language they used).

## Modes

- `/factory:factory-init` with no `factory.yaml` at the root: full setup (below). An empty folder is fine: `git init` with the base branch when there is no repository yet; the person brings the code, or the stack pack's skeleton does.
- `/factory:factory-init` with a manifest: say what exists and offer the three partial modes.
- `/factory:factory-init component {component}`: interview for one component, write its `CLAUDE.md`, add it to the manifest's `components`.
- `/factory:factory-init models {preset|role=model …}`: change the manifest's `models` and the `env.CLAUDE_CODE_SUBAGENT_MODEL` of `.claude/settings.json` (the `runner` model).
- `/factory:factory-init skin {component} {skin}`: give a front component a skin, or switch it (one of `${CLAUDE_PLUGIN_ROOT}/skins/`; list them from the table of `skins/README.md` when the skin is not given). Sets `skin: {skin}` in the component's `component` block, copies `${CLAUDE_PLUGIN_ROOT}/skins/{skin}/tokens.css` over the tokens file its stack pack names under `## Skin` (else the one its `## Design` section names, else ask), creates the pack's `overrides.css` beside it only when absent (never overwrite it: it is the application's), and adds the pack template's `## Design` section to the component's `CLAUDE.md` when it has none. The fonts follow when the pack has a font table under `## Skin` and the component holds the fonts file it names: the previous skin's row packages removed, the new row's installed, the fonts file rewritten (see Fonts below). Beyond these files (the tokens, the fonts file, the package manifest and its lock file) it never edits application code: wiring the theme files into an existing front that lacks them (imports, fonts file, shared components) is a plan's work, and the next prompt says so (`/factory:write-plan {slug}: apply the {skin} skin to {component}`). Runs the manifest check and the component's `build`, then proposes one commit (`tools(tooling): {component} skin {skin}`).
- `/factory:factory-init stack {component} {stack}`: re-apply a stack pack's template to an existing component (its `CLAUDE.md` is rewritten: ask first, and keep its Conventions section); when the component's path holds no code (nothing but its `CLAUDE.md`), its skeleton is copied with the skin's tokens and fonts, installed and verified as in the full setup.

## Full setup

### 1. Look around first

Facts you collect yourself, never ask: `git rev-parse --abbrev-ref HEAD` and `git branch -a` (base branch candidates), the top-level folders and the obvious component roots (a build tool's root file under a folder: `package.json`, `pyproject.toml`, `go.mod`, a solution or workspace file…), existing `CLAUDE.md`, `AGENTS.md`, `.claude/`, `docs/CONTRIBUTING.md` (never overwrite them silently: show what you would change). List the stack packs available: the folders of `${CLAUDE_PLUGIN_ROOT}/stacks/`, each with the `README.md` first line as its description.

### 2. Interview

In the `grill-me` format (numbered questions, each with a recommended answer phrased so that "yes" accepts it, at most 7 per round, in the person's language). Round 1, the project:

1. **Name** (recommended: the repository folder name) and a one-line description.
2. **Base branch** (recommended: the current one if it is `main`, `master` or `develop`, else `main`).
3. **Languages**: chat (recommended: the one they are writing in) and repository (recommended: `en`); the application's own UI language.
4. **Models**, one per role, each `opus`, `sonnet`, `haiku` or `fable`: planner (spec, plan), implementer (code), advisor (consulted by the implementer), reviewer, runner (mechanical work), explorer (searches); recommended: the `standard` preset (opus, sonnet, opus, opus, haiku, haiku), shown as the six answers so the person changes a role by name (`planner fable`). Every recommendation accepted writes `models: standard`; otherwise a map with `preset: standard` and the changed roles only.
5. **Components**: the list, from what you found (recommended: one per detected root, named `api`, `web`, `db`, `worker`… by kind), with their order of implementation (which needs which).
6. **Sign-in**: whether the application has accounts to sign in with (recommended: from the description). It decides the `logins` file and the packs' authentication placeholders.

Round 2, one round per component (merge small ones):

1. **Path** (relative to the root), **kind** (`api`, `front`, `db`, `worker`, `lib`) and a one-line **description** (the title of its `CLAUDE.md`: `# {{name}} — {{description}}`).
2. **Stack**: one of the packs, or free text for a stack with no pack.
3. **Layers**, in implementation order (recommended from the pack, else a sensible default for the kind: `[Domain, Application, Infrastructure, Api]` for an API, `[data, pages, ui]` for a front).
4. **Commands**: `build`, `test`, `lint` (with `{files}` where the changed files go), and when relevant `prepare`, `handoff` with the handoff file, `integration_tests` with `{filter}`; recommended from the pack, else from the detected tool (`npm run build`, `make build`…). Leave out what the component does not have (a front with no unit tests has no `test`).
5. **Skin** for a front: one of `${CLAUDE_PLUGIN_ROOT}/skins/`, each with its one-line look from the table of `skins/README.md` (recommended: `modern`).
6. **Url** for a front (recommended: the one its dev server uses) and, when the application has a sign-in, the **logins** file (recommended: `.claude/local/test-logins.md`); no `logins` otherwise.
7. **Local run**: how to start it and its dependencies, for the component's `CLAUDE.md`; for a component that runs a server, its `serve` command (recommended from the pack, with any prerequisite chained before it, else the detected dev script) and, when it has no `url`, its `serve_url` (where it answers locally), so `test-in-browser` can start it.
8. **Pack placeholders**: when the stack has a pack, the values its `README.md` lists under `## Placeholders` that the items above did not give, each with the recommended value the pack states. An optional placeholder left empty drops its line.

Stop asking when every value is known. Offer the `grill-me` skill once, in one line, for a project with many open choices; never start it unasked.

### 3. Write

Into the project, from the plugin's `${CLAUDE_PLUGIN_ROOT}/templates/`, filling the `{{placeholders}}` and dropping the lines of empty optional values:

| File | From | Notes |
|---|---|---|
| `factory.yaml` | `templates/factory.yaml` | the manifest. |
| `CLAUDE.md` | `templates/CLAUDE.md` | description, hard rules, glossary table (empty), local development (the components' Local run sections condensed in stage order: what to start first, on which url, what each needs). An existing `CLAUDE.md` or `AGENTS.md`: keep its content below the template's, and show the merge before writing. |
| `{path}/CLAUDE.md` per component | the pack's `templates/{kind}.CLAUDE.md` when the stack has a pack and a template for that kind, else `templates/component/CLAUDE.md` | the `component` block, structure, conventions, testing, local run. |
| `.claude/settings.json` | `templates/settings.json` | the `webapp-factory` marketplace known and the plugin enabled (`{{factory_marketplace}}`: the folder holding the marketplace's `.claude-plugin/marketplace.json`, or its repository: the value an existing `.claude/settings.json` already has, else walk up from `${CLAUDE_PLUGIN_ROOT}` to that file; the plugin's own folder is not the marketplace), push denied, timestamp and manifest scripts allowed, `CLAUDE_CODE_SUBAGENT_MODEL` = the `runner` role's model. Merge into an existing file, never replace it. |
| `.claude/rules/planning.md`, `.claude/rules/memory.md` | `templates/rules/` | as is. |
| `.planning/technical-debt.md`, `.planning/ideas.md`, `.planning/features/.gitkeep` | `templates/technical-debt.md`, `templates/ideas.md` | |
| `docs/CONTRIBUTING.md` | `templates/docs/CONTRIBUTING.md` | base branch filled in. An existing one is kept and shown for the person to reconcile. |
| `.claude/local/test-logins.example.md` | `templates/test-logins.example.md` | only when a component has `logins`. |
| `.gitignore` | the used packs' `gitignore` files | adds `.claude/local/` and the lines of each used pack's `gitignore` file (when the pack has one), each line when missing. |
| the skin's tokens per front component | `${CLAUDE_PLUGIN_ROOT}/skins/{skin}/tokens.css` | copied as is to the path the pack names under `## Skin` (react-express: `src/shared/ui/theme/skin.css`), after the skeleton; the pack's `overrides.css` is created when absent. A front with no pack: `skin: {skin}` in its block (`{{optional_fields}}`) and a `## Design` section naming the tokens file the person chose (recommended: `src/theme/skin.css`). |
| the skin's fonts per front component | the pack's font table under `## Skin`, the row of the skin | only when the pack has a font table and the component received its skeleton: the fonts file the pack names written with the row's imports, and the row's packages installed, pinned, with the pack's command, after the skeleton's install. See Fonts below. |
| `{path}/**` per component | the pack's `skeleton/{kind}/` when the pack has one for that kind | only when the component's path holds nothing but its `CLAUDE.md`: every file copied as is, placeholders filled, then the install command the pack's `README.md` names under `## Skeleton`, run from the component's path. A folder that already holds code is left alone, and the person is told so. |

**Fonts.** The skin's `SKIN.md` names its faces and weights; the stack pack decides how they load. A pack that self-hosts them has a font table under `## Skin`: one row per skin, the pinned packages and the exact import lines of its fonts file. Read the skin's `SKIN.md` and check that the row covers its faces; then use the row as written, never a package or weight guessed from `SKIN.md`. A face of `SKIN.md` the row lacks is a gap of the pack: say so. A row with no package (a skin on system fonts) leaves the fonts file empty and installs nothing. A skin the table does not list yet (a new skin) is a gap of the pack: say so, leave the fonts file empty (the tokens' fallback stack applies), and propose the row as a plugin change.

A pack's skills are not copied: they stay in `${CLAUDE_PLUGIN_ROOT}/stacks/{stack}/skills/` and the skills read them from there (see the workflow rules). Write each file with its exact content: no shell expansion of `$`, backticks or `{{…}}` on the way (the Write tool, or a quoted heredoc).

### 4. Verify

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs` and show the resolved manifest's summary (name, base branch, the model of each role, stages with their commands). Fix whatever it reports. Then, for each component that received a skeleton, run its `build` and `test` commands as the resolved manifest gives them, from the component's path: both must pass with the skeleton alone. A failure is a defect of the pack, not of the project: report it with the output and stop short of patching the skeleton in the project.

### 5. Commit

Propose one commit of the files written, the copied skeletons and their lock files included (never the installed dependencies: the pack's `gitignore` covers them), with its message in a code block (`tools(tooling): factory init`, and a body listing the files), and make it on the person's yes. Never push. Then the next prompts:

```
/factory:write-spec {first feature}
```
```
/factory:implement {a small change to try the loop}
```

And, when a component's stack has no pack, say in one line that its `CLAUDE.md` Conventions section is the place to grow its rules, and that a pack can be made from it later (`${CLAUDE_PLUGIN_ROOT}/stacks/README.md`).
