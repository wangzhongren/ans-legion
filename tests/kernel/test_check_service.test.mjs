import { randomUUID } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createCheckService, CheckService } from "../../src/kernel/services/public/check.mjs";
import { CheckSpec, CheckRequest, CheckAuthorization, CheckDecision } from "../../src/kernel/models/check.mjs";
import { PiToolResult } from "../../src/kernel/models/agent.mjs";

const generated = fileURLToPath(new URL("../../.ans/runtime/legion-cli-role-owned-v2/KernelEngineer/tmp/", import.meta.url));
async function fixture(t, { approved = true, missingSignal = false, source, runtimeExecutable = process.execPath, knownKeys = [] } = {}) {
  await fs.mkdir(generated, { recursive: true }); const base = await fs.mkdtemp(join(generated, "service-"));
  const root = join(base, "candidate"); const output = join(base, "evidence");
  await fs.mkdir(root); await fs.mkdir(output);
  source ??= "import test from 'node:test'; test('actual',()=>{});";
  await fs.writeFile(join(root, "unit.mjs"), source);
  const stat = await fs.lstat(root, { bigint: true }); const lifetime = new AbortController();
  const spec = new CheckSpec({ checkId: "unit", kind: "node-test", argv: ["--test", "unit.mjs"],
    testResources: ["unit.mjs"], inputResources: ["unit.mjs"], timeoutSeconds: 5 });
  const authorization = new CheckAuthorization({ authorizationId: "host-record", confirmationId: "real-confirmation",
    workspaceIdentity: { canonicalPath: root, deviceId: String(stat.dev), fileId: String(stat.ino) }, planDigest: "a".repeat(64),
    fileOwnersDigest: "b".repeat(64), organizationVersion: "v1", profileVersion: "profile", roleId: "Acceptance",
    taskId: "task", sessionId: "session", instanceId: "instance", runId: "run", approvedChecks: [spec],
    inputVersions: [{ resource: "unit.mjs", byteLength: Buffer.byteLength(source), sha256: createHash("sha256").update(source).digest("hex") }] });
  const request = new CheckRequest({ requestId: "q", runId: "run", checkId: "unit" });
  const host = { active: approved, observed: [] };
  const authorizationValidator = { async validate(request, candidate, { signal }) {
    host.observed.push(candidate.digest);
    const allowed = host.active && !lifetime.signal.aborted && candidate.digest === authorization.digest && !signal.aborted;
    let reason = "approval_missing_or_revoked";
    if (allowed) reason = "live_host_approval";
    const decision = new CheckDecision({ allowed, reason,
      requestId: request.requestId, runId: request.runId, checkId: request.checkId, authorizationDigest: candidate.digest });
    const result = { decision, authorization };
    if (!missingSignal) result.signal = lifetime.signal;
    return result;
  } };
  const config = { workspaceRoot: root, runtimeExecutable, outputRoot: output, authorizationValidator, knownKeys };
  const service = createCheckService(config);
  t.after(async () => { await service.close(); assert.ok(base.startsWith(generated)); await fs.rm(base, { recursive: true }); });
  return { service, authorization, request, host, lifetime, config, root, output };
}

test("public Service creates adjacent Provider and returns matching real typed results", async (t) => {
  const f = await fixture(t); assert.equal(CheckService.assert(f.service), f.service);
  const response = await f.service.run(f.request, f.authorization);
  assert.equal(response.result.status, "passed", JSON.stringify(response)); assert.ok(f.host.observed.length >= 2);
  assert.ok(new PiToolResult({ requestId: f.request.requestId, runId: f.request.runId, ...response }));
  assert.throws(() => createCheckService({ ...f.config, provider: {} }), /unknown field/);
});

test("constructing typed authorization cannot replace missing live customer approval", async (t) => {
  const f = await fixture(t, { approved: false });
  const response = await f.service.run(f.request, f.authorization);
  assert.equal(response.decision.allowed, false); assert.equal(response.result.executed, false);
  assert.equal(response.result.status, "error");
  assert.throws(() => createCheckService({ ...f.config, authorizationValidator: undefined }), /validator_required/);
  const missing = await fixture(t, { missingSignal: true });
  assert.equal((await missing.service.run(missing.request, missing.authorization)).result.executed, false);
});

test("changed role/task/instance/run/profile/plan/organization/owners cannot reuse host approval", async (t) => {
  const f = await fixture(t);
  for (const changes of [{ roleId: "PM" }, { taskId: "other" }, { instanceId: "other" }, { sessionId: "other" },
    { runId: "other" }, { profileVersion: "other" }, { planDigest: "c".repeat(64) },
    { organizationVersion: "other" }, { fileOwnersDigest: "c".repeat(64) }, { confirmationId: "fake" }]) {
    const forged = new CheckAuthorization({ ...f.authorization, ...changes });
    const response = await f.service.run(f.request, forged);
    assert.equal(response.result.executed, false, JSON.stringify(changes)); assert.equal(response.decision.allowed, false);
  }
});

test("live authorization revocation during execution returns stale and cancels the isolated process", async (t) => {
  const f = await fixture(t, { source: "import test from 'node:test'; test('long',async()=>await new Promise(resolve=>setTimeout(resolve,30000)));" });
  const pending = f.service.run(f.request, f.authorization);
  setTimeout(() => { f.host.active = false; f.lifetime.abort(); }, 200);
  const response = await pending;
  assert.equal(response.result.status, "stale", JSON.stringify(response)); assert.equal(response.result.reason, "authorization_changed");
});

test("caller cancellation and close are terminal, repeated close safely awaits tracked runs", async (t) => {
  const f = await fixture(t, { source: "import test from 'node:test'; test('long',async()=>await new Promise(resolve=>setTimeout(resolve,30000)));" });
  const controller = new AbortController(); const pending = f.service.run(f.request, f.authorization, { signal: controller.signal });
  setTimeout(() => controller.abort(), 200);
  assert.equal((await pending).result.status, "cancelled");
  const next = f.service.run(f.request, f.authorization); await f.service.close(); await f.service.close();
  assert.equal((await next).result.status, "cancelled");
  assert.equal((await f.service.run(f.request, f.authorization)).result.executed, false);
});

test("close does not remain stuck on a host validator that never completes", async (t) => {
  const f = await fixture(t);
  const blocked = createCheckService({ ...f.config, authorizationValidator: { validate: () => new Promise(() => {}) } });
  const pending = blocked.run(f.request, f.authorization);
  await blocked.close();
  const value = await pending;
  assert.equal(value.result.status, "cancelled"); assert.equal(value.result.executed, false);
});

test("public CheckService accepts actual Electron full derived argv with live approval", async (t) => {
  const runtimeExecutable = fileURLToPath(new URL("../../apps/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron", import.meta.url));
  const f = await fixture(t, { runtimeExecutable });
  const response = await f.service.run(f.request, f.authorization);
  assert.equal(response.result.status, "passed", JSON.stringify(response));
  assert.equal(response.result.testCount, 1); assert.equal(response.result.actualArgv[0], runtimeExecutable);
  assert.ok(new PiToolResult({ requestId: f.request.requestId, runId: f.request.runId, ...response }));
});

async function assertNoKnownRunFile(directory, key) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await assertNoKnownRunFile(path, key);
    else if (entry.isFile()) assert.equal((await fs.readFile(path)).includes(Buffer.from(key)), false, "private run file contains known value");
  }
}

test("Check Service privately forwards knownKeys and blocks static input before effects", async (t) => {
  const key = randomUUID(); const source = "import test from 'node:test';test('safe',()=>{});\n//"+key;
  const f = await fixture(t, { source, knownKeys: [key] });
  const pair = await f.service.run(f.request, f.authorization);
  assert.equal(pair.result.executed, false); assert.equal(pair.result.reason, "known_key_input_rejected");
  assert.equal(JSON.stringify(pair).includes(key), false); assert.equal(JSON.stringify(f.authorization).includes(key), false);
  assert.equal(createHash("sha256").update(await fs.readFile(join(f.root, "unit.mjs"))).digest("hex"), createHash("sha256").update(source).digest("hex"));
  await assertNoKnownRunFile(f.output, key);
});

test("Check Service preserves split-output rejection from real isolated child", async (t) => {
  const key = randomUUID();
  const source = `import test from 'node:test'; test('secret',async()=>{const value=String.fromCharCode(${[...key].map(c=>c.charCodeAt(0)).join(',')});process.stderr.write(value.slice(0,9));await new Promise(r=>setTimeout(r,80));process.stderr.write(value.slice(9));});`;
  const f = await fixture(t, { source, knownKeys: [key] });
  const pair = await f.service.run(f.request, f.authorization);
  assert.equal(pair.result.executed, true); assert.equal(pair.result.reason, "known_key_output_rejected");
  assert.equal(JSON.stringify(pair).includes(key), false); await assertNoKnownRunFile(f.output, key);
});
