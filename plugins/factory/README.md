# factory

The workflow plugin: everything useful to two projects or more. Stack-agnostic: what differs per project comes from its `factory.yaml` manifest (see `docs/manifest.md`). What is specific to one project stays in that project (its `CLAUDE.md` files, its manifest, its own `.claude/skills/`).

```
.claude-plugin/plugin.json
skills/
  factory-init/         set up the project: interview + templates (factory.yaml, CLAUDE.md files, .planning/)
  write-spec/           the only writer of 00_spec.md
  write-plan/           plan.md, one section per component touched
  implement/            stages, verification, review, commit, final review, branch close
  grill-me/             the interview that settles decisions
  review/               runs the reviewer agent and relays its findings
  test-in-browser/      click through a front component locally
agents/
  architect.md          spec + plan (planner model)
  senior-dev.md         implementation (implementer model)
  reviewer.md           read-only review (reviewer model)
  runner.md             mechanical work: builds, tests, lint, searches (runner model)
scripts/
  manifest.mjs          the single manifest parser (library + CLI)
  timestamp.mjs         dev-plan folder timestamp
reference/              workflow-rules.md (read first by every skill), caveman.md (agent-to-agent voice)
templates/              what factory-init writes into a project
stacks/                 stack packs (component templates + skills), read in place
examples/two-components/   the test project the tests run against (echo commands)
docs/                   workflow.md, flow.md (diagram), manifest.md, cheatsheet.md
tests/                  node --test
CHANGELOG.md            why each rule of the process exists
```

Skills are invoked under the plugin's prefix (`/factory:implement …`). Agents carry no `model` in their frontmatter: the skill that spawns one passes the role's model from the manifest (`models.planner`, `implementer`, `reviewer`, `runner`, `explorer`).

## Install it in a project

```bash
/plugin marketplace add C:/WS/webapp-factory
```

```bash
/plugin install factory@webapp-factory
```

`factory-init` writes both into the project's `.claude/settings.json` (`extraKnownMarketplaces`, `enabledPlugins`), so a clone of the project needs no step.

## Check

From this repository's root:

```bash
node --test "plugins/factory/tests/*.test.mjs"
```

```bash
claude plugin validate plugins/factory
```

```bash
node plugins/factory/scripts/manifest.mjs plugins/factory/examples/two-components
```
