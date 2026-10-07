import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorkbenchPipeline } from '../../src/pipelines/workbench.mjs';
import { _Renderer, conversationDisplay, resultSummary } from '../../src/interface/renderer.mjs';
import { workbenchDTO } from '../../src/models/workbench.mjs';
const role = process.env.LEGION_DESKTOP_TEST_ROLE ?? 'DesktopEngineer';
assert.ok(['DesktopEngineer', 'ProjectManager', 'Reviewer', 'Tester'].includes(role));
const root = fileURLToPath(new URL('../../../../', import.meta.url));
let roleDirectory = role;
if (role !== 'DesktopEngineer') roleDirectory = `${role}/desktop`;
const generated = resolve(root, `.ans/runtime/legion-desktop-workbench-v2/${roleDirectory}`);
await mkdir(join(generated, 'fixtures'), { recursive: true }); await mkdir(join(generated, 'user-data'), { recursive: true }); await mkdir(join(generated, 'tmp'), { recursive: true });
process.env.TEMP = join(generated, 'tmp'); process.env.TMP = join(generated, 'tmp'); delete process.env.NODE_OPTIONS; delete process.env.NODE_COMPILE_CACHE; process.env.NODE_DISABLE_COMPILE_CACHE = '1';
const projectId = 'a'.repeat(64);
function state() {
  return { ...workbenchDTO({ profiles: [{ id: 'p1', name: '本地连接', protocol: 'openai-completions', provider: 'local', modelId: 'test', baseUrl: 'http://localhost:1234', hasSavedKey: true }, { id: 'p2', name: '备用连接', protocol: 'openai-responses', provider: 'local', modelId: 'test', baseUrl: 'http://localhost:1234', hasSavedKey: true }], assignments: [], projects: [], history: { messages: [] } }), defaultProfileId: 'p1', currentProject: { id: projectId, name: '示例项目', organizationVersion: 'customer-v1', hasManager: true }, roles: [{ id: 'ProjectManager', name: '项目管理', purpose: '澄清需求', profileId: 'p1' }, { id: 'Builder', name: '执行成员', purpose: '执行确认后的任务', profileId: 'p1' }] };
}
class Node extends EventTarget {
  constructor(tag = 'div') { super(); this.tagName = tag; this.textContent = ''; this.className = ''; this.value = ''; this.hidden = false; this.disabled = false; this.children = []; this.dataset = {}; this.scrollTop = 0; this.scrollHeight = 1200; this.clientHeight = 600; this.attributes = {}; this.classList = { toggle: () => {} }; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = value; }
  focus() {} scrollIntoView() {} remove() {}
}
class Document {
  constructor() { this.nodes = new Map(); this.body = new Node(); this.documentElement = new Node(); }
  getElementById(id) { if (!this.nodes.has(id)) this.nodes.set(id, new Node()); return this.nodes.get(id); }
  createElement(tag) { return new Node(tag); }
  querySelectorAll() { return []; }
}

test('real public Pipeline selection accepts arbitrary customer folder, hides roots and has no copied development roles', async () => {
  const fixture = await mkdtemp(join(generated, 'fixtures', 'interface-pipeline-')); const customer = join(fixture, 'customer'); await mkdir(customer); const userDataDir = await mkdtemp(join(generated, 'user-data', 'interface-pipeline-')); const pipeline = createWorkbenchPipeline({ userDataDir });
  try { const selected = await pipeline.selectProject(customer); assert.equal(selected.ok, true); assert.deepEqual(selected.value.roles, []); assert.equal(selected.value.observation.status, 'unavailable'); assert.deepEqual(await readdir(customer), []); assert.equal(JSON.stringify(selected).includes('canonicalPath'), false); assert.equal((await pipeline.sendMessage({ projectId: selected.value.currentProject.id, roleId: 'Builder', text: '直接执行' })).error.code, 'manager_only'); } finally { await pipeline.close(); }
});
test('renderer polling preserves message/key/action/mapping/filter/scroll; workers remain view only', () => {
  const document = new Document(); const renderer = new _Renderer(document, {}); const dto = state(); renderer.render(dto); document.getElementById('message-input').value = '正在编辑的需求'; document.getElementById('api-key').value = 'new-secret-draft'; document.getElementById('key-action').value = 'replace'; document.getElementById('status-filter').value = 'failed'; document.getElementById('context-input').value = 'src/a.mjs'; document.getElementById('chat-scroll').scrollTop = 170; document.getElementById('details-drawer').scrollTop = 60; renderer.mappingDrafts.set('ProjectManager', 'p2'); renderer.defaultDraft = 'p2'; renderer.render({ ...dto, probe: { ...dto.probe, status: 'running' } });
  for (const [id, expected] of [['message-input', '正在编辑的需求'], ['api-key', 'new-secret-draft'], ['key-action', 'replace'], ['status-filter', 'failed'], ['context-input', 'src/a.mjs'], ['default-profile', 'p2']]) assert.equal(document.getElementById(id).value, expected);
  const managerSelect = renderer.roleRows.get('ProjectManager').select;
  assert.equal(managerSelect.value, 'p2');
  document.activeElement = managerSelect;
  const options = managerSelect.children;
  const cards = document.getElementById('role-list').children;
  renderer.render({ ...dto, profiles: dto.profiles.map((profile) => ({ ...profile, name: `${profile.name}更新` })) });
  assert.equal(renderer.roleRows.get('ProjectManager').select, managerSelect);
  assert.equal(managerSelect.children, options);
  assert.equal(document.getElementById('role-list').children, cards);
  assert.equal(managerSelect.value, 'p2');
  assert.equal(renderer.roleRows.get('Builder').select.disabled, true);
  assert.equal(renderer.roleRows.get('Builder').button.hidden, true);
  document.getElementById('member-list').children[1].dispatchEvent(new Event('click'));
  assert.equal(document.getElementById('member-details').open, true);
  assert.equal(document.getElementById('details-drawer').hidden, false);
  assert.equal(document.getElementById('chat-scroll').scrollTop, 170);
  assert.equal(document.getElementById('details-drawer').scrollTop, 60);
  document.activeElement = document.getElementById('default-profile');
  const defaultOptions = document.activeElement.children;
  renderer.render({ ...dto, profiles: dto.profiles.map((profile) => ({ ...profile, name: `${profile.name}更新` })) });
  assert.equal(document.activeElement.children, defaultOptions);
  assert.equal(document.activeElement.value, 'p2');
  document.activeElement = null;
  renderer.render({ ...dto, currentProject: { ...dto.currentProject, id: 'b'.repeat(64) } });
  assert.equal(document.getElementById('chat-scroll').scrollTop, 0);
  assert.equal(document.getElementById('message-input').value, '');
  renderer.render(dto);
  assert.equal(document.getElementById('message-input').value, '正在编辑的需求');
  renderer.navigate('settings');
  assert.equal(document.getElementById('chat-scroll').scrollTop, 0);
});
test('send and credential saves retain drafts on failure; successful send uses PM only and clears exact accepted draft', async () => {
  const document = new Document(); const calls = []; let fail = true; const dto = state(); const api = { sendMessage: async (input) => { calls.push(input); if (fail) return { ok: false, error: { message: '安全错误' } }; return { ok: true, value: dto }; }, saveProfile: async () => ({ ok: false, error: { message: '加密不可用' } }) }; const renderer = new _Renderer(document, api); renderer.render(dto); document.getElementById('message-input').value = '需求'; await renderer.send(); assert.equal(document.getElementById('message-input').value, '需求'); fail = false; await renderer.send(); assert.equal(document.getElementById('message-input').value, ''); assert.equal(calls.every((input) => input.roleId === 'ProjectManager'), true); document.getElementById('api-key').value = 'secret-draft'; document.getElementById('key-action').value = 'replace'; await renderer.saveProfile(); assert.equal(document.getElementById('api-key').value, 'secret-draft');
});
test('display hides plan JSON without mutating history, missing outputs and software checks remain honest', async () => {
  const text = '自然语言方案\n```legion-plan\n{"goal":"内部数据"}\n```'; assert.equal(conversationDisplay(text), '自然语言方案'); assert.ok(text.includes('内部数据')); const task = { results: [], writeSet: ['a.txt', 'b.txt'] }; assert.match(resultSummary(task), /实际写入 0 \/ 2/u); assert.match(resultSummary(task), /not_executed/u);
  const source = await readFile(new URL('../../src/interface/renderer.mjs', import.meta.url), 'utf8'); assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|require\(/u.test(source), false); assert.match(source, /setInterval[\s\S]*1000/u);
});
