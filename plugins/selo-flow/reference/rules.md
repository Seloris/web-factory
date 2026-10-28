# Rules shared by every selo skill

Every skill reads this file first. Each rule lives here once; the skills point to it.

## The project

One repository, one application: `selo.yaml` at the root, a `CLAUDE.md` at the root and one per component, and `.planning/`. The session opens at the root (or at a worktree of it, where ` --worktree` on a prompt also sends it: **Choosing the checkout**) with the plugin loaded; every skill works on that project. Paths in prompts and reports start from the root; git runs there; a component's commands run inside its path (`cd {path} && …`). The plugin's files are read from `${CLAUDE_PLUGIN_ROOT}`.

A component with a `stack` has stack skills in `${CLAUDE_PLUGIN_ROOT}/stacks/{stack}/skills/`: read the one its `CLAUDE.md` names when its step comes. A component with a `skin`: before planning, coding or reviewing its UI, read `reference/ui-design.md`, `skins/README.md`, `skins/recipes.css` and `skins/{skin}/SKIN.md`; its `## Design` section wins.

Useful to two projects or more: the plugin. Specific to one project: its `CLAUDE.md` files, its manifest, its `.claude/skills/`.

## The manifest

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs` from the root and read the JSON: `name`, `baseBranch`, `language`, `models`, `components` (name, path, kind, stack, skin, layers, commands, handoff, needs, logins; `port` and `demoPort`, the base ports; `url`, `serveUrl` and `demoUrl`, computed for this root's run slot, `slot`: base port + 10 × slot, **Running the app**), `stages` and `warnings` (unknown keys, ignored: tell the person). A component with `missingFile` has no `CLAUDE.md`: send the person to `/selo-flow:setup component {name}`. Never parse `selo.yaml` yourself. A component's `CLAUDE.md` loads when you work under its path; read it yourself when you work for it from elsewhere.

## Three lanes

| Lane | When | Prompt |
|---|---|---|
| **Fastlane** | One page or one component, no new entity or business rule | `/selo-flow:fastlane {request}` |
| **Blueprint** | A new page, a new entity or rule, several pages | `/selo-flow:blueprint {request}`, then `/selo-flow:build {blueprint}` |
| **Pilot** | selo picks the lane; ` --autonomous`: the person leaves | `/selo-flow:pilot {request \| blueprint}`, `/selo-flow:pilot {request} --mockup {file}` |

**Arguments.** A word that changes what a command does is a plain word right after it, a subcommand (`/selo-flow:setup update`, `/selo-flow:review blueprint {file}`, `/selo-flow:run web demo`). An option that changes how it does it is `--{name}` at the end of the prompt, after the request (`--autonomous`, `--no-browser`, `--mockup {file}`, `--stage 2`, `--worktree [{name}]`: **Choosing the checkout**); a two-word name takes a hyphen. The old form ` — {name}` (an em dash, two-word names with a space: ` — no browser`) is read the same, so a prompt written by Selo Ops or a session before 2.12.0 still works; a skill writes `--{name}`. Each skill's `argument-hint` shows its arguments after its name; a new subcommand or option updates it in the same change.

A fastlane that meets a new entity or business rule stops before its commit and proposes `/selo-flow:blueprint {same request}`. A free sentence asking to change something is a fastlane.

`/selo-flow:pilot` places the request itself, says the lane in one line (the lane, its exact prompt, why), then runs it in the session with that lane's own questions and yeses. With ` --autonomous` it runs each step as a fresh subagent, with no question (**Autonomous mode**). With ` --mockup {file}` (a validated mockup, **Mockup first**) it passes the mockup to the lane it picks.

**Routing a free request.** A setting of the person, not of the project: `SELO_ROUTING` in the `env` block of `~/.claude/settings.json` (`scripts/settings.mjs` reads it; a new session after a change). `on`: the plugin's lane hook adds a note to every free prompt (not a slash command) in a selo project: a new request to change the application runs the `pilot` skill, said in one line. A prompt that continues work in progress (a skill running, an iterate or mockup loop), answers a question, or asks one gets no lane. Absent or anything else: off, no note.

Two ways for the person to see a change before it is final; drawing and iterating need the person, never in autonomous mode:

- **Mockup first:** `/selo-flow:mockup {request}` draws it as a static HTML file on the front's skin (`.planning/mockups/`), iterated until the person validates it, uncommitted on `baseBranch` (in a worktree, committed on its branch at once, so the lane finds it there: **Choosing the checkout**); then either lane, or `pilot` (interactive or ` --autonomous`), takes ` --mockup .planning/mockups/{file}`, commits the file with its work when it is not yet, and compares the page with it in its browser test.
  **The validated mark.** On the person's validation, the mockup skill writes `<meta name="selo:mockup" content="validated">` in the file's `<head>`, right after its `<title>`, inside the file's first 8 KB; never before. `revise {file}` removes it while the mockup is iterated again, and the next validation writes it back. A file under `.planning/mockups/` that carries this meta and is not committed (on `baseBranch`), or committed on a worktree's branch by `mockup` itself (`docs({page}): mockup — {name}`, once per validation, before any code commit of the work), is validated, waiting to be built: Selo Ops lists the uncommitted ones on its new-session page (a worktree's committed mockup is reached through its `Next:` line, not the board, until selo-ops reads branches), and `pilot --autonomous` builds only such a file.
- **Iterate:** `/selo-flow:fastlane {request} --iterate` runs the app and applies one change per turn, with no test, review or commit, until the person validates; then the fastlane's end runs once on the final state (the spec delta, the tests, the review, the suites, the browser test, the commits on one yes).

Every lane ends the same way: one review of the whole work, the full suites of the touched components (through `runner`), the browser test of a touched front, the commit(s). The browser test runs on the front's demo when it has `commands.demo`, else on its dev server (`commands.serve`, or the "Local run" of its `CLAUDE.md`): it is never skipped for want of a demo. Only the person skips it: ` --no-browser`.

## Running the app

One script starts a project's components: `node ${CLAUDE_PLUGIN_ROOT}/scripts/run.mjs [component … | all] [--demo]`, from the root, behind `/selo-flow:run`, `try` and the project's `selo-run.mjs` (`node selo-run.mjs`, outside a session). Never start a component's server another way when it has a `serve` or a `demo` command.

- **Slots.** Each run takes a slot, so several worktrees run their copy side by side: on slot n every port is the base port + 10 × n (slot 0 = the base ports). The slot is chosen when the run starts: this root's live run is reused, else the slot this root had last when it is free, else the lowest free one; a slot is free when no live run holds it and its ports are free. Recorded in `{git-common-dir}/selo/slots/{n}.json`, one file per slot, shared by every worktree of the repository: the file whose `root` is a worktree gives that worktree's last slot, named with it (**Choosing the checkout**); a worktree that never ran, or whose last slot another root took since, has none.
- **What it starts.** The components named (all by default) and those they `need`, in `stages` order, each awaited on its url: their `demo` with `--demo` when every one of them has one, else their `serve`. Each command gets `PORT`, `SELO_SLOT` and the `{NAME}_URL` of each component it needs. It stays in the foreground (a background command in a session) and prints one `SELO_RUN {json}` line once everything answers: the slot, the mode, each component's url and whether this call `started` it or found it running.
- **Stop.** `run.mjs --stop [component …] [--demo]` stops this root's run, or those components of it (named ones in one mode: dev, or demo with `--demo`). Stop only what you started: a component found running belongs to someone else.
- **Demo.** A slot's demo serves one session at a time: `--demo` exits with code 3 while another live run holds it.

## Specs: pages and domains

```
.planning/
  pages/
    home.md                 one per route of a front: what the person sees and can do there
    todo-detail.md
  domain/
    todo.md                 an entity or a policy used by several pages: glossary, BRs
    app.md                  the shell: layout, navigation, sign-in, errors, i18n
  blueprints/
    2026-10-21-due-date.md  a piece of work in flight, or done (never edited after `Spec merged`)
    assets/
  mockups/
    2026-10-21-due-date.html  a static mockup on the front's skin, marked validated, committed by the lane that builds it
  changelog.md              what changed in the app, one entry per work landed
  ideas.md
  technical-debt.md
```

- **A page spec** (`${CLAUDE_PLUGIN_ROOT}/templates/planning/page.md`) is one route of a front. Its slug is a business name chosen at creation (`home`, `todo-detail`); its header carries the route (`Route: /todos/:id`). FRs grouped by zone of the page, in the order the person meets them.
- **Several fronts:** from the second front on, pages go under `pages/{component}/`, and their slug is `{component}/{page}` (`web/home`); a single-front project stays flat.
- **A domain sheet** (`templates/planning/domain.md`) is what holds whatever the page: the entity's glossary, its BRs, its lifecycle. A page spec cites a domain sheet's ids (`` `todo` BR-01 ``), never restates them. A rule with no page (an API-only rule, a job, an email) is an FR of a domain sheet. `app` is the one reserved sheet, for the shell.
- **Which file gets the rule:** the person sees it on one page → that page; it holds on several pages, or on none → the domain sheet. A slug is unique across `pages/` and `domain/`.
- **A page stub** is a page spec with its title, its `Route:` line and the line `Status: to bootstrap`, nothing else: the page's code exists, its spec is not written yet. `/selo-flow:setup` writes the stubs from an existing front's routes (its **Route scan**); the line goes once the page's FRs are written (**A spec written from code**).
- **Ids are per file:** `home FR-14`, `todo BR-06`. `FR`, `BR`, `US`, `Q` are append-only, never renumbered, never reused; a deleted one goes on the file's `Retired:` line. `node ${CLAUDE_PLUGIN_ROOT}/scripts/spec-check.mjs {slug}` checks a file's ids, and the ids it cites in another file (`` `todo` BR-01 ``), and gives the next free ones.

### Writing a spec

- Present tense: how the page or the domain behaves today. No history, no decisions, no status (a page stub's `Status: to bootstrap` aside), no date: git and the blueprints hold them.
- **Each fact once.** FRs and BRs carry the behaviour; the intro sentence and the Non-goals give context and never restate them.
- An `FR-NN` is one sentence a reviewer can check an implementation against, with its reason (`… so that …`) when not obvious. A `BR-NN` is a policy an implementation could silently break.
- A revised FR or BR is rewritten under its id. A dropped one is deleted and its id added to `Retired:`; never strike through. A doubt is a `Q-NN` in an `## Open questions` section, for the person to decide; once settled it is retired and becomes an FR or a BR.
- Never how: endpoints, tables, components, contracts belong to the blueprint's Technical defaults or to the code.
- Edited with targeted `Edit`s, never redrafted. Written in `language.repo`; business terms of the person's language inline in backticks or « ».

### A spec written from code

A page stub gets its spec from the code that exists (its **bootstrap**): `/selo-flow:setup specs`, or the first fastlane or blueprint that touches the page.

- **Observed behaviour only**, never an intention: what the page shows and does today, read from its code and what it calls (the API routes, their validation and rules).
- What looks like a bug, a dead path, or two pages disagreeing becomes a `Q-NN` of that spec, for the person to decide, never an FR: the spec must not turn a current bug into a requirement.
- A rule that holds on several pages, or in the API whatever the page, goes to a domain sheet as a BR (a new sheet named after the entity, or the next free id of an existing one), and the page cites it.
- The page spec follows the template, FRs by zone; the `Status: to bootstrap` line goes; the header gets its `Domain:`.
- Shown to the person and committed alone, before any other change, on their yes (on a worktree's branch, without a question: it is shown at the landing, whose yes covers it): `docs({page}): bootstrap spec` (several pages at once: `docs(app): bootstrap specs`), body `Spec: {page} +FR-01 +FR-02 · {domain} +BR-03`, every id written out (never a range), checked with `spec-check {slug} --cite`. History keeps what was apart from what changes.

### The spec follows the code

Every change of behaviour updates its page or domain spec, never later than the commit that ships it:

- **Fastlane:** the delta in the same commit as the code. A delta that restates the request is applied without a question; a page with no spec file gets one from the template, FRs only for what this change touches; a page stub is bootstrapped first (**A spec written from code**), in its own commit, then gets the delta; a behaviour the person did not ask for is asked once, grouped, before the commit (in autonomous mode: applied and listed first under Business decisions).
- **Blueprint:** a page stub it touches is bootstrapped before the delta is drafted (its `+` ids and "before" texts come from that spec); the delta lives in the blueprint's `## Spec delta` while it is built; `build` merges it into the specs at the end (**Blueprints**).
- A refactor, a look, a fix restoring the specified behaviour, tooling: no spec change.

Every commit that touches code carries a `Spec:` line in its body, one group per file, ` · ` between them:

- `Spec: home +FR-18 ~FR-03 · todo ~BR-06` — the ids this commit adds, changes, removes;
- `Spec: pending (.planning/blueprints/{file})` — a stage of a blueprint not merged yet: its ids are not final;
- `Spec: none ({reason})` — no behaviour changed.

Before a commit that changes a spec, run `spec-check {slug} --cite "{ids of its group}"` for each file. The plugin's commit hook warns, never blocks: a code commit with no `Spec:` line, ids that do not check, a `pending` blueprint that does not exist or is already merged.

## Blueprints

A blueprint (`templates/planning/blueprint.md`) is one screen: the spec delta, the decisions, the stages and their commit subjects, the tests, the Progress. `/selo-flow:blueprint` writes it and commits it on the person's one yes; the page and domain specs are untouched until the merge. No pseudo-code, no file-level detail: the implementer reads the code it is about to change.

**The Spec delta**, one line per change, `{slug}` being the page or domain file:

```
- {slug} + FR-NN — {the new requirement}
- {slug} ~ FR-NN — « {before} » → « {after} »
- {slug} - FR-NN — « {before} »
- {slug} + Non-goal: « {text} »
- {slug} - Non-goal: « {text} »
```

`BR`, `US` and `Q` take the same forms. A `+` id is provisional: the next free id of the file when the blueprint is written. A `~` or `-` line stores the text it replaces (the "before"); `…` may shorten it, each piece between `…` being quoted exactly. A page that does not exist yet is named in the header's `Pages:` (`` `todo-detail` (new, `Route: /todos/:id`) ``); a new domain sheet in `Domain:`.

**Decisions taken during the build** go under a `### Decided during build` heading at the end of Business decisions or of Technical defaults, `- {question} → {answer} ({reason})`: the person tells at a glance what they approved and what the build chose. A decision that refines or contradicts an FR or a BR also adds its `~` line to the Spec delta, with the "before" text: otherwise the merged spec contradicts the code.

**Lifecycle.** Committed with its delta (`docs({name}): blueprint — {summary}`). `build` runs the stages, one commit each with `Spec: pending (…)`, ticks Progress, then reviews, then merges the delta:

1. `node ${CLAUDE_PLUGIN_ROOT}/scripts/spec-check.mjs --merge {blueprint}` reads the delta against the current specs and prints, for each line, its final id and its status: `ok`, `conflict` (the spec's current text no longer holds the stored "before") or `missing` (the id is gone). It writes nothing.
2. A `conflict` or a `missing` line stops the merge and asks the person (in autonomous mode: the step stops, the stage commits stay).
3. Otherwise the session applies each line to its file (an FR placed under its zone; a new page from the page template), rewrites in the blueprint every provisional id that changed (the delta and every mention), applying the printed `renames` in their order, ticks `Spec merged`, and commits the specs and the blueprint alone: `docs({name}): spec merged`, body the `specLine` the script printed (`Spec: todo-detail +FR-01 … · home +FR-18 · todo ~BR-03`), checked first with `spec-check {slug} --cite`.

A blueprint is never edited after `Spec merged`; a new iteration is a new blueprint. A file of `blueprints/` with a `Legacy:` line under its title is a 1.0 plan moved by `/selo-flow:setup update`: history, never built, revised or listed as open.

## The changelog

`.planning/changelog.md` (`templates/changelog.md`) tells what changed in the application, for someone who reads no spec: the specs say what the app does, the changelog when and how it changed. One entry per piece of work that reaches `baseBranch`, never one per commit.

- **Which work:** a blueprint's; a fastlane's of type `feat` or `fix`, or one the user sees (a look, a visible `perf`). A work of type `refactor`, `test`, `docs`, `tools`, `ops` or `chore` gets none; a review fix or a bootstrap spec belongs to its work, never an entry of its own.
- **The entry:** `- {kind} — {one or two sentences from the user's side: what they can now see or do, never an endpoint, a table or a component}`, plus ` ([blueprint](blueprints/{file}))` for a blueprint's work. The kind: `Added` for a new behaviour, `Changed` for a behaviour that changes, `Fixed` for a fix. Written in `language.repo`, the kinds too.
- **Where in the file:** under the heading `## {YYYY-MM-DD}` of the day (`timestamp.mjs`), added under the file's intro when the newest heading is not today's; the entry first under it. A missing `changelog.md` is created from the template.
- **Its commit:** the work's last commit carries it, never a commit of its own: a build's `docs({name}): spec merged`, a fastlane's last component commit. The entry is shown with that commit's message, so the yes that covers the commit covers it; a commit made without a question (a build's `spec merged` on `baseBranch`, autonomous mode) gives the entry in the report.
- **At a landing**, the sync of a worktree's branch may conflict on `changelog.md` alone: two works added their entry at the same place. Keep both, this work's first, without a question. The entry then moves under today's heading when it was written on an earlier day.
- An entry is history: never rewritten. A later fix of the same feature is a new entry.

## Where commits go

The current branch decides (`git branch --show-current` against `baseBranch`): no manifest key.

Both variants: files named on `git add` (never `-A`, `git add .`, `-a`): it keeps build output and secrets out. Never `--amend`, never push. The `Spec:` line on every code commit. A commit is made with `-m` twice (subject, then body), the simplest form across shells.

### On `baseBranch`: one shared checkout

Work is committed on `baseBranch` as it goes: no feature branch, no squash. Several sessions share the checkout:

- **a fastlane's commits wait for one yes**: their messages shown in code blocks, all made on the person's yes, unless the person's `SELO_COMMIT` is `auto` (`node ${CLAUDE_PLUGIN_ROOT}/scripts/settings.mjs`: `commit`); a build's stage commits need none (the blueprint's yes covers them), nor does autonomous mode;
- commit in one command, naming the files this work wrote: `git add {new files} && git commit --only -m "{subject}" -m "{body}" -- {files}`; `--only` leaves out what other sessions staged;
- a file you must change that holds another session's uncommitted edits: do not write it; wait up to five minutes for that session's commit, else stop and name the file;
- a dirty tree is not a blocker;
- **a work's commits** are those whose subject has its scope (`({name})`), from the one that added the blueprint (`git log --diff-filter=A --format=%H -- {blueprint}`), or the fastlane's own hashes, to `HEAD`: other sessions' commits sit between them, so a review never takes the whole range;
- a suite that fails outside this work's files: list the files other sessions changed (`git status` minus this work's list), say `foreign uncommitted changes in {files}`, do not investigate, commit; the last stage's full suites re-run it.

### On another branch: the worktree variant

The session runs in its own worktree, on its own branch. Commits go on that branch, one per stage or per component, without a question; `--only`, the five-minute wait and the foreign-changes mark do not apply. The work's commits are `{baseBranch}..HEAD`; the review takes that range whole. The validation is the landing on `baseBranch`, one squashed commit, on the person's yes:

1. **Sync.** Bring the branch up to date with `baseBranch`: the desktop app's `sync_with_base_branch` when the session has it, else `git merge {baseBranch}`. A git conflict stops and asks, except on `.planning/changelog.md` alone (**The changelog**).
2. **Merge the spec delta** (a blueprint; a fastlane has none): **Blueprints** steps 1 to 3, against the specs as `baseBranch` has them now, then the full suites of the touched components again (through `runner`).
3. **Show the landing:** the branch and its commits; the decisions taken during the build first, then the Business decisions; the spec delta with its final ids; the changelog entry; the exact message of the one commit in a code block: subject `{type}({name}): {summary}`, body the stages, the Business decisions, the final `Spec:` line. A bootstrap commit of the work (`docs({page}): bootstrap spec`) is folded into it: the body names it and its ids join the `Spec:` line; so is a mockup's commit (`docs({page}): mockup — {name}`), named in the body. One yes.
4. **Squash**, on the yes, from the checkout that holds `baseBranch` (`git worktree list --porcelain`: the worktree whose `branch` is `refs/heads/{baseBranch}`; a base branch cannot be checked out twice). `{files}` = `git diff --name-only --no-renames {baseBranch}...{branch}` (a moved file names both paths). First `git -C {main} status --porcelain -- {files}`: a dirty file there stops the landing before anything is written, and names the file. A `merge --squash` refused because the main checkout has staged changes stops too, and says so. Then `git -C {main} merge --squash {branch}` and `git -C {main} commit --only -m "{subject}" -m "{body}" -- {files}`: `--only` leaves out what other sessions staged there.

No skill removes a worktree or its branch: the person or the desktop app does (after a squash, `git branch -d` refuses the branch; `-D` removes it).

### Choosing the checkout: ` --worktree`

A worktree is a checkout of the repository beside the main one, on its own branch (`git worktree list --porcelain`; the first entry is the main checkout). **Its name** is the last segment of its folder (`.claude/worktrees/due-date` is `due-date`), whatever its branch is called; a prompt may also name it by its branch. **Its slot** is the last one its runs took: `node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs` run there gives `slot`, and the slot files of `{git-common-dir}/selo/slots/` tell slot 0 from none (a file whose `root` is the worktree's path, forward slashes; none: `no slot yet`). The next run may move it (**Running the app**): a slot named in a footer is the last known one.

Every skill that works on the checkout (`pilot`, `fastlane`, `blueprint`, `build`, `mockup`, `review`, `try`, `run`) takes ` --worktree [{name}]`, after the request and its other options, right before ` --autonomous` when there is one (`/selo-flow:pilot {request} --mockup {file} --worktree due-date --autonomous`). It is read first: the worktree is entered before any other check of the prompt (a mockup's or a blueprint's existence, the validated mark, a blueprint's Progress), which then run there.

- **Absent:** the session stays where it was opened; the branch there decides the variant, as above.
- **` --worktree` alone** (`pilot`, `fastlane`, `blueprint`, `build`, `mockup`): a new worktree, named like a blueprint (kebab-case, short, about the result: `due-date`; a blueprint given: its name), created and entered with the session's worktree tool when it has one (its `name`); else `git worktree add {main}/.claude/worktrees/{name} -b {name} {baseBranch}` (under the main checkout, never nested in another worktree), then the session's change-directory tool; without either, stop and say where to open a session: the path, and the same prompt with ` --worktree {name}`. `review`, `try` and `run` have no request to name one from: they take a name only.
- **` --worktree {name}`:** the existing worktree of that name (or that branch), entered the same way (the worktree tool's `path`, else the change-directory tool, else the stop above), from the main checkout or from another worktree alike. None of that name: created under it, as above. The session is already there: nothing to do.

The session stays in the worktree it entered: every later prompt of the session runs there. The uncommitted files this work already wrote in the checkout it leaves (a mockup given with ` --mockup`, a bootstrap already written) are copied into the worktree before the lane goes on, as iterate's **Where** did. Then the skill runs in the worktree variant, and says so in one line before anything else: `Worktree {name} · branch {branch} · slot {n | no slot yet}`. A fresh worktree branched from the remote base by the session's tool is fine: the landing syncs it. In `pilot --autonomous`, the orchestrator moves first, so each subagent starts in the worktree.

**The worktree follows the work.** A step that ended in a worktree names it in its footer's `Next:` lines (**End of turn**), so the next step, typed in any session of the repository or started by Selo Ops, lands there, where the work and its uncommitted files are. A validated mockup drawn in a worktree is committed on its branch for the same reason (**Mockup first**). A lane that stops because a mockup or a blueprint is absent from this checkout names the worktrees that hold it (`git worktree list`, `git -C {path} log -- {file}`).

## Subagents

The session leads: it plans, decides, writes. Each subagent is spawned with its role's model from the resolved manifest's `models`, a setting of the person, not of the project: `SELO_MODELS` (the preset, `standard` by default) and `SELO_MODEL_{ROLE}` in the `env` block of `~/.claude/settings.json` (`docs/manifest.md`, "Models"; a new session after a change):

- `reviewer`: every review, always a subagent (it has no stake in the code);
- `runner`: a command whose output floods the context (a full suite, a build, a lint run); it returns the errors with `file:line`;
- `Explore` (`models.explorer`): a broad search; for a task that needs judgment, `general-purpose` on `models.implementer`.

Always pass the role's model: the plugin's model hook is the guard, not the source. It puts `reviewer` and `runner` on their role's model whatever the call names, `Explore` and `Plan` on `explorer` and `planner` when the call names none, and leaves any other agent as called (`docs/manifest.md`, "Models").

Put the role first in the spawn's description (`runner · web tests`). A blueprint or an implementation is not a subagent's job, except under `pilot --autonomous`. A subagent without the Agent tool runs its commands itself, filtered to the errors, and says what it could not delegate.

## Decisions

Recorded in two lists, in the blueprint (in the fastlane, in the commit body and the report): **Business decisions** (at most five: a rule, a label, a scope, a new page or domain sheet, what the person would want to check) and **Technical defaults** (the rest, one line each), `- {question} → {answer} ({reason})`. Those `build` takes go under `### Decided during build` (**Blueprints**). A spec holds no decisions.

## Writing code

How `fastlane` and `build` write application code; the reviewer checks it (its **Simplicity** check). Less code is fewer tokens written, read and reviewed, and fewer bugs.

- **Only what is asked:** what the request or the blueprint says, nothing more: no extra feature, refactor, comment or doc on code you did not change.
- **Reuse before writing:** an existing helper of the project, then the framework, then the language's standard library, then an installed package, then new code. A new dependency is a Technical default.
- **The smallest change that works:** no abstraction for one use (an interface with one implementation, a helper called once, a layer the component's `CLAUDE.md` does not declare), no option or parameter nobody sets, no code for a case the specs and the request do not name. Editing or deleting code beats adding it.
- **Never cut to write less:** validation, error handling, authorization and scope checks, data safety, accessibility, i18n, and the tests the lane requires (tests first, as the lane says).
- **A deliberate shortcut is said:** a Technical default (in `build`, under `### Decided during build`) that names its limit; one the project will have to pay back also gets its line in `.planning/technical-debt.md`, in that file's format.

## Autonomous mode

Only `pilot` turns it on, by ending a step's prompt with ` --autonomous`; `pilot` gets it the same way, from Selo Ops' new-session page: a person never types it. No question: each takes its recommended answer. A question with no defensible answer stops the step, with nothing committed. The hard rules hold. A mockup given (` --mockup {file}`) is already validated: no question about it; a missing file, or one without the validated mark (**Mockup first**), stops `pilot` before its first step.

## Language

Talk to the person in `language.chat`. Write everything in the repository in `language.repo`: code, identifiers, comments, contracts, tests, commit messages, blueprints, specs, instruction files. User-facing strings follow the application's own rules. Messages between agents use the caveman voice (`reference/caveman.md`); rewrite in normal prose what the person reads.

## Hard rules

- **Never push.** No `git push`, no publishing a branch. A human pushes.
- **Never run `integration_tests`** or a suite calling real external systems unless the person asked, in this session, naming them. "Check" or "why does this test fail" is not such a request: give the filtered command instead.
- **Silence is not approval.** A blueprint, a spec written with the person, a landing on `baseBranch`: committed only after their yes.

## Commits

`{type}({scope}): {summary}`, type in `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `tools`, `ops`, `chore`. The scope: a blueprint's commits use the blueprint's name (`feat(due-date): api — optional due date on a todo`); a fastlane commit uses the page it touches (`fix(home): …`), else the domain sheet (`fix(todo): …`), `app` for the shell, `tooling` for the tooling. A stage commit is `{type}({name}): {stage} — {summary}`. The project's `docs/CONTRIBUTING.md` wins.

A commit that needs the person's yes shows its exact message (subject and body) in a code block, as the last text of the turn, in the same message as the question or the call that shows it (a next-step box with a yes button is fine); never a bare "Commit?". The yes approves the commit and its message. A commit made without a question (a stage) uses the subject announced beforehand: the blueprint's Stages line, or the one stated before coding; when the work drifted, the report says the subject used and why.

## End of turn

When the job committed, end with the done footer, the very last lines:

```markdown
---
## ✅ JOB DONE
> {one line in language.chat, at most 120 characters: what the whole job achieved}
`{short hash}` {subject} · branch `{branch}` · not pushed
Changelog: {the work's entry, as written in .planning/changelog.md, without its leading "- "}
Next: {one line in language.chat: what the step does, and where to run it} · `{prompt}`
```

- **The recap line** says what the whole job achieved, from its prompt to this footer, not only the last turn: a build stopped on a question (a semantic conflict, a landing) and resumed on the answer spans several turns. Never the commit subject again.
- **One line per commit.** In the worktree variant, before the landing: `` `{short hash}` {subject} · branch `{branch}` · not merged ``; after it, the squashed commit: `` `{short hash}` {subject} · merged into `{baseBranch}` · not pushed ``.
- **The changelog line.** The turn that committed the work's entry of `.planning/changelog.md` (**The changelog**) gives it once, after the commit lines: `Changelog: {kind} — {text}`, as written in the file. `Changelog:` stays in English. No line when the work has no entry, or when this turn did not write it.
- **The next steps.** A workflow step ends with its next prompt(s) here, one `Next:` line each, after the commit lines, the most likely first: the summary in language.chat, then the prompt in backticks, real paths filled in (``Next: {Build the 2 stages, best in a new session, in language.chat} · `/selo-flow:pilot .planning/blueprints/2026-10-21-due-date.md` ``). `Next:` stays in English, whatever language.chat is. A next step that builds a request or a blueprint is one `Next:` line, `/selo-flow:pilot {request | blueprint}` (with its ` --mockup {file}`), never one line per lane: pilot picks the lane, and moves to the blueprint lane when a fastlane meets a new entity or rule. It carries ` --autonomous` when the step that just ended ran with it, never otherwise. **It carries ` --worktree {name}`** when the step that just ended ran in a worktree (**Choosing the checkout**), before ` --autonomous`, and its summary names the worktree and its slot: ``Next: {Build it, in the worktree due-date (slot 2), in language.chat} · `/selo-flow:pilot {request} --mockup .planning/mockups/{file} --worktree due-date` `` (`no slot yet` when it never ran); on `baseBranch`, neither. The next prompts appear only there, never again in code blocks above the footer. No `Next:` line when the skill gives none (autonomous mode, a blueprint done).
- A free request answered without a commit ends with the recap line alone, and its `Next:` lines when it has some, so "done, nothing to commit" never looks like "stopped halfway".
- No footer when the turn stops on a question, or on a failure before any commit; a stop after commits still ends with the footer.
- **The status line.** Every turn that does not end with the footer (a question, a commit waiting for its yes, a failure, a stop, a turn of an iterate or mockup loop) gives where the job stands in one line of its own: `Status: {one line in language.chat, at most 120 characters: what is done, what is left or blocks}`. `Status:` stays in English. It sits right before the question, or before the commit's code block, so they stay the last text; otherwise it is the last line. Never the question again, never a list of what the turn did.

Selo Ops reads these shapes from the turn's last message (the ops export of the `selo-feed` plugin): the footer as the last lines flags the job done, its `Changelog:` line is the run's changelog entry, and its `Next:` lines are the run's next steps (summary and prompt); the last `Status:` line, else the footer's recap line, is the turn's recap, and the session's recap is made of them; a commit message in a code block as the last text, its first line `{type}({scope}): …`, flags a commit waiting for its yes; a last line ending with `?`, or the question of a next-step box, flags a question. A turn that ends on none of them shows as ended without its footer.

## Marks

`fastlane` and `build` mark where they are, one Bash call at each change: `node ${CLAUDE_PLUGIN_ROOT}/scripts/ops.mjs mark {substep} [sheet …]`, `{substep}` one of `bootstrap` (the spec of a page stub), `tests` (tests written, red), `code`, `suites`, `review`, `try`, `merge` (the delta merged), `commit`. A fastlane's first mark names its page (`mark tests home`). The script prints nothing and changes nothing: a hook reads the command for Selo Ops. A forgotten mark loses detail on the dashboard, never a state.

## A 1.0 project

A project still in the 1.0 shape, the layout of factory 0.8 and selo-flow 1.0 (a `factory.yaml` or a `selo-flow.yaml` instead of `selo.yaml`, or a `.planning/features/*/00_spec.md`), is migrated first: `fastlane`, `blueprint`, `build`, `pilot` and `review` say so, change nothing, and give `/selo-flow:setup update`, which moves its areas to pages and domain sheets and its plans to legacy blueprints.
