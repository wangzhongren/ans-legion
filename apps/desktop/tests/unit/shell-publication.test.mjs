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
import { rmdir, stat, chmod } from 'node:fs/promises';
import { shellWorkflowDocument } from '../../src/models/interaction.mjs';
import { digestValue } from 'legion-runtime/workbench-models';
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
const base = resolve(projectRoot, `.ans/runtime/legion-desktop-command-center-v1/${roleDirectory}`);
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
  if(text.includes('```legion-plan') && JSON.stringify(reply.record?.body.tools??[]).includes('legion_delegate_pm')){
    const marker='当前项目分类事实（仅数据；当前Human、canonical计划与owner优先，不提供许可）：';const prompt=strings(reply.record.body).findLast(value=>value.includes(marker));const facts=JSON.parse(prompt.slice(prompt.lastIndexOf(marker)+marker.length));const source=facts.sourceIndex.findLast(item=>item.type==='human');assert.ok(source);reply.host.pendingPMPlan=text;reply.synthetic=true;return completion(reply,protocol,'',{payload:{action:'start',purpose:'plan',instruction:'依据真实Human来源形成完整计划',sourceRefs:[source.id]}},'legion_delegate_pm','delegate');
  }
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
} async function privateOrganization(setup) {
  return JSON.parse(await readFile(join(setup.data,'workbench-organization',setup.projectId+'.json'),'utf8'));
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
   for(const task of plan.tasks) { const resources = [...new Set([...task.writeSet,...testDependencyResources(plan.tasks,task),...(task.generatedEffects?.includes('dist/')?['dist/output.txt']:[])])]; task.checks=[checkSpec(task.id,resources)]; await writeFile(join(host.fixture.root, task.checks[0].testResources[0]), validationSource(resources)); }
   if(!host.publication) plan.tasks.push({id:'zz-acceptance',title:'独立验收',roleId:'Acceptance',profileId:host.fixture.ids[0],dependsOn:plan.tasks.map((task)=>task.id),accepts:plan.tasks.map((task)=>task.id),writeSet:['tests/Acceptance/check-zz-acceptance.test.mjs'],instruction:'运行独立检查并提交真实证据',checks:[checkSpec('zz-acceptance',plan.tasks.flatMap(task=>[...task.writeSet,...(task.generatedEffects?.includes('dist/')?['dist/output.txt']:[])]))]});
   if(host.negativeMode==='missing-check') delete plan.tasks[0].checks;
   if(host.negativeMode==='missing-acceptance') {plan.tasks=plan.tasks.filter((task)=>task.roleId!=='Acceptance');plan.roles=plan.roles.filter((role)=>role.id!=='Acceptance');}
   host.phase=null;host.fixture.proposalCounter+=1;
   completion(reply,protocol(record),host.planText.replace(/```legion-plan\s*\n[\s\S]*?\n```/u,'```legion-plan\n'+JSON.stringify(runtimePlan(plan))+'\n```'));return true;
 }
 return false;
}

function roleBoundary(plan, id) { if (id === 'Acceptance') return ['tests/Acceptance/check-zz-acceptance.test.mjs']; return plan.tasks.filter((item)=>item.roleId===id).flatMap((item)=>item.writeSet); }
function validationSource(resources) { if(resources.includes('gone.bin')) return "import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';test('actual retained absence and source',()=>{assert.equal(existsSync('gone.bin'),false);assert.equal(readFileSync('src.mjs','utf8'),'real-source');});"; if(resources.includes('asset.bin')) return "import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';test('actual retained binary and source',()=>{assert.deepEqual([...readFileSync('asset.bin')],[255,0,128]);assert.equal(readFileSync('src.mjs','utf8'),'real-source');});"; if (resources.includes('image.bin')) return "import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';test('actual deletion and binary',()=>{assert.equal(existsSync('file0.txt'),false);assert.deepEqual([...readFileSync('image.bin')],[255,0,126]);});"; return "import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';test('actual declared target content',()=>{for(const resource of " + JSON.stringify(resources) + ")assert.ok(readFileSync(resource,'utf8').trim().length>0);});"; }

function acceptanceSource(host) { if (host.repairFlow) return "import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';test('actual customer requirement',()=>assert.equal(readFileSync('file0.txt','utf8'),'good'));"; return validationSource([...host.plan.tasks.flatMap(item=>item.writeSet),...(host.plan.tasks.some(item=>item.generatedEffects?.includes('dist/'))?['dist/output.txt']:[])]); }
function acceptanceIssues(host, result) { if (result.status === 'passed') return []; return [{ taskId: 'task0', resource: 'file0.txt', expected: 'good', actual: result.status, reproduction: 'legion_run_check unit-zz-acceptance' }]; }
function testDependencyResources(tasks, task, seen = new Set()) { const resources=[]; for(const id of task.dependsOn){if(seen.has(id))continue;seen.add(id);const dependency=tasks.find(item=>item.id===id);resources.push(...dependency.writeSet,...testDependencyResources(tasks,dependency,seen));} return resources; }
for (const scenario of ['delete-binary', 'install-build']) test('actual SDK/native Shell publication ' + scenario + ' preserves current scope and continues original requester', async () => {
  let candidate, planned = false, count = 0, first = null, second = null;
  const local = await server((record, reply) => {
    if (++count > 32) { reply.writeHead(401); reply.end('{"error":{"message":"finite_fixture_request_bound"}}'); return; }
    const results = typedResults(record.body), tools = JSON.stringify(record.body.tools);
    if (tools.includes('legion_review_shell')) { const data = JSON.parse(strings(record.body).find((text) => text.startsWith('你是当前ProjectManager，审查')).split('真实请求及原角色任务：')[1]); if (results.some((pair) => pair.result.tool === 'legion_review_shell')) completion(reply,protocol(record),'审核本次请求结束'); else completion(reply,protocol(record),'每条独立审核',{requestId:data.request.requestId,requestDigest:data.requestDigest,revision:1,approved:true,reason:'精确源码owner和Human计划产物范围符合'},'legion_review_shell','review-'+count);return; }
    if (!taskMetadata(record.body)) { assert.equal(planned,false);planned=true;completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');return; }
    const shells = results.filter((pair) => pair.result.requestDigest);
    if (shells.some((pair) => pair.result.status !== 'published')) { console.log('publication-failure:'+JSON.stringify(shells.map(pair=>({status:pair.result.status,reason:pair.result.reason,stderr:pair.result.stderr})))); completion(reply,protocol(record),'按真实失败结束，不重复命令');return; }
    if (!shells.length) {
      const command = scenario === 'delete-binary' ? "rm file0.txt && printf '\\377\\000\\176' > image.bin" : 'npm install --offline --install-links --no-save --package-lock=false --audit=false --fund=false ./fixture-pkg && printf installed-owner > file0.txt';
      completion(reply,protocol(record),'',{command,reason:'只变更已确认源码及本条批准产物',generatedEffects:scenario==='install-build'?['node_modules/']:[],network:'none',timeoutSeconds:30},'legion_request_shell','shell-first');return;
    }
    first = shells[0];
    if (scenario === 'install-build' && shells.length === 1) { completion(reply,protocol(record),'',{command:'node_modules/.bin/localbuilder',reason:'读取既有依赖，只生成dist',generatedEffects:['dist/'],network:'none',timeoutSeconds:30},'legion_request_shell','shell-build');return; }
    second = shells[1] ?? null;
    if (!results.some((pair)=>pair.result.checkId)) completion(reply,protocol(record),'',{checkId:'unit-task0'},'legion_run_check','actual-check'); else completion(reply,protocol(record),'依据实际发布与检查结果完成');
  });
  const setup=await fixture(local);candidate=proposal([setup.ids[0]]);
  if(scenario==='delete-binary'){candidate.tasks[0].writeSet=['file0.txt','image.bin'];await writeFile(join(setup.root,'file0.txt'),'approved old bytes');}
  else { candidate.tasks[0].generatedEffects=['node_modules/','dist/'];candidate.tasks[0].artifactScopes=[{scope:'node_modules/',kind:'dependencies'},{scope:'dist/',kind:'build'}];await mkdir(join(setup.root,'fixture-pkg'));await writeFile(join(setup.root,'fixture-pkg/package.json'),JSON.stringify({name:'handwell-offline-builder',version:'1.0.0',bin:{localbuilder:'build.cjs'}}));await writeFile(join(setup.root,'fixture-pkg/build.cjs'),"#!/usr/bin/env node\nconst fs=require('fs');fs.mkdirSync('dist',{recursive:true});fs.writeFileSync('dist/output.txt','actual-build');console.log('actual build output');"); }
  try {
    await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'完整Human要求：每条项目Shell都由PM审核，删除/二进制/产物仍按owner与当前baseline发布'});const draft=await until(setup.pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed');await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest});const done=await until(setup.pipeline,state=>['completed','failed','invalidated'].includes(state.plan?.status));assert.equal(done.plan.status,'completed',JSON.stringify({tasks:done.tasks,shell:done.shellRequests,error:done.error}));assert.equal(first.result.status,'published');assert.ok(done.tasks.every(task=>task.checkStatus==='passed'));assert.equal(done.acceptances.at(-1).decision,'pass');
    if(scenario==='delete-binary'){assert.equal(first.result.publishedResources.find(item=>item.resource==='file0.txt').missing,true);assert.equal(done.fileOwners.ownerOf('file0.txt'),'Worker0');const deletion=done.tasks[0].results.find(result=>result.action==='delete_file');assert.equal(deletion.status,'deleted');assert.equal(deletion.tombstone.priorSha256,createHash('sha256').update('approved old bytes').digest('hex'));assert.deepEqual([...await readFile(join(setup.root,'image.bin'))],[255,0,126]);assert.equal(JSON.stringify(local.calls).includes('contentBase64'),false);assert.ok((await privateOrganization(setup)).evidence[0].result.inputVersions.some(input=>input.resource==='file0.txt'&&input.state==='absent'));}
    else {assert.equal(second.result.status,'published');assert.deepEqual(second.result.generatedEffects,['dist/']);assert.equal(second.result.publishedResources.some(item=>item.resource.startsWith('node_modules')),false);assert.equal(await readFile(join(setup.root,'dist/output.txt'),'utf8'),'actual-build');assert.equal(done.shellRequests.length,2);assert.ok(done.shellRequests.every(entry=>entry.review?.approved));}
  } finally {await setup.pipeline.close();await local.close();}
});
test('actual source partial persists across restart; fresh Human plan and current baseline restore through new PM/Shell grant and real checks', async () => {
  let candidate, planned = false, count = 0, recovering = false, injected = false, final = null;
  const local = await server((record, reply) => {
    if(++count>40){reply.writeHead(401);reply.end('{"error":{"message":"finite_fixture_request_bound"}}');return;}
    const results=typedResults(record.body), tools=JSON.stringify(record.body.tools);
    if(tools.includes('legion_review_shell')){const data=JSON.parse(strings(record.body).find(text=>text.startsWith('你是当前ProjectManager，审查')).split('真实请求及原角色任务：')[1]); if(results.some(pair=>pair.result.tool==='legion_review_shell'))completion(reply,protocol(record),'审核结束');else completion(reply,protocol(record),'依据本轮新基线批准',{requestId:data.request.requestId,requestDigest:data.requestDigest,revision:1,approved:true,reason:'仅本轮owner精确文件'},'legion_review_shell','review-'+count);return;}
    if(!taskMetadata(record.body)){assert.equal(planned,false);planned=true;completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');return;}
    const shell=results.find(pair=>pair.result.requestDigest);if(!shell){completion(reply,protocol(record),'',{command:recovering?'printf recovered-a > file0.txt && printf recovered-b > file1.txt':'printf partial-a > file0.txt && printf partial-b > file1.txt',reason:recovering?'Human重新确认当前基线恢复计划':'实际两文件受控发布',generatedEffects:[],network:'none',timeoutSeconds:30},'legion_request_shell','shell-'+count);return;}
    final=shell;if(shell.result.status!=='published'){completion(reply,protocol(record),'按真实部分发布暂停，不重跑许可');return;}if(!results.some(pair=>pair.result.checkId))completion(reply,protocol(record),'',{checkId:'unit-task0'},'legion_run_check','check-'+count);else completion(reply,protocol(record),'依据当前真实发布和检查完成恢复');
  });const setup=await fixture(local);candidate=proposal([setup.ids[0]]);candidate.tasks[0].writeSet=['file0.txt','file1.txt'];
  const actual=createOrganizationService({userDataDir:setup.data});const service=Object.freeze(Object.fromEntries(Object.entries(actual).map(([name,method])=>[name,name==='shellPhase'?async(project,id,patch,actor,signal)=>{if(!injected&&patch.publication?.results.length===1){injected=true;const lock=join(setup.data,'workbench-organization',project.id+'.json.lock');await mkdir(lock);try{return await method(project,id,patch,actor,signal);}finally{await rmdir(lock);}}return method(project,id,patch,actor,signal);}:method])));
  await setup.pipeline.close();let pipeline=new WorkbenchPipelineImpl({userDataDir:setup.data, leaseRoot:join(setup.data,'..','isolated-project-leases')},{profiles:setup.reopenProfiles(),organizations:service});await pipeline.selectProject(setup.root);
  try{
    await pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'两文件发布必须真实记录，故障暂停，不重放旧批准'});let draft=await until(pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed');let request=draft.interactions.find(item=>item.purpose==='execute_plan'&&item.status==='pending');assert.equal((await pipeline.answerInteraction({projectId:setup.projectId,requestId:request.requestId,version:request.version,requestDigest:request.digest,value:true})).ok,true);const partial=await until(pipeline,state=>state.plan?.status==='invalidated');assert.equal(injected,true);assert.equal(partial.shellRequests[0].result.status,'partial_published');assert.equal(await readFile(join(setup.root,'file0.txt'),'utf8'),'partial-a');await assert.rejects(readFile(join(setup.root,'file1.txt')),{code:'ENOENT'});const oldDigest=partial.plan.planDigest,oldRequest=partial.shellRequests[0].id;await pipeline.close();
    pipeline=new WorkbenchPipelineImpl({userDataDir:setup.data, leaseRoot:join(setup.data,'..','isolated-project-leases')},{profiles:setup.reopenProfiles()});const restarted=await pipeline.selectProject(setup.root);assert.equal(restarted.value.shellRequests[0].result.status,'partial_published');assert.equal((await pipeline.confirmPlan({projectId:setup.projectId,planDigest:oldDigest})).ok,false);
    recovering=true;planned=false;local.host.finalText.clear();await pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'Human明确新恢复计划：保留原owner，依据当前partial-a/缺失基线重新发布file0和file1，再自测及独立验收。旧命令不重放。'});draft=await until(pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed'&&state.plan.planDigest!==oldDigest);request=draft.interactions.find(item=>item.purpose==='execute_plan'&&item.status==='pending');assert.match(request.text,/当前基线/u);assert.match(request.text,/file0.txt.*SHA [a-f0-9]{64}/u);assert.match(request.text,/file1.txt.*absent/u);assert.equal((await pipeline.answerInteraction({projectId:setup.projectId,requestId:request.requestId,version:request.version,requestDigest:request.digest,value:true})).ok,true);const restored=await until(pipeline,state=>['completed','failed','invalidated'].includes(state.plan?.status));assert.equal(restored.plan.status,'completed',JSON.stringify({tasks:restored.tasks,shell:restored.shellRequests,error:restored.error}));const history=(await privateOrganization(setup)).shellWorkflow.requests.find(item=>item.id===oldRequest);assert.equal(history.status,'recovered');assert.equal(history.result.status,'partial_published');assert.equal(history.recovery.planDigest,restored.plan.planDigest);assert.equal(final.result.status,'published');assert.equal(restored.shellRequests.length,2);assert.equal(await readFile(join(setup.root,'file0.txt'),'utf8'),'recovered-a');assert.equal(await readFile(join(setup.root,'file1.txt'),'utf8'),'recovered-b');assert.ok(restored.tasks.every(task=>task.checkStatus==='passed'));assert.equal(restored.acceptances.at(-1).decision,'pass');
  }finally{await pipeline.close();await local.close();}
});

test('actual generated-only partial persists across restart; fresh Human plan and current baseline restore through new PM/Shell grant and real checks', async () => {
  let candidate, planned = false, count = 0, recovering = false, injected = false, final = null;
  const local = await server((record, reply) => {
    if(++count>40){reply.writeHead(401);reply.end('{"error":{"message":"finite_fixture_request_bound"}}');return;}
    const results=typedResults(record.body), tools=JSON.stringify(record.body.tools);
    if(tools.includes('legion_review_shell')){const data=JSON.parse(strings(record.body).find(text=>text.startsWith('你是当前ProjectManager，审查')).split('真实请求及原角色任务：')[1]); if(results.some(pair=>pair.result.tool==='legion_review_shell'))completion(reply,protocol(record),'审核结束');else completion(reply,protocol(record),'依据本轮新基线批准',{requestId:data.request.requestId,requestDigest:data.requestDigest,revision:1,approved:true,reason:'仅本轮owner精确文件'},'legion_review_shell','review-'+count);return;}
    if(!taskMetadata(record.body)){assert.equal(planned,false);planned=true;completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');return;}
    const shell=results.find(pair=>pair.result.requestDigest);if(!shell){completion(reply,protocol(record),'',{command:recovering?'mkdir -p dist && printf restored-generation > dist/output.txt':'mkdir -p dist && printf partial-generation > dist/output.txt',reason:recovering?'Human重新确认当前基线恢复计划':'实际生成产物受控发布',generatedEffects:['dist/'],network:'none',timeoutSeconds:30},'legion_request_shell','shell-'+count);return;}
    final=shell;if(shell.result.status!=='published'){completion(reply,protocol(record),'按真实部分发布暂停，不重跑许可');return;}if(!results.some(pair=>pair.result.checkId))completion(reply,protocol(record),'',{checkId:'unit-task0'},'legion_run_check','check-'+count);else completion(reply,protocol(record),'依据当前真实发布和检查完成恢复');
  });const setup=await fixture(local);candidate=proposal([setup.ids[0]]);candidate.tasks[0].writeSet=[];candidate.tasks[0].checks=[checkSpec('task0',['dist/output.txt'])];candidate.tasks[0].generatedEffects=['dist/'];candidate.tasks[0].artifactScopes=[{scope:'dist/',kind:'build'}];
  const actual=createOrganizationService({userDataDir:setup.data});const service=Object.freeze(Object.fromEntries(Object.entries(actual).map(([name,method])=>[name,name==='shellPhase'?async(project,id,patch,actor,signal)=>{if(!injected&&patch.status==='published'&&patch.publication?.artifactSnapshots?.some(pin=>pin.scope==='dist/')){injected=true;const lock=join(setup.data,'workbench-organization',project.id+'.json.lock');await mkdir(lock);try{return await method(project,id,patch,actor,signal);}finally{await rmdir(lock);}}return method(project,id,patch,actor,signal);}:method])));
  await setup.pipeline.close();let pipeline=new WorkbenchPipelineImpl({userDataDir:setup.data, leaseRoot:join(setup.data,'..','isolated-project-leases')},{profiles:setup.reopenProfiles(),organizations:service});await pipeline.selectProject(setup.root);
  try{
    await pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'仅生成dist产物，必须真实发布记录；故障暂停，不重放旧批准'});let draft=await until(pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed');let request=draft.interactions.find(item=>item.purpose==='execute_plan'&&item.status==='pending');assert.equal((await pipeline.answerInteraction({projectId:setup.projectId,requestId:request.requestId,version:request.version,requestDigest:request.digest,value:true})).ok,true);const partial=await until(pipeline,state=>state.plan?.status==='invalidated');assert.equal(injected,true);assert.equal(partial.shellRequests[0].result.status,'partial_published');assert.equal(await readFile(join(setup.root,'dist/output.txt'),'utf8'),'partial-generation');assert.equal((await privateOrganization(setup)).shellWorkflow.requests.find(item=>item.id===partial.shellRequests[0].id).result.candidates.length,0);assert.equal((await privateOrganization(setup)).shellWorkflow.requests.find(item=>item.id===partial.shellRequests[0].id).result.publishedResources[0].action,'generated');const oldDigest=partial.plan.planDigest,oldRequest=partial.shellRequests[0].id;await pipeline.close();
    pipeline=new WorkbenchPipelineImpl({userDataDir:setup.data, leaseRoot:join(setup.data,'..','isolated-project-leases')},{profiles:setup.reopenProfiles()});const restarted=await pipeline.selectProject(setup.root);assert.equal(restarted.value.shellRequests[0].result.status,'partial_published');assert.equal((await pipeline.confirmPlan({projectId:setup.projectId,planDigest:oldDigest})).ok,false);
    recovering=true;planned=false;local.host.finalText.clear();await pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'Human明确新恢复计划：仅生成dist/，依当前真实产物重新构建并自测及独立验收；旧命令不重放。'});draft=await until(pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed'&&state.plan.planDigest!==oldDigest);request=draft.interactions.find(item=>item.purpose==='execute_plan'&&item.status==='pending');assert.deepEqual(draft.plan.tasks[0].generatedEffects,['dist/']);assert.equal((await pipeline.answerInteraction({projectId:setup.projectId,requestId:request.requestId,version:request.version,requestDigest:request.digest,value:true})).ok,true);const restored=await until(pipeline,state=>['completed','failed','invalidated'].includes(state.plan?.status));assert.equal(restored.plan.status,'completed',JSON.stringify({tasks:restored.tasks,shell:restored.shellRequests,error:restored.error}));const history=(await privateOrganization(setup)).shellWorkflow.requests.find(item=>item.id===oldRequest);assert.equal(history.status,'recovered');assert.equal(history.result.status,'partial_published');assert.equal(history.recovery.planDigest,restored.plan.planDigest);assert.equal(final.result.status,'published');assert.equal(restored.shellRequests.length,2);assert.equal(await readFile(join(setup.root,'dist/output.txt'),'utf8'),'restored-generation');assert.ok(restored.tasks.every(task=>task.checkStatus==='passed'));assert.equal(restored.acceptances.at(-1).decision,'pass');
  }finally{await pipeline.close();await local.close();}
});

for (const retainedMode of ['same','changed-sha','changed-mode','missing-provenance']) test('actual unchanged binary recovery ' + retainedMode + ';  fresh Human plan and current baseline restore through new PM/Shell grant and real checks', async () => {
  let candidate, planned = false, count = 0, recovering = false, injected = false, final = null;
  const local = await server((record, reply) => {
    if(++count>40){reply.writeHead(401);reply.end('{"error":{"message":"finite_fixture_request_bound"}}');return;}
    const results=typedResults(record.body), tools=JSON.stringify(record.body.tools);
    if(tools.includes('legion_review_shell')){const data=JSON.parse(strings(record.body).find(text=>text.startsWith('你是当前ProjectManager，审查')).split('真实请求及原角色任务：')[1]); if(results.some(pair=>pair.result.tool==='legion_review_shell'))completion(reply,protocol(record),'审核结束');else completion(reply,protocol(record),'依据本轮新基线批准',{requestId:data.request.requestId,requestDigest:data.requestDigest,revision:1,approved:true,reason:'仅本轮owner精确文件'},'legion_review_shell','review-'+count);return;}
    if(!taskMetadata(record.body)){assert.equal(planned,false);planned=true;completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');return;}
    const shell=results.find(pair=>pair.result.requestDigest);if(!shell){completion(reply,protocol(record),'',{command:"printf '\\377\\000\\200' > asset.bin && chmod 600 asset.bin && printf real-source > src.mjs",reason:recovering?'Human重新确认当前基线恢复计划':'实际两文件受控发布',generatedEffects:[],network:'none',timeoutSeconds:30},'legion_request_shell','shell-'+count);return;}
    final=shell;if(shell.result.status!=='published'){completion(reply,protocol(record),'按真实部分发布暂停，不重跑许可');return;}if(!results.some(pair=>pair.result.checkId))completion(reply,protocol(record),'',{checkId:'unit-task0'},'legion_run_check','check-'+count);else completion(reply,protocol(record),'依据当前真实发布和检查完成恢复');
  });const setup=await fixture(local);candidate=proposal([setup.ids[0]]);candidate.tasks[0].writeSet=['asset.bin','src.mjs'];
  const actual=createOrganizationService({userDataDir:setup.data});const service=Object.freeze(Object.fromEntries(Object.entries(actual).map(([name,method])=>[name,name==='shellPhase'?async(project,id,patch,actor,signal)=>{if(!injected&&patch.publication?.results.length===1){injected=true;const lock=join(setup.data,'workbench-organization',project.id+'.json.lock');await mkdir(lock);try{return await method(project,id,patch,actor,signal);}finally{await rmdir(lock);}}return method(project,id,patch,actor,signal);}:method])));
  await setup.pipeline.close();let pipeline=new WorkbenchPipelineImpl({userDataDir:setup.data, leaseRoot:join(setup.data,'..','isolated-project-leases')},{profiles:setup.reopenProfiles(),organizations:service});await pipeline.selectProject(setup.root);
  try{
    await pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'两文件发布必须真实记录，故障暂停，不重放旧批准'});let draft=await until(pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed');let request=draft.interactions.find(item=>item.purpose==='execute_plan'&&item.status==='pending');assert.equal((await pipeline.answerInteraction({projectId:setup.projectId,requestId:request.requestId,version:request.version,requestDigest:request.digest,value:true})).ok,true);const partial=await until(pipeline,state=>state.plan?.status==='invalidated');assert.equal(injected,true);assert.equal(partial.shellRequests[0].result.status,'partial_published');assert.deepEqual([...await readFile(join(setup.root,'asset.bin'))],[255,0,128]);await assert.rejects(readFile(join(setup.root,'src.mjs')),{code:'ENOENT'});const oldDigest=partial.plan.planDigest,oldRequest=partial.shellRequests[0].id, oldResult=structuredClone((await privateOrganization(setup)).shellWorkflow.requests.find(item=>item.id===oldRequest).result); const originalAsset=await stat(join(setup.root,'asset.bin')); await pipeline.close();
    if(retainedMode==='changed-sha')await writeFile(join(setup.root,'asset.bin'),Buffer.from([255,0,129]));if(retainedMode==='changed-mode')await chmod(join(setup.root,'asset.bin'),0o700);if(retainedMode==='missing-provenance'){const path=join(setup.data,'workbench-organization',setup.projectId+'.json');const raw=JSON.parse(await readFile(path,'utf8'));raw.shellWorkflow=shellWorkflowDocument({...raw.shellWorkflow,requests:raw.shellWorkflow.requests.map(entry=>entry.id===oldRequest?{...entry,publication:{...entry.publication,results:[]}}:entry),digest:undefined});delete raw.digest;raw.digest=digestValue(raw);await writeFile(path,JSON.stringify(raw));}pipeline=new WorkbenchPipelineImpl({userDataDir:setup.data, leaseRoot:join(setup.data,'..','isolated-project-leases')},{profiles:setup.reopenProfiles()});const restarted=await pipeline.selectProject(setup.root);assert.equal(restarted.value.shellRequests[0].result.status,'partial_published');assert.equal((await pipeline.confirmPlan({projectId:setup.projectId,planDigest:oldDigest})).ok,false);
    recovering=true;planned=false;local.host.finalText.clear();await pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'Human明确新恢复计划：保留原owner，依据当前partial-a/缺失基线重新发布file0和file1，再自测及独立验收。旧命令不重放。'});draft=await until(pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed'&&state.plan.planDigest!==oldDigest);request=draft.interactions.find(item=>item.purpose==='execute_plan'&&item.status==='pending');assert.match(request.text,/当前基线/u);assert.match(request.text,/asset.bin.*SHA [a-f0-9]{64}/u);assert.match(request.text,/src.mjs.*absent/u);if(retainedMode==='same')assert.match(request.text,/将核验保留[\s\S]*asset.bin/u);else assert.equal(request.text.includes('将核验保留'),false);assert.equal((await pipeline.answerInteraction({projectId:setup.projectId,requestId:request.requestId,version:request.version,requestDigest:request.digest,value:true})).ok,true);const restored=await until(pipeline,state=>['completed','failed','invalidated'].includes(state.plan?.status));if(retainedMode==='missing-provenance'){assert.equal(restored.plan.status,'failed');assert.equal(restored.error.code,'shell_recovery_version_changed');assert.deepEqual(restored.tasks[0].retainedOutputs,[]);assert.equal(restored.tasks[0].results.some(result=>result.resource==='asset.bin'),false);return;}assert.equal(restored.plan.status,'completed',JSON.stringify({tasks:restored.tasks,shell:restored.shellRequests,error:restored.error}));const history=(await privateOrganization(setup)).shellWorkflow.requests.find(item=>item.id===oldRequest);assert.equal(history.status,'recovered');assert.equal(history.result.status,'partial_published');assert.equal(history.recovery.planDigest,restored.plan.planDigest);assert.equal(final.result.status,'published');assert.equal(restored.shellRequests.length,2);assert.deepEqual([...await readFile(join(setup.root,'asset.bin'))],[255,0,128]);assert.equal(await readFile(join(setup.root,'src.mjs'),'utf8'),'real-source');assert.deepEqual(JSON.parse(JSON.stringify(history.result)),oldResult);if(retainedMode==='same'){assert.equal(restored.tasks[0].retainedOutputs.length,1);assert.equal(restored.tasks[0].retainedOutputs[0].kind,'recovery_verified_retained');assert.equal(restored.tasks[0].retainedOutputs[0].resource,'asset.bin');assert.deepEqual(history.recovery.retainedOutputs,JSON.parse(JSON.stringify(restored.tasks[0].retainedOutputs)));assert.equal(restored.tasks[0].results.some(result=>result.resource==='asset.bin'),false);assert.equal(final.result.candidates.some(candidate=>candidate.resource==='asset.bin'),false);assert.equal((await stat(join(setup.root,'asset.bin'))).ino,originalAsset.ino);}else{assert.deepEqual(restored.tasks[0].retainedOutputs,[]);assert.equal(restored.tasks[0].results.some(result=>result.resource==='asset.bin'&&result.observedMutation),true);}assert.ok(restored.tasks.every(task=>task.checkStatus==='passed'));assert.equal(restored.acceptances.at(-1).decision,'pass');
  }finally{await pipeline.close();await local.close();}
});


for (const retainedMode of ['same']) test('actual retained deletion handoff ' + retainedMode + ';  fresh Human plan and current baseline restore through new PM/Shell grant and real checks', async () => {
  let candidate, planned = false, count = 0, recovering = false, injected = false, final = null;
  const local = await server((record, reply) => {
    if(++count>40){reply.writeHead(401);reply.end('{"error":{"message":"finite_fixture_request_bound"}}');return;}
    const results=typedResults(record.body), tools=JSON.stringify(record.body.tools);
    if(tools.includes('legion_review_shell')){const data=JSON.parse(strings(record.body).find(text=>text.startsWith('你是当前ProjectManager，审查')).split('真实请求及原角色任务：')[1]); if(results.some(pair=>pair.result.tool==='legion_review_shell'))completion(reply,protocol(record),'审核结束');else completion(reply,protocol(record),'依据本轮新基线批准',{requestId:data.request.requestId,requestDigest:data.requestDigest,revision:1,approved:true,reason:'仅本轮owner精确文件'},'legion_review_shell','review-'+count);return;}
    if(!taskMetadata(record.body)){assert.equal(planned,false);planned=true;completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');return;}
    const shell=results.find(pair=>pair.result.requestDigest);if(!shell){completion(reply,protocol(record),'',{command:"if [ -e gone.bin ]; then rm gone.bin; fi; printf real-source > src.mjs",reason:recovering?'Human重新确认当前基线恢复计划':'实际两文件受控发布',generatedEffects:[],network:'none',timeoutSeconds:30},'legion_request_shell','shell-'+count);return;}
    final=shell;if(shell.result.status!=='published'){completion(reply,protocol(record),'按真实部分发布暂停，不重跑许可');return;}if(!results.some(pair=>pair.result.checkId))completion(reply,protocol(record),'',{checkId:'unit-task0'},'legion_run_check','check-'+count);else completion(reply,protocol(record),'依据当前真实发布和检查完成恢复');
  });const setup=await fixture(local);candidate=proposal([setup.ids[0]]);candidate.tasks[0].writeSet=['gone.bin','src.mjs'];await writeFile(join(setup.root,'gone.bin'),Buffer.from([255,0,128]));
  const actual=createOrganizationService({userDataDir:setup.data});const service=Object.freeze(Object.fromEntries(Object.entries(actual).map(([name,method])=>[name,name==='shellPhase'?async(project,id,patch,actor,signal)=>{if(!injected&&patch.publication?.results.length===1){injected=true;const lock=join(setup.data,'workbench-organization',project.id+'.json.lock');await mkdir(lock);try{return await method(project,id,patch,actor,signal);}finally{await rmdir(lock);}}return method(project,id,patch,actor,signal);}:method])));
  await setup.pipeline.close();let pipeline=new WorkbenchPipelineImpl({userDataDir:setup.data, leaseRoot:join(setup.data,'..','isolated-project-leases')},{profiles:setup.reopenProfiles(),organizations:service});await pipeline.selectProject(setup.root);
  try{
    await pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'两文件发布必须真实记录，故障暂停，不重放旧批准'});let draft=await until(pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed');let request=draft.interactions.find(item=>item.purpose==='execute_plan'&&item.status==='pending');assert.equal((await pipeline.answerInteraction({projectId:setup.projectId,requestId:request.requestId,version:request.version,requestDigest:request.digest,value:true})).ok,true);const partial=await until(pipeline,state=>state.plan?.status==='invalidated');assert.equal(injected,true);assert.equal(partial.shellRequests[0].result.status,'partial_published');await assert.rejects(readFile(join(setup.root,'gone.bin')),{code:'ENOENT'});await assert.rejects(readFile(join(setup.root,'src.mjs')),{code:'ENOENT'});const oldDigest=partial.plan.planDigest,oldRequest=partial.shellRequests[0].id, oldResult=structuredClone((await privateOrganization(setup)).shellWorkflow.requests.find(item=>item.id===oldRequest).result); const originalAsset=null; await pipeline.close();
    if(retainedMode==='changed-sha')await writeFile(join(setup.root,'asset.bin'),Buffer.from([255,0,129]));if(retainedMode==='changed-mode')await chmod(join(setup.root,'asset.bin'),0o700);if(retainedMode==='missing-provenance'){const path=join(setup.data,'workbench-organization',setup.projectId+'.json');const raw=JSON.parse(await readFile(path,'utf8'));raw.shellWorkflow=shellWorkflowDocument({...raw.shellWorkflow,requests:raw.shellWorkflow.requests.map(entry=>entry.id===oldRequest?{...entry,publication:{...entry.publication,results:[]}}:entry),digest:undefined});delete raw.digest;raw.digest=digestValue(raw);await writeFile(path,JSON.stringify(raw));}pipeline=new WorkbenchPipelineImpl({userDataDir:setup.data, leaseRoot:join(setup.data,'..','isolated-project-leases')},{profiles:setup.reopenProfiles()});const restarted=await pipeline.selectProject(setup.root);assert.equal(restarted.value.shellRequests[0].result.status,'partial_published');assert.equal((await pipeline.confirmPlan({projectId:setup.projectId,planDigest:oldDigest})).ok,false);
    recovering=true;planned=false;local.host.finalText.clear();await pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'Human明确新恢复计划：保留原owner，依据当前partial-a/缺失基线重新发布file0和file1，再自测及独立验收。旧命令不重放。'});draft=await until(pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed'&&state.plan.planDigest!==oldDigest);request=draft.interactions.find(item=>item.purpose==='execute_plan'&&item.status==='pending');assert.match(request.text,/当前基线/u);assert.match(request.text,/gone.bin.*absent/u);assert.match(request.text,/src.mjs.*absent/u);if(retainedMode==='same')assert.match(request.text,/将核验保留[\s\S]*gone.bin/u);else assert.equal(request.text.includes('将核验保留'),false);assert.equal((await pipeline.answerInteraction({projectId:setup.projectId,requestId:request.requestId,version:request.version,requestDigest:request.digest,value:true})).ok,true);const restored=await until(pipeline,state=>['completed','failed','invalidated'].includes(state.plan?.status));if(retainedMode==='missing-provenance'){assert.equal(restored.plan.status,'failed');assert.equal(restored.error.code,'shell_recovery_version_changed');assert.deepEqual(restored.tasks[0].retainedOutputs,[]);assert.equal(restored.tasks[0].results.some(result=>result.resource==='gone.bin'),false);return;}assert.equal(restored.plan.status,'completed',JSON.stringify({tasks:restored.tasks,shell:restored.shellRequests,error:restored.error}));const history=(await privateOrganization(setup)).shellWorkflow.requests.find(item=>item.id===oldRequest);assert.equal(history.status,'recovered');assert.equal(history.result.status,'partial_published');assert.equal(history.recovery.planDigest,restored.plan.planDigest);assert.equal(final.result.status,'published');assert.equal(restored.shellRequests.length,2);await assert.rejects(readFile(join(setup.root,'gone.bin')),{code:'ENOENT'});assert.equal(await readFile(join(setup.root,'src.mjs'),'utf8'),'real-source');assert.deepEqual(JSON.parse(JSON.stringify(history.result)),oldResult);if(retainedMode==='same'){assert.equal(restored.tasks[0].retainedOutputs.length,1);assert.equal(restored.tasks[0].retainedOutputs[0].kind,'recovery_verified_retained');assert.equal(restored.tasks[0].retainedOutputs[0].resource,'gone.bin');assert.equal(restored.tasks[0].retainedOutputs[0].baseline.state,'absent');assert.equal(restored.tasks[0].retainedOutputs[0].tombstone.priorSha256,createHash('sha256').update(Buffer.from([255,0,128])).digest('hex'));assert.deepEqual(history.recovery.retainedOutputs,JSON.parse(JSON.stringify(restored.tasks[0].retainedOutputs)));assert.equal(restored.tasks[0].results.some(result=>result.resource==='gone.bin'),false);assert.equal(final.result.candidates.some(candidate=>candidate.resource==='gone.bin'),false);assert.ok((await privateOrganization(setup)).evidence.some(entry=>entry.result.inputVersions.some(input=>input.resource==='gone.bin'&&input.state==='absent'&&input.sha256===null)));const {dependencyOutputMetadata}=await import('../../src/models/workbench.mjs');const fact=restored.tasks[0].retainedOutputs[0];const [handoff]=dependencyOutputMetadata([{resource:fact.resource,taskId:'task0',roleId:'Worker0',action:'retain_file',contentDigest:null,byteLength:0,state:'absent',missing:true,tombstone:fact.tombstone,retainedSourceRequestId:fact.sourceRequestId,retainedSourceProposalDigest:fact.sourceProposalDigest}]);assert.equal(handoff.state,'absent');assert.equal(handoff.missing,true);assert.equal(handoff.contentDigest,null);assert.deepEqual(handoff.tombstone,fact.tombstone);assert.equal(handoff.action,'retain_file');}else{assert.deepEqual(restored.tasks[0].retainedOutputs,[]);assert.equal(restored.tasks[0].results.some(result=>result.resource==='gone.bin'&&result.observedMutation),true);}assert.ok(restored.tasks.every(task=>task.checkStatus==='passed'));assert.equal(restored.acceptances.at(-1).decision,'pass');
  }finally{await pipeline.close();await local.close();}
});


function createProjectService(options){return realCreateProjectService({...options,leaseRoot:join(leaseParent(options.userDataDir),'isolated-project-leases')});}

function runtimePlan(plan){return {...plan,schemaVersion:2,tasks:plan.tasks.map(({writeSet,...task})=>({...task,intent:task.intent??'change'}))};}
