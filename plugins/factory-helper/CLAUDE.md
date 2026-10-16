# factory-helper — the workflow pane (to build)

```component
kind: lib
stack: claude-code-mod
layers: [scripts, hooks, tests]
commands:
  build: claude plugin validate .
  test: claude plugin test .
```

Commands run from this folder. See `README.md` and `../../.planning/features/factory-helper/00_spec.md`.

## Conventions

- A mod: read the `plugin-authoring` skill before touching `hooks/`.
- Nothing project-specific: stages, commands and models come from `../factory/scripts/manifest.mjs`.
- Node scripts under `scripts/` do the file and git reads (the mod's own file API is limited); hooks stay thin.
