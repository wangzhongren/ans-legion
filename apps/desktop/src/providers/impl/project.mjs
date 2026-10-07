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
import {
  ContextReadConfirmation
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
  #data;
  #closed = false;
  constructor(options) {
    const checked = projectProviderOptions(options);
    if (!isAbsolute(checked.userDataDir)) fail('unsafe_path');
    this.#data = resolve(checked.userDataDir);
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
  async read() {
    try {
      if (this.#closed) fail('closed');
      const data = await canonicalDirectory(this.#data);
      const path = join(data, 'workbench-projects.json');
      let bytes;
      try {
        bytes = await boundedFile(path, WB_LIMITS.projectBytes);
      } catch (error) {
        if (error.code === 'ENOENT') return wbSuccess(catalogDocument({
          schemaVersion: 1,
          defaultProfileId: null,
          projects: []
        }));
        throw error;
      }
  const catalog = catalogDocument(JSON.parse(new TextDecoder('utf-8', {
        fatal: true
      }).decode(bytes)));
      for (const project of catalog.projects) await this.#isolate(project.workspaceIdentity, false);
      return wbSuccess(catalog);
    } catch (error) {
      return wbCaught(error, 'project_corrupt');
    }
  }
  async write(raw, activeRoot = null) {
    let temp = null;
    try {
      if (this.#closed) fail('closed');
      const catalog = catalogDocument(raw);
      if (activeRoot) await this.#isolate(workspaceIdentity(activeRoot));
      for (const project of catalog.projects) await this.#isolate(project.workspaceIdentity, false);
      const bytes = Buffer.from(JSON.stringify(catalog), 'utf8');
      if (bytes.length > WB_LIMITS.projectBytes) fail('project_corrupt');
      const data = await canonicalDirectory(this.#data, true);
      const target = join(data, 'workbench-projects.json');
      try {
        const old = await lstat(target);
        if (!old.isFile() || old.isSymbolicLink()) fail('unsafe_path');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
  temp = join(data, `workbench-projects-${randomUUID()}.tmp`);
      const handle = await open(temp, 'wx');
      let failure;
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } catch (error) {
        failure = error;
      }
  try {
        await handle.close();
      } catch (error) {
        failure = error;
      }
  if (failure) throw failure;
      for (const project of catalog.projects) await this.#isolate(project.workspaceIdentity, false);
      if (activeRoot) await this.#isolate(workspaceIdentity(activeRoot));
      await rename(temp, target);
      temp = null;
      return wbSuccess(catalog);
    } catch (error) {
      if (temp) {
        try {
          await unlink(temp);
        } catch (cleanup) {
          if (cleanup.code !== 'ENOENT') return wbCaught(cleanup, 'project_unavailable');
        }
      }
  return wbCaught(error, 'project_unavailable');
    }
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
