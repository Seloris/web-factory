---
name: ef-migrations
description: "Add, review, apply, remove and reset EF Core migrations for the api component's database (SQLite, or SQL Server with the pack's option), following the naming and folder rules of its CLAUDE.md (## Database table). Use when: an entity or an EF configuration changed, a new migration is needed, a migration not yet committed must be redone, the local database must be migrated or reset, or the migrations must be checked after a merge."
---

# EF Core migrations

Manage the migrations of the api component. Every project fact comes from the `## Database` table of that component's `CLAUDE.md`: the DbContext, the migrations folder, the add and apply commands, the local database and the naming rule. Read it first; run every command from the component's path (`dotnet tool restore` once, for `dotnet ef`).

## Constraints

- **Never edit a generated migration by hand** (`{timestamp}_{Name}.cs`, its `.Designer.cs`, `AppDbContextModelSnapshot.cs`), except a documented data migration: raw `migrationBuilder.Sql(...)` added on purpose to an empty migration, reviewed like code. If the model is wrong, fix the entity or its configuration, then remove and add again.
- **Never delete migration files by hand:** `dotnet ef migrations remove` reverts the snapshot with them.
- **Never rewrite a committed migration:** once on the base branch it may run somewhere; change the model and add a new one.
- On SQLite (the table's Engine row), EF cannot alter every column in place: it rebuilds the table for those changes (a new table, a copy, a rename). Read the generated `Up` for it, and for any data it could lose. On SQL Server, read it for a column made narrower or required on a table with rows, and for a cascade path SQL Server refuses (two cascading foreign keys to one table).

## Procedure

1. **Change the model:** the entity in `src/Domain/{Feature}/`, its `IEntityTypeConfiguration<T>` in `src/Infrastructure/Data/Configurations/`, its `DbSet` on `AppDbContext` and `IAppDbContext`.
2. **Add:** the table's add command with a PascalCase name for the change (`AddOrderDueDate`). EF writes `{timestamp}_{Name}.cs`, its `.Designer.cs` and updates the snapshot.
3. **Review** `Up` and `Down` against the intended change: a rename shows as a drop and an add unless the configuration says otherwise; a new required column on a table with rows needs a default; a table rebuild must carry every column over. Wrong: remove (below), fix the model, add again.
4. **Apply locally:** the table's apply command, or start the API (it applies pending migrations at start). Stop a running API first if the build output is locked, and say so in the report.
5. **Test:** the test factory migrates a new database from scratch, so the component's `test` command proves the migration runs.
6. **Commit** the model change, the migration, its designer file and the snapshot together: in a `build` or `fastlane` stage, in the stage's commit.

## Variants

| Scenario | Command |
|---|---|
| Remove the last migration, not applied | `dotnet ef migrations remove --project src/Infrastructure --startup-project src/Api` |
| Remove the last migration, already applied locally | `dotnet ef database update {PreviousMigration} --project src/Infrastructure --startup-project src/Api`, then remove as above |
| List applied and pending migrations | `dotnet ef migrations list --project src/Infrastructure --startup-project src/Api` |
| Data migration | add an empty migration (`migrations add {Name}` with no model change), write its `Sql(...)`, review it like code |
| Reset the local database | stop the API, then as the `## Local run` section of the component's `CLAUDE.md` says (SQLite: delete the file; SQL Server: `dotnet ef database drop --force`), then apply |
| Script for a deployment | `dotnet ef migrations script {From} {To} --idempotent --project src/Infrastructure --startup-project src/Api --output {file}.sql` |

## Troubleshooting

- `dotnet ef` not found: `dotnet tool restore` (the tool is pinned in `.config/dotnet-tools.json`).
- `The process cannot access the file` during the build: a running API holds the output. Stop it and retry.
- Snapshot conflict after a merge: never hand-edit the snapshot. Remove your local migration, merge, add it again: it lands after the incoming ones.
- A migration applied locally was then regenerated: reset the local database.
