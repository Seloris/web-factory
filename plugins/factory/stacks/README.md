# Stack packs

A pack is what `init` copies into a project for a given stack, nothing more:

```
stacks/{stack}/
  README.md                   first line: one-line description (shown by init)
  templates/{kind}.CLAUDE.md  component CLAUDE.md pre-filled for that kind (api, front, db, worker, lib)
  skills/{name}/SKILL.md      stack-specific skills, copied to the project's .claude/skills/
```

A pack never changes the workflow: the skills of `plugins/factory/skills/` know no stack. A pack's skill reads what it needs from the component's `CLAUDE.md` (project names, folders, fixtures), which the pack's template declares in named sections, so the skill works in every project that uses the pack.

To make a pack: copy a project's component `CLAUDE.md` that has grown good conventions, replace the project-specific values with `{{placeholders}}` that `init` asks for, move its stack-specific skills next to it, and add a `README.md`. A pack may ship a code skeleton too (`skeleton/{kind}/`), copied to the component's path when the folder is empty; none does yet.

| Pack | Description |
|---|---|
| `dotnet-angular` | .NET (Clean Architecture, CQRS with a source-generated mediator, FastEndpoints, EF Core, xUnit + Testcontainers) and Angular (Nx, signals, generated OpenAPI client). |
