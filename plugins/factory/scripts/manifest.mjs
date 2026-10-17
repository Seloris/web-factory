// The single reader of a project's manifest: the `factory.yaml` at its root and the ```component
// block of each component's CLAUDE.md. Used by the skills, through the CLI below. No dependency:
// a small YAML subset is parsed here (maps, lists, scalars, inline [a, b] and {a: b}, # comments),
// which is all a manifest needs.
//
// CLI: node manifest.mjs [dir]   → the resolved manifest as JSON (exit 1 with a message on error)
// From the project's root: node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs

export const MANIFEST_FILE = "factory.yaml";

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PRESETS = {
  standard: { planner: "opus", implementer: "sonnet", advisor: "opus", reviewer: "opus", runner: "haiku", explorer: "haiku" },
  premium: { planner: "fable", implementer: "opus", advisor: "fable", reviewer: "fable", runner: "haiku", explorer: "haiku" },
};
export const ROLES = Object.keys(PRESETS.standard);
export const COMMAND_KEYS = ["build", "test", "lint", "handoff", "prepare", "integration_tests", "serve"];
// The plugin's skins: one folder per skin holding its tokens.css (see skins/README.md).
export const SKINS_DIR = fileURLToPath(new URL("../skins/", import.meta.url));

// ---------- YAML subset ----------

const stripComment = (line) => {
  let out = "";
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      out += c;
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
      out += c;
    } else if (c === "#" && (i === 0 || /\s/.test(line[i - 1]))) {
      break;
    } else out += c;
  }
  return out.replace(/\s+$/, "");
};

const scalar = (raw) => {
  const s = raw.trim();
  if (s === "") return null;
  if (s.startsWith("[") || s.startsWith("{")) return flow(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  if (s === "true") return true;
  if (s === "false") return false;
  if (s === "null" || s === "~") return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s;
};

const splitTop = (s, sep) => {
  const parts = [];
  let depth = 0;
  let quote = null;
  let cur = "";
  for (const c of s) {
    if (quote) {
      cur += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") depth--;
    if (c === sep && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += c;
  }
  if (cur.trim() !== "") parts.push(cur);
  return parts;
};

const flow = (s) => {
  if (s.startsWith("[")) {
    if (!s.endsWith("]")) throw new Error(`Unterminated list: ${s}`);
    return splitTop(s.slice(1, -1), ",").map((p) => scalar(p));
  }
  if (!s.endsWith("}")) throw new Error(`Unterminated map: ${s}`);
  const out = {};
  for (const pair of splitTop(s.slice(1, -1), ",")) {
    const idx = pair.indexOf(":");
    if (idx < 0) throw new Error(`Bad map entry: ${pair}`);
    out[pair.slice(0, idx).trim()] = scalar(pair.slice(idx + 1));
  }
  return out;
};

const keyValue = (text) => {
  // "key: value" outside quotes and flow; returns null for a plain scalar line
  let quote = null;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "[" || c === "{") depth++;
    else if (c === "]" || c === "}") depth--;
    else if (c === ":" && depth === 0 && (i === text.length - 1 || /\s/.test(text[i + 1]))) {
      return { key: text.slice(0, i).trim(), rest: text.slice(i + 1).trim() };
    }
  }
  return null;
};

export const parseYaml = (source) => {
  const lines = [];
  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const text = stripComment(raw);
    if (text.trim() === "") continue;
    lines.push({ indent: text.length - text.trimStart().length, text: text.trim() });
  }
  if (lines.length === 0) return {};

  const parseBlock = (i, indent) => (lines[i].text.startsWith("- ") || lines[i].text === "-" ? parseList(i, indent) : parseMap(i, indent));

  const parseMap = (i, indent) => {
    const out = {};
    while (i < lines.length && lines[i].indent === indent && !lines[i].text.startsWith("- ")) {
      const kv = keyValue(lines[i].text);
      if (!kv) throw new Error(`Expected "key: value" at line "${lines[i].text}"`);
      if (kv.rest !== "") {
        out[kv.key] = scalar(kv.rest);
        i++;
      } else {
        i++;
        if (i < lines.length && (lines[i].indent > indent || (lines[i].indent === indent && lines[i].text.startsWith("- ")))) {
          const [value, next] = parseBlock(i, lines[i].indent);
          out[kv.key] = value;
          i = next;
        } else out[kv.key] = null;
      }
    }
    if (i < lines.length && lines[i].indent > indent) throw new Error(`Bad indentation at line "${lines[i].text}"`);
    return [out, i];
  };

  const parseList = (i, indent) => {
    const out = [];
    while (i < lines.length && lines[i].indent === indent && (lines[i].text.startsWith("- ") || lines[i].text === "-")) {
      const content = lines[i].text === "-" ? "" : lines[i].text.slice(2).trim();
      if (content === "") {
        i++;
        if (i < lines.length && lines[i].indent > indent) {
          const [value, next] = parseBlock(i, lines[i].indent);
          out.push(value);
          i = next;
        } else out.push(null);
        continue;
      }
      const kv = keyValue(content);
      if (kv && !content.startsWith("[") && !content.startsWith("{") && !content.startsWith('"') && !content.startsWith("'")) {
        // "- key: value": a map whose first entry sits on the dash line
        const itemIndent = indent + 2;
        lines[i] = { indent: itemIndent, text: content };
        const [value, next] = parseMap(i, itemIndent);
        out.push(value);
        i = next;
      } else {
        out.push(scalar(content));
        i++;
      }
    }
    return [out, i];
  };

  const [value, next] = parseBlock(0, lines[0].indent);
  if (next < lines.length) throw new Error(`Unexpected content at line "${lines[next].text}"`);
  return value;
};

// ---------- fenced blocks ----------

export const fencedBlock = (markdown, lang) => {
  const re = new RegExp("^```" + lang + "[ \\t]*\\r?\\n([\\s\\S]*?)^```[ \\t]*$", "m");
  const m = markdown.match(re);
  return m ? m[1] : null;
};

// ---------- manifest ----------

// Walks up from `dir` to the nearest folder holding a `factory.yaml`: the project's root, from any
// folder under it. Stops at the repository boundary (a folder holding `.git`) once it is passed: a
// nested repository never inherits the manifest of the one around it.
export const findRoot = (dir) => {
  let cur = resolve(dir);
  for (;;) {
    if (existsSync(join(cur, MANIFEST_FILE))) return cur;
    if (existsSync(join(cur, ".git"))) return null;
    const parent = dirname(cur);
    if (parent === cur) return null;
    cur = parent;
  }
};

export const resolveModels = (spec) => {
  if (spec == null) return { preset: "standard", ...PRESETS.standard };
  if (typeof spec === "string") {
    if (!PRESETS[spec]) throw new Error(`Unknown models preset "${spec}" (known: ${Object.keys(PRESETS).join(", ")})`);
    return { preset: spec, ...PRESETS[spec] };
  }
  const preset = spec.preset ?? "standard";
  if (!PRESETS[preset]) throw new Error(`Unknown models preset "${preset}"`);
  const out = { preset, ...PRESETS[preset] };
  for (const role of ROLES) if (spec[role] != null) out[role] = String(spec[role]);
  return out;
};

const readComponent = (root, c) => {
  const file = join(root, c.path, "CLAUDE.md");
  const base = { name: c.name, path: c.path, handoff: c.handoff ?? null, needs: c.needs ?? [], url: c.url ?? null, serveUrl: c.serve_url ?? c.url ?? null, file: join(c.path, "CLAUDE.md") };
  if (!existsSync(file)) return { ...base, missingFile: true, kind: null, stack: null, skin: null, layers: [], commands: {}, logins: null };
  const block = fencedBlock(readFileSync(file, "utf8"), "component");
  if (block === null) return { ...base, missingFile: false, missingBlock: true, kind: null, stack: null, skin: null, layers: [], commands: {}, logins: null };
  const spec = parseYaml(block) ?? {};
  const commands = {};
  for (const key of COMMAND_KEYS) if (spec.commands?.[key] != null) commands[key] = String(spec.commands[key]);
  const skin = spec.skin == null ? null : String(spec.skin);
  if (skin !== null && !existsSync(join(SKINS_DIR, skin, "tokens.css"))) throw new Error(`Manifest: component "${c.name}" names unknown skin "${skin}" in ${base.file}`);
  return {
    ...base,
    missingFile: false,
    kind: spec.kind ?? null,
    stack: spec.stack ?? null,
    skin,
    layers: Array.isArray(spec.layers) ? spec.layers.map(String) : [],
    commands,
    logins: spec.logins ?? null,
    url: c.url ?? spec.url ?? null,
    serveUrl: c.serve_url ?? spec.serve_url ?? c.url ?? spec.url ?? null,
  };
};

export const readManifest = (dir = process.cwd()) => {
  const root = findRoot(dir);
  if (!root) throw new Error(`No ${MANIFEST_FILE} found from ${resolve(dir)} upwards`);
  const spec = parseYaml(readFileSync(join(root, MANIFEST_FILE), "utf8")) ?? {};
  if (!spec.name) throw new Error("Manifest: `name` is required");
  if (!Array.isArray(spec.components) || spec.components.length === 0) throw new Error("Manifest: `components` must list at least one component");
  const components = spec.components.map((c, i) => {
    if (!c || !c.name || !c.path) throw new Error(`Manifest: component #${i + 1} needs \`name\` and \`path\``);
    return readComponent(root, c);
  });
  const names = new Set(components.map((c) => c.name));
  for (const c of components) for (const n of c.needs) if (!names.has(n)) throw new Error(`Manifest: component "${c.name}" needs unknown component "${n}"`);
  return {
    root,
    name: String(spec.name),
    baseBranch: spec.base_branch ? String(spec.base_branch) : "main",
    language: { chat: spec.language?.chat ?? "en", repo: spec.language?.repo ?? "en" },
    models: resolveModels(spec.models),
    components,
  };
};

// Stage order: the manifest's order, each component after the ones it needs.
export const stages = (manifest) => {
  const done = [];
  const pending = [...manifest.components];
  while (pending.length) {
    const idx = pending.findIndex((c) => c.needs.every((n) => done.some((d) => d.name === n)));
    if (idx < 0) throw new Error(`Manifest: circular \`needs\` among ${pending.map((c) => c.name).join(", ")}`);
    done.push(pending.splice(idx, 1)[0]);
  }
  return done;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const m = readManifest(process.argv[2] ?? process.cwd());
    process.stdout.write(JSON.stringify({ ...m, stages: stages(m).map((c) => c.name) }, null, 2) + "\n");
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
}
