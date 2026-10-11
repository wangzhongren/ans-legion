import {completion as protocolCompletion} from '../../../../tests/integration/test_cli_installed_flow.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { dirname, resolve, join, relative, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createWorkbenchPipeline } from '../../src/pipelines/workbench.mjs';
import { createOrganizationService } from '../../src/services/public/organization.mjs';
import { createProjectService } from '../../src/services/public/project.mjs';
import { FIXED_ROLE_DUTIES } from '../../src/models/organization.mjs';
import { planCandidate, governedDTO } from '../../src/models/workbench.mjs';
import { createWorkspaceService } from '../../src/services/public/workspace.mjs';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const role = process.env.LEGION_DESKTOP_TEST_ROLE ?? 'Tester';
assert.ok(['Tester', 'Reviewer', 'ProjectManager'].includes(role), 'unknown desktop test role');
export const generated = join(projectRoot, '.ans/runtime/legion-cli-role-owned-v2', role);
export const fixtureLeaseRoot=userData=>join(dirname(userData),'host-private-leases');
const fixtureOutputs=new WeakMap();
export const outputs=task=>fixtureOutputs.get(task)??[];
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function messageText(message) { if (typeof message.content === 'string') return message.content; return message.content.map(item => item.text ?? '').join(''); }
export function environment(extra = {}) {
  const value = { ...process.env, ...extra, LEGION_DESKTOP_TEST_ROLE: role, TMPDIR: join(generated, 'tmp'), TEMP: join(generated, 'tmp'), TMP: join(generated, 'tmp'), NODE_DISABLE_COMPILE_CACHE: '1' };
  for (const field of ['NODE_OPTIONS', 'NODE_COMPILE_CACHE', 'NODE_PATH', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_OVERRIDE_DIST_PATH']) delete value[field];
  return value;
}
export async function guard(path, create = false) {
  const child = relative(projectRoot, resolve(path));
  assert.ok(child && child !== '..' && !child.startsWith('..' + sep) && !isAbsolute(child));
  for (let ancestor = projectRoot;; ancestor = dirname(ancestor)) {
    const info = await fs.lstat(ancestor); assert.ok(info.isDirectory() && !info.isSymbolicLink());
    if (ancestor === dirname(ancestor)) break;
  }
  let current = projectRoot;
  for (const component of child.split(sep)) {
    current = join(current, component);
    if (create) { try { await fs.mkdir(current); } catch (error) { if (error.code !== 'EEXIST') throw error; } }
    const info = await fs.lstat(current); assert.ok(info.isDirectory() && !info.isSymbolicLink());
  }
}
export async function removeOwned(path, base) {
  const child = relative(resolve(base), resolve(path));
  assert.ok(child && !child.startsWith('..') && !isAbsolute(child));
  await guard(path); await fs.rm(path, { recursive: true });
  await assert.rejects(fs.stat(path), { code: 'ENOENT' });
}
export async function ownedDirectory(kind, prefix) {
  const base = join(generated, kind); await guard(base, true);
  return fs.mkdtemp(join(base, prefix));
}
export async function waitFor(read, predicate, label, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const value = await read(); if (predicate(value)) return value; await delay(20); }
  assert.fail('bounded condition: ' + label);
}
export function plan(profileId, files = ['result.txt']) {
  return { schemaVersion:2, goal: 'Finite exact customer work', roles: [{ id: 'Writer', name: '实施成员', purpose: 'Exact controlled output', profileId }],
    tasks: files.map((resource, index) => {const task={ id: 'task' + index, title: resource, roleId: 'Writer', profileId,
      dependsOn: [], intent:'change', instruction: 'Write exactly ' + resource };fixtureOutputs.set(task,[resource]);return task;}) };
}
export const planText = candidate => '```legion-plan\n' + JSON.stringify(candidate) + '\n```';
let completionCallId = 0;
export function completion(text, model = 'tester-local', tool = null, toolName = 'legion_write_file') {
  let delta = { role: 'assistant', content: text }; let finish = 'stop';
  if (tool) { completionCallId += 1; delta = { role: 'assistant', tool_calls: [{ index: 0, id: 'controlled-tool-' + completionCallId, type: 'function', function: { name: toolName, arguments: JSON.stringify(tool) } }] }; finish = 'tool_calls'; }
  return [{ index: 0, delta, finish_reason: null }, { index: 0, delta: {}, finish_reason: finish }]
    .map(choice => 'data: ' + JSON.stringify({ id: 'tester', object: 'chat.completion.chunk', model, choices: [choice] }) + '\n\n').join('') + 'data: [DONE]\n\n';
}
export function protocolText(protocol, text, model = 'tester-local') {
  if (protocol === 'openai-completions') return completion(text, model);
  let events;
  if (protocol === 'anthropic-messages') {
    events = [{ type: 'message_start', message: { id: 'msg', type: 'message', role: 'assistant', model, content: [], stop_reason: null, usage: { input_tokens: 1, output_tokens: 0 } } },
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
      { type: 'content_block_stop', index: 0 }, { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } }, { type: 'message_stop' }];
  } else {
    const item = { id: 'item', type: 'message', role: 'assistant', status: 'in_progress', content: [] };
    const part = { type: 'output_text', text, annotations: [] };
    const response = { id: 'resp', object: 'response', created_at: 1, model, status: 'in_progress', output: [] };
    events = [{ type: 'response.created', response }, { type: 'response.output_item.added', output_index: 0, item },
      { type: 'response.content_part.added', item_id: 'item', output_index: 0, content_index: 0, part: { ...part, text: '' } },
      { type: 'response.output_text.delta', item_id: 'item', output_index: 0, content_index: 0, delta: text },
      { type: 'response.output_text.done', item_id: 'item', output_index: 0, content_index: 0, text },
      { type: 'response.content_part.done', item_id: 'item', output_index: 0, content_index: 0, part },
      { type: 'response.output_item.done', output_index: 0, item: { ...item, status: 'completed', content: [part] } },
      { type: 'response.completed', response: { ...response, status: 'completed', output: [{ ...item, status: 'completed', content: [part] }], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } }];
  }
  return events.map(event => 'event: ' + event.type + '\ndata: ' + JSON.stringify(event) + '\n\n').join('');
}
export function modelFacts(body){const tags=['当前Host事实：','当前组织：','当前持久组织与提案、交互、实际验收/返修（仅事实不授权）：'];for(const tag of tags){for(const message of [...(body.messages??[])].reverse()){const text=messageText(message);if(text.includes(tag))return JSON.parse(text.split(tag)[1].split('\n')[0]);}}assert.fail('real Host facts missing');}
export function toolResults(body){const messages=body.messages??[];return messages.slice(messages.findLastIndex(message=>message.role==='user')+1).filter(message=>message.role==='tool').map(message=>JSON.parse(message.content));}
async function suFixtureReply(call,reply,options){if(call.path.endsWith('/responses')||call.path.endsWith('/messages'))return false;const names=(call.body.tools??[]).map(tool=>tool.function?.name??tool.name);if(!names.includes('legion_delegate_pm'))return false;const pairs=toolResults(call.body);const waiting=pairs.findLast(pair=>pair.result.tool==='legion_delegate_pm'&&pair.result.payload?.kind==='needs_human');const done=pairs.findLast(pair=>pair.result.tool==='legion_delegate_pm'&&['plan_ref','result_ref','error'].includes(pair.result.payload?.kind));
 if(done){if(done.result.payload.kind==='error'){replyText(reply,'Host明确委托失败 '+done.result.payload.code);return true;}replyText(reply,'OK · Su safe current continuation');return true;}
 if(waiting){const answered=pairs.findLast(pair=>pair.result.tool==='legion_request_interaction');if(!answered){replyText(reply,'',{payload:{questionRef:waiting.result.payload.questionRef}},'legion_request_interaction');return true;}replyText(reply,'',{payload:{action:'resume',delegationId:waiting.result.payload.delegationId,humanAnswerRef:answered.result.payload.humanAnswerRef}},'legion_delegate_pm');return true;}
 const marker='当前项目分类事实（仅数据；当前Human、canonical计划与owner优先，不提供许可）：';const prompt=(call.body.messages??[]).map(messageText).findLast(text=>text.includes(marker));if(!prompt)return false;const context=JSON.parse(prompt.slice(prompt.lastIndexOf(marker)+marker.length).split('\n')[0]);const source=context.sourceIndex.findLast(item=>item.type==='human');assert.ok(source);let purpose='plan',extra={};if(options.customerPurpose?.()==='repair'){const state=modelFacts(call.body);const acceptance=state.acceptances.at(-1);assert.ok(acceptance);purpose='repair';extra={acceptanceId:acceptance.id,taskId:acceptance.issues[0].taskId};}
 replyText(reply,'',{payload:{action:'start',purpose,instruction:'客户明确的本轮要求：'+(call.body.messages??[]).map(messageText).findLast(text=>text.includes('Human消息：\n')).split('Human消息：\n')[1].split('\n')[0],sourceRefs:[source.id],...extra}},'legion_delegate_pm');return true;
}
export async function localServer(handler,options={}) {
  const calls = []; const errors = []; const sockets = new Set();
  const server = createServer(async (request, reply) => {
    try { let raw = ''; for await (const bytes of request) raw += bytes;
      const call = { body: JSON.parse(raw), headers: request.headers, path: new URL(request.url, 'http://127.0.0.1').pathname }; calls.push(call);reply.protocol='openai-completions';if(call.path.endsWith('/responses'))reply.protocol='openai-responses';if(call.path.endsWith('/messages'))reply.protocol='anthropic-messages';if(options.customerHandler&&await options.customerHandler(call,reply))return;if(await suFixtureReply(call,reply,options))return;await handler(call, reply, calls);
    } catch (error) { errors.push(error); reply.destroy(); }
  });
  server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  return { calls, errors, baseUrl: 'http://127.0.0.1:' + server.address().port + '/v1',
    async close() { for (const socket of sockets) socket.destroy(); await new Promise((done, reject) => server.close(error => { if (error) reject(error); else done(); })); assert.deepEqual(errors, []); } };
}
export function replyText(reply,text,tool=null,toolName='legion_write_file'){if(reply.destroyed)return;protocolCompletion(reply,reply.protocol??'openai-completions',text,tool,toolName,'fixture-'+(++completionCallId));}
/** Independent typed Supervisor consumes actual installed SDK tool requests. */
export function supervisionReply(call,reply) {
 const names=(call.body.tools??[]).map(item=>item.function?.name??item.name);
 if(!names.includes('legion_submit_supervision'))return false;
 assert.equal(names.includes('legion_write_file'),false);
 const messages=call.body.messages;const prompt=messageText(messages.findLast(item=>item.role==='user'));
 const previous=messages.filter(item=>item.role==='tool').map(item=>JSON.parse(item.content));
 if(!previous.some(item=>item.result.tool==='legion_submit_supervision')){const snapshot=JSON.parse(prompt.split('监督输入：')[1].split('\n')[0]);replyText(reply,'',{payload:{phase:snapshot.phase,planDigest:snapshot.planDigest,findings:[],recommendation:'proceed'}},'legion_submit_supervision');}
 else {assert.equal(previous.at(-1).result.status,'completed');replyText(reply,'Typed independent supervision complete');}
 return true;
}
const unwrap = result => { assert.equal(result.ok, true, result.error?.code); return result.value; };

export async function confirmExecution(pipeline, state, value = true) {
  const request = state.interactions.findLast(item => item.status === 'pending' && item.purpose === 'execute_plan' && item.bindings.planDigest===state.plan.planDigest);
  assert.ok(request, 'current human execution request '+JSON.stringify({planStatus:state.plan?.status,turnStatus:state.turn?.status,requests:state.interactions.map(item=>({purpose:item.purpose,status:item.status,samePlan:item.bindings.planDigest===state.plan?.planDigest}))}));
  return pipeline.answerInteraction({ projectId: state.currentProject.id, requestId: request.requestId,
    version: request.version, requestDigest: request.digest, value });
}

/** Regression fixture uses the actual public organization approval contract. */
export async function prepareCandidate(candidate, root, userData, expected = 'actual tester write') {
  const projects = createProjectService({ userDataDir: userData,leaseRoot:fixtureLeaseRoot(userData) });
  const organizations = createOrganizationService({ userDataDir: userData });
  try {
    const project = unwrap(await projects.select(root)); let domain = await organizations.load(project);
    candidate.roles = candidate.roles.filter(role => role.id !== 'Acceptance');
    candidate.tasks = candidate.tasks.filter(task => task.id !== 'zzindependent');
    const transfers = candidate.transfers ?? [];
    const members = [];
    for (const role of candidate.roles) {
      const prior = domain.organization.members.find(item => item.id === role.id);
      let boundary = [...(prior?.boundary ?? [])];
      if (role.id === 'Writer' && !boundary.includes('rival.txt')) boundary.push('rival.txt');
      for (const task of candidate.tasks.filter(item => item.roleId === role.id)) for (const resource of outputs(task)) if (!boundary.includes(resource)) boundary.push(resource);
      for (const transfer of transfers.filter(item => item.fromRoleId === role.id)) boundary = boundary.filter(resource => resource !== transfer.resource);
      if (prior?.status === 'approved' && prior.name === role.name && prior.purpose === role.purpose && JSON.stringify([...prior.boundary].sort()) === JSON.stringify([...boundary].sort())) continue;
      members.push({ id: role.id, name: role.name, purpose: role.purpose, interfaces: [], boundary,
        documents: [], revision: (prior?.revision ?? 0) + 1, enabled: true, status: 'approved' });
    }
    for (const transfer of transfers) if (!members.some(item => item.id === transfer.fromRoleId)) {
      const prior = domain.organization.members.find(item => item.id === transfer.fromRoleId);
      if (!prior.boundary.includes(transfer.resource)) continue;
      members.push({ ...prior, boundary: prior.boundary.filter(resource => resource !== transfer.resource), revision: prior.revision + 1, digest: undefined });
    }
    const proposalId = 'fixture-' + (domain.revision + 1);
    const fixedAcceptance = domain.organization.members.find(item => item.id === 'Acceptance');
    if (fixedAcceptance.status !== 'approved') members.push({ ...fixedAcceptance, revision: fixedAcceptance.revision + 1, status: 'approved', digest: undefined });
    const newTransfers = transfers.filter(transfer => domain.organization.fileOwners.find(item => item.resource === transfer.resource)?.roleId !== transfer.toRoleId);
    if (members.length) {
      domain = await organizations.submitProposal(project, { id: proposalId, version: 1, members, transfers: newTransfers }, { projectId: project.id, roleId: 'RoleArchitect', instanceId: 'fixture-architect' });
      const proposal = domain.ledger.proposals.at(-1);
      domain = await organizations.reviewProposal(project, { proposalId, version: 1, digest: proposal.digest,
      organizationRevision: domain.organization.revision, organizationDigest: domain.organization.digest, decision: 'approve', reason: 'Exact regression fixture' },
      { projectId: project.id, roleId: 'ProjectManager', instanceId: 'fixture-pm' });
    }
    candidate.roles = candidate.roles.map(role => { const member = domain.organization.members.find(item => item.id === role.id); return { ...role, revision: member.revision, digest: member.digest }; });
    const resources = [...new Set(candidate.tasks.flatMap(task => outputs(task)))];
    await fs.mkdir(join(root, 'tests'), { recursive: true });
    for (const task of candidate.tasks) {
      const path = 'tests/regression-' + task.id + '.test.mjs';
      const source = "import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';" +
        'test(' + JSON.stringify(task.id) + ',()=>{' + outputs(task).map(resource => 'assert.equal(fs.readFileSync(' + JSON.stringify(resource) + ", 'utf8')," + JSON.stringify(expected) + ');').join('') + '});';
      await fs.writeFile(join(root, path), source);
      task.checks = [{ checkId: 'selftest-' + task.id, kind: 'node-test', argv: ['--test', path], testResources: [path], inputResources: [...new Set([path, ...outputs(task), ...candidate.tasks.filter(item => task.dependsOn.includes(item.id)).flatMap(item => outputs(item))])], outputResources: [], timeoutSeconds: 10, network: 'none', logMaxBytes: 4096 }];
    }
    const path = 'tests/acceptance.test.mjs';
    await fs.writeFile(join(root, path), "import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';test('all approved output contents',()=>{" + resources.map(resource => 'assert.equal(fs.readFileSync(' + JSON.stringify(resource) + ", 'utf8')," + JSON.stringify(expected) + ');').join('') + '});');
    const acceptance = domain.organization.members.find(item => item.id === 'Acceptance');
    candidate.roles.push({ id: acceptance.id, name: acceptance.name, purpose: acceptance.purpose, profileId: candidate.roles[0].profileId, revision: acceptance.revision, digest: acceptance.digest });
    candidate.tasks.push({ id: 'zzindependent', title: 'Independent exact contents', roleId: 'Acceptance', profileId: candidate.roles[0].profileId, intent:'verify', dependsOn: candidate.tasks.map(task => task.id), accepts: candidate.tasks.map(task => task.id), instruction: 'Independently inspect every output and run check, submit actual acceptance', checks: [{ checkId: 'acceptance', kind: 'node-test', argv: ['--test', path], testResources: [path], inputResources: [path, ...resources], outputResources: [], timeoutSeconds: 10, network: 'none', logMaxBytes: 4096 }] });
    candidate.governance = { organizationRevision: domain.organization.revision, organizationDigest: domain.organization.digest, maxRepairRounds: 2 };
    return candidate;
  } finally { await organizations.close(); await projects.close(); }
}

/** Runs in actual Electron main, with real safeStorage and installed SDK/public production entries. */
export async function runPublicFlows(location, userData) {
  const evidenceDirectory=await ownedDirectory('evidence','public-flow-details-');
  const { safeStorage } = await import('electron'); assert.equal(safeStorage.isEncryptionAvailable(), true);
  const { AgentSession } = await import('@earendil-works/pi-coding-agent');
  for (const dependency of ['pi-ai', 'pi-coding-agent']) {
    const metadata = JSON.parse(await fs.readFile(join(projectRoot, 'apps/desktop/node_modules/@earendil-works', dependency, 'package.json'), 'utf8'));
    assert.equal(metadata.version, '1.0.4');
  }
  const prompts = []; const originalPrompt = AgentSession.prototype.prompt;
  AgentSession.prototype.prompt = function (...args) { assert.ok(this instanceof AgentSession); prompts.push({ session: this, tools: this.getActiveToolNames() }); return originalPrompt.apply(this, args); };
  const scenarios = []; let pipeline; let server; let mode = 'chat'; let candidate; let contextChangeRoot; let deniedResource; let held; let workerCalls = 0; let readCalls = 0; let selectedRoot;
  const rootA = join(location, 'customer-A'); const rootB = join(location, 'customer-B'); await fs.mkdir(rootA); await fs.mkdir(rootB); selectedRoot = rootA;
  const managerCall=()=>server.calls.findLast(call=>(call.body.tools??[]).some(tool=>tool.function?.name==='legion_design_roles'));
  const select = async root => { selectedRoot = root; return pipeline.selectProject(root); };
  const prepare = async () => { if (candidate) {
    await waitFor(async()=>unwrap(await pipeline.getState()),state=>!state.supervisions.some(item=>item.status==='pending'),'actual Supervisor journal idle before fixture organization setup');
    try { planCandidate(candidate); } catch (error) { if (['cross_role_claim', 'missing_task_dependency'].includes(error.reason)) return; throw error; }
    await prepareCandidate(candidate, selectedRoot, userData, candidate.transfers?.length ? 'actual new owner write' : 'actual tester write');
  } };
  try {
    server = await localServer(async (call, reply) => {
      if (!call.path.endsWith('/messages')) assert.equal(call.headers.authorization, 'Bearer tester-local-secret');
      if (call.path.endsWith('/responses')) { protocolCompletion(reply,'openai-responses','OK'); return; }
      if (call.path.endsWith('/messages')) { assert.equal(call.headers['x-api-key'], 'tester-local-secret'); protocolCompletion(reply,'anthropic-messages','OK'); return; }
      if(supervisionReply(call,reply))return;
      const names = (call.body.tools ?? []).map(tool => tool.function.name);
      if (names.includes('legion_submit_acceptance')) {
        const previous = call.body.messages.filter(item => item.role === 'tool');
        if (!previous.length) { replyText(reply, '', { checkId: 'acceptance' }, 'legion_run_check'); return; }
        if (previous.length === 1) { const checked = JSON.parse(previous[0].content).result; replyText(reply, '', { payload: { taskId: 'zzindependent', evidenceIds: [checked.requestId], decision: 'pass', issues: [] } }, 'legion_submit_acceptance'); return; }
        replyText(reply, 'Independent evidence submitted'); return;
      }
      if (!names.includes('legion_write_file')) {
        assert.ok(names.includes('legion_list_files') && names.includes('legion_read_file'));
        if (mode === 'read-plan') {
          const previous = call.body.messages.filter(item => item.role === 'tool');
          readCalls += 1;
          if (previous.length === 0) { replyText(reply, '', { resource: '' }, 'legion_list_files'); return; }
          if (previous.length === 1) { replyText(reply, '', { resource: 'unselected.txt', maxBytes: 64 }, 'legion_read_file'); return; }
          if (previous.length === 2) { replyText(reply, '', { resource: 'nested/.ssh/id_rsa' }, 'legion_read_file'); return; }
          assert.ok(JSON.stringify(previous).includes('unselected-secret-marker'));
          assert.ok(!JSON.stringify(previous).includes('nested-credential-marker'));
          replyText(reply, planText(candidate)); return;
        }
        if (mode === 'hang') { held = reply; reply.writeHead(200, { 'content-type': 'text/event-stream' }); reply.write('data: ' + JSON.stringify({ id: 'stream', model: 'tester-local', choices: [{ index: 0, delta: { role: 'assistant', content: 'partial delta' }, finish_reason: null }] }) + '\n\n'); return; }
        let text = 'Clarify safely'; if (mode === 'plan') text = planText(candidate); replyText(reply, text); return;
      }
      workerCalls += 1; assert.deepEqual(names.sort(), ['legion_edit_file', 'legion_list_files','legion_query_memory', 'legion_read_file','legion_remember_fact', 'legion_request_shell', 'legion_run_check', 'legion_write_file']);
      if (mode === 'owner-edit') {
        const previous = call.body.messages.filter(item => item.role === 'tool');
        if (previous.length === 0) { replyText(reply, '', { resource: 'result.txt' }, 'legion_read_file'); return; }
        if (previous.length === 1) {
          const readResult = JSON.parse(previous[0].content).result;
          assert.equal(readResult.status, 'read'); assert.equal(readResult.text, 'actual tester write');
          assert.equal(readResult.sha256, sha(Buffer.from('actual tester write')));
          replyText(reply, '', { resource: 'result.txt', expectedSha256: readResult.sha256,
            replacements: [{ oldText: 'tester', newText: 'new owner' }] }, 'legion_edit_file'); return;
        }
        if (previous.length === 2) { assert.equal(JSON.parse(previous.at(-1).content).result.status, 'written'); replyText(reply, '', { checkId: 'selftest-task0' }, 'legion_run_check'); return; }
        assert.equal(JSON.parse(previous.at(-1).content).result.status, 'passed');
        replyText(reply, 'Owned edit completed'); return;
      }
      if (mode === 'worker-hang') { held = reply; return; }
      if (mode === 'missing') { replyText(reply, 'All work and tests completed'); return; }
      const previous = call.body.messages.filter(item => item.role === 'tool');
      if (previous.length === 1 && JSON.parse(previous[0].content).result.success) { const task = JSON.parse(messageText(call.body.messages.findLast(item => item.role === 'user')).split('Human已确认任务：')[1].split('\n')[0]); replyText(reply, '', { checkId: task.checks[0].checkId }, 'legion_run_check'); return; }
      if (previous.length) { replyText(reply, 'Host result received'); return; }
      if (mode === 'context-change') await fs.writeFile(join(contextChangeRoot, 'context.txt'), 'changed');
      if (mode === 'deny') { replyText(reply, '', { resource: deniedResource, content: 'forbidden controlled proposal' }); return; }
      replyText(reply, '', { resource: outputs(candidate.tasks[0])[0], content: 'actual tester write' });
    });
    pipeline = createWorkbenchPipeline({ userDataDir: userData,leaseRoot:fixtureLeaseRoot(userData) });
    const saved = unwrap(await pipeline.saveProfile({ name: 'Tester local', protocol: 'openai-completions', provider: 'tester', modelId: 'tester-local', baseUrl: server.baseUrl, keyAction: 'replace', apiKey: 'tester-local-secret' }));
    const profileId = saved.profiles[0].id; unwrap(await pipeline.setDefaultProfile({ profileId }));
    let state = unwrap(await select(rootA)); const idA = state.currentProject.id;
    assert.deepEqual(state.roles.map(item => item.id).sort(), ['Acceptance', 'ProjectManager', 'RoleArchitect','Supervisor']); assert.equal(server.calls.length, 0); assert.deepEqual(await fs.readdir(rootA), []);
    assert.equal((await select(userData)).ok, false); assert.equal((await select(dirname(userData))).ok, false);
    unwrap(await select(rootA));
    const read = async () => unwrap(await pipeline.getState());
    const send = async text => { if (mode === 'plan' || mode === 'read-plan') await prepare(); const started = unwrap(await pipeline.sendMessage({ projectId: (await read()).currentProject.id, roleId: 'Supervisor', text })); await waitFor(read, value => value.turn?.status === 'completed' && (!candidate || mode !== 'plan' || value.plan?.status === 'draft'), 'actual turn/plan '+text); return started; };
    const managerIdentity=async()=>{const domain=JSON.parse(await fs.readFile(join(userData,'workbench-organization',idA+'.json'),'utf8'));return domain.memberConversations.runs.findLast(run=>run.roleId==='Supervisor'&&run.channel==='su_customer').instanceId;};
    await send('first requirement');const firstManager=await managerIdentity();await send('clarify same manager');
    assert.deepEqual(await managerIdentity(),firstManager);assert.notEqual(prompts[0].session,prompts[1].session);assert.ok(JSON.stringify(managerCall().body.messages).includes('first requirement')); assert.ok(prompts[0].tools.includes('legion_delegate_pm'));assert.ok(!prompts[0].tools.includes('legion_write_file'));
    assert.equal((await read()).history.messages.length, 4); assert.deepEqual(await fs.readdir(rootA), []);
    assert.equal((await pipeline.sendMessage({ projectId: idA, roleId: 'Writer', text: 'bypass' })).error.code, 'manager_only');
    mode = 'hang'; const started = unwrap(await pipeline.sendMessage({ projectId: idA, roleId: 'Supervisor', text: 'cancel streamed turn' }));
    await waitFor(read, value => value.turn?.status==='running'&&Boolean(held), 'real SDK response in flight');assert.ok(!(await read()).turn.text.includes('partial delta'),'unverified streaming fragment remains buffered'); unwrap(await pipeline.cancelTurn({ projectId: idA, turnId: started.turn.id }));
    mode = 'chat'; await send('continue after cancel'); assert.deepEqual(await managerIdentity(),firstManager);assert.notEqual(prompts[0].session,prompts[3].session);assert.ok(JSON.stringify(managerCall().body.messages).includes('clarify same manager')); const continuedState=await read(),continuedHistory=continuedState.history.messages;assert.equal(continuedHistory.length,7);assert.deepEqual(continuedHistory.map(message=>message.role),['user','assistant','user','assistant','user','user','assistant']);assert.deepEqual(continuedHistory[4],{role:'user',text:'cancel streamed turn'});assert.equal(continuedHistory.filter(message=>message.role==='user'&&message.text==='cancel streamed turn').length,1);assert.ok(!continuedHistory.some(message=>message.role==='assistant'&&message.text.includes('partial delta')),'cancelled partial is not restored as assistant history');assert.ok(JSON.stringify(managerCall().body.messages).includes('cancel streamed turn'),'actual SDK retains the complete cancelled Human');assert.ok(!JSON.stringify(managerCall().body.messages).includes('partial delta'),'actual SDK never promotes cancelled partial assistant');assert.equal(continuedState.timeline.turns.find(turn=>turn.id===started.turn.id).status,'cancelled');assert.ok(!continuedState.timeline.messages.some(message=>message.turnId===started.turn.id&&message.kind==='assistant'&&message.text.includes('partial delta')),'private PM partial never becomes customer Su archive');assert.ok(continuedState.memberConversations.runs.some(run=>run.roleId==='ProjectManager'&&run.status==='cancelled'),'actual PM cancellation remains in its action journal');
    state = unwrap(await select(rootB)); const idB = state.currentProject.id; assert.notEqual(idA, idB); assert.deepEqual(state.history.messages, []);
    await send('only project B'); const historyB = (await read()).history.messages;
    state = unwrap(await select(rootA)); assert.equal(state.history.messages.length, 7);assert.deepEqual(state.history.messages,continuedHistory);assert.ok(!historyB.some(message=>message.text.includes('cancel streamed turn')),'cancelled Human never crosses project identity'); assert.ok(!JSON.stringify(state.history).includes('only project B')); assert.ok(JSON.stringify(historyB).includes('only project B'));
    scenarios.push('first-message/same-PM/delta/cancel/continue/two-project isolation');
    await fs.writeFile(join(rootA, 'context.txt'), 'explicit-context-marker'); await fs.writeFile(join(rootA, 'unselected.txt'), 'unselected-secret-marker');
    await fs.mkdir(join(rootA, 'nested/.ssh'), { recursive: true }); await fs.writeFile(join(rootA, 'nested/.ssh/id_rsa'), 'nested-credential-marker');
    candidate = plan(profileId, ['read-plan-result.txt']); mode = 'read-plan'; await send('inspect ordinary project files');
    const readPlan = await read(); assert.equal(readPlan.plan.status, 'draft'); assert.ok(readCalls >= 4);
    assert.ok(!JSON.stringify(readPlan).includes('unselected-secret-marker'));
    assert.ok(!JSON.stringify(readPlan).includes('nested-credential-marker'));
    assert.deepEqual((await fs.readdir(rootA)).filter(name=>name!=='tests').sort(), ['context.txt', 'nested', 'unselected.txt']);
    assert.deepEqual(await fs.readdir(join(rootA, '.ans')).catch(error => error.code === 'ENOENT' ? [] : Promise.reject(error)), []);
    scenarios.push('PM lists and reads ordinary project file; nested credential denied without persistence or audit');
    mode = 'chat'; candidate = null;
    state = unwrap(await select(rootB)); assert.equal(state.currentProject.id, idB);
    await send('after project switch'); assert.ok(!JSON.stringify(await read()).includes('unselected-secret-marker'));
    state = unwrap(await select(rootA)); assert.equal(state.currentProject.id, idA);
    assert.ok(!JSON.stringify(state).includes('unselected-secret-marker'));
    scenarios.push('project switch leaves autonomous read text out of persisted cross-project state');
    assert.equal((await pipeline.selectContext({ projectId: idA, resources: ['../outside'] })).ok, false);
    unwrap(await pipeline.selectContext({ projectId: idA, resources: ['context.txt'] }));
    candidate = plan(profileId); mode = 'plan'; await send('prepare exact plan'); state = await read();
    assert.equal(state.context.files[0].sha256, sha(Buffer.from('explicit-context-marker'))); assert.deepEqual(state.roles.map(item => item.id).sort(), ['Acceptance', 'ProjectManager', 'RoleArchitect','Supervisor', 'Writer']);
    assert.deepEqual((await fs.readdir(rootA)).filter(name=>name!=='tests').sort(), ['context.txt', 'nested', 'unselected.txt']);
    const explicitPrompt = JSON.stringify(managerCall().body.messages.findLast(message => message.role === 'user'));
    assert.ok(explicitPrompt.includes('explicit-context-marker')); assert.ok(!explicitPrompt.includes('unselected-secret-marker'));
    assert.equal((await pipeline.confirmPlan({ projectId: idA, planDigest: '0'.repeat(64) })).ok, false);
    unwrap(await confirmExecution(pipeline, state));
    const done = await waitFor(read, value => value.plan?.status === 'completed', 'actual file completion');
    assert.equal(await fs.readFile(join(rootA, 'result.txt'), 'utf8'), 'actual tester write'); assert.equal(done.tasks[0].checkStatus, 'passed');assert.equal(done.tasks[0].acceptanceStatus,'pass');
    assert.equal(done.tasks[0].results[0].observedMutation, true); assert.equal((await pipeline.confirmPlan({ projectId: idA, planDigest: state.plan.planDigest })).ok, false);
    const events = (await fs.readFile(join(rootA, '.ans/events/index.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.deepEqual(events.map(event => event.sequence), events.map((_, index) => index + 1));
    assert.ok(events.some(event => event.kind === 'mutation_success')); assert.ok(events.every(event => event.recordedAt.endsWith('+08:00')));
    assert.ok(!JSON.stringify(events).includes('actual tester write')); assert.ok(!JSON.stringify(done).includes('tester-local-secret'));
    for (const date of new Set(events.map(event => event.recordedAt.slice(0, 10)))) {
      const daily = (await fs.readFile(join(rootA, '.ans/events', date + '.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
      assert.deepEqual(daily, events.filter(event => event.recordedAt.startsWith(date)));
    }
    scenarios.push('Human exact context/confirmation/real tool write/audit/no replay/not_executed');
    for (const resource of ['outside/new.txt', '.ans/organization/current.yaml']) {
      candidate = plan(profileId, ['approved-only.txt']); mode = 'plan'; await send('deny outside exact task'); const staged = await read();
      mode = 'deny'; deniedResource = resource; unwrap(await confirmExecution(pipeline, staged));
      const denied = await waitFor(read, value => value.plan?.status === 'failed', 'dynamic task deny');
      assert.equal(denied.tasks[0].results[0].status, 'denied'); assert.equal(denied.tasks[0].results[0].observedMutation, false);
      await assert.rejects(fs.stat(join(rootA, resource)), { code: 'ENOENT' }); await assert.rejects(fs.stat(join(rootA, 'approved-only.txt')), { code: 'ENOENT' });
    }
    for (const protocol of ['openai-responses', 'anthropic-messages']) {
      const configured = unwrap(await pipeline.saveProfile({ name: protocol, protocol, provider: 'tester', modelId: 'tester-local', baseUrl: server.baseUrl, keyAction: 'replace', apiKey: 'tester-local-secret' }));
      const id = configured.profiles.find(item => item.protocol === protocol).id;
      const probe = unwrap(await pipeline.testConnection({ profileId: id })); assert.equal(probe.status, 'success');
      unwrap(await pipeline.setDefaultProfile({ profileId: id })); unwrap(await select(rootB)); mode = 'chat'; candidate = null; await send('real protocol discussion ' + protocol);
      assert.ok((await read()).history.messages.at(-1).text.includes('OK'));
    }
    scenarios.push('three installed public Pi protocols through real HTTP and sessions');
    unwrap(await pipeline.setDefaultProfile({ profileId })); unwrap(await select(rootA));
    candidate = plan(profileId, ['blocked-a.txt', 'blocked-b.txt']); mode = 'plan'; await send('context revoke plan'); state = await read();
    mode = 'context-change'; contextChangeRoot = rootA; unwrap(await confirmExecution(pipeline, state));
    const invalid = await waitFor(read, value => value.plan?.status === 'invalidated', 'whole plan invalidation');
    await fs.writeFile(join(rootA, 'context.txt'), 'explicit-context-marker'); assert.equal((await pipeline.confirmPlan({ projectId: idA, planDigest: state.plan.planDigest })).ok, false);
    assert.equal(invalid.tasks[1].status, 'blocked'); for (const file of ['blocked-a.txt', 'blocked-b.txt']) await assert.rejects(fs.stat(join(rootA, file)), { code: 'ENOENT' });
    scenarios.push('write-time context change permanently revokes whole plan');
    candidate = plan(profileId, ['missing.txt']); mode = 'plan'; await send('missing output plan'); state = await read(); mode = 'missing';
    unwrap(await confirmExecution(pipeline, state));
    const missing = await waitFor(read, value => value.plan?.status === 'failed', 'missing outputs'); assert.equal(missing.tasks[0].error.code, 'task_outputs_missing'); assert.equal(missing.tasks[0].checkStatus, 'not_executed');
    scenarios.push('tool-less worker completion cannot fabricate target or software check');
    candidate = plan(profileId, ['late.txt']); mode = 'plan'; await send('stop plan'); state = await read(); mode = 'worker-hang'; held = null;
    unwrap(await confirmExecution(pipeline, state)); await waitFor(async () => held, Boolean, 'held real worker');
    const stopping = pipeline.stopExecution({ projectId: idA }); replyText(held, '', { resource: 'late.txt', content: 'late forbidden' }); unwrap(await stopping);
    await assert.rejects(fs.stat(join(rootA, 'late.txt')), { code: 'ENOENT' }); assert.equal((await pipeline.confirmPlan({ projectId: idA, planDigest: state.plan.planDigest })).ok, false);
    candidate = plan(profileId, ['close.txt']); mode = 'plan'; await send('close plan'); state = await read();
    const confirming = confirmExecution(pipeline, state); const closing = pipeline.close();
    assert.equal((await confirming).ok, false); unwrap(await closing); unwrap(await pipeline.close());
    await assert.rejects(fs.stat(join(rootA, 'close.txt')), { code: 'ENOENT' });
    scenarios.push('immediate stop/close revoke; repeated close finishes');
    const requests = server.calls.length; pipeline = createWorkbenchPipeline({ userDataDir: userData,leaseRoot:fixtureLeaseRoot(userData) }); state = unwrap(await select(rootA));
    assert.equal(state.turn, null); assert.equal(server.calls.length, requests); assert.ok(state.history.messages.length > 0);
    assert.equal((await pipeline.confirmPlan({ projectId: idA, planDigest: state.plan.planDigest })).ok, false);
    const settings = await fs.readFile(join(userData, 'desktop-settings.json'), 'utf8'); assert.ok(!settings.includes('tester-local-secret')); assert.ok(state.profiles.every(item => !Object.hasOwn(item, 'apiKey')));
    scenarios.push('real safeStorage encrypted settings/history restore without keys/grants/model calls');
    for (const kind of ['mutation_intent', 'mutation_success']) {
      const faultRoot = join(location, kind); await fs.mkdir(faultRoot); unwrap(await select(faultRoot));
      candidate = plan(profileId, ['business/nested.txt', 'later.txt']); mode = 'plan'; await send('audit fault plan'); const staged = await read();
      const originalOpen = fs.open;
      fs.open = async function (path, ...args) {
        const handle = await originalOpen.call(this, path, ...args);
        if (String(path).includes('.ans') && String(path).endsWith('.jsonl')) {
          const write = handle.writeFile.bind(handle);
          handle.writeFile = async function (data, ...options) { if (String(data).includes('"kind":"' + kind + '"')) { const error = new Error('controlled audit fault'); error.code = 'EIO'; throw error; } return write(data, ...options); };
        }
        return handle;
      };
      try {
        unwrap(await confirmExecution(pipeline, staged));
        const failed = await waitFor(read, value => value.plan?.status === 'invalidated', 'actual audit failure');
        const result = failed.tasks[0].results[0]; assert.equal(result.auditFailed, true);
        assert.equal(result.observedMutation, kind === 'mutation_success'); assert.equal(failed.tasks[1].status, 'blocked');
        if (kind === 'mutation_intent') await assert.rejects(fs.stat(join(faultRoot, 'business')), { code: 'ENOENT' });
        else assert.equal(await fs.readFile(join(faultRoot, 'business/nested.txt'), 'utf8'), 'actual tester write');
        await assert.rejects(fs.stat(join(faultRoot, 'later.txt')), { code: 'ENOENT' });
      } finally { fs.open = originalOpen; }
    }
    scenarios.push('intent audit failure zero business mutation; commit audit failure honest observedMutation and stop');
    state = unwrap(await select(rootA));
    assert.equal(state.fileOwners.owners.find(item => item.resource === 'result.txt').roleId, 'Writer');
    const savedOwnerVersion = state.fileOwners.version;
    const failedPlan = async (label) => {
      unwrap(await pipeline.sendMessage({ projectId: idA, roleId: 'Supervisor', text: label }));
      return await waitFor(read, value => value.turn?.status === 'failed', label);
    };
    candidate = plan(profileId, ['result.txt', 'RESULT.TXT']);
    candidate.roles.push({ id: 'Other', name: 'Other', purpose: 'Separate owner', profileId });
    candidate.tasks[1].roleId = 'Other';
    mode = 'plan';await assert.rejects(prepareCandidate(candidate,selectedRoot,userData),{code:'file_owned_by_other_role'});assert.equal((await read()).fileOwners.version,savedOwnerVersion);assert.equal(await fs.readFile(join(rootA,'result.txt'),'utf8'),'actual tester write');
    candidate = plan(profileId, ['duplicate.txt', 'duplicate.txt']);
    await send('stage same-owner tasks for serialized execution');const unordered=await read();assert.equal(unordered.plan.status,'draft');
    candidate.tasks[1].dependsOn = ['task0']; await send('accept explicit same-role dependency'); state = await read();
    assert.equal(state.plan.status, 'draft'); assert.equal(state.plan.tasks[1].dependsOn[0], 'task0');
    mode = 'missing'; unwrap(await confirmExecution(pipeline, state));
    await waitFor(read, value => value.plan?.status === 'failed', 'dependent task no output');
    assert.equal((await read()).fileOwners.owners.find(item => item.resource === 'duplicate.txt').roleId, 'Writer');
    scenarios.push('cross-role owner alias rejected before approval; same-role dependency remains supported');
    const transfer = plan(profileId, ['result.txt']); transfer.roles[0] = { id: 'Other', name: 'Other', purpose: 'Transferred owner', profileId };
    transfer.tasks[0].roleId = 'Other'; transfer.transfers = [{ resource: 'result.txt', fromRoleId: 'Writer', toRoleId: 'Other' }];
    candidate = transfer; mode = 'plan'; await send('stage explicit transfer in first instance'); const staleDraft = await read();
    assert.equal(staleDraft.plan.fileOwnership.transfers[0].toRoleId, 'Other');
    assert.equal(staleDraft.fileOwners.owners.find(item => item.resource === 'result.txt').roleId, 'Writer');
    const rival = createWorkbenchPipeline({ userDataDir: userData,leaseRoot:fixtureLeaseRoot(userData) });
    try {
      const rivalState = unwrap(await rival.selectProject(rootA));
      candidate = plan(profileId, ['rival.txt']);candidate.roles.push({...transfer.roles[0]});candidate.transfers=transfer.transfers; mode = 'plan'; await prepare();
      const rivalStart=await rival.sendMessage({ projectId: rivalState.currentProject.id, roleId: 'Supervisor', text: 'advance owner version in rival instance' });
      if(!rivalStart.ok){const stored=JSON.parse(await fs.readFile(join(userData,'workbench-organization',idA+'.json'),'utf8'));await fs.writeFile(join(evidenceDirectory,'rival-timeline-refusal.json'),JSON.stringify({rivalStart,governedPromptCharacters:JSON.stringify(governedDTO(stored)).length,governed:governedDTO(stored),timeline:stored.timeline,queue:stored.queue},null,2));}
      unwrap(rivalStart);
      const stored=JSON.parse(await fs.readFile(join(userData,'workbench-organization',idA+'.json'),'utf8'));assert.ok(JSON.stringify(governedDTO(stored)).length>65536,'real complete journal exceeds model input limit');const actualPrompt=messageText(managerCall().body.messages.findLast(item=>item.role==='user'));assert.ok(actualPrompt.length<=65536,'current model prompt remains bounded');assert.ok(actualPrompt.includes('historyOmitted'));
      const rivalDraft = await waitFor(async () => unwrap(await rival.getState()), value => value.turn?.status === 'completed' && value.plan?.status === 'draft' && value.plan.tasks.find(task=>task.id==='task0')?.instruction === 'Write exactly rival.txt', 'rival draft');
      mode = 'missing'; unwrap(await confirmExecution(rival, rivalDraft));
      await waitFor(async () => unwrap(await rival.getState()), value => value.plan?.status === 'failed', 'rival task settled');
      unwrap(await rival.close());const stale = await confirmExecution(pipeline, staleDraft);
      assert.equal(stale.ok, false); assert.equal(stale.error.code, 'stale_file_owners');
      assert.equal(await fs.readFile(join(rootA, 'result.txt'), 'utf8'), 'actual tester write');
    } finally { unwrap(await rival.close()); }
    scenarios.push('rival instance owner-version update makes older Human confirmation stale');
    unwrap(await pipeline.close()); pipeline = createWorkbenchPipeline({ userDataDir: userData,leaseRoot:fixtureLeaseRoot(userData) }); unwrap(await select(rootA));
    candidate = transfer; mode = 'plan'; await send('confirm explicit transfer after refreshing owner'); state = await read();
    assert.equal(state.plan.fileOwnership.transfers.length,0,'rival Human confirmation already committed persistent ownership');
    assert.equal(state.fileOwners.owners.find(item => item.resource === 'result.txt').roleId, 'Other');
    mode = 'owner-edit'; unwrap(await confirmExecution(pipeline, state));
    const editedState = await waitFor(read, value => value.plan?.status === 'completed', 'transferred Agent edit');
    const finalText = 'actual new owner write';
    assert.equal(await fs.readFile(join(rootA, 'result.txt'), 'utf8'), finalText);
    assert.equal(editedState.fileOwners.owners.find(item => item.resource === 'result.txt').roleId, 'Other');
    assert.equal(editedState.tasks[0].results[0].action, 'edit_file');
    assert.equal(editedState.tasks[0].results[0].contentDigest, sha(Buffer.from(finalText)));
    assert.equal((await confirmExecution(pipeline, staleDraft)).ok, false);
    scenarios.push('Human transfer persists new owner; task Agent reads SHA and edits exact file with final digest');
    // This supported-format reader fixture is test data, never project authorization.
    // Current development governance pins intentionally differ from the frozen legacy GUI format.
    const observerRoot=await ownedDirectory('fixtures','large-record-observer-');
    const put=async(path,bytes)=>{await fs.mkdir(dirname(join(observerRoot,path)),{recursive:true});await fs.writeFile(join(observerRoot,path),bytes);};
    const orgText=await fs.readFile(join(projectRoot,'.ans/organization/current.yaml'),'utf8');
    const ids=[...orgText.matchAll(/\{id: ([A-Za-z0-9_.-]+)/gu)].map(match=>match[1]);
    await put('.ans/project.yaml',await fs.readFile(join(projectRoot,'.ans/project.yaml')));await put('.ans/organization/current.yaml',orgText);
    for(const id of ids){for(const file of ['role.yaml','role-card.md'])await put('.ans/roles/'+id+'/'+file,await fs.readFile(join(projectRoot,'.ans/roles',id,file)));await put('.ans/roles/'+id+'/boundary.yaml','schema_version: 1\nrole_id: '+id+'\nstatus: ACCEPTED\nversion: legion-desktop-workbench-v2\nwrite_scope: []\n');await put('.ans/roles/'+id+'/boundary.md','# Section 1: Synthetic read-only observer input\n\n| Type | Path | Purpose |\n| --- | --- | --- |\n');}
    for(const path of ['.ans/events/index.jsonl','.ans/events/2026-10-07.jsonl'])await put(path,await fs.readFile(join(projectRoot,path)));
    const recordPath='docs/scheduling/legion-cli-role-owned-v2-schema-repair-integration.md';const recordBytes=await fs.readFile(join(projectRoot,recordPath));assert.ok(recordBytes.length>1048576);await put(recordPath,recordBytes);const recordHash=sha(recordBytes);assert.equal(sha(await fs.readFile(join(observerRoot,recordPath))),recordHash);
    const observer = createWorkspaceService({ workspaceRoot: observerRoot });
    try {
      const observation = unwrap(await observer.observe({ force: true }));assert.equal(observation.status,'available');assert.deepEqual(observation.errors,[]);
      const source=observation.sources.find(item=>item.relativePath===recordPath);assert.ok(source);assert.equal(source.status,'available');assert.ok(source.verifiedAt);assert.equal(source.cached,false);
      assert.ok(observation.audits.some(event=>event.format==='governance'));assert.ok(observation.audits.every(event=>event.format==='governance'));assert.ok(observation.tasks.some(task=>task.taskId==='legion-cli-role-owned-v2-schema-repair-integration'));
      assert.ok(observation.observedAt);assert.ok(observation.sources.every(item=>item.readAt));assert.equal(sha(await fs.readFile(join(observerRoot,recordPath))),recordHash);assert.deepEqual(await fs.readFile(join(observerRoot,recordPath)),recordBytes);
      await fs.writeFile(join(evidenceDirectory,'large-record.json'),JSON.stringify({path:recordPath,byteLength:recordBytes.length,sha256:recordHash,verifiedAt:source.verifiedAt,readAt:source.readAt,taskCount:observation.tasks.length,governanceAuditCount:observation.audits.length}));
    } finally { unwrap(observer.close());await removeOwned(observerRoot,join(generated,'fixtures')); }
    scenarios.push('actual over-1MiB current records verified in full; governance records separate from runtime mirror');
    return { scenarios, realSdkPrompts: prompts.length, localhostRequests: server.calls.length, workerRequests: workerCalls, paidRequests: 0 };
  } finally { if (pipeline) unwrap(await pipeline.close()); if (server) await server.close(); AgentSession.prototype.prompt = originalPrompt; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && !process.versions.electron) {
  test('real Electron public Workbench/Pi flows preserve discussion isolation and confirmed execution', { timeout: 110000 }, async () => {
    assert.ok(['win32', 'darwin'].includes(process.platform), 'tested Electron desktop platform');
    const location = await ownedDirectory('fixtures', 'public-flow-'); const userData = await ownedDirectory('user-data', 'public-flow-'); await guard(join(generated, 'tmp'), true);
    const proofDirectory=await ownedDirectory('evidence','public-flow-proof-');const proof = join(proofDirectory, 'public-flow-proof.json');
    const harness = join(location, 'electron-flow.mjs');
    await fs.writeFile(harness, `import {app} from 'electron';\nimport {runPublicFlows} from ${JSON.stringify(import.meta.url)};\nimport {writeFile} from 'node:fs/promises';\napp.setPath('userData',${JSON.stringify(userData)});app.setPath('sessionData',${JSON.stringify(userData)});app.setAppLogsPath(${JSON.stringify(join(userData,'logs'))});\napp.whenReady().then(()=>runPublicFlows(${JSON.stringify(location)},${JSON.stringify(userData)})).then(async value=>{await writeFile(${JSON.stringify(proof)},JSON.stringify(value));app.exit(0)}).catch(error=>{console.error(error);app.exit(1)});\n`);
    try {
      let executable = join(projectRoot, 'apps/desktop/node_modules/electron/dist/electron.exe');
      if (process.platform === 'darwin') executable = join(projectRoot, 'apps/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
      const child = spawn(executable, [harness], { cwd: join(projectRoot, 'apps/desktop'), env: environment(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      let output = ''; child.stdout.on('data', bytes => { output += bytes; }); child.stderr.on('data', bytes => { output += bytes; });
      const deadline = setTimeout(() => child.kill(), 105000);
      const code = await new Promise((done, reject) => { child.once('error', reject); child.once('exit', done); }); clearTimeout(deadline);
      assert.equal(code, 0, output); const result = JSON.parse(await fs.readFile(proof, 'utf8')); assert.equal(result.scenarios.length, 14); assert.ok(result.realSdkPrompts >= 20); assert.equal(result.paidRequests, 0);
    } finally { await removeOwned(location, join(generated, 'fixtures')); await removeOwned(userData, join(generated, 'user-data')); }
  });
}
