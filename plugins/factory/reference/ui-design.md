# UI design rules

What makes a front look designed, whatever its skin. Read when planning, implementing or reviewing the UI of a component that has a `skin`, together with `skins/README.md` (the token contract), `skins/recipes.css` (every element written against the tokens) and `skins/{skin}/SKIN.md`. The component's `## Design` section wins over all of them, then the skin's `SKIN.md`, then this file.

## Tokens only

- Component styles read the skin's variables: no literal color, radius, shadow, font family or control height. A value the contract lacks is a token the project adds in its `overrides.css`, named after what it is (`--sidebar-width`), not a literal repeated in two places.
- The skin's file is never edited. The project's variables go in `overrides.css`, its rules in the component's `## Design` section.
- Both color schemes work: the skin switches with `prefers-color-scheme`, so no style may assume a light background.

## Elements

- **No unstyled native control.** Inputs, selects, checkboxes, switches, buttons and dialogs follow `recipes.css`; the browser's default look is a finding.
- Every element is built once, as a shared component, and composed by the features: a feature styles its layout (grid, gaps, widths), not its buttons.
- A checkbox or a switch has a visible label, clicking the label toggles it; a toggle that is an on/off setting is a switch (`role="switch"`), a selection is a checkbox.
- Icons are inline SVG in `currentColor`, 15–16px beside text; an icon-only button has an accessible name.

## Layout and hierarchy

- One title per page, in the display face; one primary action per form, in the accent. Secondary actions are quiet or ghost buttons.
- Group by proximity: a small gap inside a group (6–12px), a large one between groups (24–32px). Align fields on their bottom edge; stack them at narrow widths.
- Content width is bounded (a panel of about 680px for a single-column page); the page keeps a side gutter of at least 16px down to 360px wide.
- Long text wraps (`overflow-wrap: anywhere` on user content), never pushes the layout wider.

## States

- **Interactive:** hover, active (pressed), focus-visible (the `--focus` ring, never removed without a replacement) and disabled, on every control.
- **Data:** loading, error and empty are designed states, not leftovers: the empty state says what to do next (`No todos yet. Add the first one above.`), the error state says what failed and offers a retry when one makes sense.
- **Done items** stay readable: muted and struck through, not hidden or faded out.
- Destructive actions confirm in a dialog that names the object; the confirm button is `--danger`.
- Motion is short (120–150ms) and respects `prefers-reduced-motion`.

## Fonts

The skin's `SKIN.md` names its faces and weights. Load only those weights, keep the fallback stack of the tokens, and use `font-display: swap`. How they load (a stylesheet link, self-hosted files, a package) is the stack's choice: the stack pack's font table when it has one (`factory-init` installs the skin's row and switches it with the skin), else decided in the plan.
