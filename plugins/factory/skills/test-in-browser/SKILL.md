---
name: test-in-browser
description: "Test a front component by hand in a browser, on the url its manifest declares, against the locally running backend, signed in with the developer's local test accounts (the logins file the component declares). Use when the person asks to test, check, try, click through or reproduce something locally, to verify a front change in the real app, to check what a given profile sees, or to add, change, remove or list the local test accounts."
---

# Test in the browser

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first (the project), then the manifest: the prompt may name the component (`/factory:test-in-browser {component} …`); the component to test is the one named, else the only component with a `url`; ask when several have one. Read its `CLAUDE.md`: how to start it and its backend locally, what the local database is and how to read it (a read-only query command, if any).

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

1. **Scenarios.** From the request, the plan or the spec ids given, list the scenarios to run (profile, steps, expected result), in `language.chat`, and run them without waiting unless the request is ambiguous.
2. **Prerequisites.** Check that the backend and the front answer on their local urls (e.g. `curl -s -o /dev/null -w "%{http_code}" {url}`). If not, give the start commands from the component's `CLAUDE.md` and ask the person to start them: never start servers yourself unless the `CLAUDE.md` says the agent may.
3. **Browser.** Use the browser tools of the session (Claude in Chrome or the built-in browser): open the url, sign in with the scenario's account, follow the steps, read the page. Take a screenshot at each expected result. Sign out between profiles.
4. **Database check**, when the scenario says what a UI action saved: run the read-only query command the `CLAUDE.md` gives. Never write to the database.
5. **Report**, per scenario: passed / failed, what was seen, the screenshot, the console errors if any. A failure gets the likely cause from the code when it is clear, as uncertain otherwise. Do not fix anything in this skill: the calling skill (`implement`) does, or the next prompt is `/factory:implement fix {failure}`.
6. When called from `implement` and every scenario passed, tell it so it ticks `Browser test` in the plan's Validation.
