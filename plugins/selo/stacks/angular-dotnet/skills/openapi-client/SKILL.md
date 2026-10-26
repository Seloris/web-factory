---
name: openapi-client
description: "Export the OpenAPI document of the .NET API without serving it (the api component's handoff command) and regenerate the Angular front's API client from it with ng-openapi-gen (the front component's prepare command). Use when: the API contract changed, endpoints or DTOs were added or updated, at the end of an api stage, or at the start of a front stage."
---

# OpenAPI document and front client

Run the command, nothing else: no diff review, no extra build. The front stage's build catches any type error the new client causes.

The commands are those of the manifest (`node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs` from the project's root): the api component's `commands.handoff` writes `openapi.json` at the api component's root; the front component's `commands.prepare` regenerates `src/api/` from that committed file. Run them from each component's path.

| When | Command | Writes |
|---|---|---|
| End of the api stage | the api component's `handoff` | `openapi.json` |
| Start of the front stage | the front component's `prepare` | the generated client (`src/api/`: `api.ts`, `fn/{tag}/{operation}.ts`, `models/`) |
| Outside a build, both at once | `handoff` then `prepare` | both |

The export builds the API and runs its host up to `RunAsync` to read the endpoints' metadata: it opens no database and listens on no port. A running API locks the build output: stop it first when the build fails on a locked file, and say so in the report.

An endpoint missing from the document, or a function with a poor name, comes from its metadata: `.WithTags("{Feature}")` on the group gives the client's folder, `.WithName("{Verb}{Resource}")` its function (`GetOrders` → `getOrders`), `TypedResults` and `Results<…>` its response types. Fix them in the feature's endpoints file (a review finding on the api stage); never edit `openapi.json` or `src/api/` by hand.

## Commit

In a stage the generated files go in the stage's commit: `openapi.json` with the api stage, `src/api/` with the front stage. Outside a stage, commit both together: `chore({slug}): regenerate the API client`.
