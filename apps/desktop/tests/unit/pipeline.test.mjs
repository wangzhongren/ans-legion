import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorkbenchPipeline } from '../../src/pipelines/workbench.mjs';
import { _Renderer, conversationDisplay, resultSummary, _markdownContent, _markdownLinkUrl } from '../../src/interface/renderer.mjs';
import { Lexer } from 'marked';
import { workbenchDTO } from '../../src/models/workbench.mjs';
const role = process.env.LEGION_DESKTOP_TEST_ROLE ?? 'DesktopEngineer';
assert.ok(['DesktopEngineer', 'ProjectManager', 'Reviewer', 'Tester'].includes(role));
const root = fileURLToPath(new URL('../../../../', import.meta.url));
let roleDirectory = role;
if (role !== 'DesktopEngineer') roleDirectory = `${role}/desktop`;
const generated = resolve(root, `.ans/runtime/legion-desktop-command-center-v1/${roleDirectory}`);
await mkdir(join(generated, 'fixtures'), { recursive: true }); await mkdir(join(generated, 'user-data'), { recursive: true }); await mkdir(join(generated, 'tmp'), { recursive: true });
process.env.TEMP = join(generated, 'tmp'); process.env.TMP = join(generated, 'tmp'); delete process.env.NODE_OPTIONS; delete process.env.NODE_COMPILE_CACHE; process.env.NODE_DISABLE_COMPILE_CACHE = '1';
const projectId = 'a'.repeat(64);
test('Shell phase chip stays stable while private member and Shell output text stay out of the customer view',()=>{
 const document=new Document(),renderer=new _Renderer(document,{}),dto=state();dto.roles[1].activity='waiting_pm_approval';
 dto.memberConversations={runs:[{id:'r',runId:'r',instanceId:'i',roleId:'Builder',taskId:'build',status:'running',startedAt:'2026-10-10T00:00:00.000Z'}],events:[{id:'private',conversationId:'r',kind:'assistant_text',text:'PRIVATE_MEMBER_TEXT',orderKnown:true,createdAt:'2026-10-10T00:00:00.000Z'}]};
 dto.shellRequests=[{id:'s',roleId:'Builder',taskId:'build',runId:'r',status:'reviewing',review:null,result:null,generatedEffects:['dist/'],createdAt:'2026-10-10T00:00:01.000Z',updatedAt:'2026-10-10T00:00:01.000Z'}];
 renderer.render(dto);const chip=renderer.activityNodes.get('Builder');assert.match(chip.textContent,/待PM审批/u);chip.dispatchEvent(new Event('click'));
 const log=document.getElementById('member-conversation-log');assert.equal(log.textContent.includes('PRIVATE_MEMBER_TEXT'),false);
 dto.roles[1].activity='executing_shell';dto.shellRequests[0].status='running';renderer.render(dto);assert.equal(renderer.activityNodes.get('Builder'),chip);assert.match(chip.textContent,/执行Shell/u);
 const scope=document.createElement('div');renderer.taskDefinition(scope,{id:'build',title:'任务',roleId:'Builder',profileId:'p1',dependsOn:[],checks:[],instruction:'实际指令',generatedEffects:['dist/'],artifactScopes:[{scope:'dist/',kind:'build'}]});assert.match(scope.textContent,/Shell生成写入范围：dist\//u);
});

test('both real evidence surfaces show authorized absence without SHA null and retained delivery is separate from new modifications',()=>{const document=new Document(),renderer=new _Renderer(document,{}),dto=state();dto.evidence=[{id:'e',roleId:'Builder',taskId:'t',planDigest:'a'.repeat(64),result:{checkId:'c',status:'passed',testCount:1,executed:true,exitCode:0,reason:'passed',inputVersions:[{resource:'old.bin',state:'absent',sha256:null,byteLength:0}],stdout:'',stderr:''}}];renderer.render(dto);renderer.openMember('Builder');assert.match(document.getElementById('member-current-evidence').textContent,/old.bin.*获准缺失/u);assert.match(document.getElementById('execution-results').textContent,/old.bin.*获准缺失/u);assert.equal(document.getElementById('member-current-evidence').textContent.includes('SHA null'),false);assert.equal(document.getElementById('execution-results').textContent.includes('SHA null'),false);assert.match(resultSummary({writeSet:['asset.bin'],results:[],retainedOutputs:[{resource:'asset.bin'}],checkStatus:'passed'}),/实际修改 0.*恢复核验保留 1.*非新写/u);});
function state() {
  return { ...workbenchDTO({ profiles: [{ id: 'p1', name: '本地连接', protocol: 'openai-completions', provider: 'local', modelId: 'test', baseUrl: 'http://localhost:1234', hasSavedKey: true }, { id: 'p2', name: '备用连接', protocol: 'openai-responses', provider: 'local', modelId: 'test', baseUrl: 'http://localhost:1234', hasSavedKey: true }], assignments: [], projects: [], history: { messages: [] } }), defaultProfileId: 'p1', currentProject: { id: projectId, name: '示例项目', organizationVersion: 'customer-v1', hasManager: true }, roles: [{ id: 'ProjectManager', name: '项目管理', purpose: '澄清需求', profileId: 'p1' }, { id: 'Builder', name: '执行成员', purpose: '执行确认后的任务', profileId: 'p1' }] };
}
class Node extends EventTarget {
  constructor(tag = 'div', document = null) {
    super(); this.tagName = tag; this.document = document; this._text = ''; this.className = ''; this.value = ''; this.hidden = false; this._disabled = false; this.children = []; this.dataset = {}; this.scrollTop = 0; this.scrollHeight = 1200; this.clientHeight = 600; this.attributes = {}; this.parentNode = null; this.isConnected = true;
    this.classes = new Set(); this.classList = { toggle: (name, force) => { if (force) this.classes.add(name); else this.classes.delete(name); }, contains: (name) => this.classes.has(name) };
  }
  get disabled() { return this._disabled; }
  set disabled(value) { this._disabled = value; if (value && this.document?.activeElement === this) this.document.activeElement = this.document.body; }
  get textContent() { return this._text + this.children.map((node) => node.textContent).join(''); }
  set textContent(value) { this._text = value; for (const child of [...this.children ?? []]) child.remove(); this.children = []; }
  append(...children) { for (const child of children) { child.remove(); child.parentNode = this; child.setConnected(true); this.children.push(child); } }
  replaceChildren(...children) { for (const child of [...this.children]) child.remove(); this.append(...children); }
  insertBefore(child, reference) { child.remove(); child.parentNode = this; child.setConnected(true); let index = this.children.indexOf(reference); if (index < 0) index = this.children.length; this.children.splice(index, 0, child); }
  setAttribute(name, value) { this.attributes[name] = value; }
  showModal() { this.open = true; } close() { this.open = false; }
  focus() { if (this.document && !this.disabled) this.document.activeElement = this; }
  scrollIntoView() { this.scrolledIntoView = true; }
  containsNode(node) { if (node === this) return true; return this.children.some((child) => child.containsNode(node)); }
  setConnected(value) { this.isConnected = value; for (const child of this.children) child.setConnected(value); }
  remove() {
    const focused = this.document && this.containsNode(this.document.activeElement);
    if (this.parentNode) { const index = this.parentNode.children.indexOf(this); if (index >= 0) this.parentNode.children.splice(index, 1); }
    this.parentNode = null; this.setConnected(false);
    // Actual Chromium detaches the focused subtree and exposes connected BODY.
    if (focused) this.document.activeElement = this.document.body;
  }
  querySelectorAll(selector) { const result = []; for (const child of this.children) { if (selector === 'details[data-key]' && child.tagName === 'details' && child.dataset.key) result.push(child); if (/^[a-z][a-z0-9]*$/u.test(selector) && child.tagName === selector) result.push(child); if (selector === 'input[name="interaction-choice"]:checked' && child.tagName === 'input' && child.name === 'interaction-choice' && child.checked) result.push(child); result.push(...child.querySelectorAll(selector)); } return result; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  closest(selector) { if (selector === 'details[data-key]' && this.tagName === 'details' && this.dataset.key) return this; return this.parentNode?.closest(selector) ?? null; }
}
class Document {
  constructor() { this.nodes = new Map(); this.body = new Node('body', this); this.documentElement = new Node('html', this); }
  getElementById(id) { if (!this.nodes.has(id)) this.nodes.set(id, new Node('div', this)); return this.nodes.get(id); }
  createElement(tag) { return new Node(tag, this); }
  querySelectorAll(selector) { if (selector === '[data-page]') return [...this.nodes.values()].filter((node) => node.dataset.page); if (selector === '[data-suggestion]') return [...this.nodes.values()].filter((node) => node.dataset.suggestion); return []; }
  querySelector(selector) { return this.selectedChoice ?? this.getElementById('interaction-options').querySelector(selector); }
}

test('real public Pipeline selection accepts arbitrary customer folder, hides roots and has no copied development roles', async () => {
  const fixture = await mkdtemp(join(generated, 'fixtures', 'interface-pipeline-')); const customer = join(fixture, 'customer'); await mkdir(customer); const userDataDir = await mkdtemp(join(generated, 'user-data', 'interface-pipeline-')); const pipeline = createWorkbenchPipeline({userDataDir,leaseRoot:join(fixture,'isolated-project-leases')});
  try { const selected = await pipeline.selectProject(customer); assert.equal(selected.ok, true,JSON.stringify(selected)); assert.deepEqual(selected.value.roles.map((item) => item.id), ['Acceptance', 'ProjectManager', 'RoleArchitect', 'Supervisor']); assert.equal(selected.value.roles.every((item) => item.status === 'system' && item.boundary.length === 0), true); assert.equal(selected.value.observation.status, 'unavailable'); assert.deepEqual(await readdir(customer), []); assert.equal(JSON.stringify(selected).includes('canonicalPath'), false); assert.equal((await pipeline.sendMessage({ projectId: selected.value.currentProject.id, roleId: 'Builder', text: '直接执行' })).error.code, 'manager_only');
    await writeFile(join(customer,'README.md'),'真实项目正文');
    const projectId=selected.value.currentProject.id,listed=await pipeline.listProjectFiles({projectId,resource:''});assert.equal(listed.ok,true,JSON.stringify(listed));assert.ok(listed.value.entries.some(item=>item.name==='README.md'));
    const read=await pipeline.readProjectFile({projectId,resource:'README.md',maxBytes:65536});assert.equal(read.ok,true,JSON.stringify(read));assert.equal(read.value.text,'真实项目正文');assert.equal(read.value.sha256.length,64);
    const activity=await pipeline.queryRoleActivity({projectId});assert.equal(activity.ok,true,JSON.stringify(activity));assert.ok(activity.value.roles.some(item=>item.id==='Supervisor'));
    const log=await pipeline.queryRoleLog({projectId,roleId:'Supervisor'});assert.equal(log.ok,true,JSON.stringify(log));assert.deepEqual(log.value.events,[]);
    const memory=await pipeline.queryProjectMemory({projectId});assert.equal(memory.ok,true,JSON.stringify(memory));assert.deepEqual(memory.value.facts,[]);
    assert.equal((await pipeline.readProjectFile({projectId,resource:'../outside'})).ok,false);
  } finally { await pipeline.close(); }
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
  assert.equal(renderer.roleRows.get('Builder').select.disabled, false);
  assert.equal(renderer.roleRows.get('Builder').button.hidden, false);
  document.getElementById('member-list').children[1].dispatchEvent(new Event('click'));
  assert.equal(renderer.zone, 'roles');
  assert.equal(renderer.selectedRoleId, 'Builder');
  assert.equal(document.getElementById('chat-scroll').scrollTop, 170);
  assert.equal(document.getElementById('details-drawer').scrollTop, 60);
  document.activeElement = document.getElementById('default-profile');
  const defaultOptions = document.activeElement.children;
  renderer.render({ ...dto, profiles: dto.profiles.map((profile) => ({ ...profile, name: `${profile.name}更新` })) });
  assert.equal(document.activeElement.children, defaultOptions);
  assert.equal(document.activeElement.value, 'p2');
  document.activeElement = null;
  renderer.render({ ...dto, currentProject: { ...dto.currentProject, id: 'b'.repeat(64) } });
  assert.equal(document.getElementById('chat-scroll').scrollTop, 1200);
  assert.equal(document.getElementById('message-input').value, '');
  renderer.render(dto);
  assert.equal(document.getElementById('message-input').value, '正在编辑的需求');
  document.getElementById('chat-scroll').scrollTop = 170;
  renderer.navigate('settings');
  renderer.navigate('conversation');
  assert.equal(document.getElementById('chat-scroll').scrollTop, 170);
});
test('send and credential saves retain drafts on failure; successful send uses the internal Supervisor role and clears the accepted draft', async () => {
  const document = new Document(); const calls = []; let fail = true; const dto = state(); const api = { sendMessage: async (input) => { calls.push(input); if (fail) return { ok: false, error: { message: '安全错误' } }; return { ok: true, value: dto }; }, saveProfile: async () => ({ ok: false, error: { message: '加密不可用' } }) }; const renderer = new _Renderer(document, api); renderer.render(dto); document.getElementById('message-input').value = '需求'; await renderer.send(); assert.equal(document.getElementById('message-input').value, '需求'); fail = false; await renderer.send(); assert.equal(document.getElementById('message-input').value, ''); assert.equal(calls.every((input) => input.roleId === 'Supervisor'), true); document.getElementById('api-key').value = 'secret-draft'; document.getElementById('key-action').value = 'replace'; await renderer.saveProfile(); assert.equal(document.getElementById('api-key').value, 'secret-draft');
});
test('customer connection copy names 二哥 while preserving the real background PM and only invalidates active plans',async()=>{
 const document=new Document(),dto=state();let response=dto;
 const renderer=new _Renderer(document,{saveProfile:async()=>({ok:true,value:response})});renderer.render(dto);
 assert.match(document.getElementById('default-profile-hint').textContent,/二哥.*后台 PM.*没有活动计划/u);
 assert.equal(renderer.memberName(dto.roles[0]),'后台项目管理');
 await renderer.saveProfile();assert.match(document.getElementById('notice').textContent,/后续讨论可使用/u);assert.equal(document.getElementById('notice').textContent.includes('失效'),false);
 const active={...dto,plan:governedUiState().plan};response=active;renderer.render(active);await renderer.saveProfile();assert.match(document.getElementById('notice').textContent,/原活动计划已失效/u);
});
test('customer model identity and Human confirmation say 二哥 without renaming the internal Supervisor instance',async()=>{
 const source=await readFile(new URL('../../src/pipelines/workbench.mjs',import.meta.url),'utf8');
 assert.match(source,/const prompt = \['你是二哥（内部Supervisor），唯一客户对话入口/u);
 assert.match(source,/boundedModelPrompt\(\['你是二哥（内部Supervisor）。真实Human答复已记录/u);
 assert.match(source,/二哥建议 \$\{supervision\.recommendation\}/u);
 assert.match(source,/name: 'Supervisor'/u);
 assert.match(source,/name:'Supervisor'/u);
 assert.match(source,/const GUIDE = `你是项目唯一ProjectManager/u);
});
test('display hides plan JSON without mutating history, missing outputs and software checks remain honest', async () => {
  const text = '自然语言方案\n```legion-plan\n{"goal":"内部数据"}\n```'; assert.equal(conversationDisplay(text), '自然语言方案'); assert.ok(text.includes('内部数据')); const task = { results: [], writeSet: ['a.txt', 'b.txt'] }; assert.match(resultSummary(task), /实际修改 0 个文件/u); assert.match(resultSummary(task), /not_executed/u);
  assert.match(conversationDisplay('```legion-plan\n{"goal":"尚在生成"'), /^二哥已带来一份待确认的计划/u);
  const source = await readFile(new URL('../../src/interface/renderer.mjs', import.meta.url), 'utf8'); assert.equal(/innerHTML|outerHTML|insertAdjacentHTML|eval\(|new Function|require\(/u.test(source), false); assert.match(source, /setInterval[\s\S]*1000/u);
});

test('renderer shows persisted owners, explicit transfer and edited file result', () => {
  const document = new Document(); const renderer = new _Renderer(document, {});
  const dto = state();
  dto.fileOwners = { projectId, version: 'owners-v1', owners: [{ resource: 'src/a.txt', roleId: 'Builder' }] };
  dto.plan = { goal: '转交文件', status: 'draft', organizationVersion: 'customer-v2', revision: 2,
    roles: [{ id: 'Editor', name: '编辑', purpose: '修改', profileId: 'p1' }], tasks: [], profileBindings: [],
    fileOwnership: { baseVersion: 'owners-v1', nextVersion: 'owners-v2',
      claims: [{ resource: 'src/a.txt', roleId: 'Editor' }],
      transfers: [{ resource: 'src/a.txt', fromRoleId: 'Builder', toRoleId: 'Editor' }] } };
  dto.tasks = [{ id: 'edit', title: '局部编辑', roleId: 'Editor', dependsOn: [], status: 'completed', writeSet: ['src/a.txt'],
    results: [{ resource: 'src/a.txt', status: 'written', reason: 'written', success: true,
      action: 'edit_file', contentDigest: 'a'.repeat(64), observedMutation: true, auditFailed: false }],
    updatedAt: '2026-10-08T00:00:00.000Z' }];
  renderer.render(dto);
  assert.match(document.getElementById('file-owners').children[0].textContent, /src\/a\.txt → Builder/u);
  assert.match(document.getElementById('plan-ownership').children.at(-1).textContent, /Builder → Editor/u);
  assert.match(document.getElementById('execution-results').children[0].children.at(-1).textContent, /局部编辑.*最终 SHA/u);
});

test('three modal kinds submit exact finite answers; dismiss never answers and polling preserves focus and member identity', async () => {
  const document = new Document(); const calls = []; let dto = state();
  const api = { answerInteraction: async (input) => { calls.push(['answer', input]); dto = { ...dto, interactions: dto.interactions.map((request) => ({ ...request, status: 'answered', answer: { value: input.value } })) }; return { ok: true, value: dto }; }, closeInteraction: async (input) => { calls.push(['close', input]); return { ok: true, value: dto }; } };
  const renderer = new _Renderer(document, api); let order = 0;
  for (const kind of ['question', 'choice', 'confirmation']) {
    order += 1; const request = { projectId, requestId: 'request-' + order, version: 1, digest: 'b'.repeat(64), kind, purpose: 'discussion', title: kind, text: '请求内容', options: [], allowSupplement: false, status: 'pending', answer: null };
    if (kind === 'choice') { request.options = [{id:'a',label:'选项A'}]; request.allowSupplement = true; }
    dto = { ...dto, interactions: [request] }; renderer.render(dto); const member = document.getElementById('member-list').children[0]; document.activeElement = document.getElementById('message-input');
    renderer.render({ ...dto }); assert.equal(document.getElementById('member-list').children[0], member); assert.equal(Boolean(document.getElementById('interaction-modal').open), false);
    renderer.openInteraction(); assert.equal(document.getElementById('interaction-modal').open, true); await renderer.dismissInteraction(); assert.equal(calls.at(-1)[0], 'close'); assert.equal(dto.interactions[0].status, 'pending');
    renderer.openInteraction(); document.getElementById('interaction-answer').value = '真实补充'; document.selectedChoice = { value: 'a' }; await renderer.submitInteraction(kind === 'confirmation');
    const answer = calls.at(-1); assert.equal(answer[0], 'answer'); assert.deepEqual(Object.keys(answer[1]).sort(), ['projectId', 'requestDigest', 'requestId', 'value', 'version']);
    if (kind === 'question') assert.equal(answer[1].value, '真实补充');
    if (kind === 'choice') assert.deepEqual(answer[1].value, {optionId:'a',text:'真实补充'});
    if (kind === 'confirmation') assert.equal(answer[1].value, false);
    assert.equal(document.getElementById('interaction-modal').open, false);
  }
});

function pendingRequest(kind = 'question', purpose = 'discussion') {
  return { projectId, requestId: 'request-current', version: 1, digest: 'b'.repeat(64), kind, purpose, title: '请核对', text: '真实请求文本', options: [], allowSupplement: false, bindings: {}, status: 'pending', answer: null };
}
function governedUiState() {
  const dto = state(); const check = { checkId: 'unit-source', kind: 'node-test', argv: ['--test', 'tests/source.test.mjs'], testResources: ['tests/source.test.mjs'], inputResources: ['src/source.mjs'], outputResources: [], timeoutSeconds: 20, network: 'none', logMaxBytes: 4096 };
  dto.plan = { goal: '完成真实文件修改', planDigest: 'c'.repeat(64), status: 'draft', organizationVersion: 'customer-v2', revision: 3, contextSnapshotDigest: 'd'.repeat(64), governance: { organizationRevision: 2, organizationDigest: 'e'.repeat(64), maxRepairRounds: 2 }, roles: [{ id: 'Builder', name: '执行成员', profileId: 'p1', revision: 2, digest: 'f'.repeat(64) }, { id: 'Acceptance', name: '独立验收', profileId: 'p2', revision: 1, digest: 'a'.repeat(64) }], profileBindings: [{ profileId: 'p1', profileVersion: '1'.repeat(64) }, { profileId: 'p2', profileVersion: '2'.repeat(64) }], tasks: [{ id: 'build', title: '修改源码', roleId: 'Builder', profileId: 'p1', dependsOn: [], writeSet: ['src/source.mjs', 'tests/source.test.mjs'], instruction: '修改源码并检查', checks: [check] }, { id: 'accept', title: '独立验收', roleId: 'Acceptance', profileId: 'p2', dependsOn: ['build'], accepts: ['build'], writeSet: ['tests/Acceptance/source.test.mjs'], instruction: '验证完整行为', checks: [{ ...check, checkId: 'independent' }] }], fileOwnership: { baseDigest: '3'.repeat(64), nextDigest: '4'.repeat(64), claims: [{ resource: 'src/source.mjs', roleId: 'Builder' }, { resource: 'tests/source.test.mjs', roleId: 'Builder' }, { resource: 'tests/Acceptance/source.test.mjs', roleId: 'Acceptance' }], transfers: [{ resource: 'src/source.mjs', fromRoleId: 'OldBuilder', toRoleId: 'Builder' }] } };
  dto.fileOwners={projectId,version:'owners-v2',owners:dto.plan.fileOwnership.claims};dto.plan.schemaVersion=2;for(const task of dto.plan.tasks){task.intent='change';delete task.writeSet;}
  return dto;
}

test('welcome uses complete timeline, preserves actual system members and returns from settings at the same reading position', () => {
  const document = new Document(); const renderer = new _Renderer(document, {}); const dto = state();
  dto.roles.push({ id: 'Acceptance', name: '独立验收', purpose: '验证', profileId: 'p1', activity: 'waiting' }, { id: 'RoleArchitect', name: '角色架构师', purpose: '职责设计', profileId: 'p1', activity: 'working' });
  renderer.render(dto); assert.equal(document.getElementById('welcome').hidden, false); assert.equal(document.getElementById('conversation-page').classes.has('welcome-mode'), true);
  dto.timeline = { legacyMessages: [], messages: [{ id: 'message-stable', kind: 'assistant', text: '持久新历史', orderKnown: true }] };
  renderer.render(dto); assert.equal(document.getElementById('welcome').hidden, true); const message = document.getElementById('messages').children[0];
  document.getElementById('chat-scroll').scrollTop = 150; renderer.navigate('settings'); renderer.navigate('conversation'); renderer.render({ ...dto });
  assert.equal(document.getElementById('chat-scroll').scrollTop, 150); assert.equal(document.getElementById('messages').children[0], message); assert.equal(renderer.memberNodes.size, 4);
  assert.match(renderer.memberNodes.get('RoleArchitect').button.attributes['aria-label'], /正在工作/u);
});

test('member selection opens the role workspace while connection mapping still uses assignProfile', async () => {
  const document = new Document(); const calls = []; const dto = state(); const renderer = new _Renderer(document, { assignProfile: async (input) => { calls.push(input); return { ok: true, value: dto }; } });
  document.getElementById('details-drawer').hidden = true; renderer.render(dto); const input = document.getElementById('message-input'); input.focus();
  renderer.memberNodes.get('Builder').button.dispatchEvent(new Event('click'));
  assert.deepEqual(calls, []); assert.equal(renderer.zone, 'roles'); assert.equal(renderer.selectedRoleId, 'Builder'); renderer.selectZone('conversation'); assert.equal(document.activeElement, input);
  const row = renderer.roleRows.get('Builder'); row.select.value = 'p2'; row.select.dispatchEvent(new Event('change')); row.button.dispatchEvent(new Event('click')); await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, [{ roleId: 'Builder', profileId: 'p2' }]); assert.equal(renderer.mappingDrafts.has('Builder'), false);
});

test('keyboard IME and waiting block send; execution permits Su readonly dialogue; in-flight edits survive accepted earlier message', async () => {
  const document = new Document(); const dto = state(); const calls = []; let finish; const renderer = new _Renderer(document, { getState: async () => ({ ok: true, value: dto }), sendMessage: (input) => { calls.push(input); return new Promise((resolve) => { finish = resolve; }); } });
  renderer.render(dto); renderer.start(); await new Promise((resolve) => setImmediate(resolve));
  try {
    const input = document.getElementById('message-input'); input.value = '输入法草稿'; const composing = new Event('keydown', { cancelable: true }); Object.assign(composing, { key: 'Enter', ctrlKey: true, isComposing: true }); input.dispatchEvent(composing); assert.deepEqual(calls, []);
    renderer.render({ ...dto, turn: { status: 'waiting' } }); await renderer.send(); assert.deepEqual(calls, []);
    renderer.render({ ...dto, plan: { ...governedUiState().plan, status: 'running' } }); const duringExecution=renderer.send();assert.equal(calls.length,1);assert.equal(calls[0].roleId,'Supervisor');finish({ok:true,value:dto});await duringExecution;
    renderer.render(dto);input.value='下一轮只读问题'; const sending = renderer.send(); input.value = '发送期间的新想法'; await renderer.send(); assert.equal(calls.length, 2); finish({ ok: true, value: dto }); await sending; assert.equal(input.value, '发送期间的新想法'); assert.equal(calls[1].roleId, 'Supervisor');
  } finally { renderer.stop(); }
});

test('pending request close retains draft and focus, does not submit, and duplicate submissions stay locked until completion', async () => {
  const document = new Document(); let dto = { ...state(), interactions: [pendingRequest()] }; const calls = []; let finish;
  const api = { closeInteraction: async (input) => { calls.push(['close', input]); return { ok: true, value: dto }; }, answerInteraction: (input) => { calls.push(['answer', input]); return new Promise((resolve) => { finish = resolve; }); } };
  const renderer = new _Renderer(document, api); renderer.render(dto); document.getElementById('pending-interaction').focus(); renderer.openInteraction(); document.getElementById('interaction-answer').value = '稍后继续的答案'; await renderer.dismissInteraction();
  assert.equal(calls.length, 1); assert.equal(calls[0][0], 'close'); assert.equal(document.activeElement, document.getElementById('pending-interaction')); assert.equal(dto.interactions[0].status, 'pending'); assert.equal(document.getElementById('pending-interaction').hidden, false);
  renderer.openInteraction(); assert.equal(document.getElementById('interaction-answer').value, '稍后继续的答案'); const submitted = renderer.submitInteraction(); await renderer.submitInteraction(); assert.equal(calls.length, 2); assert.equal(document.getElementById('interaction-submit').disabled, true);
  dto = { ...dto, interactions: [{ ...dto.interactions[0], status: 'answered' }] }; finish({ ok: true, value: dto }); await submitted;
  assert.equal(document.getElementById('interaction-modal').open, false); assert.deepEqual(Object.keys(calls[1][1]).sort(), ['projectId', 'requestDigest', 'requestId', 'value', 'version']); assert.equal(calls[1][1].value, '稍后继续的答案');
});

test('invalid question/choice never call IPC; failures keep answers and stale requests cannot submit older versions', async () => {
  const document = new Document(); const calls = []; let dto = { ...state(), interactions: [pendingRequest()] }; const renderer = new _Renderer(document, { answerInteraction: async (input) => { calls.push(input); return { ok: false, error: { code: 'organization_busy', message: '忙，请重试' } }; } }); renderer.render(dto); renderer.openInteraction();
  document.getElementById('interaction-answer').value = '  '; await renderer.submitInteraction(); assert.deepEqual(calls, []);
  document.getElementById('interaction-answer').value = '真实答案'; await renderer.submitInteraction(); assert.equal(document.getElementById('interaction-modal').open, true); assert.equal(document.getElementById('interaction-answer').value, '真实答案'); assert.match(document.getElementById('interaction-error').textContent, /忙/u);
  dto = { ...dto, interactions: [{ ...dto.interactions[0], version: 2, digest: 'c'.repeat(64) }] }; renderer.render(dto); await renderer.submitInteraction(); assert.equal(calls.length, 1); assert.equal(document.getElementById('interaction-submit').disabled, true); assert.equal(document.getElementById('interaction-answer').value, '真实答案');
  renderer.openInteraction(); assert.equal(renderer.modalRequest.version, 2); assert.equal(document.getElementById('interaction-answer').value, '');
  const choice = { ...pendingRequest('choice'), options: [{ id: 'a', label: '实际选项' }] }; renderer.render({ ...state(), interactions: [choice] }); renderer.openInteraction(); document.selectedChoice = { value: 'fake' }; await renderer.submitInteraction(); assert.equal(calls.length, 1);
});

test('execution confirmation includes every exact file/owner/transfer, checks/accepts, connection versions, limit and current digest', () => {
  const document = new Document(); const renderer = new _Renderer(document, {}); const dto = governedUiState(); const request = pendingRequest('confirmation', 'execute_plan'); request.bindings = { planDigest: dto.plan.planDigest, organizationRevision: 2, organizationDigest: dto.plan.governance.organizationDigest }; dto.interactions = [request]; renderer.render(dto); renderer.openInteraction();
  const scope = document.getElementById('interaction-scope'); const text = scope.textContent;
  for (const expected of ['src/source.mjs → Builder', 'tests/source.test.mjs → Builder', 'tests/Acceptance/source.test.mjs → Acceptance', 'OldBuilder → Builder', 'unit-source', 'independent', '--test tests/source.test.mjs', '独立验收覆盖：build', '依赖：build', '最多返修 2 轮', '1'.repeat(64), '2'.repeat(64), dto.plan.planDigest, request.digest]) assert.ok(text.includes(expected), expected);
  assert.equal(scope.querySelectorAll('details[data-key]').filter((node) => node.dataset.key.startsWith('check-')).every((node) => node.open), true); assert.equal(document.getElementById('interaction-submit').disabled, false);
  renderer.state = { ...dto, plan: { ...dto.plan, planDigest: '9'.repeat(64) } }; renderer.openInteraction(); assert.equal(document.getElementById('interaction-submit').disabled, true); assert.match(scope.textContent, /计划已变化/u);
});

test('historical checks retain true status/count/SHA/stderr/truncation; independent failures and repair limits remain distinct', () => {
  const document = new Document(); const renderer = new _Renderer(document, {}); const dto = governedUiState();
  dto.evidence = [{ id: 'evidence-history', roleId: 'Builder', taskId: 'build', planDigest: '8'.repeat(64), result: { checkId: 'old-check', status: 'unsupported', testCount: 0, executed: false, reason: 'isolation_unsupported', exitCode: null, startedAt: null, finishedAt: null, inputVersions: [{ resource: 'src/source.mjs', sha256: '6'.repeat(64), byteLength: 20 }], stdout: '', stderr: '真实错误日志', logsTruncated: true, environment: null } }];
  dto.acceptances = [{ id: 'failed-acceptance', taskId: 'accept', planDigest: dto.plan.planDigest, decision: 'fail', evidenceIds: ['evidence-history'], issues: [{ taskId: 'build', resource: 'src/source.mjs', roleId: 'Builder', expected: '期待结果', actual: '实际失败', reproduction: '重现步骤' }] }]; dto.repairs = [{ id: 'repair-2', taskId: 'build', roleId: 'Builder', planDigest: dto.plan.planDigest, round: 2, reason: '依据真实失败返修', writeSet: ['src/source.mjs'], checks: [] }]; renderer.render(dto);
  const records = document.getElementById('execution-results'); for (const text of ['历史计划', '不支持', '实际测试 0 项', '真实错误日志', '裁剪', '6'.repeat(64)]) assert.ok(records.textContent.includes(text), text); assert.equal(records.textContent.includes('检查通过'), false);
  const acceptance = document.getElementById('acceptance-results'); for (const text of ['验收失败', '期待结果', '实际失败', '重现步骤', '原成员 Builder', '第 2 轮返修', '重新讨论']) assert.ok(acceptance.textContent.includes(text), text);
  const detail = records.querySelectorAll('details[data-key]')[0]; detail.open = true; detail.children[0].focus(); renderer.render({ ...dto, observation: { ...dto.observation, observedAt: '2026-10-09T00:00:00.000Z' } }); assert.equal(records.querySelectorAll('details[data-key]')[0], detail); assert.equal(document.activeElement, detail.children[0]); assert.equal(detail.open, true);
});


test('actual record changes replace focused summary; Chromium BODY fallback restores same key/open/scroll without taking intentional focus', () => {
  const document = new Document(); const renderer = new _Renderer(document, {}); const records = document.getElementById('execution-results');
  const build = (text, moveFocus = null) => (node) => { const detail = renderer.disclosure('evidence-one', 'Actual check'); detail.append(renderer.node('p', text)); node.append(detail); if (moveFocus) moveFocus.focus(); };
  renderer.region('execution-results', 'current', build('current plan'));
  const originalDetail = records.children[0]; const originalSummary = originalDetail.children[0]; originalDetail.open = true; records.scrollTop = 71; originalSummary.focus();
  const sentinel = document.createElement('summary'); records.append(sentinel); sentinel.focus(); sentinel.remove();
  assert.equal(document.activeElement, document.body); assert.equal(document.body.isConnected, true); originalSummary.focus();
  renderer.region('execution-results', 'historical', build('historical plan'));
  const replacement = records.children[0]; assert.notEqual(replacement, originalDetail); assert.equal(originalSummary.isConnected, false); assert.equal(document.activeElement, replacement.children[0]); assert.equal(replacement.open, true); assert.equal(records.scrollTop, 71); assert.match(records.textContent, /historical plan/u);
  renderer.region('execution-results', 'historical', build('historical plan')); assert.equal(records.children[0], replacement); assert.equal(document.activeElement, replacement.children[0]);
  const anotherControl = document.getElementById('message-input'); replacement.children[0].focus(); renderer.region('execution-results', 'changed-again', build('changed input fact', anotherControl));
  assert.equal(document.activeElement, anotherControl); assert.equal(records.children[0].open, true); assert.equal(records.scrollTop, 71);
});

test('current conversation/settings page and selected real project expose aria-current through navigation', () => {
  const document = new Document(); const renderer = new _Renderer(document, {}); const conversation = document.getElementById('conversation-nav'); conversation.dataset.page = 'conversation'; const settings = document.getElementById('settings-nav'); settings.dataset.page = 'settings';
  const dto = state(); dto.projects = [{ id: projectId, name: '当前项目' }, { id: 'b'.repeat(64), name: '其他项目' }]; renderer.render(dto); renderer.navigate('conversation');
  assert.equal(conversation.attributes['aria-current'], 'page'); assert.equal(settings.attributes['aria-current'], 'false');
  const projects = document.getElementById('project-list').children; assert.equal(projects[0].attributes['aria-current'], 'true'); assert.equal(projects[1].attributes['aria-current'], 'false');
  renderer.navigate('settings'); assert.equal(conversation.attributes['aria-current'], 'false'); assert.equal(settings.attributes['aria-current'], 'page'); renderer.navigate('conversation'); assert.equal(conversation.attributes['aria-current'], 'page');
});


test('real disabled to BODY branch restores the actual submit or reject focus after ordinary host answer failure', async () => {
  for (const rejected of [false, true]) {
    const document = new Document(); const request = pendingRequest('confirmation'); const dto = { ...state(), interactions: [request] }; let finish; const calls = [];
    const renderer = new _Renderer(document, { answerInteraction: (input) => { calls.push(input); return new Promise((resolve) => { finish = resolve; }); } }); renderer.render(dto); renderer.openInteraction(); document.getElementById('interaction-answer').value = '保留草稿';
    let initiator = document.getElementById('interaction-submit'); if (rejected) initiator = document.getElementById('interaction-reject'); initiator.focus(); const submitting = renderer.submitInteraction(rejected);
    assert.equal(document.activeElement, document.body); assert.equal(initiator.disabled, true); assert.equal(calls.length, 1); assert.equal(calls[0].value, !rejected);
    finish({ ok: false, error: { code: 'organization_busy', message: '组织事务忙，请重试。' } }); await submitting;
    assert.equal(document.getElementById('interaction-modal').open, true); assert.equal(document.getElementById('interaction-answer').value, '保留草稿'); assert.equal(initiator.disabled, false); assert.equal(document.activeElement, initiator); assert.match(document.getElementById('interaction-error').textContent, /组织事务忙/u);
  }
});

test('ordinary host answer failure keeps a user focus move into the answer editor instead of restoring the submit button', async () => {
  const document = new Document(); const dto = { ...state(), interactions: [pendingRequest()] }; let finish; const renderer = new _Renderer(document, { answerInteraction: () => new Promise((resolve) => { finish = resolve; }) }); renderer.render(dto); renderer.openInteraction(); const answer = document.getElementById('interaction-answer'); answer.value = '真实答案';
  document.getElementById('interaction-submit').focus(); const submitting = renderer.submitInteraction(); assert.equal(document.activeElement, document.body); answer.focus(); answer.value = '等待期间补充'; finish({ ok: false, error: { code: 'organization_busy', message: '组织事务忙' } }); await submitting;
  assert.equal(document.activeElement, answer); assert.equal(answer.value, '等待期间补充'); assert.equal(document.getElementById('interaction-modal').open, true); assert.equal(document.getElementById('interaction-submit').disabled, false);
});

test('stale host answer failure never focuses or enables the older submit; BODY moves to the valid close action', async () => {
  const document = new Document(); const request = pendingRequest(); const dto = { ...state(), interactions: [request] }; const updated = { ...dto, interactions: [{ ...request, version: 2, digest: 'c'.repeat(64) }] };
  const renderer = new _Renderer(document, { answerInteraction: async () => ({ ok: false, error: { code: 'stale_interaction', message: '请求已更新' } }), getState: async () => ({ ok: true, value: updated }) }); renderer.render(dto); renderer.openInteraction(); document.getElementById('interaction-answer').value = '旧请求答案'; document.getElementById('interaction-submit').focus(); await renderer.submitInteraction();
  assert.equal(document.getElementById('interaction-submit').disabled, true); assert.equal(document.getElementById('interaction-close').disabled, false); assert.equal(document.activeElement, document.getElementById('interaction-close')); assert.equal(document.getElementById('interaction-answer').value, '旧请求答案'); assert.equal(document.getElementById('interaction-modal').open, true); assert.match(document.getElementById('interaction-error').textContent, /请求已更新/u);
});


test('real role activity waiting means waiting for tasks; only waiting_answer is waiting for a Human reply and legacy duties stay explicit', () => {
  const document = new Document(); const renderer = new _Renderer(document, {}); const dto = state(); dto.roles = [
    { id: 'Builder', name: '执行成员', purpose: '实现', profileId: 'p1', status: 'approved', activity: 'waiting' },
    { id: 'Questioner', name: '等待答复成员', purpose: '提问', profileId: 'p1', status: 'approved', activity: 'waiting_answer' },
    { id: 'Legacy', name: '历史成员', purpose: '', profileId: 'p1', status: 'legacy', activity: 'waiting' }
  ]; renderer.render(dto);
  const waiting = renderer.memberNodes.get('Builder').button; assert.equal(waiting.dataset.activity, 'waiting'); assert.equal(waiting.attributes.title, '执行成员 · 项目角色 · 实现 · 等待任务'); assert.match(waiting.attributes['aria-label'], /等待任务/u); assert.equal(waiting.attributes['aria-label'].includes('等待答复'), false); assert.match(renderer.roleRows.get('Builder').purpose.textContent, /当前状态：等待任务/u);
  const waitingAnswer = renderer.memberNodes.get('Questioner').button; assert.equal(waitingAnswer.dataset.activity, 'waiting_answer'); assert.equal(waitingAnswer.attributes.title, '等待答复成员 · 项目角色 · 提问 · 等待答复'); assert.match(renderer.roleRows.get('Questioner').purpose.textContent, /当前状态：等待答复/u);
  assert.equal(renderer.memberNodes.get('Legacy').button.attributes.title, '历史成员 · 来源未记录 · 职责摘要未记录 · 职责待补全'); assert.match(renderer.roleRows.get('Legacy').purpose.textContent, /当前状态：职责待补全/u);
  assert.equal(document.getElementById('pending-interaction').hidden, true); assert.equal(dto.turn, null);
});


test('production has exactly two official navigation markers while the independent welcome CTA still opens settings', async () => {
  const html = await readFile(new URL('../../src/interface/index.html', import.meta.url), 'utf8'); const nav = [...html.matchAll(/<button\b[^>]*\bdata-page="([^"]+)"/gu)];
  assert.equal(nav.length, 2); assert.deepEqual(nav.map((match) => match[1]).sort(), ['conversation', 'settings']); const welcomeTag = /<button\b[^>]*\bid="welcome-settings"[^>]*>/u.exec(html); assert.ok(welcomeTag); assert.equal(welcomeTag[0].includes('data-page'), false);
  const document = new Document(); const dto = { ...state(), profiles: [], defaultProfileId: null, roles: [] }; document.getElementById('conversation-nav').dataset.page = 'conversation'; document.getElementById('settings-nav').dataset.page = 'settings';
  const renderer = new _Renderer(document, { getState: async () => ({ ok: true, value: dto }) }); renderer.start(); await new Promise((resolve) => setImmediate(resolve));
  try {
    assert.equal(document.getElementById('welcome-settings').hidden, false); assert.equal(document.querySelectorAll('[data-page]').length, 2); document.getElementById('welcome-settings').dispatchEvent(new Event('click'));
    assert.equal(renderer.page, 'settings'); assert.equal(document.getElementById('settings-page').hidden, false); assert.equal(document.getElementById('command-grid').hidden, true); assert.equal(document.getElementById('settings-nav').attributes['aria-current'], 'page');
  } finally { renderer.stop(); }
});


test('locked local Lexer renders useful Markdown to real element types without HTML parser output', () => {
  const document = new Document(); const source = '# 标题\n\n正文 **加粗** 与 *强调*，`inline()`。\n\n> 引用文字\n\n1. 第一项\n2. 第二项\n\n- 无序项\n\n```js\nconst x = "<script>";\n```\n\n| 名称 | 值 |\n| --- | ---: |\n| **输入** | 2 |\n\n[文档](https://example.com/docs)';
  const { root, status } = _markdownContent(document, source, Lexer); assert.equal(status, 'formatted');
  for (const tag of ['h1', 'p', 'strong', 'em', 'code', 'blockquote', 'ol', 'ul', 'li', 'pre', 'table', 'thead', 'tbody', 'th', 'td', 'a']) assert.ok(root.querySelectorAll(tag).length, tag);
  assert.equal(root.querySelectorAll('h1')[0].textContent, '标题'); assert.equal(root.querySelectorAll('pre')[0].textContent, 'const x = "<script>";');
  assert.equal(root.querySelectorAll('a')[0].attributes.href, 'https://example.com/docs'); assert.equal(root.querySelectorAll('a')[0].attributes.target, 'handwell-external-link'); assert.equal(root.querySelectorAll('th')[0].attributes.scope, 'col');
});

test('Markdown HTML/input/scripts/images stay text; only absolute credential-free HTTP(S) links are created and synthetic clicks are refused', () => {
  const document = new Document(); const source = '<script>alert(1)</script>\n\n<input autofocus onfocus="bad()">\n\n![可读图片](https://example.com/image.png)\n\n[危险](javascript:alert(1)) [文件](file:///private/test) [凭据](https://user:secret@example.com/)';
  const { root } = _markdownContent(document, source, Lexer); for (const tag of ['script', 'input', 'img', 'iframe', 'form', 'style']) assert.equal(root.querySelectorAll(tag).length, 0, tag);
  assert.ok(root.textContent.includes('<script>')); assert.ok(root.textContent.includes('<input')); assert.ok(root.textContent.includes('javascript:')); assert.ok(root.textContent.includes('file:///')); assert.ok(root.textContent.includes('图片：可读图片'));
  const links = root.querySelectorAll('a'); assert.equal(links.length, 1); assert.equal(links[0].attributes.href, 'https://example.com/image.png'); const synthetic = new Event('click', { cancelable: true }); links[0].dispatchEvent(synthetic); assert.equal(synthetic.defaultPrevented, true);
  for (const url of ['javascript:alert(1)', 'vbscript:msgbox(1)', 'data:text/html,hi', 'file:///a', 'mailto:a@example.com', '//example.com', 'https://u:p@example.com/', 'https://example.com/%0a', 'https://example.com/%250a', 'https:\\example.com', 'https://example.com/\n']) assert.equal(_markdownLinkUrl(url), null, url);
  assert.equal(_markdownLinkUrl('https://example.com/a%20b?q=ok#section'), 'https://example.com/a%20b?q=ok#section'); assert.equal(_markdownLinkUrl('http://localhost:8123/docs'), 'http://localhost:8123/docs');
});

test('streaming Markdown and unfinished protocol fences keep full raw text, while unchanged messages do not invoke Lexer again', () => {
  const original = globalThis.marked; let calls = 0; globalThis.marked = { Lexer: { lex: (...args) => { calls += 1; return Lexer.lex(...args); } } };
  try {
    const document = new Document(); const renderer = new _Renderer(document, {}); const text = '# 回复\n\n```js\nconst x = 1'; const dto = { ...state(), timeline: { legacyMessages: [], messages: [{ id: 'stream-one', kind: 'assistant', text, orderKnown: true }] } }; renderer.render(dto); const row = renderer.messageNodes.get('stream-one'); const raw = row.raw; assert.ok(raw); assert.equal(row.original.textContent, text); assert.equal(row.content.querySelectorAll('pre')[0].textContent, 'const x = 1'); const firstCalls = calls; renderer.render(dto); assert.equal(calls, firstCalls); assert.equal(renderer.messageNodes.get('stream-one').raw, raw);
    const protocol = '方案说明\n```legion-plan\n{"goal":"仍在流式生成"'; assert.equal(conversationDisplay(protocol), '方案说明'); dto.timeline.messages[0].text = protocol; renderer.render(dto); assert.equal(row.original.textContent, protocol); assert.equal(row.content.textContent.includes('仍在流式生成'), false); assert.equal(row.raw, raw); dto.timeline.messages[0].orderKnown = false; renderer.render(dto); assert.equal(row.original.textContent, protocol); assert.ok(row.content.textContent.includes('顺序未知'));
  } finally { if (original === undefined) delete globalThis.marked; else globalThis.marked = original; }
});

test('missing Lexer or display budget keeps complete readable plaintext with a local fallback notice', () => {
  const document = new Document(); const source = '**完整原文**'; const missing = _markdownContent(document, source, null); assert.equal(missing.status, 'plain_fallback'); assert.equal(missing.root.children[0].textContent, source); assert.match(missing.root.textContent, /Markdown 未加载/u);
  const long = '内容'.repeat(140000); const over = _markdownContent(document, long, Lexer); assert.equal(over.status, 'plain_fallback'); assert.equal(over.root.children[0].textContent, long); assert.match(over.root.textContent, /完整纯文本/u);
});

test('sidebar role selection opens the role workspace without taking the Su draft or changing the task drawer',()=>{
 const document=new Document(),renderer=new _Renderer(document,{}),dto=state();renderer.render(dto);const input=document.getElementById('message-input');input.value='未提交需求';const member=renderer.memberNodes.get('Builder').button;member.focus();member.dispatchEvent(new Event('click'));
 assert.equal(renderer.selectedRoleId,'Builder');assert.equal(renderer.zone,'roles');assert.equal(document.getElementById('command-grid').dataset.zone,'roles');assert.equal(document.getElementById('details-drawer').hidden,false);assert.equal(input.value,'未提交需求');assert.equal(document.activeElement,member);
 renderer.selectZone('conversation');assert.equal(input.value,'未提交需求');
});

test('private member replies never create renderer nodes while safe actions remain visible in role records',()=>{
 const document=new Document(),renderer=new _Renderer(document,{}),dto=state();dto.roles.push({id:'RoleArchitect',name:'RoleArchitect',purpose:'完整设计',profileId:'p1',activity:'working'});
 dto.memberConversations={runs:[{id:'actual-run',roleId:'RoleArchitect',taskId:'role-design',instanceId:'actual-instance',runId:'actual-run',status:'running',startedAt:'2026-10-09T00:00:00.000Z'}],events:[{id:'private',conversationId:'actual-run',kind:'assistant_text',text:'PRIVATE_ARCHITECT_TEXT',createdAt:'2026-10-09T00:00:00.000Z'},{id:'read',conversationId:'actual-run',kind:'tool_result',tool:'legion_read_file',status:'read',resource:'src/a.mjs',createdAt:'2026-10-09T00:00:01.000Z'}]};
 renderer.render(dto);renderer.openMember('RoleArchitect',null,'conversation');const log=document.getElementById('member-conversation-log');assert.equal(log.textContent.includes('PRIVATE_ARCHITECT_TEXT'),false);assert.match(log.textContent,/legion_read_file.*src\/a.mjs/u);assert.equal(log.querySelectorAll('a').length,0);
});

test('pending regression: an ended activity trigger falls back to its stable sidebar member on Escape and leaves intentionally moved focus alone', async () => {
  const document = new Document(); const dto = state(); dto.roles.find((role) => role.id === 'Builder').activity = 'working'; const renderer = new _Renderer(document, { getState: async () => ({ ok: true, value: dto }) }); renderer.render(dto); document.getElementById('details-drawer').hidden = true; renderer.start(); await new Promise((resolve) => setImmediate(resolve));
  try {
    const trigger = renderer.activityNodes.get('Builder'); const member = renderer.memberNodes.get('Builder').button; trigger.focus(); trigger.dispatchEvent(new Event('click')); dto.roles.find((role) => role.id === 'Builder').activity = 'waiting'; renderer.render(dto); assert.equal(trigger.isConnected, false); const escape = new Event('keydown', { cancelable: true }); Object.assign(escape, { key: 'Escape' }); document.getElementById('details-drawer').dispatchEvent(escape); assert.equal(document.activeElement, member); assert.equal(renderer.selectedMember, null); assert.equal(document.getElementById('details-drawer').hidden, true);
    dto.roles.find((role) => role.id === 'Builder').activity = 'working'; renderer.render(dto); const next = renderer.activityNodes.get('Builder'); next.focus(); next.dispatchEvent(new Event('click')); const editor = document.getElementById('message-input'); editor.focus(); renderer.toggleDetails(false); assert.equal(document.activeElement, editor);
  } finally { renderer.stop(); }
});


test('selected-member detail contains only its actual tasks/role card/evidence and resolved model connection', () => {
  const document = new Document(); const renderer = new _Renderer(document, {}); const dto = governedUiState(); dto.roles.push({ id: 'Acceptance', name: '独立验收', purpose: '独立检查', profileId: 'p2', activity: 'waiting' }); dto.tasks = dto.plan.tasks.map((task) => ({ id: task.id, title: task.title, roleId: task.roleId, dependsOn: task.dependsOn, intent:task.intent, status: 'pending', results: [], checkStatus: 'not_executed', updatedAt: '2026-10-09T00:00:00.000Z' })); dto.evidence = []; renderer.render(dto); renderer.openMember('Builder');
  assert.ok(document.getElementById('member-current-tasks').textContent.includes('修改源码')); assert.ok(document.getElementById('member-current-tasks').textContent.includes('src/source.mjs')); assert.equal(document.getElementById('member-current-tasks').textContent.includes('tests/Acceptance/source.test.mjs'), false); assert.equal(renderer.roleRows.get('Builder').card.hidden, false); assert.equal(renderer.roleRows.get('ProjectManager').card.hidden, true); assert.equal(renderer.roleRows.get('Acceptance').card.hidden, true); assert.ok(renderer.roleRows.get('Builder').connection.textContent.includes('本地连接')); assert.match(document.getElementById('member-current-evidence').textContent, /尚无实际检查证据/u);
  renderer.openMember('Acceptance'); assert.equal(renderer.roleRows.get('Builder').card.hidden, true); assert.equal(renderer.roleRows.get('Acceptance').card.hidden, false); assert.ok(document.getElementById('member-current-tasks').textContent.includes('tests/Acceptance/source.test.mjs'));
});


test('architect current role-design is shown alongside its older plan document task, and absent real run never invents design work', () => {
  const document = new Document(); const renderer = new _Renderer(document, {}); const dto = state(); dto.roles.push({ id: 'RoleArchitect', name: 'RoleArchitect', purpose: '角色设计', profileId: 'p1', activity: 'working' });
  const task = { id: 'old-doc', title: '旧角色文档计划', roleId: 'RoleArchitect', profileId: 'p1', dependsOn: [], writeSet: ['docs/roles/Backend/role-card.md'], instruction: '原计划文档发布', checks: [] }; dto.plan = { ...governedUiState().plan, tasks: [task] }; dto.tasks = [{ ...task, status: 'completed', results: [], checkStatus: 'not_executed', updatedAt: '2026-10-09T00:00:00.000Z' }]; dto.memberConversations = { runs: [{ id: 'new-design', roleId: 'RoleArchitect', taskId: 'role-design', instanceId: 'new-instance', runId: 'new-design', status: 'running', startedAt: '2026-10-09T00:00:00.000Z', finishedAt: null }], events: [] }; renderer.render(dto); renderer.openMember('RoleArchitect');
  const text = document.getElementById('member-current-tasks').textContent; assert.ok(text.includes('当前实际角色设计')); assert.ok(text.includes('完整角色方案设计 · 正在工作')); assert.ok(text.includes('计划中的角色文档任务')); assert.ok(text.includes('旧角色文档计划'));
  dto.memberConversations.runs = []; renderer.render(dto); const noRun = document.getElementById('member-current-tasks').textContent; assert.equal(noRun.includes('当前实际角色设计'), false); assert.equal(noRun.includes('完整角色方案设计 · 正在工作'), false); assert.ok(noRun.includes('旧角色文档计划'));
});

test('drawer tabs preserve Su draft and scroll while sidebar role selection opens the independent role area',async()=>{
 const document=new Document(),dto=state(),renderer=new _Renderer(document,{getState:async()=>({ok:true,value:dto})});renderer.render(dto);renderer.start();await new Promise(resolve=>setImmediate(resolve));
 try{document.getElementById('message-input').value='未发送新需求';renderer.selectTab('conversation');document.getElementById('details-scroll').scrollTop=80;renderer.selectTab('members');renderer.selectTab('conversation');assert.equal(document.getElementById('details-scroll').scrollTop,80);assert.equal(document.getElementById('message-input').value,'未发送新需求');
 const button=document.getElementById('tab-members');button.focus();const arrow=new Event('keydown',{cancelable:true});Object.assign(arrow,{key:'ArrowRight'});button.dispatchEvent(arrow);assert.equal(renderer.tab,'conversation');assert.equal(document.activeElement,document.getElementById('tab-conversation'));
 renderer.memberNodes.get('Builder').button.dispatchEvent(new Event('click'));assert.equal(renderer.zone,'roles');assert.equal(renderer.selectedRoleId,'Builder');assert.equal(document.getElementById('message-input').value,'未发送新需求');}finally{renderer.stop();}
});

test('system and project origin stay truthful while the historical Supervisor timeline displays the 二哥 identity',()=>{
 const document=new Document(),renderer=new _Renderer(document,{}),dto=state();dto.roles[0].status='approved';dto.roles[1].status='approved';dto.roles.push({id:'Old',name:'旧成员',status:'legacy',profileId:'p1'},{id:'Supervisor',name:'Supervisor',profileId:'p1',status:'system'});dto.timeline={legacyMessages:[],turns:[{id:'su-run',status:'completed'}],messages:[{id:'human',turnId:'su-run',kind:'human',text:'真实需求',createdAt:'2026-10-09T00:00:00.000Z',orderKnown:true},{id:'su',turnId:'su-run',kind:'assistant',text:'真实Su回复',createdAt:'2026-10-09T00:00:01.000Z',orderKnown:true},{id:'question',turnId:'su-run',requestId:'question-request',kind:'question',text:'后台PM原问题：请补充文件格式',createdAt:'2026-10-09T00:00:02.000Z',orderKnown:true}]};renderer.render(dto);
 assert.match(renderer.memberNodes.get('ProjectManager').origin.textContent,/^系统角色 · 澄清需求/u);assert.match(renderer.memberNodes.get('Builder').origin.textContent,/^项目角色 · 执行确认后的任务/u);assert.match(renderer.memberNodes.get('Old').origin.textContent,/^来源未记录/u);assert.equal(renderer.memberNodes.get('ProjectManager').name.textContent,'后台项目管理');assert.match(document.getElementById('messages').textContent,/真实需求.*真实Su回复.*后台PM原问题/u);
 assert.equal(renderer.messageNodes.get('human').name.textContent,'你');assert.equal(renderer.messageNodes.get('su').name.textContent,'二哥');assert.equal(renderer.messageNodes.get('su').avatar.textContent,'二哥');assert.equal(renderer.messageNodes.get('question').name.textContent,'二哥 · 转达待答复问题');assert.equal(renderer.messageNodes.get('question').avatar.textContent,'二哥');assert.equal(document.getElementById('task-next-step').textContent.includes('项目管理'),false);assert.match(document.getElementById('task-next-step').textContent,/二哥/u);
 assert.equal(renderer.memberNodes.has('Supervisor'),false);assert.equal(document.getElementById('entry-status').textContent,'待讨论');assert.equal(document.getElementById('entry-badge').hidden,false);assert.equal(document.getElementById('role-count').textContent,'3');assert.equal(renderer.roleRows.get('Supervisor').select.attributes['aria-label'],'二哥 AI 连接');assert.match(renderer.roleRows.get('Supervisor').name.textContent,/二哥 · Supervisor/u);
 assert.equal(document.getElementById('conversation-page').attributes['aria-label'],'二哥客户对话');assert.equal(document.getElementById('message-input').attributes['aria-label'],'给二哥的消息');
 renderer.openMember('Supervisor',null,'conversation');assert.equal(document.getElementById('member-conversation-log').textContent.includes('真实Su回复'),false);
});
test('sidebar separates the single customer entry from view-only roles and uses real plan, turn and request states',()=>{
 const document=new Document(),renderer=new _Renderer(document,{}),dto=state();dto.roles[1].status='approved';dto.roles.push({id:'Supervisor',name:'Supervisor',purpose:'当前客户对话',profileId:'p1',status:'system',activity:'waiting'});renderer.render(dto);
 const entry=document.getElementById('conversation-nav'),status=document.getElementById('entry-status'),other=renderer.memberNodes.get('Builder');
 assert.equal(entry.disabled,false);assert.equal(status.textContent,'待讨论');assert.equal(document.getElementById('entry-badge').hidden,false);assert.equal(renderer.memberNodes.has('Supervisor'),false);assert.equal(document.getElementById('role-count').textContent,'2');
 assert.match(other.origin.textContent,/执行确认后的任务/u);assert.equal(other.statusText.textContent,'等待任务');assert.match(other.button.attributes.title,/项目角色.*执行确认后的任务.*等待任务/u);
 document.getElementById('message-input').value='保留的客户草稿';document.getElementById('message-input').focus();renderer.render({...dto});assert.equal(renderer.memberNodes.get('Builder').button,other.button);assert.equal(document.getElementById('message-input').value,'保留的客户草稿');assert.equal(document.activeElement,document.getElementById('message-input'));
 renderer.state={...dto,plan:{status:'draft'},interactions:[]};renderer.renderSidebar();assert.equal(status.textContent,'计划草案');
 renderer.state={...dto,plan:{status:'draft'},interactions:[{status:'pending',purpose:'execute_plan'}]};renderer.renderSidebar();assert.equal(status.textContent,'等待你确认');
 renderer.state={...dto,turn:{status:'waiting'},interactions:[{status:'pending',purpose:'discussion'}]};renderer.renderSidebar();assert.equal(status.textContent,'等待你的答复');
 renderer.state={...dto,plan:{status:'running'},turn:{status:'completed'},interactions:[]};renderer.renderSidebar();assert.match(status.textContent,/执行中.*可问进度/u);
 renderer.state=dto;renderer.zone='roles';renderer.syncEntrySelection();assert.equal(entry.attributes['aria-current'],'false');renderer.openCustomerEntry();assert.equal(renderer.zone,'conversation');assert.equal(entry.attributes['aria-current'],'page');assert.equal(document.activeElement,document.getElementById('message-input'));assert.equal(document.getElementById('message-input').value,'保留的客户草稿');
 renderer.navigate('settings');other.button.dispatchEvent(new Event('click'));assert.equal(renderer.page,'conversation');assert.equal(renderer.zone,'roles');assert.equal(renderer.selectedRoleId,'Builder');assert.equal(entry.attributes['aria-current'],'false');
 renderer.state={...dto,roles:dto.roles.filter(role=>role.id!=='Supervisor')};renderer.renderSidebar();assert.equal(entry.disabled,true);assert.equal(status.textContent,'入口不可用');assert.equal(document.getElementById('entry-badge').hidden,true);
 renderer.projectId=null;renderer.state={...dto,currentProject:null,roles:[]};renderer.renderSidebar();assert.equal(entry.disabled,true);assert.equal(status.textContent,'先选择项目');
});
test('project command workspace reads real files and paged facts without touching Su draft',async()=>{
 const document=new Document(),dto=state(),calls=[];
 dto.roles.push({id:'Supervisor',name:'Supervisor',profileId:'p1',status:'system'});
 dto.plan={planDigest:'a'.repeat(64),status:'running',tasks:[],roles:[],governance:{maxRepairRounds:2},profileBindings:[],fileOwnership:{claims:[],transfers:[]},organizationVersion:'v1',revision:1,goal:'真实交付'};
 const api={
  listProjectFiles:async input=>{calls.push(['list',input]);return {ok:true,value:{status:'listed',resource:input.resource,entries:[{name:'src',kind:'directory'},{name:'README.md',kind:'file'}],nextCursor:''}};},
  readProjectFile:async input=>{calls.push(['read',input]);return {ok:true,value:{status:'read',resource:input.resource,text:'真实当前文件',sha256:'b'.repeat(64),byteLength:18,nextLine:2,complete:true}};},
  queryRoleActivity:async()=>({ok:true,value:{planDigest:dto.plan.planDigest,history:false,roles:[{id:'Supervisor',activity:'working',phase:'reasoning',sourceRef:'organization:a'}],tasks:[]}}),
  queryRoleLog:async input=>{calls.push(['log',input]);return {ok:true,value:{filters:{roleId:'Supervisor',taskId:null,planDigest:dto.plan.planDigest},events:[{id:'event',kind:'tool_result',tool:'legion_read_file',status:'completed',taskId:'task',resource:'README.md',createdAt:'2026-10-12',sourceRef:'journal:event'}],nextCursor:null,sourceDigest:'c'.repeat(64)}};},
  queryProjectFacts:async input=>({ok:true,value:{planDigest:dto.plan.planDigest,kind:input.kind,items:[{id:'change',taskId:'task',roleId:'Builder',resource:'README.md',status:'written',sourceRef:'task-result:real',observedMutation:true}],nextCursor:null,total:1}}),
  queryProjectOutputs:async()=>({ok:true,value:{planDigest:dto.plan.planDigest,kind:'outputs',items:[],nextCursor:null,total:0}}),
  queryProjectMemory:async input=>{calls.push(['memory',input]);return {ok:true,value:{facts:[{factId:'fact',kind:'preference',ownerRoleId:'Supervisor',status:'active',statement:'使用当前项目主题',revision:1,sources:[{id:'human:one',label:'Human原话'}]}],cursor:null,total:1}};}
 };
 const renderer=new _Renderer(document,api);renderer.render(dto);document.getElementById('message-input').value='未提交问题';await new Promise(resolve=>setImmediate(resolve));
 assert.match(document.getElementById('project-file-list').textContent,/README.md/u);
 renderer.selectZone('project');document.getElementById('project-file-list').children[1].dispatchEvent(new Event('click'));await new Promise(resolve=>setImmediate(resolve));
 assert.match(document.getElementById('file-preview-text').textContent,/真实当前文件/u);assert.equal(calls.some(item=>item[0]==='read'&&item[1].resource==='README.md'),true);
 renderer.selectProjectTab('changes');await new Promise(resolve=>setImmediate(resolve));assert.match(document.getElementById('project-changes-list').textContent,/task-result:real/u);
 renderer.selectZone('roles');await new Promise(resolve=>setImmediate(resolve));assert.match(document.getElementById('role-log-list').textContent,/legion_read_file/u);assert.match(document.getElementById('memory-list').textContent,/Human原话/u);
 assert.ok(calls.filter(item=>['list','log','memory'].includes(item[0])).every(item=>!Object.hasOwn(item[1],'cursor')));
 assert.equal(document.getElementById('message-input').value,'未提交问题');
});
test('first role and memory pages omit cursor; stale next pages stop and return keyboard focus to refresh',async()=>{
 const document=new Document(),calls=[],dto=state();dto.roles.push({id:'Supervisor',name:'Supervisor',profileId:'p1',status:'system'});
 const api={
  queryRoleLog:async input=>{calls.push(['log',input]);if(Object.hasOwn(input,'cursor'))return {ok:false,error:{code:'stale_cursor',message:'日志来源已改变'}};return {ok:true,value:{filters:{roleId:'Supervisor',taskId:null,planDigest:null},events:[],nextCursor:'opaque-log-cursor',sourceDigest:'a'.repeat(64)}};},
  queryProjectMemory:async input=>{calls.push(['memory',input]);if(Object.hasOwn(input,'cursor'))return {ok:false,error:{code:'invalid_input',message:'记忆游标无效'}};return {ok:true,value:{facts:[],cursor:'opaque-memory-cursor',total:2}};}
 };
 const renderer=new _Renderer(document,api);renderer.state=dto;renderer.projectId=projectId;renderer.selectedRoleId='Supervisor';
 await renderer.loadRoleLog();await renderer.loadMemory();
 assert.equal(calls.length,2);assert.equal(calls.every(([,input])=>!Object.hasOwn(input,'cursor')),true);
 const logMore=document.getElementById('role-log-more');assert.equal(logMore.hidden,false);logMore.focus();await renderer.loadRoleLog(true);
 assert.equal(calls[2][1].cursor,'opaque-log-cursor');assert.equal(renderer.pages.has('role-log'),false);assert.equal(logMore.hidden,true);assert.equal(document.activeElement,document.getElementById('role-log-refresh'));assert.match(document.getElementById('role-log-status').textContent,/日志来源已改变/u);
 const memoryMore=document.getElementById('memory-more');assert.equal(memoryMore.hidden,false);memoryMore.focus();await renderer.loadMemory(true);
 assert.equal(calls[3][1].cursor,'opaque-memory-cursor');assert.equal(renderer.pages.has('memory'),false);assert.equal(memoryMore.hidden,true);assert.equal(document.activeElement,document.getElementById('memory-refresh'));assert.match(document.getElementById('memory-status').textContent,/记忆游标无效/u);
 await renderer.loadRoleLog();await renderer.loadMemory();assert.equal(calls.slice(4).every(([,input])=>!Object.hasOwn(input,'cursor')),true);
});
test('idle role text remains truthful and a project without a plan saves its default connection without a false invalidation notice',async()=>{
 const document=new Document(),dto=state();dto.roles.push({id:'Supervisor',name:'Supervisor',profileId:'p1',status:'system'});
 const api={queryRoleActivity:async()=>({ok:true,value:{planDigest:null,history:false,roles:[{id:'Supervisor',activity:'waiting',phase:'not_recorded',sourceRef:'organization:current'},{id:'Builder',activity:'waiting_answer',phase:'awaiting_human',sourceRef:'organization:current'}],tasks:[]}}),getState:async()=>({ok:true,value:dto}),setDefaultProfile:async()=>({ok:true,value:{...dto,defaultProfileId:'p2'}})};
 const renderer=new _Renderer(document,api);renderer.render(dto);await renderer.loadRoleActivity();
 const roleText=document.getElementById('role-activity-list').textContent;assert.match(roleText,/二哥.*等待任务.*尚未运行/u);assert.match(roleText,/执行成员.*等待你的答复/u);assert.equal(roleText.includes('not_recorded'),false);
 assert.match(document.getElementById('default-profile-hint').textContent,/当前没有活动计划/u);
 renderer.start();await new Promise(resolve=>setImmediate(resolve));document.getElementById('default-profile').value='p2';document.getElementById('default-profile').dispatchEvent(new Event('change'));await new Promise(resolve=>setImmediate(resolve));
 assert.match(document.getElementById('notice').textContent,/后续讨论使用新连接/u);assert.equal(document.getElementById('notice').textContent.includes('失效'),false);renderer.stop();
});
test('narrow navigation reuses existing project/settings/theme controls with Escape and project focus return',async()=>{
 const document=new Document(),dto=state(),calls=[];
 document.getElementById('conversation-nav').dataset.page='conversation';document.getElementById('settings-nav').dataset.page='settings';
 const renderer=new _Renderer(document,{getState:async()=>({ok:true,value:dto}),chooseProject:async()=>{calls.push('chooseProject');return {ok:true,value:dto};}});
 renderer.render(dto);renderer.start();await new Promise(resolve=>setImmediate(resolve));
 try{
  const trigger=document.getElementById('mobile-nav-toggle');trigger.focus();trigger.dispatchEvent(new Event('click'));
  assert.equal(renderer.isMobileNavOpen(),true);assert.equal(document.getElementById('project-sidebar').dataset.open,'true');assert.equal(document.getElementById('nav-backdrop').hidden,false);assert.equal(document.getElementById('project-sidebar').attributes['aria-expanded'],undefined);assert.equal(trigger.attributes['aria-expanded'],'true');assert.equal(document.activeElement,document.getElementById('choose-project'));
  const escape=new Event('keydown',{cancelable:true});Object.assign(escape,{key:'Escape'});document.getElementById('project-sidebar').dispatchEvent(escape);assert.equal(renderer.isMobileNavOpen(),false);assert.equal(document.getElementById('nav-backdrop').hidden,true);assert.equal(document.activeElement,trigger);
  trigger.dispatchEvent(new Event('click'));const before=document.documentElement.dataset.theme;document.getElementById('theme-toggle').dispatchEvent(new Event('click'));assert.notEqual(document.documentElement.dataset.theme,before);
  document.getElementById('choose-project').dispatchEvent(new Event('click'));await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls,['chooseProject']);assert.equal(renderer.isMobileNavOpen(),false);assert.equal(document.activeElement,trigger);
  trigger.dispatchEvent(new Event('click'));document.getElementById('settings-nav').dispatchEvent(new Event('click'));assert.equal(renderer.isMobileNavOpen(),false);assert.equal(renderer.page,'settings');assert.equal(document.activeElement,document.getElementById('new-profile'));
 }finally{renderer.stop();}
});
