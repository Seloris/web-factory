import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { killTree } from "../scripts/run.mjs";
import { project, start, stopRun, waitFree } from "./fixtures/run-project.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const launcher = join(here, "..", "templates", "selo-run.mjs");

test("selo-run.mjs: finds the plugin installed for the project in installed_plugins.json and runs run.mjs", { timeout: 60000 }, async () => {
  const { dir, base } = project();
  const config = mkdtempSync(join(tmpdir(), "selo-config-"));
  const pids = [];
  try {
    writeFileSync(join(dir, "selo-run.mjs"), readFileSync(launcher, "utf8"));
    mkdirSync(join(config, "plugins"));
    const installPath = join(here, "..");
    const plugins = { "selo-flow@selo": [{ scope: "project", projectPath: dir.replace(/\//g, "\\"), installPath }] };
    writeFileSync(join(config, "plugins", "installed_plugins.json"), JSON.stringify({ version: 2, plugins }));
    const env = { ...process.env, CLAUDE_CONFIG_DIR: config };
    delete env.SELO_PLUGIN_ROOT;
    const { child, run } = await start(dir, join(dir, "selo-run.mjs"), env);
    pids.push(child.pid);
    assert.equal(run.components[0].url, `http://localhost:${base}`);
    stopRun(dir);
    assert.ok(await waitFree(base));

    writeFileSync(join(config, "plugins", "installed_plugins.json"), JSON.stringify({ version: 2, plugins: {} }));
    assert.throws(() => execFileSync(process.execPath, [join(dir, "selo-run.mjs")], { cwd: dir, env, stdio: "pipe" }), /selo is not installed/);
  } finally {
    for (const pid of pids) killTree(pid);
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    rmSync(config, { recursive: true, force: true });
  }
});
