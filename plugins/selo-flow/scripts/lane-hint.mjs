#!/usr/bin/env node
// UserPromptSubmit hook: on a free request in a selo project, when the person's SELO_ROUTING is `on`
// (scripts/settings.mjs), adds a short context telling the session to run the `pilot` skill on a new request to
// change the application; `pilot` picks the lane. A hook cannot start a skill: the session calls it. Nothing when
// routing is off, outside a selo project (no selo.yaml up the tree), on a slash command, or on a prompt that holds
// only the harness's blocks (a hand-back, a notification). Always exits 0.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findRoot } from "./manifest.mjs";
import { seloSettings } from "./settings.mjs";

// The prompt without its leading closed blocks (a view context, a reminder, a hand-back); a pasted block is
// unwrapped, it is the person's text. Same reading as selo-feed's stripWrappers.
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
export const HINT = `selo routing (SELO_ROUTING=on). If this prompt is a new request to change the application, run the pilot skill on it now (Skill \`selo-flow:pilot\`, the request as its args), saying so in one line: it picks the lane. ${COMMON}`;

// The hook's output for one event, or null. `env`: the person's settings. Never throws.
export function hookOutput(event, env = process.env) {
  try {
    if (seloSettings(env).routing !== "on") return null;
    const text = personText(event?.prompt).trim();
    if (text === "" || text.startsWith("/")) return null;
    if (findRoot(event.cwd ?? process.cwd()) === null) return null;
    return { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: HINT } };
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
