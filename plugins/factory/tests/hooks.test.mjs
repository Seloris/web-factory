import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readManifest } from "../scripts/manifest.mjs";
import { verdict } from "../scripts/require-runner.mjs";
import { classify } from "../scripts/delegate-exploration.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const scripts = join(here, "..", "scripts");
const example = join(here, "..", "..", "..", "examples", "two-components");
const manifest = readManifest(example);

const run = (script, event, env = {}) => {
  const r = spawnSync(process.execPath, [join(scripts, script)], { input: JSON.stringify(event), encoding: "utf8", env: { ...process.env, FACTORY_ALLOW_INLINE_RUNS: "", ...env } });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.trim() ? JSON.parse(r.stdout) : null;
};

const decision = (out) => out?.hookSpecificOutput?.permissionDecision ?? "allow";

test("require-runner: verdicts", () => {
  assert.equal(verdict("git status", manifest), null);
  assert.match(verdict("node scripts/echo.mjs build api", manifest), /`build` command of component `api`/);
  assert.match(verdict("cd api && node scripts/echo.mjs lint api src/a.ts", manifest), /`lint`/);
  assert.match(verdict("grep -rn foo src", manifest), /repo-wide shell search/);
  assert.match(verdict("rg foo", manifest), /repo-wide/);
  assert.match(verdict("find . -name '*.cs'", manifest), /repo-wide/);
  assert.match(verdict("npm ci", manifest), /package restore/);
  assert.equal(verdict('git commit -m "node scripts/echo.mjs build api"', manifest), null, "quoted text is ignored");
});

test("require-runner: hook denies the lead, lets subagents through", () => {
  const event = { session_id: "t1", cwd: example, tool_name: "Bash", tool_input: { command: "node scripts/echo.mjs test api" } };
  assert.equal(decision(run("require-runner.mjs", event)), "deny");
  assert.equal(decision(run("require-runner.mjs", { ...event, agent_id: "sub" })), "allow");
  assert.equal(decision(run("require-runner.mjs", event, { FACTORY_ALLOW_INLINE_RUNS: "1" })), "allow");
  assert.equal(decision(run("require-runner.mjs", { ...event, cwd: "/" })), "allow", "a project's command is unknown outside the project");
  assert.equal(decision(run("require-runner.mjs", { ...event, cwd: "/", tool_input: { command: "grep -r foo ." } })), "deny", "searches are denied even outside a project");
});

test("require-runner: outside a factory project only generic rules apply", () => {
  const event = { session_id: "t1", cwd: "/", tool_name: "Bash", tool_input: { command: "dotnet build" } };
  assert.equal(decision(run("require-runner.mjs", event)), "allow");
});

test("delegate-exploration: classify", () => {
  assert.equal(classify("Read", {}), "read");
  assert.equal(classify("Grep", {}), "search");
  assert.equal(classify("Bash", { command: "git log --oneline" }), "search");
  assert.equal(classify("Bash", { command: "git commit -m x" }), "other");
  assert.equal(classify("Edit", {}), "reset");
  assert.equal(classify("Agent", {}), "reset");
});

test("delegate-exploration: counts, denies past the limit, resets on prompt and edit", () => {
  const session = `t-${Date.now()}`;
  const ev = (tool_name, tool_input = {}) => ({ session_id: session, cwd: example, tool_name, tool_input });
  run("reset-exploration.mjs", { session_id: session });
  for (let i = 0; i < 4; i++) assert.equal(decision(run("delegate-exploration.mjs", ev("Grep"))), "allow", `call ${i + 1}`);
  assert.equal(decision(run("delegate-exploration.mjs", ev("Glob"))), "deny");
  const read = run("delegate-exploration.mjs", ev("Read"));
  assert.equal(decision(read), "allow");
  assert.match(read.hookSpecificOutput.additionalContext, /hand the rest/);
  run("delegate-exploration.mjs", ev("Edit"));
  assert.equal(decision(run("delegate-exploration.mjs", ev("Grep"))), "allow");
  for (let i = 0; i < 4; i++) run("delegate-exploration.mjs", ev("Grep"));
  assert.equal(decision(run("delegate-exploration.mjs", ev("Grep"))), "deny");
  run("reset-exploration.mjs", { session_id: session });
  assert.equal(decision(run("delegate-exploration.mjs", ev("Grep"))), "allow");
  assert.equal(decision(run("delegate-exploration.mjs", { ...ev("Grep"), agent_id: "sub" })), "allow");
});
