// The slot files of the app's runs (selo 2.0 §4.8), read by scripts/run.mjs, which starts the runs, and by
// scripts/manifest.mjs, which computes the urls of this root's slot. No import of either: both import it.
// {git-common-dir}/selo/slots/{n}.json, one per slot, shared by every worktree of the repository, each
// read-modify-write under {git-common-dir}/selo/slots.lock.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { uptime } from "node:os";
import { join, resolve } from "node:path";

export const MAX_SLOTS = 20;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The form Selo Ops joins a run on: absolute, forward slashes, drive letter upper case.
export const normRoot = (p) => resolve(p).replace(/\\/g, "/").replace(/^[a-z]:/, (d) => d.toUpperCase());

// {git-common-dir}/selo: one per repository, whatever the worktree.
export const seloDir = (root) =>
  join(execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(), "selo");

export const isAlive = (pid) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
};

// When this machine booted: a run recorded before it is dead, whatever its pids (Windows reuses them fast).
export const bootTime = () => Date.now() - uptime() * 1000;

// A run is live while it is not stopped, was recorded since this boot, and its supervisor or one of its
// components is alive.
// shortcut: a pid reused within the same boot still reads as alive; record each process's start time if it bites.
export const isLive = (rec, alive = isAlive) =>
  !!rec && rec.stoppedAt == null && rec.boot != null && Math.abs(rec.boot - bootTime()) < 120000 && (alive(rec.pid) || (rec.components ?? []).some((c) => alive(c.pid)));

export const readSlots = (dir) =>
  existsSync(join(dir, "slots"))
    ? readdirSync(join(dir, "slots"))
        .filter((f) => /^\d+\.json$/.test(f))
        .map((f) => {
          try {
            return JSON.parse(readFileSync(join(dir, "slots", f), "utf8"));
          } catch {
            return null;
          }
        })
        .filter(Boolean)
    : [];

export const writeSlot = (dir, rec) => {
  mkdirSync(join(dir, "slots"), { recursive: true });
  writeFileSync(join(dir, "slots", `${rec.slot}.json`), JSON.stringify(rec, null, 2) + "\n");
};

const latest = (recs) => [...recs].sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)))[0];

// The slot rules of §4.8: this root's live run, else the slot it had last when free, else the lowest
// free one. Free: no live run holds it and every port it would use is free.
export const chooseSlot = async ({ records, root, alive = isAlive, portsFree }) => {
  const mine = records.filter((r) => r.root === root);
  const live = mine.find((r) => isLive(r, alive));
  if (live) return { slot: live.slot, reused: true };
  const free = async (n) => !isLive(records.find((r) => r.slot === n), alive) && (await portsFree(n));
  const last = latest(mine);
  if (last && (await free(last.slot))) return { slot: last.slot, reused: false };
  for (let n = 0; n < MAX_SLOTS; n++) if (await free(n)) return { slot: n, reused: false };
  throw new Error(`No free slot among the first ${MAX_SLOTS}: stop a run (node run.mjs --stop) or free its ports`);
};

// This root's slot for the manifest's urls: its live run, else the slot it had last, else 0.
export const currentSlot = (root) => {
  try {
    const mine = readSlots(seloDir(root)).filter((r) => r.root === normRoot(root));
    return (mine.find((r) => isLive(r)) ?? latest(mine))?.slot ?? 0;
  } catch {
    return 0;
  }
};

// A short lock around every read-modify-write of the slot files: an atomic mkdir, its holder's pid inside.
export const withLock = async (dir, fn, { timeoutMs = 15000, staleMs = 30000 } = {}) => {
  const lock = join(dir, "slots.lock");
  mkdirSync(dir, { recursive: true });
  const until = Date.now() + timeoutMs;
  for (;;) {
    try {
      mkdirSync(lock);
      writeFileSync(join(lock, "pid"), String(process.pid));
      break;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      let stale = false;
      try {
        const old = Date.now() - statSync(lock).mtimeMs > staleMs;
        const holder = existsSync(join(lock, "pid")) ? Number(readFileSync(join(lock, "pid"), "utf8")) : null;
        stale = old || (holder !== null && !isAlive(holder));
      } catch {
        // released meanwhile: try again
      }
      if (stale) rmSync(lock, { recursive: true, force: true });
      else if (Date.now() > until) throw new Error(`${lock} is held by another run: try again`);
      else await sleep(50);
    }
  }
  try {
    return await fn();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
};

