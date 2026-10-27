---
name: drizzle-migrations
description: "Generate, check, apply and reset Drizzle migrations for the api component's PostgreSQL schema (PGlite locally), following the naming and folder rules of its CLAUDE.md (## Database table). Use when: a Drizzle table, column, index or relation changed, a new migration is needed, a migration not yet committed must be redone, the local database must be migrated or reset, or the migrations must be checked after a merge."
---

# Drizzle migrations

Manage the migrations of the api component. Every project fact comes from the `## Database` table of that component's `CLAUDE.md`: the schema entry point, the Drizzle config, the migrations folder, the local database folder and the naming rule. Read it first; run every command from the component's path.

## Constraints

- **Never edit a generated migration by hand** (`drizzle/{NNNN}_{name}.sql`), except a documented data migration created on purpose with `drizzle-kit generate --custom --name {name}`. If the model is wrong, fix the table file and regenerate.
- **Never edit `drizzle/meta/`** (journal and snapshots) by hand.
- **Never rewrite a committed migration:** once on the base branch it may run somewhere; change the model and generate a new one.
- Drizzle has no down migrations: undoing an applied change is a new migration (deployment) or a reset (local).

## Procedure

1. **Change the model** in the feature's `{feature}.table.ts`; make sure `src/db/schema.ts` re-exports it.
2. **Generate:** `npx drizzle-kit generate --name {snake_case_description}`. Drizzle writes `drizzle/{NNNN}_{name}.sql` and updates `drizzle/meta/`.
3. **Review** the SQL against the intended change: a rename shows as drop + add unless Drizzle asked and you answered "rename"; a new `NOT NULL` column on a table with rows needs a default or a backfill. Wrong: undo the generation (below), fix the table, regenerate.
4. **Check:** `npx drizzle-kit check` reports a migration history that no longer matches the snapshots.
5. **Apply locally:** stop the API first (PGlite allows one process per data folder, say so in the report), then `npx drizzle-kit migrate`.
6. **Test:** the test setup applies every migration to an in-memory PGlite, so the component's `test` command proves the migration runs from scratch.
7. **Commit** the table change, the `.sql` file and `drizzle/meta/` together: in an `fastlane` stage, in the stage's single commit.

`drizzle-kit generate` asks interactive questions when it cannot tell a rename from a drop + add, and an agent's shell cannot answer them. When it stops on one, never guess (a wrong answer drops data): give the person the exact `npx drizzle-kit generate --name {name}` command to run in their own terminal, say which answer the intended change calls for, and resume at Review once it has run.

## Variants

| Scenario | Command |
|---|---|
| Undo a generation not yet committed | `git status drizzle` lists what it wrote: `git restore` the modified files, delete the new untracked ones |
| Reset the local database | stop the API, delete the local database folder, `npx drizzle-kit migrate` |
| Data migration | `npx drizzle-kit generate --custom --name {name}`, write the SQL, review it like code |
| Browse the local database | stop the API, `npx drizzle-kit studio` |

## Troubleshooting

- `migrate` hangs or fails to open the database: the API (or a studio) still holds the PGlite folder. Stop it and retry.
- Migration conflict after a merge (two migrations with the same number, `check` complains): never hand-edit the journal. Undo your local generation as above, merge, regenerate: it takes the next number.
- A migration applied locally was then regenerated: reset the local database.
