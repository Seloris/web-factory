# Home (Accueil) — PRD

> **Slug**: `home`
> **Status**: Approved
> **Last updated**: 2026-10-19

## TL;DR

Someone juggling small tasks needs one place to note them, find them again and clear them out. The home page lists the todos, adds a todo with an optional tag and an optional due date, shows the todos left past their due date as late, marks it completed, pins the ones to keep in view at the top, finds todos by name or by tag, and deletes a todo after a confirmation.

## Problem

Tasks noted on paper or scattered across apps get lost: you cannot tell what is still open, you cannot pull out every task about one subject, and finished tasks bury the ones left to do; a task with a deadline slips past it unnoticed. A single list with a state, a tag, a due date and a search answers all four.

## Non-goals

- Editing a todo's name or tag after creation: delete it and add it again.
- Several tags on one todo.
- Managing tags on their own (rename, delete): a tag only exists through the todos that carry it.
- A time of day on a due date, reminders or notifications: a todo is late or not, nothing warns the person outside the list.
- Sorting or filtering by due date, or a filter on late todos: the list keeps the order of FR-01 and FR-05.
- Accounts and private lists: the application has no sign-in, so every visitor sees and changes the same todos.

## Domain Glossary

| Business term | Identifier | Business meaning | Status |
|---|---|---|---|
| `Todo` | `Todo` | A task the person wants to remember, completed or not | New |
| `Tag` | `Tag` | A free label put on a todo to group it with others on the same subject | New |
| `Échéance` | `dueDate` | The calendar day by which a todo should be completed, optional | New |
| `En retard` | `overdue` | Said of a todo not completed whose due date has passed | New |

## Functional Requirements

- **FR-01** — The home page lists every todo, the pinned todos first, then the others; newest first within each group.
- **FR-02** — The person adds a todo with a name and, optionally, a tag; the new todo starts not completed and not pinned, and appears in the list at once.
- **FR-03** — Each todo in the list shows its name, its tag when it has one, its state (completed or not) and whether it is pinned.
- **FR-04** — The person marks a todo completed, or back to not completed, from the list.
- **FR-05** — A sort-by-state toggle, off when the page opens, puts the todos not completed first within the pinned todos and within the others, so that completed todos, of less interest, move down while the pinned ones stay on top; within each state the newest comes first, and switching it off restores the order of FR-01.
- **FR-06** — A search field filters the list as the person types, keeping the todos whose name contains the text, ignoring case.
- **FR-07** — A tag dropdown filters the list to the todos carrying the chosen tag; it offers every tag carried by at least one todo, plus a choice showing all todos.
- **FR-08** — When both the search text and a tag are set, the list keeps only the todos matching both.
- **FR-09** — Deleting a todo first opens a confirmation alert naming it; confirming deletes it for good, cancelling keeps it unchanged.
- **FR-10** — An empty list shows a message inviting the person to add a first todo; a search or tag filter matching nothing shows a message saying no todo matches.
- **FR-11** — When adding a todo, the tag is typed freely and the field suggests the existing tags, so that the person reuses a tag instead of creating a near-duplicate.
- **FR-12** — The person pins a todo, or unpins it, from the list, so that the todos that matter stay at the top of a long list; every visitor sees the same pinned todos.
- **FR-13** — Next to the page title, once the list has loaded, the home page shows how many todos are not completed (« 3 à faire », « 0 à faire » when none), counting every todo whatever the search text or tag filter, and updating at once when a todo is added, completed, reopened or deleted, so that the person sees what is left at a glance.
- **FR-14** — When adding a todo, the person may give it a due date, a calendar day without a time of day; a todo added without one has no due date.
- **FR-15** — The person sets, changes or clears a todo's due date from the list, so that a deadline learned later is recorded without deleting and adding the todo again.
- **FR-16** — Each todo with a due date shows it in the list, as day, month and year (« 24/10/2026 »); a todo without one shows no date.
- **FR-17** — A todo not completed whose due date has passed is shown as late (« en retard ») in the list; it stops being shown late as soon as it is marked completed or its due date is moved to today or later or cleared, so that the person sees at a glance what is overdue.

## Business Rules

- **BR-01** — A todo's name is required, trimmed of surrounding spaces, and holds 1 to 200 characters; two todos may share the same name.
- **BR-02** — A todo carries at most one tag; a tag is trimmed of surrounding spaces and holds 1 to 30 characters.
- **BR-03** — Tags are compared ignoring case: a tag typed with another casing than an existing tag is that same tag and takes the existing tag's casing (`Urgent` and `urgent` are one tag).
- **BR-04** — A tag left empty or made only of spaces means the todo has no tag; it is not an error.
- **BR-05** — Pinning is independent of the state: a pinned todo stays pinned when it is marked completed or back to not completed, until the person unpins it. Any number of todos may be pinned.
- **BR-06** — A due date has passed when it is before today, today being the calendar day on the person's device: a todo due today is not late, it becomes late the next day.
- **BR-07** — A due date may be any day, past days included, at creation or when changed; a todo not completed given a past due date is late at once.

## UX Flow

- The person opens the home page: the form to add a todo, the search field, the tag dropdown, the sort by state, then the list.
- They type a name, optionally a tag (the field suggests the existing ones) and a due date, and add: the todo appears in the list, not completed, with its due date when it has one.
- They set, change or clear a todo's due date from the list; a todo not completed past its due date shows « en retard ».
- They tick a todo to mark it completed, untick it to reopen it.
- They pin a todo: it moves to the top of the list, above the todos not pinned; they unpin it and it goes back to its place.
- They type in the search field and/or pick a tag: the list narrows as they go.
- They delete a todo: an alert asks for confirmation; they confirm and the todo leaves the list, or cancel and nothing changes.
