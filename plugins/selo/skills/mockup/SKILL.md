---
name: mockup
description: "Mock up a change of a front before any code: one static, self-contained HTML file under .planning/mockups/, drawn with the front's skin (its tokens and recipes inlined), one plate per state and width; shown as an Artifact when the session can publish one, else in the browser pane; iterated with the person until they validate it, then marked validated in the file (a selo:mockup meta), never committed here: the lane that builds it (--mockup {file} on fastlane, blueprint or pilot) commits it with its work. Use when the person wants to see a change before it is coded, asks for a mockup, a maquette, a sketch of a screen, or to compare layouts."
argument-hint: "{request} | revise {file}: {changes}"
---

# Mockup first

A change of a front, seen and approved before any code. Writes one file, `.planning/mockups/{YYYY}-{MM}-{DD}-{name}.html`; never code, never a spec, never a commit. The lane that builds the change (`/selo:fastlane {request} --mockup {file}`, `/selo:blueprint {request} --mockup {file}`, or `/selo:pilot {request} --mockup {file}`, which picks one) commits the file with its work and compares the result with it in its browser test.

Read `${CLAUDE_PLUGIN_ROOT}/reference/rules.md` first, then the manifest, then the front's design: `reference/ui-design.md`, `skins/README.md`, `skins/recipes.css`, `skins/{skin}/SKIN.md`, `skins/{skin}/tokens.css`, and the `## Design` section of the component's `CLAUDE.md` (it wins).

## Input

`/selo:mockup {request}`, or `/selo:mockup revise {file}: {changes}` to resume one (go to step 5). Never in autonomous mode: it needs the person's eye.

## Procedure

1. **Context.** The front: the component the request names, else the only one with a `url`; ask when several have one. With no `skin`: draw with `modern`'s tokens and say so. Read the specs of the pages touched (`.planning/pages/`, `.planning/domain/` for the glossary) and their code; a broad sweep goes to an `Explore` subagent. A page that exists: start the front as `try` step 2 says, take a screenshot of the page at each width the mockup shows, stop what you started (`try` step 5). Facts are looked up, never asked.
2. **Name it.** Kebab-case, short, about the result (`due-date`); the date from `node ${CLAUDE_PLUGIN_ROOT}/scripts/timestamp.mjs`.
3. **Draw** the file in one pass:
   - **Head:** `<head>` opens with the charset meta, the viewport meta and the `<title>`, before the `<style>`: the validated mark goes right after the `<title>` (step 6) and must sit in the file's first 8 KB.
   - **Self-contained:** the skin's `tokens.css`, then `recipes.css`, then the component's `overrides.css` when it has one, copied into one `<style>`; no link to a local file, no script, no external resource except the skin's fonts from Google Fonts when `SKIN.md` names Google faces. The file renders the same in the browser pane, as an Artifact, or opened alone.
   - **Plates:** one `<section>` per state the change shows (filled, empty, loading, error, a dialog open) and per width (360 px and the desktop width the component's `CLAUDE.md` names, else 1280 px), each titled in `language.chat` with what it shows. Elements from `recipes.css` with its class names, the rules of `ui-design.md`; a look the application adds beyond the recipes (a row's pinned border, a button variant) is copied from the component's own styles, with its token names; a part of the page the change does not touch is copied as the screenshot shows it, so only the change stands out.
   - **Content:** realistic data in the application's language, its terms from the glossary; never lorem ipsum.
4. **Show it.** Publish it as an Artifact when the session has the Artifact tool (private; each iteration republishes the same file, same URL), else open it in the browser pane. The skin is the design: an artifact design guidance never restyles the mockup; it may add what the Artifact needs around it (a `<title>`, the viewport meta, the skin's dark values repeated under the theme selector the Artifact uses). Two layouts in doubt: both as plates of the same file, or side by side in an inline widget, for the person to pick. Say in a few lines what differs from the page today, the states drawn, and the behaviour questions the drawing raised (a rule, a new data): they go to the lane, the spec is not touched here.
5. **Iterate** with targeted `Edit`s, then show it again. A mockup that carries the validated mark (`revise {file}`, or a change asked after step 6) loses it first: remove the `selo:mockup` meta before the first edit. Each turn ends the same way: the turn's last line is the question `Autre chose, ou on valide ?` (in `language.chat`, bare, ending with `?`: Selo Ops reads it as a question), its `Status:` line right above it (the rules' **End of turn**), never a footer; a next-step box may carry the same question, the line stays in the text. A plate that drifts from the skin (a colour, a size outside the tokens) is fixed, never kept.
6. **Validated** (the person says so): write the validated mark, the rules' **Mockup first**: `<meta name="selo:mockup" content="validated">` on the line right after the `<title>`, never earlier in the loop. The file stays uncommitted, so the lane runs in this checkout (a lane in another worktree does not find it). End with the done footer, its recap line and one `Next:` line: `pilot` picks the lane (the rules' **The next steps**), never ` --autonomous` since a mockup is drawn with the person: ``Next: {Build it, the browser test compared with the mockup, in language.chat} · `/selo:pilot {request} --mockup .planning/mockups/{file}` ``. Dropped: delete the file and say so.

## Rules

- A mockup is a drawing, not a spec: no FR or BR is written from it; the lane writes the spec delta.
- Never edit the application's code or styles to draw the mockup.
