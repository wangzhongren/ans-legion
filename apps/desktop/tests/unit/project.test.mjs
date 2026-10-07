import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  writeFile,
  readdir,
  symlink,
  rename
} from 'node:fs/promises';
import {
  resolve,
  join
} from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createProjectProvider
} from '../../src/providers/public/project.mjs';
import {
  createProjectService
} from '../../src/services/public/project.mjs';
import {
  createWorkbenchAuthority,
  ContextReadConfirmation
} from 'legion-runtime/workbench-models';
const testRole = process.env.LEGION_DESKTOP_TEST_ROLE ?? 'DesktopEngineer';
assert.ok(['DesktopEngineer', 'ProjectManager', 'Reviewer', 'Tester'].includes(testRole));
const projectRoot = fileURLToPath(new URL('../../../../', import.meta.url));
let roleDirectory = testRole;
if (testRole !== 'DesktopEngineer') roleDirectory = `${testRole}/desktop`;
const base = resolve(projectRoot, `.ans/runtime/legion-desktop-workbench-v2/${roleDirectory}`);
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
async function fixture() {
  const fixture = await mkdtemp(join(base, 'fixtures', 'project-'));
  const root = join(fixture, 'customer');
  const data = join(fixture, 'user-data');
  await mkdir(root);
  return {
    fixture,
    root,
    data
  };
} test('real arbitrary folder accepted, catalog isolated; both ancestor overlap and junction rejected before any write', async () => {
  const {
    fixture: location,
    root,
    data
  } = await fixture(); const provider = createProjectProvider({
    userDataDir: data
  }); assert.equal((await provider.describeRoot(root)).ok, true); assert.deepEqual(await readdir(root), []); for (const [selected, userData] of [[root, root], [root, join(root, 'app-data')], [join(location, 'user-data', 'customer'), data]]) {
    await mkdir(selected, {
      recursive: true
    }); const unsafe = createProjectProvider({
      userDataDir: userData
    }); assert.equal((await unsafe.describeRoot(selected)).error.code, 'data_overlap');
  } const alias = join(location, 'alias'); await symlink(root, alias, 'junction'); assert.equal((await provider.describeRoot(alias)).error.code, 'unsafe_path'); assert.deepEqual(await readdir(root), []);
});
test('unavailable historical root does not block selecting a new valid customer project', async () => {
  const {
    root,
    data,
    fixture: location
  } = await fixture(); const service = createProjectService({
    userDataDir: data
  }); const old = await service.select(root); assert.equal(old.ok, true); await rename(root, join(location, 'moved')); const fresh = join(location, 'fresh'); await mkdir(fresh); const selected = await service.select(fresh); assert.equal(selected.ok, true); assert.notEqual(selected.value.id, old.value.id); assert.equal((await service.catalog()).value.projects.length, 2); await service.close();
});
test('Project Service serial catalog operations reuse stable identity and reject upper callbacks', async () => {
  const {
    root,
    data
  } = await fixture(); const service = createProjectService({
    userDataDir: data
  }); const first = await service.select(root); assert.equal(first.ok, true); assert.equal(first.value.manager, null); assert.equal((await service.select(root)).value.id, first.value.id); await service.setDefaultProfile('local-ai'); assert.equal((await service.catalog()).value.projects.length, 1); assert.equal((await service.catalog()).value.defaultProfileId, 'local-ai'); assert.deepEqual(await readdir(root), []); await service.close(); assert.equal((await service.catalog()).error.code, 'closed'); assert.throws(() => createProjectService({
    userDataDir: data,
    provider: {
    }
  }));
});
test('context read requires actual Kernel brand and enforces exact resources, SHA and link boundaries', async () => {
  const {
    root,
    data
  } = await fixture(); await writeFile(join(root, 'a.txt'), '真实文本'); const provider = createProjectProvider({
    userDataDir: data
  }); const identity = (await provider.describeRoot(root)).value.workspaceIdentity; const fields = {
    workspaceIdentity: identity,
    organizationVersion: 'customer-v1',
    profileVersion: 'v1',
    resources: ['a.txt']
  }; assert.equal((await provider.readContext({
    ...fields,
    authorization: {
    }
  })).ok, false); const {
    controller
  } = createWorkbenchAuthority({
    workspaceIdentity: identity,
    organizationVersion: 'customer-v1',
    profileVersion: 'v1',
    boundaries: []
  }); const authorization = controller.confirmContextRead(new ContextReadConfirmation({
    confirmationId: 'read-1',
    workspaceIdentity: identity,
    organizationVersion: 'customer-v1',
    profileVersion: 'v1',
    contextReadSet: fields.resources
  })); const result = await provider.readContext({
    ...fields,
    authorization
  }); assert.equal(result.ok, true); assert.equal(result.value.texts[0].text, '真实文本'); assert.equal(result.value.context.files[0].byteLength, 12); assert.match(result.value.context.files[0].sha256, /^[a-f0-9]{64}$/u); assert.equal((await provider.readContext({
    ...fields,
    authorization,
    resources: ['else.txt']
  })).ok, false); await writeFile(join(root, 'a.txt'), Buffer.alloc(262145)); assert.equal((await provider.readContext({
    ...fields,
    authorization
  })).error.code, 'context_budget'); controller.revoke('changed'); assert.equal((await provider.readContext({
    ...fields,
    authorization
  })).ok, false);
});
