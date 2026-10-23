// What a run consumed, read from a transcript (docs/revamp-2.2.0/proposal.md §3, §4): API calls and tokens
// per kind, per model and per prompt, the tools called, the skills loaded. Pure functions but `readSlice`.
// Ported from the session-debug mod's aggregate.mjs, cut to the raw counts: no weighted estimate.
import { closeSync, openSync, readSync, statSync } from "node:fs";

/** A run's slice over this is read from its last bytes only, and its usage says `partial: true`. */
export const READ_CAP = 32 * 1024 * 1024;
/** A main run keeps its latest prompts only; its totals stay exact past the cap. */
export const MAX_PROMPTS = 50;

const ROW_TYPE = /"type"\s*:\s*"(?:assistant|user)"/;
const zero = () => ({ input: 0, cacheRead: 0, cacheWrite: 0, output: 0 });
const KINDS = ["input", "cacheRead", "cacheWrite", "output"];
const tokensOf = (u) => ({
  input: u?.input_tokens ?? 0,
  cacheRead: u?.cache_read_input_tokens ?? 0,
  cacheWrite: u?.cache_creation_input_tokens ?? 0,
  output: u?.output_tokens ?? 0,
});
const plus = (a, b, sign = 1) => Object.fromEntries(KINDS.map((k) => [k, Math.max(0, (a?.[k] ?? 0) + sign * (b?.[k] ?? 0))]));
const sum = (t) => KINDS.reduce((n, k) => n + (t?.[k] ?? 0), 0);
const byCount = (a, b) => b.count - a.count || a.name.localeCompare(b.name);
const byTokens = (a, b) => sum(b.tokens) - sum(a.tokens) || a.model.localeCompare(b.model);

/** The text of a prompt the person typed, or null for a row that is not one (session-debug's promptText). */
export function promptText(row) {
  // A compaction summary restates the conversation: nothing the person typed at that point.
  if (row?.type !== "user" || row.isMeta || row.isCompactSummary) return null;
  const content = row.message?.content;
  const text = typeof content === "string"
    ? content
    : Array.isArray(content) && !content.some((p) => p?.type === "tool_result")
      ? content.filter((p) => p?.type === "text").map((p) => p.text).join(" ")
      : null;
  if (!text || text.startsWith("<local-command-") || text.startsWith("<task-notification>")) return null;
  // The marker Claude Code writes when the person presses Esc, and a subagent's hand-back: nothing typed.
  if (text.startsWith("[Request interrupted by user") || text.includes("<agent-message from=")) return null;
  const command = /<command-name>([^<]+)<\/command-name>/.exec(text);
  if (command) {
    const args = /<command-args>([^<]*)<\/command-args>/.exec(text)?.[1]?.trim();
    return args ? `${command[1]} ${args}` : command[1];
  }
  return text.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
}

const textsOf = (content) => (typeof content === "string" ? [content] : Array.isArray(content) ? content.filter((p) => p?.type === "text").map((p) => p.text ?? "") : []);
const commandName = (text) => /<command-name>\/?([^<]+)<\/command-name>/.exec(text)?.[1]?.trim() ?? null;
const sizeOf = (content) => (typeof content === "string" ? content.length : JSON.stringify(content ?? "").length);

/** The group of the breakdown a tool's results count in (the kookiz-usage mod's toolGroup, keys in English). */
export function toolGroup(name = "") {
  if (name.startsWith("mcp__")) {
    const server = name.slice(5).split("__")[0];
    return server.startsWith("ccd_") ? "app" : `mcp:${server}`;
  }
  if (name === "WebSearch" || name === "WebFetch") return "web";
  if (["Read", "Write", "Edit", "Glob", "Grep", "NotebookEdit"].includes(name)) return "files";
  if (name === "Bash" || name === "PowerShell") return "shell";
  if (name === "Agent" || name === "SendMessage") return "agents";
  if (name === "Skill") return "skills";
  return "other";
}

/**
 * The usage of a transcript's text (a run's slice, or a subagent's transcript whole).
 * `prompts`: false for a subagent run (its first user row is its task, not a prompt the person typed).
 * `sidechain`: true for a subagent's own transcript, where every row is a sidechain row. It has no `sizes`.
 * A line that does not parse (cut by the read cap, or being written) is skipped.
 */
export function readUsage(text, { prompts: withPrompts = true, sidechain = false, settled = false, partial = false } = {}) {
  const calls = new Map(); // message.id → { model, tokens, prompt }
  const tools = new Map();
  // The breakdown's raw input: characters each group added to the conversation (`conversation`: the person's
  // and Claude's text and Claude's tool inputs; a tool group: its results).
  const sizes = new Map();
  const toolNames = new Map(); // tool_use id → name
  const grow = (group, n) => n > 0 && sizes.set(group, (sizes.get(group) ?? 0) + n);
  const skills = new Map(); // `${how}\0${name}` → { name, how, count }
  const seenParts = new Set();
  const seenRows = new Set();
  const prompts = [];
  let prompt = null;
  // Skills a Skill call or a slash command announced: the skill-format row that brings their body is not a preload.
  const announced = [];
  const addSkill = (name, how) => {
    const key = `${how}\0${name}`;
    const row = skills.get(key) ?? { name, count: 0, how };
    row.count++;
    skills.set(key, row);
  };
  const dropSkill = (name, how) => {
    const key = `${how}\0${name}`;
    const row = skills.get(key);
    if (row && --row.count <= 0) skills.delete(key);
  };
  // A local command runs in Claude Code, not as a skill: its row comes after a meta `<local-command-caveat>` row,
  // and is followed by a `<local-command-stdout>` row (or a system row). The last command row read, until the next user row.
  let caveat = false;
  let lastCommand = null;

  for (const line of String(text ?? "").split("\n")) {
    // The rows read are assistant and user rows: the rest (attachments, request shapes naming a role) is never parsed.
    if (!ROW_TYPE.test(line)) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    // In a main slice, a sidechain row is a subagent's: counted from its own transcript, never twice.
    if (row?.isSidechain && !sidechain) continue;
    // A row written twice (a transcript replays its history after a compaction) is read once.
    if (row?.uuid) {
      if (seenRows.has(row.uuid)) continue;
      seenRows.add(row.uuid);
    }
    const message = row?.message ?? {};
    const content = Array.isArray(message.content) ? message.content : [];
    if (row.type === "assistant") {
      // `<synthetic>` rows (an interrupt, an API error written by Claude Code) are no API call.
      if (message.model === "<synthetic>") continue;
      if (message.usage && message.id) {
        // One response spans several rows with the same id and usage: the last one wins.
        const prev = calls.get(message.id);
        calls.set(message.id, { model: message.model || prev?.model || null, tokens: tokensOf(message.usage), prompt: prev ? prev.prompt : prompt });
      }
      for (const part of content) {
        if (part?.id && seenParts.has(part.id)) continue;
        if (part?.id) seenParts.add(part.id);
        if (part?.type === "text") grow("conversation", part.text?.length ?? 0);
        if (part?.type === "server_tool_use" && part.name === "advisor") tools.set("advisor", (tools.get("advisor") ?? 0) + 1);
        else if (part?.type === "tool_use" && part.name) {
          tools.set(part.name, (tools.get(part.name) ?? 0) + 1);
          toolNames.set(part.id, part.name);
          grow("conversation", sizeOf(part.input));
          if (part.name === "Skill" && part.input?.skill) {
            const name = String(part.input.skill).replace(/^\//, "");
            addSkill(name, "tool");
            announced.push(name);
          }
        }
      }
      continue;
    }
    if (row.type !== "user") continue;
    const texts = textsOf(message.content);
    const wasCaveat = caveat;
    caveat = row.isMeta === true && texts.some((t) => t.startsWith("<local-command-caveat>"));
    const command = lastCommand;
    lastCommand = null;
    if (command && texts.some((t) => t.startsWith("<local-command-stdout>"))) {
      // The command read just before was a local one: its skill and its prompt are taken back.
      for (const name of command.names) {
        dropSkill(name, "command");
        const i = announced.lastIndexOf(name);
        if (i >= 0) announced.splice(i, 1);
      }
      if (command.prompt && prompts.at(-1) === command.prompt && !command.prompt.calls) {
        prompts.pop();
        prompt = command.before;
      }
    }
    if (row.isMeta) {
      // A skill's body: an agent's frontmatter preload, unless a Skill call or a command just announced it.
      for (const t of texts) {
        if (!t.includes("<skill-format>true</skill-format>")) continue;
        const name = commandName(t);
        if (!name) continue;
        const i = announced.indexOf(name);
        if (i >= 0) announced.splice(i, 1);
        else addSkill(name, "preloaded");
      }
      continue;
    }
    if (typeof message.content === "string") grow("conversation", message.content.length);
    for (const part of content) {
      if (part?.type === "tool_result") grow(toolGroup(toolNames.get(part.tool_use_id)), sizeOf(part.content));
      else if (part?.type === "text") grow("conversation", part.text?.length ?? 0);
    }
    const names = content.some((p) => p?.type === "tool_result")
      ? []
      : texts.filter((t) => !t.startsWith("<local-command-")).flatMap((t) => [...t.matchAll(/<command-name>\/?([^<]+)<\/command-name>/g)].map((m) => m[1].trim()));
    // After a caveat row, a command is a local one: no skill, no prompt.
    if (names.length && wasCaveat) continue;
    for (const name of names) {
      addSkill(name, "command");
      announced.push(name);
    }
    const before = prompt;
    if (withPrompts && promptText(row)) {
      prompt = { at: row.timestamp ?? null, calls: 0, tokens: zero() };
      prompts.push(prompt);
    }
    if (names.length) lastCommand = { names, prompt: prompt !== before ? prompt : null, before };
  }

  const byModel = new Map();
  const usage = { calls: 0, tokens: zero(), byModel: [] };
  for (const c of calls.values()) {
    usage.calls++;
    usage.tokens = plus(usage.tokens, c.tokens);
    if (c.model) {
      const m = byModel.get(c.model) ?? { model: c.model, calls: 0, tokens: zero() };
      m.calls++;
      m.tokens = plus(m.tokens, c.tokens);
      byModel.set(c.model, m);
    }
    if (c.prompt) {
      c.prompt.calls++;
      c.prompt.tokens = plus(c.prompt.tokens, c.tokens);
    }
  }
  usage.byModel = [...byModel.values()].sort(byTokens);
  return {
    ...usage,
    tools: [...tools].map(([name, count]) => ({ name, count })).sort(byCount),
    skills: [...skills.values()].sort(byCount),
    prompts: prompts.slice(-MAX_PROMPTS),
    ...(sidechain ? {} : { sizes: Object.fromEntries([...sizes].sort((a, b) => b[1] - a[1])) }),
    settled,
    partial,
  };
}

// a ± b per group, floored at 0, a group brought to nothing dropped; undefined when neither has sizes.
const combineSizes = (a, b, sign) => {
  if (!a && !b) return undefined;
  const out = { ...a };
  for (const [k, n] of Object.entries(b ?? {})) out[k] = Math.max(0, (out[k] ?? 0) + sign * n);
  return Object.fromEntries(Object.entries(out).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]));
};

// The `Usage` part of a usage (a session's totals): calls, tokens, byModel.
const usageOf = (u) => ({ calls: u?.calls ?? 0, tokens: plus(zero(), u?.tokens), byModel: (u?.byModel ?? []).map((m) => ({ model: m.model, calls: m.calls ?? 0, tokens: plus(zero(), m.tokens) })) });

function combine(a, b, sign) {
  if (!a && !b) return null;
  const x = usageOf(a);
  const y = usageOf(b);
  const models = new Map(x.byModel.map((m) => [m.model, m]));
  for (const m of y.byModel) {
    const cur = models.get(m.model) ?? { model: m.model, calls: 0, tokens: zero() };
    models.set(m.model, { model: m.model, calls: Math.max(0, cur.calls + sign * m.calls), tokens: plus(cur.tokens, m.tokens, sign) });
  }
  const sizes = combineSizes(a?.sizes, b?.sizes, sign);
  return {
    calls: Math.max(0, x.calls + sign * y.calls),
    tokens: plus(x.tokens, y.tokens, sign),
    // A model a subtraction brought to nothing leaves the list.
    byModel: [...models.values()].filter((m) => m.calls > 0 || sum(m.tokens) > 0).sort(byTokens),
    ...(sizes ? { sizes } : {}),
  };
}

/** a + b, as a `Usage` with the main runs' `sizes` (a run's tools, skills and prompts are not summed). Null when both are null. */
export const addUsage = (a, b) => combine(a, b, 1);
/** a − b, floored at 0 per figure, as a `Usage`. A null `b` subtracts nothing. */
export const subUsage = (a, b) => combine(a, b, -1);

/**
 * The bytes [from, to) of a transcript as text: `to` null reads to its end. Over `cap`, only the last `cap`
 * bytes are read, from the first whole line in them, and `partial` is true. A missing file, or a `from` past
 * its end (the file was replaced), gives an empty text.
 */
export function readSlice(path, from = 0, to = null, cap = READ_CAP) {
  let size;
  try {
    size = statSync(path).size;
  } catch {
    return { text: "", partial: false, size: 0 };
  }
  const end = Math.min(to ?? size, size);
  let start = Math.max(0, from ?? 0);
  if (start >= end) return { text: "", partial: false, size };
  const partial = end - start > cap;
  if (partial) start = end - cap;
  const buf = Buffer.alloc(end - start);
  const fd = openSync(path, "r");
  try {
    let read = 0;
    while (read < buf.length) {
      const n = readSync(fd, buf, read, buf.length - read, start + read);
      if (n <= 0) break;
      read += n;
    }
  } finally {
    closeSync(fd);
  }
  let text = buf.toString("utf8");
  // A start inside a line: that line is dropped.
  if (partial) text = text.slice(text.indexOf("\n") + 1);
  return { text, partial, size };
}
