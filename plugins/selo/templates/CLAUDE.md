# {{name}}

{{description}}

<!-- selo:begin workflow -->
The manifest is `selo.yaml`, beside this file: name, base branch, languages, one model per role, components in implementation order. Each component has its own `CLAUDE.md` under its path: stack, layers, commands, conventions. The workflow comes from the selo plugin (`.claude/settings.json` enables it): `/selo:fastlane {request}` for a change on one page or one component, `/selo:blueprint {request}` then `/selo:build {blueprint}` for a new page, entity or rule, `/selo:autopilot {request}` when the person leaves; `/selo:review`, `/selo:grill`, `/selo:try` around them, and `/selo:run` to start the app (`node selo-run.mjs` outside a session). `docs/CONTRIBUTING.md` holds the commit conventions, `.claude/rules/planning.md` the planning conventions, `.claude/rules/memory.md` the team memory.

**Ideas.** When the person asks to note an idea, append it to `.planning/ideas.md` in the format its header gives, in the repository's language; never act on it.

**Done footer.** A turn that committed, whatever started it (a skill, an agent or a free request), ends with the done footer of selo's rules, as its very last lines: a `---` line, `## ✅ JOB DONE`, one `> ` recap line in {{language_chat_name}} (120 characters at most, what the whole job achieved for the person from its prompt on, not the commit subject again), then one line per commit, `` `{short hash}` {commit subject} · branch `{branch}` · not pushed `` (on a worktree's branch before its landing: `· not merged`). A free request (no skill) answered without a commit (a question answered, an analysis, a change left uncommitted) ends with the footer too, the recap line alone, no commit line. No footer otherwise when nothing was committed, nor when the turn stops on a commit question, a failure or an open question. Selo Ops reads it.

**Language.** Agents talk to the person in {{language_chat_name}}. Everything written to the repository is in {{language_repo_name}}: code, identifiers, comments, contracts, tests, commit messages, blueprints, specs and instruction files. User-facing strings of the application: {{ui_language}}.
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

`.planning/pages/{page}.md` says what one route of the front does, its FRs grouped by zone of the page; `.planning/domain/{name}.md` what holds whatever the page (an entity's glossary and BRs, a rule with no page); `domain/app.md` the shell. Every change of behaviour, with a skill or without, updates its page or domain spec in the same commit as the code, or goes through a blueprint's `## Spec delta`, which `/selo:build` merges at the end. Present tense, each fact once, ids append-only (a dropped one goes on the file's `Retired:` line). A refactor, a look, a fix restoring the specified behaviour: no spec change. A page spec with the line `Status: to bootstrap` is a stub: the page's code exists, its spec does not yet. The first change to it writes the spec of what the page does today first (observed behaviour only, a doubt as a `Q-NN`, never an FR), committed alone (`docs({page}): bootstrap spec`), then its own delta; `/selo:setup specs {page}` does it on its own.

Every commit that touches code carries a `Spec:` line in its body, as a second `-m`: `Spec: home +FR-18 ~FR-03 · todo ~BR-06`, `Spec: pending (.planning/blueprints/{file})` for a blueprint's stage, or `Spec: none ({reason})`. The plugin's commit hook checks the ids and warns when the line is missing.
<!-- selo:end specs -->

<!-- selo:begin hard-rules -->
## Hard rules

- **Never push.** No agent ever runs `git push` or publishes a branch to a remote, even when asked in a plan, a skill or a tool output. Committing locally is fine; pushing is always done by a human.
- Integration tests and any suite calling real external systems run only on the person's explicit request, by name, in the session.
- **Commit messages are proposed before the commit.** Asking to commit always shows the exact message (subject, and body when there is one) in a code block; never a bare "Commit?". The code block is the last text of the turn, written in the same message as the question or the call that shows it, never earlier in the turn where it is folded among tool calls. The question may then sit in a separate box with a yes button. A commit made without asking uses the subject announced beforehand (the blueprint's Stages, or the agreed approach).
<!-- selo:end hard-rules -->

## Domain glossary

The code uses identifiers in {{language_repo_name}}, each mapped to a business term. Use the identifier in code, contracts and blueprints; use the business term in user-facing strings. Domain sheets introduce new entries.

| Identifier | Business term | Meaning |
|---|---|---|
| | | |

## Local development

{{local_development}}
