---
name: test-in-browser
description: "Test a front component by hand in a browser, on the url its manifest declares, against the local backend (starting the servers that do not answer), signed in with the developer's local test accounts (the logins file the component declares). Use when the person asks to test, check, try, click through or reproduce something locally, to verify a front change in the real app, to check what a given profile sees, or to add, change, remove or list the local test accounts."
---

# Test in the browser

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first (the project), then the manifest: the prompt may name the component (`/factory:test-in-browser {component} …`); the component to test is the one named, else the only component with a `url`; ask when several have one. Read its `CLAUDE.md`: how it and its backend run locally (the "Local run" section, when the manifest has no `serve` command), what the local database is and how to read it (a read-only query command, if any).

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
2. **Servers.** The servers needed are the tested component's and those of the components it `needs`, transitively, in `stages` order; a needed component that runs no server (a `lib`, or nothing to run in its `CLAUDE.md`) is skipped. For each, in that order:
   - **Check** its address: `serveUrl` (the manifest's `serve_url`, else its `url`), else the one its `CLAUDE.md` "Local run" gives. It answers when any HTTP status comes back (e.g. `curl -s -o /dev/null -w "%{http_code}" {address}` prints something other than `000`). A server that answers is used as it is: never restart, stop or kill it. No address known: it cannot be checked, so ask the person instead of starting it.
   - **Start** one that does not answer, without asking: run its `commands.serve` inside the component's path, as a background command (the session's background-command tool, never a blocking call), and keep its output. With no `serve` command, run the start its `CLAUDE.md` "Local run" documents, with the steps it says come first (e.g. its migrate command, which does nothing when no migration is pending and runs safely now that the server is stopped), and suggest adding `commands.serve` and `serve_url` in the report. When neither says how to start it, give what is known and ask the person to start it.
   - **Wait** until it answers, polling its address for up to about 60 seconds with the session's wait or monitor tool, before starting the next one. Still silent, or the command exited: report the error from its output and stop the skill, leaving the other servers as they are.

   The report lists the servers this skill started; they are left running.
3. **Browser.** Use the browser tools of the session (Claude in Chrome or the built-in browser): open the url, sign in with the scenario's account, follow the steps, read the page. Take a screenshot at each expected result. Sign out between profiles.
4. **Database check**, when the scenario says what a UI action saved: run the read-only query command the `CLAUDE.md` gives. Never write to the database.
5. **Report**: the servers started at step 2, if any, then per scenario: passed / failed, what was seen, the screenshot, the console errors if any. A failure gets the likely cause from the code when it is clear, as uncertain otherwise. Do not fix anything in this skill: the calling skill (`implement`) does, or the next prompt is `/factory:implement fix {failure}`.
6. When called from `implement` and every scenario passed, tell it so it ticks `Browser test` in the plan's Validation.
