import test from "node:test";
import assert from "node:assert/strict";
import * as publicApi from "../../src/adapters/services/public/proposal.mjs";
import { AgentSession, ActionProposal } from "../../src/kernel/models/core.mjs";
import { PiToolRequest } from "../../src/kernel/models/agent.mjs";

const factories = [publicApi.createProposalService, publicApi.createCodexAdapter, publicApi.createClaudeAdapter];
const session = new AgentSession({ sessionId: "s", roleId: "Backend", taskId: "task", organizationVersion: "v3" });
function request(overrides = {}) {
  return new PiToolRequest({ requestId: "p", runId: "run", toolCallId: "call", tool: "legion_write_file",
    parameters: { resource: "backend/example.mjs", content: "你好\n" }, ...overrides });
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
