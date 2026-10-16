# Home to-do list (Liste de tâches de l'accueil) — PRD

> **Slug**: `home`
> **Status**: Draft
> **Last updated**: 2026-10-17

## TL;DR

A person who keeps a short list of things to do has nowhere to write them down in this application yet. The home page shows their to-dos, lets them add one and remove one. It is the first and only feature of the sample, so it also brings the application into existence.

## Problem

Opening the application today shows nothing. A person wants to jot down a to-do in one gesture and see it on the home page the next time they open the application, then get rid of it once it is done or no longer matters.

## Non-goals

- Accounts and sign-in: the list is shared by whoever opens the application (a sample with one user).
- Marking a to-do as done, editing its title, due dates, ordering by hand: removing a to-do is the only way it leaves the list.
- Several lists or categories.

## Domain Glossary

Canonical entity names introduced or reused. Names only: no properties, relationships or persistence.

| Business term | Identifier | Business meaning | Status |
|---|---|---|---|
| `Tâche` | `Todo` | One thing the person wants to do, identified by its title | New |

## Functional Requirements

- **FR-01** — The home page lists every `Todo`, newest first, so that what was just added is seen first.
- **FR-02** — The home page lets the person add a `Todo` by typing its title and confirming, and the new `Todo` appears in the list without reloading the page.
- **FR-03** — Each listed `Todo` has a delete action that removes it from the list without reloading the page.
- **FR-04** — A `Todo` survives a reload of the page and a restart of the application, so that the list is the person's memory, not the browser's.
- **FR-05** — When the list is empty, the home page says so instead of showing a blank area.

## Business Rules

- **BR-01** — A `Todo` title is required: once trimmed of surrounding spaces, it has between 1 and 200 characters; the application refuses anything else and says why.
- **BR-02** — Two `Todo`s may have the same title: the person is not stopped from writing the same thing twice.
- **BR-03** — Deleting a `Todo` is immediate and final: no confirmation, no undo.

## UX Flow

- The person opens the application: the home page shows the list of `Todo`s (or the empty message, FR-05) and, above it, a field to type a title with an add button.
- They type a title and confirm (button or Enter): the `Todo` appears at the top of the list, the field is cleared and focused again.
- A refused title (BR-01) keeps the field as typed and shows the reason beside it.
- Each `Todo` shows its title and a delete button; one click removes it from the list.
