import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SKINS_DIR } from "../scripts/manifest.mjs";

// The variables declared in a CSS text, in the bare `:root` block and in the dark `:root` block.
const blocks = (css) => {
  const dark = css.indexOf("@media (prefers-color-scheme: dark)");
  assert.ok(dark > 0, "a prefers-color-scheme: dark block");
  const names = (text) => new Set([...text.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
  return { light: names(css.slice(0, dark)), dark: names(css.slice(dark)) };
};

const skins = readdirSync(SKINS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

test("skins: every skin folder has its tokens.css and SKIN.md", () => {
  assert.ok(skins.includes("modern"), "the default skin exists");
  for (const s of skins) {
    assert.ok(existsSync(join(SKINS_DIR, s, "tokens.css")), `${s}/tokens.css`);
    assert.ok(existsSync(join(SKINS_DIR, s, "SKIN.md")), `${s}/SKIN.md`);
  }
});

test("skins: every tokens.css declares the contract of modern, and its dark block redefines only contract variables", () => {
  const contract = blocks(readFileSync(join(SKINS_DIR, "modern", "tokens.css"), "utf8")).light;
  for (const s of skins) {
    const { light, dark } = blocks(readFileSync(join(SKINS_DIR, s, "tokens.css"), "utf8"));
    assert.deepEqual([...light].sort(), [...contract].sort(), `${s}: same variables as modern`);
    for (const v of dark) assert.ok(contract.has(v), `${s}: dark ${v} is in the contract`);
  }
});

test("skins: recipes.css reads only contract variables", () => {
  const contract = blocks(readFileSync(join(SKINS_DIR, "modern", "tokens.css"), "utf8")).light;
  const used = new Set([...readFileSync(join(SKINS_DIR, "recipes.css"), "utf8").matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]));
  for (const v of used) assert.ok(contract.has(v), `recipes.css uses ${v}, missing from the contract`);
});
