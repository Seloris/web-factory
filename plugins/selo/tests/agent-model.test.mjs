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
const standard = resolveModels({});

// A throwaway project: a `.git` folder bounds findRoot. The models are the person's: the `env` of each call.
const project = (yaml = "name: demo\ncomponents:\n  - name: api\n    path: api\n") => {
  const dir = mkdtempSync(join(tmpdir(), "selo-agent-model-"));
  mkdirSync(join(dir, ".git"));
  writeFileSync(join(dir, "selo.yaml"), yaml);
  return dir;
};

const event = (cwd, tool_input) => ({ hook_event_name: "PreToolUse", tool_name: "Agent", cwd, tool_input });

// The person's own SELO_MODEL* never reach the script: only the `models` given.
const run = (stdin, models = {}) => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("SELO_MODEL")));
  return spawnSync(process.execPath, [script], { input: stdin, encoding: "utf8", env: { ...env, ...models } });
};

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
  const dir = project();
  try {
    const input = { subagent_type: "selo:reviewer", description: "reviewer · work", prompt: "review", model: "sonnet" };
    assert.deepEqual(hookOutput(event(dir, input), {}), { hookSpecificOutput: { hookEventName: "PreToolUse", updatedInput: { ...input, model: "opus" } } });
    mkdirSync(join(dir, "web", "src"), { recursive: true });
    assert.equal(hookOutput(event(join(dir, "web", "src"), input), {})?.hookSpecificOutput.updatedInput.model, "opus", "selo.yaml found up the cwd");
    assert.equal(hookOutput(event(dir, { ...input, model: "opus" }), {}), null, "already right");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hookOutput: no setting gives the standard preset", () => {
  const dir = project();
  try {
    assert.equal(hookOutput(event(dir, { subagent_type: "Explore", prompt: "p" }), {})?.hookSpecificOutput.updatedInput.model, "haiku");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hookOutput: the person's lean preset", () => {
  const dir = project();
  const lean = { SELO_MODELS: "lean" };
  try {
    assert.equal(hookOutput(event(dir, { subagent_type: "selo:reviewer", model: "sonnet" }), lean)?.hookSpecificOutput.updatedInput.model, "opus");
    assert.equal(hookOutput(event(dir, { subagent_type: "selo:runner", model: "sonnet" }), lean)?.hookSpecificOutput.updatedInput.model, "haiku");
    assert.equal(hookOutput(event(dir, { subagent_type: "Plan" }), lean)?.hookSpecificOutput.updatedInput.model, "opus");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hookOutput: the person overriding one role", () => {
  const dir = project();
  const env = { SELO_MODEL_REVIEWER: "fable" };
  try {
    assert.equal(hookOutput(event(dir, { subagent_type: "selo:reviewer", model: "opus" }), env)?.hookSpecificOutput.updatedInput.model, "fable");
    assert.equal(hookOutput(event(dir, { subagent_type: "selo:runner", model: "haiku" }), env), null, "the other roles keep the preset");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hookOutput: an unknown preset reads as standard", () => {
  const dir = project();
  try {
    assert.equal(hookOutput(event(dir, { subagent_type: "selo:reviewer", model: "sonnet" }), { SELO_MODELS: "nope" })?.hookSpecificOutput.updatedInput.model, "opus");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hookOutput: no selo.yaml gives nothing", () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-agent-model-"));
  mkdirSync(join(dir, ".git"));
  try {
    assert.equal(hookOutput(event(dir, { subagent_type: "selo:reviewer", model: "sonnet" }), {}), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hookOutput: a broken manifest gives nothing", () => {
  const dir = project("name: demo\n");
  try {
    assert.equal(hookOutput(event(dir, { subagent_type: "selo:reviewer", model: "sonnet" }), {}), null, "no components");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("script: prints the output from the person's environment, nothing on a broken manifest or bad stdin, always exit 0", () => {
  const dir = project();
  const broken = project("name: demo\n");
  try {
    const ok = run(JSON.stringify(event(dir, { subagent_type: "selo:runner", prompt: "p", model: "opus" })));
    assert.equal(ok.status, 0);
    assert.deepEqual(JSON.parse(ok.stdout), { hookSpecificOutput: { hookEventName: "PreToolUse", updatedInput: { subagent_type: "selo:runner", prompt: "p", model: "haiku" } } });
    const right = run(JSON.stringify(event(dir, { subagent_type: "selo:runner", model: "haiku" })));
    assert.equal(right.status, 0);
    assert.equal(right.stdout, "", "already right");
    const mine = run(JSON.stringify(event(dir, { subagent_type: "selo:runner", model: "haiku" })), { SELO_MODEL_RUNNER: "sonnet" });
    assert.equal(JSON.parse(mine.stdout).hookSpecificOutput.updatedInput.model, "sonnet", "the person's setting");
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
