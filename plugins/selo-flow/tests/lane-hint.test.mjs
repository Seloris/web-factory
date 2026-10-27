import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HINT, hookOutput, personText } from "../scripts/lane-hint.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "scripts", "lane-hint.mjs");
const ON = { SELO_ROUTING: "on" };

// A throwaway project: a `.git` folder bounds findRoot.
const project = () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-lane-hint-"));
  mkdirSync(join(dir, ".git"));
  writeFileSync(join(dir, "selo.yaml"), "name: demo\ncomponents:\n  - name: api\n    path: api\n");
  return dir;
};
const event = (cwd, prompt) => ({ hook_event_name: "UserPromptSubmit", cwd, prompt });
const hint = (out) => out?.hookSpecificOutput?.additionalContext ?? null;

test("personText: leading blocks dropped, a pasted block unwrapped, an unclosed tag kept", () => {
  assert.equal(personText('<artifact-view-context id="1">x</artifact-view-context>\n  /selo-flow:fastlane a'), "/selo-flow:fastlane a");
  assert.equal(personText("<pasted_content>change the title</pasted_content> please"), "change the title please");
  assert.equal(personText('<agent-message from="a1">report</agent-message>'), "");
  assert.equal(personText("<b>bold, unclosed"), "<b>bold, unclosed");
});

test("hookOutput: SELO_ROUTING=on adds the pilot note on a free request", () => {
  const dir = project();
  try {
    const out = hookOutput(event(dir, "Change le libellé du bouton"), ON);
    assert.equal(out.hookSpecificOutput.hookEventName, "UserPromptSubmit");
    assert.equal(hint(out), HINT);
    assert.match(HINT, /selo-flow:pilot/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hookOutput: nothing when SELO_ROUTING is absent or not `on`", () => {
  const dir = project();
  try {
    for (const env of [{}, { SELO_ROUTING: "off" }, { SELO_ROUTING: "auto" }]) {
      assert.equal(hookOutput(event(dir, "Change le libellé"), env), null, JSON.stringify(env));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hookOutput: nothing on a slash command, a wrapped one, or the harness's blocks alone", () => {
  const dir = project();
  try {
    for (const prompt of ["/selo-flow:fastlane x", "<system-reminder>r</system-reminder>/compact", '<agent-message from="a1">done</agent-message>', "<task-notification>t</task-notification>", "  "]) {
      assert.equal(hookOutput(event(dir, prompt), ON), null, prompt);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hookOutput: nothing outside a selo project", () => {
  const plain = mkdtempSync(join(tmpdir(), "selo-lane-hint-"));
  mkdirSync(join(plain, ".git"));
  try {
    assert.equal(hookOutput(event(plain, "Change x"), ON), null);
  } finally {
    rmSync(plain, { recursive: true, force: true });
  }
});

test("CLI: prints the note as JSON with SELO_ROUTING=on, nothing on bad input or off, always exit 0", () => {
  const dir = project();
  const run = (input, env) => spawnSync(process.execPath, [script], { input, env: { ...process.env, SELO_ROUTING: "", ...env }, encoding: "utf8" });
  try {
    const ok = run(JSON.stringify(event(dir, "Ajoute un filtre")), ON);
    assert.equal(ok.status, 0);
    assert.equal(hint(JSON.parse(ok.stdout)), HINT);
    const off = run(JSON.stringify(event(dir, "Ajoute un filtre")), {});
    assert.equal(off.status, 0);
    assert.equal(off.stdout, "");
    const bad = run("not json", ON);
    assert.equal(bad.status, 0);
    assert.equal(bad.stdout, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
