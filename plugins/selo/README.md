# selo

The workflow plugin: everything useful to two projects or more. Stack-agnostic: what differs per project comes from its `selo.yaml` manifest (see `docs/manifest.md`). What is specific to one project stays in that project (its `CLAUDE.md` files, its manifest, its own `.claude/skills/`).

```
.claude-plugin/plugin.json
skills/
  setup/                set up the project: interview + templates (selo.yaml, CLAUDE.md files, .planning/)
  write-spec/           1.0 layout: the only writer of 00_spec.md
  write-plan/           1.0 layout: plan.md, one section per component touched
  blueprint/            one screen: the page and domain spec delta, decisions, stages, tests; one yes, one commit
  build/                a blueprint's stages chained, review, browser test, the delta merged (or the worktree's landing)
  fastlane/             the fastlane (and 1.0 plans): stages, verification, commit; the last stage reviews the whole work
  autopilot/            no question: reads the code, picks the fastlane or the feature lane (spec → plan → stages), one fresh subagent per step
  grill/                the interview that settles decisions
  review/               runs the reviewer agent and relays its findings; review {plan} records it
  try/                  click through a front component locally
agents/
  reviewer.md           read-only review (reviewer model)
  runner.md             mechanical work: builds, tests, lint, searches (runner model)
scripts/
  manifest.mjs          the single manifest parser (library + CLI)
  timestamp.mjs         dev-plan folder timestamp
  spec-check.mjs        a spec's ids checked, the next free ones; --merge reads a blueprint's delta against the specs
  commit-hook.mjs       the PreToolUse hook on git commit: warns, never blocks
hooks/hooks.json        the commit hook
reference/              rules.md (read first by every skill), caveman.md (agent-to-agent voice), ui-design.md (the design rules of every front)
skins/                  the looks of a front: the token contract, recipes.css, one folder per skin (tokens.css, SKIN.md)
templates/              what setup writes into a project; planning/ holds the page, domain and blueprint templates
stacks/                 stack packs (component templates + skills), read in place
examples/two-components/   the test project the tests run against (echo commands)
docs/                   workflow.md, flow.md (diagram), manifest.md, cheatsheet.md
tests/                  node --test
CHANGELOG.md            why each rule of the process exists
```

Skills are invoked under the plugin's prefix (`/selo:fastlane …`). Agents carry no `model` in their frontmatter: the skill that spawns one passes the role's model from the manifest (`models.planner`, `implementer`, `reviewer`, `runner`, `explorer`).

## Install it in a project

```bash
/plugin marketplace add C:/WS/webapp-factory
```

```bash
/plugin install selo@selo
```

`setup` writes both into the project's `.claude/settings.json` (`extraKnownMarketplaces`, `enabledPlugins`), so a clone of the project needs no step.

## Check

From this repository's root:

```bash
node --test "plugins/selo/tests/*.test.mjs"
```

```bash
claude plugin validate plugins/selo
```

```bash
node plugins/selo/scripts/manifest.mjs plugins/selo/examples/two-components
```
