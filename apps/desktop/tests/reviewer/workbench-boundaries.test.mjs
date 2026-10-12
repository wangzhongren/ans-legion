/** Independent finite v2 review: real public SDK over controlled localhost; no paid models. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { join, resolve, dirname, relative, sep, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import * as models from 'legion-runtime/workbench-models';
import { WorkbenchPipelineImpl, createWorkbenchPipeline } from '../../src/pipelines/workbench.mjs';
import { ProfilesServiceImpl } from '../../src/services/impl/profiles.mjs';
import { ProjectServiceImpl } from '../../src/services/impl/project.mjs';
import { ProjectProviderImpl } from '../../src/providers/impl/project.mjs';
import { SettingsProviderImpl } from '../../src/providers/impl/settings.mjs';
import { createProbeProvider } from '../../src/providers/public/probe.mjs';
import { createOrganizationService } from '../../src/services/public/organization.mjs';
import { createProjectService } from '../../src/services/public/project.mjs';
import { FIXED_ROLE_DUTIES } from '../../src/models/organization.mjs';
import { workbenchInput, workbenchDTO, taskState } from '../../src/models/workbench.mjs';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const role = process.env.LEGION_DESKTOP_TEST_ROLE ?? 'Reviewer';
assert.ok(['DesktopEngineer', 'ProjectManager', 'Reviewer', 'Tester'].includes(role));
let roleDirectory = role;

const base = join(project, '.ans/runtime/legion-desktop-command-center-v1', roleDirectory);
delete process.env.NODE_OPTIONS;
delete process.env.NODE_COMPILE_CACHE;
process.env.NODE_DISABLE_COMPILE_CACHE = '1';
process.env.TEMP = join(base, 'tmp');
process.env.TMP = join(base, 'tmp');

async function guard(path) {
  let current = resolve(path);
  for (;;) {
    const metadata = await fs.lstat(current);
    assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink(), 'unsafe fixture ancestor');
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
async function directory(t, name) {
  await guard(project);
  let current = project;
  for (const part of relative(project, join(base, name)).split(sep)) {
    current = join(current, part);
    try { await fs.mkdir(current); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    await guard(current);
  }
  const parent = current;
  const path = await fs.mkdtemp(join(parent, 'review-workbench-'));
  t.after(async () => {
    const child = relative(parent, path);
    assert.ok(child.startsWith('review-workbench-') && !child.includes(sep) && !isAbsolute(child));
    await guard(path);
    async function children(root) {
      for (const entry of await fs.readdir(root, { withFileTypes: true })) {
        const target = join(root, entry.name);
        assert.ok(!(await fs.lstat(target)).isSymbolicLink(), 'unsafe fixture cleanup child');
        if (entry.isDirectory()) await children(target);
      }
    }
    await children(path);
    await fs.rm(path, { recursive: true });
  });
  return path;
}
function encryption() {
  // Test-local lower infrastructure stand-in; native DPAPI is covered by retained Desktop test.
  const key = randomBytes(32);
  return {
    isEncryptionAvailable: () => true,
    encryptString(text) {
      const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, cipher.update(text), cipher.final(), cipher.getAuthTag()]);
    },
    decryptString(bytes) {
      const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(-16));
      return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString('utf8');
    }
  };
}
const organizationsByProfile = new Map();
function complete(reply, text, tool = null, toolName = 'legion_write_file', toolId = 'review-call') {
  if (reply.destroyed) return;
  const body = reply.reviewBody;
  const names = (body?.tools ?? []).map((item) => item.function.name);
  const results = (body?.messages ?? []).filter((item) => item.role === 'tool').map((item) => { try { return JSON.parse(item.content); } catch { return {}; } });
  if (!tool && !names.includes('legion_design_roles') && names.includes('legion_run_check') && results.some((item) => item.result?.success) && !results.some((item) => item.result?.checkId)) {
    return complete(reply, '', { checkId: 'unit' }, 'legion_run_check', 'review-check');
  }
  reply.writeHead(200, { 'content-type': 'text/event-stream' });
  let delta = { role: 'assistant', content: text }; let finish = 'stop';
  if (tool) {
    delta = { role: 'assistant', tool_calls: [{ index: 0, id: toolId, type: 'function',
      function: { name: toolName, arguments: JSON.stringify(tool) } }] };
    finish = 'tool_calls';
  }
  for (const [payload, reason] of [[delta, null], [{}, finish]]) {
    reply.write('data: ' + JSON.stringify({ id: 'review', object: 'chat.completion.chunk', model: 'local',
      choices: [{ index: 0, delta: payload, finish_reason: reason }] }) + '\n\n');
  }
  reply.end('data: [DONE]\n\n');
}
function readOnlyManagerCall(call) {
  const names = (call.body.tools ?? []).map((tool) => tool.function.name).sort();
  if(names.includes('legion_delegate_pm')){assert.deepEqual(names,['legion_delegate_pm','legion_list_files','legion_query_memory','legion_query_role_activity','legion_query_role_log','legion_read_file','legion_remember_fact','legion_request_interaction']);return true;}
  if(names.includes('legion_submit_supervision')){assert.deepEqual(names,['legion_list_files','legion_query_memory','legion_query_role_activity','legion_query_role_log','legion_read_file','legion_remember_fact','legion_submit_supervision']);return true;}
  if (names.includes('legion_design_roles')) {
    assert.deepEqual(names, ['legion_design_roles', 'legion_list_files', 'legion_read_file', 'legion_request_interaction', 'legion_request_repair', 'legion_review_roles','legion_remember_fact','legion_query_memory'].sort());
    return true;
  }
  assert.ok(names.includes('legion_run_check'));
  if (names.includes('legion_submit_acceptance')) assert.deepEqual(names, ['legion_list_files', 'legion_read_file', 'legion_request_shell', 'legion_run_check', 'legion_submit_acceptance','legion_remember_fact','legion_query_memory'].sort());
  else assert.deepEqual(names, ['legion_edit_file', 'legion_list_files', 'legion_read_file', 'legion_request_shell', 'legion_run_check', 'legion_write_file','legion_remember_fact','legion_query_memory'].sort());
  return false;
}
async function fixture(t, handler, directCustomer = false, legacyHistory = null) {
  let pipeline; let server;
  const sockets = new Set(); const errors = [];
  t.after(async () => {
    if (pipeline) await pipeline.close();
    for (const socket of sockets) socket.destroy();
    if (server) await new Promise((done, reject) => server.close((error) => { if (error) reject(error); else done(); }));
    assert.deepEqual(errors, [], 'controlled server assertions');
  });
  const location = await directory(t, 'fixtures');
  const data = await directory(t, 'user-data');
  await directory(t, 'tmp');
  const root = join(location, 'customer'); await fs.mkdir(root);
  const calls = [];
  server = createServer(async (request, reply) => {
    try {
      let raw = ''; for await (const chunk of request) raw += chunk;
      const call = { body: JSON.parse(raw), authorization: request.headers.authorization };
      calls.push(call); reply.reviewBody = call.body;
      if((call.body.tools??[]).some(item=>item.function.name==='legion_delegate_pm')&&!directCustomer){
        const names=call.body.tools.map(item=>item.function.name).sort();assert.deepEqual(names,['legion_delegate_pm','legion_list_files','legion_query_memory','legion_query_role_activity','legion_query_role_log','legion_read_file','legion_remember_fact','legion_request_interaction']);
        const results=call.body.messages.filter(item=>item.role==='tool').map(item=>JSON.parse(item.content));
        const currentText=call.body.messages.flatMap(item=>typeof item.content==='string'?[item.content]:Array.isArray(item.content)?item.content.map(part=>part.text??''):[]).join('\n');
        if(currentText.includes('review-query-while-running')){
          if(results.length===0)complete(reply,'',{payload:{}},'legion_query_role_activity','during-activity');
          else if(results.length===1){assert.ok(results[0].result.payload.tasks.some(task=>task.status==='running'));complete(reply,'',{payload:{action:'add',kind:'preference',statement:'Do not change current plan',sourceRefs:['human:unused'],expectedRevision:0}},'legion_remember_fact','during-remember');}
          else if(results.length===2){assert.equal(results.at(-1).result.reason,'execution_busy');complete(reply,'',{payload:{kind:'question',purpose:'discussion',title:'must not be created',text:'business-changing request',options:[],allowSupplement:false}},'legion_request_interaction','during-question');}
          else if(results.length===3){assert.equal(results.at(-1).result.reason,'execution_busy');complete(reply,'',{payload:{action:'start',purpose:'plan',instruction:'must not change plan',sourceRefs:['human:unused']}},'legion_delegate_pm','during-delegate');}
          else{assert.equal(results.at(-1).result.reason,'execution_busy');complete(reply,'Verified read-only progress');}
        } else if(results.some(item=>item.result?.payload?.delegationId))complete(reply,'Su reports actual PM result');
        else{const strings=call.body.messages.flatMap(item=>typeof item.content==='string'?[item.content]:Array.isArray(item.content)?item.content.map(part=>part.text??''):[]).join('\n');const ref=[...strings.matchAll(/human:[A-Za-z0-9_.-]+/gu)].at(-1)?.[0];assert.ok(ref);complete(reply,'',{payload:{action:'start',purpose:'plan',instruction:'Prepare exact requested plan',sourceRefs:[ref]}},'legion_delegate_pm','su-delegate');}
      } else if ((call.body.tools ?? []).some(item=>item.function.name==='legion_submit_supervision')) {
        const names=call.body.tools.map(item=>item.function.name).sort();assert.deepEqual(names,['legion_list_files','legion_query_memory','legion_query_role_activity','legion_query_role_log','legion_read_file','legion_remember_fact','legion_submit_supervision']);
        if(call.body.messages.some(item=>item.role==='tool'))complete(reply,'Typed suggestion recorded');
        else {const strings=call.body.messages.flatMap(item=>typeof item.content==='string'?[item.content]:Array.isArray(item.content)?item.content.map(part=>part.text??''):[]);const prompt=strings.findLast(text=>text.includes('监督输入：'));assert.ok(prompt);const current=JSON.parse(prompt.split('监督输入：').at(-1).split('\n')[0]);assert.ok(['preflight','monitor'].includes(current.phase));complete(reply,'',{payload:{phase:current.phase,planDigest:current.planDigest,findings:[],recommendation:'proceed'}},'legion_submit_supervision','review-supervision');}
      } else if ((call.body.tools ?? []).some((item) => item.function.name === 'legion_submit_acceptance')) {
        const results = call.body.messages.filter((item) => item.role === 'tool').map((item) => JSON.parse(item.content));
        const checked = results.find((item) => item.result?.checkId);
        if (!checked) complete(reply, '', { checkId: 'unit' }, 'legion_run_check', 'acceptance-check');
        else if (!results.some((item) => item.result?.payload?.acceptance)) complete(reply, '', { payload: { taskId: 'acceptance', evidenceIds: [checked.result.requestId], decision: 'pass', issues: [] } }, 'legion_submit_acceptance', 'acceptance-submit');
        else complete(reply, 'Actual independent acceptance recorded');
      } else await handler(call, reply, calls.length);
    } catch (error) { errors.push(error); reply.destroy(); }
  });
  server.on('connection', (socket) => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const crypto = encryption();
  const profiles = new ProfilesServiceImpl({ userDataDir: data }, {
    settings: new SettingsProviderImpl({ userDataDir: data }, async () => crypto),
    probe: createProbeProvider({ timeoutMs: 1000 })
  });
  const saved = await profiles.save({ name: 'Reviewer local', protocol: 'openai-completions', provider: 'review',
    modelId: 'custom-review-model', baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
    keyAction: 'replace', apiKey: 'review-local-secret' });
  assert.equal(saved.ok, true);
  let legacyPath=null,legacyBytes=null;
  if(legacyHistory){const W=await import('../../src/models/workbench.mjs'),stat=await fs.lstat(root,{bigint:true}),identity={canonicalPath:await fs.realpath(root),deviceId:String(stat.dev),fileId:String(stat.ino)},id=W.identityKey(identity);const {createHistoryService}=await import('../../src/services/public/history.mjs');const history=createHistoryService({userDataDir:data});try{assert.equal((await history.save({projectId:id,workspaceIdentity:identity,history:{messages:legacyHistory}})).ok,true);}finally{await history.close();}legacyPath=join(data,'workbench-history',id+'.json');legacyBytes=await fs.readFile(legacyPath);}
  pipeline = new WorkbenchPipelineImpl({ userDataDir: data,leaseRoot:join(location,'leases') }, { profiles });
  const selected = await pipeline.selectProject(root); assert.equal(selected.ok, true);
  const id = selected.value.currentProject.id;
  assert.deepEqual(selected.value.roles.map((item) => item.id), ['Acceptance', 'ProjectManager', 'RoleArchitect','Supervisor']); assert.equal(calls.length, 0);
  assert.equal((await pipeline.setDefaultProfile({ profileId: saved.value.id })).ok, true);
  await fs.mkdir(join(root, 'tests/Acceptance'), { recursive: true });
  await fs.writeFile(join(root, 'package.json'), '{"type":"module"}');
  await fs.writeFile(join(root, 'tests/Acceptance/output.test.mjs'), "import test from 'node:test';import assert from 'node:assert/strict';import {existsSync} from 'node:fs';test('authorized output exists',()=>assert.equal(existsSync('a.txt'),true));");
  const projects = createProjectService({ userDataDir: data }); const raw = (await projects.catalog()).value.projects.find((item) => item.id === id);
  const organizations = createOrganizationService({ userDataDir: data });
  try {
    let state = await organizations.load(raw);
    const members = [{ id: 'Worker', name: 'Worker', purpose: 'Exact implementation', revision: 1, boundary: ['a.txt', 'b.txt'] },
      { id: 'Acceptance', name: 'Acceptance', purpose: FIXED_ROLE_DUTIES.Acceptance, revision: 2, boundary: [] }].map((item) => ({ ...item, interfaces: [], documents: [], enabled: true, status: 'approved' }));
    state = await organizations.submitProposal(raw, { id: 'review-roles', version: 1, members }, { projectId: id, roleId: 'RoleArchitect', instanceId: 'architect' });
    const proposal = state.ledger.proposals.at(-1);
    state = await organizations.reviewProposal(raw, { proposalId: proposal.id, version: 1, digest: proposal.digest, organizationRevision: state.organization.revision,
      organizationDigest: state.organization.digest, decision: 'approve', reason: '' }, { projectId: id, roleId: 'ProjectManager', instanceId: 'manager' });
    organizationsByProfile.set(saved.value.id, state.organization);
  } finally { await organizations.close(); await projects.close(); }
  return { root, data, location, pipeline, profiles, id, profileId: saved.value.id, calls, crypto, errors,legacyPath,legacyBytes };
}
function plan(profileId, two = false) {
  let names = ['a']; if (two) names = ['a', 'b'];
  const organization = organizationsByProfile.get(profileId);
  const spec = { checkId: 'unit', kind: 'node-test', argv: ['--test', 'tests/Acceptance/output.test.mjs'], testResources: ['tests/Acceptance/output.test.mjs'],
    inputResources: ['tests/Acceptance/output.test.mjs', 'package.json', ...names.map((id) => id + '.txt')], outputResources: [], timeoutSeconds: 10, network: 'none', logMaxBytes: 8192 };
  const roles = organization.members.filter((item) => ['Worker', 'Acceptance'].includes(item.id)).map(({ id, name, purpose, revision, digest }) => ({ id, name, purpose, revision, digest, profileId }));
  return { goal: 'Generate exact files', roles, governance: { organizationRevision: organization.revision, organizationDigest: organization.digest, maxRepairRounds: 2 },
    schemaVersion:2, tasks: [...names.map((id) => ({ id, title: id, roleId: 'Worker', profileId, dependsOn: [], intent:'change', instruction: 'Write ' + id + '.txt', checks: [spec] })),
      { id: 'acceptance', title: 'Independent output check', roleId: 'Acceptance', profileId, dependsOn: names, accepts: names, intent:'verify', instruction: 'Run exact current check and submit acceptance', checks: [spec] }] };
}
async function confirm(f, staged) {
  const request = staged.interactions.find((item) => item.purpose === 'execute_plan' && item.status === 'pending');
  assert.ok(request, 'real current execution request');
  return f.pipeline.answerInteraction({ projectId: f.id, requestId: request.requestId, version: request.version, requestDigest: request.digest, value: true });
}
function planText(candidate) { return '```legion-plan\n' + JSON.stringify(candidate) + '\n```'; }
async function until(pipeline, predicate) {
  for (let count = 0; count < 250; count += 1) {
    const state = await pipeline.getState(); assert.equal(state.ok, true);
    if (predicate(state.value)) return state.value;
    await delay(10);
  }
  const final=await pipeline.getState(); assert.fail('bounded workbench condition not reached '+JSON.stringify(final));
}
async function untilPrivateDomain(f,predicate){for(let i=0;i<220;i++){const domain=JSON.parse(await fs.readFile(join(f.data,'workbench-organization',f.id+'.json'),'utf8'));if(predicate(domain))return domain;await delay(10);}assert.fail('bounded private fixture condition not reached');}
async function draft(f, expectPlan = true) {
  assert.equal((await f.pipeline.sendMessage({ projectId: f.id, roleId: 'Supervisor', text: 'Prepare exact plan' })).ok, true);
  return until(f.pipeline, (state) => state.turn?.status === 'completed' && (!expectPlan || state.plan?.status === 'draft'));
}

test('two desktop project services cannot both claim the same stale owner version', async (t) => {
  const location = await directory(t, 'fixtures');
  const data = await directory(t, 'user-data');
  const root = join(location, 'owner-cas'); await fs.mkdir(root);
  const initial = new ProjectServiceImpl({ userDataDir: data,leaseRoot:join(location,'leases') });
  const selected = await initial.select(root);
  assert.equal(selected.ok, true);
  await initial.close();
  let reads = 0; let release;
  const bothRead = new Promise((done) => { release = done; });
  function separateService() {
    const provider = new ProjectProviderImpl({ userDataDir: data,leaseRoot:join(location,'leases') });
    const intercepted = {
      read: async () => {
        const result = await provider.read();
        reads += 1;
        if (reads === 2) release();
        await bothRead;
        return result;
      },
      write: (...args) => provider.write(...args),
      close: () => provider.close()
    };
    return new ProjectServiceImpl({ userDataDir: data,leaseRoot:join(location,'leases') }, intercepted);
  }
  const left = separateService(); const right = separateService();
  try {
    const current = selected.value;
    const next = (version, roleId) => ({ ...current, fileOwners: { projectId: current.id,
      version, owners: [{ resource: 'src/shared.ts', roleId }] } });
    const [backend, frontend] = await Promise.all([
      left.saveProject(next('1', 'Backend'), { expectedFileOwnersDigest: current.fileOwners.digest }),
      right.saveProject(next('1', 'Frontend'), { expectedFileOwnersDigest: current.fileOwners.digest })
    ]);
    assert.equal(reads, 2);
    assert.equal([backend, frontend].filter((result) => result.ok).length, 1,
      'only one persistent compare-and-swap may accept the old owner version');
    const denied = [backend, frontend].find((result) => !result.ok);
    assert.ok(['lease_busy','stale_file_owners'].includes(denied.error.code));
    const persistedProvider = new ProjectProviderImpl({ userDataDir: data,leaseRoot:join(location,'leases') });
    try {
      const persisted = await persistedProvider.read();
      assert.equal(persisted.ok, true);
      const winner = backend.ok ? 'Backend' : 'Frontend';
      assert.equal(persisted.value.projects[0].fileOwners.ownerOf('src/shared.ts'), winner);
    } finally { persistedProvider.close(); }
  } finally { await left.close(); await right.close(); }
});

test('public pure authority brands reject forged reads, preserve approvals and permanently revoke whole authority', () => {
  const { createWorkbenchAuthority, ContextReadConfirmation, ContextSnapshot, ConfirmedTaskGrant,
    AgentSession, RoleBoundary, AgentScope, TaskDispatchContext, ActionProposal, PolicyDecision, Outcome } = models;
  assert.equal(Object.keys(models).length, 64);assert.equal(typeof models.PiImageReference,'function');assert.equal(typeof models.PiImageInput,'function');
  assert.equal(Object.hasOwn(models, '_createRuntimeAuthority'), false);
  for (const requiredApprovals of [[], ['write_file'], ['A.TXT']]) {
    const workspaceIdentity = { canonicalPath: 'D:/review-fixture', deviceId: '1', fileId: '2' };
    const boundary = new RoleBoundary({ roleId: 'Worker', writeScope: ['a.txt'], tools: ['legion_write_file'], capabilities: ['write_file'], requiredApprovals });
    const owners=new models.ProjectFileOwners({projectId:'review',version:'1',owners:[{resource:'a.txt',roleId:'Worker'}]});
    const f = createWorkbenchAuthority({fileOwners:owners, workspaceIdentity, organizationVersion: 'v2', profileVersion: 'profile1', boundaries: [boundary] });
    const confirmation = new ContextReadConfirmation({ confirmationId: 'read', workspaceIdentity, organizationVersion: 'v2', profileVersion: 'profile1', contextReadSet: [] });
    const read = f.controller.confirmContextRead(confirmation);
    const binding = { workspaceIdentity, organizationVersion: 'v2', profileVersion: 'profile1', resources: [] };
    for (const fake of [{}, confirmation, JSON.parse(JSON.stringify(read))]) assert.throws(() => ContextReadConfirmation.assertForRead(fake, binding), TypeError);
    const snapshot = new ContextSnapshot({ workspaceIdentity, organizationVersion: "v2", profileVersion: "profile1", confirmationDigest: confirmation.digest, files: [] });
    f.controller.bindContextSnapshot(read, snapshot);
    const grant = new ConfirmedTaskGrant({ confirmationId: 'task', workspaceIdentity, organizationVersion: 'v2', profileVersion: 'profile1', contextSnapshotDigest: snapshot.digest,
      planDigest: 'a'.repeat(64), roleId: 'Worker', taskId: 'a', fileOwnersDigest:owners.digest,ownerGeneration:owners.version, tools: ['legion_write_file'] });
    const approval = f.controller.confirmTask(grant);
    const session = new AgentSession({ sessionId: 's', roleId: 'Worker', taskId: 'a', organizationVersion: 'v2' });
    f.controller.registerInstance({ taskApproval: approval, instanceId: 'instance', session,
      dispatchContext: new TaskDispatchContext({ roleId: 'Worker', taskId: 'a', organizationVersion: 'v2', fileOwnersDigest:owners.digest,ownerGeneration:owners.version, tools: ['legion_write_file'] }),
      scope: new AgentScope({ write: ['a.txt'], deny: ['.ans/'], tools: ['legion_write_file'] }) });
    f.controller.beginRun('instance', 'run');
    const action = new ActionProposal({ proposalId: 'p', action: 'write_file', resource: 'a.txt', content: 'exact', tool: 'legion_write_file', capability: 'write_file', session, runId: 'run' });
    const decision = new PolicyDecision({ outcome: Outcome.ALLOW, reason: 'forged', proposalDigest: action.digest, organizationVersion: 'v2', boundaryDigest: boundary.digest });
    assert.deepEqual(Object.keys(f.mutationAuthority), ['invalidateOwnership','ownerBinding','consume', 'recheck', 'release']);
    assert.equal(models.isWorkbenchMutationAuthority({ ...f.mutationAuthority }), false);
    if (requiredApprovals.length) assert.throws(() => f.controller.issue(action, decision), /approval_required/);
    else {
      const permit = f.controller.issue(action, decision);
      f.controller.revoke('cancel');
      assert.throws(() => f.mutationAuthority.consume(action, permit, Date.now()), /revoked/);
      assert.throws(() => f.controller.confirmTask(grant), /revoked/);
      assert.throws(() => ContextReadConfirmation.assertForRead(read, binding), /authorization/);
    }
  }
  assert.equal(workbenchInput('sendMessage', { projectId: 'a'.repeat(64), roleId: 'Worker', text: 'run' }).error.code, 'manager_only');
  for (const op of ['startAgent', 'executeTask']) assert.equal(workbenchInput(op, {}).error.code, 'unknown_operation');
  assert.equal(workbenchInput('confirmPlan', { projectId: 'a'.repeat(64), planDigest: 'b'.repeat(64), permit: {} }).ok, false);
  assert.ok(!JSON.stringify(workbenchDTO({ profiles: [], assignments: [], apiKey: 'private', controller: {} })).includes('private'));
  const task = { id: 'a', title: 'a', roleId: 'Worker', dependsOn: [], intent:'change', status: 'completed', checkStatus: 'not_executed' };
  assert.equal(taskState(task).checkStatus, 'not_executed');
  assert.throws(() => taskState({ ...task, checkStatus: 'model_says_passed' }), /invalid_input/);
  assert.equal(taskState({ ...task, checkStatus: 'passed', evidenceIds: ['host-check'] }).checkStatus, 'passed');
});

test('Su delegates exact PM plan; legacy PM History bytes remain read-only across safe restart', async (t) => {
  let candidate; let discussions = 0;
  const f = await fixture(t, (call, reply) => {
    assert.equal(call.authorization, 'Bearer review-local-secret');
    if (readOnlyManagerCall(call)) { discussions += 1; let text = 'Clarify'; if (discussions === 2) text = planText(candidate); complete(reply, text); }
    else {
      if (call.body.messages.some((item) => item.role === 'tool')) complete(reply, 'Host result received');
      else complete(reply, '', { resource: 'a.txt', content: 'actual controlled write' }); }
  },false,[{role:'user',text:'Old PM Human text'},{role:'assistant',text:'private-old-PM-watermark'}]);
  candidate = plan(f.profileId);
  assert.equal((await f.pipeline.sendMessage({ projectId: f.id, roleId: 'Worker', text: 'start' })).error.code, 'manager_only');
  assert.equal(f.calls.length, 0);
  await draft(f, false); const staged = await draft(f);
  assert.equal(staged.history.messages.length, 4);
  assert.deepEqual(staged.roles.map((item) => item.id), ['Acceptance', 'ProjectManager', 'RoleArchitect','Supervisor', 'Worker']);
  assert.deepEqual((await fs.readdir(f.root)).sort(), ['package.json', 'tests']);
  assert.equal((await f.pipeline.confirmPlan({ projectId: f.id, planDigest: '0'.repeat(64) })).error.code, 'plan_changed');
  assert.equal((await confirm(f, staged)).ok, true);
  const done = await until(f.pipeline, (state) => state.plan?.status === 'completed');
  await until(f.pipeline,state=>state.roleMemory.entries.some(entry=>entry.channel==='supervision_monitor'));
  const domain=JSON.parse(await fs.readFile(join(f.data,'workbench-organization',f.id+'.json'),'utf8'));
  const su=domain.roleMemories.entries.find(entry=>entry.roleId==='Supervisor'&&entry.channel==='su_customer');assert.ok(su);assert.ok(!JSON.stringify(su).includes('Typed suggestion recorded'));assert.ok(!JSON.stringify(su).includes('private-old-PM-watermark'));
  for(const channel of ['supervision_preflight','supervision_monitor']){assert.ok(domain.memberConversations.runs.some(run=>run.roleId==='Supervisor'&&run.channel===channel));const memory=domain.roleMemories.entries.find(entry=>entry.roleId==='Supervisor'&&entry.channel===channel);assert.ok(memory);assert.ok(!JSON.stringify(memory).includes('Su reports actual PM result'));}
  assert.deepEqual(await fs.readFile(f.legacyPath),f.legacyBytes);
  assert.equal(done.tasks[0].checkStatus, 'passed'); assert.equal(done.tasks[0].results[0].observedMutation, true);
  assert.equal(done.tasks.find((task) => task.id === 'acceptance').acceptanceStatus, 'pass');
  assert.equal(await fs.readFile(join(f.root, 'a.txt'), 'utf8'), 'actual controlled write');
  const { _dispatchDesktopIpc }=await import('../../src/interface/main.mjs'),frame={url:'file:///reviewer/index.html'},window={isDestroyed:()=>false,webContents:{mainFrame:frame}},event={sender:window.webContents,senderFrame:frame};
  const queries={listProjectFiles:{projectId:f.id},readProjectFile:{projectId:f.id,resource:'a.txt'},queryRoleActivity:{projectId:f.id},queryRoleLog:{projectId:f.id,roleId:'Worker',limit:1},queryProjectFacts:{projectId:f.id,kind:'changes'},queryProjectOutputs:{projectId:f.id},queryProjectMemory:{projectId:f.id}};
  const inspected={};for(const [operation,input]of Object.entries(queries)){const result=await _dispatchDesktopIpc(event,window,frame.url,operation,input,f.pipeline);assert.equal(result.ok,true,operation+' '+JSON.stringify(result));inspected[operation]=result.value;}
  const checks=await _dispatchDesktopIpc(event,window,frame.url,'queryProjectFacts',{projectId:f.id,kind:'checks'},f.pipeline);assert.equal(checks.ok,true);assert.ok(checks.value.items.some(item=>item.executed&&item.status==='passed'&&item.sourceRef.startsWith('check:')));
  const accepts=await _dispatchDesktopIpc(event,window,frame.url,'queryProjectFacts',{projectId:f.id,kind:'acceptances'},f.pipeline);assert.equal(accepts.ok,true);assert.ok(accepts.value.items.some(item=>item.decision==='pass'&&item.sourceRef.startsWith('acceptance:')));
  assert.equal(inspected.readProjectFile.text,'actual controlled write');assert.ok(inspected.queryProjectFacts.items.some(item=>item.observedMutation&&item.sourceRef.startsWith('task-result:')));assert.ok(inspected.queryRoleActivity.tasks.some(task=>task.id==='a'&&task.status==='completed'));assert.ok(inspected.queryRoleLog.events.every(item=>!['assistant_text','host_briefing'].includes(item.kind)));assert.equal(done.memberConversations.runs.length,0);assert.equal(done.memberConversations.events.length,0);

  const events = (await fs.readFile(join(f.root, '.ans/events/index.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.ok(events.some((event) => event.kind === 'mutation_success'));
  assert.ok(events.every((event) => event.recordedAt.endsWith('+08:00')));
  assert.equal((await f.pipeline.confirmPlan({ projectId: f.id, planDigest: staged.plan.planDigest })).error.code, 'plan_changed');
  const history = await fs.readFile(join(f.data, 'workbench-organization', f.id + '.json'), 'utf8');
  for (const forbidden of ['review-local-secret', 'apiKey', 'controller', 'permit']) assert.equal(history.includes(forbidden), false);
  await f.pipeline.close(); const before = f.calls.length;
  const restarted = new WorkbenchPipelineImpl({ userDataDir: f.data,leaseRoot:join(f.location,'leases') },{profiles:new ProfilesServiceImpl({userDataDir:f.data},{settings:new SettingsProviderImpl({userDataDir:f.data},async()=>f.crypto),probe:createProbeProvider({timeoutMs:1000})})});
  try {
    const restored = await restarted.selectProject(f.root); assert.equal(restored.ok, true);
    assert.deepEqual(await fs.readFile(f.legacyPath),f.legacyBytes);assert.ok(!JSON.stringify(restored.value.history).includes('private-old-PM-watermark'));
    assert.deepEqual(restored.value.history.messages, done.history.messages); assert.equal(restored.value.turn, null);
    assert.equal(f.calls.length, before);
    assert.equal((await restarted.confirmPlan({ projectId: f.id, planDigest: staged.plan.planDigest })).error.code, 'plan_changed');
  } finally { await restarted.close(); }
});

test('write-time context change invalidates full plan; old bytes restoration cannot replay independent task grants', async (t) => {
  let candidate; let f; let changed = false;
  f = await fixture(t, async (call, reply) => {
    if (readOnlyManagerCall(call)) complete(reply, planText(candidate));
    else if (!call.body.messages.some((item) => item.role === 'tool')) {
      if (!changed) { changed = true; await fs.writeFile(join(f.root, 'context.txt'), 'changed'); }
      complete(reply, '', { resource: 'a.txt', content: 'must not commit' });
    } else complete(reply, 'denied');
  });
  candidate = plan(f.profileId, true); await fs.writeFile(join(f.root, 'context.txt'), 'original');
  assert.equal((await f.pipeline.selectContext({ projectId: f.id, resources: ['context.txt'] })).ok, true);
  const staged = await draft(f);
  assert.equal((await confirm(f, staged)).ok, true);
  const done = await until(f.pipeline, (state) => state.plan?.status === 'invalidated');
  await fs.writeFile(join(f.root, 'context.txt'), 'original');
  assert.equal((await f.pipeline.confirmPlan({ projectId: f.id, planDigest: staged.plan.planDigest })).error.code, 'plan_changed');
  assert.equal(done.tasks[1].status, 'blocked');
  assert.equal(f.calls.filter((item) => !readOnlyManagerCall(item)).length, 1);
  for (const name of ['a.txt', 'b.txt']) await assert.rejects(fs.stat(join(f.root, name)), { code: 'ENOENT' });
});

test('stop synchronously revokes before queued state read; late SDK write cannot commit', async (t) => {
  let candidate; let held;
  const f = await fixture(t, (call, reply) => { if (readOnlyManagerCall(call)) complete(reply, planText(candidate)); else held = reply; });
  candidate = plan(f.profileId); const staged = await draft(f);
  assert.equal((await confirm(f, staged)).ok, true);
  for (let i = 0; i < 250 && !held; i += 1) await delay(10);
  assert.ok(held);
  const before=(await f.pipeline.getState()).value;
  const read=await f.pipeline.readProjectFile({projectId:f.id,resource:'package.json'});assert.equal(read.ok,true);
  const memory=await f.pipeline.queryProjectMemory({projectId:f.id});assert.equal(memory.ok,true);
  assert.equal((await f.pipeline.sendMessage({projectId:f.id,roleId:'Supervisor',text:'review-query-while-running'})).ok,true);
  const after=await until(f.pipeline,state=>state.turn?.status==='completed'&&state.turn.text==='Verified read-only progress');assert.equal(after.plan.status,'running');assert.equal(after.plan.planDigest,before.plan.planDigest);assert.equal(after.fileOwners.version,before.fileOwners.version);assert.deepEqual(after.tasks.map(task=>task.runId),before.tasks.map(task=>task.runId));assert.ok(!after.interactions.some(request=>request.title==='must not be created'));
  assert.deepEqual((await f.pipeline.queryProjectMemory({projectId:f.id})).value,memory.value);
  assert.equal((await f.pipeline.stopExecution({ projectId: '0'.repeat(64) })).error.code, 'project_missing');
  const original = f.profiles.list.bind(f.profiles); let entered; let unblock;
  const pending = new Promise((done) => { entered = done; });
  f.profiles.list = async () => { entered(); await new Promise((done) => { unblock = done; }); return original(); };
  const state = f.pipeline.getState(); await pending;
  const stopping = f.pipeline.stopExecution({ projectId: f.id });
  f.profiles.list = original;
  try { complete(held, '', { resource: 'a.txt', content: 'late forbidden' }); await delay(30); }
  finally { unblock(); }
  await state; const stopped = await stopping; assert.equal(stopped.ok, true); assert.equal(stopped.value.plan.status, 'invalidated');
  await assert.rejects(fs.stat(join(f.root, 'a.txt')), { code: 'ENOENT' });
});

test('close revokes in-flight plan confirmation before publish and repeated close does not infer', async (t) => {
  let candidate;
  const f = await fixture(t, (call, reply) => complete(reply, planText(candidate)));
  candidate = plan(f.profileId); const staged = await draft(f);
  const original = f.profiles.resolveConnection.bind(f.profiles); let entered; let unblock;
  const pending = new Promise((done) => { entered = done; });
  f.profiles.resolveConnection = async (...args) => { entered(); await new Promise((done) => { unblock = done; }); return original(...args); };
  const confirming = confirm(f, staged); await pending;
  const closing = f.pipeline.close(); f.profiles.resolveConnection = original; unblock();
  assert.equal((await confirming).ok, false); assert.equal((await closing).ok, true); assert.equal((await f.pipeline.close()).ok, true);
  assert.equal(f.calls.filter(call=>(call.body.tools??[]).some(tool=>tool.function.name==='legion_design_roles')).length, 1); assert.deepEqual((await fs.readdir(f.root)).sort(), ['package.json', 'tests']);
});

test('SDK completed text without target writes fails goal and leaves software checks not_executed', async (t) => {
  let candidate;
  const f = await fixture(t, (call, reply) => { let text = 'I completed every file and passed every test'; if (readOnlyManagerCall(call)) text = planText(candidate); complete(reply, text); });
  candidate = plan(f.profileId); const staged = await draft(f);
  assert.equal((await confirm(f, staged)).ok, true);
  const done = await until(f.pipeline, (state) => state.plan?.status === 'failed');
  assert.equal(done.tasks[0].status, 'failed'); assert.equal(done.tasks[0].error.code, 'task_outputs_missing');
  assert.deepEqual(done.tasks[0].results, []); assert.equal(done.tasks[0].checkStatus, 'not_executed');
  await assert.rejects(fs.stat(join(f.root, 'a.txt')), { code: 'ENOENT' });
  const oldDigest=done.plan.planDigest;candidate={...plan(f.profileId),goal:'Immediate new Human draft after failure'};
  const started=await f.pipeline.sendMessage({projectId:f.id,roleId:'Supervisor',text:'Immediately prepare the new requested draft'});assert.equal(started.ok,true);
  const next=await until(f.pipeline,state=>state.turn?.status==='completed'&&state.plan?.status==='draft'&&state.plan.planDigest!==oldDigest&&state.interactions.some(request=>request.status==='pending'&&request.purpose==='execute_plan'&&request.bindings.planDigest===state.plan.planDigest));
  const requests=next.interactions.filter(request=>request.status==='pending'&&request.purpose==='execute_plan'&&request.bindings.planDigest===next.plan.planDigest);assert.equal(requests.length,1);assert.equal(next.plan.goal,candidate.goal);
});

test('cancel_turn leaves the same Su instance usable without restoring failed text or authority', async (t) => {
  let hang = true; const human = 'Cancel this turn'; const partial = 'Cancelled partial response must stay out of incomplete customer history';
  const f = await fixture(t, (call, reply) => {
    assert.equal(readOnlyManagerCall(call), true);
    if (hang) {
      reply.writeHead(200, { 'content-type': 'text/event-stream' });
      reply.write('data: ' + JSON.stringify({ id: 'cancel-partial', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content: partial }, finish_reason: null }] }) + '\n\n');
      reply.write(': wait\n\n');
    } else complete(reply, 'Continue safely');
  },true);
  const started = await f.pipeline.sendMessage({ projectId: f.id, roleId: 'Supervisor', text: human });
  assert.equal(started.ok, true);
  const active = await until(f.pipeline, (state) => state.turn?.status === 'running' && f.calls.length>0);
  await untilPrivateDomain(f,domain=>domain.memberConversations.runs.some(run=>run.id===started.value.turn.id&&run.status==='running'));
  assert.equal(active.turn.id, started.value.turn.id);
  const cancelled = await f.pipeline.cancelTurn({ projectId: f.id, turnId: started.value.turn.id });
  assert.equal(cancelled.ok, true); assert.equal(cancelled.value.turn.status, 'cancelled');
  assert.deepEqual(cancelled.value.history.messages, [{ role: 'user', text: human }]);
  assert.equal(cancelled.value.timeline.messages.filter((message) => message.kind === 'human' && message.text === human).length, 1);
  assert.equal(cancelled.value.timeline.messages.filter((message) => message.kind === 'assistant').map((message) => message.text).join(''), '');
  hang = false;
  assert.equal((await f.pipeline.sendMessage({ projectId: f.id, roleId: 'Supervisor', text: 'Continue' })).ok, true);
  const done = await until(f.pipeline, (state) => ['completed','failed'].includes(state.turn?.status));
  assert.equal(done.turn.status,'completed',JSON.stringify({error:done.turn.error,calls:f.calls.length,fixtureErrors:f.errors.map(e=>e.stack)}));
  assert.equal(f.calls.length,2,'same process sends a real second HTTP request');
  await untilPrivateDomain(f,domain=>domain.memberConversations.runs.filter(run=>run.roleId==='Supervisor'&&run.channel==='su_customer'&&run.status!=='running').length===2);
  const raw=JSON.parse(await fs.readFile(join(f.data,'workbench-organization',f.id+'.json'),'utf8')),runs=raw.memberConversations.runs.filter(run=>run.roleId==='Supervisor'&&run.channel==='su_customer');assert.equal(runs.length,2);assert.equal(runs[0].instanceId,runs[1].instanceId);assert.equal(runs[0].runId,started.value.turn.id);assert.equal(runs[1].status,'completed');const firstTerminal=raw.memberConversations.events.find(event=>event.conversationId===runs[0].id&&event.kind==='terminal');assert.ok(firstTerminal);assert.equal(firstTerminal.text,'');assert.equal(firstTerminal.createdAt,runs[0].finishedAt);assert.equal(firstTerminal.status,runs[0].status);
  // Exact provenance pairs from the two current Host paths; no arbitrary terminal allowance.
  if(firstTerminal.reason==='run_cancelled'){assert.equal(firstTerminal.status,'interrupted');}
  else {assert.equal(firstTerminal.reason,null);assert.equal(firstTerminal.status,'cancelled');}
  assert.equal(raw.customerTimeline.turns.find(turn=>turn.id===started.value.turn.id).status,'cancelled');assert.equal(raw.memberConversations.events.filter(event=>event.conversationId===runs[0].id&&event.kind==='assistant_text').map(event=>event.text).join(''),'');assert.ok(!JSON.stringify(raw.roleMemories.entries.filter(entry=>entry.channel==='su_customer')).includes(partial));
  assert.deepEqual(done.history.messages.map((item) => item.text), [human, 'Continue', 'Continue safely']);
  assert.equal(done.history.messages.filter((message) => message.role === 'user' && message.text === human).length, 1);
  assert.equal(done.history.messages.some((message) => message.text.includes(partial)), false);
  const continuation = f.calls.at(-1);
  const messageText = (message) => { if (typeof message.content === 'string') return message.content; if (Array.isArray(message.content)) return message.content.filter((part) => part.type === 'text').map((part) => part.text).join(''); return ''; };
  assert.equal(continuation.body.messages.filter((message) => message.role === 'user' && messageText(message) === human).length, 1);
  assert.equal(continuation.body.messages.some((message) => messageText(message).includes(partial)), false);
  for (const message of continuation.body.messages) {
    assert.notEqual(message.role, 'tool');
    for (const field of ['tool_calls', 'tool_call_id', 'permit', 'authorization', 'controller']) assert.equal(Object.hasOwn(message, field), false, field);
  }
  assert.equal(done.plan, null); assert.deepEqual(done.tasks, []);
  assert.equal((await f.pipeline.confirmPlan({ projectId: f.id, planDigest: 'f'.repeat(64) })).error.code, 'plan_changed');
  assert.deepEqual(done.roles.map((item) => item.id), ['Acceptance', 'ProjectManager', 'RoleArchitect','Supervisor', 'Worker']);
  assert.deepEqual((await fs.readdir(f.root)).sort(), ['package.json', 'tests']);
});

for(const channel of ['split-text','interaction'])test('known environment value is rejected before durable '+channel,async(t)=>{
 const key='review-local-secret';const f=await fixture(t,(_call,reply)=>{
  if(channel==='interaction')return complete(reply,'',{payload:{kind:'question',purpose:'discussion',title:'Question',text:key,options:[],allowSupplement:false}},'legion_request_interaction','secret-question');
  reply.writeHead(200,{'content-type':'text/event-stream'});
  for(const part of [key.slice(0,8),key.slice(8)])reply.write('data: '+JSON.stringify({id:'secret',object:'chat.completion.chunk',choices:[{index:0,delta:{role:'assistant',content:part},finish_reason:null}]})+'\n\n');
  reply.write('data: '+JSON.stringify({id:'secret',object:'chat.completion.chunk',choices:[{index:0,delta:{},finish_reason:'stop'}]})+'\n\n');reply.end('data: [DONE]\n\n');
 });
 const started=await f.pipeline.sendMessage({projectId:f.id,roleId:'Supervisor',text:'Safe Human request'});assert.equal(started.ok,true);
 const done=await until(f.pipeline,state=>state.turn?.status==='failed');assert.equal(done.turn.error.code,'sensitive_output');assert.ok(!JSON.stringify(done).includes(key));
 await f.pipeline.close();async function scan(path){for(const entry of await fs.readdir(path,{withFileTypes:true})){const child=join(path,entry.name);if(entry.isDirectory())await scan(child);else if(entry.isFile())assert.equal((await fs.readFile(child)).includes(Buffer.from(key)),false,child);}}
 await scan(f.data);
});

test('Su public SDK reads ordinary unowned files, queries trusted facts and refuses forged PM sources without write tools',async(t)=>{
 let observed=[];const f=await fixture(t,(call,reply)=>{
  const names=call.body.tools.map(x=>x.function.name).sort();assert.deepEqual(names,['legion_delegate_pm','legion_list_files','legion_query_memory','legion_query_role_activity','legion_query_role_log','legion_read_file','legion_remember_fact','legion_request_interaction']);
  const pairs=call.body.messages.filter(x=>x.role==='tool').map(x=>JSON.parse(x.content));observed=pairs;
  if(!pairs.length)return complete(reply,'',{resource:'foreign.txt'},'legion_read_file','ordinary');
  if(pairs.length===1){assert.equal(pairs[0].result.text,'ordinary-unowned-content');return complete(reply,'',{resource:'.ans/private/key'},'legion_read_file','control-denied');}
  if(pairs.length===2){assert.equal(pairs[1].result.status,'denied');return complete(reply,'',{payload:{}},'legion_query_role_activity','status');}
  if(pairs.length===3)return complete(reply,'',{payload:{roleId:'Worker',limit:1}},'legion_query_role_log','log');
  if(pairs.length===4)return complete(reply,'',{payload:{action:'start',purpose:'plan',instruction:'must not execute',sourceRefs:['human:forged']}},'legion_delegate_pm','forged');
  assert.equal(pairs.at(-1).decision.allowed,false);complete(reply,'Only verified project observations');
 },true);await fs.writeFile(join(f.root,'foreign.txt'),'ordinary-unowned-content');
 assert.equal((await f.pipeline.sendMessage({projectId:f.id,roleId:'Supervisor',text:'Read facts only'})).ok,true);const done=await until(f.pipeline,state=>state.turn?.status==='completed');assert.equal(done.plan,null);assert.equal(done.fileOwners.owners.length,0);assert.equal(observed.length,5);assert.equal(f.calls.some(x=>x.body.tools.some(tool=>tool.function.name==='legion_design_roles')),false);await assert.rejects(fs.stat(join(f.root,'.ans/events/index.jsonl')),{code:'ENOENT'});
});

test('Su PM two-question bridge binds actual Human answers and rejects the old answerRef for the second question',async(t)=>{
 let firstAnswerRef=null,secondAnswerRef=null,oldRefDenied=false;const f=await fixture(t,(call,reply)=>{
  const names=call.body.tools.map(x=>x.function.name);const pairs=call.body.messages.filter(x=>x.role==='tool').map(x=>JSON.parse(x.content));const last=pairs.at(-1);
  if(names.includes('legion_design_roles')){
   const answers=pairs.filter(x=>x.result.tool==='legion_request_interaction');
   if(answers.length===0)return complete(reply,'',{payload:{kind:'question',purpose:'discussion',title:'PM first question',text:'Provide first answer',options:[],allowSupplement:false}},'legion_request_interaction','pm-q1');
   assert.equal(answers[0].result.payload.interaction.answer.value,'first-answer');
   if(answers.length===1)return complete(reply,'',{payload:{kind:'question',purpose:'discussion',title:'PM second question',text:'Provide second answer',options:[],allowSupplement:false}},'legion_request_interaction','pm-q2');
   assert.equal(answers[1].result.payload.interaction.answer.value,'second-answer');return complete(reply,'Private PM two answers verified');
  }
  assert.ok(names.includes('legion_delegate_pm'));
  if(!pairs.length){const strings=call.body.messages.flatMap(x=>typeof x.content==='string'?[x.content]:Array.isArray(x.content)?x.content.map(y=>y.text??''):[]).join('\n');const ref=[...strings.matchAll(/human:[A-Za-z0-9_.-]+/gu)].at(-1)?.[0];assert.ok(ref);return complete(reply,'',{payload:{action:'start',purpose:'plan',instruction:'Ask both real Human questions',sourceRefs:[ref]}},'legion_delegate_pm','start');}
  if(last.result.tool==='legion_delegate_pm'&&last.result.payload?.kind==='needs_human')return complete(reply,'',{payload:{questionRef:last.result.payload.questionRef}},'legion_request_interaction','public-question-'+pairs.length);
  if(last.result.tool==='legion_request_interaction'){
   const delegation=pairs.findLast(x=>x.result.tool==='legion_delegate_pm'&&x.result.payload?.delegationId)?.result.payload.delegationId;assert.ok(delegation);const answer=last.result.payload.humanAnswerRef;
   if(firstAnswerRef===null){firstAnswerRef=answer;return complete(reply,'',{payload:{action:'resume',delegationId:delegation,humanAnswerRef:answer}},'legion_delegate_pm','resume-first');}
   secondAnswerRef=answer;assert.notEqual(answer,firstAnswerRef);return complete(reply,'',{payload:{action:'resume',delegationId:delegation,humanAnswerRef:firstAnswerRef}},'legion_delegate_pm','old-answer');
  }
  if(last.result.tool==='legion_delegate_pm'&&!last.decision.allowed){assert.equal(last.result.reason,'stale_interaction');oldRefDenied=true;const id=pairs.findLast(x=>x.result.payload?.delegationId)?.result.payload.delegationId;return complete(reply,'',{payload:{action:'resume',delegationId:id,humanAnswerRef:secondAnswerRef}},'legion_delegate_pm','resume-second');}
  assert.equal(last.result.payload.status,'completed');complete(reply,'Su reports actual two-answer result');
 },true);
 assert.equal((await f.pipeline.sendMessage({projectId:f.id,roleId:'Supervisor',text:'Discuss two real questions'})).ok,true);
 for(const [title,value] of [['PM first question','first-answer'],['PM second question','second-answer']]){const state=await until(f.pipeline,s=>s.interactions.some(q=>q.status==='pending'&&q.title===title));const q=state.interactions.find(q=>q.status==='pending'&&q.title===title);assert.equal((await f.pipeline.answerInteraction({projectId:f.id,requestId:q.requestId,version:q.version,requestDigest:q.digest,value})).ok,true);}
 const done=await until(f.pipeline,s=>s.turn?.status==='completed');assert.equal(oldRefDenied,true);assert.equal(done.plan,null);assert.deepEqual(done.history.messages.map(x=>x.role),['user','assistant','user','assistant','user','assistant']);
 const raw=JSON.parse(await fs.readFile(join(f.data,'workbench-organization',f.id+'.json'),'utf8'));assert.equal(raw.delegations.entries.at(-1).status,'completed');assert.ok(raw.memberConversations.runs.some(r=>r.roleId==='ProjectManager'&&r.channel==='pm_delegate'));assert.ok(raw.roleMemories.entries.some(r=>r.roleId==='Supervisor'&&r.channel==='su_customer'));assert.ok(!done.history.messages.some(x=>x.text.includes('Private PM two answers verified')));
});
