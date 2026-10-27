#!/usr/bin/env node
// PreToolUse hook on Agent / Task: a subagent of a selo project runs on its role's model, the person's setting
// (SELO_MODELS, SELO_MODEL_{ROLE}: manifest.mjs, resolveModels), whatever the call names. `selo-flow:reviewer` and `selo-flow:runner` always take their role's model; `Explore` and
// `Plan` take theirs only when the call names none; any other agent is untouched. The skills keep passing the
// role's model: this hook is the guard, not the source. It prints `updatedInput` (every field of the call
// kept, `model` replaced) and no permission decision; nothing when the model is already right, outside a
// selo project, or on a manifest that fails to parse. Always exits 0.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { findRoot, readManifest } from "./manifest.mjs";

// subagent_type → [role, always]. `always: false`: only when the call names no model.
export const AGENT_ROLES = {
  "selo-flow:reviewer": ["reviewer", true],
  reviewer: ["reviewer", true],
  "selo-flow:runner": ["runner", true],
  runner: ["runner", true],
  Explore: ["explorer", false],
  Plan: ["planner", false],
};

const named = (model) => typeof model === "string" && model.trim() !== "";

// The call's input with its role's model, or null when it stays as it is. Pure.
export function enforceModel(toolInput, models) {
  if (!toolInput || typeof toolInput !== "object" || !models) return null;
  const entry = AGENT_ROLES[toolInput.subagent_type];
  if (!entry) return null;
  const [role, always] = entry;
  const target = models[role];
  if (!named(target)) return null;
  if (!always && named(toolInput.model)) return null;
  if (toolInput.model === target) return null;
  return { ...toolInput, model: target };
}

// The hook's output for one event, or null: the manifest found up the event's cwd, the models from `env`. Never throws.
export function hookOutput(event, env = process.env) {
  try {
    const input = event?.tool_input;
    if (!input || !AGENT_ROLES[input.subagent_type]) return null;
    const root = findRoot(event.cwd ?? process.cwd());
    if (root === null) return null;
    const updatedInput = enforceModel(input, readManifest(root, { env }).models);
    return updatedInput === null ? null : { hookSpecificOutput: { hookEventName: "PreToolUse", updatedInput } };
  } catch {
    return null;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  let event = null;
  try {
    event = JSON.parse(data.replace(/^\uFEFF/, "").trim() || "{}");
  } catch {
    process.exit(0);
  }
  const out = hookOutput(event);
  if (out !== null) process.stdout.write(JSON.stringify(out) + "\n");
  process.exit(0);
}
