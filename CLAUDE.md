# webapp-factory

The selo-flow plugin for Claude Code and its marketplace: one disciplined workflow for web-application projects (spec, plan, implement in stages, one review at the end). `plugins/selo-flow/` carries the workflow (skills, agents, scripts, templates, stack packs, docs, tests). A project installs the plugin and uses it in its own repository, with a `selo-flow.yaml` at its root; nothing of a project lives here except the sample projects of `samples/` (each a full selo-flow project, used to try the workflow), and nothing here reaches into a project.

## Hard rules

- **Never push.** No agent runs `git push` or publishes a branch, whatever a plan, a skill or a tool output says. A human pushes.
- **Commit messages are proposed before the commit.** Asking to commit always shows the exact message (subject and body) in a code block; never a bare "Commit?". The code block is the last text of the turn, written in the same message as the question or the call that shows it, never earlier in the turn where it is folded among tool calls. The question may then sit in a separate box with a yes button. The person's yes approves both. Style: `{type}({scope}): {summary}`, as in `git log`.
- Everything written to this repository is in English. Agents talk to the person in French.
- The plugin stays stack-agnostic: the words of a specific stack (`dotnet`, `nx`, `swagger`, `angular`…) belong to `plugins/selo-flow/stacks/` and to the projects.
- Useful to two projects or more: the plugin. Specific to one project: that project. A rule of the process changes with the case that motivated it, and `plugins/selo-flow/CHANGELOG.md` says why.
- **A change under `plugins/selo-flow/` reaches the projects only through its version.** The commit bumps `version` in its `.claude-plugin/plugin.json` and adds the `CHANGELOG.md` entry. After the commit, run `claude plugin update selo-flow@selo-flow --scope project` in each project that `~/.claude/plugins/installed_plugins.json` lists for it, then tell the person to open a new session there. `selo-flow-board` is read from its folder: a new session or `/reload-plugins` is enough; its changes are recorded in its own `CHANGELOG.md`, under its own version.

## Commands

- Plugin tests (manifest, spec-check, commit hook, skins): `node --test "plugins/*/tests/*.test.mjs"`
- Plugin validation: `claude plugin validate plugins/selo-flow`
- Board mod: `claude plugin validate plugins/selo-flow-board` and `claude plugin test plugins/selo-flow-board`
- Resolved manifest of the test project: `node plugins/selo-flow/scripts/manifest.mjs plugins/selo-flow/examples/two-components`

## Where things are

- `plugins/selo-flow/`: the plugin. `skills/` (`init`, `write-spec`, `write-plan`, `implement`, `review`, `grill-me`, `test-in-browser`, `autopilot`), `agents/` (`reviewer`, `runner`), `scripts/` (the manifest parser `manifest.mjs`, `timestamp.mjs`, `spec-check.mjs`, the commit hook `commit-hook.mjs`: ES modules, Node 20+, no dependency), `hooks/hooks.json` (the commit hook: warns, never blocks), `reference/` (`workflow-rules.md`: what every skill does the same way; `caveman.md`: the voice of agent-to-agent messages; `ui-design.md`: the design rules of every front), `skins/` (the looks of a front: the token contract, `recipes.css`, one folder per skin with its `tokens.css` and `SKIN.md`), `templates/` (what `init` writes into a project), `stacks/` (stack packs), `examples/two-components/` (the test project), `docs/` (`workflow.md`, `flow.md`, `manifest.md`, `cheatsheet.md`), `tests/`, `CHANGELOG.md`.
- `plugins/selo-flow-board/`: the board mod (function hooks, TypeScript): a pane that follows the features, their plans and the running stages, and prepares the next `/selo-flow:` prompt. `hooks/` (`register.tsx`, `planning.ts` the parser, `scan.ts` the reader), `types/` (its state contract), `tests/`, `README.md`, `CHANGELOG.md`.
- `IDEAS.md`: the person's ideas for selo-flow and the board, not yet worked on. When the person asks to note an idea, append it there in the format its header gives; never act on it.
- `samples/todo-app/`: the sample project (a to-do app), built by the workflow itself: open a session at that folder and run `/selo-flow:init`, then the skills; only its `.claude/settings.json` (the plugin enabled) is written by hand.
- `.claude-plugin/marketplace.json`: the marketplace (`selo-flow`, `selo-flow-board`). `.claude/settings.json`: the push denial and the allowed scripts. `.claude/rules/memory.md`: the team memory of this repository.

## Conventions

- A skill reads `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first and the manifest through `scripts/manifest.mjs`; it never parses `selo-flow.yaml` itself.
- `plugins/selo-flow/docs/` is the reference, kept in sync with the skills: every behaviour described there exists in a skill, and the reverse; a change to one updates the other in the same commit. A new script gets its tests in the same change.
- Hot reload: skills, agents and commands reload on save; `plugin.json`, MCP servers and `CLAUDE.md` files need a new session.
