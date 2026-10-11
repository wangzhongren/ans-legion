import { createHash, randomUUID } from "node:crypto";
import { ProjectFileOwners } from "../../workbench.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import nodeFs from "node:fs";
import { dirname, join, relative, resolve, isAbsolute, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as publicApi from "../../runtime.mjs";
import { PiToolRequest } from "../../src/kernel/models/agent.mjs";
import { createCodexAdapter, createClaudeAdapter } from "../../src/adapters/services/public/proposal.mjs";
import { MutationError } from "../../src/kernel/services/public/mutation.mjs";

const { createRuntime, AgentSession, ActionProposal, RoleBoundary, Outcome } = publicApi;
const PROJECT = fileURLToPath(new URL("../../", import.meta.url));
const TEST_ROLE = process.env.LEGION_NODE_TEST_ROLE ?? "Tester";
assert.ok(["ProjectManager", "Reviewer", "Tester"].includes(TEST_ROLE), "unknown Node test role");
const TEMP_ROOT = resolve(PROJECT, ".ans/runtime/legion-cli-role-owned-v2", TEST_ROLE, "tmp");
const CONTENT = "integration-private-body-秘密";
const ALLOWED = ["proposal", "decision", "mutation_intent", "mutation_success"];
const DENIED = ["proposal", "decision", "mutation_failure"];

async function prepareTemporaryRoot() {
  for (let current = resolve(PROJECT);; current = dirname(current)) {
    const metadata = await fs.lstat(current);
    assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink(), "unsafe fixture ancestor");
    if (current === dirname(current)) break;
  }
  let current = resolve(PROJECT);
  for (const component of relative(PROJECT, TEMP_ROOT).split(sep)) {
    current = join(current, component);
    try { await fs.mkdir(current); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
    const metadata = await fs.lstat(current);
    assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink(), "unsafe fixture directory");
  }
}

async function cleanup(workspace) {
  const target = resolve(workspace);
  const remainder = relative(TEMP_ROOT, target);
  assert.ok(!isAbsolute(remainder) && !remainder.startsWith("..") && remainder.startsWith("legion-test-"));
  for (let current = target;; current = dirname(current)) {
    assert.equal((await fs.lstat(current)).isSymbolicLink(), false);
    if (current === dirname(current)) break;
  }
  await fs.rm(target, { recursive: true });
  await assert.rejects(fs.stat(target), { code: "ENOENT" });
}

async function ownerLease(t, workspace, owners) {
  const base = await fs.mkdtemp(join(TEMP_ROOT, "legion-test-owner-lease-"));
  const leaseRoot=join(base,"leases"),catalogDir=join(base,"catalog");
  await fs.mkdir(leaseRoot,{mode:0o700});await fs.mkdir(catalogDir,{mode:0o700});
  const identity=async path=>{const s=await fs.lstat(path,{bigint:true});return {deviceId:String(s.dev),fileId:String(s.ino)};};
  const workspaceIdentity={canonicalPath:await fs.realpath(workspace),...await identity(workspace)};
  const key=createHash("sha256").update(workspaceIdentity.deviceId+":"+workspaceIdentity.fileId).digest("hex");
  const lock=join(leaseRoot,key);await fs.mkdir(lock,{mode:0o700});const holder=join(lock,"holder"),nonce=randomUUID();await fs.writeFile(holder,nonce,{flag:"wx",mode:0o600});
  await fs.writeFile(join(catalogDir,"workbench-projects.json"),JSON.stringify({schemaVersion:2,projects:[{schemaVersion:2,id:owners.projectId,workspaceIdentity,fileOwners:owners,plan:null,tasks:[],legacyHistory:[]}]}),{flag:"wx",mode:0o600});
  const sourceId=await identity(catalogDir);await fs.writeFile(join(leaseRoot,key+".owner-source.json"),JSON.stringify({schemaVersion:1,workspace:workspaceIdentity,source:{catalogDirCanonicalPath:catalogDir,dirDeviceId:sourceId.deviceId,dirFileId:sourceId.fileId,filename:"workbench-projects.json",projectId:owners.projectId}}),{flag:"wx",mode:0o600});
  t.after(()=>cleanup(base));return {leaseRoot,nonce,leaseIdentity:await identity(lock),holderIdentity:await identity(holder)};
}

async function fixture(t) {
  await prepareTemporaryRoot();
  const workspace = await fs.mkdtemp(join(TEMP_ROOT, "legion-test-permission-"));
  const backend = new AgentSession({ sessionId: "backend", roleId: "Backend", taskId: "backend-task", organizationVersion: "v3" });
  const frontend = new AgentSession({ sessionId: "frontend", roleId: "Frontend", taskId: "frontend-task", organizationVersion: "v3" });
  const unknown = new AgentSession({ sessionId: "unknown", roleId: "Unknown", taskId: "unknown-task", organizationVersion: "v3" });
  const boundary = new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"], denyScope: ["backend/private/"],
    tools: ["legion_write_file"], capabilities: ["write_file"] });
  const owners=new ProjectFileOwners({projectId:"tester-permission",version:"1",owners:[...["backend/new/file.txt","backend/approved.txt","backend/private/key.txt","backend/after/file.txt"].map(resource=>({resource,roleId:"Backend"})),{resource:"frontend/login.vue",roleId:"Frontend"}]});
  const leaseContext=await ownerLease(t,workspace,owners);
  const runtime = createRuntime({ workspace, fileOwners:owners,leaseContext, organizationVersion: "v3", boundaries: [boundary,
    new RoleBoundary({ roleId: "Frontend", writeScope: ["frontend/"], tools: ["legion_write_file"], capabilities: ["write_file"] })],
    sessions: [backend, frontend, unknown] });
  t.after(async () => { t.mock.restoreAll(); await runtime.close(); await cleanup(workspace); });
  return { workspace, runtime, backend, frontend, unknown, boundary,owners,leaseContext };
}

function proposal(session, resource = "backend/new/file.txt", extra = {}) {
  return new ActionProposal({ proposalId: "permission-request", session, resource, content: CONTENT,
    action: "write_file", tool: "legion_write_file", capability: "write_file", ...extra });
}

function assertDenied(outcome, expected, reason) {
  assert.equal(outcome.decision.outcome, expected);
  if (reason !== undefined) assert.equal(outcome.decision.reason, reason);
  assert.equal(outcome.result.status, "denied");
  assert.equal(outcome.result.success, false);
  assert.equal(outcome.result.observedMutation, false);
  assert.equal(outcome.result.auditFailed, false);
  assert.equal(outcome.result.proposalDigest, outcome.decision.proposalDigest);
}

async function assertAudit(f, expected) {
  const events = await f.runtime.events();
  assert.equal(events.length, expected.reduce((count, group) => count + group.kinds.length, 0));
  assert.deepEqual(events.map((event) => event.sequence), Array.from({ length: events.length }, (_, index) => index + 1));
  let offset = 0;
  for (const { proposal: p, kinds, decisionVersion = "v3" } of expected) {
    const group = events.slice(offset, offset + kinds.length);
    assert.deepEqual(group.map((event) => event.kind), kinds);
    for (const event of group) {
      assert.deepEqual([event.roleId, event.taskId, event.resource, event.proposalDigest, event.correlationId],
        [p.session.roleId, p.session.taskId, p.resource, p.digest, p.proposalId]);
      let version = p.session.organizationVersion;
      if (event.kind === "decision") version = decisionVersion;
      assert.equal(event.organizationVersion, version);
      assert.match(event.recordedAt, /\+08:00$/);
      assert.ok(Number.isFinite(Date.parse(event.recordedAt)));
    }
    offset += kinds.length;
  }
  const audit = join(f.workspace, ".ans/events");
  const text = await fs.readFile(join(audit, "index.jsonl"), "utf8");
  const records = text.trimEnd().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(records, events.map((event) => ({ ...event })));
  const dates = new Set(events.map((event) => event.recordedAt.slice(0, 10)));
  assert.deepEqual((await fs.readdir(audit)).sort(), ["index.jsonl", ...[...dates].map((date) => date + ".jsonl")].sort());
  for (const date of dates) {
    const daily = await fs.readFile(join(audit, date + ".jsonl"), "utf8");
    assert.deepEqual(daily.trimEnd().split("\n").map((line) => JSON.parse(line)), records.filter((event) => event.recordedAt.startsWith(date)));
    assert.ok(!daily.includes("integration-private-body"));
    assert.ok(!daily.includes('"content"'));
  }
  assert.ok(!text.includes("integration-private-error"));
  return events;
}

test("root API and both adapters complete backend write while preserving frontend", async (t) => {
  assert.deepEqual(Object.keys(publicApi).sort(), ["ActionProposal", "AgentScope", "AgentSession", "Outcome",
    "PiConnection", "RoleBoundary", "TaskDispatchContext", "createRuntime"].sort());
  const observations = [];
  for (const factory of [createCodexAdapter, createClaudeAdapter]) {
    const f = await fixture(t);
    const seed = proposal(f.frontend, "frontend/login.vue", { proposalId: "seed", content: "original frontend" });
    assert.equal((await f.runtime.submit(seed)).result.status, "written");
    const request = new PiToolRequest({ requestId: "same-request", runId: "adapter-local-run", toolCallId: "same-call",
      tool: "legion_write_file", parameters: { resource: "backend/new/file.txt", content: CONTENT } });
    const p = factory().convert(request, f.backend);
    assert.equal(p.session, f.backend);
    const allowed = await f.runtime.submit(p);
    assert.equal(allowed.decision.outcome, Outcome.ALLOW);
    assert.deepEqual([allowed.result.success, allowed.result.status, allowed.result.observedMutation, allowed.result.auditFailed], [true, "written", true, false]);
    assert.equal(await f.runtime.readFile(p.resource), CONTENT);
    assert.equal(await fs.readFile(join(f.workspace, p.resource), "utf8"), CONTENT);
    const denied = proposal(f.backend, "frontend/login.vue", { proposalId: "denied" });
    assertDenied(await f.runtime.submit(denied), Outcome.DENY, "file_owner_mismatch");
    assert.equal(await f.runtime.readFile(seed.resource), "original frontend");
    assert.equal(await fs.readFile(join(f.workspace, seed.resource), "utf8"), "original frontend");
    await assertAudit(f, [{ proposal: seed, kinds: ALLOWED }, { proposal: p, kinds: ALLOWED }, { proposal: denied, kinds: DENIED }]);
    observations.push({ digest: p.digest, contentDigest: p.contentDigest, decision: { ...allowed.decision }, result: { ...allowed.result } });
  }
  assert.deepEqual(observations[0], observations[1]);
});

test("identity copies unknown roles and unsupported tools cannot obtain write authority", async (t) => {
  const f = await fixture(t);
  const copied = new AgentSession({ ...f.backend });
  const cases = [proposal(copied), proposal(f.unknown), proposal(f.backend, undefined, { tool: "bash" }),
    proposal(f.backend, undefined, { capability: "network" }), proposal(f.backend, undefined, { action: "shell" })];
  const reasons = ["invalid_identity", "unknown_role", "unsupported_action_tool_or_capability",
    "unsupported_action_tool_or_capability", "unsupported_action_tool_or_capability"];
  for (const [index, p] of cases.entries()) assertDenied(await f.runtime.submit(p), Outcome.DENY, reasons[index]);
  await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
  await assertAudit(f, cases.map((p) => ({ proposal: p, kinds: DENIED })));
});

test("public Runtime rejects cross-role case aliases and directory descendants before an Agent runs", async (t) => {
  const f = await fixture(t);
  const writer = new RoleBoundary({ roleId: "Writer", readScope: ["."], writeScope: ["src/API.ts"],
    capabilities: ["read_project", "write_file"], tools: ["legion_write_file", "legion_read_file", "legion_list_files"] });
  const other = scope => new RoleBoundary({ roleId: "Other", readScope: ["."], writeScope: [scope],
    capabilities: ["read_project", "write_file"], tools: ["legion_write_file", "legion_read_file", "legion_list_files"] });
  for (const scope of ["SRC/api.ts", "src/"]) {
    assert.throws(() => createRuntime({ workspace: f.workspace, fileOwners:f.owners,leaseContext:f.leaseContext,organizationVersion: "v3",
      boundaries: [writer, other(scope)] }), /cross_role_write_scope_overlap/);
  }
  assert.deepEqual(await f.runtime.events(), []);
  await assert.rejects(fs.stat(join(f.workspace, "src")), { code: "ENOENT" });
});

test("original approval path aliases action approvals and deny precedence remain strict", async (t) => {
  const f = await fixture(t);
  await f.runtime.updateBoundary(new RoleBoundary({ ...f.boundary, requiredApprovals: ["backend/approved.txt"] }));
  const cases = [];
  for (const resource of ["backend/approved.txt", "BACKEND/APPROVED.TXT", "backend\\approved.txt"]) {
    const p = proposal(f.backend, resource);
    assertDenied(await f.runtime.submit(p), Outcome.REQUIRE_APPROVAL, "approval_required");
    cases.push(p);
  }
  await f.runtime.updateBoundary(new RoleBoundary({ ...f.boundary, requiredApprovals: ["write_file"],
    handoffTargets: ["Frontend"], allowScopeExpansion: true }));
  const action = proposal(f.backend);
  assertDenied(await f.runtime.submit(action), Outcome.REQUIRE_APPROVAL, "approval_required");
  const denied = proposal(f.backend, "BACKEND\\PRIVATE\\key.txt");
  assertDenied(await f.runtime.submit(denied), Outcome.DENY, "explicit_deny");
  cases.push(action, denied);
  await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
  await assertAudit(f, cases.map((p) => ({ proposal: p, kinds: DENIED })));
});

test("scalar restriction collections reject rather than silently dropping deny or approval", async (t) => {
  const f = await fixture(t);
  for (const [field, scalar] of [["denyScope", "backend/private/"], ["requiredApprovals", "write_file"],
    ["denyScope", new Uint8Array([98, 97])], ["requiredApprovals", Buffer.from("write_file")]]) {
    assert.throws(() => new RoleBoundary({ ...f.boundary, [field]: scalar }), TypeError);
  }
  await f.runtime.updateBoundary(new RoleBoundary({ ...f.boundary, requiredApprovals: ["write_file"] }));
  const denied = proposal(f.backend, "backend/private/key.txt");
  const approval = proposal(f.backend);
  assertDenied(await f.runtime.submit(denied), Outcome.DENY, "explicit_deny");
  assertDenied(await f.runtime.submit(approval), Outcome.REQUIRE_APPROVAL, "approval_required");
  await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
  await assertAudit(f, [{ proposal: denied, kinds: DENIED }, { proposal: approval, kinds: DENIED }]);
});

test("control plane and traversal proposals preserve sentinel and create no business targets", async (t) => {
  const f = await fixture(t);
  const sentinel = join(f.workspace, ".ans/organization/definition.json");
  await fs.mkdir(dirname(sentinel), { recursive: true });
  await fs.writeFile(sentinel, "organization preserved");
  const cases = [".ANS/organization/definition.json", "backend/../outside.txt", "../outside.txt"].map((resource) => proposal(f.backend, resource));
  for (const p of cases) assertDenied(await f.runtime.submit(p), Outcome.DENY, "unsafe_resource");
  assert.equal(await fs.readFile(sentinel, "utf8"), "organization preserved");
  await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
  await assert.rejects(fs.stat(join(f.workspace, "outside.txt")), { code: "ENOENT" });
  await assertAudit(f, cases.map((p) => ({ proposal: p, kinds: DENIED })));
});

test("handoff scope expansion and unknown handoff outcomes do not execute", async (t) => {
  const f = await fixture(t);
  const cases = [[{ handoffTargets: ["Frontend"], allowScopeExpansion: true }, Outcome.DENY, ""],
    [{ allowScopeExpansion: true }, Outcome.DENY, ""], [{ handoffTargets: ["Absent"] }, Outcome.DENY, ""]];
  const expected = [];
  for (const [extra, outcome, target] of cases) {
    await f.runtime.updateBoundary(new RoleBoundary({ ...f.boundary, ...extra }));
    const p = proposal(f.backend, "frontend/login.vue");
    const result = await f.runtime.submit(p);
    assertDenied(result, outcome,"file_owner_mismatch");
    assert.equal(result.decision.handoffTarget, target);
    expected.push({ proposal: p, kinds: DENIED });
  }
  await assert.rejects(fs.stat(join(f.workspace, "frontend")), { code: "ENOENT" });
  await assertAudit(f, expected);
});

test("opaque prepared permit binds content resource identity and ID and is single use", async (t) => {
  const f = await fixture(t);
  const p = proposal(f.backend);
  const expected = [];
  for (const changes of [{ content: "changed" }, { resource: "backend/other.txt" }, { proposalId: "other" },
    { session: new AgentSession({ ...f.backend }) }]) {
    const prepared = await f.runtime.prepare(p);
    assert.equal(prepared.decision.outcome, Outcome.ALLOW);
    assert.ok(Object.isFrozen(prepared.permit));
    assert.deepEqual(Object.keys(prepared.permit), []);
    expected.push({ proposal: p, kinds: ["proposal", "decision"] });
    const altered = new ActionProposal({ ...p, ...changes });
    const result = await f.runtime.execute(altered, prepared.permit);
    assert.equal(result.observedMutation, false);
    let kinds = ["mutation_failure"];
    if (changes.session !== undefined || changes.resource !== undefined) kinds = ["decision", "mutation_failure"];
    expected.push({ proposal: altered, kinds });
  }
  for (const fake of [undefined, Object.freeze({}), Object.freeze({ outcome: Outcome.ALLOW })]) {
    assert.equal((await f.runtime.execute(p, fake)).observedMutation, false);
    expected.push({ proposal: p, kinds: ["mutation_failure"] });
  }
  await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
  const prepared = await f.runtime.prepare(p);
  assert.equal((await f.runtime.execute(p, prepared.permit)).status, "written");
  expected.push({ proposal: p, kinds: ALLOWED });
  assert.equal((await f.runtime.execute(p, prepared.permit)).status, "denied");
  expected.push({ proposal: p, kinds: ["mutation_failure"] });
  assert.equal(await f.runtime.readFile(p.resource), CONTENT);
  await assertAudit(f, expected);
});

test("task boundary and version roundtrips permanently revoke old permits", async (t) => {
  const f = await fixture(t);
  const expected = [];
  for (const transition of ["task", "boundary", "version"]) {
    const p = proposal(f.backend, undefined, { proposalId: transition });
    const prepared = await f.runtime.prepare(p);
    assert.equal(prepared.decision.outcome, Outcome.ALLOW);
    expected.push({ proposal: p, kinds: ["proposal", "decision"] });
    let reason;
    if (transition === "task") { await f.runtime.setTaskStatus("backend-task", "completed"); reason = "task_inactive"; }
    if (transition === "boundary") { await f.runtime.updateBoundary(new RoleBoundary({ ...f.boundary, writeScope: [] })); reason = "outside_write_scope"; }
    if (transition === "version") { await f.runtime.updateVersion("v4"); reason = "version_mismatch"; }
    const denied = await f.runtime.execute(p, prepared.permit);
    assert.equal(denied.status, "denied"); assert.equal(denied.reason, reason);
    let decisionVersion = "v3";
    if (transition === "version") decisionVersion = "v4";
    expected.push({ proposal: p, kinds: ["decision", "mutation_failure"], decisionVersion });
    if (transition === "task") await f.runtime.setTaskStatus("backend-task", "active");
    if (transition === "boundary") await f.runtime.updateBoundary(f.boundary);
    if (transition === "version") await f.runtime.updateVersion("v3");
    assert.equal((await f.runtime.execute(p, prepared.permit)).status, "denied");
    expected.push({ proposal: p, kinds: ["mutation_failure"] });
  }
  await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
  await assertAudit(f, expected);
});

test("actual replace failure preserves previous content and cleans temporary file", async (t) => {
  const f = await fixture(t);
  const original = proposal(f.backend, undefined, { content: "original backend", proposalId: "original" });
  assert.equal((await f.runtime.submit(original)).result.status, "written");
  t.mock.method(nodeFs, "renameSync", () => { throw new Error("integration-private-error"); });
  const attempted = proposal(f.backend);
  const result = await f.runtime.submit(attempted);
  assert.equal(result.decision.outcome, Outcome.ALLOW);
  assert.deepEqual([result.result.status, result.result.success, result.result.observedMutation, result.result.auditFailed], ["failed", false, false, false]);
  assert.equal(await f.runtime.readFile(original.resource), "original backend");
  assert.deepEqual(await fs.readdir(join(f.workspace, "backend/new")), ["file.txt"]);
  await assertAudit(f, [{ proposal: original, kinds: ALLOWED },
    { proposal: attempted, kinds: ["proposal", "decision", "mutation_intent", "mutation_failure"] }]);
});

test("intent audit append failure prevents business directory and closes subsequent writes", async (t) => {
  const f = await fixture(t); const p = proposal(f.backend);
  const prepared = await f.runtime.prepare(p);
  assert.equal(prepared.decision.outcome, Outcome.ALLOW);
  const open = fs.open;
  t.mock.method(fs, "open", async (path, mode, ...rest) => {
    if (path === join(f.workspace, ".ans/events/index.jsonl") && mode === "a") throw new Error("integration-private-error");
    return await open(path, mode, ...rest);
  });
  const result = await f.runtime.execute(p, prepared.permit);
  assert.deepEqual([result.status, result.success, result.observedMutation, result.auditFailed], ["audit_failed", false, false, true]);
  assert.equal((await f.runtime.submit(proposal(f.backend, "backend/after/file.txt"))).result.auditFailed, true);
  await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
  await assertAudit(f, [{ proposal: p, kinds: ["proposal", "decision"] }]);
});

test("commit followed by result audit failure reports observed write and blocks next target", async (t) => {
  const f = await fixture(t); const p = proposal(f.backend);
  const prepared = await f.runtime.prepare(p);
  const open = fs.open; let dailyAppends = 0;
  t.mock.method(fs, "open", async (path, mode, ...rest) => {
    if (dirname(path) === join(f.workspace, ".ans/events") && !path.endsWith("index.jsonl") && mode === "a") {
      dailyAppends += 1;
      if (dailyAppends === 2) throw new Error("integration-private-error");
    }
    return await open(path, mode, ...rest);
  });
  const result = await f.runtime.execute(p, prepared.permit);
  assert.deepEqual([result.status, result.success, result.observedMutation, result.auditFailed], ["audit_failed", false, true, true]);
  assert.equal(await f.runtime.readFile(p.resource), CONTENT);
  assert.equal(await fs.readFile(join(f.workspace, p.resource), "utf8"), CONTENT);
  await assert.rejects(f.runtime.events(), MutationError);
  const next = await f.runtime.submit(proposal(f.backend, "backend/after/file.txt"));
  assert.equal(next.decision.reason, "audit_unavailable");
  assert.equal(next.result.auditFailed, true); assert.equal(next.result.observedMutation, false);
  await assert.rejects(fs.stat(join(f.workspace, "backend/after")), { code: "ENOENT" });
  const index = await fs.readFile(join(f.workspace, ".ans/events/index.jsonl"), "utf8");
  const records = index.trimEnd().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(records.map((event) => event.kind), ALLOWED);
  assert.equal(records.at(-1).observedMutation, true);
  assert.ok(!index.includes("integration-private-body") && !index.includes("integration-private-error"));
});

test("original Node Interface demo preserves one success five denials and 23 events", () => {
  const result = spawnSync(process.execPath, [join(PROJECT, "bin/legion.mjs"), "demo"],
    { cwd: PROJECT, encoding: "utf8", timeout: 20000, env: { ...process.env, TEMP: TEMP_ROOT, TMP: TEMP_ROOT, TMPDIR: TEMP_ROOT } });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /backendWritten=true frontendPreserved=true/);
  const rows = result.stdout.split(/\r?\n/).filter((line) => /^[a-z]+: /.test(line));
  assert.equal(rows.length, 6);
  assert.match(rows[0], /^allowed: ALLOW \/ written/);
  for (const row of rows.slice(1)) assert.match(row, /DENY \/ denied/);
  const events = result.stdout.split(/\r?\n/).filter((line) => line.startsWith("{")).map((line) => JSON.parse(line));
  assert.equal(events.length, 23);
  assert.deepEqual(events.map((event) => event.sequence), Array.from({ length: 23 }, (_, index) => index + 1));
  assert.deepEqual(events.map((event) => event.kind), [...ALLOWED, ...ALLOWED, ...Array.from({ length: 5 }, () => DENIED).flat()]);
  for (const event of events) { assert.match(event.recordedAt, /\+08:00$/); assert.equal(event.content, undefined); }
});
