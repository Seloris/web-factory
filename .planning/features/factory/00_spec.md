# Factory workflow plugin (Plugin de workflow « fabrique ») — PRD

> **Slug**: `factory`
> **Tags**: #plugin
> **Status**: Approved
> **Last updated**: 2026-10-16

## TL;DR

A developer who starts or maintains a web application (front, API, database) wants the same disciplined process on every project: a business spec per feature, a precise dev-plan, test-first implementation in reviewed stages, one squashed commit per branch. The `factory` plugin carries that process, stack-agnostic, driven by a manifest each project declares in its `CLAUDE.md`.

## Problem

The process existed once, hand-built inside one client project, with the stack, the layer names, the commands and the model choices hard-coded in its skills, hooks and pane. Starting the next project meant copying and editing dozens of files, and every improvement had to be ported by hand. The process must live in one place, installable anywhere, and read what differs per project from that project.

## Goals

- A new repository becomes a factory project in one session (`init`), with no application code written for it.
- The same skills run unchanged on a .NET + Angular project, a Node project or a front-only project: nothing in the plugin names a stack.
- An improvement to the workflow reaches every project through a plugin update.
- A project's model choices (which model plans, implements, reviews, runs) are one line in its manifest.

## Non-goals

- Scaffolding application code: a stack pack may do it later; the plugin never does.
- Pull-request review on the hosting platform: the review happens before each commit, locally.
- Supporting other agents (Copilot, Cursor): Claude Code only; a project may add an `AGENTS.md` pointing at `CLAUDE.md`.
- Several applications in one repository: one repository is one application with several components.

## Users & Context

The developer, alone or in a small team, in Claude Code (terminal or desktop app), on a repository they own. Daily, from the first spec of a feature to the close of its branch.

## Domain Glossary

| Business term | Identifier | Business meaning | Status |
|---|---|---|---|
| `Fabrique` | `Factory` | The plugin and its conventions | New |
| `Manifeste` | `Manifest` | The fenced `factory` block of a project's root `CLAUDE.md`, plus the `component` block of each component's `CLAUDE.md` | New |
| `Composant` | `Component` | One deployable or buildable part of the application (api, front, db, worker, lib), with its own path, `CLAUDE.md`, layers and commands | New |
| `Étape` | `Stage` | The implementation of one component, in one session, ending in one commit | New |
| `Passage de relais` | `Handoff` | The file a stage leaves for the next one (an OpenAPI document, a schema) | New |
| `Pack de stack` | `Stack pack` | Stack-specific component templates and skills `init` copies into a project | New |
| `Préréglage de modèles` | `Model preset` | A named mapping of workflow roles to models | New |
| `Fiche de spec` | `Spec` | `.planning/features/{slug}/00_spec.md` | Reused |
| `Plan de dev` | `Dev-plan` | `.planning/features/{slug}/dev-plans/{ts}-{type}-{name}/plan.md` | Reused |

## User Stories

- **US-01** — As a developer, I want to install the factory on any machine from its GitHub repository so that every project of mine gets the same workflow.
- **US-02** — As a developer, I want to turn a repository into a factory project by answering questions so that I never copy instruction files by hand.
- **US-03** — As a developer, I want to write a business spec for a feature with the assistant so that the plan and the code have a reference that never says how.
- **US-04** — As a developer, I want a dev-plan precise enough to implement without guessing so that implementation sessions do not re-decide.
- **US-05** — As a developer, I want implementation to run one stage per session, test-first, verified and reviewed before each commit so that every commit on a branch is trustworthy.
- **US-06** — As a developer, I want a branch to reach the base branch as one commit so that history stays readable.
- **US-07** — As a developer, I want to be grilled on open decisions before a spec or a plan so that edge cases surface before the code.
- **US-08** — As a developer, I want to choose which models plan, implement, review and run so that I control cost and quality per project.
- **US-09** — As a developer, I want builds, tests and broad searches kept out of my main session so that its context stays small and cheap.
- **US-10** — As a developer, I want a component's instructions to live with the component so that it stays autonomous and can move to its own repository.

## Functional Requirements

- **FR-01** — The plugin installs from a marketplace (GitHub or local path) and exposes its skills under the `factory:` prefix.
- **FR-02** — `init` interviews the person in the grill format and writes: the root `CLAUDE.md` with the manifest, one `CLAUDE.md` per component, `.claude/settings.json`, `.claude/rules/planning.md` and `memory.md`, `.planning/`, `docs/CONTRIBUTING.md`; it merges into existing files rather than replacing them.
- **FR-03** — The manifest declares the project name, base branch, chat and repository languages, model preset, components (name, path, handoff, needs, url) and hook switches; each component's block declares kind, stack, layers, commands (build, test, lint, prepare, handoff, integration_tests) and logins file.
- **FR-04** — One Node script parses both blocks and serves every consumer (skills through its CLI, hooks, the helper pane).
- **FR-05** — `write-spec` is the only writer of `00_spec.md`; `write-plan` writes one section per component touched, sub-divided by that component's layers, with Tests, Progress and Validation checklists.
- **FR-06** — `implement` runs the stages in the manifest's order honouring `needs`, starting each with the component's `prepare` and ending it with its `handoff`, verifies with the component's `build`, `test` and `lint`, runs the reviewer before the stage commit, records Deviations, and offers the final review and the branch close.
- **FR-07** — `grill-me` asks numbered questions with a recommended answer, at most seven per round, and hands its decisions to the calling skill without writing anything.
- **FR-08** — The reviewer is a read-only agent reporting ranked findings against the plan, the spec, the components' conventions and correctness; it can review a plan before implementation.
- **FR-09** — Model presets `standard` (Opus plans and reviews, Sonnet implements with Opus advisor, Haiku runs) and `premium` (Fable plans and reviews, Opus implements with Fable advisor, Haiku runs) map roles to models; a manifest may override any role. Agents carry no fixed model; the spawning skill passes the role's model.
- **FR-10** — Two hooks guard the lead session: declared commands, package restores and repo-wide shell searches are denied; past a configurable number of inline exploration calls, searches are denied and reads carry a reminder. Both are switchable per project and by a human environment variable.
- **FR-11** — `test-in-browser` checks a front component on its declared url with the accounts of its logins file, through the session's browser tools, and reports per scenario.
- **FR-12** — Stack packs live in the plugin under `stacks/{stack}/` with component templates and skills; `init` copies them for a component whose stack has a pack. The first pack is `dotnet-angular`.
- **FR-13** — Every workflow step ends with the next step's prompt(s) in code blocks; a turn that committed ends with the done footer.

## Business Rules

- **BR-01** — No agent ever pushes; a human pushes.
- **BR-02** — A spec or a plan is committed only after an explicit yes; silence is not approval.
- **BR-03** — Integration tests and suites calling external systems run only on the person's explicit, named request, through the runner, which refuses without the quoted request.
- **BR-04** — A business behaviour change found while planning or coding goes through `write-spec` before the plan or the code; a delta restating the person's request needs no confirmation, any other waits for a yes.
- **BR-05** — One stage per session unless the person asked to chain them in the prompt that starts the work.
- **BR-06** — The plugin's skills, agents and scripts name no stack; stack words belong to `stacks/` and `examples/`.
- **BR-07** — Agents talk to the person in the manifest's chat language; everything written to the repository is in its repository language; agent-to-agent messages use the caveman voice.
- **BR-08** — A plan whose `plan.md` is untracked is a draft: `implement` never starts from it.
- **BR-09** — A branch is closed (squashed) only on the person's yes, in the session, after checking nothing is uncommitted, nothing is pushed and every commit is the feature's.

## Open Questions

- **Q-01** — Should `init` offer to write an `AGENTS.md` containing `@CLAUDE.md` for tools that read it (Copilot, Codex)? Out of scope for now; a project adds it by hand.
- **Q-02** — Should a stack pack be able to ship a code skeleton (`skeleton/{kind}/`)? The pack layout reserves the folder; nothing uses it yet.
