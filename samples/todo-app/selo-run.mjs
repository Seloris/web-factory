// Starts this project's app outside a Claude Code session, on this worktree's slot, like /selo:run:
//   node selo-run.mjs [component … | all] [--demo]    in the foreground; Ctrl+C stops every component
//   node selo-run.mjs --stop                           stops the run of this folder
// Written by the selo plugin's setup (rewritten by setup update): it finds the plugin installed for this
// project and runs its scripts/run.mjs. SELO_PLUGIN_ROOT, when set, names the plugin's folder instead.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const same = (a, b) => resolve(a).replace(/\\/g, "/").toLowerCase() === resolve(b).replace(/\\/g, "/").toLowerCase();

const pluginRoot = () => {
  if (process.env.SELO_PLUGIN_ROOT) return process.env.SELO_PLUGIN_ROOT;
  const file = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "plugins", "installed_plugins.json");
  const installs = existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")).plugins?.["selo@selo"] ?? []) : [];
  // A worktree's installs are listed under the main checkout: the folder holding the git common dir.
  let main = here;
  try {
    main = dirname(execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd: here, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim());
  } catch {
    // not a git repository: this folder only
  }
  const found =
    installs.find((i) => i.projectPath && (same(i.projectPath, here) || same(i.projectPath, main))) ?? installs.find((i) => i.scope === "user") ?? installs[0];
  if (!found) throw new Error(`selo is not installed for this project (no selo@selo in ${file}): install it, or set SELO_PLUGIN_ROOT`);
  return found.installPath;
};

try {
  const { main } = await import(pathToFileURL(join(pluginRoot(), "scripts", "run.mjs")).href);
  const code = await main(process.argv.slice(2), { cwd: here });
  if (code) process.exit(code);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
