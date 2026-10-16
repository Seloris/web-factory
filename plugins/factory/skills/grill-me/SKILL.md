---
name: grill-me
description: "Grill the person on a spec, a dev-plan, a request or a project setup: rounds of numbered questions, each with a recommended answer, until every open decision is settled, then hand the decisions to write-spec, write-plan, implement or init. Writes nothing itself. Run it only when the person types /grill-me or accepts the offer: write-spec, write-plan, init and any agent facing an ambiguous request offer it, never start it on their own."
---

# Grill me

Interview the person until the spec, plan, request or setup has no open decision left. Find the edge cases now, not during the plan or the code. Inspired by Matt Pocock's `grill-me` / `grilling` skills (MIT).

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first (the project, manifest, language, subagents).

Run only on `/factory:grill-me` or after the person said yes to the offer. Offering it is cheap; running it costs several rounds, so never start it unasked.

## Target

- **Spec** (`/factory:grill-me {slug}`, or offered by `write-spec`): business questions only. Who, when, which rule, what happens in each edge case: unauthorized user, empty list, concurrent edits, limits, multi-tenant or multi-scope cases when the project has them. A technical question (endpoint, contract, table, component) is parked for the plan: note it and move on.
- **Plan** (`/factory:grill-me plan {plan folder}`, or offered by `write-plan`): technical decisions too, checked against the spec ids and the conventions of the components in scope (their `CLAUDE.md`, the project's `.claude/rules/`). A business gap found here is a spec question first.
- **Request** (offered by any agent when a request is ambiguous): whatever blocks the work.
- **Setup** (offered by `factory-init`): the manifest's values: components, stacks, commands, models, base branch.

## Facts and decisions

- **Facts** you look up yourself, never ask: current code behaviour, existing specs and plans, the conventions.
- **Decisions** go to the person: business rules, scope, trade-offs, names.

## Rounds

1. Build the decision tree: each decision opens the ones that depend on it. The frontier is every question answerable now.
2. Ask the whole frontier in one message, at most 7 questions, numbered. Each question gives a recommended answer phrased so that "yes" accepts it, and the reason in a few words. Ask in `language.chat`.
3. Wait. The person answers per number (`1 yes, 2 no: …, 3 ?`). A `?` means explain, then ask again.
4. Each answer may open new questions: recompute the frontier and run the next round.
5. Stop when the frontier is empty, or when the person says stop: the questions left become open questions.

## Hand-off

Write nothing, commit nothing. End with a summary in chat:

- **Spec target:** each decision mapped to `+ US-NN`, `+ FR-NN` / `~ FR-NN`, `+ BR-NN` or a glossary entry; questions left open as `Q-NN`; parked technical questions for the plan. Then continue with `write-spec`, which writes them (the person's answers count as their request: no second confirmation for them).
- **Plan target:** the decisions for the plan's Decisions section, and the steps they change. Then continue with `write-plan`.
- **Request target:** the agreed decisions, then resume the calling skill.
- **Setup target:** the manifest values, then resume `factory-init`.

When a skill called this one, return to it with the summary: no next prompts.
