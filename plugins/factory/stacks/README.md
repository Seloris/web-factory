# Stack packs

A pack is what `factory-init` applies to a project for a given stack, nothing more:

```
stacks/{stack}/
  README.md                   first line: one-line description (shown by factory-init)
  templates/{kind}.CLAUDE.md  component CLAUDE.md pre-filled for that kind (api, front, db, worker, lib)
  skills/{name}/SKILL.md      stack-specific skills, read in place when a component's CLAUDE.md names them
  gitignore                   optional: lines factory-init appends to the project's .gitignore
```

A pack never changes the workflow: the plugin's `skills/` know no stack. A pack's skill reads what it needs from the component's `CLAUDE.md` (project names, folders, fixtures), which the pack's template declares in named sections, so the skill works in every project that uses the pack.

To make a pack: copy a project's component `CLAUDE.md` that has grown good conventions, replace the project-specific values with `{{placeholders}}` that `factory-init` asks for, move its stack-specific skills next to it, and add a `README.md`. A pack may ship a code skeleton too (`skeleton/{kind}/`), copied to the component's path when the folder is empty; none does yet.

| Pack | Description |
|---|---|
| `react-express` | Full TypeScript: Express API (zod, Drizzle ORM on PostgreSQL, PGlite in-process for local runs and tests, Vitest + Supertest) and React front (Vite, TanStack Query, client typed from the API's OpenAPI document). |
