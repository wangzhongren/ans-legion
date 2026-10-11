import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as models from 'legion-runtime/workbench-models';
const desktop = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const project = resolve(desktop, '../..');
const packaging = join(project, '.ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/su-frontdoor-memory-repair-v1');
const spec = 'file:../../.ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/su-frontdoor-memory-repair-v1/legion-runtime-1.1.3.tgz';
const readJson = async path => JSON.parse(await fs.readFile(path, 'utf8'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(process.argv.length, 2, 'verification_has_no_dynamic_arguments');
const manifest = await readJson(join(desktop, 'package.json'));
const lock = await readJson(join(desktop, 'package-lock.json'));
const smoke = await readJson(join(packaging, 'package-smoke.json'));
const archive = await fs.readFile(join(packaging, 'legion-runtime-1.1.3.tgz'));
assert.equal(smoke.sha256, hash(archive));
const integrity = 'sha512-' + createHash('sha512').update(archive).digest('base64');
assert.equal(manifest.dependencies['legion-runtime'], spec);
assert.equal(lock.packages[''].dependencies['legion-runtime'], spec);
const entry = lock.packages['node_modules/legion-runtime'];
assert.equal(entry.resolved, spec); assert.equal(entry.integrity, integrity);
assert.equal(entry.version, '1.1.3'); assert.equal(entry.link, undefined);
const installed = join(desktop, 'node_modules/legion-runtime');
const stat = await fs.lstat(installed);
assert.ok(stat.isDirectory() && !stat.isSymbolicLink());
const published = await readJson(join(installed, 'package.json'));
assert.equal(published.version, '1.1.3');
assert.deepEqual(published.exports, smoke.packageExports);
assert.deepEqual(Object.keys(models).sort(), smoke.modelExports);
for (const [name, expected] of Object.entries(smoke.serviceExports)) {
  assert.deepEqual(Object.keys(await import('legion-runtime/services/' + name)).sort(), [...expected].sort());
}
for (const [path, digest] of Object.entries(smoke.sourceHashes)) {
  assert.equal(hash(await fs.readFile(join(installed, path))), digest, 'installed_runtime_source:' + path);
  assert.equal(hash(await fs.readFile(join(project, path))), digest, 'current_runtime_source:' + path);
}
for (const name of ['@earendil-works/pi-ai', '@earendil-works/pi-coding-agent']) {
  const resolved = fileURLToPath(import.meta.resolve(name));
  const child = relative(desktop, resolved);
  assert.ok(child.startsWith('node_modules/') && !isAbsolute(child), 'sdk_borrowed_from_repository');
  assert.equal((await readJson(join(dirname(dirname(resolved)), 'package.json'))).version, '1.0.4');
}
assert.equal(smoke.isolatedInstall, true);
assert.equal(smoke.smoke.fileOwnership, true);
assert.equal(smoke.smoke.controlledEdit, true);
assert.equal(smoke.suControls.results.length, 9);
assert.equal(smoke.readmeExample, true);
assert.ok(smoke.suWorkflow.includes('installed-cli-flow.json'));
const owned = new models.ProjectFileOwners({ projectId: 'dependency-fixture', version: '2', owners: [] });
const dispatch = { roleId: 'ProjectManager', taskId: 'dependency-fixture', organizationVersion: '2',
  fileOwnersDigest: owned.digest, ownerGeneration: owned.version, tools: [] };
new models.TaskDispatchContext(dispatch);
assert.throws(() => new models.TaskDispatchContext({ ...dispatch, writeSet: [] }), TypeError);
const evidence = { stage: 'runtime-package', tarball: smoke.tarball, sha256: smoke.sha256, integrity,
  runtimeVersion: published.version, installedSourceIdentity: true, sdkOrigin: 'desktop/node_modules',
  desktopWorkflow: 'not_executed: later integration stage', readmeExample: smoke.readmeExample };
await fs.writeFile(join(packaging, 'desktop-dependency-' + randomUUID() + '.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(evidence));
