---
name: test-in-browser
description: "Test a front component in a browser on its demo: the demo of the component and of those it needs started in the background under a lock, seeded data on separate ports, stopped after the test; without a demo, the dev servers that do not answer, started and stopped the same way. Signed in with the developer's local test accounts (the logins file the component declares). Use when the person asks to test, check, try, click through or reproduce something locally, to verify a front change in the real app, to check what a given profile sees, or to add, change, remove or list the local test accounts."
---

# Test in the browser

Read `${CLAUDE_PLUGIN_ROOT}/reference/workflow-rules.md` first (the project), then the manifest: the prompt may name the component (`/selo-flow:test-in-browser {component} …`); the component to test is the one named, else the only component with a `url`; ask when several have one. Read its `CLAUDE.md`: how it and its backend run locally (the "Local run" section, when the manifest has no `demo` or `serve` command), what the local database is and how to read it (a read-only query command, if any).

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
2. **Demo or dev servers.** The servers needed are the tested component's and those of the components it `needs`, transitively, in `stages` order; a needed component that runs no server (a `lib`, or nothing to run in its `CLAUDE.md`) is skipped.
   - **The demo**, when the tested component has `commands.demo` and `demoUrl`: every needed component runs its `demo` (seeded data, its own ports), never its dev server. The person's dev servers are never touched.
   - **Else the dev servers**: a needed component's `serveUrl` that already answers is used as it is and never stopped; one that does not answer is started from its `commands.serve`, else the start its `CLAUDE.md` "Local run" documents (with the steps it says come first, e.g. its migrate command; suggest adding `commands.demo` in the report). When neither says how, give what is known and ask the person to start it.
3. **Lock.** Before starting a demo, take the lock `{git-common-dir}/selo-flow/demo.lock` (`git rev-parse --git-common-dir`): create the folder, then the file holding this session's id and the time, only when it does not exist. Held by another session: wait for its release, checking every 15 seconds for up to 10 minutes; a lock older than 30 minutes is stale, taken over and said so in the report. Still held: stop the skill and say which session holds it. The lock is released at step 7, whatever the outcome. Dev servers take no lock.
4. **Start and wait.** Start each server to run in `stages` order, inside its component's path, as a background command (the session's background-command tool, never a blocking call), keeping its output. Before starting the next, poll its address (`demoUrl`, else `serveUrl`) until any HTTP status comes back (e.g. `curl -s -o /dev/null -w "%{http_code}" {address}` prints something other than `000`), for up to about 60 seconds with the session's wait or monitor tool. Still silent, or the command exited: report the error from its output, then step 7, and stop. The demo serves the shared checkout: list the files other sessions left uncommitted (`git status`), the report names them.

5. **Browser.** Use the browser tools of the session (Claude in Chrome or the built-in browser): open the tested component's `demoUrl` (else its `url`), sign in with the scenario's account, follow the steps, read the page. Take a screenshot at each expected result. Sign out between profiles.
6. **Database check**, when the scenario says what a UI action saved and the component's `CLAUDE.md` gives a read-only query command for the database the run uses. Never write to the database.
7. **Stop** every server this skill started, once the scenarios are done, pass or fail (the background command stopped, its port free again), then delete the lock. A dev server that already answered at step 2 is never stopped.
8. **Report**: demo or dev servers, those started and stopped, the foreign uncommitted files a demo served, then per scenario: passed / failed, what was seen, the screenshot, the console errors if any. A failure gets the likely cause from the code when it is clear, as uncertain otherwise. Do not fix anything in this skill: the calling skill (`implement`) does, or the next prompt is `/selo-flow:implement fix {failure}`.
9. When called from `implement` and every scenario passed, tell it so it ticks `Browser test` in the plan's Validation.
