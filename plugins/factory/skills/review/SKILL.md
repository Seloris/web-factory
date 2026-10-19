---
name: review
description: "Run the read-only reviewer agent on the current branch, a range, files, a plan's implementation (review {plan folder}) or a dev-plan itself (review plan {plan folder}), relay its ranked findings, and record a clean review of a plan's implementation in its Validation, then propose the branch's squash once that finalizes the plan. Use when the person asks to review a branch, a stage, a plan, or the implementation of a plan, before opening a PR."
---

# Review

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first (the project, manifest, subagents, language, commits). The prompt gives the scope: `/factory:review` (the branch), `/factory:review {range or files}`, `/factory:review {plan folder}` (the plan's implementation: from the commit that added its `plan.md` to `HEAD`, plus the uncommitted changes) or `/factory:review plan {plan folder}` (the plan itself, before it is implemented).

1. Spawn the `reviewer` agent with the Agent tool, `model:` the manifest's `models.reviewer`, and a caveman-voice task naming the scope: the current branch against the base branch plus uncommitted changes by default; the range, files or plan folder the person gave; `plan {plan folder}` for a plan review. Add the plan folder or the agreed approach when you know it.
2. Wait for its report. Never edit code in this skill: the only file it touches is the plan's Validation (step 4).
3. Relay the findings to the person in `language.chat`, rewritten in normal prose, in the reviewer's order and with its tags and `file:line`, then its verdict line.
4. **Record the review** when the scope was a plan's implementation (`/factory:review {plan folder}`) and no finding is left, fixed or left open with the person's agreement: tick `Review` in the plan's Validation and propose its commit, `chore({slug}): validation — Review`, the message in a code block, on the person's yes. Once every stage is ticked too, the plan is finalized: after that commit, propose the squash as **Plan finalized** in `workflow-rules.md` says. A review with findings leaves `Review` as it is: the fixes' commit ticks it.
5. End with the next prompts: `/factory:implement fix findings {numbers} of the review` for code, `/factory:write-plan revise {plan folder}: findings {numbers}` for a plan, `/factory:implement {plan folder} — final review` when the plan's `Review` is still `[ ]`; none once the plan is finalized (the squash is proposed instead). The findings live only in this session: the fix prompt is run here, or its session gets the findings pasted in.
