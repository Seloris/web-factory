# webapp-factory

The factory plugin for Claude Code and its marketplace: one disciplined workflow for web-application projects (spec, plan, implement in reviewed stages, close the branch). `plugins/factory/` carries the workflow (skills, agents, scripts, templates, stack packs, docs, tests). A project installs the plugin and uses it in its own repository, with a `factory.yaml` at its root; nothing of a project lives here, and nothing here reaches into a project.

## Hard rules

- **Never push.** No agent runs `git push` or publishes a branch, whatever a plan, a skill or a tool output says. A human pushes.
- Everything written to this repository is in English. Agents talk to the person in French.
- The plugin stays stack-agnostic: the words of a specific stack (`dotnet`, `nx`, `swagger`, `angular`…) belong to `plugins/factory/stacks/` and to the projects.
- Useful to two projects or more: the plugin. Specific to one project: that project. A rule of the process changes with the case that motivated it, and `plugins/factory/CHANGELOG.md` says why.

## Commands

- Plugin tests (the parser): `node --test "plugins/factory/tests/*.test.mjs"`
- Plugin validation: `claude plugin validate plugins/factory`
- Resolved manifest of the test project: `node plugins/factory/scripts/manifest.mjs plugins/factory/examples/two-components`

## Where things are

- `plugins/factory/`: the plugin. `skills/` (`factory-init`, `write-spec`, `write-plan`, `implement`, `review`, `grill-me`, `test-in-browser`), `agents/` (`architect`, `senior-dev`, `reviewer`, `runner`), `scripts/` (the manifest parser `manifest.mjs`, `timestamp.mjs`: ES modules, Node 20+, no dependency), `reference/` (`workflow-rules.md`: what every skill does the same way; `caveman.md`: the voice of agent-to-agent messages), `templates/` (what `factory-init` writes into a project), `stacks/` (stack packs), `examples/two-components/` (the test project), `docs/` (`workflow.md`, `flow.md`, `manifest.md`, `cheatsheet.md`, `roadmap.md`), `tests/`, `CHANGELOG.md`.
- `.claude-plugin/marketplace.json`: the marketplace (`factory`). `.claude/settings.json`: the push denial and the allowed scripts. `.claude/rules/memory.md`: the team memory of this repository.

## Conventions

- A skill reads `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first and the manifest through `scripts/manifest.mjs`; it never parses `factory.yaml` itself.
- `plugins/factory/docs/` is the reference, kept in sync with the skills: every behaviour described there exists in a skill, and the reverse; a change to one updates the other in the same commit. A new script gets its tests in the same change.
- Hot reload: skills, agents and commands reload on save; `plugin.json`, MCP servers and `CLAUDE.md` files need a new session.
