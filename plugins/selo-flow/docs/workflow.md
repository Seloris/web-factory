# The workflow

`flow.md` draws the whole path in one diagram; `cheatsheet.md` lists the commands.

Four phases, each a skill, chained as needed and usable in any session opened at a project's root with the plugin loaded (see `reference/rules.md`). The session runs them: a spec, a plan or an implementation asks the person when the answer changes the result, which a subagent cannot; `autopilot` is the one exception, chaining them in autonomous mode (below). Two agents serve them: `reviewer` (every review, always a subagent: it has no stake in the code) and `runner` (the commands whose output would flood the session).

| Phase | Skill | Output |
|---|---|---|
| Spec | `write-spec` | `.planning/features/{slug}/00_spec.md`: how one area of the application behaves today, present tense. The only writer of a spec. |
| Plan | `write-plan` | `.planning/features/{slug}/dev-plans/{YYYYMMDD}-{HHmmss}-{type}-{name}/plan.md` |
| Code | `implement` | from a plan or straight from a request (the fastlane): code + tests, verified, the spec updated, one commit per stage, one review at the end |
| Review | `review` | ranked findings on code, on a plan or on a whole area, by the `reviewer` agent; a clean review of a plan's implementation ticks its Validation |

Everything is committed on the manifest's `base_branch`: no feature branch, no squash, every commit naming its files.

`init` comes first, once per project: it writes the manifest and the instruction files and, for a component whose stack pack ships a code skeleton, copies that skeleton into the empty folder so the first stage starts on green `build` and `test` commands. A front component gets a skin (`modern` by default, one of the plugin's `skins/`): its tokens copied into the component, its fonts installed when the stack pack maps them (the pack's skeleton also ships the shared components that port the skin's element recipes), its design rules read in place by every skill that plans, implements or reviews its UI, and the component's `## Design` section and `overrides.css` above both; `/selo-flow:init skin {component} {skin}` switches it. `/selo-flow:init update` brings a project set up by an earlier version up to date: the plugin's tagged blocks rewritten, its own files overwritten, missing keys added, nothing of the project's own touched. `grill-me` settles the open decisions of a spec or a plan with the session's question tool, two rounds at most: `write-spec` runs it on a new area unless the request already carries its decisions; `write-plan` and `init` offer it, never start it on their own. The skills are invoked under the plugin's prefix: `/selo-flow:write-spec`, `/selo-flow:implement`…

## Two lanes

- **Fastlane, "change this":** `/selo-flow:implement {request}`, no spec step, no plan. The area's code is read, the change coded test-first, the spec delta written in the same commit, the work reviewed, the full suites and the demo browser test run, then one commit per component touched. A fastlane change that turns out to create a business rule or an entity stops before its commit and says so: it needs the feature lane.
- **Feature lane, "we specify and we develop":** `write-spec` (a short grill, new FRs marked `(planned)`), `write-plan` (*Business decisions* first, *Technical defaults* below), then the stages, one commit each, each removing `(planned)` from the FRs it builds; the last stage reviews the whole plan once and runs the full suites and the demo browser test.

Both end the same way: the review, the full suites of the touched components, the browser test on the demo, the commit(s).

## Blueprint lane (2.0 layout)

A project whose specs are `.planning/pages/{page}.md` (one per route) and `.planning/domain/{sheet}.md` (the rules shared by several pages) works with blueprints instead of a spec step and a plan step; `reference/rules.md` holds every rule.

- `/selo-flow:blueprint {request}`: a short grill, then one screen in `.planning/blueprints/{date}-{name}.md`: the spec delta (`- home + FR-18 — …`, `- todo ~ BR-03 — « before » → « after »`), the Business decisions, the Technical defaults, the stages with their commit subjects, the tests, the Progress. One yes, one commit; the specs are untouched.
- `/selo-flow:build {blueprint}`: every stage chained in one session (` — stage N` for one), each one commit carrying `Spec: pending ({blueprint})`; the decisions the build takes go under `### Decided during build`, with a `~` delta line when they change an FR or a BR. Then one review (the delta's FRs one by one, the decisions), the full suites, the browser test (on the demo, else on the dev server), and the delta merged: `spec-check --merge` gives the final ids and stops on a "before" text that changed meanwhile; one `docs({name}): spec merged` commit with the final `Spec:` line.
- **Worktree variant.** On a branch other than the base branch, commits go on that branch; the work lands on the base branch as one squashed commit, after a sync and the delta merge, on the person's yes (`rules.md`, **Where commits go**).
- The commit hook accepts `Spec: pending (…)` while the blueprint exists and is not merged, and checks each file of a `Spec: home +FR-18 · todo ~BR-03` line.

## Autopilot

`/selo-flow:autopilot {request | slug | plan folder}` takes the work to its commits with no question. On a free request it first reads the code (an `Explore` subagent, writing nothing) and picks the lane: the **fastlane** when the change touches one component (or the api and its regenerated client) and adds no business rule or entity, the **feature lane** otherwise; ` — fastlane` and ` — with plan` force it. Each step is a fresh-context subagent on its role's model (`planner`, `implementer`, `reviewer`, `runner`, `explorer`), each committed. A slug starts at the plan, a plan folder resumes at its Progress. ` — until spec` and ` — until plan` stop it earlier; ` — without browser test` skips the demo test; integration tests are always `[-]`. The skills run in **autonomous mode** (` — autonomous`, sent only by `autopilot`): every question takes its recommended answer, recorded as a Business decision or a Technical default. The report opens with the lane and why, then the Business decisions, the `Spec:` lines of the commits, the `[-]` items and the points left open. A question with no recommendation, a red suite after one fix or a broken build stops the run, its commits left as they are; the same command resumes it. The session needs the `auto` or `acceptEdits` permission mode with the components' commands allowed, else the subagents stall on their first prompt.

## The spec follows the code

`.planning/features/{slug}/` is an **area** of the application: a screen, a route or a domain. Its `00_spec.md` says how that area behaves today, in the present tense: no history, no decisions, no status, no date (git keeps them). A new request enriches its area's spec; a new area is created only for its own screen, route or domain, and its creation is a Business decision.

Every change of behaviour, with a skill or without, names its area and updates its spec in the same commit as the code, through `write-spec`:

| Case | What happens | Question? |
|---|---|---|
| Behaviour changed in an area with its spec | The delta in the same commit as the code | No, when it restates the request |
| An area with no spec | A three-line spec: TL;DR, one FR per behaviour touched | No |
| No area fits | One FR in the nearest area, said in the report | No |
| A behaviour the person did not ask for | Interactive: one grouped question before the commit. Autonomous: applied, first among the Business decisions | Once, grouped |
| A refactor, a look, a fix restoring the specified behaviour, `tooling`, `shared` | No spec change | No |

A revised FR is rewritten under its id; a replaced one is deleted and its id goes on the spec's `Retired:` line, never reused; an FR not built yet carries `(planned)`. Every commit that touches code carries a **`Spec:` line** in its body: `Spec: live-sessions +FR-48 ~FR-13 -FR-07`, or `Spec: none (refactor)`. `scripts/spec-check.mjs {slug}` checks the ids before each commit (duplicates, a retired id reused, an id the line or the plan cites but the spec lacks, and on a plan's last stage the FRs still `(planned)`) and gives the next free ones. The plugin's commit hook runs on every `git commit` of the session, subagents included: it warns, never blocks, on a code commit without a `Spec:` line, on `-a`, `git add -A`, `git add .` or `--amend`, and on a spec whose ids fail. The reviewer flags a behaviour change without its line. `/selo-flow:review {slug}` compares a whole area's spec with the code, on request. A spec written before this version is rewritten once with `/selo-flow:write-spec {slug} — rewrite`: present tense, ids kept, meaning checked by the reviewer.

## Several sessions, one checkout

Every session commits on the base branch, with a skill or without; the project's `CLAUDE.md` carries these rules in a tagged block, so free sessions follow them too:

- a commit names its files, in one command: `git add {new files} && git commit --only -m "{subject}" -m "{body}" -- {files}`; `--only` leaves out what other sessions staged; never `-a`, `git add -A`, `git add .` or `--amend`;
- a file holding another session's uncommitted edits is not written: the session waits up to five minutes for that commit, else stops and names the file;
- a dirty tree is not a blocker;
- a suite that fails outside the work's files is marked `[-] Tests: foreign uncommitted changes in {files}`, not investigated; the last stage's full suites run it again.

The demo the browser test runs on serves the shared checkout too: its report names the foreign uncommitted files it served.

## Rules that hold everywhere

- **Never push.** Agents commit locally; a human pushes. `init` writes the deny rule in the project's `.claude/settings.json`.
- **One stage per session**, unless the prompt chains them (`— stages 2-3 (web, e2e), chained`), still one commit per stage. The prompt names the stage (`/selo-flow:implement {plan folder} — stage 2 (web)`); the plan's Progress says where to resume.
- **One review, at the end.** The `reviewer` agent, read-only, reviews the whole work on the last stage: with a plan, the commits with the plan's scope since the one that added `plan.md` (other sessions' commits sit between them); in the fastlane, the work's commits. Findings it leaves open are settled later with `/selo-flow:review {plan folder}`.
- **Silence is not approval.** A spec or a plan written with the person is committed only after their yes; the commit approves it.
- **Spec changes go through `write-spec`**, even from a plan or from code, and ship in the plan's or the stage's commit.
- **Decisions in two lists**, in every mode: *Business decisions* (at most five, what the person would want to check) and *Technical defaults* (the rest), in the plan, or in the fastlane's commit body and report. A spec holds no decisions.
- **Subagents are the lead's choice.** `runner` for a command whose output would flood the context (a full suite, a build), `Explore` for a broad search, inline for a quick command or a single read. The role comes first in the spawn's description (`runner · web tests`).
- **Integration tests are never run unasked.** The lead gives the filtered command; it runs only on the person's explicit request, in the session.
- **Next prompts.** Every step ends with the prompt(s) of the next step, each in its own code block, real paths filled in.
- **Commit messages proposed before the commit.** Every request to approve a commit shows its exact message; a stage commit, made without asking, uses the subject the plan's Progress (or the approach) announced.
- **Done footer.** A turn that committed, a free request's included (the project's `CLAUDE.md` carries the rule), ends with `## ✅ JOB DONE`, a `> ` recap line in the chat language, and one line per commit: hash, subject, branch, `not pushed`. A free request answered without a commit ends with the recap line alone.
- **Language.** Agents speak to the person in `language.chat`; everything written to the repository is in `language.repo`. Messages between agents use the caveman voice; anything the person reads is rewritten in normal prose.

## Model tiering

The session model is the lead: it plans, decides and writes the code. High-volume mechanical work goes to cheaper subagents when the lead judges it worth it. Which model plays which role comes from the manifest's `models`, one per role (see `manifest.md`): a subagent is spawned with its role's model. The session's own model is the person's choice; the manifest says which one each role is meant for.

## The browser test

`test-in-browser` runs on the **demo**: the tested component's `commands.demo` on its `demo_url`, with those of the components it needs, seeded data on their own ports, started in the background under the lock `{git-common-dir}/selo-flow/demo.lock` (another session waits for the lock, not for a port) and stopped after the test. The person's dev servers and local data are never touched. It runs by default on the last stage when a touched component has a `url` and `commands.demo`; ` — without browser test` skips it, and a front with no demo is marked `[-] (no demo)`. Without a demo, asked by the person, it starts the dev servers that do not answer and stops them after the test.

## Validation of a plan

The plan's Validation checklist records the checks run on the finished implementation: `Review` (always, the only one the plan waits for), `Tests` (the full `test` command of every touched component that has one), `Browser test`, and `Integration tests` only when the person asked for them. The last stage ticks what it ran; an item not run stays `[ ]` or is marked `[-]` with the reason. A plan is done once every stage of its Progress and its `Review` are ticked.

## Planning conventions

`.claude/rules/planning.md` (the project's, written by `init` from the plugin's `templates/rules/`) defines the folder layout, the `plan.md` structure (Business decisions, Technical defaults, Context, one section per component touched sub-divided by its `layers`, Conventions, Tests, Deviations, Progress, Validation), the reserved slugs `tooling` and `shared`, the ideas file and the technical-debt file. `.planning/ideas.md` holds the person's ideas not yet specified: the project's `CLAUDE.md` tells every agent to append one there when the person asks, and never to act on it; the person removes an idea once it has become a spec.
