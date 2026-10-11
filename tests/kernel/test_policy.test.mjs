import { makeTestOwners, testLeaseContext } from "./test_control_memory.test.mjs";
const kernelOwners = makeTestOwners("Backend", ["backend/a.txt"]);
import test from "node:test";
import "./test_project_read.test.mjs";
import assert from "node:assert/strict";
import * as api from "../../src/kernel/services/public/policy.mjs";
import { AgentSession, ActionProposal, RoleBoundary, Outcome, PolicyDecision,
  _createRuntimeAuthority } from "../../src/kernel/models/core.mjs";
import { AgentScope, TaskDispatchContext } from "../../src/kernel/models/agent.mjs";
import { ConfirmedTaskGrant } from "../../src/kernel/models/workbench.mjs";
const session = new AgentSession({ sessionId: "trusted", roleId: "Backend", taskId: "task", organizationVersion: "v3" });
function boundary(extra = {}) { return new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"],
  tools: ["legion_write_file"], capabilities: ["write_file"], ...extra }); }
function proposal(extra = {}) { return new ActionProposal({ proposalId: "p", action: "write_file", resource: "backend/a.txt",
  content: "content", tool: "legion_write_file", capability: "write_file", session, ...extra }); }
function evaluate(p = proposal(), b = boundary(), extra = {}) {
  return api.createPolicyService().evaluate(p, { boundary: b, trustedSession: session, currentVersion: "v3", fileOwners: kernelOwners, ...extra });
}

test("pure Policy cross-checks typed confirmed grant against actual task and instance scope", () => {
  const grant = new ConfirmedTaskGrant({ confirmationId: "human", workspaceIdentity: {
    canonicalPath: "D:/project", deviceId: "1", fileId: "2" }, planDigest: "a".repeat(64),
    organizationVersion: "v3", profileVersion: "1", contextSnapshotDigest: "b".repeat(64),
    roleId: "Backend", taskId: "task", fileOwnersDigest: kernelOwners.digest, ownerGeneration: kernelOwners.version, tools: ["legion_write_file"] });
  const p = proposal({ runId: "run" });
  const instance = { session, status: "running", runId: "run", workbenchGrant: grant,
    grant: { fileOwnersDigest: kernelOwners.digest, ownerGeneration: kernelOwners.version, taskTools: ["legion_write_file"],
      write: ["backend/a.txt"], deny: [], tools: ["legion_write_file"] } };
  assert.equal(evaluate(p, boundary(), { instance }).outcome, Outcome.ALLOW);
  for (const workbenchGrant of [{ ...grant }, new ConfirmedTaskGrant({ ...grant, taskId: "other" })]) {
    assert.equal(evaluate(p, boundary(), { instance: { ...instance, workbenchGrant } }).reason, "confirmed_task_binding_mismatch");
  }
  assert.equal(evaluate(p, boundary(), { instance: { ...instance,
    grant: { ...instance.grant, ownerGeneration: "stale" } } }).reason, "confirmed_task_scope_mismatch");
  assert.equal(evaluate(p, boundary({ requiredApprovals: ["BACKEND\\A.TXT"] }), { instance }).outcome,
    Outcome.REQUIRE_APPROVAL);
});
test("public pure contract returns immutable decision, never a permit", () => {
  assert.deepEqual(Object.keys(api).sort(), ["PolicyService", "createPolicyService"].sort());
  assert.throws(() => new api.PolicyService(), TypeError);
  const value = evaluate(); assert.ok(value instanceof PolicyDecision); assert.ok(Object.isFrozen(value));
  assert.equal(value.outcome, Outcome.ALLOW); assert.equal(value.proposalDigest, proposal().digest);
});
test("equal copied identity cannot replace trusted session", () => {
  assert.equal(evaluate(proposal({ session: new AgentSession({ ...session }) })).reason, "invalid_identity");
});
test("unknown role, inactive task and old version fail closed", () => {
  assert.equal(evaluate(proposal(), undefined, { boundary: undefined }).reason, "unknown_role");
  assert.equal(evaluate(proposal(), boundary(), { taskStatus: "completed" }).reason, "task_inactive");
  assert.equal(evaluate(proposal(), boundary(), { currentVersion: "v4" }).reason, "version_mismatch");
  assert.equal(evaluate({}).reason, "invalid_proposal");
});
test("all control plane roots, aliases and unsafe resource forms denied", () => {
  for (const resource of [".ans/organization/x", ".GIT/x", ".agents/x", ".codex/x", ".aws/x", "../backend/a.txt",
    "C:\\backend\\a.txt", "/backend/a.txt", "backend/../a.txt", "backend/con.txt", "backend/a. "]) {
    assert.equal(evaluate(proposal({ resource })).outcome, Outcome.DENY, resource);
  }
});
test("scope component semantics and case/separator aliases", () => {
  assert.equal(evaluate(proposal({ resource: "BACKEND\\A.TXT" })).outcome, Outcome.ALLOW);
  assert.equal(evaluate(proposal({ resource: "backend2/a.txt" })).outcome, Outcome.DENY);
  assert.equal(evaluate(proposal({ resource: "backend/a.txt/sub" }), boundary({ writeScope: ["backend/a.txt"] })).outcome, Outcome.DENY);
});
test("explicit deny wins approvals, handoff and expansion", () => {
  const b = boundary({ denyScope: ["backend/private/"], requiredApprovals: ["write_file"],
    handoffTargets: ["Frontend"], allowScopeExpansion: true });
  assert.equal(evaluate(proposal({ resource: "BACKEND\\PRIVATE\\x.txt" }), b).reason, "explicit_deny");
});
test("approval exact resource canonicalization and action token regressions", () => {
  for (const resource of ["backend/approved.txt", "BACKEND/APPROVED.TXT", "backend\\approved.txt"]) {
    assert.equal(evaluate(proposal({ resource }), boundary({ requiredApprovals: ["backend/approved.txt"] }), { fileOwners: makeTestOwners("Backend", ["backend/approved.txt"]) }).outcome,
      Outcome.REQUIRE_APPROVAL);
  }
  assert.equal(evaluate(proposal(), boundary({ requiredApprovals: ["write_file"] })).outcome, Outcome.REQUIRE_APPROVAL);
  assert.equal(evaluate(proposal(), boundary({ requiredApprovals: ["backend/other.txt"] })).outcome, Outcome.ALLOW);
});
test("malformed approvals and scalar collection restrictions reject at construction", () => {
  for (const field of ["readScope", "writeScope", "denyScope", "tools", "capabilities", "requiredApprovals", "handoffTargets"]) {
    assert.throws(() => boundary({ [field]: "write_file" }), TypeError, field);
  }
  for (const condition of ["backend/", "../backend/x", "C:\\x", ".ans/x"]) {
    assert.throws(() => boundary({ requiredApprovals: [condition] }), TypeError);
  }
});
test("missing capability/tool and unsupported action cannot authorize", () => {
  assert.equal(evaluate(proposal(), boundary({ tools: [] })).reason, "missing_tool_or_capability");
  assert.equal(evaluate(proposal(), boundary({ capabilities: [] })).reason, "missing_tool_or_capability");
  assert.equal(evaluate(proposal({ action: "delete" })).reason, "unsupported_action_tool_or_capability");
});
test("scope violation selects known handoff, expansion, or denial without execution", () => {
  const p = proposal({ resource: "frontend/login.vue" });
  const value = evaluate(p, boundary({ handoffTargets: ["Backend", "Ghost", "Frontend"] }), { knownRoles: ["Frontend", "Backend"] });
  assert.equal(value.outcome, Outcome.DENY); assert.equal(value.reason, "file_owner_mismatch");
  assert.equal(evaluate(p, boundary({ allowScopeExpansion: true })).outcome, Outcome.DENY);
  assert.equal(evaluate(p).outcome, Outcome.DENY);
});

test("edit uses write capability, exact task scope and both write approval forms", () => {
  const tools = ["legion_edit_file"];
  const editBoundary = new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"],
    tools, capabilities: ["write_file"] });
  const dispatchContext = new TaskDispatchContext({ roleId: "Backend", taskId: "task",
    organizationVersion: "v3", fileOwnersDigest: kernelOwners.digest, ownerGeneration: kernelOwners.version, tools });
  const scope = new AgentScope({ write: ["backend/a.txt"], tools });
  const authority = _createRuntimeAuthority({ fileOwners: kernelOwners, boundaries: [editBoundary], organizationVersion: "v3" });
  authority.registerInstance({ instanceId: "i", session, dispatchContext, scope });
  const instance = authority.beginRun("i", "run");
  const edit = new ActionProposal({ proposalId: "edit", action: "edit_file", resource: "backend/a.txt",
    tool: "legion_edit_file", capability: "write_file", session, runId: "run",
    expectedSha256: "a".repeat(64), replacements: [{ oldText: "old", newText: "new" }] });
  const context = { boundary: editBoundary, trustedSession: session, currentVersion: "v3",
    dispatchContext, instance };
  const policy = api.createPolicyService();
  assert.equal(policy.evaluate(edit, context).outcome, Outcome.ALLOW);
  for (const approval of ["write_file", "BACKEND\\A.TXT"]) {
    const approved = new RoleBoundary({ ...editBoundary, requiredApprovals: [approval] });
    assert.equal(policy.evaluate(edit, { ...context, boundary: approved }).outcome, Outcome.REQUIRE_APPROVAL);
  }
  assert.equal(policy.evaluate(new ActionProposal({ ...edit, resource: "backend/b.txt" }), context).reason,
    "outside_instance_or_task_scope");
  assert.equal(policy.evaluate(new ActionProposal({ ...edit, tool: "legion_write_file" }), context).reason,
    "unsupported_action_tool_or_capability");
});
