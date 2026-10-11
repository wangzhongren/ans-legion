import { lstat, realpath, open, readdir } from 'node:fs/promises';
import { resolve, join, dirname, isAbsolute, relative, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { workspaceOptions } from '../abstract/workspace.mjs';
import { LIMITS, TASK_STATES, identifier, timestamp, sourceDTO, success, immutable } from '../../models/desktop.mjs';
import { WB_LIMITS } from '../../models/workbench.mjs';

class ReadFailure extends Error { constructor(code) { super(code); this.code = code; } }
function corrupt() { throw new ReadFailure('workspace_corrupt'); }
function record(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) corrupt(); return value; }
function keys(value, allowed, required = []) {
  record(value);
  if (Object.keys(value).some((key) => !allowed.includes(key)) || required.some((key) => !Object.hasOwn(value, key))) corrupt();
  return value;
}
function scalarString(value, max = 1000) { if (typeof value !== 'string' || !value || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) corrupt(); return value; }
function array(value, max) { if (!Array.isArray(value) || value.length > max) corrupt(); return value; }
function recordError(errors, sources, error) {
  let code = 'workspace_corrupt';
  if (error instanceof ReadFailure) code = error.code;
  else if (['ENOENT', 'ENOTDIR', 'EPERM', 'EACCES', 'EIO'].includes(error.code)) code = 'workspace_unavailable';
  errors.push({ code });
  const last = sources.at(-1);
  if (last && last.status === 'available') sources[sources.length - 1] = { ...last, status: 'unavailable', error: { code } };
}

function splitFlow(text, delimiter) {
  const pieces = [];
  let quote = '';
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (quote === '"' && char === '\\') { index += 1; continue; }
      if (char === quote) {
        if (quote === "'" && text[index + 1] === "'") { index += 1; continue; }
        quote = '';
      }
    } else if (char === "'" || char === '"') quote = char;
    else if (char === '[' || char === '{') depth += 1;
    else if (char === ']' || char === '}') { depth -= 1; if (depth < 0) corrupt(); }
    else if (char === delimiter && depth === 0) { pieces.push(text.slice(start, index).trim()); start = index + 1; }
  }
  if (quote || depth !== 0) corrupt();
  pieces.push(text.slice(start).trim());
  return pieces;
}

function yamlValue(text, depth = 0) {
  if (depth > 3 || text.length > 40000) corrupt();
  if (text.startsWith('[') && text.endsWith(']')) {
    const inner = text.slice(1, -1).trim();
    if (!inner) return [];
    return array(splitFlow(inner, ',').map((part) => yamlValue(part, depth + 1)), 400);
  }
  if (text.startsWith('{') && text.endsWith('}')) {
    const result = {};
    for (const part of splitFlow(text.slice(1, -1), ',')) {
      const pair = splitFlow(part, ':');
      if (pair.length !== 2 || !/^[a-zA-Z_][a-zA-Z0-9_]*$/u.test(pair[0]) || Object.hasOwn(result, pair[0])) corrupt();
      result[pair[0]] = yamlValue(pair[1], depth + 1);
    }
    return result;
  }
  if (text.startsWith('"')) {
    try { const value = JSON.parse(text); return scalarString(value, 32768); } catch { corrupt(); }
  }
  if (text.startsWith("'")) {
    if (!/^'(?:[^']|'')*'$/u.test(text)) corrupt();
    return scalarString(text.slice(1, -1).replaceAll("''", "'"), 32768);
  }
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null') return null;
  if (/^(?:0|[1-9]\d*)$/u.test(text)) { const value = Number(text); if (!Number.isSafeInteger(value)) corrupt(); return value; }
  if (!text || /[\[\]{}#&*!|>"'`\t]/u.test(text) || text.includes(': ')) corrupt();
  return scalarString(text, 32768);
}

function yaml(text) {
  const result = {};
  let sequence = null;
  for (const raw of text.replace(/\r\n/gu, '\n').split('\n')) {
    if (!raw.trim() || raw.startsWith('#')) continue;
    if (raw.startsWith('  - ')) {
      if (!sequence) corrupt();
      result[sequence].push(yamlValue(raw.slice(4)));
      if (result[sequence].length > LIMITS.roles) corrupt();
      continue;
    }
    const match = /^([a-zA-Z_][a-zA-Z0-9_]*):(?: (.*))?$/u.exec(raw);
    if (!match || Object.hasOwn(result, match[1])) corrupt();
    sequence = null;
    if (match[2] === undefined || match[2] === '') { result[match[1]] = []; sequence = match[1]; }
    else result[match[1]] = yamlValue(match[2]);
  }
  return result;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  if (typeof value === 'number' && !Number.isSafeInteger(value)) corrupt();
  return JSON.stringify(value);
}
function digest(value) { return createHash('sha256').update(value, 'utf8').digest('hex'); }
function display(value) { return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ').replaceAll('\r', ' ').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
function renderTask(bundle, events) {
  const { plan, state } = bundle;
  const rows = [`# 任务：${display(plan.taskId)}`, '', '任务记录由 `task_ops` 生成。修改需求、设计或权限后，使用对应命令更新；不要手工改状态。', '', `需求：\`${display(plan.requirement.path)}\`（${display(plan.requirement.version)}）`, `设计：\`${display(plan.design.path)}\`（${display(plan.design.version)}）`, `状态版本：${state.stateRevision} · 最新事件：${state.lastEventSeq}`, '', '## 步骤', '', '| 步骤 | 负责角色 | 当前状态 | 前置步骤 | 最近反馈 |', '| --- | --- | --- | --- | --- |'];
  for (let index = 0; index < plan.nodes.length; index += 1) {
    const planned = plan.nodes[index];
    const current = state.nodes[index];
    let dependencies = (planned.dependsOn ?? []).join(', ');
    if (!dependencies) dependencies = '无';
    rows.push(`| ${[planned.nodeId, planned.roleId, current.status, dependencies, current.latestReport?.summary ?? ''].map(display).join(' | ')} |`);
  }
  rows.push('', '## 变化记录', '', '| 序号 | 时间 | 变化 | 说明 |', '| --- | --- | --- | --- |');
  for (const event of events) rows.push(`| ${[event.seq, event.receivedAt, event.kind, event.summary].map(display).join(' | ')} |`);
  rows.push('', '机器记录保存在下面的固定区块，供程序核对事件顺序和版本。', '');
  return `${rows.join('\n')}\n<!-- ANS-TASK-EVENTS-V1\n${events.map((event) => canonical(event).replaceAll('-->', '--\\u003e')).join('\n')}\nANS-TASK-EVENTS-END -->\n`;
}

function taskRecord(text, expectedId) {
  const raw = text.replace(/\r\n/gu, '\n');
  const marker = '\n<!-- ANS-TASK-EVENTS-V1\n';
  const end = '\nANS-TASK-EVENTS-END -->\n';
  if (raw.split(marker).length !== 2 || !raw.endsWith(end)) corrupt();
  const lines = raw.split(marker)[1].slice(0, -end.length).split('\n');
  if (!lines.length || lines.length > WB_LIMITS.taskEvents) throw new ReadFailure('record_budget');
  let previousHash = null;
  const events = lines.map((line, index) => {
    const event = record(JSON.parse(line));
    const { hash, ...data } = event;
    if (event.seq !== index + 1 || event.taskId !== expectedId || event.previousHash !== previousHash || hash !== digest(canonical(data))) corrupt();
    timestamp(event.receivedAt);
    previousHash = hash;
    return event;
  });
  const bundle = record(events.at(-1).after);
  const plan = record(bundle.plan);
  const state = record(bundle.state);
  if (plan.schemaVersion !== 1 || state.schemaVersion !== 1 || plan.taskId !== expectedId || state.taskId !== expectedId || state.lastEventSeq !== events.length || !Number.isSafeInteger(state.stateRevision) || state.stateRevision < 1) corrupt();
  array(plan.nodes, LIMITS.tasks); array(state.nodes, LIMITS.tasks);
  if (plan.nodes.length !== state.nodes.length || raw !== renderTask(bundle, events)) corrupt();
  const ids = new Set();
  for (let index = 0; index < plan.nodes.length; index += 1) {
    const planned = plan.nodes[index];
    const current = state.nodes[index];
    identifier(planned.nodeId); identifier(planned.roleId, 'roleId');
    if (ids.has(planned.nodeId) || current.nodeId !== planned.nodeId || current.roleId !== planned.roleId) corrupt();
    if (!TASK_STATES.includes(current.status)) corrupt();
    ids.add(planned.nodeId);
  }
  timestamp(state.updatedAt);
  // Only finite status inputs leave Provider; token hashes/reports/argv never do.
  return state.nodes.map((node) => ({ taskId: expectedId, nodeId: node.nodeId, roleId: node.roleId, status: node.status, hasReason: Boolean(node.reason), updatedAt: state.updatedAt }));
}

function jsonLines(text) {
  if (text === '') return [];
  if (!text.endsWith('\n')) corrupt();
  const lines = text.replace(/\r\n/gu, '\n').slice(0, -1).split('\n');
  if (lines.length > WB_LIMITS.taskEvents) throw new ReadFailure('record_budget');
  return lines.map((line) => record(JSON.parse(line)));
}

const PROJECT_KEYS = ['schema_version', 'project_id', 'name', 'status', 'timezone', 'organization_version', 'project_manager', 'scheduler', 'execution_scope_config', 'implementation_design', 'authorization_source'];
const ORGANIZATION_KEYS = ['schema_version', 'status', 'version', 'approval_source', 'roles', 'delegations', 'handoff_topology', 'canonical_design', 'design_sha256', 'policy_sha256', 'path_base'];
const ROLE_KEYS = ['schema_version', 'id', 'name', 'responsibility', 'status', 'read_scope', 'write_scope', 'authority_source', 'deny_scope', 'tools', 'capabilities', 'allowed_actions', 'forbidden_actions', 'delegation_scope', 'handoff_targets', 'required_approvals', 'reporting_line', 'memory_scope', 'contracts'];
const SHELL_BOUNDARY_KEYS = ['project_shell_candidate_version', 'project_shell_candidate_status', 'project_shell_candidate_write_scope', 'project_shell_candidate_generated_effect_scope'];
const BOUNDARY_KEYS = ['schema_version', 'role_id', 'status', 'version', 'read_scope', 'write_scope', 'generated_effect_scope', 'deny_scope', 'approval_source', ...SHELL_BOUNDARY_KEYS];
// Organization membership and role boundary revisions have separate lifetimes.
// These semantic pins identify the six boundaries approved by the customer in
// config ddc9cfd1…; YAML formatting may vary, but scopes and Section 1 may not.
const WORKFLOW_APPROVAL = 'direct_customer_config_sha256_ddc9cfd12dc62d413a6353c4150e488c3451bb6ac8f2f37550441e993a8ec4fa';
const WORKFLOW_BOUNDARIES = Object.freeze({
  ProjectManager: ['b9e193d650dbe0d821ca7219194b412cc88a649f3835047bc18b412f6bc5f134', '0ba36eabe333a6cfc2c38cf9ce0d64d2533b1c00466003b8c71ac89c35d21e58'],
  KernelEngineer: ['f852c4683fbe89819672ab6a58a9bcbf569310dea6343050dc11543a57903469', 'd6386a0f03cb1f723f07ccf20af3ce4600f1beffa29ec7685a5e0535f2e17e7e'],
  AgentAdapterEngineer: ['000dc984d64b30d7bb2822eab150640984b2781605f801439f6a813fc0b0bf32', '1d47d5399f0a3492e224deed2efa79e31f5a3bc72d7403973776028e337dc08c'],
  DesktopEngineer: ['54044be14b9cc8dd936527ff726d1bfcf8933a8d2b670f175c00009d3fa21f8d', '63cb1b336e3e663120a76e17da6d726e22567d8630a9cb767915290f4467eda7'],
  Reviewer: ['04c522b9ffde5a00c89695f5c365842f5fd3dc2ea5c1309301ab18cc394d8f60', '4e4e47860e4ff03acf72dcea6bdbfec7e541fc20a1bf2057d2dd38d645eb0c23'],
  Tester: ['737142e0a2c6810401763505094cabc0ad87f4be2aa8ecf84069e5ba3e755829', '13259a96b299c6575eb424ae0ecb5a49dc0f2387497d650fa42caee4a9f33df0'],
});
// Read-only identities of the six frozen tuples accepted by Human under main
// config c872245f285125eae264b77ef4447a97fe0dcb14506c0e77f216d41003865ea4.
// Base ddc9 ACCEPTED/candidate-awaiting labels are historical, not activation.
// No execution scope is assembled here; Supervisor retains its separate v2 identity.
const SHELL_WORKFLOW_BOUNDARIES = Object.freeze({
  ProjectManager: ['37532c0621ab47868cf022268f98d585a88d1a656f9382ce3c810591895e68b1', '1578e0c21bf5b4fd01a163a44759c4b2bcefb6457395e1056434327480aacee4'],
  KernelEngineer: ['4e726abe06d6e2a002b0c180734cd0c5168041e2d44b57f4d294312c95113153', '1d924427f149a1c37b42b72e86a32a6c91f22306bc60d2860b65acfa3c5c39b4'],
  AgentAdapterEngineer: ['0c5d4502cc2ccf8d5aae379f407adf6985abd804a32d91a5914860c1c6e6f8ce', 'ab9a6512c7c34609509d08f448e640622334bdcc4cfe1c4b1e369ef8455a0efe'],
  DesktopEngineer: ['dc1abbc5d2397cc2622afad74720f4d80496ae25def3d2a035b8e4646fa304c4', 'd26c08a2905a7f86e67f289e320a50e7a3336f1f03adbc83baae62b31cdcdb1d'],
  Reviewer: ['6c5a7262633da62a85c82a54b971ec465b1f3ad6b516c6fb8bfc29bebd0be498', '3417e9cea6bc3175719b707f7883a7ee3c7848c9bae3e7945ea42613e80a1974'],
  Tester: ['e32d6e5710d909108589fddedac4ee93c8ced67532535dda7b9ee9749e7f39d9', '8b0d44e2b1179fc6cbc8ff3b9517ad48073a39123c2a76dc3e63d336c416af78'],
});

export class WorkspaceProviderImpl {
  #root;
  #cache = new Map(); #bytes = 0; #force = false; #seen = new Set();
  constructor(options) {
    const checked = workspaceOptions(options);
    if (!isAbsolute(checked.workspaceRoot)) throw new ReadFailure('unsafe_path');
    this.#root = resolve(checked.workspaceRoot);
  }

  async #guardRoot() {
    let current = this.#root;
    for (;;) {
      const metadata = await lstat(current);
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) throw new ReadFailure('unsafe_path');
      const parent = dirname(current);
      if (parent === current) break;
      current = parent;
    }
    const actual = await realpath(this.#root);
    if (actual.toLowerCase() !== this.#root.toLowerCase()) throw new ReadFailure('unsafe_path');
  }

  async #target(path) {
    if (typeof path !== 'string' || !path || path.length > 300 || path.includes('\\') || path.includes(':') || path.startsWith('/') || path.split('/').some((part) => !part || part === '.' || part === '..')) throw new ReadFailure('unsafe_path');
    let current = this.#root;
    for (const part of path.split('/')) {
      current = join(current, part);
      try { if ((await lstat(current)).isSymbolicLink()) throw new ReadFailure('unsafe_path'); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    const remainder = relative(this.#root, current);
    if (isAbsolute(remainder) || remainder === '..' || remainder.startsWith('../') || remainder.startsWith('..\\')) throw new ReadFailure('unsafe_path');
    return current;
  }

  async #read(path, kind, sources) {
    const readAt = new Date().toISOString();
    let handle;
    let result;
    try {
      const target = await this.#target(path);
      if (kind === 'task') this.#seen.add(path);
      const pathInfo = await lstat(target, { bigint: true });
      let maximum = LIMITS.fileBytes; if (kind === 'task') maximum = WB_LIMITS.taskDocumentBytes;
      if (!pathInfo.isFile() || pathInfo.isSymbolicLink()) corrupt();
      if (pathInfo.size > BigInt(maximum)) { if (kind === 'task') throw new ReadFailure('record_budget'); corrupt(); }
      this.#bytes += Number(pathInfo.size); if (this.#bytes > WB_LIMITS.refreshBytes) throw new ReadFailure('record_budget');
      const stamp = `${pathInfo.dev}:${pathInfo.ino}:${pathInfo.size}:${pathInfo.mtimeNs}:${pathInfo.ctimeNs}`;
      const cached = this.#cache.get(path);
      if (kind === 'task' && !this.#force && cached?.valid && cached.stamp === stamp) {
        sources.push({ ...sourceDTO({ kind, relativePath: path, status: 'available', modifiedAt: new Date(Number(pathInfo.mtimeMs)).toISOString(), readAt }), observedAt: readAt, verifiedAt: cached.verifiedAt, cached: true });
        return { status: 'available', text: cached.text, modifiedAt: new Date(Number(pathInfo.mtimeMs)).toISOString(), readAt, records: cached.records };
      }
      handle = await open(target, 'r');
      const info = await handle.stat({ bigint: true });
      if (!info.isFile() || info.dev !== pathInfo.dev || info.ino !== pathInfo.ino || info.size !== pathInfo.size) corrupt();
      const buffer = Buffer.alloc(maximum + 1);
      let size = 0;
      for (;;) {
        const read = await handle.read(buffer, size, buffer.length - size, size);
        size += read.bytesRead;
        if (size > maximum) throw new ReadFailure('record_budget');
        if (read.bytesRead === 0) break;
      }
      const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, size));
      const after = await handle.stat({ bigint: true }); const final = await lstat(target, { bigint: true });
      if (after.size !== info.size || after.mtimeNs !== info.mtimeNs || final.dev !== info.dev || final.ino !== info.ino || final.isSymbolicLink()) corrupt();
      result = { status: 'available', text, modifiedAt: new Date(Number(info.mtimeMs)).toISOString(), readAt };
      if (kind === 'task') this.#cache.set(path, { stamp, text, verifiedAt: readAt, valid: false });
    } catch (error) {
      let code = 'workspace_unavailable';
      if (error instanceof ReadFailure) code = error.code;
      let status = 'unavailable';
      if (error.code === 'ENOENT') { status = 'missing'; code = null; }
      result = { status, text: null, modifiedAt: null, readAt, code };
    } finally {
      if (handle) {
        try { await handle.close(); }
        catch { result = { status: 'unavailable', text: null, modifiedAt: null, readAt, code: 'workspace_unavailable' }; }
      }
    }
    let error = null;
    if (result.code) error = { code: result.code };
    sources.push({ ...sourceDTO({ kind, relativePath: path, status: result.status, modifiedAt: result.modifiedAt, readAt, error }), error, observedAt: readAt, verifiedAt: readAt, cached: false });
    return result;
  }

  async #required(path, kind, sources) {
    const result = await this.#read(path, kind, sources);
    if (result.status !== 'available') throw new ReadFailure(result.code ?? 'workspace_unavailable');
    return result.text;
  }

  async #audit(sources) {
    const path = '.ans/events/index.jsonl';
    const index = await this.#read(path, 'audit', sources);
    if (index.status === 'missing') return [];
    if (index.status !== 'available') throw new ReadFailure(index.code);
    const entries = jsonLines(index.text);
    if (!entries.length) return [];
    const governance = Object.hasOwn(entries[0], 'event_id');
    const runtime = Object.hasOwn(entries[0], 'kind');
    if (governance === runtime) corrupt();
    const daily = new Map();
    const records = [];
    for (let indexNumber = 0; indexNumber < entries.length; indexNumber += 1) {
      const entry = entries[indexNumber];
      if (entry.sequence !== indexNumber + 1) corrupt();
      if (governance) {
        keys(entry, ['event_id', 'line', 'file', 'sequence'], ['event_id', 'line', 'file', 'sequence']);
        if (typeof entry.file !== 'string' || !/^\d{4}-\d{2}-\d{2}\.jsonl$/u.test(entry.file) || !Number.isSafeInteger(entry.line) || entry.line < 1 || entry.line > WB_LIMITS.taskEvents) throw new ReadFailure('unsafe_path');
        if (!daily.has(entry.file)) daily.set(entry.file, jsonLines(await this.#required(`.ans/events/${entry.file}`, 'audit', sources)));
        const event = daily.get(entry.file)[entry.line - 1];
        if (!event || event.event_id !== entry.event_id || event.sequence !== entry.sequence) corrupt();
        keys(event, ['role_id', 'result', 'actor_id', 'sequence', 'kind', 'organization_version', 'occurred_at', 'description', 'correlation_id', 'project_id', 'event_id', 'approval_source', 'policy_sha256'], ['event_id', 'sequence', 'kind', 'organization_version', 'occurred_at', 'result']);
        if (event.kind !== 'OrganizationChange' || !['ACCEPTED_AND_RECORDED', 'REJECTED'].includes(event.result)) corrupt();
        identifier(event.event_id); scalarString(event.organization_version, 100); timestamp(event.occurred_at);
        records.push({ id: event.event_id, format: 'governance', organizationVersion: event.organization_version, eventType: event.kind, roleId: null, taskId: null, updatedAt: event.occurred_at, result: event.result });
      } else {
        keys(entry, ['sequence', 'kind', 'roleId', 'taskId', 'organizationVersion', 'resource', 'proposalDigest', 'correlationId', 'outcome', 'reason', 'observedMutation', 'recordedAt'], ['sequence', 'kind', 'organizationVersion', 'recordedAt']);
        if (typeof entry.observedMutation !== 'boolean') corrupt();
        const time = timestamp(entry.recordedAt);
        if (!time) corrupt();
        const file = `${time.slice(0, 10)}.jsonl`;
        if (!daily.has(file)) daily.set(file, jsonLines(await this.#required(`.ans/events/${file}`, 'audit', sources)));
        const mirror = daily.get(file).find((event) => event.sequence === entry.sequence);
        if (!mirror || canonical(mirror) !== canonical(entry)) corrupt();
        records.push({ id: `runtime-${entry.sequence}`, format: 'runtime', organizationVersion: scalarString(entry.organizationVersion, 100), eventType: scalarString(entry.kind, 100), roleId: entry.roleId || null, taskId: entry.taskId || null, updatedAt: time, result: null });
      }
    }
    for (const [file, values] of daily) {
      const sequences = new Set(values.map((event) => event.sequence));
      let count = 0;
      for (const entry of entries) {
        if (governance && entry.file === file) count += 1;
        if (runtime && `${entry.recordedAt.slice(0, 10)}.jsonl` === file) count += 1;
      }
      if (count !== values.length || sequences.size !== values.length) corrupt();
      for (const event of values) {
        if (!entries.some((entry) => entry.sequence === event.sequence)) corrupt();
      }
    }
    return records;
  }

  async read(options = {}) {
    if (!options || Object.getPrototypeOf(options) !== Object.prototype || Object.keys(options).some((key) => key !== 'force') || (options.force !== undefined && typeof options.force !== 'boolean')) return { ok: false, error: { code: 'invalid_input' } };
    this.#bytes = 0; this.#force = options.force === true; this.#seen.clear();
    const sources = [];
    const errors = [];
    const observedAt = new Date().toISOString();
    let project = null;
    let organization = null;
    const roles = [];
    const tasks = [];
    let audits = [];
    try {
      await this.#guardRoot();
      const projectData = keys(yaml(await this.#required('.ans/project.yaml', 'organization', sources)), PROJECT_KEYS, ['schema_version', 'project_id', 'name', 'organization_version']);
      const org = keys(yaml(await this.#required('.ans/organization/current.yaml', 'organization', sources)), ORGANIZATION_KEYS, ['schema_version', 'version', 'status', 'roles']);
      if (projectData.schema_version !== 1 || org.schema_version !== 1 || org.status !== 'ACCEPTED' || !['v003', 'v004'].includes(org.version) || projectData.organization_version !== org.version) corrupt();
      const projectName = scalarString(projectData.name, 100);
      const projectIdentity = identifier(projectData.project_id);
      project = { id: digest(this.#root.toLowerCase()), name: projectName };
      organization = { id: `org-${projectIdentity}`, version: scalarString(org.version, 100), status: org.status };
      const entries = array(org.roles, LIMITS.roles);
      const ids = new Set();
      for (const entry of entries) {
        keys(entry, ['id', 'status', 'reporting_line', 'role', 'boundary'], ['id', 'status', 'reporting_line', 'role', 'boundary']);
        const id = identifier(entry.id, 'roleId');
        if (ids.has(id) || entry.status !== 'ACCEPTED' || entry.role !== `../roles/${id}/role.yaml` || entry.boundary !== `../roles/${id}/boundary.yaml`) corrupt();
        ids.add(id);
      }
      for (const entry of entries) {
        const id = entry.id;
        if (entry.reporting_line !== 'Human' && !ids.has(entry.reporting_line)) corrupt();
        const role = keys(yaml(await this.#required(`.ans/roles/${id}/role.yaml`, 'role', sources)), ROLE_KEYS, ['schema_version', 'id', 'name', 'responsibility', 'status', 'reporting_line']);
        if (role.schema_version !== 1 || role.id !== id || role.status !== 'ACCEPTED' || role.reporting_line !== entry.reporting_line) corrupt();
        const card = await this.#required(`.ans/roles/${id}/role-card.md`, 'role', sources);
        if (!card.startsWith(`# ${id}\n`) && !card.startsWith(`# ${id}\r\n`)) corrupt();
        const boundary = keys(yaml(await this.#required(`.ans/roles/${id}/boundary.yaml`, 'boundary', sources)), BOUNDARY_KEYS, ['schema_version', 'role_id', 'status', 'version', 'write_scope']);
        let expectedBoundary = 'legion-desktop-gui-v1'; if (org.version === 'v004') expectedBoundary = 'legion-desktop-workbench-v2';
        if (boundary.schema_version !== 1 || boundary.role_id !== id || boundary.status !== 'ACCEPTED') corrupt();
        const markdown = await this.#required(`.ans/roles/${id}/boundary.md`, 'boundary', sources);
        const section = markdown.split(/^# Section [2-9]/mu)[0];
        if (!section.startsWith('# Section 1:')) corrupt();
        const paths = [];
        for (const row of section.split(/\r?\n/u).filter((line) => line.startsWith('|'))) {
          const match = /^\|[^|]+\|\s*`([^`]+)`\s*\|/u.exec(row);
          if (match) paths.push(scalarString(match[1], 300));
        }
        const scope = array(boundary.write_scope, 400).map((path) => scalarString(path, 300));
        if (scope.some((path) => !paths.includes(path))) corrupt();
        const hasShellMetadata = SHELL_BOUNDARY_KEYS.some((key) => Object.hasOwn(boundary, key));
        if (boundary.version !== expectedBoundary || boundary.approval_source === WORKFLOW_APPROVAL || hasShellMetadata) {
          const pins = hasShellMetadata ? SHELL_WORKFLOW_BOUNDARIES : WORKFLOW_BOUNDARIES;
          const approved = pins[id];
          if (org.version !== 'v004' || boundary.version !== 'legion-governed-workflow-v1' || boundary.approval_source !== WORKFLOW_APPROVAL || !Object.hasOwn(pins, id) || digest(canonical(boundary)) !== approved[0] || digest(canonical(paths)) !== approved[1]) corrupt();
        }
        roles.push({ id, name: scalarString(role.name, 100), reportsTo: entry.reporting_line, description: scalarString(role.responsibility), boundary: paths });
      }
    } catch (error) { recordError(errors, sources, error); }

    if (!errors.length) {
      try {
        const directory = await this.#target('docs/scheduling');
        const metadata = await lstat(directory);
        if (!metadata.isDirectory()) corrupt();
        sources.push(sourceDTO({ kind: 'task', relativePath: 'docs/scheduling', status: 'available', modifiedAt: metadata.mtime.toISOString(), readAt: new Date().toISOString() }));
        const files = await readdir(directory, { withFileTypes: true });
        if (files.length > 100) corrupt();
        for (const file of files) {
          if (!file.name.endsWith('.md')) continue;
          if (!file.isFile() || file.isSymbolicLink() || !/^[A-Za-z0-9_-]+\.md$/u.test(file.name)) throw new ReadFailure('unsafe_path');
          try {
            const path = `docs/scheduling/${file.name}`; const result = await this.#read(path, 'task', sources); if (result.status !== 'available') throw new ReadFailure(result.code ?? 'workspace_unavailable');
            let records = result.records; if (!records) { records = taskRecord(result.text, basename(file.name, '.md')); const cached = this.#cache.get(path); if (cached) { cached.valid = true; cached.records = records; } }
            if (tasks.length + records.length > LIMITS.tasks) corrupt();
            tasks.push(...records);
          } catch (error) { recordError(errors, sources, error); }
        }
      } catch (error) {
        if (error.code === 'ENOENT') sources.push(sourceDTO({ kind: 'task', relativePath: 'docs/scheduling', status: 'missing', readAt: new Date().toISOString() }));
        else recordError(errors, sources, error);
      }
      try { audits = await this.#audit(sources); }
      catch (error) { recordError(errors, sources, error); }
    }
    for (const [path, entry] of this.#cache) if (!this.#seen.has(path) || !entry.valid) this.#cache.delete(path);
    return success(immutable({ project, organization, roles, tasks, audits, sources, errors, observedAt: new Date().toISOString() }));
  }
}
