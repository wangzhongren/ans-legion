import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectFileOwners, FileOwnershipPlan, applyFileOwnershipPlan } from 'legion-runtime/workbench-models';
import {
  planCandidate,
  boundPlan,
  planDocument,
  topologicalTasks,
  contextDescriptor,
  contextDigest,
  identityKey,
  projectDocument,
  workbenchDTO,
  workbenchInput,
  wbError,
  historyDocument
} from '../../src/models/workbench.mjs';
const identity = {
  canonicalPath: 'D:/customer',
  deviceId: '1',
  fileId: '2'
};
const projectId = identityKey(identity);
const sha = 'a'.repeat(64);
test('customer error copy uses 二哥 while the accepted send role remains Supervisor', () => {
  for (const code of ['manager_only','preflight_incomplete','conversation_busy','invalid_plan']) {
    assert.match(wbError(code).message, /二哥/u);
    assert.equal(/Su|Supervisor|项目管理/u.test(wbError(code).message), false);
  }
  assert.equal(workbenchInput('sendMessage', { projectId, roleId: 'Supervisor', text: '当前需求' }).value.roleId, 'Supervisor');
  assert.equal(workbenchInput('sendMessage', { projectId, roleId: 'ProjectManager', text: '当前需求' }).error.code, 'manager_only');
});
const candidate = {schemaVersion:2,
  goal: '修改项目',
  roles: [{
    id: 'Builder',
    name: '开发',
    purpose: '实现',
    profileId: 'ai'
  }],
  tasks: [{
    id: 'first',
    title: '第一步',
    roleId: 'Builder',
    profileId: 'ai',
    dependsOn: [],
    intent:'change',
    instruction: '第一行\n第二行'
  },
  {
    id: 'second',
    title: '第二步',
    roleId: 'Builder',
    profileId: 'ai',
    dependsOn: ['first'],
    intent:'change',
    instruction: '实现'
  }]
};
const baseOwners=new ProjectFileOwners({projectId,version:'owners-v0',owners:[]});
const binding = {ownerSource:'/fixture/catalog',fileOwnership:{projectId,baseVersion:baseOwners.version,baseDigest:baseOwners.digest,nextVersion:baseOwners.version,nextDigest:baseOwners.digest,claims:[],transfers:[]},
  projectId,
  organizationVersion: 'customer-v1',
  revision: 1,
  profileBindings: [{
    profileId: 'ai',
    profileVersion: sha,
    contextSnapshotDigest: sha
  }],
  contextSnapshotDigest: sha
};
test('image input keeps exact Kernel references, permits image-only Human and binds task refs into the plan digest',()=>{
  const ref={projectId,attachmentId:'image_1',sha256:sha,mimeType:'image/png',byteLength:68,width:1,height:1};
  const textOnly=workbenchInput('sendMessage',{projectId,roleId:'Supervisor',text:'文本'});assert.equal(textOnly.ok,true);assert.equal(Object.hasOwn(textOnly.value,'imageRefs'),false);
  const imageOnly=workbenchInput('sendMessage',{projectId,roleId:'Supervisor',text:'',imageRefs:[ref]});assert.equal(imageOnly.ok,true,JSON.stringify(imageOnly));assert.deepEqual(imageOnly.value.imageRefs,[ref]);
  assert.equal(workbenchInput('sendMessage',{projectId,roleId:'Supervisor',text:'',imageRefs:[]}).ok,false);
  assert.equal(workbenchInput('sendMessage',{projectId,roleId:'Supervisor',text:'',imageRefs:[{...ref,projectId:'b'.repeat(64)}]}).ok,false);
  assert.equal(workbenchInput('sendMessage',{projectId,roleId:'Supervisor',text:'',imageRefs:[{...ref,path:'/private/image.png'}]}).ok,false);
  const plan=boundPlan({...candidate,tasks:[{...candidate.tasks[0],imageRefs:[ref]},candidate.tasks[1]]},binding);assert.deepEqual(plan.tasks.find(task=>task.id==='first').imageRefs,[ref]);assert.notEqual(plan.planDigest,boundPlan(candidate,binding).planDigest);
});
test('plan accepts finite DAG and rejects model authority, scope expansion, alias and cycles', () => {
  assert.deepEqual(topologicalTasks(planCandidate(candidate).tasks).map((item) => item.id), ['first', 'second']); for (const changed of [{
    ...candidate,
    approved: true
  }, {
    ...candidate,
    roles: [{
      ...candidate.roles[0],
      id: 'ProjectManager'
    }]
  }, {
    ...candidate,
    tasks: [{
      ...candidate.tasks[0],
      writeSet: ['.ans/role.yaml']
    }]
  }, {
    ...candidate,
    tasks: [{
      ...candidate.tasks[0],
      writeSet: ['a',
      'A']
    }]
  }, {
    ...candidate,
    tasks: candidate.tasks.map((item) => ({
      ...item,
      dependsOn: [item.id]
    }))
  }]) assert.throws(() => planCandidate(changed));
});
test('host digest binds every profile, context and org; stored digest tampering rejected', () => {
  const plan = boundPlan(candidate, binding); assert.ok(Object.isFrozen(plan.tasks[0])); assert.notEqual(boundPlan(candidate, {
    ...binding,
    organizationVersion: 'customer-v2'
  }).planDigest, plan.planDigest); assert.notEqual(boundPlan(candidate, {
    ...binding,
    profileBindings: [{
      ...binding.profileBindings[0],
      profileVersion: 'b'.repeat(64)
    }]
  }).planDigest, plan.planDigest); assert.throws(() => planDocument({
    ...plan,
    goal: '不同目标'
  })); assert.throws(() => boundPlan(candidate, {
    ...binding,
    profileBindings: []
  }));
});
test('context contract bounds precise files and includes SHA in digest', () => {
  const context = contextDescriptor({
    files: [{
      resource: 'src/a.txt',
      byteLength: 12,
      sha256: sha
    }],
    verifiedAt: '2026-10-07T09:44:22.2685583+08:00'
  }); assert.notEqual(contextDigest(context), contextDigest({
    ...context,
    files: [{
      ...context.files[0],
      sha256: 'b'.repeat(64)
    }]
  })); assert.throws(() => contextDescriptor({
    ...context,
    files: [{
      ...context.files[0],
      byteLength: 262145
    }]
  })); assert.throws(() => contextDescriptor({
    ...context,
    files: Array.from({
      length: 17
    }, (_, index) => ({
      ...context.files[0],
      resource: `${index}.txt`
    }))
  }));
});
test('IPC input is finite, PM only, multiline text preserved and path injection rejected', () => {
  assert.equal(workbenchInput('sendMessage', {
    projectId,
    roleId: 'Builder',
    text: '开始'
  }).error.code, 'manager_only'); assert.equal(workbenchInput('sendMessage', {
    projectId,
    roleId: 'Supervisor',
    text: '第一行\n第二行'
  }).value.text, '第一行\n第二行'); assert.equal(workbenchInput('chooseProject', {
    path: 'D:/elsewhere'
  }).ok, false); assert.equal(workbenchInput('confirmPlan', {
    projectId,
    planDigest: sha,
    approved: true
  }).ok, false);
});
test('DTO strips private workspace identity; histories reject tool/secret envelopes', () => {
  const project = projectDocument({
    schemaVersion: 1,
    id: projectId,
    name: '客户',
    workspaceIdentity: identity,
    organizationVersion: 'customer-v1',
    manager: null,
    planRevision: 0,
    plan: null,
    context: {
      files: [],
      verifiedAt: null
    },
    tasks: []
  }); const dto = workbenchDTO({
    profiles: [],
    assignments: [],
    project,
    projects: [],
    history: {
      messages: [{
        role: 'user',
        text: '需求'
      }]
    }
  }); assert.equal(JSON.stringify(dto).includes('canonicalPath'), false); assert.deepEqual(dto.roles, []); assert.throws(() => historyDocument({
    schemaVersion: 1,
    projectId,
    roleId: 'ProjectManager',
    history: {
      messages: [{
        role: 'tool',
        text: 'x'
      }]
    }
  })); assert.throws(() => historyDocument({
    schemaVersion: 1,
    projectId,
    roleId: 'ProjectManager',
    history: {
      messages: [],
      apiKey: 'secret'
    }
  }));
});

test('runtime task file lists are rejected; exact persistent owner aliases remain rejected',()=>{
 assert.throws(()=>planCandidate({...candidate,tasks:[{...candidate.tasks[0],writeSet:['src/a.txt']}]}),/invalid_plan/u);
 assert.throws(()=>new ProjectFileOwners({projectId,version:'owners-v1',owners:[{resource:'src/a.txt',roleId:'Builder'},{resource:'SRC/A.TXT',roleId:'Editor'}]}),/duplicate_owner_alias/u);
 assert.equal(planCandidate({...candidate,tasks:[candidate.tasks[0],{...candidate.tasks[1],dependsOn:[]}]}).tasks.length,2);
});

test('versioned ownership transfer is part of persisted plan digest; old projects migrate to empty owners', () => {
  const original = projectDocument({ schemaVersion: 1, id: projectId, name: '客户项目',
    workspaceIdentity: identity, organizationVersion: 'customer-v1', manager: null,
    planRevision: 0, plan: null, context: { files: [], verifiedAt: null }, tasks: [] });
  assert.equal(original.fileOwners.version, 'owners-v0');
  assert.deepEqual(original.fileOwners.owners, []);
  const owners = new ProjectFileOwners({ projectId, version: 'owners-v2',
    owners: [{ resource: 'src/a.txt', roleId: 'Builder' }] });
  const nextCandidate = { schemaVersion:2, goal: '转交并编辑', roles: [{ id: 'Editor', name: '编辑', purpose: '修改', profileId: 'ai' }],
    tasks: [{ id: 'edit', title: '修改', roleId: 'Editor', profileId: 'ai', dependsOn: [],
      intent:'change', instruction: '修改已有文件' }],
    transfers: [{ resource: 'src/a.txt', fromRoleId: 'Builder', toRoleId: 'Editor' }] };
  const ownership = new FileOwnershipPlan({ projectId, baseVersion: owners.version,
    baseDigest: owners.digest, nextVersion: 'owners-v3',
    claims: [{ resource: 'src/a.txt', roleId: 'Editor' }], transfers: nextCandidate.transfers });
  const nextOwners = applyFileOwnershipPlan(owners, ownership);
  const withOwnership = { ...binding, revision: 3,
    fileOwnership: { projectId, baseVersion: ownership.baseVersion, baseDigest: ownership.baseDigest,
      nextVersion: ownership.nextVersion, claims: ownership.claims, transfers: ownership.transfers,
      nextDigest: nextOwners.digest } };
  const plan = boundPlan(nextCandidate, withOwnership);
  assert.equal(planDocument(plan).planDigest, plan.planDigest);
  assert.equal(plan.fileOwnership.transfers[0].fromRoleId, 'Builder');
  assert.notEqual(boundPlan({ ...nextCandidate, goal: '另一目标' }, withOwnership).planDigest, plan.planDigest);
  assert.equal(projectDocument({ ...original, fileOwners: nextOwners }).fileOwners.ownerOf('SRC/A.TXT'), 'Editor');
});

test('current model facts keep exact roles/current failures while full timeline and historical checks stay out of prompt', async () => {
  const { governedPromptDTO, boundedModelPrompt } = await import('../../src/models/workbench.mjs');
  const { createOrganization,createRoleProposalLedger }=await import('../../src/models/organization.mjs');
  const { createInteractionQueue }=await import('../../src/models/interaction.mjs');
  const id='a'.repeat(64),digest='b'.repeat(64);
  const result={requestId:'evidence-current',runId:'run-current',checkId:'unit',status:'failed',reason:'tests_failed',executed:true,exitCode:1,testCount:1,inputVersions:[{resource:'src.mjs',sha256:'c'.repeat(64),byteLength:8}],environment:{platform:'darwin',runtime:'node',runtimeVersion:'v24',isolation:'actual-no-child',network:'none'},startedAt:'2026-10-08T00:00:00.000Z',finishedAt:'2026-10-08T00:00:01.000Z',stdout:'failure '+ 'x'.repeat(4000),stderr:'',logsTruncated:false};
  const current={id:'evidence-current',authorization:{roleId:'Acceptance',taskId:'acceptance',planDigest:digest},result};
  const value={organization:createOrganization(id),ledger:createRoleProposalLedger(id),queue:createInteractionQueue(id),evidence:[{...current,id:'historical-check',authorization:{...current.authorization,planDigest:'d'.repeat(64)}},current],acceptances:[{id:'failure-current',planDigest:digest,taskId:'acceptance',decision:'fail',evidenceIds:['evidence-current'],issues:[{taskId:'development',resource:'src.mjs',roleId:'Builder',expected:'one',actual:'two',reproduction:'unit'}]}],repairs:[],timeline:{messages:[{text:'historical-only-'+ 'z'.repeat(70000)}],legacyMessages:[]}};
  const facts=governedPromptDTO(value,{planDigest:digest});assert.equal(facts.organization.digest,value.organization.digest);assert.equal(facts.acceptances[0].id,'failure-current');assert.equal(facts.evidence[0].id,'evidence-current');assert.equal(facts.evidence[0].result.summaryTruncated,true);assert.equal(facts.timeline,undefined);assert.equal(JSON.stringify(facts).includes('historical-only'),false);assert.equal(facts.historyOmitted.checks,1);assert.equal(facts.historyOmitted.timelineMessages,1);
  assert.ok(boundedModelPrompt(['guide',JSON.stringify(facts),'Human exact input']).length<65536);
});

test('total prompt cap rejects rather than truncating selected context or Human input; plain SDK projection is explicit', async () => {
 const { boundedModelPrompt,modelConversationHistory }=await import('../../src/models/workbench.mjs');
 assert.equal(boundedModelPrompt(['x'.repeat(65536)]).length,65536);assert.throws(()=>boundedModelPrompt(['required guide','Human selected context '+ 'x'.repeat(65536)]),{code:'prompt_budget'});
 const messages=Array.from({length:200},(_,index)=>({role:'user',text:'exact historical '+index}));const projection=modelConversationHistory({messages});assert.equal(projection.history.messages.length,128);assert.equal(projection.omittedMessages,72);assert.equal(projection.history.messages[0].text,'exact historical 72');assert.equal(messages.length,200);
});


import { projectConversationContext } from '../../src/models/workbench.mjs';
import { createConversationTimeline, importConversationHistory, beginConversationTurn, appendConversationText, finishConversationTurn, createInteractionQueue } from '../../src/models/interaction.mjs';

test('pending regression: checkpoint slices validated timeline before typed256 limit, keeps legacy Human facts and excludes nonPM data', () => {
  let timeline = importConversationHistory(createConversationTimeline(projectId), { messages: [{ role: 'user', text: '旧项目原始需求' }] }); timeline = beginConversationTurn(timeline, { turnId: 'long-turn', userMessageId: 'human-long', continuationAnswerId: null, text: '本次完整需求', createdAt: '2026-10-09T00:00:00.000Z' });
  for (let i = 0; i < 300; i += 1) timeline = appendConversationText(timeline, { turnId: 'long-turn', messageId: 'text-' + i, text: '实际段落' + i, createdAt: '2026-10-09T00:00:00.000Z' });
  timeline = finishConversationTurn(timeline, { turnId: 'long-turn', status: 'completed', assistantText: timeline.messages.filter((message) => message.kind === 'assistant').map((message) => message.text).join(''), messageId: 'complete-long', createdAt: '2026-10-09T00:00:00.000Z' });
  const context = projectConversationContext({ timeline, queue: createInteractionQueue(projectId), memberConversations: { events: [{ text: '绝不混作PM回复' }] } }); assert.equal(context.history.messages.length, 128); assert.equal(context.omittedMessages, 174); assert.equal(context.humanFacts[0].text, '旧项目原始需求'); assert.equal(context.humanFacts[0].orderKnown, false); assert.equal(context.humanFacts[0].sourceIndex, 0); assert.equal(context.history.messages.some((message) => message.text.includes('绝不混作')), false);
});

test('pending regression: cancelled65536 assistant stays complete in UI but never expands a typed SDK message; Human is not truncated', () => {
  let timeline = beginConversationTurn(createConversationTimeline(projectId), { turnId: 'cancel-turn', userMessageId: 'cancel-human', continuationAnswerId: null, text: '需要保留的真实需求', createdAt: '2026-10-09T00:00:00.000Z' }); const partial = 'x'.repeat(65536); timeline = appendConversationText(timeline, { turnId: 'cancel-turn', messageId: 'partial', text: partial, createdAt: '2026-10-09T00:00:00.000Z' }); timeline = finishConversationTurn(timeline, { turnId: 'cancel-turn', status: 'cancelled', assistantText: partial, messageId: 'cancel-final', createdAt: '2026-10-09T00:00:00.000Z' });
  const context = projectConversationContext({ timeline, queue: createInteractionQueue(projectId) }); assert.deepEqual(context.history.messages.map(({ role, text }) => ({ role, text })), [{ role: 'user', text: '需要保留的真实需求' }]); assert.equal(timeline.messages[1].text, partial); assert.equal(context.humanFacts[0].text, '需要保留的真实需求');
});


import { createInteraction, enqueueInteraction, answerQueuedInteraction, recordConversationQuestion, recordConversationAnswer } from '../../src/models/interaction.mjs';
test('pending regression: delegated a/b and discussion-confirmation facts retain exact question semantics and exclude old execution yes', () => {
  const at = '2026-10-09T00:00:00.000Z'; let timeline = beginConversationTurn(createConversationTimeline(projectId), { turnId: 'semantic-turn', userMessageId: 'semantic-human', continuationAnswerId: null, text: '选择真实技术方案', createdAt: at }); let queue = createInteractionQueue(projectId);
  for (const [order, kind, purpose, value] of [[1, 'choice', 'discussion', { optionId: 'a', text: '' }], [2, 'confirmation', 'discussion', true], [3, 'confirmation', 'execute_plan', true]]) {
    let options = []; let bindings = {}; let title = '确认运行方式'; let text = '确认使用本地Node服务而非远程执行？'; if (kind === 'choice') { options = [{ id: 'a', label: 'Node与TypeScript' }, { id: 'b', label: 'Swift原生实现' }]; title = '实现技术'; text = '实际要用哪一种技术？'; } if (purpose === 'execute_plan') { bindings = { planDigest: sha, organizationRevision: 1, organizationDigest: sha }; title = '旧执行许可'; text = '旧execute_plan授权不得恢复'; }
    const request = createInteraction({ requestId: 'semantic-' + order, projectId, version: 1, kind, purpose, title, text, options, allowSupplement: false, bindings, createdOrder: order, createdAt: at }, { roleId: 'ProjectManager', instanceId: 'semantic-pm', runId: 'semantic-turn', toolRequestId: 'semantic-tool-' + order }); queue = enqueueInteraction(queue, request); timeline = recordConversationQuestion(timeline, request, 'semantic-turn');
    queue = answerQueuedInteraction(queue, { requestId: request.requestId, projectId, version: 1, requestDigest: request.digest, answerId: 'semantic-answer-' + order, answeredAt: at, value }, { projectId, roleId: 'Human' }, bindings); timeline = recordConversationAnswer(timeline, queue.requests.at(-1));
  }
  const context = projectConversationContext({ timeline, queue }); const decisions = context.humanFacts.filter((fact) => fact.kind === 'answer'); assert.equal(decisions.length, 2); assert.equal(decisions[0].value.optionId, 'a'); assert.equal(decisions[0].question.kind, 'choice'); assert.equal(decisions[0].question.options.find((option) => option.id === 'a').label, 'Node与TypeScript'); assert.equal(decisions[1].value, true); assert.equal(decisions[1].question.kind, 'confirmation'); assert.equal(decisions[1].question.text, '确认使用本地Node服务而非远程执行？'); assert.equal(JSON.stringify(context.humanFacts).includes('旧execute_plan授权不得恢复'), false); assert.equal(JSON.stringify(context.history.messages).includes('旧执行许可'), false);
});

import { prepareRoleContext, roleContextSources, roleContextHistory, canonicalRolePins } from '../../src/models/workbench.mjs';
import { customerTimeline,createRoleMemories, saveRoleMemory, createMemberConversations, beginMemberConversation, appendMemberConversation, finishMemberConversation } from '../../src/models/interaction.mjs';
import { createOrganization } from '../../src/models/organization.mjs';
function memoryDomain(texts = []) { const at = '2026-10-09T00:00:00.000Z'; let timeline = createConversationTimeline(projectId); for (let i = 0; i < texts.length; i += 1) { timeline = beginConversationTurn(timeline, { turnId: 'mturn-' + i, userMessageId: 'mhuman-' + i, continuationAnswerId: null, text: texts[i], createdAt: at }); timeline = finishConversationTurn(timeline, { turnId: 'mturn-' + i, status: 'cancelled', assistantText: '', messageId: 'mf-' + i, createdAt: at }); } return { organization: createOrganization(projectId), customerTimeline:customerTimeline({...timeline,schemaVersion:2,actor:'Supervisor',digest:undefined}), timeline, queue: createInteractionQueue(projectId), memberConversations: createMemberConversations(projectId), roleMemories: createRoleMemories(projectId) }; }
test('role working context uses full validated sources, exact pins and total prompt+history limits', () => {
  const domain = memoryDomain(['原始需求', '第二轮决定']); const prep = prepareRoleContext(domain, 'Supervisor', '当前完整输入'); assert.equal(prep.withinBudget, true); assert.deepEqual(roleContextHistory(prep).messages.map((message) => message.text), ['原始需求', '第二轮决定']);
  assert.equal(canonicalRolePins(domain, 'Supervisor').role.purpose, domain.organization.members.find((member) => member.id === 'Supervisor').purpose);
  assert.throws(() => prepareRoleContext(domain, 'Supervisor', 'x'.repeat(65530)), { code: 'prompt_budget' }); assert.equal(domain.timeline.messages[0].text, '原始需求');
  const full = memoryDomain(['x'.repeat(65536)]); assert.equal(roleContextSources(full, 'Supervisor').sources[0].text.length, 65536); assert.throws(() => prepareRoleContext(full, 'Supervisor', 'pins'), { code: 'prompt_budget' });
});
test('automatic threshold keeps complete recent prefix/suffix and covered Human stays in summary without all-facts reinjection', () => {
  const domain = memoryDomain(Array.from({ length: 100 }, (_, i) => '第' + i + '项原始需求' + 'x'.repeat(500))); const prep = prepareRoleContext(domain, 'Supervisor', 'pins'); assert.equal(prep.needsCompaction, true); assert.ok(prep.retained.length <= 64); assert.ok(prep.retained.reduce((sum, message) => sum + message.text.length, 0) <= 16384);
  domain.roleMemories = saveRoleMemory(domain.roleMemories, { roleId: 'Supervisor', expectedRevision: 0, summary: '真实模型摘要记住较早需求', covered: prep.compactable.map(({ sourceId, sourceDigest }) => ({ sourceId, sourceDigest })), messages: prep.retained, sourceDigest: prep.sourceDigest, updatedAt: '2026-10-09T00:00:00.000Z' });
  const after = prepareRoleContext(domain, 'Supervisor', 'pins'); assert.equal(after.withinBudget, true); assert.equal(after.history[0].text.includes('模型生成的历史摘要'), true); assert.equal(after.history.some((message) => message.text === '第0项原始需求' + 'x'.repeat(500)), false); assert.equal(domain.timeline.messages.length, 100); assert.equal(after.messages.length, prep.retained.length);
  assert.equal(prepareRoleContext(domain, 'Supervisor', 'pins', 10000).estimatedTokens !== null, true); assert.equal(prepareRoleContext(domain, 'Supervisor', 'pins').estimatedTokens, null);
});
test('role sources isolate real member replies and preserve Human while excluding PM output and old execution yes', () => {
  const domain = memoryDomain(['所有角色共享真实Human需求']); const at = '2026-10-09T00:00:00.000Z';
  for (const roleId of ['RoleArchitect', 'Acceptance']) { const id = roleId + '-run'; domain.memberConversations = beginMemberConversation(domain.memberConversations, { id, roleId, taskId: 'task', instanceId: roleId + '-instance', runId: id, planDigest: null, startedAt: at }); domain.memberConversations = finishMemberConversation(domain.memberConversations, { conversationId: id, status: 'completed', assistantText: roleId + '自身真实回复', messageId: roleId + '-text', terminalId: roleId + '-end', reason: null, finishedAt: at }); }
  const architect = roleContextSources(domain, 'RoleArchitect'); assert.ok(architect.sources.some((source) => source.text === '所有角色共享真实Human需求')); assert.ok(architect.sources.some((source) => source.text === 'RoleArchitect自身真实回复')); assert.equal(JSON.stringify(architect).includes('Acceptance自身真实回复'), false); assert.equal(JSON.stringify(roleContextSources(domain, 'ProjectManager')).includes('RoleArchitect自身真实回复'), false);
  const changed = { ...domain, roleMemories: saveRoleMemory(domain.roleMemories, { roleId: 'RoleArchitect', expectedRevision: 0, summary: '摘要', covered: [{ sourceId: architect.sources[0].sourceId, sourceDigest: '0'.repeat(64) }], messages: [], sourceDigest: architect.sourceDigest, updatedAt: at }) }; assert.throws(() => prepareRoleContext(changed, 'RoleArchitect', 'pins'), { code: 'stale_role_memory' });
});

test('55000 complete prompt reserves current pins and summary wrapper before keeping recent6000-char messages', () => {
  const domain = memoryDomain(['a'.repeat(6000), 'b'.repeat(6000), 'c'.repeat(6000)]); const prep = prepareRoleContext(domain, 'Supervisor', 'p'.repeat(55000)); assert.equal(prep.needsCompaction, true); assert.equal(prep.compactable.length, 2); assert.equal(prep.retained.length, 1); assert.equal(prep.retained[0].text, 'c'.repeat(6000));
  domain.roleMemories = saveRoleMemory(domain.roleMemories, { roleId: 'Supervisor', expectedRevision: 0, summary: 'a、b两项较早真实需求摘要', covered: prep.compactable.map(({ sourceId, sourceDigest }) => ({ sourceId, sourceDigest })), messages: prep.retained, sourceDigest: prep.sourceDigest, updatedAt: '2026-10-09T00:00:00.000Z' });
  const after = prepareRoleContext(domain, 'Supervisor', 'p'.repeat(55000)); assert.equal(after.withinBudget, true); assert.equal(after.combinedChars < 65536, true); assert.equal(domain.timeline.messages.length, 3);
});

test('active Human and real answers stay complete outside old member compaction; required plus current pins over cap refuse', () => {
  const domain = memoryDomain(['旧原始需求']); const oldAt = '2026-10-09T00:00:00.000Z'; domain.memberConversations = beginMemberConversation(domain.memberConversations, { id: 'old-architect', roleId: 'RoleArchitect', taskId: 'role-design', instanceId: 'old-instance', runId: 'old-architect', planDigest: null, startedAt: oldAt }); domain.memberConversations = finishMemberConversation(domain.memberConversations, { conversationId: 'old-architect', status: 'completed', assistantText: '旧架构师原始回复' + 'x'.repeat(45000), messageId: 'old-text', terminalId: 'old-terminal', reason: null, finishedAt: oldAt });
  const latest = '本次Human完整新要求：必须精确保留所有细节' + 'y'.repeat(1000); domain.timeline = beginConversationTurn(domain.timeline, { turnId: 'active-pm', userMessageId: 'active-human', continuationAnswerId: null, text: latest, createdAt: '2026-10-09T00:00:01.000Z' });
  domain.customerTimeline=customerTimeline({...domain.timeline,schemaVersion:2,actor:'Supervisor',digest:undefined});const preparation = prepareRoleContext(domain, 'RoleArchitect', 'canonical-pins' + 'p'.repeat(6000)); assert.equal(preparation.needsCompaction, true); assert.ok(preparation.retained.some((message) => message.text === latest)); assert.equal(preparation.compactable.some((message) => message.text === latest), false); assert.equal(preparation.sources.at(-1).text, latest);
  assert.throws(() => prepareRoleContext(domain, 'RoleArchitect', 'p'.repeat(65000)), { code: 'prompt_budget' }); assert.equal(domain.timeline.messages.at(-1).text, latest);
});


test('completed latest PM requirement of18000 chars remains required for worker through previous source watermark', () => {
  const domain = memoryDomain(['此前已听需求']); const at = '2026-10-09T00:00:00.000Z'; domain.memberConversations = beginMemberConversation(domain.memberConversations, { id: 'worker-old', roleId: 'Acceptance', taskId: 'old-task', instanceId: 'worker-old-instance', runId: 'worker-old', planDigest: null, startedAt: at }); domain.memberConversations = finishMemberConversation(domain.memberConversations, { conversationId: 'worker-old', status: 'completed', assistantText: '此前本角色实际文字' + 'x'.repeat(45000), messageId: 'worker-old-text', terminalId: 'worker-old-end', reason: null, finishedAt: at }); const old = roleContextSources(domain, 'Acceptance'); domain.roleMemories = saveRoleMemory(domain.roleMemories, { roleId: 'Acceptance', expectedRevision: 0, summary: '', covered: [], messages: old.sources, sourceDigest: old.sourceDigest, updatedAt: at });
  const latest = '刚完成PM讨论的新需求原文' + 'z'.repeat(18000); domain.timeline = beginConversationTurn(domain.timeline, { turnId: 'completed-new-round', userMessageId: 'completed-human', continuationAnswerId: null, text: latest, createdAt: '2026-10-09T00:00:01.000Z' }); domain.timeline = finishConversationTurn(domain.timeline, { turnId: 'completed-new-round', status: 'completed', assistantText: '', messageId: 'completed-new-end', createdAt: '2026-10-09T00:00:02.000Z' });
  domain.customerTimeline=customerTimeline({...domain.timeline,schemaVersion:2,actor:'Supervisor',digest:undefined});const prep = prepareRoleContext(domain, 'Acceptance', 'current exact task/pins' + 'p'.repeat(6000)); assert.equal(prep.needsCompaction, true); assert.ok(prep.retained.some((message) => message.text === latest)); assert.equal(prep.compactable.some((message) => message.text === latest), false); assert.equal(prep.retained.some((message) => message.text.includes('此前本角色实际文字')), false);
  assert.throws(() => prepareRoleContext(domain, 'Acceptance', 'p'.repeat(50000)), { code: 'prompt_budget' }); assert.equal(domain.timeline.messages.at(-1).text, latest);
});

import { dependencyOutputMetadata, contentSha256 } from '../../src/models/workbench.mjs';
import { planArtifactScopes } from '../../src/models/workbench.mjs';
test('artifact kind is unambiguous across tasks; generated and deletion handoff contain observed metadata only', () => { assert.throws(()=>planArtifactScopes({tasks:[{artifactScopes:[{scope:'dist/',kind:'build'}]},{artifactScopes:[{scope:'dist/',kind:'dependencies'}]}]}),{code:'invalid_plan'});assert.deepEqual(planArtifactScopes({tasks:[{artifactScopes:[{scope:'dist/',kind:'build'}]},{artifactScopes:[{scope:'dist/',kind:'build'}]}]}),[{scope:'dist/',kind:'build'}]); const output=dependencyOutputMetadata([{resource:'dist',taskId:'parent',roleId:'Builder',action:'generated',contentDigest:null,generationDigest:'a'.repeat(64)},{resource:'old.bin',taskId:'parent',roleId:'Builder',action:'delete_file',contentDigest:'b'.repeat(64),byteLength:0,content:'never hand off body'}]);assert.equal(output[0].generationDigest,'a'.repeat(64));assert.equal(output[1].missing,true);assert.equal(output[1].contentDigest,null);assert.equal(JSON.stringify(output).includes('never hand off body'),false); });
test('check wire preserves explicit deletion absence and legacy present SHA, refusing every conflicting or unknown baseline', async () => {
  const {governedWireDTO}=await import('../../src/models/workbench.mjs');const {createOrganization}=await import('../../src/models/organization.mjs');
  const baseline={resource:'old.bin',state:'absent',sha256:null,byteLength:0};
  const value={organization:createOrganization('a'.repeat(64)),evidence:[{id:'e',roleId:'Acceptance',taskId:'t',planDigest:'b'.repeat(64),result:{checkId:'c',status:'passed',reason:'tests_passed',executed:true,testCount:1,exitCode:0,inputVersions:[baseline],stdout:'',stderr:'',startedAt:'2026-10-10T00:00:00.000Z',finishedAt:'2026-10-10T00:00:01.000Z',logsTruncated:false,environment:{platform:'darwin',runtime:'node',runtimeVersion:'24',isolation:'actual-no-child',network:'none'}}}]};
  assert.deepEqual(governedWireDTO(value).evidence[0].result.inputVersions,[baseline]);
  const present={resource:'old.bin',sha256:'c'.repeat(64)};value.evidence[0].result.inputVersions=[present];assert.deepEqual(governedWireDTO(value).evidence[0].result.inputVersions,[present]);
  for(const input of [{...present,sha256:null},{...present,state:'present',sha256:null},{...baseline,state:'missing'},{...baseline,state:undefined},{...baseline,sha256:'c'.repeat(64)},{...baseline,byteLength:1},{...baseline,executable:false},{...baseline,payload:'untrusted'},{...present,byteLength:-1}]){value.evidence[0].result.inputVersions=[input];assert.throws(()=>governedWireDTO(value));}
});
test('dependency handoff drops bodies, hashes actual UTF8 writes and retains only latest successful producer/action/SHA', () => {
  const body = '中文真实正文\n' + 'x'.repeat(30000); const base = { resource: 'src/shared.mjs', taskId: 'parent', roleId: 'Producer', action: 'write_file', proposalDigest: 'a'.repeat(64) };
  const write = dependencyOutputMetadata([{ ...base, content: body, contentDigest: 'a'.repeat(64) }]); assert.equal(write[0].contentDigest, contentSha256(body)); assert.notEqual(write[0].contentDigest, base.proposalDigest); assert.equal(write[0].content, undefined); assert.equal(JSON.stringify(write).includes('中文真实正文'), false);
  const after = dependencyOutputMetadata([{ ...base, content: body }, { ...base, content: '重复写入', proposalDigest: 'b'.repeat(64) }, { ...base, taskId: 'later-parent', action: 'edit_file', content: body, contentDigest: 'c'.repeat(64), proposalDigest: 'd'.repeat(64) }]); assert.equal(after.length, 1); assert.deepEqual(after[0], { resource: base.resource, taskId: 'later-parent', roleId: 'Producer', action: 'edit_file', contentDigest: 'c'.repeat(64), proposalDigest: 'd'.repeat(64) });
  const unknown = dependencyOutputMetadata([{ ...base, content: body }, { ...base, action: 'edit_file', contentDigest: null, content: '旧正文不代表edit后的状态' }]); assert.equal(unknown[0].contentDigest, null); assert.equal(unknown[0].action, 'edit_file'); assert.equal(unknown[0].content, undefined);
  let calls = 0; const invalid = { ...base }; Object.defineProperty(invalid, 'content', { get() { calls += 1; return body; } }); assert.throws(() => dependencyOutputMetadata([invalid])); assert.equal(calls, 0);
  assert.throws(() => dependencyOutputMetadata([{ ...base, resource: '../escape' }])); assert.throws(() => dependencyOutputMetadata([{ ...base, action: 'read_file' }])); assert.throws(() => dependencyOutputMetadata([{ ...base, content: { toString() { calls += 1; return body; } } }])); assert.equal(calls, 0);
});

test('runtime plan cannot self-report generated observations or restore v1 authorization',()=>{
 assert.throws(()=>planCandidate({...candidate,tasks:[{...candidate.tasks[0],generatedOutputs:[{resource:'dist',generationDigest:sha}]}]}),/invalid_plan/u);
 assert.throws(()=>planCandidate({...candidate,schemaVersion:1}),/invalid_plan/u);
});

test('current supervision projection is latest per phase, source-scoped and strips all private fields',async()=>{
 const {currentSupervisionDTO}=await import('../../src/models/workbench.mjs');
 const current={id:projectId,workspaceIdentity:identity,plan:{schemaVersion:2,planDigest:sha,tasks:[{id:'task'}]},tasks:[{id:'task',runId:'current-run',status:'completed',checkStatus:'passed',acceptanceStatus:'pass'}]};
 const record={projectId,planDigest:sha,phase:'monitor',status:'completed',advice:{phase:'monitor',planDigest:sha,recommendation:'proceed',findings:[{severity:'info',taskIds:['task'],sourceRefs:['check:current'],reason:'实际检查已完成'}]},instanceId:'PRIVATE_INSTANCE',runId:'PRIVATE_RUN',sourceDigests:[{id:'check:current',digest:'c'.repeat(64)}],rawText:'PRIVATE_RAW',knownKeys:['PRIVATE_KEY']};
 const value={organization:{projectId},supervisions:[{...record,planDigest:'b'.repeat(64)},{...record,projectId:'e'.repeat(64)},{...record,status:'not_completed',advice:null},record],memberConversations:{runs:[{id:'current-run',instanceId:'actual-instance'}]},evidence:[{id:'current',authorization:{workspaceIdentity:identity,planDigest:sha,taskId:'task'},result:{runId:'current-run',checkId:'unit',status:'passed'}},{id:'old-run',authorization:{workspaceIdentity:identity,planDigest:sha,taskId:'task'},result:{runId:'old-run',checkId:'unit',status:'passed'}},{id:'other-workspace',authorization:{workspaceIdentity:{...identity,fileId:'other'},planDigest:sha,taskId:'task'},result:{runId:'current-run',checkId:'unit',status:'passed'}}],acceptances:[{id:'current-accept',planDigest:sha,taskId:'task',instanceId:'actual-instance',decision:'pass'},{id:'other-instance',planDigest:sha,taskId:'task',instanceId:'other',decision:'pass'}]};
 const projected=currentSupervisionDTO(value,current);assert.equal(projected.length,1);assert.equal(projected[0].status,'completed');assert.deepEqual(projected[0].resultStates.checks.map(item=>item.id),['current']);assert.deepEqual(projected[0].resultStates.acceptances.map(item=>item.id),['current-accept']);
 assert.deepEqual(Object.keys(projected[0]).sort(),['advice','phase','planDigest','resultStates','status']);
 for(const forbidden of ['PRIVATE_','instanceId','runId','sourceDigests','knownKeys','rawText'])assert.equal(JSON.stringify(projected).includes(forbidden),false);
 const pending=currentSupervisionDTO(value,current,[{projectId,planDigest:sha,phase:'monitor'},{projectId,planDigest:'b'.repeat(64),phase:'preflight'}]);assert.equal(pending[0].status,'pending');assert.equal(pending[0].advice,null);
 assert.deepEqual(currentSupervisionDTO(value,{...current,plan:{...current.plan,planDigest:'d'.repeat(64)}}),[]);assert.deepEqual(currentSupervisionDTO(value,{...current,id:'e'.repeat(64)}),[]);
 value.supervisions.push({...record,status:'not_completed',advice:null});assert.equal(currentSupervisionDTO(value,current)[0].status,'failed');assert.equal(currentSupervisionDTO(value,current)[0].advice,null);
});
test('supervision wire accepts finite current-plan typed fields and rejects authority/raw/history injections',async()=>{
 const {governedWireDTO}=await import('../../src/models/workbench.mjs');const {createOrganization}=await import('../../src/models/organization.mjs');
 const row={planDigest:sha,phase:'preflight',status:'completed',advice:{recommendation:'revise',findings:[{severity:'warn',taskIds:['task'],sourceRefs:['human:source'],reason:'有限安全建议'}]},resultStates:{tasks:[{id:'task',status:'pending',checkStatus:'not_executed',acceptanceStatus:'pending'}],checks:[],acceptances:[]}};
 const value={organization:createOrganization(projectId),plan:{planDigest:sha},supervisions:[row]};
 assert.deepEqual(governedWireDTO(value).supervisions,[row]);
 for(const bad of [{...row,rawText:'private'},{...row,instanceId:'private'},{...row,status:'grant'},{...row,planDigest:'b'.repeat(64)},{...row,status:'pending'}, {...row,advice:{...row.advice,knownKeys:['private']}}]){
  assert.throws(()=>governedWireDTO({...value,supervisions:[bad]}));
 }
 assert.throws(()=>governedWireDTO({...value,supervisions:[row,row]}));
 assert.deepEqual(governedWireDTO({...value,plan:null}).supervisions,[]);
});

test('member source content digest stays stable when Su completes while required Human coverage remains enforced',()=>{
 const domain=memoryDomain([]),at='2026-10-11T00:00:00.000Z';domain.timeline=beginConversationTurn(domain.timeline,{turnId:'live-Su',userMessageId:'real-Human',continuationAnswerId:null,text:'完整真实Human不能因轮次结束失去覆盖',createdAt:at});domain.customerTimeline=customerTimeline({...domain.timeline,schemaVersion:2,actor:'Supervisor',digest:undefined});const before=roleContextSources(domain,'RoleArchitect');
 domain.timeline=finishConversationTurn(domain.timeline,{turnId:'live-Su',status:'completed',assistantText:'Su解释原文',messageId:'Su-completed',createdAt:at});domain.customerTimeline=customerTimeline({...domain.timeline,schemaVersion:2,actor:'Supervisor',digest:undefined});const after=roleContextSources(domain,'RoleArchitect');assert.equal(after.sourceDigest,before.sourceDigest);assert.deepEqual(after.sources,before.sources);const prepared=prepareRoleContext(domain,'RoleArchitect','当前canonical完整输入');assert.ok(prepared.retained.some(source=>source.text==='完整真实Human不能因轮次结束失去覆盖'));assert.throws(()=>prepareRoleContext(domain,'RoleArchitect','x'.repeat(65535)),{code:'prompt_budget'});
});
test('customer projection hides the entire private member journal while paged action facts retain provenance',async()=>{
 const {publicMemberJournal,roleLogPage,projectFactsPage,projectOutputsPage}=await import('../../src/models/workbench.mjs');
 const at='2026-10-12T00:00:00.000Z',runId='private-run',planDigest='b'.repeat(64);
 let journal=beginMemberConversation(createMemberConversations(projectId),{id:runId,roleId:'Builder',taskId:'build',instanceId:'builder-instance',runId,planDigest,startedAt:at});
 for(const event of [
  {id:'brief',kind:'host_briefing',text:'private-host-briefing',tool:null,requestId:null,resource:null,checkId:null,status:null,reason:null,digest:null},
  {id:'action',kind:'tool_request',text:'',tool:'legion_read_file',requestId:'request-one',resource:'src/a.mjs',checkId:null,status:null,reason:null,digest:null},
  {id:'answer',kind:'assistant_text',text:'private-member-answer',tool:null,requestId:null,resource:null,checkId:null,status:null,reason:null,digest:null}
 ]) journal=appendMemberConversation(journal,{...event,conversationId:runId,createdAt:at});
 const publicJournal=publicMemberJournal(journal);assert.equal(publicJournal.events.length,0);assert.equal(publicJournal.runs.length,0);assert.equal(JSON.stringify(publicJournal).includes('private-'),false);
 const project={id:projectId,plan:{planDigest},tasks:[{id:'build',roleId:'Builder',runId,results:[{resource:'src/a.mjs',status:'written',action:'write_file',success:true,observedMutation:true,auditFailed:false,reason:'written',contentDigest:sha},{resource:'src/b.mjs',status:'denied',action:'write_file',success:false,observedMutation:false,auditFailed:false,reason:'unowned_file',contentDigest:null}],generatedOutputs:[{resource:'dist',generationDigest:'c'.repeat(64)}]}]};
 const domain={memberConversations:journal,evidence:[],acceptances:[],shellWorkflow:{requests:[]}};
 const log=roleLogPage(domain,project,{roleId:'Builder',limit:1});assert.equal(log.events.length,1);assert.equal(log.events[0].tool,'legion_read_file');assert.equal(JSON.stringify(log).includes('private-'),false);
 const first=projectFactsPage(domain,project,{kind:'changes',limit:1});assert.equal(first.items.length,1);assert.ok(first.nextCursor);assert.equal(first.items[0].sourceRef.startsWith('task-result:'),true);
 const second=projectFactsPage(domain,project,{kind:'changes',limit:1,cursor:first.nextCursor});assert.equal(second.items[0].status,'denied');
 assert.throws(()=>projectFactsPage(domain,{...project,tasks:[{...project.tasks[0],results:[]}]},{kind:'changes',cursor:first.nextCursor}),{code:'stale_cursor'});
 const output=projectOutputsPage(domain,project,{}, {'dist/':'c'.repeat(64)});assert.equal(output.items[0].status,'current');
});
