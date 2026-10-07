import test from "node:test";
import assert from "node:assert/strict";
import { createPolicyService } from "../../src/kernel/services/public/policy.mjs";
import { AgentSession, ActionProposal, RoleBoundary, Outcome, _createRuntimeAuthority } from "../../src/kernel/models/core.mjs";
import { AgentScope, TaskDispatchContext } from "../../src/kernel/models/agent.mjs";
const boundary = new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"], denyScope: ["backend/private/"],
  tools: ["legion_write_file"], capabilities: ["write_file"], handoffTargets: ["Frontend"], allowScopeExpansion: true });
const dispatch = new TaskDispatchContext({ roleId: "Backend", taskId: "task", organizationVersion: "v3",
  writeSet: ["backend/a.txt", "backend/b.txt", "backend/private/x.txt"], tools: ["legion_write_file"] });
function scope(extra = {}) { return new AgentScope({ write: ["backend/a.txt"], tools: ["legion_write_file"], ...extra }); }
const policy = createPolicyService();
test("discussion scope requires empty instance and task writes/tools and cannot approve writing", () => {
  const manager = new RoleBoundary({ roleId: "ProjectManager" });
  const context = new TaskDispatchContext({ roleId: "ProjectManager", taskId: "discussion",
    organizationVersion: "v4", writeSet: [], tools: [] });
  const noTools = new AgentScope({ write: [], tools: [] });
  assert.deepEqual(policy.validateScope(manager, context, noTools).write, []);
  for (const change of [{ writeSet: ["backend/a.txt"] }, { tools: ["legion_write_file"] }]) {
    assert.throws(() => policy.validateScope(manager, new TaskDispatchContext({ ...context, ...change }), noTools), /toolless/);
  }
  const session = new AgentSession({ sessionId: "pm", roleId: "ProjectManager", taskId: "discussion", organizationVersion: "v4" });
  const proposal = new ActionProposal({ proposalId: "p", action: "write_file", resource: "backend/a.txt", content: "body",
    tool: "legion_write_file", capability: "write_file", session });
  assert.equal(policy.evaluate(proposal, { boundary: manager, trustedSession: session,
    currentVersion: "v4", dispatchContext: context }).outcome, Outcome.DENY);
});
test("creation scope is copied immutable exact role/task subset", () => {
  const grant = policy.validateScope(boundary, dispatch, scope({ write: ["BACKEND\\A.TXT"] }));
  assert.deepEqual(grant.write, ["BACKEND/A.TXT"]); assert.ok(Object.isFrozen(grant.write));
});
test("directory expansion, other task file, role denial and own denial reject before SDK creation", () => {
  for (const write of [["backend/"], ["backend/not-task.txt"], ["backend/private/x.txt"], ["frontend/x.txt"]]) {
    assert.throws(() => policy.validateScope(boundary, dispatch, scope({ write })), TypeError);
  }
  assert.throws(() => policy.validateScope(boundary, dispatch, scope({ deny: ["BACKEND/A.TXT"] })), /explicit_deny/);
});
test("tool intersection is exact singleton with role capability", () => {
  for (const tools of [[], ["bash"], ["legion_write_file", "read"]]) {
    assert.throws(() => policy.validateScope(boundary, dispatch, scope({ tools })), TypeError);
  }
  const noTool = new TaskDispatchContext({ ...dispatch, tools: [] });
  assert.throws(() => policy.validateScope(boundary, noTool, scope()), /outside_tool_grant/);
});
test("request grant cannot replace task role or malformed scalar scopes", () => {
  const wrong = new TaskDispatchContext({ ...dispatch, roleId: "Frontend" });
  assert.throws(() => policy.validateScope(boundary, wrong, scope()), /dispatch_role_mismatch/);
  for (const field of ["write", "deny", "tools"]) assert.throws(() => scope({ [field]: "backend/a.txt" }), TypeError);
});
test("execution evaluates exact instance/run and denies task expansion ahead of handoff", () => {
  const session = new AgentSession({ sessionId: "s", roleId: "Backend", taskId: "task", organizationVersion: "v3" });
  const authority = _createRuntimeAuthority({ boundaries: [boundary], organizationVersion: "v3" });
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
