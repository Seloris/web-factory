# Brutalist skin on the web front: theme imports, shared/ui components, home restyled

Feature: `shared` (reserved slug, no spec) · Components: `web` · Spec: none (no business behaviour changes; the `home` spec ids stay as implemented)

## Context

The `web` component names the `brutalist` skin (`tools(tooling): web skin brutalist`): `src/shared/ui/theme/skin.css` holds its tokens and `overrides.css` is empty, but nothing loads them. `main.tsx` imports neither file, `base.css` does not exist, no font is loaded, and the `home` feature styles its own elements with literals (`system-ui`, `#b00020`, `#e0e0e0`, rounded corners, native controls). This iteration applies the skin as the plugin intends (`reference/ui-design.md`, `skins/README.md`, `skins/recipes.css`, `skins/brutalist/SKIN.md`):

- the theme chain: fonts, then `skin.css`, `base.css` and `overrides.css`, all imported by `main.tsx`;
- one `shared/ui` component per element of `recipes.css`, each with its CSS Module, reading only the token contract;
- the `home` feature recomposed on those components, its own CSS Modules reduced to layout.

What the page does stays exactly as the `home` plan built it (FR-01 to FR-11, BR-01 to BR-04). There are two visible additions: the sort-by-state toggle becomes a switch, and a failed list load offers a retry.

## Decisions

- Fonts? → Self-hosted with `@fontsource/archivo-black` (400) and `@fontsource/ibm-plex-mono` (400, 600), pinned at `5.3.0`, imported by `main.tsx` before `skin.css`. No request goes to a third party, the app works offline and the repository pins the versions. Fontsource declares `font-display: swap`, as `ui-design.md` asks. This settles the react-express pack's "how the skin's fonts load is decided by the project's first design plan".
- Buttons ask for `--btn-weight: 700`, but only 400 and 600 load? → Accepted. The browser renders the buttons on the 600 face. `SKIN.md` names only 400 and 600, and loading a 700 would break "load only those weights".
- `base.css`? → Copied as is from the pack's skeleton (`stacks/react-express/skeleton/front/src/shared/ui/theme/base.css`, the page section of `recipes.css`). `overrides.css` stays empty: the skin applies as is.
- `shared/ui` granularity? → One component per recipe: `Panel`, `PageTitle`, `Field`, `TextInput`, `SearchInput`, `Select`, `Button` (`variant`), `Switch`, `Checkbox`, `List`/`ListItem`/`ListItemText`, `Badge`, `EmptyState`, `ErrorMessage`, `icons.tsx`. `ConfirmDialog` is restyled on `Button`. A `LoadingState` is added, so that the loading text does not carry a colour in a feature module.
- Sort by state? → A `Switch` (`role="switch"`) with a clickable label, because `ui-design.md` says an on/off setting is a switch. FR-05 is unchanged.
- List states? → Empty and no-match use `EmptyState` (dashed block). Loading uses `LoadingState` (muted text). A failed load shows `ErrorMessage` and a quiet "Réessayer" button that calls `refetch()`, with the new key `common.action.retry`. The spec says nothing about the load error, so it is not changed.
- Delete button? → `ghost`, with `TrashIcon` and the text « Supprimer » kept (the `.btn-ghost svg` recipe). The i18n key is unchanged.
- Layout? → `<main>` with a side gutter of at least 16px, holding one `Panel` (680px max). Each of the form and the filters sits on one row, its controls aligned on their bottom edge. No count subtitle: it would be a functional addition absent from the spec.
- Narrow widths without a breakpoint repeated in two modules? → Rows wrap with `flex-wrap` and flex-basis minimums, so they stack on their own at narrow widths. There is no `@media`: a breakpoint cannot be a token, and `ui-design.md` forbids repeating the same literal in two modules.
- Where do the error and the ids of a field live? → `Field` renders a `<div>`, not a `<label>`. Its label is a `<label htmlFor>`, and its error is a `<p>` (invalid inside a `<label>`). The ids come from `useId`, handed to the control through a render prop, so `aria-invalid` and `aria-describedby` keep working as `TodoForm` has them today.
- Delete dialog? → Restyle only. Its `isPending` prop, its `onCancel` `preventDefault`, and its `onClose` re-open logic stay as they are: all three came from review findings of the `home` plan.
- Does a todo's name become the visible label of its checkbox, so that clicking the name toggles it (`ui-design.md`: "a checkbox has a visible label, clicking the label toggles it")? → No. The name stays plain text, and the checkbox keeps its `aria-label` as its only label. Toggling the todo when the name is clicked would change what the page does, and the row checkbox is a known exception to that rule here.
- Plugin follow-up? → `factory-init` preparing this whole foundation for every new front is a plugin change, run in its own session. It lifts this plan's components once this stage is committed.

## web

All paths under `web/`. Every style reads the skin's variables only. The literals of `recipes.css` are kept where the recipe has them: gaps, paddings, icon and checkbox sizes, the panel's 680px.

### pages

- `src/features/todos/pages/HomePage.tsx`: same state, hooks and handlers; only the markup changes.
  - `<main className={styles.page}>` holds one `<Panel>`. Inside it, in this order:
    - `<PageTitle>{t("home.title")}</PageTitle>`;
    - `TodoForm`;
    - `TodoFilters`;
    - the list area.
  - Loading (`todosQuery.isPending`): `<LoadingState>{t("home.list.loading")}</LoadingState>`.
  - Load error (`todosQuery.isError`): `<div className={styles.listError}>` holding:
    - `<ErrorMessage>{t("home.list.error")}</ErrorMessage>`;
    - `<Button variant="quiet" onClick={() => void todosQuery.refetch()} disabled={todosQuery.isFetching}>{t("common.action.retry")}</Button>`.

    While the refetch runs, the status stays `error`: the message stays and the button is disabled. On success, the list replaces both.
  - Toggle failure: `<ErrorMessage>{t("common.error.generic")}</ErrorMessage>` above the list, as today.
  - FR-10:
    - no todo at all: `<EmptyState>{t("home.list.empty")}</EmptyState>`;
    - todos but none visible: `<EmptyState>{t("home.list.noMatch")}</EmptyState>`.
  - `ConfirmDialog`: same props as today.
- `src/features/todos/pages/HomePage.module.css`: layout only.
  - `.page { padding: 32px 16px; }`.
  - `.listError { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }`.
  - Remove the `font-family: system-ui, sans-serif` (it would override the skin's body face), the `max-width` and `margin` (now `Panel`'s), and `.error` with its `#b00020`.

### ui

**Theme and fonts**

- From `web/`, `npm install --save-exact @fontsource/archivo-black@5.3.0 @fontsource/ibm-plex-mono@5.3.0`. `package.json` and `package-lock.json` go in the stage commit.
- `src/shared/ui/theme/base.css` (new): the pack skeleton's file, byte for byte.
- `src/main.tsx`: before the `./router.tsx` import, in this order:

  ```ts
  import "@fontsource/archivo-black/400.css";
  import "@fontsource/ibm-plex-mono/400.css";
  import "@fontsource/ibm-plex-mono/600.css";
  import "./shared/ui/theme/skin.css";
  import "./shared/ui/theme/base.css";
  import "./shared/ui/theme/overrides.css";
  ```

- `skin.css` and `overrides.css`: untouched.

**Shared components**, in `src/shared/ui/`. Each is a named export `{Name}.tsx` with its `{Name}.module.css`, which ports the matching rules of `recipes.css` with the recipe's class names in camelCase (`select-wrap` becomes `selectWrap`, `is-done` becomes `isDone`). They have no `className` prop: a feature lays them out through a wrapper of its own.

- `Panel.tsx`: `Panel({ children })` renders `<div className={styles.panel}>`, from the `.panel` recipe (grid, gap 28px, 680px max, centered).
- `PageTitle.tsx`: `PageTitle({ children })` renders `<h1 className={styles.title}>`, from `.title`.
- `Field.tsx`: `Field({ label, error, children }: { label: string; error: string | null; children(control: FieldControl): ReactNode })`.
  - `type FieldControl = { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined }`.
  - It builds `id` and `errorId` with `useId`, then renders:

    ```tsx
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      {children(control)}
      {error && <p id={errorId} className={styles.error}>{error}</p>}
    </div>
    ```

  - Recipes: `.field`, `.label`, `.error`.
- `TextInput.tsx`: `TextInput(props: Omit<ComponentProps<"input">, "className">)` renders `<input className={styles.input} {...props} />`.
  - Recipes: `.input`, `::placeholder`, `:focus-visible`, `[aria-invalid="true"]`.
- `SearchInput.tsx`: `SearchInput(props: Omit<ComponentProps<"input">, "className" | "type">)` renders a `<div className={styles.search}>` holding `<SearchIcon />` and `<input type="search" className={styles.input} {...props} />`.
  - Its module holds the `.input` rules too, plus `.search`, `.search svg` and `.search .input`.
  - It also hides the native clear button: `.input::-webkit-search-cancel-button { appearance: none; }` (the "no unstyled native control" rule).
- `Select.tsx`: `Select(props: Omit<ComponentProps<"select">, "className">)` renders `<div className={styles.selectWrap}>` holding `<select className={styles.select} {...props} />`.
  - Recipes: `.input, .select`, `.select`, `.select-wrap::after`.
- `Button.tsx`: `Button({ variant = "quiet", type = "button", ...props }: { variant?: "primary" | "danger" | "quiet" | "ghost" } & Omit<ComponentProps<"button">, "className">)` renders `<button type={type} className={`${styles.btn} ${styles[variant]}`} {...props} />`.
  - `type` defaults to `"button"`, so a dialog button never submits.
  - Recipes: `.btn`, `:active`, `:disabled`, `.btn-primary`, `.btn-danger`, their `:hover`, `.btn-quiet`, `.btn-ghost`, `.btn-ghost:hover`, `.btn-ghost svg`.
- `Switch.tsx`: `Switch({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange(checked: boolean): void })` renders:

  ```tsx
  <label className={styles.switch}>
    <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    <span>{label}</span>
  </label>
  ```

  - Recipes: `.switch`, `.switch input`, `::before`, `:checked`.
- `Checkbox.tsx`: `Checkbox(props: Omit<ComponentProps<"input">, "className" | "type">)` renders `<input type="checkbox" className={styles.check} {...props} />`.
  - Recipes: `.check`, `::after`, `:checked`, `:checked::after`.
  - The `.check` recipe has no disabled rule, so add one: `.check:disabled { opacity: 0.55; cursor: not-allowed; }`, the same values as `.btn:disabled`.
- `List.tsx`, one module `List.module.css`, three exports:
  - `List({ children })` renders `<ul className={styles.list}>`;
  - `ListItem({ isDone = false, children })` renders `<li className={isDone ? `${styles.item} ${styles.isDone}` : styles.item}>`;
  - `ListItemText({ children })` renders `<span className={styles.itemText}>`.

  The struck-through done state (`.item.isDone .itemText`) needs both classes in one module.
- `Badge.tsx`: `Badge({ children })` renders `<span className={styles.badge}>`, from `.badge`.
- `EmptyState.tsx`: `EmptyState({ children })` renders `<p className={styles.empty}>`, from `.empty`, with `margin: 0`.
- `LoadingState.tsx`: `LoadingState({ children })` renders `<p role="status" className={styles.loading}>`, with `margin: 0; padding: 28px 16px; text-align: center; color: var(--text-muted);`: the empty state's box without its border.
- `ErrorMessage.tsx`: `ErrorMessage({ children })` renders `<p role="alert" className={styles.error}>`, from `.error` with `margin: 0`. The parent's gap does the spacing.
- `icons.tsx`: `SearchIcon()` and `TrashIcon()`.
  - Each is an inline `<svg>`: `width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"`.
  - `SearchIcon`: a circle and a handle.
  - `TrashIcon`: a lid, a can and two lines.
  - Both always sit beside text, so they have no accessible name.
- `ConfirmDialog.tsx`: props, effect, `onCancel` and `onClose` unchanged. Only the markup changes:
  - the title becomes a plain `<h2 id="confirm-dialog-title">`, styled by the module's `.dialog h2`;
  - the error becomes `<ErrorMessage>`;
  - the buttons become `<Button variant="quiet">` (cancel) and `<Button variant="danger">` (confirm), both `disabled={isPending}`.
- `ConfirmDialog.module.css`: replaced by the dialog recipe: `.dialog`, `.dialog::backdrop`, `.dialog[open]` (the `display: grid` stays qualified by `[open]`, so a closed dialog stays hidden), `.dialog h2`, `.dialog p`, `.actions`, `@keyframes fade`. The recipe's `.dialog p` becomes `.dialog > p:not([role="alert"])`, so the error paragraph keeps `ErrorMessage`'s `--danger` instead of turning muted.

**Feature components**, in `src/features/todos/ui/`. Props and behaviour are unchanged.

- `TodoForm.tsx`:
  - Each field becomes `<Field label={…} error={…}>{(control) => <TextInput {...control} … />}</Field>`, keeping `name`, `value`, `onChange`, `required`, `maxLength`.
  - For the tag field, the `list="todo-form-tags"` attribute and the `<datalist>` stay inside the render prop.
  - The fixed ids `todo-form-name-error` and `todo-form-tag-error` go: `Field` owns them.
  - Submit: `<Button variant="primary" type="submit" disabled={isPending}>`.
  - The other error: `<ErrorMessage>`.
- `TodoForm.module.css`:
  - `.form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; }`;
  - `.name { flex: 3 1 220px; min-width: 0; }` and `.tag { flex: 1 1 160px; min-width: 0; }`, as wrappers around each `Field`;
  - `.formError { flex-basis: 100%; }`, a wrapper around the `ErrorMessage`;
  - the `#b00020` and the rem literals go.

  A field error under one field breaks the bottom alignment of the row while it shows; this is accepted.
- `TodoFilters.tsx`:
  - `Field` + `SearchInput` for the search;
  - `Field` + `Select` for the tag (same options and the same `""` to `null` mapping);
  - `<Switch label={t("home.filters.sortByState")} checked={isSortedByState} onChange={onSortByStateChange} />`.
- `TodoFilters.module.css`: `.filters { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; }`, `.search { flex: 2 1 200px; min-width: 0; }`, `.tag { flex: 1 1 160px; min-width: 0; }`. The switch keeps its own width; it is `--control-h` tall, so it aligns with the fields.
- `TodoList.tsx`: `<List>` instead of `<ul>`. Delete `TodoList.module.css`.
- `TodoItem.tsx`:

  ```tsx
  <ListItem isDone={todo.isCompleted}>
    <Checkbox checked={todo.isCompleted} disabled={isPending} aria-label={t("home.item.toggle", { name: todo.name })} onChange={…} />
    <ListItemText>{todo.name}</ListItemText>
    {todo.tag !== null && <Badge>{todo.tag}</Badge>}
    <Button variant="ghost" onClick={onDelete}><TrashIcon />{t("home.item.delete")}</Button>
  </ListItem>
  ```

  - The name is not the checkbox's label (see Decisions).
  - Delete `TodoItem.module.css`: `ListItem` gives the row its layout.
- `src/shared/lib/i18n.ts`: add `"common.action.retry": "Réessayer"`.

## Conventions

- `web/CLAUDE.md`, Structure: the `shared/ui/` line becomes "shared components: one per element of the skin's recipes (`Panel`, `PageTitle`, `Field`, `TextInput`, `SearchInput`, `Select`, `Button`, `Switch`, `Checkbox`, `List`, `Badge`, `EmptyState`, `LoadingState`, `ErrorMessage`, `ConfirmDialog`, `icons.tsx`)". A `theme/` line is added under it: "skin.css (the skin's tokens, copied by factory-init: never edited), base.css (the page), overrides.css (this application's values)". These are the pack template's wordings. Rationale: the structure the code now has.
- `web/CLAUDE.md`, Conventions › Styling: becomes the pack template's wording: "CSS Modules (styles scoped to their component; no global style outside `src/shared/ui/theme/`). Styles read the skin's variables only: no literal color, radius, shadow, font family or control height (see Design)." Rationale: the rule this plan applies, so the reviewer checks it.
- `web/CLAUDE.md`, Design, two rules:
  - "Fonts: self-hosted, pinned `@fontsource/*` packages imported by `main.tsx` before `skin.css`, only the weights `SKIN.md` names."
  - "Form and filter rows wrap with `flex-wrap` and flex-basis minimums: no media query."

  Rationale: decisions of this plan that the next UI change must follow.

## Tests

### web

Unit and integration tests: none, because `web/CLAUDE.md` forbids front tests. The browser test of the Validation (`test-in-browser`, http://localhost:5173) covers the change:

1. The 8 scenarios of the `home` plan (`.planning/features/home/dev-plans/20261017-022123-init-home/plan.md`, Tests › web), all passing on the restyled page.
2. The skin applies:
   - the title is in Archivo Black, uppercase;
   - the body text is in IBM Plex Mono (the network tab shows the woff2 files served by Vite, no third-party request);
   - borders are 2px with offset shadows, the corners square, the accent yellow and the tags pink.
3. The sort toggle is a switch: clicking its label toggles it, and its accessible role is `switch`.
4. Retry, in this order:
   1. Stop the API, then load the page: the error message and « Réessayer » show.
   2. Restart the API, then click « Réessayer »: the list loads.
5. In dark mode (`prefers-color-scheme: dark`), every element stays readable, with black text on the yellow and the pink.
6. At 360px wide, the form and the filters stack. The page keeps a 16px gutter and does not scroll horizontally. A 200-character name without spaces wraps.
7. Keyboard: Tab shows the focus ring on every control (inputs, select, switch, checkboxes, buttons, dialog buttons). Escape closes the dialog, except while a delete is pending.

## Deviations

- `Button.module.css` ports the `.btn` recipe → it also has `.btn:focus-visible { box-shadow: 0 0 0 3px var(--focus); }`. `.btn`'s own `box-shadow` has the same specificity as `base.css`'s `:focus-visible` and loads after it (the route's CSS chunk), so buttons had no focus ring (review finding; Tests › web 7).
- `List.module.css` ports `.item` and `.item-text` → `.item` also wraps (`flex-wrap: wrap`) and `.itemText` is `flex: 1 1 120px`. At 360px a 30-character tag pushed the list past the panel and the page scrolled sideways, and a long name narrowed to a column a few characters wide (review finding; Tests › web 6).
- `ConfirmDialog.module.css` ports `.dialog h2` → it also has `text-transform: var(--title-transform)`, since `SKIN.md` sets the dialog headings in uppercase (review finding).
- `ListItem`'s `flex-wrap` and the `.btn:focus-visible` ring were also missing from the plugin's `recipes.css`, and so were the quiet button's hover and the switch's disabled state. The recipe caught up in `fix(factory): the recipes keep the focus ring and fit a phone`; the final review ported the last two: `.quiet:hover:not(:disabled)` in `Button.module.css` and `.switch input:disabled` in `Switch.module.css` (review findings).
- `ConfirmDialog.module.css` ports `.dialog p` → it also has `overflow-wrap: anywhere`. The message holds the todo's name: a 200-character name without spaces widened the dialog's grid, and the dialog scrolled sideways with its buttons out of view (review finding; Tests › web 6). The recipe lacks it: plugin follow-up.
- Retry on a failed load → while the refetch runs, the status is not `error`. When no load ever succeeded, TanStack Query sets the status back to `pending`: the page shows `LoadingState` instead of a disabled button. The `disabled={todosQuery.isFetching}` only shows when a background refetch fails with data in the cache. Code unchanged; the pages section's "the status stays `error`" is wrong (review finding).

## Progress

### Stage 1 — web
Commit: `refactor(shared): web — brutalist skin on shared/ui components`
- [x] Prepare: client regenerated from `api/openapi.json`
- [x] pages: `HomePage` on `Panel`, `PageTitle` and the list states, retry on a failed load
- [x] ui: fonts installed, `base.css`, theme imports in `main.tsx`
- [x] ui: shared components (`Panel` to `icons.tsx`), `ConfirmDialog` restyled
- [x] ui: `TodoForm`, `TodoFilters`, `TodoList`, `TodoItem` on the shared components, `common.action.retry`
- [x] Conventions: `web/CLAUDE.md` updated

## Validation

- [x] Review: the `reviewer` agent on the plan's implementation, its findings settled
- [x] Browser test: the change tested in `web` (`test-in-browser` skill), the scenarios of Tests › web
