# Changelog

Why each rule of the process exists. A rule changes with the case that motivated it; the entry says which. Newest first.

## 2026-10-17 — The PGlite folder ignored wherever the api lives

- **`react-express`'s `gitignore` matches `**/.data/pglite/`.** On the sample, the first `npm run db:migrate` left some 900 PGlite files untracked under `api/.data/pglite/`: the pack's line `.data/pglite/` has a slash inside it, so git anchors it to the `.gitignore` that holds it, the project's root, never the api component's folder. The line is now unanchored; `.data/.gitkeep` stays tracked. Projects initialised earlier replace the old line in their `.gitignore`.

## 2026-10-17 — The Validation records the tests

- **A `Tests` item in the plan's Validation.** On the sample's `init-home` plan the board showed the review to do, but nothing said whether the tests had run: every stage runs its component's full suite, and no line of the plan recorded it. Whenever a touched component declares `commands.test`, the Validation now holds `Tests: the full test command of {components} green on the plan's final code`; the last stage runs the other listed suites beside its own and ticks it.
- **The final review settles the whole Validation.** The board's `Revue finale` step counted every Validation item (`0/2`: review and browser test), while `— final review` ran only the reviewer, and no prompt ran a browser test after its stage. The final review now asks first which optional items to run (tests, browser test, integration tests), runs the review, then each item the person said yes to.
- **A declined check is `[-]`, with its reason.** Closing the branch needed every item ticked, so a browser test the person declined blocked the close forever. An optional item the person declines is marked `- [-] {item}: not run ({reason})`: the plan says it was not run and why, the close accepts it, the board counts it as settled. `Review` is never declined.

## 2026-10-17 — The prompt names the stage

- **`implement` reads the stage from the prompt.** The board and `write-plan` prepared a bare `/factory:implement {plan folder}`, so nothing in the prompt said which stage a session was about to run, and chaining the stages, which the skill already allowed when the prompt asks for it, had no prompt of its own. The next prompts now name it: `— stage {N} ({component})` for one stage, `— stages {N}-{M} ({components}), chained` for every remaining one in one session, still one commit per stage. A named stage must be the one Progress picks; otherwise the skill stops and says where Progress is.
- **The board's band names the run's own stage.** While stage 1's session was finishing (its boxes ticked, its commit not made yet) the band and the live sessions read `Stage 2 — web en cours`: the label was the plan's next stage, recomputed at each scan. It is now the step the run was started on; a chained run moves to its next stage at each stage commit.

## 2026-10-17 — A stack pack ships its code skeleton

- **`factory-init` applies the pack's skeleton to an empty component.** Running `factory-init` on `samples/todo-app` with the `react-express` pack left `api/` and `web/` holding nothing but a `CLAUDE.md`, so the first `implement` stage would have had to invent the whole technical foundation the component's `CLAUDE.md` already describes (structure, package scripts, test setup). The mechanism the stacks README reserved is now real: a pack may ship `skeleton/{kind}/`, the minimum for which the template's commands pass with zero features, and `factory-init` copies it when the component's path holds nothing but its `CLAUDE.md`, fills the placeholders, runs the install command the pack's README names, and checks that `build` and `test` are green before the init commit. The skill still writes no application code of its own; a folder that already holds code is left alone.
- **`react-express` ships `skeleton/api` and `skeleton/front`**, each with one proof that the chain works: `GET /health` with its Supertest route test, which becomes the recommended `{{reference_tests}}` in place of `none yet`; the front ships an empty but valid `src/api/schema.d.ts` so `build` passes before the first `handoff` / `prepare`.

## 2026-10-17 — A committed spec is approved

- **The spec's commit approves it.** The `home` spec of the sample was committed after the person's explicit yes and still read `Draft`, waiting for a plan to approve it, and the board showed the `write-spec` session as still waiting for an answer. The yes to the commit is the approval: `write-spec` switches `Status` to `Approved` just before the spec's first commit, and an approved spec stays so; plans and stages update it through called mode, in their own commit. `write-plan` still approves a spec it drafted in called mode, or one committed before this rule.
- **The board closes a run at its commit.** A run went from `running` to `waiting` at each turn end and stayed so until the session ended, whether the skill asked a question or was done. Every factory skill ends its job with a commit, so a successful `git commit` in the session's main loop marks its run `✓ terminé`; the spec status reads `brouillon` or `validée`.

## 2026-10-17 — `factory-init` tried for real on the sample

Running `/factory:factory-init` on the empty `samples/todo-app` (pack `react-express`, an api and a web component, no sign-in) made the person invent what the interview did not ask and fix what the templates assumed.

- **The interview asks the pack's placeholders.** The pack's README listed placeholders "asked by factory-init" that no round asked; round 2 now ends with them, read from the pack's `## Placeholders` table with its recommended values, after a one-line description per component (the title of its `CLAUDE.md`) that was not asked either. The root `CLAUDE.md`'s local development section is now described (the components' Local run condensed in stage order).
- **Sign-in is a question, not an assumption.** The pack's templates hard-coded the `logins:` line and the authenticated calls of the API tests, and the logins example file was written whenever a component had a `url`. Round 1 asks whether the application has a sign-in; `logins` and `{{authenticated_calls}}` are optional placeholders whose lines drop when empty, and the example file is written only when a component has `logins`.
- **A pack ships its `gitignore`.** The pack said `.data/pglite` was git-ignored and nothing wrote it; a pack may now carry a `gitignore` file whose lines `factory-init` appends to the project's `.gitignore`.
- **The marketplace is the repository, not the plugin's folder.** The skill recommended `${CLAUDE_PLUGIN_ROOT}` for `{{factory_marketplace}}`; it now points at the folder holding `.claude-plugin/marketplace.json`, keeping an existing value.
- **Exact content, whatever the tool.** "Write tool, never heredocs" conflicted with the harness asking for Bash in auto mode; the rule is now what mattered: no shell expansion on the file's content.

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
