import { lstat, realpath, mkdir, open, unlink, rmdir } from 'node:fs/promises';
import { resolve, join, parse, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { projectLeaseOptions } from '../abstract/project_lease.mjs';
import { immutable, success, failure } from '../../models/desktop.mjs';

function rejected(code) { const error = new Error(code); error.code = code; throw error; }
function sameIdentity(a, b) { return a.dev === b.dev && a.ino === b.ino; }
async function identity(path) {
  const stat = await lstat(path, { bigint: true });
  if (!stat.isDirectory() || stat.isSymbolicLink()) rejected('lease_lost');
  return { dev: String(stat.dev), ino: String(stat.ino) };
}
async function privateRoot(path) {
  if (!isAbsolute(path)) rejected('lease_unavailable');
  const absolute = resolve(path);
  let current = parse(absolute).root;
  for (const part of absolute.slice(current.length).split('/').filter(Boolean)) {
    current = join(current, part);
    try { await mkdir(current, { mode: 0o700 }); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const stat = await lstat(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) rejected('lease_unavailable');
  }
  const stat = await lstat(absolute);
  if (process.platform !== 'win32') {
    if (stat.uid !== process.getuid() || (stat.mode & 0o077) !== 0) rejected('lease_unavailable');
  }
  return absolute;
}
export class ProjectLeaseProviderImpl {
  #root; #handles = new Map(); #tail = Promise.resolve(); #closed = false;
  constructor(options = {}) {
    const checked = projectLeaseOptions(options);
    this.#root = checked.leaseRoot ?? join(homedir(), '.legion-project-leases');
  }
  #queue(action) {
    const pending = this.#tail.then(action);
    this.#tail = pending.then(() => undefined, () => undefined);
    return pending;
  }
  acquire(workspaceRoot) {
    return this.#queue(async () => {
      if (this.#closed) return failure('closed');
      let lockPath;
      let created = false;
      try {
        if (typeof workspaceRoot !== 'string' || !isAbsolute(workspaceRoot)) return failure('invalid_input');
        const canonicalPath = await realpath(workspaceRoot);
        const workspace = await identity(canonicalPath);
        const key = createHash('sha256').update(`${workspace.dev}:${workspace.ino}`).digest('hex');
        const root = await privateRoot(this.#root);
        lockPath = join(root, key);
        try { await mkdir(lockPath, { mode: 0o700 }); created = true; }
        catch (error) { if (error.code === 'EEXIST') return failure('lease_busy'); throw error; }
        const lockIdentity = await identity(lockPath);
        const nonce = randomUUID();
        const marker = await open(join(lockPath, 'holder'), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        try { await marker.writeFile(nonce); await marker.sync(); } finally { await marker.close(); }
        const handle = immutable({ workspace: { canonicalPath, deviceId: workspace.dev, fileId: workspace.ino }, leaseId: randomUUID() });
        this.#handles.set(handle, { lockPath, lockIdentity, nonce, workspace, canonicalPath, rootIdentity: await identity(root), root });
        return success(handle);
      } catch (error) {
        if (created) {
          // Only remove an empty directory made by this acquisition; never recursively clean.
          try { await rmdir(lockPath); } catch (cleanup) { if (cleanup.code !== 'ENOTEMPTY' && cleanup.code !== 'ENOENT') return failure('lease_unavailable'); }
        }
        return failure('lease_unavailable');
      }
    });
  }
  async #current(handle) {
    const record = this.#handles.get(handle);
    if (!record) return failure('lease_lost');
    try {
      if (!sameIdentity(await identity(record.root), record.rootIdentity)) return failure('lease_lost');
      if (!sameIdentity(await identity(record.lockPath), record.lockIdentity)) return failure('lease_lost');
      if (!sameIdentity(await identity(record.canonicalPath), record.workspace)) return failure('lease_lost');
      const path = join(record.lockPath, 'holder');
      const marker = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const stat = await marker.stat();
        if (!stat.isFile() || stat.size > 100) return failure('lease_lost');
        if (await marker.readFile('utf8') !== record.nonce) return failure('lease_lost');
      } finally { await marker.close(); }
      return success(handle);
    } catch { return failure('lease_lost'); }
  }
  assertCurrent(handle) {
    return this.#queue(async () => {
      if (this.#closed) return failure('closed');
      return this.#current(handle);
    });
  }
  async #release(handle) {
    const record = this.#handles.get(handle);
    if (!record) return success(null);
    const current = await this.#current(handle);
    if (!current.ok) return current;
    try {
      await unlink(join(record.lockPath, 'holder'));
      await rmdir(record.lockPath);
      this.#handles.delete(handle);
      return success(null);
    } catch { return failure('lease_unavailable'); }
  }
  release(handle) { return this.#queue(() => this.#release(handle)); }
  close() {
    this.#closed = true;
    return this.#queue(async () => {
      for (const handle of this.#handles.keys()) {
        const result = await this.#release(handle);
        if (!result.ok) return result;
      }
      return success(null);
    });
  }
}
