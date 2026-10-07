/** Independent finite v2 review: real public SDK over controlled localhost; no paid models. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { join, resolve, dirname, relative, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import * as models from 'legion-runtime/workbench-models';
import { WorkbenchPipelineImpl, createWorkbenchPipeline } from '../../src/pipelines/workbench.mjs';
import { ProfilesServiceImpl } from '../../src/services/impl/profiles.mjs';
import { SettingsProviderImpl } from '../../src/providers/impl/settings.mjs';
import { createProbeProvider } from '../../src/providers/public/probe.mjs';
import { workbenchInput, workbenchDTO, taskState } from '../../src/models/workbench.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const role = process.env.LEGION_DESKTOP_TEST_ROLE ?? 'Reviewer';
assert.ok(['DesktopEngineer', 'ProjectManager', 'Reviewer', 'Tester'].includes(role));
let roleDirectory = role;
if (role !== 'DesktopEngineer') roleDirectory += '/desktop';
const base = join(project, '.ans/runtime/legion-desktop-workbench-v2', roleDirectory);
delete process.env.NODE_OPTIONS;
delete process.env.NODE_COMPILE_CACHE;
process.env.NODE_DISABLE_COMPILE_CACHE = '1';
process.env.TEMP = join(base, 'tmp');
process.env.TMP = join(base, 'tmp');

async function guard(path) {
  let current = resolve(path);
  for (;;) {
    const metadata = await fs.lstat(current);
    assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink(), 'unsafe fixture ancestor');
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
async function directory(t, name) {
  await guard(project);
  let current = project;
  for (const part of relative(project, join(base, name)).split(sep)) {
    current = join(current, part);
    try { await fs.mkdir(current); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    await guard(current);
  }
  const parent = current;
  const path = await fs.mkdtemp(join(parent, 'review-workbench-'));
  t.after(async () => {
    const child = relative(parent, path);
    assert.ok(child.startsWith('review-workbench-') && !child.includes(sep) && !isAbsolute(child));
    await guard(path);
    async function children(root) {
      for (const entry of await fs.readdir(root, { withFileTypes: true })) {
        const target = join(root, entry.name);
        assert.ok(!(await fs.lstat(target)).isSymbolicLink(), 'unsafe fixture cleanup child');
        if (entry.isDirectory()) await children(target);
      }
    }
    await children(path);
    await fs.rm(path, { recursive: true });
  });
  return path;
}
function encryption() {
  // Test-local lower infrastructure stand-in; native DPAPI is covered by retained Desktop test.
  const key = randomBytes(32);
  return {
    isEncryptionAvailable: () => true,
    encryptString(text) {
      const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, cipher.update(text), cipher.final(), cipher.getAuthTag()]);
    },
    decryptString(bytes) {
      const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(-16));
      return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString('utf8');
    }
  };
}
function complete(reply, text, tool = null) {
  if (reply.destroyed) return;
  reply.writeHead(200, { 'content-type': 'text/event-stream' });
  let delta = { role: 'assistant', content: text }; let finish = 'stop';
  if (tool) {
    delta = { role: 'assistant', tool_calls: [{ index: 0, id: 'review-call', type: 'function',
      function: { name: 'legion_write_file', arguments: JSON.stringify(tool) } }] };
    finish = 'tool_calls';
  }
  for (const [payload, reason] of [[delta, null], [{}, finish]]) {
    reply.write('data: ' + JSON.stringify({ id: 'review', object: 'chat.completion.chunk', model: 'local',
      choices: [{ index: 0, delta: payload, finish_reason: reason }] }) + '\n\n');
  }
  reply.end('data: [DONE]\n\n');
}
async function fixture(t, handler) {
  let pipeline; let server;
  const sockets = new Set(); const errors = [];
  t.after(async () => {
    if (pipeline) await pipeline.close();
    for (const socket of sockets) socket.destroy();
    if (server) await new Promise((done, reject) => server.close((error) => { if (error) reject(error); else done(); }));
    assert.deepEqual(errors, [], 'controlled server assertions');
  });
  const location = await directory(t, 'fixtures');
  const data = await directory(t, 'user-data');
  await directory(t, 'tmp');
  const root = join(location, 'customer'); await fs.mkdir(root);
  const calls = [];
  server = createServer(async (request, reply) => {
    try {
      let raw = ''; for await (const chunk of request) raw += chunk;
      const call = { body: JSON.parse(raw), authorization: request.headers.authorization };
      calls.push(call); await handler(call, reply, calls.length);
    } catch (error) { errors.push(error); reply.destroy(); }
  });
  server.on('connection', (socket) => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const crypto = encryption();
  const profiles = new ProfilesServiceImpl({ userDataDir: data }, {
    settings: new SettingsProviderImpl({ userDataDir: data }, async () => crypto),
    probe: createProbeProvider({ timeoutMs: 1000 })
  });
  const saved = await profiles.save({ name: 'Reviewer local', protocol: 'openai-completions', provider: 'review',
    modelId: 'custom-review-model', baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
    keyAction: 'replace', apiKey: 'review-local-secret' });
  assert.equal(saved.ok, true);
  pipeline = new WorkbenchPipelineImpl({ userDataDir: data }, { profiles });
  const selected = await pipeline.selectProject(root); assert.equal(selected.ok, true);
  const id = selected.value.currentProject.id;
  assert.deepEqual(selected.value.roles, []); assert.equal(calls.length, 0);
  assert.equal((await pipeline.setDefaultProfile({ profileId: saved.value.id })).ok, true);
  return { root, data, location, pipeline, profiles, id, profileId: saved.value.id, calls };
}
function plan(profileId, two = false) {
  let names = ['a']; if (two) names = ['a', 'b'];
  return { goal: 'Generate exact files', roles: [{ id: 'Worker', name: 'Worker', purpose: 'Exact implementation', profileId }],
    tasks: names.map((id) => ({ id, title: id, roleId: 'Worker', profileId, dependsOn: [], writeSet: [id + '.txt'], instruction: 'Write ' + id + '.txt' })) };
}
function planText(candidate) { return '```legion-plan\n' + JSON.stringify(candidate) + '\n```'; }
async function until(pipeline, predicate) {
  for (let count = 0; count < 250; count += 1) {
    const state = await pipeline.getState(); assert.equal(state.ok, true);
    if (predicate(state.value)) return state.value;
    await delay(10);
  }
  assert.fail('bounded workbench condition not reached');
}
async function draft(f, expectPlan = true) {
  assert.equal((await f.pipeline.sendMessage({ projectId: f.id, roleId: 'ProjectManager', text: 'Prepare exact plan' })).ok, true);
  return until(f.pipeline, (state) => state.turn?.status === 'completed' && (!expectPlan || state.plan?.status === 'draft'));
}

test('public pure authority brands reject forged reads, preserve approvals and permanently revoke whole authority', () => {
  const { createWorkbenchAuthority, ContextReadConfirmation, ContextSnapshot, ConfirmedTaskGrant,
    AgentSession, RoleBoundary, AgentScope, TaskDispatchContext, ActionProposal, PolicyDecision, Outcome } = models;
  assert.equal(Object.keys(models).length, 30);
  assert.equal(Object.hasOwn(models, '_createRuntimeAuthority'), false);
  for (const requiredApprovals of [[], ['write_file'], ['A.TXT']]) {
    const workspaceIdentity = { canonicalPath: 'D:/review-fixture', deviceId: '1', fileId: '2' };
    const boundary = new RoleBoundary({ roleId: 'Worker', writeScope: ['a.txt'], tools: ['legion_write_file'], capabilities: ['write_file'], requiredApprovals });
    const f = createWorkbenchAuthority({ workspaceIdentity, organizationVersion: 'v2', profileVersion: 'profile1', boundaries: [boundary] });
    const confirmation = new ContextReadConfirmation({ confirmationId: 'read', workspaceIdentity, organizationVersion: 'v2', profileVersion: 'profile1', contextReadSet: [] });
    const read = f.controller.confirmContextRead(confirmation);
    const binding = { workspaceIdentity, organizationVersion: 'v2', profileVersion: 'profile1', resources: [] };
    for (const fake of [{}, confirmation, JSON.parse(JSON.stringify(read))]) assert.throws(() => ContextReadConfirmation.assertForRead(fake, binding), TypeError);
    const snapshot = new ContextSnapshot({ workspaceIdentity, organizationVersion: "v2", profileVersion: "profile1", confirmationDigest: confirmation.digest, files: [] });
    f.controller.bindContextSnapshot(read, snapshot);
    const grant = new ConfirmedTaskGrant({ confirmationId: 'task', workspaceIdentity, organizationVersion: 'v2', profileVersion: 'profile1', contextSnapshotDigest: snapshot.digest,
      planDigest: 'a'.repeat(64), roleId: 'Worker', taskId: 'a', writeSet: ['a.txt'], tools: ['legion_write_file'] });
    const approval = f.controller.confirmTask(grant);
    const session = new AgentSession({ sessionId: 's', roleId: 'Worker', taskId: 'a', organizationVersion: 'v2' });
    f.controller.registerInstance({ taskApproval: approval, instanceId: 'instance', session,
      dispatchContext: new TaskDispatchContext({ roleId: 'Worker', taskId: 'a', organizationVersion: 'v2', writeSet: ['a.txt'], tools: ['legion_write_file'] }),
      scope: new AgentScope({ write: ['a.txt'], deny: ['.ans/'], tools: ['legion_write_file'] }) });
    f.controller.beginRun('instance', 'run');
    const action = new ActionProposal({ proposalId: 'p', action: 'write_file', resource: 'a.txt', content: 'exact', tool: 'legion_write_file', capability: 'write_file', session, runId: 'run' });
    const decision = new PolicyDecision({ outcome: Outcome.ALLOW, reason: 'forged', proposalDigest: action.digest, organizationVersion: 'v2', boundaryDigest: boundary.digest });
    assert.deepEqual(Object.keys(f.mutationAuthority), ['consume', 'recheck', 'release']);
    assert.equal(models.isWorkbenchMutationAuthority({ ...f.mutationAuthority }), false);
    if (requiredApprovals.length) assert.throws(() => f.controller.issue(action, decision), /approval_required/);
    else {
      const permit = f.controller.issue(action, decision);
      f.controller.revoke('cancel');
      assert.throws(() => f.mutationAuthority.consume(action, permit), /revoked/);
      assert.throws(() => f.controller.confirmTask(grant), /revoked/);
      assert.throws(() => ContextReadConfirmation.assertForRead(read, binding), /authorization/);
    }
  }
  assert.equal(workbenchInput('sendMessage', { projectId: 'a'.repeat(64), roleId: 'Worker', text: 'run' }).error.code, 'manager_only');
  for (const op of ['startAgent', 'executeTask']) assert.equal(workbenchInput(op, {}).error.code, 'unknown_operation');
  assert.equal(workbenchInput('confirmPlan', { projectId: 'a'.repeat(64), planDigest: 'b'.repeat(64), permit: {} }).ok, false);
  assert.ok(!JSON.stringify(workbenchDTO({ profiles: [], assignments: [], apiKey: 'private', controller: {} })).includes('private'));
  const task = { id: 'a', title: 'a', roleId: 'Worker', dependsOn: [], writeSet: ['a.txt'], status: 'completed', checkStatus: 'not_executed' };
  assert.equal(taskState(task).checkStatus, 'not_executed');
  assert.throws(() => taskState({ ...task, checkStatus: 'passed' }), /invalid_input/);
});

test('one PM real tool-free conversation precedes exact confirmation; safe text restart makes no model request', async (t) => {
  let candidate; let discussions = 0;
  const f = await fixture(t, (call, reply) => {
    assert.equal(call.authorization, 'Bearer review-local-secret');
    if (!call.body.tools?.length) { discussions += 1; let text = 'Clarify'; if (discussions === 2) text = planText(candidate); complete(reply, text); }
    else { assert.equal(call.body.tools.length, 1); assert.equal(call.body.tools[0].function.name, 'legion_write_file');
      if (call.body.messages.some((item) => item.role === 'tool')) complete(reply, 'Host result received');
      else complete(reply, '', { resource: 'a.txt', content: 'actual controlled write' }); }
  });
  candidate = plan(f.profileId);
  assert.equal((await f.pipeline.sendMessage({ projectId: f.id, roleId: 'Worker', text: 'start' })).error.code, 'manager_only');
  assert.equal(f.calls.length, 0);
  await draft(f, false); const staged = await draft(f);
  assert.equal(staged.history.messages.length, 4);
  assert.deepEqual(staged.roles.map((item) => item.id), ['ProjectManager', 'Worker']);
  assert.deepEqual(await fs.readdir(f.root), []);
  assert.equal((await f.pipeline.confirmPlan({ projectId: f.id, planDigest: '0'.repeat(64) })).error.code, 'plan_changed');
  assert.equal((await f.pipeline.confirmPlan({ projectId: f.id, planDigest: staged.plan.planDigest })).ok, true);
  const done = await until(f.pipeline, (state) => state.plan?.status === 'completed');
  assert.equal(done.tasks[0].checkStatus, 'not_executed'); assert.equal(done.tasks[0].results[0].observedMutation, true);
  assert.equal(await fs.readFile(join(f.root, 'a.txt'), 'utf8'), 'actual controlled write');
  const events = (await fs.readFile(join(f.root, '.ans/events/index.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.ok(events.some((event) => event.kind === 'mutation_success'));
  assert.ok(events.every((event) => event.recordedAt.endsWith('+08:00')));
  assert.equal((await f.pipeline.confirmPlan({ projectId: f.id, planDigest: staged.plan.planDigest })).error.code, 'plan_changed');
  const history = await fs.readFile(join(f.data, 'workbench-history', f.id + '.json'), 'utf8');
  for (const forbidden of ['review-local-secret', 'apiKey', 'controller', 'permit', 'pending']) assert.equal(history.includes(forbidden), false);
  await f.pipeline.close(); const before = f.calls.length;
  const restarted = createWorkbenchPipeline({ userDataDir: f.data });
  try {
    const restored = await restarted.selectProject(f.root); assert.equal(restored.ok, true);
    assert.deepEqual(restored.value.history.messages, done.history.messages); assert.equal(restored.value.turn, null);
    assert.equal(f.calls.length, before);
    assert.equal((await restarted.confirmPlan({ projectId: f.id, planDigest: staged.plan.planDigest })).error.code, 'plan_changed');
  } finally { await restarted.close(); }
});

test('write-time context change invalidates full plan; old bytes restoration cannot replay independent task grants', async (t) => {
  let candidate; let f; let changed = false;
  f = await fixture(t, async (call, reply) => {
    if (!call.body.tools?.length) complete(reply, planText(candidate));
    else if (!call.body.messages.some((item) => item.role === 'tool')) {
      if (!changed) { changed = true; await fs.writeFile(join(f.root, 'context.txt'), 'changed'); }
      complete(reply, '', { resource: 'a.txt', content: 'must not commit' });
    } else complete(reply, 'denied');
  });
  candidate = plan(f.profileId, true); await fs.writeFile(join(f.root, 'context.txt'), 'original');
  assert.equal((await f.pipeline.selectContext({ projectId: f.id, resources: ['context.txt'] })).ok, true);
  const staged = await draft(f);
  assert.equal((await f.pipeline.confirmPlan({ projectId: f.id, planDigest: staged.plan.planDigest })).ok, true);
  const done = await until(f.pipeline, (state) => state.plan?.status === 'invalidated');
  await fs.writeFile(join(f.root, 'context.txt'), 'original');
  assert.equal((await f.pipeline.confirmPlan({ projectId: f.id, planDigest: staged.plan.planDigest })).error.code, 'plan_changed');
  assert.equal(done.tasks[1].status, 'blocked');
  assert.equal(f.calls.filter((item) => item.body.tools?.length).length, 1);
  for (const name of ['a.txt', 'b.txt']) await assert.rejects(fs.stat(join(f.root, name)), { code: 'ENOENT' });
});

test('stop synchronously revokes before queued state read; late SDK write cannot commit', async (t) => {
  let candidate; let held;
  const f = await fixture(t, (call, reply) => { if (!call.body.tools?.length) complete(reply, planText(candidate)); else held = reply; });
  candidate = plan(f.profileId); const staged = await draft(f);
  assert.equal((await f.pipeline.confirmPlan({ projectId: f.id, planDigest: staged.plan.planDigest })).ok, true);
  for (let i = 0; i < 250 && !held; i += 1) await delay(10);
  assert.ok(held);
  assert.equal((await f.pipeline.stopExecution({ projectId: '0'.repeat(64) })).error.code, 'project_missing');
  const original = f.profiles.list.bind(f.profiles); let entered; let unblock;
  const pending = new Promise((done) => { entered = done; });
  f.profiles.list = async () => { entered(); await new Promise((done) => { unblock = done; }); return original(); };
  const state = f.pipeline.getState(); await pending;
  const stopping = f.pipeline.stopExecution({ projectId: f.id });
  f.profiles.list = original;
  try { complete(held, '', { resource: 'a.txt', content: 'late forbidden' }); await delay(30); }
  finally { unblock(); }
  await state; const stopped = await stopping; assert.equal(stopped.ok, true); assert.equal(stopped.value.plan.status, 'invalidated');
  await assert.rejects(fs.stat(join(f.root, 'a.txt')), { code: 'ENOENT' });
});

test('close revokes in-flight plan confirmation before publish and repeated close does not infer', async (t) => {
  let candidate;
  const f = await fixture(t, (call, reply) => complete(reply, planText(candidate)));
  candidate = plan(f.profileId); const staged = await draft(f);
  const original = f.profiles.resolveConnection.bind(f.profiles); let entered; let unblock;
  const pending = new Promise((done) => { entered = done; });
  f.profiles.resolveConnection = async (...args) => { entered(); await new Promise((done) => { unblock = done; }); return original(...args); };
  const confirming = f.pipeline.confirmPlan({ projectId: f.id, planDigest: staged.plan.planDigest }); await pending;
  const closing = f.pipeline.close(); f.profiles.resolveConnection = original; unblock();
  assert.equal((await confirming).ok, false); assert.equal((await closing).ok, true); assert.equal((await f.pipeline.close()).ok, true);
  assert.equal(f.calls.length, 1); assert.deepEqual(await fs.readdir(f.root), []);
});

test('SDK completed text without target writes fails goal and leaves software checks not_executed', async (t) => {
  let candidate;
  const f = await fixture(t, (call, reply) => { let text = 'I completed every file and passed every test'; if (!call.body.tools?.length) text = planText(candidate); complete(reply, text); });
  candidate = plan(f.profileId); const staged = await draft(f);
  assert.equal((await f.pipeline.confirmPlan({ projectId: f.id, planDigest: staged.plan.planDigest })).ok, true);
  const done = await until(f.pipeline, (state) => state.plan?.status === 'failed');
  assert.equal(done.tasks[0].status, 'failed'); assert.equal(done.tasks[0].error.code, 'task_outputs_missing');
  assert.deepEqual(done.tasks[0].results, []); assert.equal(done.tasks[0].checkStatus, 'not_executed');
  await assert.rejects(fs.stat(join(f.root, 'a.txt')), { code: 'ENOENT' });
});

test('cancel_turn leaves tool-free PM instance usable without restoring failed text or authority', async (t) => {
  let hang = true;
  const f = await fixture(t, (call, reply) => { if (hang) { reply.writeHead(200, { 'content-type': 'text/event-stream' }); reply.write(': wait\n\n'); } else complete(reply, 'Continue safely'); });
  const started = await f.pipeline.sendMessage({ projectId: f.id, roleId: 'ProjectManager', text: 'Cancel this turn' });
  assert.equal(started.ok, true);
  const cancelled = await f.pipeline.cancelTurn({ projectId: f.id, turnId: started.value.turn.id });
  assert.equal(cancelled.ok, true); assert.equal(cancelled.value.turn.status, 'cancelled'); assert.deepEqual(cancelled.value.history.messages, []);
  hang = false;
  assert.equal((await f.pipeline.sendMessage({ projectId: f.id, roleId: 'ProjectManager', text: 'Continue' })).ok, true);
  const done = await until(f.pipeline, (state) => state.turn?.status === 'completed');
  assert.deepEqual(done.history.messages.map((item) => item.text), ['Continue', 'Continue safely']);
  assert.equal(done.roles.length, 1); assert.equal(done.roles[0].id, 'ProjectManager');
  assert.deepEqual(await fs.readdir(f.root), []);
});
