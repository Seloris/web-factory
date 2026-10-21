---
name: grill-me
description: "Grill the person on a spec, a dev-plan, a request or a project setup: at most two rounds of the session's question tool, the recommended answer first, the rest left as open questions, then hand the decisions to write-spec, write-plan, implement or init. Writes nothing itself. Run it only when the person types /grill-me or accepts the offer: write-spec, write-plan, init and any agent facing an ambiguous request offer it, never start it on their own. With — autonomous (under autopilot), every question takes its recommended answer, and one with no recommendation stops the pipeline."
---

# Grill me

Interview the person until the spec, plan, request or setup has no open decision left. Find the edge cases now, not during the plan or the code. Inspired by Matt Pocock's `grill-me` / `grilling` skills (MIT).

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first (the project, manifest, language, subagents).

Run only on `/selo-flow:grill-me` or after the person said yes to the offer. Offering it is cheap; running it costs several rounds, so never start it unasked.

## Target

- **Spec** (`/selo-flow:grill-me {slug}`, or offered by `write-spec`): business questions only. Who, when, which rule, what happens in each edge case: unauthorized user, empty list, concurrent edits, limits, multi-tenant or multi-scope cases when the project has them. A technical question (endpoint, contract, table, component) is parked for the plan: note it and move on.
- **Plan** (`/selo-flow:grill-me plan {plan folder}`, or offered by `write-plan`): technical decisions too, checked against the spec ids and the conventions of the components in scope (their `CLAUDE.md`, the project's `.claude/rules/`). A business gap found here is a spec question first.
- **Request** (offered by any agent when a request is ambiguous): whatever blocks the work.
- **Setup** (offered by `init`): the manifest's values: components, stacks, commands, models, base branch.

## Facts and decisions

- **Facts** you look up yourself, never ask: current code behaviour, existing specs and plans, the conventions.
- **Decisions** go to the person: business rules, scope, trade-offs, names.

## Rounds

1. Build the decision tree: each decision opens the ones that depend on it. The frontier is every question answerable now; keep the ones whose answer changes the result.
2. Ask the frontier with the session's question tool: 1 to 4 questions per call, each with 2 to 4 options, the recommended one first and marked as recommended, its reason in a few words; the tool's free answer covers the rest. A question with no clear recommendation says so in its text (`no recommendation possible: {reason}`); never a vague one. Ask in `language.chat`. Without a question tool, ask in one message, numbered, each with its recommended answer phrased so that "yes" accepts it.
3. Each answer may open new questions: recompute the frontier and run the second round.
4. **Two rounds at most**, or fewer when the frontier is empty or the person says stop. What is still open becomes `Q-NN` (a spec) or an open question (a plan, a request).

## Hand-off

Write nothing, commit nothing. End with a summary in chat:

- **Spec target:** each decision mapped to `+ US-NN`, `+ FR-NN` / `~ FR-NN`, `+ BR-NN` or a glossary entry; questions left open as `Q-NN`; parked technical questions for the plan. Then continue with `write-spec`, which writes them (the person's answers count as their request: no second confirmation for them).
- **Plan target:** the decisions for the plan's Business decisions and Technical defaults, and the steps they change. Then continue with `write-plan`.
- **Request target:** the agreed decisions, then resume the calling skill.
- **Setup target:** the manifest values, then resume `init`.

When a skill called this one, return to it with the summary: no next prompts.

## Autonomous mode

Called with ` — autonomous` (by `write-spec` or `write-plan` running under `autopilot`): same rounds, same rigour, nobody to answer. Build every round as above and answer each question with its recommended answer, until the frontier is empty: no round limit, no question skipped. Hand the result off exactly as in interactive mode, plus the list of every question with the answer taken and its reason, which the caller records as Business decisions or Technical defaults.

One question with `no recommendation possible` stops everything: write nothing, return the list of the open questions (every question of the frontier that was not answered) to the caller, which stops the pipeline with it. A technical question parked for the plan is not open: it is parked as in interactive mode.
