# Todo

What holds for a todo on every page: its terms and its rules. Pages cite these `BR` ids, never restate them.

## Glossary

| Business term | Identifier | Business meaning |
|---|---|---|
| `Todo` | `Todo` | A task the person wants to remember, completed or not |
| `Tag` | `Tag` | A free label put on a todo to group it with others on the same subject |
| `Échéance` | `dueDate` | The calendar day by which a todo should be completed, optional |
| `En retard` | `overdue` | Said of a todo not completed whose due date has passed |

## Business rules

- **BR-01** — A todo's name is required, trimmed of surrounding spaces, and holds 1 to 200 characters; two todos may share the same name.
- **BR-02** — A todo carries at most one tag; a tag is trimmed of surrounding spaces and holds 1 to 30 characters.
- **BR-03** — Tags are compared ignoring case: a tag typed with another casing than an existing tag is that same tag and takes the existing tag's casing (`Urgent` and `urgent` are one tag).
- **BR-04** — A tag left empty or made only of spaces means the todo has no tag; it is not an error.
- **BR-05** — Pinning is independent of the state: a pinned todo stays pinned when it is marked completed or back to not completed, until the person unpins it. Any number of todos may be pinned.
- **BR-06** — A due date has passed when it is before today, today being the calendar day on the person's device: a todo due today is not late, it becomes late the next day.
- **BR-07** — A due date may be any day, past days included, at creation or when changed; a todo not completed given a past due date is late at once.

## Non-goals

- Editing a todo's name or tag after creation: delete it and add it again.
- Several tags on one todo.
- Managing tags on their own (rename, delete): a tag only exists through the todos that carry it.
- A time of day on a due date, reminders or notifications: a todo is late or not, nothing warns the person outside the list.
- Accounts and private lists: the application has no sign-in, so every visitor sees and changes the same todos.
