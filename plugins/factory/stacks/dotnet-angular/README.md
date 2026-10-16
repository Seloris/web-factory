.NET Clean Architecture API (CQRS, FastEndpoints, EF Core, xUnit + Testcontainers) and Angular Nx front with a generated OpenAPI client.

# dotnet-angular

Two component templates and three skills.

| File | For |
|---|---|
| `templates/api.CLAUDE.md` | kind `api`: Domain → Application → Infrastructure → Api, Mediator (source generator), FastEndpoints, FluentValidation, EF Core, OpenTelemetry; tests with xUnit v3, Shouldly, Moq, Testcontainers, Respawn, Bogus. |
| `templates/front.CLAUDE.md` | kind `front`: Angular in an Nx workspace, standalone components, signals, feature stores, PrimeNG, generated `@{scope}/api` client from the API's OpenAPI handoff. |
| `skills/ef-migrations` | add, remove, apply and script EF Core migrations, from the `## EF Core` table of the api component's `CLAUDE.md`. |
| `skills/openapi-client` | export the OpenAPI document from the API without running a server (`handoff`) and regenerate the Angular client (`prepare`). |
| `skills/write-integration-tests` | derive a FastEndpoints endpoint's integration-test matrix from its contract, policy, validator and handler, from the `## Integration tests` table of the api component's `CLAUDE.md`. |

The templates' `{{placeholders}}` are asked by `init`: `{{solution}}`, `{{root_namespace}}` (e.g. `Acme.Shop`), `{{db_context}}`, `{{workspace}}` (the Nx workspace folder), `{{app}}` (the Angular app name), `{{client_scope}}` (the npm scope of the generated client), plus the common ones (`{{name}}`, `{{description}}`, `{{url}}`…).

Hand-written conventions worth keeping when the templates are adapted: time through an injected `IDateService`, never `DateTime.Now`; booleans with the `Is` prefix; one wrapping class per use case holding `Command`/`Query`, `Validator` and `Handler`; errors as typed results or domain exceptions mapped to problem details, never bare exceptions; EF configurations in `IEntityTypeConfiguration<T>` files, one per entity; no hand-edited migrations; integration tests assert the database state after every write.
