# selo 2.0 — proposal (v3, 2026-10-21)

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

**What stays:** spec-follows-code, FR/BR ids, the `Spec:` commit line, `spec-check`, the commit hook, commits on the base branch by named files, one review at the end, the demo browser test, Business decisions / Technical defaults, never push.

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
3. **One intention, one yes.** A blueprint is approved once, spec delta and brief together.
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

Eight skills stay eight, but the person types three in practice: `fastlane`, `blueprint`, `autopilot`. A spec-only edit (a wording, a found gap) is a free request: the project's `CLAUDE.md` carries the spec rules.

### 4.6 Agents and models

- `runner` stays as it is.
- `reviewer` changes its two plan checks, written for a step-level plan. Code review: the code against each FR of the blueprint's delta and its Business decisions, then conventions, correctness, tests as today. Blueprint review: gaps in the delta (an edge case, a missing FR, a rule that belongs to the domain sheet) and in the decisions; never file-level detail, which a blueprint no longer holds.
- `build` records the detail decisions the plan used to fix (a route, a storage type, a component split) by appending them to the blueprint's Technical defaults, so the recap still holds them.
- `standard` preset becomes: planner opus, implementer **opus**, reviewer opus, runner haiku, explorer haiku. A `lean` preset keeps sonnet as implementer for the person who wants it, with a more detailed blueprint under autopilot only.

## 5. One plugin: removing the board

- Delete `plugins/selo-flow-board/` and its entry in `.claude-plugin/marketplace.json`; the root `CLAUDE.md` loses its board lines and commands.
- `workflow-rules.md`: drop "a second `-m`, never `-F`: the board reads the subject" (keep `-m` twice, it is still the simplest); drop "the board reads it, keep its shape" from the done footer.
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

Breaking for every project: version 2.0.0, with the rollback note of 1.0.0 (pin the previous version).

## 8. Open questions

Q1–Q9 of v1 are settled (§3, round 3), and the two ideas of round 4 too. None is open; the next step is the prototype of §10.

## 9. Risks

- **Opus as implementer costs more per stage.** Offset: no 174-line plan to write and re-read; to measure on the sample (one blueprint, cost and time vs `add-due-date`).
- **Short brief, more drift.** The implementer decides details the plan fixed. Mitigation: Business decisions stay in the blueprint; the reviewer checks the delta's FRs one by one; Technical defaults record the non-obvious choices.
- **Semantic conflict at merge.** A `~` or `-` in a delta whose "before" text changed during the build stops the merge and needs the person; frequent with 3–5 sessions on one page, rare otherwise.
- **Delta merged at the end.** Between the blueprint and its merge, the page spec does not show the work in flight. Mitigation: `review home` lists the open blueprints of a page.
- **Specs written from code.** An explorer can misread a page or miss a hidden state (an error, a permission). Mitigation: observed behaviour only, doubts as `Q-NN`, one review by the person before the commit; the browser test of the first fastlane on the page checks the main FRs.
- **Migration of real projects.** Splitting areas into pages and domains changes ids' files: the `Spec:` lines of old commits keep the old slugs. Acceptable: git history is read rarely, and the area-to-file map is recorded once in the migration commit.

## 10. Order of work (proposal)

1. Prototype on `samples/todo-app`: write `pages/home.md`, `domain/todo.md` and one blueprint by hand (the next feature), run it with 1.0.0's `implement` to check the brief is enough for opus.
2. `blueprint` + `build` skills, `spec-check --merge`, the reference file rewritten.
3. Rename to `selo`, `setup update` migration, board removal.
4. `autopilot` on the new lanes, docs collapsed to two files.
5. Setup on an existing repository (§4.4): the packs' `## Routes` section, `setup specs`, the first-touch bootstrap in `fastlane` and `blueprint`.
