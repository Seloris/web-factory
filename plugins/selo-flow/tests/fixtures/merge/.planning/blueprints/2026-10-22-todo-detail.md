# A page per todo, to rename it and change its tag

Pages: `todo-detail` (new, `Route: /todos/:id`), `home` · Domain: `todo` · Components: `api`, `web`

## Spec delta
- todo-detail + FR-01 — The page shows one todo: its name, its tag when it has one, its state, whether it is pinned, its due date and the late mark, as the home list shows them (`home` FR-03, FR-16, FR-17).
- todo-detail + FR-02 — The person renames the todo and changes or clears its tag in one form (`todo` BR-01 to BR-04); saving keeps every other field, and the home list shows the change when they go back.
- todo-detail + FR-03 — The tag field suggests the existing tags, as on the home page (`home` FR-11).
- todo-detail + FR-04 — A link leads back to the home page.
- todo-detail + FR-05 — A todo that does not exist (deleted, wrong address) shows « Ce todo n'existe pas » and the link back.
- todo-detail + Non-goal: « Completing, pinning, scheduling or deleting a todo from this page: those actions stay on the home page. »
- home + FR-18 — The name of each todo in the list opens its page (`todo-detail`).
- home - Non-goal: « Editing a todo's name or tag after creation: delete it and add it again. »
- todo ~ BR-03 — « … a tag typed with another casing than an existing tag is that same tag and takes the existing tag's casing (`Urgent` and `urgent` are one tag). » → « … a tag typed with another casing than a tag carried by another todo is that same tag and takes that tag's casing (`Urgent` and `urgent` are one tag); a todo is never compared with itself, so the only todo carrying a tag may change its casing. »

## Business decisions
- Inline editing in the list, or a page? → A page: the row already holds four actions, and the page is where later fields (notes) will go.
- Does the page also complete, pin, schedule or delete? → No, the home page keeps those actions; the page shows the state and edits name and tag only.
- When is the edit saved? → On « Enregistrer », with an « Annuler » that restores the saved values; an invalid name blocks the save with a message.

### Decided during build
- Editing the tag of the only todo carrying it, with another casing (`groceries` → `Groceries`): does BR-03 keep the old casing? → No, the typed casing is stored; BR-03 matches against the other todos only (a tag exists only through the todos that carry it, so otherwise its casing could never be fixed).

## Technical defaults
- Read one todo → `GET /v1/todos/{id}`, 200 or 404.
- Edit → `PATCH /v1/todos/{id}/details` with `{ name, tag }`, twin of the pin route (`PATCH /v1/todos/{id}` stays the completion route).

### Decided during build
- Details body: may `tag` be left out? → No, both fields are required, `tag` nullable; empty or blank clears it like `null` (BR-04) (the form always sends what it shows; a missing field meaning "keep" would hide client bugs).
- An address whose id the API refuses (`/todos/abc`, `/todos/0`, beyond the 32-bit range)? → The page shows the FR-05 message without calling the API (a wrong address names no todo; the API would answer 400, not 404).
- Retries of the detail query → none on 404, TanStack's default otherwise (a missing todo stays missing; three retries would delay FR-05 by seconds).
- The page title → the todo's saved name, wrapped anywhere; state, pin, tag, due date and late mark below it as read-only text and badges (one title per page; the actions stay on the home page).
- After « Enregistrer » → the fields show the stored values (trimmed, BR-03 casing), a « Modifications enregistrées. » status is announced; « Annuler » is disabled while nothing differs from the saved values (the person sees what was kept).
- Back link and name link → a `ButtonLink` in `shared/ui/Button.tsx` (React Router `Link` with the button recipe) for the back link; the list name is a link in the row's text color, underlined (the skin has no link recipe; a native link would keep the browser's blue).
- The todo changed or deleted elsewhere while its page is open? → A refresh updates untouched fields and keeps an edit in progress; a failed refresh keeps the form; a 404 on read or save shows the FR-05 message (no typed text lost to a background refresh).
- Translation keys → `detail.*` for the new page (named after the page, as `home.*` is).

## Stages
1. api — `feat(todo-detail): api — read one todo, rename it and change its tag`
2. web — `feat(todo-detail): web — a page per todo to rename it and change its tag`

## Tests
- api: get found / 404 / invalid id 400; details: rename, change tag, clear tag, tag casing reused (BR-03), name blank or 201 chars 400, 404.
- web: none (component rule); browser: open a todo from the list, rename, change and clear the tag, cancel, blank name refused, unknown id, back link, 360px.

## Progress
- [x] Stage 1 — api
- [x] Stage 2 — web
- [x] Review
- [ ] Spec merged
