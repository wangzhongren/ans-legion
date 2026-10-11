import { digestValue } from 'legion-runtime/workbench-models';
import {
  lstat,
  realpath,
  mkdir,
  open,
  rename,
  unlink,
  rmdir
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
  randomUUID
} from 'node:crypto';
import {
  historyProviderOptions
} from '../abstract/history.mjs';
import {
  projectIdentifier
} from '../../models/desktop.mjs';
import {
  WB_LIMITS,
  WorkbenchValidationError,
  workspaceIdentity,
  historyDocument,
  wbSuccess,
  wbCaught
} from '../../models/workbench.mjs';
function fail(code) {
  throw new WorkbenchValidationError(code);
} function within(a, b) {
  const part = relative(a.toLowerCase(), b.toLowerCase());
  return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith('../') && !part.startsWith('..\\'));
}
  async function canonical(path) {
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
      current = dirname(current);
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
  return actual;
} export class HistoryProviderImpl {
  #data;
  #closed = false;
  constructor(options) {
    const checked = historyProviderOptions(options);
    if (!isAbsolute(checked.userDataDir)) fail('unsafe_path');
    this.#data = resolve(checked.userDataDir);
  }
  close() {
    this.#closed = true;
    return wbSuccess(null);
  }
  async #guard(rootValue) {
    if (this.#closed) fail('closed');
    const root = workspaceIdentity(rootValue);
    const data = await canonical(this.#data);
    const actual = await canonical(root.canonicalPath);
    const info = await lstat(actual, {
      bigint: true
    });
    if (String(info.dev) !== root.deviceId || String(info.ino) !== root.fileId) fail('context_changed');
    if (within(actual, data) || within(data, actual)) fail('data_overlap');
    const directory = join(data, 'workbench-history');
    try {
      const stat = await lstat(directory);
      if (!stat.isDirectory() || stat.isSymbolicLink()) fail('unsafe_path');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  return directory;
  }
  async read(projectId, root) {
    try {
      projectIdentifier(projectId);
      const directory = await this.#guard(root);
      const target = join(directory, `${projectId}.json`);
      let info;
      try {
        info = await lstat(target);
      } catch (error) {
        if (error.code === 'ENOENT') return wbSuccess(historyDocument({
          schemaVersion: 1,
          projectId,
          roleId: 'ProjectManager',
          history: {
            messages: []
          }
        }));
        throw error;
      }
  if (!info.isFile() || info.isSymbolicLink() || info.size > WB_LIMITS.historyBytes) fail('history_corrupt');
      const handle = await open(target, 'r');
      let bytes;
      let error;
      try {
        const before = await handle.stat();
        if (before.ino !== info.ino || before.dev !== info.dev) fail('history_corrupt');
        const buffer = Buffer.alloc(WB_LIMITS.historyBytes + 1);
        let size = 0;
        for (;;) {
          const read = await handle.read(buffer, size, buffer.length - size, size);
          size += read.bytesRead;
          if (size > WB_LIMITS.historyBytes) fail('history_corrupt');
          if (!read.bytesRead) break;
        }
        bytes = buffer.subarray(0, size);
        const after = await handle.stat();
        const final = await lstat(target);
        if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || final.ino !== info.ino || final.dev !== info.dev || final.isSymbolicLink()) fail('history_corrupt');
      } catch (failure) {
        error = failure;
      }
  try {
        await handle.close();
      } catch (failure) {
        error = failure;
      }
  if (error) throw error;
      const document = historyDocument(JSON.parse(new TextDecoder('utf-8', {
        fatal: true
      }).decode(bytes)));
      if (document.projectId !== projectId) fail('history_corrupt');
      return wbSuccess(document);
    } catch (error) {
      return wbCaught(error, 'history_corrupt');
    }
  }
  async write(raw, root, options = {}) {
    let temp = null; let lock = null;
    try {
      const document = historyDocument(raw);
      const directory = await this.#guard(root);
      const bytes = Buffer.from(JSON.stringify(document));
      if (bytes.length > WB_LIMITS.historyBytes) fail('history_corrupt');
      await mkdir(directory, {
        recursive: true
      });
      await this.#guard(root);
      const target = join(directory, `${document.projectId}.json`);
      const locking = target + '.lock';
      try { await mkdir(locking, { mode: 0o700 }); lock = locking; } catch (error) { if (error.code === 'EEXIST') fail('history_busy'); throw error; }
      const current = await this.read(document.projectId, root); if (!current.ok) fail(current.error.code);
      if (options.expectedDigest !== undefined && options.expectedDigest !== digestValue(current.value)) fail('stale_history');
      try {
        const info = await lstat(target);
        if (!info.isFile() || info.isSymbolicLink()) fail('unsafe_path');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
  temp = join(directory, `${randomUUID()}.tmp`);
      const handle = await open(temp, 'wx');
      let error;
      try {
        await handle.writeFile(bytes);
        await handle.sync();
      } catch (failure) {
        error = failure;
      }
  try {
        await handle.close();
      } catch (failure) {
        error = failure;
      }
  if (error) throw error;
      await this.#guard(root);
      await rename(temp, target);
      temp = null;
      return wbSuccess(document);
    } catch (error) {
      if (temp) {
        try {
          await unlink(temp);
        } catch (cleanup) {
          if (cleanup.code !== 'ENOENT') return wbCaught(cleanup, 'history_unavailable');
        }
      }
  return wbCaught(error, 'history_unavailable');
    } finally { if (lock) await rmdir(lock); }
  }
}
