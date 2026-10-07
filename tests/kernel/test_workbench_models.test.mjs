import test from "node:test";
import assert from "node:assert/strict";
import { AgentSession, RoleBoundary, ActionProposal, PolicyDecision, Outcome, digestValue,
  ExecutionPermit } from "../../src/kernel/models/core.mjs";
import { AgentScope, TaskDispatchContext } from "../../src/kernel/models/agent.mjs";
import { ContextReadConfirmation, ContextSnapshot, ConfirmedTaskGrant, MutationVerification,
  createWorkbenchAuthority, isWorkbenchMutationAuthority } from "../../src/kernel/models/workbench.mjs";

const root = Object.freeze({ canonicalPath: "D:/fixture/project", deviceId: "1", fileId: "2" });
const version = "v4";
const profileVersion = "profile-v1";
function fixture(options = {}) {
  // Build dispatch explicitly: Session's sessionId is never a task-context field.
  const boundary = new RoleBoundary({ roleId: "Implementer", writeScope: ["backend/"],
    tools: ["legion_write_file"], capabilities: ["write_file"], ...options });
  const pair = createWorkbenchAuthority({ workspaceIdentity: root, organizationVersion: version,
    profileVersion, boundaries: [boundary] });
  const confirmation = new ContextReadConfirmation({ confirmationId: "read", workspaceIdentity: root,
    organizationVersion: version, profileVersion, contextReadSet: ["backend/input.txt"] });
  const read = pair.controller.confirmContextRead(confirmation);
  const snapshot = new ContextSnapshot({ confirmationDigest: confirmation.digest, workspaceIdentity: root,
    organizationVersion: version, profileVersion,
    files: [{ resource: "backend/input.txt", byteLength: 3, sha256: "a".repeat(64) }] });
  pair.controller.bindContextSnapshot(read, snapshot);
  const grant = new ConfirmedTaskGrant({ confirmationId: "task-confirm", workspaceIdentity: root,
    organizationVersion: version, profileVersion, contextSnapshotDigest: snapshot.digest, planDigest: "b".repeat(64),
    roleId: "Implementer", taskId: "task", writeSet: ["backend/out.txt"], tools: ["legion_write_file"] });
  const taskApproval = pair.controller.confirmTask(grant);
  const session = new AgentSession({ sessionId: "s", roleId: "Implementer", taskId: "task", organizationVersion: version });
  const dispatchContext = new TaskDispatchContext({ roleId: session.roleId, taskId: session.taskId,
    organizationVersion: version, writeSet: grant.writeSet, tools: grant.tools });
  const scope = new AgentScope({ write: grant.writeSet, tools: grant.tools, deny: [".ans/"] });
  return { ...pair, boundary, confirmation, read, snapshot, grant, taskApproval, session, dispatchContext, scope };
}
function start(f) {
  f.controller.registerInstance({ taskApproval: f.taskApproval, instanceId: "i", session: f.session,
    dispatchContext: f.dispatchContext, scope: f.scope });
  f.controller.beginRun("i", "run");
  const proposal = new ActionProposal({ proposalId: "p", action: "write_file", resource: "backend/out.txt",
    content: "body", tool: "legion_write_file", capability: "write_file", session: f.session, runId: "run" });
  const decision = new PolicyDecision({ outcome: Outcome.ALLOW, reason: "test_allow", proposalDigest: proposal.digest,
    organizationVersion: version, boundaryDigest: f.boundary.digest });
  return { proposal, decision };
}

test("workbench values copy/freeze and reject scalar, aliases, directories and unsafe paths", () => {
  const f = fixture();
  assert.equal(Object.isFrozen(f.confirmation.contextReadSet), true);
  assert.equal(Object.isFrozen(f.snapshot.files[0]), true);
  assert.throws(() => { f.snapshot.files[0].sha256 = "c".repeat(64); }, TypeError);
  for (const contextReadSet of ["backend/input.txt", ["backend/"], [".ANS/x"], ["../x"],
    ["backend/input.txt", "BACKEND\\INPUT.TXT"]]) {
    assert.throws(() => new ContextReadConfirmation({ ...f.confirmation, contextReadSet }), TypeError);
  }
  assert.throws(() => new ConfirmedTaskGrant({ ...f.grant, tools: "legion_write_file" }), TypeError);
  assert.throws(() => new ContextSnapshot({ ...f.snapshot, files: "file" }), TypeError);
});

test("context budgets are strict at 256KiB, 16 files and total 2MiB", () => {
  const f = fixture();
  const files = Array.from({ length: 8 }, (_, i) => ({ resource: "inputs/" + i,
    byteLength: 262144, sha256: "a".repeat(64) }));
  assert.equal(new ContextSnapshot({ ...f.snapshot, files }).files.length, 8);
  for (const invalid of [[{ ...files[0], byteLength: 262145 }], [...files, { ...files[0], resource: "inputs/9" }],
    Array.from({ length: 17 }, (_, i) => ({ ...files[0], resource: "inputs/" + i, byteLength: 0 }))]) {
    assert.throws(() => new ContextSnapshot({ ...f.snapshot, files: invalid }), TypeError);
  }
});

test("assertForRead requires live brand and exact identity/version/scope, never constructor data", () => {
  const f = fixture();
  const options = { workspaceIdentity: root, organizationVersion: version, profileVersion,
    resources: ["BACKEND\\INPUT.TXT"] };
  assert.equal(ContextReadConfirmation.assertForRead(f.read, options).confirmationDigest, f.confirmation.digest);
  for (const fake of [f.confirmation, {}, Object.freeze({}), JSON.parse(JSON.stringify(f.read))]) {
    assert.throws(() => ContextReadConfirmation.assertForRead(fake, options), /authorization/);
  }
  for (const change of [{ profileVersion: "changed" }, { organizationVersion: "changed" },
    { workspaceIdentity: { ...root, fileId: "3" } }, { resources: ["backend/other.txt"] }]) {
    assert.throws(() => ContextReadConfirmation.assertForRead(f.read, { ...options, ...change }), TypeError);
  }
  f.controller.revoke("close");
  assert.throws(() => ContextReadConfirmation.assertForRead(f.read, options), /authorization/);
});

test("snapshots and task confirmations cannot be rebound/replayed or cross authority", () => {
  const f = fixture(); const other = fixture();
  assert.throws(() => f.controller.confirmContextRead(f.confirmation), /replayed/);
  assert.throws(() => f.controller.bindContextSnapshot(f.read, f.snapshot), /already_bound/);
  assert.throws(() => f.controller.checkContextRead(other.read, "backend/input.txt"), /foreign/);
  assert.throws(() => f.controller.confirmTask(f.grant), /replayed/);
  assert.throws(() => f.controller.confirmTask(new ConfirmedTaskGrant({ ...f.grant,
    confirmationId: "new", contextSnapshotDigest: "d".repeat(64) })), /snapshot/);
  assert.throws(() => f.controller.confirmTask(new ConfirmedTaskGrant({ ...f.grant,
    confirmationId: "new", profileVersion: "changed" })), /binding/);
});

test("grant digest binds plan/profile/context without changing old task digest", () => {
  const f = fixture();
  for (const change of [{ planDigest: "c".repeat(64) }, { profileVersion: "changed" },
    { contextSnapshotDigest: "c".repeat(64) }, { writeSet: ["backend/other.txt"] }]) {
    assert.notEqual(f.grant.digest, new ConfirmedTaskGrant({ ...f.grant, ...change }).digest);
  }
  assert.equal(f.dispatchContext.digest, new TaskDispatchContext({ ...f.dispatchContext }).digest);
  assert.notEqual(digestValue(f.snapshot.files), f.snapshot.digest);
});

test("task approval is consumed once; exact context/task/session scope required", () => {
  const f = fixture();
  start(f);
  assert.throws(() => f.controller.registerInstance({ taskApproval: f.taskApproval, instanceId: "second",
    session: f.session, dispatchContext: f.dispatchContext, scope: f.scope }), /replayed/);
  const wrong = fixture();
  assert.throws(() => wrong.controller.registerInstance({ taskApproval: {}, instanceId: "i",
    session: wrong.session, dispatchContext: wrong.dispatchContext, scope: wrong.scope }), /approval/);
  assert.throws(() => wrong.controller.registerInstance({ taskApproval: wrong.taskApproval, instanceId: "i",
    session: wrong.session, dispatchContext: new TaskDispatchContext({ ...wrong.dispatchContext,
      writeSet: ["backend/other.txt"] }), scope: wrong.scope }), /binding/);
});

test("mutation capability exposes only three methods and forged handles/ALLOW cannot bypass scope", () => {
  const f = fixture(); const { proposal, decision } = start(f);
  assert.deepEqual(Object.keys(f.mutationAuthority), ["consume", "recheck", "release"]);
  assert.equal(isWorkbenchMutationAuthority(f.mutationAuthority), true);
  assert.equal(isWorkbenchMutationAuthority({ ...f.mutationAuthority }), false);
  assert.throws(() => f.mutationAuthority.consume(proposal, new ExecutionPermit()), /permit/);
  const outside = new ActionProposal({ ...proposal, resource: "frontend/login.txt" });
  assert.throws(() => f.controller.issue(outside, new PolicyDecision({ ...decision,
    proposalDigest: outside.digest })), /scope/);
  const permit = f.controller.issue(proposal, decision);
  const receipt = f.mutationAuthority.consume(proposal, permit);
  assert.ok(f.mutationAuthority.recheck(proposal, receipt) instanceof MutationVerification);
  assert.throws(() => f.mutationAuthority.consume(proposal, permit), /replayed/);
  f.mutationAuthority.release(receipt);
  assert.throws(() => f.mutationAuthority.recheck(proposal, receipt), /receipt/);
});

test("successful release permits subsequent independent writes; verification failure revokes all permanently", () => {
  for (const verificationFailure of ["root_identity_changed", "context_changed", "verification_unavailable"]) {
    const f = fixture(); const { proposal, decision } = start(f);
    const first = f.mutationAuthority.consume(proposal, f.controller.issue(proposal, decision));
    f.mutationAuthority.release(first);
    const pending = f.controller.issue(proposal, decision);
    const receipt = f.mutationAuthority.consume(proposal, f.controller.issue(proposal, decision));
    assert.throws(() => f.mutationAuthority.release(receipt, { verificationFailure: "unknown" }), TypeError);
    assert.throws(() => f.mutationAuthority.release({}, { verificationFailure }), TypeError);
    assert.ok(f.mutationAuthority.recheck(proposal, receipt) instanceof MutationVerification);
    f.mutationAuthority.release(receipt, { verificationFailure });
    assert.throws(() => f.controller.issue(proposal, decision), /revoked/);
    assert.throws(() => f.mutationAuthority.consume(proposal, pending), /revoked/);
    assert.throws(() => f.controller.confirmContextRead(f.confirmation), /revoked/);
    assert.throws(() => f.controller.beginRun("i", "old-values-restored"), /revoked/);
  }
});

test("foreign receipt failure cannot revoke either authority", () => {
  const f = fixture(); const other = fixture();
  const current = start(f); const second = start(other);
  const receipt = other.mutationAuthority.consume(second.proposal, other.controller.issue(second.proposal, second.decision));
  assert.throws(() => f.mutationAuthority.release(receipt, { verificationFailure: "context_changed" }), /foreign/);
  assert.ok(f.controller.issue(current.proposal, current.decision) instanceof ExecutionPermit);
  assert.ok(other.mutationAuthority.recheck(second.proposal, receipt) instanceof MutationVerification);
});

test("original resource/action approvals and one-run lifecycle remain enforced through workbench", () => {
  for (const approval of ["write_file", "BACKEND\\OUT.TXT"]) {
    const f = fixture({ requiredApprovals: [approval] }); const { proposal, decision } = start(f);
    assert.throws(() => f.controller.issue(proposal, decision), /approval_required/);
  }
  const f = fixture(); const { proposal, decision } = start(f);
  const permit = f.controller.issue(proposal, decision);
  f.controller.finishRun("i", "cancelled");
  assert.throws(() => f.mutationAuthority.consume(proposal, permit), /replayed/);
  assert.throws(() => f.controller.beginRun("i", "again"), /not_ready/);
});
