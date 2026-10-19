# Home (Accueil) — PRD

> **Slug**: `home`
> **Status**: Approved
> **Last updated**: 2026-10-19

## TL;DR

Someone juggling small tasks needs one place to note them, find them again and clear them out. The home page lists the todos, adds a todo with an optional tag, marks it completed, pins the ones to keep in view at the top, finds todos by name or by tag, and deletes a todo after a confirmation.

## Problem

Tasks noted on paper or scattered across apps get lost: you cannot tell what is still open, you cannot pull out every task about one subject, and finished tasks bury the ones left to do. A single list with a state, a tag and a search answers all three.

## Non-goals

- Editing a todo's name or tag after creation: delete it and add it again.
- Several tags on one todo.
- Managing tags on their own (rename, delete): a tag only exists through the todos that carry it.
- Accounts and private lists: the application has no sign-in, so every visitor sees and changes the same todos.

## Domain Glossary

| Business term | Identifier | Business meaning | Status |
|---|---|---|---|
| `Todo` | `Todo` | A task the person wants to remember, completed or not | New |
| `Tag` | `Tag` | A free label put on a todo to group it with others on the same subject | New |

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

## Business Rules

- **BR-01** — A todo's name is required, trimmed of surrounding spaces, and holds 1 to 200 characters; two todos may share the same name.
- **BR-02** — A todo carries at most one tag; a tag is trimmed of surrounding spaces and holds 1 to 30 characters.
- **BR-03** — Tags are compared ignoring case: a tag typed with another casing than an existing tag is that same tag and takes the existing tag's casing (`Urgent` and `urgent` are one tag).
- **BR-04** — A tag left empty or made only of spaces means the todo has no tag; it is not an error.
- **BR-05** — Pinning is independent of the state: a pinned todo stays pinned when it is marked completed or back to not completed, until the person unpins it. Any number of todos may be pinned.

## UX Flow

- The person opens the home page: the form to add a todo, the search field, the tag dropdown, the sort by state, then the list.
- They type a name, optionally a tag (the field suggests the existing ones), and add: the todo appears in the list, not completed.
- They tick a todo to mark it completed, untick it to reopen it.
- They pin a todo: it moves to the top of the list, above the todos not pinned; they unpin it and it goes back to its place.
- They type in the search field and/or pick a tag: the list narrows as they go.
- They delete a todo: an alert asks for confirmation; they confirm and the todo leaves the list, or cancel and nothing changes.
