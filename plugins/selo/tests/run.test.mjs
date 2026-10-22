import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { envFor, envName, killTree, plan } from "../scripts/run.mjs";
import { project, runScript, slotFile, start, stopRun, waitFree } from "./fixtures/run-project.mjs";
import { chooseSlot, isAlive, normRoot, withLock } from "../scripts/slots.mjs";
import { readManifest } from "../scripts/manifest.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const example = join(here, "..", "examples", "two-components");

const alive = (pids) => (pid) => pids.includes(pid);
const allFree = async () => true;

test("chooseSlot: this root's live run is reused", async () => {
  const records = [{ slot: 2, root: "C:/a", pid: 10, stoppedAt: null, components: [] }];
  assert.deepEqual(await chooseSlot({ records, root: "C:/a", alive: alive([10]), portsFree: allFree }), { slot: 2, reused: true });
});

test("chooseSlot: else the slot this root had last, when free", async () => {
  const records = [
    { slot: 1, root: "C:/a", pid: 10, startedAt: "2026-10-20", stoppedAt: "x", components: [] },
    { slot: 3, root: "C:/a", pid: 11, startedAt: "2026-10-21", stoppedAt: "x", components: [] },
  ];
  assert.deepEqual(await chooseSlot({ records, root: "C:/a", alive: alive([]), portsFree: allFree }), { slot: 3, reused: false });
});

test("chooseSlot: else the lowest free slot; a live run of another root holds its slot, a dead pid frees it", async () => {
  const records = [
    { slot: 0, root: "C:/b", pid: 20, stoppedAt: null, components: [] },
    { slot: 1, root: "C:/c", pid: 21, stoppedAt: null, components: [{ name: "web", pid: 22 }] },
    { slot: 2, root: "C:/d", pid: 23, stoppedAt: null, components: [] },
  ];
  assert.equal((await chooseSlot({ records, root: "C:/a", alive: alive([20, 22]), portsFree: allFree })).slot, 2, "slot 2's pid is dead");
  assert.equal((await chooseSlot({ records, root: "C:/a", alive: alive([20, 22, 23]), portsFree: allFree })).slot, 3);
});

test("chooseSlot: a taken port moves the run to the next slot, its last slot included", async () => {
  const records = [{ slot: 0, root: "C:/a", pid: 10, startedAt: "t", stoppedAt: "x", components: [] }];
  const portsFree = async (n) => n !== 0 && n !== 1;
  assert.equal((await chooseSlot({ records, root: "C:/a", alive: alive([]), portsFree })).slot, 2);
  await assert.rejects(chooseSlot({ records: [], root: "C:/a", alive: alive([]), portsFree: async () => false }), /No free slot/);
});

test("normRoot, envName, envFor: the root's form, the peers' urls on the slot", () => {
  assert.match(normRoot("."), /^([A-Z]:)?\//);
  assert.ok(!normRoot(".").includes("\\"));
  assert.equal(envName("api"), "API_URL");
  assert.equal(envName("billing-api"), "BILLING_API_URL");
  assert.deepEqual(envFor({ port: 5173, needs: ["api"] }, 2, { api: 3000, web: 5173 }), { PORT: "5193", SELO_SLOT: "2", API_URL: "http://localhost:3020" });
});

test("plan: needs pulled in, stages order, demo when every one has one, else the dev servers", () => {
  const m = readManifest(example);
  const dev = plan(m, ["web"], false);
  assert.equal(dev.mode, "dev");
  assert.deepEqual(dev.units.map((u) => [u.name, u.port]), [["api", 3000], ["web", 4200]]);
  const demo = plan(m, [], true);
  assert.equal(demo.mode, "demo");
  assert.deepEqual(demo.units.map((u) => [u.name, u.port, u.command]), [["api", 3101, "node scripts/echo.mjs demo api"], ["web", 5181, "node scripts/echo.mjs demo web"]]);
  delete m.components[0].commands.demo;
  const fallback = plan(m, ["web"], true);
  assert.equal(fallback.mode, "dev");
  assert.match(fallback.note, /no demo for api/);
  assert.equal(plan(m, ["api"], false).units.length, 1, "api needs nothing");
  assert.throws(() => plan(m, ["nope"], false), /Unknown component "nope"/);
  m.components[0].port = null;
  assert.throws(() => plan(m, ["api"], false), /"api" has no port/);
});

test("withLock: serialises, and takes over a lock whose holder is dead", async () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-lock-"));
  try {
    const order = [];
    await Promise.all([1, 2].map((n) => withLock(dir, async () => (order.push(`in${n}`), await new Promise((r) => setTimeout(r, 30)), order.push(`out${n}`)))));
    assert.deepEqual(order.map((s) => s.slice(0, -1)), ["in", "out", "in", "out"], "never two holders at once");
    mkdirSync(join(dir, "slots.lock"));
    writeFileSync(join(dir, "slots.lock", "pid"), "999999");
    assert.equal(isAlive(999999), false);
    assert.equal(await withLock(dir, async () => "taken over", { timeoutMs: 500 }), "taken over");
    assert.equal(existsSync(join(dir, "slots.lock")), false, "released");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------- a real run ----------


test("run.mjs: a taken port moves the run to slot 1, --stop frees it, the next run gets slot 1 back", { timeout: 60000 }, async () => {
  const { dir, base } = project();
  const squatter = createServer().listen(base);
  const pids = [];
  try {
    const { child, run } = await start(dir);
    pids.push(child.pid);
    assert.equal(run.slot, 1);
    assert.deepEqual(run.components, [{ name: "srv", mode: "dev", url: `http://localhost:${base + 10}`, started: true }]);
    assert.equal(await (await fetch(run.components[0].url)).text(), "1", "SELO_SLOT and PORT reached the component");
    const rec = slotFile(dir, 1);
    assert.equal(rec.root, normRoot(dir));
    assert.equal(rec.pid, child.pid);
    assert.ok(isAlive(rec.components[0].pid));
    pids.push(rec.components[0].pid);

    const again = execFileSync(process.execPath, [runScript], { cwd: dir, encoding: "utf8" });
    assert.match(again, /"started":false/, "a second call reuses the live run");

    assert.match(stopRun(dir), /Slot 1: stopped srv \(dev\)/);
    assert.ok(await waitFree(base + 10), "the component's port is free again");
    assert.notEqual(slotFile(dir, 1).stoppedAt, null);
    assert.match(stopRun(dir), /Nothing running/);

    squatter.close();
    const second = await start(dir);
    pids.push(second.child.pid);
    assert.equal(second.run.slot, 1, "the slot this root had last, still free");
    stopRun(dir);
    assert.ok(await waitFree(base + 10));
  } finally {
    squatter.close();
    for (const pid of pids) killTree(pid);
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
