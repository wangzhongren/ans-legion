import test from "node:test";
import assert from "node:assert/strict";
import { AgentSession, ActionProposal, RoleBoundary, PolicyDecision, Outcome, ExecutionPermit,
  MutationResult, Event, normalizeResource, normalizeScope, scopeContains, requiresApproval,
  _createRuntimeAuthority, _isRuntimeAuthority } from "../../src/kernel/models/core.mjs";

function fixture() {
  const session = new AgentSession({ sessionId: "session", roleId: "Backend", taskId: "task", organizationVersion: "v1" });
  const boundary = new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"], denyScope: ["backend/private/"],
    capabilities: ["write_file"], tools: ["legion_write_file"] });
  const proposal = new ActionProposal({ proposalId: "proposal", action: "write_file", resource: "backend/file.txt",
    content: "body", tool: "legion_write_file", capability: "write_file", session });
  const authority = _createRuntimeAuthority({ sessions: [session], boundaries: [boundary], organizationVersion: "v1" });
  const decision = new PolicyDecision({ outcome: Outcome.ALLOW, reason: "within_boundary",
    proposalDigest: proposal.digest, organizationVersion: "v1", boundaryDigest: boundary.digest });
  return { session, boundary, proposal, authority, decision };
}

function decisionFor(proposal, boundary) {
  return new PolicyDecision({ outcome: Outcome.ALLOW, reason: "claimed_allow", proposalDigest: proposal.digest,
    organizationVersion: proposal.session.organizationVersion, boundaryDigest: boundary.digest });
}

test("Session is frozen and requires exact identity fields", () => {
  const { session } = fixture();
  assert.equal(Object.isFrozen(session), true);
  assert.throws(() => { session.roleId = "Admin"; }, TypeError);
  for (const options of [null, {}, { ...session, roleId: "" }, { ...session, role: "Admin" }]) {
    assert.throws(() => new AgentSession(options), TypeError);
  }
});

test("all seven boundary collections reject scalar strings, bytes, and noncollections", () => {
  const fields = ["readScope", "writeScope", "denyScope", "capabilities", "tools", "requiredApprovals", "handoffTargets"];
  for (const field of fields) {
    for (const value of ["backend/private/", "", null, 3, true, new Uint8Array([65, 66])]) {
      assert.throws(() => new RoleBoundary({ roleId: "Backend", [field]: value }), TypeError);
    }
  }
});

test("boundary defensively copies and deeply freezes array and Set inputs", () => {
  const write = ["backend/"];
  const tools = new Set(["legion_write_file"]);
  const boundary = new RoleBoundary({ roleId: "Backend", writeScope: write, tools });
  write.push("frontend/");
  tools.add("bash");
  assert.deepEqual(boundary.writeScope, ["backend/"]);
  assert.deepEqual(boundary.tools, ["legion_write_file"]);
  assert.equal(Object.isFrozen(boundary.tools), true);
  assert.throws(() => boundary.writeScope.push("other/"), TypeError);
  assert.equal(boundary.tools.add, undefined);
});

test("boundary digest is stable for reordered collections and binds restrictions", () => {
  const first = new RoleBoundary({ roleId: "Backend", writeScope: ["backend/a", "backend/b"], tools: ["a", "b"] });
  const reordered = new RoleBoundary({ roleId: "Backend", writeScope: ["backend/b", "backend/a"], tools: ["b", "a", "a"] });
  assert.equal(first.digest, reordered.digest);
  assert.notEqual(first.digest, new RoleBoundary({ ...first, denyScope: ["backend/a"] }).digest);
  assert.throws(() => new RoleBoundary({ ...first, allowScopeExpansion: "yes" }), TypeError);
});

test("resource gate rejects control planes, traversal, absolute/UNC, devices, and glob", () => {
  for (const resource of [".ANS/organization/file", ".git/config", ".agents/file", ".codex/file",
    ".aws/credentials", "../outside", "backend/../file", "C:/outside", "/outside", "\\\\server\\share",
    "backend//file", "backend/CON.txt", "backend/LPT9.log", "backend/file. ", "backend/*", "backend/?", "a\0b"]) {
    assert.throws(() => normalizeResource(resource), TypeError, resource);
  }
  assert.equal(normalizeResource("BACKEND\\File.txt"), "BACKEND/File.txt");
  assert.equal(normalizeScope(".ANS\\events\\"), ".ANS/events/");
  assert.throws(() => normalizeScope("backend//"), TypeError);
});

test("scope identity preserves directory versus exact-file semantics", () => {
  assert.equal(scopeContains("BACKEND/", "backend/file.txt"), true);
  assert.equal(scopeContains("backend\\", "BACKEND/file.txt"), true);
  assert.equal(scopeContains("backend/", "backend-other/file.txt"), false);
  assert.equal(scopeContains("backend/file.txt", "BACKEND\\FILE.TXT"), true);
  assert.equal(scopeContains("backend/file.txt", "backend/file.txt/nested"), false);
  assert.equal(scopeContains("backend/", "backend"), false);
});

test("pure grant normalizes task path separators before storing exact resource checks", () => {
  const { authority, session, boundary } = fixture();
  authority.registerInstance({ instanceId: "i", session,
    dispatchContext: { roleId: session.roleId, taskId: session.taskId, organizationVersion: "v1",
      writeSet: ["BACKEND\\FILE.TXT"], tools: ["legion_write_file"] },
    scope: { write: ["backend/file.txt"], deny: [], tools: ["legion_write_file"] } });
  authority.beginRun("i", "run");
  const p = new ActionProposal({ proposalId: "path", action: "write_file", resource: "backend/file.txt",
    content: "body", tool: "legion_write_file", capability: "write_file", session, runId: "run" });
  const receipt = authority.consume(p, authority.issue(p, decisionFor(p, boundary)));
  assert.equal(authority.recheck(p, receipt), undefined);
});

test("canonical resource approvals and action approval preserve aliases and reject malformed conditions", () => {
  for (const condition of ["backend/approved.txt", "BACKEND\\APPROVED.TXT"]) {
    const boundary = new RoleBoundary({ roleId: "Backend", requiredApprovals: [condition] });
    for (const resource of ["backend/approved.txt", "BACKEND/APPROVED.TXT", "backend\\approved.txt"]) {
      assert.equal(requiresApproval(boundary, "write_file", resource), true);
    }
    assert.equal(requiresApproval(boundary, "write_file", "backend/other.txt"), false);
  }
  const action = new RoleBoundary({ roleId: "Backend", requiredApprovals: ["write_file"] });
  assert.equal(requiresApproval(action, "write_file", "backend/other.txt"), true);
  for (const condition of ["../outside", "C:/outside", ".ANS/file", "backend/"]) {
    assert.throws(() => new RoleBoundary({ roleId: "Backend", requiredApprovals: [condition] }), TypeError);
  }
});

test("proposal freezes fields and digest binds content, target, tool, identity, and host run", () => {
  const { proposal, session } = fixture();
  for (const changes of [{ proposalId: "other" }, { content: "other" }, { resource: "backend/other" },
    { action: "shell" }, { tool: "bash" }, { capability: "admin" }, { runId: "run-1" },
    { session: new AgentSession({ ...session, taskId: "other" }) }]) {
    assert.notEqual(proposal.digest, new ActionProposal({ ...proposal, ...changes }).digest);
  }
  assert.equal(proposal.contentDigest.length, 64);
  assert.throws(() => { proposal.content = "other"; }, TypeError);
  assert.throws(() => new ActionProposal({ ...proposal, content: 5 }), TypeError);
  assert.throws(() => new ActionProposal({ ...proposal, session: { ...session } }), TypeError);
});

test("decision, result, and Event serialize with immutable typed state", () => {
  const { decision, proposal } = fixture();
  assert.equal(Object.isFrozen(decision), true);
  assert.throws(() => new PolicyDecision({ ...decision, outcome: "UNKNOWN" }), TypeError);
  const result = new MutationResult({ success: false, status: "audit_failed", reason: "result_audit_failed",
    resource: proposal.resource, proposalDigest: proposal.digest, observedMutation: true, auditFailed: true });
  assert.equal(result.observedMutation, true);
  assert.throws(() => new MutationResult({ success: true, status: "written", reason: "ok" }), TypeError);
  const event = new Event({ sequence: 0, kind: "proposal", roleId: "Backend", taskId: "task",
    organizationVersion: "v1", resource: proposal.resource, proposalDigest: proposal.digest, correlationId: "p" });
  assert.equal(event.recordedAt, "");
  assert.deepEqual(new Event(JSON.parse(JSON.stringify(event))), event);
  assert.throws(() => new Event({ ...event, content: "raw body" }), TypeError);
  assert.throws(() => new Event({ ...event, sequence: -1 }), TypeError);
});

test("opaque permit construction and lookalike authority create no valid authorization", () => {
  const { authority, proposal } = fixture();
  assert.equal(_isRuntimeAuthority(authority), true);
  assert.equal(_isRuntimeAuthority({ consume() {} }), false);
  for (const forged of [undefined, {}, new ExecutionPermit(), Object.freeze({}), []]) {
    assert.throws(() => authority.consume(proposal, forged), /invalid_or_replayed_permit/);
  }
  assert.deepEqual(Object.keys(new ExecutionPermit()), []);
});

test("authentic permit is single use and its consumed receipt can only recheck its own proposal", () => {
  const { authority, proposal, decision } = fixture();
  const permit = authority.issue(proposal, decision);
  const receipt = authority.consume(proposal, permit);
  assert.equal(authority.recheck(proposal, receipt), undefined);
  assert.throws(() => authority.consume(proposal, permit), /replayed/);
  assert.throws(() => authority.recheck(proposal, {}), /invalid_or_revoked_receipt/);
  authority.release(receipt);
  assert.throws(() => authority.recheck(proposal, receipt), /invalid_or_revoked_receipt/);
});

test("content/target/proposal-id/run/identity changes consume and permanently reject a permit", () => {
  const { authority, proposal, decision, session } = fixture();
  for (const changes of [{ content: "other" }, { resource: "backend/other" }, { proposalId: "other" },
    { runId: "other" }, { session: new AgentSession({ ...session }) }]) {
    const permit = authority.issue(proposal, decision);
    assert.throws(() => authority.consume(new ActionProposal({ ...proposal, ...changes }), permit));
    assert.throws(() => authority.consume(proposal, permit), /replayed/);
  }
});

test("pure permit validation independently rejects claimed ALLOW outside scope, deny, tools, or control plane", () => {
  const { authority, proposal, boundary } = fixture();
  for (const changes of [{ resource: "frontend/login.vue" }, { resource: "BACKEND\\PRIVATE\\key" },
    { resource: ".ANS/organization/file" }, { resource: "../outside" }, { tool: "bash" }, { capability: "network" }]) {
    const changed = new ActionProposal({ ...proposal, ...changes });
    assert.throws(() => authority.issue(changed, decisionFor(changed, boundary)));
  }
});

test("pure permit approval revalidation blocks canonical aliases even with matching forged ALLOW", () => {
  const { authority, proposal, boundary } = fixture();
  for (const condition of ["backend/approved.txt", "BACKEND\\APPROVED.TXT", "write_file"]) {
    const approved = new RoleBoundary({ ...boundary, requiredApprovals: [condition] });
    authority.updateBoundary(approved);
    for (const resource of ["backend/approved.txt", "BACKEND/APPROVED.TXT", "backend\\approved.txt"]) {
      const changed = new ActionProposal({ ...proposal, resource });
      assert.throws(() => authority.issue(changed, decisionFor(changed, approved)), /approval_required/);
    }
  }
});

test("version, boundary, and task roundtrips revoke issued permits and consumed receipts permanently", () => {
  for (const transition of ["version", "boundary", "task"]) {
    const { authority, proposal, decision, boundary } = fixture();
    const permit = authority.issue(proposal, decision);
    const receipt = authority.consume(proposal, authority.issue(proposal, decision));
    if (transition === "version") {
      authority.updateVersion("v2");
      authority.updateVersion("v1");
    }
    if (transition === "boundary") {
      authority.updateBoundary(new RoleBoundary({ ...boundary, writeScope: [] }));
      authority.updateBoundary(boundary);
    }
    if (transition === "task") {
      authority.setTaskStatus("task", "completed");
      authority.setTaskStatus("task", "active");
    }
    assert.throws(() => authority.consume(proposal, permit), /replayed/);
    assert.throws(() => authority.recheck(proposal, receipt), /revoked/);
  }
});

test("authority snapshots expose immutable copies and reject duplicate or invalid trusted inputs", () => {
  const { authority, session, boundary } = fixture();
  const snapshot = authority.snapshot();
  assert.throws(() => snapshot.sessions.push(session), TypeError);
  assert.throws(() => { snapshot.taskStatuses[0].status = "completed"; }, TypeError);
  assert.equal(authority.taskStatus("task"), "active");
  assert.throws(() => _createRuntimeAuthority({ sessions: [session, session], boundaries: [boundary], organizationVersion: "v1" }));
  assert.throws(() => _createRuntimeAuthority({ sessions: [{ ...session }], organizationVersion: "v1" }));
  assert.throws(() => _createRuntimeAuthority({ boundaries: [boundary, boundary], organizationVersion: "v1" }));
  assert.throws(() => authority.setTaskStatus("task", "unknown"));
});
