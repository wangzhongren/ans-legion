import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  writeFile,
  readdir,
  readFile
} from 'node:fs/promises';
import {
  resolve,
  join
} from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createHistoryProvider
} from '../../src/providers/public/history.mjs';
import {
  createProjectProvider
} from '../../src/providers/public/project.mjs';
import {
  identityKey
} from '../../src/models/workbench.mjs';
import {
  createHistoryService
} from '../../src/services/public/history.mjs';
const testRole = process.env.LEGION_DESKTOP_TEST_ROLE ?? 'DesktopEngineer';
assert.ok(['DesktopEngineer', 'ProjectManager', 'Reviewer', 'Tester'].includes(testRole));
const projectRoot = fileURLToPath(new URL('../../../../', import.meta.url));
let roleDirectory = testRole;
if (testRole !== 'DesktopEngineer') roleDirectory = `${testRole}/desktop`;
const base = resolve(projectRoot, `.ans/runtime/legion-governed-workflow-v1/${roleDirectory}`);
await mkdir(join(base, 'fixtures'), {
  recursive: true
});
await mkdir(join(base, 'tmp'), {
  recursive: true
});
process.env.TEMP = join(base, 'tmp');
process.env.TMP = join(base, 'tmp');
delete process.env.NODE_OPTIONS;
delete process.env.NODE_COMPILE_CACHE;
process.env.NODE_DISABLE_COMPILE_CACHE = '1';
test('typed text roundtrip is per project, corruption explicit, no customer file is written', async () => {
  const fixture = await mkdtemp(join(base, 'fixtures', 'history-')); const data = join(fixture, 'data'); const root = join(fixture, 'customer'); const other = join(fixture, 'other'); await mkdir(root); await mkdir(other); const projects = createProjectProvider({
    userDataDir: data
  }); const identity = (await projects.describeRoot(root)).value.workspaceIdentity; const otherIdentity = (await projects.describeRoot(other)).value.workspaceIdentity; const id = identityKey(identity); const provider = createHistoryProvider({
    userDataDir: data
  }); const document = {
    schemaVersion: 1,
    projectId: id,
    roleId: 'ProjectManager',
    history: {
      messages: [{
        role: 'user',
        text: '第一行\n第二行'
      },
      {
        role: 'assistant',
        text: '方案'
      }]
    }
  }; assert.equal((await provider.write(document, identity)).ok, true); assert.deepEqual((await provider.read(id, identity)).value.history.messages, document.history.messages); assert.deepEqual((await provider.read(identityKey(otherIdentity), otherIdentity)).value.history.messages, []); assert.deepEqual(await readdir(root), []); assert.equal((await provider.write({
    ...document,
    permit: {
    }
  }, identity)).ok, false); assert.equal((await provider.write({
    ...document,
    history: {
      messages: [{
        role: 'tool',
        text: 'secret'
      }]
    }
  }, identity)).ok, false); const saved = await readFile(join(data, 'workbench-history', `${id}.json`), 'utf8'); assert.equal(saved.includes('permit'), false); await writeFile(join(data, 'workbench-history', `${id}.json`), '{broken'); assert.equal((await provider.read(id, identity)).error.code, 'history_corrupt');
});
test('History Service validates envelope and closed operations, persists only text', async () => {
  const fixture = await mkdtemp(join(base, 'fixtures', 'history-service-')); const root = join(fixture, 'customer'); const data = join(fixture, 'data'); await mkdir(root); const identity = (await createProjectProvider({
    userDataDir: data
  }).describeRoot(root)).value.workspaceIdentity; const projectId = identityKey(identity); const service = createHistoryService({
    userDataDir: data
  }); const input = {
    projectId,
    workspaceIdentity: identity,
    history: {
      messages: [{
        role: 'user',
        text: '要求'
      }]
    }
  }; assert.equal((await service.save(input)).ok, true); assert.deepEqual((await service.load({
    projectId,
    workspaceIdentity: identity
  })).value.messages, input.history.messages); assert.equal((await service.save({
    ...input,
    apiKey: 'private'
  })).ok, false); await service.close(); assert.equal((await service.load({
    projectId,
    workspaceIdentity: identity
  })).error.code, 'closed');
});
test('history rejects real path overlap before creating its data directory', async () => {
  const fixture = await mkdtemp(join(base, 'fixtures', 'history-overlap-')); const root = join(fixture, 'customer'); await mkdir(root); const identity = (await createProjectProvider({
    userDataDir: join(fixture, 'data')
  }).describeRoot(root)).value.workspaceIdentity; const unsafe = createHistoryProvider({
    userDataDir: join(root, 'data')
  }); const result = await unsafe.write({
    schemaVersion: 1,
    projectId: identityKey(identity),
    roleId: 'ProjectManager',
    history: {
      messages: []
    }
  }, identity); assert.equal(result.error.code, 'data_overlap'); assert.deepEqual(await readdir(root), []);
});

test('two history Services cannot overwrite a newer loaded digest; reloading preserves the new conversation', async () => {
  const directory = await mkdtemp(join(base, 'fixtures', 'history-cas-')); const root = join(directory, 'customer'); await mkdir(root); const data = join(directory, 'data');
  const workspaceIdentity = (await createProjectProvider({ userDataDir: data }).describeRoot(root)).value.workspaceIdentity;
  const projectId = identityKey(workspaceIdentity); const first = createHistoryService({ userDataDir: data }); const second = createHistoryService({ userDataDir: data });
  try {
    const input = { projectId, workspaceIdentity }; assert.equal((await first.load(input)).ok, true); assert.equal((await second.load(input)).ok, true);
    const history = { messages: [{ role: 'user', text: '第一个窗口已保存' }] };
    assert.equal((await first.save({ ...input, history })).ok, true);
    assert.equal((await second.save({ ...input, history: { messages: [{ role: 'user', text: '旧窗口覆盖' }] } })).error.code, 'stale_history');
    assert.deepEqual((await second.load(input)).value.messages, history.messages);
    assert.equal((await second.save({ ...input, history: { messages: [...history.messages, { role: 'assistant', text: '新版本继续' }] } })).ok, true);
  } finally { await first.close(); await second.close(); }
});
