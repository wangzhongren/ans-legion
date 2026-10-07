import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { dirname, join, relative, resolve, isAbsolute, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { AgentSession as ActualPiSession } from "@earendil-works/pi-coding-agent";
import { createRuntime, RoleBoundary, TaskDispatchContext } from "../../runtime.mjs";
import { MutationError } from "../../src/kernel/services/public/mutation.mjs";
import { createControlledModel, controlledTool, createResponseBarrier, fauxAssistantMessage, fauxToolCall } from "./controlled_pi_model.mjs";

const PROJECT = fileURLToPath(new URL("../../", import.meta.url));
const TEST_ROLE = process.env.LEGION_NODE_TEST_ROLE ?? "Tester";
assert.ok(["ProjectManager", "Reviewer", "Tester"].includes(TEST_ROLE), "unknown Node test role");
const TEMP_ROOT = resolve(PROJECT, ".ans/runtime/legion-desktop-workbench-v2", TEST_ROLE, "node/tmp");
const SECRET_A = "private-body-A";
const SECRET_B = "private-body-B";
const CONTROLLED_TOOL = "legion_write_file";

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
  const target = resolve(workspace); const remainder = relative(TEMP_ROOT, target);
  assert.ok(!isAbsolute(remainder) && !remainder.startsWith("..") && remainder.startsWith("legion-test-"));
  for (let current = target;; current = dirname(current)) {
    assert.equal((await fs.lstat(current)).isSymbolicLink(), false);
    if (current === dirname(current)) break;
  }
  await fs.rm(target, { recursive: true });
  await assert.rejects(fs.stat(target), { code: "ENOENT" });
}

async function fixture(t, scripts) {
  await prepareTemporaryRoot();
  for (const dependency of ["pi-ai", "pi-coding-agent"]) {
    const metadata = JSON.parse(await fs.readFile(new URL("../../node_modules/@earendil-works/" + dependency + "/package.json", import.meta.url), "utf8"));
    assert.equal(metadata.version, "1.0.4", "required actual installed SDK version");
  }
  const workspace = await fs.mkdtemp(join(TEMP_ROOT, "legion-test-agents-"));
  const model = createControlledModel(scripts);
  const boundary = new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"], denyScope: ["backend/private/"],
    capabilities: ["write_file"], tools: [CONTROLLED_TOOL] });
  const context = new TaskDispatchContext({ roleId: "Backend", taskId: "integration-task", organizationVersion: "v3",
    writeSet: ["backend/a.txt", "backend/b.txt"], tools: [CONTROLLED_TOOL] });
  const runtime = createRuntime({ workspace, boundaries: [boundary], organizationVersion: "v3",
    dispatchContext: context, modelProviders: [model.config] });
  const prompts = []; const disposed = [];
  const prompt = ActualPiSession.prototype.prompt;
  const dispose = ActualPiSession.prototype.dispose;
  t.mock.method(ActualPiSession.prototype, "prompt", function (...args) {
    assert.ok(this instanceof ActualPiSession);
    prompts.push({ session: this, sessionId: this.sessionId, prompt: args[0], options: args[1],
      activeTools: this.getActiveToolNames(), allTools: this.getAllTools().map((tool) => tool.name) });
    return prompt.apply(this, args);
  });
  t.mock.method(ActualPiSession.prototype, "dispose", function (...args) {
    disposed.push(this);
    return dispose.apply(this, args);
  });
  const fetch = t.mock.method(globalThis, "fetch", () => { throw new Error("offline integration forbids network"); });
  t.after(async () => {
    try { await runtime.close(); }
    finally { t.mock.restoreAll(); await cleanup(workspace); }
  });
  function config(name, resource = "backend/a.txt") {
    return { name, proxy: { provider: model.config.provider, model: "offline" },
      scope: { write: [resource], deny: [".ans/"], tools: [CONTROLLED_TOOL] } };
  }
  return { workspace, runtime, boundary, context, model, prompts, disposed, fetch, config };
}

function assertRealPi(f, expectedSessions) {
  assert.equal(f.prompts.length, expectedSessions, "real SDK prompt must execute, never skip or fake the loop");
  assert.equal(new Set(f.prompts.map((entry) => entry.session)).size, expectedSessions);
  assert.equal(new Set(f.prompts.map((entry) => entry.sessionId)).size, expectedSessions);
  for (const entry of f.prompts) {
    assert.ok(entry.session instanceof ActualPiSession);
    assert.deepEqual(entry.activeTools, [CONTROLLED_TOOL]);
    assert.deepEqual(entry.allTools, [CONTROLLED_TOOL]);
    assert.equal(entry.options.expandPromptTemplates, false);
    assert.ok(f.disposed.includes(entry.session), "actual SDK Session disposed");
    assert.ok(f.model.calls.some((call) => call.sessionId === entry.sessionId));
  }
  assert.equal(f.fetch.mock.callCount(), 0);
}

async function assertAudit(f, terminalKinds) {
  const events = await f.runtime.events();
  assert.deepEqual(events.map((event) => event.sequence), Array.from({ length: events.length }, (_, index) => index + 1));
  for (const event of events) {
    assert.equal(event.roleId, "Backend"); assert.equal(event.taskId, "integration-task");
    assert.equal(event.organizationVersion, "v3");
    assert.match(event.recordedAt, /\+08:00$/); assert.ok(Number.isFinite(Date.parse(event.recordedAt)));
    assert.ok(event.correlationId.length > 0);
    if (["proposal", "decision", "mutation_intent", "mutation_success", "mutation_failure"].includes(event.kind)) {
      assert.ok(event.proposalDigest.length === 64); assert.ok(event.resource.length > 0);
    }
  }
  for (const kind of terminalKinds) assert.ok(events.some((event) => event.kind === kind));
  const directory = join(f.workspace, ".ans/events");
  const text = await fs.readFile(join(directory, "index.jsonl"), "utf8");
  const records = text.trimEnd().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(records, events.map((event) => ({ ...event })));
  const dates = [...new Set(events.map((event) => event.recordedAt.slice(0, 10)))];
  assert.deepEqual((await fs.readdir(directory)).sort(), ["index.jsonl", ...dates.map((date) => date + ".jsonl")].sort());
  for (const date of dates) {
    const daily = await fs.readFile(join(directory, date + ".jsonl"), "utf8");
    assert.deepEqual(daily.trimEnd().split("\n").map((line) => JSON.parse(line)), records.filter((event) => event.recordedAt.startsWith(date)));
  }
  for (const secret of [SECRET_A, SECRET_B, "prompt-A", "prompt-B", "integration-fixture-credential", "integration-private-error"]) assert.ok(!text.includes(secret));
  assert.ok(!text.includes('"content"') && !text.includes('"prompt"'));
  return events;
}

function assertResponse(f, result, callIndex, expectedStatus, resource) {
  const response = result.toolResults[callIndex];
  assert.equal(response.runId, result.runId);
  assert.ok(response.requestId.length > 0);
  assert.equal(response.decision.proposalDigest, response.result.proposalDigest);
  assert.equal(response.result.status, expectedStatus);
  assert.equal(response.result.resource, resource);
}

test("two real Pi Sessions on same provider isolate transcripts tool requests results and exact scopes", { timeout: 20000 }, async (t) => {
  const f = await fixture(t, {
    "prompt-A": [controlledTool("backend/a.txt", SECRET_A), controlledTool("backend/b.txt", "A forbidden B", "cross-A"), fauxAssistantMessage("A final")],
    "prompt-B": [controlledTool("backend/b.txt", SECRET_B), controlledTool("backend/a.txt", "B forbidden A", "cross-B"), fauxAssistantMessage("B final")],
  });
  const [a, b] = await Promise.all([f.runtime.createAgent(f.config("A")), f.runtime.createAgent(f.config("B", "backend/b.txt"))]);
  assert.notEqual(a.instanceId, b.instanceId); assert.notEqual(a.sessionId, b.sessionId);
  assert.ok(Object.isFrozen(a) && Object.isFrozen(b) && Object.isFrozen(f.runtime));
  assert.deepEqual(Object.keys(a).sort(), ["instanceId", "name", "sessionId", "roleId", "taskId", "organizationVersion", "run", "cancel", "close"].sort());
  const [ar, br] = await Promise.all([a.run({ taskId: f.context.taskId, prompt: "prompt-A private instruction" }),
    b.run({ taskId: f.context.taskId, prompt: "prompt-B private instruction" })]);
  assert.equal(ar.status, "completed"); assert.equal(br.status, "completed");
  assert.equal(ar.assistantText, "A final"); assert.equal(br.assistantText, "B final");
  assert.notEqual(ar.runId, br.runId);
  assert.equal(ar.toolResults.length, 2); assert.equal(br.toolResults.length, 2);
  assertResponse(f, ar, 0, "written", "backend/a.txt"); assertResponse(f, ar, 1, "denied", "backend/b.txt");
  assertResponse(f, br, 0, "written", "backend/b.txt"); assertResponse(f, br, 1, "denied", "backend/a.txt");
  assert.equal(ar.toolResults[1].decision.reason, "outside_instance_or_task_scope");
  assert.equal(br.toolResults[1].decision.reason, "outside_instance_or_task_scope");
  assert.equal(new Set([...ar.toolResults, ...br.toolResults].map((response) => response.requestId)).size, 4);
  assert.equal(await f.runtime.readFile("backend/a.txt"), SECRET_A);
  assert.equal(await f.runtime.readFile("backend/b.txt"), SECRET_B);
  assert.equal(await fs.readFile(join(f.workspace, "backend/a.txt"), "utf8"), SECRET_A);
  assert.equal(await fs.readFile(join(f.workspace, "backend/b.txt"), "utf8"), SECRET_B);
  assert.equal(f.model.sessions.size, 2);
  for (const state of f.model.sessions.values()) assert.equal(state.calls, 3);
  for (const call of f.model.calls) {
    let foreignPrompt = "prompt-A"; let foreignBody = SECRET_A;
    if (call.marker === "prompt-A") { foreignPrompt = "prompt-B"; foreignBody = SECRET_B; }
    assert.ok(!call.transcript.includes(foreignPrompt)); assert.ok(!call.transcript.includes(foreignBody));
    if (f.model.calls.filter((entry) => entry.sessionId === call.sessionId).at(-1) === call) {
      assert.match(call.transcript, /written/); assert.match(call.transcript, /denied/);
      const ownResult = ar;
      let responses = ownResult.toolResults;
      if (call.marker === "prompt-B") responses = br.toolResults;
      for (const response of responses) assert.ok(call.transcript.includes(response.result.proposalDigest));
    }
  }
  const events = await assertAudit(f, ["agent_run_completed"]);
  for (const response of [...ar.toolResults, ...br.toolResults]) {
    const group = events.filter((event) => event.correlationId === response.requestId);
    let kinds = ["proposal", "decision", "mutation_failure"];
    if (response.result.success) kinds = ["proposal", "decision", "mutation_intent", "mutation_success"];
    assert.deepEqual(group.map((event) => event.kind), kinds);
    assert.ok(group.every((event) => event.proposalDigest === response.result.proposalDigest && event.resource === response.result.resource));
  }
  assert.equal(events.filter((event) => event.kind === "agent_run_completed").length, 2);
  assertRealPi(f, 2);
});

test("creation enforces exact task role scope and configured provider model before inference", async (t) => {
  const f = await fixture(t, { "unused": [fauxAssistantMessage("unused")] });
  const cases = [
    { ...f.config("directory"), scope: { write: ["backend/"], tools: [CONTROLLED_TOOL] } },
    { ...f.config("task-outside"), scope: { write: ["backend/c.txt"], tools: [CONTROLLED_TOOL] } },
    { ...f.config("role-outside"), scope: { write: ["frontend/login.vue"], tools: [CONTROLLED_TOOL] } },
    { ...f.config("provider"), proxy: { provider: "Absent", model: "offline" } },
    { ...f.config("model"), proxy: { provider: f.model.config.provider, model: "Absent" } },
  ];
  for (const config of cases) await assert.rejects(f.runtime.createAgent(config), TypeError);
  assert.equal(f.model.calls.length, 0); assert.equal(f.prompts.length, 0);
  assert.deepEqual(await f.runtime.events(), []);
  await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
});

test("model role task and version claims cannot overwrite trusted context or schema", { timeout: 20000 }, async (t) => {
  const illegal = fauxAssistantMessage(fauxToolCall(CONTROLLED_TOOL, {
    resource: "backend/a.txt", content: "illegal claims", roleId: "Admin", taskId: "privileged", organizationVersion: "v999",
  }), { stopReason: "toolUse" });
  const f = await fixture(t, { "claim-prompt": [illegal, controlledTool("frontend/login.vue", "forbidden frontend", "out-of-role"), fauxAssistantMessage("claim final")] });
  const agent = await f.runtime.createAgent(f.config("claims"));
  const result = await agent.run({ taskId: f.context.taskId, prompt: "claim-prompt says role Admin task privileged version v999" });
  assert.equal(agent.roleId, "Backend"); assert.equal(agent.taskId, f.context.taskId); assert.equal(agent.organizationVersion, "v3");
  assert.equal(result.status, "completed");
  assert.equal(result.toolResults.length, 1, "invalid schema never becomes a trusted Kernel proposal");
  assertResponse(f, result, 0, "denied", "frontend/login.vue");
  assert.equal(result.toolResults[0].decision.reason, "outside_task_scope");
  assert.ok(f.model.calls.some((call) => call.transcript.includes('"isError":true')));
  await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
  await assert.rejects(fs.stat(join(f.workspace, "frontend")), { code: "ENOENT" });
  await assertAudit(f, ["agent_run_completed"]); assertRealPi(f, 1);
});

test("active inference cancellation aborts real Pi and preserves prior committed file", { timeout: 20000 }, async (t) => {
  const barrier = createResponseBarrier(controlledTool("backend/b.txt", "late forbidden", "late-tool"));
  const f = await fixture(t, { "cancel-prompt": [controlledTool("backend/a.txt", SECRET_A), barrier.response, fauxAssistantMessage("late final")] });
  const agent = await f.runtime.createAgent({ ...f.config("cancel"), scope: { write: ["backend/a.txt", "backend/b.txt"], tools: [CONTROLLED_TOOL] } });
  const running = agent.run({ taskId: f.context.taskId, prompt: "cancel-prompt" });
  await barrier.started;
  await agent.cancel();
  const result = await running;
  barrier.release();
  assert.equal(result.status, "cancelled"); assert.equal(result.errorCode, "kernel_run_cancelled");
  assert.equal(result.toolResults.length, 1); assertResponse(f, result, 0, "written", "backend/a.txt");
  assert.equal(await f.runtime.readFile("backend/a.txt"), SECRET_A);
  await assert.rejects(fs.stat(join(f.workspace, "backend/b.txt")), { code: "ENOENT" });
  await agent.cancel(); await agent.close();
  await assert.rejects(agent.run({ taskId: f.context.taskId, prompt: "cancel-prompt again" }), /instance_not_ready/);
  await assertAudit(f, ["agent_run_cancelled"]); assertRealPi(f, 1);
});

test("version boundary and task revocation roundtrips never revive running instance rights", { timeout: 30000 }, async (t) => {
  for (const transition of ["version", "boundary", "task"]) {
    const barrier = createResponseBarrier(controlledTool("backend/a.txt", SECRET_A));
    const marker = "revoke-" + transition;
    const f = await fixture(t, { [marker]: [barrier.response, fauxAssistantMessage("late final")] });
    const agent = await f.runtime.createAgent(f.config("revoked-" + transition));
    const running = agent.run({ taskId: f.context.taskId, prompt: marker });
    await barrier.started;
    let stopping;
    if (transition === "version") stopping = f.runtime.updateVersion("v4");
    if (transition === "boundary") stopping = f.runtime.updateBoundary(new RoleBoundary({ ...f.boundary, writeScope: [] }));
    if (transition === "task") stopping = f.runtime.setTaskStatus(f.context.taskId, "cancelled");
    const result = await running; await stopping; barrier.release();
    assert.equal(result.status, "cancelled"); assert.equal(result.errorCode, "kernel_run_cancelled");
    assert.equal(result.toolResults.length, 0);
    if (transition === "version") await f.runtime.updateVersion("v3");
    if (transition === "boundary") await f.runtime.updateBoundary(f.boundary);
    if (transition === "task") await f.runtime.setTaskStatus(f.context.taskId, "active");
    await assert.rejects(agent.run({ taskId: f.context.taskId, prompt: marker }), /instance_not_ready/);
    await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
    await assertAudit(f, ["agent_run_cancelled"]); assertRealPi(f, 1);
    // Finish each parameter case before installing another transparent SDK observer.
    await f.runtime.close(); t.mock.restoreAll();
  }
});

test("real Pi intent append failure returns audited failure flags and creates no business directory", { timeout: 20000 }, async (t) => {
  const f = await fixture(t, { "intent-prompt": [controlledTool("backend/a.txt", SECRET_A), fauxAssistantMessage("must not continue")] });
  const agent = await f.runtime.createAgent(f.config("intent"));
  const open = fs.open;
  t.mock.method(fs, "open", async (path, mode, ...rest) => {
    if (path === join(f.workspace, ".ans/events/index.jsonl") && mode === "a") {
      const index = await fs.readFile(path, "utf8");
      const records = index.trimEnd().split("\n").map((line) => JSON.parse(line));
      if (records.at(-1).kind === "decision") throw new Error("integration-private-error");
    }
    return await open(path, mode, ...rest);
  });
  const result = await agent.run({ taskId: f.context.taskId, prompt: "intent-prompt" });
  assert.equal(result.status, "failed"); assert.equal(result.errorCode, "kernel_audit_failed");
  assert.equal(result.toolResults.length, 1); assertResponse(f, result, 0, "audit_failed", "backend/a.txt");
  assert.equal(result.toolResults[0].result.auditFailed, true); assert.equal(result.toolResults[0].result.observedMutation, false);
  await assert.rejects(fs.stat(join(f.workspace, "backend")), { code: "ENOENT" });
  await assert.rejects(f.runtime.createAgent(f.config("after-fault")), /runtime_unavailable/);
  await assertAudit(f, []); assertRealPi(f, 1);
});

test("real Pi committed file survives result audit failure with honest observation and stopped writes", { timeout: 20000 }, async (t) => {
  const f = await fixture(t, { "commit-prompt": [controlledTool("backend/a.txt", SECRET_A), controlledTool("backend/b.txt", "later write", "later"), fauxAssistantMessage("must not continue")] });
  const agent = await f.runtime.createAgent({ ...f.config("commit"), scope: { write: ["backend/a.txt", "backend/b.txt"], tools: [CONTROLLED_TOOL] } });
  const open = fs.open;
  t.mock.method(fs, "open", async (path, mode, ...rest) => {
    if (dirname(path) === join(f.workspace, ".ans/events") && !path.endsWith("index.jsonl") && mode === "a") {
      const index = await fs.readFile(join(f.workspace, ".ans/events/index.jsonl"), "utf8");
      const records = index.trimEnd().split("\n").map((line) => JSON.parse(line));
      if (records.at(-1).kind === "mutation_success") throw new Error("integration-private-error");
    }
    return await open(path, mode, ...rest);
  });
  const result = await agent.run({ taskId: f.context.taskId, prompt: "commit-prompt" });
  assert.equal(result.status, "failed"); assert.equal(result.errorCode, "kernel_audit_failed");
  assert.equal(result.toolResults.length, 1); assertResponse(f, result, 0, "audit_failed", "backend/a.txt");
  assert.equal(result.toolResults[0].result.observedMutation, true); assert.equal(result.toolResults[0].result.auditFailed, true);
  assert.equal(await f.runtime.readFile("backend/a.txt"), SECRET_A);
  assert.equal(await fs.readFile(join(f.workspace, "backend/a.txt"), "utf8"), SECRET_A);
  await assert.rejects(fs.stat(join(f.workspace, "backend/b.txt")), { code: "ENOENT" });
  await assert.rejects(f.runtime.events(), MutationError);
  await assert.rejects(f.runtime.createAgent(f.config("after-fault")), /runtime_unavailable/);
  assert.equal(f.model.calls.length, 1, "no new model response or tool after audit fault");
  const text = await fs.readFile(join(f.workspace, ".ans/events/index.jsonl"), "utf8");
  const records = text.trimEnd().split("\n").map((line) => JSON.parse(line));
  assert.equal(records.at(-1).kind, "mutation_success"); assert.equal(records.at(-1).observedMutation, true);
  for (const secret of [SECRET_A, "commit-prompt", "integration-fixture-credential", "integration-private-error"]) assert.ok(!text.includes(secret));
  assertRealPi(f, 1);
});

test("one run and Runtime close release real sessions and suppress late response tools", { timeout: 20000 }, async (t) => {
  const barrier = createResponseBarrier(controlledTool("backend/b.txt", "late closed write"));
  const f = await fixture(t, { "finished-prompt": [controlledTool("backend/a.txt", SECRET_A), fauxAssistantMessage("finished")],
    "close-prompt": [barrier.response, fauxAssistantMessage("late finish")] });
  const completed = await f.runtime.createAgent(f.config("completed"));
  await assert.rejects(completed.run({ taskId: "wrong-task", prompt: "finished-prompt" }), /task_mismatch/);
  const first = await completed.run({ taskId: f.context.taskId, prompt: "finished-prompt" });
  assert.equal(first.status, "completed");
  await assert.rejects(completed.run({ taskId: f.context.taskId, prompt: "finished-prompt" }), /instance_not_ready/);
  const closing = await f.runtime.createAgent(f.config("closing", "backend/b.txt"));
  const running = closing.run({ taskId: f.context.taskId, prompt: "close-prompt" });
  await barrier.started;
  await f.runtime.close(); const stopped = await running; barrier.release();
  assert.equal(stopped.toolResults.length, 0);
  await f.runtime.close(); await completed.close(); await closing.close();
  await assert.rejects(closing.run({ taskId: f.context.taskId, prompt: "close-prompt" }), /instance_not_ready/);
  await assert.rejects(f.runtime.createAgent(f.config("late-create")), /runtime_unavailable/);
  assert.equal(await fs.readFile(join(f.workspace, "backend/a.txt"), "utf8"), SECRET_A);
  await assert.rejects(fs.stat(join(f.workspace, "backend/b.txt")), { code: "ENOENT" });
  const text = await fs.readFile(join(f.workspace, ".ans/events/index.jsonl"), "utf8");
  assert.ok(!text.includes("late closed write"));
  assertRealPi(f, 2);
  assert.equal(stopped.status, "cancelled", JSON.stringify({ status: stopped.status, errorCode: stopped.errorCode,
    toolResults: stopped.toolResults.length }));
  assert.equal(stopped.errorCode, "kernel_run_cancelled");
});
