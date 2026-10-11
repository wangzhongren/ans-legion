import test from "node:test";
import assert from "node:assert/strict";
import * as publicApi from "../../src/adapters/services/public/proposal.mjs";
import { AgentSession, ActionProposal } from "../../src/kernel/models/core.mjs";
import { PiToolRequest, AgentControlTools } from "../../src/kernel/models/agent.mjs";

const factories = [publicApi.createProposalService, publicApi.createCodexAdapter, publicApi.createClaudeAdapter];
const session = new AgentSession({ sessionId: "s", roleId: "Backend", taskId: "task", organizationVersion: "v3" });
function request(overrides = {}) {
  return new PiToolRequest({ requestId: "p", runId: "run", toolCallId: "call", tool: "legion_write_file",
    parameters: { resource: "backend/example.mjs", content: "你好\n" }, ...overrides });
}
function editRequest(overrides = {}) {
  return request({ tool: "legion_edit_file", parameters: { resource: "backend/example.mjs",
    expectedSha256: "a".repeat(64), replacements: [{ oldText: "before", newText: "after" }] },
  ...overrides });
}

test("public factories expose only own contracts and local variants", () => {
  assert.deepEqual(Object.keys(publicApi).sort(),
    ["ProposalService", "createClaudeAdapter", "createCodexAdapter", "createProposalService"].sort());
  assert.throws(() => new publicApi.ProposalService(), TypeError);
  for (const factory of factories) assert.ok(factory() instanceof publicApi.ProposalService);
  assert.notEqual(publicApi.createCodexAdapter().constructor, publicApi.createClaudeAdapter().constructor);
});
test("all converters bind exact Session, host request ID and run", () => {
  for (const factory of factories) {
    const output = factory().convert(request(), session);
    assert.ok(output instanceof ActionProposal);
    assert.equal(output.session, session);
    assert.equal(output.proposalId, "p");
    assert.equal(output.runId, "run");
    assert.equal(output.content, "你好\n");
    assert.equal(output.action, "write_file");
    assert.equal(output.capability, "write_file");
    assert.equal(output.tool, "legion_write_file");
  }
});
test("converted output immutable and digests stable across variants", () => {
  const outputs = factories.map((factory) => factory().convert(request(), session));
  for (const output of outputs) {
    assert.equal(output.digest, outputs[0].digest);
    assert.throws(() => { output.content = "changed"; }, TypeError);
    assert.throws(() => { output.session.roleId = "Admin"; }, TypeError);
  }
});
test("empty content and resource text preserved for Kernel validation", () => {
  for (const factory of factories) {
    const output = factory().convert(request({ parameters: { resource: "backend\\x.mjs", content: "" } }), session);
    assert.equal(output.content, "");
    assert.equal(output.resource, "backend\\x.mjs");
  }
});
test("duck identity, untyped request and uncontrolled tool rejected", () => {
  for (const factory of factories) {
    for (const invalid of [null, {}, { ...request(), roleId: "Admin" }, "request"]) {
      assert.throws(() => factory().convert(invalid, session), TypeError);
    }
    for (const invalid of [null, {}, { ...session }, "session"]) {
      assert.throws(() => factory().convert(request(), invalid), TypeError);
    }
    assert.throws(() => factory().convert(request({ tool: "bash" }), session), TypeError);
  }
});
test("identity claims and invalid fields cannot enter immutable tool Model", () => {
  for (const field of ["roleId", "taskId", "organizationVersion", "session", "name", "capability"]) {
    assert.throws(() => request({ parameters: { resource: "x", content: "", [field]: "Admin" } }), TypeError);
  }
  for (const field of ["requestId", "runId", "toolCallId", "tool"]) {
    for (const value of [null, 1, "", " "]) assert.throws(() => request({ [field]: value }), TypeError);
  }
  for (const value of [null, 1, {}, []]) {
    assert.throws(() => request({ parameters: { resource: "x", content: value } }), TypeError);
  }
});
test("digest binds content and run without mutating source", () => {
  const original = request();
  const service = publicApi.createProposalService();
  const output = service.convert(original, session);
  assert.notEqual(output.digest, service.convert(request({ runId: "other" }), session).digest);
  assert.notEqual(output.digest, service.convert(request({ parameters: { resource: "x", content: "new" } }), session).digest);
  assert.equal(original.parameters.content, "你好\n");
});
test("all converters preserve exact edit request, trusted Session and ordered replacements", () => {
  const original = editRequest();
  for (const factory of factories) {
    const output = factory().convert(original, session);
    assert.ok(output instanceof ActionProposal);
    assert.equal(output.session, session);
    assert.equal(output.proposalId, "p");
    assert.equal(output.runId, "run");
    assert.equal(output.action, "edit_file");
    assert.equal(output.tool, "legion_edit_file");
    assert.equal(output.capability, "write_file");
    assert.equal(output.resource, "backend/example.mjs");
    assert.equal(output.content, "");
    assert.equal(output.expectedSha256, "a".repeat(64));
    assert.deepEqual(output.replacements, [{ oldText: "before", newText: "after" }]);
    assert.ok(Object.isFrozen(output.replacements));
    assert.throws(() => { output.replacements[0].newText = "changed"; }, TypeError);
  }
  assert.deepEqual(original.parameters.replacements, [{ oldText: "before", newText: "after" }]);
});
test("edit digest binds SHA, ordered replacements and run without changing write conversion", () => {
  const service = publicApi.createProposalService();
  const original = service.convert(editRequest(), session);
  const changedSha = service.convert(editRequest({ parameters: { resource: "backend/example.mjs",
    expectedSha256: "b".repeat(64), replacements: [{ oldText: "before", newText: "after" }] } }), session);
  const changedText = service.convert(editRequest({ parameters: { resource: "backend/example.mjs",
    expectedSha256: "a".repeat(64), replacements: [{ oldText: "before", newText: "different" }] } }), session);
  const changedRun = service.convert(editRequest({ runId: "other" }), session);
  assert.notEqual(original.digest, changedSha.digest);
  assert.notEqual(original.digest, changedText.digest);
  assert.notEqual(original.digest, changedRun.digest);
  assert.equal(service.convert(request(), session).action, "write_file");
});
test("edit Model rejects malformed replacement schema and Proposal rejects read tools", () => {
  for (const parameters of [
    { resource: "x", expectedSha256: "A".repeat(64), replacements: [{ oldText: "x", newText: "y" }] },
    { resource: "x", expectedSha256: "a".repeat(64), replacements: [] },
    { resource: "x", expectedSha256: "a".repeat(64), replacements: Array.from({ length: 17 },
      (_, index) => ({ oldText: "old-" + index, newText: "new" })) },
    { resource: "x", expectedSha256: "a".repeat(64), replacements: [{ oldText: "", newText: "y" }] },
    { resource: "x", expectedSha256: "a".repeat(64), replacements: [{ oldText: "x", newText: "y", roleId: "Admin" }] },
    { resource: "x", expectedSha256: "a".repeat(64), replacements: [{ oldText: "x", newText: "y" }, { oldText: "x", newText: "z" }] },
    { resource: "x", expectedSha256: "a".repeat(64), replacements: [{ oldText: "x", newText: "y" }], content: "overwrite" }
  ]) assert.throws(() => editRequest({ parameters }), TypeError);
  const read = request({ tool: "legion_read_file", parameters: { resource: "backend/example.mjs" } });
  for (const factory of factories) assert.throws(() => factory().convert(read, session), /invalid_controlled_request/);
});

const suPayloads = {
  legion_delegate_pm: { action: "start", purpose: "plan", instruction: "Create current plan", sourceRefs: ["human:recorded"] },
  legion_query_role_activity: { roleId: "Backend" },
  legion_query_role_log: { roleId: "Backend", limit: 20 }
};

test("checks, Shell and all control tools cannot become mutation proposals", () => {
  for (const tool of ["legion_run_check", "legion_request_shell", ...AgentControlTools]) {
    let parameters = { payload: { purpose: "control request" } };
    if (tool === "legion_run_check") parameters = { checkId: "unit" };
    if (tool === "legion_request_shell") parameters = { command: "printf project", reason: "project build" };
    if (tool === "legion_review_shell") parameters = { requestId: "shell-request", requestDigest: "a".repeat(64),
      revision: 1, approved: true, reason: "exact request reviewed" };
    if (Object.hasOwn(suPayloads, tool)) parameters = {payload:suPayloads[tool]};
    const controlled = request({ tool, parameters });
    for (const factory of factories) {
      assert.throws(() => factory().convert(controlled, session), /invalid_controlled_request/);
    }
  }
});


test("invalid Shell tool schema remains rejected before every converter", () => {
  for (const [tool, parameters] of [
    ["legion_request_shell", { payload: { command: "printf project" } }],
    ["legion_request_shell", { command: "printf project", reason: "build", callerRoleId: "ProjectManager" }],
    ["legion_review_shell", { payload: { approved: true } }],
    ["legion_review_shell", { requestId: "shell", requestDigest: "a".repeat(64), revision: 0,
      approved: true, reason: "bad revision" }]
  ]) {
    for (const factory of factories) {
      assert.throws(() => factory().convert(request({ tool, parameters }), session), TypeError);
    }
  }
});

test("classified memory changes and Supervisor suggestions stay outside Mutation conversion", () => {
  for (const [tool, payload] of [
    ["legion_remember_fact", { action: "revise", factId: "fact-1", expectedRevision: 2, kind: "preference", statement: "Use the current approved profile", sourceRefs: ["host-answer-1"] }],
    ["legion_query_memory", { kind: "pitfall", limit: 10 }],
    ["legion_submit_supervision", { phase: "preflight", planDigest: "a".repeat(64), findings: [], recommendation: "proceed" }]
  ]) {
    const controlled = request({ tool, parameters: { payload } });
    for (const factory of factories) assert.throws(() => factory().convert(controlled, session), /invalid_controlled_request/);
  }
});

test("Su start/resume/activity/log never convert to a source mutation",()=>{
  for(const [tool,payload] of [
    ["legion_delegate_pm",{action:"resume",delegationId:"host-delegation",humanAnswerRef:"host-answer"}],
    ["legion_delegate_pm",{action:"start",purpose:"repair",instruction:"Repair current acceptance",sourceRefs:[],acceptanceId:"acceptance",taskId:"task"}],
    ["legion_query_role_activity",{}],["legion_query_role_log",{roleId:"Backend",limit:20}]
  ])for(const factory of factories)assert.throws(()=>factory().convert(request({tool,parameters:{payload}}),session),/invalid_controlled_request/);
});
