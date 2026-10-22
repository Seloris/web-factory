// Runs a project's components on this worktree's slot (selo 2.0 §4.8), behind /selo:run, try and the
// project's selo-run.mjs. A slot shifts every port by 10 (slot 0 = the base ports), so one copy of the
// app runs per worktree, side by side. The slots are recorded in {git-common-dir}/selo/slots/{n}.json,
// shared by every worktree of the repository, and claimed under {git-common-dir}/selo/slots.lock.
//
// CLI, from the project's root or under it:
//   node run.mjs [component … | all] [--demo] [--timeout S]   start them and their `needs`, in stages order,
//       each awaited on its url; stays in the foreground (Ctrl+C stops what it started), and prints one
//       `SELO_RUN {json}` line once every component answers. Exit 1 on error, 3 when the slot's demo is
//       held by another live run.
//   node run.mjs --stop [component … | all] [--demo]   stop this root's run (or those components of it).

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { createInterface } from "node:readline";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readManifest, SLOT_STEP, stages } from "./manifest.mjs";
import { bootTime, chooseSlot, isAlive, isLive, normRoot, readSlots, seloDir, withLock, writeSlot } from "./slots.mjs";

export { MAX_SLOTS } from "./slots.mjs";

export const BUSY = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

export const envName = (name) => `${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_URL`;

const answers = (port, host) =>
  new Promise((done) => {
    const s = connect({ port, host });
    s.setTimeout(500, () => (s.destroy(), done(false)));
    s.once("connect", () => (s.destroy(), done(true)));
    s.once("error", () => done(false));
  });
// Both stacks: on Windows a server may hold the port on ::1 only, and a listen test would not see it.
export const portFree = async (port) => !(await answers(port, "127.0.0.1")) && !(await answers(port, "::1"));

export const killTree = (pid) => {
  if (!isAlive(pid)) return;
  try {
    if (process.platform === "win32") execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid);
    } catch {
      // already gone
    }
  }
};

// What a run starts: the named components (all by default) and those they need, in stages order, each
// with a command for the mode. The demo needs every one of them to have one; else the dev servers.
export const plan = (manifest, names, demo) => {
  const order = stages(manifest);
  const byName = new Map(order.map((c) => [c.name, c]));
  const wanted = names.length === 0 || names.includes("all") ? order.map((c) => c.name) : names;
  for (const n of wanted) if (!byName.has(n)) throw new Error(`Unknown component "${n}" (known: ${[...byName.keys()].join(", ")})`);
  const needed = new Set();
  const add = (n) => {
    if (needed.has(n)) return;
    needed.add(n);
    byName.get(n).needs.forEach(add);
  };
  wanted.forEach(add);
  const runs = order.filter((c) => needed.has(c.name) && (c.commands.serve || c.commands.demo));
  const mode = demo && runs.every((c) => c.commands.demo) ? "demo" : "dev";
  const note = demo && mode === "dev" ? `no demo for ${runs.filter((c) => !c.commands.demo).map((c) => c.name).join(", ")}: the dev servers instead` : null;
  const units = runs
    .filter((c) => (mode === "demo" ? c.commands.demo : c.commands.serve))
    .map((c) => {
      const port = mode === "demo" ? c.demoPort : c.port;
      if (port == null) throw new Error(`Component "${c.name}" has no ${mode === "demo" ? "demo_port" : "port"}: add it to its component block (docs/manifest.md)`);
      return { name: c.name, path: c.path, needs: c.needs, command: mode === "demo" ? c.commands.demo : c.commands.serve, port };
    });
  if (units.length === 0) throw new Error(`Nothing to run: no ${mode === "demo" ? "demo" : "serve"} command among ${wanted.join(", ")}`);
  return { mode, note, units, ports: Object.fromEntries(runs.map((c) => [c.name, mode === "demo" ? c.demoPort : c.port])) };
};

const urlOf = (port, slot) => `http://localhost:${port + SLOT_STEP * slot}`;

// The environment a component starts with: its port on the slot, the slot, its peers' urls.
export const envFor = (unit, slot, ports) => {
  const env = { PORT: String(unit.port + SLOT_STEP * slot), SELO_SLOT: String(slot) };
  for (const n of unit.needs) if (ports[n] != null) env[envName(n)] = urlOf(ports[n], slot);
  return env;
};

const answering = async (url) => {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
};

const parseArgs = (argv) => {
  const args = [...argv];
  const flag = (f) => (args.includes(f) ? (args.splice(args.indexOf(f), 1), true) : false);
  const at = args.indexOf("--timeout");
  const timeout = at < 0 ? 60 : Number(args.splice(at, 2)[1]);
  return { stop: flag("--stop"), demo: flag("--demo"), timeout, names: args };
};

const stop = async ({ root, dir, names, demo, out }) => {
  const stopped = await withLock(dir, async () => {
    const rec = readSlots(dir).find((r) => r.root === root && isLive(r));
    if (!rec) return null;
    const all = names.length === 0 || names.includes("all");
    // Components named: that mode only (dev without --demo), so a test's demo stop never hits the dev servers.
    const modeOk = (c) => (demo ? c.mode === "demo" : all || c.mode === "dev");
    const hit = rec.components.filter((c) => (all || names.includes(c.name)) && modeOk(c));
    // Only the components: a supervisor ends by itself with its last child, and one still starting has
    // entries that carry its own pid.
    hit.forEach((c) => killTree(c.pid));
    rec.components = rec.components.filter((c) => !hit.includes(c) && isAlive(c.pid));
    if (rec.components.length === 0) rec.stoppedAt = now();
    if (!rec.components.some((c) => c.mode === "demo")) rmSync(join(dir, "slots", `${rec.slot}.demo.lock`), { force: true });
    writeSlot(dir, rec);
    return { slot: rec.slot, hit };
  });
  if (!stopped) out("Nothing running for this root.");
  else out(`Slot ${stopped.slot}: stopped ${stopped.hit.map((c) => `${c.name} (${c.mode})`).join(", ") || "nothing"}.`);
  return 0;
};

export const main = async (argv, { cwd = process.cwd(), out = (l) => console.log(l) } = {}) => {
  const opts = parseArgs(argv);
  const manifest = readManifest(cwd);
  const root = normRoot(manifest.root);
  const dir = seloDir(manifest.root);
  if (opts.stop) return stop({ root, dir, names: opts.names, demo: opts.demo, out });

  const { mode, note, units, ports } = plan(manifest, opts.names, opts.demo);
  if (note) out(note);
  const children = new Map(); // name → child process this run started
  let demoLock = null;

  // Claim: the slot, the demo lock, an entry per component to start (its pid ours until it is spawned).
  const claim = await withLock(dir, async () => {
    const records = readSlots(dir);
    const portsFree = async (n) => (await Promise.all(units.map((u) => portFree(u.port + SLOT_STEP * n)))).every(Boolean);
    const { slot, reused } = await chooseSlot({ records, root, portsFree });
    const rec = reused ? records.find((r) => r.slot === slot) : { slot, root, pid: process.pid, boot: bootTime(), startedAt: now(), stoppedAt: null, components: [] };
    rec.components = rec.components.filter((c) => isAlive(c.pid));
    const running = units.filter((u) => rec.components.some((c) => c.name === u.name && c.mode === mode));
    const toStart = units.filter((u) => !running.includes(u));
    // The slot's demo serves one session at a time: busy while another live run holds it or runs it.
    if (mode === "demo") {
      const lock = join(dir, "slots", `${slot}.demo.lock`);
      const holder = existsSync(lock) ? Number(readFileSync(lock, "utf8")) : null;
      if (running.length || (holder && isAlive(holder))) return { busy: holder || rec.pid, slot };
      mkdirSync(join(dir, "slots"), { recursive: true });
      writeFileSync(lock, String(process.pid));
      demoLock = lock;
    }
    for (const u of toStart) {
      if (!(await portFree(u.port + SLOT_STEP * slot))) throw new Error(`Port ${u.port + SLOT_STEP * slot} of ${u.name} on slot ${slot} is taken by another process: stop it, or stop this run (--stop)`);
      rec.components.push({ name: u.name, mode, url: urlOf(u.port, slot), pid: process.pid });
    }
    writeSlot(dir, rec);
    return { slot, reused, rec, running, toStart };
  });
  if (claim.busy) {
    out(`The demo of slot ${claim.slot} is held by another run (pid ${claim.busy}): try again later.`);
    return BUSY;
  }
  const { slot, toStart } = claim;

  const update = (fn) =>
    withLock(dir, async () => {
      const rec = readSlots(dir).find((r) => r.slot === slot);
      if (rec) {
        fn(rec);
        writeSlot(dir, rec);
      }
    });

  let ending = false;
  const end = async (code) => {
    if (ending) return;
    ending = true;
    for (const child of children.values()) killTree(child.pid);
    const mine = new Set([process.pid, ...[...children.values()].map((c) => c.pid)]);
    await update((rec) => {
      rec.components = rec.components.filter((c) => !mine.has(c.pid) && isAlive(c.pid));
      if (rec.components.length === 0) rec.stoppedAt = now();
    }).catch(() => {});
    if (demoLock) rmSync(demoLock, { force: true });
    process.exit(code);
  };
  // Before the first spawn: a Ctrl+C while a component starts still stops what was started.
  if (toStart.length) for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"]) process.on(signal, () => end(0));

  for (const u of toStart) {
    const child = spawn(u.command, {
      cwd: join(manifest.root, u.path),
      env: { ...process.env, ...envFor(u, slot, ports) },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32", // its own process group, killed whole
      windowsHide: true,
    });
    children.set(u.name, child);
    for (const stream of [child.stdout, child.stderr]) createInterface({ input: stream }).on("line", (l) => out(`[${u.name}] ${l}`));
    let exited = null;
    child.once("exit", (code) => {
      exited = code ?? "signal";
      children.delete(u.name);
      if (!ending) {
        out(`${u.name} stopped (exit ${exited}).`);
        update((rec) => (rec.components = rec.components.filter((c) => c.pid !== child.pid))).then(() => children.size === 0 && end(0));
      }
    });
    await update((rec) => {
      const entry = rec.components.find((c) => c.name === u.name && c.mode === mode && c.pid === process.pid);
      if (entry) entry.pid = child.pid;
    });
    const url = urlOf(u.port, slot);
    const until = Date.now() + opts.timeout * 1000;
    while (!(await answering(url))) {
      if (exited !== null || Date.now() > until) {
        out(exited !== null ? `${u.name} exited (${exited}) before answering on ${url}.` : `${u.name} did not answer on ${url} within ${opts.timeout} s.`);
        await end(1);
      }
      await sleep(250);
    }
  }

  const components = units.map((u) => ({ name: u.name, mode, url: urlOf(u.port, slot), started: toStart.includes(u) }));
  for (const c of components) out(`${c.name}  ${c.url}${c.started ? "" : "  (already running)"}`);
  out(`SELO_RUN ${JSON.stringify({ slot, mode, root, components })}`);
  // Nothing started: the process ends here. Else its children keep it alive until they stop.
  return 0;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(
    (code) => code && process.exit(code),
    (e) => {
      process.stderr.write(`${e.message}\n`);
      process.exit(1);
    },
  );
}
