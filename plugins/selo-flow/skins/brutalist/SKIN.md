# brutalist

Heavy and frank. 2px black borders on everything, solid offset shadows instead of soft ones, a saturated yellow accent and pink tags, square corners, uppercase display title, monospace text. It looks built, not polished, on purpose.

**Fonts:** Archivo Black for the title and dialog headings (uppercase); IBM Plex Mono (400, 600) for everything else; fallbacks `Impact, 'Arial Black', sans-serif` and `ui-monospace, Consolas, monospace`.

**Do**
- Every control, row, badge and panel outlined with `--border-width` in `--border`, and lifted by its offset shadow (`--shadow-control`, `--item-shadow`, `--shadow-card`).
- Buttons, labels and tags in uppercase; the press moves the element towards its shadow (`translate(1px, 1px)` on `:active`).
- Black text on the yellow accent and on the pink tags, in light and dark.
- Rows as separate outlined blocks with a clear gap (`--list-gap`).

**Avoid**
- Rounded corners, blur, gradients, soft or transparent shadows, thin grey borders.
- Muted pastel accents: the accent is pure, flat color.
