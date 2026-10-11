import { makeTestOwners, testLeaseContext } from "./test_control_memory.test.mjs";
const kernelOwners = makeTestOwners("Backend", ["backend/a.txt", "backend/b.txt"]);
import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import nodeFs from "node:fs";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
function tmpdir() {
  const path = fileURLToPath(new URL("../../.ans/runtime/legion-cli-role-owned-v2/KernelEngineer/tmp/", import.meta.url));
  mkdirSync(path, { recursive: true });
  return path;
}
import { createFauxCore, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import { AgentSession as SdkSession } from "@earendil-works/pi-coding-agent";
import { createRuntime } from "../../src/kernel/interface/runtime.mjs";
import { AgentSession, RoleBoundary, ActionProposal, Outcome, ExecutionPermit, PolicyDecision } from "../../src/kernel/models/core.mjs";
import { createHash } from "node:crypto";
let sequence = 0;
function provider(responses, id = "local-" + ++sequence) {
  const core = createFauxCore({ provider: id, models: [{ id: "model" }], tokensPerSecond: 0 });
  core.setResponses(responses ?? [fauxAssistantMessage("done")]);
  const calls = []; const model = core.models[0];
  return { core, calls, config: { provider: id, api: core.api, apiKey: "offline-key", baseUrl: "https://legion.invalid",
    models: [{ id: model.id, name: model.name, input: model.input, reasoning: model.reasoning, cost: model.cost,
      contextWindow: model.contextWindow, maxTokens: model.maxTokens }],
    streamSimple: (model, context, options) => { calls.push({ sessionId: options.sessionId, context: JSON.stringify(context),
      keys: Object.keys(options) }); return core.streamSimple(model, context, options); } } };
}
function tool(resource, content = "changed") { return fauxAssistantMessage(fauxToolCall("legion_write_file", { resource, content }), { stopReason: "toolUse" }); }
async function fixture(t, providers = [provider()], extra = {}) {
  const workspace = await fs.mkdtemp(join(tmpdir(), "legion-runtime-"));
  const boundary = new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"], denyScope: ["backend/private/"],
    tools: ["legion_write_file"], capabilities: ["write_file"] });
  const context = { roleId: "Backend", taskId: "task", organizationVersion: "v3", fileOwnersDigest: kernelOwners.digest, ownerGeneration: kernelOwners.version, tools: ["legion_write_file"] };
  const options = { workspace, fileOwners: kernelOwners, leaseContext: testLeaseContext(workspace, kernelOwners), boundaries: [boundary], organizationVersion: "v3", dispatchContext: context,
    modelProviders: providers.map((p) => p.config), ...extra };
  const runtime = createRuntime(options);
  t.after(async () => { t.mock.restoreAll(); await runtime.close(); await fs.rm(workspace, { recursive: true }); });
  function config(name = "agent", resource = "backend/a.txt", p = providers[0]) { return { name,
    proxy: { provider: p.config.provider, model: "model" }, scope: { write: ["backend/a.txt", "backend/b.txt"], deny: [".ans/"], tools: ["legion_write_file"] } }; }
  return { workspace, boundary, context, options, providers, runtime, config };
}
test("public immutable façade hides services, authority, SDK and capabilities", async (t) => {
  const f = await fixture(t); const agent = await f.runtime.createAgent(f.config());
  assert.ok(Object.isFrozen(f.runtime)); assert.ok(Object.isFrozen(agent));
  assert.deepEqual(Object.keys(agent).sort(), ["instanceId", "name", "sessionId", "roleId", "taskId", "organizationVersion", "run", "cancel", "close"].sort());
  assert.throws(() => { agent.roleId = "Frontend"; }, TypeError);
  for (const field of ["authority", "pipeline", "policy", "mutation", "provider", "session", "permit", "submit"]) assert.equal(agent[field], undefined);
  await agent.close(); await agent.close(); await assert.rejects(agent.run({ taskId: "task", prompt: "x" }), /not_ready/);
});
test("real SDK same-role runs serialize with full owner scope and independent sessions/transcripts", async (t) => {
  const a = provider([tool("backend/a.txt", "A"), tool("backend/c.txt", "forbidden"), fauxAssistantMessage("A complete")]);
  const b = provider([tool("backend/b.txt", "B"), fauxAssistantMessage("B complete")]);
  const f = await fixture(t, [a, b]);
  t.mock.method(globalThis, "fetch", () => { throw new Error("network forbidden"); });
  let active = 0; let peak = 0;
  const sessions = []; const prompt = SdkSession.prototype.prompt;
  t.mock.method(SdkSession.prototype, "prompt", async function (...args) {
    sessions.push(this); active += 1; peak = Math.max(peak, active);
    try { return await prompt.apply(this, args); } finally { active -= 1; }
  });
  const [aa, bb] = await Promise.all([f.runtime.createAgent(f.config("A", "backend/a.txt", a)), f.runtime.createAgent(f.config("B", "backend/b.txt", b))]);
  const [ar, br] = await Promise.all([aa.run({ taskId: "task", prompt: "only A" }), bb.run({ taskId: "task", prompt: "only B" })]);
  assert.equal(ar.status, "completed"); assert.equal(br.status, "completed");
  assert.equal(ar.toolResults[0].result.status, "written"); assert.equal(ar.toolResults[1].result.status, "denied");
  assert.equal(ar.toolResults[1].decision.reason, "outside_instance_or_task_scope");
  assert.equal(await f.runtime.readFile("backend/a.txt"), "A"); assert.equal(await f.runtime.readFile("backend/b.txt"), "B");
  assert.notEqual(aa.sessionId, bb.sessionId); assert.notEqual(a.calls[0].sessionId, b.calls[0].sessionId);
  assert.equal(peak, 1);
  assert.equal(sessions.length, 2); assert.notEqual(sessions[0], sessions[1]);
  assert.match(a.calls[2].context, /denied/); assert.doesNotMatch(a.calls[0].context, /only B/);
  for (const call of [...a.calls, ...b.calls]) assert.ok(!call.keys.some((key) => ["runtime", "submit", "writeFile", "permit"].includes(key)));
  assert.equal(globalThis.fetch.mock.callCount(), 0);
  const events = await f.runtime.events(); assert.ok(events.some((e) => e.kind === "mutation_failure" && e.resource === "backend/c.txt"));
  assert.ok(!JSON.stringify(events).includes("offline-key"));
});
test("unknown provider/model, expanded task/role scope and invalid tools reject before SDK", async (t) => {
  const f = await fixture(t);
  for (const config of [
    { ...f.config(), proxy: { provider: "unknown", model: "model" } },
    { ...f.config(), proxy: { provider: f.providers[0].config.provider, model: "unknown" } },
    { ...f.config(), scope: { write: ["backend/"], tools: ["legion_write_file"] } },
    { ...f.config(), scope: { write: ["backend/c.txt"], tools: ["legion_write_file"] } },
    { ...f.config(), scope: { write: ["frontend/a.txt"], tools: ["legion_write_file"] } },
    { ...f.config(), scope: { write: ["backend/a.txt"], tools: [] } },
    { ...f.config(), scope: { write: ["backend/a.txt"], tools: ["bash"] } },
    { ...f.config(), scope: { write: ["backend/a.txt"], deny: ["backend/"], tools: ["legion_write_file"] } },
    { ...f.config(), roleId: "Frontend" },
  ]) await assert.rejects(f.runtime.createAgent(config), TypeError);
  assert.equal(f.providers[0].calls.length, 0); assert.deepEqual(await f.runtime.events(), []);
});
test("modelProviders array contract rejects record, duplicates and execution callbacks", async (t) => {
  const f = await fixture(t); const p = f.providers[0].config;
  for (const values of [{ [p.provider]: p }, [p, p], [{ ...p, submit: () => {} }], [{ ...p, streamSimple: null }],
    [{ ...p, apiKey: "!shell" }], [{ ...p, models: [...p.models, ...p.models] }]]) {
    assert.throws(() => createRuntime({ ...f.options, modelProviders: values }), TypeError);
  }
});
test("copied trusted config, unique names, task match and one run lifecycle", async (t) => {
  const p = provider(); const f = await fixture(t, [p]); const config = f.config();
  const pending = f.runtime.createAgent(config); config.scope.write.push("frontend/x");
  const agent = await pending;
  await assert.rejects(f.runtime.createAgent(f.config()), /duplicate_agent_name/);
  await assert.rejects(agent.run({ taskId: "wrong", prompt: "x" }), /task_mismatch/);
  const result = await agent.run({ taskId: "task", prompt: "x" }); assert.equal(result.status, "completed");
  await assert.rejects(agent.run({ taskId: "task", prompt: "again" }), /not_ready/);
});
test("version/boundary/task changes revoke ready agents before asynchronous shutdown", async (t) => {
  const f = await fixture(t);
  const agent = await f.runtime.createAgent(f.config());
  const stopping = f.runtime.setTaskStatus("task", "cancelled");
  await assert.rejects(agent.run({ taskId: "task", prompt: "x" }), /stale_instance|not_ready/);
  await stopping;
  await f.runtime.setTaskStatus("task", "active");
  await assert.rejects(agent.run({ taskId: "task", prompt: "x" }), /instance_not_ready/);
  const next = await f.runtime.createAgent(f.config("next"));
  const changing = f.runtime.updateBoundary(new RoleBoundary({ ...f.boundary, denyScope: ["backend/"] }));
  await assert.rejects(next.run({ taskId: "task", prompt: "x" }), /not_ready|stale_instance/); await changing;
  await f.runtime.updateVersion("v4"); await assert.rejects(f.runtime.createAgent(f.config("late")), /stale_dispatch/);
});
test("pending genuine SDK creation is aborted/closed after context change", async (t) => {
  const f = await fixture(t); const pending = f.runtime.createAgent(f.config());
  const assertion = assert.rejects(pending, { name: "AbortError" });
  await f.runtime.updateVersion("v4"); await assertion;
  assert.equal(f.providers[0].calls.length, 0);
});
test("cancel active genuine inference, release resources and prevent late tool writes", async (t) => {
  let started;
  const start = new Promise((resolve) => { started = resolve; });
  const p = provider([async (context, options) => {
    started();
    if (!options.signal.aborted) await new Promise((resolve) => options.signal.addEventListener("abort", resolve, { once: true }));
    return tool("backend/a.txt", "late");
  }]);
  const f = await fixture(t, [p]); const agent = await f.runtime.createAgent(f.config());
  const run = agent.run({ taskId: "task", prompt: "wait" }); await start;
  await agent.cancel(); const result = await run; assert.equal(result.status, "cancelled");
  await assert.rejects(fs.stat(join(f.workspace, "backend/a.txt")), { code: "ENOENT" });
  await assert.rejects(agent.run({ taskId: "task", prompt: "again" }), /not_ready/);
});
test("Runtime close awaits real active run terminal audit before closing mutation", async (t) => {
  let started;
  const start = new Promise((resolve) => { started = resolve; });
  const p = provider([async (context, options) => {
    started();
    if (!options.signal.aborted) await new Promise((resolve) => options.signal.addEventListener("abort", resolve, { once: true }));
    return tool("backend/a.txt", "late closed write");
  }]);
  const f = await fixture(t, [p]); const agent = await f.runtime.createAgent(f.config());
  const running = agent.run({ taskId: "task", prompt: "wait for close" }); await start;
  await f.runtime.close(); const result = await running;
  assert.equal(result.status, "cancelled"); assert.equal(result.errorCode, "kernel_run_cancelled");
  assert.equal(result.toolResults.length, 0);
  const log = await fs.readFile(join(f.workspace, ".ans/events/index.jsonl"), "utf8");
  const events = log.trimEnd().split("\n").map((line) => JSON.parse(line));
  assert.equal(events.at(-1).kind, "agent_run_cancelled");
  assert.equal(events.at(-1).correlationId, result.runId); assert.ok(!log.includes("late closed write"));
  await assert.rejects(fs.stat(join(f.workspace, "backend/a.txt")), { code: "ENOENT" });
  await f.runtime.close(); await agent.close();
});
test("task revocation during actual write awaits cancels tool before final commit", async (t) => {
  const p = provider([tool("backend/a.txt"), fauxAssistantMessage("done")]); const f = await fixture(t, [p]);
  const agent = await f.runtime.createAgent(f.config()); const open = fs.open; let stop;
  t.mock.method(fs, "open", async (...args) => {
    const handle = await open(...args);
    if (args[1] === "wx") stop = f.runtime.setTaskStatus("task", "cancelled");
    return handle;
  });
  const result = await agent.run({ taskId: "task", prompt: "write" }); await stop;
  assert.equal(result.status, "cancelled"); assert.equal(result.toolResults[0].result.status, "denied");
  await assert.rejects(fs.stat(join(f.workspace, "backend/a.txt")), { code: "ENOENT" });
});
test("post-commit audit failure survives Pi result and revokes remaining actions", async (t) => {
  const p = provider([tool("backend/a.txt"), tool("backend/b.txt"), fauxAssistantMessage("done")]); const f = await fixture(t, [p]);
  const agent = await f.runtime.createAgent(f.config()); const rename = nodeFs.renameSync;
  t.mock.method(nodeFs, "renameSync", (...args) => { rename(...args); nodeFs.rmSync(join(f.workspace, ".ans/events/index.jsonl"));
    nodeFs.mkdirSync(join(f.workspace, ".ans/events/index.jsonl")); });
  const result = await agent.run({ taskId: "task", prompt: "write" });
  assert.equal(result.status, "failed"); assert.equal(result.errorCode, "kernel_audit_failed");
  assert.equal(result.toolResults[0].result.observedMutation, true); assert.equal(result.toolResults[0].result.auditFailed, true);
  assert.equal(await fs.readFile(join(f.workspace, "backend/a.txt"), "utf8"), "changed");
  assert.equal(p.calls.length, 1); await assert.rejects(f.runtime.createAgent(f.config("again")), /unavailable/);
});
test("legacy trusted prepare/execute APIs preserve opaque authority and update revalidation", async (t) => {
  const session = new AgentSession({ sessionId: "legacy", roleId: "Backend", taskId: "task", organizationVersion: "v3" });
  const f = await fixture(t, [provider()], { sessions: [session] });
  const proposal = new ActionProposal({ proposalId: "legacy", action: "write_file", resource: "backend/a.txt", content: "body",
    tool: "legion_write_file", capability: "write_file", session });
  const prepared = await f.runtime.prepare(proposal); assert.equal(prepared.decision.outcome, Outcome.ALLOW);
  assert.equal((await f.runtime.execute(proposal, new ExecutionPermit())).status, "denied");
  const forged = new PolicyDecision({ ...prepared.decision });
  assert.equal((await f.runtime.execute(proposal, forged)).status, "denied");
  await f.runtime.updateVersion("v4"); await f.runtime.updateVersion("v3");
  assert.equal((await f.runtime.execute(proposal, prepared.permit)).status, "denied");
  assert.equal((await f.runtime.submit(proposal)).result.status, "written");
  const outside = await f.runtime.submit(new ActionProposal({ ...proposal, resource: "backend/not-task.txt" }));
  assert.equal(outside.decision.outcome, Outcome.DENY); assert.equal(outside.decision.reason, "file_owner_mismatch");
  await assert.rejects(fs.stat(join(f.workspace, "backend/not-task.txt")), { code: "ENOENT" });
});
test("SDK inference failure returns safe code, closes session and cannot run again", async (t) => {
  const p = provider([]); const f = await fixture(t, [p]); const agent = await f.runtime.createAgent(f.config());
  const result = await agent.run({ taskId: "task", prompt: "x" }); assert.equal(result.status, "failed");
  assert.equal(result.errorCode, "pi_model_error"); await assert.rejects(agent.run({ taskId: "task", prompt: "again" }), /not_ready/);
});

test("trusted Runtime routes edit through exact task scope and existing approval gate", async (t) => {
  const workspace = await fs.mkdtemp(join(tmpdir(), "legion-runtime-edit-"));
  await fs.mkdir(join(workspace, "backend"));
  await fs.writeFile(join(workspace, "backend/a.txt"), "one two\n");
  const session = new AgentSession({ sessionId: "edit-session", roleId: "Backend", taskId: "task",
    organizationVersion: "v3" });
  const boundary = new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"],
    capabilities: ["write_file"], tools: ["legion_edit_file"] });
  const runtime = createRuntime({ fileOwners: makeTestOwners("Backend", ["backend/a.txt"]), leaseContext: testLeaseContext(workspace, makeTestOwners("Backend", ["backend/a.txt"])), workspace: await fs.realpath(workspace), boundaries: [boundary],
    sessions: [session], organizationVersion: "v3", dispatchContext: { roleId: "Backend", taskId: "task",
      organizationVersion: "v3", fileOwnersDigest: makeTestOwners("Backend", ["backend/a.txt"]).digest, ownerGeneration: kernelOwners.version, tools: ["legion_edit_file"] },
    modelProviders: [] });
  t.after(async () => { await runtime.close(); await fs.rm(workspace, { recursive: true, force: true }); });
  function edit(resource, current, replacement) {
    return new ActionProposal({ proposalId: "edit-" + resource, action: "edit_file", resource,
      expectedSha256: createHash("sha256").update(current).digest("hex"),
      replacements: [{ oldText: replacement, newText: "ONE" }], tool: "legion_edit_file",
      capability: "write_file", session });
  }
  const first = edit("backend/a.txt", "one two\n", "one");
  const allowed = await runtime.submit(first);
  assert.equal(allowed.decision.outcome, Outcome.ALLOW);
  assert.equal(allowed.result.status, "written");
  assert.equal(await fs.readFile(join(workspace, "backend/a.txt"), "utf8"), "ONE two\n");
  const outside = await runtime.submit(edit("backend/b.txt", "x", "x"));
  assert.equal(outside.decision.reason, "file_owner_mismatch");
  await assert.rejects(fs.stat(join(workspace, "backend/b.txt")), { code: "ENOENT" });
  await runtime.updateBoundary(new RoleBoundary({ ...boundary, requiredApprovals: ["write_file"] }));
  const approved = await runtime.submit(edit("backend/a.txt", "ONE two\n", "ONE"));
  assert.equal(approved.decision.outcome, Outcome.REQUIRE_APPROVAL);
  assert.equal(approved.result.status, "denied");
  assert.equal(await fs.readFile(join(workspace, "backend/a.txt"), "utf8"), "ONE two\n");
});
