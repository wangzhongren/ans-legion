import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { dirname, resolve, join, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createWorkbenchPipeline } from '../../src/pipelines/workbench.mjs';
import { createWorkspaceService } from '../../src/services/public/workspace.mjs';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const role = process.env.LEGION_DESKTOP_TEST_ROLE ?? 'Tester';
assert.ok(['Tester', 'Reviewer', 'ProjectManager'].includes(role), 'unknown desktop test role');
export const generated = join(projectRoot, '.ans/runtime/legion-desktop-workbench-v2', role, 'desktop');
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function environment(extra = {}) {
  const value = { ...process.env, ...extra, LEGION_DESKTOP_TEST_ROLE: role, TEMP: join(generated, 'tmp'), TMP: join(generated, 'tmp'), NODE_DISABLE_COMPILE_CACHE: '1' };
  for (const field of ['NODE_OPTIONS', 'NODE_COMPILE_CACHE', 'NODE_PATH', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_OVERRIDE_DIST_PATH']) delete value[field];
  return value;
}
export async function guard(path, create = false) {
  const child = relative(projectRoot, resolve(path));
  assert.ok(child && child !== '..' && !child.startsWith('..' + sep) && !isAbsolute(child));
  for (let ancestor = projectRoot;; ancestor = dirname(ancestor)) {
    const info = await fs.lstat(ancestor); assert.ok(info.isDirectory() && !info.isSymbolicLink());
    if (ancestor === dirname(ancestor)) break;
  }
  let current = projectRoot;
  for (const component of child.split(sep)) {
    current = join(current, component);
    if (create) { try { await fs.mkdir(current); } catch (error) { if (error.code !== 'EEXIST') throw error; } }
    const info = await fs.lstat(current); assert.ok(info.isDirectory() && !info.isSymbolicLink());
  }
}
export async function removeOwned(path, base) {
  const child = relative(resolve(base), resolve(path));
  assert.ok(child && !child.startsWith('..') && !isAbsolute(child));
  await guard(path); await fs.rm(path, { recursive: true });
  await assert.rejects(fs.stat(path), { code: 'ENOENT' });
}
export async function ownedDirectory(kind, prefix) {
  const base = join(generated, kind); await guard(base, true);
  return fs.mkdtemp(join(base, prefix));
}
export async function waitFor(read, predicate, label, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const value = await read(); if (predicate(value)) return value; await delay(20); }
  assert.fail('bounded condition: ' + label);
}
export function plan(profileId, files = ['result.txt']) {
  return { goal: 'Finite exact customer work', roles: [{ id: 'Writer', name: '实施成员', purpose: 'Exact controlled output', profileId }],
    tasks: files.map((resource, index) => ({ id: 'task' + index, title: resource, roleId: 'Writer', profileId,
      dependsOn: [], writeSet: [resource], instruction: 'Write exactly ' + resource })) };
}
export const planText = candidate => '```legion-plan\n' + JSON.stringify(candidate) + '\n```';
export function completion(text, model = 'tester-local', tool = null) {
  let delta = { role: 'assistant', content: text }; let finish = 'stop';
  if (tool) { delta = { role: 'assistant', tool_calls: [{ index: 0, id: 'controlled-write', type: 'function', function: { name: 'legion_write_file', arguments: JSON.stringify(tool) } }] }; finish = 'tool_calls'; }
  return [{ index: 0, delta, finish_reason: null }, { index: 0, delta: {}, finish_reason: finish }]
    .map(choice => 'data: ' + JSON.stringify({ id: 'tester', object: 'chat.completion.chunk', model, choices: [choice] }) + '\n\n').join('') + 'data: [DONE]\n\n';
}
export function protocolText(protocol, text, model = 'tester-local') {
  if (protocol === 'openai-completions') return completion(text, model);
  let events;
  if (protocol === 'anthropic-messages') {
    events = [{ type: 'message_start', message: { id: 'msg', type: 'message', role: 'assistant', model, content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 0 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
      { type: 'content_block_stop', index: 0 }, { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } }, { type: 'message_stop' }];
  } else {
    const item = { id: 'item', type: 'message', role: 'assistant', status: 'in_progress', content: [] };
    const part = { type: 'output_text', text, annotations: [] };
    const response = { id: 'resp', object: 'response', created_at: 1, model, status: 'in_progress', output: [] };
    events = [{ type: 'response.created', response }, { type: 'response.output_item.added', output_index: 0, item },
      { type: 'response.content_part.added', item_id: 'item', output_index: 0, content_index: 0, part: { ...part, text: '' } },
      { type: 'response.output_text.delta', item_id: 'item', output_index: 0, content_index: 0, delta: text },
      { type: 'response.output_text.done', item_id: 'item', output_index: 0, content_index: 0, text },
      { type: 'response.content_part.done', item_id: 'item', output_index: 0, content_index: 0, part },
      { type: 'response.output_item.done', output_index: 0, item: { ...item, status: 'completed', content: [part] } },
      { type: 'response.completed', response: { ...response, status: 'completed', output: [{ ...item, status: 'completed', content: [part] }], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } }];
  }
  return events.map(event => 'event: ' + event.type + '\ndata: ' + JSON.stringify(event) + '\n\n').join('');
}
export async function localServer(handler) {
  const calls = []; const errors = []; const sockets = new Set();
  const server = createServer(async (request, reply) => {
    try { let raw = ''; for await (const bytes of request) raw += bytes;
      const call = { body: JSON.parse(raw), headers: request.headers, path: new URL(request.url, 'http://127.0.0.1').pathname }; calls.push(call); await handler(call, reply, calls);
    } catch (error) { errors.push(error); reply.destroy(); }
  });
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  return { calls, errors, baseUrl: 'http://127.0.0.1:' + server.address().port + '/v1',
    async close() { for (const socket of sockets) socket.destroy(); await new Promise((done, reject) => server.close(error => { if (error) reject(error); else done(); })); assert.deepEqual(errors, []); } };
}
export function replyText(reply, text, tool = null) { if (reply.destroyed) return; reply.writeHead(200, { 'content-type': 'text/event-stream' }); reply.end(completion(text, 'tester-local', tool)); }
const unwrap = result => { assert.equal(result.ok, true, result.error?.code); return result.value; };

/** Runs in actual Electron main, with real safeStorage and installed SDK/public production entries. */
export async function runPublicFlows(location, userData) {
  const { safeStorage } = await import('electron'); assert.equal(safeStorage.isEncryptionAvailable(), true);
  const { AgentSession } = await import('@earendil-works/pi-coding-agent');
  for (const dependency of ['pi-ai', 'pi-coding-agent']) {
    const metadata = JSON.parse(await fs.readFile(join(projectRoot, 'apps/desktop/node_modules/@earendil-works', dependency, 'package.json'), 'utf8'));
    assert.equal(metadata.version, '1.0.4');
  }
  const prompts = []; const originalPrompt = AgentSession.prototype.prompt;
  AgentSession.prototype.prompt = function (...args) { assert.ok(this instanceof AgentSession); prompts.push({ session: this, tools: this.getActiveToolNames() }); return originalPrompt.apply(this, args); };
  const scenarios = []; let pipeline; let server; let mode = 'chat'; let candidate; let contextChangeRoot; let deniedResource; let held; let workerCalls = 0;
  const rootA = join(location, 'customer-A'); const rootB = join(location, 'customer-B'); await fs.mkdir(rootA); await fs.mkdir(rootB);
  try {
    server = await localServer(async (call, reply) => {
      if (!call.path.endsWith('/messages')) assert.equal(call.headers.authorization, 'Bearer tester-local-secret');
      if (call.path.endsWith('/responses')) { reply.writeHead(200, { 'content-type': 'text/event-stream' }); reply.end(protocolText('openai-responses', 'OK')); return; }
      if (call.path.endsWith('/messages')) { assert.equal(call.headers['x-api-key'], 'tester-local-secret'); reply.writeHead(200, { 'content-type': 'text/event-stream' }); reply.end(protocolText('anthropic-messages', 'OK')); return; }
      if (!call.body.tools?.length) {
        if (mode === 'hang') { held = reply; reply.writeHead(200, { 'content-type': 'text/event-stream' }); reply.write('data: ' + JSON.stringify({ id: 'stream', model: 'tester-local', choices: [{ index: 0, delta: { role: 'assistant', content: 'partial delta' }, finish_reason: null }] }) + '\n\n'); return; }
        let text = 'Clarify safely'; if (mode === 'plan') text = planText(candidate); replyText(reply, text); return;
      }
      workerCalls += 1; assert.equal(call.body.tools.length, 1); assert.equal(call.body.tools[0].function.name, 'legion_write_file');
      if (mode === 'worker-hang') { held = reply; return; }
      if (mode === 'missing') { replyText(reply, 'All work and tests completed'); return; }
      if (call.body.messages.some(item => item.role === 'tool')) { replyText(reply, 'Host result received'); return; }
      if (mode === 'context-change') await fs.writeFile(join(contextChangeRoot, 'context.txt'), 'changed');
      if (mode === 'deny') { replyText(reply, '', { resource: deniedResource, content: 'forbidden controlled proposal' }); return; }
      replyText(reply, '', { resource: candidate.tasks[0].writeSet[0], content: 'actual tester write' });
    });
    pipeline = createWorkbenchPipeline({ userDataDir: userData });
    const saved = unwrap(await pipeline.saveProfile({ name: 'Tester local', protocol: 'openai-completions', provider: 'tester', modelId: 'tester-local', baseUrl: server.baseUrl, keyAction: 'replace', apiKey: 'tester-local-secret' }));
    const profileId = saved.profiles[0].id; unwrap(await pipeline.setDefaultProfile({ profileId }));
    let state = unwrap(await pipeline.selectProject(rootA)); const idA = state.currentProject.id;
    assert.deepEqual(state.roles, []); assert.equal(server.calls.length, 0); assert.deepEqual(await fs.readdir(rootA), []);
    assert.equal((await pipeline.selectProject(userData)).ok, false); assert.equal((await pipeline.selectProject(dirname(userData))).ok, false);
    unwrap(await pipeline.selectProject(rootA));
    const read = async () => unwrap(await pipeline.getState());
    const send = async text => { const started = unwrap(await pipeline.sendMessage({ projectId: (await read()).currentProject.id, roleId: 'ProjectManager', text })); await waitFor(read, value => value.turn?.status === 'completed' && (!candidate || mode !== 'plan' || value.plan?.status === 'draft'), 'actual turn/plan'); return started; };
    await send('first requirement'); await send('clarify same manager');
    assert.equal(prompts[0].session, prompts[1].session); assert.deepEqual(prompts[0].tools, []);
    assert.equal((await read()).history.messages.length, 4); assert.deepEqual(await fs.readdir(rootA), []);
    assert.equal((await pipeline.sendMessage({ projectId: idA, roleId: 'Writer', text: 'bypass' })).error.code, 'manager_only');
    mode = 'hang'; const started = unwrap(await pipeline.sendMessage({ projectId: idA, roleId: 'ProjectManager', text: 'cancel streamed turn' }));
    await waitFor(read, value => value.turn?.text.includes('partial delta'), 'real delta'); unwrap(await pipeline.cancelTurn({ projectId: idA, turnId: started.turn.id }));
    mode = 'chat'; await send('continue after cancel'); assert.equal(prompts[0].session, prompts[3].session); assert.equal((await read()).history.messages.length, 6);
    state = unwrap(await pipeline.selectProject(rootB)); const idB = state.currentProject.id; assert.notEqual(idA, idB); assert.deepEqual(state.history.messages, []);
    await send('only project B'); const historyB = (await read()).history.messages;
    state = unwrap(await pipeline.selectProject(rootA)); assert.equal(state.history.messages.length, 6); assert.ok(!JSON.stringify(state.history).includes('only project B')); assert.ok(JSON.stringify(historyB).includes('only project B'));
    scenarios.push('first-message/same-PM/delta/cancel/continue/two-project isolation');
    await fs.writeFile(join(rootA, 'context.txt'), 'explicit-context-marker'); await fs.writeFile(join(rootA, 'unselected.txt'), 'unselected-secret-marker');
    assert.equal((await pipeline.selectContext({ projectId: idA, resources: ['../outside'] })).ok, false);
    unwrap(await pipeline.selectContext({ projectId: idA, resources: ['context.txt'] }));
    candidate = plan(profileId); mode = 'plan'; await send('prepare exact plan'); state = await read();
    assert.equal(state.context.files[0].sha256, sha(Buffer.from('explicit-context-marker'))); assert.deepEqual(state.roles.map(item => item.id), ['ProjectManager', 'Writer']);
    assert.deepEqual((await fs.readdir(rootA)).sort(), ['context.txt', 'unselected.txt']);
    assert.ok(JSON.stringify(server.calls.at(-1).body).includes('explicit-context-marker')); assert.ok(!JSON.stringify(server.calls.at(-1).body).includes('unselected-secret-marker'));
    assert.equal((await pipeline.confirmPlan({ projectId: idA, planDigest: '0'.repeat(64) })).ok, false);
    unwrap(await pipeline.confirmPlan({ projectId: idA, planDigest: state.plan.planDigest }));
    const done = await waitFor(read, value => value.plan?.status === 'completed', 'actual file completion');
    assert.equal(await fs.readFile(join(rootA, 'result.txt'), 'utf8'), 'actual tester write'); assert.equal(done.tasks[0].checkStatus, 'not_executed');
    assert.equal(done.tasks[0].results[0].observedMutation, true); assert.equal((await pipeline.confirmPlan({ projectId: idA, planDigest: state.plan.planDigest })).ok, false);
    const events = (await fs.readFile(join(rootA, '.ans/events/index.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(events.map(event => event.sequence), events.map((_, index) => index + 1));
    assert.ok(events.some(event => event.kind === 'mutation_success')); assert.ok(events.every(event => event.recordedAt.endsWith('+08:00')));
    assert.ok(!JSON.stringify(events).includes('actual tester write')); assert.ok(!JSON.stringify(done).includes('tester-local-secret'));
    for (const date of new Set(events.map(event => event.recordedAt.slice(0, 10)))) {
      const daily = (await fs.readFile(join(rootA, '.ans/events', date + '.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
      assert.deepEqual(daily, events.filter(event => event.recordedAt.startsWith(date)));
    }
    scenarios.push('Human exact context/confirmation/real tool write/audit/no replay/not_executed');
    for (const resource of ['outside/new.txt', '.ans/organization/current.yaml']) {
      candidate = plan(profileId, ['approved-only.txt']); mode = 'plan'; await send('deny outside exact task'); const staged = await read();
      mode = 'deny'; deniedResource = resource; unwrap(await pipeline.confirmPlan({ projectId: idA, planDigest: staged.plan.planDigest }));
      const denied = await waitFor(read, value => value.plan?.status === 'failed', 'dynamic task deny');
      assert.equal(denied.tasks[0].results[0].status, 'denied'); assert.equal(denied.tasks[0].results[0].observedMutation, false);
      await assert.rejects(fs.stat(join(rootA, resource)), { code: 'ENOENT' }); await assert.rejects(fs.stat(join(rootA, 'approved-only.txt')), { code: 'ENOENT' });
    }
    for (const protocol of ['openai-responses', 'anthropic-messages']) {
      const configured = unwrap(await pipeline.saveProfile({ name: protocol, protocol, provider: 'tester', modelId: 'tester-local', baseUrl: server.baseUrl, keyAction: 'replace', apiKey: 'tester-local-secret' }));
      const id = configured.profiles.find(item => item.protocol === protocol).id;
      const probe = unwrap(await pipeline.testConnection({ profileId: id })); assert.equal(probe.status, 'success');
      unwrap(await pipeline.setDefaultProfile({ profileId: id })); unwrap(await pipeline.selectProject(rootB)); mode = 'chat'; candidate = null; await send('real protocol discussion ' + protocol);
      assert.ok((await read()).history.messages.at(-1).text.includes('OK'));
    }
    scenarios.push('three installed public Pi protocols through real HTTP and sessions');
    unwrap(await pipeline.setDefaultProfile({ profileId })); unwrap(await pipeline.selectProject(rootA));
    candidate = plan(profileId, ['blocked-a.txt', 'blocked-b.txt']); mode = 'plan'; await send('context revoke plan'); state = await read();
    mode = 'context-change'; contextChangeRoot = rootA; unwrap(await pipeline.confirmPlan({ projectId: idA, planDigest: state.plan.planDigest }));
    const invalid = await waitFor(read, value => value.plan?.status === 'invalidated', 'whole plan invalidation');
    await fs.writeFile(join(rootA, 'context.txt'), 'explicit-context-marker'); assert.equal((await pipeline.confirmPlan({ projectId: idA, planDigest: state.plan.planDigest })).ok, false);
    assert.equal(invalid.tasks[1].status, 'blocked'); for (const file of ['blocked-a.txt', 'blocked-b.txt']) await assert.rejects(fs.stat(join(rootA, file)), { code: 'ENOENT' });
    scenarios.push('write-time context change permanently revokes whole plan');
    candidate = plan(profileId, ['missing.txt']); mode = 'plan'; await send('missing output plan'); state = await read(); mode = 'missing';
    unwrap(await pipeline.confirmPlan({ projectId: idA, planDigest: state.plan.planDigest }));
    const missing = await waitFor(read, value => value.plan?.status === 'failed', 'missing outputs'); assert.equal(missing.tasks[0].error.code, 'task_outputs_missing'); assert.equal(missing.tasks[0].checkStatus, 'not_executed');
    scenarios.push('tool-less worker completion cannot fabricate target or software check');
    candidate = plan(profileId, ['late.txt']); mode = 'plan'; await send('stop plan'); state = await read(); mode = 'worker-hang'; held = null;
    unwrap(await pipeline.confirmPlan({ projectId: idA, planDigest: state.plan.planDigest })); await waitFor(async () => held, Boolean, 'held real worker');
    const stopping = pipeline.stopExecution({ projectId: idA }); replyText(held, '', { resource: 'late.txt', content: 'late forbidden' }); unwrap(await stopping);
    await assert.rejects(fs.stat(join(rootA, 'late.txt')), { code: 'ENOENT' }); assert.equal((await pipeline.confirmPlan({ projectId: idA, planDigest: state.plan.planDigest })).ok, false);
    candidate = plan(profileId, ['close.txt']); mode = 'plan'; await send('close plan'); state = await read();
    const confirming = pipeline.confirmPlan({ projectId: idA, planDigest: state.plan.planDigest }); const closing = pipeline.close();
    assert.equal((await confirming).ok, false); unwrap(await closing); unwrap(await pipeline.close());
    await assert.rejects(fs.stat(join(rootA, 'close.txt')), { code: 'ENOENT' });
    scenarios.push('immediate stop/close revoke; repeated close finishes');
    const requests = server.calls.length; pipeline = createWorkbenchPipeline({ userDataDir: userData }); state = unwrap(await pipeline.selectProject(rootA));
    assert.equal(state.turn, null); assert.equal(server.calls.length, requests); assert.ok(state.history.messages.length > 0);
    assert.equal((await pipeline.confirmPlan({ projectId: idA, planDigest: state.plan.planDigest })).ok, false);
    const settings = await fs.readFile(join(userData, 'desktop-settings.json'), 'utf8'); assert.ok(!settings.includes('tester-local-secret')); assert.ok(state.profiles.every(item => !Object.hasOwn(item, 'apiKey')));
    scenarios.push('real safeStorage encrypted settings/history restore without keys/grants/model calls');
    for (const kind of ['mutation_intent', 'mutation_success']) {
      const faultRoot = join(location, kind); await fs.mkdir(faultRoot); unwrap(await pipeline.selectProject(faultRoot));
      candidate = plan(profileId, ['business/nested.txt', 'later.txt']); mode = 'plan'; await send('audit fault plan'); const staged = await read();
      const originalOpen = fs.open;
      fs.open = async function (path, ...args) {
        const handle = await originalOpen.call(this, path, ...args);
        if (String(path).includes('.ans') && String(path).endsWith('.jsonl')) {
          const write = handle.writeFile.bind(handle);
          handle.writeFile = async function (data, ...options) { if (String(data).includes('"kind":"' + kind + '"')) { const error = new Error('controlled audit fault'); error.code = 'EIO'; throw error; } return write(data, ...options); };
        }
        return handle;
      };
      try {
        unwrap(await pipeline.confirmPlan({ projectId: staged.currentProject.id, planDigest: staged.plan.planDigest }));
        const failed = await waitFor(read, value => value.plan?.status === 'invalidated', 'actual audit failure');
        const result = failed.tasks[0].results[0]; assert.equal(result.auditFailed, true);
        assert.equal(result.observedMutation, kind === 'mutation_success'); assert.equal(failed.tasks[1].status, 'blocked');
        if (kind === 'mutation_intent') await assert.rejects(fs.stat(join(faultRoot, 'business')), { code: 'ENOENT' });
        else assert.equal(await fs.readFile(join(faultRoot, 'business/nested.txt'), 'utf8'), 'actual tester write');
        await assert.rejects(fs.stat(join(faultRoot, 'later.txt')), { code: 'ENOENT' });
      } finally { fs.open = originalOpen; }
    }
    scenarios.push('intent audit failure zero business mutation; commit audit failure honest observedMutation and stop');
    const observer = createWorkspaceService({ workspaceRoot: projectRoot });
    try {
      const observation = unwrap(await observer.observe({ force: true }));
      const large = [];
      for (const name of await fs.readdir(join(projectRoot, 'docs/scheduling'))) {
        if (name.endsWith('.md') && (await fs.stat(join(projectRoot, 'docs/scheduling', name))).size > 1048576) large.push('docs/scheduling/' + name);
      }
      assert.ok(large.length > 0);
      for (const path of large) { const source = observation.sources.find(item => item.relativePath === path); assert.ok(source, path); assert.equal(source.status, 'available', path); assert.ok(source.verifiedAt); }
      assert.ok(observation.audits.some(event => event.format === 'governance')); assert.ok(observation.tasks.length > 0);
      assert.ok(observation.observedAt); assert.ok(observation.sources.every(source => source.readAt));
    } finally { unwrap(observer.close()); }
    scenarios.push('actual over-1MiB current records verified in full; governance records separate from runtime mirror');
    return { scenarios, realSdkPrompts: prompts.length, localhostRequests: server.calls.length, workerRequests: workerCalls, paidRequests: 0 };
  } finally { if (pipeline) unwrap(await pipeline.close()); if (server) await server.close(); AgentSession.prototype.prompt = originalPrompt; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && !process.versions.electron) {
  test('real Electron public Workbench/Pi flows preserve discussion isolation and confirmed execution', { timeout: 110000 }, async () => {
    assert.equal(process.platform, 'win32');
    const location = await ownedDirectory('fixtures', 'public-flow-'); const userData = await ownedDirectory('user-data', 'public-flow-'); await guard(join(generated, 'tmp'), true);
    const proof = join(generated, 'fixtures', 'public-flow-proof.json');
    const harness = join(location, 'electron-flow.mjs');
    await fs.writeFile(harness, `import {app} from 'electron';\nimport {runPublicFlows} from ${JSON.stringify(import.meta.url)};\nimport {writeFile} from 'node:fs/promises';\napp.setPath('userData',${JSON.stringify(userData)});app.setPath('sessionData',${JSON.stringify(userData)});app.setAppLogsPath(${JSON.stringify(join(userData,'logs'))});\napp.whenReady().then(()=>runPublicFlows(${JSON.stringify(location)},${JSON.stringify(userData)})).then(async value=>{await writeFile(${JSON.stringify(proof)},JSON.stringify(value));app.exit(0)}).catch(error=>{console.error(error);app.exit(1)});\n`);
    try {
      const executable = join(projectRoot, 'apps/desktop/node_modules/electron/dist/electron.exe');
      const child = spawn(executable, [harness], { cwd: join(projectRoot, 'apps/desktop'), env: environment(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = ''; child.stdout.on('data', bytes => { output += bytes; }); child.stderr.on('data', bytes => { output += bytes; });
      const deadline = setTimeout(() => child.kill(), 105000);
      const code = await new Promise((done, reject) => { child.once('error', reject); child.once('exit', done); }); clearTimeout(deadline);
      assert.equal(code, 0, output); const result = JSON.parse(await fs.readFile(proof, 'utf8')); assert.equal(result.scenarios.length, 9); assert.ok(result.realSdkPrompts >= 12); assert.equal(result.paidRequests, 0);
    } finally { await removeOwned(location, join(generated, 'fixtures')); await removeOwned(userData, join(generated, 'user-data')); }
  });
}
