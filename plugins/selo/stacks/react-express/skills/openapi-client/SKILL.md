---
name: openapi-client
description: "Export the OpenAPI document from the Express API's zod contracts without running a server (the api component's handoff command) and regenerate the React front's API types from it (the front component's prepare command). Use when: the API contract changed, routes or schemas were added or updated, at the end of an api stage, or at the start of a front stage."
---

# OpenAPI document and front types

Run the command, nothing else: no diff review, no extra build. The front stage's build catches any type error the new types cause.

The commands are those of the manifest (`node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs` from the project's root): the api component's `commands.handoff` writes the handoff file named in the manifest; the front component's `commands.prepare` regenerates `src/api/schema.d.ts` from that committed file. Run them from each component's path.

| When | Command | Writes |
|---|---|---|
| End of the api stage | the api component's `handoff` | the handoff file (e.g. `openapi.json`) |
| Start of the front stage | the front component's `prepare` | the generated types (`src/api/schema.d.ts`) |
| Outside a build, both at once | `handoff` then `prepare` | both |

The export imports the routers' zod contracts through the OpenAPI registry and writes the document; it opens no database and listens on no port, so the API may keep running.

A route missing from the document means its schemas are not registered: fix the registration in the feature's `{feature}.schema.ts` (a review finding on the api stage), never edit the handoff file or the generated types by hand.

## Commit

In an `fastlane` stage the generated files go in the stage's single commit: the handoff file with the api stage, the regenerated types with the front stage. Outside a stage, commit both together: `chore({slug}): regenerate the API client`.
