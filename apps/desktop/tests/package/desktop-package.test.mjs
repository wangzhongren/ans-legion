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
const generated = join(root, '.ans/runtime/legion-desktop-workbench-v2', role, 'desktop');
const packaging = join(generated, 'packaging');
const fixtures = join(generated, 'fixtures');
const userDataRoot = join(generated, 'user-data');
const temporary = join(generated, 'tmp');
const npm = 'D:/soft/nodejs/node_modules/npm/bin/npm-cli.js';
const stableZip = join(packaging, 'LegionDesktop-0.2.0-win32-x64.zip');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const protocols = ['openai-completions', 'openai-responses', 'anthropic-messages'];
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

async function snapshot() {
  const core = JSON.parse(await readFile(join(root, '.ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/core-package-deps-complete.json'), 'utf8'));
  const hashes = {};
  const paths = [...Object.keys(core.authoredHashes), ...Object.keys(JSON.parse(await readFile(join(root,
    '.ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/package-smoke.json'), 'utf8')).sourceHashes)];
  paths.push(relative(root, core.artifact.path).split(sep).join('/'));
  const historical = {};
  const links = {};
  async function visit(path) {
    for (const item of await readdir(join(root, path), { withFileTypes: true })) {
      const child = path + '/' + item.name;
      if (item.isSymbolicLink()) links[child] = await readlink(join(root, child));
      else if (item.isDirectory()) await visit(child);
      else { assert.ok(item.isFile()); historical[child] = sha(await readFile(join(root, child))); }
    }
  }
  for (const path of ['.ans/runtime/legion-pi-node-v3', '.ans/runtime/legion-desktop-gui-v1', '.ans/runtime/legion-node-fixture-compat-v1']) await visit(path);
  for (const path of [...new Set(paths)].sort()) hashes[path] = sha(await readFile(join(root, path)));
  for (const [path, expected] of Object.entries(core.authoredHashes)) assert.equal(hashes[path], expected, 'frozen_core:' + path);
  assert.equal(hashes[relative(root, core.artifact.path).split(sep).join('/')], core.artifact.sha256);
  const protectedBaseline = JSON.parse(await readFile(join(root, '.ans/decisions/legion-desktop-workbench-v2-protected-baseline.json'), 'utf8'));
  for (const [path, item] of Object.entries(protectedBaseline.protected)) {
    hashes[path] = sha(await readFile(join(root, path))); assert.equal(hashes[path], item.sha256, path);
  }
  return { hashes, historical, links, sourceAggregate: core.artifact.sourceAggregateSha256 };
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
    npm_config_cache: join(generated, 'npm-cache'), npm_config_ignore_scripts: 'true',
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
function completion(text, model, tool = null) {
  let delta = { role: 'assistant', content: text };
  let finish = 'stop';
  if (tool) { delta = { role: 'assistant', tool_calls: [{ index: 0, id: 'fixture-write', type: 'function',
    function: { name: 'legion_write_file', arguments: JSON.stringify(tool) } }] }; finish = 'tool_calls'; }
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
  assert.deepEqual(Object.keys(entry), ['bootstrap']);
  await assert.rejects(entry.bootstrap({ userDataDir: 'relative' }));
  await assert.rejects(entry.bootstrap({ show: 'yes' }));
  await assert.rejects(entry.bootstrap({ pipeline: {} }));
  const source = await readFile(join(desktop, 'main.mjs'), 'utf8');
  assert.doesNotMatch(source, /import[^\n]*(?:pipelines|services|providers|legion-runtime)/u);
  assert.match(source, /starting\.then/u);
});

test('current Windows ZIP ships real runtime and supports isolated native PM workflow', { timeout: 285000 }, async () => {
  assert.equal(process.platform, 'win32', 'Windows package proof requires Windows');
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
  const sockets = new Set();
  const server = createServer(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const protocol = protocols.find(value => request.url.includes('/' + value + '/'));
    assert.ok(protocol); assert.equal(body.model, 'fixture-custom');
    const authenticated = request.headers.authorization === 'Bearer fixture-package-key' || request.headers['x-api-key'] === 'fixture-package-key';
    assert.equal(authenticated, true);
    const prompt = JSON.stringify([...body.messages ?? []].reverse().find(item => item.role === 'user') ?? body.input ?? '');
    const hasTools = Array.isArray(body.tools) && body.tools.length > 0;
    let kind = 'text'; if (hasTools) kind = 'execution';
    requests.push({ protocol, authenticated, hasTools, model: body.model, kind, continued: prompt.includes('继续讨论') });
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    if (prompt.includes('hold execution') || prompt.includes('停止这一轮')) { held++; response.flushHeaders(); return; }
    if (hasTools) {
      if ((body.messages ?? []).some(item => item.role === 'tool')) response.end(completion('已提交真实工具结果，软件检查未运行。', body.model));
      else response.end(completion('', body.model, { resource: 'result.txt', content: 'controlled ZIP write\n' }));
      return;
    }
    let reply = 'OK';
    if (prompt.includes('Human消息')) {
      reply = '我们先明确一个小目标：生成结果文件，然后等待你的后续决定。请检查下面的精确范围后再确认。';
      if (!prompt.includes('继续讨论')) {
        const plan = { goal: '生成一个受控结果并演示停止后续执行', roles: [{ id: 'Writer', name: '实施成员', purpose: '只执行已确认任务', profileId }],
          tasks: [{ id: 'write-result', title: '生成结果文件', roleId: 'Writer', profileId, dependsOn: [], writeSet: ['result.txt'], instruction: 'write result.txt with controlled ZIP write' },
            { id: 'wait-next', title: '等待可停止的后续任务', roleId: 'Writer', profileId, dependsOn: ['write-result'], writeSet: ['later.txt'], instruction: 'hold execution' }] };
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
    const coreSmoke = JSON.parse(await readFile(join(root, '.ans/runtime/legion-desktop-workbench-v2/ProjectManager/node/packaging/package-smoke.json'), 'utf8'));
    const runtimeRoot = join(appRoot, 'node_modules/legion-runtime');
    const runtimeFiles = await files(runtimeRoot); assert.equal(runtimeFiles.length, 29);
    for (const path of runtimeFiles) assert.equal(sha(await readFile(join(runtimeRoot, path))), sha(await readFile(join(root, path))), 'runtime_package:' + path);
    assert.deepEqual(runtimeFiles, ['package.json', 'README.md', ...Object.keys(coreSmoke.sourceHashes)].sort());
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
      import {createProposalService} from 'legion-runtime/services/proposal';
      import {readFileSync} from 'node:fs';
      assert.equal(typeof normalizeContext,'function');for(const api of [a,b,c])assert.equal(typeof api.streamSimple,'function');
      assert.equal(typeof createAgentSession,'function');assert.equal(Object.keys(models).length,30);
      for(const factory of [createPiAgentService,createPolicyService,createMutationService,createProposalService])assert.equal(typeof factory,'function');
      for(const name of ['pi-ai','pi-coding-agent'])assert.equal(JSON.parse(readFileSync('node_modules/@earendil-works/'+name+'/package.json')).version,'1.0.4');
      assert.equal(JSON.parse(readFileSync('node_modules/legion-runtime/package.json')).version,'0.4.0');
      assert.equal(process.versions.electron,'44.6.0');const v=process.versions.node.split('.').map(Number);assert.ok(v[0]>22||(v[0]===22&&v[1]>=19));
      console.log(JSON.stringify({electron:process.versions.electron,node:process.versions.node,piAi:'1.0.4',piSdk:'1.0.4',runtime:'0.4.0',models:30,publicApis:3}));`;
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
    assert.equal(discussed.plan.tasks.length, 2); assert.deepEqual(discussed.plan.tasks.flatMap(item => item.writeSet).sort(), ['later.txt', 'result.txt']);
    await page.waitForSelector('#plan-panel:not([hidden])');
    assert.equal(await page.locator('#details-drawer').isHidden(), true);
    assert.equal(await page.locator('#plan-panel').isVisible(), true);
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
    const workerRequestCount = requests.length;
    const workerEntry = page.locator('#member-list button').filter({ hasText: '实施成员' });
    await workerEntry.click(); assert.equal(await page.locator('#details-drawer').isVisible(), true);
    assert.equal(await page.locator('#member-details').evaluate(node => node.open), true);
    const workerCard = page.locator('#role-list .role-card').filter({ hasText: '实施成员' });
    assert.equal(await workerCard.locator('select').isHidden(), true);
    assert.equal(await workerCard.getByRole('button', { name: '保存连接映射' }).isHidden(), true);
    assert.equal(requests.length, workerRequestCount, 'worker details never invoke SDK');
    await page.locator('#details-close').click();
    assert.equal(await readFile(join(workspace, 'result.txt'), 'utf8'), 'controlled ZIP write\n');
    assert.ok((await stat(join(workspace, '.ans'))).isDirectory());
    await page.locator('#stop-execution').click();
    const stopped = await waitState(page, value => value.plan?.status === 'invalidated' && value.tasks.every(item => item.status !== 'running'), 'stop revokes running execution');
    assert.equal(stopped.tasks.find(item => item.id === 'write-result').status, 'completed');
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
    assert.ok(requests.at(-1).authenticated); assert.equal(requests.at(-1).hasTools, false);
    assert.ok(requests.every(item => item.authenticated));
    await closeApp();
    await writeFile(join(packaging, 'desktop-executable.log'), logs.join('\n'));
    evidence = { make: { executable: process.execPath, argv: makeArgv, exitCode: make.status },
      zip: { path: stableZip, sha256: zipSha, bytes: (await stat(stableZip)).size }, runtime,
      productionDependency: manifest.dependencies, sourceFilesVerified: sourceFiles.length + 2, runtimePackageFiles: 29,
      readiness, processExits: exits, isolation, screenshots, actualZipExecutable: true,
      nativeFolderChooser: true, pages: ['conversation', 'settings'], minimumWindow: { width: 960, height: 640 },
      realSdkRequests: requests, discussionZeroWorkspaceWrites: true, confirmedExactWriteSet: ['result.txt', 'later.txt'],
      actualWritten: ['result.txt'], stopRevokedRemainingWrite: true, sameProjectManagerAfterRestart: true,
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
