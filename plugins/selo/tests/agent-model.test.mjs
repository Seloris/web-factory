import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { enforceModel, hookOutput } from "../scripts/agent-model.mjs";
import { resolveModels } from "../scripts/manifest.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "scripts", "agent-model.mjs");
const standard = resolveModels("standard");

// A throwaway project: a `.git` folder bounds findRoot; `models` is written as given (null: no key).
const project = (models) => {
  const dir = mkdtempSync(join(tmpdir(), "selo-agent-model-"));
  mkdirSync(join(dir, ".git"));
  const lines = ["name: demo"];
  if (models !== null) lines.push(models);
  lines.push("components:", "  - name: api", "    path: api");
  writeFileSync(join(dir, "selo.yaml"), lines.join("\n") + "\n");
  return dir;
};

const event = (cwd, tool_input) => ({ hook_event_name: "PreToolUse", tool_name: "Agent", cwd, tool_input });

const run = (stdin) => spawnSync(process.execPath, [script], { input: stdin, encoding: "utf8" });

test("enforceModel: reviewer and runner always take their role's model", () => {
  for (const [type, model] of [["selo:reviewer", "opus"], ["reviewer", "opus"], ["selo:runner", "haiku"], ["runner", "haiku"]]) {
    assert.equal(enforceModel({ subagent_type: type, prompt: "p" }, standard)?.model, model, `${type} with no model`);
    assert.equal(enforceModel({ subagent_type: type, prompt: "p", model: "sonnet" }, standard)?.model, model, `${type} on another model`);
  }
});

test("enforceModel: Explore and Plan take their role's model only when the call names none", () => {
  assert.equal(enforceModel({ subagent_type: "Explore", prompt: "p" }, standard)?.model, "haiku");
  assert.equal(enforceModel({ subagent_type: "Plan", prompt: "p" }, standard)?.model, "opus");
  assert.equal(enforceModel({ subagent_type: "Explore", prompt: "p", model: "sonnet" }, standard), null, "Explore with a model: kept");
  assert.equal(enforceModel({ subagent_type: "Plan", prompt: "p", model: "sonnet" }, standard), null, "Plan with a model: kept");
});

test("enforceModel: any other agent is untouched", () => {
  for (const type of ["general-purpose", "my-agent", "selo:other", undefined]) {
    assert.equal(enforceModel({ subagent_type: type, prompt: "p", model: "sonnet" }, standard), null, String(type));
    assert.equal(enforceModel({ subagent_type: type, prompt: "p" }, standard), null, String(type));
  }
});

test("enforceModel: a call already on its model gives nothing", () => {
  assert.equal(enforceModel({ subagent_type: "selo:reviewer", model: "opus" }, standard), null);
  assert.equal(enforceModel({ subagent_type: "runner", model: "haiku" }, standard), null);
});

test("enforceModel: every other field of tool_input kept", () => {
  const input = { subagent_type: "selo:runner", description: "runner · web tests", prompt: "run the tests", model: "opus", run_in_background: true, isolation: "worktree", extra: { a: [1, 2] } };
  assert.deepEqual(enforceModel(input, standard), { ...input, model: "haiku" });
  assert.equal(input.model, "opus", "the call's input is not mutated");
});

test("hookOutput: the PreToolUse output, updatedInput only, no permission decision", () => {
  const dir = project("models: standard");
  try {
    const input = { subagent_type: "selo:reviewer", description: "reviewer · work", prompt: "review", model: "sonnet" };
    assert.deepEqual(hookOutput(event(dir, input)), { hookSpecificOutput: { hookEventName: "PreToolUse", updatedInput: { ...input, model: "opus" } } });
    mkdirSync(join(dir, "web", "src"), { recursive: true });
    assert.equal(hookOutput(event(join(dir, "web", "src"), input))?.hookSpecificOutput.updatedInput.model, "opus", "selo.yaml found up the cwd");
    assert.equal(hookOutput(event(dir, { ...input, model: "opus" })), null, "already right");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hookOutput: no models key gives the standard preset", () => {
  const dir = project(null);
  try {
    assert.equal(hookOutput(event(dir, { subagent_type: "Explore", prompt: "p" }))?.hookSpecificOutput.updatedInput.model, "haiku");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hookOutput: a lean preset", () => {
  const dir = project("models: lean");
  try {
    assert.equal(hookOutput(event(dir, { subagent_type: "selo:reviewer", model: "sonnet" }))?.hookSpecificOutput.updatedInput.model, "opus");
    assert.equal(hookOutput(event(dir, { subagent_type: "selo:runner", model: "sonnet" }))?.hookSpecificOutput.updatedInput.model, "haiku");
    assert.equal(hookOutput(event(dir, { subagent_type: "Plan" }))?.hookSpecificOutput.updatedInput.model, "opus");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hookOutput: a map overriding one role", () => {
  const dir = project("models:\n  preset: standard\n  reviewer: fable");
  try {
    assert.equal(hookOutput(event(dir, { subagent_type: "selo:reviewer", model: "opus" }))?.hookSpecificOutput.updatedInput.model, "fable");
    assert.equal(hookOutput(event(dir, { subagent_type: "selo:runner", model: "haiku" })), null, "the other roles keep the preset");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hookOutput: no selo.yaml gives nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-agent-model-"));
  mkdirSync(join(dir, ".git"));
  try {
    assert.equal(hookOutput(event(dir, { subagent_type: "selo:reviewer", model: "sonnet" })), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hookOutput: a broken manifest gives nothing", () => {
  for (const models of ["models: nope", "models:\n  preset: nope"]) {
    const dir = project(models);
    try {
      assert.equal(hookOutput(event(dir, { subagent_type: "selo:reviewer", model: "sonnet" })), null, models);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const dir = mkdtempSync(join(tmpdir(), "selo-agent-model-"));
  mkdirSync(join(dir, ".git"));
  writeFileSync(join(dir, "selo.yaml"), "name: demo\n");
  try {
    assert.equal(hookOutput(event(dir, { subagent_type: "selo:reviewer", model: "sonnet" })), null, "no components");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("script: prints the output, nothing on a broken manifest or bad stdin, always exit 0", () => {
  const dir = project("models: standard");
  const broken = project("models: nope");
  try {
    const ok = run(JSON.stringify(event(dir, { subagent_type: "selo:runner", prompt: "p", model: "opus" })));
    assert.equal(ok.status, 0);
    assert.deepEqual(JSON.parse(ok.stdout), { hookSpecificOutput: { hookEventName: "PreToolUse", updatedInput: { subagent_type: "selo:runner", prompt: "p", model: "haiku" } } });
    const right = run(JSON.stringify(event(dir, { subagent_type: "selo:runner", model: "haiku" })));
    assert.equal(right.status, 0);
    assert.equal(right.stdout, "", "already right");
    const bad = run(JSON.stringify(event(broken, { subagent_type: "selo:runner", model: "opus" })));
    assert.equal(bad.status, 0);
    assert.equal(bad.stdout, "", "broken manifest");
    for (const stdin of ["not json", "", "null", "{}"]) {
      const r = run(stdin);
      assert.equal(r.status, 0, JSON.stringify(stdin));
      assert.equal(r.stdout, "", JSON.stringify(stdin));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(broken, { recursive: true, force: true });
  }
});
