---
name: write-api-tests
description: "Derive and write xUnit v3 tests for a Minimal API endpoint by reverse-engineering its route, policy, validator, handler and domain rules into a complete test matrix (happy path, unauthenticated, forbidden, validation, not-found, scope isolation, business rules, edge cases), using the factory and base class named in the api component's CLAUDE.md (## API tests table). Use when: a new or changed endpoint needs tests, an endpoint is listed in the tests of a blueprint, or the person asks to add or complete tests for an endpoint."
---

# Write tests for an endpoint

Turn an endpoint's implementation into a complete, convention-compliant test class: **read** the route plus its use case (command or query, validator, handler) and the domain rules it calls, **derive** the exact set of cases the logic demands, **write** them against the project's factory and base class. The project facts come from the `## API tests` table of the api component's `CLAUDE.md` (setup, HTTP client, authenticated calls, test data, database assertion, problem-details type, reference tests): read it and the reference tests first, so the new tests are indistinguishable from hand-written ones.

## Inputs

- The endpoint: `src/Api/Features/{Feature}/{Feature}Endpoints.cs` (verb, route, group policy, bound parameters, `TypedResults`).
- The use case: `src/Application/{Feature}/{Action}{Entity}.cs` (the `Command` or `Query`, its `Validator`, its `Handler`).
- The domain methods and services the handler calls, and the exceptions they throw (`NotFoundException`, `ForbiddenException`, `ConflictException`, `DomainException` with their codes).
- The entities' constructors, to build the test data.

## Output

One file `tests/Api.Tests/{Feature}/{Feature}EndpointsTests.cs`, or new methods in the existing one: `public sealed class {Feature}EndpointsTests(ApiFactory api) : ApiTest(api)`, one method per derived case, named `{Action}_Should_{Expected}_When_{Condition}`, with `// Arrange` / `// Act` / `// Assert` sections. `CT` passed to every async call.

## Phase 0 — Read the endpoint and its logic

1. The route: verb and path, route values vs query vs body, the group's policy (public or not, roles), the success result.
2. The validator: every rule (`NotEmpty`, `MaximumLength`, formats, enums, `Must`).
3. The handler end to end: every branch that changes the HTTP outcome. A `NotFoundException` gives not found; a scope filter gives isolation; a `DomainException` or `ConflictException` gives one case per rule; the success path and its database writes.
4. If unclear which entities or features are involved, map the feature first (its folders in the four projects); delegate a broad sweep to `Explore`.

## Phase 1 — Derive the matrix

| Signal in the code | Test | Expected |
|---|---|---|
| A policy requiring authentication (default unless explicitly public) | no credentials | `401` |
| A role or permission policy | a user without the role | `403` |
| Each validator rule | one `[Theory]` row per invalid variant, named after the rule | `400`, the field in `errors` |
| `NotFoundException` on a missing id | an id that does not exist | `404`, `code` `not_found` |
| Scope, tenant or owner filter | act on another scope's data with a user of this scope | `403` or `404` (writes, as the handler decides), absent from the list (reads) |
| Success path | response body deserialised to its DTO **and** database state read back | the endpoint's success status |
| Optional fields, flags, collections | edge cases: optionals omitted, flag toggles, empty list, paging bounds | per case |
| Each business rule | one negative test per rule | its status (`409`, `422`) and `code` |

Skip a row only when the code makes it impossible. Never invent a case the code does not support.

## Phase 2 — Test data

The lightest that satisfies the case, as the reference tests do: nothing for a validation case; entities built with their public constructors and saved through a scope's `AppDbContext`, attached to the user's scope; a second scope and user for isolation cases; no credentials for `401`; the test clock set (`Api.Time.Set(...)`) when the handler reads the time. Never insert rows with raw SQL; never seed outside the user's scope unless the test is about isolation.

## Phase 3 — Write

1. One `[Fact]` per case; `[Theory]` with `[InlineData]` only for the validation matrix (serialisable values: strings, numbers).
2. Call the endpoint with the class's `Client`: `GetAsync`, `PostAsJsonAsync`, `PutAsJsonAsync`, `DeleteAsync`, always with `CT`.
3. Assert the status first (`response.StatusCode.ShouldBe(HttpStatusCode.OK)`), then the body: success bodies through `ReadFromJsonAsync<TDto>(CT)`, errors as the problem-details type (`status`, `code`, field `errors`).
4. Every write endpoint asserts persistence by reading the database back through a new scope's `AppDbContext`.
5. Use the project's glossary identifiers in names and comments.

## Phase 4 — Run and self-check

1. Every derived case is written; no case the code does not support.
2. Run the class through the component's test command narrowed to it (`dotnet test --filter-class "*{Feature}EndpointsTests"`): the tests are in-process and fast. A failing test is either a test mistake (fix it) or a real defect in the endpoint (raise it, never weaken the assertion to make it pass).
3. The build has no warning (warnings are errors), and `lint` is clean on the new file.

## Rules

- Follow the component's `CLAUDE.md` Testing conventions; this skill is their procedural companion and never contradicts them.
- Derive cases from the code, not from the table above: it is the maximum set.
- Never weaken an assertion to make a test pass: a failing test is a real gap to raise with the person.
