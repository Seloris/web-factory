# Roster

What holds for the raid roster on every page: its terms and its rules. Pages cite these `BR` ids, never restate them.

## Glossary

| Business term | Identifier | Business meaning |
|---|---|---|
| `Roster` | `Roster` | The one shared raid composition and the players placed in it |
| `Composition` | `Roster` (raid, tanks, heals) | The raid and how many tanks and heals it takes; the DPS are the rest |
| `Place` | `RosterPlacement` | A player in the roster, on one of their choices |
| `Verrouillé` | `IsLocked` | Said of a placed player whom generation never moves |
| `Buff` | `Buff` | A bonus a class or spec brings to the raid, or a debuff on the boss |

## Business rules

- **BR-01** — The composition is a raid of the catalogue (its size, at most 20) and a number of tanks and of heals whose sum never exceeds that size; the DPS are the rest.
- **BR-02** — Generation places each sheet at most once, on one of its choices whose role has a free place: first the most places filled, then the most S choices, then A, then B; at random between equal solutions.
- **BR-03** — A locked player keeps their place and spec through every generation; the tanks or heals count never goes below the locked players of that role, nor the DPS places below the locked DPS.
- **BR-04** — A change of composition regenerates the roster, locks kept (before any roster, it is only saved); a deleted sheet frees its place; an edited sheet keeps its place while its placed choice still exists, else frees it.
- **BR-05** — A buff is covered when the roster holds a player able to give it (the catalogue of the mockup's plates 1–2); a paladin gives one blessing among Kings, Might and Wisdom (Salvation aside), a shaman one air totem, a warlock one curse; Windfury Totem goes to an enhancement shaman first and excludes Flametongue Totem.
- **BR-06** — A player placed by hand takes their best-ranked choice of that place's role and is locked; a place whose role has none of their choices refuses them; dropped on a placed player, the two swap, both locked, when the occupant fits the role left, else the occupant leaves the roster.
