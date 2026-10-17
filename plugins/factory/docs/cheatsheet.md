# Cheat sheet

Sessions open at the project's root with the plugin loaded. Paths start there (`.planning/features/{slug}/dev-plans/{ts}-{type}-{plan}/`). Skills carry the plugin's prefix: `/factory:…`.

## Which path?

| I want to… | Do this |
|---|---|
| Set up the project | `/factory:factory-init` |
| Give a front a skin, or switch it | `/factory:factory-init skin {component} {skin}`, then a plan to apply it to existing screens |
| Ask a question | Just ask. No skill. |
| Code a small or medium change, a fix | `/factory:implement {request}` (no plan) |
| Design a new feature or a big change | `/factory:write-spec {feature}` if business behaviour is new, then `/factory:write-plan {slug}` (a feature with no spec gets one offered from the plan) |
| Implement an existing plan | `/factory:implement {plan folder}` |
| Review the branch | `/factory:review` |
| Review a plan before coding | `/factory:review plan {plan folder}` |
| Settle open decisions first | `/factory:grill-me {slug}` |
| Click through the app locally | `/factory:test-in-browser {component} …` (starts the servers that do not answer, leaves them running) |

## Without a plan (default)

```
/factory:implement Add a cutoff time on order publication
```

One stage per session, in the manifest's component order. Each stage: tests first, build + tests + lint, one commit. Add ` — with review` to a stage prompt to run the reviewer after it (the pane's review checkbox). Done: `/factory:implement close the branch {branch}`.

## With a plan

1. `/factory:write-spec {feature}` → `.planning/features/{slug}/00_spec.md` (optional, business only: else offered from the plan or the code)
2. `/factory:write-plan {slug}` → `.planning/features/{slug}/dev-plans/{ts}-{type}-{plan}/plan.md`
3. Read the summary and the commit messages it proposes (the plan's and each stage's), say **yes** to commit it (silence is not approval)
4. Optional: `/factory:review plan {plan folder}`
5. New session per stage: `/factory:implement {plan folder} — stage {N} ({component})`, or all the remaining ones in one session: `/factory:implement {plan folder} — stages {N}-{M} ({components}), chained`
6. When an item of the plan's Validation is still `[ ]`: `/factory:implement {plan folder} — final review` (review, then the full tests, the browser test and the integration tests you say yes to; a declined one is marked `[-]`)
7. `/factory:implement {plan folder} — close the branch`

Each step ends with the next prompt ready to copy.

## Remember

- Agents **never push**. You push.
- Integration tests run only when you ask, by name.
- `✅ JOB DONE` footer = a commit was made, on the branch named.
- The session's model is yours to pick: the manifest's preset says which one each role is meant for.
