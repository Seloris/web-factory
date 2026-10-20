---
name: retro
description: "After Action Review of the session: what was meant to happen, what happened, why they differ, what to sustain and improve, written to .planning/retros/{timestamp}-{name}.md as lessons with their evidence, their destination and the change to make, status open; applies nothing. retro apply takes the open lessons of every retro, groups the duplicates, proposes each change to its destination (team memory, a CLAUDE.md, the technical debt, a proposal for the factory) and applies it on the person's yes. Use at the end of a session that taught something, when the person asks for a retro, a post-mortem or lessons learned, or to apply the lessons collected."
---

# Retro

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first (the project, manifest, language, commits, next prompts, done footer), then the project's `.claude/rules/planning.md` (the `retros/` folder). Two modes:

- `/factory:retro` or `/factory:retro {focus}`: review this session, write its retro. Writes no other file.
- `/factory:retro apply`: apply the open lessons of every retro.

A retro is the After Action Review of the US Army: it compares what was meant to happen with what happened, without blame, right after the work, so the next session does not repeat the gap. It records; `apply` decides later, with several retros in view, so one session's impression does not become a rule on its own.

## Retro

1. **Gather the evidence**, from this session and the repository, not from memory of other sessions:
   - **Intended:** the plan (its stages, Decisions, Tests), the spec ids it covers, or without a plan the approach agreed with the person.
   - **Happened:** `git log` of the branch (`base=$(git merge-base {baseBranch} HEAD)`, then `git log --oneline $base..HEAD`), the plan's Deviations and Validation, the failures and retries of the session (a red suite, a broken build, a command retried), the reviewer's findings, and every correction the person made.
   - **Earlier retros:** the lessons still `open` in `.planning/retros/*.md`. A lesson seen again is a recurrence: name the earlier retro in the evidence.
2. **Answer the four questions:** what was meant to happen, what happened, why they differ (the cause, not the symptom), what to sustain and what to improve.
3. **Write the lessons to improve**, at most five, each with:
   - **Evidence:** what in the session shows it (a correction, a failure, a finding, a recurrence).
   - **Destination**, the one place that owns the truth:
     | Lesson | Destination |
     |---|---|
     | A fact of the project, not obvious from the code | `.claude/rules/memory.md` (Entries) |
     | A test proven to fail without the session's changes | `.claude/rules/memory.md` (Known failing tests) |
     | How to work in one component (a convention, a command, a trap) | that component's `CLAUDE.md` |
     | How to work in the whole project | `CLAUDE.md` or a `.claude/rules/` file |
     | Code that is wrong or missing, out of the session's scope | `.planning/technical-debt.md` |
     | A rule of the workflow itself (a skill, a template, the workflow rules) | `factory` (a proposal for the plugin) |
   - **Change:** the text to add or replace, precise enough to apply without the session: the file, the section, the words. Never an observation alone ("improve the tests").

   Sustain lists what worked and must stay (a decision, a habit, a check that caught something), so that `apply` does not remove it. A lesson that only restates a rule already written is not a lesson: point to the rule in the evidence of the gap instead.
4. **Nothing to say:** when the session went as intended and taught nothing, say so in one line and write no file. Never invent a lesson to fill the retro.
5. **Write** `.planning/retros/{timestamp}-{name}.md`: timestamp from `node ${CLAUDE_PLUGIN_ROOT}/scripts/timestamp.mjs`, used as is; `{name}` a kebab-case summary of the session. In `language.repo`:

   ```markdown
   # Retro: {title}

   Date: {YYYY-MM-DD} · Branch: `{branch}` · Feature: `{slug}` · Plan: `{plan folder}` (or `none`)

   ## Intended
   ## Happened
   ## Why the gap
   ## Sustain
   - {what worked and must stay}

   ## Improve

   | # | Lesson | Evidence | Destination | Change | Status |
   |---|---|---|---|---|---|
   | 1 | {lesson} | {evidence} | {destination file, or `factory`} | {the text to add or replace} | open |
   ```

   Feature: the plan's slug, or without a plan the one the branch's commits name, else `tooling`. A section with nothing to say holds `None.`; no `Improve` table when there is no lesson to improve.
6. **Summarise and commit.** In `language.chat`, normal prose: the four answers in a few lines and the lessons. Then propose the commit of the retro file alone, `chore({slug}): retro — {name}`, the message in a code block, and make it on the person's yes. It lands on the current branch; on a feature branch whose squash is still to come, the squash folds it with the rest.
7. **Report:** when the retros now hold more than 10 open lessons, say so. Next prompts: `/factory:retro apply`; and when the retro commit follows a squash of the same branch (the branch no longer reaches the base branch as one commit), the squash again: `/factory:implement {plan folder} — close the branch`, without a plan `/factory:implement close the branch {branch}`. Then the done footer.

## Apply

1. **Collect** every row of the `Improve` tables of `.planning/retros/*.md` whose Status is `open`, with its retro.
2. **Group** the lessons that say the same thing, across retros: one change per group, the most recurrent group first. Read each destination file before proposing: a change already there marks its lessons `applied` with no diff, one that contradicts the file is shown with the line it contradicts.
3. **Propose** the groups to the person one at a time, in `language.chat`: the lesson, its evidence (the retros it comes from), the destination and the exact diff. The person answers yes, an edit or no; never apply a change without that answer. Follow the destination's own rules: an entry of `memory.md` is one dated line (`- {date} — {fact}`), an item of `technical-debt.md` follows its format in `planning.md`.
4. **The factory is never edited from a project.** The plugin is loaded from its cache (`${CLAUDE_PLUGIN_ROOT}`), and an edit there is lost on the next update. A `factory` lesson the person approves becomes a proposal, given in chat in a code block, for the person to carry to the plugin's repository: the file and the change, the case that motivated it (the retros' evidence) and the entry for the plugin's `CHANGELOG.md`. Its status becomes `forwarded`.
5. **Update the statuses**, the only edit made to a retro: `applied`, `rejected` or `forwarded` in each row's Status. A lesson left for later stays `open`.
6. **Commit**, on the person's yes, the destination files and the retros together: `chore({slug}): retro — apply lessons`, `{slug}` the branch's feature, else `tooling`, and a body listing the lessons applied, one per line. The message is in a code block.
7. **Report:** the lessons applied, rejected, forwarded and left open, then the done footer.

## Rules

- Never push. The retro and the apply are proposed for commit; nothing else is committed.
- A retro is a record: once committed, only its Status cells change, through `apply`.
- In autonomous mode this skill does not run: `autopilot` gives its prompt in its report.
