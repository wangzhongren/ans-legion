import { createHash } from "node:crypto";
import { makeTestOwners, testLeaseContext } from "./test_control_memory.test.mjs";
const kernelOwners = makeTestOwners("Backend", ["backend/a.txt"]);
import test from "node:test";
import assert from "node:assert/strict";
import { AgentSession, ActionProposal, RoleBoundary, PolicyDecision, MutationResult, Outcome,
  validateInstanceGrant, _createRuntimeAuthority } from "../../src/kernel/models/core.mjs";
import { PiConnection, AgentScope, AgentConfig, TaskDispatchContext, AgentInstance, PiEventType,
  PiToolRequest, PiToolResult, PiRunResult, PiConnectionProfile, PiTextDelta, PiConversationHistory,
  PiConversationCheckpoint, PiImageReference, PiImageInput } from "../../src/kernel/models/agent.mjs";

function fixture() {
  const boundary = new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"], denyScope: ["backend/private/"],
    capabilities: ["write_file"], tools: ["legion_write_file"] });
  const context = new TaskDispatchContext({ roleId: "Backend", taskId: "task", organizationVersion: "v1",
    fileOwnersDigest: kernelOwners.digest, ownerGeneration: kernelOwners.version, tools: ["legion_write_file"] });
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
  const copied = new TaskDispatchContext({ ...context, ownerGeneration: "2" });
  assert.equal(copied.ownerGeneration, "2");
  assert.equal(Object.hasOwn(copied, "writeSet"), false);
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
  const grant = validateInstanceGrant(boundary, context, scope, kernelOwners);
  assert.deepEqual(grant.write, ["backend/a.txt"]);
  assert.deepEqual(grant.fileOwners.owners.map(item => item.resource), ["backend/a.txt"]);
  assert.deepEqual(grant.deny, [".ans/"]);
  assert.throws(() => grant.fileOwners.owners.push({ resource: "frontend/a", roleId: "Backend" }), TypeError);
  const aliases = new AgentScope({ ...scope, write: ["BACKEND\\A.TXT"] });
  assert.equal(validateInstanceGrant(boundary, context, aliases, kernelOwners).write[0], "BACKEND/A.TXT");
});

test("creation rejects directory inference, role/task widening, deny, and missing tools/capability", () => {
  const { boundary, context, scope } = fixture();
  for (const write of [["backend/"], ["backend/other.txt"], ["frontend/login.vue"], ["backend/private/key"]]) {
    assert.throws(() => validateInstanceGrant(boundary, context, new AgentScope({ ...scope, write }), kernelOwners));
  }
  assert.throws(() => validateInstanceGrant(boundary, context, new AgentScope({ ...scope, deny: ["backend/"] }), kernelOwners), /explicit_deny/);
  assert.throws(() => validateInstanceGrant(boundary, context, new AgentScope({ ...scope, tools: ["bash"] }), kernelOwners), /outside_tool_grant/);
  assert.throws(() => validateInstanceGrant(boundary, new TaskDispatchContext({ ...context, tools: [] }), scope, kernelOwners), /outside_tool_grant/);
  assert.throws(() => validateInstanceGrant(new RoleBoundary({ ...boundary, capabilities: [] }), context, scope, kernelOwners), /missing_capability/);
  assert.throws(() => validateInstanceGrant(boundary, new TaskDispatchContext({ ...context, roleId: "Admin" }), scope, kernelOwners), /dispatch_role_mismatch/);
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

test("Pi edit tool request copies SHA-bound bounded replacements", () => {
  const replacements = [{ oldText: "before", newText: "after" }];
  const options = { requestId: "edit", runId: "run", toolCallId: "sdk", tool: "legion_edit_file",
    parameters: { resource: "backend/a.txt", expectedSha256: "a".repeat(64), replacements } };
  const request = new PiToolRequest(options);
  replacements[0].newText = "changed";
  assert.equal(request.parameters.replacements[0].newText, "after");
  assert.ok(Object.isFrozen(request.parameters.replacements));
  assert.throws(() => new PiToolRequest({ ...options, parameters: { ...options.parameters,
    expectedSha256: "bad" } }), /expected_sha256/);
  assert.throws(() => new PiToolRequest({ ...options, parameters: { ...options.parameters,
    replacements: [{ oldText: "x", newText: "a" }, { oldText: "x", newText: "b" }] } }),
  /duplicate_old_text/);
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
  const authority = _createRuntimeAuthority({ fileOwners: kernelOwners, boundaries: [boundary], organizationVersion: "v1" });
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
  const owners = new (kernelOwners.constructor)({ projectId: "kernel-fixture", version: "1", owners: [
    { resource: "backend/a.txt", roleId: "Backend" }, { resource: "frontend/b.txt", roleId: "Frontend" }] });
  const authority = _createRuntimeAuthority({ fileOwners: owners, boundaries: [new RoleBoundary({ ...boundary, writeScope: ["backend/a.txt"] }),
    new RoleBoundary({ roleId: "Frontend", writeScope: ["frontend/b.txt"], tools: ["legion_write_file"], capabilities: ["write_file"] })], organizationVersion: "v1" });
  const firstContext = new TaskDispatchContext({ ...context, fileOwnersDigest: owners.digest });
  const secondContext = new TaskDispatchContext({ ...context, fileOwnersDigest: owners.digest, roleId: "Frontend" });
  const first = instanceSetup(authority, firstContext, "first", "backend/a.txt");
  const second = instanceSetup(authority, secondContext, "second", "frontend/b.txt");
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
  const owners = new (kernelOwners.constructor)({ projectId: "kernel-fixture", version: "1", owners: [
    { resource: "backend/a.txt", roleId: "Backend" }, { resource: "frontend/b.txt", roleId: "Frontend" }] });
  const authority = _createRuntimeAuthority({ fileOwners: owners, boundaries: [new RoleBoundary({ ...boundary, writeScope: ["backend/a.txt"] }),
    new RoleBoundary({ roleId: "Frontend", writeScope: ["frontend/b.txt"], tools: ["legion_write_file"], capabilities: ["write_file"] })], organizationVersion: "v1" });
  const firstContext = new TaskDispatchContext({ ...context, fileOwnersDigest: owners.digest });
  const secondContext = new TaskDispatchContext({ ...context, fileOwnersDigest: owners.digest, roleId: "Frontend" });
  const first = instanceSetup(authority, firstContext, "first", "backend/a.txt");
  const second = instanceSetup(authority, secondContext, "second", "frontend/b.txt");
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
    const authority = _createRuntimeAuthority({ fileOwners: kernelOwners, boundaries: [boundary], organizationVersion: "v1" });
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
      authority.updateTaskGrant(new TaskDispatchContext({ ...context, fileOwnersDigest: kernelOwners.digest, ownerGeneration: kernelOwners.version }));
      authority.updateTaskGrant(context);
    }
    assert.throws(() => authority.consume(first.proposal, permit), /replayed/);
    assert.throws(() => authority.issue(first.proposal, first.decision), /instance_or_run_changed/);
  }
});

test("instance registration fails closed on mismatched role/task/version and stopped tasks", () => {
  const { boundary, context, scope } = fixture();
  for (const changes of [{ roleId: "Admin" }, { taskId: "other" }, { organizationVersion: "v0" }]) {
    const authority = _createRuntimeAuthority({ fileOwners: kernelOwners, boundaries: [boundary], organizationVersion: "v1" });
    const session = new AgentSession({ sessionId: "s", roleId: "Backend", taskId: "task",
      organizationVersion: "v1", ...changes });
    assert.throws(() => authority.registerInstance({ instanceId: "i", session, dispatchContext: context, scope }), /identity_mismatch/);
  }
  const authority = _createRuntimeAuthority({ fileOwners: kernelOwners, boundaries: [boundary], organizationVersion: "v1" });
  authority.setTaskStatus("task", "cancelled");
  const session = new AgentSession({ sessionId: "s", roleId: "Backend", taskId: "task", organizationVersion: "v1" });
  assert.throws(() => authority.registerInstance({ instanceId: "i", session, dispatchContext: context, scope }), /task_inactive/);
});

test("instance authority stores defensive grant copies even when internal wiring receives plain records", () => {
  const { boundary, context } = fixture();
  const authority = _createRuntimeAuthority({ fileOwners: kernelOwners, boundaries: [boundary], organizationVersion: "v1" });
  const session = new AgentSession({ sessionId: "s", roleId: "Backend", taskId: "task", organizationVersion: "v1" });
  const rawScope = { write: ["backend/a.txt"], deny: [".ans/"], tools: ["legion_write_file"] };
  const rawContext = { ...context, fileOwnersDigest: kernelOwners.digest, ownerGeneration: kernelOwners.version, tools: ["legion_write_file"] };
  authority.registerInstance({ instanceId: "i", session, dispatchContext: rawContext, scope: rawScope });
  rawScope.write.push("backend/b.txt");
  rawContext.ownerGeneration = "new";
  const snapshot = authority.instanceSnapshot("i");
  assert.deepEqual(snapshot.grant.write, ["backend/a.txt"]);
  assert.deepEqual(snapshot.grant.fileOwners.owners.map(item => item.resource), ["backend/a.txt"]);
  assert.throws(() => snapshot.grant.tools.push("bash"), TypeError);
});

test("thirteen workflow tools use bounded pure payloads and host-matched typed results", async () => {
  const { AgentControlTools, AgentTools, AgentControlDecision, AgentControlResult } = await import("../../src/kernel/models/agent.mjs");
  const { CheckDecision, CheckResult } = await import("../../src/kernel/models/check.mjs");
  assert.equal(AgentControlTools.length, 13);
  assert.equal(AgentTools.length, 19);
  const base = { requestId: "q", runId: "r", toolCallId: "sdk" };
  for (const tool of AgentControlTools.filter(tool=>tool!=="legion_review_shell")) {
    let raw = { roles: [{ roleId: "Backend", responsibility: "code" }] };
    if (tool === "legion_delegate_pm") raw = { action: "start", purpose: "plan", instruction: "work", sourceRefs: ["human:h"] };
    if (["legion_query_role_activity", "legion_query_role_log"].includes(tool)) raw = { roleId: "Backend" };
    const request = new PiToolRequest({ ...base, tool, parameters: { payload: raw } });
    if (tool === "legion_delegate_pm") {
      raw.sourceRefs.push("human:later"); assert.deepEqual(request.parameters.payload.sourceRefs, ["human:h"]);
    } else if (["legion_query_role_activity", "legion_query_role_log"].includes(tool)) {
      raw.roleId = "Other"; assert.equal(request.parameters.payload.roleId, "Backend");
    } else {
      raw.roles[0].responsibility = "changed"; assert.equal(request.parameters.payload.roles[0].responsibility, "code");
    }
    assert.deepEqual(new PiToolRequest(JSON.parse(JSON.stringify(request))), request);
    const decision = new AgentControlDecision({ requestId: "q", runId: "r", tool, allowed: true, reason: "host_validated" });
    const value = new AgentControlResult({ requestId: "q", runId: "r", tool, status: "completed", reason: "done",
      payload: { proposalId: "proposal" } });
    const response = new PiToolResult({ requestId: "q", runId: "r", decision, result: value });
    assert.equal(new PiRunResult({ runId: "r", status: "completed", toolResults: [response] }).toolResults[0], response);
    assert.throws(() => new PiToolResult({ ...response, runId: "foreign" }), /identity/);
    assert.throws(() => new PiToolResult({ ...response, decision: new AgentControlDecision({ ...decision, allowed: false }) }), /denied/);
    assert.throws(() => new PiToolResult({ ...response, result: { ...value } }), TypeError);
    for (const payload of [{ callback() {} }, { callerRoleId: "PM" }, { token: "secret" },
      { nested: { apiKey: "secret" } }, { text: "x".repeat(65537) }, { values: Array(4096).fill(0) }]) {
      assert.throws(() => new PiToolRequest({ ...base, tool, parameters: { payload } }), TypeError);
    }
    assert.throws(() => new PiToolRequest({ ...base, tool, parameters: { payload: {}, roleId: "PM" } }), TypeError);
    const getter = {}; Object.defineProperty(getter, "get", { enumerable: true, get() { throw new Error("must_not_invoke"); } });
    assert.throws(() => new PiToolRequest({ ...base, tool, parameters: { payload: getter } }), /secret_effect/);
    const arrayGetter = [0];
    Object.defineProperty(arrayGetter, "0", { enumerable: true, get() { throw new Error("must_not_invoke"); } });
    assert.throws(() => new PiToolRequest({ ...base, tool, parameters: { payload: { values: arrayGetter } } }), /secret_effect/);
  }
  const check = new PiToolRequest({ ...base, tool: "legion_run_check", parameters: { checkId: "unit" } });
  assert.deepEqual(check.parameters, { checkId: "unit" });
  assert.throws(() => new PiToolRequest({ ...check, parameters: { checkId: "unit", argv: ["node"] } }), TypeError);
  const authorizationDigest = "a".repeat(64);
  const decision = new CheckDecision({ requestId: "q", runId: "r", checkId: "unit", allowed: false,
    reason: "no_approval", authorizationDigest });
  const value = new CheckResult({ requestId: "q", runId: "r", checkId: "unit", authorizationDigest,
    specDigest: "b".repeat(64), status: "error", reason: "no_approval", executed: false, actualArgv: [], exitCode: null,
    testCount: 0, stdout: "", stderr: "", logsTruncated: false, inputVersions: [], environment: null,
    startedAt: "2026-10-08T00:00:00.000Z", finishedAt: "2026-10-08T00:00:00.000Z" });
  const response = new PiToolResult({ requestId: "q", runId: "r", decision, result: value });
  assert.equal(response.result.status, "error");
  assert.throws(() => new PiToolResult({ ...response, decision: new CheckDecision({ ...decision, checkId: "foreign" }) }), /binding/);
  assert.throws(() => new PiToolResult({ ...response, result: new MutationResult({ success: false, status: "denied", reason: "no" }) }), TypeError);
});

function imageValue(bytes = Buffer.from("opaque image bytes"), extra = {}) {
  const raw = { projectId: "project-1", attachmentId: "attachment-1", sha256: createHash("sha256").update(bytes).digest("hex"),
    mimeType: "image/png", byteLength: bytes.byteLength, width: 1, height: 1, ...extra };
  const ref = new PiImageReference(raw); const data = bytes.toString("base64");
  return { raw, ref, data, input: new PiImageInput({ ref, data }) };
}

test("image values are pure frozen references and canonical byte/hash input with no effects or forged brands", () => {
  const f = imageValue();
  assert.deepEqual(Object.keys(f.ref), ["projectId", "attachmentId", "sha256", "mimeType", "byteLength", "width", "height"]);
  assert.deepEqual(Object.keys(f.input), ["ref", "data"]);
  assert.ok(Object.isFrozen(f.ref)); assert.ok(Object.isFrozen(f.input));
  assert.deepEqual(new PiImageReference(JSON.parse(JSON.stringify(f.ref))), f.ref);
  assert.throws(() => { f.ref.width = 2; }, TypeError);
  for (const change of [{ projectId: "../other" }, { attachmentId: "https://example.test/image" }, { sha256: "A".repeat(64) },
    { mimeType: "image/svg+xml" }, { mimeType: "image/webp" }, { byteLength: 0 }, { byteLength: 4194305 },
    { width: 8193 }, { height: 0 }, { width: 4001, height: 4000 }, { path: "/private/image.png" },
    { url: "https://example.test/image.png" }, { callback() {} }, { permit: {} }, { token: "secret" }]) {
    assert.throws(() => new PiImageReference({ ...f.raw, ...change }), TypeError);
  }
  for (const data of [f.data+'\n', 'data:image/png;base64,'+f.data, f.data.replace('+','-')+'-', '%%%=', '', f.data+'====']) {
    assert.throws(() => new PiImageInput({ ref: f.ref, data }), TypeError);
  }
  assert.throws(() => new PiImageInput({ ref: new PiImageReference({ ...f.raw, sha256: "0".repeat(64) }), data: f.data }), /image_content_mismatch/);
  const zero = imageValue(Buffer.from([0]));
  assert.throws(() => new PiImageInput({ ref: zero.ref, data: 'AB==' }), /noncanonical_image_base64/);
  assert.throws(() => new PiImageInput({ ref: { ...f.raw }, data: f.data }), /typed_image_reference/);
  const forgedRef = Object.assign(Object.create(PiImageReference.prototype), f.raw);
  assert.throws(() => new PiImageInput({ ref: forgedRef, data: f.data }), /typed_image_reference/);
  const forgedInput = Object.assign(Object.create(PiImageInput.prototype), { ref: f.ref, data: f.data });
  assert.throws(() => PiImageInput.assertCollection([forgedInput]), /typed_image_input/);
  let invoked = false; const getter = { ref: f.ref };
  Object.defineProperty(getter, "data", { enumerable: true, get() { invoked = true; return f.data; } });
  assert.throws(() => new PiImageInput(getter), /image_effect_field/); assert.equal(invoked, false);
});

test("image turn and restore budgets enforce count, project identity and decoded bytes", () => {
  const one = imageValue().input;
  assert.deepEqual(PiImageInput.assertCollection([]), []);
  assert.ok(Object.isFrozen(PiImageInput.assertCollection([one])));
  assert.throws(() => PiImageInput.assertCollection([one, one]), /duplicate_image/);
  assert.throws(() => PiImageInput.assertCollection([one, imageValue(undefined, { projectId: "other", attachmentId: "other" }).input]), /image_project_mismatch/);
  assert.throws(() => PiImageInput.assertCollection([one], { path: "/private" }), TypeError);
  assert.throws(() => PiImageInput.assertCollection([one], { mode: "anything" }), /invalid_image_collection_mode/);
  const small = Array.from({ length: 9 }, (_, i) => imageValue(undefined, { attachmentId: "small-"+i }).input);
  assert.equal(PiImageInput.assertCollection(small.slice(0, 4)).length, 4);
  assert.throws(() => PiImageInput.assertCollection(small.slice(0, 5)), TypeError);
  assert.equal(PiImageInput.assertCollection(small.slice(0, 8), { mode: "restore" }).length, 8);
  assert.throws(() => PiImageInput.assertCollection(small, { mode: "restore" }), TypeError);
  // Model verifies opaque bytes, not actual raster decoding; the Desktop Provider owns that proof.
  const large = Buffer.alloc(4194304, 7);
  const inputs = Array.from({ length: 5 }, (_, i) => imageValue(large, { attachmentId: "large-"+i }).input);
  assert.equal(PiImageInput.assertCollection(inputs.slice(0, 2)).length, 2);
  assert.throws(() => PiImageInput.assertCollection(inputs.slice(0, 3)), /image_collection_byte_budget/);
  assert.equal(PiImageInput.assertCollection(inputs.slice(0, 4), { mode: "restore" }).length, 4);
  assert.throws(() => PiImageInput.assertCollection(inputs, { mode: "restore" }), /image_collection_byte_budget/);
});

test("image refs preserve exact legacy text history and checkpoint JSON while image-only user history stays metadata-only", () => {
  const legacy = '{"messages":[{"role":"user","text":"需求"},{"role":"assistant","text":"计划"}]}';
  const history = new PiConversationHistory(JSON.parse(legacy)); assert.equal(JSON.stringify(history), legacy);
  const instance = new AgentInstance({ instanceId: "i", name: "Su", sessionId: "s", roleId: "Supervisor", taskId: "discussion", organizationVersion: "v1" });
  const rawCheckpoint = { instance: JSON.parse(JSON.stringify(instance)), profileId: "p", profileVersion: "1", history: JSON.parse(legacy) };
  const checkpoint = new PiConversationCheckpoint({ ...rawCheckpoint, instance });
  assert.equal(JSON.stringify(checkpoint), JSON.stringify(rawCheckpoint));
  const f = imageValue(); const refs = [{ ...f.raw }];
  const withImages = new PiConversationHistory({ messages: [{ role: "user", text: "", imageRefs: refs }, { role: "assistant", text: "seen" }] });
  refs[0].sha256 = "b".repeat(64);
  assert.equal(withImages.messages[0].imageRefs[0].sha256, f.ref.sha256);
  assert.ok(Object.isFrozen(withImages.messages[0].imageRefs));
  assert.equal(Object.hasOwn(withImages.messages[1], "imageRefs"), false);
  assert.equal(JSON.stringify(withImages).includes(f.data), false);
  assert.deepEqual(new PiConversationHistory(JSON.parse(JSON.stringify(withImages))), withImages);
  for (const message of [{ role: "assistant", text: "", imageRefs: [f.ref] }, { role: "user", text: "", imageRefs: [] },
    { role: "user", text: "", images: [f.input] }, { role: "user", text: "", data: f.data },
    { role: "user", text: "", imageRefs: [f.ref, f.ref] }]) assert.throws(() => new PiConversationHistory({ messages: [message] }), TypeError);
  assert.throws(() => new PiConversationHistory({ messages: [{ role: "user", text: "", imageRefs: [f.ref] },
    { role: "user", text: "", imageRefs: [new PiImageReference({ ...f.raw, sha256: "b".repeat(64) })] }] }), /image_reference_changed/);
  assert.throws(() => new PiConversationHistory({ messages: [{ role: "user", text: "", imageRefs: [f.ref] },
    { role: "user", text: "", imageRefs: [imageValue(undefined, { projectId: "other", attachmentId: "other" }).ref] }] }), /image_project_mismatch/);
  const refsOverBytes = [1,2,3].map(i => new PiImageReference({ ...f.raw, attachmentId: "big-"+i, byteLength: 4194304 }));
  assert.throws(() => new PiConversationHistory({ messages: [{ role: "user", text: "", imageRefs: refsOverBytes }] }), /image_collection_byte_budget/);
});

test("model input metadata validates only explicit text/image declarations and leaves old unknown bytes unchanged", () => {
  const options = { profileId: "p", profileVersion: "1", protocol: "openai-responses", provider: "local", model: "m", baseUrl: "https://example.test" };
  const missing = new PiConnectionProfile(options); assert.equal(missing.modelMetadata, null);
  const old = { name: "model", contextWindow: 8192 };
  assert.equal(JSON.stringify(new PiConnectionProfile({ ...options, modelMetadata: old }).modelMetadata), JSON.stringify(old));
  assert.equal(Object.hasOwn(new PiConnectionProfile({ ...options, modelMetadata: old }).modelMetadata, "input"), false);
  for (const input of [["text"], ["image"], ["text", "image"]]) assert.deepEqual(new PiConnectionProfile({ ...options, modelMetadata: { input } }).modelMetadata.input, input);
  for (const input of [[], ["text", "text"], ["audio"], ["text", "image", "text"], ["image", undefined], "image", null]) assert.throws(() => new PiConnectionProfile({ ...options, modelMetadata: { input } }), TypeError);
  let invoked = false; const metadata = {};
  Object.defineProperty(metadata, "input", { enumerable: true, get() { invoked = true; return ["image"]; } });
  assert.throws(() => new PiConnectionProfile({ ...options, modelMetadata: metadata }), TypeError); assert.equal(invoked, false);
});
