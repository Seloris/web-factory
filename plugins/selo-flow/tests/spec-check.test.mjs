import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSpec, parseBlueprint, planIds, planMerge, specPath } from "../scripts/spec-check.mjs";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { addedFiles, commitWarnings, isCode, isCommit, namedFiles, parseSpecLine, specSlug, specWarnings } from "../scripts/commit-hook.mjs";

const spec = `# Live sessions — Spec
## Functional Requirements
### List
- **FR-01** — The list shows every session.
- **FR-13** — The "waiting for you" filter includes awaiting-commit.
### Notifications
- **FR-31** — One notification per session.
- **FR-48** — (planned) One sound per notification.
## Business Rules
- **BR-23** — An empty filter shows every session.

Retired: FR-07, FR-50, BR-04
`;

test("checkSpec: a clean spec, next ids past the retired ones, planned FRs listed", () => {
  const r = checkSpec(spec, ["FR-13", "BR-23"]);
  assert.equal(r.ok, true);
  assert.equal(r.next.FR, "FR-51");
  assert.equal(r.next.BR, "BR-24");
  assert.equal(r.next.Q, "Q-01");
  assert.deepEqual(r.planned, ["FR-48"]);
});

test("checkSpec: a duplicate id from two sessions, a retired id reused, a cited id missing", () => {
  assert.deepEqual(checkSpec(spec + "\n- **FR-48** — Another addition.\n").duplicates, ["FR-48"]);
  const r = checkSpec(spec.replace("FR-31", "FR-07"), ["FR-99", "FR-50"]);
  assert.equal(r.ok, false);
  assert.deepEqual(r.retiredReused, ["FR-07"]);
  assert.deepEqual(r.missing, ["FR-99"], "a retired id may be cited: the commit retires it");
});

test("checkSpec --done: a cited FR still planned at the end of a plan fails", () => {
  assert.equal(checkSpec(spec, ["FR-48"]).ok, true);
  const r = checkSpec(spec, ["FR-13", "FR-48"], { done: true });
  assert.equal(r.ok, false);
  assert.deepEqual(r.plannedLeft, ["FR-48"]);
});

test("planIds and specPath", () => {
  assert.deepEqual(planIds("# Filter\n\nFeature: `live-sessions` · Components: `web` · Spec: FR-13, FR-48, BR-23\n"), ["FR-13", "FR-48", "BR-23"]);
  assert.deepEqual(planIds("# No header\n"), []);
  assert.match(specPath("x/00_spec.md", "/p").replace(/\\/g, "/"), /\/p\/x\/00_spec\.md$/);
  assert.match(specPath("live-sessions", "/no-project").replace(/\\/g, "/"), /\.planning\/pages\/live-sessions\.md$/, "a slug with no file is a page");
  const root = join(fixtures, "merge");
  assert.match(specPath("todo", root).replace(/\\/g, "/"), /\.planning\/domain\/todo\.md$/);
  assert.match(specPath("home", root).replace(/\\/g, "/"), /\.planning\/pages\/home\.md$/);
});

// The prototype's todo-detail blueprint against home and todo as they were before its merge (commit b774779 of proto/blueprint-v2).
const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures");
const read = (path) => readFileSync(join(fixtures, "merge", ".planning", path), "utf8");
const blueprint = read("blueprints/2026-10-22-todo-detail.md");
const specs = { home: read("pages/home.md"), todo: read("domain/todo.md"), "todo-detail": null };

test("planMerge: the prototype's delta, final ids, a new page, the Spec: line of its merge commit", () => {
  const bp = parseBlueprint(blueprint);
  assert.deepEqual([bp.pages, bp.domain, bp.merged], [["todo-detail", "home"], ["todo"], false]);
  const r = planMerge(blueprint, specs);
  assert.equal(r.ok, true);
  assert.deepEqual(r.create, [{ slug: "todo-detail", kind: "page" }]);
  assert.deepEqual(r.renames, []);
  assert.deepEqual(r.lines.map((l) => `${l.slug} ${l.op}${l.final ?? "Non-goal"} ${l.status}`), [
    "todo-detail +FR-01 ok", "todo-detail +FR-02 ok", "todo-detail +FR-03 ok", "todo-detail +FR-04 ok", "todo-detail +FR-05 ok",
    "todo-detail +Non-goal ok", "home +FR-18 ok", "home -Non-goal ok", "todo ~BR-03 ok",
  ]);
  assert.equal(r.specLine, "Spec: todo-detail +FR-01 +FR-02 +FR-03 +FR-04 +FR-05 · home +FR-18 · todo ~BR-03");
});

test("planMerge: another blueprint took FR-18 first, the id moves to FR-19", () => {
  const home = specs.home.replace("## Actions on a todo", "- **FR-18** — Merged by another blueprint.\n\n## Actions on a todo");
  const r = planMerge(blueprint, { ...specs, home });
  assert.equal(r.ok, true);
  assert.deepEqual(r.renames, [{ slug: "home", from: "FR-18", to: "FR-19" }]);
  assert.match(r.specLine, /· home \+FR-19 ·/);
  const two = planMerge(blueprint.replace("- home - Non-goal:", "- home + FR-19 — Another one.\n- home - Non-goal:"), { ...specs, home });
  assert.deepEqual(two.renames, [{ slug: "home", from: "FR-19", to: "FR-20" }, { slug: "home", from: "FR-18", to: "FR-19" }], "highest first: FR-18 never ends as FR-20");
});

test("planMerge: a before text changed during the build, an id gone, a merged blueprint, a bad line", () => {
  const todo = specs.todo.replace("takes the existing tag's casing", "keeps the first casing typed");
  const changed = planMerge(blueprint, { ...specs, todo });
  assert.equal(changed.ok, false);
  const br03 = changed.lines.find((l) => l.id === "BR-03");
  assert.equal(br03.status, "conflict");
  assert.match(br03.reason, /takes the existing tag's casing/);
  assert.equal(planMerge(blueprint, { ...specs, home: specs.home.replace("Editing a todo's name", "Editing a name") }).lines.find((l) => l.slug === "home" && l.op === "-").status, "conflict", "a removed non-goal must still be there");
  const gone = planMerge(blueprint, { ...specs, todo: specs.todo.replace(/^- \*\*BR-03\*\*.*$/m, "") });
  assert.equal(gone.lines.find((l) => l.id === "BR-03").status, "missing");
  const merged = planMerge(blueprint.replace("- [ ] Spec merged", "- [x] Spec merged"), specs);
  assert.deepEqual([merged.ok, merged.merged], [false, true]);
  const bad = planMerge(blueprint.replace("- home + FR-18 —", "- home adds FR-18 —"), specs);
  assert.equal(bad.lines.find((l) => l.raw?.startsWith("- home adds")).status, "invalid");
});

test("commit hook: what a commit command names", () => {
  assert.equal(isCommit('git add a.ts && git commit --only -m "feat(x): y" -- a.ts'), true);
  assert.equal(isCommit("git -C api commit -m x"), true);
  assert.equal(isCommit("git -c user.name=t -c user.email=t@t commit -m x -- a.ts"), true);
  assert.equal(isCommit("git --no-pager commit -m x"), true);
  assert.equal(isCommit('git log --grep "commit"'), false);
  assert.deepEqual(namedFiles('git commit --only -m "feat(x): y -- z" -m "Spec: x +FR-02" -- api/a.ts .planning/features/x/00_spec.md'), ["api/a.ts", ".planning/features/x/00_spec.md"]);
  assert.equal(namedFiles('git commit -m "x"'), null);
  assert.equal(isCode("api/src/a.ts"), true);
  assert.equal(isCode(".planning/features/x/00_spec.md"), false);
  assert.equal(isCode("web/CLAUDE.md"), false);
});

test("commit hook: warnings, never on a clean named commit", () => {
  const clean = 'git commit --only -m "feat(x): api — y" -m "Spec: x +FR-02" -- api/a.ts';
  assert.deepEqual(commitWarnings(clean, ["api/a.ts"]), []);
  assert.deepEqual(commitWarnings('git commit --only -m "docs(x): plan" -- .planning/x/plan.md', [".planning/x/plan.md"]), [], "no code: no Spec line needed");
  assert.match(commitWarnings('git commit -m "fix(x): y"', ["api/a.ts"]).join(), /no `Spec:` line/);
  assert.match(commitWarnings('git commit -am "fix(x): y" -m "Spec: none (refactor)"', null).join(), /git commit -a/);
  assert.match(commitWarnings('git add -A && git commit -m "x" -m "Spec: none (tooling)"', null).join(), /git add -A/);
  assert.match(commitWarnings('git commit --amend --no-edit', null).join(), /--amend/);
  assert.deepEqual(commitWarnings('git commit -m "a message about -a and --amend" -m "Spec: none (refactor)"', ["a.ts"]), [], "flags inside a message do not count");
});

test("commit hook: the files a git add before the commit stages", () => {
  assert.deepEqual(addedFiles('git add api/a.ts web/b.ts && git commit -m "feat(x): y"'), ["api/a.ts", "web/b.ts"]);
  assert.deepEqual(addedFiles('git add -N api/a.ts; git commit -m "git add z"'), ["api/a.ts"], "flags and messages do not count");
  assert.deepEqual(addedFiles('git commit -m "x"'), []);
});

test("commit hook: a spec of the commit with a duplicate id and a Spec: line citing an unknown id", () => {
  const root = mkdtempSync(join(tmpdir(), "selo-flow-hook-"));
  try {
    mkdirSync(join(root, ".planning", "features", "live"), { recursive: true });
    writeFileSync(join(root, ".planning", "features", "live", "00_spec.md"), spec + "\n- **FR-48** — Another addition.\n");
    const [warning, ...rest] = specWarnings(root, 'git commit -m "feat(live): y" -m "Spec: live +FR-99"', [".planning/features/live/00_spec.md", "api/a.ts"]);
    assert.deepEqual(rest, []);
    assert.match(warning, /^spec-check live: duplicate ids FR-48; ids of the Spec: line missing from the spec FR-99 \(next free: FR-51, BR-24\)\.$/);
    assert.deepEqual(specWarnings(root, 'git commit -m "x"', ["api/a.ts"]), [], "no spec in the commit: nothing checked");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("commit hook: the Spec: line, one group per file, pending and none", () => {
  assert.deepEqual(parseSpecLine('git commit -m "feat(x): y" -m "Spec: home +FR-18 ~FR-03 · todo ~BR-03"').groups, { home: ["FR-18", "FR-03"], todo: ["BR-03"] });
  assert.deepEqual(parseSpecLine('git commit -m "x" -m "Spec: pending (.planning/blueprints/2026-10-22-a.md)"'), { pending: ".planning/blueprints/2026-10-22-a.md", groups: {} });
  assert.equal(parseSpecLine('git commit -m "x" -m "Spec: none (refactor)"').none, true);
  assert.equal(parseSpecLine('git commit -m "x"'), null);
  assert.deepEqual([".planning/pages/home.md", ".planning/pages/web/home.md", ".planning/domain/todo.md", ".planning/features/live/00_spec.md", ".planning/blueprints/a.md"].map(specSlug), ["home", "web/home", "todo", "live", null]);
});

test("commit hook: page and domain specs checked per group, a pending blueprint missing or merged", () => {
  const root = join(fixtures, "merge");
  const files = [".planning/pages/home.md", ".planning/domain/todo.md"];
  assert.deepEqual(specWarnings(root, 'git commit -m "x" -m "Spec: home ~FR-03 · todo ~BR-03"', files), [], "BR-03 is checked in todo, not in home");
  assert.match(specWarnings(root, 'git commit -m "x" -m "Spec: home +FR-99 · todo ~BR-03"', files).join(), /^spec-check home: ids of the Spec: line missing from the spec FR-99/);
  const pending = (path) => specWarnings(root, `git commit -m "feat(a): api — b" -m "Spec: pending (${path})"`, ["api/a.ts"]);
  assert.deepEqual(pending(".planning/blueprints/2026-10-22-todo-detail.md"), [], "an existing blueprint not merged");
  assert.match(pending(".planning/blueprints/nope.md").join(), /does not exist/);
  const tmp = mkdtempSync(join(tmpdir(), "selo-flow-pending-"));
  try {
    mkdirSync(join(tmp, ".planning", "blueprints"), { recursive: true });
    writeFileSync(join(tmp, ".planning", "blueprints", "b.md"), blueprint.replace("- [ ] Spec merged", "- [x] Spec merged"));
    assert.match(specWarnings(tmp, 'git commit -m "x" -m "Spec: pending (.planning/blueprints/b.md)"', ["api/a.ts"]).join(), /already merged/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  assert.deepEqual(commitWarnings('git commit --only -m "feat(a): api — b" -m "Spec: pending (.planning/blueprints/b.md)" -- api/a.ts', ["api/a.ts"]), [], "pending counts as a Spec: line");
});
