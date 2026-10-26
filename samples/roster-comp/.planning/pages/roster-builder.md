# Roster builder (Roster de raid)

Route: `/` · Domain: `player`, `roster`

The raid leader comes to this page to note who plays what, ranked from S to C, and to get a raid roster balanced in tanks, heals and DPS, as close as possible to everyone's wishes, with its buffs.

## Toolbar

- **FR-01** — The toolbar sets the raid, the tanks and the heals with − and + steppers, and shows the DPS as the rest (`roster` BR-01, BR-03).
- **FR-02** — « Générer le roster » generates the roster (`roster` BR-02), disabled while no sheet exists; once a roster exists it reads « Remélanger », beside the locked count and « Tout déverrouiller ».

## Sheets

- **FR-03** — The sheets list shows each pseudo in its class color and each choice as its rank, its spec's game icon and « [Classe · Spé] », with edit and delete buttons and « Ajouter un joueur », disabled at 20 sheets (`player` BR-02).
- **FR-04** — The sheet dialog edits the pseudo and the choices (rank, class, spec, its role shown), adds and removes choices, and shows a refused save's message by field (`player` BR-01).
- **FR-05** — Deleting a sheet asks first, naming the player and saying their place frees (`roster` BR-04).

## Composition

- **FR-06** — The composition shows tanks, heals and DPS with « n / m » counts; each place shows its lock, spec icon, pseudo, class and spec, rank and the choice's position in the sheet (« 1er choix »); an empty place says why; its header counts the places filled, the players on each rank and the locked players.
- **FR-07** — Each place's lock button locks or unlocks its player (`roster` BR-03).
- **FR-08** — A sheet or a placed player dragged onto a place puts that player there (`roster` BR-06): two placed players swap when each fits the other's role, an occupant displaced by a sheet leaves the roster, and a placed player dragged out of the roster frees their place.
- **FR-09** — Each sheet and each place has a « Placer » action offering the same moves by keyboard and on touch screens.
- **FR-10** — Warnings above the roles name each shortfall: a role short of players and why, empty places for want of sheets, a player left with no place.

## Buffs

- **FR-11** — The buffs recap counts the covered buffs overall and per group (raid buffs, totems and blessings, boss debuffs, utility) and lists each buff with the players giving it, or what it lacks (`roster` BR-05).

## States and layout

- **FR-12** — Each zone shows an empty state before any sheet or roster, a loading state, and on an API failure an error with « Réessayer ».
- **FR-13** — At 360 px the page is one column: composition, buffs, then sheets.

## Non-goals

- Group buffs (Devotion Aura, Mana Spring Totem, Blood Pact, Vampiric Embrace): they depend on the raid's groups, which the page does not set.
- Sign-in and several rosters: one shared roster.
