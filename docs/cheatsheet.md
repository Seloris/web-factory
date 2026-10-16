# Cheat sheet

## Which path?

| I want to… | Do this |
|---|---|
| Start a project | `/factory:init` |
| Ask a question | Just ask. No skill. |
| Code a small or medium change, a fix | `/factory:implement {request}` (no plan) |
| Design a new feature or a big change | `/factory:write-spec {feature}` if business behaviour is new, then `/factory:write-plan {slug}` |
| Implement an existing plan | `/factory:implement {plan folder}` |
| Review a branch | `/factory:reviewer` |
| Review a plan before coding | `/factory:reviewer plan {plan folder}` |
| Settle open decisions first | `/factory:grill-me` |
| Click through the app locally | `/factory:test-in-browser {component} …` |

## Without a plan (default)

```
/factory:implement Add a cutoff time on order publication
```

One stage per session, in the manifest's component order. Each stage: tests first, build + tests + lint through `runner`, reviewer, one commit. Done: `/factory:implement close the branch {branch}`.

## With a plan

1. `/factory:write-spec {feature}` → `.planning/features/{slug}/00_spec.md` (optional, business only)
2. `/factory:write-plan {slug}` → `.planning/features/{slug}/dev-plans/{ts}-{type}-{name}/plan.md`
3. Read the summary, say **yes** to commit it (silence is not approval)
4. Optional: `/factory:reviewer plan {plan folder}`
5. New session per stage: `/factory:implement {plan folder}`
6. `/factory:implement {plan folder} — close the branch`

Each step ends with the next prompt ready to copy.

## Remember

- Agents **never push**. You push.
- Integration tests run only when you ask, by name.
- `✅ JOB DONE` footer = a commit was made.
- The session's model matters: the skill tells you when to switch (planner vs implementer, see the manifest's preset).
