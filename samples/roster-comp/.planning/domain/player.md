# Player

What holds for a player's sheet on every page: its terms and its rules. Pages cite these `BR` ids, never restate them.

## Glossary

| Business term | Identifier | Business meaning |
|---|---|---|
| `Fiche` | `Player` | A player of the raid: their pseudo and the specs they would play, ranked |
| `Pseudo` | `Pseudo` | The player's in-game name |
| `Choix` | `PlayerChoice` | A spec the player would play, with its rank |
| `Rang` | `Rank` | How much the player wants a choice, from S (most) to C (least) |
| `Classe`, `Spé` | `GameClass`, `Spec` | A class of the game and one of its specializations |
| `Rôle` | `Role` | What a spec does in the raid: tank, heal or DPS |

## Business rules

- **BR-01** — A sheet has a pseudo of 24 characters at most, unique whatever its case, and at least one choice; a choice is a class, one of its specs and a rank S, A, B or C; several choices may share a rank; a sheet never holds the same spec twice.
- **BR-02** — At most 20 sheets exist; a 21st is refused.
- **BR-03** — Each spec has one role (tank, heal or DPS) and its game icon, from the catalogue of the mockup's plate 8 (9 classes, 28 specs).
