# Changelog

Why each rule of the process exists. A rule changes with the case that motivated it; the entry says which. Newest first.

## 2026-10-17 — The browser test starts the servers

- **`test-in-browser` starts the local servers that do not answer.** At the browser test of `samples/todo-app`'s home plan both servers (api, web) were down; the skill could only hand the start commands over and wait, so the person had to authorise the start by hand, and asked for the default to be reversed. The skill now checks the tested component and the components it `needs`, starts each silent one in the background in stage order, waits for it to answer (bounded, then reports its error and stops), never touches a server that already answers, and says in its report which servers it started and left running.
- **The start command is in the manifest.** A new `commands.serve` and a `serve_url` per component, read by `scripts/manifest.mjs` (`serveUrl`, defaulting to `url`), rather than a command picked out of the "Local run" prose: the parser stays the one reader of how a component runs. `serve_url` is not `url`, which makes a component browser-tested. A component without them (projects initialised earlier, `samples/todo-app` among them) falls back to its `CLAUDE.md` "Local run" for both the command and the address, and the report suggests adding the keys; with no address at all the server cannot be checked, so the skill asks. The `react-express` pack chains the migrations before the API's dev server (`npm run db:migrate && npm run dev`): `serve` only runs when the API is down, which is when PGlite allows a migration.

## 2026-10-17 — Commit messages proposed before the commit

- **Every commit question shows its message.** The pack's commit was asked as a bare "commit?", and the person only saw the message once it was in the history, too late to correct it cheaply. A request to approve a commit now shows the exact message in a code block, and the yes covers both. The rule is in the workflow rules (`## Commits`), in the template of a project's `CLAUDE.md` (for requests made outside a skill), and in this repository's `CLAUDE.md`.
- **Stage subjects are announced with the plan.** A stage commit is made without a question, so its subject is now written beforehand: a `Commit:` line under each stage of the plan's Progress, approved with the plan, or the approach without a plan. `implement` uses it and says so when the work made it change. Projects initialised earlier get the `Commit:` line by updating their `.claude/rules/planning.md` from the template.

## 2026-10-17 — A TypeScript pack replaces the .NET / Angular one

- **`react-express` replaces `dotnet-angular`.** The next projects are full TypeScript (React front, Express API), and a pack is only worth keeping for a stack a project uses; the .NET / Angular pack stays in git history (last present in `7fdb9ac`). The workflow does not change: the same `handoff` / `prepare` pair carries the API contract to the front (OpenAPI generated from zod, types generated with `openapi-typescript`), and the same table-driven skills read their facts from the component's `CLAUDE.md` (`drizzle-migrations` for `ef-migrations`, `write-api-tests` for `write-integration-tests`, `openapi-client` rewritten).
- **PostgreSQL through PGlite for local runs and tests.** The database had to run with `npm ci` alone, on Windows, for anyone trying a project: PGlite is PostgreSQL in WebAssembly, in the Node process, with no Docker and no native build; deployment uses a real PostgreSQL with the same migrations. SQLite was set aside: its drivers need a native addon or a given Node version, and moving to PostgreSQL later means rewriting the migrations.
- **Route tests run with the fast suite.** They hit an in-memory PGlite, no external system, in seconds: the reason integration tests never run unasked does not apply, so they belong to the api component's `test` and run at the end of every stage. The pack declares no `integration_tests`; the rule still holds for tests that reach real systems.

## 2026-10-17 — The pane set aside, the plugin used from the project

- **`factory-helper` is out of the marketplace.** It followed the workflow while the workflow still moved, so it lagged behind the skills; it comes back once the workflow settles (last present in `b794003`). New projects no longer enable it, `factory-init` no longer ignores its `.factory-state/` folder, and the docs no longer send the person to it for the next step's model: the manifest's preset says which model each role is meant for.
- **The plugin reaches into no project.** `dev.ps1`, which started a project's session from this repository with the plugin loaded from disk, is gone, with the paths of the projects the plugin was tried on. A project installs the plugin from the marketplace and uses it; the plugin knows nothing of any project but the one its session runs in.

## 2026-10-16 — The lead chooses its subagents

- **The two hooks are gone** (`require-runner`, `delegate-exploration`, with the manifest's `hooks:` switches and `FACTORY_ALLOW_INLINE_RUNS`). `require-runner` denied a one-line `find` to the lead working on the plugin itself, and every denial costs a round trip and a workaround; the exploration counter denied the fifth `Grep` of a search that needed six. The model knows when a full test suite or a build would flood its context, and the workflow rules now say what each subagent is for (`runner`, `Explore`, `reviewer`, `architect`, `senior-dev`) and leave the call to the lead. Only the review stays a subagent by rule: its value is in having no stake in the code.
- **The model guard is gone.** Three skills checked the session's model against their role and re-spawned themselves on the right one; the person already picks the session's model, and the pane shows the one recommended for the next step. A subagent is still spawned with its role's model.
- **Integration tests: the rule, not the ritual.** They still never run unasked; the lead no longer has to quote the person's request word for word to `runner`, and `runner` no longer refuses without the quote.

## 2026-10-16 — A plugin, one project per repository

- **The repository is the plugin** (`plugins/factory/`, `plugins/factory-helper/`, their marketplace); each project is a repository of its own that enables it. Two other layouts were tried the same day and dropped: projects as separate repositories under a git-ignored `workspaces/` folder of the plugin's repository (every git command needed the project's path, the parent `CLAUDE.md` leaked into nested sessions), then a monorepo holding the plugin and the apps (a project selection in every prompt and in the pane, for a benefit no project needed yet). One project per session: nothing to pick, paths start at the root.
- **`factory.yaml` replaces the ```factory block of the root `CLAUDE.md`.** A tool reads the manifest without parsing Markdown, and the parser finds it from any folder of the project. The component block stays in each component's `CLAUDE.md`: a component keeps its instructions when it moves.
- **What goes where.** Useful to two projects or more: the plugin. Specific to one project: that project. The rule keeps the plugin reusable and the projects' quirks out of it.
- **Skills under the `factory:` prefix** (`/factory:implement`), the plugin's namespace, so a project's own skills never collide with them.
- **The pane reads the folder it runs in.** No project list, no selection: the session is the project.

## 2026-10-16 — Founding rules

Brought from the tooling of one .NET / Angular project, where each of them was learnt the hard way.

- **Never push.** An agent that pushes publishes a mistake before a human saw it; a human pushes.
- **One stage per session.** A stage spanning two components in one session ran out of context mid-way and lost track; a fresh session resumes from the plan's Progress ticks and the branch's commits.
- **Review before every stage commit**, by a read-only agent with no stake in the code: the author of a change does not see what it misses.
- **Silence is not approval.** A spec or plan committed on an unanswered summary was reworked twice; it is committed only after an explicit yes.
- **Mechanical work goes to `runner`.** Build, test and lint output floods the lead's context and buries the decision it has to make; a hook denied those commands in the lead session, and the lead read a short report. (Hook dropped the same day, see above; the advice stays.)
- **Exploration bursts are capped.** A lead reading twenty files in a row drifted from the task; past a few calls a hook sent the search to a cheap subagent. (Dropped the same day, see above.)
- **Integration tests never run unasked.** They hit real systems (databases, containers, external services) and take minutes; the person names them when they want them.
- **The spec has one writer** (`write-spec`). Specs edited from a plan or from code drifted from the business meaning; every delta goes through the skill and ships with the change that motivated it.
- **Model guard.** A plan written on the implementer's model was shallower than one written on the planner's; each skill checked the session's model against its role and delegated when it did not fit. (Dropped the same day, see above; the preset still says which model each role is meant for.)
- **Caveman voice between agents**, normal prose for the person: tokens between agents are cost without a reader.
- **Stack-agnostic skills.** The words of a stack live in `stacks/` packs and in the components' `CLAUDE.md`, never in the skills, so the same workflow runs on the next project without porting.
