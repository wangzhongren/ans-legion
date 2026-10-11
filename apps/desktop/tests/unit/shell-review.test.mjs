import { dirname as leaseParent } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  writeFile,
  readFile,
  readdir,
  rename
} from 'node:fs/promises';
import {
  join,
  resolve
} from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createServer
} from 'node:http';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto';
import {
  setTimeout as delay
} from 'node:timers/promises';
import {
  WorkbenchPipelineImpl,
  _safeArchitectErrorCode,
  createWorkbenchPipeline
} from '../../src/pipelines/workbench.mjs';
import { createProjectService as realCreateProjectService } from '../../src/services/public/project.mjs';
import { createOrganizationService } from '../../src/services/public/organization.mjs';
import { FIXED_ROLE_DUTIES } from '../../src/models/organization.mjs';
import { ProjectFileOwners } from 'legion-runtime/workbench-models';
import {
  ProfilesServiceImpl
} from '../../src/services/impl/profiles.mjs';
import {
  SettingsProviderImpl
} from '../../src/providers/impl/settings.mjs';
import {
  createProbeProvider
} from '../../src/providers/public/probe.mjs';
const testRole = process.env.LEGION_DESKTOP_TEST_ROLE ?? 'DesktopEngineer';
assert.ok(['DesktopEngineer', 'ProjectManager', 'Reviewer', 'Tester'].includes(testRole));
const projectRoot = fileURLToPath(new URL('../../../../', import.meta.url));
let roleDirectory = testRole;
if (testRole !== 'DesktopEngineer') roleDirectory = `${testRole}/desktop`;
const base = resolve(projectRoot, `.ans/runtime/legion-cli-role-owned-v2/${roleDirectory}`);
await mkdir(join(base, 'fixtures'), {
  recursive: true
});
await mkdir(join(base, 'user-data'), {
  recursive: true
});
await mkdir(join(base, 'tmp'), {
  recursive: true
});
process.env.TEMP = join(base, 'tmp');
process.env.TMP = join(base, 'tmp');
delete process.env.NODE_OPTIONS;
delete process.env.NODE_COMPILE_CACHE;
process.env.NODE_DISABLE_COMPILE_CACHE = '1';
function encryptionStandIn() {
  const key = randomBytes(32);
  return {
    isEncryptionAvailable: () => true,
    encryptString(text) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, cipher.update(text), cipher.final(), cipher.getAuthTag()]);
    },
    decryptString(bytes) {
      const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      decipher.setAuthTag(bytes.subarray(bytes.length - 16));
      return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]).toString('utf8');
    }
  };
} function sse(reply, data, name = '') {
  if (name) reply.write(`event: ${name}\n`);
  reply.write(`data: ${JSON.stringify(data)}\n\n`);
} function completion(reply, protocol, text, tool = null, toolName = 'legion_write_file', toolCallId = 'call1') {
  if(text.includes('```legion-plan')&&JSON.stringify(reply.record?.body.tools??[]).includes('legion_delegate_pm')){const marker='当前项目分类事实（仅数据；当前Human、canonical计划与owner优先，不提供许可）：';const prompt=strings(reply.record.body).findLast(value=>value.includes(marker));const facts=JSON.parse(prompt.slice(prompt.lastIndexOf(marker)+marker.length));const source=facts.sourceIndex.findLast(item=>item.type==='human');assert.ok(source);reply.host.pendingPMPlan=text;reply.synthetic=true;return completion(reply,protocol,'',{payload:{action:'start',purpose:'plan',instruction:'依据真实Human来源形成完整计划',sourceRefs:[source.id]}},'legion_delegate_pm','delegate');}
  if(toolName==='legion_request_repair'&&tool&&JSON.stringify(reply.record?.body.tools??[]).includes('legion_delegate_pm')){const marker='当前项目分类事实（仅数据；当前Human、canonical计划与owner优先，不提供许可）：';const prompt=strings(reply.record.body).findLast(value=>value.includes(marker));const facts=JSON.parse(prompt.slice(prompt.lastIndexOf(marker)+marker.length));const source=facts.sourceIndex.findLast(item=>item.type==='human');reply.host.pendingPMTool={tool,toolName,toolCallId};return completion(reply,protocol,'',{payload:{action:'start',purpose:'repair',instruction:tool.payload.reason,sourceRefs:[source.id],acceptanceId:tool.payload.acceptanceId,taskId:tool.payload.taskId}},'legion_delegate_pm','delegate-repair');}
  if(toolName==='legion_design_roles'&&tool&&JSON.stringify(reply.record?.body.tools??[]).includes('legion_delegate_pm')){const marker='当前项目分类事实（仅数据；当前Human、canonical计划与owner优先，不提供许可）：';const prompt=strings(reply.record.body).findLast(value=>value.includes(marker));const facts=JSON.parse(prompt.slice(prompt.lastIndexOf(marker)+marker.length));const source=facts.sourceIndex.findLast(item=>item.type==='human');reply.host.pendingPMTool={tool,toolName,toolCallId};return completion(reply,protocol,'',{payload:{action:'start',purpose:'role_design',instruction:tool.payload.instruction,sourceRefs:[source.id]}},'legion_delegate_pm','delegate-design');}
  if (!reply.synthetic && text.includes('```legion-plan')) {
    const raw = /```legion-plan\s*\n([\s\S]*?)\n```/u.exec(text)[1]; reply.host.plan = JSON.parse(raw);
    reply.host.planText = text; reply.host.phase = 'design'; reply.synthetic = true;
    return completion(reply, protocol, '', { payload: { instruction: raw } }, 'legion_design_roles', 'design');
  }
  const task = taskMetadata(reply.record?.body);
  if (!reply.synthetic && !tool && task && task.writeSet.length && typedResults(reply.record.body).some((item) => item.result?.success)) {
    reply.host.finalText.set(task.id, text); reply.synthetic = true;
    return completion(reply, protocol, '', { checkId: 'unit-' + task.id }, 'legion_run_check', 'check');
  }
  reply.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache'
  });
  if (protocol === 'openai-completions') {
    let delta = {
      role: 'assistant',
      content: text
    };
    let finish = 'stop';
    if (tool) {
      delta = {
        role: 'assistant',
        tool_calls: [{
          index: 0,
          id: toolCallId,
          type: 'function',
          function: {
            name: toolName,
            arguments: JSON.stringify(tool)
          }
        }]
      };
      if (text) delta.content = text; // Real Chat Completion may stream text and a tool call together.
      finish = 'tool_calls';
    } sse(reply, {
      id: 'chat1',
      object: 'chat.completion.chunk',
      model: 'local',
      choices: [{
        index: 0,
        delta,
        finish_reason: null
      }]
    });
    sse(reply, {
      id: 'chat1',
      object: 'chat.completion.chunk',
      choices: [{
        index: 0,
        delta: {
        },
        finish_reason: finish
      }]
    });
    reply.end('data: [DONE]\n\n');
  } else if (protocol === 'openai-responses') {
    let item = {
      id: 'msg1',
      type: 'message',
      role: 'assistant',
      status: 'completed',
      content: [{
        type: 'output_text',
        text,
        annotations: []
      }]
    };
    if (tool) item = {
      id: 'fc1',
      type: 'function_call',
      call_id: toolCallId,
      name: toolName,
      arguments: JSON.stringify(tool),
      status: 'completed'
    };
    const events = [{
      type: 'response.created',
      response: {
        id: 'resp1',
        status: 'in_progress',
        output: []
      }
    },
    {
      type: 'response.output_item.added',
      output_index: 0,
      item: {
        ...item,
        status: 'in_progress'
      }
    }];
    if (!tool) events.push({
      type: 'response.content_part.added',
      output_index: 0,
      content_index: 0,
      item_id: item.id,
      part: {
        type: 'output_text',
        text: '',
        annotations: []
      }
    }, {
      type: 'response.output_text.delta',
      output_index: 0,
      content_index: 0,
      item_id: item.id,
      delta: text
    });
    else events.push({
      type: 'response.function_call_arguments.delta',
      output_index: 0,
      item_id: item.id,
      delta: JSON.stringify(tool)
    });
    events.push({
      type: 'response.output_item.done',
      output_index: 0,
      item
    }, {
      type: 'response.completed',
      response: {
        id: 'resp1',
        status: 'completed',
        output: [item],
        usage: {
          input_tokens: 1,
          output_tokens: 1,
          total_tokens: 2,
          input_tokens_details: {
            cached_tokens: 0
          },
          output_tokens_details: {
            reasoning_tokens: 0
          }
        }
      }
    });
    for (const event of events) sse(reply, event, event.type);
    reply.end();
  } else {
    let content = {
      type: 'text',
      text: ''
    };
    let delta = {
      type: 'text_delta',
      text
    };
    let stop = 'end_turn';
    if (tool) {
      content = {
        type: 'tool_use',
        id: toolCallId,
        name: toolName,
        input: {
        }
      };
      delta = {
        type: 'input_json_delta',
        partial_json: JSON.stringify(tool)
      };
      stop = 'tool_use';
    } for (const event of [{
      type: 'message_start',
      message: {
        id: 'msg1',
        type: 'message',
        role: 'assistant',
        model: 'local',
        content: [],
        stop_reason: null,
        usage: {
          input_tokens: 1,
          output_tokens: 0
        }
      }
    }, {
      type: 'content_block_start',
      index: 0,
      content_block: content
    }, {
      type: 'content_block_delta',
      index: 0,
      delta
    }, {
      type: 'content_block_stop',
      index: 0
    }, {
      type: 'message_delta',
      delta: {
        stop_reason: stop,
        stop_sequence: null
      },
      usage: {
        output_tokens: 1
      }
    }, {
      type: 'message_stop'
    }]) sse(reply, event, event.type);
    reply.end();
  }
} async function server(handler) {
  const calls = [];
  const host = { phase: null, plan: null, planText: '', finalText: new Map(), fixture: null };
  const sockets = new Set();
  const instance = createServer(async (request, reply) => {
    let raw = ''; for await (const chunk of request) raw += chunk; const body = JSON.parse(raw); const record = {
      url: request.url,
      body,
      headers: request.headers
    }; calls.push(record); reply.host = host; reply.record = record; try {
      if (await governedResponse(record, reply, host)) return;
      await handler(record, reply);
    } catch (error) {
      console.error('finite-fixture-error:'+JSON.stringify({name:error.name,code:error.code,location:error.stack?.split('\n').find(line=>line.includes('shell-'))})); reply.writeHead(401); reply.end('{"error":{"message":"finite_fixture_handler_failed"}}');
    }
  });
  instance.on('connection', (socket) => {
    sockets.add(socket); socket.once('close', () => sockets.delete(socket));
  });
  await new Promise((done, reject) => {
    instance.once('error', reject); instance.listen(0, '127.0.0.1', done);
  });
  return {
    calls, host,
    url: `http://127.0.0.1:${instance.address().port}`,
    close: async () => {
      for (const socket of sockets) socket.destroy();
      await new Promise((done, reject) => instance.close((error) => {
        if (error) reject(error); else done();
      }));
    }
  };
} async function fixture(local) {
  const location = await mkdtemp(join(base, 'fixtures', 'workbench-'));
  const root = join(location, 'customer');
  await mkdir(root);
  const data = await mkdtemp(join(base, 'user-data', 'workbench-'));
  const crypto = encryptionStandIn();
  const settings = new SettingsProviderImpl({
    userDataDir: data
  }, async () => crypto);
  const profiles = new ProfilesServiceImpl({
    userDataDir: data
  }, {
    settings,
    probe: createProbeProvider({
      timeoutMs: 1000
    })
  });
  const ids = [];
  for (const [index, protocol] of ['openai-completions', 'openai-responses', 'anthropic-messages'].entries()) {
    const saved = await profiles.save({
      name: `连接${index}`,
      protocol,
      provider: `provider${index}`,
      modelId: `model${index}`,
      baseUrl: `${local.url}/p${index}`,
      keyAction: 'replace',
      apiKey: `localhost-key-${index}`
    });
    assert.equal(saved.ok, true);
    ids.push(saved.value.id);
  } const pipeline = new WorkbenchPipelineImpl({
    userDataDir: data, leaseRoot:join(data,'..','isolated-project-leases')
  }, {
    profiles
  });
  let selected;try{selected=await pipeline.selectProject(root);assert.equal(selected.ok,true,JSON.stringify(selected));}catch(error){await pipeline.close();await local.close();throw error;}
  const projectId = selected.value.currentProject.id;
  assert.deepEqual(selected.value.roles.map((item) => item.id), ['Acceptance', 'ProjectManager', 'RoleArchitect','Supervisor']);
  assert.equal((await pipeline.setDefaultProfile({
    profileId: ids[0]
  })).ok, true);
  local.host.fixture = { root, data, ids, projectId, proposalCounter: 1 };
  await mkdir(join(root, 'tests/Acceptance'), { recursive: true });
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  await writeFile(join(root, 'tests/Acceptance/fixed.test.mjs'), "import test from 'node:test';import assert from 'node:assert/strict';test('real fixed validation',()=>assert.equal(1,1));");
  const confirm = pipeline.confirmPlan.bind(pipeline);
  pipeline.confirmPlan = async (input) => {
    let state = (await pipeline.getState()).value;
    for (let wait = 0; wait < 200 && state.plan?.planDigest === input.planDigest && state.turn?.status === 'running'; wait += 1) { const next = await pipeline.getState(); if (!next.ok) return next; state = next.value; await delay(1); }
    if (state.plan?.planDigest !== input.planDigest || !state.interactions.some((item) => item.status === 'pending' && item.purpose === 'execute_plan')) return confirm(input);
    const request = state.interactions.find((item) => item.status === 'pending' && item.purpose === 'execute_plan');
    return pipeline.answerInteraction({ projectId: input.projectId, requestId: request.requestId, version: request.version, requestDigest: request.digest, value: true });
  };
  return {
    root,
    data,
    location,
    profiles,
    plainConfirm: confirm,
    reopenProfiles: () => new ProfilesServiceImpl({ userDataDir: data }, { settings: new SettingsProviderImpl({ userDataDir: data }, async () => crypto), probe: createProbeProvider({ timeoutMs: 1000 }) }),
    pipeline,
    projectId,
    ids
  };
} async function until(pipeline, predicate) {
  for (let index = 0; index < 3000; index += 1) {
    const state = await pipeline.getState();
    assert.equal(state.ok, true);
    if (predicate(state.value)) return state.value; if (state.value.turn?.status === 'failed' && !state.value.plan) assert.fail('finite fixture turn failed: '+state.value.error?.code);
    await delay(10);
  } const last = (await pipeline.getState()).value; assert.fail('bounded condition did not complete: ' + JSON.stringify({ plan: last.plan?.status, turn: last.turn?.status, error: last.error, tasks: last.tasks, acceptances: last.acceptances, repairs: last.repairs }));
} function proposal(ids, independent = false) {
  return {
    goal: '完成客户项目',
    roles: ids.map((profileId, index) => ({
      id: `Worker${index}`,
      name: `执行${index}`,
      purpose: '实现精确任务',
      profileId
    })),
    tasks: ids.map((profileId, index) => {
      let dependsOn = []; if (index && !independent) dependsOn = [`task${index - 1}`]; return {
        id: `task${index}`,
        title: `任务${index}`,
        roleId: `Worker${index}`,
        profileId,
        dependsOn,
        writeSet: [`file${index}.txt`],
        instruction: `写入文件${index}`
      };
    })
  };
} function protocol(record) {
  const index = Number(/^\/p(\d)/u.exec(record.url)[1]);
  return ['openai-completions',
  'openai-responses',
  'anthropic-messages'][index];
} function hasResult(body) {
  return /"role":"tool"|"type":"function_call_output"|"type":"tool_result"/u.test(JSON.stringify(body));
} function desiredFile(body) {
  const raw = JSON.stringify(body);
  const match = /file[0-9]\.txt/u.exec(raw);
  return match?.[0] ?? 'file0.txt';
} function strings(value) { if (typeof value === 'string') return [value]; if (Array.isArray(value)) return value.flatMap(strings); if (value && typeof value === 'object') return Object.values(value).flatMap(strings); return []; }
function typedResults(body) { return strings(body).flatMap((value) => { try { const parsed = JSON.parse(value); if (parsed.result) return [parsed]; } catch {} return []; }); }
function taskMetadata(body) { const value = strings(body).find((text) => text.startsWith('Human已确认任务：')); if (!value) return null; const task=JSON.parse(value.split('\n')[0].slice('Human已确认任务：'.length));return {...task,writeSet:task.ownedFiles??[]}; }
function checkSpec(taskId, resources) { const testResource='tests/Acceptance/check-'+taskId+'.test.mjs'; return {checkId:'unit-'+taskId,kind:'node-test',argv:['--test',testResource],testResources:[testResource],inputResources:[testResource,'package.json',...resources],outputResources:[],timeoutSeconds:10,network:'none',logMaxBytes:8192}; }
async function businessEntries(root) { return (await readdir(root)).filter((entry) => !['tests','package.json'].includes(entry)); }
async function governedResponse(record, reply, host) {
 const results = typedResults(record.body); const tools = record.body.tools ?? []; const toolText = JSON.stringify(tools);
 if(toolText.includes('legion_delegate_pm')&&results.some(pair=>pair.result?.tool==='legion_delegate_pm')){record.synthetic=true;reply.synthetic=true;const result=results.findLast(pair=>pair.result?.tool==='legion_delegate_pm').result;assert.equal(result.status,'completed',result.reason);if(result.payload?.kind==='error'){completion(reply,protocol(record),'Host已明确拒绝本委托：'+result.payload.code);return true;}completion(reply,protocol(record),(host.planText??'').replace(/```legion-plan\s*\n[\s\S]*?\n```/u,'')||'计划已形成');return true;}

 const task = taskMetadata(record.body);
 if(toolText.includes('legion_design_roles')&&host.pendingPMTool&&!results.length){const pending=host.pendingPMTool;host.pendingPMTool=null;record.synthetic=true;completion(reply,protocol(record),'',pending.tool,pending.toolName,pending.toolCallId);return true;}
 if(toolText.includes('legion_design_roles')&&host.pendingPMPlan&&!results.length){const planned=host.pendingPMPlan;host.pendingPMPlan=null;record.synthetic=true;completion(reply,protocol(record),planned);return true;}

 if(toolText.includes('legion_submit_supervision')&&host.rejectKeyMode==='supervisor')return false;
 if(toolText.includes('legion_submit_supervision')){
   record.synthetic=true;reply.synthetic=true;
   const prompt=strings(record.body).find(text=>text.startsWith('你是Supervisor。'));const snapshot=JSON.parse(prompt.split('监督输入：')[1].split('\n')[0]);
   (host.supervisionSnapshots??=[]).push(snapshot);if(host.supervisionMode==='text-only'&&snapshot.phase==='preflight'){completion(reply,protocol(record),'只有文字，不能冒充预检完成');return true;}
   if(!results.some(pair=>pair.result?.tool==='legion_submit_supervision'))completion(reply,protocol(record),'',{payload:{phase:snapshot.phase,planDigest:snapshot.planDigest,findings:[],recommendation:'proceed'}},'legion_submit_supervision','supervise');
   else completion(reply,protocol(record),'SUPERVISOR_PRIVATE_RAW_TEXT_CANARY');return true;
 }

 if (task) {
   const check = results.findLast((item) => item.result?.checkId === 'unit-'+task.id);
   if (task.id === 'zz-acceptance') {
     record.synthetic=true;reply.synthetic=true;
     if(host.acceptanceOverwrite && !results.some((pair)=>pair.result?.resource==='file0.txt'&&pair.result?.status==='denied')) { completion(reply,protocol(record),'',{resource:'file0.txt',content:'越权覆盖'},'legion_write_file','forbidden-write');return true; }
     if (!results.some((pair)=>pair.result?.success && pair.result.resource===task.writeSet[0])) completion(reply,protocol(record),'',{resource:task.writeSet[0],content:acceptanceSource(host)},'legion_write_file','acceptance-write');
     else if (!check) completion(reply,protocol(record),'',{checkId:'unit-'+task.id},'legion_run_check','accept-check');
     else if (!results.some((item) => item.result?.tool === 'legion_submit_acceptance')) completion(reply,protocol(record),'',{payload:{taskId:task.id,evidenceIds:[check.result.requestId],decision:check.result.status==='passed'?'pass':'fail',issues:acceptanceIssues(host,check.result)}},'legion_submit_acceptance','submit');
     else completion(reply,protocol(record),'已真实独立验收');
     return true;
   }
   if (check && host.finalText.has(task.id)) {record.synthetic=true;reply.synthetic=true;completion(reply,protocol(record),host.finalText.get(task.id));return true;}
   return false;
 }
 if (!host.manualArchitect && toolText.includes('legion_propose_roles')) {
   record.synthetic=true;reply.synthetic=true;
   if (results.some((item) => item.result?.tool === 'legion_propose_roles')) {completion(reply,protocol(record),'候选已提交');return true;}
   const prompt=strings(record.body).find((text)=>text.startsWith('你是RoleArchitect。'));
   const marker = '全部现有成员事实（开发成员可按revision+1修订）：'; const begin = prompt.indexOf(marker); assert.ok(begin >= 0); assert.ok(prompt.includes('四系统固定职责约束：')); const organization=JSON.parse(prompt.slice(begin + marker.length,prompt.indexOf('。组织revision：', begin))); assert.ok(Array.isArray(organization));
   const plan=host.plan; const members=[];
   for (const role of [...plan.roles,{id:'Acceptance',name:'Acceptance',purpose:FIXED_ROLE_DUTIES.Acceptance}]) {
     const previous=organization.find((item)=>item.id===role.id);let revision=1;if(previous) revision=previous.revision+1;
     members.push({id:role.id,name:role.name,purpose:FIXED_ROLE_DUTIES[role.id]??role.purpose,interfaces:[],boundary:roleBoundary(plan,role.id),documents:[],revision,enabled:true,status:'approved'});
   }
   for(const transfer of plan.transfers??[]) {const previous=organization.find((item)=>item.id===transfer.fromRoleId);if(!members.some((item)=>item.id===previous.id)) members.push({...previous,digest:undefined,boundary:previous.boundary.filter((resource)=>resource!==transfer.resource),revision:previous.revision+1,status:'approved'});}
   if(host.publication) members.push({id:'DocumentedRole',name:'DocumentedRole',purpose:'需要实际角色文档',interfaces:[],boundary:[],documents:[{resource:host.publication.resource,contentDigest:createHash('sha256').update(host.publication.content).digest('hex'),summary:'职责与边界'}],revision:1,enabled:true,status:'approved'});
   const payload={id:'proposal-'+host.fixture.proposalCounter,version:1,members}; if(plan.transfers) payload.transfers=plan.transfers;
   completion(reply,protocol(record),'',{payload},'legion_propose_roles','propose');return true;
 }
 if(host.phase==='design' && results.some((item)=>item.result?.tool==='legion_design_roles')) {
   record.synthetic=true;reply.synthetic=true; const pair=results.findLast((item)=>item.result?.tool==='legion_design_roles');
   if (pair.result.status !== 'completed') { host.phase=null; completion(reply,protocol(record),host.planText.replace(/```legion-plan\s*\n[\s\S]*?\n```/u,'```legion-plan\n'+JSON.stringify(runtimePlan(host.plan))+'\n```')); return true; }const proposal=pair.result.payload.proposal;
   host.phase='review';completion(reply,protocol(record),'',{payload:{proposalId:proposal.id,version:proposal.version,digest:proposal.digest,organizationRevision:proposal.baseRevision,organizationDigest:proposal.baseDigest,decision:'approve',reason:''}},'legion_review_roles','review');return true;
 }
 if(host.phase==='review' && results.some((item)=>item.result?.tool==='legion_review_roles')) {
   record.synthetic=true;reply.synthetic=true; const pair=results.findLast((item)=>item.result?.tool==='legion_review_roles');assert.equal(pair.result.status,'completed',JSON.stringify(pair));const organization=pair.result.payload.organization;
   const plan=structuredClone(host.plan);plan.governance={organizationRevision:organization.revision,organizationDigest:organization.digest,maxRepairRounds:2};
   for(const role of plan.roles) {const member=organization.members.find((item)=>item.id===role.id);role.revision=member.revision;role.digest=member.digest;}
   const acceptance=organization.members.find((item)=>item.id==='Acceptance');if(!host.publication) plan.roles.push({id:'Acceptance',name:acceptance.name,purpose:acceptance.purpose,revision:acceptance.revision,digest:acceptance.digest,profileId:host.fixture.ids[0]});
   for(const task of plan.tasks) { const resources = [...new Set([...task.writeSet,...testDependencyResources(plan.tasks,task)])]; task.checks=[checkSpec(task.id,resources)]; await writeFile(join(host.fixture.root, task.checks[0].testResources[0]), validationSource(resources)); }
   if(!host.publication) plan.tasks.push({id:'zz-acceptance',title:'独立验收',roleId:'Acceptance',profileId:host.fixture.ids[0],dependsOn:plan.tasks.map((task)=>task.id),accepts:plan.tasks.map((task)=>task.id),writeSet:['tests/Acceptance/check-zz-acceptance.test.mjs'],instruction:'运行独立检查并提交真实证据',checks:[checkSpec('zz-acceptance',plan.tasks.flatMap((task)=>task.writeSet))]});
   if(host.negativeMode==='missing-check') delete plan.tasks[0].checks;
   if(host.negativeMode==='missing-acceptance') {plan.tasks=plan.tasks.filter((task)=>task.roleId!=='Acceptance');plan.roles=plan.roles.filter((role)=>role.id!=='Acceptance');}
   host.phase=null;host.fixture.proposalCounter+=1;
   completion(reply,protocol(record),host.planText.replace(/```legion-plan\s*\n[\s\S]*?\n```/u,'```legion-plan\n'+JSON.stringify(runtimePlan(plan))+'\n```'));return true;
 }
 return false;
}

function roleBoundary(plan, id) { if (id === 'Acceptance') return ['tests/Acceptance/check-zz-acceptance.test.mjs']; return plan.tasks.filter((item)=>item.roleId===id).flatMap((item)=>item.writeSet); }
function validationSource(resources) { return "import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';test('actual declared target content',()=>{for(const resource of " + JSON.stringify(resources) + ")assert.ok(readFileSync(resource,'utf8').trim().length>0);});"; }

function acceptanceSource(host) { if (host.repairFlow) return "import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';test('actual customer requirement',()=>assert.equal(readFileSync('file0.txt','utf8'),'good'));"; return validationSource(host.plan.tasks.flatMap((item)=>item.writeSet)); }
function acceptanceIssues(host, result) { if (result.status === 'passed') return []; return [{ taskId: 'task0', resource: 'file0.txt', expected: 'good', actual: result.status, reproduction: 'legion_run_check unit-zz-acceptance' }]; }
test('actual original SDK request waits for independent PM SDK approval, native Shell publishes owned source and requester continues with real checks/Acceptance', async () => {
  let candidate, planned = false, pmCalls = 0, requesterInitial = 0, count = 0, receivedFinal = null;
  const local = await server((record, reply) => {
    if (++count > 24) { reply.writeHead(401, { 'content-type': 'application/json' }); reply.end('{"error":{"message":"finite_fixture_request_bound"}}'); return; }
    const tools = record.body.tools.map((tool) => tool.function?.name ?? tool.name);
    const results = typedResults(record.body);
    if (tools.includes('legion_review_shell')) {
      pmCalls += 1; assert.deepEqual(tools, ['legion_review_shell']);
      if (results.some((pair) => pair.result.tool === 'legion_review_shell')) { completion(reply, protocol(record), '已按确切源码归属与任务范围完成审核'); return; }
      const prompt = strings(record.body).find((text) => text.startsWith('你是当前ProjectManager，审查'));
      const data = JSON.parse(prompt.split('真实请求及原角色任务：')[1]);
      assert.equal(data.request.command, 'printf shell-owned > file0.txt'); assert.equal(data.roleId, 'Worker0');
      completion(reply, protocol(record), '批准本次受控镜像命令', { requestId: data.request.requestId, requestDigest: data.requestDigest, revision: data.revision, approved: true, reason: '完成已确认file0.txt，不扩大owner或生成范围' }, 'legion_review_shell', 'pm-review-1'); return;
    }
    const task = taskMetadata(record.body);
    if (!task) { assert.equal(planned, false); planned = true; completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```'); return; }
    const shell = results.find((pair) => pair.result.requestDigest);
    if (!shell) { requesterInitial += 1; completion(reply, protocol(record), '', { command: 'printf shell-owned > file0.txt', cwd: '', reason: '创建自己的已确认交付文件', generatedEffects: [], network: 'none', timeoutSeconds: 30 }, 'legion_request_shell', 'shell-1'); return; }
    receivedFinal = shell; console.log('shell-final:' + JSON.stringify({ status: shell.result.status, reason: shell.result.reason, executed: shell.result.executed }));
    if (shell.result.status !== 'published') { completion(reply, protocol(record), '按实际Shell失败结束，不重复请求'); return; }
    if (!results.some((pair) => pair.result.checkId)) completion(reply, protocol(record), '', { checkId: 'unit-task0' }, 'legion_run_check', 'worker-check-1');
    else completion(reply, protocol(record), '同一原角色上下文根据实际发布和检查完成');
  });
  const setup = await fixture(local); candidate = proposal([setup.ids[0]]);
  try {
    assert.equal((await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '通过本角色Shell交付file0.txt，再独立验收；每条命令PM结构化审批' })).ok, true);
    const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft' && state.turn?.status === 'completed');
    assert.equal((await setup.pipeline.confirmPlan({ projectId: setup.projectId, planDigest: draft.plan.planDigest })).ok, true);
    const done = await until(setup.pipeline, (state) => ['completed', 'failed', 'invalidated'].includes(state.plan?.status));
    assert.equal(done.plan.status, 'completed', JSON.stringify({ tasks: done.tasks, error: done.error, shell: done.shellRequests }));
    assert.equal(requesterInitial, 1); assert.equal(pmCalls, 2); assert.equal(receivedFinal.result.status, 'published');
    assert.equal(receivedFinal.result.executed, true); assert.equal(await readFile(join(setup.root, 'file0.txt'), 'utf8'), 'shell-owned');
    assert.ok(done.tasks.every((task) => task.checkStatus === 'passed')); assert.equal(done.acceptances.at(-1).decision, 'pass');
    assert.equal(done.shellRequests.length, 1); assert.equal(done.shellRequests[0].status, 'published');
    const saved = done.shellRequests[0], organizations = createOrganizationService({ userDataDir: setup.data }); const projects = createProjectService({ userDataDir: setup.data }); const project = (await projects.catalog()).value.projects.find((project) => project.id === setup.projectId); await assert.rejects(organizations.claimShell(project, saved.id, { projectId: setup.projectId, roleId: saved.roleId, instanceId: saved.instanceId }), { code: 'invalid_or_replayed_shell' }); await organizations.close(); await projects.close();
    assert.equal(JSON.stringify(local.calls).includes('publicationReceipt'), false); assert.equal(JSON.stringify(done).includes('authorizationId'), false);
  } finally { await setup.pipeline.close(); await local.close(); }
});
for (const mode of ['deny', 'text-only', 'forged-digest', 'failed-after-approve', 'changed-input']) test('actual SDK Shell ' + mode + ' never executes or publishes', async () => {
  let candidate, planned = false, count = 0, final = null, setup;
  const local = await server(async (record, reply) => {
    if (++count > 24) { reply.writeHead(401); reply.end('{"error":{"message":"finite_fixture_request_bound"}}'); return; }
    const tools = JSON.stringify(record.body.tools), results = typedResults(record.body);
    if (tools.includes('legion_review_shell')) {
      const data = JSON.parse(strings(record.body).find((text) => text.startsWith('你是当前ProjectManager，审查')).split('真实请求及原角色任务：')[1]);
      if (mode === 'text-only') { completion(reply, protocol(record), 'yes，批准'); return; }
      if (results.some((pair) => pair.result.tool === 'legion_review_shell')) { if (mode === 'failed-after-approve') { reply.writeHead(401); reply.end('{"error":{"message":"finite_fixture_review_failure"}}'); } else completion(reply, protocol(record), '审核结束'); return; }
      if (mode === 'changed-input') await writeFile(join(setup.root, 'file0.txt'), 'later-original-value');
      completion(reply, protocol(record), '真实审核文字', { requestId: data.request.requestId, requestDigest: mode === 'forged-digest' ? '0'.repeat(64) : data.requestDigest, revision: 1, approved: mode !== 'deny', reason: '按真实任务边界审核' }, 'legion_review_shell', 'pm-decision-1'); return;
    }
    const task = taskMetadata(record.body); if (!task) { assert.equal(planned, false); planned = true; completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```'); return; }
    const pair = results.find((pair) => pair.result.requestDigest); if (pair) { final = pair; completion(reply, protocol(record), '按拒绝结果结束，不重试'); return; }
    completion(reply, protocol(record), '', { command: 'printf forbidden > file0.txt', reason: '需要PM审核', generatedEffects: [], network: 'none', timeoutSeconds: 30 }, 'legion_request_shell', 'worker-shell-1');
  }); setup = await fixture(local); candidate = proposal([setup.ids[0]]);
  try { await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '准备实际审批拒绝回归' }); const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft' && state.turn?.status === 'completed'); await setup.pipeline.confirmPlan({ projectId: setup.projectId, planDigest: draft.plan.planDigest }); const done = await until(setup.pipeline, (state) => ['completed','failed','invalidated'].includes(state.plan?.status)); assert.ok(final); assert.equal(final.result.executed, false); assert.equal(final.result.status, 'denied'); assert.equal(final.result.publishedResources.length, 0); assert.equal(done.tasks[0].checkStatus, 'not_executed'); if (mode === 'changed-input') assert.equal(await readFile(join(setup.root, 'file0.txt'), 'utf8'), 'later-original-value'); else await assert.rejects(readFile(join(setup.root, 'file0.txt')), { code: 'ENOENT' }); }
  finally { await setup.pipeline.close(); await local.close(); }
});
test('actual SDK pending PM review cancellation returns promptly and restart never restores its grant', async () => {
  let candidate, planned = false, waiting = false;
  const local = await server((record, reply) => { const tools = JSON.stringify(record.body.tools); if (tools.includes('legion_review_shell')) { waiting = true; reply.writeHead(200, {'content-type':'text/event-stream'}); reply.write(': awaiting real cancellation\n\n'); return; } if (!taskMetadata(record.body)) { assert.equal(planned,false); planned = true; completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```'); return; } completion(reply,protocol(record),'',{command:'printf forbidden > file0.txt',reason:'实际等待审批取消',network:'none',generatedEffects:[],timeoutSeconds:30},'legion_request_shell','pending-shell-1'); });
  const setup = await fixture(local); candidate = proposal([setup.ids[0]]);
  try { await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'测试待PM审批的取消'});const draft=await until(setup.pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed');await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest}); await until(setup.pipeline,state=>waiting&&state.tasks[0].shellPhase?.status==='waiting_pm_approval'); const started=Date.now();const stopped=await setup.pipeline.stopExecution({projectId:setup.projectId});assert.equal(stopped.ok,true);assert.ok(Date.now()-started<3000); await assert.rejects(readFile(join(setup.root,'file0.txt')),{code:'ENOENT'});await setup.pipeline.close(); const reopened=new WorkbenchPipelineImpl({userDataDir:setup.data, leaseRoot:join(setup.data,'..','isolated-project-leases')},{profiles:setup.reopenProfiles()});const state=await reopened.selectProject(setup.root);assert.equal(state.ok,true);assert.equal(state.value.shellRequests[0].result.executed,false);assert.equal(state.value.shellRequests[0].status,'cancelled');assert.equal((await reopened.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest})).ok,false);await reopened.close(); }
  finally { await setup.pipeline.close();await local.close(); }
});
function testDependencyResources(tasks, task, seen = new Set()) { const resources=[]; for(const id of task.dependsOn){if(seen.has(id))continue;seen.add(id);const dependency=tasks.find((item)=>item.id===id);resources.push(...dependency.writeSet,...testDependencyResources(tasks,dependency,seen));} return resources; }

function createProjectService(options){return realCreateProjectService({...options,leaseRoot:join(leaseParent(options.userDataDir),'isolated-project-leases')});}

function runtimePlan(plan){return {...plan,schemaVersion:2,tasks:plan.tasks.map(({writeSet,...task})=>({...task,intent:task.intent??'change'}))};}
