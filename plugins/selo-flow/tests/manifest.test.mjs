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

test("resolveModels: presets and overrides", () => {
  assert.equal(resolveModels(undefined).planner, "opus");
  assert.throws(() => resolveModels("premium"), /Unknown models preset/);
  assert.equal(resolveModels({ preset: "standard", planner: "fable" }).planner, "fable");
  const custom = resolveModels({ preset: "standard", reviewer: "fable" });
  assert.equal(custom.reviewer, "fable");
  assert.equal(custom.implementer, "sonnet");
  assert.throws(() => resolveModels("gold"));
});

test("readManifest: the example project", () => {
  const m = readManifest(join(example, "web"));
  assert.equal(m.root, example);
  assert.equal(m.name, "two-components");
  assert.equal(m.seloFlow, "1.0.0");
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
  assert.equal(api.demoUrl, "http://localhost:3101", "demo_url from the component block");
  assert.equal(web.demoUrl, "http://localhost:5181", "demo_url from the manifest");
  assert.deepEqual(m.warnings, []);
  assert.equal(api.url, null, "no url: no browser test on the api stage");
  assert.equal(api.serveUrl, "http://localhost:3000");
  assert.equal(web.kind, "front");
  assert.deepEqual(web.needs, ["api"]);
  assert.equal(web.url, "http://localhost:4200");
  assert.equal(web.serveUrl, "http://localhost:4200", "serve_url falls back to url");
  assert.equal(web.commands.prepare, "node scripts/echo.mjs prepare web");
  assert.equal(web.commands.serve, "node scripts/echo.mjs serve web");
  assert.equal(web.logins, ".claude/local/test-logins.md");
  assert.equal(web.skin, "modern");
  assert.equal(api.skin, null);
  assert.deepEqual(stages(m).map((c) => c.name), ["api", "web"]);
});

test("readManifest: a skin the plugin does not ship is an error", () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-flow-skin-"));
  try {
    writeFileSync(join(dir, "selo-flow.yaml"), "name: s\ncomponents:\n  - {name: web, path: web}\n");
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
  assert.throws(() => readManifest("/"), /No selo-flow.yaml/);
});

test("findRoot: the project's selo-flow.yaml from any folder under it, never past a nested repository's boundary", () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-flow-root-"));
  try {
    writeFileSync(join(dir, "selo-flow.yaml"), "name: outer\ncomponents:\n  - {name: a, path: a}\n");
    const nested = join(dir, "vendor", "inner");
    mkdirSync(join(nested, "src"), { recursive: true });
    assert.equal(findRoot(join(nested, "src")), dir, "no manifest below: the project's is found from a subfolder");
    mkdirSync(join(nested, ".git"));
    assert.equal(findRoot(join(nested, "src")), null, "a .git folder stops the walk");
    writeFileSync(join(nested, "selo-flow.yaml"), "name: inner\ncomponents:\n  - {name: b, path: b}\n");
    assert.equal(findRoot(join(nested, "src")), nested, "the nested project's own manifest wins");
    writeFileSync(join(nested, "CLAUDE.md"), "```factory\nname: legacy\n```\n");
    assert.equal(readManifest(nested).name, "inner", "a ```factory block in CLAUDE.md is no longer a manifest");
    assert.equal(readManifest(nested).seloFlow, null, "no selo-flow key: a project from before 1.0.0");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readManifest: an unknown key is a warning, never an error", () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-flow-keys-"));
  try {
    writeFileSync(join(dir, "selo-flow.yaml"), "name: x\ncolour: red\ncomponents:\n  - {name: a, path: a, demo: oops}\n");
    mkdirSync(join(dir, "a"));
    writeFileSync(join(dir, "a", "CLAUDE.md"), "```component\nkind: api\ncommands:\n  build: b\n  deploy: d\n```\n");
    assert.deepEqual(readManifest(dir).warnings, [
      'selo-flow.yaml: unknown key "colour" (ignored)',
      'selo-flow.yaml, component "a": unknown key "demo" (ignored)',
      `${join("a", "CLAUDE.md")}, commands: unknown key "deploy" (ignored)`,
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
