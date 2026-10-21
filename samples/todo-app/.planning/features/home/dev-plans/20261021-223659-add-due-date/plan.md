# Optional due date and late todos

Feature: `home` · Components: `api`, `web` · Spec: FR-14, FR-15, FR-16, FR-17, BR-06, BR-07

## Business decisions

- How does the person set, change or clear a due date from the list (FR-15)? → An « Échéance » button on each row opens an editor inside the row: a date field prefilled with the current due date, « Enregistrer », « Retirer » (only when the todo has a due date) and « Annuler » (an explicit editor keeps a half-typed date from saving, and gives clearing a visible action).
- How is a late todo shown (FR-17)? → A badge « En retard » in the danger color, right after the due date, which stays shown (a colored badge reads at a glance and matches the tag badges; the date says by how much).
- Who decides that a due date has passed (BR-06)? → The browser, from the device's calendar day; the API stores only the day and sends no `isOverdue` field (BR-06 names the person's device, which the API does not know).
- How is the due date shown in a row (FR-16)? → As « 24/10/2026 » in muted text with a calendar icon, after the tag badge; the form's and the editor's date fields use the browser's date picker, whose display follows the browser's locale.
- Does the due date change anything else on the page? → No: the order (FR-01, FR-05), the search, the tag filter and the remaining count (FR-13) ignore it, as the spec's non-goals say; no spec delta beyond FR-14..FR-17, BR-06 and BR-07.

## Technical defaults

- Storage? → A nullable `due_date` column of type `date`, Drizzle `date({ mode: "string" })`; existing todos get `null` (a calendar day without time, read and written as `YYYY-MM-DD`, no timezone shift).
- Contract format? → `dueDate` is a `YYYY-MM-DD` string (`z.iso.date()`, which rejects days that do not exist such as `2026-02-30`) or `null`; `Todo.dueDate` is required and nullable; `POST /v1/todos` takes it optional (`nullish`) (FR-14: the field may be left out).
- Year 0000? → Rejected by a refinement (`>= "0001-01-01"`): PostgreSQL has no year 0, and the value would reach the database and fail as a 500, as the id bound comment says for ids.
- Route for FR-15? → A dedicated `PATCH /v1/todos/{id}/due-date` with `{ dueDate: string | null }` (the key required, `null` clears), `200` todo, `400`, `404`: the twin of the pin route, so the completion and pin contracts stay as they are.
- Past days? → Accepted at creation and on change, no check in the service (BR-07).
- Date handling in the browser? → Strings only: `formatDay("2026-10-24")` splits the string into « 24/10/2026 », `localDay(date)` builds `YYYY-MM-DD` from the local year, month and day; lateness is a string comparison `dueDate < today` (ISO days sort as strings); no `Date` parsing of a due date (no UTC shift).
- When is « today » read? → At each render of `HomePage`, `localDay(new Date())`; no midnight timer: TanStack Query refetches on window focus, which re-renders the page (a page left open across midnight updates on the next focus or action).
- The date field? → A shared `DateInput` (`type="date"`) on the text input's recipe, plus `color-scheme` from the skin's scheme so the native picker icon reads in dark mode (no unstyled native control).
- The editor's state? → `TodoDueDateForm` (the Forms convention) holds the typed value, its own saving flag and its own generic error; `HomePage` passes `mutateAsync` so the form closes only on success; a failure shows `common.error.generic` inside the editor, the editor stays open.
- The late badge? → `Badge` gains `tone?: "accent" | "danger"` (default `"accent"`); `danger` reads `--danger` and `--danger-text`: skin variables only.
- Row layout? → Checkbox, name, tag badge, due date, late badge, then the « Échéance », pin and delete buttons; the open editor takes a full line under them (`flex-basis: 100%`), the row's existing wrap rule handles narrow widths.
- Accessibility? → The date in a `<time dateTime="2026-10-24">`; the editor's field labelled « Échéance de « {name} » »; the « Échéance » button has `aria-expanded`.

## Context

A todo has no deadline today: the person cannot note when a task is due, nor see which tasks slipped past it. This iteration adds an optional due date, a calendar day: set when adding a todo (FR-14), set, changed or cleared from the list (FR-15), shown in the row (FR-16), and a todo not completed past its due date is marked late (FR-17, BR-06, BR-07). The API stores the day on the todo, accepts it at creation and gets a route to change it; the front adds the date field to the form, an editor on each row, the date and the late badge.

## api

### db

- `src/features/todos/todos.table.ts`: add `dueDate: date({ mode: "string" })` (nullable, no default) after `isPinned`; import `date` from `drizzle-orm/pg-core`.
- Migration through the `drizzle-migrations` stack skill: `npm run db:generate -- --name add_todo_due_date` (generates `drizzle/0002_add_todo_due_date.sql`, an `add column "due_date" date`), then `npm run db:migrate` with the API stopped. The generated files are committed as generated.

### services

- `src/features/todos/todos.schema.ts`:
  - `dueDateSchema = z.iso.date().refine((day) => day >= "0001-01-01")`, with a comment: PostgreSQL has no year 0, the value would fail as a 500.
  - `todoSchema` gains `dueDate: z.iso.date().nullable()` after `isPinned` (the `Todo` type follows).
- `src/features/todos/todos.repository.ts`:
  - `todoColumns` gains `dueDate: todos.dueDate`.
  - `insert(row)`: `row` gains `dueDate: string | null`.
  - `setDueDate(id: number, dueDate: string | null): Promise<Todo | null>`: same shape as `setPinned`.
- `src/features/todos/todos.service.ts`:
  - `createTodo(input)`: `input` gains `dueDate?: string | null | undefined`; passes `dueDate: input.dueDate ?? null` to `insert` (FR-14). No check against the clock (BR-07).
  - `setTodoDueDate(id: number, dueDate: string | null): Promise<Todo>`: throws `NotFoundError("Todo", id)` when the repository returns `null` (FR-15).
- `test/factories.ts`: `buildTodo` gains `dueDate: null` in its defaults.

### routes

- `src/features/todos/todos.schema.ts`:
  - `createTodoBodySchema` gains `dueDate: dueDateSchema.nullish()`.
  - `setTodoDueDateBodySchema = z.object({ dueDate: dueDateSchema.nullable() })`.
  - Register `PATCH /v1/todos/{id}/due-date`, summary "Set, change or clear a todo's due date": `request.params` `todoIdParamsSchema`, body `setTodoDueDateBodySchema` (required); responses `200` todo, `400` "The id or the body is invalid", `404` "The todo does not exist", problems as `application/problem+json`.
- `src/features/todos/todos.routes.ts`: `const setDueDateSchemas = { params: todoIdParamsSchema, body: setTodoDueDateBodySchema }`; `router.patch("/v1/todos/:id/due-date", validate(setDueDateSchemas), …)`: `inputOf`, `service.setTodoDueDate(params.id, body.dueDate)`, `200` with the todo. The `POST` handler passes `body` as today (it now carries `dueDate`).
- Handoff: `npx tsx scripts/export-openapi.ts openapi.json` rewrites `api/openapi.json`, committed with the stage. Check that `components.schemas.Todo` lists `dueDate` as required, nullable, `format: date`, that the `POST` body has an optional `dueDate`, and that the new path's responses `$ref` `Todo` and `ProblemDetails`.

## web

### data

- `src/shared/lib/dates.ts` (new):
  - `localDay(date: Date): string`: `YYYY-MM-DD` from `getFullYear()`, `getMonth() + 1`, `getDate()`, zero-padded (the device's calendar day, BR-06).
  - `formatDay(day: string): string`: `"2026-10-24"` → `"24/10/2026"` by splitting the string (FR-16).
- `src/features/todos/data/selectTodos.ts`: `isOverdue(todo: Todo, today: string): boolean` = `!todo.isCompleted && todo.dueDate !== null && todo.dueDate < today`, with a comment: ISO days compare as strings; a todo due today is not late (BR-06, FR-17).
- `src/features/todos/data/useCreateTodoMutation.ts`: variables gain `dueDate: string | null`.
- `src/features/todos/data/useSetTodoDueDateMutation.ts`, the twin of `useSetTodoPinnedMutation.ts` without the exported key: `export type SetTodoDueDateVariables = { id: number; dueDate: string | null }`, `api.PATCH("/v1/todos/{id}/due-date", { params: { path: { id } }, body: { dueDate } })`, throws `toProblem(error, response)` when the response is not ok, invalidates `todoKeys.all` on success.

### pages

- `src/features/todos/pages/HomePage.tsx`:
  - `const setTodoDueDate = useSetTodoDueDateMutation()`.
  - `const today = localDay(new Date())`, beside `visible`.
  - `TodoList` gets `today` and `onSetDueDate={(todo, dueDate) => setTodoDueDate.mutateAsync({ id: todo.id, dueDate }).then(() => undefined)}`.
  - `TodoForm`'s `onSubmit` passes the values through unchanged (they now carry `dueDate`).

### ui

- `src/shared/ui/DateInput.tsx` and `DateInput.module.css` (new): `DateInput(props: Omit<ComponentProps<"input">, "className" | "type">)` renders `<input type="date">` with the text input's recipe (same rules as `TextInput.module.css`: height, border, shadow, focus ring, `aria-invalid`), plus `color-scheme: light dark` so the picker icon follows the scheme. Skin variables only.
- `src/shared/ui/Badge.tsx` and `Badge.module.css`: `tone?: "accent" | "danger"` (default `"accent"`), the class `styles[tone]` beside `.badge`; `.accent` holds today's colors, `.danger { color: var(--danger-text); background: var(--danger); }`.
- `src/shared/ui/icons.tsx`: `CalendarIcon()`, a calendar on the shared `iconProps`.
- `src/features/todos/ui/TodoForm.tsx`:
  - `values` gain `dueDate: string | null`; state `dueDate` (`""`), sent as `dueDate === "" ? null : dueDate`, reset to `""` after a successful submit (FR-14).
  - A third field, `Field label={t("home.form.dueDate")}` with `DateInput name="dueDate"`, in a `.dueDate` wrapper (`flex: 1 1 160px; min-width: 0` in `TodoForm.module.css`), between the tag and the submit button.
  - `dueDateError = problem?.errors?.["body.dueDate"] ? t("home.form.dueDateInvalid") : null`; `otherError` also excludes `body.dueDate`.
- `src/features/todos/ui/TodoDueDateForm.tsx` and `TodoDueDateForm.module.css` (new): props `todoName: string`, `dueDate: string | null`, `onSubmit(dueDate: string | null): Promise<void>`, `onClose(): void`.
  - State: `value` (initialised to `dueDate ?? ""`), `isSaving`, `hasFailed`.
  - A `<form noValidate>` wrapping in a row (`display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px; flex-basis: 100%`): `Field label={t("home.dueDate.label", { name: todoName })}` with `DateInput`; `Button variant="primary" type="submit"` « Enregistrer »; when `dueDate !== null`, `Button variant="quiet"` « Retirer » submitting `null`; `Button variant="subtle"` « Annuler » calling `onClose`. Every button disabled while `isSaving`.
  - Submit: `value === ""` → `null`; `isSaving` on, `await onSubmit(...)`, then `onClose()`; on rejection `hasFailed` on, `isSaving` off, `ErrorMessage` with `common.error.generic` under the buttons.
  - Escape in the form calls `onClose` when not saving.
- `src/features/todos/ui/TodoItem.tsx` and a new `TodoItem.module.css`:
  - Props gain `today: string` and `onSetDueDate(dueDate: string | null): Promise<void>`; local state `isEditingDueDate`.
  - After the tag badge: when `todo.dueDate !== null`, `<span className={styles.dueDate}><CalendarIcon /><time dateTime={todo.dueDate}>{formatDay(todo.dueDate)}</time></span>` (`.dueDate`: `display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); font-size: 0.86em; white-space: nowrap`); then, when `isOverdue(todo, today)`, `<Badge tone="danger">{t("home.item.overdue")}</Badge>` (FR-16, FR-17). `isOverdue` and `formatDay` are pure functions of the props: no data hook in the UI.
  - Before the pin button: `Button variant="subtle"` with `aria-expanded={isEditingDueDate}`, `onClick` toggling the editor, content `<CalendarIcon />` and `t("home.item.dueDate")`.
  - When `isEditingDueDate`: `<TodoDueDateForm todoName={todo.name} dueDate={todo.dueDate} onSubmit={onSetDueDate} onClose={() => setIsEditingDueDate(false)} />` as the row's last child.
- `src/features/todos/ui/TodoList.tsx`: props gain `today: string` and `onSetDueDate(todo: Todo, dueDate: string | null): Promise<void>`; passes `today` and `onSetDueDate={(dueDate) => onSetDueDate(todo, dueDate)}` to each `TodoItem`.
- `src/shared/lib/i18n.ts`:
  - `"home.form.dueDate": "Échéance (optionnelle)"`
  - `"home.form.dueDateInvalid": "La date d'échéance est invalide."`
  - `"home.item.dueDate": "Échéance"`
  - `"home.item.overdue": "En retard"`
  - `"home.dueDate.label": "Échéance de « {name} »"`
  - `"home.dueDate.save": "Enregistrer"`
  - `"home.dueDate.clear": "Retirer"`
  - `"home.dueDate.cancel": "Annuler"`

## Conventions

- `api/CLAUDE.md`: the title becomes "the todo-app API: todos (list, create, complete, pin, set a due date, delete)". Rationale: the title names what the API does.
- `web/CLAUDE.md`: the title becomes "the todo-app front: the home page lists, adds, completes, pins, schedules, filters and deletes todos". Rationale: same.
- `CLAUDE.md` (root): the first line becomes "create, list, complete, pin, schedule, filter and delete todos from the home page". Rationale: same.

## Tests

### api

Through the `write-api-tests` stack skill, on `createTestContext()`, factories from `test/factories.ts`.

- Existing expectations that compare a whole todo (`toEqual` on a response or a row) gain `dueDate: null`; their names stay, except the service test below.
- `test/todos/todos.service.test.ts`:
  - "creates the todo not completed and not pinned, at the clock's time" becomes "creates the todo not completed, not pinned and without a due date, at the clock's time" and asserts `dueDate: null` (FR-14)
  - it creates a todo with a due date, stored as the exact day `"2026-10-24"` (read back through `db`: the column returns the string, no timezone shift) (FR-14)
  - it creates a todo due before the clock's day (BR-07)
  - it sets a todo's due date, changes it, then clears it (FR-15)
  - it keeps the due date when marking the todo completed or pinning it
  - it throws NotFoundError when setting the due date of an unknown todo
- `test/todos/todos.routes.test.ts`:
  - `POST /v1/todos`: returns 201 with the due date given; returns 201 with `dueDate: null` when it is left out; accepts a past due date (BR-07); returns 400 with a `body.dueDate` error when it is `"24/10/2026"`, `"2026-02-30"` or `"0000-01-01"`.
  - A new `describe("PATCH /v1/todos/{id}/due-date")`, every write read back through `db`:
    - sets a due date, changes it, then clears it with `null` (FR-15)
    - returns 404 when the todo does not exist
    - returns 400 when the id is not a positive integer, `dueDate` is missing or `dueDate` is not a calendar day
- Integration tests: none (the component declares no `integration_tests`).

### web

None: `web/CLAUDE.md` forbids front tests. The browser test of the Validation covers the change; « hier », « aujourd'hui » and « demain » are the device's days at the time of the test:

1. Add "A" with no due date: no date, no late badge in its row (FR-14, FR-16). The form's date field is empty again after the add.
2. Add "B" due yesterday: its row shows yesterday as « JJ/MM/AAAA » and « En retard » at once (BR-07, FR-16, FR-17).
3. Add "C" due today: its date shows, no late badge (BR-06).
4. Mark "B" completed: the late badge goes, the date stays; mark it not completed: the badge comes back (FR-17).
5. Open « Échéance » on "B", pick tomorrow, « Enregistrer »: the editor closes, the late badge goes (FR-15, FR-17).
6. Open « Échéance » on "A", set a date, save; open it again, « Retirer »: "A" shows no date; « Annuler » on an open editor changes nothing (FR-15).
7. Reload the page: every due date is still there (stored by the API).
8. Narrow the window to 360px: the row wraps, the open editor stays inside the panel, no horizontal scroll.

## Progress

### Stage 1 — api
Commit: `feat(home): api — optional due date on a todo`
- [x] db: `dueDate` column, migration `add_todo_due_date`
- [x] services: `dueDateSchema`, `dueDate` in `todoSchema` and the repository columns, `insert` with `dueDate`, `setDueDate`, `createTodo` with `dueDate`, `setTodoDueDate`, `buildTodo` default, service tests
- [x] routes: `createTodoBodySchema.dueDate`, `setTodoDueDateBodySchema`, `PATCH /v1/todos/{id}/due-date` registered and routed, route tests, existing expectations updated
- [x] Conventions: `api/CLAUDE.md` and root `CLAUDE.md` titles
- [x] Handoff: `api/openapi.json` exported, `Todo.dueDate` required, nullable, `format: date`, the new path referencing `Todo` and `ProblemDetails`

### Stage 2 — web
Commit: `feat(home): web — due dates and late todos in the list`
- [ ] Prepare: client regenerated from `api/openapi.json`
- [ ] data: `localDay` and `formatDay`, `isOverdue`, `dueDate` in `useCreateTodoMutation`, `useSetTodoDueDateMutation`
- [ ] pages: `HomePage` passes `today` and wires the due-date mutation
- [ ] ui: `DateInput`, `Badge` tone, `CalendarIcon`, the date field of `TodoForm`, `TodoDueDateForm`, the date, late badge and « Échéance » button of `TodoItem`, `TodoList` props, i18n keys
- [ ] Conventions: `web/CLAUDE.md` title

## Validation

- [ ] Review: the `reviewer` agent on the plan's implementation, its findings settled
- [ ] Tests: the full `test` command of `api` green on the plan's final code
- [ ] Browser test: the change tested in `web` (`test-in-browser` skill), the scenarios of Tests › web
