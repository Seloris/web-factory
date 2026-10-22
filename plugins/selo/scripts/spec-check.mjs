#!/usr/bin/env node
// Checks a spec's ids and gives the next free ones; reads a blueprint's spec delta against the current specs.
// Usage: node spec-check.mjs {slug | path to a spec .md} [--cite "FR-13 BR-23"]
//        node spec-check.mjs --merge {blueprint .md}
//   {slug}   a page (`home`, `web/home`), a domain sheet (`todo`), or a 1.0 area (`.planning/features/{slug}/00_spec.md`);
//   --cite   ids that must exist (a commit's Spec: group);
//   --merge  each delta line with its final id and its status (ok, conflict, missing, invalid); writes nothing.
// Prints JSON; exits 1 when a check fails, 2 on a usage error.
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findRoot } from "./manifest.mjs";

const KINDS = ["FR", "BR", "US", "Q"];
const ID = /\b(?:FR|BR|US|Q)-\d+\b/g;

export const idsIn = (text) => [...new Set(text.match(ID) ?? [])];

export function checkSpec(text, cited = []) {
  const defined = [...text.matchAll(/^\s*-\s+\*\*((?:FR|BR|US|Q)-\d+)\*\*/gm)].map((m) => m[1]);
  const retired = idsIn(/^Retired:\s*(.*)$/m.exec(text)?.[1] ?? "");

  const seen = new Set();
  const duplicates = defined.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
  const retiredReused = defined.filter((id) => retired.includes(id));
  // A cited id may be one this commit retires (`-FR-07`): retired counts as known.
  const missing = cited.filter((id) => !seen.has(id) && !retired.includes(id));

  const next = {};
  for (const k of KINDS) {
    const nums = [...defined, ...retired].filter((id) => id.startsWith(k + "-")).map((id) => Number(id.split("-")[1]));
    next[k] = `${k}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, "0")}`;
  }
  const ok = !duplicates.length && !retiredReused.length && !missing.length;
  return { ok, duplicates, retiredReused, missing, next };
}

// The spec file of a slug, from the project's root: a page, else a domain sheet, else a 1.0 area; a path ending in .md as it is.
export const specPath = (arg, cwd = process.cwd()) => {
  if (arg.endsWith(".md")) return resolve(cwd, arg);
  const root = findRoot(cwd) ?? cwd;
  const candidates = [join(root, ".planning", "pages", `${arg}.md`), join(root, ".planning", "domain", `${arg}.md`), join(root, ".planning", "features", arg, "00_spec.md")];
  return candidates.find((p) => existsSync(p)) ?? candidates[0];
};

// One delta line: `- {slug} {+|~|-} {ID} — {text}` or `- {slug} {+|~|-} Non-goal: {text}`.
const DELTA = /^-\s+(\S+)\s+([+~-])\s+(?:((?:FR|BR|US|Q)-\d+)\s+—\s+|(Non-goal)\s*[:—]\s*)(.*)$/;
const QUOTE = /[«“"]\s*([^»”"]*?)\s*[»”"]/g;
const norm = (s) => s.replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();

// The quoted "before" of a `~` or `-` line, cut on `…`: every piece must still be in the spec.
const beforePieces = (op, text) => {
  const side = op === "~" ? text.split(" → ")[0] : text;
  return [...side.matchAll(QUOTE)].flatMap((m) => m[1].split(/…|\.\.\./)).map(norm).filter(Boolean);
};

export function parseBlueprint(text) {
  const header = /^Pages:.*$/m.exec(text)?.[0] ?? "";
  const namesOf = (label) => [...(new RegExp(`${label}:([^·]*)`).exec(header)?.[1] ?? "").matchAll(/`([\w/-]+)`/g)].map((m) => m[1]);
  const section = /^## Spec delta\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1] ?? "";
  const lines = section.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.startsWith("- ")).map((raw) => {
    const m = DELTA.exec(raw);
    if (!m) return { raw, invalid: true };
    const [, slug, op, id, nonGoal, body] = m;
    return { raw, slug, op, id: id ?? null, nonGoal: Boolean(nonGoal), text: body, before: op === "+" ? [] : beforePieces(op, body) };
  });
  return { pages: namesOf("Pages"), domain: namesOf("Domain"), lines, merged: /^\s*-\s+\[x\]\s+Spec merged/im.test(text) };
}

// specs: { [slug]: current text, or null when the file does not exist yet }.
export function planMerge(blueprintText, specs) {
  const bp = parseBlueprint(blueprintText);
  const counters = {};
  const nextOf = (slug, kind) => {
    counters[slug] ??= Object.fromEntries(Object.entries(checkSpec(specs[slug] ?? "").next).map(([k, v]) => [k, Number(v.split("-")[1])]));
    return `${kind}-${String(counters[slug][kind]++).padStart(2, "0")}`;
  };
  const lines = bp.lines.map((l) => {
    if (l.invalid) return { raw: l.raw, status: "invalid", reason: "not a delta line" };
    const current = specs[l.slug] ?? null;
    const out = { slug: l.slug, op: l.op, id: l.id, final: l.id, status: "ok" };
    if (l.op === "+") {
      if (l.id) out.final = nextOf(l.slug, l.id.split("-")[0]);
      return out;
    }
    if (current === null) return { ...out, status: "missing", reason: `no spec ${l.slug}` };
    let where = norm(current);
    if (l.id) {
      const def = new RegExp(`^\\s*-\\s+\\*\\*${l.id}\\*\\*\\s+—\\s+(.*)$`, "m").exec(current);
      if (!def) return { ...out, status: "missing", reason: `${l.id} is no longer in ${l.slug}` };
      where = norm(def[1]);
    }
    const lost = l.before.filter((piece) => !where.includes(piece));
    return lost.length ? { ...out, status: "conflict", reason: `before text not found: « ${lost.join(" … ")} »` } : out;
  });
  const slugs = [...new Set(lines.filter((l) => l.slug).map((l) => l.slug))];
  const create = slugs.filter((s) => specs[s] == null).map((slug) => ({ slug, kind: bp.domain.includes(slug) ? "domain" : "page" }));
  // Highest id first, so a `to` is never a `from` still waiting: replacing them in this order never merges two ids.
  const num = (id) => Number(id.split("-")[1]);
  const renames = lines.filter((l) => l.op === "+" && l.id && l.final !== l.id).map(({ slug, id, final }) => ({ slug, from: id, to: final })).sort((a, b) => num(b.from) - num(a.from));
  const groups = slugs.map((s) => [s, ...lines.filter((l) => l.slug === s && l.final).map((l) => `${l.op}${l.final}`)]).filter((g) => g.length > 1);
  const specLine = groups.length ? `Spec: ${groups.map((g) => g.join(" ")).join(" · ")}` : null;
  const ok = !bp.merged && lines.every((l) => l.status === "ok");
  return { ok, merged: bp.merged, lines, create, renames, specLine };
}

const optionOf = (argv, name) => {
  const i = argv.indexOf(name);
  return i < 0 ? null : (argv[i + 1] ?? "");
};

const fail = (message) => {
  console.error(message);
  process.exit(2);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const blueprint = optionOf(argv, "--merge");
  if (blueprint !== null) {
    const file = resolve(blueprint);
    if (!existsSync(file)) fail(`No blueprint at ${file}`);
    const root = findRoot(process.cwd()) ?? process.cwd();
    const text = readFileSync(file, "utf8");
    const bp = parseBlueprint(text);
    const specs = {};
    const files = {};
    for (const slug of new Set(bp.lines.filter((l) => l.slug).map((l) => l.slug))) {
      const found = specPath(slug, root);
      const exists = existsSync(found) && !found.endsWith("00_spec.md");
      const path = exists ? found : join(root, ".planning", bp.domain.includes(slug) ? "domain" : "pages", `${slug}.md`);
      specs[slug] = exists ? readFileSync(found, "utf8") : null;
      files[slug] = relative(root, path).replace(/\\/g, "/");
    }
    const r = { ...planMerge(text, specs), files };
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  }
  const target = argv[0];
  if (!target || target.startsWith("--")) fail('usage: spec-check.mjs {slug | spec .md} [--cite "FR-13 BR-23"] | --merge {blueprint .md}');
  const file = specPath(target);
  if (!existsSync(file)) fail(`No spec at ${file}`);
  const r = checkSpec(readFileSync(file, "utf8"), idsIn(optionOf(argv, "--cite") ?? ""));
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}
