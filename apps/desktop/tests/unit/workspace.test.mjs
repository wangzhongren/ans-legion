import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, readdir, lstat, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createWorkspaceProvider } from '../../src/providers/public/workspace.mjs';
import { WB_LIMITS } from '../../src/models/workbench.mjs';
import { LIMITS } from '../../src/models/desktop.mjs';
import { createWorkspaceService } from '../../src/services/public/workspace.mjs';
import { WorkspaceServiceImpl } from '../../src/services/impl/workspace.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const testRole = process.env.LEGION_DESKTOP_TEST_ROLE ?? 'DesktopEngineer';
assert.ok(['DesktopEngineer', 'ProjectManager', 'Reviewer', 'Tester'].includes(testRole));
let roleDirectory = testRole;
if (testRole !== 'DesktopEngineer') roleDirectory = `${testRole}/desktop`;
const base = join(root, `.ans/runtime/legion-governed-workflow-v1/${roleDirectory}`);
const fixtureRoot = join(base, 'fixtures');
delete process.env.NODE_OPTIONS;
delete process.env.NODE_COMPILE_CACHE;
process.env.NODE_DISABLE_COMPILE_CACHE = '1';
const tmpRoot = join(base, 'tmp');
await mkdir(tmpRoot, { recursive: true });
process.env.TEMP = tmpRoot;
process.env.TMP = tmpRoot;
await mkdir(fixtureRoot, { recursive: true });
async function put(directory, path, text) { await mkdir(join(directory, path, '..'), { recursive: true }); await writeFile(join(directory, path), text, 'utf8'); }
async function fixture() {
  const directory = await mkdtemp(join(fixtureRoot, 'workspace-'));
  const paths = ['.ans/project.yaml', '.ans/organization/current.yaml', '.ans/events/index.jsonl', '.ans/events/2026-10-07.jsonl'];
  const current = await readFile(join(root, '.ans/organization/current.yaml'), 'utf8');
  const ids = [...current.matchAll(/\{id: ([A-Za-z0-9_.-]+)/gu)].map((match) => match[1]);
  for (const id of ids) for (const file of ['role.yaml', 'role-card.md', 'boundary.yaml', 'boundary.md']) paths.push(`.ans/roles/${id}/${file}`);
  for (const path of paths) await put(directory, path, await readFile(join(root, path), 'utf8'));
  return directory;
}
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function canonicalFixture(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalFixture).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalFixture(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function controlledTaskText(padding = 0) {
  const time = '2026-10-07T07:00:00.000Z';
  let reason = 'private token is never displayed'; if (padding) reason = 'x'.repeat(padding);
  const nodes = [{ nodeId: 'profiles', roleId: 'DesktopEngineer', status: 'verified' }, { nodeId: 'workspace', roleId: 'DesktopEngineer', status: 'running', reason }];
  const data = { after: { plan: { schemaVersion: 1, taskId: 'fixture-task', requirement: { path: 'requirement.md', version: 'R1' }, design: { path: 'design.md', version: 'D1' }, nodes: nodes.map(({ status, reason, ...node }) => node) }, state: { schemaVersion: 1, taskId: 'fixture-task', stateRevision: 1, lastEventSeq: 1, updatedAt: time, nodes } }, eventId: 'fixture-task-1', kind: 'initialized', nodeId: null, previousHash: null, receivedAt: time, seq: 1, summary: 'Controlled task record', taskId: 'fixture-task' };
  const event = { ...data, hash: hash(canonicalFixture(data)) };
  const visible = '# 任务：fixture-task\n\n任务记录由 `task_ops` 生成。修改需求、设计或权限后，使用对应命令更新；不要手工改状态。\n\n需求：`requirement.md`（R1）\n设计：`design.md`（D1）\n状态版本：1 · 最新事件：1\n\n## 步骤\n\n| 步骤 | 负责角色 | 当前状态 | 前置步骤 | 最近反馈 |\n| --- | --- | --- | --- | --- |\n| profiles | DesktopEngineer | verified | 无 |  |\n| workspace | DesktopEngineer | running | 无 |  |\n\n## 变化记录\n\n| 序号 | 时间 | 变化 | 说明 |\n| --- | --- | --- | --- |\n| 1 | 2026-10-07T07:00:00.000Z | initialized | Controlled task record |\n\n机器记录保存在下面的固定区块，供程序核对事件顺序和版本。\n';
  return `${visible}\n<!-- ANS-TASK-EVENTS-V1\n${canonicalFixture(event)}\nANS-TASK-EVENTS-END -->\n`;
}
async function oversizedTaskPaths() {
  const paths = [];
  for (const name of await readdir(join(root, 'docs/scheduling'))) if (name.endsWith('.md') && (await lstat(join(root, 'docs/scheduling', name))).size > WB_LIMITS.taskDocumentBytes) paths.push(`docs/scheduling/${name}`);
  return paths.sort();
}

test('Provider: actual current v004/7 role documents and snake governance references are read-only and finite', async () => {
  const directory = await fixture();
  const provider = createWorkspaceProvider({ workspaceRoot: directory });
  const before = hash(await readFile(join(directory, '.ans/organization/current.yaml')));
  const result = await provider.read();
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.errors, []);
  assert.equal(result.value.organization.id, 'org-legion-runtime');
  assert.equal(result.value.organization.version, 'v004');
  assert.equal(result.value.roles.length, 7);
  assert.equal(result.value.roles.find((role) => role.id === 'DesktopEngineer').reportsTo, 'Supervisor');
  assert.equal(result.value.roles.find((role) => role.id === 'DesktopEngineer').boundary.includes('apps/desktop/src/models/workbench.mjs'), true);
  assert.deepEqual(result.value.audits.map((event) => event.format), Array((await readFile(join(directory, '.ans/events/index.jsonl'), 'utf8')).trim().split('\n').length).fill('governance'));
  assert.equal(result.value.audits[0].updatedAt, '2026-10-07T09:44:22.2685583+08:00');
  assert.equal(result.value.sources.some((source) => source.relativePath === 'docs/scheduling' && source.status === 'missing'), true);
  assert.equal(result.value.sources.every((source) => source.readAt), true);
  assert.equal(result.value.sources.filter((source) => source.status === 'available').every((source) => source.modifiedAt), true);
  assert.equal(hash(await readFile(join(directory, '.ans/organization/current.yaml'))), before);
  assert.equal(JSON.stringify(result).includes('approval_source'), false);
  assert.equal(JSON.stringify(result).includes('description":"Customer'), false);
  assert.throws(() => createWorkspaceProvider({ workspaceRoot: directory, readFile: () => {} }));
});

test('Provider: real root task_ops Markdown hash chain and human rendering are checked without tokens/reports', async () => {
  const provider = createWorkspaceProvider({ workspaceRoot: root });
  const result = await provider.read();
  assert.equal(result.ok, true);
  const oversized = await oversizedTaskPaths();
  assert.deepEqual(result.value.errors.map((error) => error.code), oversized.map(() => 'record_budget'));
  const unavailable = result.value.sources.filter((source) => source.kind === 'task' && source.status === 'unavailable');
  assert.deepEqual(unavailable.map((source) => source.relativePath).sort(), oversized);
  for (const source of unavailable) assert.ok((await lstat(join(root, source.relativePath))).size > WB_LIMITS.taskDocumentBytes);
  if (!oversized.includes('docs/scheduling/legion-desktop-gui-v1.md')) {
    const text = await readFile(join(root, 'docs/scheduling/legion-desktop-gui-v1.md'), 'utf8');
    const eventLines = text.replace(/\r\n/gu, '\n').split('<!-- ANS-TASK-EVENTS-V1\n')[1].split('\nANS-TASK-EVENTS-END')[0].split('\n');
    const state = JSON.parse(eventLines.at(-1)).after.state;
    for (const node of state.nodes) assert.equal(result.value.tasks.find((task) => task.taskId === 'legion-desktop-gui-v1' && task.nodeId === node.nodeId).status, node.status);
  } else assert.equal(result.value.tasks.some((task) => task.taskId === 'legion-desktop-gui-v1'), false);
  const text = JSON.stringify(result);
  for (const forbidden of ['tokenHash', 'coordinatorTokenHash', 'summary', 'argv', 'prompt', 'after', 'raw']) assert.equal(text.includes(`"${forbidden}"`), false);
  const directory = await fixture();
  const taskText = await readFile(join(root, 'docs/scheduling/legion-desktop-gui-v1.md'), 'utf8');
  await put(directory, 'docs/scheduling/legion-desktop-gui-v1.md', taskText.replace('| profiles | DesktopEngineer | verified |', '| profiles | DesktopEngineer | running |'));
  assert.equal((await createWorkspaceProvider({ workspaceRoot: directory }).read()).value.errors[0].code, 'workspace_corrupt');
  await put(directory, 'docs/scheduling/legion-desktop-gui-v1.md', taskText.replace('ANS-TASK-EVENTS-END', 'BROKEN-END'));
  assert.equal((await createWorkspaceProvider({ workspaceRoot: directory }).read()).value.errors[0].code, 'workspace_corrupt');
});

test('Provider: missing, unknown YAML syntax/types/schema, role references and organization mismatch fail explicitly', async () => {
  const directory = await fixture();
  const path = '.ans/organization/current.yaml';
  const original = await readFile(join(directory, path), 'utf8');
  for (const changed of [original.replace('schema_version: 1', 'schema_version: 2'), original + 'unknown: unexpected\n', original.replace('roles:', 'roles: &alias'), original.replace('version: v004', 'version: v999'), original.replace('role: \'../roles/DesktopEngineer/role.yaml\'', 'role: \'../../outside/role.yaml\''), original.replace('delegations: []', 'delegations: !!js/function malicious'), original.replace('roles:', 'roles:\n    invalid_indent: value'), original + 'version: v004\n']) {
    await put(directory, path, changed);
    const result = await createWorkspaceProvider({ workspaceRoot: directory }).read();
    assert.equal(result.value.errors.length > 0, true);
    assert.equal(result.value.sources.some((source) => source.status === 'unavailable'), true);
  }
  const empty = await mkdtemp(join(fixtureRoot, 'empty-'));
  const result = await createWorkspaceProvider({ workspaceRoot: empty }).read();
  assert.equal(result.value.errors[0].code, 'workspace_unavailable');
  assert.equal(result.value.sources[0].status, 'missing');
});

test('Provider: safe bounds, invalid UTF8, traversal daily references and actual junction refuse reads', async () => {
  const directory = await fixture();
  const index = '.ans/events/index.jsonl';
  const original = await readFile(join(directory, index), 'utf8');
  const entries = original.trim().split('\n').map(JSON.parse);
  await put(directory, index, JSON.stringify({ ...entries[0], file: '../outside.jsonl' }) + '\n');
  assert.equal((await createWorkspaceProvider({ workspaceRoot: directory }).read()).value.errors[0].code, 'unsafe_path');
  await put(directory, index, 'x'.repeat(LIMITS.fileBytes + 1));
  assert.equal((await createWorkspaceProvider({ workspaceRoot: directory }).read()).value.errors[0].code, 'workspace_corrupt');
  await writeFile(join(directory, index), Buffer.from([0xff, 0x0a]));
  assert.equal((await createWorkspaceProvider({ workspaceRoot: directory }).read()).value.errors.length, 1);
  const linked = await mkdtemp(join(fixtureRoot, 'linked-'));
  const outside = await fixture();
  await symlink(join(outside, '.ans'), join(linked, '.ans'), 'junction');
  const before = (await readdir(join(outside, '.ans'))).sort();
  const result = await createWorkspaceProvider({ workspaceRoot: linked }).read();
  assert.equal(result.value.errors[0].code, 'unsafe_path');
  assert.deepEqual((await readdir(join(outside, '.ans'))).sort(), before);
  assert.equal((await lstat(join(linked, '.ans'))).isSymbolicLink(), true);
});

function runtimeEvent(sequence, kind = 'agent_run_completed', change = {}) {
  return { sequence, kind, roleId: 'DesktopEngineer', taskId: 'task1', organizationVersion: 'v004', resource: 'secret-file-content', proposalDigest: 'sensitive-digest', correlationId: 'private-run-id', outcome: '', reason: 'prompt=hidden api_key=sk-hidden', observedMutation: false, recordedAt: '2026-10-07T15:00:00.000+08:00', ...change };
}
test('task reader checks >1MiB complete chain/rendering, bounded cache observations and forced SHA verification', async () => {
  const directory = await fixture(); const text = controlledTaskText(1200000); assert.ok(Buffer.byteLength(text) > LIMITS.fileBytes); await put(directory, 'docs/scheduling/fixture-task.md', text); const provider = createWorkspaceProvider({ workspaceRoot: directory }); const first = await provider.read(); assert.deepEqual(first.value.errors, []); assert.equal(first.value.tasks.length, 2); const firstSource = first.value.sources.find((source) => source.relativePath === 'docs/scheduling/fixture-task.md'); assert.equal(firstSource.cached, false);
  const cached = await provider.read(); const cachedSource = cached.value.sources.find((source) => source.relativePath === firstSource.relativePath); assert.equal(cachedSource.cached, true); assert.equal(cachedSource.verifiedAt, firstSource.verifiedAt);
  const forced = await provider.read({ force: true }); assert.equal(forced.value.sources.find((source) => source.relativePath === firstSource.relativePath).cached, false);
  await put(directory, firstSource.relativePath, text.replace('| profiles | DesktopEngineer | verified |', '| profiles | DesktopEngineer | running |')); assert.equal((await provider.read()).value.errors[0].code, 'workspace_corrupt');
  await put(directory, firstSource.relativePath, 'x'.repeat(WB_LIMITS.taskDocumentBytes + 1)); assert.equal((await provider.read()).value.errors[0].code, 'record_budget');
  const many = 'header\n<!-- ANS-TASK-EVENTS-V1\n' + Array(4097).fill('{}').join('\n') + '\nANS-TASK-EVENTS-END -->\n'; await put(directory, firstSource.relativePath, many); assert.equal((await provider.read()).value.errors[0].code, 'record_budget');
});
test('observation preserves 301 actual runtime entries without old DTO overflow or liveness inference', async () => {
  const directory = await fixture(); const text = Array.from({ length: 301 }, (_, index) => JSON.stringify(runtimeEvent(index + 1))).join('\n') + '\n'; await put(directory, '.ans/events/index.jsonl', text); await put(directory, '.ans/events/2026-10-07.jsonl', text); const service = createWorkspaceService({ workspaceRoot: directory }); const result = await service.observe(); assert.equal(result.value.audits.length, 301); assert.equal(result.value.audits.every((event) => event.status === 'completed'), true); assert.equal((await service.refresh()).error.code, 'workspace_corrupt'); assert.equal(JSON.stringify(result).includes('online'), false); service.close();
});
test('refresh byte budget includes all observed task files and rejects beyond 64MiB', async () => {
  const directory = await fixture(); const bytes = 'x'.repeat(WB_LIMITS.taskDocumentBytes);
  for (let index = 0; index < 4; index += 1) await put(directory, `docs/scheduling/budget-${index}.md`, bytes);
  const result = await createWorkspaceProvider({ workspaceRoot: directory }).read();
  assert.equal(result.value.errors.some((error) => error.code === 'record_budget'), true);
  assert.equal(result.value.sources.some((source) => source.kind === 'task' && source.error?.code === 'record_budget'), true);
});

test('Provider: Core camel full-index mirrors daily; mixed/incomplete/unknown formats and divergence unavailable', async () => {
  const directory = await fixture();
  const events = [runtimeEvent(1, 'agent_run_started'), runtimeEvent(2)];
  const text = events.map(JSON.stringify).join('\n') + '\n';
  await put(directory, '.ans/events/index.jsonl', text);
  await put(directory, '.ans/events/2026-10-07.jsonl', text);
  const result = await createWorkspaceProvider({ workspaceRoot: directory }).read();
  assert.deepEqual(result.value.errors, []);
  assert.deepEqual(result.value.audits.map((event) => event.format), ['runtime', 'runtime']);
  assert.equal(JSON.stringify(result).includes('secret-file-content'), false);
  assert.equal(JSON.stringify(result).includes('private-run-id'), false);
  assert.equal(JSON.stringify(result).includes('sk-hidden'), false);
  for (const bad of [text.trimEnd(), '{}\n', JSON.stringify(events[0]) + '\n' + JSON.stringify({ event_id: 'mixed', sequence: 2, line: 2, file: '2026-10-07.jsonl' }) + '\n', events.map((event) => JSON.stringify({ ...event, unknown: true })).join('\n') + '\n']) {
    await put(directory, '.ans/events/index.jsonl', bad);
    assert.equal((await createWorkspaceProvider({ workspaceRoot: directory }).read()).value.errors[0].code, 'workspace_corrupt');
  }
  await put(directory, '.ans/events/index.jsonl', text);
  await put(directory, '.ans/events/2026-10-07.jsonl', JSON.stringify(events[0]) + '\n');
  assert.equal((await createWorkspaceProvider({ workspaceRoot: directory }).read()).value.errors[0].code, 'workspace_corrupt');
  await put(directory, '.ans/events/2026-10-07.jsonl', text + JSON.stringify(events[1]) + '\n');
  assert.equal((await createWorkspaceProvider({ workspaceRoot: directory }).read()).value.errors[0].code, 'workspace_corrupt');
});

test('Service public: accepted organization, old governance version unavailable, bounded assignments and source times', async () => {
  const directory = await fixture();
  const service = createWorkspaceService({ workspaceRoot: directory });
  assert.equal(service.state().status, 'empty');
  const first = await service.refresh();
  assert.equal(first.value.status, 'available');
  assert.equal(first.value.organization.status, 'ACCEPTED');
  assert.deepEqual(first.value.audits.map((event) => [event.organizationVersion, event.status]), [['v001', 'unavailable'], ['v003', 'unavailable']]);
  assert.equal(first.value.tasks.length, 0);
  assert.equal(first.value.lastValidAt, first.value.observedAt);
  const projectId = first.value.project.id;
  const selected = await service.refresh({ assignments: [{ projectId, roleId: 'DesktopEngineer', profileId: 'local-profile' }, { projectId: 'b'.repeat(64), roleId: 'Reviewer', profileId: 'other-project' }, { projectId, roleId: 'removed-role', profileId: 'local-profile' }] });
  assert.equal(selected.value.roles.find((role) => role.id === 'DesktopEngineer').profileId, 'local-profile');
  assert.equal(selected.value.roles.find((role) => role.id === 'Reviewer').profileId, null);
  assert.equal(selected.value.roles.some((role) => role.id === 'removed-role'), false);
  const refreshed = await service.refresh();
  assert.equal(refreshed.value.roles.every((role) => role.profileId === null), true);
  assert.equal(Object.isFrozen(refreshed.value.roles[0]), true);
  const serialized = JSON.stringify(refreshed);
  for (const field of ['isAlive', 'online', 'root', 'prompt', 'token', 'read_scope', 'approval_source', 'raw']) assert.equal(serialized.includes(`"${field}"`), false);
  assert.equal((await service.refresh({ path: 'arbitrary' })).error.code, 'invalid_input');
  assert.equal((await service.refresh({ assignments: Array(LIMITS.assignments + 1).fill({}) })).error.code, 'invalid_input');
  assert.equal(service.close().ok, true);
  assert.equal(service.close().ok, true);
  assert.equal((await service.refresh()).error.code, 'closed');
});

test('Service: corruption retains a visibly stale last valid snapshot; fresh failure and provider exceptions are safe', async () => {
  const directory = await fixture();
  const service = createWorkspaceService({ workspaceRoot: directory });
  const first = (await service.refresh()).value;
  await service.refresh({ assignments: [{ projectId: first.project.id, roleId: 'DesktopEngineer', profileId: 'removed-profile' }] });
  const lastValid = service.state();
  await delay(2); // Preserve the strict source/observation timestamp assertion across a real millisecond.
  await put(directory, '.ans/organization/current.yaml', 'invalid yaml text\n');
  const stale = (await service.refresh()).value;
  assert.equal(stale.status, 'unavailable');
  assert.equal(stale.lastValidAt, lastValid.observedAt);
  assert.notEqual(stale.observedAt, stale.lastValidAt);
  assert.deepEqual(stale.organization, first.organization);
  assert.equal(stale.roles.length, 7);
  assert.equal(stale.roles.find((role) => role.id === 'DesktopEngineer').profileId, null);
  assert.equal(stale.sources.some((source) => source.status === 'unavailable'), true);
  assert.equal(stale.errors[0].code, 'workspace_corrupt');
  service.close();
  const fresh = createWorkspaceService({ workspaceRoot: directory });
  const failed = (await fresh.refresh()).value;
  assert.equal(failed.status, 'unavailable');
  assert.equal(failed.lastValidAt, null);
  assert.equal(failed.roles.length, 0);
  fresh.close();
  const provider = { async read() { throw new Error('raw prompt=private token=private-key'); } };
  const safe = new WorkspaceServiceImpl({ workspaceRoot: directory }, provider);
  const result = await safe.refresh();
  assert.equal(result.value.status, 'unavailable');
  assert.equal(result.value.errors[0].code, 'workspace_corrupt');
  assert.equal(JSON.stringify(result).includes('private'), false);
  safe.close();
});

test('Service integration: task running/verified differs from completed runtime audit; unknown versions/kinds are unavailable', async () => {
  const directory = await fixture();
  await put(directory, 'docs/scheduling/fixture-task.md', controlledTaskText());
  const events = [runtimeEvent(1, 'agent_run_started'), runtimeEvent(2), runtimeEvent(3, 'agent_run_failed', { organizationVersion: 'v999' }), runtimeEvent(4, 'unknown_event')];
  const text = events.map(JSON.stringify).join('\n') + '\n';
  await put(directory, '.ans/events/index.jsonl', text);
  await put(directory, '.ans/events/2026-10-07.jsonl', text);
  const service = createWorkspaceService({ workspaceRoot: directory });
  const result = await service.refresh();
  assert.equal(result.value.status, 'available');
  assert.equal(result.value.organization.status, 'ACCEPTED');
  assert.equal(result.value.tasks.find((task) => task.taskId === 'fixture-task' && task.nodeId === 'workspace').status, 'running');
  assert.equal(result.value.tasks.find((task) => task.taskId === 'fixture-task' && task.nodeId === 'profiles').status, 'verified');
  assert.equal(result.value.tasks.find((task) => task.nodeId === 'workspace').reason, '任务记录包含原因；详细内容未在面板展开。');
  assert.deepEqual(result.value.audits.map((event) => event.status), ['running', 'completed', 'unavailable', 'unavailable']);
  for (const secret of ['private-run-id', 'secret-file-content', 'sk-hidden', 'sensitive-digest', 'tokenHash']) assert.equal(JSON.stringify(result).includes(secret), false);
  service.close();
  const rootService = createWorkspaceService({ workspaceRoot: root });
  const currentRoot = (await rootService.refresh()).value;
  assert.equal(currentRoot.status, 'available');
  const oversized = await oversizedTaskPaths();
  assert.equal(currentRoot.errors.length, oversized.length);
  assert.deepEqual(currentRoot.sources.filter((source) => source.kind === 'task' && source.status === 'unavailable').map((source) => source.relativePath).sort(), oversized);
  rootService.close();
});

test('Architecture: no runtime/development YAML imports, recursion, Service peer/skip-layer calls or public injection', async () => {
  const provider = await readFile(join(root, 'apps/desktop/src/providers/impl/workspace.mjs'), 'utf8');
  const service = await readFile(join(root, 'apps/desktop/src/services/impl/workspace.mjs'), 'utf8');
  assert.equal(/from ['"](?:yaml|js-yaml|.*node_modules|.*kernel|.*services)/u.test(provider), false);
  assert.equal(/recursive:\s*true/u.test(provider), false);
  assert.equal(/from ['"]node:|providers\/(?:abstract|impl)|services\/(?:impl|public)/u.test(service), false);
  assert.equal(/Date\(|Date\.now|setTimeout|readFile|readdir/u.test(service), false);
  assert.throws(() => createWorkspaceService({ workspaceRoot: root, provider: {} }));
  for (const path of ['apps/desktop/src/providers/public/workspace.mjs', 'apps/desktop/src/services/public/workspace.mjs']) assert.equal(/export\s+\*|export\s+class/u.test(await readFile(join(root, path), 'utf8')), false);
});

function replaceYamlField(text, key, value) { return text.replace(new RegExp('^' + key + ':.*$', 'mu'), key + ': ' + value); }
async function boundaryCase(change) {
  const directory = await fixture(); const path = '.ans/roles/DesktopEngineer/boundary.yaml'; const markdownPath = '.ans/roles/DesktopEngineer/boundary.md';
  const source = await readFile(join(directory, path), 'utf8'); const markdown = await readFile(join(directory, markdownPath), 'utf8');
  const changed = change(source, markdown);
  await put(directory, path, changed.yaml); await put(directory, markdownPath, changed.markdown);
  return createWorkspaceProvider({ workspaceRoot: directory }).read();
}

test('Provider: exact approved independent boundary revision is readable; unknown revision, approval, role and status reject', async () => {
  const positive = await createWorkspaceProvider({ workspaceRoot: await fixture() }).read(); assert.deepEqual(positive.value.errors, []); assert.equal(positive.value.organization.version, 'v004');
  const variants = [
    (yaml) => replaceYamlField(yaml, 'version', 'unknown-revision'),
    (yaml) => replaceYamlField(yaml, 'approval_source', 'not-customer-approved'),
    (yaml) => replaceYamlField(yaml, 'role_id', 'KernelEngineer'),
    (yaml) => replaceYamlField(yaml, 'status', 'CANDIDATE'),
    (yaml) => replaceYamlField(yaml, 'version', 'legion-desktop-workbench-v2')
  ];
  for (const variant of variants) {
    const result = await boundaryCase((yaml, markdown) => ({ yaml: variant(yaml), markdown }));
    assert.equal(result.value.errors[0].code, 'workspace_corrupt');
    assert.ok(result.value.sources.some((source) => source.status === 'unavailable'));
  }
});

test('Provider: approved boundary pin rejects Section1-only and simultaneous YAML/Section1 scope additions or removals', async () => {
  for (const mode of ['markdown-add', 'markdown-remove', 'both-add', 'both-remove']) {
    const result = await boundaryCase((yaml, markdown) => {
      const line = /^write_scope: (.+)$/mu.exec(yaml)[1]; const scope = JSON.parse(line); const removed = scope[0];
      if (mode.endsWith('add')) {
        const path = 'src/not-approved.mjs'; markdown += '\n| 文件 | `' + path + '` | 未批准路径 |\n';
        if (mode === 'both-add') yaml = replaceYamlField(yaml, 'write_scope', JSON.stringify([...scope, path]));
      } else {
        markdown = markdown.split('\n').filter((row) => !row.includes('`' + removed + '`')).join('\n');
        if (mode === 'both-remove') yaml = replaceYamlField(yaml, 'write_scope', JSON.stringify(scope.slice(1)));
      }
      return { yaml, markdown };
    });
    assert.equal(result.value.errors[0].code, 'workspace_corrupt', mode);
  }
});

test('Provider: new approved boundary revision cannot be attached to v003 or unknown organization version', async () => {
  for (const version of ['v003', 'v999']) {
    const directory = await fixture();
    for (const [path, field] of [['.ans/project.yaml', 'organization_version'], ['.ans/organization/current.yaml', 'version']]) {
      const source = await readFile(join(directory, path), 'utf8'); await put(directory, path, replaceYamlField(source, field, version));
    }
    assert.equal((await createWorkspaceProvider({ workspaceRoot: directory }).read()).value.errors[0].code, 'workspace_corrupt', version);
  }
});

test('Provider: historical v004 pinned Git boundary snapshot and compatible v003 legacy format remain readable', async () => {
  for (const version of ['v004', 'v003']) {
    const directory = await fixture(); const current = await readFile(join(directory, '.ans/organization/current.yaml'), 'utf8');
    const ids = [...current.matchAll(/\{id: ([A-Za-z0-9_.-]+)/gu)].map((match) => match[1]);
    for (const id of ids) {
      const path = '.ans/roles/' + id + '/boundary.yaml'; let gitId = id; if (id === 'Reviewer') gitId = 'reviewer'; if (id === 'Tester') gitId = 'tester'; const gitPath = '.ans/roles/' + gitId + '/boundary.yaml'; const captured = spawnSync('git', ['show', 'HEAD:' + gitPath], { cwd: root, encoding: 'utf8' });
      assert.equal(captured.status, 0, captured.stderr); let yaml = captured.stdout;
      if (version === 'v003') yaml = replaceYamlField(yaml, 'version', 'legion-desktop-gui-v1');
      await put(directory, path, yaml);
    }
    for (const [path, field] of [['.ans/project.yaml', 'organization_version'], ['.ans/organization/current.yaml', 'version']]) {
      const source = await readFile(join(directory, path), 'utf8'); await put(directory, path, replaceYamlField(source, field, version));
    }
    const result = await createWorkspaceProvider({ workspaceRoot: directory }).read(); assert.deepEqual(result.value.errors, [], version); assert.equal(result.value.organization.version, version); assert.equal(result.value.roles.length, 7);
  }
});

test('Reader: exact Human c872 tuples and prior ddc9 semantic snapshots are readable without candidate-label activation', async () => {
  const ids=['ProjectManager','KernelEngineer','AgentAdapterEngineer','DesktopEngineer','Reviewer','Tester'];
  const current=await createWorkspaceProvider({workspaceRoot:await fixture()}).read();assert.deepEqual(current.value.errors,[]);assert.equal(current.value.roles.length,7);
  const supervisor=current.value.roles.find(role=>role.id==='Supervisor');assert.equal(supervisor.boundary.some(path=>path.includes('shell-review')||path.includes('shell-publication')||path.includes('project-shell.md')),false);
  const historical=await fixture();
  for(const id of ids){const y='.ans/roles/'+id+'/boundary.yaml',m='.ans/roles/'+id+'/boundary.md';const source=await readFile(join(historical,y),'utf8');await put(historical,y,source.split('\n').filter(line=>!line.startsWith('project_shell_candidate_')).join('\n'));const text=await readFile(join(historical,m),'utf8');assert.ok(text.includes('本次项目 Shell v1 新增候选边界'));await put(historical,m,text.split('本次项目 Shell v1 新增候选边界')[0]);}
  const old=await createWorkspaceProvider({workspaceRoot:historical}).read();assert.deepEqual(old.value.errors,[]);assert.equal(old.value.roles.length,7);assert.equal(old.value.roles.find(role=>role.id==='DesktopEngineer').boundary.includes('apps/desktop/tests/unit/shell-review.test.mjs'),false);
  const formatted=await fixture();for(const id of ids){const path='.ans/roles/'+id+'/boundary.yaml';const text=await readFile(join(formatted,path),'utf8');await put(formatted,path,'# same accepted semantic tuple, formatting only\n\n'+text.replace(/\n/gu,'\r\n'));}assert.deepEqual((await createWorkspaceProvider({workspaceRoot:formatted}).read()).value.errors,[]);
});

test('Reader: four known candidate metadata fields remain pinned; unknown fields/scopes and Supervisor injection reject', async () => {
  const variants=[
    source=>source+'\nproject_shell_candidate_authorization: self-approved\n',
    source=>replaceYamlField(source,'project_shell_candidate_status','ACCEPTED'),
    source=>replaceYamlField(source,'project_shell_candidate_version','arbitrary-shell-v2'),
    source=>replaceYamlField(source,'project_shell_candidate_write_scope','["src/not-approved.mjs"]'),
    source=>replaceYamlField(source,'project_shell_candidate_generated_effect_scope','["src/"]'),
    source=>replaceYamlField(source,'approval_source','direct_customer_config_sha256_c872245f285125eae264b77ef4447a97fe0dcb14506c0e77f216d41003865ea4')
  ];for(const variant of variants){const result=await boundaryCase((source,markdown)=>({yaml:variant(source),markdown}));assert.equal(result.value.errors[0].code,'workspace_corrupt');}
  const both=await boundaryCase((source,markdown)=>({yaml:replaceYamlField(source,'project_shell_candidate_write_scope','["src/not-approved.mjs"]'),markdown:markdown+'\n| 文件 | `src/not-approved.mjs` | unknown candidate scope |\n'}));assert.equal(both.value.errors[0].code,'workspace_corrupt');
  const directory=await fixture(),path='.ans/roles/Supervisor/boundary.yaml';const supervisor=await readFile(join(directory,path),'utf8'),desktop=await readFile(join(directory,'.ans/roles/DesktopEngineer/boundary.yaml'),'utf8');await put(directory,path,supervisor+'\n'+desktop.split('\n').filter(line=>line.startsWith('project_shell_candidate_')).join('\n'));assert.equal((await createWorkspaceProvider({workspaceRoot:directory}).read()).value.errors[0].code,'workspace_corrupt');
});
