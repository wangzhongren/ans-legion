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
  if (current !== name) { const mobile=await page.locator('#mobile-nav-toggle').isVisible();if(mobile)await page.locator('#mobile-nav-toggle').click();await page.locator('#theme-toggle').click(); if (await page.locator('html').getAttribute('data-theme') !== name) await page.locator('#theme-toggle').click();if(mobile){await page.locator('#theme-toggle').press('Escape');assert.equal(await page.locator('#mobile-nav-toggle').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('#mobile-nav-toggle').evaluate(node=>node===document.activeElement),true);}}
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


import {withCommandGui,guiState,guiZone,configureGui} from './governed-workflow-ui.test.mjs';
test('macOS actual command-center six viewports/themes preserve keyboard focus drafts and read-only files',{timeout:90000},async()=>{
 assert.equal(process.platform,'darwin','new macOS GUI scenario must run');
 await withCommandGui(async({electron,page,root,controller,capture})=>{
  const initial=await guiState(page);assert.equal(initial.profiles.length,0);assert.equal(controller.server.calls.length,0);assert.equal(await page.locator('#send-message').isDisabled(),true);await capture('no-connection-current-project');await configureGui(page,controller);
  for(const size of [{width:1440,height:900},{width:1280,height:800},{width:900,height:700}]){await electron.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),size);await waitFor(()=>page.evaluate(()=>({width:innerWidth,height:innerHeight})),value=>value.width===size.width&&value.height===size.height,'actual native content size');
   for(const mode of ['dark','light']){await theme(page,mode);await guiZone(page,'conversation');const draft='完整未提交 Human 草稿 '+size.width+' '+mode;const input=page.locator('#message-input');await input.fill(draft);await input.focus();await input.press('Home');await input.press('Shift+End');const selection=await input.evaluate(node=>({start:node.selectionStart,end:node.selectionEnd}));assert.ok(selection.end>selection.start);const node=await input.elementHandle();await page.waitForTimeout(1100);assert.equal(await node.evaluate(node=>node===document.activeElement&&node.isConnected),true,'focus and node survive one real 1s polling cycle');assert.equal(await input.inputValue(),draft);assert.deepEqual(await input.evaluate(node=>({start:node.selectionStart,end:node.selectionEnd})),selection);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const box=await input.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=size.width+1&&box.y+box.height<=size.height+1);await capture('layout-'+size.width+'-'+mode);if(size.width===900){await page.locator('#mobile-nav-toggle').click();await page.locator('[data-page="settings"]').click();assert.equal(await page.locator('#settings-page').isVisible(),true);assert.equal(await page.locator('#new-profile').isVisible(),true);await capture('900-direct-ai-settings-'+mode);await page.locator('#mobile-nav-toggle').click();await page.locator('#conversation-nav').click();assert.equal(await page.locator('#message-input').inputValue(),draft);}
    await guiZone(page,'project');await page.locator('#project-refresh').click();const file=page.locator('#project-file-list button').filter({hasText:'ordinary.txt'});await file.waitFor();await file.focus();await file.press('Enter');await waitFor(()=>page.locator('#file-preview-text').innerText(),text=>text.includes('READ_ONLY_PROJECT_FILE'),'keyboard current file');assert.equal(await fs.readFile(join(root,'ordinary.txt'),'utf8'),'READ_ONLY_PROJECT_FILE\n');assert.deepEqual((await guiState(page)).context.files,[],'browsing never selects context');await page.locator('#file-preview-close').focus();await page.locator('#file-preview-close').press('Enter');await guiZone(page,'conversation');assert.equal(await input.inputValue(),draft,'draft survives workspace navigation');await page.locator('#details-toggle').click();await page.locator('#details-close').press('Escape');await waitFor(()=>page.locator('#details-drawer').isVisible(),value=>!value,'Escape closes actual details');assert.equal(await page.locator('#details-toggle').evaluate(node=>node===document.activeElement),true,'Escape restores trigger focus');
   }
  }
 });
});
