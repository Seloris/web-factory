---
name: write-spec
description: "Write the spec of an area of the application (.planning/features/{slug}/00_spec.md): how that area behaves today, in the present tense. The only writer of 00_spec.md. Use for a new area (a short grill, then the spec), an update (a delta), when write-plan or implement change a behaviour (called mode), and once per old spec with — rewrite. With — autonomous (under autopilot): no question, defaults taken and reported."
---

# Write the spec of an area

A spec says how one **area** of the application (a screen, a route, a domain) behaves today, for whom, and which rules it enforces: present tense, readable in five minutes. Never how: when endpoints, tables, components, contracts or migrations come up, lock the business name, say it belongs to the plan, move on. No history, no decisions, no `Status`, no `Updated`: git holds them.

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first; its **The spec follows the code** says when a spec changes, and the `Spec:` line. `write-plan` and `implement` call this skill instead of editing a spec.

`/factory:write-spec {request or slug}`, optionally ending with ` — rewrite` or ` — autonomous`.

## Writing rules

- One file per area, plus `assets/` for the images the person shares. Edited in place with targeted `Edit`s, never redrafted (except `— rewrite`).
- **Each fact once.** FRs and BRs carry the behaviour; the other sections give context and never restate them. A rule that is a non-goal is a non-goal.
- An `FR-NN` is one sentence a reviewer can check an implementation against, with its reason (`… so that …`) when not obvious. FRs are grouped under `###` headings, one per screen or zone, in the order the person meets them.
- A revised FR is rewritten under its id. A replaced or dropped FR or BR is deleted and its id added to the `Retired:` line; never strike through. A resolved `Q-NN` is retired the same way and becomes an FR or a BR.
- An FR not built yet reads `- **FR-48** — (planned) …`; the stage that builds it removes the mark.
- Ids (`FR`, `BR`, `US`, `Q`) are append-only, never renumbered, never reused. Take the next one from `node ${CLAUDE_PLUGIN_ROOT}/scripts/spec-check.mjs {slug}`, and run it again before any commit.
- Renaming a glossary entry updates every plan using the old name.
- Written in `language.repo`; business terms of the person's language inline in backticks.

## Which area

The area whose screen, route or domain the request touches. A new area only for its own screen, route or domain; otherwise the nearest area takes the FR, said in the report. Creating an area is a Business decision.

## Modes

### New area

1. **Grill**, unless the request already carries its decisions (ids cited, rules stated one by one): run `grill-me` on the request, through the session's question tool, four questions per call, the recommended answer first, the slug as the first question; two rounds at most; what stays open becomes `Q-NN`.
2. **Draft the whole spec in one pass** into `00_spec.md` (Template), every FR `(planned)`. Never paste it in chat: post a link, one line per section, the Domain Glossary in full, the open questions.
3. Iterate with targeted edits, then **Commit**.

### Update

Read the spec and the area's code. Write the delta: `+ FR-NN`, `~ FR-NN: before → after`, `- FR-NN`, `Q-NN → BR-NN`. Ask through the question tool only what the delta leaves open, one round. Apply it, show it, then **Commit**.

### Called mode

From `write-plan` or `implement`, same session, the caller's slug:

- a delta that restates the request, or a choice the person already made: applied, no question;
- a delta nobody asked for: applied and handed to the caller, which asks one grouped question at the end of its work (interactive) or lists it first in its Business decisions (autonomous);
- no spec for the area: a stub, no question, filled by the next changes:

  ```markdown
  # {Area} — Spec
  > **Slug**: `{slug}`
  ## TL;DR
  {one or two sentences}
  ## Functional Requirements
  - **FR-01** — {one per behaviour touched}
  ```

No commit, no next prompt: the caller commits the spec with its code or its plan. FRs that commit builds carry no `(planned)`; FRs a plan adds do.

### `— rewrite`

Once per spec written before this version. Rewrite `00_spec.md` to the Template: present tense, FRs grouped by screen or zone, ids kept; superseded or struck-through items deleted, their ids on `Retired:`; `Status`, `Last updated`, `Decisions taken autonomously` and any history removed (a reason still needed becomes a `so that`). No behaviour added, changed or dropped: spawn `reviewer` on the old and new versions, and fix every change of meaning before the commit. Subject: `docs({slug}): spec — rewrite in present tense`.

### Autonomous mode

` — autonomous` (from `autopilot`): no question. `grill-me` runs autonomous, the slug is the proposed one. Its decisions go into the report, Business decisions first (a new area among them), never into the spec. One with no defensible answer stops the step, nothing written. Commit without asking.

## Commit

A spec written on its own is its own commit on `baseBranch`, holding only its files:

```
git add {files written} && git commit --only -m "{subject}" -- .planning/features/{slug}/00_spec.md {assets written}
```

Subject `docs({slug}): spec — {summary}`. Interactive: show the exact message in a code block, ask, commit on yes. Dropped: delete a new spec's draft, or take your own edits back out (never `git checkout` the file). A spec holding another session's uncommitted edits follows the workflow rules. Unless called, end with `/factory:write-plan {slug}`.

## Template

Required (except for a stub): the header, TL;DR, Problem, Non-goals, Functional Requirements. The others only when they add something: Domain Glossary (a name the plans and code will carry, never UI words), User Stories (several roles only), Business Rules (a policy an implementation could silently break), UX Flow (a UI), Open Questions, `Retired:`.

```markdown
# {Area} ({name in the person's language}) — Spec

> **Slug**: `{slug}` · **Tags**: {#tag …}

## TL;DR
{2–3 sentences: what, for whom.}

## Problem
{The concrete pain in a real situation.}

## Non-goals
- {Out of scope, reason if not obvious.}

## Domain Glossary
| Business term | Identifier | Business meaning |
|---|---|---|

## User Stories
- **US-01** — As a {role}, I want {capability} so that {benefit}.

## Functional Requirements
### {Screen or zone}
- **FR-01** — {What the system does, one sentence.}
- **FR-02** — (planned) {…}

## Business Rules
- **BR-01** — {Policy the system enforces.}

## UX Flow
{Short bullets or a Mermaid `flowchart`.}

## Open Questions
- **Q-01** — {Question still open.}

Retired: FR-07, BR-04
```
