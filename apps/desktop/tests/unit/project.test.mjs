import { createHash } from 'node:crypto';
import { digestValue } from 'legion-runtime/workbench-models';
import { dirname as leaseParent } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  writeFile,
  readFile,
  readdir,
  symlink,
  rename, lstat, unlink
} from 'node:fs/promises';
import {
  resolve,
  join
} from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createProjectProvider as realCreateProjectProvider
} from '../../src/providers/public/project.mjs';
import { ProjectProviderImpl } from '../../src/providers/impl/project.mjs';
import { createProjectService as realCreateProjectService } from '../../src/services/public/project.mjs';
import { ProjectServiceImpl } from '../../src/services/impl/project.mjs';
import {
  createWorkbenchAuthority,
  ContextReadConfirmation,
  ProjectFileOwners
} from 'legion-runtime/workbench-models';
const testRole = process.env.LEGION_DESKTOP_TEST_ROLE ?? 'DesktopEngineer';
assert.ok(['DesktopEngineer', 'ProjectManager', 'Reviewer', 'Tester'].includes(testRole));
const projectRoot = fileURLToPath(new URL('../../../../', import.meta.url));
let roleDirectory = testRole;
if (testRole !== 'DesktopEngineer') roleDirectory = `${testRole}/desktop`;
const base = resolve(projectRoot, `.ans/runtime/legion-cli-role-owned-v2/${roleDirectory}`);
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
    profileVersion: 'v1', fileOwners:new ProjectFileOwners({projectId:'context-read',version:'owners-v0',owners:[]}),
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

test('legacy project catalog migrates an empty owner map and later owners persist only in userData', async () => {
  const { root, data } = await fixture();
  const service = createProjectService({ userDataDir: data });
  try {
    const first = (await service.select(root)).value;
    const path = join(data, 'workbench-projects.json');
    const catalog = JSON.parse(await readFile(path, 'utf8'));
    delete catalog.projects[0].fileOwners;
    catalog.projects[0].context.verifiedAt = '2026-10-08T00:00:00.000Z';
    await writeFile(path, JSON.stringify(catalog));
    const migrated = (await service.select(root)).value;
    assert.equal(migrated.fileOwners.version, 'owners-v0');
    assert.equal(migrated.context.verifiedAt, '2026-10-08T00:00:00.000Z');
    const next = new ProjectFileOwners({ projectId: first.id, version: 'owners-v1',
      owners: [{ resource: 'src/a.txt', roleId: 'Builder' }] });
    assert.equal((await service.saveProject({ ...migrated, fileOwners: next },
      { expectedFileOwnersDigest: migrated.fileOwners.digest })).ok, true);
    assert.equal((await service.catalog()).value.projects[0].fileOwners.ownerOf('src/a.txt'), 'Builder');
    assert.equal((await service.saveProject(migrated)).error.code, 'stale_file_owners');
    assert.deepEqual(await readdir(root), []);
  } finally { await service.close(); }
});

function twoServicesAfterSameRead(userDataDir) {
  let reads = 0; let release;
  const bothRead = new Promise((resolveRead) => { release = resolveRead; });
  function service() {
    const provider = new ProjectProviderImpl({userDataDir,leaseRoot:join(leaseParent(userDataDir),'isolated-project-leases')});
    const facade = {
      read: async () => {
        const result = await provider.read();
        reads += 1;
        if (reads === 2) release();
        await bothRead;
        return result;
      },
      write: (...args) => provider.write(...args),
      describeRoot: (path) => provider.describeRoot(path),
      newId: () => provider.newId(), now: () => provider.now(),
      close: () => provider.close()
    };
    return new ProjectServiceImpl({ userDataDir,leaseRoot:join(leaseParent(userDataDir),'isolated-project-leases') }, facade);
  }
  return { left: service(), right: service(), readCount: () => reads };
}

test('two project instances cannot overwrite a stale owner snapshot; lock is released', async () => {
  const { root, data } = await fixture();
  const initial = createProjectService({ userDataDir: data });
  const selected = (await initial.select(root)).value;
  await initial.close();
  const pair = twoServicesAfterSameRead(data);
  const owner = (roleId) => new ProjectFileOwners({ projectId: selected.id, version: `owners-${roleId}`,
    owners: [{ resource: 'src/shared.ts', roleId }] });
  try {
    const [backend, frontend] = await Promise.all([
      pair.left.saveProject({ ...selected, fileOwners: owner('Backend') },
        { expectedFileOwnersDigest: selected.fileOwners.digest }),
      pair.right.saveProject({ ...selected, fileOwners: owner('Frontend') },
        { expectedFileOwnersDigest: selected.fileOwners.digest })
    ]);
    assert.equal(pair.readCount(), 2);
    assert.equal([backend, frontend].filter((result) => result.ok).length, 1);
    assert.equal([backend, frontend].find((result) => !result.ok).error.code, 'lease_busy');
    const observed = createProjectProvider({ userDataDir: data });
    const persisted = (await observed.read()).value.projects[0];
    observed.close();
    assert.equal(persisted.fileOwners.ownerOf('src/shared.ts'), backend.ok ? 'Backend' : 'Frontend');
    assert.equal((await readdir(data)).includes('workbench-projects.lock'), false);
    assert.deepEqual(await readdir(root), []);
  } finally { await pair.left.close(); await pair.right.close(); }
});

test('default profile and owner saves also use whole-catalog CAS without lost updates', async () => {
  const { root, data } = await fixture();
  const initial = createProjectService({ userDataDir: data });
  const selected = (await initial.select(root)).value;
  await initial.close();
  const pair = twoServicesAfterSameRead(data);
  const owner = new ProjectFileOwners({ projectId: selected.id, version: 'owners-v1',
    owners: [{ resource: 'src/a.ts', roleId: 'Backend' }] });
  try {
    const [profile, claimed] = await Promise.all([
      pair.left.setDefaultProfile('local-ai'),
      pair.right.saveProject({ ...selected, fileOwners: owner },
        { expectedFileOwnersDigest: selected.fileOwners.digest })
    ]);
    assert.equal(pair.readCount(), 2);
    assert.equal([profile, claimed].filter((result) => result.ok).length, 1);
    assert.equal([profile, claimed].find((result) => !result.ok).error.code, 'lease_busy');
    const retry = createProjectService({ userDataDir: data });
    try {
      if (!profile.ok) assert.equal((await retry.setDefaultProfile('local-ai')).ok, true);
      if (!claimed.ok) {
        const latest = (await retry.catalog()).value.projects[0];
        assert.equal((await retry.saveProject({ ...latest, fileOwners: owner },
          { expectedFileOwnersDigest: latest.fileOwners.digest })).ok, true);
      }
      const final = (await retry.catalog()).value;
      assert.equal(final.defaultProfileId, 'local-ai');
      assert.equal(final.projects[0].fileOwners.ownerOf('src/a.ts'), 'Backend');
      assert.equal((await readdir(data)).includes('workbench-projects.lock'), false);
    } finally { await retry.close(); }
  } finally { await pair.left.close(); await pair.right.close(); }
});

test('catalog lock symlink fails closed without touching its target', async () => {
  const { root, data, fixture: location } = await fixture();
  const service = createProjectService({ userDataDir: data });
  try {
    assert.equal((await service.select(root)).ok, true);
    const sentinel = join(location, 'sentinel.txt');
    await writeFile(sentinel, 'unchanged');
    await symlink(sentinel, join(data, 'workbench-projects.lock'));
    assert.equal((await service.setDefaultProfile('local-ai')).error.code, 'unsafe_path');
    assert.equal(await readFile(sentinel, 'utf8'), 'unchanged');
    assert.equal((await service.catalog()).value.defaultProfileId, null);
  } finally { await service.close(); }
});

test('selecting another project cannot replace a concurrent owner update', async () => {
  const { root, data, fixture: location } = await fixture();
  const other = join(location, 'other'); await mkdir(other);
  const initial = createProjectService({ userDataDir: data });
  const selected = (await initial.select(root)).value;
  await initial.close();
  const pair = twoServicesAfterSameRead(data);
  const owner = new ProjectFileOwners({ projectId: selected.id, version: 'owners-v1',
    owners: [{ resource: 'src/a.ts', roleId: 'Backend' }] });
  try {
    const [opened, claimed] = await Promise.all([
      pair.left.select(other),
      pair.right.saveProject({ ...selected, fileOwners: owner },
        { expectedFileOwnersDigest: selected.fileOwners.digest })
    ]);
    assert.equal(pair.readCount(), 2);
    assert.equal([opened, claimed].filter((result) => result.ok).length, 1);
    assert.equal([opened, claimed].find((result) => !result.ok).error.code, 'catalog_changed');
    const retry = createProjectService({ userDataDir: data });
    try {
      if (!opened.ok) assert.equal((await retry.select(other)).ok, true);
      if (!claimed.ok) {
        const latest = (await retry.catalog()).value.projects.find((item) => item.id === selected.id);
        assert.equal((await retry.saveProject({ ...latest, fileOwners: owner },
          { expectedFileOwnersDigest: latest.fileOwners.digest })).ok, true);
      }
      const final = (await retry.catalog()).value;
      assert.equal(final.projects.length, 2);
      assert.equal(final.projects.find((item) => item.id === selected.id).fileOwners.ownerOf('src/a.ts'), 'Backend');
      assert.equal((await readdir(data)).includes('workbench-projects.lock'), false);
    } finally { await retry.close(); }
  } finally { await pair.left.close(); await pair.right.close(); }
});

function createProjectService(options){return realCreateProjectService({...options,leaseRoot:join(leaseParent(options.userDataDir),'isolated-project-leases')});}

function createProjectProvider(options){return realCreateProjectProvider({...options,leaseRoot:join(leaseParent(options.userDataDir),'isolated-project-leases')});}


test('Human owner source binds once: another data catalog cannot replace it; context stays private',async()=>{
 const f=await fixture(), otherData=join(f.fixture,'other-data');
 const first=createProjectService({userDataDir:f.data}),second=createProjectService({userDataDir:otherData});
 try{
  const project=(await first.select(f.root)).value,other=(await second.select(f.root)).value;
  const lease=await first.acquireExecution(project);assert.equal(lease.ok,true);assert.equal(typeof lease.value.nonce,'string');
  const next=new ProjectFileOwners({projectId:project.id,version:'owners-v1',owners:[{resource:'owned.mjs',roleId:'Builder'}]});
  const saved=await first.saveProject({...project,fileOwners:next},{expectedFileOwnersDigest:project.fileOwners.digest,bindOwnerSource:true});assert.equal(saved.ok,true);
  const key=createHash('sha256').update(project.workspaceIdentity.deviceId+':'+project.workspaceIdentity.fileId).digest('hex');
  const path=join(leaseParent(f.data),'isolated-project-leases',key+'.owner-source.json');const bytes=await readFile(path);const marker=JSON.parse(bytes.toString());
  assert.equal((await lstat(path)).mode&0o777,0o600);assert.deepEqual(marker.workspace,project.workspaceIdentity);assert.equal(marker.source.catalogDirCanonicalPath,f.data);assert.equal(marker.source.filename,'workbench-projects.json');assert.equal(marker.source.projectId,project.id);
  assert.equal(JSON.stringify((await first.catalog()).value).includes(lease.value.nonce),false);
  assert.equal((await second.saveProject(other)).error.code,'lease_busy');
  assert.equal((await first.releaseExecution(project)).ok,true);
  const rejected=await second.saveProject({...other,fileOwners:next},{expectedFileOwnersDigest:other.fileOwners.digest,bindOwnerSource:true});assert.equal(rejected.error.code,'owner_catalog_mismatch');
  assert.deepEqual(await readFile(path),bytes);assert.equal((await second.catalog()).value.projects[0].fileOwners.version,'owners-v0');
 }finally{await first.close();await second.close();}
});

test('source survives failed CAS, same-source retry succeeds, and commit mutex protects catalog writes',async()=>{
 const f=await fixture(),service=createProjectService({userDataDir:f.data}),provider=createProjectProvider({userDataDir:f.data});
 try{
  const project=(await service.select(f.root)).value;const lease=await service.acquireExecution(project);assert.equal(lease.ok,true);
  const marker=await provider.assertOwnerSource(project,true);assert.equal(marker.ok,true);
  const key=createHash('sha256').update(project.workspaceIdentity.deviceId+':'+project.workspaceIdentity.fileId).digest('hex');const root=join(leaseParent(f.data),'isolated-project-leases');const source=join(root,key+'.owner-source.json');const before=await readFile(source);const inode=(await lstat(source)).ino;
  const catalog=(await provider.read()).value;const denied=await provider.write(catalog,project.workspaceIdentity,{expectedCatalogDigest:'0'.repeat(64),bindOwnerSource:true});assert.equal(denied.error.code,'catalog_changed');assert.deepEqual(await readFile(source),before);
  const retried=await provider.write(catalog,project.workspaceIdentity,{expectedCatalogDigest:digestValue(catalog),bindOwnerSource:true});assert.equal(retried.ok,true);assert.equal((await lstat(source)).ino,inode);
  const lock=join(root,key,'commit.lock');await writeFile(lock,'fixture-exclusive',{flag:'wx',mode:0o600});const bytes=await readFile(join(f.data,'workbench-projects.json'));
  try{assert.equal((await service.saveProject({...project,name:'must-wait'})).error.code,'lease_busy');assert.deepEqual(await readFile(join(f.data,'workbench-projects.json')),bytes);}finally{await unlink(lock);}
  const holder=join(root,key,'holder');await writeFile(holder,'changed-by-fixture');assert.equal((await service.assertExecution(project)).error.code,'lease_lost');
  // Restore only this fixture's known holder so its own provider can release it.
  await writeFile(holder,lease.value.nonce);assert.equal((await service.releaseExecution(project)).ok,true);
 }finally{provider.close();await service.close();}
});
