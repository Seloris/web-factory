---
name: review
description: "Run the read-only reviewer agent and relay its ranked findings. Scopes: the current work (nothing), a range or files, a blueprint's work (review {blueprint}), a blueprint before it is built (review blueprint {blueprint}), or a page or domain sheet (review {slug}: its spec against the code, FR by FR, and the open blueprints that touch it). Records a clean review of a blueprint's work in its Progress. Use when the person asks to review recent work, a blueprint, or how far a page's code matches its spec."
argument-hint: "[range | files | {blueprint} | blueprint {blueprint} | {slug}] [--worktree {name}]"
---

# Review

Read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` first (the project, manifest, subagents, language, commits). A 1.0 project (the rules' **A 1.0 project**): say so and give `/selo:setup update`.

The prompt gives the scope, and may end with ` --worktree {name}` (the rules' **Choosing the checkout**: that existing worktree entered first, said in one line `Worktree {name} · branch {branch} · slot …`; the work of a blueprint committed on its branch is reviewed there, `{baseBranch}..HEAD`):

- `/selo:review`: the uncommitted changes and the last commits of this work.
- `/selo:review {range or files}`.
- `/selo:review {blueprint}`: a blueprint's work, as **Where commits go** defines it, plus this work's uncommitted files.
- `/selo:review blueprint {blueprint}`: the blueprint itself, before it is built.
- `/selo:review {slug}`: a page or a domain sheet (`home`, `web/home`, `todo`; a slug is unique across `pages/` and `domain/`): its spec against the code, and the open blueprints that touch it. A page stub (`Status: to bootstrap`) has no spec to check: say so and give `/selo:setup specs {slug}`.

## Steps

1. **Open blueprints**, for a page or domain scope: the files of `.planning/blueprints/` whose header (`Pages:`, `Domain:`) or Spec delta names the slug, with `- [ ] Spec merged` and no `Legacy:` line. Note each one's name, its delta lines on the slug and its Progress.
2. **Spawn the `reviewer`** agent with the Agent tool, `model:` the manifest's `models.reviewer`, and a caveman-voice task naming the scope: the uncommitted changes plus the commits the person names by default (ask which when it is not clear: the base branch holds every session's work); the range, files or blueprint the person gave; `blueprint {file}` for a review before the build; for a page or domain sheet, `page {slug}` with the open blueprints of step 1.
3. **Wait** for its report. Never edit code in this skill: the only file it touches is the blueprint's Progress (step 5).
4. **Relay** the findings to the person in `language.chat`, rewritten in normal prose, in the reviewer's order and with its tags and `file:line`, then its verdict line. For a page or domain sheet: the FRs and BRs that do not hold, then those in flight, then the open blueprints (name, delta lines, Progress).
5. **Record the review** when the scope was a blueprint's work (`/selo:review {blueprint}`) and no finding is left, fixed or left open with the person's agreement: tick `Review` in the blueprint's Progress and propose its commit, `chore({name}): review`, the message in a code block, on the person's yes. A review with findings leaves `Review` as it is: the fixes' commit ticks it. A blueprint whose `Spec merged` is ticked is never edited: say the review is clean, tick nothing.
6. **Next prompts:** `/selo:fastlane fix findings {numbers} of the review` for code; `/selo:blueprint revise {file}: findings {numbers}` for a blueprint not built yet; `/selo:build {file}` once a blueprint's `Review` is ticked and its `Spec merged` is not; `/selo:review {blueprint}` again after the fixes while its `Review` is `[ ]`. For a page or domain sheet: `/selo:fastlane {a gap to fix}` for code that drifted from one page, `/selo:blueprint {the gaps}` for a missing rule or several pages, and a free request for a spec wording (no skill). The findings live only in this session: the fix prompt is run here, or its session gets the findings pasted in.
