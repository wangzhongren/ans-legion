import test, { mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolve } from "node:path";
import { syncBuiltinESMExports } from "node:module";
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { Compile } from "typebox/compile";
import { AgentSession as SdkSession } from "@earendil-works/pi-coding-agent";
import { Type, InMemoryCredentialStore, createFauxCore, fauxAssistantMessage,
  fauxToolCall } from "@earendil-works/pi-ai";
import { createPiSessionProvider, PiSessionProvider } from "../../src/adapters/providers/public/pi_session.mjs";
import { AgentInstance, AgentScope, PiConnection, PiConnectionProfile, PiTextDelta, PiConversationHistory,
  PiConversationCheckpoint, PiToolRequest, PiToolResult, PiRunResult, ProjectReadDecision,
  ProjectReadResult, AgentControlTools, AgentControlDecision, AgentControlResult } from "../../src/kernel/models/agent.mjs";
import { PolicyDecision, MutationResult, Outcome } from "../../src/kernel/models/core.mjs";

const suPayloads = {
  legion_delegate_pm: { action: "start", purpose: "plan", instruction: "Create current plan", sourceRefs: ["human:recorded"] },
  legion_query_role_activity: { roleId: "Backend" },
  legion_query_role_log: { roleId: "Backend", limit: 20 }
};
const roleRoot = resolve(".ans/runtime/legion-governed-workflow-v1/AgentAdapterEngineer");
const fixtureRoot = resolve(roleRoot, "fixtures/pi-provider");
fs.mkdirSync(fixtureRoot, { recursive: true });
fs.mkdirSync(resolve(roleRoot, "tmp"), { recursive: true });
for (const name of ["TMPDIR", "TEMP", "TMP"]) process.env[name] = resolve(roleRoot, "tmp");

function fixture({ id = "A", provider = "same-provider", model = "m", key = "fixture-key-A", responses } = {}) {
  const core = createFauxCore({ api: "faux", provider, models: [{ id: model }], tokensPerSecond: 0 });
  core.setResponses(responses ?? [fauxAssistantMessage(fauxToolCall("legion_write_file",
    { resource: "backend/" + id + ".mjs", content: id }, { id: "call-" + id }), { stopReason: "toolUse" }),
    fauxAssistantMessage("finished " + id)]);
  const calls = [];
  const metadata = core.models.map((value) => ({ id: value.id, name: value.name,
    reasoning: value.reasoning, input: value.input, cost: value.cost,
    contextWindow: value.contextWindow, maxTokens: value.maxTokens }));
  const config = { api: core.api, baseUrl: "https://legion.invalid", apiKey: key,
    models: metadata, streamSimple: (requestedModel, context, options) => {
      calls.push({ model: requestedModel.id, provider: requestedModel.provider, apiKey: options?.apiKey,
        sessionId: options?.sessionId, transcript: JSON.stringify(context),
        maxTokens: options?.maxTokens, maxRetries: options?.maxRetries, timeoutMs: options?.timeoutMs });
      return core.streamSimple(requestedModel, context, options);
    } };
  return { core, calls, options: { instance: new AgentInstance({ instanceId: "i-" + id, name: "name-" + id,
    sessionId: "trusted-" + id, roleId: "Backend", taskId: "task-" + id, organizationVersion: "v3" }),
    proxy: new PiConnection({ provider, model }), scope: new AgentScope({ write: ["backend/" + id + ".mjs"],
      deny: [".ans/"], tools: ["legion_write_file"] }), cwd: fixtureRoot, modelProviders: { [provider]: config } } };
}
function response(request, overrides = {}) {
  return new PiToolResult({ requestId: request.requestId, runId: request.runId,
    decision: new PolicyDecision({ outcome: Outcome.ALLOW, reason: "allowed", proposalDigest: "digest",
      organizationVersion: "v3" }), result: new MutationResult({ success: true, status: "written",
      reason: "written", resource: request.parameters.resource, proposalDigest: "digest", observedMutation: true }),
    ...overrides });
}
function readResponse(request, result, allowed = true) {
  return new PiToolResult({ requestId: request.requestId, runId: request.runId,
    decision: new ProjectReadDecision({ allowed, reason: allowed ? "read_allowed" : "read_denied" }),
    result: new ProjectReadResult(result) });
}
async function next(provider, runId, type) {
  for (;;) {
    const event = await provider.next_event(runId, { signal: AbortSignal.timeout(5000) });
    assert.ok(Object.isFrozen(event));
    if (event.type === type || event.type.startsWith("run_f") || event.type === "run_cancelled") return event;
  }
}

test("installed public SDK/AI 1.0.4 and real own Provider contract are mandatory", () => {
  for (const name of ["pi-coding-agent", "pi-ai"]) {
    assert.equal(JSON.parse(fs.readFileSync("node_modules/@earendil-works/" + name + "/package.json", "utf8")).version, "1.0.4");
  }
  assert.equal(typeof SdkSession, "function");
  assert.equal(typeof Type.Object, "function");
  assert.equal(typeof InMemoryCredentialStore, "function");
  assert.throws(() => new PiSessionProvider(), TypeError);
});
test("real SDK prompt waits for deferred tool then consumes actual host result", async () => {
  const setup = fixture();
  const provider = await createPiSessionProvider(setup.options);
  assert.ok(provider instanceof PiSessionProvider);
  try {
    assert.equal(provider.start_run("run-A", "write for A"), undefined);
    const event = await next(provider, "run-A", "tool_request");
    assert.ok(event.request instanceof PiToolRequest);
    assert.equal(event.request.parameters.content, "A");
    const result = response(event.request);
    provider.respond_tool(event.request, result);
    assert.throws(() => provider.respond_tool(event.request, result), /invalid_or_late/);
    const finished = await next(provider, "run-A", "run_finished");
    assert.ok(finished.result instanceof PiRunResult);
    assert.equal(finished.result.status, "completed");
    assert.equal(finished.result.assistantText, "finished A");
    assert.deepEqual(finished.result.toolResults, [result]);
    assert.equal(setup.calls.length, 2);
    assert.match(setup.calls[1].transcript, /written/);
    assert.throws(() => provider.start_run("new-run", "again"), /not_ready/);
    await assert.rejects(provider.next_event("run-A"), /exhausted/);
  } finally { await provider.close(); }
});
test("same named provider has independent stream/model/auth/transcript and real Session IDs", async () => {
  const a = fixture({ id: "A", model: "model-A", key: "key-A" });
  const b = fixture({ id: "B", model: "model-B", key: "key-B" });
  const [pa, pb] = await Promise.all([createPiSessionProvider(a.options), createPiSessionProvider(b.options)]);
  try {
    pa.start_run("run-A", "exclusive A"); pb.start_run("run-B", "exclusive B");
    const [ea, eb] = await Promise.all([next(pa, "run-A", "tool_request"), next(pb, "run-B", "tool_request")]);
    assert.throws(() => pa.respond_tool(eb.request, response(eb.request)), /invalid_or_late/);
    assert.throws(() => pb.respond_tool(ea.request, response(ea.request)), /invalid_or_late/);
    pa.respond_tool(ea.request, response(ea.request)); pb.respond_tool(eb.request, response(eb.request));
    const [ra, rb] = await Promise.all([next(pa, "run-A", "run_finished"), next(pb, "run-B", "run_finished")]);
    assert.equal(ra.result.assistantText, "finished A"); assert.equal(rb.result.assistantText, "finished B");
    assert.notEqual(a.calls[0].sessionId, b.calls[0].sessionId);
    for (const call of a.calls) {
      assert.equal(call.model, "model-A"); assert.equal(call.apiKey, "key-A");
      assert.match(call.transcript, /backend\/A\.mjs/);
      assert.doesNotMatch(call.transcript, /exclusive B|backend\/B/);
    }
    for (const call of b.calls) {
      assert.equal(call.model, "model-B"); assert.equal(call.apiKey, "key-B");
      assert.match(call.transcript, /backend\/B\.mjs/);
      assert.doesNotMatch(call.transcript, /exclusive A|backend\/A/);
    }
  } finally { await Promise.all([pa.close(), pb.close()]); }
});
test("exact request identity, IDs, run and typed result required", async () => {
  const provider = await createPiSessionProvider(fixture().options);
  try {
    provider.start_run("run", "request");
    const { request } = await next(provider, "run", "tool_request");
    const result = response(request);
    assert.throws(() => provider.respond_tool(new PiToolRequest({ ...request }), result), /invalid_or_late/);
    assert.throws(() => provider.respond_tool(request, { ...result }), /invalid_or_late/);
    assert.throws(() => provider.respond_tool(request, response(request, { requestId: "other" })), /invalid_or_late/);
    assert.throws(() => provider.respond_tool(request, response(request, { runId: "other" })), /invalid_or_late/);
    provider.respond_tool(request, result);
    await next(provider, "run", "run_finished");
    assert.throws(() => provider.respond_tool(request, result), /invalid_or_late/);
  } finally { await provider.close(); }
});
test("denial and audit failure observations reach SDK without false rollback", async () => {
  for (const outcome of ["denied", "audit_failed"]) {
    const setup = fixture();
    const provider = await createPiSessionProvider(setup.options);
    try {
      provider.start_run("run", "write");
      const { request } = await next(provider, "run", "tool_request");
      const result = new PiToolResult({ requestId: request.requestId, runId: request.runId,
        decision: new PolicyDecision({ outcome: Outcome.DENY, reason: "denied", proposalDigest: "digest", organizationVersion: "v3" }),
        result: new MutationResult({ success: false, status: outcome, reason: outcome,
          resource: request.parameters.resource, proposalDigest: "digest",
          observedMutation: outcome === "audit_failed", auditFailed: outcome === "audit_failed" }) });
      provider.respond_tool(request, result);
      const finished = await next(provider, "run", "run_finished");
      assert.equal(finished.result.toolResults[0], result);
      assert.match(setup.calls[1].transcript, new RegExp(outcome));
      if (outcome === "audit_failed") assert.match(setup.calls[1].transcript, /observedMutation.*true/);
    } finally { await provider.close(); }
  }
});
test("read-only conversation relays list and file results through two real SDK turns", async () => {
  const setup = conversationFixture({ responses: [
    fauxAssistantMessage(fauxToolCall("legion_list_files", { resource: "", limit: 2 }, { id: "reused-call" }),
      { stopReason: "toolUse" }), fauxAssistantMessage("found files"),
    fauxAssistantMessage(fauxToolCall("legion_read_file", { resource: "src/main.mjs", startLine: 1 },
      { id: "reused-call" }), { stopReason: "toolUse" }), fauxAssistantMessage("read file") ] });
  setup.options.scope = new AgentScope({ write: [], tools: ["legion_list_files", "legion_read_file"] });
  const originalPrompt = SdkSession.prototype.prompt;
  const spy = mock.method(SdkSession.prototype, "prompt", function (...args) {
    assert.deepEqual(this.getActiveToolNames().sort(), ["legion_list_files", "legion_read_file"]);
    assert.deepEqual(this.getCallableToolNames().sort(), ["legion_list_files", "legion_read_file"]);
    assert.deepEqual(this.getAllTools().map((tool) => tool.name).sort(), ["legion_list_files", "legion_read_file"]);
    return originalPrompt.apply(this, args);
  });
  let provider;
  try {
    provider = await createPiSessionProvider(setup.options);
    provider.start_run("list", "show project root");
    const listedRequest = (await next(provider, "list", "tool_request")).request;
    assert.equal(listedRequest.tool, "legion_list_files");
    assert.deepEqual(listedRequest.parameters, { resource: "", cursor: "", limit: 2 });
    assert.throws(() => provider.respond_tool(listedRequest, readResponse(listedRequest,
      { status: "read", reason: "read", resource: "", text: "", byteLength: 0 })), /invalid_or_late/);
    const listed = readResponse(listedRequest, { status: "listed", reason: "listed", resource: "",
      entries: [{ name: "src", kind: "directory" }], nextCursor: "src" });
    provider.respond_tool(listedRequest, listed);
    assert.equal((await turn(provider, "list")).result.assistantText, "found files");
    provider.start_run("read", "inspect main");
    const readRequest = (await next(provider, "read", "tool_request")).request;
    assert.equal(readRequest.tool, "legion_read_file");
    assert.deepEqual(readRequest.parameters, { resource: "src/main.mjs", startLine: 1, maxBytes: 65536 });
    assert.throws(() => provider.respond_tool(readRequest, listed), /invalid_or_late/);
    assert.throws(() => provider.respond_tool(readRequest, readResponse(readRequest,
      { status: "read", reason: "read", resource: "other.mjs", text: "x", byteLength: 1 })), /invalid_or_late/);
    const read = readResponse(readRequest, { status: "read", reason: "read", resource: "src/main.mjs",
      text: "hello\n", byteLength: 6, nextLine: 2, complete: false });
    provider.respond_tool(readRequest, read);
    const end = await turn(provider, "read");
    assert.equal(end.result.status, "completed");
    assert.deepEqual(end.result.toolResults, [read]);
    assert.match(setup.calls.at(-1).transcript, /hello\\n/);
    assert.deepEqual(provider.get_history().messages, [
      { role: "user", text: "show project root" }, { role: "assistant", text: "found files" },
      { role: "user", text: "inspect main" }, { role: "assistant", text: "read file" }]);
  } finally { await provider?.close(); spy.mock.restore(); }
});
test("single run combines granted read and write while legacy write-only stays unchanged", async () => {
  const setup = fixture({ responses: [
    fauxAssistantMessage(fauxToolCall("legion_read_file", { resource: "src/main.mjs" }), { stopReason: "toolUse" }),
    fauxAssistantMessage(fauxToolCall("legion_write_file", { resource: "backend/A.mjs", content: "A" }),
      { stopReason: "toolUse" }), fauxAssistantMessage("done") ] });
  setup.options.scope = new AgentScope({ write: ["backend/A.mjs"],
    tools: ["legion_write_file", "legion_list_files", "legion_read_file"] });
  const provider = await createPiSessionProvider(setup.options);
  try {
    provider.start_run("mixed", "inspect then write");
    const first = (await next(provider, "mixed", "tool_request")).request;
    assert.equal(first.tool, "legion_read_file");
    const denied = readResponse(first, { status: "denied", reason: "sensitive_path", resource: "src/main.mjs" }, false);
    assert.throws(() => provider.respond_tool(first, readResponse(first,
      { status: "read", reason: "read", resource: "src/main.mjs", text: "x", byteLength: 1 }, false)), /invalid_or_late/);
    provider.respond_tool(first, denied);
    const second = (await next(provider, "mixed", "tool_request")).request;
    assert.equal(second.tool, "legion_write_file");
    const written = response(second);
    provider.respond_tool(second, written);
    const end = await next(provider, "mixed", "run_finished");
    assert.deepEqual(end.result.toolResults, [denied, written]);
    assert.match(setup.calls[1].transcript, /sensitive_path/);
  } finally { await provider.close(); }
});
test("cancelling a pending project read rejects its late response and preserves conversation", async () => {
  const setup = conversationFixture({ responses: [
    fauxAssistantMessage(fauxToolCall("legion_read_file", { resource: "src/main.mjs" }),
      { stopReason: "toolUse" }), fauxAssistantMessage("next turn") ] });
  setup.options.scope = new AgentScope({ write: [], tools: ["legion_read_file"] });
  const provider = await createPiSessionProvider(setup.options);
  try {
    provider.start_run("cancel-read", "inspect");
    const request = (await next(provider, "cancel-read", "tool_request")).request;
    await provider.cancel_turn("cancel-read");
    assert.equal((await turn(provider, "cancel-read")).result.status, "cancelled");
    assert.throws(() => provider.respond_tool(request, readResponse(request,
      { status: "read", reason: "read", resource: "src/main.mjs", text: "x", byteLength: 1 })),
    /invalid_or_late/);
    provider.start_run("next", "continue");
    assert.equal((await turn(provider, "next")).result.assistantText, "next turn");
  } finally { await provider.close(); }
});
test("edit-only Agent uses real SDK read SHA then controlled edit without a write-file tool", async () => {
  const sha256 = "a".repeat(64);
  const setup = fixture({ responses: [
    fauxAssistantMessage(fauxToolCall("legion_read_file", { resource: "backend/A.mjs" }), { stopReason: "toolUse" }),
    fauxAssistantMessage(fauxToolCall("legion_edit_file", { resource: "backend/A.mjs",
      expectedSha256: sha256, replacements: [{ oldText: "old", newText: "new" }] }),
    { stopReason: "toolUse" }), fauxAssistantMessage("edited") ] });
  setup.options.scope = new AgentScope({ write: ["backend/A.mjs"],
    tools: ["legion_edit_file", "legion_read_file"] });
  const originalPrompt = SdkSession.prototype.prompt;
  const spy = mock.method(SdkSession.prototype, "prompt", function (...args) {
    assert.deepEqual(this.getActiveToolNames().sort(), ["legion_edit_file", "legion_read_file"]);
    assert.deepEqual(this.getCallableToolNames().sort(), ["legion_edit_file", "legion_read_file"]);
    const tools = this.getAllTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), ["legion_edit_file", "legion_read_file"]);
    const schema = tools.find((tool) => tool.name === "legion_edit_file").parameters;
    assert.equal(schema.additionalProperties, false);
    assert.equal(schema.properties.expectedSha256.pattern, "^[a-f0-9]{64}$");
    assert.equal(schema.properties.replacements.minItems, 1);
    assert.equal(schema.properties.replacements.maxItems, 16);
    assert.equal(schema.properties.replacements.items.properties.oldText.minLength, 1);
    assert.equal(schema.properties.replacements.items.additionalProperties, false);
    return originalPrompt.apply(this, args);
  });
  let provider;
  try {
    provider = await createPiSessionProvider(setup.options);
    provider.start_run("edit", "read then edit");
    const readRequest = (await next(provider, "edit", "tool_request")).request;
    assert.equal(readRequest.tool, "legion_read_file");
    const readResult = readResponse(readRequest, { status: "read", reason: "read", resource: "backend/A.mjs",
      text: "old\n", byteLength: 4, sha256, complete: true });
    provider.respond_tool(readRequest, readResult);
    const editRequest = (await next(provider, "edit", "tool_request")).request;
    assert.equal(editRequest.tool, "legion_edit_file");
    assert.deepEqual(editRequest.parameters, { resource: "backend/A.mjs", expectedSha256: sha256,
      replacements: [{ oldText: "old", newText: "new" }] });
    assert.match(setup.calls[1].transcript, /"sha256":"a{64}"/);
    const editResult = response(editRequest);
    provider.respond_tool(editRequest, editResult);
    assert.throws(() => provider.respond_tool(editRequest, editResult), /invalid_or_late/);
    const end = await next(provider, "edit", "run_finished");
    assert.equal(end.result.assistantText, "edited");
    assert.deepEqual(end.result.toolResults, [readResult, editResult]);
  } finally { await provider?.close(); spy.mock.restore(); }
});
test("PM conversation and ungranted Agent scopes cannot load the edit tool", async () => {
  const conversation = conversationFixture();
  conversation.options.scope = new AgentScope({ write: [], tools: ["legion_edit_file", "legion_read_file"] });
  await assert.rejects(createPiSessionProvider(conversation.options), /conversation_must_be_toolless/);
  const setup = fixture();
  for (const scope of [
    new AgentScope({ write: ["backend/A.mjs"], tools: ["legion_read_file"] }),
    new AgentScope({ write: ["backend/A.mjs"], tools: ["legion_write_file", "bash"] })
  ]) await assert.rejects(createPiSessionProvider({ ...setup.options, scope }), TypeError);
});
test("legacy write-only Agent cannot turn an ungranted edit call into a host request", async () => {
  const setup = fixture({ responses: [fauxAssistantMessage(fauxToolCall("legion_edit_file",
    { resource: "backend/A.mjs", expectedSha256: "a".repeat(64),
      replacements: [{ oldText: "before", newText: "after" }] }), { stopReason: "toolUse" }),
  fauxAssistantMessage("no edit executed") ] });
  const provider = await createPiSessionProvider(setup.options);
  try {
    provider.start_run("legacy", "try edit");
    const result = await turn(provider, "legacy");
    assert.equal(result.events.some((value) => value.type === "tool_request"), false);
    assert.equal(result.result.toolResults.length, 0);
    assert.equal(result.result.assistantText, "no edit executed");
  } finally { await provider.close(); }
});
test("cancelling a pending edit rejects its late typed response", async () => {
  const setup = fixture({ responses: [fauxAssistantMessage(fauxToolCall("legion_edit_file",
    { resource: "backend/A.mjs", expectedSha256: "a".repeat(64),
      replacements: [{ oldText: "before", newText: "after" }] }), { stopReason: "toolUse" })] });
  setup.options.scope = new AgentScope({ write: ["backend/A.mjs"], tools: ["legion_edit_file"] });
  const provider = await createPiSessionProvider(setup.options);
  try {
    provider.start_run("edit", "change");
    const editRequest = (await next(provider, "edit", "tool_request")).request;
    await provider.cancel();
    assert.equal((await next(provider, "edit", "run_cancelled")).result.status, "cancelled");
    assert.throws(() => provider.respond_tool(editRequest, response(editRequest)), /invalid_or_late/);
  } finally { await provider.close(); }
});
test("unknown provider/model and invalid controlled configuration fail creation", async () => {
  const setup = fixture();
  for (const options of [
    { ...setup.options, proxy: new PiConnection({ provider: "missing", model: "m" }) },
    { ...setup.options, proxy: new PiConnection({ provider: "same-provider", model: "missing" }) },
    { ...setup.options, scope: new AgentScope({ tools: ["bash"] }) },
    { ...setup.options, scope: { tools: ["legion_write_file"] } },
    { ...setup.options, submit: () => {} },
    { ...setup.options, modelProviders: { "same-provider": { ...setup.options.modelProviders["same-provider"], submit: () => {} } } },
    { ...setup.options, modelProviders: { "same-provider": { ...setup.options.modelProviders["same-provider"], apiKey: "!shell" } } },
    { ...setup.options, modelProviders: { "same-provider": { ...setup.options.modelProviders["same-provider"], streamSimple: null } } },
  ]) await assert.rejects(createPiSessionProvider(options), TypeError);
});
test("actual SDK loadout only controlled tool; no user Pi files or fetch", async () => {
  const originalRead = fs.readFileSync;
  const originalPrompt = SdkSession.prototype.prompt;
  const originalDispose = SdkSession.prototype.dispose;
  const sessions = [];
  let disposed = 0;
  const fileSpy = mock.method(fs, "readFileSync", (path, ...args) => {
    assert.doesNotMatch(String(path).replaceAll("\\", "/"), /\/.pi\//);
    return originalRead(path, ...args);
  });
  syncBuiltinESMExports();
  const fetchSpy = mock.method(globalThis, "fetch", () => { throw new Error("network forbidden"); });
  const promptSpy = mock.method(SdkSession.prototype, "prompt", function (text, options) {
    assert.deepEqual(this.getActiveToolNames(), ["legion_write_file"]);
    assert.deepEqual(this.getAllTools().map((tool) => tool.name), ["legion_write_file"]);
    assert.equal(options.expandPromptTemplates, false);
    assert.equal(this.sessionManager.getSessionFile(), undefined);
    assert.deepEqual(this.resourceLoader.getSkills().skills, []);
    assert.deepEqual(this.resourceLoader.getExtensions().extensions, []);
    sessions.push(this);
    return originalPrompt.call(this, text, options);
  });
  const disposeSpy = mock.method(SdkSession.prototype, "dispose", function () {
    disposed += 1; return originalDispose.call(this);
  });
  let provider;
  try {
    provider = await createPiSessionProvider(fixture({ responses: [fauxAssistantMessage("offline done")] }).options);
    provider.start_run("run", "/skill:ignored");
    const terminal = await next(provider, "run", "run_finished");
    assert.equal(terminal.result.status, "completed");
    assert.equal(sessions.length, 1); assert.equal(disposed, 1);
    await provider.close(); await provider.close(); assert.equal(disposed, 1);
    assert.equal(fetchSpy.mock.callCount(), 0);
  } finally {
    await provider?.close(); promptSpy.mock.restore(); disposeSpy.mock.restore();
    fileSpy.mock.restore(); syncBuiltinESMExports(); fetchSpy.mock.restore();
  }
});
test("cancel settles deferred request and rejects late response; separate instance survives", async () => {
  const a = await createPiSessionProvider(fixture().options);
  const b = await createPiSessionProvider(fixture({ id: "B" }).options);
  try {
    a.start_run("run-A", "A"); b.start_run("run-B", "B");
    const [ea, eb] = await Promise.all([next(a, "run-A", "tool_request"), next(b, "run-B", "tool_request")]);
    await a.cancel(); await a.cancel();
    assert.throws(() => a.respond_tool(ea.request, response(ea.request)), /invalid_or_late/);
    const cancelled = await next(a, "run-A", "run_cancelled");
    assert.equal(cancelled.result.status, "cancelled");
    assert.equal(cancelled.result.toolResults.length, 0);
    b.respond_tool(eb.request, response(eb.request));
    assert.equal((await next(b, "run-B", "run_finished")).result.status, "completed");
  } finally { await Promise.all([a.close(), b.close()]); }
});
test("close during deferred wait releases consumer and forbids restart", async () => {
  const provider = await createPiSessionProvider(fixture().options);
  provider.start_run("run", "A");
  const { request } = await next(provider, "run", "tool_request");
  // Drain already queued run events so the following consumer waits.
  const controller = new AbortController();
  const consumer = (async () => {
    for (;;) await provider.next_event("run", { signal: controller.signal });
  })();
  const observedConsumer = assert.rejects(consumer);
  await provider.close(); await observedConsumer;
  assert.throws(() => provider.respond_tool(request, response(request)), /invalid_or_late/);
  assert.throws(() => provider.start_run("again", "again"), /not_ready/);
  await provider.close();
});
test("next_event abort cancels only waiter and correct run required", async () => {
  const provider = await createPiSessionProvider(fixture().options);
  try {
    await assert.rejects(provider.next_event("unknown"), /unknown_run/);
    provider.start_run("run", "A");
    const { request } = await next(provider, "run", "tool_request");
    const signal = AbortSignal.abort();
    await assert.rejects(provider.next_event("run", { signal }), { name: "AbortError" });
    provider.respond_tool(request, response(request));
    assert.equal((await next(provider, "run", "run_finished")).result.status, "completed");
  } finally { await provider.close(); }
});
test("SDK assistant failure produces failed run and releases actual Session", async () => {
  const provider = await createPiSessionProvider(fixture({ responses: [fauxAssistantMessage("", {
    stopReason: "error", errorMessage: "sensitive-provider-detail" })] }).options);
  try {
    provider.start_run("run", "fail");
    const terminal = await next(provider, "run", "run_failed");
    assert.equal(terminal.result.status, "failed");
    assert.equal(terminal.result.errorCode, "pi_model_error");
    assert.doesNotMatch(JSON.stringify(terminal), /sensitive-provider-detail/);
  } finally { await provider.close(); }
});
test("SDK length stop is a failed run and cannot look like a complete checkpoint summary", async () => {
  const provider = await createPiSessionProvider(fixture({ responses: [fauxAssistantMessage("incomplete summary", {
    stopReason: "length" })] }).options);
  try {
    provider.start_run("truncated-summary", "summarize this history");
    const terminal = await next(provider, "truncated-summary", "run_failed");
    assert.equal(terminal.result.status, "failed");
    assert.equal(terminal.result.errorCode, "pi_model_error");
    assert.equal(terminal.result.assistantText, "incomplete summary");
  } finally { await provider.close(); }
});
test("aborted creation fails; signal arriving after real SDK construction disposes Session", async () => {
  await assert.rejects(createPiSessionProvider({ ...fixture().options, signal: AbortSignal.abort() }), { name: "AbortError" });
  const controller = new AbortController();
  const originalGetTools = SdkSession.prototype.getActiveToolNames;
  const originalDispose = SdkSession.prototype.dispose;
  let disposed = 0;
  const toolsSpy = mock.method(SdkSession.prototype, "getActiveToolNames", function () {
    const tools = originalGetTools.call(this);
    if (tools.includes("legion_write_file")) controller.abort();
    return tools;
  });
  const disposeSpy = mock.method(SdkSession.prototype, "dispose", function () {
    disposed += 1; return originalDispose.call(this);
  });
  try {
    await assert.rejects(createPiSessionProvider({ ...fixture().options, signal: controller.signal }), { name: "AbortError" });
    assert.equal(disposed, 1);
  } finally { toolsSpy.mock.restore(); disposeSpy.mock.restore(); }
});
test("configuration metadata copied before caller mutation", async () => {
  const setup = fixture({ responses: [fauxAssistantMessage("original strategy")] });
  const provider = await createPiSessionProvider(setup.options);
  try {
    setup.options.modelProviders["same-provider"].models[0].id = "changed";
    setup.options.modelProviders["same-provider"].streamSimple = () => { throw new Error("changed strategy"); };
    provider.start_run("run", "original");
    assert.equal((await next(provider, "run", "run_finished")).result.assistantText, "original strategy");
    assert.equal(setup.calls[0].model, "m");
  } finally { await provider.close(); }
});

function conversationFixture({ id = "chat", responses = [fauxAssistantMessage("first"), fauxAssistantMessage("second")],
  tokensPerSecond = 0, budgets } = {}) {
  const setup = fixture({ id, responses });
  if (tokensPerSecond !== 0) {
    const core = createFauxCore({ api: "faux", provider: "same-provider", models: [{ id: "m" }],
      tokensPerSecond, tokenSize: { min: 1, max: 1 } });
    core.setResponses(responses);
    setup.options.modelProviders["same-provider"].streamSimple = core.streamSimple;
  }
  setup.options.scope = new AgentScope({ write: [], tools: [] });
  setup.options.lifecycle = "conversation";
  if (budgets !== undefined) setup.options.budgets = budgets;
  return setup;
}
async function turn(provider, runId) {
  const events = [];
  for (;;) {
    const value = await provider.next_event(runId, { signal: AbortSignal.timeout(5000) });
    events.push(value);
    if (value.type === "run_finished" || value.type === "run_failed" || value.type === "run_cancelled") {
      return { events, result: value.result };
    }
  }
}
function checkpoint(options, history, overrides = {}) {
  return new PiConversationCheckpoint({ instance: options.instance, profileId: "legacy:same-provider/m",
    profileVersion: options.instance.organizationVersion, history, ...overrides });
}
test("real tool-less Session spans multiple Human turns and emits typed text deltas", async () => {
  const setup = conversationFixture();
  const original = SdkSession.prototype.prompt;
  const sessions = [];
  const spy = mock.method(SdkSession.prototype, "prompt", function (...args) {
    assert.deepEqual(this.getAllTools(), []);
    assert.deepEqual(this.getActiveToolNames(), []);
    assert.deepEqual(this.getCallableToolNames(), []);
    sessions.push(this);
    return original.apply(this, args);
  });
  const provider = await createPiSessionProvider(setup.options);
  try {
    provider.start_run("one", "human one");
    assert.throws(() => provider.start_run("busy", "busy"), /not_ready/);
    const one = await turn(provider, "one");
    assert.equal(one.result.status, "completed"); assert.equal(one.result.assistantText, "first");
    const deltas = one.events.filter((value) => value.type === "text_delta");
    assert.ok(deltas.length > 0);
    assert.ok(deltas.every((value) => value.delta instanceof PiTextDelta && value.delta.runId === "one"));
    assert.equal(deltas.map((value) => value.delta.text).join(""), "first");
    assert.throws(() => provider.start_run("one", "reuse"), /run_id_reused/);
    provider.start_run("two", "human two");
    await assert.rejects(provider.next_event("one"), /unknown_run/);
    const two = await turn(provider, "two");
    assert.equal(two.result.assistantText, "second");
    assert.equal(sessions[0], sessions[1]);
    assert.match(setup.calls[1].transcript, /human one/); assert.match(setup.calls[1].transcript, /first/);
    assert.ok(provider.get_history() instanceof PiConversationHistory);
    assert.deepEqual(provider.get_history().messages, [
      { role: "user", text: "human one" }, { role: "assistant", text: "first" },
      { role: "user", text: "human two" }, { role: "assistant", text: "second" }]);
    await provider.cancel();
    assert.throws(() => provider.start_run("three", "closed"), /not_ready/);
  } finally { await provider.close(); spy.mock.restore(); }
});
test("typed text history restores into real memory Session without invoking model or changing trusted binding", async () => {
  const setup = conversationFixture({ responses: [fauxAssistantMessage("continued")] });
  const provider = await createPiSessionProvider(setup.options);
  const history = new PiConversationHistory({ messages: [
    { role: "user", text: "saved user" }, { role: "assistant", text: "saved assistant" }] });
  try {
    await assert.rejects(provider.restore_history({ ...checkpoint(setup.options, history) }), /binding/);
    await assert.rejects(provider.restore_history(checkpoint(setup.options, history, { profileVersion: "other" })), /binding/);
    const other = conversationFixture({ id: "other" });
    await assert.rejects(provider.restore_history(checkpoint(setup.options, history, { instance: other.options.instance })), /binding/);
    await provider.restore_history(checkpoint(setup.options, history));
    assert.equal(setup.calls.length, 0); assert.equal(provider.get_history(), history);
    provider.start_run("restored", "new question");
    await assert.rejects(provider.restore_history(checkpoint(setup.options, history)), /not_idle/);
    const result = await turn(provider, "restored");
    assert.equal(result.result.status, "completed");
    assert.match(setup.calls[0].transcript, /saved user/); assert.match(setup.calls[0].transcript, /saved assistant/);
    assert.equal(setup.calls[0].model, "m"); assert.equal(setup.calls[0].apiKey, "fixture-key-A");
  } finally { await provider.close(); }
});
test("fresh single_run restores one plain checkpoint before start and keeps only its current tool scope", async () => {
  const setup = fixture({ responses: [fauxAssistantMessage(fauxToolCall("legion_write_file",
    { resource: "backend/A.mjs", content: "current task" }), { stopReason: "toolUse" }),
    fauxAssistantMessage("current task done")] });
  const provider = await createPiSessionProvider(setup.options);
  const history = new PiConversationHistory({ messages: [
    { role: "user", text: "prior task request" },
    { role: "assistant", text: "prior task notes, including a historical tool outcome" }
  ] });
  const saved = checkpoint(setup.options, history);
  const originalPrompt = SdkSession.prototype.prompt;
  const sessions = [];
  const promptSpy = mock.method(SdkSession.prototype, "prompt", function (text, options) {
    sessions.push(this);
    assert.deepEqual(this.getActiveToolNames(), ["legion_write_file"]);
    const restored = this.sessionManager.getBranch().filter((entry) => entry.type === "message");
    assert.deepEqual(restored.map((entry) => entry.message.role), ["user", "assistant"]);
    assert.deepEqual(restored.map((entry) => typeof entry.message.content === "string" ? entry.message.content :
      entry.message.content.map((part) => part.text).join("")),
      history.messages.map((message) => message.text));
    return originalPrompt.call(this, text, options);
  });
  try {
    await assert.rejects(provider.restore_history({ ...saved }), /history_binding_mismatch/);
    const other = fixture({ id: "other-single" });
    await assert.rejects(provider.restore_history(checkpoint(setup.options, history, { instance: other.options.instance })),
      /history_binding_mismatch/);
    assert.throws(() => new PiConversationCheckpoint({ instance: setup.options.instance, profileId: "legacy:same-provider/m",
      profileVersion: setup.options.instance.organizationVersion,
      history: { messages: [{ role: "toolResult", text: "old permit" }] } }), TypeError);
    await provider.restore_history(saved);
    await assert.rejects(provider.restore_history(saved), /single_run_history_restore_unavailable/);

    provider.start_run("new-task-run", "current task request");
    const request = (await next(provider, "new-task-run", "tool_request")).request;
    assert.equal(request.tool, "legion_write_file");
    await assert.rejects(provider.restore_history(saved), /single_run_history_restore_unavailable/);
    provider.respond_tool(request, response(request));
    const result = await next(provider, "new-task-run", "run_finished");
    assert.equal(result.result.status, "completed");
    assert.equal(result.result.assistantText, "current task done");
    assert.equal(sessions.length, 1);
    assert.match(setup.calls[0].transcript, /prior task request/);
    assert.match(setup.calls[0].transcript, /current task request/);
    await assert.rejects(provider.restore_history(saved), /single_run_history_restore_unavailable/);
  } finally { await provider.close(); promptSpy.mock.restore(); }
});
test("current turn cancellation keeps Session usable and rejects stale run identity", async () => {
  const setup = conversationFixture({ responses: [fauxAssistantMessage("slow text"), fauxAssistantMessage("next")],
    tokensPerSecond: 100 });
  const provider = await createPiSessionProvider(setup.options);
  try {
    provider.start_run("cancelled-turn", "stop this");
    await provider.next_event("cancelled-turn", { signal: AbortSignal.timeout(5000) });
    await assert.rejects(provider.cancel_turn("wrong"), /invalid_turn_cancel/);
    await provider.cancel_turn("cancelled-turn"); await provider.cancel_turn("cancelled-turn");
    assert.equal((await turn(provider, "cancelled-turn")).result.status, "cancelled");
    provider.start_run("next-turn", "continue");
    await assert.rejects(provider.cancel_turn("cancelled-turn"), /invalid_turn_cancel/);
    assert.equal((await turn(provider, "next-turn")).result.status, "completed");
  } finally { await provider.close(); }
});
test("engineering conversation uses bounded 8192 output and 180000ms activity defaults and exact caps", async () => {
  for (const budgets of [undefined, { maxQueueEvents: 256, maxTextCharsPerTurn: 65536,
    maxOutputTokens: 8192, turnTimeoutMs: 180000 }]) {
    const setup = conversationFixture({ responses: [fauxAssistantMessage("bounded engineering reply")], budgets });
    const provider = await createPiSessionProvider(setup.options);
    try {
      if (budgets !== undefined) {
        // Changing the host's plain input after creation cannot widen the saved contract.
        budgets.maxOutputTokens = 8193; budgets.turnTimeoutMs = 180001;
      }
      provider.start_run("engineering", "inspect workflow");
      assert.equal((await turn(provider, "engineering")).result.status, "completed");
      assert.equal(setup.calls.length, 1);
      assert.equal(setup.calls[0].maxTokens, 8192);
      assert.equal(setup.calls[0].maxRetries, 0);
      assert.ok(setup.calls[0].timeoutMs > 179000 && setup.calls[0].timeoutMs <= 180000);
    } finally { await provider.close(); }
  }
});
test("conversation callers may retain former 2048 output and 60000ms activity budgets", async () => {
  const setup = conversationFixture({ responses: [fauxAssistantMessage("smaller reply")],
    budgets: { maxOutputTokens: 2048, turnTimeoutMs: 60000 } });
  const provider = await createPiSessionProvider(setup.options);
  try {
    provider.start_run("smaller", "inspect");
    assert.equal((await turn(provider, "smaller")).result.status, "completed");
    assert.equal(setup.calls[0].maxTokens, 2048);
    assert.equal(setup.calls[0].maxRetries, 0);
    assert.ok(setup.calls[0].timeoutMs > 59000 && setup.calls[0].timeoutMs <= 60000);
  } finally { await provider.close(); }
});
test("conversation budgets reject widening, bound text and retain explicit terminal after queue overflow", async () => {
  for (const budgets of [{ maxQueueEvents: 1 }, { maxQueueEvents: 257 }, { maxTextCharsPerTurn: 65537 },
    { maxOutputTokens: 8193 }, { turnTimeoutMs: 180001 }, { maxOutputTokens: 0 }, { turnTimeoutMs: 0 },
    { maxOutputTokens: 1.5 }, { turnTimeoutMs: Number.POSITIVE_INFINITY }]) {
    await assert.rejects(createPiSessionProvider(conversationFixture({ budgets }).options), /budget/);
  }
  const text = await createPiSessionProvider(conversationFixture({ responses: [fauxAssistantMessage("too long")],
    budgets: { maxTextCharsPerTurn: 3 } }).options);
  try {
    assert.throws(() => text.start_run("long-input", "long input"), /budget/);
    text.start_run("text", "ok");
    assert.equal((await turn(text, "text")).result.errorCode, "pi_text_budget");
  } finally { await text.close(); }
  const queue = await createPiSessionProvider(conversationFixture({ responses: [fauxAssistantMessage("queue")],
    budgets: { maxQueueEvents: 2 } }).options);
  try {
    queue.start_run("queue", "q");
    // Let the actual SDK finish before consuming: only one normal slot and one terminal slot.
    await new Promise((resolveWait) => setTimeout(resolveWait, 40));
    const done = await turn(queue, "queue");
    assert.ok(done.events.length <= 2); assert.equal(done.result.errorCode, "pi_queue_budget");
  } finally { await queue.close(); }
});
test("conversation rejects writable scopes and real SDK cannot execute hallucinated file tool", async () => {
  const setup = conversationFixture({ responses: [fauxAssistantMessage(fauxToolCall("legion_write_file",
    { resource: "backend/forbidden.mjs", content: "must not write" }), { stopReason: "toolUse" })] });
  for (const scope of [new AgentScope({ write: ["backend/"] }), new AgentScope({ tools: ["legion_write_file"] })]) {
    await assert.rejects(createPiSessionProvider({ ...setup.options, scope }), /toollless|toolless/);
  }
  const provider = await createPiSessionProvider(setup.options);
  try {
    provider.start_run("no-tool", "ask");
    const end = await turn(provider, "no-tool");
    assert.equal(end.result.status, "failed"); assert.equal(end.result.errorCode, "pi_unexpected_tool_call");
    assert.equal(end.result.toolResults.length, 0); assert.equal(end.events.some((value) => value.type === "tool_request"), false);
  } finally { await provider.close(); }
});

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
async function localhost(protocol, { failure = false, hang = false, interactionThenHang = false, partialThenHang = false } = {}) {
  const requests = [];
  const interruptedReplies = [];
  const server = createServer(async (request, reply) => {
    reply.on("close", () => { if (!reply.writableEnded) interruptedReplies.push(request.url); });
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    requests.push({ path: request.url, headers: request.headers, body });
    if (hang || (interactionThenHang && requests.length > 1)) return;
    if (failure) {
      reply.writeHead(401, { "content-type": "application/json" });
      reply.end(JSON.stringify({ error: { type: "authentication_error", message: "secret-provider-error-key" } }));
      return;
    }
    reply.writeHead(200, { "content-type": "text/event-stream" });
    if (partialThenHang && requests.length === 1) {
      const chunk = { id: "partial", object: "chat.completion.chunk", model: body.model,
        choices: [{ index: 0, delta: { role: "assistant", content: "cancelled-partial-canary" }, finish_reason: null }] };
      reply.write("data: " + JSON.stringify(chunk) + "\n\n");
      reply.write(": waiting\n\n");
      return;
    }
    if (interactionThenHang) {
      const tool = { index: 0, id: "network-interaction", type: "function", function: {
        name: "legion_request_interaction", arguments: JSON.stringify({ payload: { question: "Continue?" } }) } };
      const chunk = { id: "chat1", object: "chat.completion.chunk", created: 1, model: body.model,
        choices: [{ index: 0, delta: { role: "assistant", tool_calls: [tool] }, finish_reason: null }] };
      const end = { ...chunk, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
      reply.end("data: " + JSON.stringify(chunk) + "\n\ndata: " + JSON.stringify(end) + "\n\ndata: [DONE]\n\n");
      return;
    }
    reply.end(sse(protocol, "reply " + requests.length, body.model));
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  return { requests, interruptedReplies, url: "http://127.0.0.1:" + server.address().port + "/v1",
    close: async () => { server.closeAllConnections(); await new Promise((resolveClose) => server.close(resolveClose)); } };
}
function plainOptions(protocol, url, { id = "plain", key = "plain-key", version = "profile-v1", budgets } = {}) {
  const provider = "desktop-compatible";
  const model = "custom-model-" + id;
  const options = { instance: new AgentInstance({ instanceId: "i-" + id, name: "PM-" + id, sessionId: "s-" + id,
    roleId: "ProjectManager", taskId: "chat-" + id, organizationVersion: "customer-v1" }),
    proxy: new PiConnection({ provider, model }), scope: new AgentScope({ write: [], tools: [] }),
    cwd: fixtureRoot, lifecycle: "conversation",
    connection: new PiConnectionProfile({ profileId: "profile-" + id, profileVersion: version,
      protocol, provider, model, baseUrl: url }), credentials: { apiKey: key } };
  if (budgets !== undefined) options.budgets = budgets;
  return options;
}
for (const protocol of ["openai-completions", "openai-responses", "anthropic-messages"]) {
  test("real SDK plain profile uses public " + protocol + " and tool-less localhost multi-turn", async () => {
    const host = await localhost(protocol);
    const options = plainOptions(protocol, host.url);
    const provider = await createPiSessionProvider(options);
    try {
      assert.equal(options.connection.modelMetadata, null);
      provider.start_run("plain-1", "first human");
      assert.equal((await turn(provider, "plain-1")).result.assistantText, "reply 1");
      provider.start_run("plain-2", "second human");
      const done = await turn(provider, "plain-2");
      assert.equal(done.result.assistantText, "reply 2"); assert.equal(done.result.status, "completed");
      assert.equal(host.requests.length, 2);
      for (const request of host.requests) {
        assert.equal(request.body.model, options.proxy.model);
        const outputBudget = request.body.max_completion_tokens ?? request.body.max_output_tokens ?? request.body.max_tokens;
        assert.equal(outputBudget, 8192);
        assert.ok(request.body.tools === undefined || request.body.tools.length === 0);
        assert.equal(request.headers.authorization === "Bearer plain-key" || request.headers["x-api-key"] === "plain-key", true);
        assert.ok(request.path.includes("messages") || request.path.includes("responses") || request.path.includes("chat/completions"));
      }
      assert.match(JSON.stringify(host.requests[1].body), /first human/);
      assert.match(JSON.stringify(host.requests[1].body), /reply 1/);
      assert.doesNotMatch(JSON.stringify(done), /plain-key|cost|contextWindow/);
      const saved = provider.get_history();
      await provider.restore_history(new PiConversationCheckpoint({ instance: options.instance,
        profileId: options.connection.profileId, profileVersion: options.connection.profileVersion, history: saved }));
      assert.equal(host.requests.length, 2);
    } finally { await provider.close(); await host.close(); }
  });
  test("real " + protocol + " wire carries precise controlled tool schemas", async () => {
    const host = await localhost(protocol);
    const options = plainOptions(protocol, host.url);
    options.scope = new AgentScope({ write: [], tools: ["legion_run_check", ...AgentControlTools] });
    const provider = await createPiSessionProvider(options);
    try {
      provider.start_run("schemas", "describe workflow");
      assert.equal((await turn(provider, "schemas")).result.status, "completed");
      const tools = host.requests[0].body.tools;
      assert.equal(tools.length, 1 + AgentControlTools.length);
      const normalized = tools.map((tool) => {
        if (tool.function !== undefined) return { name: tool.function.name, schema: tool.function.parameters };
        return { name: tool.name, schema: tool.parameters ?? tool.input_schema };
      });
      assert.deepEqual(normalized.map((tool) => tool.name).sort(), ["legion_run_check", ...AgentControlTools].sort());
      for (const { name, schema } of normalized) {
        // SDK 1.0.4 Anthropic keeps type/properties/required only. Runtime
        // PiToolRequest still rejects extra root fields before any host request.
        if (protocol === "anthropic-messages") assert.equal(schema.additionalProperties, undefined);
        else assert.equal(schema.additionalProperties, false);
        let fields = ["payload"];
        if (name === "legion_run_check") fields = ["checkId"];
        if (name === "legion_review_shell") fields = ["requestId", "requestDigest", "revision", "approved", "reason"];
        assert.deepEqual(Object.keys(schema.properties), fields);
        assert.deepEqual(schema.required, fields);
        const validator = Compile(schema);
        if (name === "legion_run_check") {
          assert.equal(validator.Check({ checkId: "unit" }), true);
          assert.equal(validator.Check({ checkId: "" }), false);
        } else if (name === "legion_review_shell") {
          assert.equal(validator.Check({ requestId: "shell", requestDigest: "a".repeat(64), revision: 1, approved: true, reason: "approved" }), true);
          assert.equal(validator.Check({ payload: {} }), false);
        } else if (Object.hasOwn(suPayloads, name)) {
          assert.equal(validator.Check({payload:suPayloads[name]}),true);
          assert.equal(validator.Check({payload:{...suPayloads[name],callerRoleId:"Other"}}),false);
          assert.equal(validator.Check({payload:[]}),false);
        } else {
          assert.equal(validator.Check({ payload: { nested: [{ value: "ok" }] } }), true);
          assert.equal(validator.Check({ payload: { nested: { token: "secret" } } }), false);
          assert.equal(validator.Check({ payload: [] }), false);
          assert.ok(schema.properties.payload.$defs.value8);
        }
      }
    } finally { await provider.close(); await host.close(); }
  });
}

test("real HTTP model wait after a long host interaction still expires with finite budget", async () => {
  const host = await localhost("openai-completions", { interactionThenHang: true });
  const options = plainOptions("openai-completions", host.url, { budgets: { turnTimeoutMs: 250 } });
  options.scope = new AgentScope({ write: [], tools: ["legion_request_interaction"] });
  const provider = await createPiSessionProvider(options);
  try {
    provider.start_run("network", "ask then continue");
    const { request } = await next(provider, "network", "tool_request");
    assert.equal(request.tool, "legion_request_interaction");
    await delay(400);
    const identity = { requestId: request.requestId, runId: request.runId, tool: request.tool };
    const result = new PiToolResult({ requestId: request.requestId, runId: request.runId,
      decision: new AgentControlDecision({ ...identity, allowed: true, reason: "user_answered" }),
      result: new AgentControlResult({ ...identity, status: "completed", reason: "user_answered", payload: { answer: "yes" } }) });
    provider.respond_tool(request, result);
    const end = await turn(provider, "network");
    assert.equal(end.result.status, "failed");
    assert.equal(end.result.errorCode, "pi_turn_timeout");
    assert.deepEqual(end.result.toolResults, [result]);
    assert.equal(host.requests.length, 2);
    assert.match(JSON.stringify(host.requests[1].body), /user_answered/);
    assert.doesNotMatch(JSON.stringify(end.result), /plain-key/);
  } finally { await provider.close(); await host.close(); }
});
test("plain profiles are XOR legacy, typed, exact proxy, literal credentials and isolated same provider", async () => {
  const host = await localhost("openai-completions");
  const a = plainOptions("openai-completions", host.url, { id: "A", key: "key-A" });
  const b = plainOptions("openai-completions", host.url, { id: "B", key: "key-B", version: "v2" });
  for (const options of [{ ...a, modelProviders: fixture().options.modelProviders },
    { ...a, credentials: undefined }, { ...a, connection: { ...a.connection } },
    { ...a, proxy: b.proxy }, { ...a, credentials: { apiKey: "!command" } },
    { ...a, credentials: { apiKey: "safe", submit: () => {} } }]) {
    await assert.rejects(createPiSessionProvider(options), TypeError);
  }
  const [pa, pb] = await Promise.all([createPiSessionProvider(a), createPiSessionProvider(b)]);
  try {
    a.credentials.apiKey = "changed-after-create";
    pa.start_run("A", "only A"); pb.start_run("B", "only B");
    await Promise.all([turn(pa, "A"), turn(pb, "B")]);
    const requests = host.requests;
    assert.equal(requests.length, 2);
    assert.equal(requests.find((value) => value.body.model === a.proxy.model).headers.authorization, "Bearer key-A");
    assert.equal(requests.find((value) => value.body.model === b.proxy.model).headers.authorization, "Bearer key-B");
    assert.doesNotMatch(JSON.stringify(requests.find((value) => value.body.model === a.proxy.model).body), /only B/);
    await assert.rejects(pa.restore_history(new PiConversationCheckpoint({ instance: a.instance,
      profileId: a.connection.profileId, profileVersion: "v2", history: pb.get_history() })), /binding/);
    assert.doesNotMatch(JSON.stringify(pa.get_history()), /key-A|only B/);
  } finally { await Promise.all([pa.close(), pb.close()]); await host.close(); }
});
test("real protocol authentication failure is sanitized and deadline aborts pending HTTP", async () => {
  const bad = await localhost("openai-completions", { failure: true });
  const provider = await createPiSessionProvider(plainOptions("openai-completions", bad.url));
  try {
    provider.start_run("auth", "hello");
    const done = await turn(provider, "auth");
    assert.equal(done.result.status, "failed"); assert.equal(done.result.errorCode, "pi_auth_error");
    assert.doesNotMatch(JSON.stringify(done), /secret-provider-error-key|plain-key/);
    assert.equal(bad.requests.length, 1);
  } finally { await provider.close(); await bad.close(); }
  const hung = await localhost("openai-completions", { hang: true });
  const slow = await createPiSessionProvider(plainOptions("openai-completions", hung.url,
    { budgets: { turnTimeoutMs: 100 } }));
  try {
    slow.start_run("deadline", "hello");
    const done = await turn(slow, "deadline");
    assert.equal(done.result.status, "failed"); assert.equal(done.result.errorCode, "pi_turn_timeout");
    assert.equal(hung.requests.length, 1);
    await slow.close(); await slow.close();
  } finally { await slow.close(); await hung.close(); }
});

test("cancel_turn, cancel and close abort active HTTP immediately with the 180000ms default", async () => {
  for (const method of ["cancel_turn", "cancel", "close"]) {
    const host = await localhost("openai-completions", { hang: true });
    const provider = await createPiSessionProvider(plainOptions("openai-completions", host.url));
    let watchdog;
    try {
      provider.start_run(method, "request that waits on the model");
      for (let attempt = 0; attempt < 100 && host.requests.length === 0; attempt += 1) await delay(10);
      assert.equal(host.requests.length, 1);
      await Promise.race([provider[method](method), new Promise((resolveWait, rejectWait) => {
        watchdog = setTimeout(() => rejectWait(new Error("cancellation_waited_for_activity_budget")), 1500);
      })]);
      clearTimeout(watchdog);
      if (method !== "close") assert.equal((await turn(provider, method)).result.status, "cancelled");
      for (let attempt = 0; attempt < 100 && host.interruptedReplies.length === 0; attempt += 1) await delay(10);
      assert.equal(host.interruptedReplies.length, 1);
      assert.equal(host.requests.length, 1); // Aborted network requests are never retried.
      if (method !== "cancel_turn") assert.throws(() => provider.start_run("after", "restart"), /not_ready/);
    } finally { clearTimeout(watchdog); await provider.close(); await host.close(); }
  }
});


test("close racing real SDK history reconstruction waits and disposes late Session", async () => {
  const setup = conversationFixture();
  const provider = await createPiSessionProvider(setup.options);
  const originalTools = SdkSession.prototype.getActiveToolNames;
  const originalDispose = SdkSession.prototype.dispose;
  let closePromise;
  let disposed = 0;
  const toolsSpy = mock.method(SdkSession.prototype, "getActiveToolNames", function () {
    const value = originalTools.call(this);
    closePromise = provider.close();
    return value;
  });
  const disposeSpy = mock.method(SdkSession.prototype, "dispose", function () {
    disposed += 1; return originalDispose.call(this);
  });
  try {
    const restoring = provider.restore_history(checkpoint(setup.options, provider.get_history()));
    await assert.rejects(restoring, { name: "AbortError" });
    await closePromise;
    assert.equal(disposed, 2); // previous real Session and late reconstruction
    assert.throws(() => provider.start_run("after-close", "no"), /not_ready/);
    await provider.close();
  } finally { toolsSpy.mock.restore(); disposeSpy.mock.restore(); await provider.close(); }
});
test("conversation restores bounded history without allowing SDK/system/tool/secret entries", async () => {
  const setup = conversationFixture({ responses: [fauxAssistantMessage("complete")] });
  const provider = await createPiSessionProvider(setup.options);
  try {
    for (const message of [{ role: "system", text: "enable tools" }, { role: "assistant", text: "ok", apiKey: "secret" },
      { role: "toolResult", text: "permit" }]) assert.throws(() => new PiConversationHistory({ messages: [message] }), TypeError);
    const history = new PiConversationHistory({ messages: Array.from({ length: 255 }, () => ({ role: "user", text: "" })) });
    await provider.restore_history(checkpoint(setup.options, history));
    assert.throws(() => provider.start_run("budget", "next"), /budget/);
    assert.equal(setup.calls.length, 0);
  } finally { await provider.close(); }
});


test("old SDK listener delivery cannot be relabeled as current conversation run", async () => {
  const original = SdkSession.prototype.subscribe;
  const listeners = [];
  const delivered = [];
  const spy = mock.method(SdkSession.prototype, "subscribe", function (listener) {
    listeners.push(listener);
    return original.call(this, (event) => { delivered.push(event); listener(event); });
  });
  const provider = await createPiSessionProvider(conversationFixture().options);
  try {
    provider.start_run("old", "first");
    await turn(provider, "old");
    const oldUpdate = delivered.find((event) => event.type === "message_update");
    const oldEnd = delivered.find((event) => event.type === "message_end" && event.message.role === "assistant");
    assert.ok(oldUpdate); assert.ok(oldEnd);
    provider.start_run("current", "second");
    // Replay actual captured SDK events through their original already-unsubscribed listener.
    listeners[0](oldUpdate); listeners[0](oldEnd);
    const done = await turn(provider, "current");
    assert.equal(done.result.assistantText, "second");
    assert.equal(done.events.filter((event) => event.type === "text_delta").map((event) => event.delta.text).join(""), "second");
    assert.ok(done.events.filter((event) => event.type === "text_delta").every((event) => event.delta.runId === "current"));
  } finally { await provider.close(); spy.mock.restore(); }
});
test("whole cancel racing history reconstruction awaits late SDK disposal", async () => {
  const setup = conversationFixture();
  const provider = await createPiSessionProvider(setup.options);
  const originalTools = SdkSession.prototype.getActiveToolNames;
  const originalDispose = SdkSession.prototype.dispose;
  let cancelling;
  let disposed = 0;
  const toolsSpy = mock.method(SdkSession.prototype, "getActiveToolNames", function () {
    const value = originalTools.call(this);
    cancelling = provider.cancel();
    return value;
  });
  const disposeSpy = mock.method(SdkSession.prototype, "dispose", function () {
    disposed += 1; return originalDispose.call(this);
  });
  try {
    await assert.rejects(provider.restore_history(checkpoint(setup.options, provider.get_history())), { name: "AbortError" });
    await cancelling; assert.equal(disposed, 2);
    assert.throws(() => provider.start_run("cancelled-instance", "no"), /not_ready/);
  } finally { toolsSpy.mock.restore(); disposeSpy.mock.restore(); await provider.close(); }
});


test("SDK role scope prompt lists all Host-owned exact files and only granted tools", async () => {
  const setup = fixture();
  setup.options.scope = new AgentScope({ write: ["backend/A.mjs", "backend/another.mjs"],
    deny: [".ans/"], tools: ["legion_write_file"] });
  const provider = await createPiSessionProvider(setup.options);
  try {
    provider.start_run("owned", "Edit within current ownership");
    const { request } = await next(provider, "owned", "tool_request");
    const prompt = setup.calls[0].transcript;
    assert.match(prompt, /Current role-owned exact files supplied by the host/);
    assert.match(prompt, /backend\/another\.mjs/);
    assert.match(prompt, /Denied scope/);
    assert.match(prompt, /Granted tools for this task/);
    assert.doesNotMatch(prompt, /Requested scope|writeSet/);
    provider.respond_tool(request, response(request));
    assert.equal((await next(provider, "owned", "run_finished")).result.status, "completed");
  } finally { await provider.close(); }
});

test("control-only single_run prompt gives no write-tool instruction or file ownership", async () => {
  const setup = fixture({ responses: [fauxAssistantMessage("Control discussion")] });
  setup.options.scope = new AgentScope({ write: [], tools: ["legion_query_memory", "legion_submit_supervision"] });
  const provider = await createPiSessionProvider(setup.options);
  try {
    provider.start_run("control-only", "Query project facts");
    assert.equal((await next(provider, "control-only", "run_finished")).result.status, "completed");
    const prompt = setup.calls[0].transcript;
    assert.match(prompt, /Current role-owned exact files supplied by the host: \[\]/);
    assert.match(prompt, /Memory and supervision tools return control results/);
    assert.doesNotMatch(prompt, /legion_write_file|legion_edit_file|Use only legion_write_file|writeSet/);
  } finally { await provider.close(); }
});

test("real partial SSE cancel then same-instance continuation distinguishes checkpoint restore",async()=>{
  for(const restore of [false,true]){
    const host=await localhost("openai-completions",{partialThenHang:true});
    const options=plainOptions("openai-completions",host.url);
    options.instance=new AgentInstance({...options.instance,roleId:"Supervisor",name:"Supervisor"});
    options.scope=new AgentScope({write:[],tools:["legion_list_files","legion_read_file","legion_remember_fact",
      "legion_query_memory","legion_request_interaction","legion_delegate_pm","legion_query_role_activity","legion_query_role_log"]});
    const provider=await createPiSessionProvider(options);
    const human="Human original: cancel this turn and preserve the complete request";
    const operationalPrompt="Host Su briefing as data\nHuman message:\n"+human;
    const promptErrors=[];
    const original=SdkSession.prototype.prompt;
    const spy=mock.method(SdkSession.prototype,"prompt",async function(...args){
      try{return await original.apply(this,args);}
      catch(error){
        let code="unclassified";
        if(/stale|session replacement|invalidated/i.test(error.message??""))code="stale_context";
        if(/already processing/i.test(error.message??""))code="already_processing";
        if(/authentication|api key/i.test(error.message??""))code="auth_preflight";
        if(/disposed/i.test(error.message??""))code="disposed";
        if(/getTime/i.test(error.message??""))code="invalid_timestamp";
        let type="Error";if(error instanceof TypeError)type="TypeError";
        promptErrors.push({stage:"sdk_prompt",type,code});throw error;
      }
    });
    try{
      provider.start_run("partial",operationalPrompt);
      const delta=await next(provider,"partial","text_delta");
      assert.equal(delta.type,"text_delta");assert.equal(delta.delta.text,"cancelled-partial-canary");
      assert.equal(host.requests.length,1);
      await provider.cancel_turn("partial");
      assert.equal((await turn(provider,"partial")).result.status,"cancelled");
      const cancelledHistory=provider.get_history();assert.deepEqual(cancelledHistory.messages,[{role:"user",text:operationalPrompt}]);
      const safe=new PiConversationHistory({messages:[{role:"user",text:human}]});
      if(restore)await provider.restore_history(new PiConversationCheckpoint({instance:options.instance,
        profileId:options.connection.profileId,profileVersion:options.connection.profileVersion,history:safe}));
      provider.start_run("continue","Continue safely");
      const done=await turn(provider,"continue");
      assert.equal(done.result.status,"completed",JSON.stringify({restore,code:done.result.errorCode,promptErrors,requests:host.requests.length}));
      assert.equal(host.requests.length,2);
      assert.match(JSON.stringify(host.requests[1].body),/Human original: cancel this turn and preserve the complete request/);
      assert.doesNotMatch(JSON.stringify(host.requests[1].body),/cancelled-partial-canary/);
      let firstText=operationalPrompt;if(restore)firstText=human;
      assert.deepEqual(provider.get_history().messages,[{role:"user",text:firstText},{role:"user",text:"Continue safely"},{role:"assistant",text:"reply 2"}]);
      assert.deepEqual(promptErrors,[]);
    }finally{spy.mock.restore();await provider.close();await host.close();}
  }
});
