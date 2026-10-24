#!/usr/bin/env node
// UserPromptSubmit hook: on a free request in a selo project whose `routing` is `suggest` or `auto`, adds a
// short context telling the session to place the request in its lane (rules.md, **Three lanes**) before acting.
// A hook cannot start a skill: under `auto` the session calls the fastlane skill itself; a blueprint is always
// proposed, never started. Nothing when routing is `off`, outside a selo project, on a manifest that fails to
// parse, on a slash command, or on a prompt that holds only the harness's blocks (a hand-back, a notification).
// Always exits 0.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findRoot, readManifest } from "./manifest.mjs";

// The prompt without its leading closed blocks (a view context, a reminder, a hand-back); a pasted block is
// unwrapped, it is the person's text. Same reading as selo-ops' stripWrappers.
export function personText(prompt) {
  let text = String(prompt ?? "").trimStart();
  for (;;) {
    const open = /^<([a-zA-Z][\w-]*)(?:\s[^>]*)?>/.exec(text);
    if (!open) return text;
    const name = open[1];
    const rest = text.slice(open[0].length);
    const close = rest.indexOf(`</${name}>`);
    if (close < 0) return text;
    const after = rest.slice(close + name.length + 3);
    text = (name === "pasted_content" ? rest.slice(0, close) + after : after).trimStart();
  }
}

const COMMON =
  "Skip this note when the prompt continues work in progress (a selo skill running, a fastlane's iterate loop, a mockup being iterated), answers a question you asked, or is a question, an explanation or a spec's wording: then just do what it asks.";
export const HINTS = {
  suggest: `selo routing (selo.yaml: routing: suggest). If this prompt is a new request to change the application, first place it in its lane (rules.md, Three lanes): name the lane and its exact prompt (\`/selo:fastlane {request}\`, \`/selo:blueprint {request}\`, or \`/selo:mockup {request}\` when seeing it first helps), say why in one line, and wait for the person's yes before any change. ${COMMON}`,
  auto: `selo routing (selo.yaml: routing: auto). If this prompt is a new request to change the application and it fits the fastlane (one page or one component, no new page, entity or business rule), run the fastlane skill on it now (Skill \`selo:fastlane\`, the request as its args), saying so in one line. If it needs a blueprint, propose \`/selo:blueprint {request}\` and wait for the person's yes: never start one. ${COMMON}`,
};

// The hook's output for one event, or null. Never throws.
export function hookOutput(event) {
  try {
    const text = personText(event?.prompt).trim();
    if (text === "" || text.startsWith("/")) return null;
    const root = findRoot(event.cwd ?? process.cwd());
    if (root === null) return null;
    const hint = HINTS[readManifest(root).routing];
    return hint ? { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: hint } } : null;
  } catch {
    return null;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  let event = null;
  try {
    event = JSON.parse(data.replace(/^﻿/, "").trim() || "{}");
  } catch {
    process.exit(0);
  }
  const out = hookOutput(event);
  if (out !== null) process.stdout.write(JSON.stringify(out) + "\n");
  process.exit(0);
}
