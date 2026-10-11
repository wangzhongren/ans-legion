import { assertKnownTextMergeFree } from '../../src/models/workbench.mjs';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { ShellRequest, ShellReview } from 'legion-runtime/workbench-models';
import { createShellWorkflow, enqueueShellWorkflow, updateShellWorkflow, interruptShellWorkflow, publicShellWorkflow } from '../../src/models/interaction.mjs';
import assert from 'node:assert/strict';
import { createInteraction, interactionDocument, interactionBindings, answerInteraction, closeInteraction,
  invalidateInteraction, createInteractionQueue, interactionQueueDocument, enqueueInteraction,
  answerQueuedInteraction, pendingInteractions, restoreInteractionQueue } from '../../src/models/interaction.mjs';

const projectId = 'a'.repeat(64);
const origin = { roleId: 'ProjectManager', instanceId: 'pm-1', runId: 'run-1', toolRequestId: 'tool-1' };
const actor = { projectId, roleId: 'Human' };
const time = '2026-10-08T10:00:00.000Z';
function shellEntry() { const request = new ShellRequest({ requestId:'shell-1',runId:'worker-run',command:'printf safe > src/a.mjs',reason:'当前任务',generatedEffects:[] }); return { id:request.requestId,revision:1,request,requestDigest:request.digest,origin:{projectId,roleId:'Worker',taskId:'task-1',sessionId:'session-1',instanceId:'worker-1',runId:'worker-run'},bindings:{planDigest:'a'.repeat(64),organizationDigest:'b'.repeat(64),organizationVersion:'v1',roleDigest:'c'.repeat(64),roleRevision:1,profileVersion:'d'.repeat(64),contextSnapshotDigest:'e'.repeat(64),fileOwnersDigest:'f'.repeat(64),epoch:1},preparation:null,status:'pending',review:null,reviewer:null,reviewText:'',output:{stdout:'',stderr:'',truncated:false},result:null,publication:null,createdAt:time,expiresAt:'2026-10-08T10:05:00.000Z',updatedAt:time }; }
test('Shell durable request is immutable, exact and cannot revive a terminal grant; publishing restart pauses conservatively', () => { const input=shellEntry();let journal=enqueueShellWorkflow(createShellWorkflow(projectId),input);assert.ok(Object.isFrozen(journal.requests[0]));assert.equal(publicShellWorkflow(journal)[0].bindings,undefined);assert.throws(()=>enqueueShellWorkflow(journal,input),{code:'duplicate_shell_request'});journal=updateShellWorkflow(journal,input.id,{status:'reviewing'});journal=updateShellWorkflow(journal,input.id,{status:'approved',review:new ShellReview({requestId:input.id,requestDigest:input.requestDigest,revision:1,approved:true,reason:'本次批准'})});journal=updateShellWorkflow(journal,input.id,{status:'consumed'});journal=updateShellWorkflow(journal,input.id,{status:'running'});journal=updateShellWorkflow(journal,input.id,{status:'publishing'});journal=interruptShellWorkflow(journal,time);assert.equal(journal.requests[0].status,'recovery_required');assert.throws(()=>updateShellWorkflow(journal,input.id,{status:'approved'}),{code:'invalid_shell_phase'});assert.throws(()=>updateShellWorkflow(journal,input.id,{request:input.request})); });
const bindings = { planDigest: 'b'.repeat(64), organizationRevision: 1, organizationDigest: 'c'.repeat(64) };
function request(overrides = {}) {
  return createInteraction({ requestId: 'request-1', projectId, version: 1, kind: 'confirmation', purpose: 'execute_plan',
    title: 'Run the approved plan', text: 'Execute these exact files and checks?', options: [], allowSupplement: false,
    bindings, createdOrder: 1, createdAt: time, ...overrides }, origin);
}
function answerInput(current, value = true, overrides = {}) {
  return { requestId: current.requestId, projectId, version: current.version, requestDigest: current.digest,
    answerId: 'answer-1', answeredAt: time, value, ...overrides };
}
function answered(current, value) { return answerInteraction(current, answerInput(current, value), actor, current.bindings); }

test('interaction round trips preserve immutable defining digest, answer and trusted origin', () => {
  const current = request();
  const result = answered(current, true);
  assert.equal(current.status, 'pending');
  assert.equal(result.status, 'answered');
  assert.equal(result.answer.value, true);
  assert.equal(result.digest, current.digest);
  assert.equal(result.origin.runId, 'run-1');
  assert.ok(Object.isFrozen(result.bindings));
  assert.deepEqual(interactionDocument(JSON.parse(JSON.stringify(result))), result);
  assert.throws(() => interactionDocument({ ...result, text: 'changed question' }), /digest_mismatch/);
});

test('confirmation rejection is a real answer; question yes is never execute_plan confirmation', () => {
  const rejected = answered(request(), false);
  assert.equal(rejected.status, 'rejected');
  assert.equal(rejected.answer.value, false);
  const question = request({ kind: 'question', purpose: 'discussion', bindings: {} });
  const reply = answered(question, 'yes');
  assert.equal(reply.kind, 'question');
  assert.equal(reply.purpose, 'discussion');
  assert.equal(reply.answer.value, 'yes');
  assert.throws(() => answered(request(), 'yes'), /invalid_confirmation/);
  assert.throws(() => request({ kind: 'question' }), /invalid_execution_confirmation/);
  assert.throws(() => request({ bindings: {} }), /invalid_execution_confirmation/);
});

test('choice answers require an offered option and explicitly permitted supplementary text', () => {
  const choice = request({ kind: 'choice', purpose: 'discussion', options: [{ id: 'one', label: 'One' }, { id: 'two', label: 'Two' }], bindings: {} });
  assert.deepEqual(answered(choice, { optionId: 'two', text: '' }).answer.value, { optionId: 'two', text: '' });
  assert.throws(() => answered(choice, { optionId: 'invented', text: '' }), /invalid_option/);
  assert.throws(() => answered(choice, { optionId: 'one', text: 'extra' }), /supplement_not_allowed/);
  assert.equal(answered(request({ kind: 'choice', purpose: 'discussion', options: choice.options, bindings: {}, allowSupplement: true }), { optionId: 'one', text: 'why\nthis one' }).answer.value.text, 'why\nthis one');
});

test('question accepts real multiline text and rejects empty, oversized and control-character answers', () => {
  const question = request({ kind: 'question', purpose: 'discussion', bindings: {} });
  assert.equal(answered(question, 'first\nsecond').answer.value, 'first\nsecond');
  for (const value of ['', '   ', 'x'.repeat(16385), 'bad\u0000text', true]) assert.throws(() => answered(question, value), /invalid_answer_text/);
});

test('request, version, digest, current binding and project identity reject stale answers', () => {
  const current = request();
  for (const patch of [{ requestId: 'other' }, { version: 2 }, { requestDigest: 'f'.repeat(64) }]) assert.throws(() => answerInteraction(current, answerInput(current, true, patch), actor, bindings), /stale_interaction/);
  assert.throws(() => answerInteraction(current, answerInput(current, true, { projectId: 'f'.repeat(64) }), actor, bindings), /actor_forbidden/);
  assert.throws(() => answerInteraction(current, answerInput(current), { ...actor, projectId: 'f'.repeat(64) }, bindings), /actor_forbidden/);
  assert.throws(() => answerInteraction(current, answerInput(current), { ...actor, roleId: 'ProjectManager' }, bindings), /actor_forbidden/);
  assert.throws(() => answerInteraction(current, answerInput(current), actor, { ...bindings, organizationRevision: 2 }), /stale_interaction/);
});

test('unknown and spoofed fields are rejected at each payload boundary', () => {
  const current = request();
  assert.throws(() => request({ roleId: 'ProjectManager' }));
  assert.throws(() => createInteraction({ ...current }, { ...origin, roleId: 'RoleArchitect' }));
  assert.throws(() => answerInteraction(current, { ...answerInput(current), roleId: 'Human' }, actor, bindings));
  assert.throws(() => interactionBindings({ ...bindings, arbitraryCommand: 'run' }));
  assert.throws(() => answered(current, { accepted: true }));
  assert.throws(() => interactionDocument({ ...current, answer: { answerId: 'a', answeredAt: time, value: true } }), /invalid_answer_state/);
});

test('identical response delivery is idempotent and conflicting duplicate responses are refused', () => {
  const current = request();
  const result = answered(current, true);
  assert.deepEqual(answerInteraction(result, answerInput(current), actor, bindings), result);
  assert.throws(() => answerInteraction(result, answerInput(current, false), actor, bindings), /already_answered/);
  assert.throws(() => answerInteraction(result, answerInput(current, true, { answerId: 'other' }), actor, bindings), /already_answered/);
  assert.throws(() => answerInteraction(result, answerInput(current, true, { answeredAt: '2026-10-08T10:01:00.000Z' }), actor, bindings), /already_answered/);
});

test('closing is not an answer; invalidation preserves actual answers and forbids replay', () => {
  const current = request();
  assert.deepEqual(closeInteraction(current), current);
  assert.equal(closeInteraction(current).answer, null);
  const invalidated = invalidateInteraction(answered(current, true), 'Plan changed');
  assert.equal(invalidated.status, 'invalidated');
  assert.equal(invalidated.answer.value, true);
  assert.equal(invalidated.invalidationReason, 'Plan changed');
  assert.throws(() => answered(invalidated, true), /interaction_invalidated/);
  assert.deepEqual(invalidateInteraction(invalidated, 'again'), invalidated);
});

test('queue is project-bound, ordered and rejects repeated request identity or creation order', () => {
  let queue = createInteractionQueue(projectId);
  queue = enqueueInteraction(queue, request());
  queue = enqueueInteraction(queue, request({ requestId: 'request-2', createdOrder: 2 }));
  assert.deepEqual(pendingInteractions(queue).map((item) => item.requestId), ['request-1', 'request-2']);
  assert.throws(() => enqueueInteraction(queue, request({ requestId: 'request-1', createdOrder: 3 })), /invalid_enqueue/);
  assert.throws(() => enqueueInteraction(queue, request({ requestId: 'request-3', createdOrder: 2 })), /invalid_enqueue/);
  assert.throws(() => enqueueInteraction(queue, request({ requestId: 'request-3', projectId: 'f'.repeat(64), createdOrder: 3 })), /invalid_enqueue/);
  assert.deepEqual(interactionQueueDocument({ schemaVersion: 1, projectId, revision: 2, requests: [...queue.requests].reverse() }), queue);
  assert.throws(() => interactionQueueDocument({ ...queue, revision: 9 }), /queue_digest_mismatch/);
});

test('queue records response once and leaves only genuinely pending requests visible', () => {
  let queue = enqueueInteraction(createInteractionQueue(projectId), request());
  queue = enqueueInteraction(queue, request({ requestId: 'request-2', createdOrder: 2 }));
  const input = answerInput(queue.requests[0]);
  const result = answerQueuedInteraction(queue, input, actor, bindings);
  assert.equal(result.revision, queue.revision + 1);
  assert.equal(pendingInteractions(result).length, 1);
  assert.equal(pendingInteractions(result)[0].requestId, 'request-2');
  assert.deepEqual(answerQueuedInteraction(result, input, actor, bindings), result);
  assert.throws(() => answerQueuedInteraction(result, { ...input, requestId: 'unknown' }, actor, bindings), /unknown_interaction/);
});

test('restart restores pending and answered audit but cannot produce old runner tool responses', () => {
  let queue = enqueueInteraction(createInteractionQueue(projectId), request());
  queue = enqueueInteraction(queue, request({ requestId: 'request-2', createdOrder: 2 }));
  queue = answerQueuedInteraction(queue, answerInput(queue.requests[0]), actor, bindings);
  const restored = restoreInteractionQueue(JSON.parse(JSON.stringify(queue)));
  assert.deepEqual(restored.queue, queue);
  assert.equal(restored.resumeToolResponses, false);
  assert.equal(pendingInteractions(restored.queue).length, 1);
  assert.equal(restored.queue.requests[0].answer.value, true);
});

test('invalid request variants, duplicate options, invalid timestamps and budgets are rejected', () => {
  for (const patch of [{ kind: 'other' }, { purpose: 'other' }, { version: 0 }, { createdOrder: -1 },
    { createdAt: '2026-02-30T10:00:00.000Z' }, { text: '' }, { title: '' }, { allowSupplement: true },
    { kind: 'choice', purpose: 'discussion', options: [] }, { options: [{ id: 'one', label: 'one' }] }]) assert.throws(() => request(patch));
  assert.throws(() => request({ kind: 'choice', purpose: 'discussion', options: [{ id: 'same', label: 'a' }, { id: 'same', label: 'b' }] }), /invalid_options/);
  assert.throws(() => interactionQueueDocument({ schemaVersion: 1, projectId, revision: 0, requests: Array.from({ length: 257 }, () => request()) }), /queue_budget/);
});

test('timeline anchors identical text by unique turn/message/request/answer IDs; duplicate answers do not reorder', async () => {
  const {createConversationTimeline,beginConversationTurn,recordConversationQuestion,recordConversationAnswer,conversationTimeline}=await import('../../src/models/interaction.mjs');
  let timeline=createConversationTimeline(projectId);
  for(const index of [1,2]){
    timeline=beginConversationTurn(timeline,{turnId:'turn-'+index,userMessageId:'human-'+index,continuationAnswerId:null,text:'重复文字',createdAt:'2026-10-08T01:00:00.000Z'});
    let request=createInteraction({requestId:'request-'+index,projectId,version:1,kind:'question',purpose:'discussion',title:'问题'+index,text:'重复问题',options:[],allowSupplement:false,bindings:{},createdOrder:index,createdAt:'2026-10-08T01:00:01.000Z'},{roleId:'ProjectManager',instanceId:'pm',runId:'turn-'+index,toolRequestId:'tool-'+index});
    timeline=recordConversationQuestion(timeline,request,'turn-'+index);
    request=answerInteraction(request,{requestId:request.requestId,projectId,version:1,requestDigest:request.digest,answerId:'answer-'+index,answeredAt:'2026-10-08T01:00:02.000Z',value:'同样答案'},{projectId,roleId:'Human'},{});
    timeline=recordConversationAnswer(timeline,request);assert.equal(recordConversationAnswer(timeline,request).digest,timeline.digest);
  }
  assert.deepEqual(timeline.messages.map((message)=>message.kind),['human','question','answer','human','question','answer']);assert.equal(timeline.messages[0].text,timeline.messages[3].text);assert.notEqual(timeline.messages[0].id,timeline.messages[3].id);
  assert.deepEqual(conversationTimeline(JSON.parse(JSON.stringify(timeline))),timeline);assert.throws(()=>conversationTimeline({...timeline,messages:[...timeline.messages,timeline.messages[0]]}));
});

test('timeline legacy import invents neither timestamps nor interaction order; continuation must bind actual answer', async () => {
  const {createConversationTimeline,importConversationHistory,beginConversationTurn}=await import('../../src/models/interaction.mjs');
  const timeline=importConversationHistory(createConversationTimeline(projectId),{messages:[{role:'user',text:'旧文本'},{role:'assistant',text:'旧回复'}]});
  assert.equal(timeline.legacyMessages[0].createdAt,undefined);assert.equal(timeline.messages.length,0);assert.equal(importConversationHistory(timeline,{messages:[]}).digest,timeline.digest);
  assert.throws(()=>beginConversationTurn(timeline,{turnId:'resume',userMessageId:null,continuationAnswerId:'missing-answer',text:'',createdAt:'2026-10-08T01:00:00.000Z'}),/conversation_continuation_required/);
});


import { createMemberConversations, memberConversations, beginMemberConversation, appendMemberConversation, finishMemberConversation } from '../../src/models/interaction.mjs';
function memberJournal() { return beginMemberConversation(createMemberConversations(projectId), { id: 'run-member', roleId: 'RoleArchitect', taskId: 'role-design', instanceId: 'architect-actual', runId: 'run-member', planDigest: null, startedAt: time }); }
function memberEvent(text = '真实已产生文字') { return { id: 'segment-member', conversationId: 'run-member', kind: 'assistant_text', text, tool: null, requestId: null, resource: null, checkId: null, status: null, reason: null, digest: null, createdAt: time }; }

test('pending regression: isolated member journal merges actual text segments and closes its exact run without polluting PM timeline', () => {
  let journal = memberJournal(); journal = appendMemberConversation(journal, memberEvent('第一段')); journal = appendMemberConversation(journal, memberEvent('第二段')); assert.equal(journal.events.length, 1); assert.equal(journal.events[0].text, '第一段第二段');
  journal = appendMemberConversation(journal, { ...memberEvent(''), id: 'tool-member', kind: 'tool_result', tool: 'legion_list_files', requestId: 'list-actual', status: 'listed', resource: null });
  journal = finishMemberConversation(journal, { conversationId: 'run-member', status: 'cancelled', assistantText: '第一段第二段', messageId: 'final-member', terminalId: 'terminal-member', reason: 'run_cancelled', finishedAt: time });
  assert.equal(journal.runs[0].status, 'cancelled'); assert.equal(journal.events.filter((event) => event.kind === 'assistant_text').length, 1); assert.equal(journal.events.at(-1).kind, 'terminal'); assert.deepEqual(memberConversations(JSON.parse(JSON.stringify(journal))), journal);
  assert.throws(() => appendMemberConversation(journal, memberEvent('晚到文字')), /member_run_not_active/u);
});

test('pending regression: member text append rejects nonstrings/accessors/coercion before concatenation and publishes only typed fact statuses', () => {
  const journal = appendMemberConversation(memberJournal(), memberEvent('原文字')); let coerced = false;
  for (const value of [42, undefined, null, { [Symbol.toPrimitive]() { coerced = true; return '不准执行'; } }, { get toString() { coerced = true; return () => '不准执行'; } }]) assert.throws(() => appendMemberConversation(journal, { ...memberEvent(), text: value }), /invalid_conversation_text/u);
  const accessor = memberEvent(); Object.defineProperty(accessor, 'text', { enumerable: true, get() { coerced = true; return '不准读取'; } }); assert.throws(() => appendMemberConversation(journal, accessor), /invalid_conversation_text/u); assert.equal(coerced, false); assert.equal(journal.events[0].text, '原文字');
  assert.throws(() => appendMemberConversation(memberJournal(), { ...memberEvent(''), kind: 'tool_result', tool: 'legion_read_file', requestId: 'read', status: 'secret_vendor_text' }), /invalid_member_status/u);
  assert.throws(() => appendMemberConversation(memberJournal(), { ...memberEvent(''), kind: 'tool_result', tool: 'legion_read_file', requestId: 'read', status: 'read', payload: { fileBody: 'private' } }));
});

import { createRoleMemories, roleMemoriesDocument, saveRoleMemory, roleMemoryDTO } from '../../src/models/interaction.mjs';
import { digestValue } from 'legion-runtime/workbench-models';
function memoryInput(overrides = {}) { return { roleId: 'ProjectManager', expectedRevision: 0, summary: '', covered: [], messages: [{ sourceId: '1'.repeat(64), sourceDigest: '2'.repeat(64), role: 'user', text: '完整需求原文' }], sourceDigest: '3'.repeat(64), updatedAt: time, ...overrides }; }
test('persistent role working memory is immutable, revision bound and exposes counts only', () => {
  const empty = createRoleMemories(projectId), saved = saveRoleMemory(empty, memoryInput()); const restored = roleMemoriesDocument(JSON.parse(JSON.stringify(saved)));
  assert.equal(restored.entries[0].messages[0].text, '完整需求原文'); assert.ok(Object.isFrozen(saved.entries[0].messages)); assert.equal(saved.entries[0].revision, 1); assert.equal(empty.entries.length, 0);
  assert.throws(() => saveRoleMemory(saved, memoryInput()), { code: 'stale_role_memory' });
  const dto = roleMemoryDTO(saved); assert.equal(dto.entries[0].recentMessages, 1); assert.equal(dto.modelWindow, null); assert.equal(dto.cost, null); assert.equal(JSON.stringify(dto).includes('完整需求原文'), false); assert.equal(JSON.stringify(dto).includes('sourceDigest'), false);
  assert.throws(() => roleMemoriesDocument({ ...saved, projectId: 'b'.repeat(64) }), { code: 'role_memory_digest_mismatch' });
});
test('role memory rejects raw tool queues, credentials, effects and invalid summary/budget without changing original', () => {
  const empty = createRoleMemories(projectId); let calls = 0;
  for (const field of ['credentials', 'toolResponses', 'authorization', 'apiKey']) assert.throws(() => saveRoleMemory(empty, { ...memoryInput(), [field]: 'forbidden' }));
  const getter = memoryInput(); Object.defineProperty(getter, 'summary', { enumerable: true, get() { calls += 1; return ''; } }); assert.throws(() => saveRoleMemory(empty, getter), { code: 'invalid_role_memory' }); assert.equal(calls, 0);
  assert.throws(() => saveRoleMemory(empty, memoryInput({ summary: 'x'.repeat(8193) })), { code: 'role_memory_budget' });
  assert.throws(() => saveRoleMemory(empty, memoryInput({ messages: Array.from({ length: 129 }, (_, index) => ({ ...memoryInput().messages[0], sourceId: digestValue(index) })) })), { code: 'role_memory_budget' });
  assert.throws(() => saveRoleMemory(empty, memoryInput({ messages: [{ ...memoryInput().messages[0], role: 'tool' }] })), { code: 'invalid_role_memory' }); assert.equal(empty.entries.length, 0);
});
test('memory does not truncate single full messages or exceed aggregate2MiB', () => {
  const input = memoryInput({ messages: [{ ...memoryInput().messages[0], text: 'x'.repeat(65536) }] }); const saved = saveRoleMemory(createRoleMemories(projectId), input); assert.equal(saved.entries[0].messages[0].text.length, 65536);
  assert.throws(() => saveRoleMemory(createRoleMemories(projectId), { ...input, summary: 'x' }), { code: 'role_memory_budget' });
  const entries = Array.from({ length: 33 }, (_, index) => ({ ...saved.entries[0], roleId: 'Role' + index })); assert.throws(() => roleMemoriesDocument({ schemaVersion: 1, projectId, revision: 0, entries }), { code: 'role_memory_budget' });
});

test('known key stream reconciliation guards observed plus non-prefix terminal before either segment is committed',()=>{
 const key=randomBytes(24).toString('hex'),first=key.slice(0,24),last=key.slice(24);
 assert.throws(()=>assertKnownTextMergeFree(first,last,[key]),{code:'sensitive_output'});
 assert.throws(()=>assertKnownTextMergeFree(first,key,[key]),{code:'sensitive_output'});
 const original='合法原文'+ '文'.repeat(45000);
 assert.equal(assertKnownTextMergeFree(original,original+'终态',[key]),original+'终态');
 assert.equal(assertKnownTextMergeFree('非敏感观察','另一合法终态',[key]),'非敏感观察另一合法终态');
});
