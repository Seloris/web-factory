# Home (Accueil) — PRD

> **Slug**: `home`
> **Status**: Draft
> **Last updated**: 2026-10-17

## TL;DR

Someone juggling small tasks needs one place to note them, find them again and clear them out. The home page lists the todos, adds a todo with an optional tag, marks it completed, finds todos by name or by tag, and deletes a todo after a confirmation.

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

- **FR-01** — The home page lists every todo, newest first.
- **FR-02** — The person adds a todo with a name and, optionally, a tag; the new todo starts not completed and appears in the list at once.
- **FR-03** — Each todo in the list shows its name, its tag when it has one, and its state (completed or not).
- **FR-04** — The person marks a todo completed, or back to not completed, from the list.
- **FR-05** — The person can sort the list by state, not completed first, so that completed todos, of less interest, move to the bottom; within each state the newest comes first.
- **FR-06** — A search field filters the list as the person types, keeping the todos whose name contains the text, ignoring case.
- **FR-07** — A tag dropdown filters the list to the todos carrying the chosen tag; it offers every tag carried by at least one todo, plus a choice showing all todos.
- **FR-08** — When both the search text and a tag are set, the list keeps only the todos matching both.
- **FR-09** — Deleting a todo first opens a confirmation alert naming it; confirming deletes it for good, cancelling keeps it unchanged.
- **FR-10** — An empty list shows a message inviting the person to add a first todo; a search or tag filter matching nothing shows a message saying no todo matches.

## Business Rules

- **BR-01** — A todo's name is required, trimmed of surrounding spaces, and holds 1 to 200 characters; two todos may share the same name.
- **BR-02** — A todo carries at most one tag; a tag is trimmed of surrounding spaces and holds 1 to 30 characters.

## UX Flow

- The person opens the home page: the form to add a todo, the search field, the tag dropdown, the sort by state, then the list.
- They type a name, optionally a tag, and add: the todo appears in the list, not completed.
- They tick a todo to mark it completed, untick it to reopen it.
- They type in the search field and/or pick a tag: the list narrows as they go.
- They delete a todo: an alert asks for confirmation; they confirm and the todo leaves the list, or cancel and nothing changes.

## Open Questions

- **Q-01** — Is the sort by state the default order of the list, or only applied when the person asks for it?
- **Q-02** — When adding a todo, is the tag typed freely or picked among existing tags (with a new one allowed), and are `Urgent` and `urgent` the same tag?
