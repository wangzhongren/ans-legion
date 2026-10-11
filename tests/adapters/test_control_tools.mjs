import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { AgentSession as SdkSession } from "@earendil-works/pi-coding-agent";
import { createFauxCore, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { Compile } from "typebox/compile";
import { createPiSessionProvider } from "../../src/adapters/providers/public/pi_session.mjs";
import { createPiAgentService } from "../../src/adapters/services/public/pi_agent.mjs";
import { AgentInstance, AgentScope, PiConnection, PiToolRequest, PiToolResult,
  AgentControlTools, AgentTools, AgentControlDecision, AgentControlResult,
  PiConversationCheckpoint } from "../../src/kernel/models/agent.mjs";
import { PolicyDecision, MutationResult, Outcome } from "../../src/kernel/models/core.mjs";
import { CheckSpec, CheckDecision, CheckResult } from "../../src/kernel/models/check.mjs";

const spec = new CheckSpec({ checkId: "unit", kind: "node-test",
  testResources: ["tests/test.mjs"], argv: ["--test", "tests/test.mjs"],
  inputResources: ["tests/test.mjs"], timeoutSeconds: 10 });
const suPayloads = {
  legion_delegate_pm: { action: "start", purpose: "plan", instruction: "Create current plan", sourceRefs: ["human:recorded"] },
  legion_query_role_activity: { roleId: "Backend" },
  legion_query_role_log: { roleId: "Backend", limit: 20 }
};
const newTools = ["legion_run_check", ...AgentControlTools];
const roleRoot = resolve(".ans/runtime/legion-governed-workflow-v1/AgentAdapterEngineer");
const fixtureRoot = resolve(roleRoot, "fixtures/control-tools");
mkdirSync(fixtureRoot, { recursive: true });
mkdirSync(resolve(roleRoot, "tmp"), { recursive: true });
for (const name of ["TMPDIR", "TEMP", "TMP"]) process.env[name] = resolve(roleRoot, "tmp");
function call(tool, id = "call") {
  let parameters = { payload: { purpose: "governed workflow", choices: ["yes", null, 1, true] } };
  if (Object.hasOwn(suPayloads, tool)) parameters = { payload: suPayloads[tool] };
  if (tool === "legion_run_check") parameters = { checkId: "unit" };
  if (tool === "legion_review_shell") parameters = { requestId: "shell-request", requestDigest: "a".repeat(64), revision: 1, approved: true, reason: "reviewed" };
  return fauxAssistantMessage(fauxToolCall(tool, parameters, { id }), { stopReason: "toolUse" });
}
function fixture({ tools = newTools, responses = [call(tools[0]), fauxAssistantMessage("continued")],
  budgets, lifecycle = "conversation", stream } = {}) {
  const core = createFauxCore({ api: "faux", provider: "control", models: [{ id: "model" }], tokensPerSecond: 0 });
  core.setResponses(responses);
  const calls = [];
  const model = core.models[0];
  const options = { instance: new AgentInstance({ instanceId: "instance", name: "member", sessionId: "session",
    roleId: "ProjectManager", taskId: "task", organizationVersion: "v1" }),
    proxy: new PiConnection({ provider: "control", model: "model" }),
    scope: new AgentScope({ write: [], tools, checks: [spec] }), cwd: fixtureRoot, lifecycle,
    modelProviders: { control: { api: core.api, baseUrl: "https://legion.invalid", apiKey: "offline",
      models: [{ id: model.id, name: model.name, reasoning: model.reasoning, input: model.input,
        cost: model.cost, contextWindow: model.contextWindow, maxTokens: model.maxTokens }],
      streamSimple: (modelValue, context, input) => {
        calls.push({ context: JSON.stringify(context), ...input });
        if (stream !== undefined) return stream(core, modelValue, context, input, calls.length);
        return core.streamSimple(modelValue, context, input);
      } } } };
  if (budgets !== undefined) options.budgets = budgets;
  return { options, calls };
}
async function next(service, runId, type = "terminal") {
  for (;;) {
    const event = await service.next_event(runId, { signal: AbortSignal.timeout(5000) });
    if (event.type === type || ["run_finished", "run_failed", "run_cancelled"].includes(event.type)) return event;
  }
}
function controlResponse(request, { tool = request.tool, runId = request.runId, requestId = request.requestId,
  allowed = true, status = "completed", payload = { answer: "yes" } } = {}) {
  return new PiToolResult({ requestId, runId,
    decision: new AgentControlDecision({ requestId, runId, tool, allowed, reason: "host_decision" }),
    result: new AgentControlResult({ requestId, runId, tool, status, reason: "host_result", payload }) });
}
function checkResponse(request, { checkId = request.parameters.checkId, allowed = true,
  status = "passed", executed = status === "passed" || status === "failed" } = {}) {
  const identity = { requestId: request.requestId, runId: request.runId, checkId, authorizationDigest: "a".repeat(64) };
  let exitCode = null; let actualArgv = []; let testCount = 0; let environment = null; let inputVersions = [];
  if (executed) {
    exitCode = 0;
    if (status === "failed") exitCode = 1;
    actualArgv = [process.execPath, ...spec.argv]; testCount = 1;
    environment = { platform: process.platform, runtime: "node", runtimeVersion: process.version,
      isolation: "host_fixture", network: "none" };
    inputVersions = [{ resource: "tests/test.mjs", sha256: "b".repeat(64), byteLength: 10 }];
  }
  return new PiToolResult({ requestId: request.requestId, runId: request.runId,
    decision: new CheckDecision({ ...identity, allowed, reason: "host_decision" }),
    result: new CheckResult({ ...identity, specDigest: spec.digest, status, reason: "host_result", executed,
      actualArgv, exitCode, testCount, stdout: "host evidence", stderr: "", logsTruncated: false,
      inputVersions, environment, startedAt: "2026-10-08T00:00:00.000Z", finishedAt: "2026-10-08T00:00:00.001Z" }) });
}

test("all registered control schemas bound parameters and actual SDK loadout stays isolated", async () => {
  const original = SdkSession.prototype.prompt;
  const spy = mock.method(SdkSession.prototype, "prompt", function (...args) {
    const tools = this.getAllTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), [...newTools].sort());
    assert.deepEqual(this.getActiveToolNames().sort(), [...newTools].sort());
    assert.deepEqual(this.getCallableToolNames().sort(), [...newTools].sort());
    assert.deepEqual(this.resourceLoader.getSkills().skills, []);
    assert.deepEqual(this.resourceLoader.getExtensions().extensions, []);
    for (const tool of tools) {
      const validator = Compile(tool.parameters);
      assert.equal(tool.parameters.additionalProperties, false);
      if (tool.name === "legion_run_check") {
        assert.deepEqual(Object.keys(tool.parameters.properties), ["checkId"]);
        assert.equal(validator.Check({ checkId: "unit" }), true);
        for (const invalid of [{ checkId: "" }, { checkId: "unit", shell: "sh" }, { payload: {} }]) {
          assert.equal(validator.Check(invalid), false);
        }
      } else if (tool.name === "legion_review_shell") {
        assert.equal(validator.Check({ requestId: "shell-request", requestDigest: "a".repeat(64), revision: 1, approved: true, reason: "reviewed" }), true);
        assert.equal(validator.Check({ payload: { approved: true } }), false);
      } else if (Object.hasOwn(suPayloads, tool.name)) {
        assert.deepEqual(Object.keys(tool.parameters.properties), ["payload"]);
        assert.equal(validator.Check({ payload: suPayloads[tool.name] }), true);
        for (const extra of [{callerRoleId:"Other"},{value:true},{permit:{}}]) {
          assert.equal(validator.Check({payload:{...suPayloads[tool.name],...extra}}),false);
        }
      } else {
        assert.deepEqual(Object.keys(tool.parameters.properties), ["payload"]);
        assert.equal(validator.Check({ payload: { nested: [{ value: "ok" }, null, 2, false] } }), true);
        let deep = "value";
        for (let index = 0; index < 9; index += 1) deep = { value: deep };
        for (const invalid of [{ payload: [] }, { payload: {}, roleId: "PM" }, { payload: { token: "secret" } },
          { payload: { callerRoleId: "PM" } }, { payload: { value: "x".repeat(65537) } }, { payload: deep }]) {
          assert.equal(validator.Check(invalid), false);
        }
      }
    }
    return original.apply(this, args);
  });
  const provider = await createPiSessionProvider(fixture({ responses: [fauxAssistantMessage("schemas")] }).options);
  try {
    provider.start_run("schema", "inspect");
    assert.equal((await next(provider, "schema")).result.assistantText, "schemas");
  } finally { await provider.close(); spy.mock.restore(); }
});

for (const tool of AgentControlTools) {
  test("real SDK and public Service relay actual allowed/denied/cancelled/stale/error " + tool, async () => {
    const setup = fixture({ tools: [tool], responses: [call(tool), fauxAssistantMessage("allowed"),
      call(tool), fauxAssistantMessage("denied"), call(tool), fauxAssistantMessage("cancelled"),
      call(tool), fauxAssistantMessage("stale"), call(tool), fauxAssistantMessage("error")] });
    const service = await createPiAgentService(setup.options);
    try {
      for (const [status, allowed] of [["completed", true], ["denied", false], ["cancelled", true],
        ["stale", false], ["error", false]]) {
        service.start_run(status, "request " + status);
        const { request } = await next(service, status, "tool_request");
        assert.ok(request instanceof PiToolRequest);
        assert.equal(request.tool, tool);
        const result = controlResponse(request, { status, allowed, payload: { hostStatus: status } });
        service.respond_tool(request, result);
        const end = await next(service, status);
        assert.equal(end.result.status, "completed");
        assert.deepEqual(end.result.toolResults, [result]);
        assert.match(setup.calls.at(-1).context, new RegExp('"hostStatus":"' + status + '"'));
        assert.throws(() => service.respond_tool(request, result), /invalid_or_late/);
      }
    } finally { await service.close(); }
  });
}

test("check evidence stays typed across passed, failed, refused, unsupported, cancelled and stale", async () => {
  for (const [status, allowed] of [["passed", true], ["failed", true], ["error", false],
    ["unsupported", true], ["cancelled", true], ["stale", false]]) {
    const setup = fixture({ tools: ["legion_run_check"] });
    const provider = await createPiSessionProvider(setup.options);
    try {
      provider.start_run(status, "run the approved check");
      const { request } = await next(provider, status, "tool_request");
      assert.deepEqual(request.parameters, { checkId: "unit" });
      const result = checkResponse(request, { status, allowed });
      provider.respond_tool(request, result);
      const end = await next(provider, status);
      assert.equal(end.result.toolResults[0], result);
      assert.ok(end.result.toolResults[0].result instanceof CheckResult);
      assert.equal(end.result.toolResults[0].result.status, status);
      assert.match(setup.calls[1].context, /host evidence/);
    } finally { await provider.close(); }
  }
});

test("host responses reject incorrect request/run/check/tool bindings and cross-category mutation", async () => {
  for (const tool of ["legion_run_check", "legion_request_interaction"]) {
    const provider = await createPiSessionProvider(fixture({ tools: [tool] }).options);
    try {
      provider.start_run("binding", "request");
      const { request } = await next(provider, "binding", "tool_request");
      const mutation = new PiToolResult({ requestId: request.requestId, runId: request.runId,
        decision: new PolicyDecision({ outcome: Outcome.ALLOW, reason: "ok", proposalDigest: "digest", organizationVersion: "v1" }),
        result: new MutationResult({ success: true, status: "written", reason: "written", resource: "x",
          proposalDigest: "digest", observedMutation: true }) });
      assert.throws(() => provider.respond_tool(request, mutation), /invalid_or_late/);
      let valid;
      if (tool === "legion_run_check") {
        assert.throws(() => provider.respond_tool(request, checkResponse(request, { checkId: "other" })), /invalid_or_late/);
        valid = checkResponse(request);
      } else {
        for (const wrong of [{ tool: "legion_design_roles" }, { runId: "old" }, { requestId: "other" }]) {
          assert.throws(() => provider.respond_tool(request, controlResponse(request, wrong)), /invalid_or_late/);
        }
        valid = controlResponse(request);
      }
      assert.throws(() => provider.respond_tool(new PiToolRequest({ ...request }), valid), /invalid_or_late/);
      assert.throws(() => provider.respond_tool(request, { ...valid }), /invalid_or_late/);
      provider.respond_tool(request, valid);
      assert.equal((await next(provider, "binding")).result.status, "completed");
    } finally { await provider.close(); }
  }
});

test("all host pending waits exceed active budget safely and resume bounded model time", async () => {
  for (const tool of newTools) {
    const setup = fixture({ tools: [tool], budgets: { turnTimeoutMs: 150 } });
    const provider = await createPiSessionProvider(setup.options);
    try {
      provider.start_run("waiting", "please ask the host");
      const { request } = await next(provider, "waiting", "tool_request");
      await delay(300);
      let result = controlResponse;
      if (tool === "legion_run_check") result = checkResponse;
      provider.respond_tool(request, result(request));
      const end = await next(provider, "waiting");
      assert.equal(end.result.status, "completed");
      assert.equal(setup.calls.length, 2);
      for (const call of setup.calls) {
        assert.ok(call.timeoutMs > 0 && call.timeoutMs <= 150);
        assert.equal(call.maxTokens, 8192); assert.equal(call.maxRetries, 0);
      }
    } finally { await provider.close(); }
  }
});

test("cancel_turn releases pending, rejects old run and checkpoint restoration has no replay", async () => {
  const tool = "legion_request_interaction";
  const setup = fixture({ tools: [tool], responses: [call(tool), fauxAssistantMessage("fresh reply")],
    budgets: { turnTimeoutMs: 150 } });
  const provider = await createPiSessionProvider(setup.options);
  try {
    provider.start_run("old", "ask");
    const { request } = await next(provider, "old", "tool_request");
    await delay(250);
    await provider.cancel_turn("old");
    assert.equal((await next(provider, "old")).result.status, "cancelled");
    const history = provider.get_history();
    await provider.restore_history(new PiConversationCheckpoint({ instance: setup.options.instance,
      profileId: "legacy:control/model", profileVersion: "v1", history }));
    assert.equal(setup.calls.length, 1);
    provider.start_run("new", "continue");
    assert.throws(() => provider.respond_tool(request, controlResponse(request)), /invalid_or_late/);
    await assert.rejects(provider.next_event("old"), /unknown_run/);
    const end = await next(provider, "new");
    assert.equal(end.result.assistantText, "fresh reply");
    assert.deepEqual(end.result.toolResults, []);
  } finally { await provider.close(); }
});

test("host wait resumes the remaining active budget instead of granting a new full budget", async () => {
  const tool = "legion_request_interaction";
  const setup = fixture({ tools: [tool], budgets: { turnTimeoutMs: 250 }, responses: [
    async () => { await delay(90); return call(tool); },
    async () => { await delay(400); return fauxAssistantMessage("too late"); } ] });
  const provider = await createPiSessionProvider(setup.options);
  try {
    provider.start_run("remaining", "ask");
    const { request } = await next(provider, "remaining", "tool_request");
    await delay(350);
    provider.respond_tool(request, controlResponse(request));
    const end = await next(provider, "remaining");
    assert.equal(end.result.status, "failed");
    assert.equal(end.result.errorCode, "pi_turn_timeout");
    assert.equal(setup.calls.length, 2);
    assert.ok(setup.calls[1].timeoutMs > 0 && setup.calls[1].timeoutMs <= 180);
    assert.ok(setup.calls[1].timeoutMs < setup.calls[0].timeoutMs);
    assert.deepEqual(end.result.toolResults.map((value) => value.result.status), ["completed"]);
  } finally { await provider.close(); }
});

test("whole cancellation or close settle waiting architecture requests and are permanent", async () => {
  for (const method of ["cancel", "close"]) {
    const provider = await createPiSessionProvider(fixture({ tools: ["legion_design_roles"],
      budgets: { turnTimeoutMs: 100 } }).options);
    provider.start_run(method, "design roles");
    const { request } = await next(provider, method, "tool_request");
    await delay(200);
    await provider[method](); await provider[method]();
    assert.throws(() => provider.respond_tool(request, controlResponse(request)), /invalid_or_late/);
    assert.throws(() => provider.start_run("new", "continue"), /not_ready/);
    if (method === "cancel") assert.equal((await next(provider, method)).result.status, "cancelled");
    await provider.close();
  }
});

test("control/check-only single_run works and ungranted tools cannot create pending requests", async () => {
  for (const tool of newTools) {
    const provider = await createPiSessionProvider(fixture({ tools: [tool], lifecycle: "single_run" }).options);
    try {
      provider.start_run("single", "request");
      const { request } = await next(provider, "single", "tool_request");
      let result = controlResponse;
      if (tool === "legion_run_check") result = checkResponse;
      provider.respond_tool(request, result(request));
      assert.equal((await next(provider, "single")).result.status, "completed");
    } finally { await provider.close(); }
  }
  const setup = fixture({ tools: [], responses: [call("legion_request_interaction")] });
  const provider = await createPiSessionProvider(setup.options);
  try {
    provider.start_run("ungranted", "request");
    const end = await next(provider, "ungranted");
    assert.equal(end.result.errorCode, "pi_unexpected_tool_call");
    assert.deepEqual(end.result.toolResults, []);
    assert.ok(AgentTools.includes("legion_run_check"));
  } finally { await provider.close(); }
});
