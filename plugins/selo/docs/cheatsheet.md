# Cheat sheet

Sessions open at the project's root with the plugin loaded. Paths start there (`.planning/features/{slug}/dev-plans/{ts}-{type}-{plan}/`). Skills carry the plugin's prefix: `/selo:…`. Everything is committed on the base branch.

## Which path?

| I want to… | Do this |
|---|---|
| Set up the project | `/selo:setup` |
| Bring the project up to date with the plugin (a 1.0 project: migrated to pages, domain sheets and blueprints) | `/selo:setup update` |
| Give a front a skin, or switch it | `/selo:setup skin {component} {skin}`, then a blueprint to apply it to existing screens |
| Ask a question | Just ask. No skill. |
| Change something, fix a bug (the fastlane) | `/selo:fastlane {request}` |
| A new page, entity or rule, several pages (the blueprint lane) | `/selo:blueprint {request}`, then `/selo:build {blueprint}` |
| Specify then develop a feature (1.0 layout, the feature lane) | `/selo:write-spec {request}`, then `/selo:write-plan {slug}` |
| Implement an existing plan | `/selo:fastlane {plan folder}` |
| Let it choose the lane and do everything, no click | `/selo:autopilot {request}` (or `{slug}`, or `{plan folder}` to resume); ` — fastlane`, ` — with plan`, ` — until spec`, ` — until plan`, ` — without browser test` |
| Review recent work | `/selo:review` (or a range, files) |
| Review a plan before coding, or settle a plan's open review | `/selo:review plan {plan folder}`, `/selo:review {plan folder}` |
| Check a whole area's spec against the code | `/selo:review {slug}` |
| Rewrite an old spec in the present tense | `/selo:write-spec {slug} — rewrite` |
| Settle open decisions first | `/selo:grill {slug}` |
| Click through the app on its demo | `/selo:try {component} …` (starts the demo in the background, stops it after) |

## Fastlane

```
/selo:fastlane Add a cutoff time on order publication
```

The area's code is read, then each component touched: tests first, build + full test + lint, the spec delta. On the last one: the review of the whole work, the full suites, the browser test on the demo. Then one commit per component, each with its `Spec:` line. A change that creates a business rule or an entity stops and asks for the feature lane.

## Blueprint lane

1. `/selo:blueprint {request}` → `.planning/blueprints/{date}-{name}.md` (a short grill, then one screen: the spec delta, decisions, stages, tests)
2. Read the delta and the stage subjects, say **yes**: one commit
3. `/selo:build {blueprint}`: every stage chained, one commit each (`Spec: pending (…)`), the review, the full suites, the browser test (demo, else the dev server), then the delta merged into `.planning/pages/` and `.planning/domain/` (`docs({name}): spec merged`). ` — stage N` runs one stage.
4. In a worktree (a branch other than the base branch): the build ends with the landing, one squashed commit on the base branch on your yes.

## Feature lane (1.0 layout)

1. `/selo:write-spec {request}` → `.planning/features/{slug}/00_spec.md` (a short grill, new FRs `(planned)`)
2. `/selo:write-plan {slug}` → `.planning/features/{slug}/dev-plans/{ts}-{type}-{plan}/plan.md`
3. Read the summary and the commit messages it proposes (the plan's and each stage's), say **yes** to commit it (silence is not approval)
4. Optional: `/selo:review plan {plan folder}`
5. New session per stage: `/selo:fastlane {plan folder} — stage {N} ({component})`, or all the remaining ones in one session: `/selo:fastlane {plan folder} — stages {N}-{M} ({components}), chained`
6. The last stage reviews the whole plan, runs the full suites and the demo browser test. Findings left open: `/selo:review {plan folder}` once they are fixed.

Each step ends with the next prompt ready to copy.

## Autopilot

```
/selo:autopilot Add a cutoff time on order publication
```

It reads the code first and picks the lane, then runs it, each step a fresh subagent, no question: every question takes its recommended answer, listed as Business decisions (at most five, first in the report) and Technical defaults. Needs the `auto` or `acceptEdits` permission mode with the components' commands allowed. Stops on a real blocker only; relaunch the same command to resume.

## Commits

```
git add {new files} && git commit --only -m "feat(orders): api — cutoff time" -m "Spec: orders +FR-12 ~FR-03" -- {files}
```

- Name the files: never `-a`, `git add -A`, `git add .` or `--amend` (other sessions share the checkout).
- A code commit carries `Spec: {slug} +FR-NN ~FR-NN -FR-NN`, or `Spec: none ({reason})`. The commit hook warns when it is missing.
- A file another session is editing: wait for its commit, or stop.

## Remember

- Agents **never push**. You push.
- Integration tests run only when you ask, by name.
- `✅ JOB DONE` footer = the job is done: its commits, on the branch named; a free request answered without a commit shows the recap alone.
- The session's model is yours to pick: the manifest's `models` says which one each role is meant for.
