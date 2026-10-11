/** Independent finite checks for accepted Node/workbench v2, using actual public capabilities. */
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import nodeFs, { promises as fs } from "node:fs";
import { resolve, relative, dirname, join, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import * as publicApi from "../../runtime.mjs";
import { createRuntime as publicCreateRuntime, AgentSession, ActionProposal, RoleBoundary, Outcome, AgentScope,
  TaskDispatchContext } from "../../runtime.mjs";
import { ExecutionPermit, PolicyDecision, Event, MutationResult,
  assertDistinctRoleWriteScopes } from "../../src/kernel/models/core.mjs";
import { ProjectFileOwners, FileOwnershipPlan, applyFileOwnershipPlan,
  assertFileOwner } from "../../workbench.mjs";
import { AgentInstance, PiConnection, PiToolResult, PiToolRequest } from "../../src/kernel/models/agent.mjs";
import { createMutationService, MutationError } from "../../src/kernel/services/public/mutation.mjs";
import { createReadService } from "../../src/kernel/services/public/read.mjs";
import { ProjectReadRequest } from "../../src/kernel/models/agent.mjs";
import { createStorageProvider, StorageError } from "../../src/kernel/providers/public/storage.mjs";
import { createProposalService } from "../../src/adapters/services/public/proposal.mjs";
import { createPiSessionProvider } from "../../src/adapters/providers/public/pi_session.mjs";
import { AgentSession as SdkSession } from "@earendil-works/pi-coding-agent";
import { createFauxCore, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const testRole = process.env.LEGION_NODE_TEST_ROLE ?? "Reviewer";
assert.ok(["ProjectManager", "Reviewer", "Tester"].includes(testRole), "unknown Node test role");
const temporaryRoot = resolve(project, ".ans/runtime/legion-cli-role-owned-v2", testRole, "tmp");
const publicNames = ["createRuntime", "AgentSession", "ActionProposal", "RoleBoundary", "Outcome",
  "AgentScope", "PiConnection", "TaskDispatchContext"].sort();
const workspaceResources = new Map();
const reviewerOwners = resources => new ProjectFileOwners({projectId:'reviewer',version:'1',owners:resources.map(resource=>({resource,roleId:'Backend'}))});
const ownerResources = ['backend/new/file.txt','backend/approved.txt','backend/private/key','backend/after/x','backend/second.txt','backend/other.txt','backend/a','backend/a.txt','backend/b.txt'];
function createRuntime(options) {
  const fileOwners=options.fileOwners??reviewerOwners(options.dispatchContext? ["backend/a.txt","backend/b.txt"]:ownerResources);
  const state=join(options.workspace,'review-owner-state');nodeFs.mkdirSync(state,{recursive:true,mode:0o700});
  const leases=join(state,'leases'),catalog=join(state,'catalog');for(const p of [leases,catalog])nodeFs.mkdirSync(p,{recursive:true,mode:0o700});
  const id=p=>{const st=nodeFs.lstatSync(p,{bigint:true});return {deviceId:String(st.dev),fileId:String(st.ino)};};
  const workspaceIdentity={canonicalPath:nodeFs.realpathSync(options.workspace),...id(options.workspace)};
  const key=createHash('sha256').update(workspaceIdentity.deviceId+':'+workspaceIdentity.fileId).digest('hex'),lock=join(leases,key);nodeFs.mkdirSync(lock,{recursive:true,mode:0o700});
  const holder=join(lock,'holder');if(!nodeFs.existsSync(holder))nodeFs.writeFileSync(holder,'reviewer-fixture',{mode:0o600});
  nodeFs.writeFileSync(join(catalog,'workbench-projects.json'),JSON.stringify({schemaVersion:2,projects:[{schemaVersion:2,id:fileOwners.projectId,workspaceIdentity,fileOwners}]}),{mode:0o600});
  const cid=id(catalog),marker=join(leases,key+'.owner-source.json');if(!nodeFs.existsSync(marker))nodeFs.writeFileSync(marker,JSON.stringify({schemaVersion:1,workspace:workspaceIdentity,source:{catalogDirCanonicalPath:catalog,dirDeviceId:cid.deviceId,dirFileId:cid.fileId,filename:'workbench-projects.json',projectId:fileOwners.projectId}}),{mode:0o600});
  return publicCreateRuntime({...options,fileOwners,leaseContext:{leaseRoot:leases,nonce:'reviewer-fixture',leaseIdentity:id(lock),holderIdentity:id(holder)}});
}
function trackClose(root, resource) { workspaceResources.get(root).push(resource); }

async function sourceFiles(directory) {
  const values = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) values.push(...await sourceFiles(path));
    else if (entry.name.endsWith(".mjs")) values.push(path);
  }
  return values.sort();
}
async function guardedRemove(directory) {
  const target = resolve(directory);
  const child = relative(temporaryRoot, target);
  assert.ok(child.startsWith("legion-review-node-") && !child.includes(sep) && !isAbsolute(child));
  let current = target;
  for (;;) {
    const metadata = await fs.lstat(current);
    assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink(), "unsafe cleanup parent");
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  await fs.rm(target, { recursive: true, force: true });
}
function session(options = {}) {
  return new AgentSession({ sessionId: "trusted", roleId: "Backend", taskId: "task",
    organizationVersion: "v3", ...options });
}
function boundary(options = {}) {
  return new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"], denyScope: ["backend/private/"],
    tools: ["legion_write_file"], capabilities: ["write_file"], ...options });
}
function proposal(identity, options = {}) {
  return new ActionProposal({ proposalId: "review", action: "write_file", resource: "backend/new/file.txt",
    content: "review-secret-content", tool: "legion_write_file", capability: "write_file", session: identity, ...options });
}
async function prepareTemporaryRoot() {
  let current = project;
  for (;;) {
    const metadata = await fs.lstat(current);
    assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink(), "unsafe fixture ancestor");
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  current = project;
  for (const part of relative(project, temporaryRoot).split(sep)) {
    current = join(current, part);
    try { await fs.mkdir(current); }
    catch (error) { if (error.code !== "EEXIST") throw error; }
    const metadata = await fs.lstat(current);
    assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink(), "unsafe fixture parent");
  }
}
async function workspace(t) {
  await prepareTemporaryRoot();
  const root = await fs.mkdtemp(join(temporaryRoot, "legion-review-node-"));
  workspaceResources.set(root, []);
  t.after(async () => {
    try { await Promise.all(workspaceResources.get(root).map((resource) => resource.close())); }
    finally { workspaceResources.delete(root); await guardedRemove(root); }
  });
  return root;
}
async function fixture(t, options = {}) {
  const root = await workspace(t);
  const identity = session(); const accepted = boundary();
  const runtime = createRuntime({ workspace: root, boundaries: [accepted], sessions: [identity],
    organizationVersion: "v3", modelProviders: [], ...options });
  trackClose(root, runtime);
  return { root, runtime, identity, accepted, action: proposal(identity) };
}
async function absent(path) { await assert.rejects(fs.stat(path), { code: "ENOENT" }); }
function tool(resource, content, id) {
  return fauxAssistantMessage(fauxToolCall("legion_write_file", { resource, content }, { id }), { stopReason: "toolUse" });
}
function inference(id, responses) {
  const core = createFauxCore({ provider: id, models: [{ id: "model-" + id }], tokensPerSecond: 0 });
  core.setResponses(responses);
  const calls = [];
  const models = core.models.map(({ id, name, input, reasoning, cost, contextWindow, maxTokens }) =>
    ({ id, name, input, reasoning, cost, contextWindow, maxTokens }));
  const config = { provider: id, api: core.api, baseUrl: "https://legion.invalid", apiKey: "review-key-" + id,
    models, streamSimple: (model, context, options) => {
      calls.push({ model: model.id, provider: model.provider, apiKey: options.apiKey, sessionId: options.sessionId,
        transcript: JSON.stringify(context), optionKeys: Object.keys(options) });
      return core.streamSimple(model, context, options);
    } };
  return { core, calls, config };
}

test("actual source ownership, three-part structure and adjacent import/public edges", async () => {
  const policyBytes = await fs.readFile(join(project, ".ans/decisions/legion-desktop-workbench-v2-product-ownership.json"));
  assert.equal(createHash("sha256").update(policyBytes).digest("hex"),
    "87808cec2739fdbbc9520631637b4ddcb2adc2f8680a6e849ec8885d01a35187", "frozen primary ownership snapshot");
  const configuration = JSON.parse(policyBytes.toString("utf8"));
  const currentReadConfiguration = JSON.parse(await fs.readFile(join(project,
    ".ans/decisions/legion-project-wide-read-v1-project.json"), "utf8"));
  const kernelReadBoundary = await fs.readFile(join(project,
    currentReadConfiguration.roles.KernelEngineer.boundary), "utf8");
  const paths = await sourceFiles(join(project, "src"));
  assert.equal(paths.length, 41);
  const governed = JSON.parse(await fs.readFile(join(project, ".ans/decisions/handwell-pm-approved-project-shell-v1-project.json"), "utf8"));
  const projectReadFiles = new Set(["src/kernel/services/abstract/read.mjs",
    "src/kernel/services/public/read.mjs", "src/kernel/services/impl/read.mjs"]);
  assert.deepEqual(currentReadConfiguration.roles.KernelEngineer.writeFiles.filter((name) =>
    name.includes("/services/") && name.endsWith("/read.mjs")).sort(), [...projectReadFiles].sort());
  for (const path of paths) {
    const name = relative(project, path).replaceAll("\\", "/");
    let expectedOwner = "AgentAdapterEngineer";
    if (name.startsWith("src/kernel/")) expectedOwner = "KernelEngineer";
    if (projectReadFiles.has(name)) {
      assert.ok(kernelReadBoundary.split("\n").some((line) => line.startsWith("| 文件 |") &&
        line.includes("`" + name + "`")), "approved Kernel boundary must own " + name);
    }
    else if (configuration.files[name]) assert.equal(configuration.files[name].primaryOwner, expectedOwner, name);
    else {
      assert.ok(governed.roles[expectedOwner].writeFiles.includes(name), "current approved owner: " + name);
      const boundaryText = await fs.readFile(join(project, governed.roles[expectedOwner].boundary), "utf8");
      assert.ok(boundaryText.split("\n").some((line) => line.startsWith("| 文件 |") && line.includes("`" + name + "`")), name);
    }
    const source = await fs.readFile(path, "utf8");
    assert.doesNotMatch(source, /export\s+\*/);
    const imports = [...source.matchAll(/(?:\bfrom\s+|\bimport\s*)["']([^"']+)["']/g)].map((item) => item[1]);
    if (name.includes("/services/") || name.includes("/providers/")) {
      for (const part of ["abstract", "public", "impl"]) {
        await fs.access(join(dirname(dirname(path)), part, path.split(sep).at(-1)));
      }
    }
    for (const target of imports) {
      if (target.startsWith(".")) {
        const destination = relative(project, resolve(dirname(path), target)).replaceAll("\\", "/");
        await fs.access(resolve(dirname(path), target));
        if (name.includes("/interface/")) {
          assert.ok(destination.includes("/pipelines/") || destination.includes("/models/"), name + " -> " + destination);
        }
        if (name.includes("/pipelines/") && !destination.includes("/models/")) {
          assert.ok(destination.includes("/services/public/"), name + " -> " + destination);
        }
        if (name.includes("/services/impl/") && destination.includes("/services/")) {
          assert.ok(destination.includes("/services/abstract/"), name + " peer service");
          assert.equal(dirname(destination).split("/").at(-3), dirname(name).split("/").at(-3));
        }
        if (name.includes("/services/") && destination.includes("/providers/")) assert.ok(destination.includes("/providers/public/"));
        if (name.includes("/providers/")) assert.doesNotMatch(destination, /\/(services|pipelines|interface)\//);
        if (name.includes("/abstract/")) assert.doesNotMatch(destination, /\/(public|impl)\//);
        if (name.startsWith("src/adapters/") && destination.startsWith("src/kernel/")) assert.ok(destination.includes("/models/"));
      } else if (name.includes("/services/") || name.includes("/pipelines/")) {
        assert.fail("Operational external dependency outside Provider: " + name + " -> " + target);
      }
    }
  }
});

test("Model pure imports, callback-free invariant responsibility and immutable collection copies", async () => {
  for (const path of await sourceFiles(join(project, "src/kernel/models"))) {
    const source = await fs.readFile(path, "utf8");
    assert.doesNotMatch(source, /randomUUID|randomBytes|Math\.random|Date\.now|new Date\(\)|process\.|fetch\(|node:(fs|os|path)|pi-coding-agent|pi-ai/);
    assert.doesNotMatch(source, /\/(services|providers|pipelines|interface)\//);
    if (source.includes("node:crypto")) assert.match(source, /import\s*\{\s*createHash\s*\}/);
  }
  const writes = ["backend/a.txt"]; const denies = ["backend/private/"];
  const accepted = boundary({ writeScope: writes, denyScope: denies });
  const context = new TaskDispatchContext({ roleId: "Backend", taskId: "task", organizationVersion: "v3",
    fileOwnersDigest: reviewerOwners(writes).digest, ownerGeneration: "1", tools: ["legion_write_file"] });
  const scope = new AgentScope({ write: writes, deny: denies, tools: ["legion_write_file"] });
  writes.push("frontend/x"); denies.length = 0;
  for (const value of [accepted.writeScope, accepted.denyScope, accepted.tools, context.tools,
    scope.write, scope.deny, scope.tools]) {
    assert.ok(Array.isArray(value) && Object.isFrozen(value));
    assert.throws(() => value.push("expanded"), TypeError);
  }
  assert.deepEqual(accepted.writeScope, ["backend/a.txt"]);
  assert.equal(context.ownerGeneration,"1"); assert.equal(Object.hasOwn(context,"writeSet"),false);
  assert.deepEqual(scope.deny, ["backend/private/"]);
});

test("public owner model rejects cross-role aliases and requires explicit versioned transfer", () => {
  const backend = new RoleBoundary({ roleId: "Backend", writeScope: ["src/"] });
  for (const resource of ["SRC/A.ts", "src/sub/", "SRC/"]) {
    assert.throws(() => assertDistinctRoleWriteScopes([backend,
      new RoleBoundary({ roleId: "Frontend", writeScope: [resource] })]),
    /cross_role_write_scope_overlap/, resource);
  }
  assert.doesNotThrow(() => assertDistinctRoleWriteScopes([backend,
    new RoleBoundary({ roleId: "Frontend", writeScope: ["docs/"] })]));
  assert.throws(() => new ProjectFileOwners({ projectId: "customer", version: "owners-v1",
    owners: [{ resource: "src/a.ts", roleId: "Backend" },
      { resource: "SRC/A.ts", roleId: "Frontend" }] }), /duplicate_owner_alias/);
  const current = new ProjectFileOwners({ projectId: "customer", version: "owners-v1",
    owners: [{ resource: "src/a.ts", roleId: "Backend" }] });
  const fields = { projectId: "customer", baseVersion: current.version, baseDigest: current.digest,
    nextVersion: "owners-v2", claims: [{ resource: "SRC/A.ts", roleId: "Frontend" }] };
  assert.throws(() => applyFileOwnershipPlan(current, new FileOwnershipPlan(fields)),
    /file_owned_by_other_role/);
  const plan = new FileOwnershipPlan({ ...fields,
    transfers: [{ resource: "src/a.ts", fromRoleId: "Backend", toRoleId: "Frontend" }] });
  const transferred = applyFileOwnershipPlan(current, plan);
  assert.equal(current.ownerOf("src/a.ts"), "Backend");
  assert.equal(transferred.ownerOf("src/a.ts"), "Frontend");
  assert.throws(() => assertFileOwner(transferred, { projectId: "customer", version: "owners-v2",
    resource: "src/a.ts", roleId: "Backend" }), /file_owned_by_other_role/);
  assert.throws(() => assertFileOwner(transferred, { projectId: "customer", version: "owners-v1",
    resource: "src/a.ts", roleId: "Frontend" }), /stale_file_owners/);
  assert.throws(() => applyFileOwnershipPlan(transferred, plan), /stale_file_owners/);
});

test("Service public exports are own contracts/factories; Provider admits no Kernel callback", async () => {
  const entries = {
    "src/kernel/services/public/policy.mjs": ["PolicyService", "createPolicyService"],
    "src/kernel/services/public/mutation.mjs": ["MutationError", "MutationService", "createMutationService"],
    "src/kernel/services/public/read.mjs": ["ReadService", "createReadService"],
    "src/kernel/services/public/check.mjs": ["CheckService", "createCheckService"],
    "src/kernel/providers/public/check.mjs": ["CheckProvider", "CheckProviderError", "createCheckProvider"],
    "src/kernel/providers/public/storage.mjs": ["StorageError", "StorageProvider", "createStorageProvider"],
    "src/adapters/services/public/pi_agent.mjs": ["PiAgentService", "createPiAgentService"],
    "src/adapters/providers/public/pi_session.mjs": ["PiSessionProvider", "createPiSessionProvider"],
  };
  for (const [path, names] of Object.entries(entries)) {
    assert.deepEqual(Object.keys(await import(new URL("../../" + path, import.meta.url).href)).sort(), names.sort());
  }
  const mutation = await fs.readFile(join(project, "src/kernel/services/impl/mutation.mjs"), "utf8");
  assert.doesNotMatch(mutation, /Policy|evaluate|callback|adapters|pipelines/);
  const pi = await fs.readFile(join(project, "src/adapters/providers/impl/pi_session.mjs"), "utf8");
  assert.match(pi, /\["instance", "proxy", "scope", "cwd", "modelProviders",\s*"signal", "connection", "credentials", "lifecycle", "budgets"\]/);
  assert.match(pi, /\["api", "baseUrl", "apiKey", "models", "streamSimple"\]/);
  assert.doesNotMatch(pi, /PermissionRuntime|createRuntime|createPolicyService|createMutationService|\.submit\(/);
});

test("public root typed API and closure facade exclude authority and internal deep imports", async (t) => {
  assert.deepEqual(Object.keys(publicApi).sort(), publicNames);
  assert.deepEqual(Object.keys(await import("legion-runtime")).sort(), publicNames);
  for (const path of ["src/kernel/models/core.mjs", "src/kernel/providers/public/storage.mjs", "runtime.mjs"]) {
    await assert.rejects(import("legion-runtime/" + path), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
  }
  const f = await fixture(t);
  assert.ok(Object.isFrozen(f.runtime));
  assert.deepEqual(Object.keys(f.runtime).sort(), ["prepare", "execute", "submit", "updateVersion", "updateBoundary",
    "setTaskStatus", "events", "readFile", "close", "createAgent"].sort());
  const prepared = await f.runtime.prepare(f.action);
  assert.equal(prepared.decision.outcome, Outcome.ALLOW);
  assert.deepEqual(Object.keys(prepared.permit), []);
  assert.ok(Object.isFrozen(prepared.permit));
  assert.equal((await f.runtime.execute(f.action, prepared.permit)).status, "written");
  assert.equal(await f.runtime.readFile(f.action.resource), f.action.content);
});

test("original P1 path approval case and slash aliases never permit creation", async (t) => {
  const f = await fixture(t, { boundaries: [boundary({ requiredApprovals: ["backend/approved.txt"] })] });
  for (const resource of ["backend/approved.txt", "BACKEND/APPROVED.TXT", "backend\\approved.txt"]) {
    const outcome = await f.runtime.submit(proposal(f.identity, { resource }));
    assert.equal(outcome.decision.outcome, Outcome.REQUIRE_APPROVAL, resource);
    assert.equal(outcome.result.observedMutation, false, resource);
  }
  await absent(join(f.root, "backend"));
});

test("original P1 scalar deny and approval restrictions fail closed at construction", () => {
  for (const [field, scalar] of [["denyScope", "backend/private/"], ["requiredApprovals", "write_file"]]) {
    assert.throws(() => boundary({ [field]: scalar }), TypeError, field);
  }
  for (const field of ["readScope", "writeScope", "denyScope", "capabilities", "tools", "requiredApprovals", "handoffTargets"]) {
    assert.throws(() => boundary({ [field]: "scalar" }), TypeError, field);
  }
});

test("raw public factories cannot write files/events/identity from forged ALLOW or permit", async (t) => {
  const root = await workspace(t); const identity = session(); const action = proposal(identity);
  const fake = new PolicyDecision({ outcome: Outcome.ALLOW, reason: "forged", proposalDigest: action.digest,
    organizationVersion: "v3", boundaryDigest: boundary().digest });
  const provider = createStorageProvider({ workspace: root }); const service = createMutationService({ workspace: root });
  trackClose(root, provider); trackClose(root, service);
  for (const value of [undefined, fake, new ExecutionPermit(), {}]) {
    assert.equal((await provider.write(action, value)).observedMutation, false);
    assert.equal((await service.execute(action, value)).observedMutation, false);
  }
  assert.throws(() => provider.createIdentity(), StorageError);
  const event = new Event({ kind: "proposal", roleId: "Backend", taskId: "task" });
  await assert.rejects(provider.appendEvents([event]), StorageError);
  await assert.rejects(service.recordEvents([event]), MutationError);
  await absent(join(root, "backend")); await absent(join(root, ".ans"));
});

test("Runtime rejects forged ALLOW/opaque permits and authentic replay", async (t) => {
  const f = await fixture(t);
  const prepared = await f.runtime.prepare(f.action);
  for (const permit of [new PolicyDecision({ ...prepared.decision }), new ExecutionPermit(), {}, undefined]) {
    assert.equal((await f.runtime.execute(f.action, permit)).observedMutation, false);
  }
  assert.equal((await f.runtime.execute(f.action, prepared.permit)).success, true);
  assert.equal((await f.runtime.execute(f.action, prepared.permit)).success, false);
});

test("fixed registered Session identity and proposal digest bind content/resource/id/run", async (t) => {
  const f = await fixture(t);
  assert.throws(() => { f.identity.roleId = "Admin"; }, TypeError);
  for (const changes of [{ content: "tampered" }, { resource: "backend/other.txt" }, { proposalId: "other" },
    { runId: "other" }, { session: new AgentSession({ ...f.identity }) }]) {
    const prepared = await f.runtime.prepare(f.action);
    const changed = new ActionProposal({ ...f.action, ...changes });
    assert.notEqual(changed.digest === f.action.digest && changed.session === f.action.session, true);
    assert.equal((await f.runtime.execute(changed, prepared.permit)).observedMutation, false);
  }
  const cloned = await f.runtime.submit(new ActionProposal({ ...f.action, session: new AgentSession({ ...f.identity }) }));
  assert.equal(cloned.decision.reason, "invalid_identity");
  await absent(join(f.root, "backend"));
});

test("task/version/boundary transitions permanently invalidate old permits after reverting", async (t) => {
  const f = await fixture(t);
  for (const transition of ["task", "version", "boundary"]) {
    const prepared = await f.runtime.prepare(f.action);
    if (transition === "task") { await f.runtime.setTaskStatus("task", "completed"); await f.runtime.setTaskStatus("task", "active"); }
    if (transition === "version") { await f.runtime.updateVersion("v4"); await f.runtime.updateVersion("v3"); }
    if (transition === "boundary") { await f.runtime.updateBoundary(boundary({ writeScope: [] })); await f.runtime.updateBoundary(f.accepted); }
    assert.equal((await f.runtime.execute(f.action, prepared.permit)).observedMutation, false, transition);
  }
  await absent(join(f.root, "backend"));
});

test("no default scope and deny first despite approval/handoff/expansion", async (t) => {
  const f = await fixture(t);
  await f.runtime.updateBoundary(boundary({ writeScope: [] }));
  assert.equal((await f.runtime.submit(f.action)).decision.outcome, Outcome.DENY);
  await f.runtime.updateBoundary(boundary({ requiredApprovals: ["write_file"], handoffTargets: ["Frontend"], allowScopeExpansion: true }));
  for (const resource of ["backend/private/key", "BACKEND/PRIVATE/KEY", "backend\\private\\key"]) {
    const outcome = await f.runtime.submit(proposal(f.identity, { resource }));
    assert.equal(outcome.decision.outcome, Outcome.DENY); assert.equal(outcome.decision.reason, "explicit_deny");
    assert.equal(outcome.result.observedMutation, false);
  }
  await absent(join(f.root, "backend"));
});

test("control plane, traversal, absolute and reserved paths hard deny", async (t) => {
  const f = await fixture(t);
  for (const resource of [".ans/organization/x", ".ANS/events/index.jsonl", ".git/config", ".GIT/config",
    ".agents/x", ".codex/x", ".aws/credentials", "../outside", "backend/../x", "C:/outside", "/outside",
    "\\\\server\\share\\x", "backend/CON.txt", "backend/name. "]) {
    const outcome = await f.runtime.submit(proposal(f.identity, { resource }));
    assert.equal(outcome.decision.outcome, Outcome.DENY, resource); assert.equal(outcome.result.observedMutation, false);
  }
  await absent(join(f.root, "backend"));
});

test("project read never lists or returns common credential files and directories", async (t) => {
  const root = await workspace(t);
  const read = createReadService({ workspace: root });
  trackClose(root, read);
  const credentials = [".npmrc", ".netrc", ".pypirc", ".ssh/config",
    ".docker/config.json", ".kube/config", ".gnupg/private-keys-v1.d/key",
    "nested/.NPMRC", "nested/.NetRC"];
  for (const resource of credentials) {
    await fs.mkdir(dirname(join(root, resource)), { recursive: true });
    await fs.writeFile(join(root, resource), "FAKE_REVIEW_CREDENTIAL\n");
  }
  const listed = await read.listFiles(new ProjectReadRequest({ requestId: "list", runId: "run",
    tool: "legion_list_files", resource: "" }));
  assert.equal(listed.status, "listed");
  for (const name of [".npmrc", ".netrc", ".pypirc", ".ssh", ".docker", ".kube", ".gnupg"]) {
    assert.equal(listed.entries.some((entry) => entry.name === name), false, name);
  }
  for (const resource of credentials) {
    const result = await read.readFile(new ProjectReadRequest({ requestId: resource, runId: "run",
      tool: "legion_read_file", resource }));
    assert.equal(result.status, "denied", resource);
    assert.equal(result.reason, "restricted_resource", resource);
    assert.equal(result.text, "", resource);
  }
});

test("shared workspace Runtime writes have a consistent sequence and matching daily audit", async (t) => {
  const f = await fixture(t);
  const second = createRuntime({ workspace: f.root, boundaries: [f.accepted], sessions: [f.identity],
    organizationVersion: "v3", modelProviders: [] });
  trackClose(f.root, second);
  const outcomes = await Promise.all([f.runtime.submit(f.action), second.submit(proposal(f.identity,
    { proposalId: "second", resource: "backend/second.txt", content: "second-private-content" }))]);
  assert.ok(outcomes.every(({ result }) => result.success));
  const events = await f.runtime.events();
  assert.equal(events.length, 8);
  assert.deepEqual(events.map(({ sequence }) => sequence), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const id of ["review", "second"]) assert.deepEqual(events.filter((event) => event.correlationId === id).map((event) => event.kind),
    ["proposal", "decision", "mutation_intent", "mutation_success"]);
  assert.ok(events.every((event) => event.recordedAt.endsWith("+08:00")));
  const index = await fs.readFile(join(f.root, ".ans/events/index.jsonl"), "utf8");
  const daily = await fs.readFile(join(f.root, ".ans/events/" + events[0].recordedAt.slice(0, 10) + ".jsonl"), "utf8");
  assert.equal(index, daily);
  assert.doesNotMatch(index, /review-secret-content|second-private-content|"content"|apiKey|prompt/);
});

test("intent audit append failure prevents business directory creation", async (t) => {
  const f = await fixture(t); const open = fs.open; let appends = 0;
  const spy = mock.method(fs, "open", async (...args) => {
    if (args[1] === "a") { appends += 1; if (appends === 5) throw new Error("review-sensitive-I/O-error"); }
    return await open(...args);
  });
  try {
    const outcome = await f.runtime.submit(f.action);
    assert.equal(outcome.decision.outcome, Outcome.ALLOW);
    assert.equal(outcome.result.status, "audit_failed"); assert.equal(outcome.result.observedMutation, false);
    await absent(join(f.root, "backend"));
  } finally { spy.mock.restore(); }
});

test("post-commit daily audit failure explicitly observes mutation and disables next write", async (t) => {
  const f = await fixture(t); const open = fs.open; let dailyAppends = 0;
  const spy = mock.method(fs, "open", async (...args) => {
    if (args[1] === "a" && !String(args[0]).endsWith("index.jsonl")) {
      dailyAppends += 1; if (dailyAppends === 4) throw new Error("review-sensitive-I/O-error");
    }
    return await open(...args);
  });
  let outcome;
  try { outcome = await f.runtime.submit(f.action); } finally { spy.mock.restore(); }
  assert.equal(outcome.result.status, "audit_failed"); assert.equal(outcome.result.success, false);
  assert.equal(outcome.result.observedMutation, true); assert.equal(outcome.result.auditFailed, true);
  assert.equal(await fs.readFile(join(f.root, f.action.resource), "utf8"), f.action.content);
  assert.equal((await f.runtime.submit(proposal(f.identity, { resource: "backend/after/x" }))).result.observedMutation, false);
  await absent(join(f.root, "backend/after"));
  await assert.rejects(f.runtime.events(), MutationError);
  assert.doesNotMatch(await fs.readFile(join(f.root, ".ans/events/index.jsonl"), "utf8"), /review-sensitive-I\/O-error/);
});

test("Provider root and audit parent link-detection branch fails closed (metadata simulation)", async (t) => {
  const original = fs.lstat;
  for (const component of ["", ".ans", ".ans/events"]) {
    const f = await fixture(t); await fs.mkdir(join(f.root, ".ans/events"), { recursive: true });
    const target = join(f.root, component); let detection = 0;
    const spy = mock.method(fs, "lstat", async (...args) => {
      const info = await original(...args);
      if (resolve(String(args[0])) === target) {
        detection += 1;
        return { isSymbolicLink: () => true, isDirectory: () => true, isFile: () => false };
      }
      return info;
    });
    try {
      const outcome = await f.runtime.submit(f.action);
      assert.equal(outcome.result.observedMutation, false); assert.equal(outcome.result.auditFailed, true);
      assert.ok(detection > 0, "actual checked component: " + component);
    } finally { spy.mock.restore(); }
    await absent(join(f.root, "backend"));
  }
});

test("public modelProviders array rejects records, execution callbacks and unknown provider/model", async (t) => {
  const root = await workspace(t); const local = inference("contract", [fauxAssistantMessage("unused")]);
  const options = { workspace: root, boundaries: [boundary()], organizationVersion: "v3",
    dispatchContext: { roleId: "Backend", taskId: "task", organizationVersion: "v3",
      fileOwnersDigest: reviewerOwners(["backend/a.txt","backend/b.txt"]).digest, ownerGeneration:"1", tools: ["legion_write_file"] } };
  for (const modelProviders of [{ contract: local.config }, [local.config, local.config],
    [{ ...local.config, submit: () => {} }], [{ ...local.config, streamSimple: null }]]) {
    assert.throws(() => createRuntime({ ...options, modelProviders }), TypeError);
  }
  const runtime = createRuntime({ ...options, modelProviders: [local.config] }); trackClose(root, runtime);
  for (const proxy of [{ provider: "unknown", model: "model-contract" }, { provider: "contract", model: "unknown" }]) {
    await assert.rejects(runtime.createAgent({ name: "invalid", proxy,
      scope: { write: ["backend/a.txt"], deny: [], tools: ["legion_write_file"] } }), TypeError);
  }
  assert.equal(local.calls.length, 0);
});

test("real Pi SDK instances isolate models, credentials, sessions, scopes and empty resources", async (t) => {
  const root = await workspace(t);
  const a = inference("review-A", [tool("backend/a.txt", "A", "call-A"), fauxAssistantMessage("finished A")]);
  const b = inference("review-B", [tool("backend/b.txt", "B", "call-B"), fauxAssistantMessage("finished B")]);
  const runtime = createRuntime({ workspace: root, boundaries: [boundary()], organizationVersion: "v3",
    dispatchContext: { roleId: "Backend", taskId: "task", organizationVersion: "v3",
      fileOwnersDigest: reviewerOwners(["backend/a.txt","backend/b.txt"]).digest, ownerGeneration:"1", tools: ["legion_write_file"] },
    modelProviders: [a.config, b.config] });
  trackClose(root, runtime);
  const prompt = SdkSession.prototype.prompt; const dispose = SdkSession.prototype.dispose;
  let disposed = 0; const actualSessions = [];
  const fetchSpy = mock.method(globalThis, "fetch", () => { throw new Error("review forbids network"); });
  const promptSpy = mock.method(SdkSession.prototype, "prompt", function (text, options) {
    actualSessions.push(this);
    assert.deepEqual(this.getActiveToolNames(), ["legion_write_file"]);
    assert.deepEqual(this.getAllTools().map((item) => item.name), ["legion_write_file"]);
    assert.equal(options.expandPromptTemplates, false);
    assert.equal(this.sessionManager.getSessionFile(), undefined);
    for (const [getter, field] of [["getExtensions", "extensions"], ["getSkills", "skills"], ["getPrompts", "prompts"],
      ["getThemes", "themes"], ["getAgentsFiles", "agentsFiles"]]) assert.deepEqual(this.resourceLoader[getter]()[field], []);
    return prompt.call(this, text, options);
  });
  const disposeSpy = mock.method(SdkSession.prototype, "dispose", function () { disposed += 1; return dispose.call(this); });
  try {
    const [aa, bb] = await Promise.all([runtime.createAgent({ name: "A", proxy: { provider: "review-A", model: "model-review-A" },
      scope: { write: ["backend/a.txt","backend/b.txt"], deny: [".ans/"], tools: ["legion_write_file"] } }),
    runtime.createAgent({ name: "B", proxy: { provider: "review-B", model: "model-review-B" },
      scope: { write: ["backend/a.txt","backend/b.txt"], deny: [".ans/"], tools: ["legion_write_file"] } })]);
    assert.notEqual(aa.instanceId, bb.instanceId); assert.notEqual(aa.sessionId, bb.sessionId);
    assert.ok(Object.isFrozen(aa));
    assert.deepEqual(Object.keys(aa).sort(), ["instanceId", "name", "sessionId", "roleId", "taskId", "organizationVersion", "run", "cancel", "close"].sort());
    const results = await Promise.all([aa.run({ taskId: "task", prompt: "exclusive review A" }), bb.run({ taskId: "task", prompt: "exclusive review B" })]);
    assert.deepEqual(results.map((item) => item.status), ["completed", "completed"]);
    assert.deepEqual(results.map((item) => item.toolResults[0].result.status), ["written", "written"]);
    assert.equal(await runtime.readFile("backend/a.txt"), "A"); assert.equal(await runtime.readFile("backend/b.txt"), "B");
    assert.equal(a.core.state.callCount, 2); assert.equal(b.core.state.callCount, 2);
    assert.notEqual(actualSessions[0], actualSessions[1]); assert.equal(disposed, 2);
    assert.notEqual(a.calls[0].sessionId, b.calls[0].sessionId);
    for (const call of a.calls) {
      assert.equal(call.model, "model-review-A"); assert.equal(call.apiKey, "review-key-review-A");
      assert.doesNotMatch(call.transcript, /exclusive review B/);
      assert.ok(!call.optionKeys.some((key) => /runtime|permit|submit|writeFile/i.test(key)));
    }
    for (const call of b.calls) { assert.equal(call.model, "model-review-B"); assert.equal(call.apiKey, "review-key-review-B"); assert.doesNotMatch(call.transcript, /exclusive review A/); }
    assert.equal(fetchSpy.mock.callCount(), 0);
    assert.doesNotMatch(JSON.stringify(await runtime.events()), /review-key-|exclusive review|"content"/);
    await assert.rejects(aa.run({ taskId: "task", prompt: "again" }), TypeError);
  } finally { promptSpy.mock.restore(); disposeSpy.mock.restore(); fetchSpy.mock.restore(); }
});

test("actual Pi queue rejects foreign and late requests; proposal retains trusted Session", async (t) => {
  const root = await workspace(t);
  const a = inference("queue-A", [tool("backend/a", "A", "A"), fauxAssistantMessage("A")]);
  const b = inference("queue-B", [tool("backend/b", "B", "B"), fauxAssistantMessage("B")]);
  async function create(local, id) {
    const { provider, ...config } = local.config;
    const options = { cwd: root, proxy: new PiConnection({ provider, model: "model-" + provider }),
      scope: new AgentScope({ write: ["backend/"], deny: [], tools: ["legion_write_file"] }),
      instance: new AgentInstance({ instanceId: id, name: id, sessionId: id, roleId: "Backend", taskId: "task", organizationVersion: "v3" }),
      modelProviders: { [provider]: config } };
    const value = await createPiSessionProvider(options); trackClose(root, value); return value;
  }
  const [pa, pb] = await Promise.all([create(a, "a"), create(b, "b")]);
  pa.start_run("run-A", "A"); pb.start_run("run-B", "B");
  async function next(value, runId, type) {
    for (let index = 0; index < 30; index += 1) {
      const event = await value.next_event(runId, { signal: AbortSignal.timeout(5000) });
      if (event.type === type) return event;
    }
    assert.fail("bounded expected event absent");
  }
  const [ea, eb] = await Promise.all([next(pa, "run-A", "tool_request"), next(pb, "run-B", "tool_request")]);
  const identity = session(); const action = createProposalService().convert(ea.request, identity);
  assert.equal(action.session, identity); assert.equal(action.action, "write_file"); assert.equal(action.runId, "run-A");
  assert.throws(() => new PiToolRequest({ ...ea.request, parameters: { ...ea.request.parameters, roleId: "Admin" } }), TypeError);
  function response(request) { return new PiToolResult({ requestId: request.requestId, runId: request.runId,
    decision: new PolicyDecision({ outcome: Outcome.DENY, reason: "test-deny", proposalDigest: "digest", organizationVersion: "v3" }),
    result: new MutationResult({ success: false, status: "denied", reason: "test-deny", resource: request.parameters.resource, proposalDigest: "digest" }) }); }
  assert.throws(() => pa.respond_tool(eb.request, response(eb.request)), /invalid_or_late/);
  assert.throws(() => pa.respond_tool(new PiToolRequest({ ...ea.request }), response(ea.request)), /invalid_or_late/);
  pa.respond_tool(ea.request, response(ea.request));
  assert.throws(() => pa.respond_tool(ea.request, response(ea.request)), /invalid_or_late/);
  await pb.cancel(); assert.throws(() => pb.respond_tool(eb.request, response(eb.request)), /invalid_or_late/);
  assert.equal((await next(pa, "run-A", "run_finished")).result.status, "completed");
  assert.equal((await next(pb, "run-B", "run_cancelled")).result.status, "cancelled");
});

test("real Pi cannot expand exact task or instance grants; invalid scope fails before inference", async (t) => {
  const root = await workspace(t);
  const local = inference("intersection", [tool("backend/outside.txt", "outside task", "outside-task"),
    tool("frontend/b.txt", "outside owner", "outside-instance"), fauxAssistantMessage("denials observed")]);
  const runtime = createRuntime({ workspace: root, boundaries: [boundary()], organizationVersion: "v3",
    dispatchContext: { roleId: "Backend", taskId: "task", organizationVersion: "v3",
      fileOwnersDigest: reviewerOwners(["backend/a.txt","backend/b.txt"]).digest, ownerGeneration:"1", tools: ["legion_write_file"] }, modelProviders: [local.config] });
  trackClose(root, runtime);
  const config = { name: "intersection", proxy: { provider: "intersection", model: "model-intersection" },
    scope: { write: ["backend/a.txt","backend/b.txt"], deny: [".ans/"], tools: ["legion_write_file"] } };
  for (const scope of [{ ...config.scope, write: ["backend/"] }, { ...config.scope, write: ["backend/outside.txt"] },
    { ...config.scope, tools: ["bash"] }, { ...config.scope, deny: ["backend/a.txt"] }]) {
    await assert.rejects(runtime.createAgent({ ...config, scope }), TypeError);
  }
  assert.equal(local.calls.length, 0);
  const agent = await runtime.createAgent(config);
  const result = await agent.run({ taskId: "task", prompt: "Attempt the two controlled fixture writes." });
  assert.equal(result.status, "completed"); assert.equal(result.toolResults.length, 2);
  assert.deepEqual(result.toolResults.map((response) => response.decision.reason),
    ["outside_instance_or_task_scope", "outside_instance_or_task_scope"]);
  assert.ok(result.toolResults.every((response) => response.decision.outcome === Outcome.DENY && !response.result.observedMutation));
  assert.equal(local.core.state.callCount, 3); await absent(join(root, "backend"));
});

test("late real SDK creation is disposed after cancellation and never published", async (t) => {
  const root = await workspace(t); const local = inference("late", [fauxAssistantMessage("unused")]);
  const runtime = createRuntime({ workspace: root, boundaries: [boundary()], organizationVersion: "v3",
    dispatchContext: { roleId: "Backend", taskId: "task", organizationVersion: "v3", fileOwnersDigest: reviewerOwners(["backend/a.txt","backend/b.txt"]).digest, ownerGeneration:"1", tools: ["legion_write_file"] },
    modelProviders: [local.config] }); trackClose(root, runtime);
  const loadout = SdkSession.prototype.getActiveToolNames; const dispose = SdkSession.prototype.dispose;
  let stopping; let disposed = 0;
  const toolsSpy = mock.method(SdkSession.prototype, "getActiveToolNames", function () {
    const tools = loadout.call(this);
    if (tools.includes("legion_write_file")) stopping = runtime.setTaskStatus("task", "cancelled");
    return tools;
  });
  const disposeSpy = mock.method(SdkSession.prototype, "dispose", function () { disposed += 1; return dispose.call(this); });
  try {
    await assert.rejects(runtime.createAgent({ name: "late", proxy: { provider: "late", model: "model-late" },
      scope: { write: ["backend/a.txt","backend/b.txt"], deny: [], tools: ["legion_write_file"] } }), { name: "AbortError" });
    await stopping; assert.equal(disposed, 1); assert.equal(local.calls.length, 0);
    await absent(join(root, "backend"));
  } finally { toolsSpy.mock.restore(); disposeSpy.mock.restore(); }
});

test("stable tarball exact whitelist and product bytes exclude internal development artifacts", async () => {
  const packaging = join(project, ".ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/su-frontdoor-memory-repair-v1");
  const descriptor = JSON.parse(await fs.readFile(join(packaging, "package-smoke.json"), "utf8"));
  assert.equal(resolve(descriptor.tarball), join(packaging, "legion-runtime-1.1.3.tgz"));
  assert.match(descriptor.sha256, /^[a-f0-9]{64}$/);
  assert.equal(descriptor.sha256, "e0ac5ebaee7caabc52175fe28e229c6fbc195d02890ec5bffe6ba76d80a6f73a");
  const tarball = await fs.readFile(descriptor.tarball);
  assert.equal(createHash("sha256").update(tarball).digest("hex"), descriptor.sha256);
  assert.equal(descriptor.integrity, "sha512-" + createHash("sha512").update(tarball).digest("base64"));
  const archive = gunzipSync(tarball); const entries = new Map();
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((value) => value === 0)) break;
    const name = header.subarray(0, 100).toString().split("\0")[0];
    const prefix = header.subarray(345, 500).toString().split("\0")[0];
    const size = Number.parseInt(header.subarray(124, 136).toString().replaceAll("\0", "").trim(), 8);
    const path = [prefix, name].filter(Boolean).join("/");
    assert.equal(header[156], 48, "tar entry must be ordinary file: " + path);
    assert.ok(path.startsWith("package/"));
    entries.set(path.slice(8), archive.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  const expected = ["package.json", "README.md", "runtime.mjs", "workbench.mjs", "bin/legion.mjs",
    "bin/chat.mjs","apps/desktop/README.md",...(await sourceFiles(join(project, "src"))).map((path) => relative(project, path).replaceAll("\\", "/")),...JSON.parse(await fs.readFile(join(project,'package.json'),'utf8')).files.filter(path=>path.startsWith('apps/'))].sort();
  assert.equal(expected.length, 102); assert.deepEqual([...entries.keys()].sort(), expected);
  const sourceNames = expected.filter((path) => !["package.json", "README.md", "apps/desktop/README.md"].includes(path));
  assert.equal(sourceNames.length, 99); assert.deepEqual(Object.keys(descriptor.sourceHashes).sort(), sourceNames);
  for (const [path, bytes] of entries) {
    assert.ok(!/\.py$|^\.ans\/|^tests\/|node_modules|task_ops/.test(path));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), createHash("sha256").update(await fs.readFile(join(project, path))).digest("hex"), path);
    if (Object.hasOwn(descriptor.sourceHashes, path)) assert.equal(createHash("sha256").update(bytes).digest("hex"), descriptor.sourceHashes[path], "pinned current source " + path);
  }
  const metadata = JSON.parse(entries.get("package.json").toString());
  assert.equal(metadata.version, "1.1.3");
  assert.deepEqual(metadata.exports, { ".": "./runtime.mjs", "./workbench-models": "./workbench.mjs",
    "./services/policy": "./src/kernel/services/public/policy.mjs", "./services/mutation": "./src/kernel/services/public/mutation.mjs",
    "./services/read": "./src/kernel/services/public/read.mjs",
    "./services/check": "./src/kernel/services/public/check.mjs",
    "./services/proposal": "./src/adapters/services/public/proposal.mjs", "./services/pi-agent": "./src/adapters/services/public/pi_agent.mjs", "./services/shell": "./src/kernel/services/public/shell.mjs", "./headless-workbench":"./apps/desktop/src/pipelines/workbench.mjs" }); assert.deepEqual(metadata.bin, { legion: "./bin/legion.mjs" });
  assert.ok(Object.values(metadata.dependencies).every((version) => version === "1.0.4"));
  const desktop=JSON.parse(await fs.readFile(join(project,'apps/desktop/package.json'),'utf8'));
  const lock=JSON.parse(await fs.readFile(join(project,'apps/desktop/package-lock.json'),'utf8'));
  const expectedSpec='file:../../.ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/su-frontdoor-memory-repair-v1/legion-runtime-1.1.3.tgz';
  assert.equal(desktop.dependencies['legion-runtime'],expectedSpec);const installed=lock.packages['node_modules/legion-runtime'];assert.equal(installed.version,'1.1.3');assert.equal(installed.resolved,expectedSpec);assert.equal(installed.integrity,descriptor.integrity);
  for(const [path,hash] of Object.entries(descriptor.sourceHashes))assert.equal(createHash('sha256').update(await fs.readFile(join(project,'apps/desktop/node_modules/legion-runtime',path))).digest('hex'),hash,'current installed Desktop dependency '+path);

});

test('final Provider commit rejects legacy active fields, transferred owner, replaced source and occupied mutex',async(t)=>{
 for(const scenario of ['legacy','transfer','marker','mutex']){
  await t.test(scenario,async(t)=>{
   const f=await fixture(t),state=join(f.root,'review-owner-state'),catalogPath=join(state,'catalog','workbench-projects.json');
   const warm=await f.runtime.submit(proposal(f.identity,{proposalId:'positive',resource:'backend/approved.txt'}));assert.equal(warm.result.success,true);
   const catalog=JSON.parse(await fs.readFile(catalogPath,'utf8'));
   const key=createHash('sha256').update(catalog.projects[0].workspaceIdentity.deviceId+':'+catalog.projects[0].workspaceIdentity.fileId).digest('hex');
   if(scenario==='legacy'){catalog.projects[0].plan={schemaVersion:1,tasks:[{writeSet:['backend/new/file.txt']}]};await fs.writeFile(catalogPath,JSON.stringify(catalog));}
   if(scenario==='transfer'){catalog.projects[0].fileOwners={...catalog.projects[0].fileOwners,version:'2',owners:catalog.projects[0].fileOwners.owners.map(item=>item.resource===f.action.resource?{...item,roleId:'Frontend'}:item)};await fs.writeFile(catalogPath,JSON.stringify(catalog));}
   if(scenario==='marker'){const marker=join(state,'leases',key+'.owner-source.json'),bytes=await fs.readFile(marker);await fs.rename(marker,marker+'.old');await fs.writeFile(marker,bytes,{mode:0o600});}
   if(scenario==='mutex')await fs.mkdir(join(state,'leases',key,'commit.lock'),{mode:0o700});
   const result=await f.runtime.submit(f.action);assert.equal(result.result.success,false);assert.equal(result.result.observedMutation,false);
   const reasons={legacy:'invalid_or_stale_authorization',transfer:'invalid_or_stale_authorization',marker:'invalid_or_stale_authorization',mutex:'commit_lock_busy'};
   assert.equal(result.result.reason,reasons[scenario]);await absent(join(f.root,f.action.resource));
  });
 }
});
