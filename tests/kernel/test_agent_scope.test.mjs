import { makeTestOwners, testLeaseContext } from "./test_control_memory.test.mjs";
const kernelOwners = makeTestOwners("Backend", ["backend/a.txt"]);
import test from "node:test";
import assert from "node:assert/strict";
import { createPolicyService } from "../../src/kernel/services/public/policy.mjs";
import { AgentSession, ActionProposal, RoleBoundary, Outcome, _createRuntimeAuthority } from "../../src/kernel/models/core.mjs";
import { AgentScope, TaskDispatchContext } from "../../src/kernel/models/agent.mjs";
const boundary = new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"], denyScope: ["backend/private/"],
  tools: ["legion_write_file"], capabilities: ["write_file"], handoffTargets: ["Frontend"], allowScopeExpansion: true });
const dispatch = new TaskDispatchContext({ roleId: "Backend", taskId: "task", organizationVersion: "v3",
  fileOwnersDigest: kernelOwners.digest, ownerGeneration: kernelOwners.version, tools: ["legion_write_file"] });
function scope(extra = {}) { return new AgentScope({ write: ["backend/a.txt"], tools: ["legion_write_file"], ...extra }); }
const policy = createPolicyService();
test("discussion scope requires empty instance and task writes/tools and cannot approve writing", () => {
  const manager = new RoleBoundary({ roleId: "ProjectManager" });
  const context = new TaskDispatchContext({ roleId: "ProjectManager", taskId: "discussion",
    organizationVersion: "v4", fileOwnersDigest: kernelOwners.digest, ownerGeneration: kernelOwners.version, tools: [] });
  const noTools = new AgentScope({ write: [], tools: [] });
  assert.deepEqual(policy.validateScope(manager, context, noTools, kernelOwners).write, []);
  assert.throws(() => policy.validateScope(manager, new TaskDispatchContext({ ...context }), new AgentScope({ write: ["backend/a.txt"], tools: [] }), kernelOwners), /file_owner_mismatch/);
  assert.throws(() => policy.validateScope(manager, new TaskDispatchContext({ ...context, tools: ["legion_write_file"] }), new AgentScope({ write: [], tools: ["legion_write_file"] }), kernelOwners), /empty_owner_scope/);
  const session = new AgentSession({ sessionId: "pm", roleId: "ProjectManager", taskId: "discussion", organizationVersion: "v4" });
  const proposal = new ActionProposal({ proposalId: "p", action: "write_file", resource: "backend/a.txt", content: "body",
    tool: "legion_write_file", capability: "write_file", session });
  assert.equal(policy.evaluate(proposal, { boundary: manager, trustedSession: session,
    currentVersion: "v4", dispatchContext: context }).outcome, Outcome.DENY);
});
test("creation scope is copied immutable exact role/task subset", () => {
  const grant = policy.validateScope(boundary, dispatch, scope({ write: ["BACKEND\\A.TXT"] }), kernelOwners);
  assert.deepEqual(grant.write, ["BACKEND/A.TXT"]); assert.ok(Object.isFrozen(grant.write));
});
test("directory expansion, other task file, role denial and own denial reject before SDK creation", () => {
  for (const write of [["backend/"], ["backend/not-task.txt"], ["backend/private/x.txt"], ["frontend/x.txt"]]) {
    assert.throws(() => policy.validateScope(boundary, dispatch, scope({ write }), kernelOwners), TypeError);
  }
  assert.throws(() => policy.validateScope(boundary, dispatch, scope({ deny: ["BACKEND/A.TXT"] }), kernelOwners), /explicit_deny/);
});
test("tool intersection is exact singleton with role capability", () => {
  for (const tools of [[], ["bash"], ["legion_write_file", "read"]]) {
    assert.throws(() => policy.validateScope(boundary, dispatch, scope({ tools }), kernelOwners), TypeError);
  }
  const noTool = new TaskDispatchContext({ ...dispatch, tools: [] });
  assert.throws(() => policy.validateScope(boundary, noTool, scope(), kernelOwners), /outside_tool_grant/);
});
test("request grant cannot replace task role or malformed scalar scopes", () => {
  const wrong = new TaskDispatchContext({ ...dispatch, roleId: "Frontend" });
  assert.throws(() => policy.validateScope(boundary, wrong, scope(), kernelOwners), /dispatch_role_mismatch/);
  for (const field of ["write", "deny", "tools"]) assert.throws(() => scope({ [field]: "backend/a.txt" }), TypeError);
});
test("execution evaluates exact instance/run and denies task expansion ahead of handoff", () => {
  const session = new AgentSession({ sessionId: "s", roleId: "Backend", taskId: "task", organizationVersion: "v3" });
  const authority = _createRuntimeAuthority({ fileOwners: kernelOwners, boundaries: [boundary], organizationVersion: "v3" });
  authority.registerInstance({ instanceId: "i", session, dispatchContext: dispatch, scope: scope() });
  const instance = authority.beginRun("i", "run");
  function evaluate(resource, runId = "run", currentInstance = instance) {
    const proposal = new ActionProposal({ proposalId: "p", action: "write_file", resource, content: "x",
      tool: "legion_write_file", capability: "write_file", session, runId });
    return policy.evaluate(proposal, { boundary, trustedSession: session, currentVersion: "v3", instance: currentInstance });
  }
  assert.equal(evaluate("backend/a.txt").outcome, Outcome.ALLOW);
  assert.equal(evaluate("backend/b.txt").reason, "outside_instance_or_task_scope");
  assert.equal(evaluate("frontend/x.txt").outcome, Outcome.DENY);
  assert.equal(evaluate("backend/a.txt", "foreign").reason, "instance_or_run_changed");
  assert.equal(evaluate("backend/a.txt", "run", authority.finishRun("i", "completed")).reason, "instance_or_run_changed");
});

test("edit-only instance keeps the same exact task write intersection", () => {
  const editBoundary = new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"],
    capabilities: ["write_file"], tools: ["legion_edit_file"] });
  const task = new TaskDispatchContext({ roleId: "Backend", taskId: "task", organizationVersion: "v3",
    fileOwnersDigest: kernelOwners.digest, ownerGeneration: kernelOwners.version, tools: ["legion_edit_file"] });
  const allowed = new AgentScope({ write: ["backend/a.txt"], tools: ["legion_edit_file"] });
  assert.deepEqual(policy.validateScope(editBoundary, task, allowed, kernelOwners).write, ["backend/a.txt"]);
  assert.throws(() => policy.validateScope(editBoundary, task,
    new AgentScope({ write: ["backend/b.txt"], tools: ["legion_edit_file"] }), kernelOwners), /complete_role_owner_scope_required/);
  assert.throws(() => policy.validateScope(new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"],
    tools: ["legion_edit_file"] }), task, allowed, kernelOwners), /missing_capability/);
});

test("workflow capability tools preserve exact grants and cannot manufacture source writes", async () => {
  const { CheckSpec } = await import("../../src/kernel/models/check.mjs");
  const { validateInstanceGrant, _createRuntimeAuthority, AgentSession } = await import("../../src/kernel/models/core.mjs");
  const checks = [new CheckSpec({ checkId: "unit", kind: "node-test", argv: ["--test", "tests/unit.mjs"],
    testResources: ["tests/unit.mjs"], inputResources: ["tests/unit.mjs"], timeoutSeconds: 5 })];
  const tools = ["legion_run_check", "legion_design_roles", "legion_propose_roles", "legion_review_roles",
    "legion_request_interaction", "legion_submit_acceptance", "legion_request_repair"];
  const capabilities = tools.map((tool) => tool.slice(7));
  const boundary = new RoleBoundary({ roleId: "Acceptance", writeScope: [], tools, capabilities });
  const context = new TaskDispatchContext({ roleId: "Acceptance", taskId: "task", organizationVersion: "v1",
    fileOwnersDigest: kernelOwners.digest, ownerGeneration: kernelOwners.version, tools, checks });
  const scope = new AgentScope({ write: [], tools, checks });
  const grant = policy.validateScope(boundary, context, scope, kernelOwners);
  assert.equal(grant.checks.length, 1); assert.deepEqual(grant.write, []);
  assert.throws(() => grant.checks[0].argv.push("evil"), TypeError);
  assert.throws(() => validateInstanceGrant(new RoleBoundary({ ...boundary, capabilities: [] }), context, scope, kernelOwners), /missing_capability/);
  assert.throws(() => validateInstanceGrant(boundary, context, new AgentScope({ ...scope, checks: [] }), kernelOwners), /missing_check_grant/);
  assert.throws(() => validateInstanceGrant(boundary, context, new AgentScope({ ...scope,
    checks: [new CheckSpec({ ...checks[0], timeoutSeconds: 10 })] }), kernelOwners), /outside_check_grant/);
  const authority = _createRuntimeAuthority({ fileOwners: kernelOwners, boundaries: [boundary], organizationVersion: "v1" });
  const session = new AgentSession({ sessionId: "s", roleId: "Acceptance", taskId: "task", organizationVersion: "v1" });
  assert.equal(authority.registerInstance({ instanceId: "i", session, dispatchContext: context, scope }).status, "ready");
  assert.equal(authority.beginRun("i", "run").status, "running");
});

test("Su front and background queries have independent capabilities and cannot widen background delegation", () => {
  const queryTools = ["legion_query_role_activity", "legion_query_role_log"];
  const frontTools = [...queryTools, "legion_delegate_pm"];
  const owner = makeTestOwners("Backend", ["backend/a.txt"]);
  const boundary = new RoleBoundary({ roleId: "Supervisor", tools: frontTools,
    capabilities: ["query_role_activity", "query_role_log", "delegate_pm"] });
  for (const taskId of ["su_customer", "supervision_preflight", "supervision_monitor"]) {
    let tools = queryTools;
    if (taskId === "su_customer") tools = frontTools;
    const dispatch = new TaskDispatchContext({ roleId: "Supervisor", taskId, organizationVersion: "v2",
      fileOwnersDigest: owner.digest, ownerGeneration: owner.version, tools });
    const scope = new AgentScope({ write: [], tools });
    const grant = policy.validateScope(boundary, dispatch, scope, owner);
    assert.deepEqual(grant.tools, tools); assert.deepEqual(grant.write, []);
    assert.equal(grant.tools.some(tool => ["legion_write_file", "legion_edit_file", "legion_run_check", "legion_request_shell"].includes(tool)), false);
    if (taskId !== "su_customer") assert.throws(() => policy.validateScope(boundary, dispatch,
      new AgentScope({ write: [], tools: frontTools }), owner), /outside_tool_grant/);
    for (const tool of tools) {
      const capabilities = boundary.capabilities.filter(capability => capability !== tool.slice(7));
      assert.throws(() => policy.validateScope(new RoleBoundary({ ...boundary, capabilities }), dispatch, scope, owner), /missing_capability/);
    }
    assert.throws(() => policy.validateScope(boundary, dispatch, new AgentScope({ write: ["backend/a.txt"], tools }), owner), /file_owner_mismatch/);
  }
});
