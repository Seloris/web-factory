// A throwaway selo project with one component, a real HTTP server on PORT, for the run tests.
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { portFree } from "../../scripts/run.mjs";

export const runScript = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "scripts", "run.mjs");

export const project = () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-run-"));
  const base = 41000 + Math.floor(Math.random() * 2000) * 10;
  execFileSync("git", ["init", "-q"], { cwd: dir });
  writeFileSync(join(dir, "selo.yaml"), `name: r\ncomponents:\n  - {name: srv, path: srv, port: ${base}}\n`);
  mkdirSync(join(dir, "srv"));
  writeFileSync(join(dir, "srv", "CLAUDE.md"), "```component\nkind: api\ncommands:\n  build: b\n  serve: node server.mjs\n```\n");
  writeFileSync(
    join(dir, "srv", "server.mjs"),
    'import { createServer } from "node:http";\ncreateServer((q, s) => s.end(process.env.SELO_SLOT)).listen(Number(process.env.PORT));\n',
  );
  return { dir, base };
};

// Starts a run in the background and resolves with its SELO_RUN line, or rejects with its output.
export const start = (cwd, script = runScript, env = process.env) =>
  new Promise((done, fail) => {
    const child = spawn(process.execPath, [script, "--timeout", "20"], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let text = "";
    const onData = (d) => {
      text += d;
      const line = text.split("\n").find((l) => l.startsWith("SELO_RUN "));
      if (line) done({ child, run: JSON.parse(line.slice(9)) });
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", (d) => (text += d));
    child.once("exit", (code) => fail(new Error(`run exited ${code}: ${text}`)));
  });

export const stopRun = (cwd) => execFileSync(process.execPath, [runScript, "--stop"], { cwd, encoding: "utf8" });
export const slotFile = (dir, n) => JSON.parse(readFileSync(join(dir, ".git", "selo", "slots", `${n}.json`), "utf8"));
export const waitFree = async (port) => {
  for (let i = 0; i < 40 && !(await portFree(port)); i++) await new Promise((r) => setTimeout(r, 100));
  return portFree(port);
};
