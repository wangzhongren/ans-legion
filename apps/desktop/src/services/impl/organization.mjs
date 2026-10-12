import { assertKnownKeyFree } from '../../models/workbench.mjs';
import { registeredMemorySource,sensitiveMemoryText } from '../../models/memory.mjs';
import { legacyOrganizationDocument,previousOrganizationDocument,FIXED_ROLE_DUTIES } from '../../models/organization.mjs';
import { customerTimeline,createCustomerTimeline,updateCustomerTimeline,delegationJournal,createDelegations,memoryChannel,supervisionRecord } from '../../models/interaction.mjs';
import { createOrganizationProvider } from '../../providers/public/organization.mjs';
import { organizationServiceOptions } from '../abstract/organization.mjs';
import { exactObject, immutable, identifier, textValue } from '../../models/desktop.mjs';
import { organizationDocument, migrateLegacyOrganization, createOrganization, createRoleProposalLedger,
  roleProposalLedgerDocument, submitRoleProposal, reviewQueuedRoleProposal, approvedRoleDocument } from '../../models/organization.mjs';
import { createInteraction, createInteractionQueue, interactionQueueDocument, enqueueInteraction,
  answerQueuedInteraction, invalidateInteraction, conversationTimeline, createConversationTimeline, importConversationHistory, beginConversationTurn, appendConversationText, recordConversationQuestion, recordConversationAnswer, finishConversationTurn, interruptConversationTurns, conversationTurnPhase, memberConversations, createMemberConversations, beginMemberConversation, appendMemberConversation, finishMemberConversation, interruptMemberConversations, roleMemoriesDocument, createRoleMemories, saveRoleMemory as updateRoleMemory, shellWorkflowDocument, createShellWorkflow, enqueueShellWorkflow, updateShellWorkflow, interruptShellWorkflow } from '../../models/interaction.mjs';
import { roleLogPage,roleActivityFacts,roleContextSources, roleRequiredSourceIds, recoveryRetainedFact } from '../../models/workbench.mjs';
import { CheckResult, CheckAuthorization, CheckSpec, digestValue } from 'legion-runtime/workbench-models';
function fail(code, checkStatus = null) { const error = new Error(code); error.code = code; if (checkStatus !== null) error.checkStatus = checkStatus; throw error; }
function actor(value, projectId, roleId) {
  exactObject(value, ['projectId', 'roleId', 'instanceId']); identifier(value.instanceId);
  if (value.projectId !== projectId || value.roleId !== roleId) fail('actor_forbidden');
}
function initial(project) {
  let organization = createOrganization(project.id);
  if (project.plan || project.fileOwners.owners.length) organization = migrateLegacyOrganization(project.id, {
    members: (project.plan?.roles ?? []).map(({id, name}) => ({id, name})), fileOwners: project.fileOwners.owners });
  return { schemaVersion: 2, projectId: project.id, revision: 0, organization,
    customerTimeline:createCustomerTimeline(project.id),delegations:createDelegations(project.id),legacyRoleMemories:null,ledger: createRoleProposalLedger(project.id), queue: createInteractionQueue(project.id), evidence: [], acceptances: [], repairs: [], timeline: createConversationTimeline(project.id), memberConversations: createMemberConversations(project.id), roleMemories: createRoleMemories(project.id), shellWorkflow: createShellWorkflow(project.id) };
}
function document(raw,legacy=false) {
  exactObject(raw, ['schemaVersion', 'projectId', 'revision', 'organization', 'ledger', 'queue', 'evidence', 'acceptances', 'repairs', 'timeline', 'memberConversations', 'roleMemories', 'shellWorkflow','supervisions','memorySourceHistory','customerTimeline','delegations','legacyRoleMemories', 'digest']);
  if (![1,2].includes(raw.schemaVersion) || !Number.isSafeInteger(raw.revision) || raw.revision < 0) fail('organization_corrupt');
  if(raw.schemaVersion===1){
    if(raw.customerTimeline!==undefined||raw.delegations!==undefined||raw.legacyRoleMemories!==undefined)fail('organization_corrupt');
    if(raw.roleMemories&&(raw.roleMemories.schemaVersion!==1||raw.roleMemories.entries.some(entry=>entry.channel!==undefined)))fail('organization_corrupt');
    if(raw.memberConversations?.runs.some(run=>run.roleId==='ProjectManager'||run.channel!==undefined)||raw.queue?.requests.some(request=>request.origin.roleId!=='ProjectManager'))fail('organization_corrupt');
  }
  let organization;if(legacy)organization=legacyOrganizationDocument(raw.organization);else organization=raw.schemaVersion===1?previousOrganizationDocument(raw.organization):organizationDocument(raw.organization);const ledger=roleProposalLedgerDocument(raw.ledger),queue=interactionQueueDocument(raw.queue);
  if(!Array.isArray(raw.memorySourceHistory??[])||(raw.memorySourceHistory??[]).length>1024)fail('memory_source_budget');
  if ([organization, ledger, queue].some((item) => item.projectId !== raw.projectId)) fail('organization_corrupt');
  for (const key of ['evidence', 'acceptances', 'repairs']) if (!Array.isArray(raw[key]) || raw[key].length > 512) fail('organization_budget');
  const evidence = raw.evidence.map((value) => {
    exactObject(value, ['id', 'authorization', 'result','outputRevision','inputEpoch']); identifier(value.id);
    const authorization = new CheckAuthorization(value.authorization), result = new CheckResult(value.result);
    const spec = authorization.approvedChecks.find((item) => item.checkId === result.checkId);
    if (value.id !== result.requestId || result.authorizationDigest !== authorization.digest || result.runId !== authorization.runId) fail('evidence_binding_mismatch');
    if (spec && result.specDigest !== spec.digest) fail('evidence_binding_mismatch');
    if (!spec && (result.executed || result.status !== 'error' || result.specDigest !== digestValue({ checkId: result.checkId }))) fail('evidence_binding_mismatch');
    if(value.inputEpoch!==undefined&&(typeof value.inputEpoch!=='string'||!/^[a-f0-9]{64}$/u.test(value.inputEpoch)))fail('organization_corrupt');
    const entry={id:value.id,authorization,result};if(value.outputRevision!==undefined)entry.outputRevision=value.outputRevision;if(value.inputEpoch!==undefined)entry.inputEpoch=value.inputEpoch;return entry;
  });
  const fields = { schemaVersion: raw.schemaVersion, projectId: raw.projectId, revision: raw.revision, organization, ledger, queue, evidence,
    acceptances: raw.acceptances, repairs: raw.repairs, timeline: conversationTimeline(raw.timeline ?? createConversationTimeline(raw.projectId)), memberConversations: memberConversations(raw.memberConversations ?? createMemberConversations(raw.projectId)), roleMemories: roleMemoriesDocument(raw.roleMemories ?? createRoleMemories(raw.projectId)), shellWorkflow: shellWorkflowDocument(raw.shellWorkflow ?? createShellWorkflow(raw.projectId)),supervisions:(raw.supervisions??[]).map(supervisionRecord),memorySourceHistory:(raw.memorySourceHistory??[]).map(registeredMemorySource) };
  if(raw.schemaVersion===2){fields.customerTimeline=customerTimeline(raw.customerTimeline);fields.delegations=delegationJournal(raw.delegations);fields.legacyRoleMemories=raw.legacyRoleMemories===null?null:roleMemoriesDocument(raw.legacyRoleMemories);if(fields.customerTimeline.projectId!==raw.projectId||fields.delegations.projectId!==raw.projectId)fail('organization_corrupt');}
  if (fields.roleMemories.projectId !== raw.projectId) fail('invalid_role_memory');
  if (fields.memberConversations.projectId !== raw.projectId) fail('member_project_mismatch');
  for (const message of [...fields.timeline.messages,...(fields.customerTimeline?.messages??[])]) {
    if (!['question','answer'].includes(message.kind)) continue;
    const request = queue.requests.find((item)=>item.requestId===message.requestId); if(!request) fail('conversation_request_mismatch');
    if (message.kind==='answer' && request.answer?.answerId!==message.answerId) fail('conversation_answer_mismatch');
    if (request.origin.runId!==null && message.turnId!==null && request.origin.runId!==message.turnId) fail('conversation_turn_mismatch');
  }
  const digest = digestValue(fields);
  const legacyFields = { ...fields };if(raw.supervisions===undefined)delete legacyFields.supervisions;if(raw.memorySourceHistory===undefined)delete legacyFields.memorySourceHistory; if (raw.timeline === undefined) delete legacyFields.timeline; if (raw.memberConversations === undefined) delete legacyFields.memberConversations; if (raw.roleMemories === undefined) delete legacyFields.roleMemories; if (raw.shellWorkflow === undefined) delete legacyFields.shellWorkflow; const expected = digestValue(legacyFields);
  if (raw.digest !== undefined && expected !== raw.digest) fail('organization_corrupt');
  return immutable({ ...fields, digest });
}
export class OrganizationServiceImpl {
  #knownSecrets = new Set(); #provider; #tail = Promise.resolve(); #closed = false;
  constructor(options, provider = null) { this.#provider = provider ?? createOrganizationProvider(organizationServiceOptions(options)); }
  async load(project, knownSecrets = []) {
    for (const key of knownSecrets) this.#knownSecrets.add(key);
    assertKnownKeyFree(project, this.#knownSecrets);
    await this.#tail; if (this.#closed) fail('closed');
    const stored = await this.#provider.read(project.id, project.workspaceIdentity, [...this.#knownSecrets]);
    if(stored!==null)return document(stored,!stored.organization?.members?.some(member=>member.id==='Supervisor'));
    const created = document(initial(project));
    try { return document(await this.#provider.write(created, project.workspaceIdentity, null, null, null, [...this.#knownSecrets])); }
    catch (error) { if (error.code !== 'stale_organization') throw error; return document(await this.#provider.read(project.id, project.workspaceIdentity, [...this.#knownSecrets])); }
  }
  async migrate(project,knownSecrets=[],signal=null){
    for(const key of knownSecrets)this.#knownSecrets.add(key);
    await this.#tail;const raw=await this.#provider.read(project.id,project.workspaceIdentity,[...this.#knownSecrets]);
    if(raw===null||raw.schemaVersion===2)return this.load(project,knownSecrets);
    const old=document(raw,!raw.organization?.members?.some(member=>member.id==='Supervisor'));
    const base=createOrganization(project.id);const oldSu=old.organization.members.find(member=>member.id==='Supervisor');const su=base.members.find(member=>member.id==='Supervisor');
    const organization=organizationDocument({...old.organization,members:[...old.organization.members.filter(member=>member.id!=='Supervisor'),{...su,revision:(oldSu?.revision??0)+1}],revision:old.organization.revision+1,digest:undefined});
    const requests=old.queue.requests.map(request=>request.status==='pending'?invalidateInteraction(request,'organization_changed'):request);
    const next=document({...old,schemaVersion:2,organization,customerTimeline:createCustomerTimeline(project.id),delegations:createDelegations(project.id),legacyRoleMemories:old.roleMemories,roleMemories:createRoleMemories(project.id),memberConversations:interruptMemberConversations(old.memberConversations),shellWorkflow:interruptShellWorkflow(old.shellWorkflow),queue:interactionQueueDocument({...old.queue,requests,revision:old.queue.revision+1,digest:undefined}),revision:old.revision+1,digest:undefined});
    if(signal?.aborted)fail('stale_action');return document(await this.#provider.write(next,project.workspaceIdentity,raw.digest??null,signal,null,[...this.#knownSecrets]));
  }
  #mutate(project, action, signal = null) {
    if (signal !== null && !(signal instanceof AbortSignal)) fail('invalid_signal');
    const pending = this.#tail.then(async () => {
      if (this.#closed) fail('closed'); if (signal?.aborted) fail('stale_action');
      const raw = await this.#provider.read(project.id, project.workspaceIdentity, [...this.#knownSecrets]);
      const current = assertKnownKeyFree(document(raw ?? initial(project)), this.#knownSecrets); if(current.schemaVersion!==2)fail('organization_migration_required'); const next = assertKnownKeyFree(await action(current), this.#knownSecrets);
      if (next === current) return current;
      if (signal?.aborted) fail('stale_action');
      const checked = document({ ...next, revision: current.revision + 1, digest: undefined });
      return document(await this.#provider.write(checked, project.workspaceIdentity, raw?.digest ?? null, signal, null, [...this.#knownSecrets]));
    }); this.#tail = pending.then(() => undefined, () => undefined); return pending;
  }
  async queryRoleLog(project,input,trustedActor){actor(trustedActor,project.id,'Supervisor');const state=await this.load(project);if(state.schemaVersion!==2)fail('organization_migration_required');return assertKnownKeyFree(roleLogPage(state,project,input),this.#knownSecrets);}
  async queryRoleActivity(project,input,trustedActor){actor(trustedActor,project.id,'Supervisor');return assertKnownKeyFree(roleActivityFacts(await this.load(project),project,input),this.#knownSecrets);}
  async inspectRoleLog(project,input,knownSecrets=[]){const state=await this.load(project,knownSecrets);if(state.schemaVersion!==2)fail('organization_migration_required');return assertKnownKeyFree(roleLogPage(state,project,input),this.#knownSecrets);}
  async inspectRoleActivity(project,input,knownSecrets=[]){return assertKnownKeyFree(roleActivityFacts(await this.load(project,knownSecrets),project,input),this.#knownSecrets);}
  saveDelegation(project,entry,trustedActor,signal=null){actor(trustedActor,project.id,'Supervisor');return this.#mutate(project,state=>{const previous=state.delegations.entries.find(item=>item.id===entry.id);if(previous&&previous.bindings.customerInstanceId!==trustedActor.instanceId)fail('actor_forbidden');const next=delegationJournal({...state.delegations,entries:[...state.delegations.entries.filter(item=>item.id!==entry.id),entry],revision:state.delegations.revision+1,digest:undefined});return {...state,delegations:next};},signal);}
  invalidateCustomerTurn(project,turnId,trustedActor){actor(trustedActor,project.id,'Supervisor');return this.#mutate(project,state=>{const requests=state.queue.requests.map(request=>request.status==='pending'&&request.purpose==='discussion'&&request.origin.roleId==='Supervisor'&&request.origin.instanceId===trustedActor.instanceId&&request.origin.runId===turnId?invalidateInteraction(request,'human_cancelled'):request);return {...state,queue:interactionQueueDocument({...state.queue,requests,revision:state.queue.revision+1,digest:undefined})};});}
  submitProposal(project, input, trustedActor, signal = null) {
    return this.#mutate(project, (state) => ({ ...state,
      ledger: submitRoleProposal(state.ledger, state.organization, input, trustedActor) }), signal);
  }
  reviewProposal(project, input, trustedActor, signal = null) {
    return this.#mutate(project, (state) => {
      const result = reviewQueuedRoleProposal(state.ledger, state.organization, input, trustedActor);
      let queue = state.queue;
      if (result.organization.digest !== state.organization.digest) {
        const requests = queue.requests.map((request) => { if (request.status === 'pending' && request.bindings.organizationDigest !== undefined && request.bindings.organizationDigest !== result.organization.digest) return invalidateInteraction(request, 'organization_changed'); return request; });
        if (digestValue(requests) !== digestValue(queue.requests)) queue = interactionQueueDocument({ ...queue, requests, revision: queue.revision + 1, digest: undefined });
      }
      return { ...state, ...result, queue };
    }, signal);
  }
  async validatePublication(project, resource, contentDigest, trustedActor) {
    const state = await this.load(project);
    for (const proposal of [...state.ledger.proposals].reverse()) {
      if (proposal.status !== 'approved') continue;
      if (!proposal.members.some((member) => member.documents.some((item) => item.resource === resource && item.contentDigest === contentDigest))) continue;
      return approvedRoleDocument(state.organization, proposal, { proposalId: proposal.id, version: proposal.version, digest: proposal.digest, resource, contentDigest }, trustedActor);
    }
    fail('document_not_approved');
  }
  async validatePlan(project, plan) {
    const state = await this.load(project);
    if(plan.schemaVersion!==2||plan.tasks.some(task=>Object.hasOwn(task,'writeSet')||!['change','verify'].includes(task.intent)))fail('invalid_plan');
    if (!plan.governance || plan.governance.organizationDigest !== state.organization.digest || plan.governance.organizationRevision !== state.organization.revision) fail('approved_organization_required');
    for (const role of plan.roles) {
      const member = state.organization.members.find((item) => item.id === role.id);
      if (!member?.enabled || member.status !== 'approved' || role.revision !== member.revision || role.digest !== member.digest || role.name !== member.name || role.purpose !== member.purpose) fail('approved_role_required');
    }
    for (const transfer of plan.transfers ?? []) {
      if (!state.ledger.proposals.some((proposal) => proposal.status === 'approved' && (proposal.transfers ?? []).some((item) => digestValue(item) === digestValue(transfer)))) fail('approved_transfer_required');
    }
    for (const task of plan.tasks) {
      const member = state.organization.members.find((item) => item.id === task.roleId);
      if(!member?.enabled||member.status!=='approved')fail('approved_role_required');
      if (!task.checks?.length) fail('task_checks_required');
      for (const spec of task.checks) new CheckSpec(spec);

    }
    const acceptance = plan.tasks.filter((task) => task.roleId === 'Acceptance');
    const development = plan.tasks.filter((task) => !['Acceptance', 'RoleArchitect'].includes(task.roleId));
    for (const task of acceptance) if (!task.accepts?.length || new Set(task.accepts).size !== task.accepts.length || task.accepts.some((id) => !development.some((item) => item.id === id) || !task.dependsOn.includes(id))) fail('acceptance_coverage_required');
    if (development.length && !acceptance.length) fail('independent_acceptance_required');
    for (const task of development) if (!acceptance.some((check) => check.accepts?.includes(task.id) && check.dependsOn.includes(task.id))) fail('acceptance_coverage_required');
    return state;
  }
  captureMemorySources(project,secrets=[],signal=null){
    return this.#mutate(project,state=>{
      const history=[...state.memorySourceHistory],add=(id,type,ownerRoleId,values,label)=>{if(values.some(value=>sensitiveMemoryText(value,secrets)))return;const record={id,projectId:project.id,type,ownerRoleId,values,label,status:'active',digest:digestValue({projectId:project.id,id,type,ownerRoleId,values,status:'active'})};const old=history.find(item=>item.id===id);if(old){if(old.digest!==record.digest&&type!=='task_failure')fail('memory_source_conflict');return;}history.push(record);};
      if(project.plan?.schemaVersion===2&&state.queue.requests.some(request=>request.purpose==='execute_plan'&&request.status==='answered'&&request.answer?.value===true&&request.bindings.planDigest===project.plan.planDigest))add('plan:'+project.plan.planDigest,'confirmed_plan',null,[project.plan.goal],'Confirmed plan '+project.plan.planDigest.slice(0,12));
      for(const task of project.tasks??[])if(task.status==='failed'&&task.runId)add('failure:'+task.id+':'+task.runId,'task_failure',task.roleId,[`task:${task.id} reason:${task.error?.code??'task_failed'}`],'Task failure '+task.id);
      if(history.length>1024)fail('memory_source_budget');if(history.length===state.memorySourceHistory.length)return state;return {...state,memorySourceHistory:history};
    },signal);
  }
  async memorySources(project){
    const state=await this.load(project),sources=[...state.memorySourceHistory];
    const add=(id,type,ownerRoleId,values,label,status='active')=>{if(sources.some(item=>item.id===id))return;sources.push({id,projectId:project.id,type,ownerRoleId,values,label,status,digest:digestValue({projectId:project.id,id,type,ownerRoleId,values,status})});};
    for(const message of [...state.timeline.messages,...(state.customerTimeline?.messages??[])])if(message.kind==='human'&&[...state.timeline.turns,...(state.customerTimeline?.turns??[])].some(turn=>turn.userMessageId===message.id))add('human:'+message.id,'human',null,[message.text],'Human input '+message.id);
    for(const request of state.queue.requests)if(request.status==='answered'&&request.answer){const values=[JSON.stringify(request.answer.value)];let type='answer';if(typeof request.answer.value==='string'){values.push(request.answer.value);type='preference_answer';}else if(request.answer.value&&typeof request.answer.value==='object'){const option=request.options.find(item=>item.id===request.answer.value.optionId);if(option)values.push(option.label);if(request.answer.value.text)values.push(request.answer.value.text);type='preference_answer';}add('answer:'+request.answer.answerId,type,null,values,'Human answer '+request.requestId);}
    if(project.plan?.schemaVersion===2){let type='draft_plan';if(state.queue.requests.some(request=>request.purpose==='execute_plan'&&request.status==='answered'&&request.answer?.value===true&&request.bindings.planDigest===project.plan.planDigest))type='confirmed_plan';add('plan:'+project.plan.planDigest,type,null,[project.plan.goal],'Plan '+project.plan.planDigest.slice(0,12));}
    add('organization:'+state.organization.digest,'organization',null,[JSON.stringify({revision:state.organization.revision,roles:state.organization.members.map(member=>member.id)})],'Current organization');
    for(const entry of state.evidence){let type='check_result';if(entry.result.status!=='passed')type='check_failure';add('check:'+entry.id,type,entry.authorization.roleId,[`check:${entry.result.checkId} status:${entry.result.status} reason:${entry.result.reason}`],'Check '+entry.result.checkId);}
    for(const entry of state.acceptances)if(entry.decision==='pass')add('acceptance:'+entry.id,'acceptance_result','Acceptance',[JSON.stringify({taskId:entry.taskId,decision:entry.decision,evidenceIds:entry.evidenceIds})],'Acceptance '+entry.taskId);
    for(const entry of state.acceptances)if(entry.decision==='fail')for(const [index,issue]of entry.issues.entries())add('acceptance:'+entry.id+':'+index,'acceptance_issue',issue.roleId,[JSON.stringify({taskId:issue.taskId,resource:issue.resource,expected:issue.expected,actual:issue.actual,reproduction:issue.reproduction})],'Acceptance issue '+issue.taskId);
    const activity=roleActivityFacts(state,project);for(const task of activity.tasks)add(task.sourceRef,'task_status',task.roleId,[JSON.stringify(task)],'Current task '+task.id);
    for(const event of state.memberConversations.events)if(!['assistant_text','host_briefing'].includes(event.kind)){const run=state.memberConversations.runs.find(item=>item.id===event.conversationId);add('journal:'+event.id,'action',run.roleId,[JSON.stringify({kind:event.kind,tool:event.tool,status:event.status,reason:event.reason,resource:event.resource,checkId:event.checkId})],'Action '+event.id);}
    for(const task of project.tasks??[])if(task.status==='failed')add('failure:'+task.id+':'+task.runId,'task_failure',task.roleId,[`task:${task.id} reason:${task.error?.code??'task_failed'}`],'Task failure '+task.id);
    return {projectId:project.id,roles:state.organization.members.filter(member=>member.enabled).map(member=>member.id),sources};
  }
  recordSupervision(project,input,trustedActor,signal=null){actor(trustedActor,project.id,'Supervisor');const entry=supervisionRecord(input);if(entry.instanceId!==trustedActor.instanceId||entry.projectId!==project.id||entry.planDigest!==project.plan?.planDigest)fail('stale_supervision');return this.#mutate(project,state=>{if(entry.organizationDigest!==state.organization.digest)fail('stale_supervision');return {...state,supervisions:[...state.supervisions,entry].slice(-256)};},signal);}
  enqueue(project, input, origin, turnId = null) {
    return this.#mutate(project, (state) => { const request = createInteraction(input, origin); let timeline=updateCustomerTimeline(state.customerTimeline,recordConversationQuestion,request,turnId); if(turnId!==null && origin.runId!==null) timeline=updateCustomerTimeline(timeline,conversationTurnPhase,turnId,'waiting'); return { ...state, queue: enqueueInteraction(state.queue, request), customerTimeline:timeline }; });
  }
  answer(project, input, human, bindings) {
    return this.#mutate(project, (state) => {
      const queue = answerQueuedInteraction(state.queue, input, human, bindings);
      if (queue.digest === state.queue.digest) return state;
      const request = queue.requests.find((item) => item.requestId === input.requestId);
      return { ...state, queue, customerTimeline: updateCustomerTimeline(state.customerTimeline,recordConversationAnswer,request) };
    });
  }
  invalidate(project, reason, executionOnly = false) {
    return this.#mutate(project, (state) => {
      const requests = state.queue.requests.map((request) => {
        if (request.status !== 'pending' || (executionOnly && request.purpose !== 'execute_plan')) return request;
        return invalidateInteraction(request, reason);
      });
      if (digestValue(requests) === digestValue(state.queue.requests)) return state;
      return { ...state, queue: interactionQueueDocument({ ...state.queue, requests, revision: state.queue.revision + 1, digest: undefined }) };
    });
  }
  seedConversation(project, history) {
    return this.#mutate(project, (state) => {
      let timeline = importConversationHistory(state.timeline, {messages:history.messages});
      timeline = interruptConversationTurns(timeline);
      const members = interruptMemberConversations(state.memberConversations);
      const interrupted=state.delegations.entries.filter(entry=>['running','awaiting_human'].includes(entry.status));const entries=state.delegations.entries.map(entry=>interrupted.includes(entry)?{...entry,status:'stale'}:entry);
      const delegations=interrupted.length?delegationJournal({...state.delegations,entries,revision:state.delegations.revision+1,digest:undefined}):state.delegations;
      const requests=state.queue.requests.map(request=>request.status==='pending'&&interrupted.some(entry=>entry.question?.publicRequestId===request.requestId)?invalidateInteraction(request,'run_cancelled'):request);const queue=digestValue(requests)===digestValue(state.queue.requests)?state.queue:interactionQueueDocument({...state.queue,requests,revision:state.queue.revision+1,digest:undefined});
      const customer=updateCustomerTimeline(state.customerTimeline,interruptConversationTurns);
      if (timeline.digest === state.timeline.digest && members.digest === state.memberConversations.digest&&customer.digest===state.customerTimeline.digest&&delegations===state.delegations&&queue===state.queue) return state;
      return { ...state, timeline, customerTimeline:customer,delegations,queue,memberConversations: members };
    });
  }
  resumeTurn(project, turnId) { return this.#mutate(project,(state)=>({...state,customerTimeline:updateCustomerTimeline(state.customerTimeline,conversationTurnPhase,turnId,'running')})); }
  beginTurn(project, input) { return this.#mutate(project, (state) => ({ ...state, customerTimeline: updateCustomerTimeline(state.customerTimeline,beginConversationTurn, input) })); }
  appendText(project, input) { return this.#mutate(project, (state) => ({ ...state, customerTimeline: updateCustomerTimeline(state.customerTimeline,appendConversationText, input) })); }
  finishTurn(project, input) { return this.#mutate(project, (state) => ({ ...state, customerTimeline: updateCustomerTimeline(state.customerTimeline,finishConversationTurn, input) })); }
  beginMemberRun(project, input, trustedActor, signal) {
    actor(trustedActor, project.id, input.roleId); if (trustedActor.instanceId !== input.instanceId) fail('member_actor_mismatch');
    return this.#mutate(project, (state) => { if (!state.organization.members.some((member) => member.id === input.roleId && member.enabled)) fail('actor_forbidden'); return { ...state, memberConversations: beginMemberConversation(state.memberConversations, input) }; }, signal);
  }
  appendMemberEvent(project, input, trustedActor, signal) {
    return this.#mutate(project, (state) => { const run = state.memberConversations.runs.find((run) => run.id === input.conversationId); if (!run) fail('unknown_member_run'); actor(trustedActor, project.id, run.roleId); if (run.instanceId !== trustedActor.instanceId) fail('member_actor_mismatch'); return { ...state, memberConversations: appendMemberConversation(state.memberConversations, input) }; }, signal);
  }
  finishMemberRun(project, input, trustedActor) {
    return this.#mutate(project, (state) => { const run = state.memberConversations.runs.find((run) => run.id === input.conversationId); if (!run) fail('unknown_member_run'); actor(trustedActor, project.id, run.roleId); if (run.instanceId !== trustedActor.instanceId) fail('member_actor_mismatch'); return { ...state, memberConversations: finishMemberConversation(state.memberConversations, input) }; });
  }
  saveRoleMemory(project, input, trustedActor, signal = null) {
    exactObject(input, ['roleId', 'channel', 'expectedRevision', 'summary', 'covered', 'messages', 'sourceDigest', 'updatedAt']); actor(trustedActor, project.id, input.roleId);
    return this.#mutate(project, (state) => {
      if (!state.organization.members.some((member) => member.id === input.roleId && member.enabled)) fail('actor_forbidden');
      const channel=memoryChannel(input.roleId,input.channel);const source = roleContextSources(state, input.roleId,channel);
      const stale=(branch,details)=>{const error=new Error('stale_role_memory');error.code='stale_role_memory';error.memoryDiagnostic={branch,channel,...details};throw error;};
      if (source.sourceDigest !== input.sourceDigest) stale('source_digest',{expectedDigest:input.sourceDigest,actualDigest:source.sourceDigest});
      if (input.covered.some((ref) => roleRequiredSourceIds(source, state.roleMemories.entries.find((entry) => entry.roleId === input.roleId&&entry.channel===channel)).includes(ref.sourceId))) fail('invalid_role_memory');
      const refs = [...input.covered, ...input.messages];for(const ref of refs)if(!source.sources.some(message=>ref.sourceId===message.sourceId&&ref.sourceDigest===message.sourceDigest))stale('source_ref',{sourceId:ref.sourceId,expectedDigest:ref.sourceDigest,actualDigest:source.sources.find(message=>message.sourceId===ref.sourceId)?.sourceDigest??null});
      if (input.messages.some((message) => !source.sources.some((actual) => actual.sourceId === message.sourceId && actual.role === message.role && actual.text === message.text))) fail('invalid_role_memory');
      const revision=state.roleMemories.entries.find(entry=>entry.roleId===input.roleId&&entry.channel===channel)?.revision??0;
      if(input.expectedRevision!==revision)stale('revision',{expectedRevision:input.expectedRevision,actualRevision:revision});
      return { ...state, roleMemories: updateRoleMemory(state.roleMemories, input) };
    }, signal);
  }
  enqueueShell(project, input, trustedActor, signal) {
    actor(trustedActor, project.id, input.origin.roleId); if (trustedActor.instanceId !== input.origin.instanceId) fail('actor_forbidden');
    return this.#mutate(project, (state) => { const recovery = state.shellWorkflow.requests.filter((entry) => ['recovery_required', 'partial_published'].includes(entry.status)); if (recovery.length && !recoveryAuthorized(state, project, recovery)) fail('shell_recovery_required'); const member = state.organization.members.find((role) => role.id === trustedActor.roleId); if (!member?.enabled || member.digest !== input.bindings.roleDigest || state.organization.digest !== input.bindings.organizationDigest) fail('actor_forbidden'); return { ...state, shellWorkflow: enqueueShellWorkflow(state.shellWorkflow, input) }; }, signal);
  }
  async completeShellRecovery(project) {
    const state = await this.load(project), recovery = state.shellWorkflow.requests.filter((entry) => ['recovery_required', 'partial_published'].includes(entry.status));
    if (!recovery.length) return state;
    if (project.plan?.status !== 'completed' || !recoveryAuthorized(state, project, recovery)) fail('shell_recovery_required');
    const inputs = (await this.snapshotInputs(project, [...new Set(recovery.flatMap((entry) => entry.publication?.candidates.map((candidate) => candidate.resource) ?? []))], true)).map((file) => ({ state: 'present', ...file }));
    const evidenceIds = []; for (const task of project.plan.tasks) { const evidence = await this.currentEvidence(project, task); evidenceIds.push(...evidence.map((entry) => entry.id)); }
    for (const scope of [...new Set(recovery.flatMap((entry) => entry.request.generatedEffects))]) {
      const artifact = planArtifactScopes(project.plan).find((item) => item.scope === scope);
      const current = artifact ? (await this.inventory(project, planArtifactScopes(project.plan), [artifact])).generationDigest : null;
      const published = state.shellWorkflow.requests.findLast((entry) => entry.bindings.planDigest === project.plan.planDigest && entry.status === 'published' && entry.result?.publishedResources.some((item) => item.action === 'generated' && item.resource === scope.slice(0,-1)) && entry.publication?.artifactSnapshots?.some((item) => item.scope === scope && item.digest === current));
      if (!published) fail('shell_recovery_version_changed');
    }
    for (const task of project.tasks) if (task.retainedOutputs?.length) await this.verifyRetainedRecoveryOutputs(project, project.plan.tasks.find((item) => item.id === task.id), task.retainedOutputs);
    for (const input of inputs) { const tasks=project.tasks.filter(task=>task.status==='completed'&&actualResources(task).includes(input.resource));if(tasks.length!==1)fail('shell_recovery_version_changed');const task=tasks[0]; const result = task?.results.findLast((result) => result.success && result.observedMutation && result.resource === input.resource); const kept = task?.retainedOutputs?.find((fact) => fact.resource === input.resource); if (!result && !kept) fail('shell_recovery_version_changed'); if (result && (input.state === 'absent' ? !result.missing : result.contentDigest !== input.sha256)) fail('shell_recovery_version_changed'); }
    return this.#mutate(project, (actual) => { if (!recoveryAuthorized(actual, project, recovery)) fail('shell_recovery_required'); let journal = actual.shellWorkflow; for (const entry of recovery) journal = updateShellWorkflow(journal, entry.id, { status: 'recovered', recovery: { planDigest: project.plan.planDigest, resources: inputs, evidenceIds, retainedOutputs: project.tasks.flatMap(task=>task.retainedOutputs??[]).filter(fact=>fact.sourceRequestId===entry.id), recoveredAt: new Date().toISOString() }, updatedAt: new Date().toISOString() }); return { ...actual, shellWorkflow: journal }; });
  }
  async shellRecoveryInputs(project) {
    const state = await this.load(project), entries = state.shellWorkflow.requests.filter((entry) => ['recovery_required', 'partial_published'].includes(entry.status));
    if (!entries.length) return [];
    const inventory = await this.inventory(project, planArtifactScopes(project.plan));
    return [...new Set(entries.flatMap((entry) => entry.publication?.candidates.map((candidate) => candidate.resource) ?? []))].sort().map((resource) => inventory.allFiles.find((file) => file.resource === resource) ?? { resource, state: 'absent', sha256: null, byteLength: 0 });
  }
  async previewRetainedRecovery(project) {
    const state = await this.load(project), inventory = await this.inventory(project, planArtifactScopes(project.plan));
    const retained = [];
    for (const entry of state.shellWorkflow.requests.filter((entry) => ['partial_published','recovery_required'].includes(entry.status) && entry.bindings.planDigest !== project.plan?.planDigest)) for (const candidate of entry.publication?.candidates ?? []) {
      const task = project.plan?.tasks.find((task) => task.roleId === entry.origin.roleId && task.id===entry.origin.taskId && project.fileOwners.ownerOf(candidate.resource)===task.roleId);
      const baseline = inventory.allFiles.find((file) => file.resource === candidate.resource) ?? {resource:candidate.resource,state:'absent',sha256:null,byteLength:0};
      if (task && retainedPublication(entry,candidate,baseline,project,task)) retained.push({resource:candidate.resource,sourceRequestId:entry.id,sourcePlanDigest:entry.bindings.planDigest,baseline});
    }
    return immutable(retained);
  }
  async retainedRecoveryOutputs(project, task, baselines, trustedActor) {
    actor(trustedActor, project.id, task.roleId); const state=await this.load(project), human=confirmedRecoveryHuman(state,project);
    if (!state.shellWorkflow.requests.some((entry)=>['partial_published','recovery_required'].includes(entry.status))) return [];
    if (!human || !['confirmed','running'].includes(project.plan?.status)) fail('shell_recovery_required');
    const currentTask=project.tasks.find((item)=>item.id===task.id); if (!currentTask?.runId || currentTask.roleId !== trustedActor.roleId) fail('actor_forbidden');
    const inventory=await this.inventory(project,planArtifactScopes(project.plan)), facts=[];
    for (const entry of state.shellWorkflow.requests.filter((entry)=>['partial_published','recovery_required'].includes(entry.status)&&entry.bindings.planDigest!==project.plan.planDigest)) for (const candidate of entry.publication?.candidates??[]) {
      if (project.fileOwners.ownerOf(candidate.resource)!==task.roleId || entry.origin.roleId!==task.roleId || entry.origin.taskId!==task.id) continue;
      const baseline=inventory.allFiles.find((file)=>file.resource===candidate.resource)??{resource:candidate.resource,state:'absent',sha256:null,byteLength:0};
      const approved=baselines.find((file)=>file.resource===candidate.resource);
      if (!approved || digestValue(approved)!==digestValue(baseline)) fail('shell_recovery_version_changed');
      const result=retainedPublication(entry,candidate,baseline,project,task); if (!result) continue;
      if (facts.some((fact)=>fact.resource===candidate.resource)) continue;
      facts.push(recoveryRetainedFact({kind:'recovery_verified_retained',resource:candidate.resource,sourceRequestId:entry.id,sourceRequestDigest:entry.requestDigest,sourcePlanDigest:entry.bindings.planDigest,sourceProposalDigest:result.proposalDigest,candidateDigest:digestValue(candidate),baseline,...(baseline.state==='absent'?{tombstone:result.tombstone}:{}),planDigest:project.plan.planDigest,taskId:task.id,roleId:task.roleId,instanceId:trustedActor.instanceId,runId:currentTask.runId,fileOwnersDigest:project.fileOwners.digest,humanRequestId:human.requestId,humanRequestDigest:human.digest,verifiedAt:new Date().toISOString()}));
    }
    return immutable(facts);
  }
  async verifyRetainedRecoveryOutputs(project, task, values) {
    if (!values.length) return [];
    const state=await this.load(project), human=confirmedRecoveryHuman(state,project);if (!human || !task) fail('shell_recovery_required');
    const inventory=await this.inventory(project,planArtifactScopes(project.plan)), currentTask=project.tasks.find((item)=>item.id===task.id);
    for (const value of values) { const fact=recoveryRetainedFact(value);const entry=state.shellWorkflow.requests.find((entry)=>entry.id===fact.sourceRequestId),candidate=entry?.publication?.candidates.find((candidate)=>candidate.resource===fact.resource);const baseline=inventory.allFiles.find((file)=>file.resource===fact.resource)??{resource:fact.resource,state:'absent',sha256:null,byteLength:0};
      const run=state.memberConversations.runs.find((run)=>run.id===fact.runId&&run.roleId===fact.roleId&&run.taskId===fact.taskId&&run.instanceId===fact.instanceId);
      if (!entry || !candidate || !run || fact.planDigest!==project.plan.planDigest || fact.sourceRequestDigest!==entry.requestDigest || fact.sourcePlanDigest!==entry.bindings.planDigest || fact.taskId!==task.id || fact.roleId!==task.roleId || fact.runId!==currentTask?.runId || fact.fileOwnersDigest!==project.fileOwners.digest || fact.humanRequestId!==human.requestId || fact.humanRequestDigest!==human.digest || fact.candidateDigest!==digestValue(candidate) || digestValue(fact.baseline)!==digestValue(baseline)) fail('shell_recovery_version_changed');
      const result=retainedPublication(entry,candidate,baseline,project,task);if (!result || result.proposalDigest!==fact.sourceProposalDigest || (fact.baseline.state==='absent'&&digestValue(fact.tombstone)!==digestValue(result.tombstone))) fail('shell_recovery_version_changed');
    }
    return immutable(values.map(recoveryRetainedFact));
  }
  shellPhase(project, id, patch, trustedActor, signal = null) {
    return this.#mutate(project, (state) => { const entry = state.shellWorkflow.requests.find((item) => item.id === id); if (!entry) fail('unknown_shell_request'); actor(trustedActor, project.id, entry.origin.roleId); if (entry.origin.instanceId !== trustedActor.instanceId) fail('actor_forbidden'); return { ...state, shellWorkflow: updateShellWorkflow(state.shellWorkflow, id, patch) }; }, signal);
  }
  reviewShell(project, id, review, reviewer, trustedActor, signal) {
    actor(trustedActor, project.id, 'ProjectManager'); if (reviewer.instanceId !== trustedActor.instanceId) fail('actor_forbidden');
    return this.#mutate(project, (state) => { const entry = state.shellWorkflow.requests.find((item) => item.id === id); if (!entry || !['pending', 'reviewing'].includes(entry.status) || Date.parse(entry.expiresAt) <= Date.now() || review.requestId !== id || review.requestDigest !== entry.requestDigest || review.revision !== entry.revision) fail('stale_shell_review'); return { ...state, shellWorkflow: updateShellWorkflow(state.shellWorkflow, id, { status: shellReviewStatus(review), review, reviewer, updatedAt: new Date().toISOString() }) }; }, signal);
  }
  appendShellReview(project, id, text, reviewer, trustedActor, signal) {
    actor(trustedActor, project.id, 'ProjectManager'); if (reviewer.instanceId !== trustedActor.instanceId || typeof text !== 'string') fail('actor_forbidden');
    return this.#mutate(project, (state) => { const entry = state.shellWorkflow.requests.find((item) => item.id === id); if (!entry || !['pending', 'reviewing', 'approved', 'denied'].includes(entry.status)) fail('stale_shell_review'); return { ...state, shellWorkflow: updateShellWorkflow(state.shellWorkflow, id, { reviewText: entry.reviewText + text, reviewer, updatedAt: new Date().toISOString() }) }; }, signal);
  }
  claimShell(project, id, trustedActor, signal) {
    return this.#mutate(project, (state) => { const entry = state.shellWorkflow.requests.find((item) => item.id === id); if (!entry || entry.status !== 'approved' || !entry.review?.approved || Date.parse(entry.expiresAt) <= Date.now()) fail('invalid_or_replayed_shell'); actor(trustedActor, project.id, entry.origin.roleId); if (trustedActor.instanceId !== entry.origin.instanceId) fail('actor_forbidden'); return { ...state, shellWorkflow: updateShellWorkflow(state.shellWorkflow, id, { status: 'consumed', updatedAt: new Date().toISOString() }) }; }, signal);
  }
  interruptShell(project) { return this.#mutate(project, (state) => ({ ...state, shellWorkflow: interruptShellWorkflow(state.shellWorkflow, new Date().toISOString()) })); }
  async shellOutput(project, id, value, trustedActor, signal) {
    const state = await this.load(project); const entry = state.shellWorkflow.requests.find((item) => item.id === id); if (!entry) fail('unknown_shell_request'); actor(trustedActor, project.id, entry.origin.roleId); if (trustedActor.instanceId !== entry.origin.instanceId) fail('actor_forbidden');
    assertKnownKeyFree(value,this.#knownSecrets);
    const observed = await this.#provider.appendShellArchive(project.id, project.workspaceIdentity, id, value, [...this.#knownSecrets]);
    return this.#mutate(project, (current) => { const actual = current.shellWorkflow.requests.find((item) => item.id === id); if (!actual || !['consumed', 'running'].includes(actual.status)) fail('stale_shell_output'); const output = { ...actual.output }; let text = value.text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, ''); const remaining = 8192 - new TextEncoder().encode(output.stdout + output.stderr).byteLength; const bytes = new TextEncoder().encode(text); if (bytes.byteLength > remaining) { text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, Math.max(0, remaining))); while (new TextEncoder().encode(text).byteLength > remaining) text = text.slice(0, -1); output.truncated = true; } if (value.stream === 'stdout') output.stdout += text; else output.stderr += text; if (value.truncated || observed.truncated) output.truncated = true; return { ...current, shellWorkflow: updateShellWorkflow(current.shellWorkflow, id, { output, updatedAt: new Date().toISOString() }) }; }, signal);
  }
  inventory(project, artifactScopes, digestScopes = artifactScopes) { return this.#provider.inventory(project.id, project.workspaceIdentity, artifactScopes, digestScopes); }
  shellConfiguration(project, roleId) { return this.#provider.shellConfiguration(project.id, project.workspaceIdentity, roleId, project.plan?.planDigest); }
  async snapshotInputs(project, resources, allowDeletion = false) {
    const allowed = allowDeletion ? authorizedDeletedResources(await this.load(project), project) : [];
    return this.#provider.snapshotInputs(project.id, project.workspaceIdentity, resources, allowed);
  }
  checkConfiguration(project) { return this.#provider.checkConfiguration(project.id, project.workspaceIdentity); }
  recordCheck(project, id, authorization, result, trustedActor) {
    return this.#mutate(project, (state) => {
      actor(trustedActor, project.id, authorization.roleId);
      if (trustedActor.instanceId !== authorization.instanceId || authorization.planDigest !== project.plan?.planDigest || authorization.fileOwnersDigest !== project.fileOwners.digest) fail('stale_check_authorization');
      const prior = state.evidence.find((item) => item.id === id);
      const executed=project.tasks?.find(item=>item.id===authorization.taskId);const entry = { id, authorization, result,inputEpoch:inputMutationEpoch(project,authorization), outputRevision:(executed?.results?.length??0)+(executed?.generatedOutputs?.length??0) };
      if (prior) { if (digestValue(prior) !== digestValue(entry)) fail('duplicate_check_conflict'); return state; }
      return { ...state, evidence: [...state.evidence, entry] };
    });
  }
  async currentEvidence(project, task, ids = null) {
    const state = await this.load(project); const selected = [];
    for (const specValue of task.checks ?? []) {
      const spec = new CheckSpec(specValue);
      const entry = [...state.evidence].reverse().find((value) => value.authorization.planDigest === project.plan.planDigest && value.authorization.taskId === task.id && value.authorization.roleId === task.roleId && value.result.checkId === spec.checkId);
      const execution=project.tasks?.find(item=>item.id===task.id);const currentRun=execution?.runId;
      const required=[...actualResources(execution),...dependencyResources(project.tasks??[],task)];
      if(entry && (entry.outputRevision!==((execution?.results?.length??0)+(execution?.generatedOutputs?.length??0))||required.some(resource=>!entry.authorization.inputVersions.some(item=>item.resource.toLowerCase()===resource.toLowerCase()))))fail('check_evidence_stale','stale');
      if (!entry || (currentRun && entry.result.runId !== currentRun)) fail('check_not_passed', 'not_executed');
      if (ids && !ids.includes(entry.id)) fail('check_not_passed', 'error');
      if(entry.inputEpoch!==inputMutationEpoch(project,entry.authorization))fail('check_evidence_stale','stale');
      if (entry.result.status !== 'passed') fail('check_not_passed', entry.result.status);
      if (!entry.result.executed || entry.result.specDigest !== spec.digest || entry.authorization.fileOwnersDigest !== project.fileOwners.digest) fail('check_not_passed', 'stale');
      const current = await this.snapshotInputs(project, entry.authorization.inputVersions.map((item) => item.resource), true);
      if (entry.authorization.generationDigest !== undefined && entry.authorization.generationDigest !== (await this.inventory(project, planArtifactScopes(project.plan))).generationDigest) fail('check_evidence_stale', 'stale');
      if (digestValue(current) !== entry.result.inputDigest) fail('check_evidence_stale', 'stale');
      selected.push(entry);
    }
    if (!selected.length) fail('task_checks_required'); return selected;
  }
  async submitAcceptance(project, input, trustedActor, signal = null) {
    exactObject(input, ['taskId', 'evidenceIds', 'decision', 'issues']);
    actor(trustedActor, project.id, 'Acceptance'); const task = project.plan.tasks.find((item) => item.id === input.taskId && item.roleId === 'Acceptance');
    if (!task || !['pass', 'fail'].includes(input.decision) || !Array.isArray(input.evidenceIds) || !Array.isArray(input.issues) || input.issues.length > 64) fail('invalid_acceptance');
    if (input.decision === 'pass') {
      const execution = project.tasks?.find((item) => item.id === task.id); if (execution?.results.some((item) => !item.success || item.auditFailed)) fail('acceptance_scope_failed');
      await this.currentEvidence(project, task, input.evidenceIds);
      for (const id of task.accepts) { const development = project.plan.tasks.find((item) => item.id === id); await this.currentEvidence(project, development); }
    }
    const state = await this.load(project);
    if (input.decision === 'fail' && (!input.evidenceIds.length || !input.issues.length)) fail('acceptance_failure_evidence_required');
    for (const id of input.evidenceIds) {
      const entry = state.evidence.find((item) => item.id === id);
      if (!entry || entry.authorization.taskId !== task.id || entry.authorization.planDigest !== project.plan.planDigest || entry.authorization.instanceId !== trustedActor.instanceId) fail('acceptance_evidence_mismatch');
      const versions = await this.snapshotInputs(project, entry.authorization.inputVersions.map((item) => item.resource), true);
      if (digestValue(versions) !== entry.result.inputDigest) fail('check_evidence_stale');
    }
    const issues = input.issues.map((issue) => {
      exactObject(issue, ['taskId', 'resource', 'expected', 'actual', 'reproduction']);
      const owner = project.plan.tasks.find((item) => item.id === issue.taskId && task.accepts.includes(item.id));
      if (!owner || !taskRelatedResources(project,owner).includes(issue.resource) || project.fileOwners.ownerOf(issue.resource) !== owner.roleId) fail('acceptance_issue_owner_mismatch');
      return { taskId: owner.id, resource: issue.resource, roleId: owner.roleId,
        expected: textValue(issue.expected, '', 4000), actual: textValue(issue.actual, '', 4000), reproduction: textValue(issue.reproduction, '', 4000) };
    });
    if (input.decision === 'pass' && issues.length) fail('passing_acceptance_has_issues');
    return this.#mutate(project, (current) => ({ ...current, acceptances: [...current.acceptances,
      { id: identifier('acceptance-' + current.revision), planDigest: project.plan.planDigest, taskId: task.id, instanceId: trustedActor.instanceId, decision: input.decision, evidenceIds: input.evidenceIds, issues }] }), signal);
  }
  async requestRepair(project, input, trustedActor, signal = null) {
    exactObject(input, ['acceptanceId', 'taskId', 'reason']); actor(trustedActor, project.id, 'ProjectManager');
    return this.#mutate(project, async (state) => {
      const acceptance = state.acceptances.find((item) => item.id === input.acceptanceId && item.planDigest === project.plan?.planDigest && item.decision === 'fail');
      const task = project.plan?.tasks.find((item) => item.id === input.taskId && !['Acceptance', 'RoleArchitect'].includes(item.roleId));
      if (!acceptance || !task || !acceptance.issues.some((issue) => issue.taskId === task.id)) fail('repair_failure_required');
      for (const id of acceptance.evidenceIds) { const entry = state.evidence.find((item) => item.id === id); if (!entry) fail('repair_failure_required'); const current = await this.#provider.snapshotInputs(project.id, project.workspaceIdentity, entry.authorization.inputVersions.map((item) => item.resource), authorizedDeletedResources(state, project));
      if (entry.authorization.generationDigest !== undefined && entry.authorization.generationDigest !== (await this.inventory(project, planArtifactScopes(project.plan))).generationDigest) fail('check_evidence_stale', 'stale'); if (digestValue(current) !== entry.result.inputDigest) fail('check_evidence_stale'); }
      const repairs = state.repairs.filter((item) => item.planDigest === project.plan.planDigest && item.taskId === task.id);
      if (repairs.length >= project.plan.governance.maxRepairRounds) fail('repair_limit_reached');
      if (state.repairs.some((item) => item.acceptanceId === acceptance.id && item.taskId === task.id)) fail('repair_already_requested');
      for(const resource of actualResources(project.tasks.find(item=>item.id===task.id)))if(project.fileOwners.ownerOf(resource)!==task.roleId)fail('repair_owner_changed');
      return { ...state, repairs: [...state.repairs, { id: identifier('repair-' + state.revision), acceptanceId: acceptance.id, taskId: task.id,
        roleId: task.roleId, planDigest: project.plan.planDigest, round: repairs.length + 1, ownerGeneration:project.fileOwners.version, checks: task.checks, reason: textValue(input.reason, '', 4000) }] };
    }, signal);
  }
  async close() { this.#closed = true; await this.#tail; this.#knownSecrets.clear(); this.#provider.close(); }
}

function dependencyResources(tasks, task, seen = new Set()) {
  const resources = [];
  for (const id of task.dependsOn??[]) { if (seen.has(id)) continue; seen.add(id); const dependency = tasks.find((item) => item.id === id); if (!dependency) fail('invalid_plan'); resources.push(...actualResources(dependency), ...dependencyResources(tasks, dependency, seen)); }
  return [...new Set(resources)];
}

function shellReviewStatus(review) { if (review.approved) return 'approved'; return 'denied'; }
function authorizedDeletedResources(state, project) { const allowed = []; for (const entry of state.shellWorkflow.requests) if (entry.bindings.planDigest === project.plan?.planDigest) for (const result of entry.publication?.results ?? []) if (result.missing && result.observedMutation && result.tombstone && project.fileOwners.ownerOf(result.resource) === entry.origin.roleId) allowed.push(result.resource); for (const task of project.tasks??[]) for (const fact of task.retainedOutputs??[]) if (fact.baseline.state==='absent' && fact.planDigest===project.plan?.planDigest && project.fileOwners.ownerOf(fact.resource)===fact.roleId) { const entry=state.shellWorkflow.requests.find((entry)=>entry.id===fact.sourceRequestId),candidate=entry?.publication?.candidates.find((candidate)=>candidate.resource===fact.resource);if (entry&&candidate&&retainedPublication(entry,candidate,fact.baseline,project,project.plan.tasks.find((item)=>item.id===task.id))) allowed.push(fact.resource); } return allowed; }
function confirmedRecoveryHuman(state,project) { return state.queue.requests.findLast((request)=>request.purpose==='execute_plan'&&request.status==='answered'&&request.answer?.value===true&&request.bindings.planDigest===project.plan?.planDigest); }
function retainedPublication(entry,candidate,baseline,project,task) {
  if (!task || !['partial_published','recovery_required'].includes(entry.status) || entry.bindings.planDigest===project.plan?.planDigest || entry.origin.roleId!==task.roleId || entry.origin.taskId!==task.id || project.fileOwners.ownerOf(candidate.resource)!==task.roleId) return null;
  const result=entry.publication?.results.findLast((result)=>result.resource===candidate.resource&&result.success&&result.observedMutation&&!result.auditFailed);
  const published=entry.result?.publishedResources.find((item)=>item.resource===candidate.resource);if (!result || !published) return null;
  if (candidate.action==='delete') { if (!result.missing || !result.tombstone || result.tombstone.priorSha256!==candidate.baseline.sha256 || !published.missing || published.action!=='delete' || baseline.state!=='absent' || baseline.sha256!==null || baseline.byteLength!==0) return null; }
  else if (baseline.state!=='present' || baseline.sha256!==candidate.sha256 || baseline.byteLength!==candidate.byteLength || baseline.executable!==candidate.executable || result.contentDigest!==candidate.sha256 || published.sha256!==candidate.sha256 || published.missing || published.action!==candidate.action) return null;
  return result;
}
function planArtifactScopes(plan) { return (plan?.tasks ?? []).flatMap((task) => task.artifactScopes ?? []).filter((item, index, array) => array.findIndex((other) => other.scope === item.scope) === index); }
function recoveryAuthorized(state, project, entries) {
  if (!['confirmed', 'running', 'completed'].includes(project.plan?.status) || !state.queue.requests.some((request) => request.purpose === 'execute_plan' && request.status === 'answered' && request.answer?.value === true && request.bindings.planDigest === project.plan.planDigest)) return false;
  return entries.every((entry) => entry.bindings.planDigest !== project.plan.planDigest && (entry.publication?.candidates ?? []).every((candidate) => project.plan.tasks.some((task) => task.roleId === entry.origin.roleId && task.id===entry.origin.taskId && project.fileOwners.ownerOf(candidate.resource)===task.roleId)) && entry.request.generatedEffects.every((scope) => project.plan.tasks.some((task) => (task.generatedEffects ?? []).includes(scope))));
}

function actualResources(task){return [...new Set([...(task?.results??[]).filter(item=>item.success&&item.observedMutation&&!item.auditFailed).map(item=>item.resource),...(task?.retainedOutputs??[]).map(item=>item.resource)])];}
function taskRelatedResources(project,task){return [...new Set([...actualResources(project.tasks?.find(item=>item.id===task.id)),...(task.checks??[]).flatMap(spec=>spec.inputResources)])];}

/** Private Host provenance: identical bytes written by another task still supersede a check. */
function inputMutationEpoch(project,authorization){
 const inputs=new Set(authorization.inputVersions.map(item=>item.resource.toLowerCase()));const observations=[];
 for(const task of project.tasks??[]){
  for(const [index,result] of (task.results??[]).entries())if(result.observedMutation&&inputs.has(result.resource.toLowerCase()))observations.push({taskId:task.id,runId:task.runId??null,index,resource:result.resource.toLowerCase()});
  if(authorization.generationDigest!==undefined)for(const [index,output] of (task.generatedOutputs??[]).entries())observations.push({taskId:task.id,runId:task.runId??null,index,resource:output.resource,generationDigest:output.generationDigest});
 }
 return digestValue(observations);
}
