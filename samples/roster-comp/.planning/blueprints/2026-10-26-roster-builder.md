# Roster builder

Pages: `roster-builder` (new, `Route: /`) · Domain: `player` (new), `roster` (new) · Components: `api`, `web`

## Spec delta
- player + BR-01 — A sheet has a pseudo of 24 characters at most, unique whatever its case, and at least one choice; a choice is a class, one of its specs and a rank S, A, B or C; several choices may share a rank; a sheet never holds the same spec twice.
- player + BR-02 — At most 20 sheets exist; a 21st is refused.
- player + BR-03 — Each spec has one role (tank, heal or DPS) and its game icon, from the catalogue of the mockup's plate 8 (9 classes, 28 specs).
- roster + BR-01 — The composition is a raid of the catalogue (its size, at most 20) and a number of tanks and of heals whose sum never exceeds that size; the DPS are the rest.
- roster + BR-02 — Generation places each sheet at most once, on one of its choices whose role has a free place: first the most places filled, then the most S choices, then A, then B; at random between equal solutions.
- roster + BR-03 — A locked player keeps their place and spec through every generation; the tanks or heals count never goes below the locked players of that role, nor the DPS places below the locked DPS.
- roster + BR-04 — A change of composition regenerates the roster, locks kept (before any roster, it is only saved); a deleted sheet frees its place; an edited sheet keeps its place while its placed choice still exists, else frees it.
- roster + BR-05 — A buff is covered when the roster holds a player able to give it (the catalogue of the mockup's plates 1–2); a paladin gives one blessing among Kings, Might and Wisdom (Salvation aside), a shaman one air totem, a warlock one curse; Windfury Totem goes to an enhancement shaman first and excludes Flametongue Totem.
- roster + BR-06 — A player placed by hand takes their best-ranked choice of that place's role and is locked; a place whose role has none of their choices refuses them; dropped on a placed player, the two swap, both locked, when the occupant fits the role left, else the occupant leaves the roster.
- roster-builder + FR-01 — The toolbar sets the raid, the tanks and the heals with − and + steppers, and shows the DPS as the rest (`roster` BR-01, BR-03).
- roster-builder + FR-02 — « Générer le roster » generates the roster (`roster` BR-02), disabled while no sheet exists; once a roster exists it reads « Remélanger », beside the locked count and « Tout déverrouiller ».
- roster-builder + FR-03 — The sheets list shows each pseudo in its class color and each choice as its rank, its spec's game icon and « [Classe · Spé] », with edit and delete buttons and « Ajouter un joueur », disabled at 20 sheets (`player` BR-02).
- roster-builder + FR-04 — The sheet dialog edits the pseudo and the choices (rank, class, spec, its role shown), adds and removes choices, and shows a refused save's message by field (`player` BR-01).
- roster-builder + FR-05 — Deleting a sheet asks first, naming the player and saying their place frees (`roster` BR-04).
- roster-builder + FR-06 — The composition shows tanks, heals and DPS with « n / m » counts; each place shows its lock, spec icon, pseudo, class and spec, rank and the choice's position in the sheet (« 1er choix »); an empty place says why; its header counts the places filled, the players on each rank and the locked players.
- roster-builder + FR-07 — Each place's lock button locks or unlocks its player (`roster` BR-03).
- roster-builder + FR-08 — A sheet or a placed player dragged onto a place puts that player there (`roster` BR-06): two placed players swap when each fits the other's role, an occupant displaced by a sheet leaves the roster, and a placed player dragged out of the roster frees their place.
- roster-builder + FR-09 — Each sheet and each place has a « Placer » action offering the same moves by keyboard and on touch screens.
- roster-builder + FR-10 — Warnings above the roles name each shortfall: a role short of players and why, empty places for want of sheets, a player left with no place.
- roster-builder + FR-11 — The buffs recap counts the covered buffs overall and per group (raid buffs, totems and blessings, boss debuffs, utility) and lists each buff with the players giving it, or what it lacks (`roster` BR-05).
- roster-builder + FR-12 — Each zone shows an empty state before any sheet or roster, a loading state, and on an API failure an error with « Réessayer ».
- roster-builder + FR-13 — At 360 px the page is one column: composition, buffs, then sheets.
- roster-builder + Non-goal: « Group buffs (Devotion Aura, Mana Spring Totem, Blood Pact, Vampiric Embrace): they depend on the raid's groups, which the page does not set. »
- roster-builder + Non-goal: « Sign-in and several rosters: one shared roster. »

## Mockup
[The page in 7 plates, desktop and 360 px, with the 28 spec icons](../mockups/2026-10-26-roster-builder.html)

## Business decisions
- Fill the composition or maximize S first? → fill first, then S, A, B (plate 2: a place stays empty only when no sheet fits it).
- More sheets than places? → at most 20 sheets, no bench.
- The roster after a change? → targeted recalculation, locks kept (`roster` BR-04); a player left with no place gets a warning naming them, no new zone.
- A player placed by hand? → locked at once; a role with none of their choices refuses the drop (`roster` BR-06). The mockup does not draw the drag and drop.
- The game's icons? → loaded from Wowhead's CDN: no Blizzard art in the repository.

### Decided during build
- A placed player dropped on an occupant who does not fit the role they leave? → the occupant leaves the roster, as one displaced by a sheet (the move is never refused for the occupant's sake).
- The occupant of a swap? → locked too (both were moved by hand; a reshuffle would otherwise undo half the swap).
- Flametongue Totem? → given by any shaman, and lacking « exclu par Totem Furie-des-vents » while Windfury is covered; not a third air totem as plate 1's wording suggests (its weapon enchant and Windfury's overwrite each other).
- Givers the plates leave unclear? → Judgement of the Crusader: a protection or retribution paladin; Demoralizing Shout and Thunder Clap: a protection warrior; Faerie Fire: a balance or feral druid; Blessing of Salvation: any paladin, outside the one-blessing pool (Kings, Might, Wisdom), as both plates show; Windfury goes to an enhancement shaman first.
- A sheet's pseudo color? → the class of its first choice (a sheet may hold several classes).
- « Placer », which the mockup does not draw? → a dialog listing, for each role of the sheet's choices, « Une place {rôle} libre » and « Remplacer {pseudo} » per occupant, plus « Sortir du roster » for a placed player (the same moves as the drag and drop).
- Dragging a placed player out of the roster? → dragged from their place onto the sheets frame, they leave the roster; a sheet dropped back on the list does nothing.
- « Placer » on an empty place (FR-09)? → a dialog listing the sheets with a choice of its role, those left out first; the chosen one takes the place.
- A sheet created after generation, or taken out by hand? → left out, named by the warning « … n’a aucune place » until a reshuffle or a move.
- The buffs frame while the page loads or fails? → absent, as on plates 5–6; the sheets and the composition carry the loading and error states.
- An empty place after moves by hand, which a sheet left out could fill? → « Place libre — à pourvoir » and the warning « 1 place tank libre. », not « aucune fiche restante… », which only holds when no sheet left out has the role.
- A buff's note? → the givers' specs for a spec-bound buff (« · Précision »), and a pool's rule once, on its first covered buff (the plates put it on various buffs).
- A lacking buff? → « Exclu par {buff} », « Il faut un {n}e {Classe} » (its pool's players all taken), « Il faut un {Classe} {Spé} », or « Il faut un {Classe} ».
- The toolbar while the page loads or fails? → shown once the roster and the catalogue are loaded (plates 5–6 draw it with defaults; the front hardcodes no raid).
- The buffs recap? → its own frame under both columns, with its empty state before any roster (plate 4 draws it inside the composition's frame).

## Technical defaults
- Storage → the sheets, the composition and the one roster in SQLite; no sign-in, said once in `Program.cs`.
- Catalogue → classes, specs (role, icon name), raids and buffs as API code data served by one endpoint; the front hardcodes none; one raid for now, « Sommet d'Hyjal — 20 joueurs ».
- Generation and buffs recap → computed by the API, returned with the roster.
- Generation → an exact assignment (Hungarian, sheets × places) with lexicographic weights; ties broken by an injected random source, like `TimeProvider`, so tests pin it.
- Icons → `https://wow.zamimg.com/images/wow/icons/medium/{icon}.jpg`; one that fails to load shows the class color and the spec's initial (offline demo).
- Drag and drop → the browser's native drag and drop, no new dependency; touch and keyboard go through « Placer » (FR-09). Each move is one API call that returns the roster.
- Demo → `DemoSeeder` holds plate 1's 20 sheets.

### Decided during build
- Catalogue names → French display names served as API data, ids in English (`warrior-protection`); the front's own words stay in its i18n.
- Spec icons → 28 Wowhead names, each checked to answer 200 (priest Discipline `spell_holy_powerwordshield`, priest Holy `spell_holy_guardianspirit`).
- Pseudo uniqueness → a stored key (trimmed, upper-invariant) with a unique index (SQLite folds ASCII only, so « Séraphine » and « SÉRAPHINE » would both pass).
- `player` BR-01 split → the validator answers 400 by field (pseudo required and at most 24 characters, at least one choice, a known spec, a rank S to C); the handler answers 409 `pseudo_taken`, 422 `duplicate_spec`, 422 `too_many_players` (BR-02).
- Default composition → Hyjal, 2 tanks, 4 heals (plate 4); a composition change before any roster is saved, nothing generated.
- Stepper floor → DPS too: 422 `below_locked_players` when tanks or heals go below their locked players, or leave fewer DPS places than locked DPS; 422 `composition_too_large` past the raid's size.
- Places → ordered by sheet; no place index stored: a drop on an empty place takes a free place of its role. A placement before any generation marks the roster generated.
- Ties → a random noise below one rank step added to each weight (exact order kept, ties random); `Random.Shared` injected, a seeded one in the tests.
- Endpoints → `GET /catalogue`; `/players` GET, POST, PUT, DELETE (204); `/roster` GET, `PUT /composition`, `POST /generate`, `POST /placements` (`playerId`, `role`, `targetPlayerId` of the occupant), `DELETE /placements/{playerId}`, `PUT /placements/{playerId}/lock`, `POST /unlock-all`, each answering the whole roster with its buffs recap.
- Warnings and empty-place reasons → computed by the front from the counts, the sheets and the unplaced ids; a lacking pool buff carries the count of its class it needs, an excluded one the buff excluding it.
- Body font → Marcellus (`@fontsource/marcellus` 5.3.0, the version of Cinzel), imported by `overrides.css`.
- `core/ui` hooks → Button reads optional `--btn-*` variables and Field `--label-color` / `--label-shadow`, each falling back to the skin, so the WoW look stays in `overrides.css`; `core/ui` gains `Dialog`, a native `<dialog>` with projected content, for the sheet form and « Placer ».
- Moves → a drop while a move is in flight is ignored and rows are not draggable then (two answers could land out of order); a `not_found` refusal reads the sheets and the roster again.
- Loading → core `LoadingState` text, no progress bar (the API reports no progress).
- OpenAPI → schema ids take the use case's name (`SavePlayerCommand`, nested types otherwise collided) and numbers are strict (they were typed `integer | string`).

## Stages
1. api — `feat(roster-builder): api — sheets, catalogue, roster generation, manual placement, locks and buffs`
2. web — `feat(roster-builder): web — the roster builder page`

## Tests
- api: sheet create, edit, delete and each `player` BR refusal (duplicate pseudo, same spec twice, no choice, 21st sheet); generation fills first then S (plate 2's case), reshuffle keeps locks, stepper floor, composition change regenerates, delete and edit free a place, unplaced player; manual placement (best choice of the role, locked, refused off-choice, swap, displaced occupant, freed place); buff counting (one blessing per paladin, Windfury excludes Flametongue).
- web: none (no unit tests on the front, `web/CLAUDE.md`).
- browser: on the demo at 1280 and 360 px against plates 1–7: generate, lock two, reshuffle keeps them, edit and delete a sheet, drag a sheet onto a place and swap two players, « Placer » at 360 px, warnings with 15 sheets, empty, loading and error states.

## Progress
- [x] Stage 1 — api
- [x] Stage 2 — web
- [x] Review
- [x] Browser test
- [x] Spec merged
