import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { resolve, join, dirname, relative, sep, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { inflateRawSync, gunzipSync } from 'node:zlib';
import { spawn } from 'node:child_process';
import * as model from '../../src/models/desktop.mjs';
import * as wb from '../../src/models/workbench.mjs';
import { _validateIpcRequest, _dispatchDesktopIpc } from '../../src/interface/main.mjs';
import { createDesktopPipeline } from '../../src/pipelines/desktop.mjs';
import { createWorkspaceService } from '../../src/services/public/workspace.mjs';
import { createWorkspaceProvider } from '../../src/providers/public/workspace.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const desktop = join(project, 'apps/desktop');
const testRole = process.env.LEGION_DESKTOP_TEST_ROLE ?? 'Reviewer';
assert.ok(['DesktopEngineer', 'ProjectManager', 'Reviewer', 'Tester'].includes(testRole), 'unknown Desktop test role');
let roleDirectory = testRole;

const base = join(project, '.ans/runtime/legion-governed-workflow-v1', roleDirectory);
const fixtures = join(base, 'fixtures');
const userData = join(base, 'user-data');
const temporaryRoot = join(base, 'tmp');
const zipPath = join(project, '.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/packaging/LegionDesktop-0.2.0-win32-x64.zip');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
delete process.env.NODE_OPTIONS;
delete process.env.NODE_COMPILE_CACHE;
process.env.NODE_DISABLE_COMPILE_CACHE = '1';
process.env.TEMP = temporaryRoot;
process.env.TMP = temporaryRoot;

async function guard(path) {
  let current = resolve(path);
  for (;;) {
    const metadata = await fs.lstat(current);
    assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink(), 'unsafe Reviewer ancestor');
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
async function ensure(base) {
  await guard(project);
  let current = project;
  for (const part of relative(project, base).split(sep)) {
    current = join(current, part);
    try { await fs.mkdir(current); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    await guard(current);
  }
}
async function temporary(t, base = fixtures) {
  await ensure(base);
  await ensure(temporaryRoot);
  const directory = await fs.mkdtemp(join(base, 'review-'));
  t.after(async () => {
    const child = relative(base, directory);
    assert.ok(child.startsWith('review-') && !child.includes(sep) && !isAbsolute(child));
    await guard(directory);
    async function checkTree(path) {
      for (const entry of await fs.readdir(path, { withFileTypes: true })) {
        const target = join(path, entry.name);
        assert.ok(!(await fs.lstat(target)).isSymbolicLink(), 'unsafe Reviewer cleanup child');
        if (entry.isDirectory()) await checkTree(target);
      }
    }
    await checkTree(directory);
    await fs.rm(directory, { recursive: true });
  });
  return directory;
}
async function files(path) {
  const values = [];
  for (const entry of await fs.readdir(path, { withFileTypes: true })) {
    const target = join(path, entry.name);
    assert.ok(!entry.isSymbolicLink());
    if (entry.isDirectory()) values.push(...await files(target));
    else values.push(target);
  }
  return values.sort();
}
async function put(root, path, bytes) {
  const target = join(root, path);
  await fs.mkdir(dirname(target), { recursive: true });
  await fs.writeFile(target, bytes);
}
async function workspace(t) {
  const root = await temporary(t);
  const current = await fs.readFile(join(project, '.ans/organization/current.yaml'), 'utf8');
  const ids = [...current.matchAll(/\{id: ([A-Za-z0-9_.-]+)/gu)].map((item) => item[1]);
  assert.equal(ids.length, 7);
  const paths = ['.ans/project.yaml', '.ans/organization/current.yaml', '.ans/events/index.jsonl', '.ans/events/2026-10-07.jsonl'];
  for (const id of ids) for (const name of ['role.yaml', 'role-card.md', 'boundary.yaml', 'boundary.md']) paths.push(`.ans/roles/${id}/${name}`);
  for (const path of paths) await put(root, path, await fs.readFile(join(project, path)));
  return root;
}
const input = { name: 'Reviewer local', protocol: 'openai-completions', provider: 'local', modelId: 'custom-model', baseUrl: 'http://127.0.0.1:43210/v1', keyAction: 'keep' };

test('current desktop ownership and adjacent public edges; Model has no external effects', async () => {
  const ownershipBytes = await fs.readFile(join(project, '.ans/decisions/legion-desktop-workbench-v2-product-ownership.json'));
  assert.equal(hash(ownershipBytes), '87808cec2739fdbbc9520631637b4ddcb2adc2f8680a6e849ec8885d01a35187');
  const ownership = JSON.parse(ownershipBytes.toString('utf8'));
  const paths = await files(join(desktop, 'src'));
  assert.equal(paths.length, 44);
  const governed = JSON.parse(await fs.readFile(join(project, ".ans/decisions/handwell-pm-approved-project-shell-v1-project.json"), "utf8"));
  const currentBoundary = await fs.readFile(join(project, governed.roles.DesktopEngineer.boundary), "utf8");
  for (const path of paths) {
    const name = relative(project, path).replaceAll('\\', '/');
    if (ownership.files[name]) assert.equal(ownership.files[name].primaryOwner, 'DesktopEngineer', name);
    else {
      assert.ok(governed.roles.DesktopEngineer.writeFiles.includes(name), name);
      assert.ok(currentBoundary.split('\n').some((line) => line.startsWith('| 文件 |') && line.includes('`' + name + '`')), name);
    }
    if (!path.endsWith('.mjs') && !path.endsWith('.cjs')) continue;
    const text = await fs.readFile(path, 'utf8');
    assert.doesNotMatch(text, /src\/kernel|runtime\.mjs|PermissionRuntime|export\s+\*/);
    const imports = [...text.matchAll(/(?:\bfrom\s+|\bimport\s*\(|\brequire\s*\()["']([^"']+)["']/gu)].map((match) => match[1]);
    if (name.includes('/models/')) {
      assert.ok(imports.every((target) => target.startsWith('./') || target === 'legion-runtime/workbench-models' || (target === 'node:crypto' && /import\s*\{\s*createHash\s*\}/u.test(text))), name);
      assert.doesNotMatch(text, /Date\.now|new Date\(\)|Math\.random|randomUUID|process\.|fetch\(|node:(fs|os|path)|pi-ai|electron/);
    }
    if (name.includes('/services/') || name.includes('/providers/')) {
      for (const part of ['abstract', 'public', 'impl']) await fs.access(join(dirname(dirname(path)), part, path.split(sep).at(-1)));
    }
    for (const target of imports) {
      if (!target.startsWith('.')) {
        if (name.includes('/services/')) assert.equal(target, 'legion-runtime/workbench-models', name);
        if (name.includes('/pipelines/')) assert.ok(['legion-runtime/workbench-models', 'legion-runtime/services/policy', 'legion-runtime/services/mutation', 'legion-runtime/services/read', 'legion-runtime/services/check', 'legion-runtime/services/proposal', 'legion-runtime/services/pi-agent', 'legion-runtime/services/shell'].includes(target), name + ' external effect ' + target);
        continue;
      }
      const destination = relative(project, resolve(dirname(path), target)).replaceAll('\\', '/');
      await fs.access(resolve(dirname(path), target));
      if (name.includes('/interface/')) assert.match(destination, /\/(pipelines|models)\//);
      if (name.includes('/pipelines/')) assert.match(destination, /\/(services\/public|models)\//);
      if (name.includes('/services/impl/')) assert.match(destination, /\/(services\/abstract|providers\/public|models)\//);
      if (name.includes('/providers/impl/')) assert.match(destination, /\/(providers\/abstract|models)\//);
      if (name.includes('/abstract/')) assert.match(destination, /\/models\//);
      if (name.includes('/public/')) assert.match(destination, /\/(abstract|impl)\//);
    }
  }
  const root = await fs.readFile(join(desktop, 'main.mjs'), 'utf8');
  assert.match(root, /src\/interface\/main\.mjs/);
  assert.doesNotMatch(root, /src\/(pipelines|services|providers)|runtime\.mjs/);
});

test('IPC exact sender main frame URL and fields reject before any business call', async () => {
  const frame = { url: 'file:///legion/index.html' };
  const window = { isDestroyed: () => false, webContents: { mainFrame: frame } };
  const event = { sender: window.webContents, senderFrame: frame };
  let calls = 0;
  const pipeline = { getState: async () => { calls += 1; return wb.wbSuccess(wb.workbenchDTO({ profiles: [], assignments: [] })); } };
  assert.equal((await _dispatchDesktopIpc(event, window, frame.url, 'getState', {}, pipeline)).ok, true);
  assert.equal(calls, 1);
  for (const changed of [{ ...event, sender: {} }, { ...event, senderFrame: { url: frame.url } }, { ...event, senderFrame: null }]) {
    assert.equal((await _dispatchDesktopIpc(changed, window, frame.url, 'getState', {}, pipeline)).error.code, 'unauthorized_sender');
  }
  assert.equal(_validateIpcRequest(event, window, 'file:///other.html', 'getState', {}).error.code, 'unauthorized_sender');
  assert.equal(_validateIpcRequest(event, { ...window, isDestroyed: () => true }, frame.url, 'getState', {}).error.code, 'unauthorized_sender');
  for (const [operation, value, code] of [
    ['executeTask', {}, 'unknown_operation'], ['startAgent', {}, 'unknown_operation'],
    ['sendMessage', { projectId: 'a'.repeat(64), roleId: 'Worker', text: 'start' }, 'manager_only'], ['getState', { path: project }, 'invalid_input'],
    ['chooseProject', { path: project }, 'invalid_input'], ['assignProfile', { roleId: 'Reviewer', profileId: null, projectId: 'forged' }, 'invalid_input'],
    ['saveProfile', { ...input, keyAction: 'keep', apiKey: 'forged-key' }, 'invalid_input'],
    ['getState', [], 'invalid_input']
  ]) assert.equal((await _dispatchDesktopIpc(event, window, frame.url, operation, value, pipeline)).error.code, code);
  assert.equal(calls, 1);
});

test('safe immutable DTOs do not return stored secrets or raw errors', () => {
  const profile = model.profileDTO({ ...input, id: 'saved', keyCiphertext: 'c2VjcmV0', apiKey: 'never-roundtrip' });
  assert.deepEqual(Object.keys(profile).sort(), ['baseUrl', 'hasSavedKey', 'id', 'modelId', 'name', 'protocol', 'provider']);
  assert.equal(profile.hasSavedKey, true);
  const dto = model.desktopDTO({ profiles: [profile], assignments: [], workspace: model.emptyWorkspace(), probe: { status: 'failed', error: { code: 'raw-key-and-stack', message: 'never-roundtrip' } }, error: { code: 'raw-key-and-stack', field: 'private' } });
  assert.ok(!JSON.stringify(dto).includes('never-roundtrip') && !JSON.stringify(dto).includes('c2VjcmV0'));
  assert.equal(dto.error.code, 'internal_error');
  assert.equal(dto.probe.error.code, 'internal_error');
  assert.throws(() => dto.profiles.push(profile), TypeError);
  assert.throws(() => { dto.profiles[0].hasSavedKey = false; }, TypeError);
  assert.equal(model.operationInput('saveProfile', { ...input, keyAction: 'clear', apiKey: 'secret' }).ok, false);
  assert.equal(model.operationInput('saveProfile', { ...input, keyAction: 'replace' }).ok, false);
  assert.equal(model.operationInput('saveProfile', { ...input, baseUrl: 'http://example.com/v1' }).ok, false);
});

test('real current workspace preserves source bounds and authentic task records without liveness or tokens', async () => {
  const provider = createWorkspaceProvider({ workspaceRoot: project });
  const result = await provider.read();
  assert.equal(result.ok, true);
  assert.equal(result.value.roles.length, 7);
  assert.equal(result.value.organization.version, 'v004');
  const oversized = [];
  for (const name of await fs.readdir(join(project, 'docs/scheduling'))) {
    if (name.endsWith('.md') && (await fs.stat(join(project, 'docs/scheduling', name))).size > wb.WB_LIMITS.taskDocumentBytes) oversized.push('docs/scheduling/' + name);
  }
  assert.deepEqual(result.value.sources.filter((item) => item.kind === 'task' && item.status === 'unavailable').map((item) => item.relativePath).sort(), oversized.sort());
  assert.equal(result.value.errors.length, oversized.length);
  assert.ok(result.value.sources.every((item) => item.readAt));
  assert.ok(result.value.sources.filter((item) => item.status === 'available').every((item) => item.modifiedAt));
  const taskText = await fs.readFile(join(project, 'docs/scheduling/legion-node-fixture-compat-v1.md'), 'utf8');
  const events = taskText.split('<!-- ANS-TASK-EVENTS-V1\n')[1].split('\nANS-TASK-EVENTS-END')[0].split('\n').map(JSON.parse);
  for (const node of events.at(-1).after.state.nodes) assert.equal(result.value.tasks.find((item) => item.taskId === 'legion-node-fixture-compat-v1' && item.nodeId === node.nodeId).status, node.status);
  const text = JSON.stringify(result.value);
  for (const forbidden of ['tokenHash', 'coordinatorTokenHash', 'argv', 'raw', 'prompt', 'apiKey', 'online']) assert.ok(!text.includes('"' + forbidden + '"'));
  assert.ok(result.value.audits.every((item) => item.format === 'governance'));
});

test('owned workspace tamper traversal mirror and version errors are explicit; stale snapshot keeps time', async (t) => {
  const root = await workspace(t);
  const task = 'docs/scheduling/legion-node-fixture-compat-v1.md';
  const taskText = await fs.readFile(join(project, task), 'utf8');
  assert.ok(taskText.includes('| ownership-regression | Reviewer | verified |'));
  await put(root, task, taskText);
  const service = createWorkspaceService({ workspaceRoot: root });
  t.after(() => service.close());
  const accepted = await service.refresh();
  assert.equal(accepted.value.status, 'available');
  assert.equal(accepted.value.tasks.find((item) => item.nodeId === 'ownership-regression').status, 'verified');
  // A matching Markdown row alone must not authorize an unapproved boundary revision or scope.
  const boundaryYamlPath = '.ans/roles/ProjectManager/boundary.yaml';
  const boundaryMarkdownPath = '.ans/roles/ProjectManager/boundary.md';
  const approvedYaml = await fs.readFile(join(root, boundaryYamlPath), 'utf8');
  const approvedMarkdown = await fs.readFile(join(root, boundaryMarkdownPath), 'utf8');
  const approvedVersion = approvedYaml.match(/^version: (.+)$/mu)[1]; assert.equal(approvedVersion, 'legion-governed-workflow-v1');
  for (const [changedYaml, changedMarkdown] of [
    [approvedYaml.replace('version: ' + approvedVersion, 'version: unapproved-future'), approvedMarkdown],
    [approvedYaml.replace('write_scope: [', 'write_scope: ["src/unapproved.mjs",'), approvedMarkdown + '\n| 文件 | `src/unapproved.mjs` | forged matching scope |\n']
  ]) {
    await put(root, boundaryYamlPath, changedYaml); await put(root, boundaryMarkdownPath, changedMarkdown);
    const rejected = await service.refresh({ force: true });
    assert.equal(rejected.value.status, 'unavailable');
    assert.ok(rejected.value.sources.some((item) => item.relativePath === boundaryMarkdownPath && item.status === 'unavailable'));
    await put(root, boundaryYamlPath, approvedYaml); await put(root, boundaryMarkdownPath, approvedMarkdown);
    const restored = await service.refresh({ force: true });
    assert.equal(restored.value.status, 'available');
    assert.equal(restored.value.roles.length, 7);
  }
  for (const changed of [taskText.replace('| ownership-regression | Reviewer | verified |', '| ownership-regression | Reviewer | running |'), taskText.replace('ANS-TASK-EVENTS-END', 'BROKEN-END')]) {
    await put(root, task, changed);
    const result = await service.refresh();
    assert.equal(result.value.tasks.length, 0);
    assert.ok(result.value.sources.some((item) => item.relativePath === task && item.status === 'unavailable'));
  }
  await put(root, task, taskText);
  const event = { sequence: 1, kind: 'agent_run_completed', roleId: 'DesktopEngineer', taskId: 'gui-task', organizationVersion: 'v004', resource: '', proposalDigest: '', correlationId: '', outcome: '', reason: '', observedMutation: false, recordedAt: '2026-10-07T11:00:00+08:00' };
  async function mirrored(value) {
    const line = JSON.stringify(value) + '\n';
    await put(root, '.ans/events/index.jsonl', line);
    await put(root, '.ans/events/2026-10-07.jsonl', line);
  }
  await mirrored(event);
  assert.equal((await service.refresh()).value.audits[0].status, 'completed');
  for (const changed of [{ ...event, organizationVersion: 'v999' }, { ...event, kind: 'unknown_event' }]) {
    await mirrored(changed);
    assert.equal((await service.refresh()).value.audits[0].status, 'unavailable');
  }
  await mirrored(event);
  await put(root, '.ans/events/2026-10-07.jsonl', JSON.stringify({ ...event, kind: 'agent_run_failed' }) + '\n');
  assert.ok((await service.refresh()).value.errors.length > 0);
  await put(root, '.ans/events/index.jsonl', JSON.stringify({ event_id: 'outside', line: 1, file: '../outside.jsonl', sequence: 1 }) + '\n');
  assert.ok((await service.refresh()).value.sources.some((item) => item.error?.code === 'unsafe_path'));
  await mirrored(event);
  const valid = (await service.refresh()).value;
  const organizationPath = '.ans/organization/current.yaml';
  const original = await fs.readFile(join(root, organizationPath), 'utf8');
  await put(root, organizationPath, original.replace('version: v004', 'version: v999'));
  const stale = (await service.refresh()).value;
  assert.equal(stale.status, 'unavailable');
  assert.equal(stale.lastValidAt, valid.observedAt);
  assert.equal(stale.roles.length, 7);
  assert.ok(stale.errors.length > 0 && stale.observedAt);
});

test('real public Pipeline only saves desktop metadata; missing key and repeated close fail honestly', async (t) => {
  const directory = await temporary(t, userData);
  const pipeline = createDesktopPipeline({ userDataDir: directory });
  t.after(() => pipeline.close());
  const saved = await pipeline.saveProfile(input);
  assert.equal(saved.ok, true);
  const profile = saved.value.profiles[0];
  assert.equal(profile.hasSavedKey, false);
  assert.equal((await pipeline.testConnection({ profileId: profile.id })).error.code, 'key_required');
  assert.equal((await pipeline.assignProfile({ roleId: 'Reviewer', profileId: profile.id })).error.code, 'workspace_unavailable');
  assert.equal((await pipeline.deleteProfile({ id: profile.id })).value.profiles.length, 0);
  assert.equal((await pipeline.close()).ok, true);
  assert.equal((await pipeline.close()).ok, true);
  assert.equal((await pipeline.saveProfile(input)).error.code, 'closed');
  const text = await fs.readFile(join(directory, 'desktop-settings.json'), 'utf8');
  assert.deepEqual(JSON.parse(text), { schemaVersion: 1, profiles: [], assignments: [] });
});

test('real Electron window sandbox saved key protection and Interface repeat-close/restart', { timeout: 60000, skip: !['win32', 'darwin'].includes(process.platform) }, async (t) => {
  const directory = await temporary(t);
  const settings = await temporary(t, userData);
  const entry = join(directory, 'electron-review.mjs');
  const interfaceUrl = pathToFileURL(join(desktop, 'src/interface/main.mjs')).href;
  const profilesUrl = pathToFileURL(join(desktop, 'src/services/public/profiles.mjs')).href;
  const settingsUrl = pathToFileURL(join(desktop, 'src/providers/public/settings.mjs')).href;
  await fs.writeFile(entry, `import assert from 'node:assert/strict';
import {app,BrowserWindow,safeStorage} from 'electron';
import {readFile,writeFile} from 'node:fs/promises';
import {startDesktop} from ${JSON.stringify(interfaceUrl)};
import {createProfilesService} from ${JSON.stringify(profilesUrl)};
import {createSettingsProvider} from ${JSON.stringify(settingsUrl)};
async function run(){
 app.on('window-all-closed',()=>{});
 const options={userDataDir:${JSON.stringify(settings)},initialWorkspace:${JSON.stringify(project)},show:false};
 const first=await startDesktop(options);
 assert.equal(safeStorage.isEncryptionAvailable(),true);
 const profiles=createProfilesService({userDataDir:options.userDataDir});
 const secret='reviewer-local-placeholder';
 const saved=await profiles.save({...${JSON.stringify(input)},keyAction:'replace',apiKey:secret});
 assert.equal(saved.ok,true); assert.equal(saved.value.hasSavedKey,true);
 assert.ok(!JSON.stringify(saved).includes(secret));
 const stored=JSON.parse(await readFile(options.userDataDir+'/desktop-settings.json','utf8'));
 assert.ok(!JSON.stringify(stored).includes(secret));
 const decrypted=await createSettingsProvider({userDataDir:options.userDataDir}).decryptKey(stored.profiles[0].keyCiphertext);
 assert.ok(decrypted.ok&&decrypted.value===secret,${JSON.stringify(process.platform === 'win32' ? 'real main-process Windows DPAPI roundtrip' : 'real main-process macOS safeStorage roundtrip')});
 const window=BrowserWindow.fromId(first.readiness.windowId);
 const proof=await window.webContents.executeJavaScript('({process:typeof process,require:typeof require,api:Object.keys(window.legionDesktop).sort(),pages:document.querySelectorAll("[data-page]").length})');
 assert.equal(proof.process,'undefined'); assert.equal(proof.require,'undefined'); assert.equal(proof.pages,2);
 assert.deepEqual(proof.api,${JSON.stringify([...wb.WB_OPERATIONS].sort())});
 const state=await window.webContents.executeJavaScript('window.legionDesktop.getState()');
 assert.equal(state.ok,true); assert.equal(state.value.profiles[0].hasSavedKey,true); assert.ok(!JSON.stringify(state).includes(secret));
 const denied=await window.webContents.executeJavaScript('window.legionDesktop.assignProfile({roleId:"Reviewer",profileId:null,projectId:"forged"})');
 assert.equal(denied.error.code,'invalid_input');
 assert.equal((await window.webContents.executeJavaScript('window.legionDesktop.testConnection({profileId:"missing"})')).error.code,'not_found');
 profiles.close();
 const closed=await first.close(); assert.equal(closed.closed,true); assert.equal(await first.close(),closed); assert.equal(window.isDestroyed(),true);
 const second=await startDesktop(options); assert.equal(second.readiness.ready,true); assert.equal((await second.close()).closed,true);
 await writeFile(${JSON.stringify(join(directory, 'native-proof.json'))},JSON.stringify({sandbox:true,DPAPI:${process.platform === 'win32'},macOSSafeStorage:${process.platform === 'darwin'},savedKeyDTO:true,pages:2,repeatedClose:true,windowRestart:true}));
 app.exit(0);
}
void run().catch(()=>{console.error('Reviewer native boundary failed');app.exit(1);});
`, 'utf8');
  const environment = { ...process.env, TEMP: temporaryRoot, TMP: temporaryRoot, NODE_DISABLE_COMPILE_CACHE: '1' };
  delete environment.ELECTRON_RUN_AS_NODE;
  delete environment.NODE_OPTIONS;
  delete environment.NODE_COMPILE_CACHE;
  const electronBinary = process.platform === 'win32'
    ? join(desktop, 'node_modules/electron/dist/electron.exe')
    : join(desktop, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
  await fs.access(electronBinary);
  const child = spawn(electronBinary, [entry], { cwd: desktop, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  const timer = setTimeout(() => child.kill(), 50000);
  const result = await new Promise((resolveResult, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolveResult({ code, signal }));
  }).finally(() => clearTimeout(timer));
  assert.equal(result.code, 0, output.slice(-2000));
  assert.equal(result.signal, null);
  const proof = JSON.parse(await fs.readFile(join(directory, 'native-proof.json'), 'utf8'));
  assert.deepEqual(proof, { sandbox: true, DPAPI: process.platform === 'win32',
    macOSSafeStorage: process.platform === 'darwin', savedKeyDTO: true, pages: 2,
    repeatedClose: true, windowRestart: true });
  const evidenceRoot = join(project, '.ans/runtime/handwell-pm-approved-project-shell-v1/Reviewer/evidence'); await ensure(evidenceRoot); const proofDirectory = await fs.mkdtemp(join(evidenceRoot, 'native-boundary-')); await fs.writeFile(join(proofDirectory, 'native-boundary.json'), JSON.stringify({ ...proof, exitCode: result.code, paidCalls: 0 }) + '\n');
});

let legacyCaseName = 'Windows ZIP historical byte and source snapshot assertions'; if (process.platform !== 'win32') legacyCaseName = 'legacy 0.7.0 runtime archive has exact historical bytes; missing Windows ZIP is not verified';
test(legacyCaseName, async () => {
  if (process.platform !== 'win32') {
    const packaging = join(project, '.ans/runtime/legion-governed-workflow-v1/ProjectManager/packaging/role-context-20261009');
    const descriptor = JSON.parse(await fs.readFile(join(packaging, 'package-smoke.json'), 'utf8')); const bytes = await fs.readFile(join(packaging, 'legion-runtime-0.7.0.tgz'));
    assert.equal(descriptor.sha256, 'f45fa15e8c0f195930c35c782904690ce7073680df1e4ec0d0ea6e80215bbad7'); assert.equal(hash(bytes), descriptor.sha256); assert.equal(descriptor.integrity, 'sha512-' + createHash('sha512').update(bytes).digest('base64'));
    const archive = gunzipSync(bytes); const entries = new Map();
    for (let offset=0; offset+512<=archive.length;) { const header=archive.subarray(offset,offset+512); if(header.every(value=>value===0)) break; const name=header.subarray(0,100).toString().split('\0')[0]; const prefix=header.subarray(345,500).toString().split('\0')[0]; const size=parseInt(header.subarray(124,136).toString().replaceAll('\0','').trim(),8); const path=[prefix,name].filter(Boolean).join('/'); assert.equal(header[156],48); assert.ok(path.startsWith('package/')); assert.equal(entries.has(path.slice(8)),false); entries.set(path.slice(8),archive.subarray(offset+512,offset+512+size)); offset+=512+Math.ceil(size/512)*512; }
    assert.equal(entries.size,39); assert.equal(Object.keys(descriptor.sourceHashes).length,37); assert.deepEqual([...entries.keys()].filter(name=>name!=='package.json'&&name!=='README.md').sort(),Object.keys(descriptor.sourceHashes).sort());
    for(const [name,sha] of Object.entries(descriptor.sourceHashes)) assert.equal(hash(entries.get(name)),sha,name); assert.equal(JSON.parse(entries.get('package.json').toString()).version,'0.7.0');
    console.log('Historical 0.7.0 TGZ verified; Windows ZIP descriptor/body and GUI unavailable on this macOS host, not executed.'); return;
  }
  const descriptor = JSON.parse(await fs.readFile(join(dirname(zipPath), 'desktop-package.json'), 'utf8'));
  assert.equal(resolve(descriptor.zip.path), zipPath);
  assert.ok(Number.isSafeInteger(descriptor.zip.bytes) && descriptor.zip.bytes > 0);
  assert.match(descriptor.zip.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(descriptor.runtime.piAi, '1.0.4');
  assert.equal(descriptor.runtime.piSdk, '1.0.4');
  assert.equal(descriptor.runtime.runtime, '0.7.0');
  assert.deepEqual(descriptor.productionDependency, { '@earendil-works/pi-ai': '1.0.4', 'legion-runtime': 'file:../../.ans/runtime/legion-governed-workflow-v1/ProjectManager/packaging/legion-runtime-0.7.0.tgz' });
  const bytes = await fs.readFile(zipPath);
  assert.equal(bytes.length, descriptor.zip.bytes);
  assert.equal(hash(bytes), descriptor.zip.sha256);
  let end = bytes.length - 22;
  while (end >= bytes.length - 65557 && bytes.readUInt32LE(end) !== 0x06054b50) end -= 1;
  assert.ok(end >= bytes.length - 65557);
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  const entries = new Map();
  for (let index = 0; index < count; index += 1) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8').replaceAll('\\', '/');
    assert.ok(!entries.has(name), name);
    entries.set(name, { method: bytes.readUInt16LE(offset + 10), compressed: bytes.readUInt32LE(offset + 20), size: bytes.readUInt32LE(offset + 24), offset: bytes.readUInt32LE(offset + 42) });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  const sourceFiles = ['main.mjs', 'README.md', 'package.json', ...await files(join(desktop, 'src')).then((values) => values.map((path) => relative(desktop, path).replaceAll('\\', '/')))];
  assert.equal(sourceFiles.length, 47);
  for (const name of sourceFiles) {
    const matches = [...entries.keys()].filter((path) => path.endsWith('/resources/app/' + name) || path === 'resources/app/' + name);
    assert.equal(matches.length, 1, name);
    const entry = entries.get(matches[0]);
    assert.equal(bytes.readUInt32LE(entry.offset), 0x04034b50);
    const start = entry.offset + 30 + bytes.readUInt16LE(entry.offset + 26) + bytes.readUInt16LE(entry.offset + 28);
    const compressed = bytes.subarray(start, start + entry.compressed);
    let content = compressed;
    if (entry.method === 8) content = inflateRawSync(compressed);
    else assert.equal(entry.method, 0);
    assert.equal(content.length, entry.size);
    const source = await fs.readFile(join(desktop, name));
    if (name === 'package.json') {
      const manifest = JSON.parse(source.toString('utf8'));
      const shipped = JSON.parse(content.toString('utf8'));
      assert.equal(manifest.version, '0.2.0');
      assert.deepEqual(manifest.dependencies, descriptor.productionDependency);
      const { scripts, devDependencies, private: privatePackage, ...expectedManifest } = manifest;
      expectedManifest.config = { ...manifest.config };
      delete expectedManifest.config.forge;
      assert.deepEqual(shipped, expectedManifest, 'exact installed Forge production manifest transform');
    } else assert.equal(hash(content), hash(source), name);
  }
  const nodeFiles = ['package.json', 'README.md', 'runtime.mjs', 'workbench.mjs', 'bin/legion.mjs',
    ...await files(join(project, 'src')).then((paths) => paths.filter((path) => path.endsWith('.mjs')).map((path) => relative(project, path).replaceAll('\\', '/')))];
  assert.equal(nodeFiles.length, 39);
  for (const name of nodeFiles) {
    const matches = [...entries.keys()].filter((path) => path.endsWith('/resources/app/node_modules/legion-runtime/' + name) || path === 'resources/app/node_modules/legion-runtime/' + name);
    assert.equal(matches.length, 1, 'embedded Core ' + name);
    const entry = entries.get(matches[0]);
    assert.equal(bytes.readUInt32LE(entry.offset), 0x04034b50);
    const start = entry.offset + 30 + bytes.readUInt16LE(entry.offset + 26) + bytes.readUInt16LE(entry.offset + 28);
    let content = bytes.subarray(start, start + entry.compressed);
    if (entry.method === 8) content = inflateRawSync(content);
    else assert.equal(entry.method, 0);
    assert.equal(content.length, entry.size);
    assert.equal(hash(content), hash(await fs.readFile(join(project, name))), 'embedded Core exact bytes ' + name);
  }
  assert.ok([...entries.keys()].some((path) => /(?:^|\/)LegionDesktop\.exe$/u.test(path)));
  assert.ok(![...entries.keys()].some((path) => /\/resources\/app\/(tests|\.ans|scripts)\//u.test(path)));
});

test('macOS installed runtime matches current 0.8.2 package and every shipped source byte', { skip: process.platform !== 'darwin' }, async () => {
  const installed = join(desktop, 'node_modules/legion-runtime');
  const metadata = await fs.lstat(installed);
  assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink());
  const manifest = JSON.parse(await fs.readFile(join(desktop, 'package.json'), 'utf8'));
  const lock = JSON.parse(await fs.readFile(join(desktop, 'package-lock.json'), 'utf8'));
  const dependency = 'file:../../.ans/runtime/handwell-pm-approved-project-shell-v1/ProjectManager/packaging/bridge-v3/legion-runtime-0.8.2.tgz';
  assert.equal(manifest.dependencies['legion-runtime'], dependency);
  assert.equal(lock.packages[''].dependencies['legion-runtime'], dependency);
  assert.equal(lock.packages['node_modules/legion-runtime'].version, '0.8.2');
  assert.equal(lock.packages['node_modules/legion-runtime'].resolved, dependency);
  const tarballPath = resolve(desktop, dependency.slice(5));
  const descriptor = JSON.parse(await fs.readFile(join(dirname(tarballPath), 'package-smoke.json'), 'utf8'));
  const tarball = await fs.readFile(tarballPath);
  assert.equal(resolve(descriptor.tarball), tarballPath);
  assert.equal(descriptor.sha256, '1a2a7c483f04f2bb939d6bf4d25aa7a4318bc866a473dcac251f74d1ee592622');
  assert.equal(hash(tarball), descriptor.sha256);
  const integrity = 'sha512-' + createHash('sha512').update(tarball).digest('base64');
  assert.equal(descriptor.integrity, integrity);
  assert.equal(lock.packages['node_modules/legion-runtime'].integrity, integrity);
  const packageFiles = ['package.json', 'README.md', 'runtime.mjs', 'workbench.mjs', 'bin/legion.mjs',
    ...await files(join(project, 'src')).then((paths) => paths.filter((path) => path.endsWith('.mjs'))
      .map((path) => relative(project, path).replaceAll('\\', '/')))];
  assert.equal(packageFiles.length, 46);
  assert.deepEqual((await files(installed)).map((path) => relative(installed, path).replaceAll('\\', '/')).sort(),
    packageFiles.sort());
  const sourceNames = packageFiles.filter((name) => !['package.json', 'README.md'].includes(name));
  assert.equal(sourceNames.length, 44); assert.deepEqual(Object.keys(descriptor.sourceHashes).sort(), sourceNames);
  for (const name of packageFiles) {
    assert.equal(hash(await fs.readFile(join(installed, name))), hash(await fs.readFile(join(project, name))), name);
    if (Object.hasOwn(descriptor.sourceHashes, name)) assert.equal(hash(await fs.readFile(join(installed, name))), descriptor.sourceHashes[name], 'pinned installed source ' + name);
  }
  const installedManifest = JSON.parse(await fs.readFile(join(installed, 'package.json'), 'utf8'));
  assert.equal(installedManifest.version, '0.8.2');
  assert.deepEqual(installedManifest.exports, {
    '.': './runtime.mjs', './workbench-models': './workbench.mjs',
    './services/policy': './src/kernel/services/public/policy.mjs',
    './services/mutation': './src/kernel/services/public/mutation.mjs',
    './services/read': './src/kernel/services/public/read.mjs',
    './services/check': './src/kernel/services/public/check.mjs',
    './services/proposal': './src/adapters/services/public/proposal.mjs',
    './services/pi-agent': './src/adapters/services/public/pi_agent.mjs',
    './services/shell': './src/kernel/services/public/shell.mjs'
  });
  assert.deepEqual(Object.keys(await import('legion-runtime/services/read')).sort(),
    ['ReadService', 'createReadService']);
});
