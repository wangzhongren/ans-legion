import test from "node:test";
import assert from "node:assert/strict";
import { createFauxCore, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import * as api from "../../src/adapters/services/public/pi_agent.mjs";
import { createProposalService } from "../../src/adapters/services/public/proposal.mjs";
import { AgentSession, PolicyDecision, MutationResult, Outcome } from "../../src/kernel/models/core.mjs";
import { AgentInstance, AgentScope, PiConnection, PiToolResult, PiConversationCheckpoint } from "../../src/kernel/models/agent.mjs";

function options() {
  const core = createFauxCore({ provider: "service-fixture", models: [{ id: "model" }] });
  core.setResponses([fauxAssistantMessage(fauxToolCall("legion_write_file", { resource: "backend/x.mjs", content: "text" }),
    { stopReason: "toolUse" }), fauxAssistantMessage("done")]);
  const model = core.models[0];
  return { instance: new AgentInstance({ instanceId: "instance", name: "worker", sessionId: "trusted",
    roleId: "Backend", taskId: "task", organizationVersion: "v3" }),
    proxy: new PiConnection({ provider: "service-fixture", model: "model" }),
    scope: new AgentScope({ write: ["backend/"], tools: ["legion_write_file"] }), cwd: process.cwd(),
    modelProviders: { "service-fixture": { api: core.api, apiKey: "offline", baseUrl: "https://legion.invalid",
      streamSimple: core.streamSimple, models: [{ id: model.id, name: model.name, input: model.input,
        reasoning: model.reasoning, cost: model.cost, contextWindow: model.contextWindow, maxTokens: model.maxTokens }] } } };
}
async function event(service, type) {
  for (;;) {
    const value = await service.next_event("run", { signal: AbortSignal.timeout(5000) });
    if (value.type === type || value.type.startsWith("run_f") || value.type === "run_cancelled") return value;
  }
}
test("public Pi factory returns own frozen contract and hides lower layer", async () => {
  assert.deepEqual(Object.keys(api).sort(), ["PiAgentService", "createPiAgentService"].sort());
  assert.throws(() => new api.PiAgentService(), TypeError);
  const service = await api.createPiAgentService(options());
  try {
    assert.ok(service instanceof api.PiAgentService);
    assert.ok(Object.isFrozen(service));
    for (const name of ["provider", "session", "modelRuntime", "permit", "submit"]) assert.equal(service[name], undefined);
  } finally { await service.close(); }
});
test("real Service -> Provider queue composes pure proposal and preserves request identity", async () => {
  const service = await api.createPiAgentService(options());
  try {
    assert.equal(service.start_run("run", "write"), undefined);
    const { request } = await event(service, "tool_request");
    const session = new AgentSession({ sessionId: "trusted", roleId: "Backend", taskId: "task", organizationVersion: "v3" });
    const proposal = createProposalService().convert(request, session);
    assert.equal(proposal.session, session);
    assert.equal(proposal.runId, "run");
    const result = new PiToolResult({ requestId: request.requestId, runId: request.runId,
      decision: new PolicyDecision({ outcome: Outcome.DENY, reason: "outside_scope", proposalDigest: proposal.digest, organizationVersion: "v3" }),
      result: new MutationResult({ success: false, status: "denied", reason: "outside_scope", resource: proposal.resource, proposalDigest: proposal.digest }) });
    service.respond_tool(request, result);
    const terminal = await event(service, "run_finished");
    assert.equal(terminal.result.toolResults[0], result);
    assert.equal(terminal.result.assistantText, "done");
    assert.throws(() => service.respond_tool(request, result), /invalid_or_late/);
  } finally { await service.close(); }
});
test("Service cancellation releases real pending tool and rejects new run", async () => {
  const service = await api.createPiAgentService(options());
  try {
    service.start_run("run", "write");
    await event(service, "tool_request");
    await service.cancel();
    assert.equal((await event(service, "run_cancelled")).result.status, "cancelled");
    assert.throws(() => service.start_run("new", "new"), /not_ready/);
    await service.close(); await service.close();
  } finally { await service.close(); }
});

test("own Service passes typed conversation deltas/history, reusable turns and permanent close", async () => {
  const setup = options();
  setup.lifecycle = "conversation";
  setup.scope = new AgentScope({ tools: [], write: [] });
  const core = createFauxCore({ provider: "service-fixture", models: [{ id: "model" }], tokensPerSecond: 0 });
  core.setResponses([fauxAssistantMessage("one"), fauxAssistantMessage("two")]);
  setup.modelProviders["service-fixture"].streamSimple = core.streamSimple;
  const service = await api.createPiAgentService(setup);
  async function finish(runId) {
    const values = [];
    for (;;) {
      const value = await service.next_event(runId, { signal: AbortSignal.timeout(5000) });
      values.push(value);
      if (value.type === "run_finished" || value.type === "run_failed" || value.type === "run_cancelled") return values;
    }
  }
  try {
    service.start_run("first", "Human1");
    const first = await finish("first");
    assert.equal(first.at(-1).result.assistantText, "one");
    assert.ok(first.some((value) => value.type === "text_delta"));
    await service.cancel_turn("first");
    service.start_run("second", "Human2");
    const second = await finish("second");
    assert.equal(second.at(-1).result.assistantText, "two");
    const history = service.get_history();
    const checkpoint = new PiConversationCheckpoint({ instance: setup.instance,
      profileId: "legacy:service-fixture/model", profileVersion: setup.instance.organizationVersion, history });
    await service.restore_history(checkpoint);
    assert.equal(service.get_history(), history);
    assert.equal(core.state.callCount, 2);
    await service.close(); await service.close();
    assert.throws(() => service.start_run("closed", "Human3"), /not_ready/);
  } finally { await service.close(); }
});

