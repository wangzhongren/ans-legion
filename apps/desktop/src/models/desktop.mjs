/** Pure, finite desktop contracts shared by every desktop layer. No effects. */
export const PROTOCOLS = Object.freeze(['openai-completions', 'openai-responses', 'anthropic-messages']);
export const KEY_ACTIONS = Object.freeze(['keep', 'replace', 'clear']);
export const IPC_OPERATIONS = Object.freeze(['getState', 'chooseProject', 'refreshProject', 'saveProfile', 'deleteProfile', 'assignProfile', 'testConnection', 'cancelProbe']);
export const LIMITS = Object.freeze({ profiles: 100, assignments: 2000, roles: 100, tasks: 300, audits: 300, sources: 450, fileBytes: 1048576, eventBytes: 1048576, description: 1000 });
export const TASK_STATES = Object.freeze(['pending', 'ready', 'running', 'awaiting-verification', 'verified', 'failed', 'blocked', 'cancelled']);
export const AUDIT_STATES = Object.freeze(['recorded', 'running', 'completed', 'cancelled', 'failed', 'unavailable']);
const ERROR_MESSAGES = Object.freeze({
  invalid_input: '输入字段无效，请检查后重试。', not_found: '连接配置不存在。', profile_limit: '连接配置数量已达上限。',
  settings_unavailable: '无法读写桌面设置，请检查应用数据目录。', settings_corrupt: '桌面设置损坏，请重新配置。',
  encryption_unavailable: '本机加密不可用，请稍后重新配置密钥。', encryption_failed: '密钥加密失败，请重新配置。',
  decryption_failed: '已保存密钥无法解密，请替换或清除密钥。', key_required: '请先保存 API Key。',
  probe_failed: '连接测试失败，请检查协议、地址、模型和凭据。', probe_authentication: '连接认证失败，请检查凭据。',
  probe_protocol: '服务响应不符合所选协议。', probe_timeout: '连接测试超时。', probe_cancelled: '连接测试已取消。',
  probe_busy: '已有连接测试正在进行。', closed: '连接测试服务已关闭。', workspace_unavailable: '无法读取项目记录。',
  workspace_corrupt: '项目记录结构无效。', unsafe_path: '项目记录路径超出允许范围。', unknown_operation: '不支持此操作。',
  unauthorized_sender: '此窗口无权执行操作。', internal_error: '操作失败，请重试。'
});
const INPUT_FIELDS = Object.freeze(['id', 'name', 'protocol', 'provider', 'modelId', 'baseUrl', 'keyAction', 'apiKey', 'projectId', 'roleId', 'profileId', 'probeId']);

export class DesktopValidationError extends Error {
  constructor(field = '') {
    super(ERROR_MESSAGES.invalid_input);
    this.name = 'DesktopValidationError';
    this.code = 'invalid_input';
    this.field = field;
  }
}

export function immutable(value) {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}

export function safeError(code, field = '') {
  let selected = code;
  if (!Object.hasOwn(ERROR_MESSAGES, selected)) selected = 'internal_error';
  let selectedField = '';
  if (INPUT_FIELDS.includes(field)) selectedField = field;
  return immutable({ code: selected, message: ERROR_MESSAGES[selected], field: selectedField });
}

export function success(value) { return immutable({ ok: true, value }); }
export function failure(code, field = '') { return immutable({ ok: false, error: safeError(code, field) }); }
export function validationFailure(error) {
  if (error instanceof DesktopValidationError) return failure('invalid_input', error.field);
  return failure('internal_error');
}

export function exactObject(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw new DesktopValidationError();
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) throw new DesktopValidationError();
  }
  return value;
}

export function textValue(value, field, max = 160, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) throw new DesktopValidationError(field);
  const text = value.trim();
  if (!allowEmpty && text.length === 0) throw new DesktopValidationError(field);
  return text;
}

export function identifier(value, field = 'id') {
  const text = textValue(value, field, 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/u.test(text)) throw new DesktopValidationError(field);
  return text;
}

export function projectIdentifier(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) throw new DesktopValidationError('projectId');
  return value;
}

export function baseUrlValue(value) {
  const text = textValue(value, 'baseUrl', 2048);
  let url;
  try { url = new URL(text); } catch { throw new DesktopValidationError('baseUrl'); }
  if (url.username || url.password || url.search || url.hash) throw new DesktopValidationError('baseUrl');
  const localHosts = ['localhost', '127.0.0.1', '[::1]'];
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localHosts.includes(url.hostname))) throw new DesktopValidationError('baseUrl');
  return url.href.replace(/\/+$/u, '');
}

export function profileFields(value) {
  const id = identifier(value.id);
  const name = textValue(value.name, 'name', 100);
  const protocol = value.protocol;
  if (!PROTOCOLS.includes(protocol)) throw new DesktopValidationError('protocol');
  const provider = textValue(value.provider, 'provider', 100);
  const modelId = textValue(value.modelId, 'modelId', 200);
  const baseUrl = baseUrlValue(value.baseUrl);
  return { id, name, protocol, provider, modelId, baseUrl };
}

export function profileInput(value) {
  exactObject(value, ['id', 'name', 'protocol', 'provider', 'modelId', 'baseUrl', 'keyAction', 'apiKey']);
  let id = value.id;
  if (id === undefined || id === '') id = null;
  if (id !== null) identifier(id);
  const fields = profileFields({ ...value, id: id ?? 'new' });
  if (!KEY_ACTIONS.includes(value.keyAction)) throw new DesktopValidationError('keyAction');
  let apiKey = '';
  if (value.keyAction === 'replace') apiKey = textValue(value.apiKey, 'apiKey', 8192);
  else if (value.apiKey !== undefined && value.apiKey !== '') throw new DesktopValidationError('apiKey');
  return immutable({ ...fields, id, keyAction: value.keyAction, apiKey });
}

export function profileDTO(value) {
  const fields = profileFields(value);
  let hasSavedKey = value.hasSavedKey;
  if (hasSavedKey === undefined) hasSavedKey = Boolean(value.keyCiphertext);
  if (typeof hasSavedKey !== 'boolean') throw new DesktopValidationError();
  return immutable({ ...fields, hasSavedKey });
}

export function storedProfile(value) {
  exactObject(value, ['id', 'name', 'protocol', 'provider', 'modelId', 'baseUrl', 'keyCiphertext']);
  const fields = profileFields(value);
  const keyCiphertext = value.keyCiphertext;
  if (keyCiphertext !== null && (typeof keyCiphertext !== 'string' || keyCiphertext.length > 32768 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(keyCiphertext) || keyCiphertext.length === 0)) throw new DesktopValidationError();
  return immutable({ ...fields, keyCiphertext });
}

export function assignmentDTO(value) {
  exactObject(value, ['projectId', 'roleId', 'profileId']);
  return immutable({ projectId: projectIdentifier(value.projectId), roleId: identifier(value.roleId, 'roleId'), profileId: identifier(value.profileId, 'profileId') });
}

function boundedArray(value, limit) {
  if (!Array.isArray(value) || value.length > limit) throw new DesktopValidationError();
  return value;
}

export function settingsDocument(value) {
  exactObject(value, ['schemaVersion', 'profiles', 'assignments']);
  if (value.schemaVersion !== 1) throw new DesktopValidationError();
  const profiles = boundedArray(value.profiles, LIMITS.profiles).map(storedProfile);
  const ids = new Set(profiles.map((profile) => profile.id));
  if (ids.size !== profiles.length) throw new DesktopValidationError();
  const assignments = boundedArray(value.assignments, LIMITS.assignments).map(assignmentDTO);
  const pairs = new Set();
  for (const item of assignments) {
    const pair = `${item.projectId}/${item.roleId}`;
    if (pairs.has(pair) || !ids.has(item.profileId)) throw new DesktopValidationError();
    pairs.add(pair);
  }
  return immutable({ schemaVersion: 1, profiles, assignments });
}

export function emptySettings() { return settingsDocument({ schemaVersion: 1, profiles: [], assignments: [] }); }
export function profilesDTO(value) {
  return immutable({ profiles: boundedArray(value.profiles, LIMITS.profiles).map(profileDTO), assignments: boundedArray(value.assignments, LIMITS.assignments).map(assignmentDTO) });
}

export function timestamp(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || value.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,7})?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) || !Number.isFinite(Date.parse(value))) throw new DesktopValidationError();
  return value;
}

export function displayText(value, max = LIMITS.description) {
  const text = textValue(value, '', max, true);
  return text.replace(/Bearer\s+\S+|\bsk-[A-Za-z0-9_-]+|\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*\S+/giu, '[已隐藏]');
}

export function sourceDTO(value) {
  const kinds = ['organization', 'role', 'boundary', 'task', 'audit'];
  const states = ['available', 'missing', 'unavailable'];
  if (!kinds.includes(value.kind) || !states.includes(value.status)) throw new DesktopValidationError();
  const relativePath = textValue(value.relativePath, '', 300);
  if (/^[A-Za-z]:|^[/\\]|(?:^|[/\\])\.\.(?:[/\\]|$)/u.test(relativePath)) throw new DesktopValidationError();
  let error = null;
  if (value.error) error = safeError(value.error.code);
  return immutable({ kind: value.kind, relativePath, status: value.status, modifiedAt: timestamp(value.modifiedAt), readAt: timestamp(value.readAt), error });
}

export function roleDTO(value) {
  let reportsTo = null;
  if (value.reportsTo !== null && value.reportsTo !== undefined) reportsTo = identifier(value.reportsTo, 'roleId');
  let profileId = null;
  if (value.profileId !== null && value.profileId !== undefined) profileId = identifier(value.profileId, 'profileId');
  const boundary = boundedArray(value.boundary ?? [], 300).map((path) => displayText(path, 300));
  return immutable({ id: identifier(value.id, 'roleId'), name: displayText(value.name, 100), reportsTo, description: displayText(value.description ?? ''), boundary, profileId });
}

export function taskDTO(value) {
  if (!TASK_STATES.includes(value.status)) throw new DesktopValidationError();
  return immutable({ taskId: identifier(value.taskId), nodeId: identifier(value.nodeId), roleId: identifier(value.roleId, 'roleId'), status: value.status, reason: displayText(value.reason ?? '', 300), updatedAt: timestamp(value.updatedAt) });
}

export function auditDTO(value) {
  if (!['governance', 'runtime'].includes(value.format) || !AUDIT_STATES.includes(value.status)) throw new DesktopValidationError();
  let roleId = null;
  let taskId = null;
  if (value.roleId) roleId = identifier(value.roleId, 'roleId');
  if (value.taskId) taskId = identifier(value.taskId);
  return immutable({ id: identifier(value.id), format: value.format, organizationVersion: displayText(value.organizationVersion, 100), status: value.status, eventType: displayText(value.eventType, 100), roleId, taskId, updatedAt: timestamp(value.updatedAt) });
}

/** Record states and source timestamps never imply current process liveness. */
export function workspaceDTO(value) {
  if (!['available', 'empty', 'unavailable'].includes(value.status)) throw new DesktopValidationError();
  let project = null;
  let organization = null;
  if (value.project) project = { id: projectIdentifier(value.project.id), name: displayText(value.project.name, 100) };
  if (value.organization) {
    if (!['ACCEPTED', 'CANDIDATE', 'unavailable'].includes(value.organization.status)) throw new DesktopValidationError();
    organization = { id: identifier(value.organization.id), version: displayText(value.organization.version, 100), status: value.organization.status };
  }
  return immutable({ status: value.status, project, organization, roles: boundedArray(value.roles ?? [], LIMITS.roles).map(roleDTO), tasks: boundedArray(value.tasks ?? [], LIMITS.tasks).map(taskDTO), audits: boundedArray(value.audits ?? [], LIMITS.audits).map(auditDTO), sources: boundedArray(value.sources ?? [], LIMITS.sources).map(sourceDTO), errors: boundedArray(value.errors ?? [], 100).map((error) => safeError(error.code)), observedAt: timestamp(value.observedAt), lastValidAt: timestamp(value.lastValidAt) });
}

export function emptyWorkspace() { return workspaceDTO({ status: 'empty' }); }

export function probeDTO(value) {
  if (!['idle', 'running', 'success', 'failed', 'cancelled'].includes(value.status)) throw new DesktopValidationError();
  let id = null;
  let profileId = null;
  let error = null;
  let latencyMs = null;
  if (value.id) id = identifier(value.id, 'probeId');
  if (value.profileId) profileId = identifier(value.profileId, 'profileId');
  if (value.error) error = safeError(value.error.code);
  if (value.latencyMs !== null && value.latencyMs !== undefined) {
    if (!Number.isFinite(value.latencyMs) || value.latencyMs < 0 || value.latencyMs > 3600000) throw new DesktopValidationError();
    latencyMs = Math.round(value.latencyMs);
  }
  return immutable({ id, profileId, status: value.status, startedAt: timestamp(value.startedAt), finishedAt: timestamp(value.finishedAt), latencyMs, error });
}

export function desktopDTO(value) {
  const profiles = profilesDTO(value);
  let error = null;
  if (value.error) error = safeError(value.error.code, value.error.field);
  return immutable({ ...profiles, workspace: workspaceDTO(value.workspace), probe: probeDTO(value.probe), error });
}

export function operationInput(operation, input = {}) {
  if (!IPC_OPERATIONS.includes(operation)) return failure('unknown_operation');
  try {
    if (operation === 'saveProfile') return success(profileInput(input));
    if (['getState', 'chooseProject', 'refreshProject'].includes(operation)) { exactObject(input, []); return success({}); }
    if (operation === 'deleteProfile') { exactObject(input, ['id']); return success({ id: identifier(input.id) }); }
    if (operation === 'testConnection') { exactObject(input, ['profileId']); return success({ profileId: identifier(input.profileId, 'profileId') }); }
    if (operation === 'cancelProbe') { exactObject(input, ['probeId']); return success({ probeId: identifier(input.probeId, 'probeId') }); }
    exactObject(input, ['roleId', 'profileId']);
    let profileId = null;
    if (input.profileId !== null) profileId = identifier(input.profileId, 'profileId');
    return success({ roleId: identifier(input.roleId, 'roleId'), profileId });
  } catch (error) { return validationFailure(error); }
}
