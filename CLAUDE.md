# webapp-factory

The selo plugin for Claude Code, its ops export plugin `selo-ops`, and their marketplace: one disciplined workflow for web-application projects (page specs, a one-screen blueprint, its stages built in one go, one review at the end). `plugins/selo/` carries the workflow (skills, agents, scripts, templates, stack packs, docs, tests). A project installs the plugin and uses it in its own repository, with a `selo.yaml` at its root; nothing of a project lives here except the sample projects of `samples/` (each a full selo project, used to try the workflow), and nothing here reaches into a project.

## Hard rules

- **Never push.** No agent runs `git push` or publishes a branch, whatever a plan, a skill or a tool output says. A human pushes.
- **Commit messages are proposed before the commit.** Asking to commit always shows the exact message (subject and body) in a code block; never a bare "Commit?". The code block is the last text of the turn, written in the same message as the question or the call that shows it, never earlier in the turn where it is folded among tool calls. The question may then sit in a separate box with a yes button. The person's yes approves both. Style: `{type}({scope}): {summary}`, as in `git log`.
- Everything written to this repository is in English. Agents talk to the person in French.
- The plugin stays stack-agnostic: the words of a specific stack (`dotnet`, `nx`, `swagger`, `angular`…) belong to `plugins/selo/stacks/` and to the projects.
- Useful to two projects or more: the plugin. Specific to one project: that project. A rule of the process changes with the case that motivated it, and `plugins/selo/CHANGELOG.md` says why.
- **A change under `plugins/selo/` reaches the projects only through its version.** The commit bumps `version` in its `.claude-plugin/plugin.json` and adds the `CHANGELOG.md` entry. After the commit, run `claude plugin update selo@selo --scope project` in each project that `~/.claude/plugins/installed_plugins.json` lists for it, then tell the person to open a new session there.
- **Same for `plugins/selo-ops/`**, installed at user scope: after the commit, `claude plugin update selo-ops@selo --scope user`, then a new session everywhere. Its `scripts/manifest.mjs`, `spec-check.mjs`, `commit-hook.mjs` and `slots.mjs` are byte-identical copies of selo's: a change to one of them in `selo` copies it over in the same commit and bumps both versions (`tests/shared.test.mjs` fails otherwise).

## Commands

- Plugin tests (manifest, spec-check, commit hook, skins, runs and launcher; ops export and shared copies in `selo-ops`): `node --test "plugins/*/tests/*.test.mjs"`
- Plugin validation: `claude plugin validate plugins/selo`, `claude plugin validate plugins/selo-ops`, `claude plugin validate .` (the marketplace)
- Resolved manifest of the test project: `node plugins/selo/scripts/manifest.mjs plugins/selo/examples/two-components`

## Where things are

- `plugins/selo/`: the plugin. `skills/` (`setup`, `mockup`, `blueprint`, `build`, `fastlane`, `review`, `grill`, `try`, `run`, `pilot`), `agents/` (`reviewer`, `runner`), `scripts/` (the manifest parser `manifest.mjs`, `timestamp.mjs`, `spec-check.mjs`, the commit hook `commit-hook.mjs`, the model hook `agent-model.mjs`: selo's subagents put on their role's model from `selo.yaml`, the lane hook `lane-hint.mjs`: a free request sent to `pilot` when the person's `SELO_ROUTING` is on, `settings.mjs`: the person's selo settings from the environment, `run.mjs` and `slots.mjs`: the app started on a slot per worktree, `ops.mjs`: the marks' stub; ES modules, Node 20+, no dependency), `hooks/hooks.json` (the commit hook: warns, never blocks; the model hook; the lane hook), `reference/` (`rules.md`: every shared rule, read first by every skill; `caveman.md`: the voice of agent-to-agent messages; `ui-design.md`: the design rules of every front), `skins/` (the looks of a front: the token contract, `recipes.css`, one folder per skin with its `tokens.css` and `SKIN.md`), `templates/` (what `setup` writes into a project; `planning/`: the page, domain and blueprint templates), `stacks/` (stack packs), `examples/two-components/` (the test project), `docs/` (`cheatsheet.md`: the commands and the flow; `manifest.md`: the manifest's format), `tests/`, `CHANGELOG.md`.
- `plugins/selo-ops/`: the ops export for Selo Ops (`docs/revamp-2.0.0/ops-export.md`, `ops-plugin.md`), hooks only, enabled at user scope: `hooks/hooks.json` (silent, write `~/.claude/selo/`), `scripts/ops.mjs` and the copies of selo's shared scripts, `tests/`, `CHANGELOG.md`.
- `IDEAS.md`: the person's ideas for selo, not yet worked on. When the person asks to note an idea, append it there in the format its header gives; never act on it.
- `samples/`: the sample projects, built by the workflow itself: open a session at a sample's folder and run `/selo:setup`, then the skills; only its `.claude/settings.json` (the plugin enabled) is written by hand. `todo-app/`: a to-do app (`react-express`). `roster-comp/`: RosterComp, to try `angular-dotnet`.
- `.claude-plugin/marketplace.json`: the marketplace (`selo`). `.claude/settings.json`: the push denial and the allowed scripts. `.claude/rules/memory.md`: the team memory of this repository.

## Conventions

- A skill reads `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` first and the manifest through `scripts/manifest.mjs`; it never parses `selo.yaml` itself.
- Each rule lives in one place: `plugins/selo/reference/rules.md` (the rules), `docs/cheatsheet.md` (the commands), `docs/manifest.md` (the manifest). They are the reference, kept in sync with the skills: every behaviour described there exists in a skill, and the reverse; a change to one updates the other in the same commit. A new script gets its tests in the same change.
- Hot reload: skills, agents and commands reload on save; `plugin.json`, MCP servers and `CLAUDE.md` files need a new session.
