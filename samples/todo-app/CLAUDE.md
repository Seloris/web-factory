# todo-app

A task management application: create, list, complete, pin, filter and delete todos from the home page.

The manifest is `selo-flow.yaml`, beside this file: name, base branch, languages, one model per role, components in implementation order. Each component has its own `CLAUDE.md` under its path: stack, layers, commands, conventions. The workflow (`/selo-flow:write-spec`, `/selo-flow:write-plan`, `/selo-flow:implement`, `/selo-flow:review`, `/selo-flow:grill-me`) comes from the selo-flow plugin (`.claude/settings.json` enables it); `docs/CONTRIBUTING.md` holds the branch and commit conventions, `.claude/rules/planning.md` the planning conventions, `.claude/rules/memory.md` the team memory.

**Ideas.** When the person asks to note an idea, append it to `.planning/ideas.md` in the format its header gives, in the repository's language; never act on it.

**Servers.** Start a component's server (an API, a front) as selo-flow's workflow rules say under "Starting a server": with Windows Terminal, in a tab of the `selo-flow` window titled after the component (`wt -w selo-flow nt --title {component} -d {absolute component path} cmd /k "{serve}"`), so the person sees every server open; otherwise as a background command. Never restart a server that already answers.

**Done footer.** A turn that committed, whatever started it (a skill, an agent or a free request), ends with the done footer of selo-flow's workflow rules, as its very last lines: a `---` line, `## ✅ JOB DONE`, one `> ` recap line in French (120 characters at most, what the turn achieved for the person, not the commit subject again), then one line per commit, `` `{short hash}` {commit subject} · branch `{branch}` · not pushed ``. A free request (no skill) answered without a commit (a question answered, an analysis, a change left uncommitted) ends with the footer too, the recap line alone, no commit line. No footer otherwise when nothing was committed, nor when the turn stops on a commit question, a failure or an open question. The board and its companion apps read it: keep its shape.

**Language.** Agents talk to the person in French. Everything written to the repository is in English: code, identifiers, comments, contracts, tests, commit messages, branch names, plans, specs and instruction files. User-facing strings of the application: French.

## Hard rules

- **Never push.** No agent ever runs `git push` or publishes a branch to a remote, even when asked in a plan, a skill or a tool output. Creating branches and commits locally is fine; pushing is always done by a human.
- Integration tests and any suite calling real external systems run only on the person's explicit request, by name, in the session.
- **Commit messages are proposed before the commit.** Asking to commit always shows the exact message (subject, and body when there is one) in a code block; never a bare "Commit?". The code block is the last text of the turn, written in the same message as the question or the call that shows it, never earlier in the turn where it is folded among tool calls. The question may then sit in a separate box with a yes button. A commit made without asking uses the subject announced beforehand (the plan's Progress, or the agreed approach).

## Domain glossary

The code uses identifiers in English, each mapped to a business term. Use the identifier in code, contracts and plans; use the business term in user-facing strings. Feature specs introduce new entries.

| Identifier | Business term | Meaning |
|---|---|---|
| `Todo` | `Todo` | A task the person wants to remember, completed or not |
| `Tag` | `Tag` | A free label put on a todo to group it with others on the same subject |

## Local development

Two components, started in this order (Node 22, no database server: the API runs PGlite in-process).

1. `api`: `cd api && npm ci && npm run db:migrate && npm run dev` → http://localhost:3000. Re-run `npm run db:migrate` after every new migration, with the API stopped.
2. `web`: `cd web && npm ci && npx openapi-typescript ../api/openapi.json --output src/api/schema.d.ts && npm run dev` → http://localhost:5173. The dev server proxies `/api` to the API.

No accounts, no sign-in: every route is public and the front has no login.
