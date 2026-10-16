// PreToolUse hook on Read | Grep | Glob | Bash | Edit | Write | MultiEdit | Agent: keeps the lead from
// exploring the code inline in long bursts, so broad searches go to the `runner` or `Explore`
// subagents. It counts the lead's exploration calls (Grep, Glob, Read, read-only shell commands)
// since the later of the person's last prompt (the UserPromptSubmit hook resets the counter) and
// the lead's last Edit, Write or Agent call. Past the limit, a search is denied and a Read is let
// through with a reminder (an Edit needs a Read first).
// Subagents are never counted. Limit: manifest `hooks.exploration_limit` (default 4), overridden
// by FACTORY_INLINE_EXPLORATION_LIMIT; off with `hooks.delegate_exploration: false` or
// FACTORY_ALLOW_INLINE_RUNS=1.

import { allow, allowWithContext, deny, guardsOff, isMain, manifestFor, readEvent, readState, unquoted, writeState } from "./hook-io.mjs";

const READ_ONLY = /^\s*(?:git (?:log|status|diff|show|branch|rev-parse|ls-files|blame)|cat|head|tail|less|more|wc|ls|dir|type|tree|stat|file|pwd|echo)\b/;

export const classify = (toolName, toolInput) => {
  if (["Edit", "Write", "MultiEdit", "Agent", "Task"].includes(toolName)) return "reset";
  if (toolName === "Read") return "read";
  if (toolName === "Grep" || toolName === "Glob") return "search";
  if (toolName === "Bash" || toolName === "PowerShell") {
    const cmd = unquoted(toolInput?.command);
    return READ_ONLY.test(cmd) ? "search" : "other";
  }
  return "other";
};

const main = async () => {
  const event = await readEvent();
  if (event.agent_id || guardsOff()) allow();
  const manifest = manifestFor(event);
  if (!manifest || !manifest.hooks.delegateExploration) allow();
  const limit = Number(process.env.FACTORY_INLINE_EXPLORATION_LIMIT) || manifest.hooks.explorationLimit;
  const kind = classify(event.tool_name, event.tool_input);
  const state = readState(event.session_id);
  if (kind === "reset") {
    writeState(event.session_id, { count: 0 });
    allow();
  }
  if (kind === "other") allow();
  const count = (state.count ?? 0) + 1;
  writeState(event.session_id, { count });
  if (count <= limit) allow();
  const hint = `${count - 1} exploration calls in a row since your last prompt, edit or subagent (limit ${limit}): hand the rest of the exploration to the \`runner\` agent (facts, file:line) or an \`Explore\` subagent, and keep only quick single reads inline.`;
  if (kind === "read") allowWithContext(`factory delegate-exploration: ${hint}`);
  deny(`Blocked in the lead session (factory delegate-exploration): ${hint}`);
};

if (isMain(import.meta.url)) main();
