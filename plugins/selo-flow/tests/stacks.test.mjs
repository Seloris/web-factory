import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const STACKS = fileURLToPath(new URL("../stacks/", import.meta.url));

const files = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });

// A pack option's value folder (options/{option}/{value}/) holds only files that replace the pack's own, at the same paths.
test("every file of a pack option replaces a file of its pack", () => {
  for (const pack of readdirSync(STACKS).filter((n) => existsSync(join(STACKS, n, "options")))) {
    const root = join(STACKS, pack);
    for (const option of readdirSync(join(root, "options"))) {
      for (const value of readdirSync(join(root, "options", option))) {
        const folder = join(root, "options", option, value);
        const paths = files(folder).map((f) => relative(folder, f));
        assert.ok(paths.length > 0, `${pack}: options/${option}/${value} is empty`);
        for (const path of paths) {
          assert.ok(existsSync(join(root, path)), `${pack}: options/${option}/${value}/${path} replaces nothing in the pack`);
        }
      }
    }
  }
});

test("a pack with options documents them under ## Options", async () => {
  const { readFileSync } = await import("node:fs");
  for (const pack of readdirSync(STACKS).filter((n) => existsSync(join(STACKS, n, "options")))) {
    const readme = readFileSync(join(STACKS, pack, "README.md"), "utf8");
    assert.match(readme, /^## Options$/m, `${pack}: README.md has no ## Options section`);
    for (const option of readdirSync(join(STACKS, pack, "options"))) {
      assert.ok(readme.includes(`\`${option}\``), `${pack}: option ${option} is not in README.md`);
    }
  }
});
