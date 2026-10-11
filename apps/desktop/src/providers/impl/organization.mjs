import { assertKnownKeyFree } from '../../models/workbench.mjs';
import { lstat, realpath, mkdir, open, rename, unlink, rmdir, readdir, readlink, constants } from 'node:fs/promises';
import { resolve, join, dirname, relative, isAbsolute } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { organizationProviderOptions } from '../abstract/organization.mjs';
import { projectIdentifier } from '../../models/desktop.mjs';
import { workspaceIdentity } from '../../models/workbench.mjs';
import { normalizeProjectReadResource, digestValue } from 'legion-runtime/workbench-models';
const MAX_BYTES = 16777216;
function fail(code) { const error = new Error(code); error.code = code; throw error; }
function overlaps(a, b) { const part = relative(a.toLowerCase(), b.toLowerCase()); return part === '' || (!isAbsolute(part) && part !== '..' && !part.startsWith('../')); }
async function physical(path, create = false) {
  const target = resolve(path);
  let current = dirname(target); const missing = [];
  for (;;) {
    try { const info = await lstat(current); if (!info.isDirectory() || info.isSymbolicLink()) fail('unsafe_path'); break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; missing.unshift(current); current = dirname(current); }
  }
  for (let ancestor = current;; ancestor = dirname(ancestor)) {
    const info = await lstat(ancestor); if (info.isSymbolicLink() || !info.isDirectory()) fail('unsafe_path');
    if (dirname(ancestor) === ancestor) break;
  }
  if ((await realpath(current)).toLowerCase() !== current.toLowerCase()) fail('unsafe_path');
  if (create) { for (const directory of missing) await mkdir(directory, { mode: 0o700 }); await mkdir(target, { recursive: true, mode: 0o700 }); }
  try { const info = await lstat(target); if (info.isSymbolicLink()) fail('unsafe_path'); }
  catch (error) { if (error.code !== 'ENOENT' || create) throw error; }
  return target;
}
async function readJson(target) {
  let handle;
  try {
    const info = await lstat(target); if (info.isSymbolicLink() || !info.isFile() || info.size > MAX_BYTES) fail('organization_corrupt');
    handle = await open(target, 'r'); const before = await handle.stat();
    if (before.dev !== info.dev || before.ino !== info.ino) fail('organization_corrupt');
    const bytes = await handle.readFile(); const after = await handle.stat(); const last = await lstat(target);
    if (bytes.length > MAX_BYTES || before.mtimeMs !== after.mtimeMs || before.size !== after.size || last.isSymbolicLink() || last.ino !== before.ino) fail('organization_corrupt');
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  finally { if (handle) await handle.close(); }
}
export class OrganizationProviderImpl {
  #data; #closed = false;
  constructor(options) { this.#data = resolve(organizationProviderOptions(options).userDataDir); }
  async #guard(projectId, rootValue) {
    if (this.#closed) fail('closed'); projectIdentifier(projectId);
    const root = workspaceIdentity(rootValue); const workspace = await physical(root.canonicalPath);
    const info = await lstat(workspace, { bigint: true });
    if (!info.isDirectory() || String(info.dev) !== root.deviceId || String(info.ino) !== root.fileId) fail('root_identity_changed');
    const data = await physical(this.#data);
    if (overlaps(data, workspace) || overlaps(workspace, data)) fail('data_overlap');
    await physical(data, true);
    return { root, directory: await physical(join(data, 'workbench-organization'), true) };
  }
  async read(projectId, root, knownSecrets = []) { const checked = await this.#guard(projectId, root); return assertKnownKeyFree(await readJson(join(checked.directory, projectId + '.json')), knownSecrets); }
  async write(document, root, expectedDigest, signal = null, expectedRawDigest = null, knownSecrets = []) {
    assertKnownKeyFree(document, knownSecrets);
    if (signal !== null && !(signal instanceof AbortSignal)) fail('invalid_signal');
    if (signal?.aborted) fail('stale_action');
    const checked = await this.#guard(document.projectId, root); const target = join(checked.directory, document.projectId + '.json');
    const lock = target + '.lock'; let locked = false; let temporary = null;
    try {
      try { await mkdir(lock, { mode: 0o700 }); locked = true; } catch (error) { if (error.code === 'EEXIST') fail('organization_busy'); throw error; }
      const current = assertKnownKeyFree(await readJson(target), knownSecrets);
      if(expectedRawDigest!==null&&digestValue(current)!==expectedRawDigest)fail('stale_organization');
      if ((current?.digest ?? null) !== expectedDigest) fail('stale_organization');
      const bytes = Buffer.from(JSON.stringify(document)); if (bytes.length > MAX_BYTES) fail('organization_budget');
      temporary = join(checked.directory, randomUUID() + '.tmp'); const handle = await open(temporary, 'wx', 0o600);
      try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
      await this.#guard(document.projectId, root);
      // Linearization: cancellation before rename starts prevents publication.
      // After this call starts, finish the commit and return its actual document.
      if (signal?.aborted) fail('stale_action');
      await rename(temporary, target); temporary = null;
      const directory = await open(checked.directory, 'r'); try { await directory.sync(); } finally { await directory.close(); }
      return document;
    } finally { if (temporary) await unlink(temporary); if (locked) await rmdir(lock); }
  }
  async snapshotInputs(projectId, root, resources, approvedAbsences = []) {
    const checked = await this.#guard(projectId, root); const versions = [];
    for (const resource of resources) {
      const safe = normalizeProjectReadResource(resource); if (!safe) fail('exact_check_input_required');
      const target = join(checked.root.canonicalPath, safe); await physical(dirname(target));
      let info; try { info = await lstat(target); } catch (error) { if (error.code !== 'ENOENT' || !approvedAbsences.includes(safe)) throw error; versions.push({ resource: safe, state: 'absent', sha256: null, byteLength: 0 }); continue; } if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 33554432) fail('unsafe_check_input');
      const handle = await open(target, 'r');
      try {
        const before = await handle.stat(); if (before.dev !== info.dev || before.ino !== info.ino) fail('stale_check_input');
        const bytes = await handle.readFile(); const after = await handle.stat(); const final = await lstat(target);
        if (bytes.length > 33554432 || before.size !== after.size || before.mtimeMs !== after.mtimeMs || final.ino !== before.ino || final.isSymbolicLink()) fail('stale_check_input');
        versions.push({ resource: safe, sha256: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length });
      } finally { await handle.close(); }
    }
    await this.#guard(projectId, root); return versions.sort((a, b) => a.resource.toLowerCase().localeCompare(b.resource.toLowerCase()));
  }
  async checkConfiguration(projectId, root) {
    await this.#guard(projectId, root);
    const outputRoot = await physical(join(this.#data, 'checks'), true);
    const lockRoot = await physical(join(this.#data, 'project-resource-locks'), true);
    return Object.freeze({ workspaceRoot: root.canonicalPath, runtimeExecutable: await realpath(process.execPath), outputRoot, lockRoot });
  }
  async shellConfiguration(projectId, root, roleId, planDigest) {
    await this.#guard(projectId, root); if (!/^[a-f0-9]{64}$/u.test(planDigest)) fail('plan_changed'); const safeRole = roleId.replace(/[^A-Za-z0-9_.-]/gu, ''); if (safeRole !== roleId || !roleId || ['.', '..'].includes(roleId)) fail('unsafe_role_id');
    const outputRoot = await physical(join(this.#data, 'project-shell', projectId, roleId, planDigest), true); const lockRoot = await physical(join(this.#data, 'project-resource-locks'), true);
    let npmCli; for (const candidate of ['/usr/local/lib/node_modules/npm/bin/npm-cli.js', '/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js']) { try { const actual = await realpath(candidate); const info = await lstat(actual); if (info.isFile()) { npmCli = actual; break; } } catch (error) { if (error.code !== 'ENOENT') throw error; } }
    const result = { workspaceRoot: root.canonicalPath, runtimeExecutable: await realpath(process.execPath), outputRoot, lockRoot }; if (npmCli) result.npmCli = npmCli; return Object.freeze(result);
  }
  async inventory(projectId, root, artifactScopes = [], digestScopes = artifactScopes) {
    const checked = await this.#guard(projectId, root); const source = []; const allFiles = []; const artifacts = []; const directories = [];
    const generated = (resource) => artifactScopes.some((artifact) => resource === artifact.scope.slice(0, -1) || resource.startsWith(artifact.scope));
    const walk = async (directory, prefix) => {
      const before = await lstat(directory); if (!before.isDirectory() || before.isSymbolicLink()) fail('unsafe_path');
      directories.push({ resource: prefix, deviceId: String(before.dev), fileId: String(before.ino) });
      for (const name of (await readdir(directory)).sort()) { const resource = prefix + name; let safe; try { safe = normalizeProjectReadResource(resource); } catch (error) { if (!(error instanceof TypeError)) throw error; continue; } const target = join(directory, name); const info = await lstat(target); const artifact = generated(resource);
        if (info.isDirectory()) { if (artifact) artifacts.push({ resource: resource + '/', kind: 'directory' }); await walk(target, resource + '/'); continue; }
        if (info.isSymbolicLink()) { if (!artifact) fail('unsafe_shell_source_link'); const link = await readlink(target); const full = resolve(dirname(target), link); const scope = artifactScopes.find((item) => resource.startsWith(item.scope)); if (isAbsolute(link) || !scope || !full.startsWith(resolve(checked.root.canonicalPath, scope.scope) + '/')) fail('unsafe_artifact_link'); const actual = await realpath(target); if (!actual.startsWith(resolve(checked.root.canonicalPath, scope.scope) + '/')) fail('unsafe_artifact_link'); artifacts.push({ resource, kind: 'link', target: link }); continue; }
        if (!info.isFile() || info.nlink !== 1 || (info.mode & 0o6000)) fail('unsafe_shell_source');
        const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW); const hash = createHash('sha256'); let length = 0;
        try { const first = await handle.stat(); if (first.dev !== info.dev || first.ino !== info.ino) fail('stale_shell_input'); for await (const chunk of handle.createReadStream({ autoClose: false })) { hash.update(chunk); length += chunk.length; } const after = await handle.stat(), final = await lstat(target); if (first.size !== after.size || first.mtimeMs !== after.mtimeMs || final.ino !== first.ino || final.isSymbolicLink()) fail('stale_shell_input'); } finally { await handle.close(); }
        const entry = { resource: safe, state: 'present', sha256: hash.digest('hex'), byteLength: length, executable: Boolean(info.mode & 0o111) }; allFiles.push(entry); if (artifact) artifacts.push({ ...entry, kind: 'file' }); else source.push(entry);
      }
      const after = await lstat(directory); if (before.dev !== after.dev || before.ino !== after.ino || before.mtimeMs !== after.mtimeMs) fail('stale_shell_inventory');
    };
    await walk(checked.root.canonicalPath, ''); await this.#guard(projectId, root); const selected = artifacts.filter((entry) => digestScopes.some((scope) => entry.resource === scope.scope.slice(0,-1) || entry.resource.startsWith(scope.scope))); return Object.freeze({ source: Object.freeze(source), allFiles: Object.freeze(allFiles), generationDigest: digestValue(selected), inventoryDigest: digestValue({ source, directories }), directories: Object.freeze(directories) });
  }
  async appendShellArchive(projectId, root, requestId, value, knownSecrets = []) {
    assertKnownKeyFree(value,knownSecrets);
    await this.#guard(projectId, root); if (!/^[A-Za-z0-9_.-]+$/u.test(requestId)) fail('invalid_shell_id'); const directory = await physical(join(this.#data, 'project-shell-logs', projectId), true); const target = join(directory, requestId + '.jsonl');
    const text = value.text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, ''); let size = 0; try { const info = await lstat(target); if (!info.isFile() || info.isSymbolicLink()) fail('unsafe_shell_log'); size = info.size; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    assertKnownKeyFree(text,knownSecrets);
    const remaining = 1048576 - size; if (remaining < 128) return { truncated: true };
    let recorded = text, truncated = false, line = Buffer.from(JSON.stringify({ stream: value.stream, text: recorded, truncated }) + '\n');
    if (line.length > remaining) { truncated = true; recorded = recorded.slice(0, Math.max(0, Math.floor((remaining - 128) / 6))); if (/^[\uDC00-\uDFFF]$/u.test(recorded.at(-1) ?? '')) recorded = recorded.slice(0, -1); if (/^[\uD800-\uDBFF]$/u.test(recorded.at(-1) ?? '')) recorded = recorded.slice(0, -1); line = Buffer.from(JSON.stringify({ stream: value.stream, text: recorded, truncated }) + '\n'); }
    const handle = await open(target, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600); try { await handle.writeFile(line); await handle.sync(); } finally { await handle.close(); } return { truncated };
  }
  close() { this.#closed = true; }
}
