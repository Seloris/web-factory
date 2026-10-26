# api — the roster API: players, their ranked class and spec choices, the generated raid roster

```component
kind: api
stack: angular-dotnet
layers: [domain, application, infrastructure, api]
commands:
  build: dotnet build
  test: dotnet test
  lint: dotnet format --verify-no-changes --include {files}
  handoff: dotnet build src/Api -p:OpenApiGenerateDocuments=true
  serve: dotnet run --project src/Api --no-launch-profile
  demo: dotnet run --project src/Api -c Release --no-launch-profile -- --environment Demo
port: 5480
demo_port: 5580
```

All commands run from this component's path. The `test` command runs every test, endpoint tests included: they run the API in process on an in-memory SQLite database and touch no external system. Narrow it while iterating with `dotnet test --filter-class "*{Name}Tests"` or `--filter-method "*{Method}"`.

## Structure

Clean Architecture in four projects, each organised by feature (`{Layer}/{Feature}/`):

```
App.slnx                    the solution; Directory.Build.props (net10.0, nullable, warnings as errors, RosterComp.{Project} names), Directory.Packages.props (every package version)
src/
  Domain/                   entities, domain services, domain exceptions; depends on nothing
    Common/                 DomainException (a broken rule, 422) and NotFoundException, ForbiddenException, ConflictException
    {Feature}/              entities and enums of the feature
  Application/              use cases; depends on Domain only
    Common/IAppDbContext.cs the database as the handlers see it: one DbSet per entity
    DependencyInjection.cs  AddApplication: the validators and every nested Handler class
    {Feature}/              one file per use case ({Action}{Entity}.cs: Command or Query, Validator, Handler), Dtos/, {Feature}Mappers.cs
  Infrastructure/           EF Core on SQLite; implements the Application interfaces, no business logic
    Data/                   AppDbContext, Configurations/ (one IEntityTypeConfiguration per entity), Migrations/ (generated), DemoSeeder.cs
    DependencyInjection.cs  AddInfrastructure, MigrateDatabaseAsync (and the demo seed)
  Api/                      Minimal APIs; depends on Application (and Infrastructure for registration only)
    Program.cs              the host: port, problem details, validation filter, endpoints, migrations at start
    Common/                 ProblemDetailsExceptionHandler (exception → status and code), ValidationFilter (FluentValidation → 400)
    Features/{Feature}/     {Feature}Endpoints.cs: Map{Feature}(this IEndpointRouteBuilder), its routes, and the request records
    appsettings.json        base port, connection string; appsettings.Demo.json: the demo's
    .data/                  the local SQLite database (git-ignored, but the folder)
tests/
  Api.Tests/                xUnit v3, Shouldly; ApiFactory (WebApplicationFactory, in-memory SQLite, test clock), ApiTest (the base class), {Feature}/ one file per endpoints class
openapi.json                the handoff file, written by `handoff`
```

The layers, in the order a stage implements them: `domain` (entities and their rules), `application` (use cases with their validators, DTOs and mappers), `infrastructure` (EF configuration and the migration), `api` (endpoints and their tests).

## Conventions

- **Dependencies:** Domain depends on nothing; Application on Domain; Infrastructure on Application; Api on Application. The Api names an Infrastructure type only in `Program.cs`, to register it.
- **Use cases:** one file per use case in `Application/{Feature}/`, a static class holding the nested `Command` (or `Query`) record, its `Validator` (`AbstractValidator<Command>`) and its `Handler`: `CreateOrder.Command`, `CreateOrder.Validator`, `CreateOrder.Handler`. The handler is a sealed class with a primary constructor (`IAppDbContext`, `TimeProvider`, …) and one `HandleAsync(Command, CancellationToken)` method. No repository: handlers query `IAppDbContext` directly, `AsNoTracking()` for reads, projecting to the DTO in the query.
- **Endpoints are thin:** bind the request, call one handler, return its DTO: `group.MapPost("/", (CreateOrder.Command command, CreateOrder.Handler handler, CancellationToken ct) => handler.HandleAsync(command, ct))`. Each feature's group carries `.WithTags("{Feature}")`; each endpoint `.WithName("{Verb}{Resource}")` (the front's generated function: `GetOrders` → `getOrders`) and `.WithSummary(...)`; `TypedResults` with `Results<Ok<T>, NotFound>` when the outcomes differ, so the OpenAPI document lists them. Create and update return `200` with the entity's DTO, never `204`. Responses are Application DTOs, never Domain entities.
- **Validation:** format and structure checks (required, length, format, allowed values) in the use case's `Validator`; the `ValidationFilter` runs it before the handler and answers `400` with the errors by field. A validator holds no business rule.
- **Errors:** a business rule throws a `DomainException` with a stable snake_case code (`order_too_late`), or a `NotFoundException`, `ForbiddenException` or `ConflictException`; the exception handler turns it into problem details (`application/problem+json`, RFC 9457) with its `code`: `404`, `403`, `409`, `422`. A body that does not bind is a `400`. Never `throw new Exception(...)` or `InvalidOperationException` for an expected case.
- **Domain:** business logic lives in the entities (constructors, mutation methods); a rule that spans several entities goes to a static domain service (`{Name}Policy`, `{Name}Calculator`). Each entity has a private parameterless constructor for EF Core and a public one with its mandatory values. No value objects: plain properties.
- **Time** through the injected `TimeProvider` (`time.GetUtcNow()`), never `DateTime.Now`, `DateTime.UtcNow` or `DateTimeOffset.UtcNow`.
- **DTOs** are `record`s with a primary constructor; mappers are extension members in `{Feature}Mappers.cs`, 1:1 projections with no rule.
- **Authorization:** every endpoint group declares its policy, or says explicitly that it is public (an application without sign-in says so once, in `Program.cs`). Data access filters by the caller's scope (tenant, owner) inside the handler, never in the endpoint.
- **Persistence:** EF Core LINQ, no raw SQL except a documented case; select only what a response needs; no N+1 (`Include` or one query with `Contains`). One `SaveChangesAsync` per command.
- **C#:** file-scoped namespaces, one type per file, `sealed` unless designed for inheritance, `var` when the type is obvious; booleans with the `Is`/`Has`/`Can` prefix; identifiers in English. Comments explain why, never what.

## Database

| Item | Value |
|---|---|
| Engine | SQLite through EF Core: a file locally, in memory for the demo and the tests |
| DbContext | `src/Infrastructure/Data/AppDbContext.cs`, its configurations in `Data/Configurations/` |
| Migrations folder | `src/Infrastructure/Data/Migrations/` |
| Add a migration | `dotnet ef migrations add {Name} --project src/Infrastructure --startup-project src/Api --output-dir Data/Migrations` |
| Apply | `dotnet ef database update --project src/Infrastructure --startup-project src/Api` (the API also applies them at start) |
| Local database | `src/Api/.data/app.db` (git-ignored) |
| Connection | `ConnectionStrings:Default` in `appsettings.json`; in deployment, the environment (`ConnectionStrings__Default`) |
| Migration naming | PascalCase description (`AddOrderDueDate`); EF prefixes the timestamp |

The `ef-migrations` skill reads this table.

## Testing

- **xUnit v3** with Shouldly. Endpoint tests run the API in process (`ApiFactory`: `WebApplicationFactory` on an in-memory SQLite database, migrated at start); a handler or domain service with branching rules may get unit tests of its own in the same project. Names `{Action}_Should_{Expected}_When_{Condition}`, one case per method, `// Arrange` / `// Act` / `// Assert` sections.
- Test data goes in through the database (`Api.Services` scope, `AppDbContext`) or through the endpoints, never a raw SQL insert.
- The test clock is fixed (`Api.Time.Set(...)`); a test never depends on the real time.

## API tests

| Item | Value |
|---|---|
| Setup | `tests/Api.Tests/ApiFactory.cs`: one factory per test class (`IClassFixture`), each on its own in-memory database; `ApiTest` resets every table and the clock before each test |
| HTTP client | `Client` (`HttpClient` on the factory): `await Client.PostAsJsonAsync("/orders", body, CT)` |
| Test data | `using var scope = Api.Services.CreateScope();` then `AppDbContext` from it, `Add`, `SaveChangesAsync(CT)` |
| Database assertion | read back through a new scope's `AppDbContext` after every write |
| Problem details type | `Microsoft.AspNetCore.Mvc.ProblemDetails` / `HttpValidationProblemDetails`, its `code` in `Extensions` |
| Reference tests | `tests/Api.Tests/Health/HealthEndpointsTests.cs` |

The `write-api-tests` skill reads this table.

## Local run

- Prerequisites: the .NET SDK of `global.json`, `dotnet restore` and `dotnet tool restore` (dotnet-ef). Nothing else: the database is a SQLite file, created and migrated at the API's start.
- Run: `/selo:run api` (or `dotnet run --project src/Api --no-launch-profile`) → http://localhost:5480 on slot 0, the port + 10 per slot; the API reads `PORT`. It applies the pending migrations at start.
- A running API locks its build output: stop it before a `build`, `test` or `handoff` that fails on a locked file, and say so in the report. The demo builds in `Release`, apart from the dev server's `Debug` output: the two run side by side.
- Reset the local database: stop the API, delete `src/Api/.data/app.db`, start it again.
- Demo: `dotnet run --project src/Api -c Release --no-launch-profile -- --environment Demo` → http://localhost:5580 (slot 0; `/selo:run api — demo` on this worktree's slot), an in-memory database migrated and seeded by `src/Infrastructure/Data/DemoSeeder.cs` at each start; it never touches `.data/app.db`. `try` starts and stops it. A feature that adds a screen adds its demo rows to `DemoSeeder`.
