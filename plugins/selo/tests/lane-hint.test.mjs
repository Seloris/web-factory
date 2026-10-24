import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { HINTS, hookOutput, personText } from "../scripts/lane-hint.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, "..", "scripts", "lane-hint.mjs");

// A throwaway project: a `.git` folder bounds findRoot; `routing` written as given (null: no key).
const project = (routing, extra = "") => {
  const dir = mkdtempSync(join(tmpdir(), "selo-lane-hint-"));
  mkdirSync(join(dir, ".git"));
  const lines = ["name: demo"];
  if (routing !== null) lines.push(`routing: ${routing}`);
  lines.push("components:", "  - name: api", "    path: api", extra);
  writeFileSync(join(dir, "selo.yaml"), lines.join("\n") + "\n");
  return dir;
};
const event = (cwd, prompt) => ({ hook_event_name: "UserPromptSubmit", cwd, prompt });
const hint = (out) => out?.hookSpecificOutput?.additionalContext ?? null;

test("personText: leading blocks dropped, a pasted block unwrapped, an unclosed tag kept", () => {
  assert.equal(personText('<artifact-view-context id="1">x</artifact-view-context>\n  /selo:fastlane a'), "/selo:fastlane a");
  assert.equal(personText("<pasted_content>change the title</pasted_content> please"), "change the title please");
  assert.equal(personText('<agent-message from="a1">report</agent-message>'), "");
  assert.equal(personText("<b>bold, unclosed"), "<b>bold, unclosed");
});

test("hookOutput: suggest and auto add their note on a free request", () => {
  for (const mode of ["suggest", "auto"]) {
    const dir = project(mode);
    try {
      const out = hookOutput(event(dir, "Change le libellé du bouton"));
      assert.equal(out.hookSpecificOutput.hookEventName, "UserPromptSubmit");
      assert.equal(hint(out), HINTS[mode]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("hookOutput: nothing when routing is off, missing or unknown", () => {
  for (const routing of ["off", null, "always"]) {
    const dir = project(routing);
    try {
      assert.equal(hookOutput(event(dir, "Change le libellé")), null, `routing ${routing}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("hookOutput: nothing on a slash command, a wrapped one, or the harness's blocks alone", () => {
  const dir = project("auto");
  try {
    for (const prompt of ["/selo:fastlane x", "<system-reminder>r</system-reminder>/compact", '<agent-message from="a1">done</agent-message>', "<task-notification>t</task-notification>", "  "]) {
      assert.equal(hookOutput(event(dir, prompt)), null, prompt);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("hookOutput: nothing outside a selo project or on a broken manifest", () => {
  const plain = mkdtempSync(join(tmpdir(), "selo-lane-hint-"));
  mkdirSync(join(plain, ".git"));
  const broken = project("auto", "    needs: [ghost]");
  try {
    assert.equal(hookOutput(event(plain, "Change x")), null);
    assert.equal(hookOutput(event(broken, "Change x")), null);
  } finally {
    rmSync(plain, { recursive: true, force: true });
    rmSync(broken, { recursive: true, force: true });
  }
});

test("CLI: prints the note as JSON, nothing on bad input, always exit 0", () => {
  const dir = project("suggest");
  try {
    const ok = spawnSync(process.execPath, [script], { input: JSON.stringify(event(dir, "Ajoute un filtre")), encoding: "utf8" });
    assert.equal(ok.status, 0);
    assert.equal(hint(JSON.parse(ok.stdout)), HINTS.suggest);
    const bad = spawnSync(process.execPath, [script], { input: "not json", encoding: "utf8" });
    assert.equal(bad.status, 0);
    assert.equal(bad.stdout, "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
