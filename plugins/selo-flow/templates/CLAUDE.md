# {{name}}

{{description}}

<!-- selo-flow:begin workflow -->
The manifest is `selo-flow.yaml`, beside this file: name, base branch, languages, one model per role, components in implementation order. Each component has its own `CLAUDE.md` under its path: stack, layers, commands, conventions. The workflow (`/selo-flow:write-spec`, `/selo-flow:write-plan`, `/selo-flow:implement`, `/selo-flow:review`, `/selo-flow:grill-me`, `/selo-flow:autopilot`) comes from the selo-flow plugin (`.claude/settings.json` enables it); `docs/CONTRIBUTING.md` holds the commit conventions, `.claude/rules/planning.md` the planning conventions, `.claude/rules/memory.md` the team memory.

**Ideas.** When the person asks to note an idea, append it to `.planning/ideas.md` in the format its header gives, in the repository's language; never act on it.

**Done footer.** A turn that committed, whatever started it (a skill, an agent or a free request), ends with the done footer of selo-flow's workflow rules, as its very last lines: a `---` line, `## ✅ JOB DONE`, one `> ` recap line in {{language_chat_name}} (120 characters at most, what the turn achieved for the person, not the commit subject again), then one line per commit, `` `{short hash}` {commit subject} · branch `{branch}` · not pushed ``. A free request (no skill) answered without a commit (a question answered, an analysis, a change left uncommitted) ends with the footer too, the recap line alone, no commit line. No footer otherwise when nothing was committed, nor when the turn stops on a commit question, a failure or an open question. Selo Ops reads it.

**Language.** Agents talk to the person in {{language_chat_name}}. Everything written to the repository is in {{language_repo_name}}: code, identifiers, comments, contracts, tests, commit messages, plans, specs and instruction files. User-facing strings of the application: {{ui_language}}.
<!-- selo-flow:end workflow -->

<!-- selo-flow:begin commits -->
## Commits

Every session commits on the base branch, with a skill or without: no feature branch, no squash. Several sessions share this checkout:

- Commit in one command, naming the files this work wrote: `git add {new files} && git commit --only -m "{subject}" -m "{body}" -- {files}`. `--only` leaves out what other sessions staged. Never `git commit -a`, `git add -A`, `git add .` or `--amend`.
- A file you must change that holds another session's uncommitted edits: do not write it. Wait up to five minutes for that session's commit, else stop and name the file.
- A dirty tree is not a blocker: other sessions' files stay out of your commit.
- A test suite that fails outside this work's files: list the files other sessions changed (`git status` minus this work's files), mark `- [-] Tests: foreign uncommitted changes in {files}`, do not investigate, commit.
<!-- selo-flow:end commits -->

<!-- selo-flow:begin specs -->
## Specs

`.planning/features/{slug}/00_spec.md` says how one area of the application (a screen, a route, a domain) behaves today. Every change of behaviour, with a skill or without, names its area and updates that spec in the same commit as the code, through the `write-spec` skill in called mode (a free session runs it too): never a hand edit. A refactor, a look, a fix restoring the specified behaviour: no spec change.

Every commit that touches code carries a `Spec:` line in its body, as a second `-m`: `Spec: {slug} +FR-48 ~FR-13 -FR-07`, or `Spec: none ({reason})`. The plugin's commit hook checks the ids and warns when the line is missing.
<!-- selo-flow:end specs -->

<!-- selo-flow:begin hard-rules -->
## Hard rules

- **Never push.** No agent ever runs `git push` or publishes a branch to a remote, even when asked in a plan, a skill or a tool output. Committing locally is fine; pushing is always done by a human.
- Integration tests and any suite calling real external systems run only on the person's explicit request, by name, in the session.
- **Commit messages are proposed before the commit.** Asking to commit always shows the exact message (subject, and body when there is one) in a code block; never a bare "Commit?". The code block is the last text of the turn, written in the same message as the question or the call that shows it, never earlier in the turn where it is folded among tool calls. The question may then sit in a separate box with a yes button. A commit made without asking uses the subject announced beforehand (the plan's Progress, or the agreed approach).
<!-- selo-flow:end hard-rules -->

## Domain glossary

The code uses identifiers in {{language_repo_name}}, each mapped to a business term. Use the identifier in code, contracts and plans; use the business term in user-facing strings. Feature specs introduce new entries.

| Identifier | Business term | Meaning |
|---|---|---|
| | | |

## Local development

{{local_development}}
