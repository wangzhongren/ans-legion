import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorkbenchPipeline } from '../../src/pipelines/workbench.mjs';
import { FIXED_ROLE_DUTIES } from '../../src/models/organization.mjs';
import { modelFacts, supervisionReply, fixtureLeaseRoot, projectRoot, generated, environment, ownedDirectory, removeOwned, localServer, replyText, completion, planText, waitFor, messageText, confirmExecution } from './workbench-flow.test.mjs';

export const unwrap = result => { assert.equal(result.ok, true, JSON.stringify(result.error)); return result.value; };
export function assertAnswerTimeline(state,request) {
  const messages=state.timeline.messages;const question=messages.find(message=>message.kind==='question'&&message.requestId===request.requestId);assert.ok(question);const turn=state.timeline.turns.find(turn=>turn.id===question.turnId);const human=messages.find(message=>message.id===turn.userMessageId);assert.ok(human.order<question.order);assert.equal(question.orderKnown,true);const actualRequest=state.interactions.find(item=>item.requestId===request.requestId);const answers=messages.filter(message=>message.kind==='answer'&&message.answerId===actualRequest.answer.answerId);assert.equal(answers.length,1);assert.ok(question.order<answers[0].order);assert.equal(answers[0].requestId,request.requestId);assert.ok(messages.some(message=>message.kind==='assistant'&&message.order>answers[0].order));return answers[0];
}
export const humanInput = (request, value) => ({ projectId: request.projectId, requestId: request.requestId, version: request.version, requestDigest: request.digest, ...(value === undefined ? {} : { value }) });
export function spec(checkId, path, resources) { return { checkId, kind: 'node-test', argv: ['--test', path], testResources: [path], inputResources: [...new Set([path, ...resources])], outputResources: [], timeoutSeconds: 10, network: 'none', logMaxBytes: 4096 }; }
export async function seed(root) {
  await fs.mkdir(join(root, 'tests/Acceptance'), { recursive: true }); await fs.mkdir(join(root, 'docs/roles/Acceptance'), { recursive: true });
  await fs.writeFile(join(root, 'package.json'), '{"type":"module"}');
  await fs.writeFile(join(root, 'tests/developer.test.mjs'), "import test from 'node:test';import assert from 'node:assert/strict';import {value} from '../src.mjs';test('API exports an integer',()=>assert.ok(Number.isInteger(value)));");
  await fs.writeFile(join(root, 'tests/Acceptance/behavior.test.mjs'), "import test from 'node:test';import assert from 'node:assert/strict';import {value} from '../../src.mjs';test('customer contract requires one',()=>assert.equal(value,1));");
}
function transcriptText(message) { if(message.content===null)return ''; return messageText(message); }
function current(body) { const at = body.messages.findLastIndex(item => item.role === 'user'); return { prompt: messageText(body.messages[at]), tools: body.messages.slice(at + 1).filter(item => item.role === 'tool').map(item => ({ name: item.name, ...JSON.parse(item.content) })) }; }
function domainFrom(prompt){return modelFacts({messages:[{role:'user',content:prompt}]});}
function member(id, boundary, revision = 1) { return { id, name: id==='Builder'?'公开接口与软件检查开发成员':id, purpose: FIXED_ROLE_DUTIES[id] ?? '实现 src.mjs 的公开值', interfaces: ['src.mjs value'], boundary, documents: [], revision, enabled: true, status: 'approved' }; }
export function approvedPlan(domain, profileId) {
  const ids = ['Builder', 'Acceptance'];
  return { schemaVersion:2, goal: '真正检查公开值并独立验收', roles: ids.map(id => { const role = domain.organization.members.find(item => item.id === id); return { id, name: role.name, purpose: role.purpose, revision: role.revision, digest: role.digest, profileId }; }),
    tasks: [{ id: 'development', title: '实现公开值', roleId: 'Builder', profileId, dependsOn: [], intent:'change', instruction: '写公开值并执行自测', checks: [spec('developer', 'tests/developer.test.mjs', ['src.mjs', 'package.json'])] },
      { id: 'acceptance', title: '独立验收客户契约', roleId: 'Acceptance', profileId, dependsOn: ['development'], accepts: ['development'], intent:'change', instruction: '独立验证值为一，真实检查后提交结论', checks: [spec('customer-contract', 'tests/Acceptance/behavior.test.mjs', ['src.mjs', 'package.json', 'docs/roles/Acceptance/report.md'])] }],
    governance: { organizationRevision: domain.organization.revision, organizationDigest: domain.organization.digest, maxRepairRounds: 2 } };
}
/** Real HTTP protocols drive real installed Pi sessions; they never replace software checks. */
export async function controllerServer() {
  const control = { root: null, mode: 'chat', profileId: null, interaction: null, repair: false, forceBadRepair: false, expectRepairLimit: false, roleVersion: 1, planMutate: null, requests: [] };
  control.server = await localServer(async (call, reply) => {
    assert.equal(call.headers.authorization, 'Bearer independent-tester-secret');if(supervisionReply(call,reply))return;
    const names = (call.body.tools ?? []).map(item => item.function.name); const { prompt, tools } = current(call.body); control.lastTools = tools; control.requests.push({ names, prompt, messages: structuredClone(call.body.messages), model:call.body.model });
    if(!names.length && prompt.includes('你只整理本角色历史文字')){assert.equal(call.body.max_completion_tokens??call.body.max_tokens,2048);replyText(reply,'INDEPENDENT_CONTEXT_SUMMARY: previous source is historical only; current Host pins and real checks govern.');return;}
    if (names.includes('legion_propose_roles')) {
      assert.ok(!names.includes('legion_write_file')); assert.ok(!names.includes('legion_run_check'));
      if(control.mode==='architect-partial'){if(!tools.length){replyText(reply,'',{payload:{id:'observed-before-error',version:1,members:[member('Observed',['observed.mjs'])]}},'legion_propose_roles');return;}reply.writeHead(401,{'content-type':'application/json'});reply.end(JSON.stringify({error:{message:'Invalid API key private-sdk-body-independent-tester-secret'}}));return;}
      if (control.mode === 'architect-error') { reply.writeHead(503, { 'content-type': 'application/json' }); reply.end(JSON.stringify({ error: { message: 'private-sdk-body-independent-tester-secret', type: 'server_error' } })); return; }
      if(control.mode==='revised-roles'){if(!tools.length){replyText(reply,'',{payload:{id:'after-restart-duties',version:1,members:[{...member('Builder',['src.mjs'],2),purpose:'实现src.mjs公开整数值，并维护软件检查；当前批准的完整职责。'}]}},'legion_propose_roles');return;}assert.equal(tools.at(-1).result.status,'completed');replyText(reply,'Exact role candidate submitted');return;}
      if (!tools.length) { replyText(reply, '', { payload: { id: 'actual-roles', version: control.roleVersion, members: [member('Builder', ['src.mjs']), member('Acceptance', ['tests/Acceptance/behavior.test.mjs', 'docs/roles/Acceptance/report.md'], 2)] } }, 'legion_propose_roles'); return; }
      assert.equal(tools.at(-1).result.status, 'completed'); replyText(reply, 'Exact role candidate submitted'); return;
    }
    if (names.includes('legion_submit_acceptance')) {
      const task = JSON.parse(prompt.split('Human已确认任务：')[1].split('\n')[0]);
      if (control.mode === 'acceptance-escape' && !tools.length) { replyText(reply, '', { resource: 'src.mjs', content: 'export const value = 99;' }, 'legion_write_file'); return; }
      if (!tools.some(item=>item.result.resource === 'docs/roles/Acceptance/report.md')) { replyText(reply, '', { resource: 'docs/roles/Acceptance/report.md', content: 'Independent customer contract check report; see actual evidence.' }, 'legion_write_file'); return; }
      const check = tools.find(item => item.result.checkId === 'customer-contract');
      if (!check) { replyText(reply, '', { checkId: 'customer-contract' }, 'legion_run_check'); return; }
      if (!tools.some(item => item.result.tool === 'legion_submit_acceptance')) {
        const passed = check.result.status === 'passed';
        replyText(reply, '', { payload: { taskId: task.id, evidenceIds: [check.result.requestId], decision: passed ? 'pass' : 'fail', issues: passed ? [] : [{ taskId: 'development', resource: 'src.mjs', expected: 'exported value 1', actual: 'Independent check exited ' + check.result.exitCode + ': ' + (check.result.stdout + check.result.stderr).replace(/[\u0000-\u001f\u007f]/gu,' ').slice(0, 3000), reproduction: 'Run customer-contract through legion_run_check' }] } }, 'legion_submit_acceptance'); return;
      }
      replyText(reply, 'Real independent acceptance finished'); return;
    }
    if (names.includes('legion_write_file')) {
      if(control.expectedBuilder)assert.ok(prompt.includes(JSON.stringify(control.expectedBuilder)),'new task keeps full current approved purpose/revision/digest after role revision');
      if(control.holdBuilder&&!tools.length){await new Promise(resolve=>{control.releaseBuilder=()=>{control.holdBuilder=false;resolve();};});}
      assert.ok(!names.includes('legion_request_repair'));
      if (!tools.length) { replyText(reply, '', { resource: 'src.mjs', content: 'export const value = ' + (control.mode === 'selftest-failure' ? '"bad"' : (control.repair && !control.forceBadRepair ? 1 : 2)) + ';' }, 'legion_write_file'); return; }
      if (control.mode === 'no-check') { replyText(reply, 'Model says software passed without running any current check'); return; }
      if (tools.length === 1) { replyText(reply, '', { checkId: 'developer' }, 'legion_run_check'); return; }
      assert.equal(tools.at(-1).result.status, control.mode === 'selftest-failure' ? 'failed' : 'passed');
      if (control.mode === 'postcheck-change') await fs.writeFile(join(control.root, 'src.mjs'), 'export const value = 3;');
      replyText(reply, 'Implementation and real selftest complete'); return;
    }
    assert.ok(names.includes('legion_design_roles')); assert.ok(!names.includes('legion_write_file')); assert.ok(!names.includes('legion_run_check'));
    if(control.mode==='revised-roles') {
      if(!tools.length){replyText(reply,'',{payload:{instruction:'Revise the existing Builder complete purpose while preserving its owner and independent acceptance'}},'legion_design_roles');return;}
      if(tools.length===1){const proposal=tools[0].result.payload.proposal;replyText(reply,'',{payload:{proposalId:proposal.id,version:proposal.version,digest:proposal.digest,organizationRevision:proposal.baseRevision,organizationDigest:proposal.baseDigest,decision:'approve',reason:'Current exact full revised purpose'}},'legion_review_roles');return;}
      replyText(reply,'Current revised complete purpose approved');return;
    }
    if (['roles', 'architect-error','architect-partial'].includes(control.mode)) {
      const designResults = tools.filter(item => item.result.tool === 'legion_design_roles');
      const reviews = tools.filter(item => item.result.tool === 'legion_review_roles');
      if(control.mode==='architect-partial'){if(!tools.length){replyText(reply,'',{payload:{instruction:'Submit one exact candidate and preserve any real failure'}},'legion_design_roles');return;}const result=tools[0];assert.equal(result.result.status,'error');assert.equal(result.result.reason,'pi_auth_error');assert.equal(result.decision.allowed,false);assert.equal(result.result.payload.pendingProposals.length,1);assert.equal(result.result.payload.pendingProposals[0].id,'observed-before-error');assert.equal(result.result.payload.pendingProposals[0].status,'pending');assert.ok(!JSON.stringify(result).includes('private-sdk-body'));control.partialReply=result;replyText(reply,'Observed proposal remains pending; exact PM review is still required');return;}
      if (control.mode === 'architect-error') {
        if (!tools.length) { replyText(reply, '', { payload: { instruction: 'Design actual role ownership' } }, 'legion_design_roles'); return; }
        assert.equal(tools[0].result.status, 'error'); assert.equal(tools[0].result.reason, 'pi_model_error');
        assert.ok(!JSON.stringify(tools).includes('private-sdk-body')); replyText(reply, 'Architect failed safely; retry is possible'); return;
      }
      if (designResults.length === reviews.length && reviews.length < 2) { control.roleVersion = reviews.length + 1; replyText(reply, '', { payload: { instruction: 'Design exact src owner and independent acceptance' } }, 'legion_design_roles'); return; }
      if (designResults.length > reviews.length) {
        const proposal = designResults.at(-1).result.payload.proposal;
        replyText(reply, '', { payload: { proposalId: proposal.id, version: proposal.version, digest: proposal.digest, organizationRevision: proposal.baseRevision, organizationDigest: proposal.baseDigest, decision: reviews.length === 0 ? 'return' : 'approve', reason: reviews.length === 0 ? 'Review duties again' : 'Exact scope approved' } }, 'legion_review_roles'); return;
      }
      replyText(reply, 'Role revision two approved'); return;
    }
    if (control.mode === 'interaction') {
      if (!tools.length) { replyText(reply, '', { payload: control.interaction }, 'legion_request_interaction'); return; }
      assert.equal(tools[0].result.status, 'completed'); replyText(reply, 'Human answer recorded'); return;
    }
    if (control.mode === 'plan') { const candidate = approvedPlan(domainFrom(prompt), control.profileId); if (control.planMutate) control.planMutate(candidate); replyText(reply, planText(candidate)); return; }
    if (control.mode === 'repair') {
      if (!tools.length) { const domain = domainFrom(prompt); control.repair = true; replyText(reply, '', { payload: { acceptanceId: domain.acceptances.at(-1).id, taskId: 'development', reason: 'Independent customer-contract failed, original Builder must fix same src.mjs' } }, 'legion_request_repair'); return; }
      if (control.expectRepairLimit) { assert.equal(tools[0].result.status,'denied'); assert.equal(tools[0].result.reason,'repair_limit_reached'); replyText(reply,'Confirmed repair limit reached with honest failure'); return; }
      assert.equal(tools[0].result.status, 'completed', JSON.stringify(tools[0])); replyText(reply, 'Original owner repair dispatched within confirmed scope'); return;
    }
    replyText(reply, 'Plain PM discussion; no execution');
  },{customerPurpose:()=>control.mode==='repair'?'repair':'plan'});
  return control;
}

export async function runGovernedFlows(location, userData) {
  const root = join(location, 'customer'); await fs.mkdir(root); await seed(root);
  const control = await controllerServer(); control.root = root; let pipeline = createWorkbenchPipeline({userDataDir:userData,leaseRoot:fixtureLeaseRoot(userData)}); const scenarios = [];
  try {
    const profiles = unwrap(await pipeline.saveProfile({ name: 'Independent governed fixture', protocol: 'openai-completions', provider: 'tester', modelId: 'tester-local', baseUrl: control.server.baseUrl, keyAction: 'replace', apiKey: 'independent-tester-secret' }));
    control.profileId = profiles.profiles[0].id; unwrap(await pipeline.setDefaultProfile({ profileId: control.profileId })); let state = unwrap(await pipeline.selectProject(root)); const projectId = state.currentProject.id;
    const read = async () => unwrap(await pipeline.getState());
    const send = async text => { unwrap(await pipeline.sendMessage({ projectId, roleId: 'Supervisor', text })); return waitFor(read, state => ['completed', 'failed'].includes(state.turn?.status), text, 25000); };
    assert.deepEqual(state.roles.map(item => item.id).sort(), ['Acceptance', 'ProjectManager', 'RoleArchitect','Supervisor']);
    await send('Plain requirements'); await assert.rejects(fs.stat(join(root, 'src.mjs')), { code: 'ENOENT' }); await assert.rejects(fs.stat(join(root, '.ans')), { code: 'ENOENT' }); scenarios.push('pure chat preserves source and audit');
    control.mode = 'architect-error'; state = await send('Architect transient failure'); assert.equal(state.proposals.length, 0); assert.ok(!JSON.stringify(state).includes('private-sdk-body')); scenarios.push('architect safe failure keeps PM alive');
    control.mode='architect-partial';state=await send('Preserve actual proposal before later auth failure');const observed=state.proposals.find(item=>item.id==='observed-before-error');assert.equal(observed.status,'pending');assert.equal(observed.version,1);assert.equal(observed.digest,control.partialReply.result.payload.pendingProposals[0].digest);assert.ok(!state.organization.members.some(item=>item.id==='Observed'));scenarios.push('actual propose then auth failure retains exact pending candidate without approval');
    control.mode = 'roles'; state = await send('Define and review real roles'); assert.deepEqual(state.proposals.filter(item=>item.id==='actual-roles').map(item => item.status), ['returned', 'approved']); assert.equal(state.organization.members.find(item => item.id === 'Builder').status, 'approved'); assert.equal(state.organization.members.find(item => item.id === 'Acceptance').revision, 2); scenarios.push('real architect proposal return revision approve');
    for (const [kind, value] of [['confirmation', false], ['choice', { optionId: 'b', text: 'Human supplement' }], ['question', 'Actual Human answer']]) {
      control.mode = 'interaction'; control.interaction = { kind, purpose: 'discussion', title: kind + ' actual', text: 'Please answer current question', options: kind === 'choice' ? [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] : [], allowSupplement: kind === 'choice' };
      unwrap(await pipeline.sendMessage({ projectId, roleId: 'Supervisor', text: 'Ask ' + kind })); state = await waitFor(read, state => state.turn?.status === 'waiting', 'durable ' + kind);
      const request = state.interactions.find(item => item.status === 'pending'); const closed = unwrap(await pipeline.closeInteraction(humanInput(request, undefined))); assert.equal(closed.interactions.find(item => item.requestId === request.requestId).status, 'pending');
      assert.equal((await pipeline.answerInteraction({ ...humanInput(request, value), version: request.version + 1 })).ok, false);
      unwrap(await pipeline.answerInteraction(humanInput(request, value))); state = await waitFor(read, state => state.turn?.status === 'completed', 'answered ' + kind); const status = kind === 'confirmation' ? 'rejected' : 'answered'; assert.equal(state.interactions.find(item => item.requestId === request.requestId).status, status); unwrap(await pipeline.answerInteraction(humanInput(request, value)));assertAnswerTimeline(await read(),request);
    } scenarios.push('three real waiting tools closed stale duplicate answered');
    control.mode='interaction'; control.interaction={kind:'question',purpose:'discussion',title:'cancel pending question',text:'Wait for real answer',options:[],allowSupplement:false};
    unwrap(await pipeline.sendMessage({projectId,roleId:'Supervisor',text:'Cancel pending question'}));state=await waitFor(read,state=>state.turn?.status==='waiting','cancel waiting request'); const pendingQuestion=state.interactions.find(item=>item.status==='pending');unwrap(await pipeline.cancelTurn({projectId,turnId:state.turn.id}));state=await read();assert.equal(state.interactions.find(item=>item.requestId===pendingQuestion.requestId).status,'invalidated');assert.equal((await pipeline.answerInteraction(humanInput(pendingQuestion,'late answer'))).ok,false);scenarios.push('cancel revokes pending tool and late answer');
    control.mode = 'plan';
    for (const [mutate, expected] of [[plan => { plan.roles[0].digest = '0'.repeat(64); }, 'approved_role_required'], [plan => { plan.tasks[0].checks = []; }, 'task_checks_required'], [plan => { plan.tasks.pop(); }, 'independent_acceptance_required']]) {
      control.planMutate = mutate; state = await send('Reject invalid approved execution'); assert.equal(state.turn.status,'completed');const refused=JSON.parse(await fs.readFile(join(userData,'workbench-organization',projectId+'.json'),'utf8'));assert.ok(refused.delegations.entries.some(entry=>entry.status==='failed'&&entry.result?.code===expected),'actual PM candidate is refused with precise error'); await assert.rejects(fs.stat(join(root, 'src.mjs')), { code: 'ENOENT' });
    } control.planMutate = null; scenarios.push('no current role approval checks coverage all refused');
    state = await send('Implement and independently inspect'); assert.equal(state.plan.status, 'draft'); assert.equal((await pipeline.confirmPlan({ projectId, planDigest: state.plan.planDigest })).error.code, 'execution_confirmation_required');
    const executionRequest = state.interactions.find(item => item.status === 'pending' && item.purpose === 'execute_plan'); unwrap(await pipeline.closeInteraction(humanInput(executionRequest, undefined))); await assert.rejects(fs.stat(join(root, 'src.mjs')), { code: 'ENOENT' });
    unwrap(await confirmExecution(pipeline, state)); state = await waitFor(read, state => state.plan?.status === 'failed', 'real independent failure', 30000);
    assert.equal(await fs.readFile(join(root, 'src.mjs'), 'utf8'), 'export const value = 2;'); assert.equal(state.tasks.find(item=>item.roleId==='Builder').checkStatus, 'passed'); assert.equal(state.tasks.find(item=>item.roleId==='Acceptance').checkStatus, 'failed'); assert.ok(state.acceptances.length,JSON.stringify({tasks:state.tasks,tools:control.lastTools})); assert.equal(state.acceptances.at(-1).decision, 'fail'); assert.ok(state.evidence.every(item => item.result.executed && item.result.testCount > 0)); scenarios.push('developer true pass independent true assertion failure');
    control.mode = 'repair'; await send('PM choose original owner repair'); state = await waitFor(read, state => state.plan?.status === 'completed', 'repair selftest independent recheck', 30000);
    assert.equal(await fs.readFile(join(root, 'src.mjs'), 'utf8'), 'export const value = 1;'); assert.equal(state.repairs[0].roleId, 'Builder'); assert.equal(Object.hasOwn(state.repairs[0],'writeSet'),false); assert.equal(state.repairs[0].round, 1); assert.equal(state.acceptances.at(-1).decision, 'pass'); assert.ok(state.tasks.every(item => item.checkStatus === 'passed')); assert.equal(state.evidence.length, 4); assert.equal(state.evidence[1].result.status, 'failed'); scenarios.push('PM original owner bounded repair actual fresh independent recheck');
    const firstByRole = role => control.requests.filter(request=>role==='RoleArchitect'?request.names.includes('legion_propose_roles'):role==='Acceptance'?request.names.includes('legion_submit_acceptance'):request.names.includes('legion_write_file')&&!request.names.includes('legion_submit_acceptance'));
    for(const [role,marker] of [['RoleArchitect','Exact role candidate submitted'],['Builder','Implementation and real selftest complete'],['Acceptance','Real independent acceptance finished']]) {
      const requests=firstByRole(role);const resumed=requests.filter(request=>request.messages.some(message=>message.role==='assistant'&&transcriptText(message).includes(marker)));assert.ok(resumed.length,role+' remembers own completed earlier run');
      const latest=resumed.at(-1);for(const other of ['Implementation and real selftest complete','Real independent acceptance finished','Exact role candidate submitted'].filter(value=>value!==marker))assert.ok(!latest.messages.some(message=>message.role==='assistant'&&transcriptText(message).includes(other)),role+' assistant history is isolated');assert.ok(!latest.messages.slice(0,latest.messages.findLastIndex(message=>message.role==='user')).some(message=>message.role==='tool'),'old tools never restored');
      if(role!=='RoleArchitect'){const actual=state.organization.members.find(member=>member.id===role);assert.ok(latest.prompt.includes(JSON.stringify(actual)),role+' canonical full purpose/revision/digest intact');assert.ok(latest.prompt.includes('src.mjs'));}
    }
    scenarios.push('four roles preserve independent task and repair text while canonical Host facts remain current');

    const memberIds = state.roles.map(item => item.id); const anchoredAnswers=state.timeline.messages.filter(message=>message.kind==='answer').map(message=>({id:message.id,order:message.order,answerId:message.answerId})); control.mode = 'chat'; await send('Repeated Human text'); await send('Repeated Human text');const repeated=(await read()).timeline.messages.filter(message=>message.kind==='human'&&message.text==='Repeated Human text');assert.equal(repeated.length,2);assert.notEqual(repeated[0].id,repeated[1].id);assert.ok(repeated[0].order<repeated[1].order);assert.deepEqual((await read()).timeline.messages.filter(message=>message.kind==='answer').map(message=>({id:message.id,order:message.order,answerId:message.answerId})),anchoredAnswers);await send('Another plain turn after completed work'); assert.deepEqual((await read()).roles.map(item => item.id), memberIds); scenarios.push('persistent members survive new discussion');
    const calls = control.server.calls.length; unwrap(await pipeline.close()); unwrap(await pipeline.close()); pipeline = createWorkbenchPipeline({userDataDir:userData,leaseRoot:fixtureLeaseRoot(userData)}); state = unwrap(await pipeline.selectProject(root));
    assert.equal(control.server.calls.length, calls); assert.equal(state.turn, null); assert.equal(state.acceptances.at(-1).decision, 'pass'); assert.deepEqual(state.roles.map(item => item.id), memberIds); assert.equal((await pipeline.confirmPlan({ projectId, planDigest: state.plan.planDigest, requestId: executionRequest.requestId, version: executionRequest.version, requestDigest: executionRequest.digest })).ok, false); scenarios.push('restart restores facts no old model or grant execution');
    control.mode='chat';state=await send('Changed requirement after restart: keep current owner and customer contract');const resumedPM=control.requests.at(-1);assert.ok(resumedPM.messages.some(message=>message.role==='user'&&transcriptText(message).includes('Repeated Human text')));assert.ok(resumedPM.prompt.includes(JSON.stringify(state.organization.members.find(member=>member.id==='ProjectManager'))));
    control.mode='revised-roles';state=await send('Revise Builder complete purpose after restart and changed requirement');assert.equal(state.organization.members.find(member=>member.id==='Builder').revision,2);control.expectedBuilder=state.organization.members.find(member=>member.id==='Builder');const architectAfterRestart=control.requests.findLast(request=>request.names.includes('legion_propose_roles')&&!request.messages.slice(request.messages.findLastIndex(message=>message.role==='user')+1).some(message=>message.role==='tool'));assert.ok(architectAfterRestart.messages.some(message=>message.role==='assistant'&&transcriptText(message).includes('Exact role candidate submitted')));assert.ok(architectAfterRestart.messages.every(message=>message.role!=='tool'),'old RoleArchitect tools are not revived');scenarios.push('RoleArchitect restart and requirement change keep text while real approval changes complete canonical purpose');
    control.mode = 'plan'; state = await send('Second confirmed plan keeps members'); assert.equal(state.plan.status, 'draft'); assert.deepEqual(state.roles.map(item => item.id), memberIds); control.mode = 'acceptance-escape'; control.repair = true;
    unwrap(await confirmExecution(pipeline, state)); state = await waitFor(read, state => state.plan?.status === 'failed', 'acceptance cannot mutate business source', 30000);
    assert.equal(await fs.readFile(join(root, 'src.mjs'), 'utf8'), 'export const value = 1;'); assert.equal(state.tasks.find(item=>item.roleId==='Acceptance').results[0].status, 'denied'); assert.equal(state.tasks.find(item=>item.roleId==='Acceptance').results[0].observedMutation, false); assert.notEqual(state.acceptances.at(-1).planDigest, state.plan.planDigest); scenarios.push('Acceptance own test scope denies source mutation and pass');
    for (const mode of ['no-check', 'selftest-failure', 'postcheck-change']) {
      const failedDigest=state.plan.planDigest;assert.equal(state.plan.status,'failed');control.mode = 'plan'; state = await send('New current candidate ' + mode); assert.equal(state.turn.status,'completed','new candidate '+mode+' '+JSON.stringify({error:state.turn.error,planStatus:state.plan?.status}));assert.equal(state.plan.status,'draft','new current candidate must produce draft');assert.notEqual(state.plan.planDigest,failedDigest);const pending=state.interactions.filter(request=>request.status==='pending'&&request.purpose==='execute_plan'&&request.bindings.planDigest===state.plan.planDigest);assert.equal(pending.length,1,'exact current Host execution confirmation');if(mode==='postcheck-change'){const domain=JSON.parse(await fs.readFile(join(userData,'workbench-organization',projectId+'.json'),'utf8'));const memories=domain.roleMemories.entries;assert.equal(new Set(memories.map(entry=>entry.roleId+'|'+entry.channel)).size,memories.length);const {roleContextSources}=await import('../../src/models/workbench.mjs');for(const channel of ['su_customer','supervision_preflight','supervision_monitor']){const memory=memories.find(entry=>entry.roleId==='Supervisor'&&entry.channel===channel);assert.ok(memory,'separate Supervisor '+channel);const sources=roleContextSources(domain,'Supervisor',channel);for(const ref of [...memory.covered,...memory.messages])assert.ok(sources.sources.some(source=>source.sourceId===ref.sourceId&&source.sourceDigest===ref.sourceDigest),'memory references belong to its exact channel');}const foreground=memories.find(entry=>entry.roleId==='Supervisor'&&entry.channel==='su_customer');assert.equal(JSON.stringify(foreground).includes('Typed independent supervision complete'),false,'background assistant never pollutes Su checkpoint/summary');const frontCall=control.server.calls.findLast(call=>(call.body.tools??[]).some(tool=>tool.function?.name==='legion_delegate_pm'));assert.equal(JSON.stringify(frontCall.body.messages).includes('Typed independent supervision complete'),false,'Su SDK receives no private background assistant');assert.ok(domain.customerTimeline.messages.some(message=>message.kind==='human'&&message.text==='New current candidate postcheck-change'));} control.mode = mode; control.repair = true;
      unwrap(await confirmExecution(pipeline, state)); state = await waitFor(read, state => state.plan?.status === 'failed', 'actual ' + mode + ' refusal', 30000);
      const developer = state.tasks.find(item=>item.roleId==='Builder'); assert.equal(developer.status,'failed');
      if (mode === 'no-check') { assert.equal(developer.checkStatus,'not_executed'); assert.equal(developer.error.code,'check_not_passed'); }
      if (mode === 'selftest-failure') assert.equal(developer.checkStatus,'failed');
      if (mode === 'postcheck-change') { assert.equal(developer.checkStatus,'stale'); assert.equal(developer.error.code,'check_evidence_stale'); }
      assert.ok(!state.acceptances.some(item=>item.planDigest===state.plan.planDigest && item.decision==='pass'));
      scenarios.push('actual current ' + mode + ' cannot reuse old evidence or completion');
    }
    control.mode='plan'; control.repair=false; state=await send('New plan with confirmed two repair rounds'); control.mode='chat'; unwrap(await confirmExecution(pipeline,state));state=await waitFor(read,state=>state.plan?.status==='failed','limit initial failed independent check',30000); const limitedPlan=state.plan.planDigest;
    control.forceBadRepair=true; control.mode='repair';
    for(let round=1;round<=2;round++){await send('PM limited original owner repair '+round);state=await waitFor(read,state=>state.plan?.status==='failed','actual limited repair '+round,30000);assert.equal(state.repairs.filter(item=>item.planDigest===limitedPlan).length,round);assert.equal(state.acceptances.at(-1).decision,'fail');}
    control.expectRepairLimit=true;await send('Refuse third original owner repair');state=await read();assert.equal(state.repairs.filter(item=>item.planDigest===limitedPlan).length,2);assert.equal(state.plan.status,'failed');scenarios.push('two actual failed repairs stop at confirmed limit without widening source scope');
    const serialized = JSON.stringify(state); assert.ok(!serialized.includes('independent-tester-secret')); assert.ok(!serialized.includes('private-sdk-body'));
    return { scenarios, actualModelRequests: control.server.calls.length, executedChecks: state.evidence.filter(item => item.result.executed).length, platform: process.platform, electron: process.versions.electron, paidRequests: 0 };
  } finally { unwrap(await pipeline.close()); await control.server.close(); }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && !process.versions.electron) {
  test('actual Electron installed SDK governance selftest independent failure PM repair fresh acceptance', { timeout: 160000 }, async () => {
    const location = await ownedDirectory('fixtures', 'governed-flow-'); const userData = await ownedDirectory('user-data', 'governed-flow-'); const evidence=await ownedDirectory('evidence','governed-regression-');const proof = join(evidence, 'governed-flow.json');
    const harness = join(location, 'electron-governed.mjs'); await fs.writeFile(harness, `import {app} from 'electron';import {runGovernedFlows} from ${JSON.stringify(import.meta.url)};import {writeFile} from 'node:fs/promises';app.setPath('userData',${JSON.stringify(userData)});app.setPath('sessionData',${JSON.stringify(userData)});app.setAppLogsPath(${JSON.stringify(join(userData,'logs'))});app.whenReady().then(()=>runGovernedFlows(${JSON.stringify(location)},${JSON.stringify(userData)})).then(async value=>{await writeFile(${JSON.stringify(proof)},JSON.stringify(value));app.exit(0)}).catch(error=>{console.error(error);app.exit(1)});`);
    try {
      let executable = join(projectRoot, 'apps/desktop/node_modules/electron/dist/electron.exe'); if (process.platform === 'darwin') executable = join(projectRoot, 'apps/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
      const child = spawn(executable, [harness], { cwd: join(projectRoot, 'apps/desktop'), env: environment(), stdio: ['ignore', 'pipe', 'pipe'] }); let output = ''; child.stdout.on('data', bytes => { output += bytes; }); child.stderr.on('data', bytes => { output += bytes; });
      const deadline = setTimeout(() => child.kill(), 155000); const code = await new Promise((done, reject) => { child.once('error', reject); child.once('exit', done); }); clearTimeout(deadline); assert.equal(code, 0, output);
      const result = JSON.parse(await fs.readFile(proof, 'utf8')); assert.ok(result.scenarios.length >= 11); assert.ok(result.actualModelRequests > 20); assert.equal(result.paidRequests, 0);
    } finally { await removeOwned(location, join(generated, 'fixtures')); await removeOwned(userData, join(generated, 'user-data')); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && !process.versions.electron) test('independent public organization migration requires real approval and exact architecture document SHA', async () => {
  const { createProjectService } = await import('../../src/services/public/project.mjs');
  const { createOrganizationService } = await import('../../src/services/public/organization.mjs');
  const { ProjectFileOwners } = await import('legion-runtime/workbench-models');
  const { createHash } = await import('node:crypto');
  const location = await ownedDirectory('fixtures', 'organization-integration-'); const userData = await ownedDirectory('user-data', 'organization-integration-'); const root = join(location, 'legacy'); await fs.mkdir(root); await fs.writeFile(join(root, 'src.mjs'), 'export const value=1;');
  const projects = createProjectService({userDataDir:userData,leaseRoot:fixtureLeaseRoot(userData)}); const organizations = createOrganizationService({ userDataDir: userData });
  try {
    const selected = unwrap(await projects.select(root)); const project = { ...selected, fileOwners: new ProjectFileOwners({projectId:selected.id,version:'old-owners',owners:[{resource:'src.mjs',roleId:'Builder'}]}) };
    let state = await organizations.load(project); assert.equal(state.organization.status,'legacy'); assert.equal(state.organization.members.find(item=>item.id==='Builder').purpose,''); assert.ok(state.organization.members.every(item=>item.status==='legacy')); assert.equal(state.ledger.proposals.length,0);
    const doc = 'docs/roles/RoleArchitect/duties.md'; const contentDigest = createHash('sha256').update('Exact approved role duties').digest('hex');
    const architect = {projectId:project.id,roleId:'RoleArchitect',instanceId:'independent-architect'}; const pm={projectId:project.id,roleId:'ProjectManager',instanceId:'independent-manager'};
    await assert.rejects(organizations.submitProposal(project,{id:'forbidden',version:1,members:[member('ProjectManager',['src.mjs'])]},architect),{code:'manager_business_write'});
    await assert.rejects(organizations.submitProposal(project,{id:'forbidden',version:1,members:[member('Acceptance',['src.mjs'])]},architect),{code:'acceptance_business_write'});
    const candidates=[member('Builder',['src.mjs']),member('Acceptance',['docs/roles/Acceptance/report.md']),{...member('RoleArchitect',[doc]),documents:[{resource:doc,contentDigest,summary:'Exact role duties'}]},member('ProjectManager',[]),member('Supervisor',[])];
    state=await organizations.submitProposal(project,{id:'migration',version:1,members:candidates},architect); const proposal=state.ledger.proposals.at(-1);
    await assert.rejects(organizations.validatePublication(project,doc,contentDigest,architect),{code:'document_not_approved'});
    const input={proposalId:proposal.id,version:proposal.version,digest:proposal.digest,organizationRevision:state.organization.revision,organizationDigest:state.organization.digest,decision:'approve',reason:'Review actual legacy owners and exact duties'};
    await assert.rejects(organizations.reviewProposal(project,input,architect),{code:'actor_forbidden'}); await assert.rejects(organizations.reviewProposal(project,{...input,digest:'0'.repeat(64)},pm),{code:'stale_proposal'});
    state=await organizations.reviewProposal(project,input,pm); assert.equal(state.organization.status,'ready'); assert.equal(state.organization.fileOwners.find(item=>item.resource==='src.mjs').roleId,'Builder');
    assert.equal((await organizations.validatePublication(project,doc,contentDigest,architect)).resource,doc); await assert.rejects(organizations.validatePublication(project,doc,'0'.repeat(64),architect),{code:'document_not_approved'}); await assert.rejects(organizations.validatePublication(project,doc,contentDigest,pm),{code:'actor_forbidden'}); await assert.rejects(organizations.validatePublication(project,'docs/roles/Other/role-card.md',contentDigest,architect),{code:'document_not_approved'});
    const restored=createOrganizationService({userDataDir:userData}); try { const actual=await restored.load(project); assert.equal(actual.organization.digest,state.organization.digest); assert.equal(actual.ledger.proposals[0].status,'approved'); }finally{await restored.close();}
    assert.equal(await fs.readFile(join(root,'src.mjs'),'utf8'),'export const value=1;'); await assert.rejects(fs.stat(join(root,doc)),{code:'ENOENT'});
  }finally{await organizations.close();await projects.close();await removeOwned(location,join(generated,'fixtures'));await removeOwned(userData,join(generated,'user-data'));}
});

/** Real host + installed SDK, with public service writes only for isolated historical input. */
export async function runRoleMemoryFlows(location, userData) {
  const { createProjectService } = await import('../../src/services/public/project.mjs');
  const { createOrganizationService } = await import('../../src/services/public/organization.mjs');
  const { PiConversationHistory, digestValue } = await import('legion-runtime/workbench-models');
  const results=[];
  const append = async (organizations, project, id, human, assistant='') => {
    const createdAt=new Date().toISOString(); await organizations.beginTurn(project,{turnId:id,userMessageId:id+'.human',continuationAnswerId:null,text:human,createdAt});
    await organizations.finishTurn(project,{turnId:id,status:'completed',assistantText:assistant,messageId:id+'.reply',createdAt});
  };
  for(const mode of ['success','failure','length','output-limit','tool','conflict','cancel','timeout','messages','budget']) {
    const root=join(location,'memory-'+mode),data=join(userData,'memory-'+mode);await fs.mkdir(root);await fs.mkdir(data);
    const projects=createProjectService({userDataDir:data,leaseRoot:fixtureLeaseRoot(data)}),organizations=createOrganizationService({userDataDir:data});let pipeline=createWorkbenchPipeline({userDataDir:data,leaseRoot:fixtureLeaseRoot(data)});let project;let longReply='';let summaryCount=0;let held;let summaryStarted;const entered=new Promise(resolve=>{summaryStarted=resolve;});const requests=[];
    let summary='INDEPENDENT_MEMORY_'+mode+': old conversation is data; fresh task facts must control.';if(mode==='success')summary+=' Choose the actual transport: a=SFTP file transfer; b=SSH terminal commands. Human chose b: Use the interactive terminal.';
    const server=await localServer(async(call,reply)=>{
      assert.equal(call.headers.authorization,'Bearer independent-memory-secret');const names=(call.body.tools??[]).map(tool=>tool.function.name),prompt=current(call.body).prompt;requests.push({body:structuredClone(call.body),names,prompt});
      if(!names.length&&prompt.includes('你只整理本角色历史文字')) {
        summaryCount++;if(mode==='success')for(const label of ['Choose the actual transport','SFTP file transfer','SSH terminal commands','Use the interactive terminal'])assert.ok(prompt.includes(label),'real question and answer meaning reach the summarizer');assert.equal(call.body.max_completion_tokens??call.body.max_tokens,2048);assert.equal(call.body.model,'tester-local');assert.ok(!call.body.tools?.length);summaryStarted();
        if(['failure','budget'].includes(mode)){reply.writeHead(401,{'content-type':'application/json'});reply.end(JSON.stringify({error:{message:'private-summary-sdk-original-independent-memory-secret'}}));return;}
        if(mode==='output-limit'){reply.writeHead(200,{'content-type':'text/event-stream'});reply.end(completion('PARTIAL_LENGTH_SUMMARY_MUST_NOT_COMMIT').replace('"finish_reason":"stop"','"finish_reason":"length"'));return;}
        if(mode==='length'){replyText(reply,'L'.repeat(8193));return;}
        if(mode==='tool'){replyText(reply,'',{resource:'illegal.txt',content:'summary cannot execute'},'legion_write_file');return;}
        if(['cancel','timeout'].includes(mode)){held=reply;return;}
        if(mode==='conflict')await append(organizations,project,'concurrent-source','Concurrent changed Human source');
        replyText(reply,summary);return;
      }
      assert.ok(names.includes('legion_design_roles'));if(prompt.includes('Host有界委托：')&&JSON.parse(prompt.split('Host有界委托：')[1].split('\n')[0]).instruction.includes('request semantic choice')&&!current(call.body).tools.length){replyText(reply,'',{payload:{kind:'choice',purpose:'discussion',title:'Choose the actual transport',text:'Which connection preserves the customer meaning?',options:[{id:'a',label:'SFTP file transfer'},{id:'b',label:'SSH terminal commands'}],allowSupplement:true}},'legion_request_interaction');return;}
      replyText(reply,'Actual PM response for '+mode);
    },{customerHandler:async(call,reply)=>{const names=(call.body.tools??[]).map(tool=>tool.function?.name??tool.name);if(!names.includes('legion_delegate_pm'))return false;const prompt=messageText(call.body.messages.findLast(message=>message.role==='user'));const human=prompt.includes('Human消息：\n')?prompt.split('Human消息：\n')[1].split('\n')[0]:'';const tools=current(call.body).tools;
      if(human.startsWith('FULL_NEW_HUMAN_')){replyText(reply,longReply);return true;}
      if(human==='request semantic choice'&&!tools.length){replyText(reply,'',{payload:{kind:'choice',purpose:'discussion',title:'Choose the actual transport',text:'Which connection preserves the customer meaning?',options:[{id:'a',label:'SFTP file transfer'},{id:'b',label:'SSH terminal commands'}],allowSupplement:true}},'legion_request_interaction');return true;}
      replyText(reply,'Actual Su response for '+mode);return true;}});
    const read=async()=>unwrap(await pipeline.getState());const send=async text=>{unwrap(await pipeline.sendMessage({projectId:project.id,roleId:'Supervisor',text}));return waitFor(read,value=>['completed','failed','cancelled'].includes(value.turn?.status),'memory '+mode+' turn',mode==='timeout'?40000:15000);};
    try {
      const profiles=unwrap(await pipeline.saveProfile({name:'Memory '+mode,protocol:'openai-completions',provider:'tester',modelId:'tester-local',baseUrl:server.baseUrl,keyAction:'replace',apiKey:'independent-memory-secret'}));unwrap(await pipeline.setDefaultProfile({profileId:profiles.profiles[0].id}));unwrap(await pipeline.selectProject(root));project=unwrap(await projects.select(root));await send('Establish current role memory '+mode);
      if(mode==='success'){
        unwrap(await pipeline.sendMessage({projectId:project.id,roleId:'Supervisor',text:'request semantic choice'}));let state=await waitFor(read,value=>value.turn?.status==='waiting','semantic choice');const choice=state.interactions.find(item=>item.status==='pending');unwrap(await pipeline.answerInteraction(humanInput(choice,{optionId:'b',text:'Use the interactive terminal'})));await waitFor(read,value=>value.turn?.status==='completed','semantic answer');
      }
      const old='OLD_'+mode+'_'+'o'.repeat(mode==='messages'?0:(mode==='budget'?63000:52000));const largeHuman='FULL_NEW_HUMAN_'+mode+'_'+'h'.repeat(mode==='success'?18000:30);
      if(mode==='messages') { for(let index=0;index<48;index++)await append(organizations,project,'many-'+index,'Human source '+index,'Actual old reply '+index); }
      else {longReply=old;await send(largeHuman);}
      const before=await organizations.load(project);const businessBefore=server.calls.filter(call=>(call.body.tools??[]).some(tool=>tool.function.name==='legion_delegate_pm')).length;const startedAt=Date.now();const oldMemory=before.roleMemories.entries.find(entry=>entry.roleId==='Supervisor'&&entry.channel==='su_customer');
      if(mode==='cancel'){
        const starting=pipeline.sendMessage({projectId:project.id,roleId:'Supervisor',text:'Cancel the actual summarization'});await entered;const close=pipeline.close();await starting;await close;if(held&&!held.destroyed)held.end();pipeline=createWorkbenchPipeline({userDataDir:data,leaseRoot:fixtureLeaseRoot(data)});unwrap(await pipeline.selectProject(root));
      } else await send('Current complete requirement '+mode);
      const after=await organizations.load(project),memory=after.roleMemories.entries.find(entry=>entry.roleId==='Supervisor'&&entry.channel==='su_customer');assert.equal(summaryCount,1,'one tool-less summary request without retry');
      for(const message of before.customerTimeline.messages)assert.deepEqual(after.customerTimeline.messages.find(item=>item.id===message.id),message,'source archive unchanged');
      await assert.rejects(fs.stat(join(root,'illegal.txt')),{code:'ENOENT'});const state=await read();assert.ok(!JSON.stringify(state.roleMemory).includes(summary));assert.ok(!JSON.stringify(state.memoryNotices).includes('private-summary-sdk-original'));assert.equal(state.roleMemory.localCharsLimit,65536);assert.equal(state.roleMemory.modelWindow,null);assert.equal(state.roleMemory.cost,null);
      if(['success','messages'].includes(mode)) {
        assert.equal(memory.summary,summary);assert.ok(memory.covered.length>0);const business=server.calls.filter(call=>(call.body.tools??[]).some(tool=>tool.function.name==='legion_delegate_pm')).at(-1);business.prompt=messageText(business.body.messages.findLast(message=>message.role==='user'));const history=business.body.messages.slice(0,business.body.messages.findLastIndex(message=>message.role==='user'));
        assert.ok(history.some(message=>transcriptText(message).includes(summary)));assert.ok(!history.some(message=>transcriptText(message).includes(old))||mode==='messages');assert.ok(history.every(message=>message.role!=='tool'));
        const total=business.prompt.length+JSON.stringify(history.map(message=>({role:message.role,text:transcriptText(message)}))).length;assert.ok(total<=65536,'complete prompt/pins/history budget');
        if(mode==='success'){for(const label of ['Choose the actual transport','SFTP file transfer','SSH terminal commands','Use the interactive terminal'])assert.ok(JSON.stringify(history).includes(label),'choice semantic retained in current plain history');assert.ok(history.some(message=>transcriptText(message).includes(largeHuman)),'completed newly arrived 18k Human is never cut to recent 16k');const semantic=JSON.stringify(requests);for(const text of ['Choose the actual transport','SFTP file transfer','SSH terminal commands','Use the interactive terminal'])assert.ok(semantic.includes(text));assert.ok(server.calls.some(request=>JSON.stringify(request.body.messages).includes('"optionId":"b"')||JSON.stringify(request.body.messages).includes('\\"optionId\\":\\"b\\"')));}
        const covered=structuredClone(memory.covered);await send('No duplicate summary needed');const next=(await organizations.load(project)).roleMemories.entries.find(entry=>entry.roleId==='Supervisor'&&entry.channel==='su_customer');assert.deepEqual(next.covered,covered);assert.equal(summaryCount,1,'watermark prevents replay and repeated compaction');
        const count=requests.length;unwrap(await pipeline.close());pipeline=createWorkbenchPipeline({userDataDir:data,leaseRoot:fixtureLeaseRoot(data)});unwrap(await pipeline.selectProject(root));assert.equal(requests.length,count);await send('Restart restores this role text');assert.ok(server.calls.findLast(call=>(call.body.tools??[]).some(tool=>tool.function.name==='legion_delegate_pm')).body.messages.some(message=>transcriptText(message).includes(summary)));assert.equal(summaryCount,1);
        if(mode==='success'){const ownProject=project;const otherRoot=join(location,'separate-project');await fs.mkdir(otherRoot);unwrap(await pipeline.selectProject(otherRoot));project=unwrap(await projects.select(otherRoot));await send('Separate project own unique Human requirement');assert.ok(!server.calls.findLast(call=>(call.body.tools??[]).some(tool=>tool.function.name==='legion_delegate_pm')).body.messages.some(message=>transcriptText(message).includes(summary)||transcriptText(message).includes(largeHuman)));unwrap(await pipeline.selectProject(root));project=ownProject;await send('Original project remembers only its own summary');assert.ok(server.calls.findLast(call=>(call.body.tools??[]).some(tool=>tool.function.name==='legion_delegate_pm')).body.messages.some(message=>transcriptText(message).includes(summary)));assert.ok(!server.calls.findLast(call=>(call.body.tools??[]).some(tool=>tool.function.name==='legion_delegate_pm')).body.messages.some(message=>transcriptText(message).includes('Separate project own unique Human requirement')));}
      } else {
        assert.deepEqual(memory.covered,oldMemory.covered,'failed/cancelled/conflicted summary claims no new coverage');assert.equal(memory.summary,oldMemory.summary);if(mode==='conflict')assert.ok(after.customerTimeline.messages.some(message=>message.text==='Concurrent changed Human source'));
        if(mode==='budget'){assert.equal(state.turn.status,'failed');assert.equal(state.turn.error.code,'prompt_budget');assert.equal(server.calls.filter(call=>(call.body.tools??[]).some(tool=>tool.function.name==='legion_delegate_pm')).length,businessBefore,'over-budget old context never reaches business model');const newText='COMPLETE_OVERSIZED_HUMAN_'+'H'.repeat(65000);const count=server.calls.length;const refusal=await pipeline.sendMessage({projectId:project.id,roleId:'Supervisor',text:newText});assert.equal(refusal.ok,false);assert.equal(refusal.error.code,'prompt_budget');assert.equal(server.calls.length,count);assert.ok((await organizations.load(project)).customerTimeline.messages.some(message=>message.text===newText),'over-budget current input remains complete in archive');}
        else if(mode!=='cancel'){assert.equal(state.turn.status,'completed','old context within hard budget continues honestly');const codes={failure:'role_memory_summary_failed',length:'role_memory_summary_length',tool:'role_memory_summary_failed','output-limit':'role_memory_summary_failed',timeout:'role_memory_summary_failed',conflict:'role_memory_summary_conflict'};assert.ok(state.memoryNotices.some(notice=>notice.code===codes[mode]),JSON.stringify(state.memoryNotices));}
      }
      if(mode==='timeout'){assert.ok(Date.now()-startedAt>=29000&&Date.now()-startedAt<39000,'real summary times out at its 30s budget without retry');if(held&&!held.destroyed)held.end();}
      results.push({mode,summaryRequests:summaryCount,covered:memory.covered.length,archives:after.customerTimeline.messages.length,realRequests:requests.length});
    }finally{unwrap(await pipeline.close());await organizations.close();await projects.close();await server.close();}
  }
  // Old files are verified against their original digest before adding new memory fields.
  const root=join(location,'migration'),data=join(userData,'migration');await fs.mkdir(root);await fs.mkdir(data);const projects=createProjectService({userDataDir:data,leaseRoot:fixtureLeaseRoot(data)}),organizations=createOrganizationService({userDataDir:data});
  try{const project=unwrap(await projects.select(root));const original=await organizations.load(project);const path=join(data,'workbench-organization',project.id+'.json');const raw=JSON.parse(await fs.readFile(path,'utf8'));delete raw.roleMemories;delete raw.digest;raw.digest=digestValue(raw);await fs.writeFile(path,JSON.stringify(raw));const migrated=await organizations.load(project);assert.equal(migrated.roleMemories.entries.length,0);assert.deepEqual(migrated.timeline,original.timeline);const invalid={...raw,revision:raw.revision+1};await fs.writeFile(path,JSON.stringify(invalid));await assert.rejects(organizations.load(project),{code:'organization_corrupt'});results.push({mode:'legacy digest checked before migration',rawRejected:true});}finally{await organizations.close();await projects.close();}
  return {results,platform:process.platform,paidRequests:0};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&!process.versions.electron)test('independent actual host summary success semantic watermark failures cancellation CAS and legacy migration', {timeout:100000}, async()=>{
  const location=await ownedDirectory('fixtures','role-memory-'),userData=await ownedDirectory('user-data','role-memory-');const evidence=await ownedDirectory('evidence','memory-regression-');const proof=join(evidence,'memory-flow.json');const harness=join(location,'entry.mjs');await fs.writeFile(harness,`import {app} from 'electron';import {runRoleMemoryFlows} from ${JSON.stringify(import.meta.url)};import {writeFile} from 'node:fs/promises';app.setPath('userData',${JSON.stringify(userData)});app.setPath('sessionData',${JSON.stringify(userData)});app.whenReady().then(()=>runRoleMemoryFlows(${JSON.stringify(location)},${JSON.stringify(userData)})).then(async value=>{await writeFile(${JSON.stringify(proof)},JSON.stringify(value));app.exit(0)}).catch(error=>{console.error(error);app.exit(1)});`);
  try{let executable=join(projectRoot,'apps/desktop/node_modules/electron/dist/electron.exe');if(process.platform==='darwin')executable=join(projectRoot,'apps/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');const child=spawn(executable,[harness],{cwd:join(projectRoot,'apps/desktop'),env:environment(),stdio:['ignore','pipe','pipe']});let output='';child.stdout.on('data',bytes=>{output+=bytes;});child.stderr.on('data',bytes=>{output+=bytes;});const timeout=setTimeout(()=>child.kill(),95000);const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});clearTimeout(timeout);assert.equal(code,0,output);assert.equal(JSON.parse(await fs.readFile(proof,'utf8')).results.length,11);}finally{await removeOwned(location,join(generated,'fixtures'));await removeOwned(userData,join(generated,'user-data'));}
});

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)&&!process.versions.electron)test('independent public memory save reports the actual filesystem commit if cancellation arrives after rename', async(t)=>{
  const { createProjectService }=await import('../../src/services/public/project.mjs');const { createOrganizationService }=await import('../../src/services/public/organization.mjs');const { roleContextSources }=await import('../../src/models/workbench.mjs');const { syncBuiltinESMExports }=await import('node:module');
  const location=await ownedDirectory('fixtures','memory-commit-'),userData=await ownedDirectory('user-data','memory-commit-'),root=join(location,'customer');await fs.mkdir(root);const projects=createProjectService({userDataDir:userData,leaseRoot:fixtureLeaseRoot(userData)}),organizations=createOrganizationService({userDataDir:userData});
  try{const project=unwrap(await projects.select(root));const domain=await organizations.load(project);const actor={projectId:project.id,roleId:'ProjectManager',instanceId:'public-save-cancel-observer'};const input={roleId:'ProjectManager',expectedRevision:0,summary:'Independent save cancellation observation',covered:[],messages:[],sourceDigest:roleContextSources(domain,'ProjectManager').sourceDigest,updatedAt:new Date().toISOString()};const before=new AbortController();before.abort();await assert.rejects(organizations.saveRoleMemory(project,input,actor,before.signal),{code:'stale_action'});assert.equal((await organizations.load(project)).roleMemories.entries.length,0);
    const after=new AbortController(),target=join(userData,'workbench-organization',project.id+'.json');let observed=false;const rename=fs.rename;t.mock.method(fs,'rename',async(from,to)=>{const result=await rename(from,to);if(to===target){observed=true;after.abort();}return result;});syncBuiltinESMExports();const result=await organizations.saveRoleMemory(project,input,actor,after.signal);assert.equal(observed,true,'actual atomic rename observed');assert.equal(after.signal.aborted,true);assert.equal(result.roleMemories.entries[0].summary,input.summary);const persisted=JSON.parse(await fs.readFile(target,'utf8'));assert.equal(persisted.digest,result.digest);assert.equal(persisted.roleMemories.entries[0].revision,1);assert.deepEqual(await fs.readdir(join(userData,'workbench-organization')),[project.id+'.json'],'no leftover locks or temp files');
  }finally{t.mock.restoreAll();syncBuiltinESMExports();await organizations.close();await projects.close();await removeOwned(location,join(generated,'fixtures'));await removeOwned(userData,join(generated,'user-data'));}
});
