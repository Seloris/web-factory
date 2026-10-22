import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

// A plugin cannot import another's files: selo-ops carries copies of selo's scripts. selo is the source;
// on a failure, copy the file over, in the same commit as the change to the source.
for (const name of ["manifest.mjs", "spec-check.mjs", "commit-hook.mjs", "slots.mjs"]) {
  test(`scripts/${name} is a byte-identical copy of selo's`, () => {
    const copy = readFileSync(new URL(`../scripts/${name}`, import.meta.url));
    const source = readFileSync(new URL(`../../selo/scripts/${name}`, import.meta.url));
    assert.ok(copy.equals(source), `plugins/selo-ops/scripts/${name} differs from plugins/selo/scripts/${name}: copy it over`);
  });
}
