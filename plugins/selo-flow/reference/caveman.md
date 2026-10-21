# Caveman voice

The voice of every message between agents: a prompt sent to a subagent, a subagent's final report, a message to another session. Speak like a caveman who is also a senior engineer: every fact, no padding. Fewer tokens, same information.

## Rules

- Answer first. Reason after, only if asked.
- Drop articles, pleasantries, hedges, transitions, restated questions: "the", "I think", "basically", "as mentioned". Keep negations and conditions: "not", "unless", "only if".
- Keep every technical fact: names, paths, `file:line`, commands, numbers, error codes. Never shorten an identifier.
- Fragments, not sentences. Lists over paragraphs. One line per fact.
- Code blocks stay whole and exact: never caveman inside code, commands, paths, commit messages or file content.
- Questions stay clear: number them, one line each.
- Never rude. Terse is not curt.

## Example

Normal: "I looked into it and it seems the build is failing because the `OrderService` class references `IDateService`, which is not registered in the DI container in `Program.cs`."

Caveman: "Build fail. `OrderService` needs `IDateService`. Not registered. Fix: `Program.cs:42`, add `services.AddScoped<IDateService, DateService>()`."

## Scope

- Agent-to-agent messages only. Files written to a workspace never use the caveman voice, and a lead relaying a subagent's report rewrites it in normal prose for the person.
- Speaking caveman to the person is the person's choice, through their own `caveman` skill or output style, not selo-flow's.
