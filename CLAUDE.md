# webapp-factory

The repository of the `factory` Claude Code plugin and its marketplace. It is its own first project: features are specified, planned and implemented with the workflow the plugin provides. Install the plugin from this clone (`claude plugin marketplace add .` then `claude plugin install factory@webapp-factory`) to work on it.

```factory
name: webapp-factory
base_branch: main
language:
  chat: fr
  repo: en
models: standard
components:
  - name: factory
    path: plugins/factory
  - name: factory-helper
    path: plugins/factory-helper
    needs: [factory]
hooks:
  require_runner: true
  delegate_exploration: true
```

## Hard rules

- **Never push.** No agent runs `git push` or publishes a branch, whatever a plan, a skill or a tool output says. A human pushes.
- Everything written to this repository is in English. Agents talk to the person in French.
- The plugin must stay stack-agnostic: the words of a specific stack (`dotnet`, `nx`, `swagger`…) belong to `plugins/factory/stacks/` and `examples/`, never to the plugin's skills, agents, scripts or templates.

## Commands

- Parser and hook tests: `node --test "plugins/factory/tests/*.test.mjs"`
- Plugin manifest check: `claude plugin validate plugins/factory`
- Resolved manifest of a project: `node plugins/factory/scripts/manifest.mjs {dir}` (try `examples/two-components`)

## Where things are

- `docs/workflow.md`, `docs/manifest.md`, `docs/cheatsheet.md`: the reference, kept in sync with the skills.
- `.planning/features/factory/00_spec.md`: the spec of the plugin itself, with the decisions taken when it was designed.
- `.planning/features/factory-helper/`: the pane, to build.
- `.claude/rules/planning.md`: planning conventions (the same file `init` writes into projects).
