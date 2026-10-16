# Factory helper pane (Panneau d'aide « fabrique ») — PRD

> **Slug**: `factory-helper`
> **Tags**: #plugin #mod
> **Status**: Draft
> **Last updated**: 2026-10-16

## TL;DR

A Claude Code pane that follows the factory workflow without calling a model: which plan is under way, which stage is next and on which model, the prompt to paste for it, which sessions are working on what right now, and a score of how well the session followed the rules. A generic rewrite of a pane built for one project, driven by the manifest instead of hard-coded stages.

## Problem

The workflow spans several sessions (one per stage) and several models. Without a pane, the person reads `plan.md` to find the next unchecked step, retypes the `/factory:implement …` prompt, forgets which model the step needs, and cannot see what another session on the same machine is doing. The original pane solved this for one project, with its two stages and its commands in the code.

## Goals

- From any session, the next step of the picked plan and its prompt are one press away, with the model it needs.
- The person sees every session of the machine working on this repository, and on which step.
- The person sees, per session, how well the workflow was followed and what cost points.
- The pane works on every project that has a manifest, with no project-specific code.

## Non-goals

- Starting sessions itself: the desktop app offers no safe way; the pane fills or copies the prompt.
- Picking the session's model: the person does, when creating the session.
- Replacing the skills: the pane reads plans, git and transcripts; it decides nothing.

## Users & Context

The developer, in the Claude Code desktop app or terminal, with a factory project open, several times a day while moving between stages.

## Domain Glossary

| Business term | Identifier | Business meaning | Status |
|---|---|---|---|
| `Panneau` | `Pane` | The mod's UI surface in Claude Code | New |
| `Chronologie` | `Timeline` | The plan's steps (plan, one per stage, review, tests, close) with their state | New |
| `Tuile` | `Tile` | A button carrying a prompt and the model it runs on | New |
| `Session en cours` | `Run` | What one session of this machine is doing on this repository, written to a per-session file | New |
| `Journal` | `History` | The recorded runs of a plan or a branch, per machine | New |
| `Score de conformité` | `Compliance score` | A score out of 100 from the session's transcript against the workflow rules | New |

## User Stories

- **US-01** — As a developer, I want to pick a plan (by feature or by date) or follow the current branch's dev without a plan so that the pane shows what I work on.
- **US-02** — As a developer, I want the plan's timeline with the next step marked and its prompt filled in or copied so that I never retype a prompt.
- **US-03** — As a developer, I want each tile to show the model its step runs on so that I create the next session on the right model.
- **US-04** — As a developer, I want to see the other sessions of this machine working on this repository, with their step and duration, so that I do not start a stage twice.
- **US-05** — As a developer, I want a compliance score with what cost points so that I notice when a session skipped the review or ran tests inline.
- **US-06** — As a developer, I want the stages, commands and models to come from the manifest so that the pane works on every project.

## Functional Requirements

- **FR-01** — The pane reads the manifest through the plugin's `manifest.mjs` and derives the timeline's stages from `stages`, the Validation items from `url` and `integration_tests`, and each tile's model from `models`.
- **FR-02** — The timeline marks a step done from the plan's Progress ticks and Validation ticks at `HEAD`, flags uncommitted ticks and a plan whose `plan.md` is untracked (draft).
- **FR-03** — A tile fills the prompt box when the box is empty and the session has not run another prompt; otherwise it copies the prompt and says where to run it and on which model.
- **FR-04** — Each session writes its run (step, target, state, model, started at) to a per-session file ignored by git; the pane lists the runs of the machine and drops stale ones.
- **FR-05** — The compliance score reads the session's transcripts and scores: lead model per step against the preset, subagent models, builds/tests/lint delegated, review before each commit, one stage per session; a hard rule broken (push, integration tests unasked) scores 0.
- **FR-06** — A `/factory-helper` command opens the pane; it is drawn for the desktop app and the terminal alike.

## Business Rules

- **BR-01** — The pane never calls a model and never edits a file of the repository.
- **BR-02** — The pane never opens a session.
- **BR-03** — Nothing project-specific in the pane's code: every name, command and model comes from the manifest or the plans.

## Open Questions

- **Q-01** — Where the per-machine run files live: under the plugin's data folder or under the repository in a git-ignored folder (`.factory-state/` is reserved for it in the templates' `.gitignore`).
- **Q-02** — Whether the `session-debug` pane (token breakdown, call tree) is ported too, as a second mod, or folded into this one.
