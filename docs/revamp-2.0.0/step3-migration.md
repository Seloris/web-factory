# selo 2.0 — `setup update` played on the sample (step 3, 2026-10-22)

`/selo:setup update` (the "From 1.0" steps of `plugins/selo/skills/setup/SKILL.md`) was played by hand, step by step from the skill text, on a throwaway copy of `samples/todo-app` (its tracked files at `aedf619`, no `node_modules`). The sample itself stays in 1.0 shape on `feat/revamp` (proposal §8, round 6). Expected result: proposal §7, and for the specs the prototype's `pages/home.md` and `domain/todo.md` of `6e40a30` (branch `proto/blueprint-v2`).

| §7 step | Result on the copy |
|---|---|
| 1. Manifest | `selo-flow.yaml` → `selo.yaml`, `selo:` key. |
| 2. Areas | One area, `home`, the route `/` → `pages/home.md`. |
| 3. Shared rules | Glossary, BR-01…BR-07 and four entity Non-goals → `domain/todo.md`; `home` cites them (FR-02, FR-12, FR-14, FR-17). |
| 4. Template | `domain/todo.md` identical to the prototype's; `pages/home.md` differs by its intro sentence only (zones, FR order, ids, texts, Non-goals identical). `spec-check` clean on both. |
| 5. Plans | Four done plans → `blueprints/2026-10-17-home.md`, `2026-10-17-brutalist-skin.md`, `2026-10-19-pin-todo.md`, `2026-10-21-due-date.md`, each with one `Legacy:` line; `features/` and its `.gitkeep` gone. |
| 6. `(planned)` | None in the sample. |
| 7. Instruction files | Tagged blocks rewritten with `selo:` tags; the glossary line and `docs/CONTRIBUTING.md`'s 1.0 sections replaced. |
| 8. Ports | `web`: `url` → `port: 5173`; `api`: `serve_url` → `port: 3000`. Resolved urls unchanged. |
| 9. Pack commands | `api`: `demo` added (`src/demo.ts`, an empty `src/seed/demo.ts` from the pack, the `demo` script, `demo_port: 3101`). `web`: added on the round's yes: its `vite.config.ts` (no demo mode) replaced by the pack's mode-aware proxy, the `demo` script, `demo_port: 5181`. The resolved manifest gives both demo urls. |

Fixed in the skill from this run: the plugin's old name in prose (`the selo-flow plugin`, `selo-flow init`) was not covered by the renames; text outside the tags still word for word the 1.0 template's is now replaced without a question; a pack command whose backing changes an existing file (the web demo) is shown in the round and added on a yes instead of being left out (§7 step 9 names this case); a `Legacy:` blueprint is refused by `build` and named in `reference/rules.md`.

Not checked: the grouped question round and the `reviewer` comparison of step 4 (the answers were the recommended ones, the comparison done by reading); the `api` and `web` build and test with the added demo files (the copy has no `node_modules`; the files are the pack's skeleton, whose imports match the sample's `app.ts`, `db/client.ts` and `shared/clock.ts`). The play was done by the session that wrote the skill, not by a fresh one.
