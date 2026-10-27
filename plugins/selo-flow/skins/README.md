# Skins

A skin is the look of a front component: a set of CSS variables and the guidance to use them. Stack-agnostic: plain CSS and Markdown, applied by whatever framework the component uses.

```
skins/
  README.md                 this file: the token contract
  recipes.css               every element (field, button, switch, checkbox, list row, badge, dialog…) written once against the tokens
  {skin}/
    tokens.css              the skin's values for every token of the contract, light and dark (prefers-color-scheme)
    SKIN.md                 its intent, fonts, and what the tokens alone do not say
```

| Skin | Look | For |
|---|---|---|
| `modern` (default) | white surfaces, soft shadows, plenty of air, one indigo accent | most applications |
| `editorial` | paper and ink: italic serif title, hairline rules instead of cards, no shadow, wine accent | content, reading tools |
| `brutalist` | 2px black borders, solid offset shadows, saturated yellow and pink, square corners, monospace text | personal projects, internal tools that own it |
| `aurora` | glowing gradient background, translucent blurred surfaces, mint accent; designed dark first | dashboards, creative applications |
| `swiss` | black, white and one red; a large tight title, uppercase spaced labels, strict grid, no cards | portfolios, showcase sites, sober tools |
| `soft` | rounded, pastel, large touch targets (48px), friendly | consumer and mobile applications |
| `pro` | dense and neutral: 32px controls, rows instead of cards, small title | back-offices, data tables |

## How a project uses a skin

1. The front component's ```` ```component ```` block names it: `skin: brutalist`. `setup` asks for it (recommended: `modern`) and `/selo-flow:setup skin {component} {skin}` switches it.
2. `setup` copies `{skin}/tokens.css` into the component, at the path its stack pack names (react-express: `src/shared/ui/theme/skin.css`), and creates the component's `overrides.css` beside it when absent. The application imports the skin first, then its overrides. The copied file is never edited: switching skins rewrites it. When the stack pack self-hosts fonts, it maps each skin to its font packages and imports (react-express: a font table, written into `src/shared/ui/theme/fonts.ts`), and `setup` installs the skin's fonts with its tokens; otherwise the project's first design plan decides how they load.
3. The project overrides at two levels, both its own: **variables** in `overrides.css` (`:root { --accent: #e5484d; }`, and a `prefers-color-scheme: dark` block for a dark-only value), and **rules** in the `## Design` section of the component's `CLAUDE.md`, which wins over the skin's `SKIN.md` and over `reference/ui-design.md`.
4. Planning, implementing and reviewing the component's UI read `reference/ui-design.md`, this file, `recipes.css` and `{skin}/SKIN.md` from the plugin (as a pack's stack skills are read in place), then the component's `## Design` section.

## The token contract

Every skin defines every variable below, so that switching skins is replacing one file. Component styles read these variables only: a literal color, radius, shadow or font family in a component's style is a convention finding.

| Group | Variables | Meaning |
|---|---|---|
| Color | `--bg`, `--bg-image` | page background; an optional image layered on it (`none`, or gradients) |
| | `--surface`, `--surface-2` | raised surfaces (panel, dialog, rows); a quieter fill (switch track, quiet button) |
| | `--border` | hairlines and outlines |
| | `--text`, `--text-muted` | body text; secondary text, labels, placeholders |
| | `--accent`, `--accent-text` | the one action color; text on it |
| | `--accent-soft`, `--accent-soft-text` | the badge (tag) fill and its text, derived from the accent unless the skin sets them |
| | `--danger`, `--danger-soft`, `--danger-text` | destructive actions and errors; their quiet fill; text on `--danger` |
| | `--focus` | the focus ring |
| | `--control-bg`, `--control-border`, `--control-border-on` | inputs, checkboxes and switches: fill, border, border when checked |
| | `--pop-bg`, `--scrim` | the dialog's surface; the backdrop behind it |
| Type | `--font-sans`, `--font-display`, `--font-size` | body face, title face, base size |
| | `--title-size`, `--title-weight`, `--title-tracking`, `--title-transform`, `--title-style` | the page title |
| | `--label-size`, `--label-weight`, `--label-transform`, `--label-tracking` | field labels |
| Shape | `--radius`, `--radius-control`, `--radius-pill` | panels and dialogs; controls and buttons; pills |
| | `--check-radius`, `--switch-radius`, `--badge-radius` | checkbox, switch, badge |
| | `--border-width`, `--control-h` | every outline's width; the height of inputs and buttons |
| Depth | `--shadow-card`, `--shadow-control`, `--shadow-pop`, `--blur` | panel, controls, dialog; a `backdrop-filter` for translucent skins (`none` otherwise) |
| Panel | `--panel-bg`, `--panel-border`, `--panel-pad` | the page's main surface; `transparent`, `0`, `0` for skins without cards (`editorial`, `swiss`) |
| List | `--list-gap`, `--list-rule`, `--item-pad`, `--item-bg`, `--item-border`, `--item-rule`, `--item-radius`, `--item-shadow` | rows as cards (a gap, a border) or as ruled lines (no gap, a bottom rule, a strong top rule) |
| Badge | `--badge-border`, `--badge-transform`, `--badge-tracking` | the tag's outline and lettering |
| Button | `--btn-border`, `--btn-weight`, `--btn-transform`, `--btn-tracking` | the buttons' outline and lettering |

`tests/skins.test.mjs` checks that every `tokens.css` declares the same variables as `modern/tokens.css`, in light and in dark.

## Adding a skin

Useful to two projects or more, as every plugin change: a project first tunes its `overrides.css`; a look worth sharing becomes a skin. Copy `modern/`, change the values (keep every variable), write its `SKIN.md` (intent, fonts with their fallback stacks, what to do and avoid), add its row above, and run the plugin's tests.
