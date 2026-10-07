/** Complete finite workbench contracts. Pure values; no SDK, IO, clocks or authority issuance. */
import {
  digestValue,
  normalizeResource,
  PiConversationHistory
} from 'legion-runtime/workbench-models';
import {
  exactObject,
  textValue,
  identifier,
  projectIdentifier,
  timestamp,
  displayText,
  immutable,
  profilesDTO,
  probeDTO,
  emptyWorkspace,
  safeError,
  roleDTO,
  taskDTO,
  auditDTO,
  sourceDTO,
  operationInput,
  DesktopValidationError
} from './desktop.mjs';
export const WB_LIMITS = Object.freeze({
  projects: 64,
  roles: 32,
  tasks: 64,
  taskFiles: 64,
  historyBytes: 8388608,
  projectBytes: 4194304,
  taskDocumentBytes: 16777216,
  taskEvents: 4096,
  refreshBytes: 67108864,
  contextFileBytes: 262144,
  contextFiles: 16,
  contextBytes: 2097152
});
export const WB_OPERATIONS = Object.freeze(['getState', 'chooseProject', 'refreshProject', 'setDefaultProfile', 'saveProfile', 'deleteProfile', 'assignProfile', 'sendMessage', 'selectContext', 'confirmPlan', 'cancelTurn', 'stopExecution', 'testConnection', 'cancelProbe']);
export const WB_TASK_STATES = Object.freeze(['pending', 'running', 'completed', 'failed', 'blocked', 'cancelled', 'interrupted']);
const OUTPUT_MESSAGES = Object.freeze({
  task_outputs_missing: '模型运行结束，但授权目标文件尚未全部生成。',
  task_write_failed: '模型运行结束，实际文件写入包含失败或拒绝。'
});
const MESSAGES = Object.freeze({
  invalid_plan: '计划结构或依赖无效，请与项目管理修改后重试。',
  plan_changed: '计划、连接或上下文已改变，请重新确认。',
  manager_only: '需求只能发送给项目管理，执行成员仅可查看任务。',
  project_missing: '当前项目不存在或未选择。',
  project_unavailable: '无法访问项目目录或项目定义。',
  project_corrupt: '保存的项目定义损坏。',
  data_overlap: '项目目录与应用数据目录重叠，请选择其他目录。',
  history_unavailable: '无法读写此项目的会话历史。',
  history_corrupt: '会话历史损坏或超出预算。',
  context_unavailable: '无法读取所选上下文文件。',
  context_changed: '上下文文件或项目身份已改变，请重新选择并确认。',
  context_budget: '上下文超出16个文件、单文件256KiB或合计2MiB预算。',
  record_budget: '记录读取超出本轮预算。',
  conversation_busy: '当前项目管理仍在回复，请等待或停止本轮。',
  execution_busy: '当前计划正在执行，请先停止。',
  pi_auth_error: '模型认证失败，请检查连接密钥。',
  pi_network_error: '模型网络请求失败，请检查连接。',
  pi_protocol_error: '模型响应格式无效，请检查协议。',
  pi_turn_timeout: '模型本轮请求超时。',
  pi_text_budget: '模型输出超出本轮文本预算。',
  pi_queue_budget: '模型事件超出队列预算。',
  pi_history_budget: '模型会话超出历史预算。',
  pi_unexpected_tool_call: '讨论期间模型请求了未授权工具。',
  pi_model_error: '模型请求失败，请检查连接后重试。',
  pi_model_aborted: '模型请求已停止。',
  pi_run_failed: '模型运行失败。',
  pi_cleanup_failed: '模型资源关闭失败。',
  pi_run_cancelled: '本轮已停止。',
  audit_unavailable: '执行审计不可用，后续写入已停止。'
});
export class WorkbenchValidationError extends Error {
  constructor(code = 'invalid_input') {
    super(code);
    this.code = code;
  }
} export function wbError(code, field = '') {
  if (Object.hasOwn(OUTPUT_MESSAGES, code)) return immutable({
    code,
    message: OUTPUT_MESSAGES[code],
    field: ''
  });
  if (Object.hasOwn(MESSAGES, code)) return immutable({
    code,
    message: MESSAGES[code],
    field: ''
  });
  return safeError(code, field);
} export function wbSuccess(value) {
  return immutable({
    ok: true,
    value
  });
} export function wbFailure(code, field = '') {
  return immutable({
    ok: false,
    error: wbError(code, field)
  });
} export function wbCaught(error, fallback = 'internal_error') {
  if (error instanceof WorkbenchValidationError || error instanceof DesktopValidationError) return wbFailure(error.code);
  return wbFailure(fallback);
} export function conversationText(value, maximum = 65536) {
  if (typeof value !== 'string' || value.length > maximum || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) reject();
  return value;
} export function workbenchInput(operation, input = {
}) {
  if (!WB_OPERATIONS.includes(operation)) return wbFailure('unknown_operation');
  try {
    if (['saveProfile', 'deleteProfile', 'assignProfile', 'testConnection', 'cancelProbe', 'chooseProject', 'refreshProject'].includes(operation)) return operationInput(operation, input);
    if (operation === 'getState') {
      exactObject(input, ['force']);
      if (input.force !== undefined && typeof input.force !== 'boolean') reject();
      return wbSuccess({
        force: input.force === true
      });
    } if (operation === 'setDefaultProfile') {
      exactObject(input, ['profileId']);
      return wbSuccess({
        profileId: identifier(input.profileId)
      });
    } const fields = {
      sendMessage: ['projectId',
      'roleId',
      'text'],
      selectContext: ['projectId',
      'resources'],
      confirmPlan: ['projectId',
      'planDigest'],
      cancelTurn: ['projectId',
      'turnId'],
      stopExecution: ['projectId']
    };
    exactObject(input, fields[operation]);
    const result = {
      projectId: projectIdentifier(input.projectId)
    };
    if (operation === 'sendMessage') {
      if (input.roleId !== 'ProjectManager') reject('manager_only');
      result.roleId = 'ProjectManager';
      result.text = conversationText(input.text);
      if (!result.text.trim()) reject();
    } if (operation === 'selectContext') result.resources = exactResources(input.resources, WB_LIMITS.contextFiles);
    if (operation === 'confirmPlan') result.planDigest = sha(input.planDigest);
    if (operation === 'cancelTurn') result.turnId = identifier(input.turnId);
    return wbSuccess(result);
  } catch (error) {
    return wbCaught(error);
  }
} function reject(code = 'invalid_input') {
  throw new WorkbenchValidationError(code);
} function array(value, maximum) {
  if (!Array.isArray(value) || value.length > maximum) reject();
  return value;
} function sha(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) reject();
  return value;
} export function exactResources(value, maximum = WB_LIMITS.taskFiles) {
  const seen = new Set();
  const result = array(value, maximum).map((item) => {
    const resource = normalizeResource(item); const key = resource.toLowerCase(); if (seen.has(key)) reject(); seen.add(key); return resource;
  });
  return Object.freeze(result.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase(), 'en')));
} export function workspaceIdentity(value) {
  exactObject(value, ['canonicalPath', 'deviceId', 'fileId']);
  const canonicalPath = textValue(value.canonicalPath, '', 32767).replaceAll('\\', '/');
  if (!/^(?:[A-Za-z]:\/|\/)/u.test(canonicalPath) || canonicalPath.split('/').some((part) => ['.', '..'].includes(part))) reject();
  for (const field of ['deviceId', 'fileId']) if (typeof value[field] !== 'string' || !/^(?:0|[1-9][0-9]*)$/u.test(value[field])) reject();
  if (value.fileId === '0') reject();
  return immutable({
    canonicalPath,
    deviceId: value.deviceId,
    fileId: value.fileId
  });
} export function identityKey(value) {
  const identity = workspaceIdentity(value);
  return digestValue({
    ...identity,
    canonicalPath: identity.canonicalPath.toLowerCase()
  });
} export function contextDescriptor(value) {
  exactObject(value, ['files', 'verifiedAt']);
  let total = 0;
  const files = array(value.files, WB_LIMITS.contextFiles).map((file) => {
    exactObject(file, ['resource', 'byteLength', 'sha256']); if (!Number.isSafeInteger(file.byteLength) || file.byteLength < 0 || file.byteLength > WB_LIMITS.contextFileBytes) reject('context_budget'); total += file.byteLength; return {
      resource: normalizeResource(file.resource),
      byteLength: file.byteLength,
      sha256: sha(file.sha256)
    };
  });
  if (total > WB_LIMITS.contextBytes) reject('context_budget');
  exactResources(files.map((file) => file.resource), WB_LIMITS.contextFiles);
  files.sort((a, b) => a.resource.toLowerCase().localeCompare(b.resource.toLowerCase(), 'en'));
  return immutable({
    files,
    verifiedAt: timestamp(value.verifiedAt)
  });
} export function contextDigest(value) {
  return digestValue(contextDescriptor(value).files.map((file) => ({
    ...file,
    resource: file.resource.toLowerCase()
  })));
} function role(value) {
  exactObject(value, ['id', 'name', 'purpose', 'profileId']);
  const id = identifier(value.id, 'roleId');
  if (['Human', 'ProjectManager'].includes(id)) reject('invalid_plan');
  return immutable({
    id,
    name: displayText(value.name, 100),
    purpose: displayText(value.purpose, 1000),
    profileId: identifier(value.profileId, 'profileId')
  });
} function task(value) {
  exactObject(value, ['id', 'title', 'roleId', 'profileId', 'dependsOn', 'writeSet', 'instruction']);
  const writeSet = exactResources(value.writeSet);
  if (!writeSet.length) reject('invalid_plan');
  const dependsOn = array(value.dependsOn, WB_LIMITS.tasks).map((id) => identifier(id));
  if (new Set(dependsOn).size !== dependsOn.length) reject('invalid_plan');
  return immutable({
    id: identifier(value.id),
    title: displayText(value.title, 200),
    roleId: identifier(value.roleId, 'roleId'),
    profileId: identifier(value.profileId, 'profileId'),
    dependsOn: dependsOn.sort(),
    writeSet,
    instruction: conversationText(value.instruction, 16384)
  });
} export function planCandidate(value) {
  try {
    exactObject(value, ['goal', 'roles', 'tasks']);
    const roles = array(value.roles, WB_LIMITS.roles).map(role);
    const tasks = array(value.tasks, WB_LIMITS.tasks).map(task);
    if (!roles.length || !tasks.length || new Set(roles.map((item) => item.id)).size !== roles.length || new Set(tasks.map((item) => item.id)).size !== tasks.length) reject('invalid_plan');
    const byRole = new Map(roles.map((item) => [item.id, item]));
    const ids = new Set(tasks.map((item) => item.id));
    for (const item of tasks) if (!byRole.has(item.roleId) || byRole.get(item.roleId).profileId !== item.profileId || item.dependsOn.some((id) => !ids.has(id) || id === item.id)) reject('invalid_plan');
    topologicalTasks(tasks);
    return immutable({
      goal: displayText(value.goal, 1000),
      roles: roles.sort((a, b) => a.id.localeCompare(b.id, 'en')),
      tasks: tasks.sort((a, b) => a.id.localeCompare(b.id, 'en'))
    });
  } catch {
    reject('invalid_plan');
  }
} export function topologicalTasks(tasks) {
  const done = new Set();
  const ordered = [];
  const remaining = [...tasks];
  while (remaining.length) {
    const ready = remaining.filter((item) => item.dependsOn.every((id) => done.has(id))).sort((a, b) => a.id.localeCompare(b.id, 'en'));
    if (!ready.length) reject('invalid_plan');
    for (const item of ready) {
      ordered.push(item);
      done.add(item.id);
      remaining.splice(remaining.indexOf(item), 1);
    }
  } return Object.freeze(ordered);
} export function extractPlan(text) {
  const matches = [...text.matchAll(/```legion-plan\s*\n([\s\S]*?)\n```/gu)];
  if (!matches.length) return null;
  if (matches.length !== 1) reject('invalid_plan');
  try {
    return planCandidate(JSON.parse(matches[0][1]));
  } catch {
    reject('invalid_plan');
  }
} export function boundPlan(candidate, binding) {
  const checked = planCandidate(candidate);
  exactObject(binding, ['projectId', 'organizationVersion', 'revision', 'profileBindings', 'contextSnapshotDigest']);
  if (!Number.isSafeInteger(binding.revision) || binding.revision < 1) reject();
  const profileBindings = array(binding.profileBindings, WB_LIMITS.roles + 1).map((item) => {
    exactObject(item, ['profileId', 'profileVersion', 'contextSnapshotDigest']); return {
      profileId: identifier(item.profileId),
      profileVersion: sha(item.profileVersion),
      contextSnapshotDigest: sha(item.contextSnapshotDigest)
    };
  }).sort((a, b) => a.profileId.localeCompare(b.profileId, 'en'));
  const ids = new Set(profileBindings.map((item) => item.profileId));
  if (ids.size !== profileBindings.length || checked.roles.some((item) => !ids.has(item.profileId))) reject('invalid_plan');
  const fields = {
    ...checked,
    projectId: projectIdentifier(binding.projectId),
    organizationVersion: identifier(binding.organizationVersion),
    revision: binding.revision,
    profileBindings,
    contextSnapshotDigest: sha(binding.contextSnapshotDigest)
  };
  return immutable({
    ...fields,
    planDigest: digestValue(fields),
    status: 'draft'
  });
} export function planDocument(value) {
  exactObject(value, ['goal', 'roles', 'tasks', 'projectId', 'organizationVersion', 'revision', 'profileBindings', 'contextSnapshotDigest', 'planDigest', 'status']);
  const result = boundPlan({
    goal: value.goal,
    roles: value.roles,
    tasks: value.tasks
  }, {
    projectId: value.projectId,
    organizationVersion: value.organizationVersion,
    revision: value.revision,
    profileBindings: value.profileBindings,
    contextSnapshotDigest: value.contextSnapshotDigest
  });
  if (value.planDigest !== result.planDigest || !['draft', 'confirmed', 'running', 'completed', 'failed', 'cancelled', 'invalidated'].includes(value.status)) reject('invalid_plan');
  return immutable({
    ...result,
    status: value.status
  });
} export function taskState(value) {
  exactObject(value, ['id', 'title', 'roleId', 'dependsOn', 'writeSet', 'status', 'runId', 'results', 'error', 'updatedAt', 'checkStatus']);
  if (!WB_TASK_STATES.includes(value.status) || value.checkStatus !== 'not_executed') reject();
  let runId = null;
  if (value.runId) runId = identifier(value.runId);
  const results = array(value.results ?? [], 256).map((item) => {
    exactObject(item, ['resource', 'status', 'success', 'observedMutation', 'auditFailed', 'reason']); if (!['written', 'denied', 'failed', 'audit_failed'].includes(item.status) || [item.success, item.observedMutation, item.auditFailed].some((flag) => typeof flag !== 'boolean')) reject(); let resource = ''; if (item.resource) resource = normalizeResource(item.resource); return {
      resource,
      status: item.status,
      success: item.success,
      observedMutation: item.observedMutation,
      auditFailed: item.auditFailed,
      reason: displayText(item.reason ?? '', 300)
    };
  });
  let error = null;
  if (value.error) error = wbError(value.error.code);
  return immutable({
    id: identifier(value.id),
    title: displayText(value.title, 200),
    roleId: identifier(value.roleId),
    dependsOn: array(value.dependsOn, WB_LIMITS.tasks).map((id) => identifier(id)),
    writeSet: exactResources(value.writeSet),
    status: value.status,
    runId,
    results,
    error,
    updatedAt: timestamp(value.updatedAt),
    checkStatus: 'not_executed'
  });
} export function projectDocument(value) {
  exactObject(value, ['schemaVersion', 'id', 'name', 'workspaceIdentity', 'organizationVersion', 'manager', 'planRevision', 'plan', 'context', 'tasks']);
  if (value.schemaVersion !== 1 || !Number.isSafeInteger(value.planRevision) || value.planRevision < 0) reject();
  const id = projectIdentifier(value.id);
  const root = workspaceIdentity(value.workspaceIdentity);
  if (identityKey(root) !== id) reject();
  let manager = null;
  if (value.manager) {
    exactObject(value.manager, ['instanceId', 'sessionId', 'profileId', 'profileVersion']);
    manager = {
      instanceId: identifier(value.manager.instanceId),
      sessionId: identifier(value.manager.sessionId),
      profileId: identifier(value.manager.profileId),
      profileVersion: sha(value.manager.profileVersion)
    };
  } let plan = null;
  if (value.plan) {
    plan = planDocument(value.plan);
    if (plan.projectId !== id || plan.organizationVersion !== value.organizationVersion || plan.revision !== value.planRevision) reject();
  } return immutable({
    schemaVersion: 1,
    id,
    name: displayText(value.name, 100),
    workspaceIdentity: root,
    organizationVersion: identifier(value.organizationVersion),
    manager,
    planRevision: value.planRevision,
    plan,
    context: contextDescriptor(value.context),
    tasks: array(value.tasks, WB_LIMITS.tasks).map(taskState)
  });
} export function projectSummary(value) {
  const checked = projectDocument(value);
  return immutable({
    id: checked.id,
    name: checked.name,
    organizationVersion: checked.organizationVersion,
    hasManager: checked.manager !== null
  });
} export function catalogDocument(value) {
  exactObject(value, ['schemaVersion', 'defaultProfileId', 'projects']);
  if (value.schemaVersion !== 1) reject();
  let defaultProfileId = null;
  if (value.defaultProfileId) defaultProfileId = identifier(value.defaultProfileId);
  const projects = array(value.projects, WB_LIMITS.projects).map(projectDocument);
  if (new Set(projects.map((item) => item.id)).size !== projects.length) reject();
  return immutable({
    schemaVersion: 1,
    defaultProfileId,
    projects
  });
} export function historyDocument(value) {
  exactObject(value, ['schemaVersion', 'projectId', 'roleId', 'history']);
  if (value.schemaVersion !== 1 || value.roleId !== 'ProjectManager') reject('history_corrupt');
  return immutable({
    schemaVersion: 1,
    projectId: projectIdentifier(value.projectId),
    roleId: 'ProjectManager',
    history: new PiConversationHistory(value.history)
  });
} export function profileVersion(stored) {
  return digestValue({
    id: stored.id,
    name: stored.name,
    protocol: stored.protocol,
    provider: stored.provider,
    modelId: stored.modelId,
    baseUrl: stored.baseUrl,
    keyCiphertext: stored.keyCiphertext
  });
} export function observationDTO(value = {
}) {
  const base = value.workspace ?? emptyWorkspace();
  if (!['available', 'empty', 'unavailable'].includes(base.status)) reject();
  const sources = array(base.sources ?? [], 450).map((source) => ({
    ...sourceDTO(source),
    error: source.error && wbError(source.error.code) || null,
    observedAt: timestamp(source.observedAt ?? source.readAt),
    verifiedAt: timestamp(source.verifiedAt ?? source.readAt),
    cached: source.cached === true
  }));
  let project = null;
  let organization = null;
  if (base.project) project = {
    id: projectIdentifier(base.project.id),
    name: displayText(base.project.name, 100)
  };
  if (base.organization) {
    if (!['ACCEPTED', 'CANDIDATE', 'unavailable'].includes(base.organization.status)) reject();
    organization = {
      id: identifier(base.organization.id),
      version: displayText(base.organization.version, 100),
      status: base.organization.status
    };
  } return immutable({
    status: base.status,
    project,
    organization,
    roles: array(base.roles ?? [], 100).map(roleDTO),
    tasks: array(base.tasks ?? [], 300).map(taskDTO),
    audits: array(base.audits ?? [], 4096).map(auditDTO),
    sources,
    errors: array(base.errors ?? [], 100).map((error) => wbError(error.code)),
    observedAt: timestamp(base.observedAt),
    lastValidAt: timestamp(base.lastValidAt)
  });
} export function workbenchDTO(value) {
  const fields = profilesDTO(value);
  const projects = array(value.projects ?? [], WB_LIMITS.projects).map((item) => {
    exactObject(item, ['id', 'name', 'organizationVersion', 'hasManager']); return {
      id: projectIdentifier(item.id),
      name: displayText(item.name, 100),
      organizationVersion: identifier(item.organizationVersion),
      hasManager: item.hasManager === true
    };
  });
  let currentProject = null;
  let plan = null;
  let context = contextDescriptor({
    files: [],
    verifiedAt: null
  });
  let tasks = [];
  let roles = [];
  if (value.project) {
    const project = projectDocument(value.project);
    currentProject = projectSummary(project);
    plan = project.plan;
    context = project.context;
    tasks = project.tasks;
    if (project.manager) roles.push({
      id: 'ProjectManager',
      name: '项目管理',
      purpose: '与Human讨论需求、确认计划和汇报结果',
      profileId: project.manager.profileId
    });
    if (plan) roles.push(...plan.roles);
  } let turn = null;
  if (value.turn) {
    exactObject(value.turn, ['id', 'projectId', 'status', 'text', 'error']);
    if (!['running', 'completed', 'failed', 'cancelled'].includes(value.turn.status)) reject();
    turn = {
      id: identifier(value.turn.id),
      projectId: projectIdentifier(value.turn.projectId),
      status: value.turn.status,
      text: conversationText(value.turn.text),
      error: null
    };
    if (value.turn.error) turn.error = wbError(value.turn.error.code);
  } const history = new PiConversationHistory(value.history ?? {
    messages: []
  });
  let error = null;
  if (value.error) error = wbError(value.error.code);
  let defaultProfileId = null;
  if (value.defaultProfileId) defaultProfileId = identifier(value.defaultProfileId);
  return immutable({
    ...fields,
    defaultProfileId,
    projects,
    currentProject,
    roles,
    history,
    turn,
    plan,
    tasks,
    context,
    observation: observationDTO({
      workspace: value.observation
    }),
    probe: probeDTO(value.probe ?? {
      status: 'idle'
    }),
    error
  });
}
