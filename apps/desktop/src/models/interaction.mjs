import { supervisionInput } from './memory.mjs';
/** Human interactions are durable values, never runtime tool approvals or execution authority. */
import { digestValue, normalizeResource, normalizeProjectReadResource, ShellRequest, ShellPreparation, ShellReview, ShellResult, ShellCandidate, FileBaseline, shellEffects, MutationResult } from 'legion-runtime/workbench-models';
import { exactObject, identifier, projectIdentifier, textValue, immutable } from './desktop.mjs';

export class InteractionValidationError extends Error {
  constructor(code = 'invalid_interaction') { super(code); this.code = code; }
}
function fail(code) { throw new InteractionValidationError(code); }
function integer(value, minimum = 1) {
  if (!Number.isSafeInteger(value) || value < minimum) fail('invalid_version');
  return value;
}
function sha(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) fail('invalid_digest');
  return value;
}
function text(value, max = 16384) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fail('invalid_answer_text');
  return value;
}
function time(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) fail('invalid_timestamp');
  return value;
}
export function interactionBindings(value) {
  exactObject(value, ['planDigest', 'organizationRevision', 'organizationDigest', 'contextDigest', 'profileVersion', 'workspaceDigest']);
  const result = {};
  for (const field of ['planDigest', 'organizationDigest', 'contextDigest', 'profileVersion', 'workspaceDigest']) if (value[field] !== undefined) result[field] = sha(value[field]);
  if (value.organizationRevision !== undefined) result.organizationRevision = integer(value.organizationRevision, 0);
  return immutable(result);
}
function origin(value) {
  exactObject(value, ['roleId', 'instanceId', 'runId', 'toolRequestId']);
  if (!['ProjectManager','Supervisor'].includes(value.roleId)) fail('manager_only');
  let runId = null;
  let toolRequestId = null;
  if (value.runId !== null) runId = identifier(value.runId);
  if (value.toolRequestId !== null) toolRequestId = identifier(value.toolRequestId);
  if ((runId === null) !== (toolRequestId === null)) fail('invalid_origin');
  return { roleId: value.roleId, instanceId: identifier(value.instanceId), runId, toolRequestId };
}
function options(value, kind) {
  if (!Array.isArray(value) || value.length > 32) fail('invalid_options');
  const result = value.map((item) => {
    exactObject(item, ['id', 'label']);
    return { id: identifier(item.id), label: textValue(item.label, '', 1000) };
  });
  if (new Set(result.map((item) => item.id)).size !== result.length) fail('invalid_options');
  if (kind === 'choice' && !result.length) fail('invalid_options');
  if (kind !== 'choice' && result.length) fail('invalid_options');
  return result;
}
function answerValue(value, request) {
  if (request.kind === 'confirmation') {
    if (typeof value !== 'boolean') fail('invalid_confirmation');
    return value;
  }
  if (request.kind === 'question') return text(value);
  exactObject(value, ['optionId', 'text']);
  const optionId = identifier(value.optionId);
  if (!request.options.some((item) => item.id === optionId)) fail('invalid_option');
  let supplement = '';
  if (value.text !== '') {
    if (!request.allowSupplement) fail('supplement_not_allowed');
    supplement = text(value.text);
  }
  return { optionId, text: supplement };
}
export function interactionDocument(value) {
  exactObject(value, ['schemaVersion', 'requestId', 'projectId', 'version', 'kind', 'purpose', 'origin', 'title', 'text', 'options', 'allowSupplement', 'bindings', 'createdOrder', 'createdAt', 'status', 'answer', 'invalidationReason', 'digest']);
  if (value.schemaVersion !== 1 || !['confirmation', 'choice', 'question'].includes(value.kind) || !['discussion', 'execute_plan'].includes(value.purpose) ||
    !['pending', 'answered', 'rejected', 'invalidated'].includes(value.status) || typeof value.allowSupplement !== 'boolean') fail('invalid_request');
  const bindings = interactionBindings(value.bindings);
  if (value.purpose === 'execute_plan' && (value.kind !== 'confirmation' || bindings.planDigest === undefined || bindings.organizationRevision === undefined || bindings.organizationDigest === undefined)) fail('invalid_execution_confirmation');
  if (value.kind !== 'choice' && value.allowSupplement) fail('invalid_options');
  const fields = { schemaVersion: 1, requestId: identifier(value.requestId), projectId: projectIdentifier(value.projectId),
    version: integer(value.version), kind: value.kind, purpose: value.purpose, origin: origin(value.origin),
    title: textValue(value.title, '', 200), text: text(value.text), options: options(value.options, value.kind),
    allowSupplement: value.allowSupplement, bindings, createdOrder: integer(value.createdOrder, 0), createdAt: time(value.createdAt) };
  const digest = digestValue(fields);
  if (value.digest !== undefined && value.digest !== digest) fail('request_digest_mismatch');
  let answer = null;
  if (value.answer !== null) {
    exactObject(value.answer, ['answerId', 'answeredAt', 'value']);
    answer = { answerId: identifier(value.answer.answerId), answeredAt: time(value.answer.answeredAt), value: answerValue(value.answer.value, fields) };
  }
  if (value.status === 'pending' && answer !== null) fail('invalid_answer_state');
  if (['answered', 'rejected'].includes(value.status)) {
    if (answer === null) fail('missing_answer');
    if (value.status === 'rejected' && (fields.kind !== 'confirmation' || answer.value !== false)) fail('invalid_answer_state');
    if (value.status === 'answered' && fields.kind === 'confirmation' && answer.value !== true) fail('invalid_answer_state');
  }
  let invalidationReason = null;
  if (value.status === 'invalidated') invalidationReason = textValue(value.invalidationReason, '', 300);
  else if (value.invalidationReason !== null) fail('invalid_answer_state');
  return immutable({ ...fields, digest, status: value.status, answer, invalidationReason });
}
/** origin is supplied separately from payload by the trusted host. */
export function createInteraction(input, trustedOrigin) {
  exactObject(input, ['requestId', 'projectId', 'version', 'kind', 'purpose', 'title', 'text', 'options', 'allowSupplement', 'bindings', 'createdOrder', 'createdAt']);
  return interactionDocument({ ...input, schemaVersion: 1, origin: trustedOrigin, status: 'pending', answer: null, invalidationReason: null });
}
export function answerInteraction(requestValue, input, actor, currentBindings) {
  const request = interactionDocument(requestValue);
  exactObject(input, ['requestId', 'projectId', 'version', 'requestDigest', 'answerId', 'answeredAt', 'value']);
  exactObject(actor, ['projectId', 'roleId']);
  if (actor.roleId !== 'Human' || actor.projectId !== request.projectId || input.projectId !== request.projectId) fail('answer_actor_forbidden');
  if (input.requestId !== request.requestId || input.version !== request.version || input.requestDigest !== request.digest ||
    digestValue(interactionBindings(currentBindings)) !== digestValue(request.bindings)) fail('stale_interaction');
  const answer = { answerId: identifier(input.answerId), answeredAt: time(input.answeredAt), value: answerValue(input.value, request) };
  if (request.status === 'answered' || request.status === 'rejected') {
    if (digestValue(answer) === digestValue(request.answer)) return request;
    fail('interaction_already_answered');
  }
  if (request.status !== 'pending') fail('interaction_invalidated');
  let status = 'answered';
  if (request.kind === 'confirmation' && answer.value === false) status = 'rejected';
  return interactionDocument({ ...request, status, answer });
}
/** Closing a popup is deliberately not a state transition. */
export function closeInteraction(requestValue) { return interactionDocument(requestValue); }
export function invalidateInteraction(requestValue, reason) {
  const request = interactionDocument(requestValue);
  if (request.status === 'invalidated') return request;
  return interactionDocument({ ...request, status: 'invalidated', invalidationReason: reason });
}
export function interactionQueueDocument(value) {
  exactObject(value, ['schemaVersion', 'projectId', 'revision', 'requests', 'digest']);
  if (value.schemaVersion !== 1 || !Array.isArray(value.requests) || value.requests.length > 256) fail('interaction_queue_budget');
  const projectId = projectIdentifier(value.projectId);
  const requests = value.requests.map(interactionDocument).sort((a, b) => a.createdOrder - b.createdOrder);
  if (requests.some((request) => request.projectId !== projectId) || new Set(requests.map((item) => item.requestId)).size !== requests.length ||
    new Set(requests.map((item) => item.createdOrder)).size !== requests.length) fail('invalid_interaction_queue');
  const fields = { schemaVersion: 1, projectId, revision: integer(value.revision, 0), requests };
  const digest = digestValue(fields);
  if (value.digest !== undefined && value.digest !== digest) fail('queue_digest_mismatch');
  return immutable({ ...fields, digest });
}
export function createInteractionQueue(projectId) {
  return interactionQueueDocument({ schemaVersion: 1, projectId, revision: 0, requests: [] });
}
export function enqueueInteraction(queueValue, requestValue) {
  const queue = interactionQueueDocument(queueValue);
  const request = interactionDocument(requestValue);
  if (request.status !== 'pending' || request.projectId !== queue.projectId || queue.requests.some((item) => item.requestId === request.requestId || item.createdOrder >= request.createdOrder)) fail('invalid_enqueue');
  return interactionQueueDocument({ schemaVersion: 1, projectId: queue.projectId, revision: queue.revision + 1, requests: [...queue.requests, request] });
}
export function answerQueuedInteraction(queueValue, input, actor, currentBindings) {
  const queue = interactionQueueDocument(queueValue);
  const index = queue.requests.findIndex((request) => request.requestId === input.requestId);
  if (index < 0) fail('unknown_interaction');
  const answered = answerInteraction(queue.requests[index], input, actor, currentBindings);
  if (digestValue(answered) === digestValue(queue.requests[index])) return queue;
  const requests = [...queue.requests];
  requests[index] = answered;
  return interactionQueueDocument({ schemaVersion: 1, projectId: queue.projectId, revision: queue.revision + 1, requests });
}
export function pendingInteractions(queueValue) {
  return immutable(interactionQueueDocument(queueValue).requests.filter((request) => request.status === 'pending'));
}
/** Preserve audit and pending questions; the caller must not replay old runner tool responses. */
export function restoreInteractionQueue(queueValue) {
  return immutable({ queue: interactionQueueDocument(queueValue), resumeToolResponses: false });
}


/** Host presentation journal. It is data only: never an SDK tool reply or permission. */
export function conversationTimeline(value) {
  exactObject(value, ['schemaVersion', 'projectId', 'revision', 'historyImported', 'legacyMessages', 'turns', 'messages', 'digest']);
  if (value.schemaVersion !== 1 || typeof value.historyImported !== 'boolean' || !Array.isArray(value.turns) || value.turns.length > 256 || !Array.isArray(value.messages) || value.messages.length > 1024 || !Array.isArray(value.legacyMessages) || value.legacyMessages.length > 256) fail('conversation_budget');
  const projectId = projectIdentifier(value.projectId);
  const turns = value.turns.map((turn) => {
    exactObject(turn, ['id', 'userMessageId', 'continuationAnswerId', 'status']);
    if (!['running', 'waiting', 'completed', 'failed', 'cancelled', 'interrupted'].includes(turn.status)) fail('invalid_conversation_turn');
    return { id: identifier(turn.id), userMessageId: nullableId(turn.userMessageId), continuationAnswerId: nullableId(turn.continuationAnswerId), status: turn.status };
  });
  if (new Set(turns.map((turn) => turn.id)).size !== turns.length) fail('duplicate_conversation_turn');
  const messages = value.messages.map((message) => {
    exactObject(message, ['id', 'turnId', 'requestId', 'answerId', 'kind', 'text', 'order', 'createdAt', 'orderKnown']);
    if (!['human', 'assistant', 'question', 'answer'].includes(message.kind) || typeof message.orderKnown !== 'boolean') fail('invalid_conversation_message');
    const fields = { id: identifier(message.id), turnId: nullableId(message.turnId), requestId: nullableId(message.requestId), answerId: nullableId(message.answerId), kind: message.kind, text: journalText(message.text), order: integer(message.order), createdAt: time(message.createdAt), orderKnown: message.orderKnown };
    if (fields.turnId !== null && !turns.some((turn) => turn.id === fields.turnId)) fail('unknown_conversation_turn');
    if (['question', 'answer'].includes(fields.kind) && fields.requestId === null) fail('conversation_request_required');
    if (fields.kind === 'answer' && fields.answerId === null) fail('conversation_answer_required');
    if (fields.kind !== 'answer' && fields.answerId !== null) fail('invalid_conversation_answer');
    return fields;
  }).sort((a, b) => a.order - b.order);
  if (new Set(messages.map((message) => message.id)).size !== messages.length || new Set(messages.map((message) => message.order)).size !== messages.length) fail('duplicate_conversation_message');
  const answers = messages.filter((message) => message.kind === 'answer');
  const questions = messages.filter((message) => message.kind === 'question');
  if (new Set(answers.map((message) => message.answerId)).size !== answers.length || new Set(questions.map((message) => message.requestId)).size !== questions.length) fail('duplicate_conversation_anchor');
  for (const message of answers) if (!questions.some((question) => question.requestId === message.requestId && question.order < message.order)) fail('conversation_question_required');
  for (const turn of turns) {
    if (turn.userMessageId !== null && !messages.some((message) => message.id === turn.userMessageId && message.kind === 'human' && message.turnId === turn.id)) fail('conversation_user_anchor_required');
    if (turn.continuationAnswerId !== null && !answers.some((message) => message.answerId === turn.continuationAnswerId)) fail('conversation_continuation_required');
  }
  const legacyMessages = value.legacyMessages.map((message, index) => {
    exactObject(message, ['role', 'text', 'sourceIndex']);
    if (!['user', 'assistant'].includes(message.role) || message.sourceIndex !== index) fail('invalid_legacy_conversation');
    return { role: message.role, text: journalText(message.text), sourceIndex: index };
  });
  if ([...messages, ...legacyMessages].reduce((total, message) => total + message.text.length, 0) > 4194304) fail('conversation_budget');
  const fields = { schemaVersion: 1, projectId, revision: integer(value.revision, 0), historyImported: value.historyImported, legacyMessages, turns, messages };
  const digest = digestValue(fields); if (value.digest !== undefined && value.digest !== digest) fail('conversation_digest_mismatch');
  return immutable({ ...fields, digest });
}
function nullableId(value) { if (value === null) return null; return identifier(value); }
export function createConversationTimeline(projectId) { return conversationTimeline({schemaVersion:1,projectId,revision:0,historyImported:false,legacyMessages:[],turns:[],messages:[]}); }
function nextTimeline(timeline, patch) { return conversationTimeline({...timeline,...patch,revision:timeline.revision+1,digest:undefined}); }
function messageOrder(timeline) { return timeline.messages.reduce((maximum, message) => Math.max(maximum, message.order),0)+1; }
export function importConversationHistory(value, history) {
  const timeline=conversationTimeline(value);if(timeline.historyImported)return timeline;
  exactObject(history,['messages']);if(!Array.isArray(history.messages))fail('invalid_legacy_conversation');
  return nextTimeline(timeline,{historyImported:true,legacyMessages:history.messages.map((message,sourceIndex)=>({...message,sourceIndex}))});
}
export function beginConversationTurn(value,input) {
  const timeline=conversationTimeline(value);exactObject(input,['turnId','userMessageId','continuationAnswerId','text','createdAt']);
  const id=identifier(input.turnId);if(timeline.turns.some((turn)=>turn.id===id))fail('duplicate_conversation_turn');
  const userMessageId=nullableId(input.userMessageId),continuationAnswerId=nullableId(input.continuationAnswerId);const messages=[...timeline.messages];
  if(continuationAnswerId===null) {if(userMessageId===null)fail('conversation_user_anchor_required');messages.push({id:userMessageId,turnId:id,requestId:null,answerId:null,kind:'human',text:text(input.text,65536),order:messageOrder(timeline),createdAt:time(input.createdAt),orderKnown:true});}
  else if(userMessageId!==null)fail('duplicate_conversation_answer');
  return nextTimeline(timeline,{turns:[...timeline.turns,{id,userMessageId,continuationAnswerId,status:'running'}],messages});
}
export function appendConversationText(value,input) {
  const timeline=conversationTimeline(value);exactObject(input,['turnId','messageId','text','createdAt']);
  const turn=timeline.turns.find((item)=>item.id===input.turnId);if(!turn||!['running','waiting'].includes(turn.status))fail('conversation_turn_not_active');
  const id=identifier(input.messageId),chunk=journalText(input.text);if(!chunk)return timeline;
  const existing=timeline.messages.find((message)=>message.id===id);const messages=[...timeline.messages];
  if(existing){if(existing.kind!=='assistant'||existing.turnId!==turn.id)fail('conversation_segment_mismatch');messages[messages.indexOf(existing)]={...existing,text:existing.text+chunk};}
  else messages.push({id,turnId:turn.id,requestId:null,answerId:null,kind:'assistant',text:chunk,order:messageOrder(timeline),createdAt:time(input.createdAt),orderKnown:true});
  return nextTimeline(timeline,{messages});
}
export function recordConversationQuestion(value,requestValue,turnId=null) {
  const timeline=conversationTimeline(value),request=interactionDocument(requestValue);if(timeline.projectId!==request.projectId)fail('conversation_project_mismatch');
  const existing=timeline.messages.find((message)=>message.kind==='question'&&message.requestId===request.requestId);if(existing)return timeline;
  let orderKnown=false;if(turnId!==null){identifier(turnId);if(!timeline.turns.some((turn)=>turn.id===turnId))fail('unknown_conversation_turn');orderKnown=true;}
  let shown=request.title+'\n'+request.text;if(request.options.length)shown+='\n'+request.options.map((option)=>option.id+'：'+option.label).join('\n');
  return nextTimeline(timeline,{messages:[...timeline.messages,{id:request.requestId+'.question',turnId,requestId:request.requestId,answerId:null,kind:'question',text:shown,order:messageOrder(timeline),createdAt:request.createdAt,orderKnown}]});
}
export function recordConversationAnswer(value,requestValue) {
  let timeline=conversationTimeline(value);const request=interactionDocument(requestValue);if(!request.answer)fail('conversation_answer_required');
  const existing=timeline.messages.find((message)=>message.answerId===request.answer.answerId);if(existing){if(existing.requestId!==request.requestId)fail('duplicate_conversation_answer');return timeline;}
  let question=timeline.messages.find((message)=>message.kind==='question'&&message.requestId===request.requestId);
  if(!question){timeline=recordConversationQuestion(timeline,request);question=timeline.messages.at(-1);}
  return nextTimeline(timeline,{messages:[...timeline.messages,{id:request.answer.answerId,turnId:question.turnId,requestId:request.requestId,answerId:request.answer.answerId,kind:'answer',text:'答复「'+request.title+'」：'+JSON.stringify(request.answer.value),order:messageOrder(timeline),createdAt:request.answer.answeredAt,orderKnown:question.orderKnown}]});
}
export function finishConversationTurn(value,input) {
  let timeline=conversationTimeline(value);exactObject(input,['turnId','status','assistantText','messageId','createdAt']);
  if(!timeline.turns.some((turn)=>turn.id===input.turnId))fail('unknown_conversation_turn');
  if(!['completed','failed','cancelled','interrupted'].includes(input.status))fail('invalid_conversation_turn');
  const observed=timeline.messages.filter((message)=>message.turnId===input.turnId&&message.kind==='assistant').map((message)=>message.text).join('');
  const final=journalText(input.assistantText);
  if(final&&final!==observed){let addition=final;let orderKnown=false;if(final.startsWith(observed)){addition=final.slice(observed.length);orderKnown=true;}
    const id=identifier(input.messageId);timeline=nextTimeline(timeline,{messages:[...timeline.messages,{id,turnId:input.turnId,requestId:null,answerId:null,kind:'assistant',text:addition,order:messageOrder(timeline),createdAt:time(input.createdAt),orderKnown}]});}
  return nextTimeline(timeline,{turns:timeline.turns.map((turn)=>{if(turn.id===input.turnId)return {...turn,status:input.status};return turn;})});
}
export function interruptConversationTurns(value) {const timeline=conversationTimeline(value);if(!timeline.turns.some((turn)=>['running','waiting'].includes(turn.status)))return timeline;return nextTimeline(timeline,{turns:timeline.turns.map((turn)=>{if(['running','waiting'].includes(turn.status))return {...turn,status:'interrupted'};return turn;})});}

function journalText(value) { if (typeof value !== 'string' || value.length > 65536 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fail('invalid_conversation_text'); return value; }

export function conversationTurnPhase(value, turnId, status) { const timeline = conversationTimeline(value); if (!['running','waiting'].includes(status)) fail('invalid_conversation_turn'); const turn=timeline.turns.find((item)=>item.id===turnId); if(!turn||!['running','waiting'].includes(turn.status)) fail('conversation_turn_not_active'); if(turn.status===status)return timeline; return nextTimeline(timeline,{turns:timeline.turns.map((item)=>{if(item.id===turnId)return {...item,status};return item;})}); }


/** Separate host SDK journal for non-PM members. No prompts, file bodies or grants. */
export function memberConversations(value) {
  exactObject(value, ['schemaVersion', 'projectId', 'revision', 'runs', 'events', 'digest']);
  if (value.schemaVersion !== 1 || !Array.isArray(value.runs) || value.runs.length > 256 || !Array.isArray(value.events) || value.events.length > 1024) fail('member_conversation_budget');
  const projectId = projectIdentifier(value.projectId);
  const runs = value.runs.map((run) => {
    exactObject(run, ['id', 'roleId', 'channel', 'taskId', 'instanceId', 'runId', 'planDigest', 'status', 'startedAt', 'finishedAt']);
    if (!['running', 'completed', 'failed', 'cancelled', 'interrupted'].includes(run.status)) fail('invalid_member_run');
    let planDigest = null; if (run.planDigest !== null) planDigest = sha(run.planDigest);
    let finishedAt = null; if (run.finishedAt !== null) finishedAt = time(run.finishedAt);
    if (run.status === 'running' && finishedAt !== null) fail('invalid_member_run');
    return { id: identifier(run.id), roleId: identifier(run.roleId), ...(run.channel===undefined?{}:{channel:run.channel==='shell_review'&&run.roleId==='ProjectManager'?'shell_review':memoryChannel(run.roleId,run.channel)}), taskId: identifier(run.taskId), instanceId: identifier(run.instanceId), runId: identifier(run.runId), planDigest, status: run.status, startedAt: time(run.startedAt), finishedAt };
  });
  if (new Set(runs.map((run) => run.id)).size !== runs.length || new Set(runs.map((run) => run.instanceId + '|' + run.runId)).size !== runs.length) fail('duplicate_member_run');
  const events = value.events.map((event) => {
    exactObject(event, ['id', 'conversationId', 'kind', 'text', 'tool', 'requestId', 'resource', 'checkId', 'status', 'reason', 'digest', 'order', 'createdAt', 'orderKnown']);
    if (!['assistant_text', 'host_briefing', 'tool_request', 'tool_result', 'terminal'].includes(event.kind) || typeof event.orderKnown !== 'boolean' || !runs.some((run) => run.id === event.conversationId)) fail('invalid_member_event');
    let resource = null; if (event.resource !== null) { resource = normalizeProjectReadResource(event.resource); if (!resource) fail('unsafe_member_resource'); }
    if (event.status !== null && !['completed', 'denied', 'error', 'cancelled', 'written', 'failed', 'audit_failed', 'passed', 'unsupported', 'stale', 'read', 'listed', 'interrupted'].includes(event.status)) fail('invalid_member_status');
    const facts = { id: identifier(event.id), conversationId: identifier(event.conversationId), kind: event.kind, text: journalText(event.text), tool: nullableId(event.tool), requestId: nullableId(event.requestId), resource, checkId: nullableId(event.checkId), status: nullableId(event.status), reason: nullableId(event.reason), digest: null, order: integer(event.order), createdAt: time(event.createdAt), orderKnown: event.orderKnown };
    if (event.digest !== null) facts.digest = sha(event.digest);
    if (['assistant_text', 'host_briefing'].includes(event.kind)) { if (facts.tool !== null || facts.requestId !== null || facts.resource !== null || facts.checkId !== null || facts.status !== null || facts.reason !== null || facts.digest !== null) fail('invalid_member_text'); }
    else if (facts.text !== '') fail('invalid_member_fact_text');
    if (['tool_request', 'tool_result'].includes(event.kind) && (facts.tool === null || facts.requestId === null)) fail('member_tool_identity_required');
    return facts;
  }).sort((a, b) => a.order - b.order);
  if (new Set(events.map((event) => event.id)).size !== events.length || new Set(events.map((event) => event.order)).size !== events.length) fail('duplicate_member_event');
  if (events.reduce((sum, event) => sum + event.text.length, 0) > 4194304) fail('member_conversation_budget');
  const fields = { schemaVersion: 1, projectId, revision: integer(value.revision, 0), runs, events }; const digest = digestValue(fields);
  if (value.digest !== undefined && value.digest !== digest) fail('member_conversation_digest_mismatch');
  return immutable({ ...fields, digest });
}
export function createMemberConversations(projectId) { return memberConversations({ schemaVersion: 1, projectId, revision: 0, runs: [], events: [] }); }
function nextMembers(value, patch) { return memberConversations({ ...value, ...patch, revision: value.revision + 1, digest: undefined }); }
export function beginMemberConversation(value, input) {
  const journal = memberConversations(value); exactObject(input, ['id', 'roleId', 'channel', 'taskId', 'instanceId', 'runId', 'planDigest', 'startedAt']);
  return nextMembers(journal, { runs: [...journal.runs, { ...input, status: 'running', finishedAt: null }] });
}
export function appendMemberConversation(value, input) {
  const journal = memberConversations(value); exactObject(input, ['id', 'conversationId', 'kind', 'text', 'tool', 'requestId', 'resource', 'checkId', 'status', 'reason', 'digest', 'createdAt']);
  const descriptor = Object.getOwnPropertyDescriptor(input, 'text'); if (!descriptor || !Object.hasOwn(descriptor, 'value')) fail('invalid_conversation_text'); const chunk = journalText(descriptor.value);
  const run = journal.runs.find((run) => run.id === input.conversationId); if (!run || run.status !== 'running') fail('member_run_not_active');
  const events = [...journal.events]; const old = events.find((event) => event.id === input.id);
  if (old) { if (input.kind !== 'assistant_text' || old.kind !== input.kind || old.conversationId !== input.conversationId) fail('duplicate_member_event'); events[events.indexOf(old)] = { ...old, text: old.text + chunk }; }
  else { const reserved = journal.runs.filter((run) => run.status === 'running').length; if (input.kind !== 'terminal' && events.length + reserved >= 1024) fail('member_conversation_budget'); let order = 1; if (events.length) order = events.at(-1).order + 1; events.push({ ...input, text: chunk, order, orderKnown: true }); }
  return nextMembers(journal, { events });
}
export function finishMemberConversation(value, input) {
  let journal = memberConversations(value); exactObject(input, ['conversationId', 'status', 'assistantText', 'messageId', 'terminalId', 'reason', 'finishedAt']);
  const run = journal.runs.find((run) => run.id === input.conversationId); if (!run) fail('unknown_member_run');
  if (!['completed', 'failed', 'cancelled', 'interrupted'].includes(input.status)) fail('invalid_member_run');
  if (run.status !== 'running') { if (run.status === input.status) return journal; fail('member_run_finished'); }
  const final = journalText(input.assistantText); const observed = journal.events.filter((event) => event.conversationId === run.id && event.kind === 'assistant_text').map((event) => event.text).join('');
  if (final && final !== observed) {
    let text = final; let known = false; if (final.startsWith(observed)) { text = final.slice(observed.length); known = true; }
    journal = appendMemberConversation(journal, { id: input.messageId, conversationId: run.id, kind: 'assistant_text', text, tool: null, requestId: null, resource: null, checkId: null, status: null, reason: null, digest: null, createdAt: input.finishedAt });
    if (!known) journal = nextMembers(journal, { events: journal.events.map((event) => { if (event.id === input.messageId) return { ...event, orderKnown: false }; return event; }) });
  }
  journal = appendMemberConversation(journal, { id: input.terminalId, conversationId: run.id, kind: 'terminal', text: '', tool: null, requestId: null, resource: null, checkId: null, status: input.status, reason: input.reason, digest: null, createdAt: input.finishedAt });
  return nextMembers(journal, { runs: journal.runs.map((item) => { if (item.id === run.id) return { ...item, status: input.status, finishedAt: input.finishedAt }; return item; }) });
}
export function interruptMemberConversations(value) {
  const journal = memberConversations(value); if (!journal.runs.some((run) => run.status === 'running')) return journal;
  return nextMembers(journal, { runs: journal.runs.map((run) => { if (run.status === 'running') return { ...run, status: 'interrupted' }; return run; }) });
}

/** Private, bounded role working context. Original journals remain separate and unchanged. */
export const ROLE_MEMORY_LIMITS = immutable({ hardChars: 65536, softChars: 49152, softMessages: 96, recentChars: 16384, recentMessages: 64, summaryChars: 8192, messages: 128, aggregateBytes: 2097152 });
function memoryPlain(value, depth = 0) {
  if (depth > 8) fail('invalid_role_memory');
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (!value || typeof value !== 'object' || (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype)) fail('invalid_role_memory');
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) { if (Array.isArray(value) && key === 'length') continue; if (key === 'digest' && descriptor.value === undefined) continue; if (!Object.hasOwn(descriptor, 'value') || ['__proto__', 'constructor', 'prototype', 'apiKey', 'credentials', 'token', 'authorization', 'toolResponses'].includes(key)) fail('invalid_role_memory'); memoryPlain(descriptor.value, depth + 1); }
}
export function roleMemoriesDocument(value) {
  memoryPlain(value); exactObject(value, ['schemaVersion', 'projectId', 'revision', 'entries', 'digest']);
  if (![1,2].includes(value.schemaVersion) || !Array.isArray(value.entries) || value.entries.length > 256) fail('role_memory_budget');
  const entries = value.entries.map((entry) => {
    exactObject(entry, ['roleId', 'channel', 'revision', 'summary', 'covered', 'messages', 'sourceDigest', 'updatedAt']);
    const summary = journalText(entry.summary); if (summary.length > ROLE_MEMORY_LIMITS.summaryChars) fail('role_memory_budget');
    if (!Array.isArray(entry.covered) || entry.covered.length > 4096 || !Array.isArray(entry.messages) || entry.messages.length > ROLE_MEMORY_LIMITS.messages) fail('role_memory_budget');
    const covered = entry.covered.map((ref) => { exactObject(ref, ['sourceId', 'sourceDigest']); return { sourceId: sha(ref.sourceId), sourceDigest: sha(ref.sourceDigest) }; });
    const messages = entry.messages.map((message) => { exactObject(message, ['sourceId', 'sourceDigest', 'role', 'text']); if (!['user', 'assistant'].includes(message.role)) fail('invalid_role_memory'); return { sourceId: sha(message.sourceId), sourceDigest: sha(message.sourceDigest), role: message.role, text: journalText(message.text) }; });
    if (new Set(covered.map((ref) => ref.sourceId)).size !== covered.length || new Set(messages.map((message) => message.sourceId)).size !== messages.length || messages.some((message) => covered.some((ref) => ref.sourceId === message.sourceId))) fail('invalid_role_memory');
    if (summary.length + messages.reduce((sum, message) => sum + message.text.length, 0) > ROLE_MEMORY_LIMITS.hardChars || (covered.length && !summary.trim())) fail('role_memory_budget');
    return { roleId: identifier(entry.roleId), ...(value.schemaVersion===2?{channel:memoryChannel(entry.roleId,entry.channel)}:{}), revision: integer(entry.revision, 0), summary, covered, messages, sourceDigest: sha(entry.sourceDigest), updatedAt: time(entry.updatedAt) };
  });
  if (new Set(entries.map((entry) => entry.roleId+'|'+(entry.channel??''))).size !== entries.length) fail('invalid_role_memory');
  const fields = { schemaVersion: value.schemaVersion, projectId: projectIdentifier(value.projectId), revision: integer(value.revision, 0), entries };
  if (new TextEncoder().encode(JSON.stringify(fields)).byteLength > ROLE_MEMORY_LIMITS.aggregateBytes) fail('role_memory_budget');
  const digest = digestValue(fields); if (value.digest !== undefined && value.digest !== digest) fail('role_memory_digest_mismatch');
  return immutable({ ...fields, digest });
}
export function createRoleMemories(projectId) { return roleMemoriesDocument({ schemaVersion: 2, projectId, revision: 0, entries: [] }); }
export function saveRoleMemory(value, input) {
  const memories = roleMemoriesDocument(value); memoryPlain(input); exactObject(input, ['roleId', 'channel', 'expectedRevision', 'summary', 'covered', 'messages', 'sourceDigest', 'updatedAt']);
  const channel=memoryChannel(input.roleId,input.channel); const previous = memories.entries.find((entry) => entry.roleId === input.roleId && entry.channel===channel); const revision = previous?.revision ?? 0;
  if (input.expectedRevision !== revision) fail('stale_role_memory');
  const entry = { roleId: input.roleId, channel, revision: revision + 1, summary: input.summary, covered: input.covered, messages: input.messages, sourceDigest: input.sourceDigest, updatedAt: input.updatedAt };
  return roleMemoriesDocument({ ...memories, entries: [...memories.entries.filter((item) => item.roleId !== input.roleId || item.channel!==channel), entry], revision: memories.revision + 1, digest: undefined });
}
/** Never export private source values, summary text, checkpoints or SDK authorization. */
export function roleMemoryDTO(value) {
  const memories = roleMemoriesDocument(value);
  return immutable({ revision: memories.revision, localCharsLimit: ROLE_MEMORY_LIMITS.hardChars, modelWindow: null, cost: null, entries: memories.entries.map((entry) => ({ roleId: entry.roleId, channel:entry.channel, revision: entry.revision, hasSummary: Boolean(entry.summary), summaryChars: entry.summary.length, recentMessages: entry.messages.length, coveredMessages: entry.covered.length, updatedAt: entry.updatedAt })) });
}

/** Host Shell workflow journal. It contains facts, never an execution permit or publication receipt. */
export function shellWorkflowDocument(value) {
  exactObject(value, ['schemaVersion', 'projectId', 'revision', 'requests', 'digest']);
  if (value.schemaVersion !== 1 || !Array.isArray(value.requests) || value.requests.length > 256) fail('shell_workflow_budget');
  const requests = value.requests.map((entry) => {
    exactObject(entry, ['id', 'revision', 'request', 'requestDigest', 'origin', 'bindings', 'preparation', 'status', 'review', 'reviewer', 'reviewStatus', 'reviewText', 'output', 'result', 'publication', 'recovery', 'createdAt', 'expiresAt', 'updatedAt']);
    const request = new ShellRequest(entry.request); if (request.requestId !== entry.id || request.digest !== entry.requestDigest) fail('shell_request_mismatch');
    exactObject(entry.origin, ['projectId', 'roleId', 'taskId', 'sessionId', 'instanceId', 'runId']);
    for (const key of ['roleId', 'taskId', 'sessionId', 'instanceId', 'runId']) identifier(entry.origin[key]); if (entry.origin.projectId !== value.projectId || entry.origin.runId !== request.runId || entry.origin.roleId === 'ProjectManager') fail('actor_forbidden');
    exactObject(entry.bindings, ['planDigest', 'organizationDigest', 'organizationVersion', 'roleDigest', 'roleRevision', 'profileVersion', 'contextSnapshotDigest', 'fileOwnersDigest', 'epoch']);
    for (const key of ['planDigest', 'organizationDigest', 'roleDigest', 'profileVersion', 'contextSnapshotDigest', 'fileOwnersDigest']) sha(entry.bindings[key]); integer(entry.bindings.roleRevision); integer(entry.bindings.epoch, 0); identifier(entry.bindings.organizationVersion);
    if (!['pending', 'reviewing', 'approved', 'denied', 'consumed', 'running', 'publishing', 'published', 'partial_published', 'failed', 'cancelled', 'expired', 'stale', 'unsupported', 'error', 'interrupted', 'recovery_required', 'recovered'].includes(entry.status)) fail('invalid_shell_phase');
    let preparation = null; if (entry.preparation !== null) { preparation = new ShellPreparation(entry.preparation); if (preparation.requestId !== request.requestId || preparation.requestDigest !== request.digest) fail('shell_preparation_mismatch'); }
    let review = null; if (entry.review !== null) { review = new ShellReview(entry.review); if (review.requestId !== request.requestId || review.requestDigest !== request.digest || review.revision !== entry.revision) fail('shell_review_mismatch'); }
    let reviewer = null; if (entry.reviewer !== null) { exactObject(entry.reviewer, ['instanceId', 'sessionId', 'runId', 'profileVersion']); reviewer = { instanceId: identifier(entry.reviewer.instanceId), sessionId: identifier(entry.reviewer.sessionId), runId: identifier(entry.reviewer.runId), profileVersion: sha(entry.reviewer.profileVersion) }; }
    const reviewState = {}; if (entry.reviewStatus !== undefined) { if (!['running','completed','failed','cancelled','interrupted'].includes(entry.reviewStatus)) fail('invalid_shell_phase'); reviewState.reviewStatus = entry.reviewStatus; } const reviewText = journalText(entry.reviewText); exactObject(entry.output, ['stdout', 'stderr', 'truncated']); const stdout = journalText(entry.output.stdout), stderr = journalText(entry.output.stderr); if (new TextEncoder().encode(stdout + stderr).byteLength > 65536 || typeof entry.output.truncated !== 'boolean') fail('shell_output_budget');
    let result = null; if (entry.result !== null) { result = new ShellResult(entry.result); if (result.requestId !== entry.id || result.runId !== request.runId || result.requestDigest !== request.digest || result.status === 'ready_for_publication') fail('shell_result_mismatch'); }
    let publication = null; if (entry.publication !== null) { exactObject(entry.publication, ['state', 'candidates', 'results', 'generationDigest', 'artifactSnapshots']); if (!['staged', 'publishing', 'complete', 'recovery_required'].includes(entry.publication.state) || !Array.isArray(entry.publication.results) || entry.publication.results.length > 10000) fail('invalid_publication'); publication = { state: entry.publication.state, candidates: entry.publication.candidates.map((candidate) => new ShellCandidate(candidate)), results: entry.publication.results.map((result) => ({ ...new MutationResult(result) })), generationDigest: sha(entry.publication.generationDigest) }; if (entry.publication.artifactSnapshots !== undefined) { if (!Array.isArray(entry.publication.artifactSnapshots) || entry.publication.artifactSnapshots.length > 64) fail('invalid_publication'); publication.artifactSnapshots = entry.publication.artifactSnapshots.map((item) => { exactObject(item, ['scope','digest']); const [scope] = shellEffects([item.scope]); return { scope, digest: sha(item.digest) }; }); } }
    const recovery = {}; if (entry.recovery !== undefined) { exactObject(entry.recovery, ['planDigest', 'resources', 'evidenceIds', 'recoveredAt', 'retainedOutputs']); recovery.recovery = { planDigest: sha(entry.recovery.planDigest), resources: entry.recovery.resources.map((file) => ({ ...new FileBaseline(file) })), evidenceIds: entry.recovery.evidenceIds.map((id) => identifier(id)), recoveredAt: time(entry.recovery.recoveredAt), ...(entry.recovery.retainedOutputs === undefined ? {} : { retainedOutputs: entry.recovery.retainedOutputs.map(recoveryRetainedFact) }) }; if (entry.status !== 'recovered') fail('invalid_shell_phase'); }
    return { id: identifier(entry.id), revision: integer(entry.revision), request, requestDigest: request.digest, origin: { ...entry.origin }, bindings: { ...entry.bindings }, preparation, status: entry.status, review, reviewer, ...reviewState, reviewText, output: { stdout, stderr, truncated: entry.output.truncated }, result, publication, ...recovery, createdAt: time(entry.createdAt), expiresAt: time(entry.expiresAt), updatedAt: time(entry.updatedAt) };
  });
  if (new Set(requests.map((request) => request.id)).size !== requests.length) fail('duplicate_shell_request');
  const fields = { schemaVersion: 1, projectId: projectIdentifier(value.projectId), revision: integer(value.revision, 0), requests }; const digest = digestValue(fields); if (value.digest !== undefined && value.digest !== digest) fail('shell_workflow_digest_mismatch'); return immutable({ ...fields, digest });
}
export function createShellWorkflow(projectId) { return shellWorkflowDocument({ schemaVersion: 1, projectId, revision: 0, requests: [] }); }
export function enqueueShellWorkflow(value, input) { const journal = shellWorkflowDocument(value); return shellWorkflowDocument({ ...journal, revision: journal.revision + 1, requests: [...journal.requests, input], digest: undefined }); }
export function updateShellWorkflow(value, id, patch) {
  const journal = shellWorkflowDocument(value); exactObject(patch, ['status', 'review', 'reviewer', 'reviewStatus', 'reviewText', 'output', 'result', 'publication', 'recovery', 'updatedAt']); const old = journal.requests.find((entry) => entry.id === id); if (!old) fail('unknown_shell_request');
  if (patch.status && patch.status !== old.status) {
    const next = { pending: ['reviewing','cancelled','expired','denied','interrupted'], reviewing: ['approved','denied','cancelled','expired','interrupted'], approved: ['consumed','denied','cancelled','expired','stale','interrupted'], consumed: ['running','failed','cancelled','stale','unsupported','error','interrupted'], running: ['publishing','failed','denied','cancelled','stale','unsupported','error','interrupted'], publishing: ['published','partial_published','recovery_required'], partial_published: ['recovered'], recovery_required: ['recovered'] };
    if (!(next[old.status] ?? []).includes(patch.status)) fail('invalid_shell_phase');
  }
  return shellWorkflowDocument({ ...journal, revision: journal.revision + 1, requests: journal.requests.map((entry) => { if (entry.id === id) return { ...entry, ...patch }; return entry; }), digest: undefined });
}
export function interruptShellWorkflow(value, now) {
  let journal = shellWorkflowDocument(value); for (const entry of journal.requests) if (['pending', 'reviewing', 'approved', 'consumed', 'running', 'publishing'].includes(entry.status)) { let status = 'interrupted'; if (entry.status === 'publishing' || entry.publication?.results.some((result) => result.observedMutation)) status = 'recovery_required'; journal = updateShellWorkflow(journal, entry.id, { status, ...(entry.reviewStatus === 'running' ? { reviewStatus: 'interrupted' } : {}), updatedAt: now }); } return journal;
}
export function publicShellWorkflow(value) {
  const journal = shellWorkflowDocument(value);
  return immutable(journal.requests.map((entry) => ({ id: entry.id, revision: entry.revision, roleId: entry.origin.roleId, taskId: entry.origin.taskId, instanceId: entry.origin.instanceId, runId: entry.origin.runId, command: entry.request.command, cwd: entry.request.cwd, reason: entry.request.reason, network: entry.request.network, generatedEffects: entry.request.generatedEffects, timeoutSeconds: entry.request.timeoutSeconds, requestDigest: entry.requestDigest, status: entry.status, review: entry.review, reviewer: entry.reviewer, ...(entry.reviewStatus ? { reviewStatus: entry.reviewStatus } : {}), reviewText: '', output: entry.output, result: entry.result, ...(entry.recovery ? { recovery: entry.recovery } : {}), createdAt: entry.createdAt, expiresAt: entry.expiresAt, updatedAt: entry.updatedAt })));
}

/** Host recovery observation only, never a MutationResult or execution authority. */
export function recoveryRetainedFact(value) {
  exactObject(value,['kind','resource','sourceRequestId','sourceRequestDigest','sourcePlanDigest','sourceProposalDigest','candidateDigest','baseline','tombstone','planDigest','taskId','roleId','instanceId','runId','fileOwnersDigest','humanRequestId','humanRequestDigest','verifiedAt']);
  if (value.kind !== 'recovery_verified_retained') fail('invalid_input');
  const fact = {kind:value.kind,resource:normalizeResource(value.resource),baseline:new FileBaseline(value.baseline),verifiedAt:time(value.verifiedAt)};
  if (fact.baseline.resource !== fact.resource) fail('invalid_input');
  for (const key of ['sourceRequestId','taskId','roleId','instanceId','runId','humanRequestId']) fact[key]=identifier(value[key]);
  for (const key of ['sourceRequestDigest','sourcePlanDigest','sourceProposalDigest','candidateDigest','planDigest','fileOwnersDigest','humanRequestDigest']) fact[key]=sha(value[key]);
  if (fact.baseline.state==='absent') { exactObject(value.tombstone,['resource','priorSha256','proposalDigest']); fact.tombstone={resource:normalizeResource(value.tombstone.resource),priorSha256:sha(value.tombstone.priorSha256),proposalDigest:sha(value.tombstone.proposalDigest)}; if (fact.tombstone.resource!==fact.resource || fact.tombstone.proposalDigest!==fact.sourceProposalDigest) fail('invalid_input'); }
  else if (value.tombstone!==undefined) fail('invalid_input');
  return immutable(fact);
}



/** Private typed supervision record only. Raw SDK text never enters this journal. */
export function supervisionRecord(value){
 exactObject(value,['id','projectId','instanceId','runId','planDigest','organizationDigest','phase','status','advice','sourceDigests','createdAt','failureCode']);
 if(!['preflight','monitor'].includes(value.phase)||!['completed','not_completed'].includes(value.status))fail('invalid_supervision');
 let advice=null;if(value.advice!==null){advice=supervisionInput(value.advice);if(advice.planDigest!==value.planDigest||advice.phase!==value.phase)fail('invalid_supervision');}
 if(value.status==='completed'&&advice===null)fail('invalid_supervision');
 if(!Array.isArray(value.sourceDigests)||value.sourceDigests.length>256)fail('invalid_supervision');
 let extra={};if(value.failureCode!==undefined){if(!/^[a-z][a-z0-9_]{0,79}$/u.test(value.failureCode))fail('invalid_supervision');extra={failureCode:value.failureCode};}
 return immutable({...extra,id:identifier(value.id),projectId:projectIdentifier(value.projectId),instanceId:identifier(value.instanceId),runId:identifier(value.runId),planDigest:sha(value.planDigest),organizationDigest:sha(value.organizationDigest),phase:value.phase,status:value.status,advice,sourceDigests:value.sourceDigests.map(item=>{exactObject(item,['id','digest']);return {id:textValue(item.id,'',200),digest:sha(item.digest)};}),createdAt:time(value.createdAt)});
}

export const MEMORY_CHANNELS = Object.freeze(['su_customer','pm_delegate','supervision_preflight','supervision_monitor','member_task']);
export function memoryChannel(roleId, channel = null) {
  const actual = channel ?? (roleId === 'ProjectManager' ? 'pm_delegate' : roleId === 'Supervisor' ? 'su_customer' : 'member_task');
  if (!MEMORY_CHANNELS.includes(actual) || (actual.startsWith('supervision_') || actual === 'su_customer') && roleId !== 'Supervisor' || actual === 'pm_delegate' && roleId !== 'ProjectManager' || actual === 'member_task' && ['ProjectManager','Supervisor'].includes(roleId)) fail('invalid_memory_channel');
  return actual;
}
export function customerTimeline(value) {
  exactObject(value,['schemaVersion','actor','projectId','revision','historyImported','legacyMessages','turns','messages','digest']);
  if(value.schemaVersion!==2||value.actor!=='Supervisor')fail('invalid_customer_timeline');
  const {actor,digest,...fields}=value;const inner=conversationTimeline({...fields,schemaVersion:1,digest:undefined});
  const result={...inner,schemaVersion:2,actor:'Supervisor',digest:undefined};delete result.digest;const expected=digestValue(result);
  if(digest!==undefined&&digest!==expected)fail('conversation_digest_mismatch');return immutable({...result,digest:expected});
}
export function createCustomerTimeline(projectId){return customerTimeline({...createConversationTimeline(projectId),schemaVersion:2,actor:'Supervisor',digest:undefined});}
export function customerTimelineInner(value){const {actor,digest,...fields}=customerTimeline(value);return conversationTimeline({...fields,schemaVersion:1,digest:undefined});}
export function updateCustomerTimeline(value, transition, ...args){return customerTimeline({...transition(customerTimelineInner(value),...args),schemaVersion:2,actor:'Supervisor',digest:undefined});}
export function delegationJournal(value){
 exactObject(value,['schemaVersion','projectId','revision','entries','digest']);if(value.schemaVersion!==1||!Array.isArray(value.entries)||value.entries.length>256)fail('delegation_budget');
 const entries=value.entries.map(entry=>{exactObject(entry,['id','purpose','instruction','sourceRefs','bindings','status','question','answerRef','result','createdAt','updatedAt']);identifier(entry.id);if(!['plan','role_design','repair'].includes(entry.purpose)||!['running','awaiting_human','completed','failed','cancelled','stale'].includes(entry.status))fail('invalid_delegation');
 if(typeof entry.instruction!=='string'||!entry.instruction.trim()||new TextEncoder().encode(entry.instruction).byteLength>8192||!Array.isArray(entry.sourceRefs)||entry.sourceRefs.length>32)fail('delegation_budget');for(const ref of entry.sourceRefs)text(ref,200);
 exactObject(entry.bindings,['customerInstanceId','customerRunId','pmInstanceId','pmRunId','organizationDigest','ownerDigest','profileVersion','contextDigest','workspaceDigest']);for(const key of ['customerInstanceId','customerRunId','pmInstanceId','pmRunId'])identifier(entry.bindings[key]);for(const key of ['organizationDigest','ownerDigest','profileVersion','contextDigest','workspaceDigest'])sha(entry.bindings[key]);if(entry.question!==null){exactObject(entry.question,['ref','payload','requestId','runId','digest','publicRequestId']);identifier(entry.question.ref);identifier(entry.question.requestId);identifier(entry.question.runId);if(entry.question.runId!==entry.bindings.pmRunId)fail('invalid_delegation');if(entry.question.publicRequestId!==null)identifier(entry.question.publicRequestId);sha(entry.question.digest);if(digestValue(entry.question.payload)!==entry.question.digest)fail('invalid_delegation');}if(entry.answerRef!==null)identifier(entry.answerRef);time(entry.createdAt);time(entry.updatedAt);memoryPlain(entry);return entry;});if(new Set(entries.map(entry=>entry.id)).size!==entries.length)fail('invalid_delegation');
 const fields={schemaVersion:1,projectId:projectIdentifier(value.projectId),revision:integer(value.revision,0),entries};const digest=digestValue(fields);if(value.digest!==undefined&&value.digest!==digest)fail('delegation_digest_mismatch');return immutable({...fields,digest});
}
export function createDelegations(projectId){return delegationJournal({schemaVersion:1,projectId,revision:0,entries:[]});}
