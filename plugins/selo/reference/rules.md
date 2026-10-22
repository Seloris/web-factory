# Rules shared by every selo skill

Every skill reads this file first. Each rule lives here once; the skills point to it.

## The project

One repository, one application: `selo.yaml` at the root, a `CLAUDE.md` at the root and one per component, and `.planning/`. The session opens at the root (or at a worktree of it) with the plugin loaded; every skill works on that project. Paths in prompts and reports start from the root; git runs there; a component's commands run inside its path (`cd {path} && …`). The plugin's files are read from `${CLAUDE_PLUGIN_ROOT}`.

A component with a `stack` has stack skills in `${CLAUDE_PLUGIN_ROOT}/stacks/{stack}/skills/`: read the one its `CLAUDE.md` names when its step comes. A component with a `skin`: before planning, coding or reviewing its UI, read `reference/ui-design.md`, `skins/README.md`, `skins/recipes.css` and `skins/{skin}/SKIN.md`; its `## Design` section wins.

Useful to two projects or more: the plugin. Specific to one project: its `CLAUDE.md` files, its manifest, its `.claude/skills/`.

## The manifest

Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs` from the root and read the JSON: `name`, `baseBranch`, `language`, `models`, `components` (name, path, kind, stack, skin, layers, commands, handoff, needs, logins; `port` and `demoPort`, the base ports; `url`, `serveUrl` and `demoUrl`, computed for this root's run slot, `slot`: base port + 10 × slot, **Running the app**), `stages` and `warnings` (unknown keys, ignored: tell the person). A component with `missingFile` has no `CLAUDE.md`: send the person to `/selo:setup component {name}`. Never parse `selo.yaml` yourself. A component's `CLAUDE.md` loads when you work under its path; read it yourself when you work for it from elsewhere.

## Three lanes

| Lane | When | Prompt |
|---|---|---|
| **Fastlane** | One page or one component, no new entity or business rule | `/selo:fastlane {request}` |
| **Blueprint** | A new page, a new entity or rule, several pages | `/selo:blueprint {request}`, then `/selo:build {blueprint}` |
| **Autopilot** | The person leaves | `/selo:autopilot {request \| blueprint}` |

A fastlane that meets a new entity or business rule stops before its commit and proposes `/selo:blueprint {same request}`. A free sentence asking to change something is a fastlane.

Every lane ends the same way: one review of the whole work, the full suites of the touched components (through `runner`), the browser test of a touched front, the commit(s). The browser test runs on the front's demo when it has `commands.demo`, else on its dev server (`commands.serve`, or the "Local run" of its `CLAUDE.md`): it is never skipped for want of a demo. Only the person skips it: ` — no browser`.

## Running the app

One script starts a project's components: `node ${CLAUDE_PLUGIN_ROOT}/scripts/run.mjs [component … | all] [--demo]`, from the root, behind `/selo:run`, `try` and the project's `selo-run.mjs` (`node selo-run.mjs`, outside a session). Never start a component's server another way when it has a `serve` or a `demo` command.

- **Slots.** Each run takes a slot, so several worktrees run their copy side by side: on slot n every port is the base port + 10 × n (slot 0 = the base ports). The slot is chosen when the run starts: this root's live run is reused, else the slot this root had last when it is free, else the lowest free one; a slot is free when no live run holds it and its ports are free. Recorded in `{git-common-dir}/selo/slots/{n}.json`, shared by every worktree of the repository.
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
  ideas.md
  technical-debt.md
```

- **A page spec** (`${CLAUDE_PLUGIN_ROOT}/templates/planning/page.md`) is one route of a front. Its slug is a business name chosen at creation (`home`, `todo-detail`); its header carries the route (`Route: /todos/:id`). FRs grouped by zone of the page, in the order the person meets them.
- **Several fronts:** from the second front on, pages go under `pages/{component}/`, and their slug is `{component}/{page}` (`web/home`); a single-front project stays flat.
- **A domain sheet** (`templates/planning/domain.md`) is what holds whatever the page: the entity's glossary, its BRs, its lifecycle. A page spec cites a domain sheet's ids (`` `todo` BR-01 ``), never restates them. A rule with no page (an API-only rule, a job, an email) is an FR of a domain sheet. `app` is the one reserved sheet, for the shell.
- **Which file gets the rule:** the person sees it on one page → that page; it holds on several pages, or on none → the domain sheet. A slug is unique across `pages/` and `domain/`.
- **A page stub** is a page spec with its title, its `Route:` line and the line `Status: to bootstrap`, nothing else: the page's code exists, its spec is not written yet. `/selo:setup` writes the stubs from an existing front's routes (its **Route scan**); the line goes once the page's FRs are written (**A spec written from code**).
- **Ids are per file:** `home FR-14`, `todo BR-06`. `FR`, `BR`, `US`, `Q` are append-only, never renumbered, never reused; a deleted one goes on the file's `Retired:` line. `node ${CLAUDE_PLUGIN_ROOT}/scripts/spec-check.mjs {slug}` checks a file's ids and gives the next free ones.

### Writing a spec

- Present tense: how the page or the domain behaves today. No history, no decisions, no status (a page stub's `Status: to bootstrap` aside), no date: git and the blueprints hold them.
- **Each fact once.** FRs and BRs carry the behaviour; the intro sentence and the Non-goals give context and never restate them.
- An `FR-NN` is one sentence a reviewer can check an implementation against, with its reason (`… so that …`) when not obvious. A `BR-NN` is a policy an implementation could silently break.
- A revised FR or BR is rewritten under its id. A dropped one is deleted and its id added to `Retired:`; never strike through. A doubt is a `Q-NN` in an `## Open questions` section, for the person to decide; once settled it is retired and becomes an FR or a BR.
- Never how: endpoints, tables, components, contracts belong to the blueprint's Technical defaults or to the code.
- Edited with targeted `Edit`s, never redrafted. Written in `language.repo`; business terms of the person's language inline in backticks or « ».

### A spec written from code

A page stub gets its spec from the code that exists (its **bootstrap**): `/selo:setup specs`, or the first fastlane or blueprint that touches the page.

- **Observed behaviour only**, never an intention: what the page shows and does today, read from its code and what it calls (the API routes, their validation and rules).
- What looks like a bug, a dead path, or two pages disagreeing becomes a `Q-NN` of that spec, for the person to decide, never an FR: the spec must not turn a current bug into a requirement.
- A rule that holds on several pages, or in the API whatever the page, goes to a domain sheet as a BR (a new sheet named after the entity, or the next free id of an existing one), and the page cites it.
- The page spec follows the template, FRs by zone; the `Status: to bootstrap` line goes; the header gets its `Domain:`.
- Shown to the person and committed alone, before any other change, on their yes (on a worktree's branch, without a question: it is shown at the landing, whose yes covers it): `docs({page}): bootstrap spec` (several pages at once: `docs(app): bootstrap specs`), body `Spec: {page} +FR-01 +FR-02 · {domain} +BR-03`, every id written out (never a range), checked with `spec-check {slug} --cite`. History keeps what was apart from what changes.

### The spec follows the code

Every change of behaviour updates its page or domain spec, never later than the commit that ships it:

- **Fastlane:** the delta in the same commit as the code. A delta that restates the request is applied without a question; a page with no spec file gets one from the template, FRs only for what this change touches; a page stub is bootstrapped first (**A spec written from code**), in its own commit, then gets the delta; a behaviour the person did not ask for is asked once, grouped, before the commit (under autopilot: applied and listed first under Business decisions).
- **Blueprint:** a page stub it touches is bootstrapped before the delta is drafted (its `+` ids and "before" texts come from that spec); the delta lives in the blueprint's `## Spec delta` while it is built; `build` merges it into the specs at the end (**Blueprints**).
- A refactor, a look, a fix restoring the specified behaviour, tooling: no spec change.

Every commit that touches code carries a `Spec:` line in its body, one group per file, ` · ` between them:

- `Spec: home +FR-18 ~FR-03 · todo ~BR-06` — the ids this commit adds, changes, removes;
- `Spec: pending (.planning/blueprints/{file})` — a stage of a blueprint not merged yet: its ids are not final;
- `Spec: none ({reason})` — no behaviour changed.

Before a commit that changes a spec, run `spec-check {slug} --cite "{ids of its group}"` for each file. The plugin's commit hook warns, never blocks: a code commit with no `Spec:` line, ids that do not check, a `pending` blueprint that does not exist or is already merged.

## Blueprints

A blueprint (`templates/planning/blueprint.md`) is one screen: the spec delta, the decisions, the stages and their commit subjects, the tests, the Progress. `/selo:blueprint` writes it and commits it on the person's one yes; the page and domain specs are untouched until the merge. No pseudo-code, no file-level detail: the implementer reads the code it is about to change.

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
2. A `conflict` or a `missing` line stops the merge and asks the person (under autopilot: the step stops, the stage commits stay).
3. Otherwise the session applies each line to its file (an FR placed under its zone; a new page from the page template), rewrites in the blueprint every provisional id that changed (the delta and every mention), applying the printed `renames` in their order, ticks `Spec merged`, and commits the specs and the blueprint alone: `docs({name}): spec merged`, body the `specLine` the script printed (`Spec: todo-detail +FR-01 … · home +FR-18 · todo ~BR-03`), checked first with `spec-check {slug} --cite`.

A blueprint is never edited after `Spec merged`; a new iteration is a new blueprint. A file of `blueprints/` with a `Legacy:` line under its title is a 1.0 plan moved by `/selo:setup update`: history, never built, revised or listed as open.

## Where commits go

The current branch decides (`git branch --show-current` against `baseBranch`): no manifest key.

Both variants: files named on `git add` (never `-A`, `git add .`, `-a`): it keeps build output and secrets out. Never `--amend`, never push. The `Spec:` line on every code commit. A commit is made with `-m` twice (subject, then body), the simplest form across shells.

### On `baseBranch`: one shared checkout

Work is committed on `baseBranch` as it goes: no feature branch, no squash. Several sessions share the checkout:

- commit in one command, naming the files this work wrote: `git add {new files} && git commit --only -m "{subject}" -m "{body}" -- {files}`; `--only` leaves out what other sessions staged;
- a file you must change that holds another session's uncommitted edits: do not write it; wait up to five minutes for that session's commit, else stop and name the file;
- a dirty tree is not a blocker;
- **a work's commits** are those whose subject has its scope (`({name})`), from the one that added the blueprint (`git log --diff-filter=A --format=%H -- {blueprint}`), or the fastlane's own hashes, to `HEAD`: other sessions' commits sit between them, so a review never takes the whole range;
- a suite that fails outside this work's files: list the files other sessions changed (`git status` minus this work's list), say `foreign uncommitted changes in {files}`, do not investigate, commit; the last stage's full suites re-run it.

### On another branch: the worktree variant

The session runs in its own worktree, on its own branch. Commits go on that branch, one per stage or per component, without a question; `--only`, the five-minute wait and the foreign-changes mark do not apply. The work's commits are `{baseBranch}..HEAD`; the review takes that range whole. The validation is the landing on `baseBranch`, one squashed commit, on the person's yes:

1. **Sync.** Bring the branch up to date with `baseBranch`: the desktop app's `sync_with_base_branch` when the session has it, else `git merge {baseBranch}`. A git conflict stops and asks.
2. **Merge the spec delta** (a blueprint; a fastlane has none): **Blueprints** steps 1 to 3, against the specs as `baseBranch` has them now, then the full suites of the touched components again (through `runner`).
3. **Show the landing:** the branch and its commits; the decisions taken during the build first, then the Business decisions; the spec delta with its final ids; the exact message of the one commit in a code block: subject `{type}({name}): {summary}`, body the stages, the Business decisions, the final `Spec:` line. A bootstrap commit of the work (`docs({page}): bootstrap spec`) is folded into it: the body names it and its ids join the `Spec:` line. One yes.
4. **Squash**, on the yes, from the checkout that holds `baseBranch` (`git worktree list --porcelain`: the worktree whose `branch` is `refs/heads/{baseBranch}`; a base branch cannot be checked out twice). `{files}` = `git diff --name-only --no-renames {baseBranch}...{branch}` (a moved file names both paths). First `git -C {main} status --porcelain -- {files}`: a dirty file there stops the landing before anything is written, and names the file. A `merge --squash` refused because the main checkout has staged changes stops too, and says so. Then `git -C {main} merge --squash {branch}` and `git -C {main} commit --only -m "{subject}" -m "{body}" -- {files}`: `--only` leaves out what other sessions staged there.

No skill removes a worktree or its branch: the person or the desktop app does (after a squash, `git branch -d` refuses the branch; `-D` removes it).

## Subagents

The session leads: it plans, decides, writes. Each subagent is spawned with its role's model from `models`:

- `reviewer`: every review, always a subagent (it has no stake in the code);
- `runner`: a command whose output floods the context (a full suite, a build, a lint run); it returns the errors with `file:line`;
- `Explore` (`models.explorer`): a broad search; for a task that needs judgment, `general-purpose` on `models.implementer`.

Put the role first in the spawn's description (`runner · web tests`). A blueprint or an implementation is not a subagent's job, except under `autopilot`. A subagent without the Agent tool runs its commands itself, filtered to the errors, and says what it could not delegate.

## Decisions

Recorded in two lists, in the blueprint (in the fastlane, in the commit body and the report): **Business decisions** (at most five: a rule, a label, a scope, a new page or domain sheet, what the person would want to check) and **Technical defaults** (the rest, one line each), `- {question} → {answer} ({reason})`. Those `build` takes go under `### Decided during build` (**Blueprints**). A spec holds no decisions.

## Autonomous mode

Only `autopilot` turns it on, by ending a step's prompt with ` — autonomous`; a person never types it. No question: each takes its recommended answer. A question with no defensible answer stops the step, with nothing committed. The hard rules hold.

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

End each workflow step with the next prompt(s), one code block each, real paths filled in, e.g. `/selo:build .planning/blueprints/2026-10-21-due-date.md`.

When the job committed, end with the done footer, the very last lines:

```markdown
---
## ✅ JOB DONE
> {one line in language.chat, at most 120 characters: what the whole job achieved}
`{short hash}` {subject} · branch `{branch}` · not pushed
```

- **The recap line** says what the whole job achieved, from its prompt to this footer, not only the last turn: a build stopped on a question (a semantic conflict, a landing) and resumed on the answer spans several turns. Never the commit subject again.
- **One line per commit.** In the worktree variant, before the landing: `` `{short hash}` {subject} · branch `{branch}` · not merged ``; after it, the squashed commit: `` `{short hash}` {subject} · merged into `{baseBranch}` · not pushed ``.
- A free request answered without a commit ends with the recap line alone, so "done, nothing to commit" never looks like "stopped halfway".
- No footer when the turn stops on a question, or on a failure before any commit; a stop after commits still ends with the footer.

Selo Ops reads these shapes from the turn's last message (the ops export, `scripts/ops.mjs`): the footer as the last lines flags the job done; a commit message in a code block as the last text, its first line `{type}({scope}): …`, flags a commit waiting for its yes; a last line ending with `?`, or the question of a next-step box, flags a question. A turn that ends on none of them shows as ended without its footer.

## Marks

`fastlane` and `build` mark where they are, one Bash call at each change: `node ${CLAUDE_PLUGIN_ROOT}/scripts/ops.mjs mark {substep} [sheet …]`, `{substep}` one of `bootstrap` (the spec of a page stub), `tests` (tests written, red), `code`, `suites`, `review`, `try`, `merge` (the delta merged), `commit`. A fastlane's first mark names its page (`mark tests home`). The script prints nothing and changes nothing: a hook reads the command for Selo Ops. A forgotten mark loses detail on the dashboard, never a state.

## A 1.0 project

A project still in the 1.0 shape, the layout of factory 0.8 and selo-flow 1.0 (a `factory.yaml` or a `selo-flow.yaml` instead of `selo.yaml`, or a `.planning/features/*/00_spec.md`), is migrated first: `fastlane`, `blueprint`, `build`, `autopilot` and `review` say so, change nothing, and give `/selo:setup update`, which moves its areas to pages and domain sheets and its plans to legacy blueprints.
