/** UI adapter only. All model/credential/permission work stays behind fixed preload IPC. */
export function conversationDisplay(text) {
  const clean = text.replace(/```legion-plan\s*\n[\s\S]*?\n```/gu, '').replace(/```legion-plan[^\n]*(?:\n[\s\S]*)?$/gu, '').trim();
  if (clean) return clean;
  if (text.includes('```legion-plan')) return '项目管理提出了计划，请查看当前任务并答复执行确认。';
  return text;
}
/** Pure HTTP(S) projection; parsing text never opens a URL or loads an image. */
export function _markdownLinkUrl(value) {
  if (typeof value !== 'string' || value.length > 8192 || !/^https?:\/\//iu.test(value) || /[\u0000-\u0020\u007f\\]/u.test(value)) return null;
  try {
    let decoded = value;
    for (let depth = 0; depth < 4; depth += 1) {
      if (/[\u0000-\u001f\u007f]/u.test(decoded)) return null;
      const next = decodeURIComponent(decoded); if (next === decoded) break; decoded = next;
    }
    if (/[\u0000-\u001f\u007f]/u.test(decoded)) return null;
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}
function markdownEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos|nbsp);/giu, (raw, name) => {
    if (named[name.toLowerCase()]) return named[name.toLowerCase()];
    let code = Number.parseInt(name.slice(1), 10); if (name.toLowerCase().startsWith('#x')) code = Number.parseInt(name.slice(2), 16);
    if (code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return raw;
    return String.fromCodePoint(code);
  });
}
/** Internal DOM adapter: real locked Lexer tokens, never HTML output. */
export function _markdownContent(document, source, lexer = globalThis.marked?.Lexer) {
  const root = document.createElement('div'); root.className = 'markdown-content'; let status = 'formatted';
  const plain = (reason) => {
    root.replaceChildren(); const text = document.createElement('p'); text.className = 'markdown-plain'; text.textContent = source; root.append(text);
    const note = document.createElement('small'); note.className = 'markdown-fallback'; note.textContent = reason; root.append(note); return { root, status: 'plain_fallback' };
  };
  if (!lexer?.lex) return plain('Markdown 未加载，已显示完整纯文本。');
  if (source.length > 262144) return plain('此回复较长，已显示完整纯文本；原文仍保留。');
  let count = 0;
  const make = (tag, text = '', className = '') => { count += 1; if (count > 6000) throw new RangeError('markdown_display_budget'); const node = document.createElement(tag); node.className = className; node.textContent = text; return node; };
  const render = (parent, tokens, depth = 0) => {
    if (depth > 32) throw new RangeError('markdown_display_depth');
    for (const token of tokens) {
      let node = null;
      switch (token.type) {
        case 'space': case 'def': break;
        case 'heading': { const level = Math.max(1, Math.min(6, token.depth)); node = make('h' + level); render(node, token.tokens, depth + 1); break; }
        case 'paragraph': node = make('p'); render(node, token.tokens, depth + 1); break;
        case 'strong': case 'em': case 'del': node = make(token.type); render(node, token.tokens, depth + 1); break;
        case 'blockquote': node = make('blockquote'); render(node, token.tokens, depth + 1); break;
        case 'code': { node = make('div', '', 'markdown-code'); if (token.lang) node.append(make('small', token.lang, 'code-language')); const pre = make('pre'); pre.append(make('code', token.text)); node.append(pre); break; }
        case 'codespan': node = make('code', token.text); break;
        case 'br': node = make('br'); break;
        case 'hr': node = make('hr'); break;
        case 'list': {
          let tag = 'ul'; if (token.ordered) tag = 'ol'; node = make(tag); if (token.ordered && Number.isSafeInteger(token.start)) node.setAttribute('start', String(token.start));
          for (const item of token.items) { const li = make('li'); if (item.task) { let state = '☐ '; if (item.checked) state = '☑ '; li.append(make('span', state, 'markdown-task')); } render(li, item.tokens, depth + 1); node.append(li); } break;
        }
        case 'table': {
          node = make('div', '', 'markdown-table-scroll'); const table = make('table'); const head = make('thead'); const header = make('tr');
          for (const cell of token.header) { const th = make('th'); th.setAttribute('scope', 'col'); if (['left', 'center', 'right'].includes(cell.align)) th.className = 'align-' + cell.align; render(th, cell.tokens, depth + 1); header.append(th); } head.append(header); table.append(head);
          const body = make('tbody'); for (const cells of token.rows) { const row = make('tr'); for (const cell of cells) { const td = make('td'); if (['left', 'center', 'right'].includes(cell.align)) td.className = 'align-' + cell.align; render(td, cell.tokens, depth + 1); row.append(td); } body.append(row); } table.append(body); node.append(table); break;
        }
        case 'link': case 'image': {
          const url = _markdownLinkUrl(markdownEntities(token.href));
          if (!url) { node = make('span', token.raw, 'markdown-unavailable-link'); break; }
          node = make('a'); node.setAttribute('href', url); node.setAttribute('target', 'handwell-external-link'); node.setAttribute('rel', 'noreferrer'); node.setAttribute('data-external-link', 'true');
          if (token.type === 'image') node.append(make('span', `图片：${token.text || '未提供描述'} · ${url}`)); else render(node, token.tokens, depth + 1);
          node.setAttribute('title', url + ' · 在系统浏览器打开');
          node.addEventListener('click', (event) => { if (!event.isTrusted || globalThis.navigator?.userActivation?.isActive === false) event.preventDefault(); }); break;
        }
        case 'text': if (token.tokens) { render(parent, token.tokens, depth + 1); break; } node = make('span', markdownEntities(token.text)); break;
        case 'escape': node = make('span', markdownEntities(token.text)); break;
        // Raw HTML and unrecognized syntax remain literal source, with no attributes.
        default: node = make('span', token.raw ?? token.text ?? ''); break;
      }
      if (node) parent.append(node);
    }
  };
  try { render(root, lexer.lex(source, { gfm: true, breaks: false })); }
  catch { status = 'plain_fallback'; return plain('此回复暂时以完整纯文本显示；原文仍保留。'); }
  return { root, status };
}
export function resultSummary(task) {
  const written = new Set(task.results.filter((result) => result.success).map((result) => result.resource.toLowerCase()));
  let text = `实际修改 ${written.size} 个文件${task.retainedOutputs?.length ? ' · 恢复核验保留 ' + task.retainedOutputs.length + ' 个（非新写）' : ''} · 软件检查：${label(task.checkStatus ?? 'not_executed')} (${task.checkStatus ?? 'not_executed'})`;
  if (task.acceptanceStatus) text += ` · 独立验收：${label(task.acceptanceStatus)}`;
  else text += ' · 独立验收：未验收';
  if (task.results.some((result) => result.auditFailed)) text += ' · 审计失败，请检查实际写入结果';
  return text;
}
const LABELS = { pass: '验收通过', fail: '验收失败', passed: '检查通过', not_executed: '未运行', unsupported: '不支持', stale: '证据过期', waiting: '等待答复', draft: '等待你确认', confirmed: '已确认', running: '执行中', completed: '目标已写入', failed: '失败', error: '错误', invalidated: '已失效，请重新讨论', cancelled: '已取消', pending: '等待执行', approved: '已批准', returned: '已退回', blocked: '已阻塞', interrupted: '已中断', recorded: '已记录', unavailable: '不可用', available: '可读', missing: '缺失', empty: '尚未读取', working: '正在工作', waiting_answer: '等待答复', waiting_dependency: '等待依赖 / 确认', inactive: '已停用', legacy: '职责待补全', system: '系统职责' };
Object.assign(LABELS, { waiting_pm_approval: '待PM审批', executing_shell: '执行Shell', publishing: '发布中', published: '已发布', partial_published: '部分已发布，需要恢复', recovery_required: '暂停，待恢复', recovered: '已通过新授权恢复', denied: '已拒绝', expired: '审批已过期', consumed: '批准已消费', reviewing: 'PM审核中', deleted: '已删除' });
const label = (value) => LABELS[value] ?? value;
const time = (value) => value ?? '未记录';
const requestKey = (request) => [request.projectId, request.requestId, request.version, request.digest].join('|');

/** Internal DOM adapter for focused Interface tests. */
export class _Renderer {
  constructor(document, api) {
    this.document = document; this.api = api; this.state = null; this.reading = false; this.sending = false;
    this.projectId = null; this.messageDrafts = new Map(); this.contextDrafts = new Map(); this.mappingDrafts = new Map(); this.roleRows = new Map();
    this.memberNodes = new Map(); this.profileNodes = new Map(); this.messageNodes = new Map(); this.regions = new Map();
    this.defaultDraft = null; this.pendingHuman = null; this.modalRequest = null; this.interactionDrafts = new Map();
    this.interactionBusy = false; this.interactionStale = false; this.timer = null; this.page = 'conversation'; this.tab = 'task';
    this.tabScroll = new Map(); this.focusReturn = null; this.modalFocusReturn = null; this.selectedMember = null; this.memberRuns = new Map(); this.memberReading = new Map(); this.activityNodes = new Map(); this.currentMemberView = null; this.memberEventNodes = new Map();
  }
  get(id) { return this.document.getElementById(id); }
  node(tag, text = '', className = '') { const node = this.document.createElement(tag); node.textContent = text; node.className = className; return node; }
  setText(node, text) { if (node.textContent !== text) node.textContent = text; }
  option(value, text) { const option = this.node('option', text); option.value = value; return option; }
  notice(text = '', error = false) { const node = this.get('notice'); node.textContent = text; node.hidden = !text; node.classList.toggle('error', error); }
  fail(result) { this.notice(result.error?.message ?? '操作未完成，请重试。', true); }
  inlineError(id, text = '') { const node = this.get(id); node.textContent = text; node.hidden = !text; }
  async call(name, input) {
    try { return await this.api[name](input); }
    catch { return { ok: false, error: { code: 'host_unavailable', message: '无法连接主进程，请重新打开工作台。' } }; }
  }
  async update(name, input, message = '') {
    const result = await this.call(name, input);
    if (!result.ok) { this.fail(result); return result; }
    if (input?.projectId && input.projectId !== this.projectId) return result;
    this.render(result.value); if (message) this.notice(message); return result;
  }
  /** Regions containing only facts keep disclosures and scroll when actual data changes. */
  region(id, value, build) {
    const signature = JSON.stringify(value); if (this.regions.get(id) === signature) return;
    const container = this.get(id); const disclosures = new Map();
    for (const detail of container.querySelectorAll?.('details[data-key]') ?? []) disclosures.set(detail.dataset.key, detail.open);
    const originalFocus = this.document.activeElement;
    const focusedDetail = originalFocus?.closest?.('details[data-key]');
    const focusKey = focusedDetail?.dataset.key;
    const top = container.scrollTop; const fragment = this.node('div'); build(fragment);
    const oldNodes = [...container.children]; const desired = [...fragment.children].map((node, index) => {
      let old = oldNodes[index];
      if (node.dataset.key) old = oldNodes.find((item) => item.dataset.key === node.dataset.key);
      if (old && old.tagName === node.tagName && old.className === node.className && old.textContent === node.textContent) return old;
      return node;
    });
    for (let index = 0; index < desired.length; index += 1) {
      if (container.children[index] !== desired[index]) container.insertBefore(desired[index], container.children[index] ?? null);
    }
    for (const node of oldNodes) if (!desired.includes(node)) node.remove();
    for (const detail of container.querySelectorAll?.('details[data-key]') ?? []) if (disclosures.has(detail.dataset.key)) detail.open = disclosures.get(detail.dataset.key);
    // Chromium moves activeElement to BODY after removal. Inspect the saved node,
    // and keep an intentional focus move to another connected control.
    if (focusKey && originalFocus?.isConnected === false && (this.document.activeElement === this.document.body || this.document.activeElement === originalFocus)) {
      for (const detail of container.querySelectorAll?.('details[data-key]') ?? []) if (detail.dataset.key === focusKey) detail.querySelector?.('summary')?.focus();
    }
    container.scrollTop = top; this.regions.set(id, signature);
  }
  disclosure(key, title) { const detail = this.node('details'); detail.dataset.key = key; detail.append(this.node('summary', title)); return detail; }
  toggleDetails(open, tab = this.tab) {
    const drawer = this.get('details-drawer');
    if (open) {
      if (drawer.hidden) this.focusReturn = this.document.activeElement;
      if (this.page !== 'conversation') this.navigate('conversation');
      drawer.hidden = false; this.selectTab(tab); this.get('details-close').focus();
    } else {
      const memberReturn = this.memberNodes.get(this.selectedMember)?.button;
      const active = this.document.activeElement;
      const ownsFocus = active === this.document.body || active === this.get('details-close') || active === this.focusReturn || drawer.contains?.(active);
      drawer.hidden = true; this.selectedMember = null;
      for (const row of this.roleRows.values()) row.card.classList.toggle('selected', false);
      let target = this.focusReturn;
      if (!target || target.isConnected === false) target = memberReturn;
      if (!target || target.isConnected === false) target = this.get('details-toggle');
      if (ownsFocus && target?.isConnected !== false) target?.focus(); this.focusReturn = null;
    }
    this.get('details-toggle').setAttribute('aria-expanded', String(open));
    this.document.body.classList.toggle('details-open', open);
  }
  selectTab(tab, focus = false) {
    if (!['task', 'files', 'members', 'conversation', 'records'].includes(tab)) return;
    const scroll = this.get('details-scroll'); this.tabScroll.set(this.tab, scroll.scrollTop); this.tab = tab;
    for (const name of ['task', 'files', 'members', 'conversation', 'records']) {
      const active = name === tab; const button = this.get('tab-' + name);
      button.setAttribute('aria-selected', String(active)); button.setAttribute('tabindex', '-1');
      if (active) button.setAttribute('tabindex', '0'); this.get('detail-' + name).hidden = !active;
    }
    scroll.scrollTop = this.tabScroll.get(tab) ?? 0; if (tab === 'conversation' && !this.selectedMember && this.state?.roles.length) { this.selectedMember = this.state.roles.find((role) => role.id === 'Supervisor')?.id ?? this.state.roles[0].id; this.renderSidebar(); this.renderMemberCurrent(); this.renderMemberConversation(); } if (focus) this.get('tab-' + tab).focus();
  }
  navigate(page) {
    if (!['conversation', 'settings'].includes(page)) return;
    this.page = page;
    this.get('conversation-page').hidden = page !== 'conversation'; this.get('settings-page').hidden = page !== 'settings';
    for (const button of this.document.querySelectorAll('[data-page]')) {
      const active = button.dataset.page === page; button.classList.toggle('active', active);
      button.setAttribute('aria-current', 'false'); if (active) button.setAttribute('aria-current', 'page');
    }
    if (page === 'settings') { this.toggleDetails(false); this.get('new-profile').focus(); }
  }
  keyAction() {
    const action = this.get('key-action').value; this.get('api-key').disabled = action !== 'replace';
    let text = '填写新密钥，保存成功后清空；失败保留输入。';
    if (action === 'keep') text = '保留已保存密钥，密钥不可读回。';
    if (action === 'clear') text = '保存后移除已保存密钥。'; this.setText(this.get('key-hint'), text);
  }
  editProfile(profile = null) {
    const fields = { 'profile-id': '', 'profile-name': '', protocol: 'openai-completions', provider: '', 'model-id': '', 'base-url': '', 'key-action': 'replace', 'api-key': '' };
    if (profile) Object.assign(fields, { 'profile-id': profile.id, 'profile-name': profile.name, protocol: profile.protocol, provider: profile.provider, 'model-id': profile.modelId, 'base-url': profile.baseUrl, 'key-action': 'keep' });
    for (const [id, value] of Object.entries(fields)) this.get(id).value = value;
    this.setText(this.get('form-title'), '新增连接'); if (profile) this.setText(this.get('form-title'), '编辑连接');
    this.setText(this.get('saved-key'), '尚未保存密钥'); if (profile?.hasSavedKey) this.setText(this.get('saved-key'), '已保存密钥');
    this.inlineError('profile-error'); this.keyAction(); this.renderProfileSelection();
  }
  renderProfileSelection() { for (const [id, row] of this.profileNodes) row.card.classList.toggle('selected', id === this.get('profile-id').value); }
  async saveProfile() {
    if (this.get('save-profile').disabled) return;
    const input = { id: this.get('profile-id').value, name: this.get('profile-name').value, protocol: this.get('protocol').value, provider: this.get('provider').value, modelId: this.get('model-id').value, baseUrl: this.get('base-url').value, keyAction: this.get('key-action').value, apiKey: this.get('api-key').value };
    if (input.keyAction !== 'replace') input.apiKey = '';
    const before = new Set(this.state.profiles.map((item) => item.id)); this.get('save-profile').disabled = true;
    const result = await this.update('saveProfile', input, '连接已保存，旧计划已失效，请重新讨论。'); this.get('save-profile').disabled = false;
    if (!result.ok) { this.inlineError('profile-error', result.error.message); return; }
    let saved = result.value.profiles.find((item) => item.id === input.id);
    if (!saved) saved = result.value.profiles.find((item) => !before.has(item.id)); this.editProfile(saved ?? null);
  }
  makeProfile(profile) {
    const card = this.node('article', '', 'profile-item'); const name = this.node('h3'); const model = this.node('p'); const protocol = this.node('small'); const key = this.node('span', '', 'badge'); const actions = this.node('div', '', 'profile-actions');
    const edit = this.node('button', '编辑', 'secondary'); edit.addEventListener('click', () => this.editProfile(this.state.profiles.find((item) => item.id === profile.id)));
    const probe = this.node('button', '测试', 'secondary'); probe.addEventListener('click', () => void this.testProfile(profile.id));
    const remove = this.node('button', '删除', 'danger'); remove.addEventListener('click', async () => {
      const current = this.state.profiles.find((item) => item.id === profile.id); if (!current || !globalThis.confirm(`删除连接「${current.name}」与关联映射？旧计划将失效。`)) return;
      const result = await this.update('deleteProfile', { id: profile.id }, '连接已删除，旧计划已失效。'); if (result.ok && this.get('profile-id').value === profile.id) this.editProfile();
    }); actions.append(edit, probe, remove); card.append(name, model, protocol, key, actions); return { card, name, model, protocol, key, probe };
  }
  async testProfile(profileId) {
    if (this.state.probe.status === 'running' || this.probing) return; this.probing = true; this.renderProfiles();
    const pending = this.call('testConnection', { profileId }); await this.load(); const result = await pending; this.probing = false;
    if (!result.ok) this.fail(result); else if (result.value.error) this.notice(result.value.error.message, true);
    await this.load();
  }
  renderProfiles() {
    const list = this.get('profile-list'); const seen = new Set(); this.get('new-profile').disabled = !this.state;
    for (const profile of this.state.profiles) {
      seen.add(profile.id); let row = this.profileNodes.get(profile.id);
      if (!row) { row = this.makeProfile(profile); this.profileNodes.set(profile.id, row); list.append(row.card); }
      this.setText(row.name, profile.name); this.setText(row.model, profile.modelId); this.setText(row.protocol, `${profile.provider} · ${profile.protocol}`);
      this.setText(row.key, '尚未保存密钥'); if (profile.hasSavedKey) this.setText(row.key, '已保存密钥'); row.probe.disabled = this.probing || this.state.probe.status === 'running';
    }
    for (const [id, row] of this.profileNodes) if (!seen.has(id)) { row.card.remove(); this.profileNodes.delete(id); }
    this.renderProfileSelection();
    this.syncSelect(this.get('default-profile'), this.defaultDraft ?? this.state.defaultProfileId ?? '', '选择默认连接');
    const probe = this.state.probe; const profile = this.state.profiles.find((item) => item.id === probe.profileId);
    let text = '尚未测试 · 只测试已保存连接'; if (probe.status === 'running') text = '正在测试已保存连接…';
    if (probe.status === 'success') text = `请求成功 · ${probe.latencyMs} ms · 费用未知`;
    if (probe.status === 'cancelled') text = '测试已取消'; if (probe.error) text = probe.error.message;
    if (profile) text = `${profile.name} · ${text}`; this.setText(this.get('probe-state'), text); this.get('cancel-probe').disabled = probe.status !== 'running';
  }
  syncSelect(select, value, empty) {
    const focused = this.document.activeElement === select; const signature = JSON.stringify(this.state.profiles.map((item) => [item.id, item.name]));
    if (!focused && select.dataset.signature !== signature) { select.replaceChildren(this.option('', empty)); for (const profile of this.state.profiles) select.append(this.option(profile.id, profile.name)); select.dataset.signature = signature; }
    if (!focused) select.value = value ?? '';
  }
  makeRoleRow(role) {
    const card = this.node('article', '', 'role-card'); const name = this.node('h3'); const purpose = this.node('p', '', 'muted'); const connection = this.node('p', '', 'muted'); card.append(name, purpose, connection);
    const mappingCard = this.node('div', '', 'mapping-row'); const mappingLabel = this.node('div'); const mappingName = this.node('strong'); const hint = this.node('p', '', 'muted'); mappingLabel.append(mappingName, hint);
    const select = this.node('select'); select.setAttribute('aria-label', `${role.id} AI 连接`); const button = this.node('button', '保存映射', 'secondary'); mappingCard.append(mappingLabel, select, button);
    select.addEventListener('change', () => this.mappingDrafts.set(role.id, select.value));
    button.addEventListener('click', async () => {
      if (button.disabled) return; const projectId = this.projectId; let profileId = null; if (select.value) profileId = select.value; button.disabled = true;
      const result = await this.update('assignProfile', { roleId: role.id, profileId }); button.disabled = false;
      if (result.ok && projectId === this.projectId) { this.mappingDrafts.delete(role.id); this.renderSidebar(); this.notice('映射已保存，原计划已失效，请重新讨论。'); }
    }); return { card, name, purpose, connection, mappingCard, mappingName, hint, select, button };
  }
  memberName(role) { if(role.id==='Supervisor')return '项目监督（Su）';if (role.id === 'ProjectManager') return '后台项目管理'; if (role.id === 'RoleArchitect') return '角色架构师'; return role.name; }
  activity(role) {
    if (role.activity) return role.activity;
    if (role.id === 'Supervisor') { if (this.state.turn?.status === 'running') return 'working'; if (this.state.turn?.status === 'waiting') return 'waiting_answer'; }
    const tasks = this.state.tasks.filter((task) => task.roleId === role.id);
    if (tasks.some((task) => task.status === 'running')) return 'working';
    if (tasks.some((task) => task.status === 'failed')) return 'failed';
    if (tasks.some((task) => ['blocked', 'pending'].includes(task.status))) return 'waiting_dependency'; return 'waiting';
  }
  renderSidebar() {
    this.region('project-list', [this.state.projects, this.projectId], (list) => {
      if (!this.state.projects.length) list.append(this.node('p', '选一个真实项目文件夹', 'empty-note'));
      for (const project of this.state.projects) {
        const button = this.node('button', '', 'project-button'); button.append(this.node('strong', project.name)); button.classList.toggle('active', project.id === this.projectId);
        button.setAttribute('aria-current', 'false'); if (project.id === this.projectId) button.setAttribute('aria-current', 'true');
        button.setAttribute('title', '通过系统目录框重新选择同一目录可恢复会话'); button.addEventListener('click', () => { if (project.id !== this.projectId) void this.update('chooseProject'); }); list.append(button);
      }
    });
    const members = this.get('member-list'); const roles = this.get('role-list'); const mappings = this.get('mapping-list'); const seen = new Set();
    this.setText(this.get('role-count'), String(this.state.roles.length));
    for (const role of this.state.roles) {
      seen.add(role.id); let member = this.memberNodes.get(role.id);
      if (!member) {
        const button = this.node('button', '', 'member-button'); button.dataset.roleId = role.id; const initial = this.node('span', '', 'member-initial'); const name = this.node('strong'); const origin = this.node('small', '', 'member-origin'); const dot = this.node('span', '', 'activity-dot'); dot.setAttribute('aria-hidden', 'true'); button.append(initial, name, origin, dot); member = { button, initial, name, origin, dot }; this.memberNodes.set(role.id, member); members.append(button);
        button.addEventListener('click', () => this.openMember(role.id));
      }
      const activity = this.activity(role); let stateLabel = label(activity); if (activity === 'waiting') stateLabel = '等待任务'; if (role.status === 'legacy' && activity === 'waiting') stateLabel = '职责待补全';
      this.setText(member.origin, this.roleOrigin(role)); this.setText(member.name, this.memberName(role)); this.setText(member.initial, role.id.slice(0, 2).toUpperCase()); member.button.dataset.activity = activity;
      member.button.setAttribute('title', `${this.memberName(role)} · ${this.roleOrigin(role)} · ${stateLabel}`); member.button.setAttribute('aria-label', `${this.memberName(role)}，${stateLabel}，查看成员资料`);
      let row = this.roleRows.get(role.id); if (!row) { row = this.makeRoleRow(role); this.roleRows.set(role.id, row); roles.append(row.card); mappings.append(row.mappingCard); }
      this.setText(row.name, `${this.memberName(role)} · ${role.id}`); row.card.classList.toggle('selected', role.id === this.selectedMember); row.card.hidden = role.id !== this.selectedMember;
      this.setText(row.purpose, `${this.roleOrigin(role)}\n${role.purpose || '职责待补全'}\n定义版本 ${role.revision ?? '历史未知'} · ${label(role.status ?? 'legacy')}\n当前状态：${stateLabel}\n接口：${(role.interfaces ?? []).join('、') || '尚未记录'}\n精确边界：${(role.boundary ?? []).join('、') || '无业务写边界'}\n定义摘要：${role.digest ?? '历史未知'}\n文档：${(role.documents ?? []).map((item) => item.resource + ' · SHA ' + item.contentDigest + ' · ' + item.summary).join('；') || '尚未发布'}`);
      const profile = this.state.profiles.find((item) => item.id === role.profileId); this.setText(row.connection, `连接：${profile?.name ?? '未配置'} · ${profile?.modelId ?? '模型未知'}`);
      this.setText(row.mappingName, this.memberName(role)); this.setText(row.hint, '保存后旧计划失效');
      const assignment = this.state.assignments.find((item) => item.projectId === this.projectId && item.roleId === role.id); let profileId = '';
      if (assignment) profileId = assignment.profileId; if (this.mappingDrafts.has(role.id)) profileId = this.mappingDrafts.get(role.id);
      this.syncSelect(row.select, profileId, '使用默认连接'); row.select.disabled = !this.projectId;
    }
    for (const [id, row] of this.roleRows) if (!seen.has(id)) { row.card.remove(); row.mappingCard.remove(); this.roleRows.delete(id); this.memberNodes.get(id)?.button.remove(); this.memberNodes.delete(id); }
  }
  roleOrigin(role) { if (['ProjectManager', 'RoleArchitect', 'Acceptance','Supervisor'].includes(role.id)) return '系统角色'; if (role.status === 'approved') return '项目角色'; return '来源未记录'; }
  openMember(roleId, runId = null, tab = 'members') {
    this.selectedMember = roleId; if (runId) this.memberRuns.set(this.projectId + '|' + roleId, runId);
    this.toggleDetails(true, tab); this.get('member-details').open = true; this.renderSidebar(); this.renderMemberCurrent(); this.renderMemberConversation(); if (tab === 'members') this.get('member-current').scrollIntoView({ block: 'nearest' });
  }
  renderMemberCurrent() {
    const panel = this.get('member-current'); panel.hidden = !this.selectedMember; if (panel.hidden) return;
    const role = this.state.roles.find((role) => role.id === this.selectedMember); let name = this.selectedMember; if (role) name = this.memberName(role); this.setText(this.get('member-current-title'), name + ' · 当前任务');
    const actualTasks = this.state.tasks.filter((task) => task.roleId === this.selectedMember); const definitions = (this.state.plan?.tasks ?? []).filter((task) => task.roleId === this.selectedMember); const runs = (this.state.memberConversations?.runs ?? []).filter((run) => run.roleId === this.selectedMember); const workingRun = [...runs].reverse().find((run) => run.status === 'running');
    this.region('member-current-tasks', [this.selectedMember, actualTasks, definitions, workingRun, role?.profileId, this.state.profiles], (node) => {
      if (this.selectedMember === 'RoleArchitect' && workingRun?.taskId === 'role-design') { node.append(this.node('h3', '当前实际角色设计'), this.node('p', '完整角色方案设计 · 正在工作；这是实际角色设计run，不是计划业务写入任务。')); }
      if (!actualTasks.length) node.append(this.node('p', '当前没有属于此成员的计划任务。', 'muted'));
      if (actualTasks.length && this.selectedMember === 'RoleArchitect') node.append(this.node('h3', '计划中的角色文档任务'));
      for (const task of actualTasks) { const row = this.node('article', '', 'member-task'); row.append(this.node('h3', task.title + ' · ' + label(task.status)), this.node('p', resultSummary(task), 'muted')); const definition = definitions.find((item) => item.id === task.id); if (definition) this.taskDefinition(row, definition, true); else { const files = this.node('div', '', 'file-list'); this.files(files, (this.state.fileOwners?.owners??[]).filter(item=>item.roleId===task.roleId).map(item=>item.resource)); row.append(files); row.append(this.node('p', '检查说明未记录。', 'muted')); } for (const fact of task.retainedOutputs ?? []) row.append(this.node('p', '恢复核验保留：'+fact.resource+' · 来源 '+fact.sourceRequestId+' · SHA '+(fact.baseline.sha256??'获准缺失')+' · 不代表新写入', 'muted')); if (task.error) row.append(this.node('p', task.error.message, 'error-text')); node.append(row); }
    });
    const evidence = (this.state.evidence ?? []).filter((item) => item.roleId === this.selectedMember);
    this.region('member-current-evidence', [this.selectedMember, evidence], (node) => {
      if (!evidence.length) node.append(this.node('p', '此成员尚无实际检查证据；未执行不能称为通过。', 'muted'));
      for (const item of evidence) { const result = item.result; const detail = this.disclosure('member-evidence-' + item.id, result.checkId + ' · ' + label(result.status) + ' · 实际 ' + result.testCount + ' 项'); detail.append(this.node('p', '任务 ' + item.taskId + ' · 证据 ' + item.id + ' · 计划 ' + item.planDigest, 'member-run-source')); for (const input of result.inputVersions) detail.append(this.node('p', checkInputText(input), 'muted')); if (result.stdout) detail.append(this.node('pre', result.stdout)); if (result.stderr) detail.append(this.node('pre', result.stderr)); if (result.logsTruncated) detail.append(this.node('p', '日志按公开预算裁剪。', 'muted')); node.append(detail); }
    });
  }
  renderMemberActivity() {
    const container = this.get('member-activity'); const working = this.state.roles.filter((role) => role.id !== 'ProjectManager' && ['working', 'waiting_pm_approval', 'executing_shell', 'publishing'].includes(this.activity(role))); container.hidden = working.length === 0; const seen = new Set();
    for (const role of working) {
      seen.add(role.id); let button = this.activityNodes.get(role.id);
      if (!button) { button = this.node('button', '', 'secondary'); button.addEventListener('click', () => { const run = [...(this.state.memberConversations?.runs ?? [])].reverse().find((run) => run.roleId === role.id && run.status === 'running'); this.openMember(role.id, run?.id ?? null, 'conversation'); }); this.activityNodes.set(role.id, button); container.append(button); }
      const run = [...(this.state.memberConversations?.runs ?? [])].reverse().find((run) => run.roleId === role.id && run.status === 'running'); let task = '正在工作'; if (run?.taskId === 'role-design') task = '完整角色方案'; else if (run) task = this.state.plan?.tasks.find((task) => task.id === run.taskId)?.title ?? run.taskId;
      const activity = this.activity(role); this.setText(button, this.memberName(role) + ' · ' + task + ' · ' + label(activity)); button.setAttribute('aria-label', this.memberName(role) + label(activity) + '，查看实际运行对话');
    }
    for (const [id, button] of this.activityNodes) if (!seen.has(id)) { button.remove(); this.activityNodes.delete(id); }
  }
  memberRunStatus(status) { return { running: '正在工作', completed: '模型已结束', failed: '失败', cancelled: '已取消', interrupted: '已中断' }[status] ?? status; }
  renderMemberConversation() {
    const container = this.get('member-conversation'); container.hidden = !this.selectedMember; if (container.hidden) return;
    const journal = this.state.memberConversations; const pm = this.selectedMember === 'Supervisor'; let runs = (journal?.runs ?? []).filter((run) => run.roleId === this.selectedMember); if (pm) { runs = (this.state.timeline?.turns ?? []).map((turn) => ({ id: turn.id, taskId: 'discussion', status: turn.status, startedAt: this.state.timeline.messages.find((message) => message.turnId === turn.id)?.createdAt ?? '未记录', instanceId: null, runId: turn.id, finishedAt: null })); if (this.state.timeline?.legacyMessages.length) runs.unshift({ id: 'legacy-records', taskId: 'legacy-records', status: 'interrupted', startedAt: '未记录', instanceId: null, runId: null, finishedAt: null }); } const key = this.projectId + '|' + this.selectedMember; const select = this.get('member-run-select');
    if (pm) for (const shell of this.state.shellRequests ?? []) if (shell.reviewText || shell.review) runs.push({ id: 'shell-review-' + shell.id, taskId: 'shell-review', status: shell.reviewStatus ?? 'interrupted', startedAt: shell.createdAt, instanceId: shell.reviewer?.instanceId ?? null, runId: shell.reviewer?.runId ?? null, finishedAt: null });
    const requested = this.memberRuns.get(key); let run = runs.find((run) => run.id === requested); if (!run) run = runs.at(-1); if (run) this.memberRuns.set(key, run.id);
    const view = key + '|' + (run?.id ?? 'none'); const log = this.get('member-conversation-log');
    if (this.currentMemberView !== view) { if (this.currentMemberView) this.memberReading.set(this.currentMemberView, log.scrollTop); this.currentMemberView = view; }
    const signature = JSON.stringify(runs.map((run) => [run.id, run.taskId, run.status]));
    if (this.document.activeElement !== select && select.dataset.signature !== signature) { select.replaceChildren(); for (const item of runs) { let task = this.state.plan?.tasks.find((task) => task.id === item.taskId)?.title ?? item.taskId; if (item.taskId === 'role-design') task = '完整角色方案'; if (item.taskId === 'discussion') task = '项目讨论'; if (item.taskId === 'shell-review') task = '真实PM Shell审核'; if (item.taskId === 'legacy-records') task = '旧消息（运行来源未记录）'; select.append(this.option(item.id, task + ' · ' + this.memberRunStatus(item.status) + ' · ' + item.startedAt)); } select.dataset.signature = signature; }
    if (this.document.activeElement !== select) select.value = run?.id ?? ''; select.disabled = runs.length === 0;
    const role = this.state.roles.find((role) => role.id === this.selectedMember); let shownName = this.selectedMember; if (role) shownName = this.memberName(role); this.setText(this.get('member-conversation-title'), shownName + ' · 实际运行对话');
    let binding = '没有已记录的成员对话；旧版本的内容不会补造。';
    if (run) { let ended = run.finishedAt ?? '未记录'; if (run.status === 'running' && !run.finishedAt) ended = '未结束'; binding = '任务 ' + run.taskId + ' · 实例 ' + run.instanceId + ' · run ' + run.runId + '\n' + this.memberRunStatus(run.status) + ' · 开始 ' + run.startedAt + ' · 结束 ' + ended + '\n来源：实际 SDK 文字/工具与宿主终止记录；中断不代表模型正常完成。工具仅公开元数据。'; }
    if (pm && run) binding = '来源：本项目持久PM原始消息与真实讨论记录；实例和结束时间未记录时不补造。\n运行 ' + (run.runId ?? '未记录') + ' · ' + this.memberRunStatus(run.status);
    this.setText(this.get('member-run-binding'), binding);
    const channel=this.selectedMember==='Supervisor'?'su_customer':this.selectedMember==='ProjectManager'?'pm_delegate':'member_task';const memory = this.state.roleMemory?.entries.find((entry) => entry.roleId === this.selectedMember&&(entry.channel===undefined||entry.channel===channel)); const notice = this.state.memoryNotices?.find((item) => item.roleId === this.selectedMember&&(item.channel===undefined||item.channel===channel)); let memoryText = '角色工作记忆尚未记录；原始对话独立保存。模型窗口与费用未知。'; if (memory) memoryText = '角色记忆版本 ' + memory.revision + ' · 已摘要覆盖 ' + memory.coveredMessages + ' 条 · 最近完整消息 ' + memory.recentMessages + ' 条。模型摘要仅用于工作上下文，原文保留；本地字符计量，模型窗口与费用未知。'; if (notice) memoryText += '\n' + notice.message; this.setText(this.get('member-memory-state'), memoryText);
    let events = (journal?.events ?? []).filter((event) => event.conversationId === run?.id); if (pm && run) { if (run.id === 'legacy-records') events = (this.state.timeline?.legacyMessages ?? []).map((message, index) => ({ id: 'legacy-' + index, kind: message.role === 'user' ? 'human_text' : 'assistant_text', text: message.text, createdAt: '未记录', orderKnown: false })); else events = (this.state.timeline?.messages ?? []).filter((message) => message.turnId === run.id).map((message) => ({ ...message, kind: ['human', 'answer'].includes(message.kind) ? 'human_text' : 'assistant_text' })); } const top = log.scrollTop; const follow = this.tab === 'conversation' && !this.get('details-drawer').hidden && log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    if (run) {
      const shells = (this.state.shellRequests ?? []).filter((shell) => pm ? run.id === 'shell-review-' + shell.id : shell.runId === run.id && shell.roleId === this.selectedMember);
      for (const shell of shells) {
        events.push({ id: 'shell-request-' + shell.id, kind: 'host_shell', text: '请求 ' + shell.id + '\n角色 ' + shell.roleId + ' · 任务 ' + shell.taskId + '\n命令：' + shell.command + '\n项目相对cwd：' + (shell.cwd || '.') + '\n原因：' + shell.reason + '\n网络：' + shell.network + ' · 命令预算 ' + shell.timeoutSeconds + ' 秒\n生成范围：' + (shell.generatedEffects.join('、') || '无') + '\n状态：' + label(shell.status), createdAt: shell.createdAt, orderKnown: true });
        if (pm && shell.reviewText) events.push({ id: 'shell-review-text-' + shell.id, kind: 'assistant_text', text: shell.reviewText, createdAt: shell.updatedAt, orderKnown: true });
        if (shell.review) events.push({ id: 'shell-review-decision-' + shell.id, kind: 'host_shell', text: 'PM结构化审核：' + (shell.review.approved ? '批准' : '拒绝') + '\n原因：' + shell.review.reason + '\n请求 ' + shell.id + ' · 当前审批摘要 ' + shell.review.requestDigest + '\n这是历史审核事实，不能重新执行旧命令。', createdAt: shell.updatedAt, orderKnown: true });
        if (!pm && (shell.output.stdout || shell.output.stderr || shell.result)) events.push({ id: 'shell-output-' + shell.id, kind: 'host_shell', text: '请求 ' + shell.id + ' · ' + label(shell.result?.status ?? shell.status) + '\n实际执行：' + (shell.result?.executed ?? '执行中') + ' · 退出码：' + (shell.result?.exitCode ?? '未记录') + '\n标准输出：\n' + shell.output.stdout + '\n错误输出：\n' + shell.output.stderr + (shell.output.truncated ? '\n预览已按预算裁剪，完整日志保留在宿主限额归档。' : '') + '\n实际发布：' + (shell.result?.publishedResources.map((item) => item.resource + (item.missing ? '（已删除）' : '')).join('、') || '无') + '\nShell结束不代表自测或独立验收通过。', createdAt: shell.updatedAt, orderKnown: true });
      }
    }
    const changedRun = this.lastMemberRendered !== view;
    if (changedRun) { log.replaceChildren(); this.memberEventNodes.clear(); this.memberEmpty = null; }
    if (!events.length && !this.memberEmpty) { this.memberEmpty = this.node('p', '尚未产生可显示的实际对话。', 'muted'); log.append(this.memberEmpty); }
    if (events.length && this.memberEmpty) { this.memberEmpty.remove(); this.memberEmpty = null; }
    const seen = new Set();
    for (const event of events) {
      seen.add(event.id); let row = this.memberEventNodes.get(event.id);
      if (!row) { row = { node: this.node('article', '', 'member-event'), signature: null }; this.memberEventNodes.set(event.id, row); log.append(row.node); }
      const signature = JSON.stringify(event); if (row.signature === signature) continue; row.signature = signature; row.node.replaceChildren();
      if (['assistant_text', 'human_text', 'host_briefing', 'host_shell'].includes(event.kind)) { let heading = '实际回复'; if (event.kind === 'human_text') heading = 'Human原始消息 / 答复'; if (event.kind === 'host_briefing') heading = '宿主任务输入（非成员回复）'; if (event.kind === 'host_shell') heading = '真实Shell请求 / 审核 / 执行记录'; row.node.append(this.node('small', heading + ' · ' + event.createdAt)); if (!event.orderKnown) row.node.append(this.node('p', '终态返回文字，流式位置未知。', 'muted')); const body = this.node('div', '', 'message-text'); let shown = event.text; if (pm && event.kind === 'assistant_text') shown = conversationDisplay(event.text); if (event.kind === 'assistant_text' && globalThis.marked?.Lexer) body.append(_markdownContent(this.document, shown).root); else body.textContent = shown; row.node.append(body); if (shown !== event.text) { const raw = this.disclosure('member-raw-' + event.id, '查看原始回复'); raw.append(this.node('pre', event.text)); row.node.append(raw); } }
      else { let title = '工具请求'; if (event.kind === 'tool_result') title = '工具结果'; if (event.kind === 'terminal') title = '运行终态'; row.node.append(this.node('small', title + ' · ' + event.createdAt)); const lines = []; if (event.tool) lines.push(event.tool + ' · 请求 ' + event.requestId); if (event.resource) lines.push('文件：' + event.resource); if (event.checkId) lines.push('检查：' + event.checkId); if (event.status) { let status = event.status; if (event.kind === 'terminal') status = this.memberRunStatus(status); else if (status === 'completed') status = '响应完成'; lines.push('状态：' + status); } if (event.reason) lines.push('原因：' + event.reason); if (event.digest) lines.push('摘要：' + event.digest); row.node.append(this.node('p', lines.join('\n'), 'member-run-source')); }
    }
    for (const [id, row] of this.memberEventNodes) if (!seen.has(id)) { row.node.remove(); this.memberEventNodes.delete(id); }
    if (changedRun) log.scrollTop = this.memberReading.get(view) ?? 0; else if (follow) log.scrollTop = log.scrollHeight; else log.scrollTop = top; this.lastMemberRendered = view;
  }
  conversationItems() {
    const items = []; const timeline = this.state.timeline;
    if (timeline) {
      for (let index = 0; index < timeline.legacyMessages.length; index += 1) { const message = timeline.legacyMessages[index]; items.push({ id: 'legacy-' + index, role: message.role, raw: message.text, text: '旧记录（未记录交互顺序）\n' + message.text }); }
      for (const message of timeline.messages) {
        let role = 'assistant'; if (['human', 'answer'].includes(message.kind)) role = 'user'; let text = message.text;
        if (!message.orderKnown) text = '旧记录或终态校准（顺序未知）\n' + text; items.push({ id: message.id, role, text, raw: message.text });
      }
    } else {
      for (let index = 0; index < this.state.history.messages.length; index += 1) { const message = this.state.history.messages[index]; items.push({ ...message, id: 'history-' + index }); }
      const turn = this.state.turn;
      if (turn && this.pendingHuman && this.pendingHuman.turnId === turn.id && this.pendingHuman.projectId === this.projectId && turn.status !== 'completed') items.push({ id: 'human-' + turn.id, role: 'user', text: this.pendingHuman.text });
      for (const request of this.state.interactions ?? []) {
        items.push({ id: 'question-' + request.requestId, role: 'assistant', text: '旧交互记录（顺序未知）\n' + request.title + '\n' + request.text });
        if (request.answer) items.push({ id: 'answer-' + request.answer.answerId, role: 'user', text: '答复「' + request.title + '」：' + JSON.stringify(request.answer.value) });
      }
      if (['running', 'waiting'].includes(turn?.status) && turn.text) items.push({ id: 'turn-' + turn.id, role: 'assistant', text: turn.text });
    }
    return items;
  }
  renderMessages() {
    const messages = this.get('messages'); const seen = new Set();
    for (const item of this.conversationItems()) {
      seen.add(item.id); let row = this.messageNodes.get(item.id);
      if (!row) {
        const article = this.node('article', '', 'message ' + item.role); const avatar = this.node('span', 'PM', 'message-avatar'); const body = this.node('div', '', 'message-body'); const name = this.node('div', '项目管理', 'message-label'); const content = this.node('div', '', 'message-text');
        if (item.role === 'user') { name.textContent = '你'; avatar.textContent = 'H'; }
        body.append(name, content); article.append(avatar, body); row = { article, body, content, source: null, raw: null, original: null }; this.messageNodes.set(item.id, row); messages.append(article);
      }
      let text = item.text; if (item.role === 'assistant') text = conversationDisplay(item.text);
      if (row.source !== text) {
        row.source = text;
        if (item.role === 'assistant' && globalThis.marked?.Lexer) { const rendered = _markdownContent(this.document, text); row.content.replaceChildren(rendered.root); }
        else { this.setText(row.content, text); if (item.role === 'assistant') { const note = this.node('small', 'Markdown 未加载，已显示完整纯文本。', 'markdown-fallback'); row.content.append(note); } }
      }
      if (item.role === 'assistant' && !row.raw && (globalThis.marked?.Lexer || item.text.includes('```legion-plan'))) { row.raw = this.disclosure('raw-' + item.id, '查看原始回复'); row.raw.className = 'message-raw'; row.original = this.node('pre'); row.raw.append(row.original); row.body.append(row.raw); }
      if (row.raw) { row.raw.hidden = false; this.setText(row.original, item.raw ?? item.text); }
    }
    for (const [id, row] of this.messageNodes) if (!seen.has(id)) { row.article.remove(); this.messageNodes.delete(id); }
  }
  files(container, resources) { for (const resource of resources) container.append(this.node('code', resource)); }
  checkDefinition(container, spec, expanded = false) {
    const detail = this.disclosure('check-' + spec.checkId, `检查 ${spec.checkId}`);
    detail.open = expanded;
    detail.append(this.node('p', `${spec.kind} · 网络 ${spec.network} · 限时 ${spec.timeoutSeconds} 秒 · 日志上限 ${spec.logMaxBytes} bytes`, 'muted'));
    detail.append(this.node('p', `参数：${spec.argv.join(' ')}\n测试文件：${spec.testResources.join('、')}\n输入文件：${spec.inputResources.join('、')}\n输出文件：${spec.outputResources.join('、') || '无'}`, 'check-definition')); container.append(detail);
  }
  taskDefinition(container, task, files = false, expanded = false) {
    container.append(this.node('h3', task.title)); const profile = this.state.profiles.find((item) => item.id === task.profileId);
    container.append(this.node('p', `${task.roleId} · ${profile?.name ?? task.profileId} · 依赖：${task.dependsOn.join('、') || '无前置任务'}`, 'muted'));
    if (files) { const list = this.node('div', '', 'file-list'); this.files(list, (this.state.fileOwners?.owners??[]).filter(item=>item.roleId===task.roleId).map(item=>item.resource)); container.append(list); }
    for (const spec of task.checks ?? []) this.checkDefinition(container, spec, expanded);
    if (!task.checks?.length) container.append(this.node('p', '未记录软件检查', 'muted'));
    if (task.accepts?.length) container.append(this.node('p', '独立验收覆盖：' + task.accepts.join('、')));
    container.append(this.node('p', 'Shell生成写入范围：' + ((task.generatedEffects ?? []).join('、') || '无') + '\n已确认产物类型：' + ((task.artifactScopes ?? []).map((item) => item.scope + ' · ' + item.kind).join('、') || '无') + '\n每条Shell命令由PM结构化审核；批准不能扩大上述范围和源码owner。', 'muted'));
    const instruction = this.disclosure('instruction-' + task.id, '查看任务说明'); instruction.append(this.node('p', task.instruction)); container.append(instruction);
  }
  renderPlan() {
    const plan = this.state.plan; this.get('plan-panel').hidden = !plan;
    this.setText(this.get('task-next-step'), '和项目管理讨论目标，确认完整文件范围后开始。');
    if (plan) this.setText(this.get('task-next-step'), `当前阶段：${label(plan.status)}。可在任务、文件与上下文、成员、记录中查看完整事实。`);
    if (plan?.status === 'draft') this.setText(this.get('task-next-step'), '计划等待确认：核对文件、归属、检查与独立验收，再答复执行确认。');
    if (!plan) {
      for (const id of ['plan-roles', 'plan-tasks', 'plan-files', 'plan-ownership']) this.region(id, null, (node) => { if (id === 'plan-files') node.append(this.node('p', '尚无执行计划。', 'muted')); }); return;
    }
    this.setText(this.get('plan-goal'), plan.goal); this.setText(this.get('plan-status'), label(plan.status));
    this.region('plan-roles', plan.roles, (node) => { for (const role of plan.roles) node.append(this.node('span', `${role.name} · ${role.id}`, 'badge')); });
    this.region('plan-tasks', [plan.tasks, this.state.profiles], (node) => {
      for (const task of plan.tasks) { const row = this.node('article', '', 'plan-task'); this.taskDefinition(row, task); node.append(row); }
      node.append(this.node('p', `确认范围内最多返修 ${plan.governance?.maxRepairRounds ?? '历史未知'} 轮。`, 'muted'));
    });
    this.region('plan-files', plan.tasks, (node) => { for (const task of plan.tasks) { node.append(this.node('h3', `${task.title} · ${task.roleId}`)); const files = this.node('div', '', 'file-list'); this.files(files, (this.state.fileOwners?.owners??[]).filter(item=>item.roleId===task.roleId).map(item=>item.resource)); node.append(files); } });
    this.region('plan-ownership', plan.fileOwnership ?? null, (node) => {
      if (!plan.fileOwnership) { node.append(this.node('p', '历史计划未记录独立归属版本。', 'muted')); return; }
      for (const claim of plan.fileOwnership.claims) node.append(this.node('p', `${claim.resource} → ${claim.roleId}`));
      if (plan.fileOwnership.transfers.length) node.append(this.node('h3', '本次明确归属转交'));
      for (const transfer of plan.fileOwnership.transfers) node.append(this.node('p', `${transfer.resource}：${transfer.fromRoleId} → ${transfer.toRoleId}`, 'ownership-transfer'));
    });
    this.setText(this.get('plan-binding'), `组织 ${plan.organizationVersion} · 第 ${plan.revision} 版 · 上下文 ${this.state.context.files.length} 个文件 · ${plan.profileBindings.length} 个连接版本已绑定`);
    const executionRequest = (this.state.interactions ?? []).find((item) => item.status === 'pending' && item.purpose === 'execute_plan');
    this.get('confirm-plan').disabled = plan.status !== 'draft' || !executionRequest; this.get('stop-execution').hidden = !['confirmed', 'running'].includes(plan.status);
  }
  renderFileOwners() { this.region('file-owners', this.state.fileOwners, (node) => { const owners = this.state.fileOwners?.owners ?? []; if (!owners.length) node.append(this.node('p', '尚无文件归属。', 'muted')); for (const owner of owners) node.append(this.node('p', `${owner.resource} → ${owner.roleId}`)); }); }
  renderResults() {
    const tasks = this.state.tasks; const filter = this.get('status-filter').value || 'all';
    this.region('task-list', [tasks, filter], (node) => {
      let shown = 0;
      for (const task of tasks) {
        if (filter !== 'all' && filter !== task.status) continue; shown += 1;
        const row = this.node('article', '', 'task-row'); row.append(this.node('h3', `${task.title} · ${label(task.status)}`), this.node('p', resultSummary(task)), this.node('p', `成员 ${task.roleId} · 依赖 ${task.dependsOn.join('、') || '无'} · 更新 ${time(task.updatedAt)}`, 'muted'));
        for (const fact of task.retainedOutputs ?? []) row.append(this.node('p', '恢复核验保留：'+fact.resource+' · 来源 '+fact.sourceRequestId+' · SHA '+(fact.baseline.sha256??'获准缺失')+' · 不代表新写入', 'muted')); if (task.error) row.append(this.node('p', task.error.message, 'error-text')); node.append(row);
      }
      if (!shown) node.append(this.node('p', '此状态下尚无任务。', 'muted'));
    });
    const evidence = this.state.evidence ?? []; this.get('execution-panel').hidden = !tasks.length && !evidence.length;
    this.region('execution-results', [tasks, evidence, this.state.plan?.planDigest], (node) => {
      for (const task of tasks) {
        const row = this.node('article', '', 'result-row'); row.append(this.node('strong', `${task.title} · ${label(task.status)}`), this.node('p', resultSummary(task), 'muted'));
        for (const fact of task.retainedOutputs ?? []) row.append(this.node('p', '恢复核验保留：'+fact.resource+' · 来源 '+fact.sourceRequestId+' · SHA '+(fact.baseline.sha256??'获准缺失')+' · 不代表新写入', 'muted')); if (task.error) row.append(this.node('p', task.error.message, 'error-text'));
        for (const result of task.results) {
          let action = '完整写入'; if (result.action === 'edit_file') action = '局部编辑'; let text = `${result.resource || '不合法的路径'} · ${action} · ${label(result.status)} · ${result.reason}`;
          if (result.contentDigest) text += ` · 最终 SHA ${result.contentDigest}`; if (result.observedMutation && !result.success) text += ' · 已观察到写入，请核对实际文件'; row.append(this.node('p', text));
        }
        node.append(row);
      }
      for (const entry of evidence) {
        const result = entry.result; let context = '当前计划'; if (entry.planDigest !== this.state.plan?.planDigest) context = '历史计划';
        const detail = this.disclosure('evidence-' + entry.id, `${result.checkId} · ${label(result.status)} · 实际测试 ${result.testCount} 项`);
        detail.append(this.node('p', `${context} · ${entry.roleId} / ${entry.taskId} · ${entry.id}`, 'history-label'), this.node('p', `实际运行 ${result.executed} · 退出码 ${result.exitCode ?? '未知'} · 原因 ${result.reason}`), this.node('p', `开始 ${time(result.startedAt)} · 结束 ${time(result.finishedAt)}`, 'muted'));
        if (result.environment) detail.append(this.node('p', `${result.environment.platform} · ${result.environment.runtime} ${result.environment.runtimeVersion} · 隔离 ${result.environment.isolation} · 网络 ${result.environment.network}`, 'muted'));
        for (const input of result.inputVersions) detail.append(this.node('p', checkInputText(input), 'muted'));
        if (result.stdout) detail.append(this.node('h3', '标准输出'), this.node('pre', result.stdout)); if (result.stderr) detail.append(this.node('h3', '错误输出'), this.node('pre', result.stderr));
        if (result.logsTruncated) detail.append(this.node('p', '日志已按公开显示预算裁剪。', 'muted')); node.append(detail);
      }
    });
  }
  renderAcceptance() {
    this.region('acceptance-results', [this.state.acceptances, this.state.repairs, this.state.plan?.planDigest, this.state.plan?.governance], (node) => {
      if (!this.state.acceptances?.length) node.append(this.node('p', '尚无独立验收记录。开发自测不代表独立验收。', 'muted'));
      for (const item of this.state.acceptances ?? []) {
        const detail = this.disclosure('acceptance-' + item.id, `${item.taskId} · ${label(item.decision)}`); detail.open = item.decision === 'fail';
        let context = '当前计划'; if (item.planDigest !== this.state.plan?.planDigest) context = '历史计划';
        detail.append(this.node('p', `${context} · ${item.id} · 证据 ${item.evidenceIds.join('、')}`, 'muted'));
        for (const issue of item.issues) detail.append(this.node('p', `${issue.resource} · 原成员 ${issue.roleId} · ${issue.taskId}`), this.node('p', `期望：${issue.expected}\n实际：${issue.actual}\n复现：${issue.reproduction}`, 'interaction-text'));
        if (item.decision === 'fail') {
          detail.append(this.node('p', '项目管理将依据失败记录协调原成员在确认范围内返修。', 'muted'));
          const discuss = this.node('button', '回到对话讨论', 'secondary'); discuss.addEventListener('click', () => { this.toggleDetails(false); this.navigate('conversation'); this.get('message-input').value = `请依据独立验收失败 ${item.id}（${item.taskId}），说明原成员在已确认范围内的返修安排。`; this.get('message-input').focus(); }); detail.append(discuss);
        } node.append(detail);
      }
      for (const repair of this.state.repairs ?? []) {
        const detail = this.disclosure('repair-' + repair.id, `${repair.roleId} · ${repair.taskId} · 第 ${repair.round} 轮返修`);
        let context = '当前计划'; if (repair.planDigest !== this.state.plan?.planDigest) context = '历史计划'; detail.append(this.node('p', `${context} · ${repair.id}`, 'muted'), this.node('p', repair.reason)); const files = this.node('div', '', 'file-list'); this.files(files, (this.state.fileOwners?.owners??[]).filter(item=>item.roleId===repair.roleId).map(item=>item.resource)); detail.append(files); for (const spec of repair.checks) this.checkDefinition(detail, spec); node.append(detail);
      }
      const limit = this.state.plan?.governance?.maxRepairRounds; const current = (this.state.repairs ?? []).filter((item) => item.planDigest === this.state.plan?.planDigest);
      if (limit !== undefined && current.some((item) => item.round >= limit)) node.append(this.node('p', `已到确认的 ${limit} 轮返修上限；仍失败时需要重新讨论。`, 'scope-warning'));
    });
    this.region('proposal-list', this.state.proposals, (node) => {
      if (!this.state.proposals?.length) node.append(this.node('p', '尚无角色提案记录。', 'muted'));
      for (const proposal of this.state.proposals ?? []) {
        const detail = this.disclosure('proposal-' + proposal.id + '-' + proposal.version, `${proposal.id} · 第 ${proposal.version} 版 · ${label(proposal.status)}`);
        detail.append(this.node('p', `基础组织 ${proposal.baseRevision} · ${proposal.baseDigest}\n候选摘要 ${proposal.digest}`, 'muted'));
        if (proposal.review) detail.append(this.node('p', `${proposal.review.decision} · ${proposal.review.reason}`));
        for (const member of proposal.members) detail.append(this.node('p', `${member.name} · ${member.id} · ${member.purpose}\n边界：${member.boundary.join('、') || '无业务文件'}`, 'interaction-text'));
        for (const transfer of proposal.transfers ?? []) detail.append(this.node('p', `${transfer.resource}：${transfer.fromRoleId} → ${transfer.toRoleId}`, 'ownership-transfer')); node.append(detail);
      }
    });
  }
  renderObservation() {
    const observation = this.state.observation;
    this.setText(this.get('observation-state'), '这些是已有文件的记录，不表示当前进程在线。');
    if (observation.status === 'unavailable') {
      let text = '此项目没有可用的开发记录，仍可正常对话。'; if (observation.lastValidAt) text = '来源不可用，以下保留上次有效快照，已过期。'; this.setText(this.get('observation-state'), text);
    }
    this.setText(this.get('governance-state'), `治理记录：${observation.organization?.status ?? '不可用'} · ${observation.organization?.version ?? '无版本'}`);
    this.setText(this.get('record-state'), `任务阶段记录：${observation.tasks.length} 条`); this.setText(this.get('audit-state'), `治理 / 运行审计：${observation.audits.length} 条`);
    this.setText(this.get('snapshot-time'), `本轮观察 ${time(observation.observedAt)} · 最近有效 ${time(observation.lastValidAt)}`);
    this.region('observation-errors', observation.errors, (node) => { for (const error of observation.errors) node.append(this.node('p', error.message, 'error-text')); });
    this.region('source-list', observation.sources, (node) => {
      for (const source of observation.sources) { const row = this.node('article', '', 'source-row'); row.append(this.node('code', source.relativePath), this.node('p', `${label(source.status)} · 文件时间 ${time(source.modifiedAt)}`), this.node('p', `观察 ${time(source.observedAt)} · 最近校验 ${time(source.verifiedAt)} · 缓存 ${source.cached}`, 'muted')); if (source.error) row.append(this.node('p', source.error.message, 'error-text')); node.append(row); }
    });
    this.region('record-list', observation.tasks, (node) => { for (const record of observation.tasks) { const row = this.node('article', '', 'record-row'); row.append(this.node('strong', `${record.taskId} / ${record.nodeId} · ${label(record.status)}`), this.node('p', `${record.roleId} · ${time(record.updatedAt)}`)); if (record.reason) row.append(this.node('p', record.reason)); node.append(row); } });
    this.region('audit-list', observation.audits, (node) => { for (const audit of observation.audits) { const row = this.node('article', '', 'record-row'); row.append(this.node('strong', `${audit.format} · ${audit.eventType}`), this.node('p', `${audit.organizationVersion} · ${label(audit.status)} · ${time(audit.updatedAt)}`)); node.append(row); } });
  }
  render(value) {
    if (!value?.profiles || !value.observation) return;
    const scroll = this.get('chat-scroll'); const top = scroll.scrollTop; const height = scroll.scrollHeight; const follow = height - top - scroll.clientHeight < 80;
    const detailsTop = this.get('details-scroll').scrollTop; const settingsTop = this.get('settings-page').scrollTop;
    const id = value.currentProject?.id ?? null; const initial = this.state === null; const changedProject = id !== this.projectId;
    if (changedProject) {
      if (this.projectId) { this.messageDrafts.set(this.projectId, this.get('message-input').value); this.contextDrafts.set(this.projectId, this.get('context-input').value); }
      this.projectId = id; this.get('message-input').value = this.messageDrafts.get(id) ?? ''; this.get('context-input').value = this.contextDrafts.get(id) ?? value.context.files.map((file) => file.resource).join('\n');
      this.mappingDrafts.clear(); this.roleRows.clear(); this.memberNodes.clear(); this.get('member-list').replaceChildren(); this.get('role-list').replaceChildren(); this.get('mapping-list').replaceChildren(); this.messageNodes.clear(); this.get('messages').replaceChildren();
      if (this.get('interaction-modal').open) { this.saveInteractionDraft(); this.closeDialog(); } this.modalRequest = null; this.pendingHuman = null; this.selectedMember = null; this.activityNodes.clear(); this.get('member-activity').replaceChildren(); this.currentMemberView = null; this.lastMemberRendered = null; this.regions.clear(); this.tabScroll.clear();
    }
    this.get('conversation-page').setAttribute('aria-label','Su客户对话');this.get('message-input').setAttribute('aria-label','给Su的消息');this.get('message-input').placeholder='描述你的想法，和Su一起想清楚…';this.state = value; this.setText(this.get('project-name'), value.currentProject?.name ?? '及时雨 · Handwell');
    const manager = value.roles.find((role) => role.id === 'Supervisor'); let profileId = value.defaultProfileId;
    const mapping = value.assignments.find((item) => item.projectId === id && item.roleId === 'Supervisor'); if (manager?.profileId) profileId = manager.profileId; if (mapping) profileId = mapping.profileId;
    const profile = value.profiles.find((item) => item.id === profileId); this.setText(this.get('manager-connection'), profile?.name ?? '配置一个 AI 连接，和Su开始讨论');
    const empty = this.conversationItems().length === 0; this.get('welcome').hidden = !empty; this.get('suggestions').hidden = !empty; this.get('conversation-page').classList.toggle('welcome-mode', empty);
    this.get('welcome-choose').hidden = id !== null; this.get('welcome-settings').hidden = !id || Boolean(profile);
    this.setText(this.get('welcome-description'), '选择一个项目，带着你的想法开始。'); if (id) this.setText(this.get('welcome-description'), '把目标告诉Su，一起理清方案。'); if (id && !profile) this.setText(this.get('welcome-description'), '项目已准备好，配置一个 AI 连接即可开始。');
    const running = ['running', 'waiting'].includes(value.turn?.status); const executing = ['confirmed', 'running'].includes(value.plan?.status);
    this.get('message-input').disabled = !id; this.get('send-message').disabled = !id || !profile || running || this.sending; this.get('cancel-turn').hidden = !running;
    let status = '选择项目后开始对话'; if (id) status = '需求只发送给Su'; if (running) status = 'Su正在回复'; if (value.turn?.status === 'waiting') status = '等待你的答复，请打开待答复请求'; if (executing) status = '按已确认计划执行中 · 可向Su只读询问进度与文件';
    if (!profile && id) status = '先配置有效的 AI 连接'; this.setText(this.get('conversation-status'), status);
    this.get('select-context').disabled = !id || running || executing;
    this.renderProfiles(); this.renderSidebar(); this.renderMemberActivity(); this.renderMemberCurrent(); this.renderMemberConversation(); this.renderMessages(); this.renderPlan(); this.renderFileOwners(); this.renderResults(); this.renderAcceptance(); this.renderObservation(); this.renderInteractions();
    this.setText(this.get('context-state'), `已读取 ${value.context.files.length} 个文件 · 校验 ${time(value.context.verifiedAt)}`);
    this.region('context-files', value.context, (node) => { for (const file of value.context.files) node.append(this.node('p', `${file.resource} · ${file.byteLength} bytes · SHA ${file.contentDigest ?? file.sha256 ?? '未提供'}`, 'muted')); });
    if (value.error) this.notice(value.error.message, true);
    if (changedProject || initial) scroll.scrollTop = scroll.scrollHeight;
    else if (follow && scroll.scrollHeight !== height) scroll.scrollTop = scroll.scrollHeight;
    else scroll.scrollTop = top;
    this.get('settings-page').scrollTop = settingsTop; this.get('details-scroll').scrollTop = detailsTop;
  }
  renderInteractions() {
    const pending = (this.state.interactions ?? []).filter((request) => request.status === 'pending'); const button = this.get('pending-interaction');
    button.hidden = pending.length === 0; button.textContent = `待答复 ${pending.length} 项 · 查看并答复`;
    if (this.modalRequest && !this.interactionBusy && !pending.some((request) => requestKey(request) === requestKey(this.modalRequest))) {
      this.interactionStale = true; this.inlineError('interaction-error', '请求已更新或取消，请稍后关闭并重新查看当前请求。'); this.interactionControls();
    }
    // Polling updates facts only. Explicitly opening a request owns focus.
  }
  executionScope(container, request) {
    const plan = this.state.plan;
    if (!plan || request.bindings?.planDigest !== plan.planDigest) {
      container.append(this.node('p', '此请求的计划已变化，无法确认。请重新查看当前请求。', 'scope-warning')); this.interactionStale = true; return;
    }
    container.append(this.node('h3', plan.goal), this.node('p', `计划第 ${plan.revision} 版 · 确认范围内最多返修 ${plan.governance?.maxRepairRounds ?? '历史未知'} 轮`, 'muted'));
    container.append(this.node('h3', '执行成员与连接'));
    for (const role of plan.roles) {
      const profile = this.state.profiles.find((item) => item.id === role.profileId); const binding = plan.profileBindings.find((item) => item.profileId === role.profileId);
      container.append(this.node('p', `${role.name} · ${role.id} · 职责第 ${role.revision ?? '未知'} 版\n${profile?.name ?? role.profileId} · ${profile?.modelId ?? '模型未知'}\n角色摘要 ${role.digest ?? '历史未知'}\n连接版本 ${binding?.profileVersion ?? '历史未知'}`, 'interaction-text'));
    }
    container.append(this.node('h3', '全部任务、精确文件与检查'));
    for (const task of plan.tasks) {
      const row = this.node('article', '', 'scope-task'); this.taskDefinition(row, task, false, true);
      for (const resource of (this.state.fileOwners?.owners??[]).filter(item=>item.roleId===task.roleId).map(item=>item.resource)) {
        const claim = plan.fileOwnership?.claims.find((item) => item.resource === resource); row.append(this.node('p', `${resource} → ${claim?.roleId ?? task.roleId}`, 'scope-file'));
      }
      if (!(this.state.fileOwners?.owners??[]).some(item=>item.roleId===task.roleId)) row.append(this.node('p', '此角色当前无独占文件。', 'muted')); container.append(row);
    }
    if (plan.fileOwnership?.transfers.length) container.append(this.node('h3', '需要明确确认的归属转交'));
    for (const transfer of plan.fileOwnership?.transfers ?? []) container.append(this.node('p', `${transfer.resource}：${transfer.fromRoleId} → ${transfer.toRoleId}`, 'ownership-transfer'));
    const advanced = this.disclosure('scope-binding', '完整版本与绑定');
    advanced.append(this.node('p', `请求 ${request.requestId}\n版本 ${request.version}\n请求摘要 ${request.digest}\n计划摘要 ${plan.planDigest}\n组织 ${plan.governance?.organizationRevision ?? '未知'} / ${plan.governance?.organizationDigest ?? '未知'}\n固定上下文 ${plan.contextSnapshotDigest}\n归属 ${plan.fileOwnership?.baseDigest ?? '历史未知'} → ${plan.fileOwnership?.nextDigest ?? '历史未知'}\n请求绑定 ${JSON.stringify(request.bindings)}`, 'scope-binding')); container.append(advanced);
  }
  interactionControls() {
    this.get('interaction-submit').disabled = this.interactionBusy || this.interactionStale;
    this.get('interaction-reject').disabled = this.interactionBusy || this.interactionStale;
    for (const id of ['interaction-close', 'interaction-later']) this.get(id).disabled = this.interactionBusy;
  }
  saveInteractionDraft() {
    if (!this.modalRequest) return; const choice = this.document.querySelector('input[name="interaction-choice"]:checked');
    this.interactionDrafts.set(requestKey(this.modalRequest), { text: this.get('interaction-answer').value, optionId: choice?.value ?? '' });
  }
  openInteraction(purpose = null) {
    if (this.interactionBusy) return; const request = (this.state.interactions ?? []).find((item) => item.status === 'pending' && (!purpose || item.purpose === purpose)); if (!request) return;
    if (this.modalRequest) this.saveInteractionDraft(); this.modalRequest = request; this.interactionStale = false; this.inlineError('interaction-error');
    const draft = this.interactionDrafts.get(requestKey(request)); const dialog = this.get('interaction-modal');
    this.setText(this.get('interaction-title'), request.title); this.setText(this.get('interaction-text'), request.text);
    let kind = '提问'; if (request.kind === 'confirmation') kind = '讨论确认'; if (request.kind === 'choice') kind = '选择'; if (request.purpose === 'execute_plan') kind = '执行确认';
    this.setText(this.get('interaction-kind'), kind); this.setText(this.get('interaction-binding'), `第 ${request.version} 版 · 关闭后仍可稍后答复`);
    const scope = this.get('interaction-scope'); scope.replaceChildren(); scope.hidden = request.purpose !== 'execute_plan'; if (!scope.hidden) this.executionScope(scope, request);
    const choices = this.get('interaction-options'); choices.replaceChildren();
    for (const option of request.options) { const row = this.node('label'); const input = this.node('input'); input.type = 'radio'; input.name = 'interaction-choice'; input.value = option.id; input.checked = draft?.optionId === option.id; row.append(input, this.node('span', option.label)); choices.append(row); }
    this.get('interaction-answer').value = draft?.text ?? ''; this.get('interaction-answer').hidden = request.kind === 'confirmation' || (request.kind === 'choice' && !request.allowSupplement);
    this.get('interaction-reject').hidden = request.kind !== 'confirmation'; let submit = '提交答复'; if (request.kind === 'confirmation') submit = '确认'; if (request.purpose === 'execute_plan') submit = '确认并执行'; this.setText(this.get('interaction-submit'), submit);
    this.interactionControls(); if (!dialog.open) { this.modalFocusReturn = this.document.activeElement; dialog.showModal(); }
  }
  closeDialog() { const dialog = this.get('interaction-modal'); if (dialog.open) dialog.close(); if (this.modalFocusReturn?.isConnected !== false) this.modalFocusReturn?.focus(); this.modalFocusReturn = null; }
  async submitInteraction(rejected = false) {
    const request = this.modalRequest; if (!request || this.interactionBusy || this.interactionStale) return;
    if (!(this.state.interactions ?? []).some((item) => item.status === 'pending' && requestKey(item) === requestKey(request))) { this.interactionStale = true; this.inlineError('interaction-error', '请求已更新，请重新查看。'); this.interactionControls(); return; }
    let value = true; if (rejected) value = false;
    const text = this.get('interaction-answer').value;
    if (request.kind === 'question') { if (!text.trim() || text.length > 16384) { this.inlineError('interaction-error', '请输入非空答复，最多16384字符。'); return; } value = text; }
    if (request.kind === 'choice') {
      const choice = this.document.querySelector('input[name="interaction-choice"]:checked');
      if (!choice || !request.options.some((item) => item.id === choice.value)) { this.inlineError('interaction-error', '请先选择一个有效选项。'); return; }
      let supplement = ''; if (request.allowSupplement) supplement = text; if (supplement.length > 16384) { this.inlineError('interaction-error', '补充最多16384字符。'); return; } value = { optionId: choice.value, text: supplement };
    }
    const submittedFocus = this.document.activeElement;
    this.saveInteractionDraft(); this.interactionBusy = true; this.interactionControls(); this.inlineError('interaction-error');
    const result = await this.update('answerInteraction', { projectId: request.projectId, requestId: request.requestId, version: request.version, requestDigest: request.digest, value });
    this.interactionBusy = false;
    if (result.ok) { this.interactionDrafts.delete(requestKey(request)); this.closeDialog(); this.modalRequest = null; this.navigate('conversation'); }
    else {
      this.inlineError('interaction-error', result.error?.message ?? '答复未保存，请重试。');
      if (['stale_interaction', 'interaction_invalidated', 'unknown_interaction', 'interaction_already_answered'].includes(result.error?.code)) { this.interactionStale = true; this.inlineError('interaction-error', '请求已更新，请稍后关闭并重新查看。'); await this.load(); }
    }
    this.interactionControls();
    // Disabling a focused submit/reject button may send Chromium focus to BODY.
    // Restore only this request's initiating control and leave an active editor alone.
    if (!result.ok && this.get('interaction-modal').open && this.modalRequest && requestKey(this.modalRequest) === requestKey(request) && this.document.activeElement === this.document.body && [this.get('interaction-submit'), this.get('interaction-reject')].includes(submittedFocus)) {
      let target = submittedFocus; if (this.interactionStale) target = this.get('interaction-close');
      if (target.isConnected !== false && !target.disabled && !target.hidden) target.focus();
    }
  }
  async dismissInteraction() {
    const request = this.modalRequest; if (!request || this.interactionBusy) return; this.saveInteractionDraft();
    if (this.interactionStale) { this.closeDialog(); this.modalRequest = null; return; }
    this.interactionBusy = true; this.interactionControls();
    const result = await this.update('closeInteraction', { projectId: request.projectId, requestId: request.requestId, version: request.version, requestDigest: request.digest }); this.interactionBusy = false;
    if (result.ok) { this.closeDialog(); this.modalRequest = null; }
    else this.inlineError('interaction-error', result.error?.message ?? '暂时无法关闭请求，请重试。'); this.interactionControls();
  }
  async load() {
    if (this.reading) return; this.reading = true; const projectId = this.projectId;
    try { const result = await this.call('getState', {}); if (!result.ok) this.fail(result); else if (projectId === this.projectId) this.render(result.value); }
    finally { this.reading = false; }
  }
  async send() {
    if (this.sending || !this.projectId || !this.get('message-input').value.trim() || this.get('send-message').disabled) return;
    const projectId = this.projectId; const text = this.get('message-input').value; this.sending = true; this.get('send-message').disabled = true;
    const result = await this.update('sendMessage', { projectId, roleId: 'Supervisor', text }); this.sending = false;
    if (result.ok && result.value.turn && projectId === this.projectId) this.pendingHuman = { projectId, turnId: result.value.turn.id, text };
    if (result.ok && projectId === this.projectId && this.get('message-input').value === text) this.get('message-input').value = '';
    if (this.state) this.render(this.state);
  }
  start() {
    this.get('pending-interaction').addEventListener('click', () => this.openInteraction());
    this.get('interaction-form').addEventListener('submit', (event) => { event.preventDefault(); void this.submitInteraction(); });
    this.get('interaction-reject').addEventListener('click', () => void this.submitInteraction(true));
    for (const id of ['interaction-close', 'interaction-later']) this.get(id).addEventListener('click', () => void this.dismissInteraction());
    this.get('interaction-modal').addEventListener('cancel', (event) => { event.preventDefault(); void this.dismissInteraction(); });
    for (const button of this.document.querySelectorAll('[data-page]')) button.addEventListener('click', () => this.navigate(button.dataset.page));
    this.get('welcome-settings').addEventListener('click', () => this.navigate('settings'));
    for (const tab of ['task', 'files', 'members', 'conversation', 'records']) {
      const button = this.get('tab-' + tab); button.addEventListener('click', () => this.selectTab(tab));
      button.addEventListener('keydown', (event) => { const names = ['task', 'files', 'members', 'conversation', 'records']; let index = names.indexOf(tab);
        if (event.key === 'ArrowRight') index = (index + 1) % names.length; else if (event.key === 'ArrowLeft') index = (index + names.length - 1) % names.length; else if (event.key === 'Home') index = 0; else if (event.key === 'End') index = names.length - 1; else return;
        event.preventDefault(); this.selectTab(names[index], true);
      });
    }
    this.get('details-drawer').addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.preventDefault(); this.toggleDetails(false); } });
    for (const button of this.document.querySelectorAll('[data-suggestion]')) button.addEventListener('click', () => { this.get('message-input').value = button.dataset.suggestion; this.get('message-input').focus(); });
    for (const id of ['choose-project', 'welcome-choose']) this.get(id).addEventListener('click', () => void this.update('chooseProject'));
    this.get('details-toggle').addEventListener('click', () => this.toggleDetails(this.get('details-drawer').hidden)); this.get('details-close').addEventListener('click', () => this.toggleDetails(false));
    this.get('member-run-select').addEventListener('change', () => { const key = this.projectId + '|' + this.selectedMember; if (this.currentMemberView) this.memberReading.set(this.currentMemberView, this.get('member-conversation-log').scrollTop); this.memberRuns.set(key, this.get('member-run-select').value); this.renderMemberConversation(); });
    this.get('member-settings').addEventListener('click', () => this.navigate('settings'));
    this.get('theme-toggle').addEventListener('click', () => { let next = 'dark'; if (this.document.documentElement.dataset.theme === 'dark') next = 'light'; this.document.documentElement.dataset.theme = next; });
    this.get('refresh-project').addEventListener('click', () => void this.update('refreshProject', {}, '已重新读取并校验来源。'));
    this.get('new-profile').addEventListener('click', () => this.editProfile()); this.get('key-action').addEventListener('change', () => this.keyAction());
    this.get('profile-form').addEventListener('submit', (event) => { event.preventDefault(); void this.saveProfile(); });
    this.get('default-profile').addEventListener('change', async () => {
      const profileId = this.get('default-profile').value; if (!profileId) return; this.defaultDraft = profileId;
      const result = await this.update('setDefaultProfile', { profileId }); if (result.ok) { this.defaultDraft = null; this.render(result.value); this.notice('默认连接已保存，旧计划已失效。'); }
    });
    this.get('message-form').addEventListener('submit', (event) => { event.preventDefault(); void this.send(); });
    this.get('message-input').addEventListener('keydown', (event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); void this.send(); } });
    this.get('select-context').addEventListener('click', () => { const resources = this.get('context-input').value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean); void this.update('selectContext', { projectId: this.projectId, resources }, '上下文已读取，原计划需重新讨论确认。'); });
    this.get('confirm-plan').addEventListener('click', () => this.openInteraction('execute_plan'));
    this.get('stop-execution').addEventListener('click', async () => { const button = this.get('stop-execution'); button.disabled = true; button.textContent = '正在停止…'; await this.update('stopExecution', { projectId: this.projectId }, '已停止当前计划，旧确认不能再次使用。'); button.disabled = false; button.textContent = '停止当前执行'; });
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

function checkInputText(input) { if (input.state === 'absent') return input.resource + ' · 获准缺失（0 bytes，无SHA）'; return input.resource + ' · ' + (input.byteLength ?? '未记录') + ' bytes · SHA ' + input.sha256; }
