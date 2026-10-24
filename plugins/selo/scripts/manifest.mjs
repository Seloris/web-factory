// The single reader of a project's manifest: the `selo.yaml` at its root and the ```component
// block of each component's CLAUDE.md. Used by the skills, through the CLI below. No dependency:
// a small YAML subset is parsed here (maps, lists, scalars, inline [a, b] and {a: b}, # comments),
// which is all a manifest needs.
//
// CLI: node manifest.mjs [dir] [--slot N]   → the resolved manifest as JSON, urls on slot N
//      (default: this root's run slot, scripts/run.mjs; exit 1 with a message on error)
// From the project's root: node ${CLAUDE_PLUGIN_ROOT}/scripts/manifest.mjs

export const MANIFEST_FILE = "selo.yaml";

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { currentSlot } from "./slots.mjs";

export const PRESETS = {
  standard: { planner: "opus", implementer: "opus", reviewer: "opus", runner: "haiku", explorer: "haiku" },
  lean: { planner: "opus", implementer: "sonnet", reviewer: "opus", runner: "haiku", explorer: "haiku" },
};
export const ROLES = Object.keys(PRESETS.standard);
export const COMMAND_KEYS = ["build", "test", "lint", "handoff", "prepare", "integration_tests", "serve", "demo"];
// The keys the parser reads; any other is reported in `warnings`, never an error.
export const MANIFEST_KEYS = ["selo", "name", "base_branch", "language", "models", "routing", "components"];
// `routing`: what the lane hook does on a free request (scripts/lane-hint.mjs); `off` by default.
export const ROUTING = ["off", "suggest", "auto"];
export const COMPONENT_KEYS = ["name", "path", "handoff", "needs", "port", "demo_port", "url", "serve_url", "demo_url"];
export const BLOCK_KEYS = ["kind", "stack", "skin", "layers", "commands", "logins", "port", "demo_port", "url", "serve_url", "demo_url"];

// `port` and `demo_port` replace the 1.0 urls (selo 2.0 §4.8): a front with a `port` is browser-tested.
// They are base ports: a run on slot n listens on base + 10 × n (scripts/run.mjs), and the urls follow.
export const SLOT_STEP = 10;
// The port of a 1.0 url on this machine, so the old keys shift with the slot too; any other url: null.
const portOf = (url) => {
  const m = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::(\d+))?\/?$/.exec(url ?? "");
  return m ? Number(m[1] ?? 80) : null;
};
// The component's base ports and its urls on `slot`, from the new keys, else the 1.0 ones.
const addresses = (c, spec, slot) => {
  const at = (port) => (port == null ? null : `http://localhost:${port + SLOT_STEP * slot}`);
  const url = c.url ?? spec.url ?? null;
  const serveUrl = c.serve_url ?? spec.serve_url ?? null;
  const demoUrl = c.demo_url ?? spec.demo_url ?? null;
  const port = c.port ?? spec.port ?? portOf(serveUrl ?? url);
  const demoPort = c.demo_port ?? spec.demo_port ?? portOf(demoUrl);
  return {
    port,
    demoPort,
    url: url !== null && portOf(url) === null ? url : url !== null || spec.kind === "front" ? at(portOf(url) ?? port) : null,
    serveUrl: port !== null ? at(port) : serveUrl ?? url,
    demoUrl: demoPort !== null ? at(demoPort) : demoUrl,
  };
};

const unknownKeys = (map, known, where) =>
  map && typeof map === "object" ? Object.keys(map).filter((k) => !known.includes(k)).map((k) => `${where}: unknown key "${k}" (ignored)`) : [];
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

// Walks up from `dir` to the nearest folder holding a `selo.yaml`: the project's root, from any
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

const readComponent = (root, c, warnings, slot) => {
  const file = join(root, c.path, "CLAUDE.md");
  warnings.push(...unknownKeys(c, COMPONENT_KEYS, `selo.yaml, component "${c.name}"`));
  const base = { name: c.name, path: c.path, handoff: c.handoff ?? null, needs: c.needs ?? [], ...addresses(c, {}, slot), file: join(c.path, "CLAUDE.md") };
  if (!existsSync(file)) return { ...base, missingFile: true, kind: null, stack: null, skin: null, layers: [], commands: {}, logins: null };
  const block = fencedBlock(readFileSync(file, "utf8"), "component");
  if (block === null) return { ...base, missingFile: false, missingBlock: true, kind: null, stack: null, skin: null, layers: [], commands: {}, logins: null };
  const spec = parseYaml(block) ?? {};
  warnings.push(...unknownKeys(spec, BLOCK_KEYS, base.file), ...unknownKeys(spec.commands, COMMAND_KEYS, `${base.file}, commands`));
  const commands = {};
  for (const key of COMMAND_KEYS) if (spec.commands?.[key] != null) commands[key] = String(spec.commands[key]);
  const where = addresses(c, spec, slot);
  // Without its address the demo cannot be awaited: try falls back to the dev servers.
  if (commands.demo && where.demoUrl === null) warnings.push(`${base.file}: commands.demo without demo_port (the browser test runs on the dev servers)`);
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
    ...where,
  };
};

// `slot`: the run's slot (scripts/run.mjs), which shifts every url; the base ports stay as written.
export const readManifest = (dir = process.cwd(), { slot = 0 } = {}) => {
  const root = findRoot(dir);
  if (!root) throw new Error(`No ${MANIFEST_FILE} found from ${resolve(dir)} upwards`);
  const spec = parseYaml(readFileSync(join(root, MANIFEST_FILE), "utf8")) ?? {};
  if (!spec.name) throw new Error("Manifest: `name` is required");
  if (!Array.isArray(spec.components) || spec.components.length === 0) throw new Error("Manifest: `components` must list at least one component");
  const warnings = [
    ...unknownKeys(spec, MANIFEST_KEYS, "selo.yaml"),
    ...unknownKeys(spec.models, [...ROLES, "preset"], "selo.yaml, models"),
    ...unknownKeys(spec.language, ["chat", "repo"], "selo.yaml, language"),
  ];
  const routing = spec.routing == null ? "off" : String(spec.routing);
  if (!ROUTING.includes(routing)) warnings.push(`selo.yaml: routing "${routing}" is not one of ${ROUTING.join(", ")} (read as off)`);
  const components = spec.components.map((c, i) => {
    if (!c || !c.name || !c.path) throw new Error(`Manifest: component #${i + 1} needs \`name\` and \`path\``);
    return readComponent(root, c, warnings, slot);
  });
  const names = new Set(components.map((c) => c.name));
  for (const c of components) for (const n of c.needs) if (!names.has(n)) throw new Error(`Manifest: component "${c.name}" needs unknown component "${n}"`);
  return {
    root,
    name: String(spec.name),
    // The plugin version that wrote or last updated the project (`setup`, `setup update`); null before 1.0.0.
    selo: spec["selo"] == null ? null : String(spec["selo"]),
    slot,
    baseBranch: spec.base_branch ? String(spec.base_branch) : "main",
    language: { chat: spec.language?.chat ?? "en", repo: spec.language?.repo ?? "en" },
    models: resolveModels(spec.models),
    routing: ROUTING.includes(routing) ? routing : "off",
    components,
    warnings,
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
    const args = process.argv.slice(2);
    const at = args.indexOf("--slot");
    const slot = at < 0 ? null : Number(args.splice(at, 2)[1]);
    if (slot !== null && !(Number.isInteger(slot) && slot >= 0)) throw new Error("--slot takes a slot number (0, 1, …)");
    const dir = args[0] ?? process.cwd();
    const current = slot ?? currentSlot(findRoot(dir) ?? dir);
    const m = readManifest(dir, { slot: current });
    process.stdout.write(JSON.stringify({ ...m, stages: stages(m).map((c) => c.name) }, null, 2) + "\n");
  } catch (e) {
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
}
