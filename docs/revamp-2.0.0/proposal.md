# selo 2.0 — proposal (v4, 2026-10-22)

Working document, meant to continue the reflection. Basis: a full read of selo-flow 1.0.0 (8 skills, 2 agents, `workflow-rules.md`, docs, templates), the `samples/todo-app` history (spec `home`, four plans), the 1.0.0 proposal in `docs/revamp-1.0.0/`, and four grill-me rounds with the person on 2026-10-21 (§3). Nothing in the plugin is changed yet.

## On one page

**Goal:** the most fluid dev flow for web apps, with a reliable recap of the specs, and two ways of asking: a concise request, or a feature planned from scratch.

**In one sentence:** one plugin, `selo`; the spec is written **per page** (plus domain sheets for shared rules); the 170-line dev plan becomes a **one-screen blueprint** that carries its own spec delta; one yes instead of two; three lanes named like flight modes: **Fastlane**, **Blueprint**, **Autopilot**.

```
/selo:fastlane  {request}     "change this": code + page spec delta, one review, commit(s)
/selo:blueprint {request}     grill → page spec delta + brief, ONE yes, one commit
/selo:build     {blueprint}   every stage chained, one commit each, review, delta merged
/selo:autopilot {request}     no question: picks Fastlane or Blueprint → Build
```

**What goes away:** the board plugin, `write-spec` and `write-plan` as two steps, the `(planned)` marks, `— stages N-M (…), chained`, the pseudo-code plan, the `.planning/features/{slug}/dev-plans/{ts}-{type}-{name}/plan.md` path.

**What stays:** spec-follows-code, FR/BR ids, the `Spec:` commit line, `spec-check`, the commit hook, commits on the base branch by named files (or on a worktree's branch, merged into the base branch on the person's yes: §4.7), one review at the end, the demo browser test, Business decisions / Technical defaults, never push.

## 1. Diagnosis of 1.0.0

Measured on `samples/todo-app`, feature "optional due date" (commits `4ed64c2`, `219b7d8`, `f677536`, `a67aaba`):

| What | Lines |
|---|---|
| Spec delta (`00_spec.md`) | +17 |
| `plan.md` | 174 |
| Hand-written production code (api + web, generated `schema.d.ts`, `openapi.json`, migrations excluded) | ≈ 323 |
| Hand-written tests | ≈ 185 |

1. **The plan rewrites the code.** 174 lines of plan for ≈ 323 lines of production code (≈ 54 %): file paths, signatures, Zod schemas, CSS values. The `refactor-brutalist-skin` plan is 227 lines and holds whole TSX snippets. The person reads the code twice, once in English prose.
2. **Two approvals for one intention.** `write-spec` asks yes and commits; `write-plan` asks yes and commits again. The person approves "what" and "how" in two sessions for one feature.
3. **Feature = page, in practice, but nothing says it.** The only area of the sample, `home`, is one page. "Area = a screen, a route or a domain" leaves the cut to each session: specs will drift between page-shaped and domain-shaped.
4. **The page spec is a contention point.** With 3–5 sessions on one checkout, two pieces of work on the same page both write `00_spec.md` (the `(planned)` FRs at spec time, their removal at the last stage), and the second one waits five minutes or stops.
5. **Ceremony drift.** The sample's `home/00_spec.md` still has the old format (`— PRD`, `Status`, `Last updated`, a `Status` column in the glossary): `— rewrite` was never run. Rules nobody runs are noise.
6. **Too many incantations.** `— stage 2 (web)`, `— stages 1-2 (api, web), chained`, `— until spec`, `— until plan`, `— with plan`, `— without browser test`, `review plan {folder}`, `review {folder}`, `review {slug}`. A web app has two components in most cases: chaining should be the default.
7. **One workflow described five times.** `workflow-rules.md`, `docs/workflow.md`, `docs/flow.md`, `docs/cheatsheet.md`, the `README.md`. Each rule change touches all five.
8. **The board shapes rules.** Two rules exist only for it: "a second `-m`, never `-F`: the board reads the subject from the command", and "the board reads the done footer, keep its shape".

## 2. Principles of 2.0

1. **A page is the unit the person thinks in.** The spec follows the app's map, not the history of requests.
2. **Specify the what, not the how.** The spec says what the page does; the blueprint says the decisions and the steps; the code says the how. Nothing is written twice.
3. **One intention, one yes.** A blueprint is approved once, spec delta and brief together. In a worktree (§4.7) the merge into the base branch adds one yes for the result: the "what" and the "done", never a yes per commit.
4. **The default is the common case.** Two components, chained stages, the browser test on: no option to type for that.
5. **Each rule in one place.** One reference file for the rules, one cheatsheet for the commands; the rest points to them.

## 3. Decisions taken (grill-me, 2026-10-21)

Round 1:

- Spec unit? → **Page + domain**: one spec per page (route); the rules shared by several pages (an entity, a BR) go in a domain sheet.
- The dev plan? → **A short brief**, one screen: decisions, stages and their commit subjects, tests. No pseudo-code.
- Spec and plan: one approval or two? → **One**: grill → spec delta + brief → one yes → one commit.
- Command names? → **Fastlane / Blueprint**, prefix `/selo:` (plugin renamed `selo`).

Round 2:

- Where does a blueprint's spec delta live while it is built? → **In the blueprint.** The last stage merges it into the page spec. No more `(planned)`; sessions on the same page no longer collide on its spec.
- Stages of a build? → **Chained by default** in one session, one commit each; `— stage N` still runs one.
- Spec ↔ code traceability? → **Keep ids + the `Spec:` line**, `spec-check` and the hook; drop only what served the board.
- With a short brief, which model codes? → **Opus implements** (`standard` preset: implementer = opus). It takes the detail decisions the plan used to spell out.

Round 3 (the open questions Q1–Q9 of v1):

- Q1, page slug? → **A business name** chosen at creation (`todo-detail`); the route is a header line of the spec (`Route: /todos/:id`). A renamed route changes one line, not a file.
- Q2, a page in two fronts? → **A folder per front only from two fronts on**: `pages/home.md` with one front, `pages/{component}/home.md` with two or more.
- Q3, a map of the pages? → **None.** The `pages/` folder is enough.
- Q4, the done footer without the board? → **Kept, lighter**: the "keep its shape for the board" rule goes. The recap-only footer of a free request without a commit **stays** (changed 2026-10-22): Selo Ops flags a session done on the footer (`ops-export.md` §5.3), and without it "done, nothing to commit" and "stopped halfway" look the same.
- Q5, a spec-only edit? → **No dedicated skill.** A free request does it; the project's `CLAUDE.md` carries the spec rules.
- Q6, a mockup as input? → **Input and check**: an image given to `blueprint` is saved in `blueprints/assets/` and cited; `/selo:try` takes a screenshot and compares it with the mockup in its report.
- Q7, marketplace name? → **Renamed `selo`**: `selo@selo`, one name everywhere.
- Q8, "Specs of the day"? → **Left in `IDEAS.md`**, out of 2.0.
- Q9, commit scope? → **A blueprint's commits use the blueprint's name** (`feat(due-date): api — …`); the per-page recap comes from the `Spec:` lines. **A fastlane commit uses the page it touches** (`fix(home): …`), the domain when no page (`fix(todo): …`), `app` for the shell.

Round 4 (two new ideas):

- An advisor (`/selo:advisor {intention}` → the exact prompt to run)? → **Dropped.** Autopilot already picks the lane, and a fastlane already redirects to a blueprint; a skill that only names the prompt repeats that rule.
- Setup on a repository that already has code: when are page specs written? → **Routes early, FRs late.** Setup scans the routes and writes one empty spec per page (slug + `Route:`); a page gets its FRs the first time a fastlane or a blueprint touches it, or on demand (below).
- How deep is a spec written from existing code? → **Pages and domains**: FRs per page, domain sheets for the shared rules. A behaviour that looks wrong becomes a `Q-NN`, never an FR: the spec must not turn current bugs into requirements.
- How are the routes found? → **By the stack pack, with a fallback**: each pack says where its routes live (react-express: `src/router.tsx`); with no pack, an explorer reads the front and the person validates the list. The same scan serves the migration (§7, step 2).
- Approval? → **One yes, one commit** for the whole set of pages and domains (`docs(app): bootstrap specs`).
- A full or per-page scan on demand? → **A setup sub-mode**: `/selo:setup specs [page …]` fills every empty page, or the ones named.
- The first touch of an empty page? → **A separate commit first**: the fastlane or the blueprint writes the spec of what exists (`docs(home): bootstrap spec`), then its own delta. History keeps "what was" apart from "what changes".
- Setup detects an existing repository by itself? → **Yes**: a front component that already holds code adds the route scan to the interview; no option to type.

## 4. The model

### 4.1 Pages and domains

```
.planning/
  pages/
    home.md                 one per route: what the person sees and can do there
    todo-detail.md
  domain/
    todo.md                 an entity or a policy used by several pages: glossary, BRs
  blueprints/
    2026-10-21-due-date.md  a piece of work in flight, or done (kept, never edited after done)
    assets/
  ideas.md
  technical-debt.md
```

- **A page spec** = one route of a front. Its slug is a business name chosen at creation (`home`, `todo-detail`, `settings-billing`); its header carries the route (`Route: /todos/:id`). FRs grouped by zone of the page, in the order the person meets them.
- **Several fronts**: from the second front on, pages go under `pages/{component}/`; a single-front project stays flat.
- **A domain sheet** = what is true whatever the page: the entity's glossary, its BRs, its lifecycle. A page spec cites `BR` ids of a domain sheet, never restates them.
- **No page** (an API-only rule, a job, an email): a domain sheet holds the FR.
- **`app`** is the one reserved page-less sheet for the shell: layout, navigation, sign-in, errors, i18n.
- Ids are per file: `home FR-14`, `todo BR-06`. The `Spec:` line names files: `Spec: home +FR-18 · todo ~BR-06`.

The rule "which file gets the FR" becomes mechanical: the person sees it on a page → that page; it holds on several pages or with no page → the domain sheet.

### 4.2 The blueprint

One file, one screen, written by `/selo:blueprint`, approved once, committed once. Template:

```markdown
# {Title}

Pages: `home` · Domain: `todo` · Components: `api`, `web`

## Spec delta
- home + FR-14 — When adding a todo, the person may give it a due date, a calendar day…
- home ~ FR-03 — … → …
- todo + BR-06 — A due date has passed when it is before today, on the person's device.

## Business decisions        (≤ 5)
- How is a late todo shown? → A red « En retard » badge after the date (reads at a glance).

## Technical defaults        (one line each)
- Storage → nullable `date` column, `YYYY-MM-DD` strings end to end (no timezone shift).
- Route for FR-15 → `PATCH /v1/todos/{id}/due-date`, twin of the pin route.

## Stages
1. api — `feat(due-date): api — optional due date on a todo`
2. web — `feat(due-date): web — due dates and late todos in the list`

## Tests
- api: create with/without a date, invalid day 400, PATCH set/clear, 404.
- web: none (component rule); browser: add with date, edit, clear, late badge, 360px.

## Progress
- [ ] Stage 1 — api
- [ ] Stage 2 — web
- [ ] Review
- [ ] Spec merged
```

The due-date plan of the sample rewritten this way is ≈ 35 lines instead of 174. What disappears is file-level detail, which the implementer reads from the code it is about to change.

**Mockup.** An image given to `/selo:blueprint` is saved in `blueprints/assets/` and cited under a `## Mockup` section; the last stage's browser test (`/selo:try`) takes a screenshot of the page and compares it with the mockup in its report.

**Lifecycle.** Committed with its delta, the page spec untouched. `/selo:build` runs the stages, ticks Progress, and on the last stage, after the review: applies the delta to the page and domain specs (through `spec-check`, which gives the final ids), ticks `Spec merged`, commits. A blueprint is never edited after `Spec merged`; a new iteration is a new blueprint.

**`Spec:` lines during a build.** Stage commits carry `Spec: pending (.planning/blueprints/{file})`: their ids are not final yet, and a commit is never amended. Only the merge commit carries the final ids (`Spec: home +FR-18 ~FR-03 · todo +BR-06`). `spec-check` and the commit hook accept the `pending` form when the blueprint exists and is not merged.

**Id collisions.** Two blueprints in flight on the same page both propose `FR-18`. The delta's `+` ids are provisional; the merge takes the next free ones and rewrites them in the blueprint. `spec-check` already gives the next free id; it gains `--merge {blueprint}`.

**Semantic conflicts.** A `~ FR-03` or `- FR-07` in the delta can meet an FR that a fastlane or another blueprint changed during the build. The delta stores the text it replaces (`~ FR-03: before → after`, as write-spec's update mode does today); the merge stops and asks when the spec's current text no longer matches the stored "before".

### 4.3 The three lanes

| Lane | When | What happens | Questions |
|---|---|---|---|
| **Fastlane** `/selo:fastlane {request}` | One page or one component, no new entity or BR | Code test-first, page spec delta in the same commit, review, suites, browser test, one commit per component | Only when the answer changes the result |
| **Blueprint** `/selo:blueprint {request}` then `/selo:build {blueprint}` | A new page, a new entity or rule, several pages | Grill (≤ 2 rounds), blueprint written, **one yes**, one commit; build chains every stage | The grill, then one yes |
| **Autopilot** `/selo:autopilot {request \| blueprint}` | The person leaves | Reads the code, picks Fastlane or Blueprint → Build, every question takes its recommended answer | None |

A Fastlane that meets a new entity or BR stops before its commit and proposes `/selo:blueprint {same request}`. `/selo:fastlane` with no lane word in a free sentence stays the default reading of "change this".

### 4.4 Setup on an existing repository

Setup already detects component roots and leaves their code alone; 2.0 also gives the project its pages.

1. **Detection.** A front component whose folder already holds code adds one question to the interview: scan its routes now (recommended).
2. **Route scan.** The stack pack's `README.md` gains a `## Routes` section: where the routes are declared and how to read a route's path and page module. With no pack, an explorer subagent reads the front and proposes the list. The person validates the list (business slugs, as Q1 says); the migration (§7, step 2) uses the same scan.
3. **Empty page specs.** One `pages/{slug}.md` per validated route: title, `Route:` line, the template's sections empty and a `Status: to bootstrap` line. One yes, one commit (`docs(app): bootstrap specs`).
4. **FRs on first touch.** A fastlane or a blueprint that meets a page still `to bootstrap` first writes the spec of what the page does today (FRs by zone, shared rules moved to domain sheets), commits it alone (`docs(home): bootstrap spec`), then goes on with its own delta. Under autopilot the same, with no question.
5. **On demand.** `/selo:setup specs` fills every page still `to bootstrap`; `/selo:setup specs home todo-detail` only those. Explorer subagents read one page each; the person approves the whole set once; one commit.

**Rules of a spec written from code.** It describes observed behaviour only, never an intention. Anything that looks like a bug, a dead path or an inconsistency between pages becomes a `Q-NN` in that spec, for the person to decide, never an FR. Rules found on several pages go to a domain sheet as BRs, as §4.1 says.

### 4.5 Commands

| 2.0 | Replaces | Note |
|---|---|---|
| `/selo:setup` | `/selo-flow:init` | sub-modes kept: `update`, `component`, `skin`, `stack`, `models`; new: `specs [page …]` (§4.4) |
| `/selo:fastlane {request}` | `/selo-flow:implement {request}` | |
| `/selo:blueprint {request}` | `write-spec` + `write-plan` | grill built in, skipped when the request carries its decisions |
| `/selo:build {blueprint}` | `/selo-flow:implement {plan folder} — stages …, chained` | chained by default; `— stage N` for one |
| `/selo:autopilot {…}` | same | options: `— fastlane`, `— blueprint`, `— until blueprint`, `— no browser` |
| `/selo:review [scope]` | same | scopes: nothing, a range, a blueprint, a page (`review home`: spec vs code) |
| `/selo:grill {…}` | `/selo-flow:grill-me` | |
| `/selo:try {component}` | `/selo-flow:test-in-browser` | compares with the blueprint's mockup when there is one |
| `/selo:run [component \| all] [— demo \| — stop]` | new | starts the app on this worktree's slot, gives its URLs (§4.8) |

Eight skills become nine with `run` (§4.8), but the person types three in practice: `fastlane`, `blueprint`, `autopilot`. A spec-only edit (a wording, a found gap) is a free request: the project's `CLAUDE.md` carries the spec rules.

### 4.7 Worktree variant (2026-10-22)

The person runs each session in its own git worktree, on its own branch. The validation is then the merge of that branch into `baseBranch`, not a commit.

- When does it apply? → **When the session's branch is not `baseBranch`** (a worktree's branch). Detected from git, no `selo.yaml` key. On `baseBranch` itself, the one-checkout rules of 1.0.0 stay as they are.
- How many yeses? → **The blueprint's yes, then the merge's yes.** Fastlane: one, the merge. Autopilot: none while it runs; it stops ready to merge and the person gives the merge's yes. No commit inside the worktree asks a yes.
- Where do commits go? → **On the worktree's branch**, one per stage or per component as today, without a question.
- What leaves the "Where commits go" rules? → **What existed for sessions sharing one checkout**: `--only`, the five-minute wait on a file another session holds, the "foreign uncommitted changes" mark, and finding a work's commits by their scope. The work's commits are `{baseBranch}..HEAD`; the review takes that range whole. Files are still named on `git add` (no `-A`): it keeps build output and secrets out.
- What stays? → **Never push, never `--amend`, no squash, the `Spec:` line on every code commit, the commit hook.** Stage commits keep `Spec: pending (…)`.
- When does the spec delta merge? → **At the merge step, not at the last stage**, in this order:
  1. bring the branch up to date with `baseBranch` (the desktop app's `sync_with_base_branch`, else `git merge {baseBranch}`); a git conflict stops and asks;
  2. apply the blueprint's delta with `spec-check --merge` against the page specs as `baseBranch` has them now: final ids, semantic conflicts seen against the latest text; commit (`Spec: home +FR-18 …`), then re-run the full suites of the touched components;
  3. show the merge: the branch, its commits, the Business decisions, the spec delta with its final ids, and the exact merge message in a code block; one yes;
  4. on the yes, merge from the checkout that holds `baseBranch` (the base branch cannot be checked out in a worktree): `git -C {main checkout} merge --no-ff {branch} -m "{subject}" -m "{body}"`. A dirty file of the main checkout that the merge touches stops it and names the file.
  A fastlane has no delta to apply: steps 1, 3, 4.
- And the done footer? → **It says where the work is.** Before the merge: `` `{short hash}` {subject} · branch `{branch}` · not merged ``. After: `` merged into `{baseBranch}` · not pushed ``.
- Who removes the worktree? → **The person, or the desktop app.** No skill removes a worktree.

### 4.8 Running the app: one slot per run (2026-10-22)

Every project starts its components the same way, one by one or all at once, and several copies run side by side: one per worktree, each on its own ports, so two worktrees run their browser tests at the same time.

- Who starts the app? → **One script of the plugin, `scripts/run.mjs`**, behind `/selo:run [component | all] [— demo | — stop]`. `all` starts every component in `stages` order, each awaited on its URL before the next. `try` uses the same script. It runs the component's `commands.serve`, or `commands.demo` with `— demo`, in the background, and prints the URLs.
- What does the manifest give? → **Base ports, not URLs.** A component that serves has `port` (dev) and `demo_port` (demo); they replace `url`, `serve_url` and `demo_url`. A `front` with a `port` is browser-tested (today: a component with `url`). The resolved manifest still returns `url`, `serveUrl` and `demoUrl`, computed for the current slot: skills read them as today.
- How are ports shifted? → **By the run's slot**: port = base + 10 × slot. Slot 0 is the base ports, so a single run keeps the ports of today.
- When does a run get its slot? → **When it starts, not when the worktree is created:**
  1. this root already has a live run → reuse it, print its URLs, start nothing;
  2. else the slot this root had last, when it is free;
  3. else the lowest free slot.
  A slot is free when no live run holds it **and** every port it would use is free: a server started by hand moves the run to the next slot. A single worktree therefore always gets the same ports, the same tab.
- Where is it recorded? → **One file per slot, `{git-common-dir}/selo/slots/{n}.json`**, shared by every worktree of the repository:
  ```json
  { "slot": 1, "root": "C:/WS/ia-projects/todo-app/.claude/worktrees/due-date", "pid": 18244, "startedAt": "…", "stoppedAt": null,
    "components": [ { "name": "api", "mode": "dev", "url": "http://localhost:3010", "pid": 18250 },
                    { "name": "web", "mode": "dev", "url": "http://localhost:5183", "pid": 18262 } ] }
  ```
  `root` has the exact form of the ops export's `root` (absolute, forward slashes, drive letter upper case): Selo Ops joins a session to its run on it. A slot is claimed under a short lock (`{git-common-dir}/selo/slots.lock`, an atomic `mkdir`). `— stop` stops the processes and sets `stoppedAt`; the file stays, and `root` is what step 2 reads. A `pid` that is dead frees the slot.
- What does a component receive? → **Its port and its peers' URLs, in the environment**: `PORT`, `SELO_SLOT`, and `{NAME}_URL` for each component it `needs` (`API_URL`). The stack pack reads them: `react-express` starts Vite with `--port $PORT --strictPort` and points its `/api` proxy at `API_URL`; the api already reads `PORT`. Local data stays per worktree (PGlite under the component's folder); a pack whose database is shared (a Docker container) says so.
- What about the demo lock? → **Per slot**: `{git-common-dir}/selo/slots/{n}.demo.lock`. Two sessions on one worktree still wait for each other; two worktrees no longer do.
- What does Selo Ops show? → **The run of each session's worktree**: ports and links, read from the slot files (`ops-export.md` §2). Nothing is copied into the export.

### 4.6 Agents and models

- `runner` stays as it is.
- `reviewer` changes its two plan checks, written for a step-level plan. Code review: the code against each FR of the blueprint's delta and its Business decisions, then conventions, correctness, tests as today. Blueprint review: gaps in the delta (an edge case, a missing FR, a rule that belongs to the domain sheet) and in the decisions; never file-level detail, which a blueprint no longer holds.
- `build` records the detail decisions the plan used to fix (a route, a storage type, a component split) by appending them to the blueprint's Technical defaults, so the recap still holds them.
- `standard` preset becomes: planner opus, implementer **opus**, reviewer opus, runner haiku, explorer haiku. A `lean` preset keeps sonnet as implementer for the person who wants it, with a more detailed blueprint under autopilot only.

## 5. One plugin: removing the board

- Delete `plugins/selo-flow-board/` and its entry in `.claude-plugin/marketplace.json`; the root `CLAUDE.md` loses its board lines and commands.
- `workflow-rules.md`: drop "a second `-m`, never `-F`: the board reads the subject" (keep `-m` twice, it is still the simplest); drop "the board reads it, keep its shape" from the done footer. The footer's `> ` recap line says what the whole job achieved, from its prompt to the footer, not only the last turn: a build stopped on a question (a semantic conflict, the merge of a worktree, §4.7) and resumed on the answer spans several turns, and Selo Ops shows that line as the run's recap (`ops-export.md` §5.3).
- `templates/CLAUDE.md`: the done footer stays, lighter: "The board and its companion apps read it: keep its shape" becomes "Selo Ops reads it". The recap-only footer of a free request answered without a commit stays.
- `docs/manifest.md`, `skins/README.md`, `skills/init/SKILL.md`: their board mentions.
- `IDEAS.md`: its "Specs of the day" idea stays there, out of 2.0; its `## board` scope heading is the person's to rename.
- Rename: plugin `selo-flow` → `selo`, marketplace `selo-flow` → `selo` (install `selo@selo`), manifest `selo-flow.yaml` → `selo.yaml` (`setup update` renames it and rewrites the project's `extraKnownMarketplaces` and `enabledPlugins`, as `init update` renamed `factory.yaml`).

## 6. Docs

One reference, one cheatsheet:

- `reference/rules.md`: every shared rule (today `workflow-rules.md`), read first by every skill.
- `docs/cheatsheet.md`: the commands and the three lanes, with the diagram of `flow.md` inside.
- `README.md`: install and the folder map only. `docs/workflow.md` and `docs/flow.md` are removed; their content lives in the two files above.

## 7. Migration (`/selo:setup update`)

1. `selo-flow.yaml` → `selo.yaml`, `selo: 2.0.0`.
2. `.planning/features/{slug}/00_spec.md` → `.planning/pages/{slug}.md` when the slug is a page, else `.planning/domain/{slug}.md`; asked once per area, with a recommendation from the routes found in the front.
3. Rules shared by several pages moved to domain sheets: proposed, never silent (the reviewer checks no meaning changed, as `— rewrite` does today).
4. Old specs rewritten to the template in the same pass (the sample's `home` needs it).
5. `dev-plans/` folders moved to `.planning/blueprints/{date}-{name}.md` as they are, marked legacy; an unfinished plan is finished by `/selo:build` reading the legacy format, or rewritten as a blueprint.
6. `(planned)` FRs of unfinished plans moved back into their blueprint's delta.
7. The project's `CLAUDE.md` tagged blocks rewritten (`/selo:` prompts, the footer without the board).
8. `url`, `serve_url`, `demo_url` of each component turned into `port` and `demo_port` (§4.8); the stack pack's dev and demo scripts read `PORT` and the `{NAME}_URL` of their peers.

Breaking for every project: version 2.0.0, with the rollback note of 1.0.0 (pin the previous version).

## 8. Open questions

Q1–Q9 of v1 are settled (§3, round 3), and the two ideas of round 4 too. The worktree variant (§4.7) and the app's runs (§4.8) open four:

- Q10, does the one-checkout mode stay? §4.7 keeps it for a session on `baseBranch`; dropping it would remove `--only` and the waits from the rules for good, but force a worktree on every session.
- Q11, merge with `--no-ff` or fast-forward? `--no-ff` keeps one merge commit per work, which a log reads as "this blueprint landed"; fast-forward keeps a straight history.
- Q12, two yeses for a blueprint (§2.3)? The alternative: commit the blueprint on its branch without asking, and the merge's yes covers spec and code at once. Faster, but the person sees the delta only once the code exists.
- Q13, how does the person start the app outside a session? `/selo:run` runs it as a background task of the session, which stops with it. A launcher at the project root (written by `setup`, calling the plugin's `run.mjs`) would serve a terminal; its path to the plugin changes with each version.

## 9. Risks

- **Opus as implementer costs more per stage.** Offset: no 174-line plan to write and re-read; to measure on the sample (one blueprint, cost and time vs `add-due-date`).
- **Short brief, more drift.** The implementer decides details the plan fixed. Mitigation: Business decisions stay in the blueprint; the reviewer checks the delta's FRs one by one; Technical defaults record the non-obvious choices.
- **Semantic conflict at merge.** A `~` or `-` in a delta whose "before" text changed during the build stops the merge and needs the person; frequent with 3–5 sessions on one page, rare otherwise.
- **One page spec in two long-lived branches.** Two worktrees whose blueprints touch `pages/home.md` meet at the merge: the second one gets a git conflict on the spec, or a semantic conflict in `spec-check --merge`. Mitigation: the merge step brings the branch up to date first (§4.7); short branches.
- **Delta merged at the end.** Between the blueprint and its merge, the page spec does not show the work in flight. Mitigation: `review home` lists the open blueprints of a page.
- **Specs written from code.** An explorer can misread a page or miss a hidden state (an error, a permission). Mitigation: observed behaviour only, doubts as `Q-NN`, one review by the person before the commit; the browser test of the first fastlane on the page checks the main FRs.
- **Migration of real projects.** Splitting areas into pages and domains changes ids' files: the `Spec:` lines of old commits keep the old slugs. Acceptable: git history is read rarely, and the area-to-file map is recorded once in the migration commit.

## 10. Order of work (proposal)

1. Prototype on `samples/todo-app`: write `pages/home.md`, `domain/todo.md` and one blueprint by hand (the next feature), run it with 1.0.0's `implement` to check the brief is enough for opus.
2. `blueprint` + `build` skills, `spec-check --merge`, the reference file rewritten.
3. Rename to `selo`, `setup update` migration, board removal.
4. `autopilot` on the new lanes, docs collapsed to two files.
5. Setup on an existing repository (§4.4): the packs' `## Routes` section, `setup specs`, the first-touch bootstrap in `fastlane` and `blueprint`.
6. `run.mjs` and its tests (slot choice, stale pid, ports taken), `/selo:run`, the manifest's ports, the `react-express` pack reading `PORT` and `API_URL`, `try` on the slot (§4.8).
