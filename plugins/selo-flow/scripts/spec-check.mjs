#!/usr/bin/env node
// Checks an area spec's ids and gives the next free ones.
// Usage: node spec-check.mjs {slug | path to 00_spec.md} [--cite "FR-13 BR-23"] [--plan {plan folder}] [--done]
//   --cite   ids that must exist (a commit's Spec: line); --plan adds the ids of the plan's header `Spec:` line;
//   --done   the plan's last stage: a cited FR or BR still marked (planned) is an error.
// Prints JSON; exits 1 when a check fails, 2 on a usage error.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findRoot } from "./manifest.mjs";

const KINDS = ["FR", "BR", "US", "Q"];
const ID = /\b(?:FR|BR|US|Q)-\d+\b/g;

export const idsIn = (text) => [...new Set(text.match(ID) ?? [])];

// The ids of a plan's header line (`Feature: … · Spec: US-03, FR-02`), none without one.
export const planIds = (planText) => idsIn(/^.*\bSpec:\s*(.*)$/m.exec(planText)?.[1] ?? "");

export function checkSpec(text, cited = [], { done = false } = {}) {
  const defined = [...text.matchAll(/^\s*-\s+\*\*((?:FR|BR|US|Q)-\d+)\*\*/gm)].map((m) => m[1]);
  const retired = idsIn(/^Retired:\s*(.*)$/m.exec(text)?.[1] ?? "");
  const planned = [...text.matchAll(/^\s*-\s+\*\*((?:FR|BR)-\d+)\*\*\s+—\s+\(planned\)/gm)].map((m) => m[1]);

  const seen = new Set();
  const duplicates = defined.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
  const retiredReused = defined.filter((id) => retired.includes(id));
  // A cited id may be one this commit retires (`-FR-07`): retired counts as known.
  const missing = cited.filter((id) => !seen.has(id) && !retired.includes(id));
  const plannedLeft = done ? cited.filter((id) => planned.includes(id)) : [];

  const next = {};
  for (const k of KINDS) {
    const nums = [...defined, ...retired].filter((id) => id.startsWith(k + "-")).map((id) => Number(id.split("-")[1]));
    next[k] = `${k}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(2, "0")}`;
  }
  const ok = !duplicates.length && !retiredReused.length && !missing.length && !plannedLeft.length;
  return { ok, duplicates, retiredReused, missing, planned, plannedLeft, next };
}

// The spec file of a slug, from the project's root; a path ending in .md is taken as it is.
export const specPath = (arg, cwd = process.cwd()) => {
  if (arg.endsWith(".md")) return resolve(cwd, arg);
  const root = findRoot(cwd) ?? cwd;
  return join(root, ".planning", "features", arg, "00_spec.md");
};

const optionOf = (argv, name) => {
  const i = argv.indexOf(name);
  return i < 0 ? null : (argv[i + 1] ?? "");
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const target = argv[0];
  if (!target || target.startsWith("--")) {
    console.error('usage: spec-check.mjs {slug | 00_spec.md} [--cite "FR-13 BR-23"] [--plan {plan folder}] [--done]');
    process.exit(2);
  }
  const file = specPath(target);
  if (!existsSync(file)) {
    console.error(`No spec at ${file}`);
    process.exit(2);
  }
  const cited = idsIn(optionOf(argv, "--cite") ?? "");
  const plan = optionOf(argv, "--plan");
  if (plan) {
    const planFile = join(resolve(plan), "plan.md");
    if (!existsSync(planFile)) {
      console.error(`No plan at ${planFile}`);
      process.exit(2);
    }
    cited.push(...planIds(readFileSync(planFile, "utf8")).filter((id) => !cited.includes(id)));
  }
  const r = checkSpec(readFileSync(file, "utf8"), cited, { done: argv.includes("--done") });
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}
