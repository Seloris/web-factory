---
name: ef-migrations
description: "Add, remove, apply, and script EF Core migrations for the api component's DbContext, following the naming and snapshot rules of its CLAUDE.md (## EF Core table). Use when: an entity or EF configuration changed, a new migration is needed, a migration must be rolled back or removed, the local database must be updated, or an idempotent SQL script must be generated for deployment."
---

# EF Core migrations

Manage the migrations of the api component's DbContext. Every project fact comes from the `## EF Core` table of that component's `CLAUDE.md`: the DbContext file, the migrations and SQL script folders, the design-time factory, the connection-string secret and the naming rule. Read it first; run every command from the component's path, with `--project {Infrastructure project}` (the design-time factory makes `--startup-project` unnecessary).

## Naming

- Migration names follow the table's rule (default: a 3-digit sequential prefix then a PascalCase description: `001_Init`, `013_Orders_RemoveSiteId`).
- Before adding one, list the migrations folder and take the highest prefix + 1. Pass the full `NNN_Name` to the CLI; EF prepends its own timestamp (`20260721093154_013_Orders_RemoveSiteId.cs`).

## Constraints

- **Never edit by hand** `{timestamp}_{Name}.cs` (`Up`/`Down`), except a documented exceptional case (raw `Sql()` for a data migration). If the model changed, remove the migration via the CLI and regenerate it.
- **Never edit by hand** `{timestamp}_{Name}.Designer.cs` or the model snapshot. If the snapshot looks wrong, fix the offending migration or configuration, then `migrations remove` + `migrations add`.
- **Never delete migration files by hand**: always `dotnet ef migrations remove`, so the snapshot is reverted consistently.

## Procedure

1. **Next name:** list the migrations folder, build `NNN+1_PascalCaseDescription`.
2. **Add:** `dotnet ef migrations add {NNN_Name} --project {Infrastructure} --output-dir {migrations folder relative to the project}`.
3. **Review** `Up`/`Down` against the intended model change. Wrong: fix the entity or configuration, remove, regenerate.
4. **Update the local database:** `dotnet ef database update --project {Infrastructure}`.
5. **Idempotent SQL script** when the change must be deployed: `dotnet ef migrations script {previous} {new} --idempotent --project {Infrastructure} --output "{SQL scripts folder}/{timestamp}_{NNN_Name}.sql"`, with the full migration basenames.
6. **Commit** the migration files (`.cs` + `.Designer.cs`), the updated snapshot and any SQL script together with the model change: in an `implement` stage, in the stage's single commit.

In the lead session the `dotnet ef` runs go through the `runner` agent (the hook blocks builds inline; `dotnet ef` builds); read its report.

## Variants

| Scenario | Command |
|---|---|
| Remove the last migration (not applied) | `dotnet ef migrations remove --project {Infrastructure}` |
| Remove the last migration (applied) | `dotnet ef database update {previous} --project {Infrastructure}` then `migrations remove` |
| Reset the database | `dotnet ef database update 0 --project {Infrastructure}` |
| Update to a given migration | `dotnet ef database update {migration} --project {Infrastructure}` |
| List applied / pending | `dotnet ef migrations list --project {Infrastructure}` |

## Troubleshooting

- `Unable to create a 'DbContext'` / null connection string: the user secret named in the table is missing. `dotnet user-secrets set "{secret key}" "{connection string}" --project {Infrastructure}`.
- `dotnet ef` not found: `dotnet tool install --global dotnet-ef`, or `dotnet tool restore` when a manifest exists.
- Snapshot conflicts after a merge: never hand-edit the snapshot; remove your local migration, merge, regenerate it with the next prefix.
