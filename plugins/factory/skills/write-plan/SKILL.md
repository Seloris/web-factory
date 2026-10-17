---
name: write-plan
description: "Write a dev-plan under .planning/features/{slug}/dev-plans/: one plan.md with one section per component touched (sub-divided by its layers) and the test strategy, committed on the feature branch. Use when the person explicitly asks to plan a new feature, a change or refactor of an existing one, or a tooling change (reserved tooling slug). Plans only: never source code."
---

# Write a dev-plan

A plan precise enough to implement without guessing. This skill writes `plan.md` and images under `.planning/`, never source code. It never edits `00_spec.md` either: every spec change goes through the `write-spec` skill.

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first (the project, manifest, subagents, language, commits, next prompts), then the project's `.claude/rules/planning.md`: it defines the folder layout, the `plan.md` structure and naming. Ask rather than assume when a requirement is ambiguous.

The prompt names the feature: `/factory:write-plan {slug}` (or `/factory:write-plan {slug}: {request}`). The plan lives under `.planning/features/{slug}/dev-plans/`.

## Procedure

Given an uncommitted plan folder that the person says is validated (`/factory:write-plan {folder}: the plan is validated, commit it.`), skip to step 5: that request is its yes when the branch is settled (the current branch is not the base branch); on the base branch, ask for the branch name only, then commit.

1. **Context.**
   - Read the manifest: the components, their `layers` and `commands`, the `stages` order and the base branch.
   - Read the feature's `00_spec.md`. If it is missing and the slug is not `tooling` or `shared`, run the `write-spec` skill first.
   - Read the `CLAUDE.md` of every component in scope and the `.claude/rules/` files matching their paths, then the code of the area.
   - Refactor or non-trivial change of an existing feature: map it across every component and layer first (entities, use cases, endpoints, persistence, tests); an `Explore` subagent does a broad sweep well.
2. **Spec first.** Whenever the plan would change business behaviour (a user story, functional requirement or business rule), before or during the draft, run the `write-spec` skill in called mode: it writes the delta (asking first only for a change the person did not request), and the updated `00_spec.md` goes into the plan's commit. Then resume here. The plan only references spec ids; it never restates or changes business rules.
3. **Offer the grill.** Before the draft, always offer it in one line, in `language.chat`: *"I can challenge you first on the technical choices and edge cases (`grill-me`). Shall we?"* On yes, run the `grill-me` skill on the plan and build the draft from its decisions (they go in the Decisions section). On no, go on.
4. **Draft the plan in its file**, uncommitted, on the current branch. The plan's text is produced once, in `plan.md`: never paste its sections in chat, before or after writing them.
   - Infer the plan header (slug, components in scope, spec ids covered) and the branch as `planning.md` describes, and create the plan folder with the timestamp from `node ${CLAUDE_PLUGIN_ROOT}/scripts/timestamp.mjs`. If an earlier session left a never-committed plan folder for this slug, name it and ask the person first whether to resume it or delete it.
   - Write `plan.md` in full, following the `plan.md` structure: one section per component touched, in stage order, sub-divided by that component's `layers`. Its Tests section lists, per component, the unit tests and the integration tests to write (or "none" with the reason), honouring each component's own testing conventions (a component whose `CLAUDE.md` says "no unit tests" gets none). The implementation writes exactly these tests and does not ask again.
   - Then post one short message: the header and the branch, a link to the draft, what the plan changes in at most ten lines (one per component touched, with its stage's commit subject, one for the tests), and your open questions, if any. Offer in one line to review the draft first, in this session (`/factory:review plan {plan folder}`): its findings are applied here, before the commit.

   Iterate until the person is satisfied: apply each change with a targeted `Edit` of the draft and say what changed in a line or two. Never rewrite the whole file, and move the folder when the person corrects the slug, the type or the name. Record the questions the person answered in the Decisions section as they are answered.
5. **One confirmation**, which always names the branch and shows the commit message in a code block: *"Commit the plan `.planning/features/{slug}/dev-plans/{folder}/` on branch `{branch}` with `docs({slug}): plan {type}-{name}`?"* The plan's Progress already carries each stage's commit subject, so the person approves those with the plan. On no, go back to step 4; if the person drops the plan, delete the draft folder and say so. On yes:
   - on the base branch, create the branch the person validated (the uncommitted draft follows); on another branch, stay on it;
   - if the spec's `Status` is still `Draft` (a spec this plan drafted in called mode, or one committed before specs were approved at their commit), have `write-spec` mark it `Approved` (status only: no extra confirmation, the plan confirmation covers it);
   - commit the plan folder, with the `00_spec.md` delta or status change if any, and nothing else from the working tree: `docs({slug}): plan {type}-{name}`. Never push.
6. **Stop.** End with the branch and the path of the new plan folder, then the next prompts: `/factory:implement {plan folder} — stage 1 ({component})` in a new session, and when the plan has several stages `/factory:implement {plan folder} — stages 1-{M} ({components}), chained` to run them all in one session.

Save any image the person shares as soon as it is shared, following the Images rule.
