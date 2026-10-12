import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve, relative, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const role = process.env.LEGION_NODE_TEST_ROLE ?? "ProjectManager";
assert.ok(["ProjectManager", "Reviewer", "Tester"].includes(role), "unknown_node_test_role");
const generated = join(project, ".ans/runtime/legion-desktop-command-center-v1", role);
const packaging = join(generated, "packaging", "desktop-image-input-v1-facade-repair-20261012");
const cache = join(generated, "npm-cache", "desktop-image-input-v1-facade-repair-20261012");
const temporary = join(generated, "tmp", "desktop-image-input-v1-facade-repair-20261012");
const historicalSeed = join(project, ".ans/runtime/legion-pi-node-v3/npm-cache/_cacache");
const localSeed = "/private/tmp/legion-npm-cache/_cacache";
const previousGovernedTarball = join(project, ".ans/runtime/legion-governed-workflow-v1/ProjectManager/packaging/legion-runtime-0.7.0.tgz");
const previousGovernedSmoke = join(project, ".ans/runtime/legion-governed-workflow-v1/ProjectManager/packaging/package-smoke.json");
const historicalTarball = join(project, ".ans/runtime/legion-pi-node-v3/packaging/legion-runtime-0.3.0.tgz");
const stableTarball = join(project, ".ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/legion-runtime-0.4.0.tgz");
const previousRuntimeTarball = join(project, ".ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/legion-runtime-0.6.0.tgz");
const previousTarball = join(project, ".ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/legion-runtime-0.5.0.tgz");
const publicNames = ["createRuntime", "AgentSession", "ActionProposal", "RoleBoundary",
  "Outcome", "AgentScope", "PiConnection", "TaskDispatchContext"].sort();
const modelNames = ["ContextReadConfirmation", "ContextSnapshot", "ConfirmedTaskGrant", "MutationVerification",
  "createWorkbenchAuthority", "isWorkbenchMutationAuthority", "PiConnection", "PiConnectionProfile", "AgentScope",
  "AgentConfig", "TaskDispatchContext", "AgentInstance", "PiEventType", "PiTextDelta", "PiImageReference", "PiImageInput", "PiConversationHistory",
  "PiConversationCheckpoint", "PiToolRequest", "PiToolResult", "PiRunResult", "AgentSession", "RoleBoundary",
  "ActionProposal", "PolicyDecision", "ExecutionPermit", "MutationResult", "Event", "Outcome",
  "ProjectReadRequest", "ProjectReadDecision", "ProjectReadResult", "normalizeProjectReadResource",
  "FileOwnershipError", "ProjectFileOwners", "FileOwnershipTransfer", "FileOwnershipPlan",
  "applyFileOwnershipPlan", "assertFileOwner", "assertDistinctRoleWriteScopes",
  "normalizeResource", "normalizeScope", "digestValue", "CheckSpec", "CheckRequest", "CheckAuthorization",
  "CheckDecision", "CheckResult", "checkSpecs", "AgentControlDecision", "AgentControlResult", "AgentControlTools", "AgentTools",
  "ShellRequest", "ShellReview", "ShellPreparation", "ShellAuthorization", "ShellDecision", "ShellCandidate", "ShellResult", "FileBaseline",
  "shellEffects", "shellArtifacts", "shellBaselines"].sort();
const serviceNames = {
  policy: ["PolicyService", "createPolicyService"], mutation: ["MutationService", "MutationError", "createMutationService"],
  read: ["ReadService", "createReadService"],
  check: ["CheckService", "createCheckService"],
  shell: ["ShellService", "createShellService"],
  proposal: ["ProposalService", "createProposalService", "createCodexAdapter", "createClaudeAdapter"],
  "pi-agent": ["PiAgentService", "createPiAgentService"],
};
const packageExports = { ".": "./runtime.mjs", "./workbench-models": "./workbench.mjs",
  "./services/policy": "./src/kernel/services/public/policy.mjs",
  "./services/mutation": "./src/kernel/services/public/mutation.mjs",
  "./services/read": "./src/kernel/services/public/read.mjs",
  "./services/check": "./src/kernel/services/public/check.mjs",
  "./services/shell": "./src/kernel/services/public/shell.mjs",
  "./services/proposal": "./src/adapters/services/public/proposal.mjs",
  "./services/pi-agent": "./src/adapters/services/public/pi_agent.mjs", "./headless-workbench": "./apps/desktop/src/pipelines/workbench.mjs" };
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function protectedHashes() {
  const paths = [];
  const links = {};
  const absent = [];
  async function visit(directory, prefix) {
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      if (item.isSymbolicLink()) links[prefix + "/" + item.name] = await fs.readlink(join(directory, item.name));
      else if (item.isDirectory()) await visit(join(directory, item.name), prefix + "/" + item.name);
      else { assert.ok(item.isFile()); paths.push(prefix + "/" + item.name); }
    }
  }
  for (const directory of [".ans/runtime/legion-pi-node-v3", ".ans/runtime/legion-desktop-gui-v1", ".ans/runtime/legion-node-fixture-compat-v1"]) {
    try { await controlledDirectory(join(project, directory)); await visit(join(project, directory), directory); }
    catch (error) { if (error.code === "ENOENT") absent.push(directory); else throw error; }
  }
  paths.push(".ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/packaging/bridge-v1/legion-runtime-0.8.0.tgz",
    ".ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/packaging/bridge-v1/package-smoke.json");
  paths.push(".ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/packaging/bridge-v2/legion-runtime-0.8.1.tgz",
    ".ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/packaging/bridge-v2/package-smoke.json");
  paths.push(relative(project, previousGovernedTarball), relative(project, previousGovernedSmoke),
    ".ans/runtime/legion-governed-workflow-v1/ProjectManager/packaging/role-context-20261009/legion-runtime-0.7.0.tgz",
    ".ans/runtime/legion-governed-workflow-v1/ProjectManager/packaging/role-context-20261009/package-smoke.json");
  const baseline = JSON.parse(await fs.readFile(join(project, ".ans/decisions/legion-desktop-workbench-v2-protected-baseline.json"), "utf8"));
  for (const [path, item] of Object.entries(baseline.protected)) {
    try {
      const bytes = await fs.readFile(join(project, path));
      assert.equal(bytes.length, item.bytes, "protected baseline size: " + path);
      assert.equal(hash(bytes), item.sha256, "protected baseline: " + path);
      paths.push(path);
    } catch (error) { if (error.code === "ENOENT") absent.push(path); else throw error; }
  }
  const hashes = {};
  for (const path of [...new Set(paths)].sort()) hashes[path] = hash(await fs.readFile(join(project, path)));
  return { files: hashes, links, absent: [...new Set(absent)].sort() };
}

function execute(argumentsList, cwd, extraEnvironment = {}, binary = process.execPath) {
  const environment = { ...process.env, ...extraEnvironment,
    npm_config_cache: cache, npm_config_update_notifier: "false", npm_config_offline: "true",
    TEMP: temporary, TMP: temporary, TMPDIR: temporary, NODE_DISABLE_COMPILE_CACHE: "1" };
  delete environment.NODE_OPTIONS;
  delete environment.NODE_COMPILE_CACHE;
  const result = spawnSync(binary, argumentsList, {
    cwd, encoding: "utf8", timeout: 120000, maxBuffer: 16 * 1024 * 1024,
    env: environment,
  });
  assert.equal(result.error, undefined, String(result.error));
  assert.equal(result.status, 0, result.stdout + "\n" + result.stderr);
  return result.stdout;
}

function npm(argumentsList, cwd = project) {
  return execute([...argumentsList, "--ignore-scripts", "--no-audit", "--no-fund"], cwd, {}, "npm");
}

function expectedPackageFiles() {
  const paths = ["package.json", "README.md", "runtime.mjs", "workbench.mjs", "bin/legion.mjs",
    "src/kernel/models/check.mjs", "src/kernel/models/shell.mjs", "src/kernel/models/core.mjs", "src/kernel/models/agent.mjs", "src/kernel/models/workbench.mjs",
    "src/kernel/pipelines/permission.mjs", "src/kernel/interface/runtime.mjs",
    "src/kernel/interface/demo.mjs"];
  for (const division of ["abstract", "public", "impl"]) {
    for (const service of ["policy", "mutation", "read", "check", "shell"]) paths.push("src/kernel/services/" + division + "/" + service + ".mjs");
    paths.push("src/kernel/providers/" + division + "/storage.mjs");
    paths.push("src/kernel/providers/" + division + "/check.mjs");
    paths.push("src/kernel/providers/" + division + "/shell.mjs");
    for (const service of ["proposal", "pi_agent"]) paths.push("src/adapters/services/" + division + "/" + service + ".mjs");
    paths.push("src/adapters/providers/" + division + "/pi_session.mjs");
  }
  paths.push("apps/desktop/README.md", "bin/chat.mjs", ...["apps/desktop/src/models/desktop.mjs", "apps/desktop/src/models/interaction.mjs", "apps/desktop/src/models/memory.mjs", "apps/desktop/src/models/organization.mjs", "apps/desktop/src/models/workbench.mjs", "apps/desktop/src/pipelines/workbench.mjs", "apps/desktop/src/providers/abstract/environment_profile.mjs", "apps/desktop/src/providers/abstract/history.mjs", "apps/desktop/src/providers/abstract/memory.mjs", "apps/desktop/src/providers/abstract/organization.mjs", "apps/desktop/src/providers/abstract/probe.mjs", "apps/desktop/src/providers/abstract/project.mjs", "apps/desktop/src/providers/abstract/project_lease.mjs", "apps/desktop/src/providers/abstract/settings.mjs", "apps/desktop/src/providers/abstract/workspace.mjs", "apps/desktop/src/providers/impl/environment_profile.mjs", "apps/desktop/src/providers/impl/history.mjs", "apps/desktop/src/providers/impl/memory.mjs", "apps/desktop/src/providers/impl/organization.mjs", "apps/desktop/src/providers/impl/probe.mjs", "apps/desktop/src/providers/impl/project.mjs", "apps/desktop/src/providers/impl/project_lease.mjs", "apps/desktop/src/providers/impl/settings.mjs", "apps/desktop/src/providers/impl/workspace.mjs", "apps/desktop/src/providers/public/environment_profile.mjs", "apps/desktop/src/providers/public/history.mjs", "apps/desktop/src/providers/public/memory.mjs", "apps/desktop/src/providers/public/organization.mjs", "apps/desktop/src/providers/public/probe.mjs", "apps/desktop/src/providers/public/project.mjs", "apps/desktop/src/providers/public/project_lease.mjs", "apps/desktop/src/providers/public/settings.mjs", "apps/desktop/src/providers/public/workspace.mjs", "apps/desktop/src/services/abstract/environment_profiles.mjs", "apps/desktop/src/services/abstract/history.mjs", "apps/desktop/src/services/abstract/memory.mjs", "apps/desktop/src/services/abstract/organization.mjs", "apps/desktop/src/services/abstract/profiles.mjs", "apps/desktop/src/services/abstract/project.mjs", "apps/desktop/src/services/abstract/workspace.mjs", "apps/desktop/src/services/impl/environment_profiles.mjs", "apps/desktop/src/services/impl/history.mjs", "apps/desktop/src/services/impl/memory.mjs", "apps/desktop/src/services/impl/organization.mjs", "apps/desktop/src/services/impl/profiles.mjs", "apps/desktop/src/services/impl/project.mjs", "apps/desktop/src/services/impl/workspace.mjs", "apps/desktop/src/services/public/environment_profiles.mjs", "apps/desktop/src/services/public/history.mjs", "apps/desktop/src/services/public/memory.mjs", "apps/desktop/src/services/public/organization.mjs", "apps/desktop/src/services/public/profiles.mjs", "apps/desktop/src/services/public/project.mjs", "apps/desktop/src/services/public/workspace.mjs"]);
  assert.equal(new Set(paths).size, paths.length);
  return paths.sort();
}

async function controlledDirectory(target, create = false) {
  const child = relative(project, target);
  assert.ok(child !== "" && !child.startsWith(".." + sep) && child !== ".." && !isAbsolute(child));
  if (create) {
    const own = relative(generated, target);
    assert.ok(!own.startsWith(".." + sep) && own !== ".." && !isAbsolute(own));
  }
  let componentPath = project;
  for (const component of child.split(sep)) {
    componentPath = join(componentPath, component);
    if (create) {
      try { await fs.mkdir(componentPath); }
      catch (error) { if (error.code !== "EEXIST") throw error; }
    }
    const metadata = await fs.lstat(componentPath);
    assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink(), "unsafe fixture directory");
  }
}

async function prepareFixture() {
  for (const directory of [packaging, cache, temporary]) await controlledDirectory(directory, true);
  let seed = historicalSeed;
  try { await controlledDirectory(seed); }
  catch (error) { if (error.code === "ENOENT") seed = localSeed; else throw error; }
  const seedMetadata = await fs.lstat(seed);
  assert.ok(seedMetadata.isDirectory() && !seedMetadata.isSymbolicLink(), "unsafe cache seed");
  await fs.cp(seed, join(cache, "_cacache"), { recursive: true, force: false, errorOnExist: false,
    filter: async (source, destination) => {
      const metadata = await fs.lstat(source);
      assert.ok(!metadata.isSymbolicLink() && (metadata.isFile() || metadata.isDirectory()), "unsafe cache seed");
      const child = relative(cache, destination);
      assert.ok(child !== "" && !child.startsWith(".." + sep) && child !== ".." && !isAbsolute(child));
      let existing;
      try { existing = await fs.lstat(destination); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      if (existing !== undefined) {
        assert.ok(!existing.isSymbolicLink() && (existing.isFile() || existing.isDirectory()), "unsafe cache destination");
      }
      return true;
    } });
}

async function guardedRemove(directory) {
  const target = resolve(directory);
  const root = resolve(packaging);
  const child = relative(root, target);
  assert.ok(child !== "" && !child.startsWith(".." + sep) && child !== ".." && !isAbsolute(child));
  let componentPath = project;
  for (const component of relative(project, target).split(sep)) {
    componentPath = join(componentPath, component);
    const metadata = await fs.lstat(componentPath);
    assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink(), "unsafe cleanup component");
  }
  await fs.rm(target, { recursive: true, force: true });
}

async function installedLease(workspace, owners) {
  const fs = (await import("node:fs")).promises;
  const path = await import("node:path");
  const { createHash, randomUUID } = await import("node:crypto");
  const id = async target => { const stat = await fs.lstat(target, { bigint: true }); return { deviceId: String(stat.dev), fileId: String(stat.ino) }; };
  const workspaceIdentity = { canonicalPath: await fs.realpath(workspace), ...await id(workspace) };
  const state = path.join(path.dirname(workspace), "private-owner-fixture-" + path.basename(workspace));
  const leaseRoot = path.join(state, "leases"), catalogDir = path.join(state, "catalog");
  for (const directory of [leaseRoot, catalogDir]) await fs.mkdir(directory, { recursive: true, mode: 0o700 });
  const key = createHash("sha256").update(workspaceIdentity.deviceId + ":" + workspaceIdentity.fileId).digest("hex");
  const lock = path.join(leaseRoot, key); await fs.mkdir(lock, { mode: 0o700 });
  const nonce = randomUUID(), holder = path.join(lock, "holder");
  await fs.writeFile(holder, nonce, { flag: "wx", mode: 0o600 });
  await fs.writeFile(path.join(catalogDir, "workbench-projects.json"), JSON.stringify({ schemaVersion: 2, projects: [{ schemaVersion: 2, id: owners.projectId, workspaceIdentity, fileOwners: owners, plan: null, tasks: [], legacyHistory: [] }] }), { flag: "wx", mode: 0o600 });
  const catalogIdentity = await id(catalogDir);
  await fs.writeFile(path.join(leaseRoot, key + ".owner-source.json"), JSON.stringify({ schemaVersion: 1, workspace: workspaceIdentity, source: { catalogDirCanonicalPath: catalogDir, dirDeviceId: catalogIdentity.deviceId, dirFileId: catalogIdentity.fileId, filename: "workbench-projects.json", projectId: owners.projectId } }), { flag: "wx", mode: 0o600 });
  return { leaseRoot, nonce, leaseIdentity: await id(lock), holderIdentity: await id(holder) };
}

async function installedFreshSingleRunSmoke(workspace) {
  const assert = (await import("node:assert/strict")).default;
  const ai = await import("@earendil-works/pi-ai");
  const wb = await import("legion-runtime/workbench-models");
  const { createPiAgentService } = await import("legion-runtime/services/pi-agent");
  const core = ai.createFauxCore({ provider: "installed-seed", models: [{ id: "offline" }], tokensPerSecond: 0 });
  core.setResponses([ai.fauxAssistantMessage("current task completed")]);
  const instance = new wb.AgentInstance({ instanceId: "fresh-installed", name: "worker", sessionId: "fresh-session",
    roleId: "Backend", taskId: "current-task", organizationVersion: "current-org" });
  const calls = [];
  const options = { instance, proxy: new wb.PiConnection({ provider: core.provider, model: "offline" }),
    scope: new wb.AgentScope({ write: ["backend/current.txt"], tools: ["legion_write_file"] }),
    cwd: workspace, lifecycle: "single_run", modelProviders: { [core.provider]: {
      api: core.api, baseUrl: "https://legion.invalid", apiKey: "fixture-only",
      models: core.models.map(({ id, name, reasoning, input, cost, contextWindow, maxTokens }) =>
        ({ id, name, reasoning, input, cost, contextWindow, maxTokens })),
      streamSimple: (model, context, requestOptions) => {
        calls.push(JSON.stringify(context));
        return core.streamSimple(model, context, requestOptions);
      }
    } } };
  const history = new wb.PiConversationHistory({ messages: [
    { role: "user", text: "previous question with options a and b" },
    { role: "assistant", text: "plain previous task notes; a was selected" }
  ] });
  const checkpoint = new wb.PiConversationCheckpoint({ instance,
    profileId: "legacy:installed-seed/offline", profileVersion: "current-org", history });
  assert.throws(() => new wb.PiConversationHistory({ messages: [{ role: "toolResult", text: "old grant yes" }] }), TypeError);
  const service = await createPiAgentService(options);
  try {
    await assert.rejects(service.restore_history({ ...checkpoint }), /history_binding_mismatch/);
    await assert.rejects(service.restore_history(new wb.PiConversationCheckpoint({ instance,
      profileId: checkpoint.profileId, profileVersion: "old-connection", history })), /history_binding_mismatch/);
    const previousInstance = new wb.AgentInstance({ ...instance, instanceId: "previous-instance" });
    await assert.rejects(service.restore_history(new wb.PiConversationCheckpoint({ instance: previousInstance,
      profileId: checkpoint.profileId, profileVersion: checkpoint.profileVersion, history })), /history_binding_mismatch/);
    await service.restore_history(checkpoint);
    assert.equal(calls.length, 0, "restore_must_not_call_model");
    await assert.rejects(service.restore_history(checkpoint), /single_run_history_restore_unavailable/);
    service.start_run("current-run", "current confirmed task input");
    await assert.rejects(service.restore_history(checkpoint), /single_run_history_restore_unavailable/);
    let terminal;
    for (;;) {
      const event = await service.next_event("current-run", { signal: AbortSignal.timeout(5000) });
      assert.notEqual(event.type, "tool_request", "plain_seed_must_not_replay_tools");
      if (["run_finished", "run_failed", "run_cancelled"].includes(event.type)) { terminal = event; break; }
    }
    assert.equal(terminal.type, "run_finished", JSON.stringify(terminal));
    assert.equal(terminal.result.status, "completed");
    assert.equal(terminal.result.assistantText, "current task completed");
    assert.equal(calls.length, 1);
    const modelContext = JSON.parse(calls[0]);
    assert.deepEqual(modelContext.messages.flatMap(message => message.toolsAdded ?? []).map(tool => tool.name), ["legion_write_file"]);
    assert.ok(modelContext.messages.every(message => message.role !== "toolResult"));
    assert.match(calls[0], /previous question with options a and b/);
    assert.match(calls[0], /plain previous task notes; a was selected/);
    assert.match(calls[0], /current confirmed task input/);
    await assert.rejects(service.restore_history(checkpoint), /single_run_history_restore_unavailable/);
    assert.throws(() => service.start_run("second-run", "cannot reuse old instance"), /not_ready/);
  } finally { await service.close(); await service.close(); }
  const lengthCore = ai.createFauxCore({ provider: "installed-seed", models: [{ id: "offline" }], tokensPerSecond: 0 });
  lengthCore.setResponses([ai.fauxAssistantMessage("incomplete summary", { stopReason: "length" })]);
  const lengthOptions = { ...options, instance: new wb.AgentInstance({ ...instance, instanceId: "length-instance" }),
    modelProviders: { [core.provider]: { ...options.modelProviders[core.provider], streamSimple: lengthCore.streamSimple } } };
  const lengthService = await createPiAgentService(lengthOptions);
  try {
    lengthService.start_run("length-run", "summary must finish");
    let terminal;
    for (;;) {
      const event = await lengthService.next_event("length-run", { signal: AbortSignal.timeout(5000) });
      if (["run_finished", "run_failed", "run_cancelled"].includes(event.type)) { terminal = event; break; }
    }
    assert.equal(terminal.type, "run_failed");
    assert.equal(terminal.result.status, "failed");
    assert.equal(terminal.result.errorCode, "pi_model_error");
  } finally { await lengthService.close(); }
  return { runtime: process.versions, freshSingleRunSeed: true, bindingRejected: true,
    repeatedRestoreRejected: true, activeAndFinishedRestoreRejected: true, oldToolSeedRejected: true,
    currentToolOnly: true, restoredTextInActualSdkCall: true, lengthStopFailed: true,
    fixtureModelCalls: calls.length + lengthCore.state.callCount, paidModelCalls: 0 };
}

async function installedPublicImageFacadeSmoke(base) {
  const assert = (await import('node:assert/strict')).default;
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const {createWorkbenchPipeline,createHeadlessWorkbenchPipeline} = await import('legion-runtime/headless-workbench');
  await fs.mkdir(base,{recursive:true});
  const directory=await fs.mkdtemp(path.join(base,'installed-image-facade-'));
  const desktop=createWorkbenchPipeline({userDataDir:path.join(directory,'desktop'),leaseRoot:path.join(directory,'desktop-leases')});
  const headless=createHeadlessWorkbenchPipeline({userDataDir:path.join(directory,'headless'),leaseRoot:path.join(directory,'headless-leases'),profile:{protocol:'openai-completions',provider:'local',modelId:'local',baseUrl:'http://127.0.0.1:1/v1',env:{LEGION_API_KEY:'installed-image-facade-fixture'}}});
  try {
    const methods=['stageImage','discardImage','readImagePreview'];
    for(const [name,host] of [['desktop',desktop],['headless',headless]]) {
      assert.equal(Object.isFrozen(host),true,name+' public facade must be finite');
      for(const method of methods)assert.equal(typeof host[method],'function',name+' public image method missing:'+method);
    }
    return {desktop:true,headless:true,methods,source:'actual-installed-public-factories'};
  } finally {await desktop.close();await headless.close();}
}

async function installedShellSmoke(base) {
  const assert = (await import('node:assert/strict')).default;
  const fs = (await import('node:fs')).promises;
  const path = await import('node:path');
  const { createHash } = await import('node:crypto');
  const wb = await import('legion-runtime/workbench-models');
  const { createShellService, ShellService } = await import('legion-runtime/services/shell');
  const { createMutationService } = await import('legion-runtime/services/mutation');
  const runtime = await fs.realpath(process.execPath);
  await fs.mkdir(base, { recursive: true });
  const root = await fs.mkdtemp(path.join(base, 'installed-shell-'));
  const workspaceRoot = path.join(root, 'workspace');
  const outputRoot = path.join(root, 'private');
  const lockRoot = path.join(root, 'locks');
  for (const directory of [workspaceRoot, outputRoot, lockRoot]) await fs.mkdir(directory);
  await fs.mkdir(path.join(workspaceRoot, 'local'));
  await fs.writeFile(path.join(workspaceRoot, 'owned.txt'), 'original\n');
  await fs.writeFile(path.join(workspaceRoot, 'removed.txt'), 'remove with exact baseline\n');
  await fs.writeFile(path.join(workspaceRoot, 'asset.png'), Buffer.from([137, 80, 0]));
  await fs.writeFile(path.join(workspaceRoot, 'package.json'), JSON.stringify({ name: 'installed-shell-fixture', version: '1.3.1',
    scripts: { build: 'node -e "require(\'node:fs\').mkdirSync(\'dist\',{recursive:true});require(\'node:fs\').writeFileSync(\'dist/result.txt\',\'built\')"' } }));
  await fs.writeFile(path.join(workspaceRoot, 'local/package.json'), JSON.stringify({ name: 'installed-shell-local', version: '1.3.1', bin: { 'installed-bin': 'bin.js' } }));
  await fs.writeFile(path.join(workspaceRoot, 'local/bin.js'), '#!/usr/bin/env node\nconsole.log("local installed dependency");\n');
  const stat = await fs.lstat(workspaceRoot, { bigint: true });
  const workspaceIdentity = { canonicalPath: workspaceRoot, deviceId: String(stat.dev), fileId: String(stat.ino) };
  const roleId = 'ProjectManager';
  const taskId = 'installed-shell-package';
  const organizationVersion = 'fixture-v1';
  const profileVersion = 'fixture-profile';
  const planDigest = 'a'.repeat(64);
  const inputResources = ['asset.png', 'local/bin.js', 'local/package.json', 'owned.txt', 'package.json', 'removed.txt'];
  const ownedResources = ['asset.png', 'owned.txt', 'removed.txt'];
  const fileOwners = new wb.ProjectFileOwners({ projectId: 'installed-shell', version: 'owners-v1',
    owners: ownedResources.map(resource => ({ resource, roleId })) });
  const tools = ['legion_request_shell'];
  const artifactScopes = [{ scope: 'node_modules/', kind: 'dependencies' }, { scope: 'dist/', kind: 'build' }];
  const generatedEffects = ['dist/', 'node_modules/'];
  const boundary = new wb.RoleBoundary({ roleId, writeScope: ownedResources, tools, capabilities: ['request_shell'] });
  const { controller, mutationAuthority } = wb.createWorkbenchAuthority({ workspaceIdentity, organizationVersion, profileVersion,
    boundaries: [boundary], fileOwners });
  const confirmation = new wb.ContextReadConfirmation({ confirmationId: 'package-read', workspaceIdentity, organizationVersion,
    profileVersion, contextReadSet: [] });
  const readAuthority = controller.confirmContextRead(confirmation);
  const context = new wb.ContextSnapshot({ confirmationDigest: confirmation.digest, workspaceIdentity, organizationVersion,
    profileVersion, files: [] });
  controller.bindContextSnapshot(readAuthority, context);
  const taskApproval = controller.confirmTask(new wb.ConfirmedTaskGrant({ confirmationId: 'package-task', workspaceIdentity,
    organizationVersion, profileVersion, roleId, taskId, ownerGeneration: fileOwners.version, tools, generatedEffects, artifactScopes,
    planDigest, contextSnapshotDigest: context.digest, fileOwnersDigest: fileOwners.digest }));
  const session = new wb.AgentSession({ sessionId: 'installed-shell-session', roleId, taskId, organizationVersion });
  const dispatchContext = new wb.TaskDispatchContext({ roleId, taskId, organizationVersion, fileOwnersDigest: fileOwners.digest, ownerGeneration: fileOwners.version, tools, generatedEffects });
  const scope = new wb.AgentScope({ write: ownedResources, tools, generatedEffects });
  controller.registerInstance({ taskApproval, instanceId: 'installed-shell-instance', session, dispatchContext, scope });
  controller.beginRun('installed-shell-instance', 'installed-shell-run');
  const request = new wb.ShellRequest({ requestId: 'installed-shell-request', runId: 'installed-shell-run', reason: 'real installed package native/npm/publication smoke',
    command: 'printf "approved\\n" > owned.txt && node -e \'require("node:fs").writeFileSync("asset.png",Buffer.from([255,0,128,89]))\' && rm removed.txt && npm install ./local --install-links --no-save --package-lock=false --ignore-scripts --no-audit --no-fund && npm run build',
    generatedEffects, network: 'none', timeoutSeconds: 60 });
  const review = new wb.ShellReview({ requestId: request.requestId, requestDigest: request.digest, revision: 1, approved: true,
    reason: 'private fixture Host recorded exact reviewed command and plan' });
  const lifetime = new AbortController();
  const registry = { request, review, authorization: null, consumed: false };
  const phases = [];
  const output = [];
  const knownKey = "installed-current-key-canary-5ab019";
  const service = createShellService({ workspaceRoot, outputRoot, lockRoot, runtimeExecutable: runtime, artifactScopes, knownKeys: [knownKey],
    authorizationValidator: { async validate(current, authorization, decision, { phase, signal }) {
      phases.push(phase);
      let allowed = !signal.aborted && !lifetime.signal.aborted && current === registry.request && decision === registry.review &&
        authorization === registry.authorization && decision.approved && Date.parse(authorization.expiresAt) > Date.now() &&
        authorization.fileOwnersDigest === fileOwners.digest && authorization.planDigest === planDigest && authorization.contextSnapshotDigest === context.digest;
      if (phase === 'consume') {
        if (registry.consumed) allowed = false;
        if (allowed) registry.consumed = true;
      }
      return { decision: new wb.ShellDecision({ requestId: current.requestId, runId: current.runId, requestDigest: current.digest,
        allowed, reason: 'actual_private_fixture_registry' }), authorization, review: decision, signal: lifetime.signal };
    } } });
  const mutation = createMutationService({ workspace: workspaceRoot, authority: mutationAuthority, leaseContext: await installedLease(workspaceRoot, fileOwners) });
  try {
    assert.ok(service instanceof ShellService);
    assert.ok(Number.isSafeInteger(service.observeTime()) && service.observeTime() >= 0);
    assert.ok(Number.isSafeInteger(mutation.observeTime()) && mutation.observeTime() >= 0);
    const preparation = await service.prepare(request);
    assert.ok(preparation instanceof wb.ShellPreparation);
    assert.notEqual(preparation.actualCwd, workspaceRoot);
    const authorization = new wb.ShellAuthorization({ authorizationId: 'installed-shell-authorization', projectId: fileOwners.projectId,
      prepareId: preparation.prepareId, organizationVersion, roleId, taskId, sessionId: session.sessionId,
      instanceId: 'installed-shell-instance', runId: request.runId, profileVersion, expiresAt: new Date(Date.now() + 60000).toISOString(),
      requestDigest: request.digest, reviewDigest: review.digest, planDigest, contextSnapshotDigest: context.digest,
      fileOwners: { projectId: fileOwners.projectId, version: fileOwners.version, owners: fileOwners.owners }, fileOwnersDigest: fileOwners.digest,
      snapshotDigest: preparation.snapshotDigest, generationDigest: preparation.generationDigest, workspaceIdentity,
      inputVersions: preparation.inputVersions, ownerGeneration: fileOwners.version, generatedEffects, artifactScopes, authoredResources: inputResources });
    registry.authorization = authorization;
    const pair = await service.run(request, authorization, review, { onOutput: item => { output.push({ stream: item.stream, truncated: item.truncated }); } });
    assert.equal(pair.result.status, 'ready_for_publication', JSON.stringify(pair));
    assert.equal(pair.result.executed, true);
    assert.equal(pair.result.exitCode, 0);
    assert.deepEqual(pair.result.candidates.map(candidate => candidate.resource).sort(), ownedResources);
    assert.deepEqual(phases, ['approve', 'consume', 'publication']);
    assert.equal(await fs.readFile(path.join(workspaceRoot, 'owned.txt'), 'utf8'), 'original\n');
    const receipt = await service.publicationReceipt(request.requestId);
    assert.equal(JSON.stringify(receipt), '{}');
    const results = [];
    for (const candidate of pair.result.candidates) {
      const parameters = { proposalId: 'published-' + candidate.resource, resource: candidate.resource,
        expectedBaseline: candidate.baseline, tool: 'legion_shell_publish', capability: 'request_shell', session, runId: request.runId };
      if (candidate.action === 'delete') parameters.action = 'delete_file';
      else {
        parameters.action = 'write_file';
        parameters.executable = candidate.executable;
        const data = await service.readCandidateData(request.requestId, candidate.resource);
        if (data.encoding === 'base64') parameters.contentBase64 = data.contentBase64;
        else parameters.content = data.content;
      }
      const proposal = new wb.ActionProposal(parameters);
      assert.throws(() => controller.issueShellPublication(proposal, {}, service.observeTime()), error => error instanceof TypeError && error.message === "invalid_or_revoked_shell_publication");
      const permit = controller.issueShellPublication(proposal, receipt, service.observeTime());
      const observed = await mutation.execute(proposal, permit);
      assert.equal(observed.success, true, JSON.stringify(observed));
      assert.equal((await mutation.execute(proposal, permit)).status, 'denied');
      results.push(observed);
    }
    const generatedResult = await service.publishGenerated(request.requestId);
    assert.equal(generatedResult.status, 'published', JSON.stringify(generatedResult));
    const final = await service.finishPublication(request.requestId, { results, generatedResult });
    assert.equal(final.status, 'published', JSON.stringify(final));
    assert.equal(await fs.readFile(path.join(workspaceRoot, 'owned.txt'), 'utf8'), 'approved\n');
    assert.deepEqual(await fs.readFile(path.join(workspaceRoot, 'asset.png')), Buffer.from([255, 0, 128, 89]));
    await assert.rejects(fs.lstat(path.join(workspaceRoot, 'removed.txt')), error => error.code === 'ENOENT');
    assert.equal(await fs.readFile(path.join(workspaceRoot, 'dist/result.txt'), 'utf8'), 'built');
    const bin = path.join(workspaceRoot, 'node_modules/.bin/installed-bin');
    assert.ok((await fs.lstat(bin)).isSymbolicLink());
    assert.ok((await fs.realpath(bin)).startsWith(path.join(workspaceRoot, 'node_modules') + '/'));
    assert.notEqual(final.generationDigest, preparation.generationDigest);
    const replay = await service.run(request, authorization, review);
    assert.equal(replay.result.executed, false);
    const serialized = JSON.stringify(final);
    for (const privateField of ['contentBase64', 'publicationReceipt', 'authorizationId']) assert.equal(serialized.includes(privateField), false);
    async function dependencyTree(directory) {
      const values = [];
      async function visit(current, resource) {
        const info = await fs.lstat(current, { bigint: true });
        const item = { resource, inode: String(info.ino), mode: Number(info.mode & 0o777n), kind: 'directory' };
        if (info.isSymbolicLink()) { item.kind = 'link'; item.target = await fs.readlink(current); }
        else if (info.isFile()) { item.kind = 'file'; item.sha256 = createHash('sha256').update(await fs.readFile(current)).digest('hex'); }
        else assert.ok(info.isDirectory());
        values.push(item);
        if (info.isDirectory()) for (const entry of (await fs.readdir(current)).sort()) await visit(path.join(current, entry), resource + '/' + entry);
      }
      await visit(directory, 'node_modules'); return values;
    }
    const dependenciesBefore = await dependencyTree(path.join(workspaceRoot, 'node_modules'));
    async function approveNext(id, command) {
      const next = new wb.ShellRequest({ requestId: id, runId: request.runId, reason: 'installed dependency-read repair smoke', command,
        generatedEffects: ['dist/'], network: 'none', timeoutSeconds: 60 });
      const prepared = await service.prepare(next);
      const reviewed = new wb.ShellReview({ requestId: id, requestDigest: next.digest, revision: 2, approved: true,
        reason: 'private fixture permits only dist publication and fixed dependency reads' });
      const authorized = new wb.ShellAuthorization({ ...authorization, authorizationId: id + '-authorization', prepareId: prepared.prepareId,
        requestDigest: next.digest, reviewDigest: reviewed.digest, expiresAt: new Date(Date.now() + 60000).toISOString(),
        inputVersions: prepared.inputVersions, snapshotDigest: prepared.snapshotDigest, generationDigest: prepared.generationDigest,
        generatedEffects: ['dist/'] });
      registry.request = next; registry.review = reviewed; registry.authorization = authorized; registry.consumed = false;
      return { next, prepared, reviewed, authorized };
    }
    const reuse = await approveNext('installed-only-dist', 'node_modules/.bin/installed-bin > dist/reused.txt');
    const reused = await service.run(reuse.next, reuse.authorized, reuse.reviewed);
    assert.equal(reused.result.status, 'ready_for_publication', JSON.stringify(reused));
    assert.equal(reused.result.candidates.length, 0);
    assert.deepEqual(reused.result.generatedEffects, ['dist/']);
    const reusedGenerated = await service.publishGenerated(reuse.next.requestId);
    assert.equal(reusedGenerated.status, 'published', JSON.stringify(reusedGenerated));
    const reusedFinal = await service.finishPublication(reuse.next.requestId, { results: [], generatedResult: reusedGenerated });
    assert.equal(reusedFinal.status, 'published', JSON.stringify(reusedFinal));
    assert.deepEqual(reusedFinal.publishedResources.map(item => item.resource), ['dist']);
    assert.equal(await fs.readFile(path.join(workspaceRoot, 'dist/reused.txt'), 'utf8'), 'local installed dependency\n');
    assert.deepEqual(await dependencyTree(path.join(workspaceRoot, 'node_modules')), dependenciesBefore);
    const misuse = await approveNext('installed-readonly-change', 'printf changed > node_modules/installed-shell-local/bin.js && printf unsafe > dist/should-not-publish.txt');
    const refused = await service.run(misuse.next, misuse.authorized, misuse.reviewed);
    assert.equal(refused.result.status, 'error', JSON.stringify(refused));
    assert.equal(refused.result.reason, 'shell_readonly_dependency_changed');
    assert.equal(refused.result.candidates.length, 0);
    assert.deepEqual(refused.result.generatedEffects, []);
    await assert.rejects(fs.lstat(path.join(workspaceRoot, 'dist/should-not-publish.txt')), error => error.code === 'ENOENT');
    assert.deepEqual(await dependencyTree(path.join(workspaceRoot, 'node_modules')), dependenciesBefore);
    const poisoned = new wb.ShellRequest({ requestId: 'installed-key-command', runId: request.runId, reason: 'known-key input must fail before mirror', command: 'printf safe', network: 'none', timeoutSeconds: 10 });
    await fs.writeFile(path.join(workspaceRoot, 'poisoned-input.txt'), knownKey);
    await assert.rejects(service.prepare(poisoned), /shell_known_key_input_rejected/);
    const { createCheckService } = await import('legion-runtime/services/check');
    const checkService = createCheckService({ workspaceRoot, outputRoot, lockRoot, runtimeExecutable: runtime, knownKeys: [knownKey], authorizationValidator: { validate() { throw new Error('unused private registry'); } } });
    await checkService.close();
    return { installedKnownKeyShellInputRejected: true, installedCheckPrivateKeyOptions: true, runtime: { node: process.versions.node, electron: process.versions.electron ?? null, executable: runtime },
      backend: 'macos-seatbelt-permission-signature', actualNodeChild: true, realOfflineNpmInstall: true, generatedBuild: true,
      publicWorkbenchPublication: true, freshHostTimeFacts: true, binaryBytes: 4, deletedMissing: true, replayDenied: true, onlyDistReadsExistingBin: true,
      readonlyDependencyInodeBytesLinkModeUnchanged: true, readonlyDependencyModificationRejected: true, phases, outputFrames: output.length,
      publishedResources: final.publishedResources, generationDigest: final.generationDigest, npmCli: await fs.realpath(path.join(path.dirname(runtime), '../lib/node_modules/npm/bin/npm-cli.js')) };
  } finally {
    lifetime.abort();
    await service.close();
    await mutation.close();
    assert.equal(await fs.realpath(root), root);
    await fs.rm(root, { recursive: true });
  }
}

async function installedSuControlSmoke(base) {
  const assert = (await import('node:assert/strict')).default;
  const fs = (await import('node:fs')).promises;
  const path = await import('node:path');
  const { createServer } = await import('node:http');
  const wb = await import('legion-runtime/workbench-models');
  const { createPiAgentService } = await import('legion-runtime/services/pi-agent');
  const { Compile } = await import('typebox/compile');
function sse(protocol, text, model) {
  if (protocol === "openai-completions") {
    const first = { id: "chat-1", object: "chat.completion.chunk", created: 1, model,
      choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }] };
    const last = { ...first, choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
    return "data: " + JSON.stringify(first) + "\n\ndata: " + JSON.stringify(last) + "\n\ndata: [DONE]\n\n";
  }
  const events = [];
  if (protocol === "anthropic-messages") {
    events.push({ type: "message_start", message: { id: "msg1", type: "message", role: "assistant",
      model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } },
    { type: "message_stop" });
  } else {
    const item = { id: "item1", type: "message", role: "assistant", status: "in_progress", content: [] };
    const content = { type: "output_text", text, annotations: [] };
    const response = { id: "resp1", object: "response", created_at: 1, model, status: "in_progress", output: [] };
    events.push({ type: "response.created", response },
      { type: "response.output_item.added", output_index: 0, item },
      { type: "response.content_part.added", item_id: "item1", output_index: 0, content_index: 0,
        part: { ...content, text: "" } },
      { type: "response.output_text.delta", item_id: "item1", output_index: 0, content_index: 0, delta: text },
      { type: "response.output_text.done", item_id: "item1", output_index: 0, content_index: 0, text },
      { type: "response.content_part.done", item_id: "item1", output_index: 0, content_index: 0, part: content },
      { type: "response.output_item.done", output_index: 0, item: { ...item, status: "completed", content: [content] } },
      { type: "response.completed", response: { ...response, status: "completed",
        output: [{ ...item, status: "completed", content: [content] }],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } });
  }
  return events.map((value) => "event: " + value.type + "\ndata: " + JSON.stringify(value) + "\n\n").join("");
}

function toolSse(protocol,model,tool,parameters){
 const args=JSON.stringify(parameters),id="tool-shell";
 if(protocol==="openai-completions") {
  const first={id:"chat",object:"chat.completion.chunk",created:1,model,choices:[{index:0,delta:{role:"assistant",tool_calls:[{index:0,id,type:"function",function:{name:tool,arguments:args}}]},finish_reason:null}]};
  const last={...first,choices:[{index:0,delta:{},finish_reason:"tool_calls"}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}};
  return "data: "+JSON.stringify(first)+"\n\ndata: "+JSON.stringify(last)+"\n\ndata: [DONE]\n\n";
 }
 let events=[];
 if(protocol==="anthropic-messages") {
  events=[{type:"message_start",message:{id:"msg",type:"message",role:"assistant",model,content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:1,output_tokens:0}}},
   {type:"content_block_start",index:0,content_block:{type:"tool_use",id,name:tool,input:{}}},
   {type:"content_block_delta",index:0,delta:{type:"input_json_delta",partial_json:args}},
   {type:"content_block_stop",index:0},{type:"message_delta",delta:{stop_reason:"tool_use",stop_sequence:null},usage:{output_tokens:1}},{type:"message_stop"}];
 } else {
  const response={id:"resp",object:"response",created_at:1,model,status:"in_progress",output:[]};
  const item={id:"fc_shell",type:"function_call",call_id:id,name:tool,arguments:"",status:"in_progress"};
  events=[{type:"response.created",response},{type:"response.output_item.added",output_index:0,item},
   {type:"response.function_call_arguments.delta",item_id:item.id,output_index:0,delta:args},
   {type:"response.function_call_arguments.done",item_id:item.id,output_index:0,arguments:args},
   {type:"response.output_item.done",output_index:0,item:{...item,arguments:args,status:"completed"}},
   {type:"response.completed",response:{...response,status:"completed",output:[{...item,arguments:args,status:"completed"}],usage:{input_tokens:1,output_tokens:1,total_tokens:2}}}];
 }
 return events.map(value=>"event: "+value.type+"\ndata: "+JSON.stringify(value)+"\n\n").join("");
}

  await fs.mkdir(base, { recursive: true });
  const results = [];
  for (const protocol of ['openai-completions', 'openai-responses', 'anthropic-messages']) {
    for (const tool of ['legion_delegate_pm', 'legion_query_role_activity', 'legion_query_role_log']) {
      const directory = await fs.mkdtemp(path.join(base, 'installed-sdk-su-'));
      const requests = [];
      const roleId = 'Supervisor';
      const lifecycle = 'conversation';
      let payload = {};
      if (tool === 'legion_delegate_pm') payload = { action: 'start', purpose: 'plan', instruction: 'Bounded recorded customer request', sourceRefs: ['human:fixture'] };
      if (tool === 'legion_query_role_log') payload = { roleId: 'Backend', limit: 20 };
      const parameters = { payload };
      const server = createServer(async (request, response) => {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        requests.push(body);
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        if (requests.length === 1) response.end(toolSse(protocol, body.model, tool, parameters));
        else response.end(sse(protocol, 'continued original role', body.model));
      });
      await new Promise(done => server.listen(0, '127.0.0.1', done));
      let service;
      try {
        const instance = new wb.AgentInstance({ instanceId: protocol + '-' + tool, sessionId: 'session-' + tool,
          name: roleId, roleId, taskId: 'package-schema', organizationVersion: 'fixture-v1' });
        const connection = new wb.PiConnectionProfile({ profileId: protocol, profileVersion: 'v1', protocol,
          provider: 'package-fixture', model: 'custom-model', baseUrl: 'http://127.0.0.1:' + server.address().port + '/v1' });
        service = await createPiAgentService({ instance, connection, credentials: { apiKey: 'local-package-fixture' },
          proxy: new wb.PiConnection({ provider: connection.provider, model: connection.model }),
          scope: new wb.AgentScope({ write: [], tools: [tool] }), cwd: directory, lifecycle,
          budgets: { turnTimeoutMs: 10000, maxOutputTokens: 2048, maxTextCharsPerTurn: 65536, maxQueueEvents: 256 } });
        for (const name of ['start_run', 'next_event', 'respond_tool', 'cancel_turn', 'get_history', 'restore_history', 'cancel', 'close']) assert.equal(typeof service[name], 'function');
        service.start_run('package-run', 'approved fixture task');
        let pending;
        for (;;) {
          const event = await service.next_event('package-run', { signal: AbortSignal.timeout(10000) });
          if (event.type === 'tool_request') { pending = event.request; break; }
          assert.equal(['run_failed', 'run_cancelled', 'run_finished'].includes(event.type), false, JSON.stringify(event));
        }
        assert.equal(pending.tool, tool);
        assert.equal(requests[0].tools.length, 1);
        let schema = requests[0].tools[0].parameters;
        if (protocol === 'openai-completions') schema = requests[0].tools[0].function.parameters;
        if (protocol === 'anthropic-messages') schema = requests[0].tools[0].input_schema;
        assert.equal(Compile(schema).Check(parameters), true);
        if (protocol === 'anthropic-messages') assert.equal(schema.additionalProperties, undefined);
        else assert.equal(Compile(schema).Check({ ...parameters, permit: {} }), false);
        assert.throws(() => new wb.PiToolRequest({ ...pending, requestId: 'forged', toolCallId: 'forged', parameters: { ...parameters, callerRoleId: 'ProjectManager' } }), TypeError);
        const binding = { requestId: pending.requestId, runId: pending.runId, tool };
        let hostPayload = { snapshotRevision: 1, events: [{ eventId: 'event-one', tool: 'legion_read_file', resource: 'backend/x.mjs', status: 'read' }], nextCursor: null };
        if (tool === 'legion_delegate_pm') hostPayload = { kind: 'needs_human', delegationId: 'fixture-delegation', questionRef: 'fixture-question', status: 'awaiting_human' };
        const result = new wb.PiToolResult({ requestId: binding.requestId, runId: binding.runId,
          decision: new wb.AgentControlDecision({ ...binding, allowed: true, reason: 'private_fixture_control_only' }),
          result: new wb.AgentControlResult({ ...binding, status: 'completed', reason: 'private_fixture_control_only', payload: hostPayload }) });
        if (tool === 'legion_delegate_pm') assert.equal(result.result.payload.status, 'awaiting_human');
        assert.throws(() => new wb.PiToolRequest({ ...pending, requestId: 'forged-payload', toolCallId: 'forged-payload', parameters: { payload: { ...payload, callerRoleId: 'ProjectManager' } } }), TypeError);
        service.respond_tool(pending, result);
        assert.throws(() => service.respond_tool(pending, result), /invalid_or_late/);
        for (;;) {
          const event = await service.next_event('package-run', { signal: AbortSignal.timeout(10000) });
          if (['run_finished', 'run_failed', 'run_cancelled'].includes(event.type)) {
            assert.equal(event.result.status, 'completed', JSON.stringify(event));
            assert.equal(event.result.assistantText, 'continued original role');
            assert.equal(event.result.toolResults[0], result); break;
          }
        }
        assert.equal(requests.length, 2);
        for (const privateName of ['authorizationId', 'publicationReceipt', 'contentBase64', 'readCandidateData']) assert.equal(JSON.stringify(requests[1]).includes(privateName), false);
        results.push({ protocol, tool, finalResultOnly: true, samePending: true, schema: true, source: 'installed-sdk-1.0.4' });
      } finally {
        if (service) await service.close();
        server.closeAllConnections(); await new Promise(done => server.close(done));
        assert.equal(await fs.realpath(directory), directory);
        await fs.rm(directory, { recursive: true });
      }
    }
  }
  return { results, paidModelCalls: 0, totalActualLocalRequests: 18, lifecyclePublicMethods: 8 };
}


async function installedSmoke(expectedModels, expectedServices) {
  const assert = (await import("node:assert/strict")).default;
  const fs = (await import("node:fs")).promises;
  const path = await import("node:path");
  const { createHash } = await import("node:crypto");
  globalThis.fetch = () => { throw new Error("package smoke forbids network"); };
  const api = await import("legion-runtime");
  assert.deepEqual(Object.keys(api).sort(), ["createRuntime", "AgentSession", "ActionProposal",
    "RoleBoundary", "Outcome", "AgentScope", "PiConnection", "TaskDispatchContext"].sort());
  const ai = await import("@earendil-works/pi-ai");
  const sdk = await import("@earendil-works/pi-coding-agent");
  assert.equal(typeof sdk.createAgentSession, "function");
  const wb = await import("legion-runtime/workbench-models");
  assert.deepEqual(Object.keys(wb).sort(), expectedModels);
  for (const [name, names] of Object.entries(expectedServices)) {
    const service = await import("legion-runtime/services/" + name);
    assert.deepEqual(Object.keys(service).sort(), names.sort());
  }
  for (const dependency of ["legion-runtime", "@earendil-works/pi-ai", "@earendil-works/pi-coding-agent"]) {
    const resolved = (await import("node:url")).fileURLToPath(import.meta.resolve(dependency));
    assert.ok(resolved.startsWith(path.join(process.cwd(), "node_modules") + path.sep), "isolated_dependency_origin:" + dependency);
  }
  assert.equal(wb.AgentSession, api.AgentSession);
  assert.equal(wb.RoleBoundary, api.RoleBoundary);
  const owners = new wb.ProjectFileOwners({ projectId: "customer", version: "v1", owners: [
    { resource: "src/api.ts", roleId: "Backend" }] });
  assert.throws(() => new wb.FileOwnershipPlan({ projectId: "customer", baseVersion: "v1",
    baseDigest: owners.digest, nextVersion: "v2", claims: [
      { resource: "src/api.ts", roleId: "Backend" }, { resource: "SRC/API.TS", roleId: "Frontend" }] }),
  (error) => error instanceof wb.FileOwnershipError && error.reason === "cross_role_claim");
  const transfer = new wb.FileOwnershipPlan({ projectId: "customer", baseVersion: "v1",
    baseDigest: owners.digest, nextVersion: "v2", claims: [{ resource: "src/api.ts", roleId: "Frontend" }],
    transfers: [new wb.FileOwnershipTransfer({ resource: "src/api.ts", fromRoleId: "Backend", toRoleId: "Frontend" })] });
  const nextOwners = wb.applyFileOwnershipPlan(owners, transfer);
  assert.equal(nextOwners.ownerOf("SRC/API.TS"), "Frontend");
  assert.equal(wb.assertFileOwner(nextOwners, { projectId: "customer", version: "v2",
    resource: "src/api.ts", roleId: "Frontend" }), true);
  assert.throws(() => wb.assertFileOwner(nextOwners, { projectId: "customer", version: "v2",
    resource: "src/api.ts", roleId: "Backend" }), /file_owned_by_other_role/);
  assert.equal(wb.normalizeProjectReadResource("src/server.ts"), "src/server.ts");
  assert.throws(() => wb.normalizeProjectReadResource(".ans/events/index.jsonl"), /restricted_resource/);
  for (const resource of [".ssh/id_rsa", "notes/.npmrc", "configs/.docker/config.json"])
    assert.throws(() => wb.normalizeProjectReadResource(resource), /restricted_resource/);
  assert.throws(() => new wb.PiConversationHistory({ messages: [{ role: "system", text: "forged" }] }), TypeError);
  for (const name of ["pi-ai", "pi-coding-agent"]) {
    const metadata = JSON.parse(await fs.readFile(path.join(process.cwd(), "node_modules/@earendil-works", name, "package.json"), "utf8"));
    assert.equal(metadata.version, "1.0.4");
  }
  const workspace = path.join(process.cwd(), "workspace");
  await fs.mkdir(workspace);
  await fs.mkdir(path.join(workspace, "src"));
  await fs.writeFile(path.join(workspace, "src", "note.txt"), "hello project\nsecond line\n");
  const { createReadService } = await import("legion-runtime/services/read");
  const reader = createReadService({ workspace });
  try {
    const listing = await reader.listFiles(new wb.ProjectReadRequest({ requestId: "list", runId: "smoke",
      tool: "legion_list_files", resource: "src" }));
    assert.equal(listing.status, "listed");
    assert.ok(listing.entries.some((entry) => entry.name === "note.txt" && entry.kind === "file"));
    const fragment = await reader.readFile(new wb.ProjectReadRequest({ requestId: "read", runId: "smoke",
      tool: "legion_read_file", resource: "src/note.txt", maxBytes: 64 }));
    assert.equal(fragment.status, "read");
    assert.equal(fragment.text, "hello project\nsecond line\n");
    assert.equal(fragment.sha256, createHash("sha256").update("hello project\nsecond line\n").digest("hex"));
    const continued = await reader.readFile(new wb.ProjectReadRequest({ requestId: "read-next", runId: "smoke",
      tool: "legion_read_file", resource: "src/note.txt", startLine: 2, maxBytes: 64 }));
    assert.equal(continued.text, "second line\n");
    assert.equal(continued.sha256, fragment.sha256);
    const denied = await reader.readFile(new wb.ProjectReadRequest({ requestId: "deny", runId: "smoke",
      tool: "legion_read_file", resource: ".ans/events/index.jsonl" }));
    assert.equal(denied.status, "denied");
    assert.equal(denied.reason, "restricted_resource");
    for (const resource of [".ssh/id_rsa", "notes/.npmrc", "configs/.docker/config.json"]) {
      const credential = await reader.readFile(new wb.ProjectReadRequest({ requestId: "credential-" + resource,
        runId: "smoke", tool: "legion_read_file", resource }));
      assert.equal(credential.status, "denied");
      assert.equal(credential.reason, "restricted_resource");
      assert.equal(credential.text, "");
    }
  } finally { await reader.close(); }
  const boundary = new api.RoleBoundary({ roleId: "Backend", writeScope: ["backend/"],
    denyScope: ["backend/private/"], tools: ["legion_write_file", "legion_edit_file"], capabilities: ["write_file"] });
  const conflicting = new api.RoleBoundary({ roleId: "Frontend", writeScope: ["BACKEND/manual.txt"],
    tools: ["legion_write_file"], capabilities: ["write_file"] });
  assert.throws(() => wb.assertDistinctRoleWriteScopes([boundary, conflicting]), /cross_role_write_scope_overlap/);
  const runtimeOwners = new wb.ProjectFileOwners({ projectId: "installed-owner", version: "owners-v2", owners: ["backend/manual.txt", "backend/agent.txt"].map(resource => ({ resource, roleId: "Backend" })) });
  const leaseContext = await installedLease(workspace, runtimeOwners);
  assert.throws(() => new wb.TaskDispatchContext({ roleId: "Backend", taskId: "old-task", organizationVersion: "smoke-v3", writeSet: ["backend/manual.txt"], tools: ["legion_write_file"] }), TypeError);
  const session = new api.AgentSession({ sessionId: "manual", roleId: "Backend", taskId: "manual-task", organizationVersion: "smoke-v3" });
  const manual = api.createRuntime({ workspace, fileOwners: runtimeOwners, leaseContext, boundaries: [boundary], sessions: [session],
    organizationVersion: "smoke-v3", modelProviders: [] });
  const proposal = new api.ActionProposal({ proposalId: "legacy-first", action: "write_file",
    resource: "backend/manual.txt", content: "manual", tool: "legion_write_file",
    capability: "write_file", session });
  try {
    const prepared = await manual.prepare(proposal);
    assert.equal(prepared.decision.outcome, api.Outcome.ALLOW);
    assert.equal((await manual.execute(proposal, prepared.permit)).status, "written");
    assert.equal((await manual.execute(proposal, prepared.permit)).status, "denied");
    const submitted = await manual.submit(new api.ActionProposal({ ...proposal, proposalId: "legacy-second", content: "submitted" }));
    assert.equal(submitted.result.status, "written");
    assert.equal(await manual.readFile("backend/manual.txt"), "submitted");
    const originalSha = createHash("sha256").update("submitted").digest("hex");
    const edit = new api.ActionProposal({ proposalId: "edit-first", action: "edit_file",
      resource: "backend/manual.txt", tool: "legion_edit_file", capability: "write_file", session,
      expectedSha256: originalSha, replacements: [{ oldText: "submitted", newText: "edited" }] });
    const editPrepared = await manual.prepare(edit);
    assert.equal(editPrepared.decision.outcome, api.Outcome.ALLOW);
    const editResult = await manual.execute(edit, editPrepared.permit);
    assert.equal(editResult.status, "written");
    assert.equal(editResult.contentDigest, createHash("sha256").update("edited").digest("hex"));
    assert.equal(await manual.readFile("backend/manual.txt"), "edited");
    assert.equal((await manual.execute(edit, editPrepared.permit)).status, "denied");
    const stale = await manual.submit(new api.ActionProposal({ proposalId: "edit-stale", action: "edit_file",
      resource: "backend/manual.txt", tool: "legion_edit_file", capability: "write_file", session,
      expectedSha256: originalSha, replacements: [{ oldText: "submitted", newText: "overwritten" }] }));
    assert.equal(stale.result.status, "denied");
    assert.equal(stale.result.reason, "edit_sha_mismatch");
    assert.equal(await manual.readFile("backend/manual.txt"), "edited");
  } finally { await manual.close(); }
  const core = ai.createFauxCore({ provider: "fixture", models: [{ id: "offline" }], tokensPerSecond: 0 });
  core.setResponses([
    ai.fauxAssistantMessage(ai.fauxToolCall("legion_write_file", { resource: "backend/agent.txt", content: "real Pi package" }), { stopReason: "toolUse" }),
    ai.fauxAssistantMessage("package complete"),
  ]);
  const models = core.models.map(({ id, name, reasoning, input, cost, contextWindow, maxTokens }) =>
    ({ id, name, reasoning, input, cost, contextWindow, maxTokens }));
  const runtime = api.createRuntime({ workspace, fileOwners: runtimeOwners, leaseContext, boundaries: [boundary], organizationVersion: "smoke-v3",
    dispatchContext: new api.TaskDispatchContext({ roleId: "Backend", taskId: "agent-task",
      organizationVersion: "smoke-v3", fileOwnersDigest: runtimeOwners.digest, ownerGeneration: runtimeOwners.version, tools: ["legion_write_file"] }),
    modelProviders: [{ provider: "fixture", api: core.api, baseUrl: "https://legion.invalid",
      apiKey: "fixture-only", models, streamSimple: core.streamSimple }] });
  try {
    const agent = await runtime.createAgent({ name: "package-worker",
      proxy: new api.PiConnection({ provider: "fixture", model: "offline" }),
      scope: new api.AgentScope({ write: runtimeOwners.owners.map(item => item.resource), deny: [".ans/"], tools: ["legion_write_file"] }) });
    const result = await agent.run({ taskId: "agent-task", prompt: "Write the approved fixture file." });
    assert.equal(result.status, "completed");
    assert.equal(result.toolResults.length, 1);
    assert.equal(result.toolResults[0].result.status, "written");
    assert.equal(core.state.callCount, 2);
    assert.equal(await runtime.readFile("backend/agent.txt"), "real Pi package");
    const events = await runtime.events();
    assert.ok(events.some((event) => event.kind === "mutation_success" && event.resource === "backend/agent.txt"));
    assert.ok(!JSON.stringify(events).includes("fixture-only"));
  } finally { await runtime.close(); }
  const conversationCore = ai.createFauxCore({ provider: "conversation-fixture", models: [{ id: "offline" }], tokensPerSecond: 0 });
  conversationCore.setResponses([ai.fauxAssistantMessage("first reply"), ai.fauxAssistantMessage("second reply")]);
  const instance = new wb.AgentInstance({ instanceId: "package-pm", name: "ProjectManager", sessionId: "package-pm-session",
    roleId: "ProjectManager", taskId: "discussion", organizationVersion: "customer-v1" });
  const { createPiAgentService } = await import("legion-runtime/services/pi-agent");
  const conversation = await createPiAgentService({ instance, proxy: new wb.PiConnection({ provider: conversationCore.provider, model: "offline" }),
    scope: new wb.AgentScope({ write: [], tools: [] }), cwd: workspace, lifecycle: "conversation",
    modelProviders: { [conversationCore.provider]: { api: conversationCore.api, baseUrl: "https://legion.invalid", apiKey: "fixture-conversation",
      models: conversationCore.models.map(({ id, name, reasoning, input, cost, contextWindow, maxTokens }) => ({ id, name, reasoning, input, cost, contextWindow, maxTokens })),
      streamSimple: conversationCore.streamSimple } } });
  try {
    for (const [runId, prompt, text] of [["turn1", "first human", "first reply"], ["turn2", "second human", "second reply"]]) {
      conversation.start_run(runId, prompt);
      for (;;) {
        const event = await conversation.next_event(runId, { signal: AbortSignal.timeout(5000) });
        assert.notEqual(event.type, "tool_request");
        if (["run_finished", "run_failed", "run_cancelled"].includes(event.type)) {
          assert.equal(event.result.status, "completed"); assert.equal(event.result.assistantText, text); break;
        }
      }
    }
    assert.equal(conversation.get_history().messages.length, 4);
    assert.equal(conversationCore.state.callCount, 2);
  } finally { await conversation.close(); }
  const freshSingleRunSeed = await installedFreshSingleRunSmoke(workspace);
  console.log(JSON.stringify({ freshSingleRunSeed, publicImport: true, legacyTypedFlow: true, realPiCalls: core.state.callCount,
    piAiVersion: "1.0.4", piSdkVersion: "1.0.4", networkCalls: 0, workbenchModels: expectedModels.length,
    serviceSubpaths: Object.keys(expectedServices).length, conversationCalls: conversationCore.state.callCount,
    projectRead: true, fileOwnership: true, controlledEdit: true }));
}

const standalonePackageCheck = resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url);
if (standalonePackageCheck) test("public entry exports only supported Interface and input Models", async () => {
  const manifest = JSON.parse(await fs.readFile(join(project, "package.json"), "utf8"));
  const requiredModules = {
    "test:kernel": ["tests/kernel/test_check_models.test.mjs", "tests/kernel/test_check_service.test.mjs", "tests/kernel/test_check_provider.test.mjs", "tests/kernel/test_shell_models.test.mjs", "tests/kernel/test_shell_service.test.mjs", "tests/kernel/test_shell_provider.test.mjs"],
    "test:adapters": ["tests/adapters/test_control_tools.mjs", "tests/adapters/test_shell_tools.mjs"],
    "test:integration": ["tests/integration/test_check_flow.mjs"],
  };
  for (const [script, modules] of Object.entries(requiredModules)) {
    for (const module of modules) {
      assert.ok(manifest.scripts[script].split(/\s+/).includes(module), "missing_normal_test_entry:" + script + ":" + module);
      assert.ok(manifest.scripts.test.split(/\s+/).includes(module), "missing_normal_test_entry:test:" + module);
    }
  }
  const entry = await import("../../runtime.mjs");
  assert.deepEqual(Object.keys(entry).sort(), publicNames);
  const text = await fs.readFile(join(project, "runtime.mjs"), "utf8");
  assert.ok(!text.includes("export *"));
  assert.ok(!text.includes("_authority"));
  const models = await import("../../workbench.mjs");
  assert.deepEqual(Object.keys(models).sort(), modelNames);
  const workbenchText = await fs.readFile(join(project, "workbench.mjs"), "utf8");
  assert.ok(!workbenchText.includes("export *") && !workbenchText.includes("_createRuntimeAuthority"));
});

export async function buildPackageEvidence() {
  await prepareFixture();
  const protectionBefore = await protectedHashes();
  const stableBefore = await fs.readFile(stableTarball);
  const previousBefore = await fs.readFile(previousTarball);
  const previousRuntimeBefore = await fs.readFile(previousRuntimeTarball);
  assert.equal("sha512-" + createHash("sha512").update(stableBefore).digest("base64"),
    "sha512-b4IDAB0/guYLpndKkuXDWFihy5AG+QLjUPdDfqchPvuvuWuFJY5NxAJSY1ogL2TI3w1JJMZ4Bhba1VSZ2v94AA==");
  assert.equal(hash(previousBefore), "9fe38c708833d261ee3f3d7b25e7d66c19f6a4978039d1d8a38e7a31b69350da");
  await fs.writeFile(join(packaging, "protected-before.json"), JSON.stringify(protectionBefore, null, 2) + "\n");
  const runDirectory = await fs.mkdtemp(join(packaging, "smoke-"));
  const consumer = join(runDirectory, "consumer");
  await fs.mkdir(consumer);
  try {
    const expected = expectedPackageFiles();
    const dry = JSON.parse(npm(["pack", "--dry-run", "--json"]))[0];
    assert.deepEqual(dry.files.map((file) => file.path).sort(), expected);
    const packed = JSON.parse(npm(["pack", "--json", "--pack-destination", runDirectory]))[0];
    assert.deepEqual(packed.files.map((file) => file.path).sort(), expected);
    assert.equal(packed.name, "legion-runtime");
    assert.equal(packed.version, "1.3.1");
    const tarball = join(packaging, packed.filename);
    const bytes = await fs.readFile(join(runDirectory, packed.filename));
    try { await fs.writeFile(tarball, bytes, { flag: "wx" }); }
    catch (error) { if (error.code !== "EEXIST") throw error; assert.deepEqual(await fs.readFile(tarball), bytes, "immutable_bridge_tarball_changed"); }
    assert.deepEqual(await fs.readFile(stableTarball), stableBefore, "previous stable package changed");
    assert.deepEqual(await fs.readFile(previousTarball), previousBefore, "previous 0.5 package changed");
    assert.deepEqual(await fs.readFile(previousRuntimeTarball), previousRuntimeBefore, "previous 0.6 package changed");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (!protectionBefore.absent.includes(relative(project, historicalTarball))) {
      assert.equal(hash(await fs.readFile(historicalTarball)), "a83a86499c4aaa7c997d94cabbb697efdc82f81475b622b85307ac682de4d8f0");
    }
    const integrity = "sha512-" + createHash("sha512").update(bytes).digest("base64");
    assert.equal(integrity, packed.integrity);
    const tarballDependency = "file:" + relative(consumer, tarball).replaceAll("\\", "/");
    await fs.writeFile(join(consumer, "package.json"), JSON.stringify({ name: "legion-isolated-consumer",
      private: true, type: "module", dependencies: { "legion-runtime": tarballDependency } }));
    const sourceLock = JSON.parse(await fs.readFile(join(project, "package-lock.json"), "utf8"));
    sourceLock.name = "legion-isolated-consumer";
    sourceLock.version = "1.3.1";
    sourceLock.packages[""] = { name: "legion-isolated-consumer", version: "1.3.1",
      dependencies: { "legion-runtime": tarballDependency } };
    sourceLock.packages["node_modules/legion-runtime"] = { version: "1.3.1", resolved: tarballDependency,
      integrity, dependencies: { "@earendil-works/pi-ai": "1.0.4", "@earendil-works/pi-coding-agent": "1.0.4" },
      bin: { legion: "bin/legion.mjs" }, engines: { node: ">=22.19.0" } };
    await fs.writeFile(join(consumer, "package-lock.json"), JSON.stringify(sourceLock, null, 2) + "\n");
    npm(["ci", "--offline", "--cache", cache], consumer);
    const tree = JSON.parse(npm(["ls", "--all", "--json"], consumer));
    assert.equal(tree.dependencies["legion-runtime"].version, "1.3.1");
    await fs.writeFile(join(consumer, "smoke.mjs"), "const installedLease = " + installedLease.toString() + ";\nconst installedFreshSingleRunSmoke = " + installedFreshSingleRunSmoke.toString() + ";\nawait (" + installedSmoke.toString() + ")(" + JSON.stringify(modelNames) + "," + JSON.stringify(serviceNames) + ");\n");
    const smokeOutput = execute(["smoke.mjs"], consumer);
    const smoke = JSON.parse(smokeOutput.trim());
    assert.equal(smoke.realPiCalls, 2);
    assert.equal(smoke.freshSingleRunSeed.freshSingleRunSeed, true);
    assert.equal(smoke.freshSingleRunSeed.lengthStopFailed, true);
    assert.equal(smoke.projectRead, true);
    assert.equal(smoke.fileOwnership, true);
    assert.equal(smoke.controlledEdit, true);
    await fs.writeFile(join(consumer, "shell-smoke.mjs"), "const installedLease = " + installedLease.toString() + ";\nconst value = await (" + installedShellSmoke.toString() + ")(" + JSON.stringify(join(generated, "fixtures", "desktop-image-input-v1-facade-repair-20261012")) + "); console.log(JSON.stringify(value));\n");
    const shell = JSON.parse(execute(["shell-smoke.mjs"], consumer).trim());
    assert.equal(shell.realOfflineNpmInstall, true);
    assert.equal(shell.publicWorkbenchPublication, true);
    await fs.writeFile(join(consumer,"public-image-facade-smoke.mjs"),"const value = await ("+installedPublicImageFacadeSmoke.toString()+")("+JSON.stringify(join(generated,"fixtures","desktop-image-input-v1-facade-repair-20261012"))+"); console.log(JSON.stringify(value));\n");
    const publicImageFacades=JSON.parse(execute(["public-image-facade-smoke.mjs"],consumer).trim());
    assert.equal(publicImageFacades.desktop,true);assert.equal(publicImageFacades.headless,true);
    assert.deepEqual(publicImageFacades.methods,['stageImage','discardImage','readImagePreview']);
    const installed = join(consumer, "node_modules/legion-runtime");
    const sourceHashes = {};
    for (const file of expected) {
      assert.equal(hash(await fs.readFile(join(installed, file))), hash(await fs.readFile(join(project, file))), "shipped source differs: " + file);
      if (file.endsWith(".mjs")) sourceHashes[file] = hash(await fs.readFile(join(project, file)));
    }
    assert.equal(Object.keys(sourceHashes).length, expected.filter(file => file.endsWith(".mjs")).length);
    const keyGuardSources = {};
    for (const file of ["src/kernel/services/impl/check.mjs", "src/kernel/services/impl/shell.mjs", "src/kernel/providers/impl/check.mjs", "src/kernel/providers/impl/shell.mjs"]) {
      assert.ok(sourceHashes[file], "key_guard_impl_missing:" + file);
      assert.match(await fs.readFile(join(installed, file), "utf8"), /knownKeys/);
      keyGuardSources[file] = sourceHashes[file];
    }
    assert.equal(shell.installedKnownKeyShellInputRejected, true);
    assert.equal(shell.installedCheckPrivateKeyOptions, true);
    const sourceAggregateSha256 = hash(Buffer.from(Object.keys(sourceHashes).sort()
      .map((path) => path + "\t" + sourceHashes[path] + "\n").join(""), "utf8"));
    const readme = await fs.readFile(join(installed, 'README.md'), 'utf8');
    const example = readme.match(/```javascript\r?\n([\s\S]*?)```/);
    assert.ok(example, 'README Su example required');
    await fs.writeFile(join(consumer, 'readme-example.mjs'), example[1]);
    const exampleOutput = execute(['readme-example.mjs'], consumer);
    assert.match(exampleOutput, /Su discussion complete/);
    const readmeExample = true;
    const suWorkflow = 'final fixed cli requires installed-cli-flow.json';
    await fs.writeFile(join(consumer, "su-control-smoke.mjs"), "const value = await (" + installedSuControlSmoke.toString() + ")(" + JSON.stringify(join(generated, "fixtures", "desktop-image-input-v1-facade-repair-20261012")) + "); console.log(JSON.stringify(value));\n");
    const suControls = JSON.parse(execute(["su-control-smoke.mjs"], consumer).trim());
    assert.equal(suControls.results.length, 9);
    assert.equal(suControls.totalActualLocalRequests, 18);
    const published = JSON.parse(await fs.readFile(join(installed, "package.json"), "utf8"));
    assert.deepEqual(published.exports, packageExports);
    assert.deepEqual(published.bin, { legion: "./bin/legion.mjs" });
    for (const dependency of Object.values(published.dependencies)) assert.equal(dependency, "1.0.4");
    const cliOutput = execute([join(installed, published.bin.legion), "demo"], consumer);
    assert.match(cliOutput, /backendWritten=true frontendPreserved=true/);
    assert.equal(cliOutput.split("\n").filter((line) => line.startsWith("{")).length, 23);
    const cliRows = cliOutput.split("\n").filter((line) => line.includes(" / "));
    assert.equal(cliRows.length, 6);
    assert.equal(cliRows.filter((line) => line.includes(" / denied / ")).length, 5);
    const lock = JSON.parse(await fs.readFile(join(consumer, "package-lock.json"), "utf8"));
    for (const [name, entry] of Object.entries(lock.packages)) {
      if (name !== "") assert.ok(entry.integrity, "consumer integrity missing: " + name);
    }
    const evidence = { publicImageFacades, tarball, sha256, integrity, fileCount: packed.files.length,
      publicExports: publicNames, modelExports: modelNames, serviceExports: serviceNames, packageExports,
      packageFiles: expected, sourceHashes, keyGuardSources, sourceAggregateSha256, sourceAggregateAlgorithm: "ordinal /relativePath TAB SHA256 LF UTF-8",
      isolatedInstall: true, smoke, shell, suControls, suWorkflow, readmeExample, cliScenarios: 6, cliEvents: 23,
      consumerLockSha256: createHash("sha256").update(await fs.readFile(join(consumer, "package-lock.json"))).digest("hex") };
    const evidencePath = join(runDirectory, "package-smoke.json");
    await fs.writeFile(evidencePath, JSON.stringify(evidence, null, 2) + "\n");
    await fs.rename(evidencePath, join(packaging, "package-smoke.json"));
    console.log("PACKAGE_EVIDENCE " + JSON.stringify(evidence));
  } finally {
    await guardedRemove(runDirectory);
    const protectionAfter = await protectedHashes();
    assert.deepEqual(await fs.readFile(stableTarball), stableBefore, "previous stable package changed");
    assert.deepEqual(await fs.readFile(previousTarball), previousBefore, "previous 0.5 package changed");
    assert.deepEqual(await fs.readFile(previousRuntimeTarball), previousRuntimeBefore, "previous 0.6 package changed");
    await fs.writeFile(join(packaging, "protected-after.json"), JSON.stringify(protectionAfter, null, 2) + "\n");
    assert.deepEqual(protectionAfter, protectionBefore, "historical artifacts/cache/compat changed");
  }
}

if (standalonePackageCheck) test("current complete Node closure local tarball installs offline, enforces ownership and edit, and retains legacy API", buildPackageEvidence);
