import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSpec, planIds, specPath } from "../scripts/spec-check.mjs";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addedFiles, commitWarnings, isCode, isCommit, namedFiles, specWarnings } from "../scripts/commit-hook.mjs";

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
  assert.match(specPath("live-sessions", "/no-project").replace(/\\/g, "/"), /\.planning\/features\/live-sessions\/00_spec\.md$/);
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
