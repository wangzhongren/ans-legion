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
const generated = join(project, ".ans/runtime/legion-desktop-workbench-v2", role, "node");
const packaging = join(generated, "packaging");
const cache = join(generated, "npm-cache");
const temporary = join(generated, "tmp");
const seed = join(project, ".ans/runtime/legion-pi-node-v3/npm-cache/_cacache");
const historicalTarball = join(project, ".ans/runtime/legion-pi-node-v3/packaging/legion-runtime-0.3.0.tgz");
const stableTarball = join(project, ".ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/legion-runtime-0.4.0.tgz");
const npmCli = "D:/soft/nodejs/node_modules/npm/bin/npm-cli.js";
const publicNames = ["createRuntime", "AgentSession", "ActionProposal", "RoleBoundary",
  "Outcome", "AgentScope", "PiConnection", "TaskDispatchContext"].sort();
const modelNames = ["ContextReadConfirmation", "ContextSnapshot", "ConfirmedTaskGrant", "MutationVerification",
  "createWorkbenchAuthority", "isWorkbenchMutationAuthority", "PiConnection", "PiConnectionProfile", "AgentScope",
  "AgentConfig", "TaskDispatchContext", "AgentInstance", "PiEventType", "PiTextDelta", "PiConversationHistory",
  "PiConversationCheckpoint", "PiToolRequest", "PiToolResult", "PiRunResult", "AgentSession", "RoleBoundary",
  "ActionProposal", "PolicyDecision", "ExecutionPermit", "MutationResult", "Event", "Outcome",
  "normalizeResource", "normalizeScope", "digestValue"].sort();
const serviceNames = {
  policy: ["PolicyService", "createPolicyService"], mutation: ["MutationService", "MutationError", "createMutationService"],
  proposal: ["ProposalService", "createProposalService", "createCodexAdapter", "createClaudeAdapter"],
  "pi-agent": ["PiAgentService", "createPiAgentService"],
};
const packageExports = { ".": "./runtime.mjs", "./workbench-models": "./workbench.mjs",
  "./services/policy": "./src/kernel/services/public/policy.mjs",
  "./services/mutation": "./src/kernel/services/public/mutation.mjs",
  "./services/proposal": "./src/adapters/services/public/proposal.mjs",
  "./services/pi-agent": "./src/adapters/services/public/pi_agent.mjs" };
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function protectedHashes() {
  const paths = [];
  const links = {};
  async function visit(directory, prefix) {
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      if (item.isSymbolicLink()) links[prefix + "/" + item.name] = await fs.readlink(join(directory, item.name));
      else if (item.isDirectory()) await visit(join(directory, item.name), prefix + "/" + item.name);
      else { assert.ok(item.isFile()); paths.push(prefix + "/" + item.name); }
    }
  }
  for (const directory of [".ans/runtime/legion-pi-node-v3", ".ans/runtime/legion-desktop-gui-v1", ".ans/runtime/legion-node-fixture-compat-v1"]) {
    await visit(join(project, directory), directory);
  }
  const baseline = JSON.parse(await fs.readFile(join(project, ".ans/decisions/legion-desktop-workbench-v2-protected-baseline.json"), "utf8"));
  for (const [path, item] of Object.entries(baseline.protected)) {
    assert.equal(hash(await fs.readFile(join(project, path))), item.sha256, "protected baseline: " + path);
    paths.push(path);
  }
  const hashes = {};
  for (const path of [...new Set(paths)].sort()) hashes[path] = hash(await fs.readFile(join(project, path)));
  return { files: hashes, links };
}

function execute(argumentsList, cwd, extraEnvironment = {}) {
  const environment = { ...process.env, ...extraEnvironment,
    npm_config_cache: cache, npm_config_update_notifier: "false", npm_config_offline: "true",
    TEMP: temporary, TMP: temporary, NODE_DISABLE_COMPILE_CACHE: "1" };
  delete environment.NODE_OPTIONS;
  delete environment.NODE_COMPILE_CACHE;
  const result = spawnSync(process.execPath, argumentsList, {
    cwd, encoding: "utf8", timeout: 120000, maxBuffer: 16 * 1024 * 1024,
    env: environment,
  });
  assert.equal(result.error, undefined, String(result.error));
  assert.equal(result.status, 0, result.stdout + "\n" + result.stderr);
  return result.stdout;
}

function npm(argumentsList, cwd = project) {
  return execute([npmCli, ...argumentsList, "--ignore-scripts", "--no-audit", "--no-fund"], cwd);
}

function expectedPackageFiles() {
  const paths = ["package.json", "README.md", "runtime.mjs", "workbench.mjs", "bin/legion.mjs",
    "src/kernel/models/core.mjs", "src/kernel/models/agent.mjs", "src/kernel/models/workbench.mjs",
    "src/kernel/pipelines/permission.mjs", "src/kernel/interface/runtime.mjs",
    "src/kernel/interface/demo.mjs"];
  for (const division of ["abstract", "public", "impl"]) {
    for (const service of ["policy", "mutation"]) paths.push("src/kernel/services/" + division + "/" + service + ".mjs");
    paths.push("src/kernel/providers/" + division + "/storage.mjs");
    for (const service of ["proposal", "pi_agent"]) paths.push("src/adapters/services/" + division + "/" + service + ".mjs");
    paths.push("src/adapters/providers/" + division + "/pi_session.mjs");
  }
  assert.equal(paths.length, 29);
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
  await controlledDirectory(seed);
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

async function installedSmoke(expectedModels, expectedServices) {
  const assert = (await import("node:assert/strict")).default;
  const fs = (await import("node:fs")).promises;
  const path = await import("node:path");
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
  assert.equal(wb.AgentSession, api.AgentSession);
  assert.equal(wb.RoleBoundary, api.RoleBoundary);
  assert.throws(() => new wb.PiConversationHistory({ messages: [{ role: "system", text: "forged" }] }), TypeError);
  for (const name of ["pi-ai", "pi-coding-agent"]) {
    const metadata = JSON.parse(await fs.readFile(path.join(process.cwd(), "node_modules/@earendil-works", name, "package.json"), "utf8"));
    assert.equal(metadata.version, "1.0.4");
  }
  const workspace = path.join(process.cwd(), "workspace");
  await fs.mkdir(workspace);
  const boundary = new api.RoleBoundary({ roleId: "Backend", writeScope: ["backend/"],
    denyScope: ["backend/private/"], tools: ["legion_write_file"], capabilities: ["write_file"] });
  const session = new api.AgentSession({ sessionId: "manual", roleId: "Backend", taskId: "manual-task", organizationVersion: "smoke-v3" });
  const manual = api.createRuntime({ workspace, boundaries: [boundary], sessions: [session],
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
  } finally { await manual.close(); }
  const core = ai.createFauxCore({ provider: "fixture", models: [{ id: "offline" }], tokensPerSecond: 0 });
  core.setResponses([
    ai.fauxAssistantMessage(ai.fauxToolCall("legion_write_file", { resource: "backend/agent.txt", content: "real Pi package" }), { stopReason: "toolUse" }),
    ai.fauxAssistantMessage("package complete"),
  ]);
  const models = core.models.map(({ id, name, reasoning, input, cost, contextWindow, maxTokens }) =>
    ({ id, name, reasoning, input, cost, contextWindow, maxTokens }));
  const runtime = api.createRuntime({ workspace, boundaries: [boundary], organizationVersion: "smoke-v3",
    dispatchContext: new api.TaskDispatchContext({ roleId: "Backend", taskId: "agent-task",
      organizationVersion: "smoke-v3", writeSet: ["backend/agent.txt"], tools: ["legion_write_file"] }),
    modelProviders: [{ provider: "fixture", api: core.api, baseUrl: "https://legion.invalid",
      apiKey: "fixture-only", models, streamSimple: core.streamSimple }] });
  try {
    const agent = await runtime.createAgent({ name: "package-worker",
      proxy: new api.PiConnection({ provider: "fixture", model: "offline" }),
      scope: new api.AgentScope({ write: ["backend/agent.txt"], deny: [".ans/"], tools: ["legion_write_file"] }) });
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
  console.log(JSON.stringify({ publicImport: true, legacyTypedFlow: true, realPiCalls: core.state.callCount,
    piAiVersion: "1.0.4", piSdkVersion: "1.0.4", networkCalls: 0, workbenchModels: expectedModels.length,
    serviceSubpaths: Object.keys(expectedServices).length, conversationCalls: conversationCore.state.callCount }));
}

test("public entry exports only supported Interface and input Models", async () => {
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

test("29-file local tarball installs offline, runs actual Pi and legacy API, and starts CLI", async () => {
  await prepareFixture();
  const protectionBefore = await protectedHashes();
  const phaseBefore = JSON.parse(await fs.readFile(join(project, ".ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/stage-history-before.json"), "utf8"));
  for (const [path, digest] of Object.entries(phaseBefore.files)) assert.equal(protectionBefore.files[path], digest, "historical file changed during installation: " + path);
  assert.deepEqual(protectionBefore.links, phaseBefore.links, "historical links changed during installation");
  const stableBefore = await fs.readFile(stableTarball);
  await fs.writeFile(join(packaging, "protected-before.json"), JSON.stringify(protectionBefore, null, 2) + "\n");
  const runDirectory = await fs.mkdtemp(join(packaging, "smoke-"));
  const consumer = join(runDirectory, "consumer");
  await fs.mkdir(consumer);
  try {
    const expected = expectedPackageFiles();
    const dry = JSON.parse(npm(["pack", "--dry-run", "--json"]))[0];
    assert.deepEqual(dry.files.map((file) => file.path).sort(), expected);
    const packed = JSON.parse(npm(["pack", "--json", "--pack-destination", packaging]))[0];
    assert.deepEqual(packed.files.map((file) => file.path).sort(), expected);
    assert.equal(packed.name, "legion-runtime");
    assert.equal(packed.version, "0.4.0");
    const tarball = join(packaging, packed.filename);
    const bytes = await fs.readFile(tarball);
    assert.deepEqual(bytes, stableBefore, "regenerated v2 package differs from installed stable artifact");
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    assert.equal(hash(await fs.readFile(historicalTarball)), "a83a86499c4aaa7c997d94cabbb697efdc82f81475b622b85307ac682de4d8f0");
    const integrity = "sha512-" + createHash("sha512").update(bytes).digest("base64");
    assert.equal(integrity, packed.integrity);
    await fs.writeFile(join(consumer, "package.json"), JSON.stringify({ name: "legion-isolated-consumer", private: true, type: "module" }));
    npm(["install", tarball, "--offline", "--cache", cache], consumer);
    const tree = JSON.parse(npm(["ls", "--all", "--json"], consumer));
    assert.equal(tree.dependencies["legion-runtime"].version, "0.4.0");
    await fs.writeFile(join(consumer, "smoke.mjs"), "await (" + installedSmoke.toString() + ")(" + JSON.stringify(modelNames) + "," + JSON.stringify(serviceNames) + ");\n");
    const smokeOutput = execute(["smoke.mjs"], consumer);
    const smoke = JSON.parse(smokeOutput.trim());
    assert.equal(smoke.realPiCalls, 2);
    const installed = join(consumer, "node_modules/legion-runtime");
    const sourceHashes = {};
    for (const file of expected) {
      assert.equal(hash(await fs.readFile(join(installed, file))), hash(await fs.readFile(join(project, file))), "shipped source differs: " + file);
      if (file.endsWith(".mjs")) sourceHashes[file] = hash(await fs.readFile(join(project, file)));
    }
    assert.equal(Object.keys(sourceHashes).length, 27);
    const sourceAggregateSha256 = hash(Buffer.from(Object.keys(sourceHashes).sort()
      .map((path) => path + "\t" + sourceHashes[path] + "\n").join(""), "utf8"));
    const readme = await fs.readFile(join(installed, "README.md"), "utf8");
    const example = readme.match(/```javascript\r?\n([\s\S]*?)```/);
    assert.ok(example, "README offline example required");
    await fs.writeFile(join(consumer, "readme-example.mjs"), example[1]);
    const exampleOutput = execute(["readme-example.mjs"], consumer);
    assert.match(exampleOutput, /completed written/);
    assert.match(exampleOutput, /hello from Pi/);
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
    const evidence = { tarball, sha256, integrity, fileCount: packed.files.length,
      publicExports: publicNames, modelExports: modelNames, serviceExports: serviceNames, packageExports,
      sourceHashes, sourceAggregateSha256, sourceAggregateAlgorithm: "ordinal /relativePath TAB SHA256 LF UTF-8",
      isolatedInstall: true, smoke, readmeExample: true, cliScenarios: 6, cliEvents: 23,
      consumerLockSha256: createHash("sha256").update(await fs.readFile(join(consumer, "package-lock.json"))).digest("hex") };
    await fs.writeFile(join(packaging, "package-smoke.json"), JSON.stringify(evidence, null, 2) + "\n");
    console.log("PACKAGE_EVIDENCE " + JSON.stringify(evidence));
  } finally {
    await guardedRemove(runDirectory);
    const protectionAfter = await protectedHashes();
    await fs.writeFile(join(packaging, "protected-after.json"), JSON.stringify(protectionAfter, null, 2) + "\n");
    assert.deepEqual(protectionAfter, protectionBefore, "historical artifacts/cache/compat changed");
  }
});
