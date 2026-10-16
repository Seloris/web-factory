// PreToolUse hook on Bash: in the lead session, denies the commands the manifest declares for its
// components (build, test, lint, handoff, prepare, integration tests), package restores and
// repo-wide shell searches, so the lead hands them to the `runner` agent (or Grep/Glob) and reads
// a short report instead of raw output. Subagents are never blocked: the event carries an
// `agent_id` only when the call comes from one.
// Off when the manifest says `hooks.require_runner: false`, or for humans with
// FACTORY_ALLOW_INLINE_RUNS=1 in the environment Claude Code starts from.

import { allow, deny, guardsOff, isMain, manifestFor, readEvent, unquoted } from "./hook-io.mjs";
import { declaredCommands } from "./manifest.mjs";

const RESTORES = [/\bnpm (?:install|ci|i)\b/, /\bpnpm (?:install|i)\b/, /\byarn(?: install)?\b/, /\bdotnet restore\b/, /\bpip install\b/, /\bcomposer install\b/, /\bbundle install\b/];
const SEARCHES = [/\bgrep\b[^|]*\s-[a-zA-Z]*r/, /\brg\b/, /\bfind\b[^|]*\s-(?:i?name|path)\b/, /\bGet-ChildItem\b[^|]*-Recurse/i, /\bSelect-String\b/i, /\bgci\b[^|]*-r/i];

const normalise = (s) => unquoted(s).replace(/\s+/g, " ").trim();

export const verdict = (command, manifest) => {
  const text = normalise(command);
  if (!text) return null;
  for (const re of SEARCHES) if (re.test(text)) return "a repo-wide shell search: use the Grep or Glob tools, or hand it to the `runner` agent";
  for (const re of RESTORES) if (re.test(text)) return "a package restore: hand it to the `runner` agent and read its report";
  if (manifest)
    for (const c of declaredCommands(manifest)) {
      const prefix = normalise(c.prefix);
      if (prefix && text.includes(prefix)) return `the \`${c.key}\` command of component \`${c.component}\`: hand it to the \`runner\` agent and read its report (errors and warnings with file:line)`;
    }
  return null;
};

const main = async () => {
  const event = await readEvent();
  if (event.agent_id || guardsOff()) allow();
  const manifest = manifestFor(event);
  if (manifest && !manifest.hooks.requireRunner) allow();
  const why = verdict(event.tool_input?.command, manifest);
  if (why) deny(`Blocked in the lead session (factory require-runner): this is ${why}. Builds, tests, lint and searches never run inline here.`);
  allow();
};

if (isMain(import.meta.url)) main();
