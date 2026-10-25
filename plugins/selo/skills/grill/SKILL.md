---
name: grill
description: "Grill the person on a blueprint's request, a request or a project setup: at most two rounds of the session's question tool, the recommended answer first, the rest left as open questions, then hand the decisions to blueprint, fastlane or setup. Writes nothing itself. Run it on /grill, when blueprint starts (unless the request already carries its decisions), or when the person accepts the offer: setup and any agent facing an ambiguous request offer it, never start it on their own. With — autonomous (from pilot), every question takes its recommended answer, and one with no recommendation stops the pipeline."
---

# Grill me

Interview the person until the request or setup has no open decision left. Find the edge cases now, not during the build. Inspired by Matt Pocock's `grill-me` / `grilling` skills (MIT).

Read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` first (the project, manifest, language, subagents).

Run on `/selo:grill`, from `blueprint` (it runs it unless the request already carries its decisions: ids cited, rules stated one by one), or after the person said yes to the offer. Elsewhere, offering it is cheap; running it costs several rounds, so never start it unasked.

## Target

- **Blueprint** (`/selo:grill {request or page}`, or run by `blueprint`): business questions first. Who, when, which rule, which page or domain sheet, what happens in each edge case: unauthorized user, empty list, concurrent edits, limits, multi-tenant or multi-scope cases when the project has them. Then the technical choices a reviewer would question (a route, a storage type, a contract rule), checked against the conventions of the components in scope (their `CLAUDE.md`, the project's `.claude/rules/`); never file-level detail.
- **Request** (offered by any agent when a request is ambiguous): whatever blocks the work.
- **Setup** (offered by `setup`): the manifest's values: components, stacks, commands, models, base branch.

## Facts and decisions

- **Facts** you look up yourself, never ask: current code behaviour, existing specs and blueprints, the conventions.
- **Decisions** go to the person: business rules, scope, trade-offs, names.

## Rounds

1. Build the decision tree: each decision opens the ones that depend on it. The frontier is every question answerable now; keep the ones whose answer changes the result.
2. Ask the frontier with the session's question tool: 1 to 4 questions per call, each with 2 to 4 options, the recommended one first and marked as recommended, its reason in a few words; the tool's free answer covers the rest. A question with no clear recommendation says so in its text (`no recommendation possible: {reason}`); never a vague one. Ask in `language.chat`. Without a question tool, ask in one message, numbered, each with its recommended answer phrased so that "yes" accepts it.
3. Each answer may open new questions: recompute the frontier and run the second round.
4. **Two rounds at most**, or fewer when the frontier is empty or the person says stop. What is still open becomes a `Q-NN` line of the delta (a blueprint) or an open question (a request).

## Hand-off

Write nothing, commit nothing. End with a summary in chat:

- **Blueprint target** (run by `blueprint`): each decision mapped to a Spec delta line (`{slug} + FR-NN`, `~`, `+ BR-NN`, a glossary entry of a domain sheet), a Business decision or a Technical default; what stays open as `Q-NN`. Then continue with `blueprint`, which writes them (no second confirmation for the person's answers).
- **Request target:** the agreed decisions, then resume the calling skill.
- **Setup target:** the manifest values, then resume `setup`.

When a skill called this one, return to it with the summary: no next prompts.

## Autonomous mode

Called with ` — autonomous` (by `blueprint` running under `pilot — autonomous`): same rounds, same rigour, nobody to answer. Build every round as above and answer each question with its recommended answer, until the frontier is empty: no round limit, no question skipped. Hand the result off exactly as in interactive mode, plus the list of every question with the answer taken and its reason, which the caller records as Business decisions or Technical defaults.

One question with `no recommendation possible` stops everything: write nothing, return the list of the open questions (every question of the frontier that was not answered) to the caller, which stops the pipeline with it.
