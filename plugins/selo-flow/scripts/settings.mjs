#!/usr/bin/env node
// The person's selo settings, from the environment (the `env` block of ~/.claude/settings.json), so skills and
// hooks read one place. SELO_ROUTING=on: a free change request runs `pilot` (scripts/lane-hint.mjs); anything
// else or absent: off. SELO_COMMIT=auto: a fastlane on baseBranch commits without its yes; else: ask.
// The models (SELO_MODELS, SELO_MODEL_{ROLE}) are the person's too: manifest.mjs resolves them into the manifest's
// `models`, which the skills already read. Prints { routing, commit } as JSON.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const seloSettings = (env = process.env) => ({
  routing: env.SELO_ROUTING === "on" ? "on" : "off",
  commit: env.SELO_COMMIT === "auto" ? "auto" : "ask",
});

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify(seloSettings()) + "\n");
}
