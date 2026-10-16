---
name: write-spec
description: "Draft or update a feature's business spec (.planning/features/{slug}/00_spec.md) with the person: problem, non-goals, functional requirements, business rules, plus the user stories and the glossary when they add something. The only way 00_spec.md is ever written. Use for a new business idea, to update the spec of an existing feature, when a plan needs a spec that does not exist yet, or when planning or implementing reveals a business behaviour change."
---

# Write or update a feature spec

The spec says what the feature does, for whom, why, and which rules it enforces. It never says how. When the person brings up properties, relationships, endpoints, contracts, components, tables, authorization policies or migrations, say it belongs to the plan, lock the name and business meaning, and move on.

This skill is the only writer of `00_spec.md`: planning (`write-plan`) and implementation (`implement`) call it instead of editing the spec themselves.

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first (the project, language), and the project's `.claude/rules/planning.md`.

The prompt names the feature: `/factory:write-spec {feature}`. The spec lives under `.planning/features/{slug}/`.

## Rules

- A single file per feature: no sibling files or subfolders (except `assets/`). Existing specs are edited in place, never redrafted.
- **Each fact once.** The plan and the reviewer work from the numbered requirements; the other sections give them context, they do not repeat them. A sentence that restates another section is removed. A business rule that is already a non-goal is a non-goal.
- An `FR-NN` is one sentence the reviewer can check an implementation against; its reason goes in the same sentence (`… so that …`) when it is not obvious.
- `US-NN`, `BR-NN` and `Q-NN` are append-only and never renumbered (plans reference them). `FR-NN` is revised in place under the same id.
- A resolved `Q-NN` is removed from Open Questions and becomes an `FR-NN` or `BR-NN`.
- Renaming a Domain Glossary entry is a breaking change: update every plan that uses the old name.
- `Status` starts at `Draft` and becomes `Approved` the first time a plan is confirmed against the spec (`write-plan` asks for it). Bump `Last updated` on every edit.
- Written in `language.repo`, with business terms of the person's language allowed inline in backticks.
- A spec written or updated on its own (Procedure below) is its own commit, containing only `00_spec.md` (and its `assets/`): `docs({slug}): spec — {summary}`.
- In called mode, the spec change is **not** committed alone: it goes into the calling skill's commit (the plan's commit, or the implementation stage's commit), so the spec and the change that motivates it ship together. The `Draft` → `Approved` switch also goes in the plan's commit. Never push.

## Called mode

When `write-plan` or `implement` calls this skill for a business behaviour change found while planning or coding:

1. Write the delta: `+ US-NN` / `+ BR-NN` for additions, `~ FR-NN: before → after` for revisions, `Q-NN resolved → BR-NN`.
2. **Delta that only restates what the person explicitly asked for** (the request, or a choice they already made in the conversation): no extra confirmation. Edit the spec in place following the Rules, and show the delta in the calling skill's report.
   **Delta the person did not ask for** (a business behaviour change discovered while planning or coding): propose it in chat and wait for the person's yes before editing.
3. Do not commit: the calling skill commits `00_spec.md` with its own work. Return to it: no next prompts.

## Procedure

1. **Slug.** List `.planning/features/` and propose a slug, reusing an existing one first: *"Suggested feature slug: **`{slug}`** (existing | new) — {rationale}. Confirm, or suggest another?"* Wait for confirmation.
2. **New or update.** For an update, read the current spec and edit it in place. If it already holds uncommitted changes (`git diff` on the file is not empty), say so and ask the person what to do with them before drafting: they would end up in the spec's commit. Read the code to understand current behaviour, but never copy technical detail into the spec.
3. **Offer the grill.** Before drafting, always offer it in one line, in `language.chat`: *"I can challenge you first on the business rules and edge cases (`grill-me`). Shall we?"* On yes, run the `grill-me` skill on the spec, then draft from its decisions. On no, go on.
4. **Draft the whole spec in one pass**, straight into `00_spec.md`, uncommitted, with only the sections that earn their place (Template below). The spec's text is produced once, in the file: never paste a section in chat. Then post one message: a link to the file, the gist of each section in a line, the Domain Glossary table in full when there is one (every future plan uses these names), and the questions left open. Iterate until the person is satisfied: apply each refinement with a targeted `Edit` and say what changed in a line. Never rewrite the whole file.
5. **Confirm and commit.** Ask *"Commit `.planning/features/{slug}/00_spec.md`?"*, and on yes commit it (see Rules). If the person drops it instead, delete the draft of a new spec, or take your own edits back out of an existing one (never `git checkout` the file: it may hold other uncommitted changes), and say so. Unless another skill called this one, end with the next prompt: `/factory:write-plan {slug}` in a new session.
6. **Images** the person shares are saved in `.planning/features/{slug}/assets/` and referenced from the relevant section (usually UX Flow or Problem).

## Template

Required: the header block, TL;DR, Problem, Non-goals, Functional Requirements. The other sections only when they say something the required ones do not:

| Section | Write it when |
|---|---|
| Goals | the observable outcomes are not obvious from the TL;DR |
| Users & Context | there are several roles, or the circumstances of use matter (frequency, device, place); one role with an obvious use is a clause of the TL;DR |
| Domain Glossary | the feature introduces or reuses a name the plans and the code will carry (an entity, a concept with a business meaning); never for the words of the UI |
| User Stories | there are several roles, or a benefit no FR carries; a single role whose reasons are in the FRs needs none |
| Business Rules | a policy or constraint an implementation could silently break, and which is not already a non-goal |
| UX Flow | the feature has a user interface |
| Open Questions | a decision is still open |

```markdown
# {Feature name} ({feature name in the person's language, if different}) — PRD

> **Slug**: `{slug}`
> **Tags**: {#tag …; omit the line when none applies}
> **Status**: Draft | Approved
> **Last updated**: {YYYY-MM-DD}

## TL;DR

{2–3 sentences: the problem, who has it, what this feature does about it.}

## Problem

{Why this feature exists. A concrete pain point in a real user situation, not a generic statement.}

## Goals

- {Observable outcome: what becomes true once this ships.}

## Non-goals

- {Explicitly out of scope, with a one-line reason if not obvious.}

## Users & Context

{Who uses the feature, in which role, in which circumstances. Frequency and typical scenario if relevant.}

## Domain Glossary

Canonical entity names introduced or reused. Names only: no properties, relationships or persistence.

| Business term | Identifier | Business meaning | Status |
|---|---|---|---|
| `Contrat` | `Site` | A commercial agreement between the company and a `KeyAccount` | Reused |
| `Type d'intervention` | `InterventionType` | The kind of on-site intervention scheduled by a technician | New |

## User Stories

- **US-01** — As a {role}, I want {capability} so that {benefit}.

## Functional Requirements

- **FR-01** — {What the system must do, one sentence, with its reason when not obvious.}

## Business Rules

- **BR-01** — {Policy or constraint the system must enforce.}

## UX Flow

{Short bulleted walkthrough or a Mermaid `flowchart`.}

## Open Questions

- **Q-01** — {Question to settle before or during planning.}
```
