import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { seloSettings } from "../scripts/settings.mjs";

const script = join(dirname(fileURLToPath(import.meta.url)), "..", "scripts", "settings.mjs");

test("seloSettings: off and ask by default; only `on` and `auto` switch them", () => {
  assert.deepEqual(seloSettings({}), { routing: "off", commit: "ask" });
  assert.deepEqual(seloSettings({ SELO_ROUTING: "on", SELO_COMMIT: "auto" }), { routing: "on", commit: "auto" });
  assert.deepEqual(seloSettings({ SELO_ROUTING: "auto", SELO_COMMIT: "yes" }), { routing: "off", commit: "ask" });
});

test("CLI: prints the settings of its environment as JSON", () => {
  const env = { ...process.env, SELO_ROUTING: "on" };
  delete env.SELO_COMMIT;
  const out = spawnSync(process.execPath, [script], { env, encoding: "utf8" });
  assert.equal(out.status, 0);
  assert.deepEqual(JSON.parse(out.stdout), { routing: "on", commit: "ask" });
});
