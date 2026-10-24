---
name: try
description: "Test a front component in a browser on this worktree's slot: the demo of the component and of those it needs started in the background through run.mjs (seeded data, the slot's demo held by one session at a time), stopped after the test; without a demo, their dev servers, started and stopped the same way; with a mockup (a blueprint's, or a fastlane's — mockup), a screenshot compared with it. Signed in with the developer's local test accounts (the logins file the component declares). Use when the person asks to test, check, try, click through or reproduce something locally, to verify a front change in the real app, to check what a given profile sees, or to add, change, remove or list the local test accounts."
---

# Test in the browser

Read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` first (the project), then the manifest: the prompt may name the component (`/selo:try {component} …`); the component to test is the one named, else the only component with a `url`; ask when several have one. Read its `CLAUDE.md`: how it and its backend run locally (the "Local run" section, when the manifest has no `demo` or `serve` command), what the local database is and how to read it (a read-only query command, if any).

## Accounts

The component's `logins` file (default `.claude/local/test-logins.md`, git-ignored: it holds local passwords) lists the local test accounts, one per profile:

```markdown
| Profile | Login | Password | Notes |
|---|---|---|---|
| admin | admin@local | … | sees everything |
| restricted | user@local | … | one scope only |
```

- No file: say so, propose to create it from the person's accounts, and write it as they give them. Never invent credentials, never put them in a commit.
- "Add / change / remove / list the test accounts": edit the file and stop.

## Procedure

1. **Scenarios.** From the request, the blueprint's `browser:` line or the spec ids given, list the scenarios to run (profile, steps, expected result), in `language.chat`, and run them without waiting unless the request is ambiguous.
2. **Start on the slot**, as the rules' **Running the app** say: from the root, `node ${CLAUDE_PLUGIN_ROOT}/scripts/run.mjs {component} --demo` as a background command (the session's background-command tool, never a blocking call), keeping its output. It starts the tested component and those it `needs`, in `stages` order, on this worktree's slot: their demo when every one of them has `commands.demo` (seeded data, its own ports), else their dev servers (`commands.serve`), which a `no demo for …` line says (suggest adding `commands.demo` in the report). Wait for its `SELO_RUN {json}` line, for up to about 2 minutes with the session's wait or monitor tool: the slot, the mode, each component's url and whether this call `started` it.
   - **Exit code 3**: the slot's demo serves another session. Start it again every 15 seconds for up to 10 minutes; still busy, stop the skill and say so.
   - **Another error** (a component that exits or stays silent, a taken port, a missing `port`): report its output and stop. A component with no `serve` or `demo` command is not started by the script: when the tested front has none, start it as its `CLAUDE.md` "Local run" says (with the steps it says come first), else give what is known and ask the person to start it.
   - On `baseBranch` the run serves the shared checkout: list the files other sessions left uncommitted (`git status`), the report names them.
3. **Browser.** Use the browser tools of the session (Claude in Chrome or the built-in browser): open the tested component's url from the `SELO_RUN` line, sign in with the scenario's account, follow the steps, read the page. Take a screenshot at each expected result. Sign out between profiles.
4. **Database check**, when the scenario says what a UI action saved and the component's `CLAUDE.md` gives a read-only query command for the database the run uses. Never write to the database.
5. **Stop** what this skill started, once the scenarios are done, pass or fail: `node ${CLAUDE_PLUGIN_ROOT}/scripts/run.mjs --stop {each component the SELO_RUN line marks started}`, with `--demo` when its mode is `demo`. A component found running (`started: false`) belongs to someone else: never stop it.
6. **Mockup.** When a mockup covers the tested page (a blueprint's `## Mockup`, from `build` or the blueprint named; a fastlane's ` — mockup {file}`): an HTML mockup is opened in the browser and each plate screenshotted at its width; take a screenshot of the page at the mockup's width and say how it differs from the mockup (layout, spacing, colours, missing or extra elements), in the report.
7. **Report**: the slot, demo or dev servers, those started and stopped, the foreign uncommitted files the run served, the mockup comparison, then per scenario: passed / failed, what was seen, the screenshot, the console errors if any. A failure gets the likely cause from the code when it is clear, as uncertain otherwise. Do not fix anything in this skill: the calling skill (`fastlane`) does, or the next prompt is `/selo:fastlane fix {failure}`.
8. When called from `build` or `fastlane` and every scenario passed, tell it so it ticks `Browser test` (the blueprint's Progress; the fastlane says it in its report).
