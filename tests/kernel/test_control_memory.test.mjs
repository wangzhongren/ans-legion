import nodeFs from "node:fs";
import { join, dirname } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { ProjectFileOwners } from "../../src/kernel/models/workbench.mjs";
import { AgentControlTools, AgentControlDecision, AgentControlResult, PiToolRequest, PiToolResult, TaskDispatchContext } from "../../src/kernel/models/agent.mjs";
import { RoleBoundary, validateInstanceGrant } from "../../src/kernel/models/core.mjs";

export function makeTestOwners(roleId, resources, version = "1") {
  return new ProjectFileOwners({ projectId: "kernel-fixture", version,
    owners: resources.map(resource => ({ resource, roleId })) });
}
const fixtureStates = new Map();
after(() => {
  for (const state of fixtureStates.values()) {
    if (!nodeFs.existsSync(state)) continue;
    assert.equal(nodeFs.realpathSync(state), state);
    assert.equal(nodeFs.lstatSync(state).isSymbolicLink(), false);
    nodeFs.rmSync(state, { recursive: true });
  }
});
export function testLeaseContext(workspace, owners) {
  const root = nodeFs.realpathSync(workspace);
  const id = path => { const value = nodeFs.lstatSync(path, { bigint: true }); return { deviceId: String(value.dev), fileId: String(value.ino) }; };
  const workspaceIdentity = { canonicalPath: root, ...id(root) };
  let state = fixtureStates.get(root);
  if (state === undefined) { state = nodeFs.mkdtempSync(join(dirname(root), "owner-lease-fixture-")); fixtureStates.set(root, state); }
  const leaseRoot = join(state, "leases"), catalogDir = join(state, "catalog");
  nodeFs.mkdirSync(leaseRoot, { recursive: true, mode: 0o700 }); nodeFs.mkdirSync(catalogDir, { recursive: true, mode: 0o700 });
  const key = createHash("sha256").update(workspaceIdentity.deviceId + ":" + workspaceIdentity.fileId).digest("hex");
  const lock = join(leaseRoot, key); nodeFs.mkdirSync(lock, { recursive: true, mode: 0o700 });
  const holder = join(lock, "holder");
  if (!nodeFs.existsSync(holder)) nodeFs.writeFileSync(holder, randomUUID(), { flag: "wx", mode: 0o600 });
  const catalogPath = join(catalogDir, "workbench-projects.json");
  if (!nodeFs.existsSync(catalogPath)) nodeFs.writeFileSync(catalogPath, JSON.stringify({ schemaVersion: 2, projects: [{ schemaVersion: 2, id: owners.projectId, workspaceIdentity, fileOwners: owners, plan: null, tasks: [], legacyHistory: [] }] }), { flag: "wx", mode: 0o600 });
  const markerPath = join(leaseRoot, key + ".owner-source.json");
  const catalogIdentity = id(catalogDir);
  if (!nodeFs.existsSync(markerPath)) nodeFs.writeFileSync(markerPath, JSON.stringify({ schemaVersion: 1, workspace: workspaceIdentity, source: { catalogDirCanonicalPath: catalogDir, dirDeviceId: catalogIdentity.deviceId, dirFileId: catalogIdentity.fileId, filename: "workbench-projects.json", projectId: owners.projectId } }), { flag: "wx", mode: 0o600 });
  return { leaseRoot, nonce: nodeFs.readFileSync(holder, "utf8"), leaseIdentity: id(lock), holderIdentity: id(holder) };
}

test("CLI memory and supervision are typed control results with separate capabilities", () => {
  const owners = makeTestOwners("Supervisor", []);
  for (const [tool, capability] of [["legion_query_memory", "query_memory"],
    ["legion_remember_fact", "remember_fact"], ["legion_submit_supervision", "submit_supervision"]]) {
    assert.ok(AgentControlTools.includes(tool));
    const request = new PiToolRequest({ requestId: "q", runId: "run", toolCallId: "c", tool,
      parameters: { payload: { action: "add", statement: "bounded fact", expectedRevision: 0 } } });
    const decision = new AgentControlDecision({ allowed: true, reason: "host_validated", requestId: "q", runId: "run", tool });
    const result = new AgentControlResult({ requestId: "q", runId: "run", tool, status: "completed", reason: "stored", payload: { revision: 1 } });
    const response = new PiToolResult({ requestId: "q", runId: "run", decision, result });
    assert.equal(response.result, result);
    assert.ok(Object.isFrozen(request.parameters.payload));
    const dispatch = new TaskDispatchContext({ roleId: "Supervisor", taskId: "control", organizationVersion: "v2",
      fileOwnersDigest: owners.digest, ownerGeneration: owners.version, tools: [tool] });
    const scope = { write: [], deny: [], tools: [tool] };
    assert.equal(validateInstanceGrant(new RoleBoundary({ roleId: "Supervisor", tools: [tool], capabilities: [capability] }), dispatch, scope, owners).write.length, 0);
    assert.throws(() => validateInstanceGrant(new RoleBoundary({ roleId: "Supervisor", tools: [tool] }), dispatch, scope, owners), /missing_capability/);
    assert.throws(() => new PiToolRequest({ ...request, parameters: { payload: { ownerRoleId: "other", token: "secret" } } }), /secret|control/);
  }
});

test("Su delegation domain admits start/resume and rejects fake Human values or caller identity", () => {
  const base = { requestId: "q", runId: "front-run", toolCallId: "c", tool: "legion_delegate_pm" };
  const request = payload => new PiToolRequest({ ...base, parameters: { payload } });
  const start = { action: "start", purpose: "plan", instruction: "x".repeat(8192), sourceRefs: Array(32).fill("human:source") };
  const resume = { action: "resume", delegationId: "host-delegation", humanAnswerRef: "host-answer" };
  assert.equal(request(start).parameters.payload.instruction.length, 8192);
  assert.deepEqual(request(resume).parameters.payload, resume);
  assert.equal(request({ ...start, purpose: "repair", acceptanceId: "acceptance", taskId: "task" }).parameters.payload.purpose, "repair");
  assert.equal(request({ ...start, purpose: "role_design" }).parameters.payload.purpose, "role_design");
  for (const payload of [{ ...start, instruction: "x".repeat(8193) }, { ...start, instruction: "汉".repeat(2731) },
    { ...start, sourceRefs: Array(33).fill("human:h") }, { ...start, sourceRefs: ["x".repeat(201)] },
    { ...start, purpose: "execute_plan" }, { ...start, purpose: "repair" }, { ...start, taskId: "fake" },
    { ...start, projectId: "other" }, { ...start, callerInstanceId: "front" }, { ...start, channel: "su_customer" },
    { ...resume, value: true }, { ...resume, instruction: "mixed" }, { ...resume, humanAnswerRef: "" }]) {
    assert.throws(() => request(payload), TypeError);
  }
  const decision = new AgentControlDecision({ requestId: "q", runId: "front-run", tool: base.tool, allowed: true, reason: "host_bound" });
  const result = new AgentControlResult({ requestId: "q", runId: "front-run", tool: base.tool, status: "completed", reason: "pending", payload: { kind: "needs_human", delegationId: "host-delegation", questionRef: "host-question", status: "awaiting_human" } });
  assert.equal(new PiToolResult({ requestId: "q", runId: "front-run", decision, result }).result.payload.status, "awaiting_human");
});

test("Su queries have bounded typed filters/pages/results and cannot fake another tool", () => {
  for (const tool of ["legion_query_role_activity", "legion_query_role_log"]) {
    const base = { requestId: "q", runId: "r", toolCallId: "c", tool };
    let valid = { roleId: "Backend", taskId: "task", planDigest: "a".repeat(64) };
    if (tool === "legion_query_role_log") valid = { ...valid, cursor: "x".repeat(4096), limit: 50 };
    const request = payload => new PiToolRequest({ ...base, parameters: { payload } });
    assert.deepEqual(request(valid).parameters.payload, valid);
    if (tool === "legion_query_role_activity") assert.deepEqual(request({}).parameters.payload, {});
    for (const change of [{ projectId: "other" }, { callerRoleId: "Supervisor" }, { purpose: "su_customer" },
      { roleId: "x".repeat(201) }, { planDigest: "invalid" }, { path: ".ans/private" }]) {
      assert.throws(() => request({ ...valid, ...change }), TypeError);
    }
    if (tool === "legion_query_role_log") for (const change of [{ limit: 0 }, { limit: 51 }, { limit: 1.5 }, { cursor: "x".repeat(4097) }]) assert.throws(() => request({ ...valid, ...change }), TypeError);
    const options = { requestId: "q", runId: "r", tool, status: "completed", reason: "safe_page", payload: { text: "x".repeat(32757) } };
    assert.equal(Buffer.byteLength(JSON.stringify(new AgentControlResult(options).payload)), 32768);
    assert.throws(() => new AgentControlResult({ ...options, payload: { text: "x".repeat(32758) } }), /role_query_result_budget/);
    const result = new AgentControlResult({ ...options, payload: { items: [], nextCursor: null } });
    const wrongDecision = new AgentControlDecision({ requestId: "q", runId: "r", tool: "legion_delegate_pm", allowed: true, reason: "wrong" });
    assert.throws(() => new PiToolResult({ requestId: "q", runId: "r", decision: wrongDecision, result }), /control_result_tool_mismatch/);
  }
});
