import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fencedBlock, findRoot, parseYaml, readManifest, resolveModels, stages } from "../scripts/manifest.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const example = join(here, "..", "examples", "two-components");

test("parseYaml: maps, lists, scalars, flow, comments", () => {
  const out = parseYaml(`
name: my-app   # a comment
count: 3
flag: true
nothing:
language:
  chat: fr
  repo: en
tags: [a, b, "c d"]
inline: { x: 1, y: [2, 3] }
components:
  - name: api
    path: src/api
    needs: []
  - name: web
    path: "src/web"
    needs: [api]
plain:
  - one
  - two
url: http://localhost:4200
`);
  assert.equal(out.name, "my-app");
  assert.equal(out.count, 3);
  assert.equal(out.flag, true);
  assert.equal(out.nothing, null);
  assert.deepEqual(out.language, { chat: "fr", repo: "en" });
  assert.deepEqual(out.tags, ["a", "b", "c d"]);
  assert.deepEqual(out.inline, { x: 1, y: [2, 3] });
  assert.deepEqual(out.components, [
    { name: "api", path: "src/api", needs: [] },
    { name: "web", path: "src/web", needs: ["api"] },
  ]);
  assert.deepEqual(out.plain, ["one", "two"]);
  assert.equal(out.url, "http://localhost:4200");
});

test("parseYaml: list at the key's indentation", () => {
  const out = parseYaml("items:\n- a\n- b\nnext: 1\n");
  assert.deepEqual(out, { items: ["a", "b"], next: 1 });
});

test("fencedBlock: picks the right language", () => {
  const md = "# T\n\n```yaml\nx: 1\n```\n\n```factory\nname: a\n```\n";
  assert.equal(fencedBlock(md, "factory"), "name: a\n");
  assert.equal(fencedBlock(md, "component"), null);
});

test("resolveModels: the person's preset and overrides, from the environment", () => {
  assert.deepEqual(resolveModels({}), { preset: "standard", planner: "opus", implementer: "opus", reviewer: "opus", runner: "haiku", explorer: "haiku" });
  assert.equal(resolveModels({ SELO_MODELS: "lean" }).implementer, "sonnet");
  const custom = resolveModels({ SELO_MODEL_REVIEWER: "fable", SELO_MODEL_PLANNER: " fable " });
  assert.deepEqual([custom.reviewer, custom.planner, custom.implementer], ["fable", "fable", "opus"]);
  const lean = resolveModels({ SELO_MODELS: "lean", SELO_MODEL_RUNNER: "sonnet", SELO_MODEL_EXPLORER: "  " });
  assert.deepEqual([lean.preset, lean.implementer, lean.runner, lean.explorer], ["lean", "sonnet", "sonnet", "haiku"]);
  const warnings = [];
  const typo = resolveModels({ SELO_MODELS: "gold", SELO_MODEL_REVIEWER: "fable" }, warnings);
  assert.deepEqual([typo.preset, typo.implementer, typo.reviewer], ["standard", "opus", "fable"]);
  assert.deepEqual(warnings, ['SELO_MODELS: unknown preset "gold" (known: standard, lean; standard used)']);
});

test("readManifest: the example project", () => {
  const m = readManifest(join(example, "web"), { env: {} });
  assert.equal(m.root, example);
  assert.equal(m.name, "two-components");
  assert.equal(m.selo, "2.0.0");
  assert.equal(m.baseBranch, "main");
  assert.deepEqual(m.language, { chat: "fr", repo: "en" });
  assert.equal(m.models.preset, "standard");
  assert.equal(m.models.reviewer, "opus");
  assert.equal(m.components.length, 2);
  const [api, web] = m.components;
  assert.equal(api.kind, "api");
  assert.deepEqual(api.layers, ["Domain", "Application", "Api"]);
  assert.equal(api.handoff, "api/openapi.json");
  assert.equal(api.commands.build, "node scripts/echo.mjs build api");
  assert.equal(api.commands.serve, "node scripts/echo.mjs serve api");
  assert.equal(api.commands.demo, "node scripts/echo.mjs demo api");
  assert.equal(api.demoUrl, "http://localhost:3101", "demo_port from the component block");
  assert.equal(web.demoUrl, "http://localhost:5181", "demo_port from the manifest");
  assert.deepEqual([api.port, api.demoPort, web.port, web.demoPort], [3000, 3101, 4200, 5181], "base ports");
  assert.equal(m.slot, 0);
  assert.deepEqual(m.warnings, []);
  assert.equal(api.url, null, "no url: no browser test on the api stage");
  assert.equal(api.serveUrl, "http://localhost:3000");
  assert.equal(web.kind, "front");
  assert.deepEqual(web.needs, ["api"]);
  assert.equal(web.url, "http://localhost:4200");
  assert.equal(web.serveUrl, "http://localhost:4200");
  assert.equal(web.commands.prepare, "node scripts/echo.mjs prepare web");
  assert.equal(web.commands.serve, "node scripts/echo.mjs serve web");
  assert.equal(web.logins, ".claude/local/test-logins.md");
  assert.equal(web.skin, "modern");
  assert.equal(api.skin, null);
  assert.deepEqual(stages(m).map((c) => c.name), ["api", "web"]);
});

test("readManifest: port and demo_port give the urls (slot 0), a front with a port is browser-tested", () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-ports-"));
  try {
    writeFileSync(join(dir, "selo.yaml"), "name: p\ncomponents:\n  - {name: api, path: api, port: 3000, demo_port: 3101}\n  - {name: web, path: web, port: 5173}\n");
    for (const [name, kind] of [["api", "api"], ["web", "front"]]) {
      mkdirSync(join(dir, name));
      const demo = name === "web" ? "demo_port: 5181\n" : "";
      writeFileSync(join(dir, name, "CLAUDE.md"), "```component\nkind: " + kind + "\n" + demo + "commands:\n  build: b\n```\n");
    }
    const [api, web] = readManifest(dir).components;
    assert.deepEqual([api.url, api.serveUrl, api.demoUrl], [null, "http://localhost:3000", "http://localhost:3101"]);
    assert.deepEqual([web.url, web.serveUrl, web.demoUrl], ["http://localhost:5173", "http://localhost:5173", "http://localhost:5181"]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readManifest: a slot shifts every url by 10 per slot, the base ports stay", () => {
  const [api, web] = readManifest(example, { slot: 2 }).components;
  assert.deepEqual([api.url, api.serveUrl, api.demoUrl], [null, "http://localhost:3020", "http://localhost:3121"]);
  assert.deepEqual([web.url, web.serveUrl, web.demoUrl], ["http://localhost:4220", "http://localhost:4220", "http://localhost:5201"]);
  assert.deepEqual([api.port, web.demoPort], [3000, 5181]);
});

test("readManifest: the 1.0 url keys are still read, a local one gives its port and shifts", () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-urls-"));
  try {
    writeFileSync(join(dir, "selo.yaml"), "name: p\ncomponents:\n  - {name: api, path: api, serve_url: http://localhost:3000, demo_url: http://localhost:3101}\n  - {name: web, path: web, url: http://localhost:4200}\n  - {name: ext, path: ext, url: https://staging.example.com}\n");
    for (const name of ["api", "web", "ext"]) {
      mkdirSync(join(dir, name));
      writeFileSync(join(dir, name, "CLAUDE.md"), "```component\nkind: " + (name === "api" ? "api" : "front") + "\ncommands:\n  build: b\n```\n");
    }
    const [api, web, ext] = readManifest(dir, { slot: 1 }).components;
    assert.deepEqual([api.port, api.url, api.serveUrl, api.demoUrl], [3000, null, "http://localhost:3010", "http://localhost:3111"]);
    assert.deepEqual([web.port, web.url, web.serveUrl], [4200, "http://localhost:4210", "http://localhost:4210"]);
    assert.deepEqual([ext.port, ext.url, ext.serveUrl], [null, "https://staging.example.com", "https://staging.example.com"], "a url elsewhere stays as it is");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readManifest: a skin the plugin does not ship is an error", () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-skin-"));
  try {
    writeFileSync(join(dir, "selo.yaml"), "name: s\ncomponents:\n  - {name: web, path: web}\n");
    mkdirSync(join(dir, "web"));
    writeFileSync(join(dir, "web", "CLAUDE.md"), "```component\nkind: front\nskin: neon\ncommands:\n  build: x\n```\n");
    assert.throws(() => readManifest(dir), /unknown skin "neon"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stages: needs order and cycles", () => {
  const m = { components: [{ name: "b", needs: ["a"] }, { name: "a", needs: [] }] };
  assert.deepEqual(stages(m).map((c) => c.name), ["a", "b"]);
  assert.throws(() => stages({ components: [{ name: "a", needs: ["b"] }, { name: "b", needs: ["a"] }] }));
});

test("readManifest: errors", () => {
  assert.throws(() => readManifest("/"), /No selo.yaml/);
});

test("findRoot: the project's selo.yaml from any folder under it, never past a nested repository's boundary", () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-root-"));
  try {
    writeFileSync(join(dir, "selo.yaml"), "name: outer\ncomponents:\n  - {name: a, path: a}\n");
    const nested = join(dir, "vendor", "inner");
    mkdirSync(join(nested, "src"), { recursive: true });
    assert.equal(findRoot(join(nested, "src")), dir, "no manifest below: the project's is found from a subfolder");
    mkdirSync(join(nested, ".git"));
    assert.equal(findRoot(join(nested, "src")), null, "a .git folder stops the walk");
    writeFileSync(join(nested, "selo.yaml"), "name: inner\ncomponents:\n  - {name: b, path: b}\n");
    assert.equal(findRoot(join(nested, "src")), nested, "the nested project's own manifest wins");
    writeFileSync(join(nested, "CLAUDE.md"), "```factory\nname: legacy\n```\n");
    assert.equal(readManifest(nested).name, "inner", "a ```factory block in CLAUDE.md is no longer a manifest");
    assert.equal(readManifest(nested).selo, null, "no selo key: a project from before 1.0.0");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readManifest: an unknown key is a warning, never an error", () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-keys-"));
  try {
    writeFileSync(join(dir, "selo.yaml"), "name: x\ncolour: red\ncomponents:\n  - {name: a, path: a, demo: oops}\n");
    mkdirSync(join(dir, "a"));
    writeFileSync(join(dir, "a", "CLAUDE.md"), "```component\nkind: api\ncommands:\n  build: b\n  deploy: d\n```\n");
    assert.deepEqual(readManifest(dir).warnings, [
      'selo.yaml: unknown key "colour" (ignored)',
      'selo.yaml, component "a": unknown key "demo" (ignored)',
      `${join("a", "CLAUDE.md")}, commands: unknown key "deploy" (ignored)`,
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readManifest: unknown language keys are warned, so are a demo without its address and the person's unknown preset", () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-keys-"));
  try {
    writeFileSync(join(dir, "selo.yaml"), "name: x\nlanguage:\n  chat: fr\n  ui: fr\ncomponents:\n  - {name: a, path: a}\n");
    mkdirSync(join(dir, "a"));
    writeFileSync(join(dir, "a", "CLAUDE.md"), "```component\nkind: front\ncommands:\n  demo: npm run demo\n```\n");
    const m = readManifest(dir, { env: { SELO_MODELS: "gold" } });
    assert.equal(m.models.preset, "standard");
    assert.deepEqual(m.warnings, [
      'selo.yaml, language: unknown key "ui" (ignored)',
      `${join("a", "CLAUDE.md")}: commands.demo without demo_port (the browser test runs on the dev servers)`,
      'SELO_MODELS: unknown preset "gold" (known: standard, lean; standard used)',
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readManifest: `models` is a person's setting since 2.8.0, an unknown key here", () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-models-"));
  try {
    mkdirSync(join(dir, "a"));
    writeFileSync(join(dir, "a", "CLAUDE.md"), "```component\nkind: api\ncommands:\n  build: b\n```\n");
    writeFileSync(join(dir, "selo.yaml"), "name: x\nmodels:\n  preset: lean\n  reviewer: fable\ncomponents:\n  - {name: a, path: a}\n");
    const m = readManifest(dir, { env: { SELO_MODEL_PLANNER: "fable" } });
    assert.deepEqual([m.models.preset, m.models.implementer, m.models.reviewer, m.models.planner], ["standard", "opus", "opus", "fable"]);
    assert.deepEqual(m.warnings, ['selo.yaml: unknown key "models" (ignored)']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readManifest: `routing` is a person's setting since 2.6.0, an unknown key here", () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-routing-"));
  try {
    mkdirSync(join(dir, "a"));
    writeFileSync(join(dir, "a", "CLAUDE.md"), "```component\nkind: api\ncommands:\n  build: b\n```\n");
    writeFileSync(join(dir, "selo.yaml"), "name: x\nrouting: auto\ncomponents:\n  - {name: a, path: a}\n");
    const m = readManifest(dir);
    assert.equal(m.routing, undefined);
    assert.deepEqual(m.warnings, ['selo.yaml: unknown key "routing" (ignored)']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
