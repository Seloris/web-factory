---
name: write-integration-tests
description: "Derive and write xUnit integration tests for a FastEndpoints endpoint by reverse-engineering its contract, authorization policy, validator and handler logic into a complete test matrix (happy path, unauthenticated, forbidden, validation, not-found, scope isolation, edge cases), using the fixtures named in the api component's CLAUDE.md (## Integration tests table). Use when: a new or changed endpoint needs tests, an endpoint is listed in the Tests section of a dev-plan, or the person asks to add or complete integration tests for an endpoint."
---

# Write integration tests for an endpoint

Turn an endpoint's implementation into a complete, convention-compliant integration-test file: **read** the endpoint plus its command or query, validator and handler, **derive** the exact set of cases the logic demands, **write** them against the project's base class, seeders and faker. The project facts come from the `## Integration tests` table of the api component's `CLAUDE.md` (project, base class, app fixture, seeder, faker, read-side assertion, problem-details type, reference tests): read it and the reference tests first, so the new tests are indistinguishable from hand-written ones.

## Inputs

- The endpoint file under the Api project (`v1/{Feature}/{Name}Endpoint.cs`).
- Its command or query wrapping class under the Application project (`{Feature}/{Commands|Queries}/{Name}.cs`: `Command`/`Query`, `Validator`, `Handler`).
- The domain exceptions the handler throws (`NotFoundException`, `AccessForbiddenException`, `DomainException`…).
- The faker's `Generate{Entity}()` methods and the entities the standard seeding context exposes.

## Output

One file `{IntegrationTests project}/{Feature}/{Name}EndpointTests.cs`, or new methods in an existing one. Class shape: `public sealed class {Name}EndpointTests({App fixture} app) : {Base class}(app)`. One method per derived case, `{Action}_Should_{Expected}_When_{Condition}`, with `// Arrange` / `// Act` / `// Assert` sections.

## Phase 0 — Read the endpoint and its logic

1. The endpoint: verb + route, `Req`/`Res` shape, route params vs body, the `Configure()` body (policy, anonymous or not).
2. The wrapping class: every `Validator` rule; the `Handler.Handle` body end to end.
3. Every branch that changes the HTTP outcome: `NotFoundException` → not found; scope or perimeter guards → isolation; `DomainException` or business guards → one case per rule; the success path and its database side effects.
4. If unclear which entities or DTOs are involved, map the feature first (Domain, Application, Api folders, EF configurations); delegate a broad sweep to `Explore`.

## Phase 1 — Derive the matrix

| Signal in the code | Test | Expected |
|---|---|---|
| Authentication required (default unless explicitly anonymous) | `Should_Fail_When_Unauthenticated`, anonymous client | `401` |
| A policy in `Configure()` | `Should_Fail_When_User_Has_No_Permissions`, user seeded with no roles or scopes | `403` |
| Each `Validator` rule | a `[Theory]` with one `[InlineData(…, TestDisplayName = "…")]` per invalid variant | `400` |
| `NotFoundException` on a missing id | `{Action}_NonExistentId_Should_Return_NotFound` | `404` |
| Scope, tenant or perimeter guard or filter | isolation: act on another scope's data with a user of this scope | `403` (writes) or empty / filtered (reads) |
| Success path | happy path: `Res` shape **and** database state through the read-side assertion | `200` |
| Optional fields, flags, collections | edge cases: null optionals, flag toggles, empty result, large N | per case |
| Each business rule | one negative test per rule | per error code |

Skip a row only when the code makes it impossible. Never invent a case the code does not support.

## Phase 2 — Seeding

The lightest that satisfies the case, as the reference tests do: the standard seeding alone (no feature data); the standard seeding with a callback adding entities through the seeder's db-context helper, built with the faker and attached to the standard context's ids so they stay in the user's scope; a custom user and scope for permission or isolation cases; the anonymous client for `401`; the test date service when the handler reads the clock. Never hand-build what the faker produces; never insert data in the test body outside the seeder's helper; never seed outside the user's scope unless the test is about isolation.

## Phase 3 — Write

1. `[Fact]` per case; `[Theory]` only for the validation matrix.
2. Call the endpoint with the FastEndpoints typed extensions (`POSTAsync<TEndpoint, TReq, TRes>`…); query-string or header requests through an `HttpRequestMessage` on the endpoint's test URL.
3. Assert with Shouldly: status, response shape (`ShouldSatisfyAllConditions` for several fields), error responses deserialised into the problem-details type.
4. Every write endpoint asserts persistence through the read-side assertion.
5. Thread the cancellation token through every async call.

## Phase 4 — Self-check

1. Every derived case is written; no case the code does not support.
2. Usings, namespace, primary-constructor base call.
3. Do not run the suite: it is slow. Give the filtered command from the component's `commands.integration_tests` (`{filter}` = `{Name}EndpointTests`), and run it only if the person explicitly asks in this session.

## Rules

- Follow the component's `CLAUDE.md` Testing conventions; this skill is their procedural companion and never contradicts them.
- Derive cases from the code, not from the table above: it is the maximum set.
- Never weaken an assertion to make a test pass: a failing generated test is a real gap to raise with the person.
- Use the project's glossary identifiers in names and comments.
