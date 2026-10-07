import test from "node:test";
import assert from "node:assert/strict";
import { AgentSession, ActionProposal, RoleBoundary, PolicyDecision, MutationResult, Outcome,
  validateInstanceGrant, _createRuntimeAuthority } from "../../src/kernel/models/core.mjs";
import { PiConnection, AgentScope, AgentConfig, TaskDispatchContext, AgentInstance, PiEventType,
  PiToolRequest, PiToolResult, PiRunResult, PiConnectionProfile, PiTextDelta, PiConversationHistory,
  PiConversationCheckpoint } from "../../src/kernel/models/agent.mjs";

function fixture() {
  const boundary = new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"], denyScope: ["backend/private/"],
    capabilities: ["write_file"], tools: ["legion_write_file"] });
  const context = new TaskDispatchContext({ roleId: "Backend", taskId: "task", organizationVersion: "v1",
    writeSet: ["backend/a.txt", "backend/b.txt"], tools: ["legion_write_file"] });
  const scope = new AgentScope({ write: ["backend/a.txt"], deny: [".ans/"], tools: ["legion_write_file"] });
  return { boundary, context, scope };
}

test("single_run remains default; conversation explicitly has no tools or writes", () => {
  const { scope } = fixture();
  const options = { name: "manager", proxy: { provider: "p", model: "m" }, scope };
  assert.equal(new AgentConfig(options).lifecycle, "single_run");
  assert.throws(() => new AgentConfig({ ...options, lifecycle: "conversation" }), /toolless/);
  const conversation = new AgentConfig({ ...options, lifecycle: "conversation", scope: { write: [], tools: [] } });
  assert.equal(conversation.lifecycle, "conversation");
  assert.throws(() => new AgentConfig({ ...options, lifecycle: "repeat" }), /lifecycle/);
});

test("plain connection profile copies metadata and never admits keys/functions/foreign model", () => {
  const metadata = { input: ["text"], contextWindow: 8192, maxTokens: 2048 };
  const options = { profileId: "profile", profileVersion: "1", protocol: "openai-responses",
    provider: "p", model: "m", baseUrl: "http://127.0.0.1:8080", modelMetadata: metadata };
  const profile = new PiConnectionProfile(options);
  metadata.input.push("image");
  assert.deepEqual(profile.modelMetadata.input, ["text"]);
  assert.equal(Object.isFrozen(profile.modelMetadata), true);
  assert.equal(new PiConnectionProfile({ ...options, modelMetadata: undefined }).modelMetadata, null);
  for (const change of [{ apiKey: "secret" }, { protocol: "unknown" },
    { modelMetadata: { id: "other" } }, { modelMetadata: { compat: { callback() {} } } },
    { baseUrl: "https://user:password@example.test" }]) {
    assert.throws(() => new PiConnectionProfile({ ...options, ...change }), TypeError);
  }
});

test("stream text is run-bound and history/checkpoints contain only immutable user/assistant text", () => {
  assert.equal(PiEventType.TEXT_DELTA, "text_delta");
  const delta = new PiTextDelta({ runId: "run", text: "你好" });
  assert.equal(Object.isFrozen(delta), true);
  assert.throws(() => new PiTextDelta({ runId: "", text: "text" }), TypeError);
  assert.throws(() => new PiTextDelta({ runId: "r", text: "x".repeat(65537) }), TypeError);
  const raw = [{ role: "user", text: "需求" }, { role: "assistant", text: "计划" }];
  const history = new PiConversationHistory({ messages: raw });
  raw[0].text = "changed";
  assert.equal(history.messages[0].text, "需求");
  for (const messages of ["text", [{ role: "tool", text: "tool result" }],
    [{ role: "assistant", text: "text", pendingTool: {} }]]) {
    assert.throws(() => new PiConversationHistory({ messages }), TypeError);
  }
  const instance = new AgentInstance({ instanceId: "i", name: "manager", sessionId: "s", roleId: "PM",
    taskId: "discussion", organizationVersion: "v4" });
  const options = { instance, profileId: "p", profileVersion: "1", history };
  assert.equal(new PiConversationCheckpoint(options).history, history);
  for (const extra of [{ permit: {} }, { apiKey: "secret" }, { runId: "active" }]) {
    assert.throws(() => new PiConversationCheckpoint({ ...options, ...extra }), TypeError);
  }
});

function instanceSetup(authority, context, instanceId, resource) {
  const session = new AgentSession({ sessionId: instanceId + "-session", roleId: context.roleId,
    taskId: context.taskId, organizationVersion: context.organizationVersion });
  const scope = new AgentScope({ write: [resource], deny: [".ans/"], tools: ["legion_write_file"] });
  authority.registerInstance({ instanceId, session, dispatchContext: context, scope });
  authority.beginRun(instanceId, instanceId + "-run");
  const proposal = new ActionProposal({ proposalId: instanceId + "-proposal", action: "write_file",
    resource, content: instanceId, tool: "legion_write_file", capability: "write_file",
    session, runId: instanceId + "-run" });
  const decision = new PolicyDecision({ outcome: Outcome.ALLOW, reason: "within_grants", proposalDigest: proposal.digest,
    organizationVersion: context.organizationVersion, boundaryDigest: authority.boundary(context.roleId).digest });
  return { session, scope, proposal, decision };
}

test("AgentConfig converts and deeply freezes only name/provider/model/scope", () => {
  const options = { name: "worker-1", proxy: { provider: "local", model: "controlled" },
    scope: { write: ["backend/a.txt"], deny: [".ans/"], tools: ["legion_write_file"] } };
  const config = new AgentConfig(options);
  options.proxy.model = "other";
  options.scope.write.push("backend/b.txt");
  assert.equal(config.proxy.model, "controlled");
  assert.deepEqual(config.scope.write, ["backend/a.txt"]);
  assert.equal(config.proxy instanceof PiConnection, true);
  assert.equal(config.scope instanceof AgentScope, true);
  assert.throws(() => { config.proxy.model = "other"; }, TypeError);
  assert.throws(() => new AgentConfig({ ...options, roleId: "Admin" }), TypeError);
  assert.throws(() => new AgentConfig({ ...options, name: " " }), TypeError);
  assert.throws(() => new PiConnection({ provider: "local", model: "" }), TypeError);
  assert.throws(() => new PiConnection({ provider: "local", model: "controlled", apiKey: "secret" }), TypeError);
});

test("AgentScope collections reject scalars and distinguish write from control-plane deny", () => {
  for (const field of ["write", "deny", "tools"]) {
    for (const value of ["backend/a.txt", null, false, new Uint8Array([65])]) {
      assert.throws(() => new AgentScope({ [field]: value }), TypeError);
    }
  }
  assert.throws(() => new AgentScope({ write: [".ANS/events/index.jsonl"] }), /control_plane/);
  assert.throws(() => new AgentScope({ deny: ["../outside/"] }), TypeError);
  const scope = new AgentScope({ write: ["BACKEND\\a.txt"], deny: [".ANS\\"], tools: new Set(["legion_write_file"]) });
  assert.deepEqual(scope.write, ["BACKEND/a.txt"]);
  assert.deepEqual(scope.deny, [".ANS/"]);
  assert.equal(Object.isFrozen(scope.tools), true);
});

test("TaskDispatchContext only accepts an immutable exact-file writeSet", () => {
  const { context } = fixture();
  for (const writeSet of ["backend/a.txt", ["backend/"], ["../outside"], [".ANS/file"], null]) {
    assert.throws(() => new TaskDispatchContext({ ...context, writeSet }), TypeError);
  }
  assert.throws(() => new TaskDispatchContext({ ...context, tools: "legion_write_file" }), TypeError);
  const raw = ["backend/a.txt"];
  const copied = new TaskDispatchContext({ ...context, writeSet: raw });
  raw.push("frontend/login.vue");
  assert.deepEqual(copied.writeSet, ["backend/a.txt"]);
  assert.equal(context.digest.length, 64);
  assert.notEqual(context.digest, copied.digest);
});

test("AgentInstance is frozen identity with no operational callback or authority leak", () => {
  const session = new AgentSession({ sessionId: "s", roleId: "Backend", taskId: "t", organizationVersion: "v1" });
  const instance = new AgentInstance({ instanceId: "i", name: "worker", sessionId: "s", roleId: "Backend",
    taskId: "t", organizationVersion: "v1" });
  assert.equal(instance.matchesSession(session), true);
  assert.equal(instance.matchesSession(new AgentSession({ ...session, roleId: "Admin" })), false);
  assert.throws(() => { instance.roleId = "Admin"; }, TypeError);
  assert.throws(() => new AgentInstance({ ...instance, run() {} }), TypeError);
  assert.deepEqual(Object.keys(instance), ["instanceId", "name", "sessionId", "roleId", "taskId", "organizationVersion"]);
});

test("instance grant is the exact role/task/request intersection and is defensively immutable", () => {
  const { boundary, context, scope } = fixture();
  const grant = validateInstanceGrant(boundary, context, scope);
  assert.deepEqual(grant.write, ["backend/a.txt"]);
  assert.deepEqual(grant.writeSet, ["backend/a.txt", "backend/b.txt"]);
  assert.deepEqual(grant.deny, [".ans/"]);
  assert.throws(() => grant.writeSet.push("frontend/a"), TypeError);
  const aliases = new AgentScope({ ...scope, write: ["BACKEND\\A.TXT"] });
  assert.equal(validateInstanceGrant(boundary, context, aliases).write[0], "BACKEND/A.TXT");
});

test("creation rejects directory inference, role/task widening, deny, and missing tools/capability", () => {
  const { boundary, context, scope } = fixture();
  for (const write of [["backend/"], ["backend/other.txt"], ["frontend/login.vue"], ["backend/private/key"]]) {
    assert.throws(() => validateInstanceGrant(boundary, context, new AgentScope({ ...scope, write })));
  }
  assert.throws(() => validateInstanceGrant(boundary, context, new AgentScope({ ...scope, deny: ["backend/"] })), /explicit_deny/);
  assert.throws(() => validateInstanceGrant(boundary, context, new AgentScope({ ...scope, tools: ["bash"] })), /outside_tool_grant/);
  assert.throws(() => validateInstanceGrant(boundary, new TaskDispatchContext({ ...context, tools: [] }), scope), /outside_tool_grant/);
  assert.throws(() => validateInstanceGrant(new RoleBoundary({ ...boundary, capabilities: [] }), context, scope), /missing_capability/);
  assert.throws(() => validateInstanceGrant(boundary, new TaskDispatchContext({ ...context, roleId: "Admin" }), scope), /dispatch_role_mismatch/);
});

test("PiToolRequest freezes the canonical payload without granting a claimed role", () => {
  const parameters = { resource: "backend/a.txt", content: "text" };
  const request = new PiToolRequest({ requestId: "request", runId: "run", toolCallId: "call",
    tool: "legion_write_file", parameters });
  parameters.content = "changed";
  assert.equal(request.parameters.content, "text");
  assert.throws(() => { request.parameters.resource = ".ans/file"; }, TypeError);
  assert.throws(() => new PiToolRequest({ ...request, roleId: "Admin" }), TypeError);
  assert.throws(() => new PiToolRequest({ ...request, parameters: { ...parameters, roleId: "Admin" } }), TypeError);
  const deniedResource = new PiToolRequest({ ...request, parameters: { resource: "../outside", content: "" } });
  assert.equal(deniedResource.parameters.resource, "../outside");
  assert.deepEqual(new PiToolRequest(JSON.parse(JSON.stringify(request))), request);
});

test("PiToolResult and PiRunResult preserve typed results and reject duplicate/foreign responses", () => {
  const decision = new PolicyDecision({ outcome: Outcome.DENY, reason: "outside_scope", proposalDigest: "digest",
    organizationVersion: "v1" });
  const mutation = new MutationResult({ success: false, status: "denied", reason: "outside_scope" });
  const result = new PiToolResult({ requestId: "request", runId: "run", decision, result: mutation });
  const rawResults = [result];
  const run = new PiRunResult({ runId: "run", status: "completed", assistantText: "denied", toolResults: rawResults });
  rawResults.length = 0;
  assert.equal(run.toolResults.length, 1);
  assert.throws(() => run.toolResults.push(result), TypeError);
  assert.throws(() => new PiToolResult({ ...result, result: { ...mutation } }), TypeError);
  assert.throws(() => new PiRunResult({ ...run, toolResults: [result, result] }), /duplicate/);
  assert.throws(() => new PiRunResult({ ...run, runId: "other" }), /foreign/);
  assert.throws(() => new PiRunResult({ ...run, toolResults: "result" }), TypeError);
  assert.throws(() => new PiRunResult({ ...run, status: "running" }), TypeError);
  assert.equal(new PiRunResult({ runId: "r", status: "cancelled" }).errorCode, "");
});

test("Pi event type values match the fixed pull protocol", () => {
  assert.deepEqual(Object.values(PiEventType),
    ["tool_request", "run_event", "run_finished", "run_failed", "run_cancelled", "text_delta"]);
  assert.equal(Object.isFrozen(PiEventType), true);
});

test("registered instance binds exact Session, current task/version, and single-run lifecycle", () => {
  const { boundary, context, scope } = fixture();
  const authority = _createRuntimeAuthority({ boundaries: [boundary], organizationVersion: "v1" });
  const session = new AgentSession({ sessionId: "s", roleId: "Backend", taskId: "task", organizationVersion: "v1" });
  const snapshot = authority.registerInstance({ instanceId: "i", session, dispatchContext: context, scope });
  assert.equal(snapshot.status, "ready");
  assert.equal(snapshot.session, session);
  assert.throws(() => { snapshot.status = "running"; }, TypeError);
  assert.throws(() => authority.registerInstance({ instanceId: "i", session, dispatchContext: context, scope }), /duplicate/);
  authority.beginRun("i", "run");
  assert.throws(() => authority.beginRun("i", "again"), /not_ready/);
  authority.finishRun("i", "completed");
  assert.throws(() => authority.beginRun("i", "new-run"), /not_ready/);
});

test("instance permits bind independent task/scope/session/run and cannot cross workers", () => {
  const { boundary, context } = fixture();
  const authority = _createRuntimeAuthority({ boundaries: [boundary], organizationVersion: "v1" });
  const first = instanceSetup(authority, context, "first", "backend/a.txt");
  const second = instanceSetup(authority, context, "second", "backend/b.txt");
  const firstPermit = authority.issue(first.proposal, first.decision);
  assert.throws(() => authority.consume(second.proposal, firstPermit), /identity/);
  assert.throws(() => authority.consume(first.proposal, firstPermit), /replayed/);
  const secondPermit = authority.issue(second.proposal, second.decision);
  assert.equal(authority.recheck(second.proposal, authority.consume(second.proposal, secondPermit)), undefined);
  for (const changes of [{ resource: "backend/b.txt" }, { runId: "second-run" },
    { session: new AgentSession({ ...first.session }) }]) {
    const proposal = new ActionProposal({ ...first.proposal, ...changes });
    const decision = new PolicyDecision({ ...first.decision, proposalDigest: proposal.digest });
    assert.throws(() => authority.issue(proposal, decision));
  }
});

test("cancelling one instance revokes its permits and receipts without cancelling another instance", () => {
  const { boundary, context } = fixture();
  const authority = _createRuntimeAuthority({ boundaries: [boundary], organizationVersion: "v1" });
  const first = instanceSetup(authority, context, "first", "backend/a.txt");
  const second = instanceSetup(authority, context, "second", "backend/b.txt");
  const permit = authority.issue(first.proposal, first.decision);
  const receipt = authority.consume(first.proposal, authority.issue(first.proposal, first.decision));
  const otherPermit = authority.issue(second.proposal, second.decision);
  authority.revokeInstance("first");
  assert.throws(() => authority.consume(first.proposal, permit), /replayed/);
  assert.throws(() => authority.recheck(first.proposal, receipt), /revoked/);
  assert.throws(() => authority.issue(first.proposal, first.decision), /instance_or_run_changed/);
  assert.equal(authority.recheck(second.proposal, authority.consume(second.proposal, otherPermit)), undefined);
  assert.equal(authority.instanceSnapshot("second").status, "running");
});

test("task/role/version/grant changes cancel old instance writes permanently after roundtrip", () => {
  for (const transition of ["task", "role", "version", "grant"]) {
    const { boundary, context } = fixture();
    const authority = _createRuntimeAuthority({ boundaries: [boundary], organizationVersion: "v1" });
    const first = instanceSetup(authority, context, "first", "backend/a.txt");
    const permit = authority.issue(first.proposal, first.decision);
    if (transition === "task") {
      authority.setTaskStatus("task", "cancelled");
      authority.setTaskStatus("task", "active");
    }
    if (transition === "role") {
      authority.updateBoundary(new RoleBoundary({ ...boundary, writeScope: [] }));
      authority.updateBoundary(boundary);
    }
    if (transition === "version") {
      authority.updateVersion("v2");
      authority.updateVersion("v1");
    }
    if (transition === "grant") {
      authority.updateTaskGrant(new TaskDispatchContext({ ...context, writeSet: ["backend/b.txt"] }));
      authority.updateTaskGrant(context);
    }
    assert.throws(() => authority.consume(first.proposal, permit), /replayed/);
    assert.throws(() => authority.issue(first.proposal, first.decision), /instance_or_run_changed/);
  }
});

test("instance registration fails closed on mismatched role/task/version and stopped tasks", () => {
  const { boundary, context, scope } = fixture();
  for (const changes of [{ roleId: "Admin" }, { taskId: "other" }, { organizationVersion: "v0" }]) {
    const authority = _createRuntimeAuthority({ boundaries: [boundary], organizationVersion: "v1" });
    const session = new AgentSession({ sessionId: "s", roleId: "Backend", taskId: "task",
      organizationVersion: "v1", ...changes });
    assert.throws(() => authority.registerInstance({ instanceId: "i", session, dispatchContext: context, scope }), /identity_mismatch/);
  }
  const authority = _createRuntimeAuthority({ boundaries: [boundary], organizationVersion: "v1" });
  authority.setTaskStatus("task", "cancelled");
  const session = new AgentSession({ sessionId: "s", roleId: "Backend", taskId: "task", organizationVersion: "v1" });
  assert.throws(() => authority.registerInstance({ instanceId: "i", session, dispatchContext: context, scope }), /task_inactive/);
});

test("instance authority stores defensive grant copies even when internal wiring receives plain records", () => {
  const { boundary, context } = fixture();
  const authority = _createRuntimeAuthority({ boundaries: [boundary], organizationVersion: "v1" });
  const session = new AgentSession({ sessionId: "s", roleId: "Backend", taskId: "task", organizationVersion: "v1" });
  const rawScope = { write: ["backend/a.txt"], deny: [".ans/"], tools: ["legion_write_file"] };
  const rawContext = { ...context, writeSet: ["backend/a.txt"], tools: ["legion_write_file"] };
  authority.registerInstance({ instanceId: "i", session, dispatchContext: rawContext, scope: rawScope });
  rawScope.write.push("backend/b.txt");
  rawContext.writeSet.push("backend/b.txt");
  const snapshot = authority.instanceSnapshot("i");
  assert.deepEqual(snapshot.grant.write, ["backend/a.txt"]);
  assert.deepEqual(snapshot.grant.writeSet, ["backend/a.txt"]);
  assert.throws(() => snapshot.grant.tools.push("bash"), TypeError);
});
