# Counter

What holds for the counter on every page: its terms and its rules. Pages cite these `BR` ids, never restate them.

## Glossary

| Business term | Identifier | Business meaning |
|---|---|---|
| `compteur` | `counter` | One shared number that signed-in users increment. |

## Business rules

- **BR-01** — The counter never goes below zero.
- **BR-02** — An anonymous user can neither read nor increment the counter.

## Functional requirements

- **FR-01** — The API exposes the counter's value and an increment operation.
