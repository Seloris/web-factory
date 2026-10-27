# Home

Route: `/` · Domain: `todo`

Someone juggling small tasks needs one place to note them, find them again and clear them out. The home page lists the todos, adds them, marks them completed, pins, schedules, finds and deletes them.

## Header

- **FR-13** — Next to the page title, once the list has loaded, the home page shows how many todos are not completed (« 3 à faire », « 0 à faire » when none), counting every todo whatever the search text or tag filter, and updating at once when a todo is added, completed, reopened or deleted, so that the person sees what is left at a glance.

## Add form

- **FR-02** — The person adds a todo with a name and, optionally, a tag (`todo` BR-01 to BR-04); the new todo starts not completed and not pinned, and appears in the list at once.
- **FR-11** — When adding a todo, the tag is typed freely and the field suggests the existing tags, so that the person reuses a tag instead of creating a near-duplicate.
- **FR-14** — When adding a todo, the person may give it a due date, a calendar day without a time of day (`todo` BR-07); a todo added without one has no due date.

## Filters

- **FR-05** — A sort-by-state toggle, off when the page opens, puts the todos not completed first within the pinned todos and within the others, so that completed todos, of less interest, move down while the pinned ones stay on top; within each state the newest comes first, and switching it off restores the order of FR-01.
- **FR-06** — A search field filters the list as the person types, keeping the todos whose name contains the text, ignoring case.
- **FR-07** — A tag dropdown filters the list to the todos carrying the chosen tag; it offers every tag carried by at least one todo, plus a choice showing all todos.
- **FR-08** — When both the search text and a tag are set, the list keeps only the todos matching both.

## List

- **FR-01** — The home page lists every todo, the pinned todos first, then the others; newest first within each group.
- **FR-03** — Each todo in the list shows its name, its tag when it has one, its state (completed or not) and whether it is pinned.
- **FR-16** — Each todo with a due date shows it in the list, as day, month and year (« 24/10/2026 »); a todo without one shows no date.
- **FR-17** — A todo not completed whose due date has passed (`todo` BR-06) is shown as late (« en retard ») in the list; it stops being shown late as soon as it is marked completed or its due date is moved to today or later or cleared, so that the person sees at a glance what is overdue.
- **FR-10** — An empty list shows a message inviting the person to add a first todo; a search or tag filter matching nothing shows a message saying no todo matches.

## Actions on a todo

- **FR-04** — The person marks a todo completed, or back to not completed, from the list.
- **FR-12** — The person pins a todo, or unpins it, from the list, so that the todos that matter stay at the top of a long list; every visitor sees the same pinned todos (`todo` BR-05).
- **FR-15** — The person sets, changes or clears a todo's due date from the list, so that a deadline learned later is recorded without deleting and adding the todo again.
- **FR-09** — Deleting a todo first opens a confirmation alert naming it; confirming deletes it for good, cancelling keeps it unchanged.

## Non-goals

- Editing a todo's name or tag after creation: delete it and add it again.
- Sorting or filtering by due date, or a filter on late todos: the list keeps the order of FR-01 and FR-05.
