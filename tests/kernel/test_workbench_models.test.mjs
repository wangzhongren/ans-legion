import { makeTestOwners } from "./test_control_memory.test.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { AgentSession, RoleBoundary, ActionProposal, PolicyDecision, Outcome, digestValue,
  ExecutionPermit } from "../../src/kernel/models/core.mjs";
import { AgentScope, TaskDispatchContext } from "../../src/kernel/models/agent.mjs";
import { ContextReadConfirmation, ContextSnapshot, ConfirmedTaskGrant, MutationVerification,
  createWorkbenchAuthority, isWorkbenchMutationAuthority, ProjectFileOwners, FileOwnershipTransfer,
  FileOwnershipPlan, FileOwnershipError, applyFileOwnershipPlan, assertFileOwner } from "../../src/kernel/models/workbench.mjs";

const root = Object.freeze({ canonicalPath: "D:/fixture/project", deviceId: "1", fileId: "2" });
const version = "v4";
const profileVersion = "profile-v1";
function fixture(options = {}, fileOwners = makeTestOwners("Implementer", ["backend/out.txt"])) {
  // Build dispatch explicitly: Session's sessionId is never a task-context field.
  const boundary = new RoleBoundary({ roleId: "Implementer", writeScope: ["backend/"],
    tools: ["legion_write_file"], capabilities: ["write_file"], ...options });
  const authorityOptions = { workspaceIdentity: root, organizationVersion: version,
    profileVersion, boundaries: [boundary] };
  if (fileOwners !== undefined) authorityOptions.fileOwners = fileOwners;
  const pair = createWorkbenchAuthority(authorityOptions);
  const confirmation = new ContextReadConfirmation({ confirmationId: "read", workspaceIdentity: root,
    organizationVersion: version, profileVersion, contextReadSet: ["backend/input.txt"] });
  const read = pair.controller.confirmContextRead(confirmation);
  const snapshot = new ContextSnapshot({ confirmationDigest: confirmation.digest, workspaceIdentity: root,
    organizationVersion: version, profileVersion,
    files: [{ resource: "backend/input.txt", byteLength: 3, sha256: "a".repeat(64) }] });
  pair.controller.bindContextSnapshot(read, snapshot);
  const grantOptions = { confirmationId: "task-confirm", workspaceIdentity: root,
    organizationVersion: version, profileVersion, contextSnapshotDigest: snapshot.digest, planDigest: "b".repeat(64),
    roleId: "Implementer", taskId: "task", fileOwnersDigest: fileOwners.digest, ownerGeneration: fileOwners.version, tools: ["legion_write_file"] };
  if (fileOwners !== undefined) grantOptions.fileOwnersDigest = fileOwners.digest;
  const grant = new ConfirmedTaskGrant(grantOptions);
  const taskApproval = pair.controller.confirmTask(grant);
  const session = new AgentSession({ sessionId: "s", roleId: "Implementer", taskId: "task", organizationVersion: version });
  const dispatchContext = new TaskDispatchContext({ roleId: session.roleId, taskId: session.taskId,
    organizationVersion: version, fileOwnersDigest: fileOwners.digest, ownerGeneration: fileOwners.version, tools: grant.tools });
  const scope = new AgentScope({ write: ["backend/out.txt"], tools: grant.tools, deny: [".ans/"] });
  return { ...pair, boundary, confirmation, read, snapshot, grant, taskApproval, session, dispatchContext, scope,
    fileOwners };
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

test("file ownership plans atomically claim and explicitly transfer exact case-insensitive paths", () => {
  const current = new ProjectFileOwners({ projectId: "project", version: "v1", owners: [
    { resource: "src/a.ts", roleId: "Backend" }, { resource: "src/b.ts", roleId: "Frontend" }] });
  const transfer = new FileOwnershipTransfer({ resource: "SRC\\B.TS", fromRoleId: "Frontend",
    toRoleId: "Backend" });
  const plan = new FileOwnershipPlan({ projectId: "project", baseVersion: "v1", baseDigest: current.digest,
    nextVersion: "v2", claims: [{ resource: "SRC/a.ts", roleId: "Backend" },
      { resource: "src/b.ts", roleId: "Backend" }, { resource: "src/c.ts", roleId: "Backend" },
      { resource: "SRC/C.TS", roleId: "Backend" }], transfers: [transfer] });
  assert.equal(new ProjectFileOwners(JSON.parse(JSON.stringify(current))).digest, current.digest);
  assert.equal(new FileOwnershipPlan(JSON.parse(JSON.stringify(plan))).digest, plan.digest);
  assert.equal(plan.claims.length, 3);
  const next = applyFileOwnershipPlan(current, plan);
  assert.equal(next.version, "v2");
  assert.equal(next.ownerOf("SRC\\B.TS"), "Backend");
  assert.equal(next.ownerOf("src/c.ts"), "Backend");
  assert.equal(current.ownerOf("src/b.ts"), "Frontend");
  assert.equal(assertFileOwner(next, { projectId: "project", version: "v2",
    resource: "SRC/B.TS", roleId: "Backend" }), true);
  assert.throws(() => applyFileOwnershipPlan(next, plan), /stale_file_owners/);
  assert.throws(() => new ProjectFileOwners({ projectId: "project", version: "v1", owners: [
    { resource: "src/a.ts", roleId: "Backend" }, { resource: "SRC\\A.TS", roleId: "Frontend" }] }),
    /duplicate_owner_alias/);
  assert.throws(() => new ProjectFileOwners({ projectId: "project", version: "v1", owners: [
    { resource: "src/", roleId: "Backend" }] }), TypeError);
});

test("ownership conflicts name the prior owner and leave the snapshot unchanged", () => {
  const current = new ProjectFileOwners({ projectId: "project", version: "v1", owners: [
    { resource: "src/a.ts", roleId: "Backend" }] });
  const base = { projectId: "project", baseVersion: "v1", baseDigest: current.digest, nextVersion: "v2" };
  assert.throws(() => new FileOwnershipPlan({ ...base, claims: [
    { resource: "src/a.ts", roleId: "Backend" }, { resource: "SRC\\A.TS", roleId: "Frontend" }] }),
    (error) => error instanceof FileOwnershipError && error.reason === "cross_role_claim" &&
      error.ownerRoleId === "Backend");
  const stolen = new FileOwnershipPlan({ ...base, claims: [{ resource: "SRC/a.ts", roleId: "Frontend" }],
    transfers: [] });
  assert.throws(() => applyFileOwnershipPlan(current, stolen),
    (error) => error instanceof FileOwnershipError && error.reason === "file_owned_by_other_role" &&
      error.ownerRoleId === "Backend");
  const staleTransfer = new FileOwnershipPlan({ ...base, claims: [{ resource: "src/a.ts", roleId: "Frontend" }],
    transfers: [{ resource: "src/a.ts", fromRoleId: "Other", toRoleId: "Frontend" }] });
  assert.throws(() => applyFileOwnershipPlan(current, staleTransfer), /transfer_from_mismatch/);
  assert.equal(current.ownerOf("src/a.ts"), "Backend");
  assert.throws(() => assertFileOwner(current, { projectId: "project", version: "v1",
    resource: "src/a.ts", roleId: "Frontend" }), /file_owned_by_other_role/);
});

test("ownership claims and transfers reject protected components at any depth", () => {
  const current = new ProjectFileOwners({ projectId: "project", version: "v1", owners: [
    { resource: "src/public/index.ts", roleId: "Backend" }] });
  const planBase = { projectId: "project", baseVersion: "v1", baseDigest: current.digest,
    nextVersion: "v2" };
  for (const resource of ["src/.git/config", "src\\.AnS\\state.json", "docs/.CoDeX/settings.json",
    "src/.SSH/id_rsa", "src/.DoCkEr/config.json", "src/.KUBE/config", "src/.ENV.local",
    "packages/.NpMrC", "packages/private.PEM"]) {
    assert.throws(() => new ProjectFileOwners({ projectId: "project", version: "v1", owners: [
      { resource, roleId: "Backend" }] }), /restricted_resource/, resource);
    assert.throws(() => new FileOwnershipPlan({ ...planBase,
      claims: [{ resource, roleId: "Backend" }] }), /restricted_resource/, resource);
    assert.throws(() => new FileOwnershipTransfer({ resource, fromRoleId: "Backend",
      toRoleId: "Frontend" }), /restricted_resource/, resource);
    assert.throws(() => current.ownerOf(resource), /restricted_resource/, resource);
  }
  const ordinary = new FileOwnershipPlan({ ...planBase,
    claims: [{ resource: "src/nested/feature.ts", roleId: "Backend" }], transfers: [] });
  const next = applyFileOwnershipPlan(current, ordinary);
  assert.equal(next.ownerOf("SRC\\NESTED\\FEATURE.TS"), "Backend");
  assert.equal(current.ownerOf("src/public/index.ts"), "Backend");
});

test("confirmed task and branded authority bind file-owner digest through issue and recheck", () => {
  const owners = new ProjectFileOwners({ projectId: "project", version: "owners-v1", owners: [
    { resource: "backend/out.txt", roleId: "Implementer" }] });
  const f = fixture({}, owners);
  const { proposal, decision } = start(f);
  assert.equal(f.controller.assertFileOwners(owners), true);
  const receipt = f.mutationAuthority.consume(proposal, f.controller.issue(proposal, decision));
  assert.ok(f.mutationAuthority.recheck(proposal, receipt) instanceof MutationVerification);
  const changed = new ProjectFileOwners({ projectId: "project", version: "owners-v2", owners: [
    { resource: "backend/out.txt", roleId: "Other" }] });
  assert.throws(() => f.controller.assertFileOwners(changed), /stale_file_owners/);
  assert.throws(() => f.mutationAuthority.recheck(proposal, receipt), /revoked/);
  const wrongOwners = new ProjectFileOwners({ projectId: "project", version: "owners-v1", owners: [
    { resource: "backend/out.txt", roleId: "Other" }] });
  assert.throws(() => fixture({}, wrongOwners), /file_owned_by_other_role/);
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
    { contextSnapshotDigest: "c".repeat(64) }, { ownerGeneration: "next" }]) {
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
      ownerGeneration: "other" }), scope: wrong.scope }), /binding/);
});

test("mutation capability exposes only three methods and forged handles/ALLOW cannot bypass scope", () => {
  const f = fixture(); const { proposal, decision } = start(f);
  assert.deepEqual(Object.keys(f.mutationAuthority), ["invalidateOwnership", "ownerBinding", "consume", "recheck", "release"]);
  assert.equal(isWorkbenchMutationAuthority(f.mutationAuthority), true);
  assert.equal(isWorkbenchMutationAuthority({ ...f.mutationAuthority }), false);
  assert.throws(() => f.mutationAuthority.consume(proposal, new ExecutionPermit()), /permit/);
  const outside = new ActionProposal({ ...proposal, resource: "frontend/login.txt" });
  assert.throws(() => f.controller.issue(outside, new PolicyDecision({ ...decision,
    proposalDigest: outside.digest })), /unowned_file/);
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

test("read-only acceptance grants bind exact approved checks and never receive write tools", async () => {
  const { CheckSpec } = await import("../../src/kernel/models/check.mjs");
  const f = fixture();
  const check = new CheckSpec({ checkId: "acceptance", kind: "node-test", argv: ["--test", "tests/accept.mjs"],
    testResources: ["tests/accept.mjs"], inputResources: ["tests/accept.mjs", "src/main.mjs"],
    timeoutSeconds: 20, network: "none" });
  const tools = ["legion_list_files", "legion_read_file", "legion_run_check", "legion_submit_acceptance"];
  const grant = new ConfirmedTaskGrant({ ...f.grant, confirmationId: "accept", tools, checks: [check] });
  const context = new TaskDispatchContext({ ...f.dispatchContext, tools, checks: [check] });
  const scope = new AgentScope({ write: [], tools, checks: [check] });
  assert.ok(Object.isFrozen(grant.checks));
  assert.equal(scope.checks[0], check);
  assert.deepEqual(new ConfirmedTaskGrant(JSON.parse(JSON.stringify(grant))), grant);
  assert.deepEqual(new TaskDispatchContext(JSON.parse(JSON.stringify(context))), context);
  assert.deepEqual(new AgentScope(JSON.parse(JSON.stringify(scope))), scope);
  assert.notEqual(grant.digest, new ConfirmedTaskGrant({ ...grant, checks: [new CheckSpec({ ...check, network: "localhost" })] }).digest);
  assert.throws(() => new ConfirmedTaskGrant({ ...grant, checks: [] }), /checks_required/);
  assert.throws(() => f.controller.registerInstance({ taskApproval: f.controller.confirmTask(new ConfirmedTaskGrant({ ...grant, tools: [...tools, "legion_write_file"] })), instanceId: "accept", session: f.session, dispatchContext: context, scope }), /binding/);
  assert.throws(() => new TaskDispatchContext({ ...context, writeSet: [] }), /unknown field writeSet/);
  assert.throws(() => new ConfirmedTaskGrant({ ...grant, tools: [...tools, "bash"] }), /write_tool/);
  assert.throws(() => new ConfirmedTaskGrant({ ...grant, checks: [check, check] }), /duplicate_check/);
});

test("legacy writeSet execution grants and missing owner snapshots fail closed", () => {
  const f = fixture();
  assert.throws(() => new ConfirmedTaskGrant({ ...f.grant, writeSet: ["backend/out.txt"] }), /unknown field writeSet/);
  assert.throws(() => new TaskDispatchContext({ ...f.dispatchContext, writeSet: [] }), /unknown field writeSet/);
  assert.throws(() => createWorkbenchAuthority({ workspaceIdentity: root, organizationVersion: version,
    profileVersion, boundaries: [f.boundary] }), /typed_file_owners_required/);
  assert.throws(() => f.controller.confirmTask(new ConfirmedTaskGrant({ ...f.grant, ownerGeneration: "next" })), /stale_file_owners/);
});

test("one role cannot begin two source-writing runs at once", () => {
  const f = fixture(); start(f);
  const grant = new ConfirmedTaskGrant({ ...f.grant, confirmationId: "second", taskId: "second" });
  const session = new AgentSession({ ...f.session, sessionId: "second", taskId: "second" });
  const dispatch = new TaskDispatchContext({ ...f.dispatchContext, taskId: "second" });
  f.controller.registerInstance({ taskApproval: f.controller.confirmTask(grant), instanceId: "second", session, dispatchContext: dispatch, scope: f.scope });
  assert.throws(() => f.controller.beginRun("second", "next"), /role_write_run_already_active/);
  f.controller.finishRun("i", "completed");
  assert.equal(f.controller.beginRun("second", "next").status, "running");
});
