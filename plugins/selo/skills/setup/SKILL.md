---
name: setup
description: "Set up the current repository as a selo project: interview the person (name, base branch, language, one model per role, sign-in, then each component: name, path, kind, description, stack, commands, skin, ports, the stack pack's placeholders; an existing front's routes scanned and given one page stub each), write its selo.yaml manifest and CLAUDE.md, one autonomous CLAUDE.md per component (from the stack pack when one exists), .planning/, .claude/settings.json (the plugin enabled, push denied), the selo-run.mjs launcher that starts the app outside a session (and the stack pack's shortcut, npm run app), the planning and memory rules and docs/CONTRIBUTING.md. Also adds a component (setup component {component}), changes the models (setup models {role=model …}), switches a front component's skin (setup skin {component} {skin}) re-applies a stack pack (setup stack {component} {stack}), writes the specs of the page stubs from the existing code (setup specs [page …]: one explorer per page, observed behaviour only, doubts as open questions, shared rules to domain sheets, one yes, one commit), or brings an existing project up to date with the installed plugin (setup update: the plugin's tagged blocks rewritten, its own files overwritten, missing keys added; a 1.0 project migrated to 2.0: selo-flow.yaml renamed selo.yaml, its area specs moved to page specs and domain sheets, its plans moved to .planning/blueprints/ as legacy, ports instead of urls, the stack pack's missing commands added). Writes no application code of its own: a component whose stack pack ships a code skeleton gets it copied, installed and checked (build and test green) when its folder is empty, and a front gets its skin's tokens copied and, when its pack has a font table, the skin's fonts installed."
---

# Set up a project

Turns the repository the session opened into a project the selo workflow can run on. It writes instructions and, for a component whose stack pack ships a code skeleton, copies that skeleton into its empty folder so the first stage starts on green commands; it writes no application code of its own.

Read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` first (the project, language, hard rules, commits). Talk to the person in their language from the first message (ask in the language they used).

## Modes

- `/selo:setup` with no `selo.yaml` at the root: full setup (below). An empty folder is fine: `git init` with the base branch when there is no repository yet; the person brings the code, or the stack pack's skeleton does.
- `/selo:setup` with a manifest: say what exists and offer the partial modes, `update` first when the manifest's `selo` version is older than the plugin's (or absent), or when the project is still 1.0 (a `selo-flow.yaml` or a `factory.yaml` instead of `selo.yaml`, or a `.planning/features/*/00_spec.md`).
- `/selo:setup component {component}`: interview for one component, write its `CLAUDE.md`, add it to the manifest's `components`.
- `/selo:setup models {preset|role=model …}`: change the manifest's `models` and the `env.CLAUDE_CODE_SUBAGENT_MODEL` of `.claude/settings.json` (the `runner` model).
- `/selo:setup skin {component} {skin}`: give a front component a skin, or switch it (one of `${CLAUDE_PLUGIN_ROOT}/skins/`; list them from the table of `skins/README.md` when the skin is not given). Sets `skin: {skin}` in the component's `component` block, copies `${CLAUDE_PLUGIN_ROOT}/skins/{skin}/tokens.css` over the tokens file its stack pack names under `## Skin` (else the one its `## Design` section names, else ask), creates the pack's `overrides.css` beside it only when absent (never overwrite it: it is the application's), and adds the pack template's `## Design` section to the component's `CLAUDE.md` when it has none. The fonts follow when the pack has a font table under `## Skin` and the component holds the fonts file it names: the previous skin's row packages removed, the new row's installed, the fonts file rewritten (see Fonts below). Beyond these files (the tokens, the fonts file, the package manifest and its lock file) it never edits application code: wiring the theme files into an existing front that lacks them (imports, fonts file, shared components) is a blueprint's work, and the next prompt says so (`/selo:blueprint apply the {skin} skin to {component}`). Runs the manifest check and the component's `build`, then proposes one commit (`tools(tooling): {component} skin {skin}`, body `Spec: none (tooling)`).
- `/selo:setup update`: bring the project up to date with the installed plugin, as **Update** below says.
- `/selo:setup specs [page …]`: write the spec of every page stub from the code, or of the stubs named, as **Specs** below says.
- `/selo:setup stack {component} {stack}`: re-apply a stack pack's template to an existing component (its `CLAUDE.md` is rewritten: ask first, and keep its Conventions section); when the component's path holds no code (nothing but its `CLAUDE.md`), its skeleton is copied with the skin's tokens and fonts, installed and verified as in the full setup.

## Full setup

### 1. Look around first

Facts you collect yourself, never ask: `git rev-parse --abbrev-ref HEAD` and `git branch -a` (base branch candidates), the top-level folders and the obvious component roots (a build tool's root file under a folder: `package.json`, `pyproject.toml`, `go.mod`, a solution or workspace file…), existing `CLAUDE.md`, `AGENTS.md`, `.claude/`, `docs/CONTRIBUTING.md` (never overwrite them silently: show what you would change). List the stack packs available: the folders of `${CLAUDE_PLUGIN_ROOT}/stacks/`, each with the `README.md` first line as its description. A front component root that already holds code (more than a `CLAUDE.md`) is an **existing front**: it gets the route scan (round 2, item 9).

### 2. Interview

In the `grill` format (the session's question tool, 1 to 4 questions per call, the recommended answer first, in the person's language; numbered questions in chat only without that tool). Round 1, the project:

1. **Name** (recommended: the repository folder name) and a one-line description.
2. **Base branch** (recommended: the current one if it is `main`, `master` or `develop`, else `main`).
3. **Languages**: chat (recommended: the one they are writing in) and repository (recommended: `en`); the application's own UI language.
4. **Models**, one per role, each `opus`, `sonnet`, `haiku` or `fable`: planner (spec, plan), implementer (code), reviewer, runner (mechanical work), explorer (searches); recommended: the `standard` preset (opus, sonnet, opus, haiku, haiku), shown as the five answers so the person changes a role by name (`planner fable`). Every recommendation accepted writes `models: standard`; otherwise a map with `preset: standard` and the changed roles only.
5. **Components**: the list, from what you found (recommended: one per detected root, named `api`, `web`, `db`, `worker`… by kind), with their order of implementation (which needs which).
6. **Sign-in**: whether the application has accounts to sign in with (recommended: from the description). It decides the `logins` file and the packs' authentication placeholders.

Round 2, one round per component (merge small ones):

1. **Path** (relative to the root), **kind** (`api`, `front`, `db`, `worker`, `lib`) and a one-line **description** (the title of its `CLAUDE.md`: `# {{name}} — {{description}}`).
2. **Stack**: one of the packs, or free text for a stack with no pack.
3. **Layers**, in implementation order (recommended from the pack, else a sensible default for the kind: `[Domain, Application, Infrastructure, Api]` for an API, `[data, pages, ui]` for a front).
4. **Commands**: `build`, `test`, `lint` (with `{files}` where the changed files go), and when relevant `prepare`, `handoff` with the handoff file, `integration_tests` with `{filter}`; recommended from the pack, else from the detected tool (`npm run build`, `make build`…). Leave out what the component does not have (a front with no unit tests has no `test`).
5. **Skin** for a front: one of `${CLAUDE_PLUGIN_ROOT}/skins/`, each with its one-line look from the table of `skins/README.md` (recommended: `modern`).
6. **Port** of a front's dev server (recommended: the one its dev server uses; a front with a `port` is browser-tested) and, when the application has a sign-in, the **logins** file (recommended: `.claude/local/test-logins.md`); no `logins` otherwise.
7. **Local run**: how to start it and its dependencies, for the component's `CLAUDE.md`; for a component that runs a server, its `serve` command (recommended from the pack, with any prerequisite chained before it, else the detected dev script) and, for a component that is not a front, its `port` (where it answers locally); then its `demo` command and `demo_port` (recommended from the pack: seeded data on its own port), which `try` runs on by default. `port` and `demo_port` are base ports (a run on slot n adds 10 × n); they go where the pack's template puts them (its component block), else in the component's entry of `selo.yaml`.
8. **Pack placeholders**: when the stack has a pack, the values its `README.md` lists under `## Placeholders` that the items above did not give, each with the recommended value the pack states. An optional placeholder left empty drops its line.
9. **Route scan**, for an existing front only: scan its routes now and give each page an empty spec (recommended), or later (`/selo:setup specs`). On the yes, run **Route scan** below once the components are known; its list is validated in the next round.

Stop asking when every value is known. Offer the `grill` skill once, in one line, for a project with many open choices; never start it unasked.

### 3. Write

Into the project, from the plugin's `${CLAUDE_PLUGIN_ROOT}/templates/`, filling the `{{placeholders}}` and dropping the lines of empty optional values:

| File | From | Notes |
|---|---|---|
| `selo.yaml` | `templates/selo.yaml` | the manifest; `{{plugin_version}}` is the `version` of `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`. |
| `CLAUDE.md` | `templates/CLAUDE.md` | description, hard rules, glossary table (empty), local development (the components' Local run sections condensed in stage order: what to start first, on which url, what each needs). An existing `CLAUDE.md` or `AGENTS.md`: keep its content below the template's, and show the merge before writing. |
| `{path}/CLAUDE.md` per component | the pack's `templates/{kind}.CLAUDE.md` when the stack has a pack and a template for that kind, else `templates/component/CLAUDE.md` | the `component` block, structure, conventions, testing, local run. |
| `.claude/settings.json` | `templates/settings.json` | the `selo` marketplace known and the plugin enabled (`{{selo_marketplace}}`: the folder holding the marketplace's `.claude-plugin/marketplace.json`, or its repository: the value an existing `.claude/settings.json` already has, else walk up from `${CLAUDE_PLUGIN_ROOT}` to that file; the plugin's own folder is not the marketplace), push denied, the timestamp, manifest, spec-check and run scripts and the ops marks allowed, `CLAUDE_CODE_SUBAGENT_MODEL` = the `runner` role's model. Merge into an existing file, never replace it. |
| `.claude/rules/planning.md`, `.claude/rules/memory.md` | `templates/rules/` | as is. |
| `selo-run.mjs` | `templates/selo-run.mjs` | as is: the launcher that starts the app outside a session (`node selo-run.mjs [component \| all] [--demo]`, the rules' **Running the app**); it finds the plugin installed for the project and runs its `run.mjs`. |
| the launcher's shortcut | the used packs' `## Ports` section | only when a pack names one (`react-express`: `npm run app` in a root `package.json`): written as the section says, each script added when missing, an existing file merged, never replaced. |
| `.planning/technical-debt.md`, `.planning/ideas.md` | `templates/technical-debt.md`, `templates/ideas.md` | `pages/`, `domain/` and `blueprints/` are created by the first spec or blueprint (or the route scan's page stubs), never with a placeholder file. |
| `.planning/pages/{slug}.md` per validated route | **Route scan** below | only for an existing front scanned in round 2: one page stub each, committed apart (step 5). |
| `docs/CONTRIBUTING.md` | `templates/docs/CONTRIBUTING.md` | base branch filled in. An existing one is kept and shown for the person to reconcile. |
| `.claude/local/test-logins.example.md` | `templates/test-logins.example.md` | only when a component has `logins`. |
| `.gitignore` | the used packs' `gitignore` files | adds `.claude/local/` and the lines of each used pack's `gitignore` file (when the pack has one), each line when missing. |
| the skin's tokens per front component | `${CLAUDE_PLUGIN_ROOT}/skins/{skin}/tokens.css` | copied as is to the path the pack names under `## Skin` (react-express: `src/shared/ui/theme/skin.css`), after the skeleton; the pack's `overrides.css` is created when absent. A front with no pack: `skin: {skin}` in its block (`{{optional_fields}}`) and a `## Design` section naming the tokens file the person chose (recommended: `src/theme/skin.css`). |
| the skin's fonts per front component | the pack's font table under `## Skin`, the row of the skin | only when the pack has a font table and the component received its skeleton: the fonts file the pack names written with the row's imports, and the row's packages installed, pinned, with the pack's command, after the skeleton's install. See Fonts below. |
| `{path}/**` per component | the pack's `skeleton/{kind}/` when the pack has one for that kind | only when the component's path holds nothing but its `CLAUDE.md`: every file copied as is, placeholders filled, then the install command the pack's `README.md` names under `## Skeleton`, run from the component's path. A folder that already holds code is left alone, and the person is told so. |

**Fonts.** The skin's `SKIN.md` names its faces and weights; the stack pack decides how they load. A pack that self-hosts them has a font table under `## Skin`: one row per skin, the pinned packages and the exact import lines of its fonts file. Read the skin's `SKIN.md` and check that the row covers its faces; then use the row as written, never a package or weight guessed from `SKIN.md`. A face of `SKIN.md` the row lacks is a gap of the pack: say so. A row with no package (a skin on system fonts) leaves the fonts file empty and installs nothing. A skin the table does not list yet (a new skin) is a gap of the pack: say so, leave the fonts file empty (the tokens' fallback stack applies), and propose the row as a plugin change.

**Tagged blocks.** The plugin's parts of a file the project also writes in (the root `CLAUDE.md`, `docs/CONTRIBUTING.md`, `.claude/rules/memory.md`) sit between `<!-- selo:begin {id} -->` and `<!-- selo:end {id} -->` lines, as the templates carry them: write them with their tags. `setup update` rewrites what is between them and nothing else; the project writes outside them.

**Route scan.** How an existing front's pages are found, here, in `specs` and in **From 1.0** step 2:

1. **Read the routes**: where the stack pack's `README.md` says under `## Routes`; with no pack or no such section, an `Explore` subagent (`models.explorer`) reads the front (its router, its page folders) and returns each route's path and page module. Leave out what is not a page: a layout (the shell: `domain/app.md`), a redirect, not found.
2. **Validate the list**, one grouped question: each route with its recommended slug (a business name from the page module or the path, as the rules' **Specs: pages and domains** say: `/` → `home`, `/todos/:id` → `todo-detail`), the routes the pack's reading could not place named apart. The person renames a slug, merges two routes into one page, or drops one.
3. **Write a page stub** per validated route, `.planning/pages/{slug}.md` (`pages/{component}/{slug}.md` from the second front on), never over an existing file: the template's title (the page's business name) and header line (`Route: {path}`, no `Domain:` yet), then the line `Status: to bootstrap`, nothing else. The rules' **Specs: pages and domains** say what that line means; `/selo:setup specs`, or the first fastlane or blueprint on the page, writes its FRs.

A pack's skills are not copied: they stay in `${CLAUDE_PLUGIN_ROOT}/stacks/{stack}/skills/` and the skills read them from there (see the workflow rules). Write each file with its exact content: no shell expansion of `$`, backticks or `{{…}}` on the way (the Write tool, or a quoted heredoc).

### 4. Verify

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs` and show the resolved manifest's summary (name, base branch, the model of each role, stages with their commands). Fix whatever it reports. Then, for each component that received a skeleton, run its `build` and `test` commands as the resolved manifest gives them, from the component's path: both must pass with the skeleton alone. A failure is a defect of the pack, not of the project: report it with the output and stop short of patching the skeleton in the project.

### 5. Commit

Propose one commit of the files written, the copied skeletons and their lock files included (never the installed dependencies: the pack's `gitignore` covers them), with its message in a code block (`tools(tooling): selo setup`, and a body listing the files and ending with `Spec: none (tooling)`), and make it on the person's yes. The route scan's page stubs, when there are any, are a second commit made on the same yes, shown beside the first in its own code block: `docs(app): bootstrap specs`, the body listing each stub with its route and ending with `Spec: none (page stubs, to bootstrap)`. Never push. Then the next prompts:

```
/selo:run
```
(the app on this worktree's slot, its URLs; outside a session `node selo-run.mjs`, or the pack's shortcut.)
```
/selo:blueprint {first page or feature}
```
```
/selo:setup specs
```
(only when page stubs were written: their FRs from the code, all at once.)
```
/selo:fastlane {a small change to try the loop}
```

And, when a component's stack has no pack, say in one line that its `CLAUDE.md` Conventions section is the place to grow its rules, and that a pack can be made from it later (`${CLAUDE_PLUGIN_ROOT}/stacks/README.md`).


## Specs

`/selo:setup specs` writes the spec of every page stub (the rules' **Specs: pages and domains**) from the code; `/selo:setup specs home todo-detail` only of those. The rules' **A spec written from code** say what goes in it. A 1.0 project (the rules' **A 1.0 project**): say so and give `/selo:setup update`.

1. **The pages.** Every `.planning/pages/**/*.md` with a `Status: to bootstrap` line, or the slugs named: a named page that already has its spec is skipped and said; a name with no file is not a page (say so, and offer it as a stub). No page spec at all and a front that holds code: run the **Route scan** first (its list validated, its stubs written), then go on with them.
2. **Explorers.** One `Explore` subagent (`models.explorer`) per page, in parallel, each with the page's route and module (from the scan, or the router), a caveman-voice task: read the page and what it calls, return the zones in the order the person meets them, the behaviour of each as candidate FRs, the rules it relies on with where they are enforced (the page, the API), and what looks wrong (a bug, a dead path, a difference with another page). Observed behaviour only; they write nothing.
3. **Write**, in this session: the page specs from `${CLAUDE_PLUGIN_ROOT}/templates/planning/page.md`, the rules found on several pages or in the API to domain sheets (`templates/planning/domain.md`, or the existing sheet, its next free ids), each page citing them; the doubts as `Q-NN`. Then `node ${CLAUDE_PLUGIN_ROOT}/scripts/spec-check.mjs {slug}` on every file written.
4. **Show it**, one round: a link to each file, its FRs counted by zone, the domain BRs in full, every `Q-NN` in full. The person corrects a reading with targeted edits; then **one yes** for the whole set, the commit message in a code block: `docs(app): bootstrap specs` (one page: `docs({page}): bootstrap spec`), body the files and the `Spec:` line of every file, every id written out, never a range (`Spec: home +FR-01 +FR-02 +FR-03 · todo +BR-01 +BR-02`), checked with `spec-check {slug} --cite` first. On the yes, commit those files alone, as the rules' **Where commits go** say. Never push.
5. **Next prompt:** `/selo:review {slug}` for a page whose reading the person doubts; else the lanes (`/selo:fastlane`, `/selo:blueprint`).

## Update

`/selo:setup update` brings a project set up by an earlier version up to date with the installed plugin: the routine steps on every update, and, for a 1.0 project, the **From 1.0** steps that move it to the 2.0 layout. A 1.0 project still has the old plugin enabled: the person installs this one first (`/plugin install selo@selo` from the same marketplace folder), then runs `/selo:setup update`, which rewrites the project's settings to it.

### 1. Version and shape

- The plugin's version is the `version` of `${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json`.
- The manifest is `selo.yaml`. A 1.0 project has `selo-flow.yaml`, a project from before 1.0.0 `factory.yaml`: `git mv {old} selo.yaml` first, then run the manifest script. The project's version is its `selo` (or, in a renamed manifest, the old `selo-flow:` key, which the script reports as unknown); none: before 1.0.0.
- **A 1.0 project** is one whose manifest was renamed here, whose version is below 2.0.0, or that has a `.planning/features/*/00_spec.md`. It gets the **From 1.0** steps.
- Already the plugin's version and not 1.0: say so and stop.

Look first, ask once, write after: collect every fact of the steps below, put the questions of **From 1.0** (steps 2, 3, 5, 7, 9) to the person in one round, grouped, the recommended answer first, then write.

### 2. Routine steps

1. **Tagged blocks.** In the root `CLAUDE.md`, `docs/CONTRIBUTING.md` and `.claude/rules/memory.md`, rewrite each block from its template, placeholders rendered from the manifest (one the manifest does not hold, such as `{{ui_language}}`, keeps the value the block had): what is between a block's two tags is replaced, nothing outside them moves. The 1.0 tags (`<!-- selo-flow:begin {id} -->`, `<!-- selo-flow:end {id} -->`) are the same blocks, rewritten with the `selo:` tags. A block the template has and the file lacks is inserted after the block that precedes it in the template; a block the template no longer has is removed. A file with no tag at all (a project from before 1.0.0) is rewritten from the template once, carrying over the project's own parts into it (description, glossary rows, local development, memory entries and known failing tests, what the project added to `CONTRIBUTING.md`); the report asks the person to read its `git diff`.
2. **The plugin's own files** are overwritten from the templates: `.claude/rules/planning.md`, `selo-run.mjs` (written when absent), and `.claude/local/test-logins.example.md` when a component has `logins`.
3. **Missing keys are added, values kept:**
   - `selo.yaml`: `selo: {plugin version}` as its first line, set or replaced (a `selo-flow:` key removed); no other key invented.
   - `.claude/settings.json`, merged as JSON: the template's missing `permissions` entries, an old `git * push:*` deny rule replaced by the template's `git -C * push*` and `git -c * push*` (Claude Code reads `:*` after a `*` as a literal, so the old one never matched). The marketplace: an old `selo-flow` or `webapp-factory` entry of `extraKnownMarketplaces` becomes `selo` (same source); `selo-flow@selo-flow` and `factory@webapp-factory` become `selo@selo`, their values kept; the board's entries (`selo-flow-board@selo-flow`, `factory-board@webapp-factory`) are removed: the board is gone. Nothing else moves.
   - `.gitignore`: the lines `setup` adds (`.claude/local/`, the used packs' `gitignore` lines), each when missing.
   - Files `setup` writes that the project lacks (`.planning/ideas.md`, `.planning/technical-debt.md`, `.claude/rules/memory.md`): created from their templates.
   - The launcher's shortcut of each used pack's `## Ports` section (`react-express`: the `app` and `app:demo` scripts of the root `package.json`), each script when missing.
4. **Old names in the project's own text:** outside the tagged blocks, the instruction files (`CLAUDE.md` files, `.claude/rules/`, `docs/`) get `factory.yaml` and `selo-flow.yaml` replaced by `selo.yaml`, the prompts `/factory:{skill}` and `/selo-flow:{skill}` by `/selo:{skill}`, the skills renamed on the way (`init` and `factory-init` → `setup`, `implement` → `fastlane`, `grill-me` → `grill`, `test-in-browser` → `try`, also when a sentence names the skill without its prefix), and the plugin's old name in prose (`the selo-flow plugin`, `selo-flow init`) by `selo`, nothing else. Never under `.planning/`: only **From 1.0** touches specs and plans.
5. **Never touched:** application code (except the files step 9 of **From 1.0** adds), `overrides.css`, memory entries, `ideas.md`, `technical-debt.md`, a component `CLAUDE.md` beyond the words of step 4 and the keys of steps 8 and 9 of **From 1.0**.

### 3. From 1.0

The nine steps that move a 1.0 project to the 2.0 layout of the rules (**Specs: pages and domains**, **Blueprints**). Files are moved with `git mv`, so their history follows.

1. **Manifest.** Done by steps 1 and 2.3: `selo.yaml`, `selo: {plugin version}`.
2. **Areas become pages or domain sheets.** For each `.planning/features/{slug}/00_spec.md`: a page when the area describes what one route of a front shows (`.planning/pages/{slug}.md`, or `pages/{component}/{slug}.md` with two fronts or more), else a domain sheet (`.planning/domain/{slug}.md`). The routes come from the front, as **Route scan** step 1 says. Asked once per area, with the recommendation from the routes found (`home` and the route `/` → page `home`). A page's slug stays the area's; the route goes in its header. A route that no area covers is offered in the same round as a page stub (**Route scan** steps 2 and 3, recommended), written in the migration commit.
3. **Shared rules move to domain sheets.** The BRs, the glossary rows and the Non-goals that hold for an entity rather than for one page (an entity's rules, its terms, what it never does) go to a domain sheet named after the entity (`domain/todo.md`), and the page cites them (`` `todo` BR-01 ``) instead of restating them. Proposed in the same round as step 2 (the sheet, what moves to it), never silent. A moved id keeps its number in its new file; the old file does not retire it: the migration commit records the map.
4. **Specs rewritten to the templates** (`${CLAUDE_PLUGIN_ROOT}/templates/planning/page.md`, `domain.md`), in the same pass: the header `Route: {path} · Domain: {sheet}`; one or two intro sentences from the TL;DR; the FRs grouped by zone of the page, in the order the person meets them (the old UX Flow gives the order); the Non-goals split between the page and the sheet. Dropped: the title's `— PRD`, the `Slug`, `Status` and `Last updated` lines, the `TL;DR`, `Problem` and `UX Flow` sections (their facts are in the FRs, or were context), the glossary's `Status` column. Every `FR`, `BR`, `US` and `Q` keeps its id and its text; the only words added are the citations of the moved BRs. Then the `reviewer` agent (`models.reviewer`) compares each old spec with its new files: every id present once, no meaning changed, nothing restated; its findings are fixed before the person sees the result.
5. **Plans become legacy blueprints.** Each `.planning/features/{slug}/dev-plans/{YYYYMMDD}-{HHmmss}-{type}-{name}/plan.md` is moved to `.planning/blueprints/{YYYY-MM-DD}-{name}.md` (two plans of the same day and name: the second keeps its type, `{YYYY-MM-DD}-{type}-{name}.md`), its `assets/` to `.planning/blueprints/assets/{YYYY-MM-DD}-{name}/`, with the links in it rewritten. One line is inserted under its title, nothing else changes: `Legacy: 1.0 plan, moved from {old folder} by setup update.` A plan is done when every stage of its Progress and its Review are ticked. An unfinished plan is also rewritten as a blueprint, `.planning/blueprints/{today}-{name}.md` from the blueprint template: the stages left, its Business decisions and Technical defaults one line each, its Tests, the delta of step 6; its Legacy line ends `superseded by {blueprint file}`. Asked in the round: rewrite it (recommended), or leave it legacy, unfinished, for the person to finish by hand. An area's own `assets/` go to `.planning/blueprints/assets/{slug}/`, the spec links rewritten. The emptied `.planning/features/` is removed, its `.gitkeep` with it.
6. **`(planned)` FRs go back to their blueprint.** An FR marked `(planned)` whose plan is unfinished leaves the spec and becomes a `+` line of that blueprint's delta, its id kept as the provisional one. A `(planned)` mark whose plan is done is stale: the mark is removed, the FR kept, and the report names it.
7. **The project's instruction files.** The root `CLAUDE.md` tagged blocks are rewritten by step 2.1 (the `/selo:` prompts, the specs and commits of 2.0, the footer without the board). The 1.0 wording the project wrote outside the tags (`.planning/features/`, `00_spec.md`, `write-spec`, `write-plan`, a plan folder, "the board", "Feature specs introduce new entries", the `<slug>` of `docs/CONTRIBUTING.md`'s Format section) is proposed in the round with the templates' 2.0 wording, and rewritten on the yes. Text outside the tags that is still word for word the 1.0 template's (the types, Format and Examples sections of `docs/CONTRIBUTING.md`) is replaced by the 2.0 template's without a question, and named in the report.
8. **Ports instead of urls.** Each component's `url` and `serve_url` become `port`, its `demo_url` `demo_port`, the port of the url, where the key was (the `components` entry of `selo.yaml` or the component block); a front keeps a `port`, so it stays browser-tested; a `serve_url` on the port of its `url` is dropped. A url that is not `http://localhost:{port}` stays as it is and the report names it. When the stack pack's `README.md` has a `## Ports` section, the component's dev and demo scripts are changed as it says (`PORT`, and the `{NAME}_URL` of each component it `needs`); otherwise the scripts are left as they are.
9. **The stack pack's missing commands.** For a component with a stack pack, each command of the pack's template block (`templates/{kind}.CLAUDE.md`) that the component's block lacks (the `react-express` pack's `demo`) is added, with what backs it: the pack's skeleton files it runs (`skeleton/{kind}/`) copied when absent, placeholders filled, and its script added to the component's package manifest; `demo` also gets `demo_port`, the pack's recommended port. When backing it would change a file the component already has (a config file with no demo mode), the pack's file, placeholders filled from the component's values, is shown beside the component's in the round: on the yes it replaces it when the component's file is still the pack's older shape (only the pack's change differs), else the change is merged into it; on a no, the command is not added and the report gives the prompt that adds it: `/selo:fastlane tooling: add the {command} of {component} from the {stack} pack`. A copied file the project must fill (an empty demo seed) is named in the report. Then that component's `build` and `test` run (through `runner`) and must be green.

### 4. Verify

Run the manifest script, as in the full setup, and fix what it reports. For a 1.0 project, also `node ${CLAUDE_PLUGIN_ROOT}/scripts/spec-check.mjs {slug}` on every page and domain file (its ids well formed, none twice).

### 5. Report and commit

What changed for the person since the project's version, from the plugin's `CHANGELOG.md` entries in between, in a few lines; for a 1.0 project, the area-to-file map, the plans moved and the blueprints written, the ports, the commands added and those left as a prompt. Then one commit of the files changed, its message in a code block, on the person's yes: `chore(tooling): selo update {from} → {to}` (`{from}` is `0.x` before 1.0.0), its body the same map, ending with `Spec: none (tooling: specs moved, no behaviour changed)`. Never push. End by telling the person to open a new session (`CLAUDE.md` files and the plugin load at its start), and with the next prompt of each blueprint written by step 5: `/selo:build {blueprint}`.
