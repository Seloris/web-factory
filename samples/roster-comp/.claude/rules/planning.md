---
description: "Planning under .planning/: page specs, domain sheets, blueprints and their spec delta, images, ideas and technical debt. Use when writing or editing a spec or a blueprint."
paths:
  - "**/.planning/**"
---

# Planning conventions

```
.planning/
  pages/
    {page}.md               one per route of the front: what the person sees and can do there
  domain/
    {name}.md               an entity or a policy used by several pages, or with no page: glossary, BRs
    app.md                  the shell: layout, navigation, sign-in, errors, i18n
  blueprints/
    {YYYY-MM-DD}-{name}.md  a piece of work in flight, or done (never edited after `Spec merged`)
    assets/                 images a blueprint cites (mockups, screenshots)
  mockups/
    {YYYY-MM-DD}-{name}.html  a static mockup on the front's skin (`/selo-flow:mockup`), committed by the lane that builds it
  ideas.md
  technical-debt.md
```

The selo plugin's rules (`reference/rules.md`) hold the full conventions; the skills read them. In short:

## Page specs and domain sheets

- **A page spec** is one route of a front: a business slug chosen at creation (`home`, `todo-detail`), its route in the header (`Route: /todos/:id`), FRs grouped by zone of the page in the order the person meets them. With two fronts or more, pages go under `pages/{component}/`.
- **A domain sheet** holds what is true whatever the page: the entity's glossary, its BRs, a rule with no page as an FR. A page cites its ids (`` `todo` BR-01 ``), never restates them.
- **Which file:** the person sees it on one page → that page; it holds on several pages, or on none → the domain sheet.
- **A page stub** (`Status: to bootstrap` under its `Route:` line, nothing else) is a page whose code exists and whose spec is not written yet. The first change to it, or `/selo-flow:setup specs {page}`, writes the spec of what it does today first (observed behaviour only, a doubt as a `Q-NN`), committed alone: `docs({page}): bootstrap spec`.
- Present tense, each fact once, no history, no status (a stub's aside), no date, never how (endpoints, tables, components). `FR`, `BR`, `US`, `Q` ids are per file, append-only, never reused; a dropped one goes on the file's `Retired:` line. A doubt is a `Q-NN` under `## Open questions`.
- `node ${CLAUDE_PLUGIN_ROOT}/scripts/spec-check.mjs {slug}` (the selo plugin's script) checks a file's ids and gives the next free ones.

## Blueprints

One screen, written by `/selo-flow:blueprint`, approved once: the `## Spec delta` (`{slug} + FR-NN — …`, `{slug} ~ FR-NN — « before » → « after »`, `{slug} - FR-NN — « before »`), the Business decisions and Technical defaults, the Stages with their commit subjects, the Tests, the Progress. No pseudo-code, no file-level detail. `/selo-flow:build` runs it and merges the delta into the specs at the end; the specs are untouched until then. A blueprint is never edited after `Spec merged`; a new iteration is a new blueprint.

A blueprint whose first lines say `Legacy:` is a 1.0 plan moved by `/selo-flow:setup update`: history, never built.

## Images

Save an image the person shares at the moment it is shared, in `.planning/blueprints/assets/`, named in kebab-case after its content, and cite it from the blueprint: `![what it shows](./assets/{name}.png)`.

## Ideas: `.planning/ideas.md`

The person's ideas, not yet specified, grouped by scope: one section per component, page or `app`, a new scope's section added at the bottom; in a section, new items appended at the bottom, no priorities or metadata:

```
## <scope>

- {YYYY-MM-DD} — **<Short title>:** <The idea in a sentence or two, as the person put it>.
```

Title: 3–6 words, sentence case. An idea that spans several scopes goes under `app`. An agent appends an idea only when the person asks, in their words; it never reorders, rewrites or removes one. The person removes an idea once it has become a spec, or once dropped.

## Technical debt: `.planning/technical-debt.md`

A flat list, no sections, priorities or metadata, new items appended at the bottom:

```
- **<Short title> (<scope>):** <One sentence stating what is wrong or missing, not how to fix it>. See [<File>](<relative-path>).
```

Title: 3–6 words, sentence case. Scope: component, layer, page or domain names. Link only the most relevant file(s).
