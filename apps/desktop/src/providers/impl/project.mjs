import { assertKnownKeyFree } from '../../models/workbench.mjs';
import { homedir } from 'node:os';
import { constants } from 'node:fs';
import {
  lstat,
  realpath,
  mkdir,
  open,
  rename,
  unlink
} from 'node:fs/promises';
import {
  resolve,
  dirname,
  join,
  relative,
  isAbsolute,
  basename
} from 'node:path';
import {
  randomUUID,
  createHash
} from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import {
  ContextReadConfirmation,
  digestValue
} from 'legion-runtime/workbench-models';
import { exactObject } from '../../models/desktop.mjs';
import {
  projectProviderOptions
} from '../abstract/project.mjs';
import {
  WB_LIMITS,
  WorkbenchValidationError,
  workspaceIdentity,
  catalogDocument,
  contextDescriptor,
  exactResources,
  wbSuccess,
  wbCaught
} from '../../models/workbench.mjs';
function fail(code) {
  throw new WorkbenchValidationError(code);
} function within(parent, child) {
  const part = relative(parent.toLowerCase(), child.toLowerCase());
  return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith('../') && !part.startsWith('..\\'));
}
  async function canonicalDirectory(path, create = false) {
  if (!isAbsolute(path)) fail('unsafe_path');
  const target = resolve(path);
  let current = target;
  const missing = [];
  for (; ; ) {
    try {
      const info = await lstat(current);
      if (!info.isDirectory() || info.isSymbolicLink()) fail('unsafe_path');
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      missing.unshift(basename(current));
      const parent = dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
  let ancestor = current;
  for (; ; ) {
    const info = await lstat(ancestor);
    if (!info.isDirectory() || info.isSymbolicLink()) fail('unsafe_path');
    const parent = dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  const actual = join(await realpath(current), ...missing);
  if (actual.toLowerCase() !== target.toLowerCase()) fail('unsafe_path');
  if (create) await mkdir(actual, {
    recursive: true
  });
  return actual;
}
  async function identity(path) {
  const actual = await canonicalDirectory(path);
  const info = await lstat(actual, {
    bigint: true
  });
  return workspaceIdentity({
    canonicalPath: actual.replaceAll('\\', '/'),
    deviceId: String(info.dev),
    fileId: String(info.ino)
  });
} function same(a, b) {
  return a.canonicalPath.toLowerCase() === b.canonicalPath.toLowerCase() && a.deviceId === b.deviceId && a.fileId === b.fileId;
}
  async function boundedFile(path, maximum) {
  const before = await lstat(path, {
    bigint: true
  });
  if (!before.isFile() || before.isSymbolicLink() || before.size > BigInt(maximum)) fail('context_budget');
  const handle = await open(path, 'r');
  let result;
  let failure;
  try {
    const info = await handle.stat({
      bigint: true
    });
    if (info.dev !== before.dev || info.ino !== before.ino || info.size !== before.size) fail('context_changed');
    const buffer = Buffer.alloc(maximum + 1);
    let size = 0;
    for (; ; ) {
      const read = await handle.read(buffer, size, buffer.length - size, size);
      size += read.bytesRead;
      if (size > maximum) fail('context_budget');
      if (!read.bytesRead) break;
    }
  const after = await handle.stat({
      bigint: true
    });
    const pathInfo = await lstat(path, {
      bigint: true
    });
    if (after.size !== info.size || after.mtimeNs !== info.mtimeNs || pathInfo.dev !== info.dev || pathInfo.ino !== info.ino || pathInfo.isSymbolicLink()) fail('context_changed');
    result = buffer.subarray(0, size);
  } catch (error) {
    failure = error;
  }
  try {
    await handle.close();
  } catch (error) {
    failure = error;
  }
  if (failure) throw failure;
  return result;
} export class ProjectProviderImpl {
  #data; #leaseRoot;
  #closed = false;
  constructor(options) {
    const checked = projectProviderOptions(options);
    if (!isAbsolute(checked.userDataDir)) fail('unsafe_path');
    this.#data = resolve(checked.userDataDir); this.#leaseRoot = checked.leaseRoot ?? join(homedir(), '.legion-project-leases');
  }
  newId() {
    return randomUUID();
  }
  now() {
    return new Date().toISOString();
  }
  close() {
    this.#closed = true;
    return wbSuccess(null);
  }
  async #isolate(root, verify = true) {
    const data = await canonicalDirectory(this.#data);
    if (within(root.canonicalPath, data) || within(data, root.canonicalPath)) fail('data_overlap');
    if (verify && !same(root, await identity(root.canonicalPath))) fail('context_changed');
  }
  async describeRoot(path) {
    try {
      if (this.#closed) fail('closed');
      const root = await identity(path);
      await this.#isolate(root);
      return wbSuccess({
        workspaceIdentity: root,
        name: basename(root.canonicalPath) || '项目'
      });
    } catch (error) {
      return wbCaught(error, 'project_unavailable');
    }
  }
  async read(knownSecrets = []) {
    try {
      if (this.#closed) fail('closed');
      const data = await canonicalDirectory(this.#data);
      const path = join(data, 'workbench-projects.json');
      let bytes;
      try {
        bytes = await boundedFile(path, WB_LIMITS.projectBytes);
      } catch (error) {
        if (error.code === 'ENOENT') return wbSuccess(catalogDocument({
          schemaVersion: 2,
          defaultProfileId: null,
          projects: []
        }));
        throw error;
      }
  const catalog = catalogDocument(JSON.parse(new TextDecoder('utf-8', {
        fatal: true
      }).decode(bytes)));
      assertKnownKeyFree(catalog, knownSecrets);
      for (const project of catalog.projects) await this.#isolate(project.workspaceIdentity, false);
      return wbSuccess(catalog);
    } catch (error) {
      return wbCaught(error, 'project_corrupt');
    }
  }
  async #acquireCatalogLock(data) {
    const path = join(data, 'workbench-projects.lock');
    const deadline = performance.now() + 2000;
    for (;;) {
      try { return { path, handle: await open(path, 'wx', 0o600) }; }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        let present;
        try { present = await lstat(path); }
        catch (lookup) { if (lookup.code !== 'ENOENT') throw lookup; }
        if (present && (!present.isFile() || present.isSymbolicLink())) fail('unsafe_path');
        if (performance.now() >= deadline) fail('project_busy');
        await delay(20);
      }
    }
  }
  async #releaseCatalogLock(lock) {
    let held; let failure = null;
    try { held = await lock.handle.stat({ bigint: true }); }
    catch (error) { failure = error; }
    try { await lock.handle.close(); }
    catch (error) { failure = error; }
    if (failure) throw failure;
    const current = await lstat(lock.path, { bigint: true });
    if (current.isSymbolicLink() || !current.isFile() ||
        current.dev !== held.dev || current.ino !== held.ino) fail('unsafe_path');
    await unlink(lock.path);
  }
  async ownerSource(project) {
    const data=await canonicalDirectory(this.#data,true); const info=await lstat(data,{bigint:true});
    return {schemaVersion:1,workspace:project.workspaceIdentity,source:{catalogDirCanonicalPath:data,dirDeviceId:String(info.dev),dirFileId:String(info.ino),filename:'workbench-projects.json',projectId:project.id}};
  }
  #key(root){return createHash('sha256').update(root.deviceId+':'+root.fileId).digest('hex');}
  async executionContext(root) {
    try {
      const actual=await identity(root.canonicalPath);if(!same(actual,root))fail('lease_lost');
      const leaseRoot=await canonicalDirectory(this.#leaseRoot); const rootInfo=await lstat(leaseRoot);
      if(process.platform!=='win32'&&(rootInfo.uid!==process.getuid()||(rootInfo.mode&0o077)!==0))fail('lease_lost');
      const path=join(leaseRoot,this.#key(actual));const lease=await lstat(path,{bigint:true});
      if(!lease.isDirectory()||lease.isSymbolicLink())fail('lease_lost');
      const holderPath=join(path,'holder');const holder=await lstat(holderPath,{bigint:true});
      if(!holder.isFile()||holder.isSymbolicLink()||holder.size>100n||(process.platform!=='win32'&&(holder.mode&0o777n)!==0o600n))fail('lease_lost');
      const nonce=new TextDecoder('utf-8',{fatal:true}).decode(await boundedFile(holderPath,100));
      return wbSuccess({leaseRoot,nonce,leaseIdentity:{deviceId:String(lease.dev),fileId:String(lease.ino)},holderIdentity:{deviceId:String(holder.dev),fileId:String(holder.ino)}});
    }catch(error){return wbCaught(error,'lease_lost');}
  }
  async assertOwnerSource(project, bind=false) {
    try {
      const marker=await this.ownerSource(project); const root=await canonicalDirectory(this.#leaseRoot); const path=join(root,this.#key(project.workspaceIdentity)+'.owner-source.json');
      if(bind){
        let handle;
        try {handle=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);}
        catch(error){if(error.code!=='EEXIST')throw error;}
        if(handle){try{await handle.writeFile(JSON.stringify(marker));await handle.sync();}finally{await handle.close();}}
      }
      const info=await lstat(path);
      if(!info.isFile()||info.isSymbolicLink()||(process.platform!=='win32'&&(info.uid!==process.getuid()||(info.mode&0o777)!==0o600)))fail('owner_catalog_mismatch');
      const current=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await boundedFile(path,16384)));
      if(digestValue(current)!==digestValue(marker))fail('owner_catalog_mismatch');
      return wbSuccess(marker);
    }catch(error){if(!bind&&error.code==='ENOENT')return wbSuccess(null);return wbCaught(error,'owner_catalog_mismatch');}
  }
  async #commitMutex(root){
    const context=await this.executionContext(root);if(!context.ok)fail(context.error.code);
    const path=join(context.value.leaseRoot,this.#key(root),'commit.lock');const deadline=performance.now()+2000;
    for(;;){try{return {path,handle:await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600)};}catch(error){if(error.code!=='EEXIST')throw error;if(performance.now()>=deadline)fail('lease_busy');await delay(10);}}
  }
  async write(raw, activeRoot = null, options = {}) {
    assertKnownKeyFree(raw, options.knownSecrets ?? []);
    let lock = null; let commits = []; let temp = null; let written = null; let failure = null;
    try {
      if (this.#closed) fail('closed');
      exactObject(options, ['expectedCatalogDigest', 'ownerExpectation','confirmMigration','bindOwnerSource','knownSecrets']);
      if (typeof options.expectedCatalogDigest !== 'string' ||
          !/^[a-f0-9]{64}$/u.test(options.expectedCatalogDigest)) fail('invalid_input');
      if (options.ownerExpectation !== undefined) {
        exactObject(options.ownerExpectation, ['projectId', 'digest']);
        if (typeof options.ownerExpectation.projectId !== 'string' ||
            typeof options.ownerExpectation.digest !== 'string' ||
            !/^[a-f0-9]{64}$/u.test(options.ownerExpectation.digest)) fail('invalid_input');
      }
      const catalog = catalogDocument(raw);
      if (activeRoot) await this.#isolate(workspaceIdentity(activeRoot));
      assertKnownKeyFree(catalog, options.knownSecrets ?? []);
      for (const project of catalog.projects) await this.#isolate(project.workspaceIdentity, false);
      const bytes = Buffer.from(JSON.stringify(catalog), 'utf8');
      if (bytes.length > WB_LIMITS.projectBytes) fail('project_corrupt');
      const data = await canonicalDirectory(this.#data, true);
      const dataInfo = await lstat(data, { bigint: true });
      if(catalog.schemaVersion===2){let roots=catalog.projects.map(item=>item.workspaceIdentity);if(activeRoot)roots=[activeRoot];for(const root of roots.sort((a,b)=>this.#key(a).localeCompare(this.#key(b)))){commits.push(await this.#commitMutex(root));const project=catalog.projects.find(item=>same(item.workspaceIdentity,root));if(project){const source=await this.assertOwnerSource(project);if(!source.ok)fail(source.error.code);}}}
      lock = await this.#acquireCatalogLock(data);
      const currentResult = await this.read(options.knownSecrets ?? []);
      if (!currentResult.ok) fail(currentResult.error.code);
      const current = currentResult.value; if(current.schemaVersion===1&&!options.confirmMigration)fail('legacy_migration_requires_exit');
      if (digestValue(current) !== options.expectedCatalogDigest) {
        const expectedOwner = options.ownerExpectation;
        if (expectedOwner !== undefined) {
          const saved = current.projects.find((item) => item.id === expectedOwner.projectId);
          if (!saved || saved.fileOwners.digest !== expectedOwner.digest) fail('stale_file_owners');
        }
        fail('catalog_changed');
      }
      const target = join(data, 'workbench-projects.json');
      temp = join(data, `workbench-projects-${randomUUID()}.tmp`);
      const handle = await open(temp, 'wx', 0o600);
      try { await handle.writeFile(bytes); await handle.sync(); }
      finally { await handle.close(); }
      assertKnownKeyFree(catalog, options.knownSecrets ?? []);
      for (const project of catalog.projects) await this.#isolate(project.workspaceIdentity, false);
      if (activeRoot) await this.#isolate(workspaceIdentity(activeRoot));
      const actualData = await canonicalDirectory(this.#data);
      const currentDataInfo = await lstat(actualData, { bigint: true });
      if (actualData !== data || currentDataInfo.dev !== dataInfo.dev ||
          currentDataInfo.ino !== dataInfo.ino) fail('unsafe_path');
      const original=await boundedFile(target,WB_LIMITS.projectBytes).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
      if(original && JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(original)).schemaVersion===1 && catalog.schemaVersion===2){const backup=await open(join(data,`workbench-projects-v1-${randomUUID()}.backup.json`),'wx',0o600);try{await backup.writeFile(original);await backup.sync();}finally{await backup.close();}}
      if(options.bindOwnerSource){const project=catalog.projects.find(item=>activeRoot&&same(item.workspaceIdentity,activeRoot));if(!project)fail('owner_catalog_mismatch');const source=await this.assertOwnerSource(project,true);if(!source.ok)fail(source.error.code);}
      await rename(temp, target);
      temp = null; written = catalog;
    } catch (error) { failure = error; }
    if (temp) {
      try { await unlink(temp); }
      catch (error) { if (error.code !== 'ENOENT') failure = error; }
    }
    if (lock) {
      try { await this.#releaseCatalogLock(lock); }
      catch (error) { failure = error; }
    }
    for(const commit of commits.reverse()){try{await this.#releaseCatalogLock(commit);}catch(error){failure=error;}}
    if (failure) return wbCaught(failure, 'project_unavailable');
    return wbSuccess(written);
  }
  async readContext(input) {
    try {
      if (this.#closed) fail('closed');
      exactObject(input, ['authorization', 'workspaceIdentity', 'organizationVersion', 'profileVersion', 'resources']);
      const resources = exactResources(input.resources, WB_LIMITS.contextFiles);
      const root = workspaceIdentity(input.workspaceIdentity);
      await this.#isolate(root);
      ContextReadConfirmation.assertForRead(input.authorization, {
        workspaceIdentity: root,
        organizationVersion: input.organizationVersion,
        profileVersion: input.profileVersion,
        resources
      });
      const files = [];
      const texts = [];
      let total = 0;
      for (const resource of resources) {
        ContextReadConfirmation.assertForRead(input.authorization, { workspaceIdentity: root, organizationVersion: input.organizationVersion, profileVersion: input.profileVersion, resources: [resource] });
        let target = root.canonicalPath;
        const parts = resource.split('/');
        for (let index = 0; index < parts.length; index += 1) {
          target = join(target, parts[index]);
          const info = await lstat(target);
          if (info.isSymbolicLink() || (index < parts.length - 1 && !info.isDirectory())) fail('unsafe_path');
        }
  const bytes = await boundedFile(target, WB_LIMITS.contextFileBytes);
        total += bytes.length;
        if (total > WB_LIMITS.contextBytes) fail('context_budget');
        files.push({
          resource,
          byteLength: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex')
        });
        const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(text)) fail('context_unavailable');
        texts.push({ resource, text });
      }
  await this.#isolate(root);
      ContextReadConfirmation.assertForRead(input.authorization, { workspaceIdentity: root, organizationVersion: input.organizationVersion, profileVersion: input.profileVersion, resources });
      return wbSuccess({
        context: contextDescriptor({
          files,
          verifiedAt: this.now()
        }),
        texts
      });
    } catch (error) {
      return wbCaught(error, 'context_unavailable');
    }
  }
}
