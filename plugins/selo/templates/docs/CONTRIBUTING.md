<!-- selo:begin contributing -->
# Development process

1. Work on `{{base_branch}}`, or in a worktree whose branch lands on it as one squashed commit on the person's yes. On `{{base_branch}}`, each commit names its files (`git commit --only -- {files}`), never `-a`, `git add -A`, `git add .` or `--amend`.
2. A fastlane or a blueprint's build ends with one review of the whole work by the `reviewer` agent; `/selo:review` when it left findings open.
3. Push (a human, never an agent).
<!-- selo:end contributing -->

# Commit conventions

A simplified Conventional Commits.

## Types

- `feat` – a feature
- `fix` – a bug fix
- `refactor` – restructuring with no functional change
- `perf` – performance
- `style` – formatting, whitespace
- `test` – tests only
- `docs` – documentation (README, `docs/`, `.planning/`: specs, blueprints)
- `tools` – tooling around the project (`.claude/`, the selo plugin, scripts)
- `ops` – CI/CD, infrastructure
- `chore` – anything else (`.gitignore`…)

## Format

```
<type>(<scope>): <short description>

<long description, optional>
```

- `<scope>`: a blueprint's name for its commits; for a fastlane, the page it touches (`.planning/pages/`), else the domain sheet (`.planning/domain/`), `app` for the shell; `tooling` for the tooling (optional for `chore`, `ops`, `style`).
- A stage commit names its stage before the description: `feat(cutoff-time): api — cutoff time per site`.
- A commit that touches code carries a `Spec:` line in its body: `Spec: orders +FR-14 ~FR-03 · order ~BR-02`, `Spec: pending (.planning/blueprints/{file})` for a blueprint's stage, or `Spec: none (refactor)`.

## Examples

```
feat(cutoff-time): api — list endpoint with cutoff filter
feat(cutoff-time): web — orders page
docs(cutoff-time): spec merged
fix(auth): token refresh on 401
docs(cutoff-time): blueprint — cutoff time per site
tools(tooling): selo setup
```
