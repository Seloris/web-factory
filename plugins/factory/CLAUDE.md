# factory — the workflow plugin

```component
kind: lib
stack: claude-code-plugin
layers: [scripts, skills, agents, templates, docs]
commands:
  build: claude plugin validate .
  test: node --test "tests/*.test.mjs"
```

Commands run from this folder. `test` covers the manifest parser and the hooks against `../../examples/two-components`.

## Conventions

- Stack-agnostic: no stack word (`dotnet`, `nx`, `swagger`, `angular`…) in `skills/`, `agents/`, `scripts/`, `reference/` or `templates/`. They belong to `stacks/` and to the examples.
- A skill reads `reference/workflow-rules.md` first and the manifest through `scripts/manifest.mjs`; it never parses `CLAUDE.md` itself.
- Scripts: ES modules, Node 20+, no dependency. A hook never throws: on any error it allows the call.
- Every behaviour described in `../../docs/` exists in a skill, and the reverse; a change to one updates the other in the same commit.
- A template's `{{placeholder}}` is listed in the `init` skill's interview.

## Testing

`node --test "tests/*.test.mjs"`: parser unit tests, hook verdicts, and the hook scripts spawned with real events against the example project. A new script gets its tests in the same stage.
