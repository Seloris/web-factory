# selo-flow 1.0.0 — plan

The factory becomes **selo-flow 1.0.0**: the revamp of `proposal.md` (versions 0.9.0 to 0.11.0 of its §14, in one release) plus the rename. Work happens on the branch `revamp/selo-flow`, in the worktree `.claude/worktrees/selo-flow`; nothing reaches `develop` before the whole plan is done and reviewed. A human merges and pushes.

## Decisions

Taken by the person on 2026-10-21:

- The five recommendations of `proposal.md` §16 are accepted: no feature branches and no squash in projects (commits on the base branch with `git commit --only`); the area rule and the `Spec:` line; `retro` deleted; `autopilot` picks the lane; the worktree trial right after the living specs.
- The quick lane is named **fastlane** (option ` — fastlane`; ` — with plan` forces the feature lane).
- Everything is renamed `selo-flow`, the manifest included.
- Worktrees and `land` are not in 1.0.0: they come in 1.1.0, after the one-hour trial on a throwaway repository.
- The board's "Specs of the day" panel is not in 1.0.0: it is noted in `IDEAS.md`.

Taken for this plan (the person can revise them before stage 1):

| Question | Choice | Why |
|---|---|---|
| Names | marketplace `selo-flow`, plugins `selo-flow` and `selo-flow-board`, folders `plugins/selo-flow` and `plugins/selo-flow-board`, prompts `/selo-flow:{skill}` | One name everywhere |
| Manifest | `selo-flow.yaml` replaces `factory.yaml`; its version key is `selo-flow: 1.0.0` | The rename covers the manifest |
| `factory-init` | renamed `init` (`/selo-flow:init`, `/selo-flow:init update`) | `/selo-flow:factory-init` repeats the name |
| Paths written by the tools | `~/.claude/selo-flow-board/` (board export), `{git-common-dir}/selo-flow/` (locks) | Same name as the plugin |
| Versions | both plugins go to `1.0.0` in the last stage, with one `CHANGELOG.md` entry each; the commits before it keep `0.8.0` / `0.12.0` | Nothing reaches a project before the merge, so the repository's rule (the version carries a change to the projects) holds at the merge |
| Board CHANGELOG | the board gets its own `CHANGELOG.md`; its two entries in the factory's CHANGELOG move there | Their numbers collided with the factory's |
| Old name in history | `CHANGELOG.md` entries before 1.0.0 keep the word "factory" | They describe what was true then |
| Repository folder and GitHub repository | stay `webapp-factory` until the person renames them | A human action, outside an agent's reach |

## Stages

Each stage is one commit on `revamp/selo-flow`, its message shown to the person before it is made. After each stage: `node --test "plugins/*/tests/*.test.mjs"`, `claude plugin validate` on both plugins, `claude plugin test` on the board.

### Stage 0 — docs
Commit: `docs(repo): selo-flow 1.0.0 proposal, drafts and plan`
- [x] `docs/revamp-1.0.0/`: `proposal.md`, `mockups.html`, `drafts/`, `proto/`, this plan
- [x] `IDEAS.md`: the "Specs of the day" panel under `## board`

### Stage 1 — rename
Commit: `refactor(repo): rename the factory to selo-flow`
- [x] `git mv plugins/factory plugins/selo-flow`, `git mv plugins/factory-board plugins/selo-flow-board`
- [x] `.claude-plugin/marketplace.json`, both `plugin.json` (names, descriptions, keywords)
- [x] `/factory:` → `/selo-flow:` in skills, agents, rules, templates, docs, the board's prompt builders and parsers, the board's `RUN_SKILLS` and `SKILL_LABEL`
- [x] `factory.yaml` → `selo-flow.yaml`: `MANIFEST_FILE` in `scripts/manifest.mjs`, its tests, `examples/two-components/`, `samples/todo-app/`, `templates/`, the board's `scan.ts` and `planning.ts` (the `models:` writer)
- [x] `skills/factory-init` → `skills/init`; every mention
- [x] the board export folder and its README; `samples/todo-app/.claude/settings.json` (marketplace and plugin ids)
- [x] the root `CLAUDE.md` of this repository (names, paths, commands; the stale `architect` / `senior-dev` line removed), `.claude/settings.json`, `.claude/rules/memory.md` if it names the plugin
- [x] tests and validation green

### Stage 2 — cleanup and shared develop (ex-0.9.0)
Commit: `refactor(selo-flow): one review, no branches, no squash, no retro`
- [x] Delete `skills/retro`, `.planning/retros/` from `planning.md`, the retro next prompt
- [x] Delete ` — with review`, ` — final review` (→ `/selo-flow:review {plan}`), ` — close the branch`, **Plan finalized** (the squash), feature-branch creation and its questions
- [x] Delete the `advisor` role (`manifest.mjs` preset, `docs/manifest.md`, the board's preset copy)
- [x] Delete `wt.exe` and "never restart a server"; `test-in-browser` starts servers in the background and stops them after the test (opt-in until stage 5)
- [x] `reference/workflow-rules.md` from `drafts/workflow-rules-v2.md`, without what later stages add (lanes, `Spec:` line, demo)
- [x] `skills/implement/SKILL.md` from `drafts/implement-v2.md`, same limits; one review, on the last stage
- [x] Commit rules of step A (`git commit --only`, wait or stop on a file another session changed, foreign test failures marked `[-]`) in the project template `CLAUDE.md`, in a tagged block
- [x] `templates/rules/planning.md` trimmed (no retros, squash, branch rules)
- [x] Board: review checkbox and `REVIEW_MARKER` removed; "Final review" button → `/selo-flow:review {plan}`; "Squash" button, ` — close the branch` prompts, `branchFeature` and `aheadCount` removed; `shaBySubject` reads more than 200 commits; export `schemaVersion: 3`
- [x] `reviewer.md` and `runner.md` without the rules copied from `workflow-rules.md`

### Stage 3 — `init update`
Commit: `feat(selo-flow): init update brings a project up to date`
- [x] `init` writes the plugin-owned parts of mixed files between `<!-- selo-flow:begin {id} -->` and `<!-- selo-flow:end {id} -->`
- [x] `init update`: rewrites tagged blocks, overwrites plugin-owned files, adds missing keys (manifest, component blocks, `.claude/settings.json`, `.gitignore`), never touches project content; first pass on an untagged project rewrites from the template and lets the person read the `git diff`
- [x] `init update` renames `factory.yaml` to `selo-flow.yaml` and writes `selo-flow: {version}`
- [x] The "skill to update an existing project" idea leaves `IDEAS.md`

### Stage 4 — living specs and fastlane (ex-0.10.0)
Commit: `feat(selo-flow): areas, Spec lines and the fastlane`
- [x] `scripts/spec-check.mjs` from `proto/` with its tests in `tests/`; also flags FRs still `(planned)` at the end of a plan
- [x] The area rule, the `Spec:` line, `(planned)`, `Retired:` in `workflow-rules.md` and in a tagged block of the template `CLAUDE.md`
- [x] `hooks/hooks.json`: a `PreToolUse` hook on `git commit` that runs `spec-check` and warns (never denies) on a code commit without `Spec:`, or on `-a`, `add -A`, `--amend`
- [x] `skills/write-spec/SKILL.md` from `drafts/write-spec-v2.md`: no `Status`, no `Updated`, no decisions section, stubs, `— rewrite`
- [x] `skills/autopilot/SKILL.md` from `drafts/autopilot-v2.md`: read-only exploration, then fastlane or feature lane; ` — fastlane`, ` — with plan`
- [x] `write-plan`: *Business decisions* and *Technical defaults* replace *Decisions* and *Decisions taken autonomously*; `Integration tests` only on request
- [x] `grill-me`: the session's question tool (1 to 4 questions per call, recommended answer first), 2 rounds, the rest as `Q-NN`
- [x] `review {slug}`: a whole area's spec against the code
- [x] Board: an area with a spec and no plan has no next action; the `Status` label goes

### Stage 5 — demo (ex-0.11.0)
Commit: `feat(selo-flow): browser tests run on the demo`
- [x] `commands.demo` and `demo_url` in `manifest.mjs`, with tests; a warning on an unknown key
- [x] `test-in-browser`: `{git-common-dir}/selo-flow/demo.lock`, demo in the background, stopped after; on by default when a touched component has `url` and `demo`; ` — without browser test`
- [x] Board: `BROWSER_MARKER` becomes ` — without browser test`
- [x] Pack `react-express`: `npm run demo` (api on in-memory PGlite with `seed/demo.ts`, web on the demo port with `--force`), vitest allowed on pure `.ts` modules of the front; its README's broken placeholder row fixed

### Stage 6 — docs, sample, release
Commit: `feat(selo-flow): release 1.0.0`
- [ ] `docs/workflow.md`, `flow.md`, `manifest.md`, `cheatsheet.md`, both READMEs in sync with the skills
- [ ] `samples/todo-app`: `/selo-flow:init update`, then one fastlane request and one feature-lane request run through the workflow
- [ ] Both `plugin.json` at `1.0.0`; `CHANGELOG.md` entries (the factory's and the board's own)

### Stage 7 — review
Commit: `fix(selo-flow): review — {summary}` (only when the review leads to fixes)
- [ ] The `reviewer` agent on the whole branch (`git log develop..revamp/selo-flow`), findings settled with the person
- [ ] Compact the branch when it needs it (the person's request, 2026-10-21): fix-up and review commits are folded into the stage they fix, or the whole branch into one `feat(selo-flow): release 1.0.0` commit; the message is shown first, and the old `HEAD` hash is given to get the branch back
- [ ] The person merges into `develop` and pushes

## After the merge (the person)

- Rename the repository folder and the GitHub repository if wanted.
- In each project (`samples/todo-app`, the companion renamed SelOps): remove `factory@webapp-factory` and `factory-board@webapp-factory`, add the `selo-flow` marketplace, install `selo-flow@selo-flow` and `selo-flow-board@selo-flow`, run `/selo-flow:init update`, open a new session.
- Run the worktree trial (`proposal.md` §15) on a throwaway repository, never on a real project: `git worktree remove --force` empties a `node_modules` junction's target.

## Progress

- [x] Stage 0 — docs
- [x] Stage 1 — rename
- [x] Stage 2 — cleanup and shared develop
- [x] Stage 3 — `init update`
- [x] Stage 4 — living specs and fastlane
- [x] Stage 5 — demo
- [ ] Stage 6 — docs, sample, release
- [ ] Stage 7 — review
