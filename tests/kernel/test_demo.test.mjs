import { makeTestOwners, testLeaseContext } from "./test_control_memory.test.mjs";
import { ProjectFileOwners } from "../../src/kernel/models/workbench.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { runPermissionDemo } from "../../src/kernel/pipelines/permission.mjs";
test("native Node demo preserves frontend and exercises six actual permission scenarios", async (t) => {
  const generated = fileURLToPath(new URL("../../.ans/runtime/legion-cli-role-owned-v2/KernelEngineer/tmp/", import.meta.url));
  await fs.mkdir(generated, { recursive: true });
  const workspace = await fs.mkdtemp(join(generated, "demo-"));
  t.after(async () => { assert.ok(workspace.startsWith(generated)); await fs.rm(workspace, { recursive: true }); });
  const demo = await runPermissionDemo({ workspace, leaseContext: testLeaseContext(workspace, new ProjectFileOwners({ projectId: "permission-demo", version: "1", owners: [{ resource: "backend/main.mjs", roleId: "Backend" }, { resource: "frontend/login.vue", roleId: "Frontend" }] })) });
  assert.equal(demo.backendWritten, true); assert.equal(demo.frontendPreserved, true);
  assert.deepEqual(demo.rows.map((row) => row.scenario), ["allowed", "outside", "tool", "capability", "deny", "version"]);
  assert.deepEqual(demo.rows.map((row) => row.decision.outcome), ["ALLOW", "DENY", "DENY", "DENY", "DENY", "DENY"]);
  assert.deepEqual(demo.rows.map((row) => row.result.status), ["written", "denied", "denied", "denied", "denied", "denied"]);
  assert.equal(demo.events.length, 23); assert.deepEqual(demo.events.map((e) => e.sequence), Array.from({ length: 23 }, (_, i) => i + 1));
  assert.ok(demo.events.some((e) => e.resource === "frontend/login.vue" && e.kind === "mutation_failure"));
});

test("self-created private demo persists an explicit schema2 catalog/project", async () => {
  const demo = await runPermissionDemo();
  assert.equal(demo.backendWritten, true); assert.equal(demo.frontendPreserved, true);
  assert.equal(demo.rows[0].result.status, "written");
});
