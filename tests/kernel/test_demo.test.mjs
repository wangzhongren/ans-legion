import test from "node:test";
import assert from "node:assert/strict";
import { runPermissionDemo } from "../../src/kernel/pipelines/permission.mjs";
test("native Node demo preserves frontend and exercises six actual permission scenarios", async () => {
  const demo = await runPermissionDemo();
  assert.equal(demo.backendWritten, true); assert.equal(demo.frontendPreserved, true);
  assert.deepEqual(demo.rows.map((row) => row.scenario), ["allowed", "outside", "tool", "capability", "deny", "version"]);
  assert.deepEqual(demo.rows.map((row) => row.decision.outcome), ["ALLOW", "DENY", "DENY", "DENY", "DENY", "DENY"]);
  assert.deepEqual(demo.rows.map((row) => row.result.status), ["written", "denied", "denied", "denied", "denied", "denied"]);
  assert.equal(demo.events.length, 23); assert.deepEqual(demo.events.map((e) => e.sequence), Array.from({ length: 23 }, (_, i) => i + 1));
  assert.ok(demo.events.some((e) => e.resource === "frontend/login.vue" && e.kind === "mutation_failure"));
});
