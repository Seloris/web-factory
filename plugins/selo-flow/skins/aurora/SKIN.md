# aurora

Glow and glass. A dark page lit by soft teal, green and violet glows, translucent surfaces with a backdrop blur, a mint accent. Designed dark first; the light mode keeps the glows in pastel.

**Fonts:** Outfit (400–600); fallback `ui-sans-serif, system-ui, sans-serif`.

**Do**
- The background image (`--bg-image`) on the page, fixed; surfaces translucent over it with `--blur`.
- Large radii, thin translucent borders, an inner top highlight on panels (in `--shadow-card`).
- The mint accent for the primary action and the checked state only.

**Avoid**
- Opaque cards that hide the glows, more than three glows, saturated text colors.
- Blur on many small elements: keep it to the panel and the dialog.
