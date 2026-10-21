# Prototype §10 — results (2026-10-22)

Branch `proto/blueprint-v2`, worktree `.claude/worktrees/proto-blueprint`. Written by hand: `samples/todo-app/.planning/pages/home.md`, `domain/todo.md` (the old `features/home/00_spec.md` split in two), and the blueprint `blueprints/2026-10-22-todo-detail.md` (a new page `/todos/:id` to rename a todo and change its tag). Run: `claude -p --plugin-dir plugins/selo-flow --model opus`, 1.0.0's `implement`, `— stages 1-2 (api, web), chained — autonomous`, with the overrides of [prompt.md](prompt.md).

## Verdict

The brief is enough. Opus built the whole delta with no question and no stop, every scenario of the blueprint's Tests passes in the browser (checked by hand after the run), and no FR of the delta is missing. It read the blueprint, `pages/home.md` and `domain/todo.md` before the code, so the `todo BR-01 to BR-04` citations were resolved from the sheet.

Caveat: the session had the advisor tool (the person's usual setup) and called it twice: once after exploring the code, before writing any, and once before its report. Its content is redacted in the log. The verdict is therefore "blueprint + one advisor call before coding is enough", which is how the person's sessions run anyway.

## Numbers

| What | Prototype (`todo-detail`) | 1.0.0 (`add-due-date`) |
|---|---|---|
| Brief / plan | 35 lines (45 after the build) | 174 lines |
| Hand-written production code (api + web, `openapi.json` and `schema.d.ts` excluded) | ≈ 520 | ≈ 323 |
| Hand-written tests | 192 (api, 18 cases) | ≈ 185 |
| Brief / code | ≈ 7 % | ≈ 54 % |
| Run | 12.2 min, 73 turns, $5.30 (opus $5.29 incl. 2 advisor calls, runner haiku $0.01) | not measured |
| Questions, stops | 0 | — |
| Review (opus) | 6 findings, 5 fixed, 1 left open (an optional extra test) | — |

The features differ; compare the ratios, not the totals. The cost of 1.0.0's `write-plan` session (writing and re-reading 174 lines) was not measured, so the "opus costs more" risk of §9 is not settled by this run; $5.30 for a two-component page with its review is the reference to beat.

## What the build decided alone

The blueprint's 2 Technical defaults became 10, and its 3 Business decisions became 4. All sound; they are what the 1.0.0 plan used to spell out (404 retries, invalid ids in the address, live-region status, what a refresh does to an edit in progress, a shared `ButtonLink`, translation keys). Recording them in the blueprint (§4.6) works: the person reads them in one place.

## Findings for 2.0

1. **A build decision can change a rule without touching the delta.** The added Business decision ("BR-03 matches against the *other* todos, so the only todo carrying a tag can change its casing") refines `todo` BR-03, but the delta has no `todo ~ BR-03` line: at the merge, the domain sheet would keep the old wording and contradict the code. → `build`: a decision that refines or contradicts an FR or BR adds its `~` line to the delta. `reviewer` (code review): checks every added Business decision against the delta.
2. **Approved and added decisions look the same.** After the build, nothing in the blueprint says which defaults the person approved and which the build took. In the worktree variant the merge's yes is the only moment the person sees them. → `build` appends under a `### Decided during build` sub-heading (or a `(build)` tag per line); the merge recap (§4.7 step 3) lists them first.
3. **The browser test did not run** (`[-] not run (no demo)`), for two separate causes. The UI was only checked because it was done by hand afterwards, and that check found a layout defect (below).
   - *Sample drift:* the `react-express` pack gives `npm run demo` and `commands.demo`, but the sample predates it and has neither (the drift of §1.5 again). → `setup update` adds a pack's missing commands to a component.
   - *Workflow:* 1.0.0 skips the test when a front has no `demo`. → `build` and `try` fall back to `commands.serve` through `run.mjs` (§4.8) instead of skipping.
   Running the app by hand also needed other ports (3000 was held by another session): a direct case for the slots of §4.8.
4. **Five prompt overrides were needed** to run a blueprint through 1.0.0: the input path, no `write-spec`, `Spec: pending (…)`, decisions appended to the blueprint, commits on the current branch. Each one is a rule `build` must carry itself; none needs a new concept beyond §4.2, §4.6 and §4.7.
5. **The page spec template** (the author's judgment, not a measure of the run). Grouping FRs by zone while keeping the old ids (`home` FR-13 first, under Header) reads well; ids out of order are harmless. A page spec needs no Status, TL;DR, Problem or UX Flow: one intro sentence, the zones, Non-goals. Non-goals split between page and domain sheet without ambiguity.

## Defect found by hand (sample, not workflow)

- `TodoDetailsForm`: the « Le nom est obligatoire. » message under the name field pushes it down while the tag field stays aligned to the bottom (`align-items: flex-end`), so the two fields are no longer on one line. Cosmetic; a browser test would have caught it.

## Not checked

- Spec merge (`spec-check --merge`): not part of 1.0.0, left for step 2 of §10.
- `lean` preset (sonnet implementer with this brief): not run.
