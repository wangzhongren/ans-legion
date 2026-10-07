/** UI adapter only. All model/credential/permission work stays behind fixed preload IPC. */
export function conversationDisplay(text) {
  const clean = text.replace(/```legion-plan\s*\n[\s\S]*?\n```/gu, '').trim();
  if (clean) return clean;
  if (text.includes('```legion-plan')) return '项目管理提出了计划数据，请查看下面的结构化方案与验证结果。';
  return text;
}
export function resultSummary(task) {
  const written = new Set(task.results.filter((result) => result.success).map((result) => result.resource.toLowerCase()));
  let text = `实际写入 ${written.size} / ${task.writeSet.length} 个目标文件 · 软件检查：未运行（not_executed）`;
  if (task.results.some((result) => result.auditFailed)) text += ' · 审计失败，请检查实际写入结果';
  return text;
}
const LABELS = { draft: '等待你确认', confirmed: '已确认', running: '执行中', completed: '目标已写入', failed: '失败', invalidated: '已失效，请重新讨论', cancelled: '已取消', pending: '等待执行', blocked: '已阻塞', interrupted: '已中断', recorded: '已记录', unavailable: '不可用', available: '可读', missing: '缺失', empty: '尚未读取' };
const label = (value) => LABELS[value] ?? value;
const time = (value) => value ?? '未记录';

/** Internal DOM adapter for focused Interface tests. */
export class _Renderer {
  constructor(document, api) {
    this.document = document; this.api = api; this.state = null; this.reading = false; this.sending = false;
    this.projectId = null; this.messageDrafts = new Map(); this.contextDrafts = new Map(); this.mappingDrafts = new Map(); this.roleRows = new Map();
    this.messageSignature = ''; this.planSignature = ''; this.resultsSignature = ''; this.timer = null;
    this.defaultDraft = null; this.pendingHuman = null;
  }
  get(id) { return this.document.getElementById(id); }
  node(tag, text = '', className = '') { const node = this.document.createElement(tag); node.textContent = text; node.className = className; return node; }
  notice(text = '', error = false) { const node = this.get('notice'); node.textContent = text; node.hidden = !text; node.classList.toggle('error', error); }
  fail(result) { this.notice(result.error?.message ?? '操作未完成，请重试。', true); }
  async call(name, input) { try { return await this.api[name](input); } catch { return { ok: false, error: { message: '无法连接主进程，请重新打开工作台。' } }; } }
  async update(name, input, message = '') {
    const result = await this.call(name, input); if (!result.ok) { this.fail(result); return result; }
    this.render(result.value); if (message) this.notice(message); return result;
  }
  toggleDetails(open) {
    this.get('details-drawer').hidden = !open; this.get('details-toggle').setAttribute('aria-expanded', String(open));
    this.document.body.classList.toggle('details-open', open);
  }
  navigate(page) {
    this.get('conversation-page').hidden = page !== 'conversation'; this.get('settings-page').hidden = page !== 'settings';
    for (const button of this.document.querySelectorAll('[data-page]')) button.classList.toggle('active', button.dataset.page === page);
    this.get('chat-scroll').scrollTop = 0; this.get('settings-page').scrollTop = 0;
    if (page === 'settings') this.toggleDetails(false);
  }
  keyAction() { this.get('api-key').disabled = this.get('key-action').value !== 'replace'; }
  editProfile(profile = null) {
    const fields = { 'profile-id': '', 'profile-name': '', protocol: 'openai-completions', provider: '', 'model-id': '', 'base-url': '', 'key-action': 'replace', 'api-key': '' };
    if (profile) Object.assign(fields, { 'profile-id': profile.id, 'profile-name': profile.name, protocol: profile.protocol, provider: profile.provider, 'model-id': profile.modelId, 'base-url': profile.baseUrl, 'key-action': 'keep' });
    for (const [id, value] of Object.entries(fields)) this.get(id).value = value;
    this.get('form-title').textContent = '新增连接'; if (profile) this.get('form-title').textContent = '编辑连接';
    this.get('saved-key').textContent = '尚未保存密钥'; if (profile?.hasSavedKey) this.get('saved-key').textContent = '已保存密钥';
    this.keyAction();
  }
  async saveProfile() {
    const input = { id: this.get('profile-id').value, name: this.get('profile-name').value, protocol: this.get('protocol').value, provider: this.get('provider').value, modelId: this.get('model-id').value, baseUrl: this.get('base-url').value, keyAction: this.get('key-action').value, apiKey: this.get('api-key').value };
    if (input.keyAction !== 'replace') input.apiKey = '';
    const before = new Set(this.state.profiles.map((item) => item.id)); this.get('save-profile').disabled = true;
    const result = await this.update('saveProfile', input, '连接已保存。'); this.get('save-profile').disabled = false;
    if (!result.ok) return;
    let saved = result.value.profiles.find((item) => item.id === input.id);
    if (!saved) saved = result.value.profiles.find((item) => !before.has(item.id));
    this.editProfile(saved ?? null);
  }
  renderProfiles() {
    const list = this.get('profile-list'); list.replaceChildren();
    if (!this.state.profiles.length) list.append(this.node('p', '添加一个连接后，即可与项目管理讨论。', 'muted'));
    for (const profile of this.state.profiles) {
      const card = this.node('article', '', 'card profile-item'); card.append(this.node('h3', profile.name), this.node('p', profile.modelId), this.node('small', `${profile.provider} · ${profile.protocol}`));
      let key = '尚未保存密钥'; if (profile.hasSavedKey) key = '已保存密钥'; card.append(this.node('span', key, 'badge'));
      const actions = this.node('div', '', 'profile-actions');
      const edit = this.node('button', '编辑', 'secondary'); edit.addEventListener('click', () => this.editProfile(profile));
      const probe = this.node('button', '测试', 'secondary'); probe.disabled = this.state.probe.status === 'running';
      probe.addEventListener('click', async () => { this.notice('正在测试连接…'); const pending = this.call('testConnection', { profileId: profile.id }); await this.load(); const result = await pending; if (!result.ok) this.fail(result); else if (result.value.error) this.notice(result.value.error.message, true); else this.notice('连接测试已结束。'); await this.load(); });
      const remove = this.node('button', '删除', 'danger'); remove.addEventListener('click', async () => {
        if (!globalThis.confirm(`删除连接「${profile.name}」与关联映射？`)) return;
        const result = await this.update('deleteProfile', { id: profile.id }, '连接已删除。'); if (result.ok && this.get('profile-id').value === profile.id) this.editProfile();
      });
      actions.append(edit, probe, remove); card.append(actions); list.append(card);
    }
    const select = this.get('default-profile'); const selected = select.value; const signature = JSON.stringify(this.state.profiles.map((item) => [item.id, item.name]));
    const focused = this.document.activeElement === select;
    if (!focused && select.dataset.signature !== signature) {
      select.replaceChildren(this.option('', '选择默认连接'));
      for (const profile of this.state.profiles) select.append(this.option(profile.id, profile.name));
      select.dataset.signature = signature;
    }
    if (!focused) select.value = this.defaultDraft ?? this.state.defaultProfileId ?? selected;
    const probe = this.state.probe;
    let text = '尚未测试'; if (probe.status === 'running') text = '正在测试已保存连接…'; if (probe.status === 'success') text = `请求成功 · ${probe.latencyMs} ms`; if (probe.error) text = probe.error.message;
    this.get('probe-state').textContent = text; this.get('cancel-probe').disabled = probe.status !== 'running';
  }
  option(value, text) { const option = this.node('option', text); option.value = value; return option; }
  makeRoleRow(role) {
    const card = this.node('article', '', 'role-card'); const name = this.node('h3'); const purpose = this.node('p', '', 'muted'); const select = this.node('select'); select.setAttribute('aria-label', `${role.id} AI 连接`); const button = this.node('button', '保存连接映射', 'secondary');
    card.append(name, purpose, select, button);
    const connection = this.node('p', '', 'muted'); card.append(connection);
    if (role.id !== 'ProjectManager') { select.hidden = true; select.disabled = true; button.hidden = true; }
    select.addEventListener('change', () => this.mappingDrafts.set(role.id, select.value));
    button.addEventListener('click', async () => { let profileId = null; if (select.value) profileId = select.value; button.disabled = true; const result = await this.update('assignProfile', { roleId: role.id, profileId }); button.disabled = false; if (result.ok) { this.mappingDrafts.delete(role.id); this.notice('映射已保存，原计划已失效，请与项目管理重新讨论。'); } });
    return { card, name, purpose, select, button, connection, signature: '' };
  }
  renderSidebar() {
    const projects = this.get('project-list'); projects.replaceChildren();
    if (!this.state.projects.length) projects.append(this.node('p', '任意真实文件夹都可作为项目', 'empty-note'));
    for (const project of this.state.projects) {
      const button = this.node('button', '', 'project-button'); button.append(this.node('strong', project.name));
      button.classList.toggle('active', project.id === this.projectId);
      if (project.id !== this.projectId) button.append(this.node('small', '选择同一目录可恢复此会话'));
      button.addEventListener('click', () => { if (project.id !== this.projectId) void this.update('chooseProject'); }); projects.append(button);
    }
    const members = this.get('member-list'); const roles = this.get('role-list'); members.replaceChildren(); this.get('role-count').textContent = String(this.state.roles.length);
    if (!this.state.roles.length) members.append(this.node('p', '首条消息创建项目管理，确认后创建执行成员。', 'empty-note'));
    const seen = new Set();
    for (const role of this.state.roles) {
      seen.add(role.id); const member = this.node('button', '', 'member-button'); member.append(this.node('strong', role.name));
      let detail = '执行成员 · 查看范围'; if (role.id === 'ProjectManager') detail = '唯一需求与确认入口'; member.append(this.node('small', detail));
      member.addEventListener('click', () => { if (role.id === 'ProjectManager') this.navigate('conversation'); else { this.toggleDetails(true); this.get('member-details').open = true; this.roleRows.get(role.id)?.card.scrollIntoView({ block: 'nearest' }); } }); members.append(member);
      let row = this.roleRows.get(role.id); if (!row) { row = this.makeRoleRow(role); this.roleRows.set(role.id, row); roles.append(row.card); }
      row.name.textContent = `${role.name} · ${role.id}`; row.purpose.textContent = role.purpose;
      const connection = this.state.profiles.find((item) => item.id === role.profileId);
      const tasks = this.state.tasks.filter((task) => task.roleId === role.id);
      row.connection.textContent = `连接：${connection?.name ?? role.profileId} · ${tasks.map((task) => label(task.status)).join('、') || '待确认的成员定义'}`;
      const focused = this.document.activeElement === row.select;
      const signature = JSON.stringify(this.state.profiles.map((item) => [item.id, item.name])); if (!focused && row.signature !== signature) { row.select.replaceChildren(this.option('', '未映射')); for (const profile of this.state.profiles) row.select.append(this.option(profile.id, profile.name)); row.signature = signature; }
      const assignment = this.state.assignments.find((item) => item.projectId === this.projectId && item.roleId === role.id);
      let profileId = role.profileId; if (assignment) profileId = assignment.profileId; if (this.mappingDrafts.has(role.id)) profileId = this.mappingDrafts.get(role.id); if (!focused) row.select.value = profileId;
    }
    for (const id of this.roleRows.keys()) if (!seen.has(id)) { this.roleRows.get(id).card.remove(); this.roleRows.delete(id); }
  }
  renderMessages() {
    const items = [...this.state.history.messages]; const turn = this.state.turn;
    if (turn && this.pendingHuman?.turnId === turn.id && this.pendingHuman.projectId === this.projectId && turn.status !== 'completed') items.push({ role: 'user', text: this.pendingHuman.text });
    if (turn?.status === 'running') items.push({ role: 'assistant', text: turn.text || '正在整理回复…' });
    const signature = JSON.stringify(items); if (signature === this.messageSignature) return; this.messageSignature = signature;
    const messages = this.get('messages'); messages.replaceChildren();
    for (const item of items) {
      const article = this.node('article', '', `message ${item.role}`); let name = '项目管理'; let avatar = 'PM'; if (item.role === 'user') { name = '你'; avatar = 'H'; }
      const body = this.node('div', '', 'message-body'); const content = this.node('p', '', 'message-text'); content.textContent = item.text; if (item.role === 'assistant') content.textContent = conversationDisplay(item.text);
      body.append(this.node('div', name, 'message-label'), content);
      if (item.role === 'assistant' && item.text.includes('```legion-plan')) { const raw = this.node('details'); raw.append(this.node('summary', '查看原始回复'), this.node('pre', item.text)); body.append(raw); }
      article.append(this.node('span', avatar, 'message-avatar'), body); messages.append(article);
    }
  }
  files(container, resources) { container.replaceChildren(); for (const resource of resources) container.append(this.node('code', resource)); }
  renderPlan() {
    const plan = this.state.plan; this.get('plan-panel').hidden = !plan; if (!plan) { this.planSignature = ''; return; }
    this.get('plan-goal').textContent = plan.goal; this.get('plan-status').textContent = label(plan.status);
    const signature = JSON.stringify(plan); if (signature !== this.planSignature) {
      this.planSignature = signature; const roles = this.get('plan-roles'); roles.replaceChildren(); for (const role of plan.roles) roles.append(this.node('span', `${role.name} · ${role.id}`, 'badge'));
      const tasks = this.get('plan-tasks'); tasks.replaceChildren(); for (const task of plan.tasks) { const row = this.node('article', '', 'plan-task'); row.append(this.node('h3', task.title)); let dependency = '无前置任务'; if (task.dependsOn.length) dependency = `依赖：${task.dependsOn.join('、')}`; const profile = this.state.profiles.find((item) => item.id === task.profileId); row.append(this.node('p', `${task.roleId} · ${profile?.name ?? task.profileId} · ${dependency}`)); const files = this.node('div', '', 'file-list'); this.files(files, task.writeSet); row.append(files); const details = this.node('details'); details.append(this.node('summary', '查看任务说明'), this.node('p', task.instruction)); row.append(details); tasks.append(row); }
    }
    this.get('plan-binding').textContent = `组织 ${plan.organizationVersion} · 计划第 ${plan.revision} 版 · 上下文 ${this.state.context.files.length} 个文件 · ${plan.profileBindings.length} 个连接版本已绑定`;
    this.get('confirm-plan').disabled = plan.status !== 'draft' || this.state.turn?.status === 'running';
    this.get('stop-execution').hidden = !['confirmed', 'running'].includes(plan.status);
  }
  renderResults() {
    const tasks = this.state.tasks; this.get('execution-panel').hidden = !tasks.some((task) => task.status !== 'pending');
    const signature = JSON.stringify(tasks); if (signature !== this.resultsSignature) {
      this.resultsSignature = signature; const results = this.get('execution-results'); results.replaceChildren();
      for (const task of tasks) { const row = this.node('article', '', 'result-row'); row.append(this.node('strong', `${task.title} · ${label(task.status)}`), this.node('p', resultSummary(task), 'muted')); if (task.error) row.append(this.node('p', task.error.message, 'error-text')); for (const result of task.results) { let text = `${result.resource || '不合法的路径'} · ${label(result.status)} · ${result.reason}`; if (result.observedMutation && !result.success) text += ' · 已观察到写入，请核对实际文件'; row.append(this.node('p', text)); } results.append(row); }
    }
    const list = this.get('task-list'); list.replaceChildren(); const filter = this.get('status-filter').value;
    for (const task of tasks) { if (filter !== 'all' && filter !== task.status) continue; const row = this.node('article', '', 'record-row'); row.append(this.node('strong', `${task.title} · ${label(task.status)}`), this.node('p', resultSummary(task)), this.node('p', time(task.updatedAt), 'muted')); const files = this.node('div', '', 'file-list'); this.files(files, task.writeSet); row.append(files); if (task.error) row.append(this.node('p', task.error.message, 'error-text')); list.append(row); }
  }
  renderObservation() {
    const observation = this.state.observation;
    this.get('observation-state').textContent = '这些是已有文件的记录，不表示当前进程在线。';
    if (observation.status === 'unavailable') { let text = '来源不可用，客户项目无需提供开发组织文件。'; if (observation.lastValidAt) text = '来源不可用，以下保留上次有效快照，已过期。'; this.get('observation-state').textContent = text; }
    this.get('governance-state').textContent = `治理记录：${observation.organization?.status ?? '不可用'} · ${observation.organization?.version ?? '无版本'}`;
    this.get('record-state').textContent = `任务阶段记录：${observation.tasks.length} 条`;
    this.get('audit-state').textContent = `已有治理 / 运行审计：${observation.audits.length} 条`;
    this.get('snapshot-time').textContent = `本轮观察 ${time(observation.observedAt)} · 最近有效 ${time(observation.lastValidAt)}`;
    const errors = this.get('observation-errors'); errors.replaceChildren(); for (const error of observation.errors) errors.append(this.node('p', error.message, 'error-text'));
    const sources = this.get('source-list'); sources.replaceChildren(); for (const source of observation.sources) { const row = this.node('article', '', 'source-row'); row.append(this.node('code', source.relativePath), this.node('p', `${label(source.status)} · 文件时间 ${time(source.modifiedAt)}`), this.node('p', `观察 ${time(source.observedAt)} · 最近校验 ${time(source.verifiedAt)} · 缓存 ${source.cached}`, 'muted')); if (source.error) row.append(this.node('p', source.error.message, 'error-text')); sources.append(row); }
    const records = this.get('record-list'); records.replaceChildren(); for (const record of observation.tasks) { const row = this.node('article', '', 'record-row'); row.append(this.node('strong', `${record.taskId} / ${record.nodeId} · ${label(record.status)}`), this.node('p', `${record.roleId} · ${time(record.updatedAt)}`)); if (record.reason) row.append(this.node('p', record.reason)); records.append(row); }
    const audits = this.get('audit-list'); audits.replaceChildren(); for (const audit of observation.audits) { const row = this.node('article', '', 'record-row'); row.append(this.node('strong', `${audit.format} · ${audit.eventType}`), this.node('p', `${audit.organizationVersion} · ${label(audit.status)} · ${time(audit.updatedAt)}`)); audits.append(row); }
  }
  render(value) {
    if (!value?.profiles || !value.observation) return;
    const scroll = this.get('chat-scroll'); const top = scroll.scrollTop; const height = scroll.scrollHeight; const follow = height - top - scroll.clientHeight < 80;
    const detailsTop = this.get('details-drawer').scrollTop;
    const id = value.currentProject?.id ?? null;
    const changedProject = id !== this.projectId;
    if (changedProject) {
      if (this.projectId) { this.messageDrafts.set(this.projectId, this.get('message-input').value); this.contextDrafts.set(this.projectId, this.get('context-input').value); }
      this.projectId = id; this.get('message-input').value = this.messageDrafts.get(id) ?? ''; this.get('context-input').value = this.contextDrafts.get(id) ?? value.context.files.map((file) => file.resource).join('\n');
      this.mappingDrafts.clear(); this.roleRows.clear(); this.get('role-list').replaceChildren(); this.messageSignature = ''; this.planSignature = ''; this.resultsSignature = ''; this.pendingHuman = null; scroll.scrollTop = 0;
    }
    this.state = value;
    this.get('project-name').textContent = value.currentProject?.name ?? '选择一个项目开始';
    const manager = value.roles.find((role) => role.id === 'ProjectManager'); let profileId = value.defaultProfileId; if (manager) profileId = manager.profileId;
    const profile = value.profiles.find((item) => item.id === profileId); this.get('manager-connection').textContent = profile?.name ?? '先到 AI 连接设置添加并选择连接';
    this.get('welcome').hidden = value.history.messages.length > 0 || value.turn?.status === 'running'; this.get('welcome-choose').hidden = id !== null;
    const running = value.turn?.status === 'running'; const executing = ['confirmed', 'running'].includes(value.plan?.status);
    this.get('message-input').disabled = !id; this.get('send-message').disabled = !id || !profile || running || executing || this.sending; this.get('cancel-turn').hidden = !running;
    let status = '首条消息将创建此项目的项目管理'; if (manager) status = '需求仅发送给项目管理'; if (running) status = '项目管理正在回复'; if (executing) status = '按已确认计划执行中'; this.get('conversation-status').textContent = status;
    this.get('select-context').disabled = !id || running || executing;
    this.renderProfiles(); this.renderSidebar(); this.renderMessages(); this.renderPlan(); this.renderResults(); this.renderObservation();
    this.get('context-state').textContent = `已选 ${value.context.files.length} 个文件 · 校验 ${time(value.context.verifiedAt)}`;
    const files = this.get('context-files'); files.replaceChildren(); for (const file of value.context.files) files.append(this.node('p', `${file.resource} · ${file.byteLength} bytes`, 'muted'));
    if (value.error) this.notice(value.error.message, true);
    if (changedProject) scroll.scrollTop = 0;
    else if (follow && scroll.scrollHeight !== height) scroll.scrollTop = scroll.scrollHeight;
    else scroll.scrollTop = top;
    this.get('details-drawer').scrollTop = detailsTop;
  }
  async load() {
    if (this.reading) return; this.reading = true;
    try { const result = await this.call('getState', {}); if (!result.ok) this.fail(result); else this.render(result.value); }
    finally { this.reading = false; }
  }
  async send() {
    if (this.sending || !this.projectId || !this.get('message-input').value.trim()) return;
    const text = this.get('message-input').value; this.sending = true; this.get('send-message').disabled = true;
    const result = await this.update('sendMessage', { projectId: this.projectId, roleId: 'ProjectManager', text }); this.sending = false;
    if (result.ok && result.value.turn) this.pendingHuman = { projectId: result.value.turn.projectId, turnId: result.value.turn.id, text };
    if (result.ok && this.get('message-input').value === text) this.get('message-input').value = '';
    if (this.state) this.render(this.state);
  }
  start() {
    for (const button of this.document.querySelectorAll('[data-page]')) button.addEventListener('click', () => this.navigate(button.dataset.page));
    for (const button of this.document.querySelectorAll('[data-suggestion]')) button.addEventListener('click', () => { this.get('message-input').value = button.dataset.suggestion; this.get('message-input').focus(); });
    for (const id of ['choose-project', 'welcome-choose']) this.get(id).addEventListener('click', () => void this.update('chooseProject'));
    this.get('details-toggle').addEventListener('click', () => this.toggleDetails(this.get('details-drawer').hidden)); this.get('details-close').addEventListener('click', () => this.toggleDetails(false));
    this.get('theme-toggle').addEventListener('click', () => { let current = this.document.documentElement.dataset.theme; if (!current) { current = 'light'; if (globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches) current = 'dark'; } let next = 'dark'; if (current === 'dark') next = 'light'; this.document.documentElement.dataset.theme = next; });
    this.get('refresh-project').addEventListener('click', () => void this.update('refreshProject', {}, '已重新读取并校验来源。'));
    this.get('new-profile').addEventListener('click', () => this.editProfile()); this.get('key-action').addEventListener('change', () => this.keyAction());
    this.get('profile-form').addEventListener('submit', (event) => { event.preventDefault(); void this.saveProfile(); });
    this.get('default-profile').addEventListener('change', async () => {
      const profileId = this.get('default-profile').value; if (!profileId) return;
      this.defaultDraft = profileId; const result = await this.update('setDefaultProfile', { profileId });
      if (result.ok) { this.defaultDraft = null; this.render(result.value); }
    });
    this.get('message-form').addEventListener('submit', (event) => { event.preventDefault(); void this.send(); });
    this.get('message-input').addEventListener('keydown', (event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); void this.send(); } });
    this.get('select-context').addEventListener('click', () => { const resources = this.get('context-input').value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean); void this.update('selectContext', { projectId: this.projectId, resources }, '上下文已读取，原计划需重新讨论确认。'); });
    this.get('confirm-plan').addEventListener('click', () => { if (this.state.plan?.status === 'draft') void this.update('confirmPlan', { projectId: this.projectId, planDigest: this.state.plan.planDigest }, '当前精确计划已确认。'); });
    this.get('stop-execution').addEventListener('click', () => void this.update('stopExecution', { projectId: this.projectId }, '已停止当前计划，旧确认不能再次使用。'));
    this.get('cancel-turn').addEventListener('click', () => { if (this.state.turn) void this.update('cancelTurn', { projectId: this.projectId, turnId: this.state.turn.id }); });
    this.get('cancel-probe').addEventListener('click', async () => { const result = await this.call('cancelProbe', { probeId: this.state.probe.id }); if (!result.ok) this.fail(result); await this.load(); });
    this.get('status-filter').addEventListener('change', () => this.renderResults());
    this.editProfile(); void this.load(); this.timer = setInterval(() => { void this.load(); }, 1000);
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}
if (typeof window !== 'undefined' && window.legionDesktop) {
  const renderer = new _Renderer(document, window.legionDesktop); renderer.start(); window.addEventListener('beforeunload', () => renderer.stop(), { once: true });
}
