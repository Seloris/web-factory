# Pin a todo at the top of the list

Feature: `home` · Components: `api`, `web` · Spec: FR-01, FR-02, FR-03, FR-05, FR-12, BR-05

## Context

The home page lists every todo newest first: in a long list, the todos that matter sink under the new ones. This iteration lets the person pin a todo: pinned todos stay at the top of the list, for every visitor, until they are unpinned. The API stores a pinned flag on each todo and gets a route to set it; the front orders the pinned todos first, marks them in the list and adds a pin button on each row.

## Decisions

- "Pin a note": what is a note? → A `Todo`: the application has no other entity, and no `Note` enters the glossary.
- Pins shared by every visitor, or kept per browser? → Shared: stored by the API with the todo, like its state (the spec's non-goal: no accounts, one list for everyone).
- Order among the pinned todos? → Newest first, as FR-01 (a boolean is enough: no pinning date).
- Pin and completion? → Independent (BR-05): a completed todo stays pinned; the sort by state applies within the pinned todos, then within the others, the pinned group always on top (FR-05 revised).
- Filters and limit? → The search and the tag filter apply to pinned todos like any other; any number of todos may be pinned (BR-05).
- Where is the pinned-first order computed? → In the browser, in `selectVisibleTodos`, like the filters and the sort by state (the first plan's decision): `GET /v1/todos` keeps its newest-first order and only gains the `isPinned` field.
- Route? → A dedicated `PATCH /v1/todos/{id}/pin` with `{ isPinned }` (`200` todo, `400`, `404`), rather than a partial body on `PATCH /v1/todos/{id}`: the completion contract, its tests and its front mutation stay as they are, and the front's two mutations keep separate keys for their pending states.
- The pin button? → A toggle button with a stable label (`Épingler`) and `aria-pressed`, highlighted when pressed; the pinned row is also marked by the accent on its leading edge (FR-03). A new `subtle` button variant: the `ghost` one turns red on hover, which reads as destructive.
- Branch? → `feat/home-pin-todo`, cut from `develop` (at the same commit as `main`), following `docs/CONTRIBUTING.md`.

## api

### db

- `src/features/todos/todos.table.ts`: add `isPinned: boolean().notNull().default(false)` after `isCompleted`. Existing todos become not pinned.
- Migration through the `drizzle-migrations` stack skill: `npm run db:generate -- --name add_todo_is_pinned` (generates `drizzle/0001_add_todo_is_pinned.sql`, an `add column "is_pinned" boolean default false not null`), then `npm run db:migrate` with the API stopped. The generated files are committed as generated.

### services

- `src/features/todos/todos.schema.ts`: `todoSchema` gains `isPinned: z.boolean()` after `isCompleted` (the `Todo` type follows).
- `src/features/todos/todos.repository.ts`:
  - `todoColumns` gains `isPinned: todos.isPinned`, so every select and `returning` carries it.
  - `setPinned(id: number, isPinned: boolean): Promise<Todo | null>`: same shape as `setCompleted` (`update … set({ isPinned }) where id … returning(todoColumns)`, `null` when no row matched).
  - `list()` unchanged: newest first.
- `src/features/todos/todos.service.ts`: `setTodoPinned(id: number, isPinned: boolean): Promise<Todo>`: throws `NotFoundError("Todo", id)` when the repository returns `null` (FR-12). `setTodoCompleted` does not touch `isPinned` (BR-05); `createTodo` leaves it to the column default (FR-02).
- `test/factories.ts`: `buildTodo` gains `isPinned: false` in its defaults.

### routes

- `src/features/todos/todos.schema.ts`:
  - `setTodoPinnedBodySchema = z.object({ isPinned: z.boolean() })`.
  - Register `PATCH /v1/todos/{id}/pin`, summary "Pin or unpin a todo": `request.params` `todoIdParamsSchema`, body `setTodoPinnedBodySchema` (required); responses `200` todo, `400` "The id or the body is invalid", `404` "The todo does not exist", problems as `application/problem+json`.
- `src/features/todos/todos.routes.ts`: `const setPinnedSchemas = { params: todoIdParamsSchema, body: setTodoPinnedBodySchema }`; `router.patch("/v1/todos/:id/pin", validate(setPinnedSchemas), …)`: `inputOf`, `service.setTodoPinned(params.id, body.isPinned)`, `200` with the todo.
- Handoff: `npx tsx scripts/export-openapi.ts openapi.json` rewrites `api/openapi.json`, committed with the stage. Check that `components.schemas.Todo` lists `isPinned` as required and that the new path's responses `$ref` `Todo` and `ProblemDetails`.

## web

### data

- `src/features/todos/data/useSetTodoPinnedMutation.ts`, the twin of `useSetTodoCompletedMutation.ts`: `export type SetTodoPinnedVariables = { id: number; isPinned: boolean }`, `export const setTodoPinnedKey = [...todoKeys.all, "setPinned"] as const`, `api.PATCH("/v1/todos/{id}/pin", { params: { path: { id } }, body: { isPinned } })`, throws `toProblem(error, response)` when the response is not ok, invalidates `todoKeys.all` on success.
- `src/features/todos/data/selectTodos.ts`, `selectVisibleTodos`: after the filters, always one stable `toSorted`: pinned before not pinned (FR-01); then, when `isSortedByState`, not completed before completed (FR-05). Within each group the API's newest-first order stands. The comment says the pinned group comes first and the sort by state applies within each group.

### pages

- `src/features/todos/pages/HomePage.tsx`:
  - `const setTodoPinned = useSetTodoPinnedMutation()`.
  - `pendingPinIds` from `useMutationState({ filters: { mutationKey: setTodoPinnedKey, status: "pending" }, select: (mutation) => (mutation.state.variables as SetTodoPinnedVariables).id })`, beside `pendingIds`.
  - `TodoList` gets `pendingPinIds` and `onTogglePinned={(todo, isPinned) => setTodoPinned.mutate({ id: todo.id, isPinned })}`.
  - The generic error above the list shows when `setTodoCompleted.isError || setTodoPinned.isError` (`common.error.generic`).

### ui

- `src/features/todos/ui/TodoList.tsx`: props gain `pendingPinIds: number[]` and `onTogglePinned(todo: Todo, isPinned: boolean): void`; passes `isPinPending={pendingPinIds.includes(todo.id)}` and `onTogglePinned={(isPinned) => onTogglePinned(todo, isPinned)}` to each `TodoItem`.
- `src/features/todos/ui/TodoItem.tsx`: props gain `isPinPending: boolean` and `onTogglePinned(isPinned: boolean): void`. `ListItem` gets `isPinned={todo.isPinned}`. Before the delete button, a `Button variant="subtle"` with `aria-pressed={todo.isPinned}`, `disabled={isPinPending}`, `onClick={() => onTogglePinned(!todo.isPinned)}`, content `<PinIcon />` and `t("home.item.pin")`. Row order: checkbox, name, tag badge, pin, delete.
- `src/shared/ui/icons.tsx`: `PinIcon()`, a pushpin on the shared `iconProps`.
- `src/shared/ui/Button.tsx` and `Button.module.css`: the `variant` union gains `"subtle"`. `.subtle`: the `ghost` geometry (auto height, small padding, `0.86em`, transparent, no shadow, 15px icon), `color: var(--text-muted)`; on hover and when `[aria-pressed="true"]`: `color: var(--accent-soft-text); background: var(--accent-soft)`. Comment: a neutral row action (pin), quiet until hovered or pressed.
- `src/shared/ui/List.tsx` and `List.module.css`: `ListItem` gains `isPinned?: boolean` (default `false`), adding an `isPinned` class beside `isDone`; `.item.isPinned` marks the row's leading edge with `var(--accent)`, its width derived from `var(--border-width)`: skin variables only, no literal color or shadow.
- `src/shared/lib/i18n.ts`: `"home.item.pin": "Épingler"`.

## Conventions

- `api/CLAUDE.md`: the title becomes "the todo-app API: todos (list, create, complete, pin, delete)". Rationale: the title names what the API does.
- `web/CLAUDE.md`: the title becomes "the todo-app front: the home page lists, adds, completes, pins, filters and deletes todos". Rationale: same.
- `CLAUDE.md` (root): the first line becomes "create, list, complete, pin, filter and delete todos from the home page". Rationale: same.

## Tests

### api

Through the `write-api-tests` stack skill, on `createTestContext()`, factories from `test/factories.ts`.

- Existing expectations that compare a whole todo (`toEqual` on a response or a row) gain `isPinned: false`; their names stay, except the service test below.
- `test/todos/todos.service.test.ts`:
  - "creates the todo not completed, at the clock's time" becomes "creates the todo not completed and not pinned, at the clock's time" and asserts `isPinned: false` (FR-02)
  - it pins a todo, then unpins it
  - it keeps a pinned todo pinned when marking it completed, then back to not completed (BR-05)
  - it throws NotFoundError when pinning an unknown todo
- `test/todos/todos.routes.test.ts`, a new `describe("PATCH /v1/todos/{id}/pin")`, every write read back through `db`:
  - pins a todo, then unpins it
  - returns 404 when the todo does not exist
  - returns 400 when the id is not a positive integer or `isPinned` is missing
- Integration tests: none (the component declares no `integration_tests`).

### web

None: `web/CLAUDE.md` forbids front tests. The browser test of the Validation covers the change, starting from three todos "A", "B", "C" created in that order (so "C" is the newest):

1. Pin "A": it moves to the top, its row marked, its pin button pressed; "C" then "B" follow (FR-01, FR-03, FR-12).
2. Pin "B" too: "B" then "A" on top, newest first among the pinned, then "C" (FR-01).
3. Mark "B" completed: it stays pinned, on top, struck through (BR-05).
4. Switch "Non terminées d'abord" on: "A" then "B" (pinned, not completed first), then "C"; switch it off: "B", "A", "C" (FR-05).
5. Search "C": only "C" stays; search "A": only "A", still marked pinned (the filters apply to pinned todos).
6. Unpin "A": it goes back to its date order, "B", "C", "A"; reload the page: "B" is still pinned (the pin is stored, FR-12).

## Progress

### Stage 1 — api
Commit: `feat(home): api — pin and unpin a todo`
- [x] db: `isPinned` column, migration `add_todo_is_pinned`
- [x] services: `isPinned` in `todoSchema` and the repository columns, `setPinned`, `setTodoPinned`, `buildTodo` default, service tests
- [x] routes: `setTodoPinnedBodySchema`, `PATCH /v1/todos/{id}/pin` registered and routed, route tests, existing expectations updated
- [x] Conventions: `api/CLAUDE.md` and root `CLAUDE.md` titles
- [x] Handoff: `api/openapi.json` exported, `Todo.isPinned` required, the new path referencing `Todo` and `ProblemDetails`

### Stage 2 — web
Commit: `feat(home): web — pinned todos at the top of the list`
- [x] Prepare: client regenerated from `api/openapi.json`
- [x] data: `useSetTodoPinnedMutation`, pinned-first order in `selectVisibleTodos`
- [x] pages: `HomePage` wires the pin mutation, its pending ids and its error
- [x] ui: pin button in `TodoItem`, `TodoList` props, `PinIcon`, `subtle` button variant, `ListItem` `isPinned`, `home.item.pin`
- [x] Conventions: `web/CLAUDE.md` title

## Validation

- [ ] Review: the `reviewer` agent on the plan's implementation, its findings settled
- [x] Tests: the full `test` command of `api` green on the plan's final code
- [x] Browser test: the change tested in `web` (`test-in-browser` skill), the scenarios of Tests › web
