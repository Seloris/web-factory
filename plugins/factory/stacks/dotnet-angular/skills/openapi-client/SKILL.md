---
name: openapi-client
description: "Export the OpenAPI document from the .NET API without running a server (the api component's handoff command) and regenerate the Angular client library from it (the front component's prepare command). Use when: the API contract changed, endpoints or DTOs were added or updated, at the end of an api stage, or at the start of a front stage."
---

# OpenAPI document and Angular client

Run the command, nothing else: no diff review, no extra build. The front stage's build catches any type error the new client causes.

The commands are those of the manifest (`node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs` from the project's root): the api component's `commands.handoff` writes the handoff file named in the manifest; the front component's `commands.prepare` regenerates the client from that committed file. Run them from each component's path.

| When | Command | Writes |
|---|---|---|
| End of the api stage | the api component's `handoff` | the handoff file (e.g. `openapi.json`) |
| Start of the front stage | the front component's `prepare` | the generated client (e.g. `libs/api/src/generated/`) |
| Outside a plan, both at once | `handoff` then `prepare` | both |

The export builds the API and writes its document without listening on a port. A running API process locks the build output and makes the export fail: stop it first (the command is in the api component's `CLAUDE.md`, Local run), without asking, and say so in the report. Do not restart it afterwards unless asked.

## Commit

In an `implement` stage the generated files go in the stage's single commit: the handoff file with the api stage, the regenerated client with the front stage. Outside a stage, commit both together: `chore({slug}): regenerate the API client`.
