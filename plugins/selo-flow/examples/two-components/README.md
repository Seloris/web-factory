# two-components

The plugin's test project: an `api` component handing an OpenAPI file to a `web` component, every command an `echo`, so the workflow can be exercised on a stack that cannot fail. The plugin's tests (`node --test "plugins/selo-flow/tests/*.test.mjs"` from the repository root) read this project's manifest (`selo-flow.yaml`).

To try the workflow on it by hand, copy it to a folder of its own, `git init` there, then `/selo-flow:write-plan demo`, `/selo-flow:implement …`. `.planning/features/demo/00_spec.md` is a sample spec to plan from.
