#!/usr/bin/env node
// Prototype: checks a zone spec's ids and gives the next free ones.
// Usage: node spec-check.mjs <path to 00_spec.md> [--cite "FR-13 BR-23"]
import { readFileSync } from "node:fs";

const KINDS = ["FR", "BR", "US", "Q"];

export function checkSpec(text, cited = []) {
  const defined = [...text.matchAll(/^\s*-\s+\*\*((?:FR|BR|US|Q)-\d+)\*\*/gm)].map((m) => m[1]);
  const retiredLine = text.match(/^Retired:\s*(.*)$/m);
  const retired = retiredLine ? retiredLine[1].split(/[,\s]+/).filter(Boolean) : [];
  const planned = [...text.matchAll(/^\s*-\s+\*\*((?:FR|BR)-\d+)\*\*\s+—\s+\(planned\)/gm)].map((m) => m[1]);

  const seen = new Set();
  const duplicates = defined.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
  const retiredReused = defined.filter((id) => retired.includes(id));
  const missing = cited.filter((id) => !seen.has(id));

  const next = {};
  for (const k of KINDS) {
    const nums = [...defined, ...retired].filter((id) => id.startsWith(k + "-")).map((id) => Number(id.split("-")[1]));
    next[k] = `${k}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, "0")}`;
  }
  return { ok: !duplicates.length && !retiredReused.length && !missing.length, duplicates, retiredReused, missing, planned, next };
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("spec-check.mjs")) {
  const [file, flag, list] = process.argv.slice(2);
  if (!file) { console.error("usage: spec-check.mjs <00_spec.md> [--cite \"FR-13 BR-23\"]"); process.exit(2); }
  const cited = flag === "--cite" && list ? list.split(/[,\s]+/).filter(Boolean) : [];
  const r = checkSpec(readFileSync(file, "utf8"), cited);
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}
