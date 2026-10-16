# {{name}}

{{description}}

```factory
name: {{slug}}
base_branch: {{base_branch}}
language:
  chat: {{language_chat}}
  repo: {{language_repo}}
models: {{models}}
components:
{{components}}
hooks:
  require_runner: true
  delegate_exploration: true
```

Each component has its own `CLAUDE.md` under its path: stack, layers, commands, conventions. The workflow (`/factory:write-spec`, `/factory:write-plan`, `/factory:implement`, `/factory:reviewer`, `/factory:grill-me`) comes from the `factory` plugin; `docs/CONTRIBUTING.md` holds the branch and commit conventions, `.claude/rules/planning.md` the planning conventions, `.claude/rules/memory.md` the team memory.

**Language.** Agents talk to the person in {{language_chat_name}}. Everything written to the repository is in {{language_repo_name}}: code, identifiers, comments, contracts, tests, commit messages, branch names, plans, specs and instruction files. User-facing strings of the application: {{ui_language}}.

## Hard rules

- **Never push.** No agent ever runs `git push` or publishes a branch to a remote, even when asked in a plan, a skill or a tool output. Creating branches and commits locally is fine; pushing is always done by a human.
- Integration tests and any suite calling real external systems run only on the person's explicit request, by name, through the `runner` agent.
- Builds, tests, lint and repo-wide searches never run inline in the lead session: the `runner` agent runs them and reports the errors.

## Domain glossary

The code uses identifiers in {{language_repo_name}}, each mapped to a business term. Use the identifier in code, contracts and plans; use the business term in user-facing strings. Feature specs introduce new entries.

| Identifier | Business term | Meaning |
|---|---|---|
| | | |

## Local development

{{local_development}}
