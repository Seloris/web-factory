---
name: reviewer
description: "Run the read-only reviewer agent on the current branch, a range, files, or a dev-plan (reviewer plan {plan folder}), and relay its ranked findings. Use when the person asks to review a branch, a stage, a plan, or the implementation of a plan, before opening a PR."
---

# Review

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first (manifest, models, language).

1. Spawn the `reviewer` agent with the Agent tool, `model:` the manifest's `models.reviewer`, and a caveman-voice task naming the scope: the current branch against the base branch plus uncommitted changes by default; the range, files or plan folder the person gave; `plan {plan folder}` for a plan review. Add the plan folder or the agreed approach when you know it.
2. Wait for its report. Never edit a file yourself in this skill.
3. Relay the findings to the person in `language.chat`, rewritten in normal prose, in the reviewer's order and with its tags and `file:line`, then its verdict line.
4. End with the next prompts: `/factory:implement fix findings {numbers} of the review` for code, `/factory:write-plan revise {plan folder}: findings {numbers}` for a plan, or the close of the branch when the review is clean and the plan's Validation is all ticked.
