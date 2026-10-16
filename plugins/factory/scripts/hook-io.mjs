// Shared plumbing of the PreToolUse / UserPromptSubmit hooks: read the event, answer it.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readManifest } from "./manifest.mjs";

// True when the module is run as a script (node file.mjs), false when imported by a test.
export const isMain = (importMetaUrl) => Boolean(process.argv[1]) && resolve(process.argv[1]) === fileURLToPath(importMetaUrl);

export const readEvent = async () => {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  data = data.replace(/^﻿/, "").trim();
  return data ? JSON.parse(data) : {};
};

export const allow = () => process.exit(0);

export const deny = (reason) => {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }) + "\n");
  process.exit(0);
};

export const allowWithContext = (context) => {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", additionalContext: context } }) + "\n");
  process.exit(0);
};

// The manifest of the project the event comes from, or null when there is none (the hooks then
// stay out of the way: the plugin may be installed in a repository that is not a factory project).
export const manifestFor = (event) => {
  try {
    return readManifest(event.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
  } catch {
    return null;
  }
};

// Humans may switch the guards off for a session from the environment Claude Code starts in.
export const guardsOff = () => process.env.FACTORY_ALLOW_INLINE_RUNS === "1";

// Per-session state (the exploration counter), outside the repository.
const stateDir = () => {
  const dir = join(tmpdir(), "factory-state");
  mkdirSync(dir, { recursive: true });
  return dir;
};

export const readState = (sessionId) => {
  const file = join(stateDir(), `${sessionId || "unknown"}.json`);
  if (!existsSync(file)) return { count: 0 };
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return { count: 0 };
  }
};

export const writeState = (sessionId, state) => {
  writeFileSync(join(stateDir(), `${sessionId || "unknown"}.json`), JSON.stringify(state));
};

// Quoted text (a commit message, an inline script) is not a command: drop it before matching.
export const unquoted = (command) => String(command ?? "").replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, " ");
