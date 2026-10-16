# factory

The workflow plugin. Everything here is stack-agnostic: what differs per project comes from the project's manifest (see `../../docs/manifest.md`).

```
.claude-plugin/plugin.json
skills/
  init/                 turn a repository into a factory project (interview + templates)
  write-spec/           the only writer of 00_spec.md
  write-plan/           plan.md, one section per component touched
  implement/            stages, verification, review, commit, final review, branch close
  grill-me/             the interview that settles decisions
  reviewer/             runs the reviewer agent and relays its findings
  test-in-browser/      click through a front component locally
  caveman/              terse voice; its rules govern agent-to-agent messages
agents/
  architect.md          spec + plan (planner model)
  senior-dev.md         implementation (implementer model)
  reviewer.md           read-only review (reviewer model)
  runner.md             mechanical work: builds, tests, lint, searches (runner model)
hooks/hooks.json        PreToolUse: require-runner, delegate-exploration; UserPromptSubmit: reset
scripts/
  manifest.mjs          the single manifest parser (library + CLI)
  timestamp.mjs         dev-plan folder timestamp
  require-runner.mjs    denies declared commands, restores and repo-wide searches in the lead session
  delegate-exploration.mjs / reset-exploration.mjs   exploration burst guard
  hook-io.mjs           shared hook plumbing
reference/workflow-rules.md   rules every skill reads first (model guard, language, commits, footer…)
templates/              what init writes into a project
stacks/                 stack packs (component templates + skills) init copies when a stack matches
tests/                  node --test
```

`CLAUDE.md` in this folder is not part of the plugin: it is this repository's own component file (the factory develops itself with its workflow), loaded only when working in this repository.

Agents carry no `model` in their frontmatter: the skill that spawns one passes the role's model from the manifest (`models.planner`, `implementer`, `reviewer`, `runner`, `explorer`).

## Check

From the repository root: `node --test "plugins/factory/tests/*.test.mjs"` and `claude plugin validate plugins/factory`.

## Install from a clone

```bash
claude plugin marketplace add ./path/to/webapp-factory
claude plugin install factory@webapp-factory
```

An edit to a plugin installed from a local marketplace takes effect in the next session, or after `/reload-plugins`. Bump `version` in `.claude-plugin/plugin.json` for the record.
