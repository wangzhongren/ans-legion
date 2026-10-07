import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeContext } from "@earendil-works/pi-ai";
import * as completions from "@earendil-works/pi-ai/api/openai-completions";
import * as responses from "@earendil-works/pi-ai/api/openai-responses";
import * as anthropic from "@earendil-works/pi-ai/api/anthropic-messages";
import { _electron } from "playwright";
import { createServer } from "node:http";
import { relative, isAbsolute } from "node:path";
import * as publicModels from "legion-runtime/workbench-models";
import { createPiAgentService } from "legion-runtime/services/pi-agent";

const desktop = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = resolve(desktop, "../..");
const generated = join(project, ".ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop");
const packaging = join(generated, "packaging");
const temporary = join(generated, "tmp");
const nodeArtifact = join(project, ".ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/legion-runtime-0.4.0.tgz");
const localSpec = "file:../../.ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/legion-runtime-0.4.0.tgz";
const expected = Object.freeze({ "@earendil-works/pi-ai": "1.0.4", electron: "44.6.0",
  "@electron-forge/cli": "8.0.1", "@electron-forge/maker-zip": "8.0.1", playwright: "1.63.0" });
const hash = (value) => createHash("sha256").update(value).digest("hex");
assert.equal(process.argv.length, 2, "verification_has_no_dynamic_arguments");
assert.equal(process.platform, "win32");
assert.equal(process.arch, "x64");
const packageBytes = await fs.readFile(join(desktop, "package.json"));
const lockBytes = await fs.readFile(join(desktop, "package-lock.json"));
const manifest = JSON.parse(packageBytes);
const lock = JSON.parse(lockBytes);
assert.equal(lock.lockfileVersion, 3);
assert.equal(lock.name, manifest.name);
assert.equal(lock.version, manifest.version);
assert.equal(manifest.version, "0.2.0");
assert.equal(manifest.dependencies["legion-runtime"], localSpec);
const localEntry = lock.packages["node_modules/legion-runtime"];
assert.equal(localEntry.version, "0.4.0");
assert.equal(localEntry.resolved, localSpec);
assert.equal(localEntry.link, undefined, "runtime_must_not_be_symlink");
const archiveBytes = await fs.readFile(nodeArtifact);
const runtimeIntegrity = "sha512-" + createHash("sha512").update(archiveBytes).digest("base64");
assert.equal(localEntry.integrity, runtimeIntegrity);
const runtimeDirectory = join(desktop, "node_modules/legion-runtime");
const runtimeInfo = await fs.lstat(runtimeDirectory);
assert.ok(runtimeInfo.isDirectory() && !runtimeInfo.isSymbolicLink());
const published = JSON.parse(await fs.readFile(join(runtimeDirectory, "package.json"), "utf8"));
assert.equal(published.version, "0.4.0");
assert.deepEqual(published.dependencies, { "@earendil-works/pi-ai": "1.0.4", "@earendil-works/pi-coding-agent": "1.0.4" });
const installedSdkVersions = {};
for (const name of ["@earendil-works/pi-ai", "@earendil-works/pi-coding-agent"]) {
  const entry = fileURLToPath(import.meta.resolve(name));
  const child = relative(desktop, entry).replaceAll("\\", "/");
  assert.ok(child.startsWith("node_modules/") && !isAbsolute(child), "sdk_borrowed_from_development_tree");
  const info = JSON.parse(await fs.readFile(join(dirname(dirname(entry)), "package.json"), "utf8"));
  assert.equal(info.name, name); assert.equal(info.version, "1.0.4");
  const api = await import(name);
  if (name.endsWith("pi-coding-agent")) assert.equal(typeof api.createAgentSession, "function");
  else assert.equal(typeof api.normalizeContext, "function");
  installedSdkVersions[name] = info.version;
}
const modelNames = ["ContextReadConfirmation", "ContextSnapshot", "ConfirmedTaskGrant", "MutationVerification",
  "createWorkbenchAuthority", "isWorkbenchMutationAuthority", "PiConnection", "PiConnectionProfile", "AgentScope",
  "AgentConfig", "TaskDispatchContext", "AgentInstance", "PiEventType", "PiTextDelta", "PiConversationHistory",
  "PiConversationCheckpoint", "PiToolRequest", "PiToolResult", "PiRunResult", "AgentSession", "RoleBoundary",
  "ActionProposal", "PolicyDecision", "ExecutionPermit", "MutationResult", "Event", "Outcome", "normalizeResource", "normalizeScope", "digestValue"].sort();
assert.deepEqual(Object.keys(publicModels).sort(), modelNames);
const rootApi = await import("legion-runtime");
assert.deepEqual(Object.keys(rootApi).sort(), ["createRuntime", "AgentSession", "ActionProposal", "RoleBoundary", "Outcome", "AgentScope", "PiConnection", "TaskDispatchContext"].sort());
for (const [name, names] of Object.entries({ policy: ["PolicyService", "createPolicyService"],
  mutation: ["MutationService", "MutationError", "createMutationService"],
  proposal: ["ProposalService", "createProposalService", "createCodexAdapter", "createClaudeAdapter"],
  "pi-agent": ["PiAgentService", "createPiAgentService"] })) {
  assert.deepEqual(Object.keys(await import("legion-runtime/services/" + name)).sort(), names.sort());
}
const packedEvidence = JSON.parse(await fs.readFile(join(dirname(nodeArtifact), "package-smoke.json"), "utf8"));
assert.equal(packedEvidence.sha256, hash(archiveBytes));
assert.equal(packedEvidence.fileCount, 29);
assert.equal(Object.keys(packedEvidence.sourceHashes).length, 27);
for (const [path, sha256] of Object.entries(packedEvidence.sourceHashes)) {
  assert.equal(hash(await fs.readFile(join(runtimeDirectory, path))), sha256, "installed_runtime_source_mismatch");
}
for (const group of ["dependencies", "devDependencies"]) {
  assert.deepEqual(lock.packages[""][group], manifest[group]);
}
const installedVersions = {};
for (const [name, version] of Object.entries(expected)) {
  let declared = manifest.dependencies[name];
  if (declared === undefined) declared = manifest.devDependencies[name];
  assert.equal(declared, version, "unlocked_direct_dependency");
  assert.equal(lock.packages["node_modules/" + name].version, version, "lock_version_mismatch");
  const installed = JSON.parse(await fs.readFile(join(desktop, "node_modules", name, "package.json"), "utf8"));
  assert.equal(installed.version, version, "installed_version_mismatch");
  installedVersions[name] = installed.version;
}
let integrityRecords = 0;
for (const [name, item] of Object.entries(lock.packages)) {
  if (name === "") continue;
  if (name === "node_modules/legion-runtime") assert.equal(item.resolved, localSpec);
  else assert.match(item.resolved, /^https:\/\/registry\.npmjs\.org\//, "nonregistry_dependency");
  assert.equal(item.link, undefined, "dependency_link_forbidden");
  assert.match(item.integrity, /^sha512-[A-Za-z0-9+/]+={0,2}$/, "missing_dependency_integrity");
  integrityRecords += 1;
}
assert.equal(typeof normalizeContext, "function");
assert.deepEqual(normalizeContext({ messages: [], tools: [] }).messages, []);
for (const module of [completions, responses, anthropic]) assert.equal(typeof module.streamSimple, "function");
assert.equal(typeof _electron.launch, "function", "playwright_electron_api_missing");
const electron = join(desktop, "node_modules/electron");
const binary = join(electron, "dist/electron.exe");
const binaryMetadata = await fs.lstat(binary);
assert.ok(binaryMetadata.isFile() && !binaryMetadata.isSymbolicLink());
assert.equal((await fs.readFile(join(electron, "dist/version"), "utf8")).trim().replace(/^v/, ""), expected.electron);
assert.equal(await fs.readFile(join(electron, "path.txt"), "utf8"), "electron.exe");
const environment = { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_DISABLE_COMPILE_CACHE: "1" };
environment.TEMP = temporary;
environment.TMP = temporary;
delete environment.NODE_COMPILE_CACHE;
delete environment.NODE_OPTIONS;
const result = spawnSync(binary, ["-e", "console.log(JSON.stringify(process.versions))"], {
  env: environment, cwd: desktop, encoding: "utf8", timeout: 30000, maxBuffer: 1024 * 1024,
});
assert.equal(result.error, undefined, String(result.error));
assert.equal(result.status, 0, result.stderr);
const embedded = JSON.parse(result.stdout.trim());
assert.equal(embedded.electron, expected.electron);
const parts = embedded.node.split(".").map(Number);
assert.ok(parts.length === 3 && parts.every(Number.isInteger));
assert.ok(parts[0] > 22 || (parts[0] === 22 && parts[1] >= 19), "electron_embedded_node_too_old");
const installedEvidence = JSON.parse(await fs.readFile(join(packaging, "electron-install.json"), "utf8"));
assert.equal(installedEvidence.version, expected.electron);
assert.equal(installedEvidence.checksumVerified, true);
assert.equal(installedEvidence.binary, binary);
const binarySha256 = hash(await fs.readFile(binary));
assert.equal(installedEvidence.binarySha256, binarySha256, "binary_changed_after_install");
assert.equal(installedEvidence.archiveSha256, hash(await fs.readFile(installedEvidence.archive)));
const { AgentInstance, AgentScope, PiConnection, PiConnectionProfile, PiConversationCheckpoint } = publicModels;

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
    events.push({ type: "message_start", message: { id: "msg1", type: "message", role: "assistant", model,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } }, { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } }, { type: "message_stop" });
  } else {
    const item = { id: "item1", type: "message", role: "assistant", status: "in_progress", content: [] };
    const content = { type: "output_text", text, annotations: [] };
    const response = { id: "resp1", object: "response", created_at: 1, model, status: "in_progress", output: [] };
    events.push({ type: "response.created", response }, { type: "response.output_item.added", output_index: 0, item },
      { type: "response.content_part.added", item_id: "item1", output_index: 0, content_index: 0, part: { ...content, text: "" } },
      { type: "response.output_text.delta", item_id: "item1", output_index: 0, content_index: 0, delta: text },
      { type: "response.output_text.done", item_id: "item1", output_index: 0, content_index: 0, text },
      { type: "response.content_part.done", item_id: "item1", output_index: 0, content_index: 0, part: content },
      { type: "response.output_item.done", output_index: 0, item: { ...item, status: "completed", content: [content] } },
      { type: "response.completed", response: { ...response, status: "completed", output: [{ ...item, status: "completed", content: [content] }],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } });
  }
  return events.map((value) => "event: " + value.type + "\ndata: " + JSON.stringify(value) + "\n\n").join("");
}

const realSdkProtocols = [];
for (const protocol of ["openai-completions", "openai-responses", "anthropic-messages"]) {
  const requests = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    requests.push({ body, authorization: request.headers.authorization, key: request.headers["x-api-key"] });
    response.writeHead(200, { "content-type": "text/event-stream" });
    response.end(sse(protocol, "local reply " + requests.length, body.model));
  });
  await new Promise((accept, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", accept); });
  const instance = new AgentInstance({ instanceId: protocol, name: "ProjectManager", sessionId: protocol + "-session",
    roleId: "ProjectManager", taskId: "discussion", organizationVersion: "customer-v1" });
  const connection = new PiConnectionProfile({ profileId: protocol, profileVersion: "v1", protocol,
    provider: "desktop-private", model: "custom-model", baseUrl: "http://127.0.0.1:" + server.address().port + "/v1" });
  let service;
  try {
    service = await createPiAgentService({ instance, proxy: new PiConnection({ provider: connection.provider, model: connection.model }),
      scope: new AgentScope({ write: [], tools: [] }), cwd: temporary, lifecycle: "conversation", connection, credentials: { apiKey: "fixture-private-key" } });
    for (const runId of ["first", "second"]) {
      service.start_run(runId, runId + " human");
      for (;;) {
        const event = await service.next_event(runId, { signal: AbortSignal.timeout(5000) });
        assert.notEqual(event.type, "tool_request");
        if (["run_finished", "run_failed", "run_cancelled"].includes(event.type)) {
          assert.equal(event.result.status, "completed"); assert.equal(event.result.assistantText, "local reply " + requests.length); break;
        }
      }
    }
    assert.equal(requests.length, 2);
    for (const request of requests) {
      assert.equal(request.body.model, "custom-model");
      assert.ok(request.body.tools === undefined || request.body.tools.length === 0);
      assert.ok(request.authorization === "Bearer fixture-private-key" || request.key === "fixture-private-key");
    }
    assert.match(JSON.stringify(requests[1].body), /first human/);
    assert.match(JSON.stringify(requests[1].body), /local reply 1/);
    const history = service.get_history();
    assert.equal(history.messages.length, 4);
    await service.restore_history(new PiConversationCheckpoint({ instance, profileId: connection.profileId,
      profileVersion: connection.profileVersion, history }));
    assert.equal(requests.length, 2, "restore_must_not_call_model");
    realSdkProtocols.push({ protocol, requests: 2, realSdk: true, historyMessages: 4, emptyTools: true, privateKeyObservedOnlyByLocalFixture: true });
  } finally {
    if (service) await service.close();
    server.closeAllConnections(); await new Promise((accept) => server.close(accept));
  }
}
const evidence = { installedVersions, installedSdkVersions, embedded, binary, binarySha256,
  packageSha256: hash(packageBytes), lockSha256: hash(lockBytes), integrityRecords,
  publicPiApis: ["openai-completions", "openai-responses", "anthropic-messages"],
  normalizeContext: true, playwrightElectron: true, officialChecksumVerified: true,
  runtimeVersion: "0.4.0", runtimeTarball: nodeArtifact, runtimeTarballSha256: hash(archiveBytes), runtimeIntegrity,
  publicModelCount: modelNames.length, runtimeSourceFiles: 27, actualLocalTarballInstalled: true, realSdkProtocols,
  paidModelCalls: 0, additionalBrowserDownloads: 0 };
await fs.writeFile(join(packaging, "dependencies-verified.json"), JSON.stringify(evidence, null, 2) + "\n");
console.log(JSON.stringify(evidence, null, 2));
