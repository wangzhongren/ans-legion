import { makeTestOwners, testLeaseContext } from "./test_control_memory.test.mjs";
const kernelOwners = makeTestOwners("Backend", ["backend/a.txt", "backend/b.txt", "backend/c.txt", "backend/data.json", "backend/output.txt"]);
import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import nodeFs from "node:fs";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
function tmpdir() {
  const path = fileURLToPath(new URL("../../.ans/runtime/legion-cli-role-owned-v2/KernelEngineer/tmp/", import.meta.url));
  mkdirSync(path, { recursive: true });
  return path;
}
import { join, resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { createMutationService } from "../../src/kernel/services/public/mutation.mjs";
import { createStorageProvider, StorageError } from "../../src/kernel/providers/public/storage.mjs";
import { AgentSession, RoleBoundary, ActionProposal, PolicyDecision, ExecutionPermit, Outcome,
  _createRuntimeAuthority } from "../../src/kernel/models/core.mjs";
import { AgentScope, TaskDispatchContext } from "../../src/kernel/models/agent.mjs";
import { ContextReadConfirmation, ContextSnapshot, ConfirmedTaskGrant,
  createWorkbenchAuthority } from "../../src/kernel/models/workbench.mjs";

async function fixture(t) {
  const workspace = await fs.mkdtemp(join(tmpdir(), "legion-mutation-"));
  const session = new AgentSession({ sessionId: "s", roleId: "Backend", taskId: "task", organizationVersion: "v3" });
  const boundary = new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"], tools: ["legion_write_file"], capabilities: ["write_file"] });
  const authority = _createRuntimeAuthority({ fileOwners: kernelOwners, sessions: [session], boundaries: [boundary], organizationVersion: "v3" });
  const mutation = createMutationService({ workspace, _authority: authority, leaseContext: testLeaseContext(workspace, kernelOwners) });
  t.after(async () => { t.mock.restoreAll(); await mutation.close(); await fs.rm(workspace, { recursive: true }); });
  function proposal(extra = {}) { return new ActionProposal({ proposalId: "p", action: "write_file", resource: "backend/a.txt", content: "secret-body",
    tool: "legion_write_file", capability: "write_file", session, ...extra }); }
  function permit(p = proposal()) { return authority.issue(p, new PolicyDecision({ outcome: Outcome.ALLOW, reason: "ok",
    proposalDigest: p.digest, organizationVersion: "v3", boundaryDigest: boundary.digest })); }
  return { workspace, session, boundary, authority, mutation, proposal, permit };
}
async function editableFixture(t, content = "alpha\nbeta\ngamma\n") {
  const f = await fixture(t);
  await fs.mkdir(join(f.workspace, "backend"));
  const path = join(f.workspace, "backend/a.txt");
  await fs.writeFile(path, content);
  const boundary = new RoleBoundary({ ...f.boundary, tools: ["legion_write_file", "legion_edit_file"] });
  f.authority.updateBoundary(boundary);
  function edit(replacements, expectedSha256 = createHash("sha256").update(content).digest("hex"), extra = {}) {
    return new ActionProposal({ proposalId: "edit", action: "edit_file", resource: "backend/a.txt",
      tool: "legion_edit_file", capability: "write_file", session: f.session, expectedSha256,
      replacements, ...extra });
  }
  function permit(proposal) { return f.authority.issue(proposal, new PolicyDecision({ outcome: Outcome.ALLOW,
    reason: "ok", proposalDigest: proposal.digest, organizationVersion: "v3", boundaryDigest: boundary.digest })); }
  return { ...f, path, content, edit, editPermit: permit, editBoundary: boundary };
}

test("controlled edit applies ordered unique replacements atomically and audits final SHA", async (t) => {
  const f = await editableFixture(t);
  const proposal = f.edit([{ oldText: "alpha", newText: "ALPHA" }, { oldText: "beta", newText: "BETA" }]);
  const ordinary = createMutationService({ workspace: f.workspace });
  assert.equal((await ordinary.execute(proposal, new ExecutionPermit())).status, "denied");
  assert.equal(await fs.readFile(f.path, "utf8"), f.content);
  await ordinary.close();
  const permit = f.editPermit(proposal);
  const result = await f.mutation.execute(proposal, permit);
  const expected = "ALPHA\nBETA\ngamma\n";
  const digest = createHash("sha256").update(expected).digest("hex");
  assert.equal(result.status, "written");
  assert.equal(result.contentDigest, digest);
  assert.equal(await fs.readFile(f.path, "utf8"), expected);
  assert.equal((await f.mutation.execute(proposal, permit)).status, "denied");
  const events = await f.mutation.events();
  assert.deepEqual(events.map((event) => event.kind), ["mutation_intent", "mutation_success"]);
  assert.equal(events[1].contentDigest, digest);
  assert.ok(!JSON.stringify(events).includes("ALPHA"));
});

test("edit rejects stale SHA, missing and ambiguous text without changing the file", async (t) => {
  const f = await editableFixture(t, "same same\n");
  for (const [replacements, sha, reason] of [
    [[{ oldText: "same", newText: "changed" }], "a".repeat(64), "edit_sha_mismatch"],
    [[{ oldText: "same", newText: "changed" }], createHash("sha256").update(f.content).digest("hex"),
      "edit_ambiguous_old_text"],
    [[{ oldText: "missing", newText: "changed" }], createHash("sha256").update(f.content).digest("hex"),
      "edit_old_text_missing"],
    [[{ oldText: "same same", newText: "first step" }, { oldText: "absent", newText: "second step" }],
      createHash("sha256").update(f.content).digest("hex"), "edit_old_text_missing"],
  ]) {
    const proposal = f.edit(replacements, sha);
    const result = await f.mutation.execute(proposal, f.editPermit(proposal));
    assert.equal(result.status, "denied");
    assert.equal(result.reason, reason);
    assert.equal(await fs.readFile(f.path, "utf8"), f.content);
  }
});

test("edit requires an existing bounded UTF-8 ordinary file", async (t) => {
  const f = await editableFixture(t);
  const replacement = [{ oldText: "alpha", newText: "new" }];
  for (const [bytes, reason] of [[Buffer.from([0xff]), "edit_invalid_utf8"],
    [Buffer.from("a\0b"), "edit_binary_file"], [Buffer.alloc(2097153, 65), "edit_file_too_large"]]) {
    await fs.writeFile(f.path, bytes);
    const proposal = f.edit(replacement, createHash("sha256").update(bytes).digest("hex"));
    const result = await f.mutation.execute(proposal, f.editPermit(proposal));
    assert.equal(result.status, "denied"); assert.equal(result.reason, reason);
    assert.deepEqual(await fs.readFile(f.path), bytes);
  }
  await fs.unlink(f.path);
  const missing = f.edit(replacement);
  const denied = await f.mutation.execute(missing, f.editPermit(missing));
  assert.equal(denied.status, "denied"); assert.equal(denied.reason, "edit_target_missing");
});

test("edit output cannot exceed the 2 MiB text cap and leaves original bytes intact", async (t) => {
  const f = await editableFixture(t);
  const proposal = f.edit([{ oldText: "alpha", newText: "x".repeat(2097147) }]);
  const result = await f.mutation.execute(proposal, f.editPermit(proposal));
  assert.equal(result.status, "denied");
  assert.equal(result.reason, "edit_file_too_large");
  assert.equal(await fs.readFile(f.path, "utf8"), f.content);
});

test("edit rechecks source after intent audit and leaves an external change intact", async (t) => {
  const f = await editableFixture(t);
  const proposal = f.edit([{ oldText: "alpha", newText: "ALPHA" }]);
  const open = fs.open; let changed = false;
  t.mock.method(fs, "open", async (...args) => {
    const handle = await open(...args);
    if (!changed && String(args[0]).endsWith(".jsonl")) {
      changed = true;
      await fs.writeFile(f.path, "outside edit\n");
    }
    return handle;
  });
  const result = await f.mutation.execute(proposal, f.editPermit(proposal));
  assert.equal(result.status, "denied");
  assert.equal(result.reason, "edit_sha_mismatch");
  assert.equal(await fs.readFile(f.path, "utf8"), "outside edit\n");
  assert.equal((await f.mutation.events()).at(-1).kind, "mutation_failure");
});

test("edit permit cannot bypass write_file or exact-path approval", async (t) => {
  const f = await editableFixture(t);
  const proposal = f.edit([{ oldText: "alpha", newText: "ALPHA" }]);
  for (const approval of ["write_file", "BACKEND\\A.TXT"]) {
    const boundary = new RoleBoundary({ ...f.editBoundary, requiredApprovals: [approval] });
    f.authority.updateBoundary(boundary);
    const decision = new PolicyDecision({ outcome: Outcome.ALLOW, reason: "claimed_allow",
      proposalDigest: proposal.digest, organizationVersion: "v3", boundaryDigest: boundary.digest });
    assert.throws(() => f.authority.issue(proposal, decision), /approval_required/);
    assert.equal(await fs.readFile(f.path, "utf8"), f.content);
  }
});
test("ordinary Provider/Mutation APIs, forged ALLOW and permits cannot write", async (t) => {
  const f = await fixture(t); const p = f.proposal();
  const raw = createStorageProvider({ workspace: f.workspace });
  const ordinary = createMutationService({ workspace: f.workspace });
  const forged = new PolicyDecision({ outcome: Outcome.ALLOW, reason: "forged", proposalDigest: p.digest, organizationVersion: "v3" });
  assert.equal((await raw.write(p, forged)).status, "denied");
  assert.equal((await ordinary.execute(p, new ExecutionPermit())).status, "denied");
  assert.equal((await f.mutation.execute(p, forged)).status, "denied");
  assert.equal((await f.mutation.execute(p, new ExecutionPermit())).status, "denied");
  assert.throws(() => raw.createIdentity(), StorageError);
  await assert.rejects(fs.readFile(join(f.workspace, "backend/a.txt")), { code: "ENOENT" });
  await ordinary.close(); await raw.close();
});
test("actual Unicode replace succeeds exactly once and audit excludes raw content", async (t) => {
  const f = await fixture(t); const p = f.proposal({ content: "中文\nnew" }); const permit = f.permit(p);
  const result = await f.mutation.execute(p, permit);
  assert.equal(result.status, "written"); assert.equal(result.observedMutation, true);
  assert.equal(await f.mutation.readFile("BACKEND\\A.TXT"), p.content);
  assert.equal((await f.mutation.execute(p, permit)).status, "denied");
  const events = await f.mutation.events(); assert.deepEqual(events.map((e) => e.kind), ["mutation_intent", "mutation_success"]);
  assert.ok(!JSON.stringify(events).includes(p.content));
});
test("proposal content/target/identity changes consume failed permit and prevent replay", async (t) => {
  const f = await fixture(t);
  for (const extra of [{ content: "changed" }, { resource: "backend/b.txt" },
    { session: new AgentSession({ ...f.session }) }]) {
    const p = f.proposal(); const permit = f.permit(p);
    assert.equal((await f.mutation.execute(f.proposal(extra), permit)).status, "denied");
    assert.equal((await f.mutation.execute(p, permit)).status, "denied");
  }
});
test("version/task/boundary roundtrip permanently revoke permit", async (t) => {
  const f = await fixture(t);
  const changes = [() => { f.authority.updateVersion("v4"); f.authority.updateVersion("v3"); },
    () => { f.authority.setTaskStatus("task", "cancelled"); f.authority.setTaskStatus("task", "active"); },
    () => { f.authority.updateBoundary(new RoleBoundary({ ...f.boundary, denyScope: ["backend/"] })); f.authority.updateBoundary(f.boundary); }];
  for (const change of changes) {
    const p = f.proposal(); const permit = f.permit(p); change();
    assert.equal((await f.mutation.execute(p, permit)).status, "denied");
  }
});
test("mutation failure reports failed with an actual audited failure and cleans temporary", async (t) => {
  const f = await fixture(t); const p = f.proposal();
  t.mock.method(nodeFs, "renameSync", () => { throw Object.assign(new Error("controlled IO failure"), { code: "EACCES" }); });
  const result = await f.mutation.execute(p, f.permit(p));
  assert.equal(result.status, "failed"); assert.equal(result.observedMutation, false);
  assert.equal((await f.mutation.events()).at(-1).kind, "mutation_failure");
  assert.deepEqual(await fs.readdir(join(f.workspace, "backend")), []);
});
test("rights changed during awaited intent audit are rechecked before target creation", async (t) => {
  const f = await fixture(t); const p = f.proposal(); const permit = f.permit(p);
  const open = fs.open; let changed = false;
  t.mock.method(fs, "open", async (...args) => {
    const handle = await open(...args);
    if (!changed && String(args[0]).endsWith(".jsonl")) { changed = true; f.authority.updateVersion("v4"); }
    return handle;
  });
  const result = await f.mutation.execute(p, permit);
  assert.equal(result.status, "denied"); assert.equal(result.reason, "authorization_changed");
  await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
});
test("approval aliases and control planes remain denied even forged decision to authority", async (t) => {
  const f = await fixture(t);
  f.authority.updateBoundary(new RoleBoundary({ ...f.boundary, requiredApprovals: ["backend/approved.txt"] }));
  const changed = f.authority.boundary("Backend");
  for (const resource of ["BACKEND\\APPROVED.TXT", ".ans/organization/x", ".GIT/x", ".agents/x", ".codex/x", ".aws/x", "../x"]) {
    const p = f.proposal({ resource });
    assert.throws(() => f.authority.issue(p, new PolicyDecision({ outcome: Outcome.ALLOW, reason: "forged",
      proposalDigest: p.digest, organizationVersion: "v3", boundaryDigest: changed.digest })), TypeError);
  }
});
test("junction metadata rejects target and workspace root, actual link where host allows", async (t) => {
  const f = await fixture(t); const outside = await fs.mkdtemp(join(tmpdir(), "legion-outside-"));
  t.after(() => fs.rm(outside, { recursive: true }));
  let actual = true;
  try { await fs.symlink(outside, join(f.workspace, "backend"), "junction"); }
  catch (error) {
    if (error.code !== "EPERM") throw error;
    actual = false;
    t.diagnostic("Host denies junction creation (EPERM); controlled lstat metadata exercises the actual guard, no skip.");
    await fs.mkdir(join(f.workspace, "backend"));
    const lstat = fs.lstat;
    t.mock.method(fs, "lstat", async (path, ...args) => {
      if (String(path).toLowerCase() === join(f.workspace, "backend").toLowerCase()) {
        return { isSymbolicLink: () => true, isDirectory: () => true, isFile: () => false };
      }
      return await lstat(path, ...args);
    });
  }
  const p = f.proposal(); assert.equal((await f.mutation.execute(p, f.permit(p))).status, "denied");
  assert.deepEqual(await fs.readdir(outside), []);
  if (actual) assert.throws(() => createStorageProvider({ workspace: join(f.workspace, "backend") }), /invalid_workspace/);
  else {
    const lstat = fs.lstat;
    t.mock.method(fs, "lstat", async (path, ...args) => {
      if (String(path).toLowerCase() === f.workspace.toLowerCase()) {
        return { isSymbolicLink: () => true, isDirectory: () => true, isFile: () => false };
      }
      return await lstat(path, ...args);
    });
    await assert.rejects(f.mutation.readFile("backend/a.txt"), /read_failed/);
  }
});

async function workbenchFixture(t, { emptyContext = false } = {}) {
  const workspace = await fs.mkdtemp(join(tmpdir(), "legion-context-"));
  const root = await fs.lstat(workspace, { bigint: true });
  const workspaceIdentity = { canonicalPath: nodeFs.realpathSync(workspace), deviceId: String(root.dev), fileId: String(root.ino) };
  await fs.mkdir(join(workspace, "inputs"));
  const input = join(workspace, "inputs/input.txt");
  await fs.writeFile(input, "old", "utf8");
  const boundary = new RoleBoundary({ roleId: "Implementer", writeScope: ["backend/"],
    capabilities: ["write_file"], tools: ["legion_write_file"] });
  const kernelOwners = makeTestOwners("Implementer", ["backend/a.txt", "backend/b.txt"]);
  const { controller, mutationAuthority } = createWorkbenchAuthority({ fileOwners: kernelOwners, workspaceIdentity,
    organizationVersion: "v4", profileVersion: "profile1", boundaries: [boundary] });
  const contextReadSet = [];
  const files = [];
  if (!emptyContext) {
    contextReadSet.push("inputs/input.txt");
    files.push({ resource: "inputs/input.txt", byteLength: 3,
      sha256: createHash("sha256").update("old").digest("hex") });
  }
  const confirmation = new ContextReadConfirmation({ confirmationId: "read", workspaceIdentity,
    organizationVersion: "v4", profileVersion: "profile1", contextReadSet });
  const readAuthorization = controller.confirmContextRead(confirmation);
  const snapshot = new ContextSnapshot({ confirmationDigest: confirmation.digest, workspaceIdentity,
    organizationVersion: "v4", profileVersion: "profile1", files });
  controller.bindContextSnapshot(readAuthorization, snapshot);
  const grant = new ConfirmedTaskGrant({ confirmationId: "execute", workspaceIdentity,
    organizationVersion: "v4", profileVersion: "profile1", roleId: "Implementer", taskId: "task",
    planDigest: "a".repeat(64), contextSnapshotDigest: snapshot.digest,
    fileOwnersDigest: kernelOwners.digest, ownerGeneration: kernelOwners.version, tools: ["legion_write_file"] });
  const session = new AgentSession({ sessionId: "s", roleId: "Implementer", taskId: "task", organizationVersion: "v4" });
  const dispatchContext = new TaskDispatchContext({ roleId: "Implementer", taskId: "task", organizationVersion: "v4",
    fileOwnersDigest: kernelOwners.digest, ownerGeneration: kernelOwners.version, tools: grant.tools });
  controller.registerInstance({ taskApproval: controller.confirmTask(grant), instanceId: "i", session,
    dispatchContext, scope: new AgentScope({ write: kernelOwners.owners.map(item => item.resource), tools: grant.tools }) });
  controller.beginRun("i", "run");
  const mutation = createMutationService({ workspace, authority: mutationAuthority, leaseContext: testLeaseContext(workspace, kernelOwners) });
  function proposal(resource = "backend/a.txt") {
    return new ActionProposal({ proposalId: resource, action: "write_file", resource, content: "new-output",
      tool: "legion_write_file", capability: "write_file", session, runId: "run" });
  }
  function permit(p = proposal()) {
    return controller.issue(p, new PolicyDecision({ outcome: Outcome.ALLOW, reason: "bound_allow",
      proposalDigest: p.digest, organizationVersion: "v4", boundaryDigest: boundary.digest }));
  }
  t.after(async () => { t.mock.restoreAll(); await mutation.close(); await fs.rm(workspace, { recursive: true }); });
  return { workspace, input, workspaceIdentity, controller, mutationAuthority, readAuthorization,
    mutation, proposal, permit };
}

function assertFixturePath(path) {
  const remainder = relative(resolve(tmpdir()), resolve(path));
  assert.equal(isAbsolute(remainder), false);
  assert.notEqual(remainder, "");
  assert.notEqual(remainder, "..");
  assert.equal(remainder.startsWith("..\\") || remainder.startsWith("../"), false);
}

test("branded workbench verifies real context and releases successful receipts for further task writes", async (t) => {
  const f = await workbenchFixture(t);
  for (const resource of ["backend/a.txt", "BACKEND\\B.TXT"]) {
    const p = f.proposal(resource);
    assert.equal((await f.mutation.execute(p, f.permit(p))).status, "written");
    assert.equal(await f.mutation.readFile(resource), p.content);
  }
  assert.equal((await f.mutation.events()).filter((event) => event.kind === "mutation_success").length, 2);
  assert.throws(() => createMutationService({ workspace: f.workspace, authority: { ...f.mutationAuthority } }), /branded/);
  assert.throws(() => createMutationService({ workspace: f.workspace, authority: f.mutationAuthority,
    _authority: {} }), /conflict/);
});

test("same-size content change with restored mtime rejects SHA and permanently revokes all pending permits", async (t) => {
  const f = await workbenchFixture(t); const p = f.proposal(); const pending = f.permit(p);
  const stat = await fs.stat(f.input);
  await fs.writeFile(f.input, "NEW"); await fs.utimes(f.input, stat.atime, stat.mtime);
  const result = await f.mutation.execute(p, f.permit(p));
  assert.equal(result.status, "denied"); assert.equal(result.reason, "context_changed");
  await fs.writeFile(f.input, "old"); await fs.utimes(f.input, stat.atime, stat.mtime);
  assert.equal((await f.mutation.execute(p, pending)).status, "denied");
  assert.throws(() => f.permit(p), /revoked/);
  assert.throws(() => ContextReadConfirmation.assertForRead(f.readAuthorization, {
    workspaceIdentity: f.workspaceIdentity, organizationVersion: "v4", profileVersion: "profile1",
    resources: ["inputs/input.txt"] }), /authorization/);
  await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
});

test("actual root directory replacement and restoration do not revive confirmation", async (t) => {
  const f = await workbenchFixture(t); const p = f.proposal(); const permit = f.permit(p);
  const backup = f.workspace + "-original";
  assertFixturePath(backup);
  await fs.rename(f.workspace, backup); await fs.mkdir(f.workspace);
  try {
    const result = await f.mutation.execute(p, permit);
    assert.equal(result.status, "denied"); assert.equal(result.reason, "root_identity_changed");
    assert.deepEqual(await fs.readdir(f.workspace), []);
  } finally {
    await fs.rmdir(f.workspace); await fs.rename(backup, f.workspace);
  }
  assert.throws(() => f.permit(p), /revoked/);
  await assert.rejects(fs.stat(join(f.workspace, "backend/a.txt")), { code: "ENOENT" });
});

test("context byte growth and removal reject before target effects", async (t) => {
  for (const change of ["grow", "remove"]) {
    const f = await workbenchFixture(t); const p = f.proposal(); const permit = f.permit(p);
    if (change === "grow") await fs.writeFile(f.input, "longer");
    else await fs.unlink(f.input);
    const result = await f.mutation.execute(p, permit);
    assert.equal(result.status, "denied"); assert.equal(result.reason, "context_changed");
    assert.throws(() => f.permit(p), /revoked/);
    await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
  }
});

test("context IO verification unavailable permanently invalidates authority, not just local Provider", async (t) => {
  const f = await workbenchFixture(t); const p = f.proposal(); const permit = f.permit(p);
  const openSync = nodeFs.openSync;
  t.mock.method(nodeFs, "openSync", (path, ...args) => {
    if (String(path) === f.input) throw Object.assign(new Error("controlled context permission"), { code: "EACCES" });
    return openSync(path, ...args);
  });
  const result = await f.mutation.execute(p, permit);
  assert.equal(result.status, "denied"); assert.equal(result.reason, "verification_unavailable");
  t.mock.restoreAll();
  assert.throws(() => f.permit(p), /revoked/);
});

test("context change during intent audit is refused before target directory creation", async (t) => {
  const f = await workbenchFixture(t); const p = f.proposal(); const permit = f.permit(p);
  const open = fs.open; let changed = false;
  t.mock.method(fs, "open", async (...args) => {
    const handle = await open(...args);
    if (!changed && String(args[0]).endsWith(".jsonl")) {
      changed = true; await fs.writeFile(f.input, "NEW");
    }
    return handle;
  });
  const result = await f.mutation.execute(p, permit);
  assert.equal(result.status, "denied"); assert.equal(result.reason, "context_changed");
  assert.equal(result.observedMutation, false);
  assert.equal((await f.mutation.events()).at(-1).kind, "mutation_failure");
  assert.throws(() => f.permit(p), /revoked/);
  await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
});

test("context change after temporary creation is rechecked before sync commit", async (t) => {
  const f = await workbenchFixture(t); const p = f.proposal(); const permit = f.permit(p);
  const open = fs.open;
  t.mock.method(fs, "open", async (...args) => {
    const handle = await open(...args);
    if (String(args[0]).includes(".legion-write-")) await fs.writeFile(f.input, "NEW");
    return handle;
  });
  const result = await f.mutation.execute(p, permit);
  assert.equal(result.status, "denied"); assert.equal(result.reason, "context_changed");
  assert.equal(result.observedMutation, false);
  assert.deepEqual(await fs.readdir(join(f.workspace, "backend")), []);
  assert.throws(() => f.permit(p), /revoked/);
});

test("context junction is refused; EPERM fallback is explicitly injected synchronous lstat metadata", async (t) => {
  const f = await workbenchFixture(t); const p = f.proposal(); const permit = f.permit(p);
  const outside = await fs.mkdtemp(join(tmpdir(), "legion-context-link-"));
  t.after(() => fs.rm(outside, { recursive: true }));
  const directory = join(f.workspace, "inputs");
  assertFixturePath(directory); assertFixturePath(outside);
  await fs.writeFile(join(outside, "input.txt"), "old");
  await fs.unlink(f.input); await fs.rmdir(directory);
  try { await fs.symlink(outside, directory, "junction"); }
  catch (error) {
    if (error.code !== "EPERM") throw error;
    t.diagnostic("EPERM: this context link stimulus is injected lstat metadata, not native junction/reparse E2E.");
    await fs.mkdir(directory); await fs.writeFile(f.input, "old");
    const lstatSync = nodeFs.lstatSync;
    t.mock.method(nodeFs, "lstatSync", (path, ...args) => {
      if (String(path) === directory) return { isSymbolicLink: () => true, isDirectory: () => true };
      return lstatSync(path, ...args);
    });
  }
  const result = await f.mutation.execute(p, permit);
  assert.equal(result.status, "denied"); assert.equal(result.reason, "context_changed");
  assert.equal(await fs.readFile(join(outside, "input.txt"), "utf8"), "old");
  assert.throws(() => f.permit(p), /revoked/);
});

test("workbench preserves intent fail-closed and post-commit audit failure observedMutation", async (t) => {
  for (const stage of ["intent", "result"]) {
    const f = await workbenchFixture(t); const p = f.proposal(); const permit = f.permit(p);
    const open = fs.open; let auditOpens = 0;
    t.mock.method(fs, "open", async (...args) => {
      if (String(args[0]).endsWith(".jsonl")) {
        auditOpens += 1;
        if (stage === "intent" || auditOpens > 2) throw Object.assign(new Error("controlled audit failure"), { code: "EACCES" });
      }
      return await open(...args);
    });
    const result = await f.mutation.execute(p, permit);
    assert.equal(result.status, "audit_failed"); assert.equal(result.auditFailed, true);
    assert.equal(result.observedMutation, stage === "result");
    if (stage === "result") assert.equal(await fs.readFile(join(f.workspace, "backend/a.txt"), "utf8"), p.content);
    else await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
    assert.equal((await f.mutation.execute(p, f.permit(p))).status, "audit_failed");
    t.mock.restoreAll();
  }
});

test("empty context still synchronously rechecks output parent links after final awaited target inspection", async (t) => {
  const f = await workbenchFixture(t, { emptyContext: true }); const p = f.proposal();
  const open = fs.open; const lstat = fs.lstat; const lstatSync = nodeFs.lstatSync;
  let temporaryOpened = false; let lateParentLink = false; let synchronousGuardObserved = false;
  t.mock.method(fs, "open", async (...args) => {
    const handle = await open(...args);
    if (String(args[0]).includes(".legion-write-")) temporaryOpened = true;
    return handle;
  });
  t.mock.method(fs, "lstat", async (path, ...args) => {
    let value;
    try { value = await lstat(path, ...args); }
    catch (error) {
      if (error.code !== "ENOENT") throw error;
      if (temporaryOpened && String(path) === join(f.workspace, "backend/a.txt")) lateParentLink = true;
      throw error;
    }
    return value;
  });
  t.mock.method(nodeFs, "lstatSync", (path, ...args) => {
    if (lateParentLink && String(path) === join(f.workspace, "backend")) {
      synchronousGuardObserved = true;
      return { isSymbolicLink: () => true, isDirectory: () => true };
    }
    return lstatSync(path, ...args);
  });
  t.diagnostic("Timing regression uses controlled lstat metadata after the last awaited target inspection; not native junction E2E.");
  const result = await f.mutation.execute(p, f.permit(p));
  assert.equal(synchronousGuardObserved, true);
  assert.equal(result.status, "denied"); assert.equal(result.reason, "unsafe_target");
  assert.equal(result.observedMutation, false);
  assert.deepEqual(await fs.readdir(join(f.workspace, "backend")), []);
});

test("persistent owner re-read rejects a transfer after intent and before actual commit", async (t) => {
  const f = await fixture(t);
  const context = testLeaseContext(f.workspace, kernelOwners);
  const catalogPath = join(context.leaseRoot, "../catalog/workbench-projects.json");
  const originalOpen = fs.open;
  let lockObserved = false;
  t.mock.method(fs, "open", async (path, ...args) => {
    const handle = await originalOpen(path, ...args);
    if (String(path).includes(".legion-write-")) {
      const leaseName = nodeFs.readdirSync(context.leaseRoot).find(name => /^[a-f0-9]{64}$/.test(name));
      lockObserved = nodeFs.existsSync(join(context.leaseRoot, leaseName, "commit.lock"));
      const document = JSON.parse(nodeFs.readFileSync(catalogPath, "utf8"));
      document.projects[0].fileOwners = makeTestOwners("Other", kernelOwners.owners.map(item => item.resource), "2");
      nodeFs.writeFileSync(catalogPath, JSON.stringify(document));
    }
    return handle;
  });
  const proposal = f.proposal();
  const result = await f.mutation.execute(proposal, f.permit(proposal));
  assert.equal(result.success, false); assert.equal(result.observedMutation, false);
  assert.equal(result.reason, "authorization_changed"); assert.equal(lockObserved, true);
  await assert.rejects(fs.stat(join(f.workspace, proposal.resource)), error => error.code === "ENOENT");
  const leases = nodeFs.readdirSync(context.leaseRoot).filter(name => /^[a-f0-9]{64}$/.test(name));
  assert.equal(leases.length, 1); assert.equal(nodeFs.existsSync(join(context.leaseRoot, leases[0], "commit.lock")), false);
});

test("absent lease context and old IO callbacks never authorize source writes", async (t) => {
  const f = await fixture(t);
  assert.throws(() => createMutationService({ workspace: f.workspace, _authority: f.authority, ownerGuard: { run: operation => operation(), assertCurrent: async () => true } }), /unknown field ownerGuard/);
  const mutation = createMutationService({ workspace: f.workspace, _authority: f.authority }); t.after(() => mutation.close());
  const p = f.proposal(); const result = await mutation.execute(p, f.permit(p));
  assert.equal(result.success, false); assert.equal(result.observedMutation, false); assert.equal(result.reason, "lease_context_required");
  await assert.rejects(fs.stat(join(f.workspace, p.resource)), error => error.code === "ENOENT");
});

test("holder replacement and immutable owner marker changes fail closed", async (t) => {
  for (const target of ["holder", "marker"]) {
    const f = await fixture(t); const context = testLeaseContext(f.workspace, kernelOwners);
    const key = nodeFs.readdirSync(context.leaseRoot).find(name => /^[a-f0-9]{64}$/.test(name));
    let path = join(context.leaseRoot, key, "holder");
    if (target === "marker") path = join(context.leaseRoot, key + ".owner-source.json");
    const original = nodeFs.readFileSync(path);
    nodeFs.renameSync(path, path + ".prior"); nodeFs.writeFileSync(path, original, { mode: 0o600, flag: "wx" });
    const p = f.proposal(); const result = await f.mutation.execute(p, f.permit(p));
    assert.equal(result.success, false); assert.equal(result.observedMutation, false);
    await assert.rejects(fs.stat(join(f.workspace, p.resource)), error => error.code === "ENOENT");
    assert.equal(nodeFs.existsSync(join(context.leaseRoot, key, "commit.lock")), false);
  }
});

test("shared commit mutex waits for another writer and releases only its own inode", async (t) => {
  const f = await fixture(t); const context = testLeaseContext(f.workspace, kernelOwners);
  const key = nodeFs.readdirSync(context.leaseRoot).find(name => /^[a-f0-9]{64}$/.test(name));
  const path = join(context.leaseRoot, key, "commit.lock");
  nodeFs.writeFileSync(path, "external writer", { flag: "wx", mode: 0o600 });
  let settled = false; const p = f.proposal();
  const operation = f.mutation.execute(p, f.permit(p)).then(result => { settled = true; return result; });
  await new Promise(resolveWait => setTimeout(resolveWait, 40));
  assert.equal(settled, false); assert.equal(nodeFs.readFileSync(path, "utf8"), "external writer");
  nodeFs.unlinkSync(path);
  const result = await operation;
  assert.equal(result.success, true); assert.equal(nodeFs.existsSync(path), false);
});

test("final locked owner check rejects schema rollback with identical owners and generation", async (t) => {
  for (const rollback of ["catalog", "project", "plan-writeSet", "task-writeSet"]) {
    const f = await fixture(t); const context = testLeaseContext(f.workspace, kernelOwners);
    const catalogPath = join(context.leaseRoot, "../catalog/workbench-projects.json");
    const originalDocument = nodeFs.readFileSync(catalogPath, "utf8");
    const p = f.proposal(); const permit = f.permit(p);
    const originalOpen = fs.open; let changed = false; let lockObserved = false;
    t.mock.method(fs, "open", async (path, ...args) => {
      const handle = await originalOpen(path, ...args);
      if (String(path).includes(".legion-write-") && !changed) {
        changed = true;
        const key = nodeFs.readdirSync(context.leaseRoot).find(name => /^[a-f0-9]{64}$/.test(name));
        lockObserved = nodeFs.existsSync(join(context.leaseRoot, key, "commit.lock"));
        const document = JSON.parse(originalDocument); const project = document.projects[0];
        if (rollback === "catalog") document.schemaVersion = 1;
        if (rollback === "project") project.schemaVersion = 1;
        if (rollback === "plan-writeSet") project.plan = { schemaVersion: 2, tasks: [{ id: "old", writeSet: [p.resource] }] };
        if (rollback === "task-writeSet") project.tasks = [{ id: "old", status: "running", writeSet: [p.resource] }];
        assert.deepEqual(project.fileOwners, JSON.parse(originalDocument).projects[0].fileOwners);
        nodeFs.writeFileSync(catalogPath, JSON.stringify(document));
      }
      return handle;
    });
    const result = await f.mutation.execute(p, permit);
    assert.equal(changed, true); assert.equal(lockObserved, true);
    assert.equal(result.success, false); assert.equal(result.observedMutation, false);
    assert.equal(result.status, "denied"); assert.equal(result.reason, "authorization_changed");
    await assert.rejects(fs.stat(join(f.workspace, p.resource)), error => error.code === "ENOENT");
    assert.deepEqual(await fs.readdir(join(f.workspace, "backend")), []);
    nodeFs.writeFileSync(catalogPath, originalDocument);
    assert.throws(() => f.permit(p), /file_ownership_revoked/);
    t.mock.restoreAll();
  }
});

test("legacyHistory writeSet remains read-only history and cannot invalidate current schema2 writes", async (t) => {
  const f = await fixture(t); const context = testLeaseContext(f.workspace, kernelOwners);
  const catalogPath = join(context.leaseRoot, "../catalog/workbench-projects.json");
  const document = JSON.parse(nodeFs.readFileSync(catalogPath, "utf8"));
  document.projects[0].legacyHistory = [{ schemaVersion: 1, plan: { tasks: [{ writeSet: ["foreign/a.txt"] }] }, tasks: [{ writeSet: ["foreign/a.txt"] }] }];
  nodeFs.writeFileSync(catalogPath, JSON.stringify(document));
  const p = f.proposal(); const result = await f.mutation.execute(p, f.permit(p));
  assert.equal(result.success, true); assert.equal(result.observedMutation, true);
  assert.equal(await fs.readFile(join(f.workspace, p.resource), "utf8"), p.content);
  assert.deepEqual(JSON.parse(nodeFs.readFileSync(catalogPath, "utf8")).projects[0].legacyHistory, document.projects[0].legacyHistory);
});
