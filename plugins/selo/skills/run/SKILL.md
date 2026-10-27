---
name: run
description: "Start the app on this worktree's slot and give its URLs: /selo:run [component | all] [demo | stop]. Starts the components named (all by default) and those they need, in the manifest's order, each awaited on its URL, in the background, on ports shifted by the slot so several worktrees run side by side; demo starts their demo (seeded data) instead of their dev servers; stop stops this worktree's run. Use when the person asks to start, launch, run, open or stop the app, a server or its demo, or asks on which URL it runs."
argument-hint: "[component | all] [demo | stop]"
---

# Run the app

Read the **Running the app** section of `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` first. Arguments: component names or `all` (default `all`), then `demo` or `stop` (also read as `--demo`, `--stop` or the old ` — demo`, ` — stop`: the rules' **Arguments**).

1. **Start.** From the project's root, `node ${CLAUDE_PLUGIN_ROOT}/scripts/run.mjs {components} [--demo]` as a background command (the session's background-command tool, never a blocking call), keeping its output. Wait for its `SELO_RUN {json}` line, for up to about 2 minutes, with the session's wait or monitor tool.
2. **Report.** The slot, the mode (dev or demo) and one link per component, the front first, the ones found running marked so. A line before `SELO_RUN` that says `no demo for …` says the run fell back to the dev servers: repeat it.
3. **Stop**, with `stop`: `node ${CLAUDE_PLUGIN_ROOT}/scripts/run.mjs --stop [{components}] [--demo]` (a short foreground command), then say what it stopped. A run another session started on this worktree is stopped too: say so.

**Errors.** The run exits with its message, which you repeat with what to do:

- `has no port` (or `demo_port`): the component's block lacks it, `/selo:setup component {name}` adds it.
- `Port … is taken`: a process this run did not start holds a port of the slot (a server started by hand): name the port, stop that process or run `/selo:run stop` first.
- Exit code 3: the slot's demo serves another session (a `try` running); start it again in a few minutes.
- A component that exits or does not answer: its last output lines, and the likely cause when they show it.

Outside a session the person runs the same script with `node selo-run.mjs [component | all] [--demo]` at the project's root (Ctrl+C stops it), or the shortcut its stack pack gives (`npm run app` with `react-express`).
