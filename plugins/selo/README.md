# selo

The workflow plugin for web applications. Stack-agnostic: a project describes itself in its `selo.yaml` manifest (`docs/manifest.md`). The commands and the flow: `docs/cheatsheet.md`. Every rule: `reference/rules.md`.

## Install it in a project

```bash
/plugin marketplace add C:/WS/webapp-factory
```

```bash
/plugin install selo@selo
```

Then `/selo:setup`. It writes both into the project's `.claude/settings.json` (`extraKnownMarketplaces`, `enabledPlugins`), so a clone of the project needs no step.

## Folder map

```
.claude-plugin/plugin.json
skills/
  setup/                set up the project, update / migrate it (setup update), specs of existing pages (setup specs)
  fastlane/             a request on one page or component: code, spec delta, review, commit(s); — iterate: a loop of changes, committed once
  mockup/               a static mockup on the front's skin, iterated and validated before any code
  blueprint/            one screen: spec delta, decisions, stages, tests; one yes, one commit
  build/                a blueprint's stages chained, review, browser test, delta merged (or the worktree's landing)
  autopilot/            no question: picks the fastlane or the blueprint lane, one fresh subagent per step
  grill/                the interview that settles decisions
  review/               the reviewer on recent work, a blueprint, or a page against its spec
  try/                  click through a front component locally, on this worktree's slot
  run/                  start the app on this worktree's slot, give its URLs, stop it
agents/                 reviewer.md (read-only review), runner.md (builds, tests, lint)
scripts/                manifest.mjs (the manifest parser), spec-check.mjs (spec ids, --merge), commit-hook.mjs, agent-model.mjs, timestamp.mjs,
                        run.mjs + slots.mjs (the app on a slot per worktree), ops.mjs (the marks' stub)
hooks/hooks.json        the commit hook (warns, never blocks), the model hook (selo's subagents on their role's model); the ops export is the selo-ops plugin's
reference/              rules.md (read first by every skill), caveman.md (agent-to-agent voice), ui-design.md
skins/                  the looks of a front: the token contract, recipes.css, one folder per skin
templates/              what setup writes into a project; planning/ holds the page, domain and blueprint templates
stacks/                 stack packs (component templates, skeleton, skills), read in place
examples/two-components/   the test project the tests run against (echo commands)
docs/                   cheatsheet.md, manifest.md
tests/                  node --test
CHANGELOG.md            why each rule of the process exists
```

Agents carry no `model` in their frontmatter: the skill that spawns one passes the role's model from the manifest, and the model hook (`scripts/agent-model.mjs`) puts the call on that model when it names another.
