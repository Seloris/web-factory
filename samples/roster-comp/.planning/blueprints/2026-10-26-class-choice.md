# Class choice on placement

Pages: `roster-builder` · Domain: `roster` · Components: `api`, `web`

## Spec delta
- roster ~ BR-06 — « A player placed by hand takes their best-ranked choice of that place's role and is locked; … » → « A player placed by hand takes the choice of that place's role picked for them, their best-ranked one when none is picked, and is locked; a place whose role has none of their choices refuses them, as does a picked choice that is not one of theirs for that role; dropped on a placed player, the two swap, both locked, when the occupant fits the role left, on their best-ranked choice of it, else the occupant leaves the roster. »
- roster-builder + FR-14 — Placing a player on a place, by drag and drop, « Placer » or « Remplir », asks which of their choices of that place's role they play (rank, spec icon, « [Classe · Spé] », best-ranked first) when they have several, and places them at once when they have one (`roster` BR-06).
- roster-builder ~ FR-09 — « Each sheet and each place has a « Placer » action offering the same moves by keyboard and on touch screens. » → « Each sheet and each place has a « Placer » action offering the same moves by keyboard. »
- roster-builder - FR-13 — « At 360 px the page is one column: composition, buffs, then sheets. »
- roster-builder + FR-15 — On a desktop screen the sheets fill the left column and the composition the right one, the buffs recap right below it, so the roster and its buffs show together.
- roster-builder + Non-goal: « Phones and touch screens: the page is laid out and used on a desktop screen only. »

## Business decisions
- How is the class picked on a drop? → a menu of the player's choices of that place's role when they have several; one choice places at once (no click for nothing).
- On a swap, which class does the displaced occupant play? → their best-ranked choice of the role they receive, no second menu (they can be dragged again).
- Do « Placer » and « Remplir » offer the choice too? → yes, the same menu after the place is picked (one rule everywhere).
- Where do the buffs go? → right column, under the composition; the mobile layout is dropped (desktop only).

## Technical defaults
- The place command takes an optional chosen spec; absent, the best-ranked choice of the role (current clients keep working).
- A chosen spec that is not one of the player's choices for that role is refused as a domain error (422), like a role with no choice.
- The class menu is one small dialog shared by the drop, « Placer » and « Remplir », built from the house dialog.

### Decided during build
- Code of a picked spec refused → `spec_not_chosen` (stable snake_case, like `role_not_chosen`).

## Stages
1. api — `feat(class-choice): api — place a player on a chosen spec`
2. web — `feat(class-choice): web — class menu on placement, buffs under the composition`

## Tests
- api: placed on a chosen spec of the role; no spec given takes the best-ranked one; a spec not among their choices of the role refused; a swap's occupant takes their best-ranked choice of the role left.
- web: the drop with several choices of the role opens the menu and places on the one picked; with one choice it places at once; cancelling the menu places nobody.
- browser: at 1440 px, drag a sheet with two heal choices onto a heal place, pick the second, see it placed with that spec and the buffs updated below the composition; « Placer » by keyboard offers the same menu.

## Progress
- [x] Stage 1 — api
- [ ] Stage 2 — web
- [ ] Review
- [ ] Browser test
- [ ] Spec merged
