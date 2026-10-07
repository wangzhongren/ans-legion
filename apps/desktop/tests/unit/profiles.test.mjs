import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PROTOCOLS, LIMITS, profileInput, profileDTO, settingsDocument, emptySettings, operationInput, workspaceDTO, desktopDTO, probeDTO, safeError } from '../../src/models/desktop.mjs';
import { createSettingsProvider } from '../../src/providers/public/settings.mjs';
import { SettingsProviderImpl } from '../../src/providers/impl/settings.mjs';
import { createProbeProvider } from '../../src/providers/public/probe.mjs';
import { createProfilesService } from '../../src/services/public/profiles.mjs';
import { ProfilesServiceImpl } from '../../src/services/impl/profiles.mjs';

const PROJECT = 'a'.repeat(64);
const input = { id: 'p1', name: '测试连接', protocol: 'openai-completions', provider: '显示名', modelId: 'local-test', baseUrl: 'http://127.0.0.1:1234/v1', keyAction: 'replace', apiKey: 'local-test-key' };
const testRole = process.env.LEGION_DESKTOP_TEST_ROLE ?? 'DesktopEngineer';
assert.ok(['DesktopEngineer', 'ProjectManager', 'Reviewer', 'Tester'].includes(testRole));
const projectRoot = fileURLToPath(new URL('../../../../', import.meta.url));
let roleDirectory = testRole;
if (testRole !== 'DesktopEngineer') roleDirectory = `${testRole}/desktop`;
const base = join(projectRoot, `.ans/runtime/legion-desktop-workbench-v2/${roleDirectory}`);
const fixtureRoot = join(base, 'fixtures');
process.env.NODE_DISABLE_COMPILE_CACHE = '1';
delete process.env.NODE_OPTIONS;
delete process.env.NODE_COMPILE_CACHE;
const tmpRoot = join(base, 'tmp');
await mkdir(tmpRoot, { recursive: true });
process.env.TEMP = tmpRoot;
process.env.TMP = tmpRoot;
await mkdir(fixtureRoot, { recursive: true });

async function fixture() { return mkdtemp(join(fixtureRoot, 'profiles-')); }
test('Service private connection: stored version is stable until edit, decrypt failure safe, public DTO has no key', async () => {
  const directory = await fixture(); const crypto = encryptedDouble(); const settings = new SettingsProviderImpl({ userDataDir: directory }, async () => crypto); const probe = createProbeProvider({ timeoutMs: 1000 }); const service = new ProfilesServiceImpl({ userDataDir: directory }, { settings, probe });
  try { const saved = await service.save({ ...input, id: undefined }); assert.equal(saved.ok, true); const id = saved.value.id; const first = await service.resolveConnection(id); assert.equal(first.ok, true); assert.equal(first.value.credentials.apiKey, input.apiKey); assert.equal((await service.resolveConnection(id)).value.connection.profileVersion, first.value.connection.profileVersion); assert.equal(JSON.stringify((await service.list()).value).includes(input.apiKey), false); await service.save({ ...input, id, name: '新连接名', keyAction: 'keep', apiKey: '' }); assert.notEqual((await service.resolveConnection(id)).value.connection.profileVersion, first.value.connection.profileVersion); await service.save({ ...input, id, keyAction: 'clear', apiKey: '' }); assert.equal((await service.resolveConnection(id)).error.code, 'key_required'); } finally { service.close(); }
});
function encryptedDouble() {
  const key = randomBytes(32);
  return {
    isEncryptionAvailable: () => true,
    encryptString(text) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), data]);
    },
    decryptString(buffer) {
      const cipher = createDecipheriv('aes-256-gcm', key, buffer.subarray(0, 12));
      cipher.setAuthTag(buffer.subarray(12, 28));
      return Buffer.concat([cipher.update(buffer.subarray(28)), cipher.final()]).toString('utf8');
    }
  };
}

function stored(ciphertext = null) {
  const { keyAction, apiKey, ...fields } = input;
  return { ...fields, keyCiphertext: ciphertext };
}

function sse(response, data, event = '') {
  if (event) response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(data)}\n\n`);
}

function reply(response, protocol) {
  response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  if (protocol === 'openai-completions') {
    sse(response, { id: 'chat1', object: 'chat.completion.chunk', model: 'local-test', choices: [{ index: 0, delta: { role: 'assistant', content: 'OK' }, finish_reason: null }] });
    sse(response, { id: 'chat1', object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] });
    response.end('data: [DONE]\n\n');
  } else if (protocol === 'openai-responses') {
    const message = { id: 'msg1', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'OK', annotations: [] }] };
    for (const event of [{ type: 'response.created', response: { id: 'resp1', status: 'in_progress', output: [] } }, { type: 'response.output_item.added', output_index: 0, item: { ...message, status: 'in_progress', content: [] } }, { type: 'response.content_part.added', output_index: 0, content_index: 0, item_id: 'msg1', part: { type: 'output_text', text: '', annotations: [] } }, { type: 'response.output_text.delta', output_index: 0, content_index: 0, item_id: 'msg1', delta: 'OK' }, { type: 'response.output_item.done', output_index: 0, item: message }, { type: 'response.completed', response: { id: 'resp1', status: 'completed', output: [message], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 0 } } } }]) sse(response, event, event.type);
    response.end();
  } else {
    for (const event of [{ type: 'message_start', message: { id: 'msg1', type: 'message', role: 'assistant', model: 'local-test', content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 0 } } }, { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'OK' } }, { type: 'content_block_stop', index: 0 }, { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } }, { type: 'message_stop' }]) sse(response, event, event.type);
    response.end();
  }
}

async function localServer(handler) {
  const server = createServer(handler);
  const sockets = new Set();
  server.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return { url: `http://127.0.0.1:${server.address().port}`, async close() {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve, reject) => server.close((error) => { if (error) reject(error); else resolve(); }));
  } };
}

test('Model: finite profile inputs, three credential actions, safe URL policy', () => {
  for (const protocol of PROTOCOLS) assert.equal(profileInput({ ...input, protocol }).protocol, protocol);
  assert.equal(profileInput({ ...input, id: undefined }).id, null);
  for (const keyAction of ['keep', 'clear']) assert.equal(profileInput({ ...input, keyAction, apiKey: '' }).apiKey, '');
  for (const baseUrl of ['http://example.com/v1', 'file:///tmp/test', 'https://user:secret@example.com', 'https://example.com?api_key=secret', 'http://127.0.0.2/v1']) assert.throws(() => profileInput({ ...input, baseUrl }));
  assert.equal(profileInput({ ...input, baseUrl: 'https://example.com/v1/' }).baseUrl, 'https://example.com/v1');
  assert.equal(profileInput({ ...input, baseUrl: 'http://[::1]:1234/v1' }).baseUrl, 'http://[::1]:1234/v1');
  for (const change of [{ protocol: 'arbitrary-module' }, { keyAction: 'keep' }, { keyAction: 'clear' }, { apiKey: '' }, { name: '' }, { name: 'a'.repeat(101) }, { extra: 'value' }, { provider: () => {} }]) assert.throws(() => profileInput({ ...input, ...change }));
});

test('Model: stored/public variants preserve invariants and never return keys', () => {
  const { keyAction, apiKey, ...fields } = input;
  const stored = { ...fields, keyCiphertext: Buffer.from('encrypted').toString('base64') };
  const state = settingsDocument({ schemaVersion: 1, profiles: [stored], assignments: [{ projectId: PROJECT, roleId: 'DesktopEngineer', profileId: 'p1' }] });
  assert.deepEqual(settingsDocument(JSON.parse(JSON.stringify(state))), state);
  assert.equal(profileDTO(stored).hasSavedKey, true);
  assert.equal(JSON.stringify(profileDTO(stored)).includes('encrypted'), false);
  assert.equal(Object.hasOwn(profileDTO(stored), 'apiKey'), false);
  assert.equal(Object.isFrozen(state.profiles[0]), true);
  assert.throws(() => { state.profiles[0].name = 'changed'; });
  assert.deepEqual(emptySettings(), { schemaVersion: 1, profiles: [], assignments: [] });
  for (const value of [{ ...state, schemaVersion: 2 }, { ...state, profiles: [stored, stored] }, { ...state, assignments: [{ projectId: PROJECT, roleId: 'r', profileId: 'missing' }] }, { ...state, profiles: [{ ...stored, apiKey: 'plaintext' }] }, { ...state, profiles: [{ ...stored, keyCiphertext: '!bad' }] }]) assert.throws(() => settingsDocument(value));
});

test('Model: full workspace and IPC projections are bounded and immutable', () => {
  const workspace = workspaceDTO({ status: 'available', project: { id: PROJECT, name: '项目', root: 'C:/hidden' }, organization: { id: 'legion', version: 'v003', status: 'ACCEPTED' }, roles: [{ id: 'DesktopEngineer', name: '桌面', reportsTo: 'Supervisor', description: '职责', boundary: ['apps/desktop/src/'], apiKey: 'hidden' }], tasks: [{ taskId: 'task1', nodeId: 'profiles', roleId: 'DesktopEngineer', status: 'running', reason: 'token=secret-value', updatedAt: '2026-10-07T07:00:00Z', token: 'hidden' }], audits: [{ id: 'event1', format: 'governance', organizationVersion: 'v003', status: 'recorded', eventType: 'accepted', prompt: 'hidden' }], sources: [{ kind: 'organization', relativePath: '.ans/org/current.json', status: 'available', modifiedAt: '2026-10-07T07:00:00Z', readAt: '2026-10-07T07:00:01Z' }], observedAt: '2026-10-07T07:00:01Z' });
  const state = desktopDTO({ ...emptySettings(), workspace, probe: { status: 'idle' } });
  const serialized = JSON.stringify(state);
  for (const forbidden of ['hidden', 'secret-value', 'liveness', 'isAlive', 'root']) assert.equal(serialized.includes(forbidden), false);
  assert.equal(state.workspace.tasks[0].status, 'running');
  assert.equal(state.workspace.audits[0].status, 'recorded');
  assert.equal(Object.isFrozen(state.workspace.roles[0].boundary), true);
  assert.throws(() => workspaceDTO({ status: 'available', roles: Array(LIMITS.roles + 1).fill({}) }));
  assert.throws(() => workspaceDTO({ status: 'available', observedAt: 'yesterday' }));
  const actualGovernanceTimestamp = '2026-10-07T09:44:22.2685583+08:00';
  assert.equal(workspaceDTO({ status: 'available', observedAt: actualGovernanceTimestamp }).observedAt, actualGovernanceTimestamp);
  assert.throws(() => workspaceDTO({ status: 'available', observedAt: '2026-10-07T09:44:22.26855831+08:00' }));
  assert.throws(() => workspaceDTO({ status: 'available', sources: [{ kind: 'audit', relativePath: '../secret', status: 'available' }] }));
  assert.throws(() => probeDTO({ status: 'success', latencyMs: -1 }));
  assert.equal(operationInput('getState', { path: 'C:/arbitrary' }).ok, false);
  assert.equal(operationInput('chooseProject', { path: 'C:/arbitrary' }).ok, false);
  assert.equal(operationInput('unknown', {}).error.code, 'unknown_operation');
  assert.equal(operationInput('saveProfile', input).ok, true);
  assert.equal(operationInput('assignProfile', { roleId: 'r', profileId: null }).ok, true);
  assert.deepEqual(safeError('raw SDK secret'), { code: 'internal_error', message: '操作失败，请重试。', field: '' });
});

test('Model: no effect imports or ternary operators', async () => {
  const source = await readFile(fileURLToPath(new URL('../../src/models/desktop.mjs', import.meta.url)), 'utf8');
  assert.equal(/^import /mu.test(source), false);
  const hasConditional = (code) => /(?<!\?)\?(?![?.])\s*[^?.:]+\s*:/u.test(code.replace(/\/(?:\\.|[^/\\\r\n])+\/[a-z]*/gu, ''));
  assert.equal(hasConditional('const result = flag ? yes : no;'), true);
  assert.equal(hasConditional('const pattern = /api[_-]?key[:=]/giu;'), false);
  assert.equal(hasConditional('const result = value ?? fallback; const object = { value: result };'), false);
  assert.equal(hasConditional(source), false);
});

test('Provider Settings: public persistence and unavailable encryption are safe', async () => {
  const directory = await fixture();
  const provider = createSettingsProvider({ userDataDir: directory });
  assert.deepEqual((await provider.read()).value, emptySettings());
  assert.equal((await provider.write({ schemaVersion: 1, profiles: [stored()], assignments: [] })).ok, true);
  assert.equal((await createSettingsProvider({ userDataDir: directory }).read()).value.profiles[0].id, 'p1');
  assert.equal((await provider.encryptKey(input.apiKey)).error.code, 'encryption_unavailable');
  assert.equal((await provider.decryptKey(null)).error.code, 'key_required');
  assert.equal((await provider.decryptKey('bad!')).error.code, 'decryption_failed');
  assert.throws(() => createSettingsProvider({ userDataDir: directory, encryption: () => {} }));
});

test('Provider Settings: encrypted roundtrip, corrupt/decrypt/encrypt failures are distinct (stand-in, not DPAPI)', async () => {
  const directory = await fixture();
  const crypto = encryptedDouble();
  const provider = new SettingsProviderImpl({ userDataDir: directory }, async () => crypto);
  const encrypted = await provider.encryptKey(input.apiKey);
  assert.equal(encrypted.ok, true);
  assert.equal((await provider.decryptKey(encrypted.value)).value, input.apiKey);
  assert.equal((await provider.write({ schemaVersion: 1, profiles: [stored(encrypted.value)], assignments: [] })).ok, true);
  const disk = await readFile(join(directory, 'desktop-settings.json'), 'utf8');
  assert.equal(disk.includes(input.apiKey), false);
  const reopened = new SettingsProviderImpl({ userDataDir: directory }, async () => crypto);
  assert.equal((await reopened.decryptKey((await reopened.read()).value.profiles[0].keyCiphertext)).value, input.apiKey);
  const wrongMachine = new SettingsProviderImpl({ userDataDir: directory }, async () => encryptedDouble());
  assert.equal((await wrongMachine.decryptKey(encrypted.value)).error.code, 'decryption_failed');
  const unavailable = new SettingsProviderImpl({ userDataDir: directory }, async () => ({ isEncryptionAvailable: () => false }));
  assert.equal((await unavailable.decryptKey(encrypted.value)).error.code, 'encryption_unavailable');
  const broken = new SettingsProviderImpl({ userDataDir: directory }, async () => ({ isEncryptionAvailable: () => true, encryptString() { throw new Error(`SDK ${input.apiKey}`); }, decryptString() { throw new Error(input.apiKey); } }));
  assert.equal((await broken.encryptKey(input.apiKey)).error.code, 'encryption_failed');
  assert.equal((await broken.decryptKey(encrypted.value)).error.code, 'decryption_failed');
  await writeFile(join(directory, 'desktop-settings.json'), '{broken');
  assert.equal((await provider.read()).error.code, 'settings_corrupt');
  await writeFile(join(directory, 'desktop-settings.json'), 'a'.repeat(LIMITS.fileBytes + 1));
  assert.equal((await provider.read()).error.code, 'settings_corrupt');
  const obstructed = join(await fixture(), 'file');
  await writeFile(obstructed, 'not a directory');
  assert.equal((await createSettingsProvider({ userDataDir: obstructed }).read()).error.code, 'settings_unavailable');
  assert.equal((await createSettingsProvider({ userDataDir: obstructed }).write(emptySettings())).error.code, 'settings_unavailable');
});

test('Provider Probe: actual fixed public Pi APIs send three localhost requests with bounded payloads', async () => {
  const requests = [];
  const server = await localServer((request, response) => {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      const path = new URL(request.url, 'http://localhost').pathname;
      requests.push({ path, rawPath: request.url, body: JSON.parse(body), headers: request.headers });
      let protocol = 'openai-completions';
      if (path.endsWith('/responses')) protocol = 'openai-responses';
      if (path.endsWith('/messages')) protocol = 'anthropic-messages';
      reply(response, protocol);
    });
  });
  const provider = createProbeProvider({ timeoutMs: 3000 });
  try {
    for (const protocol of PROTOCOLS) {
      let baseUrl = `${server.url}/v1`;
      if (protocol === 'anthropic-messages') baseUrl = server.url;
      const result = await provider.run({ profile: profileDTO({ ...input, protocol, baseUrl, provider: '../../arbitrary-module', hasSavedKey: true }), apiKey: input.apiKey });
      assert.equal(result.ok, true);
      assert.equal(result.value.status, 'success', `${protocol} ${JSON.stringify(result)}`);
      assert.equal(result.value.error, null);
      assert.equal(JSON.stringify(result).includes(input.apiKey), false);
      assert.equal(Object.hasOwn(result.value, 'content'), false);
    }
    assert.deepEqual(requests.map((request) => request.path), ['/v1/chat/completions', '/v1/responses', '/v1/messages']);
    assert.deepEqual(requests.map((request) => request.rawPath), ['/v1/chat/completions', '/v1/responses', '/v1/messages?beta=true']);
    for (const request of requests) {
      assert.equal(request.body.model, input.modelId);
      assert.equal(request.body.stream, true);
      assert.equal(request.body.tools === undefined || request.body.tools.length === 0, true);
      assert.equal(request.body.max_tokens ?? request.body.max_completion_tokens ?? request.body.max_output_tokens, 16);
      assert.equal(JSON.stringify(request.body).includes('Reply OK.'), true);
    }
    assert.equal(requests[0].headers.authorization, `Bearer ${input.apiKey}`);
    assert.equal(requests[2].headers['x-api-key'], input.apiKey);
  } finally { provider.close(); await server.close(); }
});

test('Provider Probe: raw authentication/SDK errors do not escape and retries are disabled', async () => {
  for (const statusCode of [401, 500]) {
    let requests = 0;
    let type = 'server_error';
    let expectedCode = 'probe_failed';
    if (statusCode === 401) { type = 'authentication_error'; expectedCode = 'probe_authentication'; }
    const server = await localServer((request, response) => { requests += 1; response.writeHead(statusCode, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: { message: `${statusCode} raw ${input.apiKey}`, type } })); });
    const provider = createProbeProvider({ timeoutMs: 1000 });
    try {
      const result = await provider.run({ profile: profileDTO({ ...input, baseUrl: `${server.url}/v1`, hasSavedKey: true }), apiKey: input.apiKey });
      assert.equal(result.value.status, 'failed');
      assert.equal(result.value.error.code, expectedCode);
      assert.equal(JSON.stringify(result).includes(input.apiKey), false);
      assert.equal(JSON.stringify(result).includes('raw'), false);
      assert.equal(requests, 1);
    } finally { provider.close(); await server.close(); }
  }
});

test('Service public: metadata CRUD, missing/key-required errors, scoped mappings and deletion cleanup', async () => {
  const directory = await fixture();
  const service = createProfilesService({ userDataDir: directory });
  try {
    assert.deepEqual((await service.list()).value, { profiles: [], assignments: [] });
    const saved = await service.save({ ...input, id: undefined, keyAction: 'keep', apiKey: '' });
    assert.equal(saved.ok, true);
    assert.equal(saved.value.hasSavedKey, false);
    const id = saved.value.id;
    assert.equal((await service.testConnection(id)).error.code, 'key_required');
    assert.equal((await service.save({ ...input, id: 'missing', keyAction: 'keep', apiKey: '' })).error.code, 'not_found');
    assert.equal((await service.save({ ...input, id: undefined, extra: true })).error.code, 'invalid_input');
    assert.equal((await service.save({ ...input, id: undefined })).error.code, 'encryption_unavailable');
    assert.equal((await service.list()).value.profiles.length, 1);
    assert.equal((await service.assign({ projectId: PROJECT, roleId: 'DesktopEngineer', profileId: id })).ok, true);
    assert.equal((await service.assign({ projectId: 'b'.repeat(64), roleId: 'DesktopEngineer', profileId: id })).value.assignments.length, 2);
    assert.equal((await service.assign({ projectId: PROJECT, roleId: 'DesktopEngineer', profileId: 'missing' })).error.code, 'not_found');
    assert.equal((await service.assign({ projectId: PROJECT, roleId: 'DesktopEngineer', profileId: null })).value.assignments.length, 1);
    const reopened = createProfilesService({ userDataDir: directory });
    assert.equal((await reopened.list()).value.assignments[0].projectId, 'b'.repeat(64));
    assert.equal(reopened.close().ok, true);
    assert.equal((await service.delete(id)).value.assignments.length, 0);
    assert.equal((await service.list()).value.profiles.length, 0);
    assert.equal((await service.delete(id)).error.code, 'not_found');
    assert.equal((await service.testConnection('missing')).error.code, 'not_found');
    assert.equal(service.close().ok, true);
    assert.equal(service.close().ok, true);
    assert.equal((await service.list()).error.code, 'closed');
    assert.equal((await service.save({ ...input, id: undefined, keyAction: 'clear', apiKey: '' })).error.code, 'closed');
  } finally { service.close(); }
  assert.throws(() => createProfilesService({ userDataDir: directory, settings: {} }));
});

test('Service: keep/replace/clear never roundtrip credentials, serialized mutations preserve both additions', async () => {
  const directory = await fixture();
  const crypto = encryptedDouble();
  const settings = new SettingsProviderImpl({ userDataDir: directory }, async () => crypto);
  const probe = createProbeProvider({ timeoutMs: 1000 });
  const service = new ProfilesServiceImpl({ userDataDir: directory }, { settings, probe });
  try {
    const result = await service.save({ ...input, id: undefined });
    const id = result.value.id;
    assert.equal(result.value.hasSavedKey, true);
    const before = (await settings.read()).value.profiles[0].keyCiphertext;
    const kept = await service.save({ ...input, id, name: '改名', keyAction: 'keep', apiKey: '' });
    assert.equal(kept.value.name, '改名');
    assert.equal((await settings.read()).value.profiles[0].keyCiphertext, before);
    const replaced = await service.save({ ...input, id, apiKey: 'replacement-test-key' });
    assert.equal(replaced.value.hasSavedKey, true);
    const encrypted = (await settings.read()).value.profiles[0].keyCiphertext;
    assert.notEqual(encrypted, before);
    assert.equal((await settings.decryptKey(encrypted)).value, 'replacement-test-key');
    assert.equal((await service.save({ ...input, id, keyAction: 'clear', apiKey: '' })).value.hasSavedKey, false);
    assert.equal((await settings.read()).value.profiles[0].keyCiphertext, null);
    const parallel = await Promise.all([service.save({ ...input, id: undefined }), service.save({ ...input, id: undefined, name: '另一个' })]);
    assert.equal(parallel.every((value) => value.ok), true);
    assert.equal(new Set((await service.list()).value.profiles.map((profile) => profile.id)).size, 3);
    for (const publicValue of [result, kept, replaced, await service.list()]) {
      assert.equal(JSON.stringify(publicValue).includes(input.apiKey), false);
      assert.equal(JSON.stringify(publicValue).includes('replacement-test-key'), false);
      assert.equal(JSON.stringify(publicValue).includes('keyCiphertext'), false);
    }
    await writeFile(join(directory, 'desktop-settings.json'), '{broken');
    assert.equal((await service.list()).error.code, 'settings_corrupt');
    assert.equal((await service.save({ ...input, id: undefined })).error.code, 'settings_corrupt');
  } finally { service.close(); }
});

test('Service: contract-compatible Provider failures cannot disclose keys or launch a probe', async () => {
  const document = settingsDocument({ schemaVersion: 1, profiles: [stored(Buffer.from('ciphertext').toString('base64'))], assignments: [] });
  let errorCode = 'decryption_failed';
  const settings = { read: async () => ({ ok: true, value: document }), decryptKey: async () => ({ ok: false, error: { code: errorCode, message: `raw ${input.apiKey}` } }), write: async () => ({ ok: false, error: { code: 'settings_unavailable', message: input.apiKey } }), encryptKey: async () => ({ ok: false, error: { code: 'encryption_failed', message: input.apiKey } }), newId: () => 'new1' };
  const probe = { run() { throw new Error('Probe must not run without a decrypted credential'); }, state: () => ({ status: 'idle' }), cancel: () => ({ ok: false, error: { code: 'not_found', message: input.apiKey } }), close: () => ({ ok: true, value: null }) };
  const service = new ProfilesServiceImpl({ userDataDir: await fixture() }, { settings, probe });
  try {
    const decryption = await service.testConnection('p1');
    assert.equal(decryption.error.code, 'decryption_failed');
    errorCode = 'encryption_unavailable';
    assert.equal((await service.testConnection('p1')).error.code, 'encryption_unavailable');
    assert.equal((await service.save({ ...input, id: undefined })).error.code, 'encryption_failed');
    assert.equal((await service.save({ ...input, keyAction: 'keep', apiKey: '' })).error.code, 'settings_unavailable');
    assert.equal(service.cancelProbe('test1').error.code, 'not_found');
    assert.equal(JSON.stringify(decryption).includes(input.apiKey), false);
    assert.equal(JSON.stringify(decryption).includes('raw'), false);
    assert.equal(service.getProbeState().value.status, 'idle');
  } finally { service.close(); }
});

test('Service integration: saved encrypted key reaches real Pi localhost request; probe result is sanitized', async () => {
  let authorization = null;
  const server = await localServer((request, response) => { authorization = request.headers.authorization; reply(response, 'openai-completions'); });
  const directory = await fixture();
  const settings = new SettingsProviderImpl({ userDataDir: directory }, async () => encryptedDouble());
  const crypto = encryptedDouble();
  const stableSettings = new SettingsProviderImpl({ userDataDir: directory }, async () => crypto);
  const probe = createProbeProvider({ timeoutMs: 1000 });
  const service = new ProfilesServiceImpl({ userDataDir: directory }, { settings: stableSettings, probe });
  try {
    const saved = await service.save({ ...input, id: undefined, baseUrl: `${server.url}/v1` });
    const result = await service.testConnection(saved.value.id);
    assert.equal(result.ok, true);
    assert.equal(result.value.status, 'success');
    assert.equal(authorization, `Bearer ${input.apiKey}`);
    assert.equal(service.getProbeState().value.id, result.value.id);
    assert.equal(JSON.stringify(result).includes(input.apiKey), false);
    assert.equal(Object.hasOwn(result.value, 'content'), false);
    // A new stand-in machine key fails instead of sending any request.
    const wrongMachineService = new ProfilesServiceImpl({ userDataDir: directory }, { settings, probe });
    assert.equal((await wrongMachineService.testConnection(saved.value.id)).error.code, 'decryption_failed');
    wrongMachineService.close();
  } finally { service.close(); await server.close(); }
});

test('Architecture: finite public factories, Service adjacent imports, no Model effects or protocol module routing', async () => {
  const serviceSource = await readFile(fileURLToPath(new URL('../../src/services/impl/profiles.mjs', import.meta.url)), 'utf8');
  assert.equal(/from ['"]node:/u.test(serviceSource), false);
  assert.equal(/providers\/(?:impl|abstract)/u.test(serviceSource), false);
  assert.equal(/services\/(?:impl|public)\//u.test(serviceSource), false);
  assert.equal(/import\(/u.test(serviceSource), false);
  const probeSource = await readFile(fileURLToPath(new URL('../../src/providers/impl/probe.mjs', import.meta.url)), 'utf8');
  assert.equal(/import\(/u.test(probeSource), false);
  assert.equal(/profile\.provider/u.test(probeSource), false);
  assert.equal(/completeSimple/u.test(probeSource), false);
  for (const path of ['providers/public/settings.mjs', 'providers/public/probe.mjs', 'services/public/profiles.mjs']) {
    const source = await readFile(fileURLToPath(new URL(`../../src/${path}`, import.meta.url)), 'utf8');
    assert.equal(/export\s+\*/u.test(source), false);
    assert.equal(/export\s+\{|export\s+class/u.test(source), false);
  }
});

test('Provider Probe: incomplete protocol, total timeout, cancel/busy and idempotent close', async () => {
  const incomplete = await localServer((request, response) => { response.writeHead(200, { 'content-type': 'text/event-stream' }); response.end('data: [DONE]\n\n'); });
  const first = createProbeProvider({ timeoutMs: 1000 });
  try {
    const result = await first.run({ profile: profileDTO({ ...input, baseUrl: `${incomplete.url}/v1`, hasSavedKey: true }), apiKey: input.apiKey });
    assert.equal(result.value.status, 'failed');
    assert.equal(result.value.error.code, 'probe_failed');
  } finally { first.close(); await incomplete.close(); }
  const hanging = await localServer((request, response) => { response.writeHead(200, { 'content-type': 'text/event-stream' }); response.write(': waiting\n\n'); });
  const provider = createProbeProvider({ timeoutMs: 120 });
  const request = { profile: profileDTO({ ...input, baseUrl: `${hanging.url}/v1`, hasSavedKey: true }), apiKey: input.apiKey };
  try {
    const start = Date.now();
    const timeout = await provider.run(request);
    assert.equal(timeout.value.error.code, 'probe_timeout');
    assert.ok(Date.now() - start < 800);
    const running = provider.run(request);
    assert.equal(provider.state().status, 'running');
    assert.equal((await provider.run(request)).error.code, 'probe_busy');
    assert.equal(provider.cancel('unrelated').error.code, 'not_found');
    assert.equal(provider.cancel(provider.state().id).ok, true);
    assert.equal((await running).value.error.code, 'probe_cancelled');
    assert.equal(provider.state().status, 'cancelled');
    const closing = provider.run(request);
    assert.equal(provider.close().ok, true);
    assert.equal(provider.close().ok, true);
    assert.equal((await closing).value.status, 'cancelled');
    assert.equal((await provider.run(request)).error.code, 'closed');
  } finally { provider.close(); await hanging.close(); }
});
