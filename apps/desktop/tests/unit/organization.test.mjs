import { randomBytes } from 'node:crypto';
import { dirname as leaseParent } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, readFile, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectService as realCreateProjectService } from '../../src/services/public/project.mjs';
import { createOrganizationService } from '../../src/services/public/organization.mjs';
import { FIXED_ROLE_DUTIES } from '../../src/models/organization.mjs';
import { digestValue } from 'legion-runtime/workbench-models';
const generated = fileURLToPath(new URL('../../../../.ans/runtime/legion-desktop-command-center-v1/DesktopEngineer/', import.meta.url));
await mkdir(join(generated, 'fixtures'), { recursive: true }); await mkdir(join(generated, 'user-data'), { recursive: true });
async function fixture() {
 const directory = await mkdtemp(join(generated, 'fixtures', 'organization-')); const root = join(directory, 'customer'); await mkdir(root);
 const data = await mkdtemp(join(generated, 'user-data', 'organization-')); const projects = createProjectService({ userDataDir: data });
 const project = (await projects.select(root)).value; const service = createOrganizationService({ userDataDir: data }); await service.load(project);
 return { directory, root, data, project, projects, service };
}
function actor(project, roleId) { return { projectId: project.id, roleId, instanceId: roleId + '-instance' }; }
function member(id, boundary, revision = 1) { return { id, name: id, purpose: FIXED_ROLE_DUTIES[id] ?? '实现业务', interfaces: ['public API'], boundary, documents: [], revision, enabled: true, status: 'approved' }; }
function approval(state, proposal, decision = 'approve', reason = '') { return { proposalId: proposal.id, version: proposal.version, digest: proposal.digest, organizationRevision: state.organization.revision, organizationDigest: state.organization.digest, decision, reason }; }
async function propose(f, input) { return f.service.submitProposal(f.project, input, actor(f.project, 'RoleArchitect')); }

test('atomic ledger approval persists members across independent plans and rejects spoofed actors/exact stale reviews', async () => {
 const f = await fixture();
 try {
 let state = await propose(f, { id: 'roles', version: 1, members: [member('Builder', ['src/a.mjs'])] }); const proposal = state.ledger.proposals.at(-1);
 assert.equal(state.organization.members.some((item) => item.id === 'Builder'), false);
 await assert.rejects(f.service.reviewProposal(f.project, approval(state, proposal), actor(f.project, 'RoleArchitect')), { code: 'actor_forbidden' });
 await assert.rejects(f.service.reviewProposal(f.project, { ...approval(state, proposal), digest: '0'.repeat(64) }, actor(f.project, 'ProjectManager')), { code: 'stale_proposal' });
 state = await f.service.reviewProposal(f.project, approval(state, proposal, 'return', '拆分职责'), actor(f.project, 'ProjectManager'));
 assert.equal(state.ledger.proposals[0].status, 'returned'); assert.equal(state.organization.members.some((item) => item.id === 'Builder'), false);
 state = await propose(f, { id: 'roles', version: 2, members: [member('Builder', ['src/a.mjs'])] });
 state = await f.service.reviewProposal(f.project, approval(state, state.ledger.proposals.at(-1)), actor(f.project, 'ProjectManager'));
 await assert.rejects(f.service.reviewProposal(f.project, approval(state, proposal), actor(f.project, 'ProjectManager')));
 state = await propose(f, { id: 'other', version: 1, members: [member('Editor', ['src/b.mjs'])] });
 state = await f.service.reviewProposal(f.project, approval(state, state.ledger.proposals.at(-1)), actor(f.project, 'ProjectManager'));
 const restored = await createOrganizationService({ userDataDir: f.data }).load({ ...f.project, plan: null });
 assert.deepEqual(restored.organization.members.map((item) => item.id), ['Acceptance', 'Builder', 'Editor', 'ProjectManager', 'RoleArchitect','Supervisor']);
 assert.deepEqual(restored.organization.fileOwners, [{ resource: 'src/a.mjs', roleId: 'Builder' }, { resource: 'src/b.mjs', roleId: 'Editor' }]);
 assert.equal(restored.ledger.proposals[0].status, 'returned');
 } finally { await f.service.close(); await f.projects.close(); }
});

test('three durable answer kinds require exact nonce/version/bindings; duplicate answers and restart never replay tools', async () => {
 const f = await fixture(); const bindings = { organizationRevision: 0, organizationDigest: (await f.service.load(f.project)).organization.digest };
 try {
 for (const [order, kind, value] of [[1, 'confirmation', false], [2, 'choice', { optionId: 'a', text: '补充' }], [3, 'question', '真实文字答复']]) {
 let state = await f.service.enqueue(f.project, { requestId: 'request-' + order, projectId: f.project.id, version: 1, kind, purpose: 'discussion', title: '真实请求', text: '请回答', options: [], allowSupplement: false, bindings, createdOrder: order, createdAt: '2026-10-08T01:00:00.000Z', ...choiceFields(kind) }, { roleId: 'ProjectManager', instanceId: 'pm', runId: 'old-run', toolRequestId: 'old-tool' });
 const request = state.queue.requests.at(-1); const input = { requestId: request.requestId, projectId: f.project.id, version: 1, requestDigest: request.digest, answerId: 'answer-' + order, answeredAt: '2026-10-08T01:01:00.000Z', value };
 await assert.rejects(f.service.answer(f.project, { ...input, version: 2 }, { projectId: f.project.id, roleId: 'Human' }, bindings), { code: 'stale_interaction' });
 await assert.rejects(f.service.answer(f.project, input, { projectId: f.project.id, roleId: 'Human' }, { ...bindings, organizationRevision: 1 }), { code: 'stale_interaction' });
 state = await f.service.answer(f.project, input, { projectId: f.project.id, roleId: 'Human' }, bindings);
 const duplicate = await f.service.answer(f.project, input, { projectId: f.project.id, roleId: 'Human' }, bindings); assert.equal(duplicate.digest, state.digest);
 await assert.rejects(f.service.answer(f.project, { ...input, answerId: 'other' }, { projectId: f.project.id, roleId: 'Human' }, bindings), { code: 'interaction_already_answered' });
 }
 const restored = await createOrganizationService({ userDataDir: f.data }).load(f.project); assert.deepEqual(restored.queue.requests.map((item) => item.status), ['rejected', 'answered', 'answered']);
 } finally { await f.service.close(); await f.projects.close(); }
});
function choiceFields(kind) { if (kind === 'choice') return { options: [{ id: 'a', label: '选项A' }], allowSupplement: true }; return {}; }

test('pending questions survive reload; cancellation invalidates and preserves prior real answers', async () => {
 const f = await fixture(); const state = await f.service.load(f.project);
 try {
 await f.service.enqueue(f.project, { requestId: 'pending', projectId: f.project.id, version: 1, kind: 'question', purpose: 'discussion', title: '问题', text: '继续？', options: [], allowSupplement: false, bindings: {}, createdOrder: 1, createdAt: '2026-10-08T01:00:00.000Z' }, { roleId: 'ProjectManager', instanceId: 'pm', runId: null, toolRequestId: null });
 assert.equal((await createOrganizationService({ userDataDir: f.data }).load(f.project)).queue.requests[0].status, 'pending');
 await f.service.invalidate(f.project, 'human_cancelled');
 assert.equal((await f.service.load(f.project)).queue.requests[0].status, 'invalidated');
 } finally { await f.service.close(); await f.projects.close(); }
});

test('legacy owner/current-plan migration preserves unknown duties without fabricated approval', async () => {
 const f = await fixture();
 try {
 const otherRoot = join(f.directory, 'legacy'); await mkdir(otherRoot); const legacy = (await f.projects.select(otherRoot)).value;
 const owners = { owners: [{ resource: 'old.mjs', roleId: 'Old' }] };
 const restored = await f.service.load({ ...legacy, fileOwners: owners });
 assert.equal(restored.organization.status, 'legacy'); const member = restored.organization.members.find((item) => item.id === 'Old'); assert.equal(member.purpose, ''); assert.equal(member.status, 'legacy'); assert.equal(member.revision, 0);
 } finally { await f.service.close(); await f.projects.close(); }
});

test('concurrent CAS, corrupted full digest and linked inputs fail closed', async () => {
 const f = await fixture();
 try {
 const file = join(f.data, 'workbench-organization', f.project.id + '.json'); const original = JSON.parse(await readFile(file, 'utf8'));
 await writeFile(file, JSON.stringify({ ...original, revision: original.revision + 1 })); await assert.rejects(f.service.load(f.project), { code: 'organization_corrupt' });
 await writeFile(file, JSON.stringify(original));
 await writeFile(join(f.directory, 'outside.txt'), 'outside'); await symlink(join(f.directory, 'outside.txt'), join(f.root, 'linked.txt'));
 await assert.rejects(f.service.snapshotInputs(f.project, ['linked.txt']), { code: 'unsafe_check_input' });
 await assert.rejects(f.service.snapshotInputs(f.project, ['.ans/project.json']));
 const other = createOrganizationService({ userDataDir: f.data }); const outcomes = await Promise.allSettled([propose(f, { id: 'one', version: 1, members: [member('Builder', ['a.txt'])] }), other.submitProposal(f.project, { id: 'two', version: 1, members: [member('Editor', ['b.txt'])] }, actor(f.project, 'RoleArchitect'))]);
 assert.equal(outcomes.filter((item) => item.status === 'fulfilled').length, 1); assert.ok(['organization_busy', 'stale_organization'].includes(outcomes.find((item) => item.status === 'rejected').reason.code)); await other.close();
 } finally { await f.service.close(); await f.projects.close(); }
});

test('conversation journal commits question/answer with queue CAS and restores without fabricating legacy timestamps', async () => {
 const f=await fixture();try{
 let state=await f.service.seedConversation(f.project,{messages:[{role:'user',text:'旧记录'}]});assert.equal(state.timeline.legacyMessages[0].createdAt,undefined);
 await f.service.beginTurn(f.project,{turnId:'dialogue',userMessageId:'human-dialogue',continuationAnswerId:null,text:'相同文本',createdAt:'2026-10-08T01:00:00.000Z'});
 state=await f.service.enqueue(f.project,{requestId:'journal-request',projectId:f.project.id,version:1,kind:'question',purpose:'discussion',title:'真实问题',text:'请回答',options:[],allowSupplement:false,bindings:{},createdOrder:1,createdAt:'2026-10-08T01:00:01.000Z'},{roleId:'ProjectManager',instanceId:'pm',runId:'dialogue',toolRequestId:'tool'},'dialogue');
 assert.equal(state.customerTimeline.messages.at(-1).requestId,state.queue.requests[0].requestId);assert.equal(state.customerTimeline.turns[0].status,'waiting');
 const request=state.queue.requests[0];const input={requestId:request.requestId,projectId:f.project.id,version:1,requestDigest:request.digest,answerId:'journal-answer',answeredAt:'2026-10-08T01:00:02.000Z',value:'实际答案'};
 state=await f.service.answer(f.project,input,{projectId:f.project.id,roleId:'Human'},{});assert.equal(state.customerTimeline.messages.at(-1).answerId,state.queue.requests[0].answer.answerId);
 const duplicate=await f.service.answer(f.project,input,{projectId:f.project.id,roleId:'Human'},{});assert.equal(duplicate.digest,state.digest);
 const other=createOrganizationService({userDataDir:f.data});try{const restored=await other.load(f.project);assert.deepEqual(restored.customerTimeline.messages.map((message)=>message.kind),['human','question','answer']);assert.equal(restored.customerTimeline.messages.filter((message)=>message.answerId==='journal-answer').length,1);assert.equal(restored.timeline.legacyMessages[0].text,'旧记录');}finally{await other.close();}
 }finally{await f.service.close();await f.projects.close();}
});


test('pending regression: old digest without member journal migrates in original CAS and actual member events remain isolated', async () => {
 const f = await fixture(); const origin = actor(f.project, 'RoleArchitect');
 try {
  const current = await f.service.load(f.project); const { digest, memberConversations, ...legacy } = current; const old = { ...legacy, digest: digestValue(legacy) }; const file = join(f.data, 'workbench-organization', f.project.id + '.json'); await writeFile(file, JSON.stringify(old));
  assert.equal((await f.service.load(f.project)).memberConversations.runs.length, 0); await f.service.beginMemberRun(f.project, { id: 'actual-run', roleId: 'RoleArchitect', taskId: 'role-design', instanceId: origin.instanceId, runId: 'actual-run', planDigest: null, startedAt: '2026-10-09T00:00:00.000Z' }, origin, new AbortController().signal);
  const input = { id: 'actual-text', conversationId: 'actual-run', kind: 'assistant_text', text: '架构师实际回复', tool: null, requestId: null, resource: null, checkId: null, status: null, reason: null, digest: null, createdAt: '2026-10-09T00:00:00.000Z' };
  await assert.rejects(f.service.appendMemberEvent(f.project, input, { ...origin, instanceId: 'foreign-instance' }, new AbortController().signal), /member_actor_mismatch/u); await f.service.appendMemberEvent(f.project, input, origin, new AbortController().signal);
  const restored = await f.service.seedConversation(f.project, { messages: [] }); assert.equal(restored.memberConversations.runs[0].status, 'interrupted'); assert.equal(restored.memberConversations.events[0].text, '架构师实际回复'); assert.equal(restored.timeline.messages.some((message) => message.text.includes('架构师实际回复')), false); assert.ok(JSON.parse(await readFile(file, 'utf8')).memberConversations);
 } finally { await f.service.close(); await f.projects.close(); }
});


test('invalid real-shape proposal has safe boundary diagnostics and commits no pending role/owner before a corrected exact proposal', async () => {
 const f = await fixture();
 try {
  const before = await f.service.load(f.project); await assert.rejects(propose(f, { id: 'whole-team', version: 1, members: [member('Backend', ['职责:不能是边界']), member('Frontend', ['src/**'])] }), (error) => error.code === 'invalid_role_resource' && error.field === 'members[0].boundary[0]' && !error.expected.includes('职责:不能是边界'));
  const unchanged = await f.service.load(f.project); assert.equal(unchanged.digest, before.digest); assert.equal(unchanged.ledger.proposals.length, 0); assert.equal(unchanged.organization.fileOwners.length, 0);
  const corrected = await propose(f, { id: 'whole-team', version: 1, members: [member('Backend', ['src/backend.mjs']), member('Frontend', ['src/frontend.mjs'])] }); assert.equal(corrected.ledger.proposals.length, 1); assert.equal(corrected.ledger.proposals[0].status, 'pending'); assert.equal(corrected.organization.members.some((role) => role.id === 'Backend'), false);
 } finally { await f.service.close(); await f.projects.close(); }
});

import { roleContextSources } from '../../src/models/workbench.mjs';
test('persistent role memory validates legacy digest, source CAS and role isolation across service restart', async () => {
  const f = await fixture(); const at = '2026-10-09T00:00:00.000Z';
  try {
    const current = await f.service.load(f.project); const { digest, roleMemories, ...legacy } = current; const file = join(f.data, 'workbench-organization', f.project.id + '.json'); await writeFile(file, JSON.stringify({ ...legacy, digest: digestValue(legacy) }));
    let state = await f.service.beginTurn(f.project, { turnId:'memory-human',userMessageId:'memory-source',continuationAnswerId:null,text:'重启后必须保留的完整需求',createdAt:at }); assert.equal(state.roleMemories.entries.length, 0);
    const source = roleContextSources(state, 'Supervisor','su_customer'); const input = { roleId: 'Supervisor',channel:'su_customer', expectedRevision: 0, summary: '', covered: [], messages: source.sources, sourceDigest: source.sourceDigest, updatedAt: at };
    assert.throws(() => f.service.saveRoleMemory(f.project, input, actor(f.project, 'RoleArchitect')), { code: 'actor_forbidden' }); state = await f.service.saveRoleMemory(f.project, input, actor(f.project, 'Supervisor'));
    const reopened = createOrganizationService({ userDataDir: f.data }); try { assert.equal((await reopened.load(f.project)).roleMemories.entries[0].messages[0].text, '重启后必须保留的完整需求'); } finally { await reopened.close(); }
    await assert.rejects(f.service.saveRoleMemory(f.project, input, actor(f.project, 'Supervisor')), error=>error.code==='stale_role_memory'&&error.memoryDiagnostic.branch==='revision'&&error.memoryDiagnostic.expectedRevision===0&&error.memoryDiagnostic.actualRevision===1);
    await assert.rejects(f.service.saveRoleMemory(f.project, { ...input, expectedRevision: 1, sourceDigest: '0'.repeat(64) }, actor(f.project, 'Supervisor')), error=>error.code==='stale_role_memory'&&error.memoryDiagnostic.branch==='source_digest'&&error.memoryDiagnostic.expectedDigest==='0'.repeat(64)&&error.memoryDiagnostic.actualDigest===source.sourceDigest);
    const before = (await f.service.load(f.project)).roleMemories.digest; await assert.rejects(f.service.saveRoleMemory(f.project, { ...input, expectedRevision: 1, messages: [{ ...input.messages[0], text: '伪造来源' }] }, actor(f.project, 'Supervisor')), { code: 'invalid_role_memory' }); assert.equal((await f.service.load(f.project)).roleMemories.digest, before);
    const aborted = new AbortController(); aborted.abort(); await assert.rejects(f.service.saveRoleMemory(f.project, { ...input, expectedRevision: 1 }, actor(f.project, 'Supervisor'), aborted.signal), { code: 'stale_action' }); assert.equal((await f.service.load(f.project)).roleMemories.digest, before);
  } finally { await f.service.close(); await f.projects.close(); }
});

import { readdirSync, readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { createOrganizationProvider } from '../../src/providers/public/organization.mjs';
test('actual filesystem final cancellation query preserves prepared target and cleans temp/lock; committed writes ignore later cancellation', async () => {
  const f = await fixture(); const provider = createOrganizationProvider({ userDataDir: f.data }); const directory = join(f.data, 'workbench-organization'); const file = f.project.id + '.json';
  try {
    const previous = await provider.read(f.project.id, f.project.workspaceIdentity); const { digest, ...fields } = previous; const nextFields = { ...fields, revision: fields.revision + 1 }; const next = { ...nextFields, digest: digestValue(nextFields) }; const before = new AbortController(); let prepared = false;
    const nativeAborted = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted').get;
    // Deterministic real AbortController at the provider's final query: inspect actual temp,
    // then abort. Native fs.watch can coalesce past rename on macOS and cannot prove this fence.
    Object.defineProperty(before.signal, 'aborted', { get() { if (readdirSync(directory).some((name) => name.endsWith('.tmp'))) { prepared = true; before.abort(); } return nativeAborted.call(before.signal); } });
    await assert.rejects(provider.write(next, f.project.workspaceIdentity, digest, before.signal), { code: 'stale_action' });
    assert.equal(prepared, true); assert.equal((await provider.read(f.project.id, f.project.workspaceIdentity)).digest, digest); assert.deepEqual(await readdir(directory), [file]);
    const after = new AbortController(); Object.defineProperty(after.signal, 'aborted', { get() { if (readdirSync(directory).some((name) => name.endsWith('.tmp'))) queueMicrotask(() => after.abort()); return nativeAborted.call(after.signal); } }); const committed = await provider.write(next, f.project.workspaceIdentity, digest, after.signal);
    assert.equal(committed.digest, next.digest); assert.equal(JSON.parse(readFileSync(join(directory, file), 'utf8')).digest, next.digest); assert.equal(after.signal.aborted, true); assert.deepEqual(await readdir(directory), [file]);
  } finally { await provider.close(); await f.service.close(); await f.projects.close(); }
});

function createProjectService(options){return realCreateProjectService({...options,leaseRoot:join(leaseParent(options.userDataDir),'isolated-project-leases')});}


test('three-system original digest is validated before CAS migration; pending execution is invalidated and reloading is idempotent',async()=>{
 const f=await fixture();try{
  const {readFile}=await import('node:fs/promises');const {legacyOrganizationDocument}=await import('../../src/models/organization.mjs');const {interactionQueueDocument,interactionDocument}=await import('../../src/models/interaction.mjs');
  const old=await f.service.load(f.project);await f.service.enqueue(f.project,{requestId:'old-execute',projectId:f.project.id,version:1,kind:'confirmation',purpose:'execute_plan',title:'Old execute',text:'Old plan',options:[],allowSupplement:false,bindings:{planDigest:'a'.repeat(64),organizationRevision:old.organization.revision,organizationDigest:old.organization.digest},createdOrder:1,createdAt:'2026-10-10T00:00:00.000Z'},{roleId:'ProjectManager',instanceId:'old-pm',runId:null,toolRequestId:null});
  const path=join(f.data,'workbench-organization',f.project.id+'.json');let raw=JSON.parse(await readFile(path,'utf8'));raw.organization=legacyOrganizationDocument({...raw.organization,members:raw.organization.members.filter(member=>member.id!=='Supervisor'),digest:undefined});raw.queue=interactionQueueDocument({...raw.queue,requests:raw.queue.requests.map(request=>interactionDocument({...request,bindings:{...request.bindings,organizationDigest:raw.organization.digest},digest:undefined})),digest:undefined});delete raw.supervisions;delete raw.memorySourceHistory;delete raw.digest;raw.digest=digestValue(raw);await writeFile(path,JSON.stringify(raw));
  raw.schemaVersion=1;delete raw.customerTimeline;delete raw.delegations;delete raw.legacyRoleMemories;raw.roleMemories={schemaVersion:1,projectId:raw.projectId,revision:0,entries:[]};raw.roleMemories.digest=digestValue(raw.roleMemories);delete raw.digest;raw.digest=digestValue(raw);await writeFile(path,JSON.stringify(raw));
  const validated=await f.service.load(f.project);assert.equal(validated.schemaVersion,1);assert.equal(await readFile(path,'utf8'),JSON.stringify(raw));
  const migrated=await f.service.migrate(f.project);assert.equal(migrated.schemaVersion,2);assert.equal(migrated.organization.members.find(member=>member.id==='Supervisor').purpose,FIXED_ROLE_DUTIES.Supervisor);assert.equal(migrated.organization.revision,raw.organization.revision+1);assert.deepEqual(migrated.organization.fileOwners,raw.organization.fileOwners);assert.equal(migrated.queue.requests[0].status,'invalidated');assert.equal((await f.service.load(f.project)).digest,migrated.digest);
  const corrupted={...raw,revision:raw.revision+1};const bytes=JSON.stringify(corrupted);await writeFile(path,bytes);await assert.rejects(f.service.load(f.project),{code:'organization_corrupt'});assert.equal(await readFile(path,'utf8'),bytes);
 }finally{await f.service.close();await f.projects.close();}
});

test('trusted known key refuses Human, role purpose/interfaces/document summary, review and role memory before CAS',async()=>{
 const f=await fixture(),key=randomBytes(24).toString('hex');
 try{
  let state=await f.service.load(f.project,[key]);
  const file=join(f.data,'workbench-organization',f.project.id+'.json');const before=await readFile(file);
  await assert.rejects(f.service.beginTurn(f.project,{turnId:'bad-human',userMessageId:'human-bad',continuationAnswerId:null,text:key,createdAt:'2026-10-11T00:00:00.000Z'}),{code:'sensitive_output'});
  for(const field of ['purpose','interfaces','summary']){
   const m=member('Builder',['src/a.mjs']);if(field==='purpose')m.purpose=key;if(field==='interfaces')m.interfaces=[key];if(field==='summary')m.documents=[{resource:'docs/roles/Builder/design.md',contentDigest:'a'.repeat(64),summary:key}];
   await assert.rejects(propose(f,{id:'bad-'+field,version:1,members:[m]}),{code:'sensitive_output'});
  }
  assert.deepEqual(await readFile(file),before);
  state=await propose(f,{id:'clean-roles',version:1,members:[member('Builder',['src/a.mjs'])]});const proposal=state.ledger.proposals.at(-1);const clean=await readFile(file);
  await assert.rejects(f.service.reviewProposal(f.project,approval(state,proposal,'return',key),actor(f.project,'ProjectManager')),{code:'sensitive_output'});assert.deepEqual(await readFile(file),clean);
  await assert.rejects(f.service.beginMemberRun(f.project,{id:'key-member',roleId:'RoleArchitect',taskId:key,instanceId:'RoleArchitect-instance',runId:'key-member',planDigest:null,startedAt:'2026-10-11T00:00:00.000Z'},actor(f.project,'RoleArchitect')));
  assert.deepEqual(await readFile(file),clean);
 }finally{await f.service.close();await f.projects.close();}
});

test('public action log cursor pins filtered snapshot, survives unrelated append and rejects changed or lost source',async()=>{
 const f=await fixture(),su=actor(f.project,'Supervisor'),at='2026-10-11T00:00:00.000Z';
 let stage='begin';try{
  await f.service.beginMemberRun(f.project,{id:'su-log',roleId:'Supervisor',channel:'su_customer',taskId:'customer',instanceId:su.instanceId,runId:'su-log',planDigest:null,startedAt:at},su);
  stage='append';for(let i=0;i<4;i++)await f.service.appendMemberEvent(f.project,{id:'action-'+i,conversationId:'su-log',kind:'tool_result',text:'',tool:'legion_list_files',requestId:'request-'+i,resource:null,checkId:null,status:'listed',reason:'listed',digest:null,createdAt:at},su);
  stage='first';const first=await f.service.queryRoleLog(f.project,{roleId:'Supervisor',limit:2},su);assert.equal(first.events.length,2);assert.ok(first.nextCursor);
  const beforeInspect=await readFile(join(f.data,'workbench-organization',f.project.id+'.json'),'utf8');
  const inspected=await f.service.inspectRoleLog(f.project,{roleId:'Supervisor',limit:2});assert.deepEqual(inspected,first);
  const activity=await f.service.inspectRoleActivity(f.project,{roleId:'Supervisor'});assert.equal(activity.roles[0].id,'Supervisor');
  assert.equal(await readFile(join(f.data,'workbench-organization',f.project.id+'.json'),'utf8'),beforeInspect);
  await f.service.appendMemberEvent(f.project,{id:'self-query',conversationId:'su-log',kind:'tool_result',text:'',tool:'legion_query_role_log',requestId:'query-request',resource:null,checkId:null,status:'completed',reason:'completed',digest:null,createdAt:at},su);
  stage='second';const second=await f.service.queryRoleLog(f.project,{roleId:'Supervisor',limit:2,cursor:first.nextCursor},su);assert.deepEqual(second.events.map(event=>event.id),['action-2','action-3']);assert.equal(second.sourceDigest,first.sourceDigest);assert.equal(second.nextCursor,null);
  await assert.rejects(f.service.queryRoleLog(f.project,{roleId:'Supervisor',taskId:'other',cursor:first.nextCursor},su),{code:'stale_cursor'});
  const path=join(f.data,'workbench-organization',f.project.id+'.json');const original=JSON.parse(await readFile(path,'utf8'));const {memberConversations}=await import('../../src/models/interaction.mjs');
  stage='source-change';for(const missing of [false,true]){const changed=structuredClone(original);changed.memberConversations=memberConversations({...changed.memberConversations,events:changed.memberConversations.events.flatMap(event=>event.id==='action-0'?(missing?[]:[{...event,status:'error',reason:'read_failed'}]):[event]),revision:changed.memberConversations.revision+1,digest:undefined});delete changed.digest;changed.digest=digestValue(changed);await writeFile(path,JSON.stringify(changed));await assert.rejects(f.service.queryRoleLog(f.project,{roleId:'Supervisor',limit:2,cursor:first.nextCursor},su),{code:'stale_cursor'});}
 }catch(error){console.error('role-log-stage:'+stage+':'+(error.code??'error')+':'+(String(error.stack??'').match(/[A-Za-z_]+\.mjs:[0-9]+:[0-9]+/u)?.[0]??'no_location'));throw error;}finally{await f.service.close();await f.projects.close();}
});
