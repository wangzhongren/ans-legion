import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { _electron } from 'playwright';
import { projectRoot, generated, environment, ownedDirectory, removeOwned, guard, sha, localServer, replyText, protocolText, plan, planText, waitFor, prepareCandidate } from '../integration/workbench-flow.test.mjs';

const handwellEvidence=await ownedDirectory('evidence','workbench-ui-regression-');
const quoted = value => "'" + value.replaceAll("'", "''") + "'";
function command(executable, argv, timeout = 30000) {
  const result = spawnSync(executable, argv, { cwd: projectRoot, env: environment(), windowsHide: true, encoding: 'utf8', timeout, maxBuffer: 16 * 1024 * 1024 });
  assert.ifError(result.error); assert.equal(result.status, 0, result.stdout + result.stderr); return result.stdout;
}
async function files(directory, prefix = '') {
  const values = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    assert.equal(entry.isSymbolicLink(), false);
    if (entry.isDirectory()) values.push(...await files(join(directory, entry.name), prefix + entry.name + '/'));
    else { assert.equal(entry.isFile(), true); values.push(prefix + entry.name); }
  }
  return values.sort();
}
async function state(page) { const result = await page.evaluate(() => window.legionDesktop.getState()); assert.equal(result.ok, true, result.error?.code); return result.value; }
async function theme(page, name) {
  const current = await page.locator('html').getAttribute('data-theme');
  if (current !== name) { await page.locator('#theme-toggle').click(); if (await page.locator('html').getAttribute('data-theme') !== name) await page.locator('#theme-toggle').click(); }
  assert.equal(await page.locator('html').getAttribute('data-theme'), name);
}

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
  command('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], 12000);
}

test('Windows ZIP native chooser, focused UI, confirmed write and DPAPI process restart', { timeout: 175000,
  skip: process.platform !== 'win32' ? 'Windows ZIP and DPAPI were not executed on this macOS host' : false }, async () => {
  const location = await ownedDirectory('fixtures', 'zip-ui-'); const userData = await ownedDirectory('user-data', 'zip-ui-'); await guard(join(generated, 'tmp'), true);
  const extracted = join(location, 'consumer'); await fs.mkdir(extracted);
  const workspace = join(location, 'customer-A'); const workspaceB = join(location, 'customer-B'); await fs.mkdir(workspace); await fs.mkdir(workspaceB);
  await fs.writeFile(join(workspace, 'context.txt'), 'UI-explicit-context');
  const descriptorPath = join(projectRoot, '.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/packaging/desktop-package.json');
  const descriptorBytes = await fs.readFile(descriptorPath); const descriptor = JSON.parse(descriptorBytes);
  const zip = resolve(descriptor.zip.path); assert.equal(zip, join(projectRoot, '.ans/runtime/legion-desktop-workbench-v2/ProjectManager/desktop/packaging/LegionDesktop-0.2.0-win32-x64.zip'));
  const zipBytes = await fs.readFile(zip); assert.equal(sha(zipBytes), descriptor.zip.sha256); assert.equal(zipBytes.length, descriptor.zip.bytes);
  let electron; let server; let profileId; let candidate; let held; const exits = []; const screenshots = [];
  const capture = async (page, name) => { const path = join(handwellEvidence, 'tester-' + name + '.png'); await page.screenshot({ path }); screenshots.push(path); };
  const closeApp = async () => {
    if (!electron) return;
    const child = electron.process(); const exiting = new Promise(done => child.once('exit', (code, signal) => done({ code, signal })));
    await electron.close(); const result = await exiting; exits.push(result); assert.equal(result.code, 0); electron = null;
  };
  try {
    command('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::ExtractToDirectory(' + quoted(zip) + ',' + quoted(extracted) + ')'], 60000);
    const appRoot = join(extracted, 'resources/app');
    const sourcePaths = await files(join(projectRoot, 'apps/desktop/src'));
    for (const path of [...sourcePaths.map(name => 'src/' + name), 'main.mjs', 'README.md']) assert.equal(sha(await fs.readFile(join(appRoot, path))), sha(await fs.readFile(join(projectRoot, 'apps/desktop', path))), path);
    const runtimeRoot = join(appRoot, 'node_modules/legion-runtime'); const runtimePaths = await files(runtimeRoot); assert.equal(runtimePaths.length, 29);
    for (const path of runtimePaths) assert.equal(sha(await fs.readFile(join(runtimeRoot, path))), sha(await fs.readFile(join(projectRoot, path))), path);
    const runtime = JSON.parse(await fs.readFile(join(runtimeRoot, 'package.json'), 'utf8')); assert.equal(runtime.version, '0.4.0');
    for (const dependency of ['pi-ai', 'pi-coding-agent']) assert.equal(JSON.parse(await fs.readFile(join(appRoot, 'node_modules/@earendil-works', dependency, 'package.json'), 'utf8')).version, '1.0.4');
    server = await localServer((call, reply) => {
      if (call.path.endsWith('/messages')) assert.equal(call.headers['x-api-key'], 'tester-ui-key'); else assert.equal(call.headers.authorization, 'Bearer tester-ui-key');
      if (call.path.endsWith('/responses')) { reply.writeHead(200, { 'content-type': 'text/event-stream' }); reply.end(protocolText('openai-responses', 'OK')); return; }
      if (!call.body.tools?.length) { let text = 'OK'; if (candidate) text = 'Literal <img src=x onerror=globalThis.hacked=1>\n' + planText(candidate); replyText(reply, text); return; }
      const last = call.body.messages.findLast(item => item.role === 'user');
      const lastText = typeof last?.content === 'string' ? last.content : (last?.content ?? []).filter(item => item.type === 'text').map(item => item.text).join('');
      if (lastText.includes('"id":"task1"')) { held = reply; return; }
      if (call.body.messages.some(item => item.role === 'tool')) replyText(reply, 'Actual result received');
      else replyText(reply, '', { resource: 'result.txt', content: 'actual ZIP tester write' });
    });
    const launch = async () => {
      electron = await _electron.launch({ executablePath: join(extracted, 'LegionDesktop.exe'), args: [], cwd: extracted, env: environment({ LEGION_DESKTOP_USER_DATA_DIR: userData, LEGION_DESKTOP_SHOW: 'true' }), timeout: 35000 });
      const page = await electron.firstWindow({ timeout: 20000 }); await page.waitForSelector('#conversation-page:not([hidden])');
      await page.waitForFunction(() => document.querySelector('#send-message').disabled); return page;
    };
    let page = await launch(); const before = server.calls.length;
    assert.deepEqual(await page.evaluate(() => [typeof process, typeof require]), ['undefined', 'undefined']);
    assert.equal((await state(page)).currentProject, null); assert.equal(server.calls.length, before);
    await chooseNativeProject(electron, page, workspace);
    let selected = await waitFor(() => state(page), value => value.currentProject?.name === 'customer-A', 'native A selection');
    const idA = selected.currentProject.id; assert.equal(selected.currentProject.hasManager, false); assert.deepEqual(selected.roles, []);
    await chooseNativeProject(electron, page, workspaceB); selected = await waitFor(() => state(page), value => value.currentProject?.name === 'customer-B', 'native B selection'); assert.notEqual(selected.currentProject.id, idA); assert.deepEqual(selected.history.messages, []);
    await chooseNativeProject(electron, page, workspace); await waitFor(() => state(page), value => value.currentProject?.id === idA, 'native A return');
    assert.equal(server.calls.length, before); assert.deepEqual(await fs.readdir(workspaceB), []);
    await page.locator('.sidebar-bottom [data-page="settings"]').click();
    for (const protocol of ['openai-completions', 'openai-responses']) {
      await page.locator('#new-profile').click(); await page.locator('#profile-name').fill(protocol); await page.locator('#protocol').selectOption(protocol);
      await page.locator('#provider').fill('tester'); await page.locator('#model-id').fill('tester-local'); await page.locator('#base-url').fill(server.baseUrl); await page.locator('#api-key').fill('tester-ui-key'); await page.locator('#save-profile').click();
      const saved = await waitFor(() => state(page), value => value.profiles.some(item => item.name === protocol), 'real UI save');
      assert.equal(saved.profiles.find(item => item.name === protocol).hasSavedKey, true); assert.equal(await page.locator('#api-key').inputValue(), '');
    }
    const profiles = (await state(page)).profiles; profileId = profiles.find(item => item.protocol === 'openai-completions').id;
    await page.locator('#default-profile').selectOption(profileId); await waitFor(() => state(page), value => value.defaultProfileId === profileId, 'default selection');
    const stored = await fs.readFile(join(userData, 'desktop-settings.json'), 'utf8'); assert.ok(!stored.includes('tester-ui-key')); assert.ok(JSON.parse(stored).profiles.every(item => item.keyCiphertext));
    await theme(page, 'light'); await capture(page, 'settings-light'); await theme(page, 'dark'); await capture(page, 'settings-dark');
    await page.locator('.profile-item').filter({ hasText: 'openai-completions' }).getByRole('button', { name: '编辑', exact: true }).click();
    await page.locator('#base-url').fill('http://example.com/v1'); await page.locator('#save-profile').click(); await page.waitForSelector('#notice.error:not([hidden])'); await capture(page, 'settings-error'); assert.equal(await page.locator('#api-key').inputValue(), '');
    await page.locator('#base-url').fill(server.baseUrl);
    await page.locator('[data-page="conversation"]').click(); await page.locator('#details-toggle').click(); await page.locator('#context-input').fill('context.txt'); await page.locator('#select-context').click();
    await waitFor(() => state(page), value => value.context.files.length === 1, 'Human selected context'); await page.locator('#details-close').click();
    candidate = plan(profileId, ['result.txt', 'later.txt']); candidate.tasks[1].dependsOn = ['task0'];
    await page.locator('#message-input').fill('UI first requirement'); await page.locator('#send-message').click();
    const discussed = await waitFor(() => state(page), value => value.turn?.status === 'completed' && value.plan?.status === 'draft', 'actual draft after SDK completion');
    assert.equal(discussed.history.messages.length, 2); assert.deepEqual(discussed.roles.map(item => item.id), ['ProjectManager', 'Writer']);
    assert.deepEqual(await fs.readdir(workspace), ['context.txt']); assert.ok(JSON.stringify(server.calls.at(-1).body).includes('UI-explicit-context'));
    await page.waitForSelector('#plan-panel:not([hidden])'); assert.equal(await page.locator('#messages img').count(), 0); assert.equal(await page.evaluate(() => globalThis.hacked), undefined);
    assert.equal(await page.locator('#messages pre').isVisible(), false); assert.ok(discussed.history.messages.at(-1).text.includes('```legion-plan'));
    await page.locator('#message-input').fill('unsent customer draft'); await page.locator('#details-toggle').click();
    await page.locator('#member-details').evaluate(node => { node.open = true; });
    const managerSelect = page.getByLabel('ProjectManager AI 连接');
    await managerSelect.selectOption(profiles.find(item => item.protocol === 'openai-responses').id);
    await page.locator('#status-filter').evaluate(node => { node.closest('details').open = true; });
    await page.locator('#status-filter').selectOption('completed');
    await page.locator('#details-drawer').evaluate(node => { for (const detail of node.querySelectorAll('details')) detail.open = true; node.scrollTop = 60; });
    const drawerScroll = await page.locator('#details-drawer').evaluate(node => node.scrollTop); assert.ok(drawerScroll > 0);
    const observed = (await state(page)).observation.observedAt;
    await page.waitForTimeout(1150);
    await waitFor(() => state(page), value => value.observation.observedAt !== observed, 'one actual one-second poll', 5000);
    assert.equal(await page.locator('#message-input').inputValue(), 'unsent customer draft'); assert.equal(await managerSelect.inputValue(), profiles.find(item => item.protocol === 'openai-responses').id); assert.equal(await page.locator('#status-filter').inputValue(), 'completed');
    assert.equal(await page.locator('#details-drawer').evaluate(node => node.scrollTop), drawerScroll);
    await page.locator('#details-close').click(); await theme(page, 'light'); await capture(page, 'conversation-light'); await theme(page, 'dark'); await capture(page, 'conversation-dark');
    await electron.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(960, 640)); await capture(page, 'conversation-minimum-dark');
    await page.locator('.sidebar-bottom [data-page="settings"]').click(); await page.locator('#profile-name').fill('unsaved settings edit');
    await page.waitForTimeout(1100); assert.equal(await page.locator('#profile-name').inputValue(), 'unsaved settings edit'); await capture(page, 'settings-minimum-dark');
    await page.locator('[data-page="conversation"]').click(); assert.equal(await page.locator('#chat-scroll').evaluate(node => node.scrollTop), 0);
    const callsBeforeDenied = server.calls.length;
    for (const input of [{ projectId: idA, roleId: 'Writer', text: 'direct worker' }, { projectId: idA, roleId: 'ProjectManager', text: 'inject', root: workspace }]) assert.equal((await page.evaluate(value => window.legionDesktop.sendMessage(value), input)).ok, false);
    assert.equal((await page.evaluate(value => window.legionDesktop.confirmPlan(value), { projectId: idA, planDigest: discussed.plan.planDigest, roleId: 'Writer' })).ok, false);
    const foreign = await electron.evaluate(async ({ BrowserWindow }, preload) => { const window = new BrowserWindow({ show: false, webPreferences: { preload, nodeIntegration: false, contextIsolation: true, sandbox: true } }); try { await window.loadURL('data:text/html,<html></html>'); return await window.webContents.executeJavaScript('window.legionDesktop.getState()'); } finally { window.destroy(); } }, join(appRoot, 'src/interface/preload.cjs'));
    assert.equal(foreign.ok, false); assert.equal(foreign.error.code, 'unauthorized_sender'); assert.equal(server.calls.length, callsBeforeDenied);
    await page.locator('#member-list button').filter({ hasText: '实施成员' }).click(); assert.equal(await page.locator('#details-drawer').isVisible(), true);
    const workerCard = page.locator('#role-list .role-card').filter({ hasText: '实施成员' }); assert.equal(await workerCard.locator('select').isHidden(), true); assert.equal(server.calls.length, callsBeforeDenied);
    await page.locator('#details-close').click(); await page.locator('#confirm-plan').click();
    await waitFor(() => state(page), value => value.tasks.some(item => item.id === 'task1' && item.status === 'running'), 'real dependent task starts'); await waitFor(async () => held, Boolean, 'held actual second request');
    assert.equal(await fs.readFile(join(workspace, 'result.txt'), 'utf8'), 'actual ZIP tester write'); await page.locator('#stop-execution').click();
    const stopped = await waitFor(() => state(page), value => value.plan?.status === 'invalidated' && value.tasks.every(item => item.status !== 'running'), 'UI stop');
    assert.ok(stopped.tasks.every(item => item.checkStatus === 'not_executed')); await assert.rejects(fs.stat(join(workspace, 'later.txt')), { code: 'ENOENT' });
    const audit = (await fs.readFile(join(workspace, '.ans/events/index.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse); assert.ok(audit.some(event => event.kind === 'mutation_success')); assert.ok(!JSON.stringify(audit).includes('actual ZIP tester write'));
    const requestsBeforeRestart = server.calls.length; await closeApp(); page = await launch(); assert.equal(server.calls.length, requestsBeforeRestart); assert.equal((await state(page)).currentProject, null);
    await chooseNativeProject(electron, page, workspace); const restored = await waitFor(() => state(page), value => value.currentProject?.id === idA, 'restart native selection');
    assert.deepEqual(restored.history.messages, stopped.history.messages); assert.equal(restored.turn, null); assert.equal(server.calls.length, requestsBeforeRestart); assert.equal((await page.evaluate(value => window.legionDesktop.confirmPlan(value), { projectId: idA, planDigest: discussed.plan.planDigest })).ok, false);
    candidate = null; const probe = await page.evaluate(value => window.legionDesktop.testConnection({ profileId: value }), profileId); assert.equal(probe.ok, true); assert.equal(probe.value.status, 'success'); assert.equal(server.calls.length, requestsBeforeRestart + 1, 'DPAPI decrypt actually authenticates after process restart');
    assert.ok(!JSON.stringify(await state(page)).includes('tester-ui-key')); await closeApp();
    assert.equal(sha(await fs.readFile(zip)), descriptor.zip.sha256); assert.equal(sha(await fs.readFile(descriptorPath)), sha(descriptorBytes));
    await fs.writeFile(join(generated, 'fixtures', 'zip-ui-proof.json'), JSON.stringify({ zip: descriptor.zip, descriptorSha256: sha(descriptorBytes), sourceFiles: sourcePaths.length + 2, runtimeFiles: runtimePaths.length, nativeChooser: true, dpapiProcessRestart: true, localhostRequests: server.calls.length, screenshots, exits, paidRequests: 0 }, null, 2));
  } finally {
    if (electron) await closeApp(); if (server) await server.close();
    await removeOwned(location, join(generated, 'fixtures')); await removeOwned(userData, join(generated, 'user-data'));
  }
});

test('installed macOS Electron UI gives PM and confirmed worker controlled project reads', {
  timeout: 90000, skip: process.platform !== 'darwin' ? 'macOS Electron check requires macOS' : false,
}, async () => {
  await fs.mkdir(handwellEvidence,{recursive:true});
  const location = await ownedDirectory('fixtures', 'handwell-mac-read-ui-');
  const userData = await ownedDirectory('user-data', 'mac-read-ui-');
  await guard(join(generated, 'tmp'), true);
  const workspace = join(location, 'customer-project');
  await fs.mkdir(join(workspace, 'nested/.ssh'), { recursive: true });
  await fs.writeFile(join(workspace, 'ordinary.txt'), 'mac-ui-ordinary-marker\n');
  await fs.writeFile(join(workspace, 'nested/.ssh/id_rsa'), 'mac-ui-credential-marker');
  let electron; let server; let phase = 'initial'; let transferPlan;
  try {
    const runtimePackage = JSON.parse(await fs.readFile(join(projectRoot, 'apps/desktop/node_modules/legion-runtime/package.json'), 'utf8'));
    const electronPackage = JSON.parse(await fs.readFile(join(projectRoot, 'apps/desktop/node_modules/electron/package.json'), 'utf8'));
    assert.equal(runtimePackage.version, '0.8.2'); assert.equal(electronPackage.version, '44.6.0');
    const planned = plan('placeholder-profile', ['approved.txt']);
    server = await localServer(async (call, reply) => {
      const names = (call.body.tools ?? []).map(item => item.function.name).sort();
      const previous = call.body.messages.filter(item => item.role === 'tool');
      if(names.includes('legion_submit_acceptance')){if(!previous.length){replyText(reply,'',{checkId:'acceptance'},'legion_run_check');return;}if(previous.length===1){const checked=JSON.parse(previous[0].content).result;assert.equal(checked.status,'passed');replyText(reply,'',{payload:{taskId:'zzindependent',evidenceIds:[checked.requestId],decision:'pass',issues:[]}},'legion_submit_acceptance');return;}assert.equal(JSON.parse(previous.at(-1).content).result.status,'completed');replyText(reply,'Actual independent acceptance complete');return;}
      if (!names.includes('legion_write_file')) {
        assert.ok(names.includes('legion_list_files')&&names.includes('legion_read_file'));assert.ok(names.includes('legion_design_roles'));
        const candidate=phase==='transfer'?transferPlan:planned;assert.ok(candidate.governance,'fixture roles approved before SDK turn');
        if (phase === 'transfer') { replyText(reply, planText(transferPlan)); return; }
        if (previous.length === 0) { replyText(reply, '', { resource: '' }, 'legion_list_files'); return; }
        if (previous.length === 1) { replyText(reply, '', { resource: 'ordinary.txt' }, 'legion_read_file'); return; }
        if (previous.length === 2) { replyText(reply, '', { resource: 'nested/.ssh/id_rsa' }, 'legion_read_file'); return; }
        const responses = JSON.stringify(previous);
        assert.ok(responses.includes('mac-ui-ordinary-marker'));
        assert.ok(!responses.includes('mac-ui-credential-marker'));
        replyText(reply, planText(planned)); return;
      }
      assert.deepEqual(names, ['legion_edit_file', 'legion_list_files', 'legion_read_file', 'legion_request_shell', 'legion_run_check', 'legion_write_file']);
      if (phase === 'transfer') {
        if (previous.length === 0) { replyText(reply, '', { resource: 'approved.txt' }, 'legion_read_file'); return; }
        if (previous.length === 1) {
          const read = JSON.parse(previous[0].content).result;
          assert.equal(read.status, 'read'); assert.equal(read.text, 'mac-ui-approved-write');
          assert.equal(read.sha256, sha(Buffer.from(read.text)));
          replyText(reply, '', { resource: 'approved.txt', expectedSha256: read.sha256,
            replacements: [{ oldText: 'approved', newText: 'edited' }] }, 'legion_edit_file'); return;
        }
        if(previous.length===2){assert.equal(JSON.parse(previous.at(-1).content).result.status,'written');replyText(reply,'',{checkId:'selftest-task0'},'legion_run_check');return;}assert.equal(JSON.parse(previous.at(-1).content).result.status,'passed');
        replyText(reply, 'Transferred Agent edit completed'); return;
      }
      if (previous.length === 0) { replyText(reply, '', { resource: 'ordinary.txt' }, 'legion_read_file'); return; }
      if (previous.length === 1) { replyText(reply, '', { resource: 'nested/.ssh/id_rsa' }, 'legion_read_file'); return; }
      if (previous.length === 2) {
        const responses = JSON.stringify(previous);
        assert.ok(responses.includes('mac-ui-ordinary-marker'));
        assert.ok(!responses.includes('mac-ui-credential-marker'));
        replyText(reply, '', { resource: 'approved.txt', content: 'mac-ui-approved-write' }); return;
      }
      if(previous.length===3){assert.equal(JSON.parse(previous.at(-1).content).result.status,'written');replyText(reply,'',{checkId:'selftest-task0'},'legion_run_check');return;}assert.equal(JSON.parse(previous.at(-1).content).result.status,'passed');replyText(reply, 'Worker completed');
    });
    const executablePath = join(projectRoot, 'apps/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
    electron = await _electron.launch({ executablePath, args: [join(projectRoot, 'apps/desktop')],
      cwd: join(projectRoot, 'apps/desktop'),
      env: environment({ LEGION_DESKTOP_USER_DATA_DIR: userData, LEGION_DESKTOP_INITIAL_WORKSPACE: workspace,
        LEGION_DESKTOP_SHOW: 'false' }), timeout: 35000 });
    const page = await electron.firstWindow({ timeout: 20000 });
    await page.waitForSelector('#conversation-page:not([hidden])');
    const initial = await waitFor(() => state(page), value => value.currentProject?.name === 'customer-project', 'macOS project selected');
    assert.deepEqual(initial.context.files, []);
    await page.locator('.sidebar-bottom [data-page="settings"]').click();
    await page.locator('#new-profile').click(); await page.locator('#profile-name').fill('mac read tester');
    await page.locator('#protocol').selectOption('openai-completions');
    await page.locator('#provider').fill('tester'); await page.locator('#model-id').fill('tester-local');
    await page.locator('#base-url').fill(server.baseUrl); await page.locator('#api-key').fill('mac-ui-key');
    await page.locator('#save-profile').click();
    const saved = await waitFor(() => state(page), value => value.profiles.some(item => item.name === 'mac read tester'), 'macOS profile saved');
    const profileId = saved.profiles.find(item => item.name === 'mac read tester').id;
    planned.roles[0].profileId = profileId; planned.tasks[0].profileId = profileId;
    await page.locator('#default-profile').selectOption(profileId);
    await page.locator('[data-page="conversation"]').click();
    await prepareCandidate(planned,workspace,userData,'mac-ui-approved-write');
    await page.locator('#message-input').fill('Inspect this project and propose one exact output');
    await page.locator('#send-message').click();
    const discussed = await waitFor(() => state(page), value => value.plan?.status === 'draft' && value.turn?.status === 'completed', 'macOS PM draft', 20000);
    assert.deepEqual(discussed.context.files, []);
    assert.equal(await fs.readFile(join(workspace, 'ordinary.txt'), 'utf8'), 'mac-ui-ordinary-marker\n');
    await assert.rejects(fs.stat(join(workspace, 'approved.txt')), { code: 'ENOENT' });
    assert.ok(!JSON.stringify(discussed).includes('mac-ui-ordinary-marker'));
    assert.ok(!JSON.stringify(discussed).includes('mac-ui-credential-marker'));
    await page.locator('#details-toggle').click();await page.waitForSelector('#plan-panel:not([hidden])');
    await page.screenshot({ path: join(handwellEvidence, 'tester-mac-read-draft.png') });
    await page.locator('#tab-task').click();await page.waitForSelector('#detail-task:not([hidden])');await page.locator('#confirm-plan').click();await page.waitForSelector('#interaction-modal[open]');await page.locator('#interaction-submit').click();
    const completed = await waitFor(() => state(page), value => value.plan?.status === 'completed', 'macOS confirmed worker', 20000);
    assert.equal(await fs.readFile(join(workspace, 'approved.txt'), 'utf8'), 'mac-ui-approved-write');
    assert.equal(completed.tasks[0].checkStatus, 'passed');assert.equal(completed.tasks[0].acceptanceStatus,'pass');
    const audit = await fs.readFile(join(workspace, '.ans/events/index.jsonl'), 'utf8');
    assert.ok(audit.includes('mutation_success'));
    assert.ok(!audit.includes('mac-ui-ordinary-marker') && !audit.includes('mac-ui-credential-marker'));
    assert.ok(!JSON.stringify(completed).includes('mac-ui-credential-marker'));
    assert.equal(completed.fileOwners.owners.find(item => item.resource === 'approved.txt').roleId, 'Writer');
    assert.equal(server.calls.length, 12);
    await page.locator('#details-close').click();
    transferPlan = plan(profileId, ['approved.txt']);
    transferPlan.roles[0] = { id: 'Editor', name: 'Editor', purpose: 'Confirmed file transfer', profileId };
    transferPlan.tasks[0].roleId = 'Editor';
    transferPlan.transfers = [{ resource: 'approved.txt', fromRoleId: 'Writer', toRoleId: 'Editor' }];
    await prepareCandidate(transferPlan,workspace,userData,'mac-ui-edited-write');
    phase = 'transfer';
    await page.locator('#message-input').fill('Transfer approved.txt from Writer to Editor for a small edit');
    await page.locator('#send-message').click();
    const transferDraft = await waitFor(() => state(page), value => value.plan?.status === 'draft' &&
      value.plan?.fileOwnership?.transfers.length === 1, 'macOS transfer draft', 20000);
    assert.equal(transferDraft.fileOwners.owners.find(item => item.resource === 'approved.txt').roleId, 'Writer');
    assert.equal(await fs.readFile(join(workspace, 'approved.txt'), 'utf8'), 'mac-ui-approved-write');
    if(!(await page.locator('#details-drawer').isVisible()))await page.locator('#details-toggle').click();await page.locator('#tab-files').click();await page.waitForSelector('#detail-files:not([hidden])');
    await page.locator('#plan-ownership').getByText('approved.txt：Writer → Editor').waitFor();
    await page.screenshot({ path: join(handwellEvidence, 'tester-mac-transfer-draft.png') });
    await page.locator('#tab-task').click();await page.waitForSelector('#detail-task:not([hidden])');await page.locator('#confirm-plan').click();await page.waitForSelector('#interaction-modal[open]');await page.locator('#interaction-submit').click();
    const transferred = await waitFor(() => state(page), value => value.plan?.status === 'completed' &&
      value.fileOwners.owners.some(item => item.resource === 'approved.txt' && item.roleId === 'Editor'), 'macOS transferred Agent edit', 20000);
    assert.equal(await fs.readFile(join(workspace, 'approved.txt'), 'utf8'), 'mac-ui-edited-write');
    assert.equal(transferred.tasks[0].results[0].action, 'edit_file');
    assert.equal(transferred.tasks[0].results[0].contentDigest, sha(Buffer.from('mac-ui-edited-write')));
    assert.equal((await page.evaluate(value => window.legionDesktop.confirmPlan(value),
      { projectId: initial.currentProject.id, planDigest: discussed.plan.planDigest })).ok, false);
    assert.equal(server.calls.length, 20);
  } catch(error) {const directory=join(userData,'workbench-organization');for(const name of await fs.readdir(directory).catch(()=>[])){if(name.endsWith('.json'))await fs.copyFile(join(directory,name),join(handwellEvidence,'mac-read-failed-organization.json'));}throw error;} finally {
    if (electron) await electron.close();
    if (server) await server.close();
    await removeOwned(location, join(generated, 'fixtures'));
    await removeOwned(userData, join(generated, 'user-data'));
  }
});
