# RosterComp

Raid roster builder for WoW Forever: player sheets with class and spec choices ranked S to C, and a generated raid roster balanced in tanks, heals and DPS.

<!-- selo:begin workflow -->
The manifest is `selo.yaml`, beside this file: name, base branch, languages, components in implementation order. Each component has its own `CLAUDE.md` under its path: stack, layers, commands, conventions. The workflow comes from the selo plugin (`.claude/settings.json` enables it): `/selo-flow:fastlane {request}` for a change on one page or one component, `/selo-flow:blueprint {request}` then `/selo-flow:build {blueprint}` for a new page, entity or rule, `/selo-flow:pilot {request}` to let selo pick the lane (with ` — autonomous`, from Selo Ops, when the person leaves); `/selo-flow:review`, `/selo-flow:grill`, `/selo-flow:try` around them, and `/selo-flow:run` to start the app (`node selo-run.mjs` outside a session). `docs/CONTRIBUTING.md` holds the commit conventions, `.claude/rules/planning.md` the planning conventions, `.claude/rules/memory.md` the team memory.

**Ideas.** When the person asks to note an idea, append it to `.planning/ideas.md` in the format its header gives, in the repository's language; never act on it.

**Done footer.** A turn that committed, whatever started it (a skill, an agent or a free request), ends with the done footer of selo's rules, as its very last lines: a `---` line, `## ✅ JOB DONE`, one `> ` recap line in French (120 characters at most, what the whole job achieved for the person from its prompt on, not the commit subject again), then one line per commit, `` `{short hash}` {commit subject} · branch `{branch}` · not pushed `` (on a worktree's branch before its landing: `· not merged`). A free request (no skill) answered without a commit (a question answered, an analysis, a change left uncommitted) ends with the footer too, the recap line alone, no commit line. No footer otherwise when nothing was committed, nor when the turn stops on a commit question, a failure or an open question. Selo Ops reads it.

**Language.** Agents talk to the person in French. Everything written to the repository is in English: code, identifiers, comments, contracts, tests, commit messages, blueprints, specs and instruction files. User-facing strings of the application: French.
<!-- selo:end workflow -->

<!-- selo:begin commits -->
## Commits

The current branch decides. On the base branch, several sessions share this checkout and commit on it, with a skill or without: no feature branch, no squash.

- Commit in one command, naming the files this work wrote: `git add {new files} && git commit --only -m "{subject}" -m "{body}" -- {files}`. `--only` leaves out what other sessions staged. Never `git commit -a`, `git add -A`, `git add .` or `--amend`.
- A file you must change that holds another session's uncommitted edits: do not write it. Wait up to five minutes for that session's commit, else stop and name the file.
- A dirty tree is not a blocker: other sessions' files stay out of your commit.
- A test suite that fails outside this work's files: list the files other sessions changed (`git status` minus this work's files), say `foreign uncommitted changes in {files}`, do not investigate, commit.

On another branch (a worktree), commits go on that branch without a question, files still named on `git add`, never `--amend`; the work lands on the base branch as one squashed commit, on the person's yes (selo's rules, "Where commits go").
<!-- selo:end commits -->

<!-- selo:begin specs -->
## Specs

`.planning/pages/{page}.md` says what one route of the front does, its FRs grouped by zone of the page; `.planning/domain/{name}.md` what holds whatever the page (an entity's glossary and BRs, a rule with no page); `domain/app.md` the shell. Every change of behaviour, with a skill or without, updates its page or domain spec in the same commit as the code, or goes through a blueprint's `## Spec delta`, which `/selo-flow:build` merges at the end. Present tense, each fact once, ids append-only (a dropped one goes on the file's `Retired:` line). A refactor, a look, a fix restoring the specified behaviour: no spec change. A page spec with the line `Status: to bootstrap` is a stub: the page's code exists, its spec does not yet. The first change to it writes the spec of what the page does today first (observed behaviour only, a doubt as a `Q-NN`, never an FR), committed alone (`docs({page}): bootstrap spec`), then its own delta; `/selo-flow:setup specs {page}` does it on its own.

Every commit that touches code carries a `Spec:` line in its body, as a second `-m`: `Spec: home +FR-18 ~FR-03 · todo ~BR-06`, `Spec: pending (.planning/blueprints/{file})` for a blueprint's stage, or `Spec: none ({reason})`. The plugin's commit hook checks the ids and warns when the line is missing.
<!-- selo:end specs -->

<!-- selo:begin hard-rules -->
## Hard rules

- **Never push.** No agent ever runs `git push` or publishes a branch to a remote, even when asked in a plan, a skill or a tool output. Committing locally is fine; pushing is always done by a human.
- Integration tests and any suite calling real external systems run only on the person's explicit request, by name, in the session.
- **Commit messages are proposed before the commit.** Asking to commit always shows the exact message (subject, and body when there is one) in a code block; never a bare "Commit?". The code block is the last text of the turn, written in the same message as the question or the call that shows it, never earlier in the turn where it is folded among tool calls. The question may then sit in a separate box with a yes button. A commit made without asking uses the subject announced beforehand (the blueprint's Stages, or the agreed approach).
<!-- selo:end hard-rules -->

## Domain glossary

The code uses identifiers in English, each mapped to a business term. Use the identifier in code, contracts and blueprints; use the business term in user-facing strings. An entity's terms live in its domain sheet's glossary, once; this table holds the terms no domain sheet holds.

| Identifier | Business term | Meaning |
|---|---|---|
| | | |

## Local development

Two components, started in this order: `api` (.NET 10, SQLite file created and migrated at start) on http://localhost:5480, then `web` (Angular) on http://localhost:4480, which proxies `/api` to the API. `/selo-flow:run` starts both on this worktree's slot (each port + 10 per slot); `npm run app` (or `node selo-run.mjs`) does the same outside a session, `npm run app:demo` starts the demos (seeded in-memory data) on 5580 and 4580. Prerequisites: the .NET SDK of `api/global.json`, Node 24 or later; `dotnet restore` and `dotnet tool restore` in `api/`, `npm ci` in `web/`. Details in each component's `CLAUDE.md`, section Local run.
