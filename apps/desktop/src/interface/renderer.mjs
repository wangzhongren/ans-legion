/** UI adapter only. All model/credential/permission work stays behind fixed preload IPC. */
export function conversationDisplay(text) {
  const clean = text.replace(/```legion-plan\s*\n[\s\S]*?\n```/gu, '').replace(/```legion-plan[^\n]*(?:\n[\s\S]*)?$/gu, '').trim();
  if (clean) return clean;
  if (text.includes('```legion-plan')) return '二哥已带来一份待确认的计划，请查看当前任务并答复执行确认。';
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
    this.projectId = null; this.messageDrafts = new Map(); this.imageDrafts = new Map(); this.contextDrafts = new Map(); this.mappingDrafts = new Map(); this.roleRows = new Map();
    this.memberNodes = new Map(); this.profileNodes = new Map(); this.messageNodes = new Map(); this.regions = new Map();
    this.defaultDraft = null; this.pendingHuman = null; this.modalRequest = null; this.interactionDrafts = new Map();
    this.interactionBusy = false; this.interactionStale = false; this.timer = null; this.page = 'conversation'; this.tab = 'task';
    this.tabScroll = new Map(); this.focusReturn = null; this.modalFocusReturn = null; this.selectedMember = null; this.memberRuns = new Map(); this.memberReading = new Map(); this.activityNodes = new Map(); this.currentMemberView = null; this.memberEventNodes = new Map();
    this.zone = 'conversation'; this.projectTab = 'files'; this.fileDirectory = ''; this.fileCursor = ''; this.previewResource = null; this.previewNextLine = 1;
    this.queryEpoch = 0; this.factSignature = ''; this.selectedRoleId = null; this.pages = new Map(); this.queryTokens = new Map();
    this.mobileNavReturn = null; this.mobileResize = null;
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
    const openedNavigation = this.isMobileNavOpen();
    if (openedNavigation) this.closeMobileNav(false);
    this.page = page;
    this.get('command-grid').hidden = page !== 'conversation'; this.get('workspace-switcher').hidden = page !== 'conversation'; this.get('settings-page').hidden = page !== 'settings';
    for (const button of this.document.querySelectorAll('[data-page]')) {
      const active = button.dataset.page === page; button.classList.toggle('active', active);
      button.setAttribute('aria-current', 'false'); if (active) button.setAttribute('aria-current', 'page');
    }
    this.syncEntrySelection();
    if (page === 'settings') { this.toggleDetails(false); this.get('new-profile').focus(); }
    if (page === 'conversation' && openedNavigation) this.get('message-input').focus();
  }
  syncEntrySelection() {
    const entry = this.get('conversation-nav'); const active = this.page === 'conversation' && this.zone === 'conversation';
    let current = 'false'; if (active) current = 'page';
    entry.classList.toggle('active', active); entry.setAttribute('aria-current', current);
  }
  openCustomerEntry() {
    this.navigate('conversation'); this.selectZone('conversation');
    const input = this.get('message-input');
    if (!input.disabled) input.focus();
    else if (!this.projectId) this.get('welcome-choose').focus();
    else this.get('welcome-settings').focus();
  }
  isMobileNavOpen() { return this.get('project-sidebar').dataset.open === 'true'; }
  openMobileNav() {
    if (this.isMobileNavOpen()) return;
    this.mobileNavReturn = this.document.activeElement;
    this.get('project-sidebar').dataset.open = 'true';
    this.get('nav-backdrop').hidden = false;
    this.get('mobile-nav-toggle').setAttribute('aria-expanded','true');
    this.get('choose-project').focus();
  }
  closeMobileNav(returnFocus = true) {
    if (!this.isMobileNavOpen()) return;
    this.get('project-sidebar').dataset.open = 'false';
    this.get('nav-backdrop').hidden = true;
    this.get('mobile-nav-toggle').setAttribute('aria-expanded','false');
    const previous = this.mobileNavReturn;
    this.mobileNavReturn = null;
    if (returnFocus && previous?.isConnected !== false) previous.focus();
    else if (returnFocus) this.get('mobile-nav-toggle').focus();
  }
  keyAction() {
    const action = this.get('key-action').value; this.get('api-key').disabled = action !== 'replace';
    let text = '填写新密钥，保存成功后清空；失败保留输入。';
    if (action === 'keep') text = '保留已保存密钥，密钥不可读回。';
    if (action === 'clear') text = '保存后移除已保存密钥。'; this.setText(this.get('key-hint'), text);
  }
  editProfile(profile = null) {
    const fields = { 'profile-id': '', 'profile-name': '', protocol: 'openai-completions', provider: '', 'model-id': '', 'base-url': '', 'image-capability':'unknown', 'key-action': 'replace', 'api-key': '' };
    if (profile) Object.assign(fields, { 'profile-id': profile.id, 'profile-name': profile.name, protocol: profile.protocol, provider: profile.provider, 'model-id': profile.modelId, 'base-url': profile.baseUrl, 'image-capability':profile.imageCapability??'unknown', 'key-action': 'keep' });
    for (const [id, value] of Object.entries(fields)) this.get(id).value = value;
    this.setText(this.get('form-title'), '新增连接'); if (profile) this.setText(this.get('form-title'), '编辑连接');
    this.setText(this.get('saved-key'), '尚未保存密钥'); if (profile?.hasSavedKey) this.setText(this.get('saved-key'), '已保存密钥');
    this.inlineError('profile-error'); this.keyAction(); this.renderProfileSelection();
  }
  renderProfileSelection() { for (const [id, row] of this.profileNodes) row.card.classList.toggle('selected', id === this.get('profile-id').value); }
  async saveProfile() {
    if (this.get('save-profile').disabled) return;
    const input = { id: this.get('profile-id').value, name: this.get('profile-name').value, protocol: this.get('protocol').value, provider: this.get('provider').value, modelId: this.get('model-id').value, baseUrl: this.get('base-url').value, imageCapability:this.get('image-capability').value, keyAction: this.get('key-action').value, apiKey: this.get('api-key').value };
    if (input.keyAction !== 'replace') input.apiKey = '';
    const before = new Set(this.state.profiles.map((item) => item.id)); this.get('save-profile').disabled = true;
    const hadActivePlan = ['draft','confirmed','running'].includes(this.state.plan?.status);
    let notice = '连接已保存，后续讨论可使用。'; if (hadActivePlan) notice = '连接已保存，原活动计划已失效，请重新讨论。';
    const result = await this.update('saveProfile', input, notice); this.get('save-profile').disabled = false;
    if (!result.ok) { this.inlineError('profile-error', result.error.message); return; }
    let saved = result.value.profiles.find((item) => item.id === input.id);
    if (!saved) saved = result.value.profiles.find((item) => !before.has(item.id)); this.editProfile(saved ?? null);
  }
  makeProfile(profile) {
    const card = this.node('article', '', 'profile-item'); const name = this.node('h3'); const model = this.node('p'); const protocol = this.node('small'); const key = this.node('span', '', 'badge'); const actions = this.node('div', '', 'profile-actions');
    const edit = this.node('button', '编辑', 'secondary'); edit.addEventListener('click', () => this.editProfile(this.state.profiles.find((item) => item.id === profile.id)));
    const probe = this.node('button', '测试', 'secondary'); probe.addEventListener('click', () => void this.testProfile(profile.id));
    const remove = this.node('button', '删除', 'danger'); remove.addEventListener('click', async () => {
      const current = this.state.profiles.find((item) => item.id === profile.id); if (!current) return;
      const hadActivePlan = ['draft','confirmed','running'].includes(this.state.plan?.status);
      let question = `删除连接「${current.name}」与关联映射？`; if (hadActivePlan) question += '当前活动计划会失效。';
      if (!globalThis.confirm(question)) return;
      let notice = '连接已删除。'; if (hadActivePlan) notice = '连接已删除，原活动计划已失效。';
      const result = await this.update('deleteProfile', { id: profile.id }, notice); if (result.ok && this.get('profile-id').value === profile.id) this.editProfile();
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
    let defaultHint = '二哥使用默认连接；后台 PM 可单独映射。当前没有活动计划。';
    if (['draft','confirmed','running'].includes(this.state.plan?.status)) defaultHint = '二哥使用默认连接；后台 PM 可单独映射。更改连接会使当前活动计划失效并停止其执行。';
    this.setText(this.get('default-profile-hint'),defaultHint);
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
    const select = this.node('select'); select.setAttribute('aria-label', `${this.memberName(role)} AI 连接`); const button = this.node('button', '保存映射', 'secondary'); mappingCard.append(mappingLabel, select, button);
    select.addEventListener('change', () => this.mappingDrafts.set(role.id, select.value));
    button.addEventListener('click', async () => {
      if (button.disabled) return; const projectId = this.projectId; let profileId = null; if (select.value) profileId = select.value; button.disabled = true;
      const hadActivePlan = ['draft','confirmed','running'].includes(this.state.plan?.status);
      const result = await this.update('assignProfile', { roleId: role.id, profileId }); button.disabled = false;
      if (result.ok && projectId === this.projectId) { this.mappingDrafts.delete(role.id); this.renderSidebar(); let notice = '映射已保存，后续任务使用新连接。'; if (hadActivePlan) notice = '映射已保存，原活动计划已失效，请重新讨论。'; this.notice(notice); }
    }); return { card, name, purpose, connection, mappingCard, mappingName, hint, select, button };
  }
  memberName(role) { if(role.id==='Supervisor')return '二哥';if (role.id === 'ProjectManager') return '后台项目管理'; if (role.id === 'RoleArchitect') return '角色架构师'; return role.name; }
  activity(role) {
    if (role.activity) return role.activity;
    if (role.id === 'Supervisor') { if (this.state.turn?.status === 'running') return 'working'; if (this.state.turn?.status === 'waiting') return 'waiting_answer'; }
    const tasks = this.state.tasks.filter((task) => task.roleId === role.id);
    if (tasks.some((task) => task.status === 'running')) return 'working';
    if (tasks.some((task) => task.status === 'failed')) return 'failed';
    if (tasks.some((task) => ['blocked', 'pending'].includes(task.status))) return 'waiting_dependency'; return 'waiting';
  }
  customerEntryState(role) {
    if (!this.projectId) return { activity: 'inactive', text: '先选择项目' };
    if (!role || role.activity === 'inactive') return { activity: 'inactive', text: '入口不可用' };
    const pending = this.state.interactions ?? [];
    if (this.state.turn?.status === 'waiting' || role.activity === 'waiting_answer' || pending.some(item => item.status === 'pending' && item.purpose === 'discussion')) return { activity: 'waiting_answer', text: '等待你的答复' };
    if (this.state.plan?.status === 'running') return { activity: 'working', text: '执行中 · 可问进度' };
    if (this.state.turn?.status === 'running') return { activity: 'working', text: '正在回复' };
    if (this.state.plan?.status === 'confirmed') return { activity: 'waiting_dependency', text: '已确认 · 待执行' };
    if (this.state.plan?.status === 'draft' && pending.some(item => item.status === 'pending' && item.purpose === 'execute_plan')) return { activity: 'waiting_answer', text: '等待你确认' };
    if (this.state.plan?.status === 'draft') return { activity: 'waiting_dependency', text: '计划草案' };
    if (role.activity === 'failed') return { activity: 'failed', text: '上次回复失败' };
    return { activity: 'waiting', text: '待讨论' };
  }
  renderSidebar() {
    this.region('project-list', [this.state.projects, this.projectId], (list) => {
      if (!this.state.projects.length) list.append(this.node('p', '选一个真实项目文件夹', 'empty-note'));
      for (const project of this.state.projects) {
        const button = this.node('button', '', 'project-button'); button.append(this.node('strong', project.name)); button.classList.toggle('active', project.id === this.projectId);
        button.setAttribute('aria-current', 'false'); if (project.id === this.projectId) button.setAttribute('aria-current', 'true');
        button.setAttribute('title', '通过系统目录框重新选择同一目录可恢复会话'); button.addEventListener('click', async () => { if (project.id !== this.projectId) await this.update('chooseProject'); this.closeMobileNav(true); }); list.append(button);
      }
    });
    const members = this.get('member-list'); const roles = this.get('role-list'); const mappings = this.get('mapping-list'); const seen = new Set();
    const entry = this.get('conversation-nav'); const customer = this.state.roles.find(role => role.id === 'Supervisor'); const entryState = this.customerEntryState(customer);
    entry.disabled = !this.projectId || !customer || customer.activity === 'inactive'; entry.dataset.activity = entryState.activity;
    this.setText(this.get('entry-status'), entryState.text); this.get('entry-badge').hidden = !this.projectId || !customer;
    entry.setAttribute('title', `二哥 · ${entryState.text} · 当前项目客户对话`);
    let badge = ''; if (customer && this.projectId) badge = '内置，';
    entry.setAttribute('aria-label', `二哥主入口，${badge}${entryState.text}，当前项目对话`);
    this.syncEntrySelection();
    this.setText(this.get('role-count'), String(this.state.roles.filter(role => role.id !== 'Supervisor').length));
    for (const role of this.state.roles) {
      seen.add(role.id); let member = this.memberNodes.get(role.id);
      if (role.id !== 'Supervisor' && !member) {
        const button = this.node('button', '', 'member-button'); button.dataset.roleId = role.id; const initial = this.node('span', '', 'member-initial'); const name = this.node('strong'); const origin = this.node('small', '', 'member-origin'); const status = this.node('span', '', 'member-status'); const dot = this.node('span', '', 'activity-dot'); const statusText = this.node('small'); dot.setAttribute('aria-hidden', 'true'); status.append(dot, statusText); button.append(initial, name, origin, status); member = { button, initial, name, origin, statusText }; this.memberNodes.set(role.id, member); members.append(button);
        button.addEventListener('click', () => { const wasMobileOpen = this.isMobileNavOpen(); this.closeMobileNav(false); this.navigate('conversation'); this.selectedRoleId = role.id; this.selectZone('roles'); void this.refreshRoleZone(); if (wasMobileOpen) this.get('role-selector').focus(); });
      }
      const activity = this.activity(role); let stateLabel = label(activity); if (activity === 'waiting') stateLabel = '等待任务'; if (role.status === 'legacy' && activity === 'waiting') stateLabel = '职责待补全';
      if (member) {
        this.setText(member.origin, `${this.roleOrigin(role)} · ${role.purpose || '职责摘要未记录'}`); this.setText(member.name, this.memberName(role)); this.setText(member.initial, role.id.slice(0, 2).toUpperCase()); this.setText(member.statusText, stateLabel); member.button.dataset.activity = activity;
        member.button.setAttribute('title', `${this.memberName(role)} · ${this.roleOrigin(role)} · ${role.purpose || '职责摘要未记录'} · ${stateLabel}`); member.button.setAttribute('aria-label', `${this.memberName(role)}，${role.purpose || '职责摘要未记录'}，${stateLabel}，查看角色工作`);
      }
      let row = this.roleRows.get(role.id); if (!row) { row = this.makeRoleRow(role); this.roleRows.set(role.id, row); roles.append(row.card); mappings.append(row.mappingCard); }
      this.setText(row.name, `${this.memberName(role)} · ${role.id}`); row.card.classList.toggle('selected', role.id === this.selectedMember); row.card.hidden = role.id !== this.selectedMember;
      this.setText(row.purpose, `${this.roleOrigin(role)}\n${role.purpose || '职责待补全'}\n定义版本 ${role.revision ?? '历史未知'} · ${label(role.status ?? 'legacy')}\n当前状态：${stateLabel}\n接口：${(role.interfaces ?? []).join('、') || '尚未记录'}\n精确边界：${(role.boundary ?? []).join('、') || '无业务写边界'}\n定义摘要：${role.digest ?? '历史未知'}\n文档：${(role.documents ?? []).map((item) => item.resource + ' · SHA ' + item.contentDigest + ' · ' + item.summary).join('；') || '尚未发布'}`);
      const profile = this.state.profiles.find((item) => item.id === role.profileId); this.setText(row.connection, `连接：${profile?.name ?? '未配置'} · ${profile?.modelId ?? '模型未知'}`);
      this.setText(row.mappingName, this.memberName(role)); let mappingHint = '保存后用于后续任务'; if (['draft','confirmed','running'].includes(this.state.plan?.status)) mappingHint = '保存后当前活动计划失效'; this.setText(row.hint, mappingHint);
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
    const container = this.get('member-conversation');
    container.hidden = !this.selectedMember;
    if (container.hidden) return;
    const role = this.state.roles.find(item => item.id === this.selectedMember);
    let name = this.selectedMember; if (role) name = this.memberName(role);
    this.setText(this.get('member-conversation-title'), name + ' · 工作记录');
    this.setText(this.get('member-run-binding'), '成员原始对话与宿主任务输入只在私有记录保存。此处仅显示安全行动事实；完整分页日志请使用角色运行区。');
    const runs = (this.state.memberConversations?.runs ?? []).filter(item => item.roleId === this.selectedMember);
    const select = this.get('member-run-select');
    const signature = JSON.stringify(runs.map(item => [item.id,item.status]));
    if (this.document.activeElement !== select && select.dataset.signature !== signature) {
      select.replaceChildren();
      for (const run of runs) select.append(this.option(run.id, run.taskId + ' · ' + this.memberRunStatus(run.status)));
      select.dataset.signature = signature;
    }
    const key = this.projectId + '|' + this.selectedMember;
    let run = runs.find(item => item.id === this.memberRuns.get(key));
    if (!run) run = runs.at(-1);
    if (run) this.memberRuns.set(key,run.id);
    if (this.document.activeElement !== select) select.value = run?.id ?? '';
    select.disabled = runs.length === 0;
    let channel = 'member_task'; if (this.selectedMember === 'Supervisor') channel = 'su_customer'; else if (this.selectedMember === 'ProjectManager') channel = 'pm_delegate';
    const memory = this.state.roleMemory?.entries.find(item => item.roleId === this.selectedMember && item.channel === channel);
    let memoryText = '工作记忆尚未记录。分类事实在角色运行区查看。';
    if (memory) memoryText = '私有工作记忆版本 ' + memory.revision + ' · 最近消息 ' + memory.recentMessages + ' 条；摘要正文不公开。';
    this.setText(this.get('member-memory-state'),memoryText);
    const events = (this.state.memberConversations?.events ?? []).filter(item => item.conversationId === run?.id && !['assistant_text','host_briefing'].includes(item.kind));
    this.region('member-conversation-log',[run?.id,events],node => {
      if (!events.length) node.append(this.node('p','尚无可公开的行动记录。','muted'));
      for (const event of events) {
        const row = this.node('article','','member-event');
        row.append(this.node('small',event.createdAt + ' · ' + event.kind));
        row.append(this.node('p',[event.tool,event.status,event.resource,event.checkId,event.reason].filter(Boolean).join(' · '),'member-run-source'));
        node.append(row);
      }
    });
  }
  conversationItems() {
    const items = []; const timeline = this.state.timeline;
    if (timeline) {
      for (let index = 0; index < timeline.legacyMessages.length; index += 1) { const message = timeline.legacyMessages[index]; items.push({ id: 'legacy-' + index, role: message.role, kind: 'legacy', raw: message.text, text: '旧记录（未记录交互顺序）\n' + message.text }); }
      for (const message of timeline.messages) {
        let role = 'assistant'; if (['human', 'answer'].includes(message.kind)) role = 'user'; let text = message.text;
        if (!message.orderKnown) text = '旧记录或终态校准（顺序未知）\n' + text; items.push({ id: message.id, role, kind: message.kind, text, raw: message.text, imageRefs:message.imageRefs??[] });
      }
    } else {
      for (let index = 0; index < this.state.history.messages.length; index += 1) { const message = this.state.history.messages[index]; items.push({ ...message, id: 'history-' + index }); }
      const turn = this.state.turn;
      if (turn && this.pendingHuman && this.pendingHuman.turnId === turn.id && this.pendingHuman.projectId === this.projectId && turn.status !== 'completed') items.push({ id: 'human-' + turn.id, role: 'user', text: this.pendingHuman.text });
      for (const request of this.state.interactions ?? []) {
        items.push({ id: 'question-' + request.requestId, role: 'assistant', kind: 'question', text: '旧交互记录（顺序未知）\n' + request.title + '\n' + request.text });
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
        const article = this.node('article', '', 'message ' + item.role); const avatar = this.node('span', '二哥', 'message-avatar'); const body = this.node('div', '', 'message-body'); const name = this.node('div', '二哥', 'message-label'); const content = this.node('div', '', 'message-text');
        if (item.role === 'user') { name.textContent = '你'; avatar.textContent = 'H'; }
        body.append(name, content); article.append(avatar, body); row = { article, avatar, name, body, content, source: null, raw: null, original: null }; this.messageNodes.set(item.id, row); messages.append(article);
      }
      if (item.role === 'assistant') { let speaker = '二哥'; if (item.kind === 'question') speaker = '二哥 · 转达待答复问题'; this.setText(row.avatar, '二哥'); this.setText(row.name, speaker); }
      let text = item.text; if (item.role === 'assistant') text = conversationDisplay(item.text);
      if (row.source !== text) {
        row.source = text;
        if (item.role === 'assistant' && globalThis.marked?.Lexer) { const rendered = _markdownContent(this.document, text); row.content.replaceChildren(rendered.root); }
        else { this.setText(row.content, text); if (item.role === 'assistant') { const note = this.node('small', 'Markdown 未加载，已显示完整纯文本。', 'markdown-fallback'); row.content.append(note); } }
      }
      if(item.role==='user'&&item.imageRefs?.length&&!row.imageList){row.imageList=this.node('div','','message-image');row.body.append(row.imageList);for(const ref of item.imageRefs){const button=this.node('button','查看图片 · '+ref.mimeType+' · '+ref.width+'×'+ref.height,'secondary compact');button.addEventListener('click',async()=>{const projectId=this.projectId;const result=await this.call('readImagePreview',{projectId,ref});if(!result.ok){this.setText(button,result.error?.message??'图片不可读取');return;}if(projectId!==this.projectId||!button.isConnected)return;const img=this.node('img');img.src='data:'+result.value.ref.mimeType+';base64,'+result.value.data;img.alt='Human发送的图片';button.replaceWith(img);});row.imageList.append(button);}}
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
    this.setText(this.get('task-next-step'), '把目标告诉二哥，确认角色归属、检查和计划后开始。');
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
      this.queryEpoch += 1; this.pages.clear(); this.fileDirectory = ''; this.fileCursor = ''; this.previewResource = null; this.previewNextLine = 1; this.selectedRoleId = null; this.factSignature = '';
      if (this.projectId) { this.messageDrafts.set(this.projectId, this.get('message-input').value); this.contextDrafts.set(this.projectId, this.get('context-input').value); }
      this.projectId = id; this.get('message-input').value = this.messageDrafts.get(id) ?? ''; this.get('context-input').value = this.contextDrafts.get(id) ?? value.context.files.map((file) => file.resource).join('\n');
      this.mappingDrafts.clear(); this.roleRows.clear(); this.memberNodes.clear(); this.get('member-list').replaceChildren(); this.get('role-list').replaceChildren(); this.get('mapping-list').replaceChildren(); this.messageNodes.clear(); this.get('messages').replaceChildren();
      if (this.get('interaction-modal').open) { this.saveInteractionDraft(); this.closeDialog(); } this.modalRequest = null; this.pendingHuman = null; this.selectedMember = null; this.activityNodes.clear(); this.get('member-activity').replaceChildren(); this.currentMemberView = null; this.lastMemberRendered = null; this.regions.clear(); this.tabScroll.clear();
    }
    this.get('conversation-page').setAttribute('aria-label','二哥客户对话');this.get('message-input').setAttribute('aria-label','给二哥的消息');this.get('message-input').placeholder='描述你的想法，和二哥一起想清楚…';this.state = value; this.setText(this.get('project-name'), value.currentProject?.name ?? '二哥项目指挥台');
    const manager = value.roles.find((role) => role.id === 'Supervisor'); let profileId = value.defaultProfileId;
    const mapping = value.assignments.find((item) => item.projectId === id && item.roleId === 'Supervisor'); if (manager?.profileId) profileId = manager.profileId; if (mapping) profileId = mapping.profileId;
    const profile = value.profiles.find((item) => item.id === profileId); this.setText(this.get('manager-connection'), profile?.name ?? '配置一个 AI 连接，和二哥开始讨论');
    const empty = this.conversationItems().length === 0; this.get('welcome').hidden = !empty && Boolean(profile); this.get('suggestions').hidden = !empty; this.get('conversation-page').classList.toggle('welcome-mode', empty);
    this.get('welcome-choose').hidden = id !== null; this.get('welcome-settings').hidden = !id || Boolean(profile);
    this.setText(this.get('welcome-description'), '选择一个项目，和二哥从你的想法开始。'); if (id) this.setText(this.get('welcome-description'), '把目标告诉二哥，一起理清方案。'); if (id && !profile) this.setText(this.get('welcome-description'), '项目已准备好，配置一个 AI 连接后即可和二哥开始。');
    const running = ['running', 'waiting'].includes(value.turn?.status); const executing = ['confirmed', 'running'].includes(value.plan?.status);
    this.get('message-input').disabled = !id; this.get('send-message').disabled = !id || !profile || running || this.sending; this.get('choose-image').disabled=!id||running;this.get('cancel-turn').hidden = !running;
    let status = '选择项目后开始对话'; if (id) status = '需求只发送给二哥'; if (running) status = '二哥正在回复'; if (value.turn?.status === 'waiting') status = '等待你的答复，请打开待答复请求'; if (executing) status = '按已确认计划执行中 · 可向二哥只读询问进度与文件';
    if (!profile && id) status = '先配置有效的 AI 连接'; this.setText(this.get('conversation-status'), status);
    const runningTasks = value.tasks.filter(task => task.status === 'running').length;
    const blockedTasks = value.tasks.filter(task => task.status === 'blocked').length;
    const failedTasks = value.tasks.filter(task => task.status === 'failed').length;
    let planStatus = '尚无计划'; if (value.plan) planStatus = label(value.plan.status); let pendingStatus = ''; if ((value.interactions ?? []).some(item => item.status === 'pending')) pendingStatus = ' · 待答复'; this.setText(this.get('command-status'), `${planStatus} · 运行 ${runningTasks} · 阻塞 ${blockedTasks} · 失败 ${failedTasks}${pendingStatus}`);
    this.get('select-context').disabled = !id || running || executing;
    this.renderProfiles(); this.renderSidebar(); this.renderMemberActivity(); this.renderMemberCurrent(); this.renderMemberConversation(); this.renderMessages(); this.renderImageDrafts(); this.renderPlan(); this.renderFileOwners(); this.renderResults(); this.renderAcceptance(); this.renderObservation(); this.renderInteractions();
    this.setText(this.get('context-state'), `已读取 ${value.context.files.length} 个文件 · 校验 ${time(value.context.verifiedAt)}`);
    this.region('context-files', value.context, (node) => { for (const file of value.context.files) node.append(this.node('p', `${file.resource} · ${file.byteLength} bytes · SHA ${file.contentDigest ?? file.sha256 ?? '未提供'}`, 'muted')); });
    this.renderCommandZones();
    const signature = JSON.stringify({projectId:id,planDigest:value.plan?.planDigest,tasks:value.tasks.map(task => [task.id,task.status,task.checkStatus,task.results.length,task.generatedOutputs?.length]),evidence:value.evidence?.length,acceptances:value.acceptances?.length,owners:value.fileOwners?.version});
    if (signature !== this.factSignature) { this.factSignature = signature; void this.refreshCommandFacts(changedProject); }
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
  renderCommandZones() {
    this.get('command-grid').dataset.zone = this.zone;
    for (const button of this.document.querySelectorAll('[data-zone][role="tab"]')) button.setAttribute('aria-selected',String(button.dataset.zone === this.zone));
    for (const button of this.document.querySelectorAll('[data-project-tab]')) button.setAttribute('aria-selected',String(button.dataset.projectTab === this.projectTab));
    for (const tab of ['files','changes','outputs','checks']) this.get('project-' + tab + '-panel').hidden = this.projectTab !== tab;
    const selector = this.get('role-selector');
    const signature = JSON.stringify(this.state.roles.map(role => [role.id,role.name]));
    if (selector.dataset.signature !== signature && this.document.activeElement !== selector) {
      selector.replaceChildren();
      for (const role of this.state.roles) selector.append(this.option(role.id,this.memberName(role)));
      selector.dataset.signature = signature;
    }
    if (!this.selectedRoleId || !this.state.roles.some(role => role.id === this.selectedRoleId)) this.selectedRoleId = this.state.roles.find(role => role.id === 'Supervisor')?.id ?? this.state.roles[0]?.id ?? null;
    if (this.document.activeElement !== selector) selector.value = this.selectedRoleId ?? '';
    selector.disabled = !this.projectId;
  }
  selectZone(zone,focus = false) {
    if (!['conversation','project','roles'].includes(zone)) return;
    this.zone = zone; this.renderCommandZones(); this.syncEntrySelection();
    if (focus) this.get('zone-' + zone).focus();
    if (zone === 'project' && this.projectId) void this.refreshProjectTab();
    if (zone === 'roles' && this.projectId) void this.refreshRoleZone();
  }
  selectProjectTab(tab,focus = false) {
    if (!['files','changes','outputs','checks'].includes(tab)) return;
    this.projectTab = tab; this.renderCommandZones();
    if (focus) this.document.querySelector('[data-project-tab="' + tab + '"]')?.focus();
    if (this.projectId) void this.refreshProjectTab();
  }
  async commandQuery(operation,input,slot) {
    const projectId = this.projectId, epoch = this.queryEpoch;
    const token = (this.queryTokens.get(slot) ?? 0) + 1;
    this.queryTokens.set(slot,token);
    const result = await this.call(operation,{projectId,...input});
    if (epoch !== this.queryEpoch || projectId !== this.projectId || this.queryTokens.get(slot) !== token) return null;
    return result;
  }
  pageFailure(result,statusId,moreId,refreshId,key) {
    this.setText(this.get(statusId),result.error?.message ?? '查询未完成，请刷新。');
    if (key === 'files') this.fileCursor = '';
    else this.pages.delete(key);
    const more = this.get(moreId), focused = this.document.activeElement === more;
    more.hidden = true;
    if (focused) this.get(refreshId).focus();
  }
  pageMore(moreId,refreshId,nextCursor) {
    const more = this.get(moreId), focused = this.document.activeElement === more;
    more.hidden = !nextCursor;
    if (focused && more.hidden) this.get(refreshId).focus();
  }
  async loadFiles(resource = this.fileDirectory, append = false) {
    if (!this.projectId) return;
    const input = {resource,limit:50};
    if (append) { if (!this.fileCursor) return; input.cursor = this.fileCursor; }
    const result = await this.commandQuery('listProjectFiles',input,'files');
    if (!result) return;
    if (!result.ok) { this.pageFailure(result,'file-status','file-more','project-refresh','files'); return; }
    if (!append) this.get('project-file-list').replaceChildren();
    this.fileDirectory = resource; this.fileCursor = result.value.nextCursor;
    this.setText(this.get('file-path'),resource || '项目根目录');
    let fileStatus = '此目录没有可显示文件。'; if (result.value.entries.length) fileStatus = '普通项目文件 · 只读'; this.setText(this.get('file-status'),fileStatus);
    for (const entry of result.value.entries) {
      let path = entry.name; if (resource) path = resource + '/' + entry.name;
      let mark = '· '; if (entry.kind === 'directory') mark = '▸ '; const button = this.node('button',mark + entry.name,'workspace-file');
      button.addEventListener('click',() => { if (entry.kind === 'directory') void this.loadFiles(path); else void this.previewFile(path); });
      this.get('project-file-list').append(button);
    }
    this.pageMore('file-more','project-refresh',this.fileCursor);
  }
  async previewFile(resource,append = false) {
    if (!this.projectId) return;
    let startLine = 1;
    if (append && resource === this.previewResource) startLine = this.previewNextLine;
    const result = await this.commandQuery('readProjectFile',{resource,startLine,maxBytes:16384},'preview');
    if (!result) return;
    this.get('file-preview').hidden = false;
    this.setText(this.get('file-preview-title'),resource);
    if (!result.ok) { this.setText(this.get('file-preview-status'),result.error?.message ?? '文件不可读。'); this.get('file-preview-text').textContent = ''; this.get('file-preview-more').hidden = true; return; }
    this.previewResource = resource; this.previewNextLine = result.value.nextLine;
    let completion = ' · 可继续读取'; if (result.value.complete) completion = ' · 已读完'; this.setText(this.get('file-preview-status'),'当前文件 · SHA ' + (result.value.sha256 ?? '未知') + ' · ' + result.value.byteLength + ' bytes' + completion);
    if (append) this.get('file-preview-text').textContent += result.value.text;
    else this.get('file-preview-text').textContent = result.value.text;
    this.get('file-preview-more').hidden = result.value.complete;
  }
  factRow(item,kind) {
    const row = this.node('article','','workspace-fact');
    let title = item.taskId ?? item.id;
    if (kind === 'changes') title += ' · ' + (item.resource || '无资源') + ' · ' + label(item.status);
    if (kind === 'outputs') title += ' · ' + item.resource + ' · ' + label(item.status);
    if (kind === 'checks') title += ' · ' + item.checkId + ' · ' + label(item.status);
    if (kind === 'acceptances') title += ' · 独立验收 ' + label(item.decision);
    row.append(this.node('strong',title));
    const details = [];
    if (item.roleId) details.push('角色 ' + item.roleId);
    if (item.sourceRef) details.push('来源 ' + item.sourceRef);
    if (item.observedMutation !== undefined) details.push('实际修改 ' + item.observedMutation);
    if (item.executed !== undefined) details.push('实际执行 ' + item.executed + ' · 测试 ' + item.testCount + ' 项');
    if (item.contentDigest) details.push('SHA ' + item.contentDigest);
    if (item.sha256) details.push('SHA ' + item.sha256);
    if (item.history) details.push('历史记录，非当前通过');
    row.append(this.node('p',details.join(' · '),'muted'));
    if (item.reason) row.append(this.node('p',item.reason));
    if (item.stdout) row.append(this.node('pre',item.stdout));
    if (item.stderr) row.append(this.node('pre',item.stderr));
    for (const issue of item.issues ?? []) row.append(this.node('p',issue.resource + ' · ' + issue.expected + ' / ' + issue.actual,'error-text'));
    if (item.resource && !item.missing) { const open = this.node('button','查看当前文件','secondary compact'); open.addEventListener('click',() => { this.selectProjectTab('files'); void this.previewFile(item.resource); }); row.append(open); }
    return row;
  }
  async loadFacts(kind,append = false) {
    if (!this.projectId || !this.state.plan) return;
    const key = kind;
    const input = {kind,limit:20};
    if (append) { const cursor = this.pages.get(key); if (!cursor) return; input.cursor = cursor; }
    const result = await this.commandQuery('queryProjectFacts',input,'facts-' + kind);
    if (!result) return;
    let panel = 'checks'; if (kind === 'changes') panel = 'changes';
    if (!result.ok) { this.pageFailure(result,panel + '-status',panel + '-more','project-refresh',key); return; }
    const list = this.get('project-' + panel + '-list');
    if (!append && kind === 'changes') list.replaceChildren();
    if (!append && kind === 'checks') list.replaceChildren();
    this.pages.set(key,result.value.nextCursor);
    for (const item of result.value.items) list.append(this.factRow(item,kind));
    let factStatus = '尚无本轮真实检查事实。'; if (kind === 'changes') factStatus = '尚无本轮真实修改事实。'; if (result.value.total) factStatus = '当前计划 · 真实来源 ' + result.value.total + ' 条'; this.setText(this.get(panel + '-status'),factStatus);
    this.pageMore(panel + '-more','project-refresh',result.value.nextCursor);
  }
  async loadChecks() {
    if (!this.projectId || !this.state.plan) return;
    await this.loadFacts('checks');
    await this.loadAcceptances();
  }
  async loadAcceptances(append = false) {
    if (!this.projectId || !this.state.plan) return;
    const input = {kind:'acceptances',limit:20};
    if (append) { const cursor = this.pages.get('acceptances'); if (!cursor) return; input.cursor = cursor; }
    const result = await this.commandQuery('queryProjectFacts',input,'facts-acceptances');
    if (!result) return;
    if (!result.ok) { this.pageFailure(result,'checks-status','acceptances-more','project-refresh','acceptances'); return; }
    this.pages.set('acceptances',result.value.nextCursor);
    for (const item of result.value.items) this.get('project-checks-list').append(this.factRow(item,'acceptances'));
    this.pageMore('acceptances-more','project-refresh',result.value.nextCursor);
  }
  async loadOutputs(append = false) {
    if (!this.projectId || !this.state.plan) return;
    const input = {limit:20};
    if (append) { const cursor = this.pages.get('outputs'); if (!cursor) return; input.cursor = cursor; }
    const result = await this.commandQuery('queryProjectOutputs',input,'outputs');
    if (!result) return;
    if (!result.ok) { this.pageFailure(result,'outputs-status','outputs-more','project-refresh','outputs'); return; }
    if (!append) this.get('project-outputs-list').replaceChildren();
    this.pages.set('outputs',result.value.nextCursor);
    for (const item of result.value.items) this.get('project-outputs-list').append(this.factRow(item,'outputs'));
    let outputStatus = '尚未观察到产物。'; if (result.value.total) outputStatus = '真实发布 / 生成记录 ' + result.value.total + ' 条'; this.setText(this.get('outputs-status'),outputStatus);
    this.pageMore('outputs-more','project-refresh',result.value.nextCursor);
  }
  async refreshProjectTab() {
    if (!this.projectId) return;
    if (this.projectTab === 'files') await this.loadFiles();
    if (this.projectTab === 'changes') await this.loadFacts('changes');
    if (this.projectTab === 'outputs') await this.loadOutputs();
    if (this.projectTab === 'checks') await this.loadChecks();
  }
  async loadRoleActivity() {
    if (!this.projectId) return;
    const result = await this.commandQuery('queryRoleActivity',{},'role-activity');
    if (!result) return;
    if (!result.ok) { this.setText(this.get('role-status'),result.error?.message ?? '角色状态不可读。'); return; }
    let roleStatus = '当前项目实际状态'; if (result.value.history) roleStatus = '历史计划 · 不代表当前执行'; this.setText(this.get('role-status'),roleStatus);
    const selected = this.selectedRoleId;
    this.region('role-activity-list',result.value.roles,node => {
      for (const role of result.value.roles) {
        let activity = label(role.activity), phase = role.phase;
        if (role.activity === 'waiting') activity = '等待任务';
        if (role.activity === 'waiting_answer') activity = '等待你的答复';
        if (role.phase === 'not_recorded') phase = '尚未运行';
        if (role.phase === 'awaiting_human') phase = '等待你的答复';
        if (role.phase === 'reasoning') phase = '正在工作';
        node.append(this.node('p',this.memberName(this.state.roles.find(item => item.id === role.id) ?? role) + ' · ' + activity + ' · ' + phase,'workspace-fact'));
      }
    });
    this.region('role-task-list',[selected,result.value.tasks],node => {
      const tasks = result.value.tasks.filter(item => item.roleId === selected);
      if (!tasks.length) node.append(this.node('p','当前无分配任务。','muted'));
      for (const task of tasks) {
        const row = this.node('article','','workspace-fact');
        row.append(this.node('strong',task.id + ' · ' + label(task.status)));
        let acceptanceStatus = '未验收'; if (task.acceptanceStatus) acceptanceStatus = label(task.acceptanceStatus); row.append(this.node('p','检查 ' + label(task.checkStatus) + ' · 验收 ' + acceptanceStatus + ' · 观察变更 ' + task.observedChanges));
        if (task.blockingTaskIds.length) row.append(this.node('p','等待上游：' + task.blockingTaskIds.join('、'),'error-text'));
        node.append(row);
      }
    });
  }
  async loadRoleLog(append = false) {
    if (!this.projectId || !this.selectedRoleId) return;
    const roleId = this.selectedRoleId;
    const input = {roleId,limit:20};
    if (append) { const cursor = this.pages.get('role-log'); if (!cursor) return; input.cursor = cursor; }
    const result = await this.commandQuery('queryRoleLog',input,'role-log');
    if (!result || roleId !== this.selectedRoleId) return;
    if (!result.ok) { this.pageFailure(result,'role-log-status','role-log-more','role-log-refresh','role-log'); return; }
    if (!append) this.get('role-log-list').replaceChildren();
    this.pages.set('role-log',result.value.nextCursor);
    for (const event of result.value.events) {
      const row = this.node('article','','workspace-fact');
      row.append(this.node('strong',(event.tool || event.kind) + ' · ' + (event.status || '已记录')));
      row.append(this.node('p',[event.createdAt,event.taskId,event.resource,event.checkId,event.sourceRef].filter(Boolean).join(' · '),'muted'));
      if (event.reason) row.append(this.node('p',event.reason));
      this.get('role-log-list').append(row);
    }
    let logStatus = '此角色暂无行动记录。'; if (result.value.events.length) logStatus = '行动事实；原始成员消息不公开。'; this.setText(this.get('role-log-status'),logStatus);
    this.pageMore('role-log-more','role-log-refresh',result.value.nextCursor);
  }
  async loadMemory(append = false) {
    if (!this.projectId) return;
    const kind = this.get('memory-kind').value;
    const input = {limit:20}; if (kind) input.kind = kind;
    if (append) { const cursor = this.pages.get('memory'); if (!cursor) return; input.cursor = cursor; }
    const result = await this.commandQuery('queryProjectMemory',input,'memory');
    if (!result) return;
    if (!result.ok) { this.pageFailure(result,'memory-status','memory-more','memory-refresh','memory'); return; }
    if (!append) this.get('memory-list').replaceChildren();
    this.pages.set('memory',result.value.cursor);
    for (const fact of result.value.facts) {
      const row = this.node('article','','workspace-fact');
      row.append(this.node('strong',fact.kind + ' · ' + fact.ownerRoleId + ' · ' + fact.status));
      row.append(this.node('p',fact.statement));
      row.append(this.node('p','修订 ' + fact.revision + ' · ' + fact.sources.map(source => source.label).join('、'),'muted'));
      this.get('memory-list').append(row);
    }
    let memoryStatus = '当前没有可显示的分类事实。'; if (result.value.total) memoryStatus = '本项目分类事实 ' + result.value.total + ' 条'; this.setText(this.get('memory-status'),memoryStatus);
    this.pageMore('memory-more','memory-refresh',result.value.cursor);
  }
  async refreshRoleZone() { await this.loadRoleActivity(); await this.loadRoleLog(); await this.loadMemory(); }
  async refreshCommandFacts(changedProject) {
    if (!this.projectId) return;
    if (changedProject) await this.loadFiles('');
    await this.loadRoleActivity();
    if (this.state.plan && this.projectTab !== 'files') await this.refreshProjectTab();
    if (changedProject) { await this.loadRoleLog(); await this.loadMemory(); }
  }
  async send() {
    const drafts=this.imageDrafts.get(this.projectId)??[];
    if (this.sending || !this.projectId || (!this.get('message-input').value.trim()&&!drafts.length) || this.get('send-message').disabled) return;
    const projectId = this.projectId; const text = this.get('message-input').value;const imageRefs=drafts.map(item=>item.ref); this.sending = true; this.get('send-message').disabled = true;
    const input={ projectId, roleId: 'Supervisor', text };if(imageRefs.length)input.imageRefs=imageRefs;
    const result = await this.update('sendMessage', input); this.sending = false;
    if (result.ok && result.value.turn && projectId === this.projectId) this.pendingHuman = { projectId, turnId: result.value.turn.id, text };
    if (result.ok && projectId === this.projectId && this.get('message-input').value === text) this.get('message-input').value = '';
    if(result.ok){const current=this.imageDrafts.get(projectId)??[];this.imageDrafts.set(projectId,current.filter(item=>!imageRefs.some(ref=>ref.attachmentId===item.ref.attachmentId)));this.renderImageDrafts();}
    if (this.state) this.render(this.state);
  }
  renderImageDrafts(){
    const drafts=this.imageDrafts.get(this.projectId)??[];
    this.region('image-drafts',[this.projectId,drafts.map(item=>item.ref.attachmentId)],node=>{for(const item of drafts){const card=this.node('div','','image-draft');const img=this.node('img');img.src=item.dataUrl;img.alt='待发送图片';const remove=this.node('button','移除图片','secondary');remove.type='button';remove.addEventListener('click',async()=>{const projectId=this.projectId;const result=await this.call('discardImage',{projectId,ref:item.ref});if(!result.ok){this.fail(result);return;}const current=this.imageDrafts.get(projectId)??[];this.imageDrafts.set(projectId,current.filter(value=>value.ref.attachmentId!==item.ref.attachmentId));if(projectId===this.projectId){this.renderImageDrafts();this.get('choose-image').focus();}});card.append(img,remove);node.append(card);}});
  }
  async addImageFile(file){
    const projectId=this.projectId;if(!projectId||!file||!['image/png','image/jpeg'].includes(file.type)||!Number.isSafeInteger(file.size)||file.size<1||file.size>4194304){this.notice('只接受当前项目内不超过4MiB的PNG/JPEG图片。',true);return;}
    const drafts=this.imageDrafts.get(projectId)??[];if(drafts.length>=4||drafts.reduce((sum,item)=>sum+item.ref.byteLength,0)+file.size>8388608){this.notice('每次最多4张图片，总计8MiB。',true);return;}
    let dataUrl;try{dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('image_read_failed'));reader.readAsDataURL(file);});}catch{this.notice('图片读取失败，请重新选择。',true);return;}
    if(projectId!==this.projectId)return;
    const prefix='data:'+file.type+';base64,';if(typeof dataUrl!=='string'||!dataUrl.startsWith(prefix)){this.notice('图片读取失败，请重新选择。',true);return;}
    const result=await this.call('stageImage',{projectId,mimeType:file.type,data:dataUrl.slice(prefix.length)});
    if(!result.ok){this.fail(result);return;}if(projectId!==this.projectId)return;
    this.imageDrafts.set(projectId,[...(this.imageDrafts.get(projectId)??[]),{ref:result.value.ref,dataUrl}]);this.renderImageDrafts();this.notice('图片已加入待发送内容。');
  }
  start() {
    this.get('mobile-nav-toggle').addEventListener('click',() => { if (this.isMobileNavOpen()) this.closeMobileNav(true); else this.openMobileNav(); });
    this.get('nav-backdrop').addEventListener('click',() => this.closeMobileNav(true));
    this.get('project-sidebar').addEventListener('keydown',event => { if (event.key === 'Escape' && this.isMobileNavOpen()) { event.preventDefault(); this.closeMobileNav(true); } });
    this.mobileResize = () => { if (globalThis.window?.innerWidth > 900 && this.isMobileNavOpen()) { const focusedToggle = this.document.activeElement === this.get('mobile-nav-toggle'); this.closeMobileNav(false); if (focusedToggle) this.get('conversation-nav').focus(); } };
    globalThis.window?.addEventListener('resize',this.mobileResize);
    for (const button of this.document.querySelectorAll('[data-zone][role="tab"]')) {
      button.addEventListener('click',() => this.selectZone(button.dataset.zone,true));
      button.addEventListener('keydown',event => { const zones=['conversation','project','roles']; const index=zones.indexOf(button.dataset.zone); let next=index; if(event.key==='ArrowRight')next=(index+1)%zones.length;else if(event.key==='ArrowLeft')next=(index+zones.length-1)%zones.length;else return;event.preventDefault();this.selectZone(zones[next],true); });
    }
    for (const button of this.document.querySelectorAll('[data-project-tab]')) button.addEventListener('click',() => this.selectProjectTab(button.dataset.projectTab,true));
    this.get('top-choose-project').addEventListener('click',() => void this.update('chooseProject'));
    this.get('project-refresh').addEventListener('click',() => void this.refreshProjectTab());
    this.get('roles-refresh').addEventListener('click',() => void this.refreshRoleZone());
    this.get('file-parent').addEventListener('click',() => { const pieces=this.fileDirectory.split('/');pieces.pop();void this.loadFiles(pieces.join('/')); });
    this.get('file-more').addEventListener('click',() => void this.loadFiles(this.fileDirectory,true));
    this.get('file-preview-close').addEventListener('click',() => { this.get('file-preview').hidden=true;this.previewResource=null; });
    this.get('file-preview-more').addEventListener('click',() => { if(this.previewResource)void this.previewFile(this.previewResource,true); });
    this.get('changes-more').addEventListener('click',() => void this.loadFacts('changes',true));
    this.get('outputs-more').addEventListener('click',() => void this.loadOutputs(true));
    this.get('checks-more').addEventListener('click',() => void this.loadFacts('checks',true));
    this.get('acceptances-more').addEventListener('click',() => void this.loadAcceptances(true));
    this.get('role-selector').addEventListener('change',() => { this.selectedRoleId=this.get('role-selector').value;this.pages.delete('role-log');void this.loadRoleActivity();void this.loadRoleLog(); });
    this.get('role-log-refresh').addEventListener('click',() => void this.loadRoleLog());
    this.get('role-log-more').addEventListener('click',() => void this.loadRoleLog(true));
    this.get('memory-refresh').addEventListener('click',() => void this.loadMemory());
    this.get('memory-kind').addEventListener('change',() => { this.pages.delete('memory');void this.loadMemory(); });
    this.get('memory-more').addEventListener('click',() => void this.loadMemory(true));
    this.get('pending-interaction').addEventListener('click', () => this.openInteraction());
    this.get('interaction-form').addEventListener('submit', (event) => { event.preventDefault(); void this.submitInteraction(); });
    this.get('interaction-reject').addEventListener('click', () => void this.submitInteraction(true));
    for (const id of ['interaction-close', 'interaction-later']) this.get(id).addEventListener('click', () => void this.dismissInteraction());
    this.get('interaction-modal').addEventListener('cancel', (event) => { event.preventDefault(); void this.dismissInteraction(); });
    for (const button of this.document.querySelectorAll('[data-page]')) button.addEventListener('click', () => { if (button === this.get('conversation-nav')) this.openCustomerEntry(); else this.navigate(button.dataset.page); });
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
    for (const id of ['choose-project', 'welcome-choose']) this.get(id).addEventListener('click', async () => { await this.update('chooseProject'); this.closeMobileNav(true); });
    this.get('details-toggle').addEventListener('click', () => this.toggleDetails(this.get('details-drawer').hidden)); this.get('details-close').addEventListener('click', () => this.toggleDetails(false));
    this.get('member-run-select').addEventListener('change', () => { const key = this.projectId + '|' + this.selectedMember; if (this.currentMemberView) this.memberReading.set(this.currentMemberView, this.get('member-conversation-log').scrollTop); this.memberRuns.set(key, this.get('member-run-select').value); this.renderMemberConversation(); });
    this.get('member-settings').addEventListener('click', () => this.navigate('settings'));
    this.get('theme-toggle').addEventListener('click', () => { let next = 'dark'; if (this.document.documentElement.dataset.theme === 'dark') next = 'light'; this.document.documentElement.dataset.theme = next; });
    this.get('refresh-project').addEventListener('click', () => void this.update('refreshProject', {}, '已重新读取并校验来源。'));
    this.get('new-profile').addEventListener('click', () => this.editProfile()); this.get('key-action').addEventListener('change', () => this.keyAction());
    this.get('profile-form').addEventListener('submit', (event) => { event.preventDefault(); void this.saveProfile(); });
    this.get('default-profile').addEventListener('change', async () => {
      const profileId = this.get('default-profile').value; if (!profileId) return; this.defaultDraft = profileId;
      const hadActivePlan = ['draft','confirmed','running'].includes(this.state?.plan?.status);
      const result = await this.update('setDefaultProfile', { profileId }); if (result.ok) { this.defaultDraft = null; this.render(result.value); let message = '默认连接已保存，后续讨论使用新连接。'; if (hadActivePlan) message = '默认连接已保存，原活动计划已失效。'; this.notice(message); }
    });
    this.get('message-form').addEventListener('submit', (event) => { event.preventDefault(); void this.send(); });
    this.get('choose-image').addEventListener('click',()=>this.get('image-file').click());
    this.get('image-file').addEventListener('change',event=>{const files=[...(event.target.files??[])];void (async()=>{for(const file of files)await this.addImageFile(file);})();event.target.value='';});
    this.get('message-input').addEventListener('paste',event=>{const files=[...(event.clipboardData?.files??[])].filter(file=>['image/png','image/jpeg'].includes(file.type));if(files.length){event.preventDefault();void (async()=>{for(const file of files)await this.addImageFile(file);})();}});
    this.get('message-form').addEventListener('dragover',event=>{if([...(event.dataTransfer?.types??[])].includes('Files')){event.preventDefault();this.get('composer-box').dataset.imageDrop='true';}});
    this.get('message-form').addEventListener('dragleave',()=>{this.get('composer-box').dataset.imageDrop='false';});
    this.get('message-form').addEventListener('drop',event=>{this.get('composer-box').dataset.imageDrop='false';const files=[...(event.dataTransfer?.files??[])].filter(file=>['image/png','image/jpeg'].includes(file.type));if(files.length){event.preventDefault();void (async()=>{for(const file of files)await this.addImageFile(file);})();}});
    this.get('message-input').addEventListener('keydown', (event) => { if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); void this.send(); } });
    this.get('select-context').addEventListener('click', () => { const resources = this.get('context-input').value.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean); void this.update('selectContext', { projectId: this.projectId, resources }, '上下文已读取，原计划需重新讨论确认。'); });
    this.get('confirm-plan').addEventListener('click', () => this.openInteraction('execute_plan'));
    this.get('stop-execution').addEventListener('click', async () => { const button = this.get('stop-execution'); button.disabled = true; button.textContent = '正在停止…'; await this.update('stopExecution', { projectId: this.projectId }, '已停止当前计划，旧确认不能再次使用。'); button.disabled = false; button.textContent = '停止当前执行'; });
    this.get('cancel-turn').addEventListener('click', () => { if (this.state.turn) void this.update('cancelTurn', { projectId: this.projectId, turnId: this.state.turn.id }); });
    this.get('cancel-probe').addEventListener('click', async () => { const result = await this.call('cancelProbe', { probeId: this.state.probe.id }); if (!result.ok) this.fail(result); await this.load(); });
    this.get('status-filter').addEventListener('change', () => this.renderResults());
    this.editProfile(); void this.load(); this.timer = setInterval(() => { void this.load(); }, 1000);
  }
  stop() { if (this.timer) clearInterval(this.timer); this.timer = null; if (this.mobileResize) globalThis.window?.removeEventListener('resize',this.mobileResize); this.mobileResize = null; }
}
if (typeof window !== 'undefined' && window.legionDesktop) {
  const renderer = new _Renderer(document, window.legionDesktop); renderer.start(); window.addEventListener('beforeunload', () => renderer.stop(), { once: true });
}

function checkInputText(input) { if (input.state === 'absent') return input.resource + ' · 获准缺失（0 bytes，无SHA）'; return input.resource + ' · ' + (input.byteLength ?? '未记录') + ' bytes · SHA ' + input.sha256; }
