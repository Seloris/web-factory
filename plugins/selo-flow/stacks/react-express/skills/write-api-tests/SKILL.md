---
name: write-api-tests
description: "Derive and write Vitest + Supertest tests for an Express route by reverse-engineering its zod contract, guard, service and repository into a complete test matrix (happy path, unauthenticated, forbidden, validation, not-found, scope isolation, business rules, edge cases), using the setup and factories named in the api component's CLAUDE.md (## API tests table). Use when: a new or changed route needs tests, a route is listed in the Tests section of a dev-plan, or the person asks to add or complete tests for a route."
---

# Write tests for a route

Turn a route's implementation into a complete, convention-compliant test file: **read** the router entry plus its contract, guard, service and repository, **derive** the exact set of cases the logic demands, **write** them against the project's test context, seed helpers and factories. The project facts come from the `## API tests` table of the api component's `CLAUDE.md` (setup, HTTP client, authenticated calls, factories, database assertion, problem-details type, reference tests): read it and the reference tests first, so the new tests are indistinguishable from hand-written ones.

## Inputs

- The router: `src/features/{feature}/{feature}.routes.ts` (verb, path, guard, `validate(...)` call, status codes).
- The contract: `{feature}.schema.ts` (params, query, body, response schemas).
- The service function the route calls, and the repository functions it uses.
- The `AppError`s the service throws (`NotFoundError`, `ForbiddenError`, `ConflictError`, `BusinessRuleError` with their codes).
- The factories of `test/factories.ts` and what `seed` exposes.

## Output

One file `test/{feature}/{feature}.routes.test.ts`, or a new `describe` block in an existing one: `describe("POST /v1/orders", ...)`, one `it` per derived case, named as a sentence (`it("returns 404 when the order does not exist")`), with `// Arrange` / `// Act` / `// Assert` sections. One test context per file (`beforeAll(createTestContext)`), `reset()` in `beforeEach`: never a new database per test.

## Phase 0 — Read the route and its logic

1. The router entry: verb + path, path params vs query vs body, the guard (public or not, roles), the success status.
2. The contract: every zod constraint (required fields, `min`/`max`, formats, enums, refinements).
3. The service end to end: every branch that changes the HTTP outcome. A `NotFoundError` gives not found; a scope filter or check gives isolation; a `BusinessRuleError` or `ConflictError` gives one case per rule; the success path and its database writes.
4. If unclear which tables or features are involved, map the feature first (its folder, its tables); delegate a broad sweep to `Explore`.

## Phase 1 — Derive the matrix

| Signal in the code | Test | Expected |
|---|---|---|
| A guard requiring authentication (default unless explicitly public) | no auth header | `401` |
| A role or permission guard | user seeded without the role | `403` |
| Each zod constraint on params, query or body | one `it.each` row per invalid variant, named after the constraint | `400`, problem details listing the field |
| `NotFoundError` on a missing id | an id that does not exist | `404` |
| Scope, tenant or owner filter | act on another scope's data with a user of this scope | `403` or `404` (writes, as the service decides), absent from the list (reads) |
| Success path | response body parsed with the response schema **and** database state read back through `db` | the route's success status |
| Optional fields, flags, collections | edge cases: optionals omitted, flag toggles, empty list, pagination bounds | per case |
| Each business rule | one negative test per rule | the rule's status and `code` |

Skip a row only when the code makes it impossible. Never invent a case the code does not support.

## Phase 2 — Seeding

The lightest that satisfies the case, as the reference tests do: the bare context; entities built with the factories and inserted through `seed` or the repository, attached to the user's scope; a second scope and user for isolation cases; no auth header for `401`; the test clock set when the service reads the time. Never hand-build a row a factory produces; never insert data with raw SQL in a test; never seed outside the user's scope unless the test is about isolation.

## Phase 3 — Write

1. `it` per case; `it.each` only for the validation matrix.
2. Call the route with Supertest on the context's `app`: `await request(app).post(path).set(authHeader(user)).send(body)`.
3. Assert the status first, then the body: success bodies through the response zod schema (`schema.parse(res.body)`), errors as the problem-details type (`type`, `status`, `code`, field errors).
4. Every write route asserts persistence by reading the database back through `db`.
5. Use the project's glossary identifiers in names and comments.

## Phase 4 — Run and self-check

1. Every derived case is written; no case the code does not support.
2. Run the file through the component's test command narrowed to it (`npx vitest run test/{feature}/{feature}.routes.test.ts`): the tests are in-process and fast. A failing test is either a test mistake (fix it) or a real defect in the route (raise it, never weaken the assertion to make it pass).
3. Imports, types, no `any`, lint clean on the new file.

## Rules

- Follow the component's `CLAUDE.md` Testing conventions; this skill is their procedural companion and never contradicts them.
- Derive cases from the code, not from the table above: it is the maximum set.
- Never weaken an assertion to make a test pass: a failing test is a real gap to raise with the person.
