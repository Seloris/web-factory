# Stack packs

A pack is what `init` applies to a project for a given stack, nothing more:

```
stacks/{stack}/
  README.md                   first line: one-line description (shown by init)
  templates/{kind}.CLAUDE.md  component CLAUDE.md pre-filled for that kind (api, front, db, worker, lib)
  skills/{name}/SKILL.md      stack-specific skills, read in place when a component's CLAUDE.md names them
  gitignore                   optional: lines init appends to the project's .gitignore
  skeleton/{kind}/            optional: the code a component of that kind starts from, copied by init
                              into the component's path when it holds nothing but its CLAUDE.md
```

A pack never changes the workflow: the plugin's `skills/` know no stack. A pack's skill reads what it needs from the component's `CLAUDE.md` (project names, folders, fixtures), which the pack's template declares in named sections, so the skill works in every project that uses the pack.

To make a pack: copy a project's component `CLAUDE.md` that has grown good conventions, replace the project-specific values with `{{placeholders}}` that `init` asks for, move its stack-specific skills next to it, and add a `README.md`. A pack may ship a code skeleton too (`skeleton/{kind}/`): the smallest project for which the template's commands pass with zero features, with the same `{{placeholders}}` as the templates, and a `## Skeleton` section in the README naming the install command to run after the copy. A front skeleton ports the skins' element recipes (`skins/recipes.css`) into shared components, and its README's `## Skin` section names the tokens file and, when the pack self-hosts fonts, a font table: one row per skin, its pinned packages and the exact imports of the fonts file `init` writes. A new skin adds its row to every pack that has such a table.

| Pack | Description |
|---|---|
| `react-express` | Full TypeScript: Express API (zod, Drizzle ORM on PostgreSQL, PGlite in-process for local runs and tests, Vitest + Supertest) and React front (Vite, TanStack Query, client typed from the API's OpenAPI document). |
