import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSpec } from "./spec-check.mjs";

const spec = `# Live sessions — Spec
## Functional Requirements
### Liste
- **FR-01** — La liste montre chaque session.
- **FR-13** — Le filtre « Vous attend » inclut awaiting-commit.
### Notifications
- **FR-31** — Une notification par session.
- **FR-48** — (planned) Un son par notification.
## Business Rules
- **BR-23** — Un filtre vide montre toutes les sessions.

Retired: FR-07, FR-50, BR-04
`;

test("clean spec: next ids skip retired ones, planned listed", () => {
  const r = checkSpec(spec, ["FR-13", "BR-23"]);
  assert.equal(r.ok, true);
  assert.equal(r.next.FR, "FR-51");
  assert.equal(r.next.BR, "BR-24");
  assert.deepEqual(r.planned, ["FR-48"]);
});

test("duplicate id from two parallel sessions", () => {
  const r = checkSpec(spec + "\n- **FR-48** — Autre ajout.\n");
  assert.equal(r.ok, false);
  assert.deepEqual(r.duplicates, ["FR-48"]);
});

test("retired id reused, cited id missing", () => {
  const r = checkSpec(spec.replace("FR-31", "FR-07"), ["FR-99"]);
  assert.deepEqual(r.retiredReused, ["FR-07"]);
  assert.deepEqual(r.missing, ["FR-99"]);
});
