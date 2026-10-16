# {{name}} — {{description}}

```component
kind: api
stack: dotnet-angular
layers: [Domain, Application, Infrastructure, Api]
commands:
  build: dotnet build {{solution}}
  test: dotnet test {{root_namespace}}.Application.UnitTests && dotnet test {{root_namespace}}.Infrastructure.UnitTests
  handoff: dotnet run --project {{root_namespace}}.Api -- --export-openapi {{handoff_file}}
  integration_tests: dotnet test {{root_namespace}}.Api.IntegrationTests --filter "FullyQualifiedName~{filter}"
```

All commands run from this component's path. The `test` command is the fast suite; narrow it while iterating with `--filter "FullyQualifiedName~{TestClass}"`.

## Structure

Clean Architecture, one project per layer, every layer organised by feature (`{Layer}/{Feature}/`):

| Project | Depends on | Holds |
|---|---|---|
| `{{root_namespace}}.Domain` | nothing | entities, value objects, domain services, domain events, domain errors |
| `{{root_namespace}}.Application` | Domain | use cases: one wrapping class per command or query holding `Command`/`Query`, `Validator` and `Handler`; DTOs and mappers; ports (interfaces) to the outside |
| `{{root_namespace}}.Infrastructure` | Domain, Application | EF Core (`{{db_context}}`, `IEntityTypeConfiguration<T>` under `Data/Configurations/`, migrations under `Data/Migrations/`), external integrations, jobs |
| `{{root_namespace}}.Api` | Application | FastEndpoints endpoints under `v1/{Feature}/{Name}Endpoint.cs`, authorization policies, problem-details mapping, OpenAPI export |

A shared kernel project, when there is one, holds only what several products share: no feature logic.

## Conventions

- **Time** always through the injected `IDateService`; never `DateTime.Now` / `UtcNow` in Domain, Application or Infrastructure.
- **Naming:** booleans with the `Is`/`Has`/`Can` prefix; identifiers in English; one type per file; the feature's name as the folder in every layer.
- **Use cases:** `public static class {Name}` wrapping `sealed record Command(...)` (or `Query`), `sealed class Validator : AbstractValidator<Command>`, `sealed class Handler : ICommandHandler<Command, Result>`. Handlers return typed results or throw typed domain exceptions (`NotFoundException`, `AccessForbiddenException`, `DomainException` with an error code); never bare `Exception`.
- **Authorization:** every endpoint names its policy in `Configure()`; anonymous access is explicit. Data access filters by the caller's scope (tenant, perimeter) inside the handler, never in the endpoint.
- **Persistence:** entities expose behaviour, not public setters; EF configuration lives in `IEntityTypeConfiguration<T>`, one per entity; query projections for reads, tracked entities for writes; no N+1 (`Include` or projection).
- **Errors** reach the client as problem details with a stable error code; validation failures are `400`, missing entities `404`, scope violations `403`.
- **Cancellation tokens** are threaded through every async call.
- Comments explain why, never what; XML docs on public Domain types only.

## EF Core

| Item | Value |
|---|---|
| DbContext | `{{root_namespace}}.Infrastructure/Data/{{db_context}}.cs` |
| Migrations folder | `{{root_namespace}}.Infrastructure/Data/Migrations/` |
| SQL scripts folder | `{{root_namespace}}.Infrastructure/Data/SqlMigrations/` |
| Design-time factory | `{{root_namespace}}.Infrastructure/Data/DesignFactory/{{db_context}}Factory.cs` |
| Connection string | `ConnectionStrings:{{db_context}}` in the user secrets of `{{root_namespace}}.Infrastructure` |
| Migration naming | `NNN_PascalCaseDescription`, 3-digit sequential prefix |

The `ef-migrations` skill reads this table.

## Testing

- **Unit tests** (`{{root_namespace}}.Application.UnitTests`, `{{root_namespace}}.Infrastructure.UnitTests`): xUnit v3, Shouldly, Moq. Domain methods, aggregates and handlers; `IDateService` faked; one test class per use case, methods named `{Action}_Should_{Expected}_When_{Condition}`, `// Arrange` / `// Act` / `// Assert` sections.
- **Integration tests** (`{{root_namespace}}.Api.IntegrationTests`): Testcontainers + Respawn, one class per endpoint, see the table below. Slow: never run unasked.
- Fakers (Bogus) and seeders are the only way to build test data; never hand-build an entity a faker can produce.

## Integration tests

| Item | Value |
|---|---|
| Project | `{{root_namespace}}.Api.IntegrationTests` |
| Base class | `{{root_namespace}}IntegrationTest` (primary constructor taking the app fixture) |
| App fixture | `{{root_namespace}}App` (`CreateClient()` anonymous, logged clients from the seeder, `TestDateService`) |
| Seeder | `SeedStandard()` / `SeedStandard(async (seeder, ctx) => …)` with `ArrangeWithDbContext` |
| Faker | `{{root_namespace}}Faker.Generate{Entity}(...)` |
| Read-side assertion | `AssertWithReadContext(async readCtx => …)` |
| Problem details type | `{{root_namespace}}ProblemDetails` |
| Reference tests | {{reference_tests}} |

The `write-integration-tests` skill reads this table.

## Local run

- Prerequisites: .NET SDK {{dotnet_version}}, Docker (integration tests), the user secrets above.
- Run: `dotnet run --project {{root_namespace}}.Api` → {{api_url}}. A running API locks the build output: stop it before a build or a handoff export (`Stop-Process -Name {{root_namespace}}.Api -Force` on Windows), and say so in the report.
- {{local_dependencies}}
