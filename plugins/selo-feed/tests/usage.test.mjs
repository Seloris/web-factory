import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { addUsage, MAX_PROMPTS, promptText, readSlice, readUsage, subUsage } from "../scripts/usage.mjs";

// Transcript rows, as Claude Code writes them.
const usage = (input, output, cacheRead = 0, cacheWrite = 0) => ({ input_tokens: input, output_tokens: output, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: cacheWrite });
const assistant = (id, model, u, content = [{ type: "text", text: "x" }], timestamp = "2026-10-22T10:00:01.000Z") =>
  ({ type: "assistant", timestamp, message: { id, model, role: "assistant", usage: u, content } });
const user = (content, extra = {}) => ({ type: "user", timestamp: "2026-10-22T10:00:00.000Z", message: { role: "user", content }, ...extra });
const jsonl = (...rows) => rows.map((r) => (typeof r === "string" ? r : JSON.stringify(r))).join("\n") + "\n";
const T = (input, cacheRead, cacheWrite, output) => ({ input, cacheRead, cacheWrite, output });

test("one response on three rows is one call", () => {
  const u = usage(10, 5, 100, 20);
  const r = readUsage(jsonl(
    user("hello"),
    assistant("msg_1", "claude-opus-5-5", u, [{ type: "thinking", thinking: "…" }]),
    assistant("msg_1", "claude-opus-5-5", u, [{ type: "text", text: "Hi" }]),
    assistant("msg_1", "claude-opus-5-5", u, [{ type: "tool_use", id: "tu_1", name: "Read", input: {} }]),
  ));
  assert.equal(r.calls, 1);
  assert.deepEqual(r.tokens, T(10, 100, 20, 5));
  assert.deepEqual(r.byModel, [{ model: "claude-opus-5-5", calls: 1, tokens: T(10, 100, 20, 5) }]);
  assert.deepEqual(r.tools, [{ name: "Read", count: 1 }]);
  assert.deepEqual(r.prompts, [{ at: "2026-10-22T10:00:00.000Z", calls: 1, tokens: T(10, 100, 20, 5) }]);
  assert.equal(r.settled, false);
  assert.equal(r.partial, false);
});

test("two models: one row each, most tokens first; <synthetic> is no call", () => {
  const r = readUsage(jsonl(
    user("go"),
    assistant("a", "claude-haiku-5-5", usage(1, 1)),
    assistant("b", "claude-sonnet-5-5", usage(100, 50)),
    assistant("c", "claude-sonnet-5-5", usage(10, 5)),
    assistant("d", "<synthetic>", usage(0, 0)),
  ));
  assert.equal(r.calls, 3);
  assert.deepEqual(r.byModel.map((m) => [m.model, m.calls]), [["claude-sonnet-5-5", 2], ["claude-haiku-5-5", 1]]);
  assert.deepEqual(r.tokens, T(111, 0, 0, 56));
});

test("skills: the Skill tool, a slash command, an agent's preload", () => {
  const r = readUsage(jsonl(
    user("<command-message>selo-flow:fastlane</command-message>\n<command-name>/selo-flow:fastlane</command-name>\n<command-args>add a filter</command-args>"),
    assistant("a", "claude-opus-5-5", usage(1, 1), [{ type: "tool_use", id: "tu_1", name: "Skill", input: { skill: "dataviz" } }]),
    user([{ type: "tool_result", tool_use_id: "tu_1", content: "Launching skill: dataviz" }]),
    // The body of the skill just called: not a preload.
    user([{ type: "text", text: "<command-name>dataviz</command-name><skill-format>true</skill-format> body" }], { isMeta: true }),
    // An agent's frontmatter preload: a meta row, no call.
    user([{ type: "text", text: "<command-name>selo-flow:review</command-name>\n<skill-format>true</skill-format> body" }], { isMeta: true }),
  ));
  assert.deepEqual(r.skills, [
    { name: "dataviz", count: 1, how: "tool" },
    { name: "selo-flow:fastlane", count: 1, how: "command" },
    { name: "selo-flow:review", count: 1, how: "preloaded" },
  ]);
  assert.deepEqual(r.tools, [{ name: "Skill", count: 1 }]);
  assert.equal(r.prompts.length, 1, "the slash command is a prompt; the tool result and the meta rows are not");
  assert.equal(promptText(JSON.parse(jsonl(user("<command-name>/selo-flow:try</command-name><command-args></command-args>")))), "/selo-flow:try");
});

test("the advisor is a server_tool_use named advisor", () => {
  const r = readUsage(jsonl(
    user("go"),
    assistant("a", "claude-opus-5-5", usage(1, 1), [{ type: "server_tool_use", id: "st_1", name: "advisor", input: {} }]),
    assistant("a", "claude-opus-5-5", usage(1, 1), [{ type: "server_tool_use", id: "st_1", name: "advisor", input: {} }]),
    assistant("b", "claude-opus-5-5", usage(1, 1), [{ type: "server_tool_use", id: "st_2", name: "advisor", input: {} }, { type: "tool_use", id: "tu_1", name: "Bash", input: {} }]),
  ));
  assert.deepEqual(r.tools, [{ name: "advisor", count: 2 }, { name: "Bash", count: 1 }]);
});

test("prompts: not a compaction summary, a task notification, a local command, a tool result, a meta row", () => {
  const r = readUsage(jsonl(
    user("first"),
    assistant("a", "claude-opus-5-5", usage(1, 1)),
    user("This session is being continued from a previous conversation…", { isCompactSummary: true }),
    user("<task-notification>\n<task-id>b1</task-id>\n</task-notification>"),
    user("<local-command-stdout>ok</local-command-stdout>"),
    user([{ type: "tool_result", tool_use_id: "x", content: "r" }]),
    user("<system-reminder>r</system-reminder>", { isMeta: true }),
    assistant("b", "claude-opus-5-5", usage(2, 2)),
    { ...user("second"), timestamp: "2026-10-22T11:00:00.000Z" },
    assistant("c", "claude-opus-5-5", usage(4, 4)),
  ));
  assert.deepEqual(r.prompts, [
    { at: "2026-10-22T10:00:00.000Z", calls: 2, tokens: T(3, 0, 0, 3) },
    { at: "2026-10-22T11:00:00.000Z", calls: 1, tokens: T(4, 0, 0, 4) },
  ]);
  assert.deepEqual(readUsage(jsonl(user("task"), assistant("a", "m", usage(1, 1))), { prompts: false }).prompts, [], "a subagent run has none");
});

test("prompts keep the latest 50; the totals stay exact", () => {
  const rows = [];
  for (let i = 0; i < 60; i++) rows.push({ ...user(`p${i}`), timestamp: `2026-10-22T10:${String(i).padStart(2, "0")}:00.000Z` }, assistant(`m${i}`, "m", usage(1, 0)));
  const r = readUsage(jsonl(...rows));
  assert.equal(r.prompts.length, MAX_PROMPTS);
  assert.equal(r.prompts[0].at, "2026-10-22T10:10:00.000Z");
  assert.equal(r.calls, 60);
});

test("only message.model of assistant rows counts: an attachment naming a model is no call", () => {
  const r = readUsage(jsonl(
    user("go"),
    { type: "attachment", attachment: { type: "api-request-shape", model: "claude-opus-5-5" }, message: { model: "claude-opus-5-5", usage: usage(9, 9), id: "x" } },
    { type: "user", message: { role: "user", model: "claude-opus-5-5", content: "<system-reminder>assistant</system-reminder>" }, isMeta: true },
    assistant("a", "claude-sonnet-5-5", usage(1, 1)),
  ));
  assert.equal(r.calls, 1);
  assert.deepEqual(r.byModel.map((m) => m.model), ["claude-sonnet-5-5"]);
});

test("a cut last line is skipped", () => {
  const whole = jsonl(user("go"), assistant("a", "m", usage(1, 1)));
  const cut = JSON.stringify(assistant("b", "m", usage(5, 5))).slice(0, 40);
  const r = readUsage(whole + cut);
  assert.equal(r.calls, 1);
});

test("readSlice: a slice, a missing file, a slice over the cap", () => {
  const dir = mkdtempSync(join(tmpdir(), "selo-usage-"));
  const file = join(dir, "t.jsonl");
  const first = jsonl(user("one"), assistant("a", "m", usage(1, 1)));
  const second = jsonl(user("two"), assistant("b", "m", usage(2, 2)), assistant("c", "m", usage(3, 3)));
  writeFileSync(file, first + second);
  const size = Buffer.byteLength(first + second);
  const from = Buffer.byteLength(first);

  assert.equal(readUsage(readSlice(file, 0, from).text).calls, 1);
  assert.equal(readUsage(readSlice(file, from, null).text).calls, 2);
  assert.deepEqual(readSlice(join(dir, "none.jsonl"), 0, null), { text: "", partial: false, size: 0 });
  assert.equal(readSlice(file, size + 10, null).text, "", "a from past the end reads nothing");

  // Over the cap: the last bytes only, from the first whole line, flagged partial.
  const lastRow = JSON.stringify(assistant("c", "m", usage(3, 3))) + "\n";
  const slice = readSlice(file, 0, null, Buffer.byteLength(lastRow) + 5);
  assert.equal(slice.partial, true);
  const r = readUsage(slice.text, { partial: slice.partial });
  assert.equal(r.calls, 1);
  assert.deepEqual(r.tokens, T(3, 0, 0, 3));
  assert.equal(r.partial, true);
});

test("addUsage and subUsage: the Usage part, floored at 0, empty models dropped", () => {
  const a = readUsage(jsonl(assistant("a", "x", usage(10, 10)), assistant("b", "y", usage(1, 1))));
  const b = readUsage(jsonl(assistant("c", "y", usage(5, 5))));
  const sum = addUsage(a, b);
  assert.deepEqual(Object.keys(sum).sort(), ["byModel", "calls", "sizes", "tokens"]);
  assert.deepEqual(sum.sizes, { conversation: 3 });
  assert.equal(sum.calls, 3);
  assert.deepEqual(sum.byModel.map((m) => [m.model, m.calls]), [["x", 1], ["y", 2]]);
  const back = subUsage(sum, a);
  assert.deepEqual(back, { calls: 1, tokens: T(5, 0, 0, 5), byModel: [{ model: "y", calls: 1, tokens: T(5, 0, 0, 5) }], sizes: { conversation: 1 } });
  assert.equal(addUsage(null, null), null);
  assert.deepEqual(subUsage(b, null).calls, 1);
  assert.deepEqual(subUsage(null, b), { calls: 0, tokens: T(0, 0, 0, 0), byModel: [], sizes: {} });
  // A subagent's usage has no sizes: a total of subagent runs has none either.
  const agent = readUsage(jsonl(assistant("d", "y", usage(1, 1))), { sidechain: true });
  assert.equal(agent.sizes, undefined);
  assert.equal(addUsage(agent, agent).sizes, undefined);
});

test("a sidechain row is the subagent's: not counted in the main slice", () => {
  const r = readUsage(jsonl(user("go"), assistant("a", "m", usage(1, 1)), { ...assistant("b", "m", usage(9, 9)), isSidechain: true }));
  assert.equal(r.calls, 1);
});

test("a subagent's own transcript: every row a sidechain row, all counted with sidechain", () => {
  // As Claude Code writes subagents/agent-{id}.jsonl (session 0d213aa8, an Explore run on Haiku read as zero by 2.3.0).
  const side = (r) => ({ ...r, isSidechain: true, agentId: "aecf2e98fd675b99a" });
  const text = jsonl(
    side(user("Read-only, quick. Check web/src/features/help/.")),
    side(assistant("m1", "claude-haiku-5-5", usage(3, 40, 0, 9000), [{ type: "tool_use", id: "t1", name: "Glob", input: { pattern: "**/help/*" } }])),
    side(user([{ type: "tool_result", tool_use_id: "t1", content: "help.tsx" }])),
    side(assistant("m2", "claude-haiku-5-5", usage(2, 200, 9000, 300), [{ type: "text", text: "Report." }])),
  );
  assert.equal(readUsage(text, { prompts: false }).calls, 0, "read as a main slice, it is nothing");
  const r = readUsage(text, { prompts: false, sidechain: true, settled: true });
  assert.equal(r.calls, 2);
  assert.deepEqual(r.tokens, T(5, 9000, 9300, 240));
  assert.deepEqual(r.byModel, [{ model: "claude-haiku-5-5", calls: 2, tokens: T(5, 9000, 9300, 240) }]);
  assert.deepEqual(r.tools, [{ name: "Glob", count: 1 }]);
  assert.deepEqual(r.prompts, []);
  assert.equal(r.sizes, undefined);
});

test("sizes: characters added per group of the breakdown", () => {
  const r = readUsage(jsonl(
    user("hello"),
    assistant("a", "m", usage(1, 1), [{ type: "text", text: "Sure" }, { type: "tool_use", id: "t1", name: "Bash", input: "ls" }]),
    user([{ type: "tool_result", tool_use_id: "t1", content: "a.txt b.txt" }]),
    assistant("b", "m", usage(1, 1), [{ type: "tool_use", id: "t2", name: "mcp__ccd_turn__wrap_up", input: "x" }, { type: "tool_use", id: "t3", name: "mcp__terminal__read", input: "y" }]),
    user([{ type: "tool_result", tool_use_id: "t2", content: "ok" }, { type: "tool_result", tool_use_id: "t3", content: "abc" }, { type: "tool_result", tool_use_id: "gone", content: "z" }]),
  ));
  assert.deepEqual(r.sizes, { conversation: 13, shell: 11, "mcp:terminal": 3, app: 2, other: 1 });
  assert.deepEqual(Object.keys(r.sizes), ["conversation", "shell", "mcp:terminal", "app", "other"]);
});

test("no prompt: an Esc marker, a subagent's hand-back", () => {
  const r = readUsage(jsonl(
    user("go"),
    assistant("a", "m", usage(1, 1)),
    user([{ type: "text", text: "[Request interrupted by user]" }]),
    user("[Request interrupted by user for tool use]"),
    user("Another Claude session sent a message:\n<agent-message from=\"a1\">\ndone\n</agent-message>"),
    assistant("b", "m", usage(1, 1)),
  ));
  assert.equal(r.prompts.length, 1);
  assert.equal(r.prompts[0].calls, 2);
});

test("the prefilter reads the row's own type: a request shape naming a role is not parsed", () => {
  const r = readUsage(jsonl(
    { type: "attachment", attachment: { type: "api-request-shape", messages: [{ role: "user", content: "go" }] } },
    '{"type": "user", "message": {"role": "user", "content": "spaced"}}',
    '{"type": "assistant", "message": {"id": "a", "model": "m", "usage": {"input_tokens": 3, "output_tokens": 1}, "content": []}}',
  ));
  assert.equal(r.calls, 1);
  assert.equal(r.prompts.length, 1);
});

test("a built-in or local command is neither a skill nor a prompt", () => {
  const caveat = user("<local-command-caveat>Caveat: the messages below were generated by the user while running local commands.</local-command-caveat>", { isMeta: true });
  const cmd = (name) => user(`<command-name>/${name}</command-name>\n<command-message>${name}</command-message>\n<command-args></command-args>`);
  const r = readUsage(jsonl(
    user("go"),
    assistant("a", "m", usage(1, 1)),
    // After a caveat row, followed by a system row (/clear) or a stdout row (/compact).
    caveat, cmd("clear"), { type: "system", subtype: "local_command", content: "" },
    caveat, cmd("compact"), user("<local-command-stdout>Compacted</local-command-stdout>"),
    // No caveat, but a stdout row after it: taken back too.
    cmd("model"), user("<local-command-stdout>Set model to sonnet</local-command-stdout>"),
    assistant("b", "m", usage(1, 1)),
    // A typed skill: kept.
    cmd("selo-flow:try"),
    assistant("c", "m", usage(1, 1)),
  ));
  assert.deepEqual(r.skills, [{ name: "selo-flow:try", count: 1, how: "command" }]);
  assert.equal(r.prompts.length, 2);
  assert.deepEqual(r.prompts.map((p) => p.calls), [2, 1]);
});

test("a row written twice is read once", () => {
  const p = { ...user("go"), uuid: "u1" };
  const r = readUsage(jsonl(p, assistant("a", "m", usage(1, 1)), p, { ...user("<command-name>/selo-flow:try</command-name>"), uuid: "u2" }, { ...user("<command-name>/selo-flow:try</command-name>"), uuid: "u2" }));
  assert.equal(r.prompts.length, 2);
  assert.deepEqual(r.prompts.map((x) => x.calls), [1, 0]);
  assert.deepEqual(r.skills, [{ name: "selo-flow:try", count: 1, how: "command" }]);
});
