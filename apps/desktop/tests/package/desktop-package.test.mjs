import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, lstat, readlink, copyFile, rm, stat } from 'node:fs/promises';
import { dirname, join, resolve, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { _electron } from 'playwright';
import * as entry from '../../main.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const desktop = join(root, 'apps/desktop');
const role = process.env.LEGION_DESKTOP_TEST_ROLE ?? 'ProjectManager';
assert.ok(['ProjectManager', 'Reviewer', 'Tester'].includes(role), 'unknown_desktop_test_role');
const generated = join(root, '.ans/runtime/legion-cli-role-owned-v2', role);
const packaging = join(generated, 'packaging', 'su-frontdoor-memory-repair-v1');
const fixtures = join(generated, 'fixtures', 'su-frontdoor-memory-repair-v1');
const userDataRoot = join(generated, 'user-data', 'su-frontdoor-memory-repair-v1');
const temporary = join(generated, 'tmp', 'su-frontdoor-memory-repair-v1');
const npm = 'D:/soft/nodejs/node_modules/npm/bin/npm-cli.js';
const stableZip = join(packaging, 'LegionDesktop-0.2.0-win32-x64.zip');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const protocols = ['openai-completions', 'openai-responses', 'anthropic-messages'];
const readTools = ['legion_list_files', 'legion_read_file'].sort();
const workerTools = ['legion_write_file', 'legion_edit_file', ...readTools].sort();
const operations = ['getState', 'chooseProject', 'refreshProject', 'setDefaultProfile', 'saveProfile',
  'deleteProfile', 'assignProfile', 'sendMessage', 'selectContext', 'confirmPlan', 'cancelTurn',
  'stopExecution', 'testConnection', 'cancelProbe'].sort();

async function files(directory, prefix = '') {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const name = prefix + item.name;
    assert.equal(item.isSymbolicLink(), false, 'unexpected_link:' + name);
    if (item.isDirectory()) result.push(...await files(join(directory, item.name), name + '/'));
    else { assert.ok(item.isFile(), 'unexpected_entry:' + name); result.push(name); }
  }
  return result.sort();
}

async function currentPackageSmoke() {
  const descriptor = join(root, '.ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/su-frontdoor-memory-repair-v1/package-smoke.json');
  try { return JSON.parse(await readFile(descriptor, 'utf8')); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    assert.equal(role, 'ProjectManager', 'only the package owner prepares the missing bridge descriptor');
    const { buildPackageEvidence } = await import('../../../../tests/package/test_package.mjs');
    await buildPackageEvidence();
    return JSON.parse(await readFile(descriptor, 'utf8'));
  }
}

async function snapshot() {
  const packageEvidence = JSON.parse(await readFile(join(root,
    '.ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/su-frontdoor-memory-repair-v1/package-smoke.json'), 'utf8'));
  const hashes = {};
  const paths = Object.keys(packageEvidence.sourceHashes);
  paths.push('.ans/runtime/legion-governed-workflow-v1/ProjectManager/packaging/legion-runtime-0.7.0.tgz', '.ans/runtime/legion-governed-workflow-v1/ProjectManager/packaging/package-smoke.json');
  paths.push(relative(root, packageEvidence.tarball).split(sep).join('/'));
  const previousTarballs = [
    ['.ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/legion-runtime-0.4.0.tgz',
      'f3114a19205b69542c5629cfbb4a2664e9aebc62fc81f76a69d332e6f922140c'],
    ['.ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/legion-runtime-0.5.0.tgz',
      '9fe38c708833d261ee3f3d7b25e7d66c19f6a4978039d1d8a38e7a31b69350da']];
  for (const [path] of previousTarballs) paths.push(path);
  const historical = {};
  const links = {};
  const absent = [];
  async function visit(path) {
    for (const item of await readdir(join(root, path), { withFileTypes: true })) {
      const child = path + '/' + item.name;
      if (item.isSymbolicLink()) links[child] = await readlink(join(root, child));
      else if (item.isDirectory()) await visit(child);
      else { assert.ok(item.isFile()); historical[child] = sha(await readFile(join(root, child))); }
    }
  }
  for (const path of ['.ans/runtime/legion-pi-node-v3', '.ans/runtime/legion-desktop-gui-v1', '.ans/runtime/legion-node-fixture-compat-v1']) {
    try { await visit(path); }
    catch (error) { if (error.code === 'ENOENT') absent.push(path); else throw error; }
  }
  for (const path of [...new Set(paths)].sort()) hashes[path] = sha(await readFile(join(root, path)));
  for (const [path, expected] of Object.entries(packageEvidence.sourceHashes)) assert.equal(hashes[path], expected, 'runtime_source:' + path);
  assert.equal(hashes[relative(root, packageEvidence.tarball).split(sep).join('/')], packageEvidence.sha256);
  for (const [path, digest] of previousTarballs) assert.equal(hashes[path], digest);
  const protectedBaseline = JSON.parse(await readFile(join(root, '.ans/decisions/legion-desktop-workbench-v2-protected-baseline.json'), 'utf8'));
  for (const [path, item] of Object.entries(protectedBaseline.protected)) {
    try { hashes[path] = sha(await readFile(join(root, path))); assert.equal(hashes[path], item.sha256, path); }
    catch (error) { if (error.code === 'ENOENT') absent.push(path); else throw error; }
  }
  return { hashes, historical, links, absent: [...new Set(absent)].sort(),
    sourceAggregate: packageEvidence.sourceAggregateSha256 };
}

async function guardedRemove(target, base) {
  target = resolve(target); base = resolve(base);
  const child = relative(base, target);
  assert.ok(child && !child.startsWith('..' + sep) && child !== '..' && !isAbsolute(child), 'cleanup containment');
  const scope = relative(generated, target);
  assert.ok(scope && !scope.startsWith('..' + sep) && scope !== '..' && !isAbsolute(scope));
  let cursor = root;
  for (const component of relative(root, target).split(sep)) {
    cursor = join(cursor, component);
    const info = await lstat(cursor);
    assert.equal(info.isSymbolicLink(), false, 'cleanup ancestor link'); assert.ok(info.isDirectory());
  }
  await rm(target, { recursive: true, force: true, maxRetries: 3, retryDelay: 150 });
}

function environment(extra = {}) {
  const env = { ...process.env, ...extra, LEGION_DESKTOP_TEST_ROLE: role, TEMP: temporary, TMP: temporary,
    npm_config_cache: join(generated, 'npm-cache', 'su-frontdoor-memory-repair-v1'), npm_config_ignore_scripts: 'true',
    npm_config_audit: 'false', npm_config_fund: 'false', npm_config_offline: 'true',
    NODE_DISABLE_COMPILE_CACHE: '1', ELECTRON_DISABLE_SECURITY_WARNINGS: 'false' };
  for (const key of ['NODE_OPTIONS', 'NODE_COMPILE_CACHE', 'NODE_PATH', 'ELECTRON_RUN_AS_NODE',
    'ELECTRON_OVERRIDE_DIST_PATH', 'ELECTRON_MIRROR', 'ELECTRON_CUSTOM_DIR', 'ELECTRON_CUSTOM_FILENAME']) delete env[key];
  return env;
}
function command(executable, argv, options = {}) {
  const result = spawnSync(executable, argv, { cwd: root, env: environment(), encoding: 'utf8', windowsHide: true,
    timeout: 180000, maxBuffer: 8 * 1024 * 1024, ...options });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stdout + '\n' + result.stderr); return result;
}
const quoted = value => "'" + value.replaceAll("'", "''") + "'";
async function chooseNativeProject(electron, page, workspace) {
  const mainPid = await electron.evaluate(() => process.pid);
  await page.locator('#choose-project').click();
  // Actual Win32 Folder Edit1152 and SelectFolder Button1; every handle belongs to this main PID.
  // This picker exposes no UIA action patterns, so use its native controls after UIA identifies it.
  const script = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new();
    Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes;
    Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public static class NativeChooser {[DllImport("user32.dll")]public static extern IntPtr GetDlgItem(IntPtr w,int id);[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr w,out uint p);[DllImport("user32.dll",CharSet=CharSet.Unicode,EntryPoint="SendMessageW")]public static extern IntPtr SetText(IntPtr w,uint m,IntPtr p,string text);[DllImport("user32.dll",EntryPoint="SendMessageW")]public static extern IntPtr Click(IntPtr w,uint m,IntPtr p,IntPtr text);}';
    Start-Sleep -Milliseconds 300;
    $condition=New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ProcessIdProperty,${mainPid});
    $items=[Windows.Automation.AutomationElement]::RootElement.FindAll([Windows.Automation.TreeScope]::Descendants,$condition);
    $dialog=$null; foreach($item in $items){if($item.Current.Name -eq '选择客户项目文件夹' -and $item.Current.ControlType -eq [Windows.Automation.ControlType]::Window){$dialog=$item;break}}
    if($null -eq $dialog){throw 'tracked_native_dialog_not_found'}
    $handle=[IntPtr]$dialog.Current.NativeWindowHandle;
    $edit=[NativeChooser]::GetDlgItem($handle,1152); $button=[NativeChooser]::GetDlgItem($handle,1);
    if($edit -eq [IntPtr]::Zero -or $button -eq [IntPtr]::Zero){throw 'native_folder_controls_missing'}
    foreach($control in @($handle,$edit,$button)){$owner=0;[void][NativeChooser]::GetWindowThreadProcessId($control,[ref]$owner);if($owner -ne ${mainPid}){throw 'native_control_owner_mismatch'}}
    $result=[NativeChooser]::SetText($edit,12,[IntPtr]::Zero,${quoted(workspace)});
    if($result -eq [IntPtr]::Zero){throw 'native_set_folder_failed'}
    [void][NativeChooser]::Click($button,245,[IntPtr]::Zero,[IntPtr]::Zero);`;
  command('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 12000 });
}
async function state(page) { const result = await page.evaluate(() => window.legionDesktop.getState()); assert.equal(result.ok, true, result.error?.code); return result.value; }
async function waitState(page, predicate, label) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const value = await state(page); if (predicate(value)) return value;
    await new Promise(accept => setTimeout(accept, 100));
  }
  const value = await state(page);
  const notice = await page.locator('#notice').textContent();
  assert.fail(label + ': ' + JSON.stringify({ turn: value.turn?.status, error: value.error, notice, plan: value.plan?.status, tasks: value.tasks }));
}
async function theme(page, desired) {
  const current = await page.evaluate(() => {
    if (document.documentElement.dataset.theme) return document.documentElement.dataset.theme;
    if (matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  });
  if (current !== desired) await page.locator('#theme-toggle').click();
}
async function capture(page, name, screenshots) {
  const path = join(packaging, 'desktop-package-' + name + '.png');
  await page.screenshot({ path, fullPage: true }); screenshots.push(path);
  console.log('NATIVE_ZIP_SCREENSHOT ' + path);
}
function completion(text, model, tool = null, toolName = 'legion_write_file') {
  let delta = { role: 'assistant', content: text };
  let finish = 'stop';
  if (tool) { delta = { role: 'assistant', tool_calls: [{ index: 0, id: 'fixture-' + toolName, type: 'function',
    function: { name: toolName, arguments: JSON.stringify(tool) } }] }; finish = 'tool_calls'; }
  const first = { id: 'chat1', object: 'chat.completion.chunk', created: 1, model, choices: [{ index: 0, delta, finish_reason: null }] };
  const last = { ...first, choices: [{ index: 0, delta: {}, finish_reason: finish }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
  return 'data: ' + JSON.stringify(first) + '\n\ndata: ' + JSON.stringify(last) + '\n\ndata: [DONE]\n\n';
}
function sse(protocol, text, model) {
  if (protocol === 'openai-completions') return completion(text, model);
  const events = [];
  if (protocol === 'anthropic-messages') {
    events.push({ type: 'message_start', message: { id: 'msg1', type: 'message', role: 'assistant', model,
      content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
      { type: 'content_block_stop', index: 0 },
      { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } },
      { type: 'message_stop' });
  } else {
    const item = { id: 'item1', type: 'message', role: 'assistant', status: 'in_progress', content: [] };
    const content = { type: 'output_text', text, annotations: [] };
    const response = { id: 'resp1', object: 'response', created_at: 1, model, status: 'in_progress', output: [] };
    events.push({ type: 'response.created', response }, { type: 'response.output_item.added', output_index: 0, item },
      { type: 'response.content_part.added', item_id: 'item1', output_index: 0, content_index: 0, part: { ...content, text: '' } },
      { type: 'response.output_text.delta', item_id: 'item1', output_index: 0, content_index: 0, delta: text },
      { type: 'response.output_text.done', item_id: 'item1', output_index: 0, content_index: 0, text },
      { type: 'response.content_part.done', item_id: 'item1', output_index: 0, content_index: 0, part: content },
      { type: 'response.output_item.done', output_index: 0, item: { ...item, status: 'completed', content: [content] } },
      { type: 'response.completed', response: { ...response, status: 'completed', output: [{ ...item, status: 'completed', content: [content] }],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } });
  }
  return events.map(value => 'event: ' + value.type + '\ndata: ' + JSON.stringify(value) + '\n\n').join('');
}

test('workbench entry imports inertly and validates plain public startup options', async () => {
  const manifest = JSON.parse(await readFile(join(desktop, 'package.json'), 'utf8'));
  for (const module of ['tests/unit/organization-model.test.mjs', 'tests/unit/interaction-model.test.mjs',
    'tests/unit/organization.test.mjs', 'tests/unit/acceptance.test.mjs',
    'tests/reviewer/governed-workflow-boundaries.test.mjs', 'tests/integration/governed-workflow.test.mjs',
    'tests/e2e/governed-workflow-ui.test.mjs']) {
    assert.ok(manifest.scripts.test.split(/\s+/).includes(module), 'missing_normal_test_entry:' + module);
  }
  assert.deepEqual(Object.keys(entry), ['bootstrap']);
  await assert.rejects(entry.bootstrap({ userDataDir: 'relative' }));
  await assert.rejects(entry.bootstrap({ show: 'yes' }));
  await assert.rejects(entry.bootstrap({ pipeline: {} }));
  const source = await readFile(join(desktop, 'main.mjs'), 'utf8');
  assert.doesNotMatch(source, /import[^\n]*(?:pipelines|services|providers|legion-runtime)/u);
  assert.match(source, /starting\.then/u);
});

if (process.platform === 'win32') test('current Windows ZIP ships real runtime and supports isolated native PM workflow', { timeout: 285000 }, async () => {
  for (const directory of [packaging, fixtures, userDataRoot, temporary]) await mkdir(directory, { recursive: true });
  const before = await snapshot();
  await writeFile(join(packaging, 'desktop-package-before.json'), JSON.stringify(before, null, 2) + '\n');
  const makeArgv = [npm, '--prefix', 'apps/desktop', 'run', 'make', '--ignore-scripts'];
  const make = command(process.execPath, makeArgv);
  console.log('CURRENT_ZIP_MAKE_COMPLETED');
  await writeFile(join(packaging, 'desktop-make.log'), make.stdout + '\n' + make.stderr);
  const produced = join(desktop, 'out/make/zip/win32/x64/LegionDesktop-win32-x64-0.2.0.zip');
  assert.ok((await stat(produced)).size > 0); await copyFile(produced, stableZip);
  const zipSha = sha(await readFile(stableZip)); assert.equal(zipSha, sha(await readFile(produced)));
  const extracted = join(packaging, 'consumer-' + randomUUID());
  const workspace = join(fixtures, 'customer-' + randomUUID());
  const userData = join(userDataRoot, 'package-' + randomUUID());
  await mkdir(extracted); await mkdir(workspace); await mkdir(userData);
  assert.ok(!workspace.startsWith(userData + sep) && !userData.startsWith(workspace + sep));
  const screenshots = []; const requests = []; const exits = []; const logs = [];
  let profileId; let electron; let evidence; let held = 0;
  let editReadObserved = false; let editRequestIssued = false;
  const sockets = new Set();
  const server = createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const protocol = protocols.find(value => request.url.includes('/' + value + '/'));
    assert.ok(protocol); assert.equal(body.model, 'fixture-custom');
    const authenticated = request.headers.authorization === 'Bearer fixture-package-key' || request.headers['x-api-key'] === 'fixture-package-key';
    assert.equal(authenticated, true);
    const prompt = JSON.stringify([...body.messages ?? []].reverse().find(item => item.role === 'user') ?? body.input ?? '');
    const toolNames = (body.tools ?? []).map(tool => tool.function?.name ?? tool.name).sort();
    const hasTools = toolNames.length > 0;
    const canWrite = toolNames.includes('legion_write_file');
    let kind = 'text'; if (canWrite) kind = 'execution';
    requests.push({ protocol, authenticated, hasTools, toolNames, canWrite, model: body.model, kind, continued: prompt.includes('继续讨论') });
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    if (prompt.includes('hold execution') || prompt.includes('停止这一轮')) { held++; response.flushHeaders(); return; }
    if (prompt.includes('edit result.txt')) {
      assert.deepEqual(toolNames, workerTools);
      const toolResponses = (body.messages ?? []).filter(item => item.role === 'tool');
      if (toolResponses.length === 0) {
        response.end(completion('', body.model, { resource: 'result.txt', maxBytes: 65536 }, 'legion_read_file'));
      } else if (toolResponses.length === 1) {
        const expectedSha256 = sha(Buffer.from('controlled ZIP write\n'));
        assert.ok(JSON.stringify(toolResponses[0]).includes(expectedSha256), 'complete_file_sha_reaches_edit_agent');
        editReadObserved = true; editRequestIssued = true;
        response.end(completion('', body.model, { resource: 'result.txt', expectedSha256,
          replacements: [{ oldText: 'controlled ZIP write', newText: 'controlled ZIP edit' }] }, 'legion_edit_file'));
      } else response.end(completion('已完成受控编辑，软件检查未运行。', body.model));
      return;
    }
    if (canWrite) {
      if ((body.messages ?? []).some(item => item.role === 'tool')) response.end(completion('已提交真实工具结果，软件检查未运行。', body.model));
      else response.end(completion('', body.model, { resource: 'result.txt', content: 'controlled ZIP write\n' }));
      return;
    }
    let reply = 'OK';
    if (prompt.includes('Human消息')) {
      reply = '我们先明确一个小目标：生成结果文件，然后等待你的后续决定。请检查下面的精确范围后再确认。';
      if (!prompt.includes('继续讨论')) {
        let plan;
        if (prompt.includes('归属转交')) {
          plan = { goal: '确认把既有结果文件转交给Editor', roles: [{ id: 'Editor', name: '接手成员', purpose: '只执行确认任务', profileId }],
            tasks: [{ id: 'transfer-hold', title: '确认归属后等待', roleId: 'Editor', profileId, dependsOn: [],
              writeSet: ['result.txt'], instruction: 'hold execution' }],
            transfers: [{ resource: 'result.txt', fromRoleId: 'Writer', toRoleId: 'Editor' }] };
        } else {
          plan = { goal: '生成并受控编辑结果，再演示停止', roles: [{ id: 'Writer', name: '实施成员', purpose: '只执行已确认任务', profileId }],
            tasks: [{ id: 'write-result', title: '生成结果文件', roleId: 'Writer', profileId, dependsOn: [], writeSet: ['result.txt'], instruction: 'write result.txt with controlled ZIP write' },
              { id: 'edit-result', title: '受控局部编辑', roleId: 'Writer', profileId, dependsOn: ['write-result'], writeSet: ['result.txt'], instruction: 'edit result.txt after reading its SHA' },
              { id: 'wait-next', title: '等待可停止的后续任务', roleId: 'Writer', profileId, dependsOn: ['edit-result'], writeSet: ['later.txt'], instruction: 'hold execution' }] };
        }
        reply += '\n\n```legion-plan\n' + JSON.stringify(plan) + '\n```';
      }
    }
    response.end(sse(protocol, reply, body.model));
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
  const closeApp = async () => {
    const child = electron.process(); const exited = new Promise(accept => child.once('exit', (code, signal) => accept({ code, signal })));
    await electron.close(); const result = await exited; exits.push(result);
    assert.equal(result.code, 0); assert.equal(result.signal, null); electron = null;
  };
  try {
    command('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory(' + quoted(stableZip) + ',' + quoted(extracted) + ')'], { timeout: 60000 });
    console.log('CURRENT_ZIP_EXTRACTED ' + extracted);
    const appRoot = join(extracted, 'resources/app');
    const manifest = JSON.parse(await readFile(join(appRoot, 'package.json'), 'utf8'));
    const sourceManifest = JSON.parse(await readFile(join(desktop, 'package.json'), 'utf8'));
    assert.equal(manifest.name, 'legion-desktop'); assert.equal(manifest.version, '0.2.0');
    assert.equal(manifest.main, 'main.mjs'); assert.equal(manifest.type, 'module');
    assert.deepEqual(manifest.dependencies, sourceManifest.dependencies);
    const { scripts, devDependencies, private: privatePackage, ...expectedManifest } = sourceManifest;
    expectedManifest.config = { ...sourceManifest.config }; delete expectedManifest.config.forge;
    assert.deepEqual(manifest, expectedManifest, 'exact Forge production manifest transform');
    const packagedFiles = await files(appRoot);
    for (const forbidden of ['tests/', 'scripts/', 'out/', '.ans/', 'forge.config.mjs', 'package-lock.json'])
      assert.equal(packagedFiles.some(path => path === forbidden || path.startsWith(forbidden)), false, forbidden);
    for (const dev of ['electron', 'playwright', '@electron-forge/cli', '@electron-forge/maker-zip'])
      assert.equal(packagedFiles.some(path => path.startsWith('node_modules/' + dev + '/')), false, dev);
    const sourceFiles = await files(join(desktop, 'src'));
    for (const path of [...sourceFiles.map(name => 'src/' + name), 'main.mjs', 'README.md'])
      assert.equal(sha(await readFile(join(appRoot, path))), sha(await readFile(join(desktop, path))), path);
    const coreSmoke = JSON.parse(await readFile(join(root, '.ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/su-frontdoor-memory-repair-v1/package-smoke.json'), 'utf8'));
    const runtimeRoot = join(appRoot, 'node_modules/legion-runtime');
    const runtimeFiles = await files(runtimeRoot); assert.equal(runtimeFiles.length, coreSmoke.fileCount);
    for (const path of runtimeFiles) assert.equal(sha(await readFile(join(runtimeRoot, path))), sha(await readFile(join(root, path))), 'runtime_package:' + path);
    assert.deepEqual(runtimeFiles, coreSmoke.packageFiles);
    const executable = join(extracted, 'LegionDesktop.exe');
    const probeCode = `import assert from 'node:assert/strict';
      import {normalizeContext} from '@earendil-works/pi-ai';
      import * as a from '@earendil-works/pi-ai/api/openai-completions';
      import * as b from '@earendil-works/pi-ai/api/openai-responses';
      import * as c from '@earendil-works/pi-ai/api/anthropic-messages';
      import {createAgentSession} from '@earendil-works/pi-coding-agent';
      import * as models from 'legion-runtime/workbench-models';
      import {createPiAgentService} from 'legion-runtime/services/pi-agent';
      import {createPolicyService} from 'legion-runtime/services/policy';
      import {createMutationService} from 'legion-runtime/services/mutation';
      import {createReadService} from 'legion-runtime/services/read';
      import {createProposalService} from 'legion-runtime/services/proposal';
      import {readFileSync} from 'node:fs';
      assert.equal(typeof normalizeContext,'function');for(const api of [a,b,c])assert.equal(typeof api.streamSimple,'function');
      assert.equal(typeof createAgentSession,'function');assert.equal(Object.keys(models).length,62);
      for(const name of ['ProjectReadRequest','ProjectReadDecision','ProjectReadResult','normalizeProjectReadResource',
        'ProjectFileOwners','FileOwnershipPlan','FileOwnershipTransfer','FileOwnershipError',
        'applyFileOwnershipPlan','assertFileOwner','assertDistinctRoleWriteScopes'])assert.equal(typeof models[name],'function');
      for(const factory of [createPiAgentService,createPolicyService,createMutationService,createReadService,createProposalService])assert.equal(typeof factory,'function');
      for(const name of ['pi-ai','pi-coding-agent'])assert.equal(JSON.parse(readFileSync('node_modules/@earendil-works/'+name+'/package.json')).version,'1.0.4');
      assert.equal(JSON.parse(readFileSync('node_modules/legion-runtime/package.json')).version,'1.1.3');
      assert.equal(process.versions.electron,'44.6.0');const v=process.versions.node.split('.').map(Number);assert.ok(v[0]>22||(v[0]===22&&v[1]>=19));
      console.log(JSON.stringify({electron:process.versions.electron,node:process.versions.node,piAi:'1.0.4',piSdk:'1.0.4',runtime:'1.1.3',models:62,publicApis:3,readService:true,fileOwners:true}));`;
    const embedded = command(executable, ['--input-type=module', '-e', probeCode], {
      cwd: appRoot, env: { ...environment(), ELECTRON_RUN_AS_NODE: '1' }, timeout: 30000 });
    const runtime = JSON.parse(embedded.stdout.trim());
    async function launch() {
      electron = await _electron.launch({ executablePath: executable, args: [], cwd: extracted,
        env: environment({ LEGION_DESKTOP_USER_DATA_DIR: userData, LEGION_DESKTOP_SHOW: 'true' }), timeout: 45000 });
      let output = ''; const child = electron.process();
      child.stdout.on('data', bytes => { output += bytes.toString(); }); child.stderr.on('data', bytes => { output += bytes.toString(); });
      child.once('exit', () => logs.push(output));
      const page = await electron.firstWindow({ timeout: 30000 });
      await page.waitForSelector('#conversation-page:not([hidden])', { timeout: 15000 });
      await page.waitForFunction(() => document.getElementById('send-message').disabled === true);
      return page;
    }
    let page = await launch();
    const isolation = await page.evaluate(() => ({ process: typeof process, require: typeof require, api: Object.keys(window.legionDesktop).sort() }));
    assert.equal(isolation.process, 'undefined'); assert.equal(isolation.require, 'undefined'); assert.deepEqual(isolation.api, operations);
    const readiness = await electron.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows()[0]; return { ready: !window.isDestroyed(), windowId: window.id };
    });
    assert.equal(readiness.ready, true); assert.ok(Number.isInteger(readiness.windowId));
    await theme(page, 'light'); await capture(page, 'initial-conversation-light', screenshots);
    await chooseNativeProject(electron, page, workspace);
    const selected = await waitState(page, value => value.currentProject !== null, 'real native folder selection');
    assert.equal(selected.currentProject.hasManager, false); assert.equal(requests.length, 0);
    assert.deepEqual(await readdir(workspace), []);
    await page.locator('[data-page="settings"]').click();
    const profileIds = [];
    for (const protocol of protocols) {
      await page.locator('#new-profile').click(); await page.locator('#profile-name').fill(protocol);
      await page.locator('#protocol').selectOption(protocol); await page.locator('#provider').fill('fixture-local');
      await page.locator('#model-id').fill('fixture-custom');
      await page.locator('#base-url').fill('http://127.0.0.1:' + server.address().port + '/' + protocol + '/v1');
      await page.locator('#api-key').fill('fixture-package-key'); await page.locator('#save-profile').click();
      const saved = await waitState(page, value => value.profiles.some(item => item.name === protocol), 'profile save');
      const profile = saved.profiles.find(item => item.name === protocol); assert.equal(profile.hasSavedKey, true);
      profileIds.push(profile.id); assert.equal(await page.locator('#api-key').inputValue(), '');
      await page.locator('.profile-item').filter({ hasText: protocol }).getByRole('button', { name: '测试', exact: true }).click();
      await waitState(page, value => value.probe.profileId === profile.id && value.probe.status === 'success', 'real ' + protocol + ' probe');
    }
    profileId = profileIds[0];
    assert.deepEqual([...new Set(requests.map(item => item.protocol))].sort(), [...protocols].sort());
    assert.ok(requests.every(item => !item.hasTools));
    const ciphertext = await readFile(join(userData, 'desktop-settings.json'), 'utf8');
    assert.equal(ciphertext.includes('fixture-package-key'), false);
    assert.ok(JSON.parse(ciphertext).profiles.every(item => typeof item.keyCiphertext === 'string' && item.keyCiphertext.length > 0));
    await page.locator('#default-profile').selectOption(profileId);
    await waitState(page, value => value.defaultProfileId === profileId, 'default profile');
    await theme(page, 'light'); await capture(page, 'settings-light', screenshots);
    await theme(page, 'dark'); await capture(page, 'settings-dark', screenshots);
    await page.locator('[data-page="conversation"]').click();
    await page.locator('#message-input').fill('请为这个客户项目提出一个最小实施方案。'); await page.locator('#send-message').click();
    let discussed = await waitState(page, value => value.plan?.status === 'draft' && value.turn?.status === 'completed', 'real PM plan');
    assert.equal(discussed.currentProject.hasManager, true); assert.equal(discussed.roles.filter(item => item.id === 'ProjectManager').length, 1);
    assert.equal(discussed.history.messages.length, 2); assert.deepEqual(await readdir(workspace), []);
    assert.deepEqual(requests.at(-1).toolNames, readTools);
    assert.equal(requests.some(item => item.canWrite), false, 'unconfirmed_discussion_cannot_write');
    assert.equal(discussed.plan.tasks.length, 3);
    assert.deepEqual(discussed.plan.tasks.flatMap(item => item.writeSet).sort(), ['later.txt', 'result.txt', 'result.txt']);
    assert.deepEqual(discussed.plan.fileOwnership.claims.map(item => [item.resource, item.roleId]),
      [['later.txt', 'Writer'], ['result.txt', 'Writer']]);
    assert.deepEqual(discussed.plan.fileOwnership.transfers, []);
    await page.waitForSelector('#plan-panel:not([hidden])');
    assert.equal(await page.locator('#details-drawer').isHidden(), true);
    assert.equal(await page.locator('#plan-panel').isVisible(), true);
    assert.match(await page.locator('#plan-ownership').textContent(), /result\.txt → Writer/u);
    await theme(page, 'light'); await capture(page, 'conversation-light', screenshots);
    await theme(page, 'dark'); await capture(page, 'conversation-dark', screenshots);
    await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640));
    await capture(page, 'conversation-minimum-dark', screenshots);
    await page.locator('[data-page="settings"]').click(); await capture(page, 'settings-minimum-dark', screenshots);
    await page.locator('[data-page="conversation"]').click();
    const workerDenied = await page.evaluate(projectId => window.legionDesktop.sendMessage({ projectId, roleId: 'Writer', text: 'bypass' }), discussed.currentProject.id);
    assert.equal(workerDenied.ok, false); assert.equal(workerDenied.error.code, 'manager_only');
    const managerEntry = page.locator('#member-list button').filter({ hasText: '唯一需求与确认入口' });
    assert.equal(await managerEntry.count(), 1); await managerEntry.click();
    assert.equal(await page.locator('#conversation-page').isVisible(), true);
    const requestCount = requests.length;
    const workerStartDenied = await page.evaluate(input => window.legionDesktop.confirmPlan(input),
      { projectId: discussed.currentProject.id, planDigest: discussed.plan.planDigest, roleId: 'Writer' });
    assert.equal(workerStartDenied.ok, false); assert.equal(workerStartDenied.error.code, 'invalid_input');
    assert.equal(requests.length, requestCount);
    await page.locator('#confirm-plan').click();
    await waitState(page, value => value.tasks.some(item => item.id === 'wait-next' && item.status === 'running'), 'controlled execution started');
    const heldDeadline = Date.now() + 5000;
    while (held < 1 && Date.now() < heldDeadline) await new Promise(accept => setTimeout(accept, 50));
    assert.ok(held >= 1, 'real held execution request');
    assert.ok(requests.some(item => item.canWrite && workerTools.every(name => item.toolNames.includes(name))),
      'confirmed_worker_must_keep_read_write_and_edit_tools');
    assert.equal(editReadObserved, true);
    assert.equal(editRequestIssued, true);
    const workerRequestCount = requests.length;
    const workerEntry = page.locator('#member-list button').filter({ hasText: '实施成员' });
    await workerEntry.click(); assert.equal(await page.locator('#details-drawer').isVisible(), true);
    assert.equal(await page.locator('#member-details').evaluate(node => node.open), true);
    const workerCard = page.locator('#role-list .role-card').filter({ hasText: '实施成员' });
    assert.equal(await workerCard.locator('select').isHidden(), true);
    assert.equal(await workerCard.getByRole('button', { name: '保存连接映射' }).isHidden(), true);
    assert.equal(requests.length, workerRequestCount, 'worker details never invoke SDK');
    await page.locator('#details-close').click();
    assert.equal(await readFile(join(workspace, 'result.txt'), 'utf8'), 'controlled ZIP edit\n');
    assert.ok((await stat(join(workspace, '.ans'))).isDirectory());
    await page.locator('#stop-execution').click();
    const stopped = await waitState(page, value => value.plan?.status === 'invalidated' && value.tasks.every(item => item.status !== 'running'), 'stop revokes running execution');
    assert.equal(stopped.tasks.find(item => item.id === 'write-result').status, 'completed');
    assert.equal(stopped.tasks.find(item => item.id === 'edit-result').status, 'completed');
    assert.equal(stopped.fileOwners.owners.find(item => item.resource === 'result.txt').roleId, 'Writer');
    assert.equal(stopped.tasks.every(item => item.checkStatus === 'not_executed'), true);
    await assert.rejects(readFile(join(workspace, 'later.txt')), { code: 'ENOENT' });
    await page.locator('#message-input').fill('停止这一轮'); await page.locator('#send-message').click();
    await waitState(page, value => value.turn?.status === 'running', 'cancellable PM turn');
    await page.locator('#cancel-turn').click();
    await waitState(page, value => value.turn?.status === 'cancelled', 'cancel current PM turn');
    const requestsBeforeRestart = requests.length;
    await closeApp(); page = await launch();
    const restored = await state(page); assert.equal(restored.profiles.length, 3);
    assert.equal(restored.history.messages.length, 0); assert.equal(requests.length, requestsBeforeRestart, 'restart_must_not_call_model');
    await chooseNativeProject(electron, page, workspace);
    const reopened = await waitState(page, value => value.currentProject?.id === discussed.currentProject.id, 'same project reopened');
    assert.equal(reopened.history.messages.length, 2); assert.equal(requests.length, requestsBeforeRestart);
    await page.locator('#message-input').fill('继续讨论'); await page.locator('#send-message').click();
    const continued = await waitState(page, value => value.turn?.status === 'completed' && value.history.messages.length === 4, 'DPAPI key decrypt and real continued SDK history');
    assert.equal(continued.roles.filter(item => item.id === 'ProjectManager').length, 1);
    assert.ok(requests.at(-1).authenticated); assert.deepEqual(requests.at(-1).toolNames, readTools);
    assert.ok(requests.every(item => item.authenticated));
    await page.locator('#message-input').fill('请把 result.txt 的文件归属转交给 Editor。'); await page.locator('#send-message').click();
    const transferDraft = await waitState(page, value => value.plan?.status === 'draft' &&
      value.plan.fileOwnership?.transfers.length === 1 && value.turn?.status === 'completed', 'explicit transfer draft');
    assert.deepEqual(transferDraft.plan.fileOwnership.transfers.map(item =>
      [item.resource, item.fromRoleId, item.toRoleId]), [['result.txt', 'Writer', 'Editor']]);
    assert.equal(transferDraft.fileOwners.owners.find(item => item.resource === 'result.txt').roleId, 'Writer');
    assert.match(await page.locator('#plan-ownership').textContent(), /Writer → Editor/u);
    await page.locator('#confirm-plan').click();
    const transferred = await waitState(page, value => value.fileOwners.owners.some(item =>
      item.resource === 'result.txt' && item.roleId === 'Editor') &&
      value.tasks.some(item => item.id === 'transfer-hold' && item.status === 'running'), 'confirmed file transfer');
    assert.equal(transferred.fileOwners.version, transferDraft.plan.fileOwnership.nextVersion);
    await page.locator('#stop-execution').click();
    await waitState(page, value => value.plan?.status === 'invalidated' &&
      value.tasks.every(item => item.status !== 'running'), 'stop transferred task');
    await closeApp();
    page = await launch();
    await chooseNativeProject(electron, page, workspace);
    const ownershipRestored = await waitState(page, value => value.currentProject?.id === discussed.currentProject.id,
      'same project owner map restored');
    assert.equal(ownershipRestored.fileOwners.owners.find(item => item.resource === 'result.txt').roleId, 'Editor');
    assert.equal(await readFile(join(workspace, 'result.txt'), 'utf8'), 'controlled ZIP edit\n');
    await closeApp();
    await writeFile(join(packaging, 'desktop-executable.log'), logs.join('\n'));
    evidence = { make: { executable: process.execPath, argv: makeArgv, exitCode: make.status },
      zip: { path: stableZip, sha256: zipSha, bytes: (await stat(stableZip)).size }, runtime,
      productionDependency: manifest.dependencies, sourceFilesVerified: sourceFiles.length + 2, runtimePackageFiles: 46,
      readiness, processExits: exits, isolation, screenshots, actualZipExecutable: true,
      nativeFolderChooser: true, pages: ['conversation', 'settings'], minimumWindow: { width: 960, height: 640 },
      realSdkRequests: requests, discussionZeroWorkspaceWrites: true, confirmedExactWriteSet: ['result.txt', 'later.txt'],
      actualWritten: ['result.txt'], controlledEditFromReadSha: editReadObserved && editRequestIssued,
      fileOwnerAfterTransfer: ownershipRestored.fileOwners.owners.find(item => item.resource === 'result.txt').roleId,
      ownerPersistedAcrossRestart: true, stopRevokedRemainingWrite: true, sameProjectManagerAfterRestart: true,
      DPAPISaveRestartAuthenticated: true, historyAfterRestart: continued.history.messages.length,
      checkStatus: 'not_executed', modelMetadata: 'unknown', paidModelCalls: 0, heldRequestsCancelled: held,
      independentReviewerTester: 'pending', limitations: 'Local controlled fixtures prove this package path; live paid providers and arbitrary shell execution are not tested.' };
  } finally {
    if (electron) await closeApp();
    for (const socket of sockets) socket.destroy(); await new Promise(accept => server.close(accept));
    await guardedRemove(extracted, packaging); await guardedRemove(userData, userDataRoot); await guardedRemove(workspace, fixtures);
    const after = await snapshot(); await writeFile(join(packaging, 'desktop-package-after.json'), JSON.stringify(after, null, 2) + '\n');
    assert.deepEqual(after, before, 'frozen core and historical artifacts/cache unchanged');
  }
  evidence.protectedHashesUnchanged = true; evidence.sourceAggregate = before.sourceAggregate;
  evidence.temporaryConsumers = (await readdir(packaging)).filter(name => name.startsWith('consumer-')).length;
  assert.equal(evidence.temporaryConsumers, 0);
  await writeFile(join(packaging, 'desktop-package.json'), JSON.stringify(evidence, null, 2) + '\n');
});

if (process.platform === 'darwin') test('macOS installed package identity; Windows ZIP proof pending', async () => {
  const nodePackage = join(root, '.ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/su-frontdoor-memory-repair-v1');
  const smoke = await currentPackageSmoke();
  const archive = await readFile(join(nodePackage, 'legion-runtime-1.1.3.tgz'));
  assert.equal(smoke.sha256, sha(archive));
  assert.equal(sha(await readFile(join(root, '.ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/legion-runtime-0.4.0.tgz'))),
    'f3114a19205b69542c5629cfbb4a2664e9aebc62fc81f76a69d332e6f922140c');
  assert.equal(sha(await readFile(join(root, '.ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/legion-runtime-0.5.0.tgz'))),
    '9fe38c708833d261ee3f3d7b25e7d66c19f6a4978039d1d8a38e7a31b69350da');
  assert.ok(smoke.fileCount > 46);
  assert.equal(Object.keys(smoke.sourceHashes).length, smoke.fileCount - 3);
  assert.equal(smoke.modelExports.length, 62);
  assert.equal(smoke.smoke.fileOwnership, true);
  assert.equal(smoke.smoke.controlledEdit, true);
  const manifest = JSON.parse(await readFile(join(desktop, 'package.json'), 'utf8'));
  const lock = JSON.parse(await readFile(join(desktop, 'package-lock.json'), 'utf8'));
  const spec = manifest.dependencies['legion-runtime'];
  assert.equal(spec, 'file:../../.ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/su-frontdoor-memory-repair-v1/legion-runtime-1.1.3.tgz');
  assert.equal(lock.packages[''].dependencies['legion-runtime'], spec);
  const entry = lock.packages['node_modules/legion-runtime'];
  assert.equal(entry.version, '1.1.3');
  assert.equal(entry.resolved, spec);
  assert.equal(entry.integrity, 'sha512-' + createHash('sha512').update(archive).digest('base64'));
  assert.equal(entry.link, undefined);
  const runtimeRoot = join(desktop, 'node_modules/legion-runtime');
  const runtimeInfo = await lstat(runtimeRoot);
  assert.ok(runtimeInfo.isDirectory() && !runtimeInfo.isSymbolicLink());
  const published = JSON.parse(await readFile(join(runtimeRoot, 'package.json'), 'utf8'));
  assert.equal(published.version, '1.1.3');
  for (const file of ['README.md', 'package.json'])
    assert.deepEqual(await readFile(join(runtimeRoot, file)), await readFile(join(root, file)), 'installed_source_bytes:' + file);
  assert.deepEqual(published.exports, smoke.packageExports);
  const runtimeFiles = await files(runtimeRoot);
  assert.equal(runtimeFiles.length, smoke.fileCount);
  assert.deepEqual(runtimeFiles, smoke.packageFiles);
  for (const [path, digest] of Object.entries(smoke.sourceHashes)) {
    assert.equal(sha(await readFile(join(runtimeRoot, path))), digest, 'installed_runtime_source:' + path);
  }
  const models = await import('legion-runtime/workbench-models');
  assert.deepEqual(Object.keys(models).sort(), smoke.modelExports);
  for (const [name, names] of Object.entries(smoke.serviceExports)) {
    const service = await import('legion-runtime/services/' + name);
    assert.deepEqual(Object.keys(service).sort(), [...names].sort(), 'service:' + name);
  }
  assert.deepEqual(Object.keys(await import('legion-runtime')).sort(), smoke.publicExports);
  assert.equal(typeof models.ProjectReadRequest, 'function');
  assert.equal(typeof models.ProjectReadDecision, 'function');
  assert.equal(typeof models.ProjectReadResult, 'function');
  assert.equal(typeof models.normalizeProjectReadResource, 'function');
  for (const name of ['ProjectFileOwners', 'FileOwnershipPlan', 'FileOwnershipTransfer', 'FileOwnershipError',
    'applyFileOwnershipPlan', 'assertFileOwner', 'assertDistinctRoleWriteScopes']) assert.equal(typeof models[name], 'function');
  const owners = new models.ProjectFileOwners({ projectId: 'installed-smoke', version: 'v1',
    owners: [{ resource: 'src/api.ts', roleId: 'Backend' }] });
  const transfer = new models.FileOwnershipPlan({ projectId: 'installed-smoke', baseVersion: 'v1',
    baseDigest: owners.digest, nextVersion: 'v2', claims: [{ resource: 'src/api.ts', roleId: 'Frontend' }],
    transfers: [new models.FileOwnershipTransfer({ resource: 'src/api.ts', fromRoleId: 'Backend', toRoleId: 'Frontend' })] });
  assert.equal(models.applyFileOwnershipPlan(owners, transfer).ownerOf('SRC/API.TS'), 'Frontend');
  assert.throws(() => new models.FileOwnershipPlan({ projectId: 'installed-smoke', baseVersion: 'v1',
    baseDigest: owners.digest, nextVersion: 'v2', claims: [
      { resource: 'src/api.ts', roleId: 'Backend' }, { resource: 'SRC/API.TS', roleId: 'Frontend' }] }),
  /cross_role_claim/);
  const sourceSha = sha(Buffer.from('alpha\n'));
  const read = new models.ProjectReadResult({ status: 'read', reason: 'read', resource: 'src/api.ts',
    text: 'alpha\n', byteLength: 6, nextLine: 0, complete: true, sha256: sourceSha });
  assert.equal(read.sha256, sourceSha);
  const session = new models.AgentSession({ sessionId: 'installed-smoke', roleId: 'Frontend',
    taskId: 'edit-api', organizationVersion: 'v1' });
  const edit = new models.ActionProposal({ proposalId: 'edit-api', action: 'edit_file',
    resource: 'src/api.ts', tool: 'legion_edit_file', capability: 'write_file', session,
    expectedSha256: read.sha256, replacements: [{ oldText: 'alpha', newText: 'beta' }] });
  assert.equal(edit.expectedSha256, sourceSha);
  assert.equal(typeof (await import('legion-runtime/services/read')).createReadService, 'function');
  const electron = JSON.parse(await readFile(join(desktop, 'node_modules/electron/package.json'), 'utf8'));
  assert.equal(electron.version, '44.6.0');
  const electronPath = await readFile(join(desktop, 'node_modules/electron/path.txt'), 'utf8');
  assert.equal(electronPath, 'Electron.app/Contents/MacOS/Electron');
  assert.ok((await stat(join(desktop, 'node_modules/electron/dist', electronPath))).isFile());
  console.log('MACOS_PACKAGE_IDENTITY ' + JSON.stringify({ runtime: published.version,
    models: smoke.modelExports.length, services: Object.keys(smoke.serviceExports).length,
    files: runtimeFiles.length, electron: electron.version, windowsZip: 'not_executed_on_macos' }));
});

async function electronCheckSmoke(generated) {
  const assert = (await import('node:assert/strict')).default;
  const fs = (await import('node:fs')).promises;
  const path = await import('node:path');
  const { createHash } = await import('node:crypto');
  const wb = await import('legion-runtime/workbench-models');
  const { createCheckService } = await import('legion-runtime/services/check');
  assert.equal(process.versions.electron, '44.6.0');
  assert.ok(process.execPath.endsWith('/Electron'));
  const fixtureRoot = path.join(generated, 'fixtures', 'su-frontdoor-memory-repair-v1');
  await fs.mkdir(fixtureRoot, { recursive: true });
  const base = await fs.mkdtemp(path.join(fixtureRoot, 'electron-check-'));
  const candidate = path.join(base, 'candidate');
  const output = path.join(base, 'output');
  await fs.mkdir(candidate); await fs.mkdir(output);
  const source = "import test from 'node:test'; import assert from 'node:assert/strict'; import {Session} from 'node:inspector'; import {Worker} from 'node:worker_threads'; test('actual Electron isolated test',()=>{ assert.equal(2+2,4); assert.equal(process.env.NODE_OPTIONS,undefined); assert.equal(process.permission.has('inspector'),false); assert.throws(()=>new Session().connect(),e=>e.code==='ERR_ACCESS_DENIED'); assert.throws(()=>process.binding('fs'),e=>e.code==='ERR_ACCESS_DENIED'); assert.throws(()=>new Worker('0',{eval:true}),e=>e.code==='ERR_ACCESS_DENIED'); });";
  await fs.writeFile(path.join(candidate, 'unit.mjs'), source);
  const stat = await fs.lstat(candidate, { bigint: true });
  const lifetime = new AbortController();
  const spec = new wb.CheckSpec({ checkId: 'electron-unit', kind: 'node-test', argv: ['--test', 'unit.mjs'],
    testResources: ['unit.mjs'], inputResources: ['unit.mjs'], timeoutSeconds: 10 });
  let authorization = new wb.CheckAuthorization({ authorizationId: 'host-fixture', confirmationId: 'approved-fixture',
    workspaceIdentity: { canonicalPath: candidate, deviceId: String(stat.dev), fileId: String(stat.ino) },
    planDigest: 'a'.repeat(64), fileOwnersDigest: 'b'.repeat(64), organizationVersion: 'v1', profileVersion: 'profile',
    roleId: 'Acceptance', taskId: 'package', sessionId: 'session', instanceId: 'instance', runId: 'run',
    approvedChecks: [spec], inputVersions: [{ resource: 'unit.mjs', byteLength: Buffer.byteLength(source),
      sha256: createHash('sha256').update(source).digest('hex') }] });
  const request = new wb.CheckRequest({ requestId: 'electron-request', runId: 'run', checkId: spec.checkId });
  let validations = 0;
  const config = { workspaceRoot: candidate, runtimeExecutable: process.execPath, outputRoot: output,
    authorizationValidator: { validate(request, current, { signal }) {
      validations++;
      const allowed = current.digest === authorization.digest && !signal.aborted && !lifetime.signal.aborted;
      return { decision: new wb.CheckDecision({ allowed, reason: 'live_fixture_approval', requestId: request.requestId,
        runId: request.runId, checkId: request.checkId, authorizationDigest: current.digest }),
        authorization, signal: lifetime.signal };
    } } };
  const service = createCheckService(config);
  assert.throws(() => createCheckService({ ...config, provider: {} }), /unknown field/);
  try {
    const value = await service.run(request, authorization, { signal: new AbortController().signal });
    assert.equal(value.result.status, 'passed', JSON.stringify(value));
    assert.equal(value.result.executed, true); assert.equal(value.result.testCount, 1);
    assert.equal(value.result.exitCode, 0); assert.ok(validations >= 2);
    assert.deepEqual(value.result.actualArgv.slice(0, 6), [process.execPath, '--permission', '--allow-fs-read=*',
      '--allow-fs-write=*', '--allow-child-process', '--test-isolation=none']);
    assert.match(value.result.actualArgv[6], /\/reporter\.mjs$/);
    assert.deepEqual(value.result.actualArgv.slice(7), spec.argv);
    assert.equal(value.result.environment.isolation, 'macos-seatbelt+node-events-v1+no-child-process');
    assert.equal(value.result.inputDigest, authorization.inputDigest);
    assert.ok(new wb.PiToolResult({ requestId: request.requestId, runId: request.runId, ...value }));
    const forgedSource = "import {writeSync} from 'node:fs'; writeSync(3, JSON.stringify({type:'test:pass',name:'forged',nesting:0,detailsType:'test'})+'\\n');";
    await fs.writeFile(path.join(candidate, 'unit.mjs'), forgedSource);
    authorization = new wb.CheckAuthorization({ ...authorization, inputVersions: [{ resource: 'unit.mjs',
      byteLength: Buffer.byteLength(forgedSource), sha256: createHash('sha256').update(forgedSource).digest('hex') }] });
    const forged = await service.run(request, authorization);
    assert.equal(forged.result.status, 'error', JSON.stringify(forged));
    assert.equal(forged.result.reason, 'invalid_reporter_events');
    assert.equal(forged.result.testCount, 0);
    lifetime.abort();
    const revoked = await service.run(request, authorization);
    assert.equal(revoked.result.executed, false); assert.equal(revoked.decision.allowed, false);
    const evidence = { electron: process.versions.electron, node: process.versions.node, runtimeExecutable: process.execPath,
      validations, result: value.result, forged: forged.result, revoked: revoked.result };
    await fs.mkdir(path.join(generated, 'packaging', 'su-frontdoor-memory-repair-v1'), { recursive: true });
    await fs.writeFile(path.join(generated, 'packaging/su-frontdoor-memory-repair-v1/electron-check-smoke.json'), JSON.stringify(evidence, null, 2) + '\n');
    console.log('ELECTRON_CHECK_SMOKE ' + JSON.stringify(evidence));
  } finally { await service.close(); await service.close(); }
}

if (process.platform === 'darwin') test('actual Electron Node host executes installed CheckService with live approval', async () => {
  for (const directory of [packaging, fixtures, temporary]) await mkdir(directory, { recursive: true });
  const electronPath = await readFile(join(desktop, 'node_modules/electron/path.txt'), 'utf8');
  const binary = join(desktop, 'node_modules/electron/dist', electronPath);
  const code = 'await (' + electronCheckSmoke.toString() + ')(' + JSON.stringify(generated) + ');';
  const result = command(binary, ['--input-type=module', '-e', code], { cwd: desktop,
    env: { ...environment(), ELECTRON_RUN_AS_NODE: '1', TMPDIR: temporary }, timeout: 45000 });
  assert.match(result.stdout, /ELECTRON_CHECK_SMOKE/);
});

async function installedFreshSingleRunSmoke(workspace) {
  const assert = (await import("node:assert/strict")).default;
  const ai = await import("@earendil-works/pi-ai");
  const wb = await import("legion-runtime/workbench-models");
  const { createPiAgentService } = await import("legion-runtime/services/pi-agent");
  const core = ai.createFauxCore({ provider: "installed-seed", models: [{ id: "offline" }], tokensPerSecond: 0 });
  core.setResponses([ai.fauxAssistantMessage("current task completed")]);
  const instance = new wb.AgentInstance({ instanceId: "fresh-installed", name: "worker", sessionId: "fresh-session",
    roleId: "Backend", taskId: "current-task", organizationVersion: "current-org" });
  const calls = [];
  const options = { instance, proxy: new wb.PiConnection({ provider: core.provider, model: "offline" }),
    scope: new wb.AgentScope({ write: ["backend/current.txt"], tools: ["legion_write_file"] }),
    cwd: workspace, lifecycle: "single_run", modelProviders: { [core.provider]: {
      api: core.api, baseUrl: "https://legion.invalid", apiKey: "fixture-only",
      models: core.models.map(({ id, name, reasoning, input, cost, contextWindow, maxTokens }) =>
        ({ id, name, reasoning, input, cost, contextWindow, maxTokens })),
      streamSimple: (model, context, requestOptions) => {
        calls.push(JSON.stringify(context));
        return core.streamSimple(model, context, requestOptions);
      }
    } } };
  const history = new wb.PiConversationHistory({ messages: [
    { role: "user", text: "previous question with options a and b" },
    { role: "assistant", text: "plain previous task notes; a was selected" }
  ] });
  const checkpoint = new wb.PiConversationCheckpoint({ instance,
    profileId: "legacy:installed-seed/offline", profileVersion: "current-org", history });
  assert.throws(() => new wb.PiConversationHistory({ messages: [{ role: "toolResult", text: "old grant yes" }] }), TypeError);
  const service = await createPiAgentService(options);
  try {
    await assert.rejects(service.restore_history({ ...checkpoint }), /history_binding_mismatch/);
    await assert.rejects(service.restore_history(new wb.PiConversationCheckpoint({ instance,
      profileId: checkpoint.profileId, profileVersion: "old-connection", history })), /history_binding_mismatch/);
    const previousInstance = new wb.AgentInstance({ ...instance, instanceId: "previous-instance" });
    await assert.rejects(service.restore_history(new wb.PiConversationCheckpoint({ instance: previousInstance,
      profileId: checkpoint.profileId, profileVersion: checkpoint.profileVersion, history })), /history_binding_mismatch/);
    await service.restore_history(checkpoint);
    assert.equal(calls.length, 0, "restore_must_not_call_model");
    await assert.rejects(service.restore_history(checkpoint), /single_run_history_restore_unavailable/);
    service.start_run("current-run", "current confirmed task input");
    await assert.rejects(service.restore_history(checkpoint), /single_run_history_restore_unavailable/);
    let terminal;
    for (;;) {
      const event = await service.next_event("current-run", { signal: AbortSignal.timeout(5000) });
      assert.notEqual(event.type, "tool_request", "plain_seed_must_not_replay_tools");
      if (["run_finished", "run_failed", "run_cancelled"].includes(event.type)) { terminal = event; break; }
    }
    assert.equal(terminal.type, "run_finished", JSON.stringify(terminal));
    assert.equal(terminal.result.status, "completed");
    assert.equal(terminal.result.assistantText, "current task completed");
    assert.equal(calls.length, 1);
    const modelContext = JSON.parse(calls[0]);
    assert.deepEqual(modelContext.messages.flatMap(message => message.toolsAdded ?? []).map(tool => tool.name), ["legion_write_file"]);
    assert.ok(modelContext.messages.every(message => message.role !== "toolResult"));
    assert.match(calls[0], /previous question with options a and b/);
    assert.match(calls[0], /plain previous task notes; a was selected/);
    assert.match(calls[0], /current confirmed task input/);
    await assert.rejects(service.restore_history(checkpoint), /single_run_history_restore_unavailable/);
    assert.throws(() => service.start_run("second-run", "cannot reuse old instance"), /not_ready/);
  } finally { await service.close(); await service.close(); }
  const lengthCore = ai.createFauxCore({ provider: "installed-seed", models: [{ id: "offline" }], tokensPerSecond: 0 });
  lengthCore.setResponses([ai.fauxAssistantMessage("incomplete summary", { stopReason: "length" })]);
  const lengthOptions = { ...options, instance: new wb.AgentInstance({ ...instance, instanceId: "length-instance" }),
    modelProviders: { [core.provider]: { ...options.modelProviders[core.provider], streamSimple: lengthCore.streamSimple } } };
  const lengthService = await createPiAgentService(lengthOptions);
  try {
    lengthService.start_run("length-run", "summary must finish");
    let terminal;
    for (;;) {
      const event = await lengthService.next_event("length-run", { signal: AbortSignal.timeout(5000) });
      if (["run_finished", "run_failed", "run_cancelled"].includes(event.type)) { terminal = event; break; }
    }
    assert.equal(terminal.type, "run_failed");
    assert.equal(terminal.result.status, "failed");
    assert.equal(terminal.result.errorCode, "pi_model_error");
  } finally { await lengthService.close(); }
  return { runtime: process.versions, freshSingleRunSeed: true, bindingRejected: true,
    repeatedRestoreRejected: true, activeAndFinishedRestoreRejected: true, oldToolSeedRejected: true,
    currentToolOnly: true, restoredTextInActualSdkCall: true, lengthStopFailed: true,
    fixtureModelCalls: calls.length + lengthCore.state.callCount, paidModelCalls: 0 };
}

if (process.platform === 'darwin') test('installed runtime restores fresh single_run text once in Node and actual Electron Node host', async () => {
  for (const directory of [packaging, fixtures, temporary]) await mkdir(directory, { recursive: true });
  const node = await installedFreshSingleRunSmoke(fixtures);
  const electronPath = await readFile(join(desktop, 'node_modules/electron/path.txt'), 'utf8');
  const binary = join(desktop, 'node_modules/electron/dist', electronPath);
  const code = 'const value = await (' + installedFreshSingleRunSmoke.toString() + ')(' + JSON.stringify(fixtures) + '); console.log(JSON.stringify(value));';
  const executed = command(binary, ['--input-type=module', '-e', code], { cwd: desktop,
    env: { ...environment(), ELECTRON_RUN_AS_NODE: '1', TMPDIR: temporary }, timeout: 45000 });
  const electron = JSON.parse(executed.stdout.trim());
  assert.equal(electron.runtime.electron, '44.6.0');
  assert.equal(electron.freshSingleRunSeed, true);
  assert.equal(electron.lengthStopFailed, true);
  await writeFile(join(packaging, 'installed-role-memory-smoke.json'), JSON.stringify({ node, electron }, null, 2) + '\n');
  console.log('INSTALLED_ROLE_MEMORY_SMOKE ' + JSON.stringify({ node, electron }));
});

async function installedAdapterShellSmoke(base) {
  const assert = (await import('node:assert/strict')).default;
  const fs = (await import('node:fs')).promises;
  const path = await import('node:path');
  const { createServer } = await import('node:http');
  const wb = await import('legion-runtime/workbench-models');
  const { createPiAgentService } = await import('legion-runtime/services/pi-agent');
  const { Compile } = await import('typebox/compile');
function sse(protocol, text, model) {
  if (protocol === "openai-completions") {
    const first = { id: "chat-1", object: "chat.completion.chunk", created: 1, model,
      choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }] };
    const last = { ...first, choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
    return "data: " + JSON.stringify(first) + "\n\ndata: " + JSON.stringify(last) + "\n\ndata: [DONE]\n\n";
  }
  const events = [];
  if (protocol === "anthropic-messages") {
    events.push({ type: "message_start", message: { id: "msg1", type: "message", role: "assistant",
      model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } },
    { type: "message_stop" });
  } else {
    const item = { id: "item1", type: "message", role: "assistant", status: "in_progress", content: [] };
    const content = { type: "output_text", text, annotations: [] };
    const response = { id: "resp1", object: "response", created_at: 1, model, status: "in_progress", output: [] };
    events.push({ type: "response.created", response },
      { type: "response.output_item.added", output_index: 0, item },
      { type: "response.content_part.added", item_id: "item1", output_index: 0, content_index: 0,
        part: { ...content, text: "" } },
      { type: "response.output_text.delta", item_id: "item1", output_index: 0, content_index: 0, delta: text },
      { type: "response.output_text.done", item_id: "item1", output_index: 0, content_index: 0, text },
      { type: "response.content_part.done", item_id: "item1", output_index: 0, content_index: 0, part: content },
      { type: "response.output_item.done", output_index: 0, item: { ...item, status: "completed", content: [content] } },
      { type: "response.completed", response: { ...response, status: "completed",
        output: [{ ...item, status: "completed", content: [content] }],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } });
  }
  return events.map((value) => "event: " + value.type + "\ndata: " + JSON.stringify(value) + "\n\n").join("");
}

function toolSse(protocol,model,tool,parameters){
 const args=JSON.stringify(parameters),id="tool-shell";
 if(protocol==="openai-completions") {
  const first={id:"chat",object:"chat.completion.chunk",created:1,model,choices:[{index:0,delta:{role:"assistant",tool_calls:[{index:0,id,type:"function",function:{name:tool,arguments:args}}]},finish_reason:null}]};
  const last={...first,choices:[{index:0,delta:{},finish_reason:"tool_calls"}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}};
  return "data: "+JSON.stringify(first)+"\n\ndata: "+JSON.stringify(last)+"\n\ndata: [DONE]\n\n";
 }
 let events=[];
 if(protocol==="anthropic-messages") {
  events=[{type:"message_start",message:{id:"msg",type:"message",role:"assistant",model,content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:1,output_tokens:0}}},
   {type:"content_block_start",index:0,content_block:{type:"tool_use",id,name:tool,input:{}}},
   {type:"content_block_delta",index:0,delta:{type:"input_json_delta",partial_json:args}},
   {type:"content_block_stop",index:0},{type:"message_delta",delta:{stop_reason:"tool_use",stop_sequence:null},usage:{output_tokens:1}},{type:"message_stop"}];
 } else {
  const response={id:"resp",object:"response",created_at:1,model,status:"in_progress",output:[]};
  const item={id:"fc_shell",type:"function_call",call_id:id,name:tool,arguments:"",status:"in_progress"};
  events=[{type:"response.created",response},{type:"response.output_item.added",output_index:0,item},
   {type:"response.function_call_arguments.delta",item_id:item.id,output_index:0,delta:args},
   {type:"response.function_call_arguments.done",item_id:item.id,output_index:0,arguments:args},
   {type:"response.output_item.done",output_index:0,item:{...item,arguments:args,status:"completed"}},
   {type:"response.completed",response:{...response,status:"completed",output:[{...item,arguments:args,status:"completed"}],usage:{input_tokens:1,output_tokens:1,total_tokens:2}}}];
 }
 return events.map(value=>"event: "+value.type+"\ndata: "+JSON.stringify(value)+"\n\n").join("");
}

  await fs.mkdir(base, { recursive: true });
  const results = [];
  for (const protocol of ['openai-completions', 'openai-responses', 'anthropic-messages']) {
    for (const tool of ['legion_request_shell', 'legion_review_shell']) {
      const directory = await fs.mkdtemp(path.join(base, 'installed-sdk-shell-'));
      const requests = [];
      let roleId = 'Backend';
      let lifecycle = 'single_run';
      let parameters = { command: 'printf "fixture"', reason: 'schema check' };
      if (tool === 'legion_review_shell') {
        roleId = 'ProjectManager'; lifecycle = 'conversation';
        parameters = { requestId: 'pending-role-request', requestDigest: 'a'.repeat(64), revision: 1, approved: true, reason: 'record exact fixture approval' };
      }
      const server = createServer(async (request, response) => {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        requests.push(body);
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        if (requests.length === 1) response.end(toolSse(protocol, body.model, tool, parameters));
        else response.end(sse(protocol, 'continued original role', body.model));
      });
      await new Promise(done => server.listen(0, '127.0.0.1', done));
      let service;
      try {
        const instance = new wb.AgentInstance({ instanceId: protocol + '-' + tool, sessionId: 'session-' + tool,
          name: roleId, roleId, taskId: 'package-schema', organizationVersion: 'fixture-v1' });
        const connection = new wb.PiConnectionProfile({ profileId: protocol, profileVersion: 'v1', protocol,
          provider: 'package-fixture', model: 'custom-model', baseUrl: 'http://127.0.0.1:' + server.address().port + '/v1' });
        service = await createPiAgentService({ instance, connection, credentials: { apiKey: 'local-package-fixture' },
          proxy: new wb.PiConnection({ provider: connection.provider, model: connection.model }),
          scope: new wb.AgentScope({ write: [], tools: [tool] }), cwd: directory, lifecycle,
          budgets: { turnTimeoutMs: 10000, maxOutputTokens: 2048, maxTextCharsPerTurn: 65536, maxQueueEvents: 256 } });
        for (const name of ['start_run', 'next_event', 'respond_tool', 'cancel_turn', 'get_history', 'restore_history', 'cancel', 'close']) assert.equal(typeof service[name], 'function');
        service.start_run('package-run', 'approved fixture task');
        let pending;
        for (;;) {
          const event = await service.next_event('package-run', { signal: AbortSignal.timeout(10000) });
          if (event.type === 'tool_request') { pending = event.request; break; }
          assert.equal(['run_failed', 'run_cancelled', 'run_finished'].includes(event.type), false, JSON.stringify(event));
        }
        assert.equal(pending.tool, tool);
        assert.equal(requests[0].tools.length, 1);
        let schema = requests[0].tools[0].parameters;
        if (protocol === 'openai-completions') schema = requests[0].tools[0].function.parameters;
        if (protocol === 'anthropic-messages') schema = requests[0].tools[0].input_schema;
        assert.equal(Compile(schema).Check(parameters), true);
        if (protocol === 'anthropic-messages') assert.equal(schema.additionalProperties, undefined);
        else assert.equal(Compile(schema).Check({ ...parameters, permit: {} }), false);
        assert.throws(() => new wb.PiToolRequest({ ...pending, requestId: 'forged', toolCallId: 'forged', parameters: { ...parameters, callerRoleId: 'ProjectManager' } }), TypeError);
        let result;
        if (tool === 'legion_request_shell') {
          const request = new wb.ShellRequest({ requestId: pending.requestId, runId: pending.runId, ...pending.parameters });
          const binding = { requestId: pending.requestId, runId: pending.runId, requestDigest: request.digest };
          result = new wb.PiToolResult({ requestId: pending.requestId, runId: pending.runId,
            decision: new wb.ShellDecision({ ...binding, allowed: false, reason: 'fixture Host refuses execution' }),
            result: new wb.ShellResult({ ...binding, status: 'denied', reason: 'fixture Host refuses execution', executed: false,
              exitCode: null, stdout: '', stderr: '', logsTruncated: false, generationDigest: 'a'.repeat(64),
              startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() }) });
        } else {
          result = new wb.PiToolResult({ requestId: pending.requestId, runId: pending.runId,
            decision: new wb.AgentControlDecision({ requestId: pending.requestId, runId: pending.runId, tool, allowed: true, reason: 'private fixture recorded review' }),
            result: new wb.AgentControlResult({ requestId: pending.requestId, runId: pending.runId, tool,
              status: 'completed', reason: 'private fixture recorded review', payload: { recorded: true } }) });
        }
        service.respond_tool(pending, result);
        assert.throws(() => service.respond_tool(pending, result), /invalid_or_late/);
        for (;;) {
          const event = await service.next_event('package-run', { signal: AbortSignal.timeout(10000) });
          if (['run_finished', 'run_failed', 'run_cancelled'].includes(event.type)) {
            assert.equal(event.result.status, 'completed', JSON.stringify(event));
            assert.equal(event.result.assistantText, 'continued original role');
            assert.equal(event.result.toolResults[0], result); break;
          }
        }
        assert.equal(requests.length, 2);
        for (const privateName of ['authorizationId', 'publicationReceipt', 'contentBase64', 'readCandidateData']) assert.equal(JSON.stringify(requests[1]).includes(privateName), false);
        results.push({ protocol, tool, finalResultOnly: true, samePending: true, schema: true, source: 'installed-sdk-1.0.4' });
      } finally {
        if (service) await service.close();
        server.closeAllConnections(); await new Promise(done => server.close(done));
        assert.equal(await fs.realpath(directory), directory);
        await fs.rm(directory, { recursive: true });
      }
    }
  }
  return { results, paidModelCalls: 0, totalActualLocalRequests: 12, lifecyclePublicMethods: 8 };
}

if (process.platform === 'darwin') test('installed SDK exposes exact Shell request/review tools across three real protocols', async () => {
  const evidence = await installedAdapterShellSmoke(fixtures);
  assert.equal(evidence.results.length, 6);
  await mkdir(packaging, { recursive: true });
  await writeFile(join(packaging, 'installed-shell-adapter-smoke.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('INSTALLED_SHELL_ADAPTER_SMOKE ' + JSON.stringify(evidence));
});
