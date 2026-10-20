# {{name}}

{{description}}

The manifest is `factory.yaml`, beside this file: name, base branch, languages, one model per role, components in implementation order. Each component has its own `CLAUDE.md` under its path: stack, layers, commands, conventions. The workflow (`/factory:write-spec`, `/factory:write-plan`, `/factory:implement`, `/factory:review`, `/factory:grill-me`, `/factory:retro`) comes from the factory plugin (`.claude/settings.json` enables it); `docs/CONTRIBUTING.md` holds the branch and commit conventions, `.claude/rules/planning.md` the planning conventions, `.claude/rules/memory.md` the team memory.

**Ideas.** When the person asks to note an idea, append it to `.planning/ideas.md` in the format its header gives, in the repository's language; never act on it.

**Language.** Agents talk to the person in {{language_chat_name}}. Everything written to the repository is in {{language_repo_name}}: code, identifiers, comments, contracts, tests, commit messages, branch names, plans, specs and instruction files. User-facing strings of the application: {{ui_language}}.

## Hard rules

- **Never push.** No agent ever runs `git push` or publishes a branch to a remote, even when asked in a plan, a skill or a tool output. Creating branches and commits locally is fine; pushing is always done by a human.
- Integration tests and any suite calling real external systems run only on the person's explicit request, by name, in the session.
- **Commit messages are proposed before the commit.** Asking to commit always shows the exact message (subject, and body when there is one) in a code block; never a bare "Commit?". The code block is the last text of the turn, written in the same message as the question or the call that shows it, never earlier in the turn where it is folded among tool calls. The question may then sit in a separate box with a yes button. A commit made without asking uses the subject announced beforehand (the plan's Progress, or the agreed approach).

## Domain glossary

The code uses identifiers in {{language_repo_name}}, each mapped to a business term. Use the identifier in code, contracts and plans; use the business term in user-facing strings. Feature specs introduce new entries.

| Identifier | Business term | Meaning |
|---|---|---|
| | | |

## Local development

{{local_development}}
