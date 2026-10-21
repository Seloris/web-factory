<!-- selo-flow:begin contributing -->
# Development process

1. Work on `{{base_branch}}`: no feature branch. Spec, plan, stages and fixes are each one commit, naming its files (`git commit --only -- {files}`), never `-a`, `git add -A`, `git add .` or `--amend`.
2. A plan's last stage is reviewed by the `reviewer` agent on the whole plan; `/selo-flow:review {plan folder}` when it left the review open.
3. Push (a human, never an agent).
<!-- selo-flow:end contributing -->

# Commit conventions

A simplified Conventional Commits.

## Types

- `feat` – a feature
- `fix` – a bug fix
- `refactor` – restructuring with no functional change
- `perf` – performance
- `style` – formatting, whitespace
- `test` – tests only
- `docs` – documentation (README, `docs/`, `.planning/`)
- `tools` – tooling around the project (`.claude/`, the selo-flow plugin, scripts)
- `ops` – CI/CD, infrastructure
- `chore` – anything else (`.gitignore`…)

## Format

```
<type>(<slug>): <short description>

<long description, optional>
```

- `<slug>`: the feature slug from `.planning/features/`, or `tooling` / `shared` (optional for `chore`, `ops`, `style`).
- A stage commit names its stage before the description: `feat(orders): api — cutoff time per site`.
- A commit that touches code carries a `Spec:` line in its body: `Spec: orders +FR-14 ~FR-03 -FR-07`, or `Spec: none (refactor)`.

## Examples

```
feat(orders): api — list endpoint with cutoff filter
feat(orders): web — orders page
fix(orders): review — cutoff filter on empty list
fix(auth): token refresh on 401
docs(orders): plan add-cutoff-time
tools(tooling): selo-flow init
```
