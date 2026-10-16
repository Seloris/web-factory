# todo-app

A sample project of the factory plugin: a to-do application (create, list and delete to-dos from the home page), made of an Express API and a React front from the `react-express` stack pack. It lives in `samples/todo-app` of the plugin's repository, tracked with it: sessions open at this folder, and the workflow's branches are branches of that repository.

The manifest is `factory.yaml`, beside this file: name, base branch, languages, model preset, components in implementation order. Each component has its own `CLAUDE.md` under its path: stack, layers, commands, conventions. The workflow (`/factory:write-spec`, `/factory:write-plan`, `/factory:implement`, `/factory:review`, `/factory:grill-me`) comes from the factory plugin (`.claude/settings.json` enables it); `docs/CONTRIBUTING.md` holds the branch and commit conventions, `.claude/rules/planning.md` the planning conventions, `.claude/rules/memory.md` the team memory.

**Language.** Agents talk to the person in French. Everything written to the repository is in English: code, identifiers, comments, contracts, tests, commit messages, branch names, plans, specs and instruction files. User-facing strings of the application: French.

## Hard rules

- **Never push.** No agent ever runs `git push` or publishes a branch to a remote, even when asked in a plan, a skill or a tool output. Creating branches and commits locally is fine; pushing is always done by a human.
- Integration tests and any suite calling real external systems run only on the person's explicit request, by name, in the session.
- **Commit messages are proposed before the commit.** Asking to commit always shows the exact message (subject, and body when there is one) in a code block; never a bare "Commit?". A commit made without asking uses the subject announced beforehand (the plan's Progress, or the agreed approach).

## Domain glossary

The code uses identifiers in English, each mapped to a business term. Use the identifier in code, contracts and plans; use the business term in user-facing strings. Feature specs introduce new entries.

| Identifier | Business term | Meaning |
|---|---|---|
| `Todo` | `Tâche` | One thing the person wants to do, with a title |

## Local development

No application code yet: the first plan of the `home` feature (type `init`) scaffolds both components following their `CLAUDE.md`. Once it lands: `cd api && npm ci && npm run db:migrate && npm run dev` (http://localhost:3000), then `cd web && npm ci && npm run dev` (http://localhost:5173).
