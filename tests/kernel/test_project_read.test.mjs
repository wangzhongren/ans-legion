import { makeTestOwners, testLeaseContext } from "./test_control_memory.test.mjs";
const kernelOwners = makeTestOwners("Backend", ["src/out.txt"]);
import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
function tmpdir() {
  const path = fileURLToPath(new URL("../../.ans/runtime/legion-cli-role-owned-v2/KernelEngineer/tmp/", import.meta.url));
  mkdirSync(path, { recursive: true });
  return path;
}
import { createHash } from "node:crypto";
import { createReadService } from "../../src/kernel/services/public/read.mjs";
import { createPolicyService } from "../../src/kernel/services/public/policy.mjs";
import { RoleBoundary, AgentSession, _createRuntimeAuthority } from "../../src/kernel/models/core.mjs";
import { AgentScope, TaskDispatchContext, ProjectReadRequest, ProjectReadDecision,
  ProjectReadResult, PiToolRequest, PiToolResult } from "../../src/kernel/models/agent.mjs";
import { ConfirmedTaskGrant } from "../../src/kernel/models/workbench.mjs";

function request(tool, resource, extra = {}) {
  return new ProjectReadRequest({ requestId: "request", runId: "run", tool, resource, ...extra });
}
async function fixture(t) {
  const workspace = await fs.mkdtemp(join(tmpdir(), "legion-project-read-"));
  await fs.mkdir(join(workspace, "src"));
  await fs.writeFile(join(workspace, "src", "a.txt"), "first\nsecond\nthird\n");
  await fs.writeFile(join(workspace, "package.json"), '{"name":"example"}\n');
  const read = createReadService({ workspace: await fs.realpath(workspace) });
  t.after(async () => { await read.close(); await fs.rm(workspace, { recursive: true, force: true }); });
  return { workspace, read };
}

test("project read Model remains distinct from write permits and tool payloads", () => {
  const list = new PiToolRequest({ requestId: "q", runId: "run", toolCallId: "sdk", tool: "legion_list_files",
    parameters: { resource: "", limit: 10 } });
  assert.deepEqual(list.parameters, { resource: "", cursor: "", limit: 10 });
  const file = new PiToolRequest({ requestId: "f", runId: "run", toolCallId: "sdk", tool: "legion_read_file",
    parameters: { resource: "src/a.txt", startLine: 2, maxBytes: 100 } });
  assert.deepEqual(file.parameters, { resource: "src/a.txt", startLine: 2, maxBytes: 100 });
  const result = new PiToolResult({ requestId: "q", runId: "run",
    decision: new ProjectReadDecision({ allowed: true, reason: "within_project_read_scope" }),
    result: new ProjectReadResult({ status: "listed", reason: "listed", entries: [] }) });
  assert.equal(result.result.status, "listed");
  assert.throws(() => new ProjectReadRequest({ requestId: "q", runId: "run", tool: "legion_list_files",
    limit: 201 }), /read_budget/);
  assert.throws(() => new ProjectReadRequest({ requestId: "q", runId: "run", tool: "legion_read_file",
    resource: "a.txt", maxBytes: 65537 }), /read_budget/);
});

test("PM project read authorization works without a write grant and rejects stale run", () => {
  const tools = ["legion_list_files", "legion_read_file"];
  const boundary = new RoleBoundary({ roleId: "ProjectManager", readScope: ["."], tools,
    capabilities: ["read_project"] });
  const dispatchContext = new TaskDispatchContext({ roleId: "ProjectManager", taskId: "discussion",
    organizationVersion: "v1", fileOwnersDigest: kernelOwners.digest, ownerGeneration: kernelOwners.version, tools });
  const scope = new AgentScope({ write: [], tools });
  const policy = createPolicyService();
  assert.deepEqual(policy.validateScope(boundary, dispatchContext, scope, kernelOwners).write, []);
  const session = new AgentSession({ sessionId: "pm", roleId: "ProjectManager", taskId: "discussion",
    organizationVersion: "v1" });
  const authority = _createRuntimeAuthority({ fileOwners: kernelOwners, boundaries: [boundary], organizationVersion: "v1" });
  authority.registerInstance({ instanceId: "pm-instance", session, dispatchContext, scope });
  const instance = authority.beginRun("pm-instance", "run");
  const context = { boundary, session, trustedSession: session, currentVersion: "v1", instance, dispatchContext };
  assert.equal(policy.evaluateRead(request("legion_list_files", ""), context).allowed, true);
  assert.equal(policy.evaluateRead(request("legion_read_file", "src/a.txt"), context).allowed, true);
  assert.equal(policy.evaluateRead(request("legion_read_file", "../outside"), context).reason, "unsafe_resource");
  assert.equal(policy.evaluateRead(new ProjectReadRequest({ requestId: "q", runId: "old",
    tool: "legion_read_file", resource: "src/a.txt" }), context).reason, "instance_or_run_changed");
  assert.equal(policy.evaluateRead(request("legion_read_file", "src/a.txt"),
    { ...context, instance: authority.finishRun("pm-instance", "closed") }).allowed, false);
  assert.throws(() => policy.validateScope(new RoleBoundary({ roleId: "ProjectManager", tools,
    capabilities: ["read_project"] }), dispatchContext, scope, kernelOwners), /missing_project_read_grant/);
});

test("read-enabled confirmed task retains exact write grant", () => {
  const tools = ["legion_write_file", "legion_list_files", "legion_read_file"];
  const confirmed = new ConfirmedTaskGrant({ confirmationId: "human", workspaceIdentity: {
    canonicalPath: "/tmp/project", deviceId: "1", fileId: "2" }, planDigest: "a".repeat(64),
  organizationVersion: "v1", roleId: "Backend", taskId: "task", fileOwnersDigest: kernelOwners.digest, ownerGeneration: kernelOwners.version, tools,
  profileVersion: "profile", contextSnapshotDigest: "b".repeat(64) });
  assert.deepEqual(confirmed.tools, tools);
  const boundary = new RoleBoundary({ roleId: "Backend", readScope: ["."], writeScope: ["src/out.txt"],
    capabilities: ["read_project", "write_file"], tools });
  const dispatchContext = new TaskDispatchContext({ roleId: "Backend", taskId: "task", organizationVersion: "v1",
    fileOwnersDigest: kernelOwners.digest, ownerGeneration: kernelOwners.version, tools });
  const scope = new AgentScope({ write: ["src/out.txt"], tools });
  assert.deepEqual(createPolicyService().validateScope(boundary, dispatchContext, scope, kernelOwners).write, ["src/out.txt"]);
  assert.throws(() => createPolicyService().validateScope(boundary, dispatchContext,
    new AgentScope({ write: ["src/other.txt"], tools }), kernelOwners), /complete_role_owner_scope_required/);
  assert.throws(() => new ConfirmedTaskGrant({ ...confirmed, tools: ["legion_write_file", "legion_read_file"] }),
    /confirmed_execution_write_tool_required/);
});

test("safe service lists ordinary files and reads bounded line segments", async (t) => {
  const { read } = await fixture(t);
  const first = await read.listFiles(request("legion_list_files", "", { limit: 1 }));
  assert.equal(first.status, "listed"); assert.equal(first.entries.length, 1); assert.notEqual(first.nextCursor, "");
  const second = await read.listFiles(request("legion_list_files", "", { cursor: first.nextCursor, limit: 1 }));
  assert.equal(second.status, "listed"); assert.notEqual(second.entries[0].name, first.entries[0].name);
  const part = await read.readFile(request("legion_read_file", "src/a.txt", { maxBytes: 7 }));
  assert.equal(part.status, "read"); assert.equal(part.text, "first\n"); assert.equal(part.nextLine, 2);
  const rest = await read.readFile(request("legion_read_file", "src/a.txt", { startLine: 2 }));
  assert.equal(rest.text, "second\nthird\n"); assert.equal(rest.complete, true);
  const completeSha = createHash("sha256").update("first\nsecond\nthird\n", "utf8").digest("hex");
  assert.equal(part.sha256, completeSha);
  assert.equal(rest.sha256, completeSha);
  assert.equal((await read.readFile(request("legion_read_file", "src/a.txt", { startLine: 9 }))).reason,
    "start_line_out_of_range");
});

test("safe service rejects control paths, links, binary, oversized and changed root", async (t) => {
  const { workspace, read } = await fixture(t);
  for (const name of [".git", ".ans", ".aws", ".agents", ".codex", "nested"]) {
    await fs.mkdir(join(workspace, name));
    await fs.writeFile(join(workspace, name, "hidden.txt"), "secret");
  }
  for (const name of [".env", ".env.local", "private.pem", "id_ed25519"]) {
    await fs.writeFile(join(workspace, name), "secret");
  }
  await fs.mkdir(join(workspace, "nested", ".git"));
  await fs.writeFile(join(workspace, "nested", ".git", "config"), "secret");
  await fs.writeFile(join(workspace, "binary.bin"), Buffer.from([0, 1, 2]));
  await fs.writeFile(join(workspace, "large.txt"), "x".repeat(2097153));
  await fs.symlink(join(workspace, "src"), join(workspace, "link"));
  const listed = await read.listFiles(request("legion_list_files", ""));
  assert.equal(listed.status, "listed");
  for (const name of [".git", ".ans", ".aws", ".agents", ".codex", ".env", ".env.local",
    "private.pem", "id_ed25519", "link"]) assert.ok(!listed.entries.some((entry) => entry.name === name));
  for (const path of [".git/hidden.txt", ".ans/hidden.txt", ".aws/hidden.txt", ".agents/hidden.txt",
    ".codex/hidden.txt", "nested/.git/config", ".env", ".env.local", "private.pem",
    "id_ed25519", "link/a.txt", "../outside", "/tmp/outside"]) {
    const result = await read.readFile(request("legion_read_file", path));
    assert.equal(result.status, "denied", path);
    assert.equal(result.text, "", path);
  }
  assert.equal((await read.readFile(request("legion_read_file", "binary.bin"))).reason, "binary_file");
  assert.equal((await read.readFile(request("legion_read_file", "large.txt"))).reason, "file_too_large");
  const moved = workspace + "-moved";
  await fs.rename(workspace, moved);
  try {
    await fs.mkdir(workspace);
    assert.equal((await read.listFiles(request("legion_list_files", ""))).reason, "root_identity_changed");
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
    await fs.rename(moved, workspace);
  }
});

test("credential files and directories are omitted from listings and denied by direct read", async (t) => {
  const { workspace, read } = await fixture(t);
  await fs.mkdir(join(workspace, "nested"));
  for (const name of [".npmrc", ".NETRC", "_netrc", ".pypirc", ".git-credentials"]) {
    await fs.writeFile(join(workspace, name), "fake-test-token");
  }
  for (const name of [".ssh", ".docker", ".kube", ".gnupg", ".azure", ".gcloud",
    ".terraform", ".terraform.d"]) {
    await fs.mkdir(join(workspace, name));
    await fs.writeFile(join(workspace, name, "config"), "fake-test-token");
  }
  await fs.writeFile(join(workspace, "nested", ".NpMrC"), "fake-test-token");
  await fs.mkdir(join(workspace, "nested", ".DoCkEr"));
  await fs.writeFile(join(workspace, "nested", ".DoCkEr", "config.json"), "fake-test-token");
  await fs.writeFile(join(workspace, "nested", "notes.md"), "ordinary text\n");
  const root = await read.listFiles(request("legion_list_files", ""));
  assert.equal(root.status, "listed");
  for (const name of [".npmrc", ".NETRC", "_netrc", ".pypirc", ".git-credentials", ".ssh",
    ".docker", ".kube", ".gnupg", ".azure", ".gcloud", ".terraform", ".terraform.d"]) {
    assert.ok(!root.entries.some((entry) => entry.name === name), name);
  }
  const nested = await read.listFiles(request("legion_list_files", "nested"));
  assert.deepEqual(nested.entries.map((entry) => entry.name), ["notes.md"]);
  for (const path of [".npmrc", ".NETRC", "_netrc", ".pypirc", ".git-credentials",
    ".ssh/config", ".docker/config", ".kube/config", ".gnupg/config", ".azure/config",
    ".gcloud/config", ".terraform/config", ".terraform.d/config", "nested\\.NpMrC",
    "nested/.DoCkEr/config.json"]) {
    const result = await read.readFile(request("legion_read_file", path));
    assert.equal(result.status, "denied", path);
    assert.equal(result.reason, "restricted_resource", path);
    assert.equal(result.text, "", path);
  }
  assert.equal((await read.readFile(request("legion_read_file", "nested/notes.md"))).text, "ordinary text\n");
  assert.equal((await read.readFile(request("legion_read_file", "package.json"))).status, "read");
});

test("front and background Su actually read other-role ordinary files while Restricted and links remain denied", async (t) => {
  const f = await fixture(t);
  await fs.mkdir(join(f.workspace, ".ans")); await fs.writeFile(join(f.workspace, ".ans", "private.json"), "private");
  await fs.writeFile(join(f.workspace, ".env"), "fixture-secret");
  await fs.symlink(join(f.workspace, "src/a.txt"), join(f.workspace, "src/link.txt"));
  const owners = new (kernelOwners.constructor)({ projectId: "read-fixture", version: "owners-1", owners: [
    { resource: "src/a.txt", roleId: "Backend" }, { resource: "package.json", roleId: "Frontend" }] });
  const tools = ["legion_list_files", "legion_read_file"];
  const boundary = new RoleBoundary({ roleId: "Supervisor", readScope: ["."], tools, capabilities: ["read_project"] });
  const policy = createPolicyService();
  for (const channel of ["su_customer", "supervision_preflight", "supervision_monitor"]) {
    const session = new AgentSession({ sessionId: channel, roleId: "Supervisor", taskId: channel, organizationVersion: "v2" });
    const dispatchContext = new TaskDispatchContext({ roleId: "Supervisor", taskId: channel, organizationVersion: "v2",
      fileOwnersDigest: owners.digest, ownerGeneration: owners.version, tools });
    const authority = _createRuntimeAuthority({ fileOwners: owners, boundaries: [boundary], organizationVersion: "v2" });
    authority.registerInstance({ instanceId: channel, session, dispatchContext, scope: new AgentScope({ write: [], tools }) });
    const instance = authority.beginRun(channel, "run");
    const context = { boundary, session, trustedSession: session, currentVersion: "v2", instance, dispatchContext };
    for (const resource of ["src/a.txt", "package.json"]) {
      const value = request("legion_read_file", resource);
      assert.equal(policy.evaluateRead(value, context).allowed, true);
      const result = await f.read.readFile(value);
      assert.equal(result.status, "read"); assert.ok(result.text.length > 0);
    }
    const listed = await f.read.listFiles(request("legion_list_files", ""));
    assert.equal(listed.entries.some(item => item.name === ".ans" || item.name === ".env"), false);
    for (const resource of [".ans/private.json", ".env", "nested/.git/config", "nested/.ssh/id_rsa", "nested/.npmrc"]) {
      const value = request("legion_read_file", resource);
      assert.equal(policy.evaluateRead(value, context).reason, "restricted_resource");
      assert.equal((await f.read.readFile(value)).status, "denied");
    }
    assert.equal((await f.read.readFile(request("legion_read_file", "src/link.txt"))).status, "denied");
    assert.equal(policy.evaluateRead(request("legion_read_file", "src/a.txt"), { ...context, session: new AgentSession({ ...session }) }).reason, "invalid_identity");
    assert.equal(policy.evaluateRead(request("legion_read_file", "src/a.txt", { runId: "stale" }), context).reason, "instance_or_run_changed");
    assert.throws(() => request("legion_read_file", "src/a.txt", { maxBytes: 65537 }), /read_budget/);
    assert.throws(() => request("legion_list_files", "", { limit: 201 }), /read_budget/);
  }
});
