import { createEnvironmentProfilesService } from '../../src/services/public/environment_profiles.mjs';
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
  createWorkbenchPipeline,
  createHeadlessWorkbenchPipeline
} from '../../src/pipelines/workbench.mjs';
import { createProjectService as realCreateProjectService } from '../../src/services/public/project.mjs';
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
      console.error('workbench-fixture-error:'+JSON.stringify({name:error.name==='AssertionError'?'AssertionError':'Error',code:/^[a-zA-Z0-9_]+$/.test(error.code??'')?error.code:null,location:String(error.stack??'').match(/[A-Za-z_-]+\.mjs:[0-9]+:[0-9]+/u)?.[0]??null}));reply.destroy(error);
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
  let profiles = new ProfilesServiceImpl({
    userDataDir: data
  }, {
    settings,
    probe: createProbeProvider({
      timeoutMs: 1000
    })
  });
  const ids = [];
  if(local.host.knownKey){
    ids.push('environment','environment','environment');
  }else for (const [index, protocol] of ['openai-completions', 'openai-responses', 'anthropic-messages'].entries()) {
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
  } const pipeline = local.host.knownKey ? {...createHeadlessWorkbenchPipeline({userDataDir:data,leaseRoot:join(data,'..','isolated-project-leases'),profile:{protocol:'openai-completions',provider:'local',modelId:'local',baseUrl:local.url+'/p0',env:{LEGION_API_KEY:local.host.knownKey}}})} : new WorkbenchPipelineImpl({
    userDataDir: data, leaseRoot:join(data,'..','isolated-project-leases')
  }, {
    profiles, organizations:local.host.organizationFactory?.(data), environmentProfileId:local.host.knownKey?'environment':null
  });
  let selected;
  try { selected = await pipeline.selectProject(root); assert.equal(selected.ok, true,JSON.stringify(selected)); }
  catch(error) { await pipeline.close(); await local.close(); throw error; }
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
  for (let index = 0; index < 200; index += 1) {
    const state = await pipeline.getState();
    assert.equal(state.ok, true);
    if (predicate(state.value)) return state.value;
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
} test('actual SDK: first Human message creates PM, two rounds read-only tools; three profile protocols execute confirmed dynamic DAG with real audit', async () => {
  let candidate; let discussion = 0; const local = await server((record, reply) => {
    if (isCustomerCall(record.body)) {
      discussion += 1; let text = '请确认详细需求'; if (discussion === 2) text = '方案\n```legion-plan\n' + JSON.stringify(candidate) + '\n```'; completion(reply, protocol(record), text);
    } else {
      assert.deepEqual(record.body.tools.map(tool => tool.function?.name ?? tool.name).sort(), ['legion_edit_file', 'legion_list_files', 'legion_query_memory', 'legion_read_file', 'legion_remember_fact', 'legion_request_shell', 'legion_run_check', 'legion_write_file']); if (hasResult(record.body)) completion(reply, protocol(record), '已按主机结果完成'); else completion(reply, protocol(record), '', {
        resource: desiredFile(record.body),
        content: '真实客户写入'
      });
    }
  }); const setup = await fixture(local); candidate = proposal(setup.ids); try {
    assert.equal((await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'Worker0',
      text: '开始'
    })).error.code, 'manager_only'); for (const text of ['客户首次需求', '澄清后方案']) {
      assert.equal((await setup.pipeline.sendMessage({
        projectId: setup.projectId,
        roleId: 'Supervisor',
        text
      })).ok, true); await until(setup.pipeline, (state) => state.turn?.status === 'completed' || state.turn?.status === 'failed');
    } const draft = (await setup.pipeline.getState()).value; assert.equal(draft.turn.status, 'completed', JSON.stringify({ error: draft.error, calls: local.calls.map((record) => ({tools: record.body.tools?.length, results: typedResults(record.body)})) })); assert.equal(draft.plan.status, 'draft'); assert.equal(draft.history.messages.length, 4); assert.deepEqual(draft.roles.map(role=>role.id).sort(),['Acceptance','ProjectManager','RoleArchitect','Supervisor','Worker0','Worker1','Worker2']);assert.equal(draft.roles.find(role=>role.id==='Supervisor').purpose,FIXED_ROLE_DUTIES.Supervisor); assert.deepEqual(await businessEntries(setup.root), []); assert.equal(draft.plan.profileBindings.length, 3); assert.equal(new Set(draft.plan.profileBindings.map((item) => item.profileVersion)).size, 3); assert.equal((await setup.pipeline.confirmPlan({
      projectId: setup.projectId,
      planDigest: '0'.repeat(64)
    })).error.code, 'plan_changed'); assert.equal((await setup.pipeline.confirmPlan({
      projectId: setup.projectId,
      planDigest: draft.plan.planDigest
    })).ok, true); const done = await until(setup.pipeline, (state) => ['completed', 'failed', 'invalidated'].includes(state.plan.status)); assert.equal(done.plan.status, 'completed', JSON.stringify({ tasks: done.tasks, controls: local.calls.flatMap((record) => typedResults(record.body)).filter((pair) => pair.result?.tool === 'legion_submit_acceptance') })); assert.deepEqual(done.tasks.map((task) => task.status), ['completed', 'completed', 'completed', 'completed']); for (const task of done.tasks.filter((item) => item.roleId !== 'Acceptance')) {
      assert.equal(task.checkStatus, 'passed'); assert.equal(task.results[0].observedMutation, true); assert.equal(await readFile(join(setup.root,task.results[0].resource), 'utf8'), '真实客户写入');
    } const audit = await readFile(join(setup.root, '.ans/events/index.jsonl'), 'utf8'); assert.ok(audit.includes('mutation_success')); assert.ok(audit.includes('agent_run_completed')); assert.equal(local.calls.filter((record) => !record.synthetic).length, 8); for (const record of local.calls.filter(record => !record.synthetic).slice(0, 2)) {
      assert.equal(isCustomerCall(record.body), true);
      assert.deepEqual(record.body.tools.map(tool => tool.function?.name ?? tool.name).sort(), ['legion_delegate_pm','legion_list_files','legion_query_memory','legion_query_role_activity','legion_query_role_log','legion_read_file','legion_remember_fact','legion_request_interaction']);
    } for (const record of local.calls) {
      const index = Number(/^\/p(\d)/u.exec(record.url)[1]); let credential = record.headers.authorization; if (index === 2) credential = record.headers['x-api-key']; assert.ok(credential.includes(`localhost-key-${index}`));
    } await assert.rejects(readFile(join(setup.data,'workbench-history',setup.projectId+'.json')),{code:'ENOENT'});const history = await readFile(join(setup.data,'workbench-organization',setup.projectId+'.json'),'utf8'); for (const forbidden of ['localhost-key-', 'Human明确选择的上下文', 'credentials', 'permit']) assert.equal(history.includes(forbidden), false);
  } finally {
    await setup.pipeline.close(); await local.close();
  }
});
test('same confirmed plan: changed context revokes all profile authorities, independent nodes stay blocked after old SHA restoration', async () => {
  let candidate; let setup; const waiting=[]; const local = await server(async (record, reply) => {
    if (isCustomerCall(record.body)) completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```'); else if (!hasResult(record.body)) {
      waiting.push({record,reply});
      if(waiting.length===3){
        await writeFile(join(setup.root, 'context.txt'), '变更内容');
        for(const pending of waiting)completion(pending.reply,protocol(pending.record),'',{resource:desiredFile(pending.record.body),content:'不得写入'});
      }
    } else completion(reply, protocol(record), '结束');
  }); setup = await fixture(local); candidate = proposal(setup.ids, true); await writeFile(join(setup.root, 'context.txt'), '原内容'); try {
    assert.equal((await setup.pipeline.selectContext({
      projectId: setup.projectId,
      resources: ['context.txt']
    })).ok, true); await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'Supervisor',
      text: '只参考所选文件'
    }); const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft'); assert.equal((await setup.pipeline.confirmPlan({
      projectId: setup.projectId,
      planDigest: draft.plan.planDigest
    })).ok, true); const done = await until(setup.pipeline, (state) => state.plan?.status === 'invalidated'); await writeFile(join(setup.root, 'context.txt'), '原内容'); assert.equal((await setup.pipeline.confirmPlan({
      projectId: setup.projectId,
      planDigest: draft.plan.planDigest
    })).error.code, 'plan_changed'); assert.equal(done.tasks.slice(1).every((task) => task.status === 'blocked'), true); assert.equal(local.calls.filter(record => isWorkerCall(record.body)).length, 3); assert.equal((await businessEntries(setup.root)).some((name) => /^file/u.test(name)), false);
  } finally {
    await setup.pipeline.close(); await local.close();
  }
});
test('two projects and late events: switch aborts old turn, new history isolated; restart restores text but no pending approval', async () => {
  let hang = true; const local = await server((record, reply) => {
    if (hang) {
      reply.writeHead(200, {
        'content-type': 'text/event-stream'
      }); reply.write(': wait\n\n');
    } else completion(reply, protocol(record), '第二个项目回复');
  }); const setup = await fixture(local); try {
    await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'Supervisor',
      text: '旧项目秘密需求'
    }); await until(setup.pipeline, (state) => state.turn?.status === 'running'); const next = join(setup.location, 'second'); await mkdir(next); const selected = await setup.pipeline.selectProject(next); assert.equal(selected.ok, true,JSON.stringify(selected)); const secondId = selected.value.currentProject.id; assert.notEqual(secondId, setup.projectId); assert.equal(selected.value.history.messages.length, 0); hang = false; await setup.pipeline.sendMessage({
      projectId: secondId,
      roleId: 'Supervisor',
      text: '新项目需求'
    }); const done = await until(setup.pipeline, (state) => state.turn?.status === 'completed'); assert.deepEqual(done.history.messages.map((item) => item.text), ['新项目需求', '第二个项目回复']); assert.equal(JSON.stringify(local.calls.at(-1).body).includes('旧项目秘密需求'), false); assert.equal((await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'Supervisor',
      text: '旧事件'
    })).error.code, 'project_missing'); assert.deepEqual(await businessEntries(setup.root), []); await setup.pipeline.close(); assert.equal((await setup.pipeline.close()).ok, true); const restarted = new WorkbenchPipelineImpl({
      userDataDir: setup.data, leaseRoot:join(setup.data,'..','isolated-project-leases')
    }); const state = await restarted.selectProject(next); assert.equal(state.ok, true); assert.deepEqual(state.value.history.messages, done.history.messages); assert.equal(state.value.turn, null); assert.equal((await restarted.confirmPlan({
      projectId: secondId,
      planDigest: 'a'.repeat(64)
    })).error.code, 'plan_changed'); await restarted.close();
  } finally {
    await setup.pipeline.close(); await local.close();
  }
});
test('public saveProfile encrypts repeated registered Human credential while rejecting matching metadata and ordinary Human text', async () => {
  const key = randomBytes(24).toString('hex');
  const local = await server((record, reply) => completion(reply, protocol(record), '合法回复'));
  const setup = await fixture(local);
  try {
    const first = (await setup.profiles.list()).value.profiles.find((item) => item.id === setup.ids[0]);
    const { hasSavedKey, ...fields } = first;
    const input = { ...fields, keyAction: 'replace', apiKey: key };
    assert.equal((await setup.pipeline.saveProfile(input)).ok, true);
    assert.equal((await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '合法讨论' })).ok, true);
    await until(setup.pipeline, (state) => state.turn?.status === 'completed');
    for (let repeat = 0; repeat < 2; repeat += 1) {
      const saved = await setup.pipeline.saveProfile(input);
      assert.equal(saved.ok, true, saved.error?.code);
      assert.equal(JSON.stringify(saved).includes(key), false);
      const connection = await setup.profiles.resolveConnection(setup.ids[0]);
      assert.equal(connection.ok, true);
      assert.equal(connection.value.credentials.apiKey, key);
      const persisted = await readFile(join(setup.data, 'desktop-settings.json'), 'utf8');
      assert.equal(persisted.includes(key), false);
      assert.ok(JSON.parse(persisted).profiles.find((item) => item.id === setup.ids[0]).keyCiphertext);
    }
    const before = await readFile(join(setup.data, 'desktop-settings.json'));
    for (const field of ['name', 'provider', 'modelId', 'baseUrl']) {
      const denied = await setup.pipeline.saveProfile({ ...input, [field]: field === 'baseUrl' ? local.url + '/' + key : key });
      assert.equal(denied.ok, false);
      assert.equal(denied.error.code, 'sensitive_output');
      assert.deepEqual(await readFile(join(setup.data, 'desktop-settings.json')), before);
    }
    const denied = await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: key });
    assert.equal(denied.error.code, 'sensitive_output');
    assert.equal(JSON.stringify(await setup.pipeline.getState()).includes(key), false);
    await assertNoKnownKey(setup.data, key);
    await assertNoKnownKey(setup.root, key);
  } finally { await setup.pipeline.close(); await local.close(); }
});
test('profile revision change invalidates draft; arbitrary callbacks and direct execution IPC are rejected', async () => {
  let candidate; const local = await server((record, reply) => completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```')); const setup = await fixture(local); candidate = proposal(setup.ids.slice(0, 1)); try {
    await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'Supervisor',
      text: '计划'
    }); const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft' && state.turn?.status === 'completed'); const first = (await setup.profiles.list()).value.profiles[0]; const {
      hasSavedKey,
      ...fields
    } = first; assert.equal((await setup.pipeline.saveProfile({
      ...fields,
      name: '连接版本改变',
      keyAction: 'keep',
      apiKey: ''
    })).ok, true); assert.equal((await setup.pipeline.confirmPlan({
      projectId: setup.projectId,
      planDigest: draft.plan.planDigest
    })).error.code, 'plan_changed'); assert.deepEqual(await businessEntries(setup.root), []); assert.throws(() => createWorkbenchPipeline({
      userDataDir: setup.data, leaseRoot:join(setup.data,'..','isolated-project-leases'),
      streamSimple: () => {
      }
    })); const facade = createWorkbenchPipeline({
      userDataDir: setup.data, leaseRoot:join(setup.data,'..','isolated-project-leases')
    }); assert.equal(Object.hasOwn(facade, 'startAgent'), false); await facade.close();
  } finally {
    await setup.pipeline.close(); await local.close();
  }
});
test('completed SDK text without tools is failed target generation; actual run audit remains completed and checks unexecuted', async () => {
  let candidate; const local = await server((record, reply) => {
    let text = '我已完成所有文件和检查'; if (isCustomerCall(record.body)) text = '```legion-plan\n' + JSON.stringify(candidate) + '\n```'; completion(reply, protocol(record), text);
  }); const setup = await fixture(local); candidate = proposal(setup.ids.slice(0, 1)); try {
    await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'Supervisor',
      text: '生成文件'
    }); const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft'); await setup.pipeline.confirmPlan({
      projectId: setup.projectId,
      planDigest: draft.plan.planDigest
    }); const done = await until(setup.pipeline, (state) => state.plan?.status === 'failed'); assert.equal(done.tasks[0].status, 'failed'); assert.equal(done.tasks[0].error.code, 'task_outputs_missing'); assert.deepEqual(done.tasks[0].results, []); assert.equal(done.tasks[0].checkStatus, 'not_executed'); assert.equal((await businessEntries(setup.root)).includes('file0.txt'), false); const audit = await readFile(join(setup.root, '.ans/events/index.jsonl'), 'utf8'); assert.ok(audit.includes('agent_run_completed')); assert.equal(audit.includes('mutation_success'), false);
  } finally {
    await setup.pipeline.close(); await local.close();
  }
});
test('stop revokes at entry while queue awaits slow state; wrong project cannot cancel; late tool never commits', async () => {
  let candidate; let held; const local = await server((record, reply) => {
    if (isCustomerCall(record.body)) completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```'); else held = {
      record,
      reply
    };
  }); const setup = await fixture(local); candidate = proposal(setup.ids.slice(0, 1)); try {
    await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'Supervisor',
      text: '计划'
    }); const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft'); await setup.pipeline.confirmPlan({
      projectId: setup.projectId,
      planDigest: draft.plan.planDigest
    }); for (let index = 0; index < 200 && !held; index += 1) await delay(10); assert.ok(held); assert.equal((await setup.pipeline.stopExecution({
      projectId: '0'.repeat(64)
    })).error.code, 'project_missing'); const original = setup.profiles.list.bind(setup.profiles); let unblock; let entered; const waiting = new Promise((done) => {
      entered = done;
    }); setup.profiles.list = async () => {
      entered(); await new Promise((done) => {
        unblock = done;
      }); return original();
    }; const slow = setup.pipeline.getState(); await waiting; const stopping = setup.pipeline.stopExecution({
      projectId: setup.projectId
    }); setup.profiles.list = original; completion(held.reply, protocol(held.record), '', {
      resource: 'file0.txt',
      content: 'late forbidden'
    }); await delay(30); unblock(); await slow; const stopped = await stopping; assert.equal(stopped.ok, true); assert.equal(stopped.value.plan.status, 'invalidated'); assert.equal((await businessEntries(setup.root)).includes('file0.txt'), false);
  } finally {
    await setup.pipeline.close(); await local.close();
  }
});
test('close invalidates in-flight confirmation before active assignment; idempotent close emits no execution request', async () => {
  let candidate; const local = await server((record, reply) => completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```')); const setup = await fixture(local); candidate = proposal(setup.ids.slice(0, 1)); try {
    await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'Supervisor',
      text: '计划'
    }); const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft'); const original = setup.profiles.resolveConnection.bind(setup.profiles); let unblock; let entered; const waiting = new Promise((done) => {
      entered = done;
    }); setup.profiles.resolveConnection = async (...args) => {
      entered(); await new Promise((done) => {
        unblock = done;
      }); return original(...args);
    }; const confirming = setup.pipeline.confirmPlan({
      projectId: setup.projectId,
      planDigest: draft.plan.planDigest
    }); await waiting; const closed = setup.pipeline.close(); setup.profiles.resolveConnection = original; unblock(); assert.equal((await confirming).ok, false); assert.equal((await closed).ok, true); assert.equal((await setup.pipeline.close()).ok, true); assert.equal(local.calls.filter((record) => !record.synthetic).length, 1); assert.deepEqual(await businessEntries(setup.root), []);
  } finally {
    await setup.pipeline.close(); await local.close();
  }
});
test('cancel one PM turn preserves conversation for next turn; closing pending stream is bounded', async () => {
  let hanging = true; const local = await server((record, reply) => {
    if (hanging) {
      reply.writeHead(200, {
        'content-type': 'text/event-stream'
      }); reply.write(': waiting\n\n');
    } else completion(reply, protocol(record), '继续回复');
  }); const setup = await fixture(local); try {
    const sent = await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'Supervisor',
      text: '停止这轮'
    }); const cancelled = await setup.pipeline.cancelTurn({
      projectId: setup.projectId,
      turnId: sent.value.turn.id
    }); assert.equal(cancelled.value.turn.status, 'cancelled'); assert.deepEqual(cancelled.value.history.messages.map((item) => item.text), ['停止这轮']); hanging = false; await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'Supervisor',
      text: '继续'
    }); const done = await until(setup.pipeline, (state) => state.turn?.status === 'completed'); assert.deepEqual(done.history.messages.map((item) => item.text), ['停止这轮', '继续', '继续回复']); hanging = true; await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'Supervisor',
      text: '关闭'
    }); assert.equal((await setup.pipeline.close()).ok, true);
  } finally {
    await setup.pipeline.close(); await local.close();
  }
});

test('PM and confirmed worker list and read current project without widening exact writes', async () => {
  let setup; let candidate; let pmCalls = 0; let workerCalls = 0;
  const local = await server((record, reply) => {
    const body = JSON.stringify(record.body);
    if (isCustomerCall(record.body)) {
      pmCalls += 1;
      assert.equal(record.body.tools.some((tool) => JSON.stringify(tool).includes('legion_write_file')), false);
      if (pmCalls === 1) completion(reply, protocol(record), '', { resource: '' }, 'legion_list_files');
      if (pmCalls === 2) {
        assert.match(body, /note\.txt/u);
        assert.doesNotMatch(body, /secret-value/u);
        completion(reply, protocol(record), '', { resource: 'note.txt' }, 'legion_read_file', 'call2');
      }
      if (pmCalls === 3) {
        assert.match(body, /project data/u);
        completion(reply, protocol(record), '', { resource: '.env' }, 'legion_read_file', 'call3');
      }
      if (pmCalls === 4) {
        assert.match(body, /restricted_resource/u);
        assert.doesNotMatch(body, /secret-value/u);
        completion(reply, protocol(record), '方案\n```legion-plan\n' + JSON.stringify(candidate) + '\n```');
      }
      return;
    }
    assert.equal(record.body.tools?.length, 8);
    workerCalls += 1;
    if (workerCalls === 1) completion(reply, protocol(record), '', { resource: 'note.txt' }, 'legion_read_file');
    if (workerCalls === 2) {
      assert.match(body, /project data/u);
      completion(reply, protocol(record), '', { resource: 'file0.txt', content: 'from read' }, 'legion_write_file', 'call2');
    }
    if (workerCalls === 3) completion(reply, protocol(record), '完成');
  });
  setup = await fixture(local); candidate = proposal([setup.ids[0]]);
  await writeFile(join(setup.root, 'note.txt'), 'project data\n');
  await writeFile(join(setup.root, '.env'), 'secret-value');
  try {
    const sent = await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '先浏览项目再提出计划' });
    assert.equal(sent.ok, true);
    const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft' || state.turn?.status === 'failed');
    assert.equal(draft.plan?.status, 'draft', JSON.stringify(draft.error));
    assert.equal(draft.context.files.length, 0);
    assert.deepEqual((await businessEntries(setup.root)).sort(), ['.env', 'note.txt']);
    assert.equal(pmCalls, 4);
    assert.equal((await setup.pipeline.confirmPlan({ projectId: setup.projectId, planDigest: draft.plan.planDigest })).ok, true);
    const done = await until(setup.pipeline, (state) => ['completed', 'failed', 'invalidated'].includes(state.plan.status));
    assert.equal(done.plan.status, 'completed', JSON.stringify(done.error));
    assert.equal(await readFile(join(setup.root, 'file0.txt'), 'utf8'), 'from read');
    assert.equal(workerCalls, 3);
  } finally { await setup.pipeline.close(); await local.close(); }
});

test('persisted owner transfer enables a new role to read SHA and edit only its confirmed file', async () => {
  let setup; let pmCalls = 0; let workerCalls = 0;
  let firstPlan; let invalidPlan; let transferPlan;
  const local = await server((record, reply) => {
    if (isCustomerCall(record.body)) {
      pmCalls += 1;
      if (pmCalls === 1) completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(firstPlan) + '\n```');
      if (pmCalls === 2) completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(invalidPlan) + '\n```');
      if (pmCalls === 3) completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(transferPlan) + '\n```');
      return;
    }
    assert.equal(record.body.tools?.length, 8);
    workerCalls += 1;
    if (workerCalls === 1) completion(reply, protocol(record), '', { resource: 'note.txt', content: 'before\n' });
    if (workerCalls === 2) completion(reply, protocol(record), '已写入');
    if (workerCalls === 3) completion(reply, protocol(record), '', { resource: 'note.txt' }, 'legion_read_file');
    if (workerCalls === 4) {
      const toolMessage = record.body.messages.at(-1);
      assert.equal(toolMessage.role, 'tool');
      const read = JSON.parse(toolMessage.content);
      assert.equal(read.result.status, 'read');
      assert.equal(read.result.text, 'before\n');
      assert.match(read.result.sha256, /^[a-f0-9]{64}$/u);
      completion(reply, protocol(record), '', { resource: 'note.txt', expectedSha256: read.result.sha256,
        replacements: [{ oldText: 'before', newText: 'after' }] }, 'legion_edit_file', 'call2');
    }
    if (workerCalls === 5) completion(reply, protocol(record), '已编辑');
  });
  setup = await fixture(local);
  const baseRole = { id: 'Builder', name: '开发', purpose: '写文件', profileId: setup.ids[0] };
  const nextRole = { id: 'Editor', name: '编辑', purpose: '修改文件', profileId: setup.ids[0] };
  const task = (id, roleId) => ({ id, title: id, roleId, profileId: setup.ids[0], dependsOn: [],
    writeSet: ['note.txt'], instruction: '修改这个文件' });
  firstPlan = { goal: '创建文件', roles: [baseRole], tasks: [task('create', 'Builder')] };
  invalidPlan = { goal: '试图无声转交', roles: [nextRole], tasks: [task('edit', 'Editor')] };
  transferPlan = { goal: '转交并编辑', roles: [nextRole], tasks: [task('edit', 'Editor')],
    transfers: [{ resource: 'note.txt', fromRoleId: 'Builder', toRoleId: 'Editor' }] };
  try {
    assert.equal((await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '创建' })).ok, true);
    const first = await until(setup.pipeline, (state) => state.plan?.status === 'draft');
    assert.equal((await setup.pipeline.confirmPlan({ projectId: setup.projectId, planDigest: first.plan.planDigest })).ok, true);
    const created = await until(setup.pipeline, (state) => state.plan?.status === 'completed');
    assert.equal(created.fileOwners.ownerOf('note.txt'), 'Builder');
    assert.equal(await readFile(join(setup.root, 'note.txt'), 'utf8'), 'before\n');
    assert.equal((await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '试试无声转交' })).ok, true);
    const rejected = await until(setup.pipeline, (state) => state.error?.code === 'approved_organization_required' && state.turn?.status === 'completed');
    assert.equal(rejected.error.code, 'approved_organization_required');
    assert.ok(local.calls.flatMap((record) => typedResults(record.body)).some((pair) => pair.result?.tool === 'legion_propose_roles' && pair.result.reason === 'file_owned_by_other_role' && pair.result.status === 'denied'));
    assert.equal(rejected.fileOwners.ownerOf('note.txt'), 'Builder');
    assert.equal(await readFile(join(setup.root, 'note.txt'), 'utf8'), 'before\n');
    assert.equal((await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '明确转交给Editor' })).ok, true);
    const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft' && state.plan.revision === 2);
    assert.equal(draft.fileOwners.ownerOf('note.txt'), 'Builder');
    assert.deepEqual(draft.plan.fileOwnership.transfers.map((item) => [item.resource, item.fromRoleId, item.toRoleId]),
      [['note.txt', 'Builder', 'Editor']]);
    assert.equal((await setup.pipeline.confirmPlan({ projectId: setup.projectId, planDigest: draft.plan.planDigest })).ok, true);
    const edited = await until(setup.pipeline, (state) => state.plan?.status === 'completed' && state.plan.revision === 2);
    assert.equal(edited.fileOwners.ownerOf('note.txt'), 'Editor');
    assert.equal(edited.tasks[0].results[0].action, 'edit_file');
    assert.match(edited.tasks[0].results[0].contentDigest, /^[a-f0-9]{64}$/u);
    assert.equal(await readFile(join(setup.root, 'note.txt'), 'utf8'), 'after\n');
    assert.equal(workerCalls, 5);
  } finally { await setup.pipeline.close(); await local.close(); }
});

test('confirmation rejects a different instance owner update and leaves customer files untouched', async () => {
  let candidate;
  const local = await server((record, reply) => {
    assert.equal(record.body.tools?.length, 8);
    completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```');
  });
  const setup = await fixture(local); candidate = proposal([setup.ids[0]]);
  const external = createProjectService({ userDataDir: setup.data });
  try {
    assert.equal((await setup.pipeline.sendMessage({ projectId: setup.projectId,
      roleId: 'Supervisor', text: '提出计划' })).ok, true);
    const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft');
    const saved = (await external.catalog()).value.projects.find((item) => item.id === setup.projectId);
    const owners = new ProjectFileOwners({ projectId: setup.projectId, version: 'owners-external',
      owners: [{ resource: 'file0.txt', roleId: 'Other' }] });
    assert.equal((await external.saveProject({ ...saved, fileOwners: owners },
      { expectedFileOwnersDigest: saved.fileOwners.digest })).ok, true);
    const denied = await setup.pipeline.confirmPlan({ projectId: setup.projectId,
      planDigest: draft.plan.planDigest });
    assert.equal(denied.error.code, 'stale_file_owners');
    const current = (await setup.pipeline.getState()).value;
    assert.equal(current.fileOwners.ownerOf('file0.txt'), 'Other');
    assert.deepEqual(await businessEntries(setup.root), []);
    assert.equal((await setup.pipeline.confirmPlan({ projectId: setup.projectId,
      planDigest: draft.plan.planDigest })).error.code, 'plan_changed');
  } finally { await external.close(); await setup.pipeline.close(); await local.close(); }
});

// The scripted model now traverses real SDK control tools, persisted proposal review, checks and Acceptance.
// Original test handlers still own their mutation/read/cancel scenarios. No host authorization is fabricated.
function strings(value) { if (typeof value === 'string') return [value]; if (Array.isArray(value)) return value.flatMap(strings); if (value && typeof value === 'object') return Object.values(value).flatMap(strings); return []; }
function typedResults(body) { return strings(body).flatMap((value) => { try { const parsed = JSON.parse(value); if (parsed.result) return [parsed]; } catch {} return []; }); }
function taskMetadata(body) { const value = strings(body).find((text) => text.startsWith('Human已确认任务：')); if (!value) return null; const task=JSON.parse(value.split('\n')[0].slice('Human已确认任务：'.length));return {...task,writeSet:task.ownedFiles??[]}; }
function checkSpec(taskId, resources) { const testResource='tests/Acceptance/check-'+taskId+'.test.mjs'; return {checkId:'unit-'+taskId,kind:'node-test',argv:['--test',testResource],testResources:[testResource],inputResources:[...new Set([testResource,'package.json',...resources])],outputResources:[],timeoutSeconds:10,network:'none',logMaxBytes:8192}; }
async function businessEntries(root) { return (await readdir(root)).filter((entry) => !['tests','package.json'].includes(entry)); }
async function governedResponse(record, reply, host) {
 const results = typedResults(record.body); const tools = record.body.tools ?? []; const toolText = JSON.stringify(tools);
 if(!host.manualCustomer&&toolText.includes('legion_delegate_pm')&&results.some(pair=>pair.result?.tool==='legion_delegate_pm')){record.synthetic=true;reply.synthetic=true;const result=results.findLast(pair=>pair.result?.tool==='legion_delegate_pm').result;assert.equal(result.status,'completed',result.reason);if(result.payload?.kind==='error'){completion(reply,protocol(record),'Host已明确拒绝本委托：'+result.payload.code);return true;}completion(reply,protocol(record),(host.planText??'').replace(/```legion-plan\s*\n[\s\S]*?\n```/u,'')||'计划已形成');return true;}

 const task = taskMetadata(record.body);
 if(toolText.includes('legion_design_roles')&&host.pendingPMTool&&!results.length){const pending=host.pendingPMTool;host.pendingPMTool=null;record.synthetic=true;completion(reply,protocol(record),'',pending.tool,pending.toolName,pending.toolCallId);return true;}
 if(toolText.includes('legion_design_roles')&&host.pendingPMPlan&&!results.length){const planned=host.pendingPMPlan;host.pendingPMPlan=null;record.synthetic=true;completion(reply,protocol(record),planned);return true;}

 if(toolText.includes('legion_submit_supervision')&&host.rejectKeyMode==='supervisor')return false;
 if(toolText.includes('legion_submit_supervision')){
   record.synthetic=true;reply.synthetic=true;
   const prompt=strings(record.body).find(text=>text.startsWith('你是Supervisor。'));const snapshot=JSON.parse(prompt.split('监督输入：')[1].split('\n')[0]);
   if(host.supervisionRead){const read=results.find(pair=>pair.result?.resource==='package.json');if(!read){completion(reply,protocol(record),'',{resource:'package.json',maxBytes:4096},'legion_read_file','supervision-read-'+snapshot.phase);return true;}assert.equal(read.result.status,'read');(host.supervisionReads??=new Set()).add(snapshot.phase);}
   (host.supervisionSnapshots??=[]).push(snapshot);if(host.holdSupervisionPhase===snapshot.phase&&!host.supervisionReleased&&!results.some(pair=>pair.result?.tool==='legion_submit_supervision')){host.releaseSupervision=()=>{host.supervisionReleased=true;const findings=[{severity:'info',taskIds:snapshot.tasks.map(task=>task.id),sourceRefs:[snapshot.sourceIndex[0].id],reason:'当前有来源检查与验收摘要'}];completion(reply,protocol(record),'',{payload:{phase:snapshot.phase,planDigest:snapshot.planDigest,findings,recommendation:'proceed'}},'legion_submit_supervision','held-supervision');};return true;}if((host.supervisionMode==='text-only'&&snapshot.phase==='preflight')||host.supervisionFailurePhase===snapshot.phase){completion(reply,protocol(record),'只有文字，不能冒充预检完成');return true;}
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
     else if(host.rejectKeyMode==='acceptance')return false;
     else if (!results.some((item) => item.result?.tool === 'legion_submit_acceptance')) completion(reply,protocol(record),'',{payload:{taskId:task.id,evidenceIds:[check.result.requestId],decision:check.result.status==='passed'?'pass':'fail',issues:acceptanceIssues(host,check.result)}},'legion_submit_acceptance','submit');
     else completion(reply,protocol(record),'已真实独立验收');
     return true;
   }
   if (check && host.finalText.has(task.id)) {record.synthetic=true;reply.synthetic=true;completion(reply,protocol(record),host.finalText.get(task.id));return true;}
   return false;
 }
 if (!host.manualArchitect && host.rejectKeyMode!=='role-proposal' && toolText.includes('legion_propose_roles')) {
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
   for(const task of plan.tasks) { const resources = [...new Set([...task.writeSet,...testDependencyResources(plan.tasks,task)])]; task.checks=[checkSpec(task.id,resources)]; await writeFile(join(host.fixture.root, task.checks[0].testResources[0]), host.failCheck?'import test from "node:test";import assert from "node:assert/strict";test("real failure",()=>assert.fail("expected selftest failure"));':validationSource(resources)); }
   if(!host.publication) plan.tasks.push({id:'zz-acceptance',title:'独立验收',roleId:'Acceptance',profileId:host.fixture.ids[0],dependsOn:plan.tasks.map((task)=>task.id),accepts:plan.tasks.map((task)=>task.id),writeSet:['tests/Acceptance/check-zz-acceptance.test.mjs'],instruction:'运行独立检查并提交真实证据',checks:[checkSpec('zz-acceptance',plan.tasks.flatMap((task)=>task.writeSet))]});
   if(host.negativeMode==='missing-check') delete plan.tasks[0].checks;
   if(host.negativeMode==='missing-acceptance') {plan.tasks=plan.tasks.filter((task)=>task.roleId!=='Acceptance');plan.roles=plan.roles.filter((role)=>role.id!=='Acceptance');}
   host.phase=null;host.fixture.proposalCounter+=1;
   completion(reply,protocol(record),host.planText.replace(/```legion-plan\s*\n[\s\S]*?\n```/u,'```legion-plan\n'+JSON.stringify(runtimePlan(plan))+'\n```'));return true;
 }
 return false;
}

function roleBoundary(plan, id) { if (id === 'Acceptance') return ['tests/Acceptance/check-zz-acceptance.test.mjs']; return [...new Set(plan.tasks.filter((item)=>item.roleId===id).flatMap((item)=>item.writeSet))]; }
function validationSource(resources) { return "import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';test('actual declared target content',()=>{for(const resource of " + JSON.stringify(resources) + ")assert.ok(readFileSync(resource,'utf8').trim().length>0);});"; }

test('actual SDK three interaction tools accept real answers, close retains pending and wrong nonce/duplicate/cancel reject', async () => {
  let stage = 0;
  const local = await server((record, reply) => {
    const results = typedResults(record.body);
    const previous = results.findLast((pair) => pair.result?.tool === 'legion_request_interaction');
    if (previous) { assert.equal(previous.result.status, 'completed'); assert.ok(previous.result.payload.interaction.answer); stage += 1; }
    if (stage >= 3) { completion(reply, protocol(record), '真实答复已收到'); return; }
    const kinds = ['question', 'choice', 'confirmation']; const kind = kinds[stage];
    let options = [], allowSupplement = false;
    if (kind === 'choice') { options = [{ id: 'yes', label: '方案A' }]; allowSupplement = true; }
    completion(reply, protocol(record), '', { payload: { kind, purpose: 'discussion', title: '问题' + stage, text: '请明确答复', options, allowSupplement } }, 'legion_request_interaction', 'question-' + stage);
  });
  const setup = await fixture(local);
  try {
    await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '讨论三类答复' });
    for (let index = 0; index < 3; index += 1) {
      const pending = await until(setup.pipeline, (state) => state.interactions.some((request) => request.status === 'pending' && request.title === '问题' + index));
      assert.equal(pending.turn.status, 'waiting'); const request = pending.interactions.find((item) => item.status === 'pending');
      const input = { projectId: setup.projectId, requestId: request.requestId, version: request.version, requestDigest: request.digest };
      assert.equal((await setup.pipeline.closeInteraction(input)).ok, true);
      assert.equal((await setup.pipeline.getState()).value.interactions.find((item) => item.requestId === request.requestId).status, 'pending');
      let value = '真实文字'; if (index === 1) value = { optionId: 'yes', text: '补充需求' }; if (index === 2) value = false;
      const stale = await setup.pipeline.answerInteraction({ ...input, version: 2, value }); assert.equal(stale.error.code, 'stale_interaction');
      assert.equal((await setup.pipeline.answerInteraction({ ...input, value })).ok, true);
      assert.equal((await setup.pipeline.answerInteraction({ ...input, value })).ok, true);
      const conflicting = await setup.pipeline.answerInteraction({ ...input, value: '冲突重复' }); assert.equal(conflicting.ok, false);
    }
    const completed = await until(setup.pipeline, (state) => state.turn?.status === 'completed');
    assert.deepEqual(completed.interactions.map((request) => request.status), ['answered', 'answered', 'rejected']);
    assert.equal(completed.plan, null); assert.deepEqual(await businessEntries(setup.root), []);
  } finally { await setup.pipeline.close(); await local.close(); }
});

test('restart preserves pending question as fact and never responds to a dead SDK run', async () => {
  let recovery = false;
  const local = await server((record, reply) => {
    if (recovery) { assert.equal(typedResults(record.body).length, 0); assert.ok(JSON.stringify(record.body).includes('真实恢复答案')); completion(reply, protocol(record), '已按新会话继续'); return; }
    completion(reply, protocol(record), '', { payload: { kind: 'question', purpose: 'discussion', title: '持久问题', text: '需要哪些功能？', options: [], allowSupplement: false } }, 'legion_request_interaction', 'old-question');
  });
  const setup = await fixture(local);
  try {
    await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '讨论' });
    const waiting = await until(setup.pipeline, (state) => state.turn?.status === 'waiting'); const request = waiting.interactions[0];
    await setup.pipeline.close(); recovery = true;
    const retained = new WorkbenchPipelineImpl({ userDataDir: setup.data , leaseRoot:join(setup.data,'..','isolated-project-leases')}, { profiles: setup.reopenProfiles() });
    try {
      const selected = await retained.selectProject(setup.root); assert.equal(selected.value.interactions[0].status, 'pending');
      const answered = await retained.answerInteraction({ projectId: setup.projectId, requestId: request.requestId, version: request.version, requestDigest: request.digest, value: '真实恢复答案' }); assert.equal(answered.ok, true, JSON.stringify(answered));
      const complete = await until(retained, (state) => state.turn?.status === 'completed'); assert.equal(complete.interactions[0].answer.value, '真实恢复答案');
      assert.deepEqual(complete.timeline.messages.map((message)=>message.kind),['human','question','answer','assistant']);
      assert.equal(complete.timeline.turns.at(-1).continuationAnswerId,complete.interactions[0].answer.answerId);
      await retained.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'后续新需求'});const future=await until(retained,(state)=>state.turn?.status==='completed'&&state.history.messages.length>=4);
      const answer=future.timeline.messages.find((message)=>message.kind==='answer');const later=future.timeline.messages.find((message)=>message.kind==='human'&&message.text==='后续新需求');assert.ok(answer.order<later.order);assert.equal(future.timeline.messages.filter((message)=>message.answerId===answer.answerId).length,1);
    } finally { await retained.close(); }
  } finally { await setup.pipeline.close(); await local.close(); }
});

test('unapproved text plan, missing self-check and missing independent coverage cannot execute or complete', async () => {
  for (const mode of ['unapproved', 'missing-check', 'missing-acceptance']) {
    let candidate; const local = await server((record, reply) => { if (mode === 'unapproved') reply.synthetic = true; completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(mode==='unapproved'?runtimePlan(candidate):candidate) + '\n```'); });
    const setup = await fixture(local); candidate = proposal([setup.ids[0]]); local.host.negativeMode = mode;
    try {
      await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '不要跳过授权或验证' });
      const failed = await until(setup.pipeline, (state) => state.error!==null && state.turn?.status === 'completed');
      const expected = { unapproved: 'approved_organization_required', 'missing-check': 'task_checks_required', 'missing-acceptance': 'independent_acceptance_required' }[mode];
      assert.equal(failed.error.code, expected); assert.equal(failed.plan, null); assert.deepEqual(await businessEntries(setup.root), []);
    } finally { await setup.pipeline.close(); await local.close(); }
  }
});

test('ordinary yes and missing/wrong confirmation nonce do not issue execution authority', async () => {
  let candidate; let planned = false;
  const local = await server((record, reply) => { if (!planned) { planned = true; completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```'); } else completion(reply, protocol(record), '继续讨论'); });
  const setup = await fixture(local); candidate = proposal([setup.ids[0]]);
  try {
    await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '计划' }); const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft' && state.turn?.status === 'completed');
    assert.equal((await setup.plainConfirm({ projectId: setup.projectId, planDigest: draft.plan.planDigest })).error.code, 'execution_confirmation_required');
    assert.equal((await setup.pipeline.answerInteraction({ projectId: setup.projectId, requestId: draft.interactions[0].requestId, version: 1, requestDigest: '0'.repeat(64), value: true })).error.code, 'stale_interaction');
    await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: 'yes' }); const done = await until(setup.pipeline, (state) => state.turn?.status === 'completed');
    assert.equal(done.plan.status, 'draft'); assert.equal(done.interactions[0].status, 'pending');assert.ok(done.tasks.every(task=>task.status==='pending'&&task.runId===null)); assert.deepEqual(await businessEntries(setup.root), []);
  } finally { await setup.pipeline.close(); await local.close(); }
});

function acceptanceSource(host) { if (host.repairFlow) return "import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';test('actual customer requirement',()=>assert.equal(readFileSync('file0.txt','utf8'),'good'));"; return validationSource(host.plan.tasks.flatMap((item)=>item.writeSet)); }
function acceptanceIssues(host, result) { if (result.status === 'passed') return []; return [{ taskId: 'task0', resource: 'file0.txt', expected: 'good', actual: result.status, reproduction: 'legion_run_check unit-zz-acceptance' }]; }

test('actual SDK Acceptance failure is read by PM, returns to original owner for real self-check and independent recheck', async () => {
  let candidate; let requestedPlan = false; let repaired = false;
  const local = await server((record, reply) => {
    const task = taskMetadata(record.body);
    if (task) {
      if (hasResult(record.body)) completion(reply, protocol(record), '依据真实结果完成');
      else { let content = 'bad'; if (repaired) content = 'good'; completion(reply, protocol(record), '', { resource: 'file0.txt', content }); }
      return;
    }
    if (!requestedPlan) { requestedPlan = true; completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```'); return; }
    const results = typedResults(record.body);
    if (results.some((pair) => pair.result?.tool === 'legion_request_repair')) { assert.equal(results.findLast((pair) => pair.result?.tool === 'legion_request_repair').result.status, 'completed', JSON.stringify(results.findLast((pair) => pair.result?.tool === 'legion_request_repair'))); completion(reply, protocol(record), '原角色返修已安排'); return; }
    const prompt = strings(record.body).findLast((value) => value.includes('当前持久组织与提案、交互、实际验收/返修（仅事实不授权）：'));
    const domain = JSON.parse(/当前持久组织与提案、交互、实际验收\/返修（仅事实不授权）：([^\n]+)/u.exec(prompt)[1]);
    const failed = domain.acceptances.at(-1); assert.equal(failed.decision, 'fail'); assert.ok(domain.evidence.some((entry) => entry.result.status === 'failed'));
    repaired = true;
    completion(reply, protocol(record), '', { payload: { acceptanceId: failed.id, taskId: 'task0', reason: '独立检查证实实际值应为good，交回Worker0修复' } }, 'legion_request_repair', 'repair');
  });
  const setup = await fixture(local); candidate = proposal([setup.ids[0]]); local.host.repairFlow = true;
  try {
    await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '实现并验收good' }); const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft' && state.turn?.status === 'completed');
    assert.equal((await setup.pipeline.confirmPlan({ projectId: setup.projectId, planDigest: draft.plan.planDigest })).ok, true);
    const failed = await until(setup.pipeline, (state) => state.plan?.status === 'failed'); assert.equal(failed.tasks.find((task) => task.id === 'task0').checkStatus, 'passed'); assert.equal(failed.acceptances.at(-1).decision, 'fail'); assert.equal(await readFile(join(setup.root, 'file0.txt'), 'utf8'), 'bad');
    await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '读取失败证据并在已确认范围内返修' });
    const done = await until(setup.pipeline, (state) => state.plan?.status === 'completed' && state.repairs.length === 1 && state.turn?.status === 'completed');
    assert.equal(done.repairs[0].roleId, 'Worker0'); assert.equal(Object.hasOwn(done.repairs[0],'writeSet'),false); assert.equal(done.acceptances.at(-1).decision, 'pass'); assert.equal(await readFile(join(setup.root, 'file0.txt'), 'utf8'), 'good');
    assert.equal(done.evidence.filter((entry) => entry.roleId === 'Worker0' && entry.result.status === 'passed').length, 2);
    assert.equal(done.evidence.filter((entry) => entry.roleId === 'Acceptance').length, 2);
    assert.deepEqual(done.roleMemory.entries.map((entry) => entry.roleId+'|'+entry.channel).sort(),['Acceptance|member_task','ProjectManager|pm_delegate','RoleArchitect|member_task','Supervisor|su_customer','Supervisor|supervision_monitor','Supervisor|supervision_preflight','Worker0|member_task']);
    assert.equal(done.memberConversations.events.filter((event) => event.kind === 'host_briefing' && done.memberConversations.runs.find((run) => run.id === event.conversationId)?.roleId === 'Worker0').length, 2);
    const workerStarts = local.calls.filter((record) => taskMetadata(record.body)?.id === 'task0' && !hasResult(record.body)); assert.equal(workerStarts.length, 2); assert.match(JSON.stringify(workerStarts[1].body), /历史实际宿主任务输入/u); assert.equal(typedResults(workerStarts[1].body).length, 0); assert.equal(JSON.stringify(workerStarts[1].body).includes('已真实独立验收'), false);

  } finally { await setup.pipeline.close(); await local.close(); }
});

function testDependencyResources(tasks, task, seen = new Set()) { const resources=[]; for(const id of task.dependsOn){if(seen.has(id))continue;seen.add(id);const dependency=tasks.find((item)=>item.id===id);resources.push(...dependency.writeSet,...testDependencyResources(tasks,dependency,seen));} return resources; }

test('cancelling a live pending SDK question invalidates it and consumes terminal before the next turn', async () => {
  let questions = true;
  const local = await server((record, reply) => {
    if (questions) completion(reply, protocol(record), '', {payload:{kind:'question',purpose:'discussion',title:'待取消',text:'需要答复',options:[],allowSupplement:false}}, 'legion_request_interaction', 'pending');
    else completion(reply, protocol(record), '下一轮可正常回复');
  });
  const setup = await fixture(local);
  try {
    await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'提问'});
    const waiting = await until(setup.pipeline, (state) => state.turn?.status === 'waiting');
    const cancelled = await setup.pipeline.cancelTurn({projectId:setup.projectId,turnId:waiting.turn.id});
    assert.equal(cancelled.ok,true);assert.equal(cancelled.value.turn.status,'cancelled');assert.equal(cancelled.value.interactions[0].status,'invalidated');
    questions=false;
    assert.equal((await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'继续'})).ok,true);
    const done=await until(setup.pipeline,(state)=>state.turn?.status==='completed');assert.equal(done.turn.text,'下一轮可正常回复');
    assert.equal((await setup.pipeline.answerInteraction({projectId:setup.projectId,requestId:waiting.interactions[0].requestId,version:1,requestDigest:waiting.interactions[0].digest,value:'迟到答案'})).error.code,'interaction_invalidated');
  }finally{await setup.pipeline.close();await local.close();}
});

test('actual SDK RoleArchitect publishes only Human-confirmed governance document whose content SHA matches the approved candidate', async () => {
  const resource='docs/roles/DocumentedRole/role-card.md';const content='# DocumentedRole\n职责和精确边界。\n';let candidate;
  const local=await server((record,reply)=>{
    const task=taskMetadata(record.body);
    if(!task){completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');return;}
    if(hasResult(record.body)) completion(reply,protocol(record),'角色文档按批准SHA发布');
    else completion(reply,protocol(record),'',{resource,content});
  });
  const setup=await fixture(local);local.host.publication={resource,content};
  candidate={goal:'发布已批准角色文档',roles:[{id:'RoleArchitect',name:'RoleArchitect',purpose:FIXED_ROLE_DUTIES.RoleArchitect,profileId:setup.ids[0]}],tasks:[{id:'publish',title:'发布治理文档',roleId:'RoleArchitect',profileId:setup.ids[0],dependsOn:[],writeSet:[resource],instruction:'严格按已批准候选SHA发布'}]};
  try{
    await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'起草角色文档并让我确认发布'});
    const draft=await until(setup.pipeline,(state)=>state.plan?.status==='draft'&&state.turn?.status==='completed');
    await assert.rejects(readFile(join(setup.root,resource),'utf8'),{code:'ENOENT'});
    assert.equal((await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest})).ok,true);
    const done=await until(setup.pipeline,(state)=>['completed','failed','invalidated'].includes(state.plan?.status));
    assert.equal(done.plan.status,'completed',JSON.stringify(done.tasks));assert.equal(await readFile(join(setup.root,resource),'utf8'),content);assert.equal(done.tasks[0].checkStatus,'passed');
    const declaration=done.organization.members.find((member)=>member.id==='DocumentedRole').documents[0];assert.equal(declaration.contentDigest,createHash('sha256').update(content).digest('hex'));
  }finally{await setup.pipeline.close();await local.close();}
});

test('actual SDK Acceptance cannot mutate business source or submit pass after its source write was denied', async () => {
 let candidate;const local=await server((record,reply)=>{if(!taskMetadata(record.body)){completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');return;}if(hasResult(record.body))completion(reply,protocol(record),'开发自测完成');else completion(reply,protocol(record),'',{resource:'file0.txt',content:'合法实现'});});
 const setup=await fixture(local);candidate=proposal([setup.ids[0]]);local.host.acceptanceOverwrite=true;
 try{
 await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'实现及独立验收'});const draft=await until(setup.pipeline,(state)=>state.plan?.status==='draft'&&state.turn?.status==='completed');
 assert.equal((await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest})).ok,true);const done=await until(setup.pipeline,(state)=>state.plan?.status==='failed');
 assert.equal(await readFile(join(setup.root,'file0.txt'),'utf8'),'合法实现');const acceptance=done.tasks.find((task)=>task.roleId==='Acceptance');assert.ok(acceptance.results.some((result)=>result.resource==='file0.txt'&&result.status==='denied'&&!result.observedMutation));
 assert.equal(done.acceptances.length,0);assert.ok(local.calls.flatMap((record)=>typedResults(record.body)).some((pair)=>pair.result?.tool==='legion_submit_acceptance'&&pair.result.reason==='acceptance_scope_failed'));
 }finally{await setup.pipeline.close();await local.close();}
});

test('live repair: real SDK architect terminal preserves safe authentication/protocol codes without raw vendor text', async () => {
 for (const [httpStatus, vendorText, expected] of [[401,'Invalid API key vendor-private-diagnostic','pi_auth_error'],[500,'Invalid JSON vendor-private-diagnostic','pi_protocol_error']]) {
  let reported=null;const local=await server((record,reply)=>{
   if(JSON.stringify(record.body.tools).includes('legion_propose_roles')){reply.writeHead(httpStatus,{'content-type':'application/json'});reply.end(JSON.stringify({error:{message:vendorText,type:'api_error'}}));return;}
   const result=typedResults(record.body).findLast((pair)=>pair.result?.tool==='legion_design_roles');
   if(result){reported=result;completion(reply,protocol(record),'按真实失败原因继续讨论');return;}
   completion(reply,protocol(record),'',{payload:{instruction:'只读诊断，提交最小角色候选'}},'legion_design_roles','design-failure');
  });const setup=await fixture(local);local.host.manualArchitect=true;
  try{await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'检查架构师真实失败'});await until(setup.pipeline,(state)=>['completed','failed'].includes(state.turn?.status));
   assert.ok(reported);assert.equal(reported.decision.allowed,false);assert.equal(reported.result.reason,expected);assert.equal(reported.result.status,'error');assert.equal(JSON.stringify(reported).includes('vendor-private-diagnostic'),false);
  }finally{await setup.pipeline.close();await local.close();}
 }
});

test('live repair: actual legacy migration supplies all fourteen observed owners and organization identity to the architect', async () => {
 let childPrompt='';const local=await server((record,reply)=>{
  if(JSON.stringify(record.body.tools).includes('legion_propose_roles')){childPrompt=strings(record.body).find((text)=>text.startsWith('你是RoleArchitect。'));completion(reply,protocol(record),'不提交不完整提案');return;}
  if(typedResults(record.body).some((pair)=>pair.result?.tool==='legion_design_roles')){completion(reply,protocol(record),'保持既有归属等待明确提案');return;}
  completion(reply,protocol(record),'',{payload:{instruction:'补齐既有成员职责，保留观察到的文件归属'}},'legion_design_roles','legacy-design');
 });const setup=await fixture(local);local.host.manualArchitect=true;const projects=createProjectService({userDataDir:setup.data});
 try{
  const legacyRoot=join(setup.location,'legacy-customer');await mkdir(legacyRoot);const original=(await projects.select(legacyRoot)).value;
  const owners=Array.from({length:14},(_,index)=>({resource:'existing/file-'+index+'.mjs',roleId:'Existing'}));
  await projects.saveProject({...original,fileOwners:new ProjectFileOwners({projectId:original.id,version:'observed-owners-v1',owners})},{expectedFileOwnersDigest:original.fileOwners.digest});
  const selected=await setup.pipeline.selectProject(legacyRoot);assert.equal(selected.value.organization.status,'legacy');assert.equal(selected.value.organization.fileOwners.length,14);assert.deepEqual(selected.value.organization.members.find((member)=>member.id==='Existing').boundary,[]);
  await setup.pipeline.sendMessage({projectId:original.id,roleId:'Supervisor',text:'根据实际旧归属补齐职责'});await until(setup.pipeline,(state)=>state.turn?.status==='completed');
  assert.ok(childPrompt);for(const owner of owners)assert.ok(childPrompt.includes(owner.resource),owner.resource);assert.ok(childPrompt.includes(selected.value.organization.digest));assert.ok(childPrompt.includes('组织revision：'+selected.value.organization.revision));
 }finally{await projects.close();await setup.pipeline.close();await local.close();}
});

test('live repair: PM guide gives exact smallest valid confirmation/question/choice payload examples', async () => {
 let prompt='';const local=await server((record,reply)=>{if(isCustomerCall(record.body)){const source=classifiedContext(record.body).sourceIndex.findLast(item=>item.type==='human');completion(reply,protocol(record),'',{payload:{action:'start',purpose:'role_design',instruction:'核对后台PM交互说明',sourceRefs:[source.id]}},'legion_delegate_pm','guide-delegate');return;}assert.equal(isManagerCall(record.body),true);prompt=strings(record.body).find((text)=>text.startsWith('你是项目唯一ProjectManager。'));completion(reply,protocol(record),'按明确交互约束讨论');});const setup=await fixture(local);
 try{await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'采用三类合法交互'});await until(setup.pipeline,(state)=>state.turn?.status==='completed');
  for(const payload of [{kind:'confirmation',purpose:'discussion',title:'确认方案',text:'同意这个方案吗？',options:[],allowSupplement:false},{kind:'question',purpose:'discussion',title:'补充需求',text:'需要哪些功能？',options:[],allowSupplement:false},{kind:'choice',purpose:'discussion',title:'选择方案',text:'请选择',options:[{id:'a',label:'方案A'}],allowSupplement:true}])assert.ok(prompt.includes(JSON.stringify({payload})),payload.kind);
 }finally{await setup.pipeline.close();await local.close();}
});

test('live repair: only finite Adapter terminal codes cross the architect boundary; unknown/vendor content stays opaque', () => {
 for(const code of ['pi_model_error','pi_auth_error','pi_network_error','pi_protocol_error','pi_model_aborted','pi_run_failed','pi_run_cancelled','pi_cleanup_failed','pi_turn_timeout','pi_text_budget','pi_queue_budget','pi_history_budget','pi_unexpected_tool_call'])assert.equal(_safeArchitectErrorCode(code),code);
 for(const value of ['',null,undefined,{},'unknown_code','Bearer private-key vendor text'])assert.equal(_safeArchitectErrorCode(value),'architect_failed');
});

test('conversation repair repro: active pending Human precedes its question/answer and future turn does not move old answers', async () => {
  const document={nodes:new Map(),createElement:()=>({children:[],textContent:'',className:'',append(...nodes){this.children.push(...nodes);}}),getElementById(id){if(!this.nodes.has(id))this.nodes.set(id,{children:[],replaceChildren(...nodes){this.children=nodes;},append(...nodes){this.children.push(...nodes);}});return this.nodes.get(id);}};
  const { _Renderer }=await import('../../src/interface/renderer.mjs');const renderer=new _Renderer(document,{});renderer.projectId='a'.repeat(64);
  const turn={id:'turn-a',projectId:renderer.projectId,status:'waiting',text:''};renderer.pendingHuman={turnId:turn.id,projectId:renderer.projectId,text:'重复文字'};
  renderer.state={history:{messages:[]},turn,interactions:[{title:'真实问题',text:'请选择',answer:{value:'真实答案'}}]};renderer.renderMessages();
  const shown=document.getElementById('messages').children.map((node)=>node.children[1].children[1].textContent);
  assert.equal(shown[0],'重复文字');assert.ok(shown.findIndex((text)=>text.includes('真实问题'))<shown.findIndex((text)=>text.includes('真实答案')));
});

test('conversation repair repro: a real proposal followed by SDK authentication failure remains pending in failed design result', async () => {
  let childCalls=0,reported=null;const local=await server((record,reply)=>{
    if(JSON.stringify(record.body.tools).includes('legion_propose_roles')){
      childCalls+=1;
      if(childCalls===1)completion(reply,protocol(record),'',{payload:{id:'observed-before-failure',version:1,members:[{id:'Observed',name:'Observed',purpose:'真实提交候选',interfaces:[],boundary:['observed.mjs'],documents:[],revision:1,enabled:true,status:'approved'}]}},'legion_propose_roles','propose-before-failure');
      else {reply.writeHead(401,{'content-type':'application/json'});reply.end(JSON.stringify({error:{message:'Invalid API key private-vendor-detail'}}));}return;
    }
    const result=typedResults(record.body).findLast((pair)=>pair.result?.tool==='legion_design_roles');if(result){reported=result;completion(reply,protocol(record),'按真实已观察候选处理');return;}
    completion(reply,protocol(record),'',{payload:{instruction:'提交候选后保持真实失败状态'}},'legion_design_roles','design-partial');
  });const setup=await fixture(local);local.host.manualArchitect=true;
  try{await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'真实部分作用'});const done=await until(setup.pipeline,(state)=>state.turn?.status==='completed');
    assert.equal(reported.result.status,'error');assert.equal(reported.result.reason,'pi_auth_error');assert.equal(reported.decision.allowed,false);assert.equal(reported.result.payload.pendingProposals[0].id,'observed-before-failure');assert.equal(reported.result.payload.pendingProposals[0].status,'pending');assert.equal(done.proposals[0].status,'pending');assert.equal(JSON.stringify(reported).includes('private-vendor-detail'),false);
  }finally{await setup.pipeline.close();await local.close();}
});

test('conversation repair: real SDK repeated Human text remains distinct and answers retain turn order across later messages', async () => {
 let phase=0;const local=await server((record,reply)=>{
  if(phase===0||phase===2){const title='问题'+phase;phase+=1;completion(reply,protocol(record),'',{payload:{kind:'question',purpose:'discussion',title,text:'回答这个具体问题',options:[],allowSupplement:false}},'legion_request_interaction','question-'+phase);return;}
  phase+=1;completion(reply,protocol(record),'对应轮的后续回复');
 });const setup=await fixture(local);
 try{
  for(const index of [1,2]){
   await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'重复文字'});const pending=await until(setup.pipeline,(state)=>state.turn?.status==='waiting');const request=pending.interactions.find((item)=>item.status==='pending');
   const input={projectId:setup.projectId,requestId:request.requestId,version:request.version,requestDigest:request.digest,value:'相同答案'};await setup.pipeline.answerInteraction(input);await setup.pipeline.answerInteraction(input);await until(setup.pipeline,(state)=>state.turn?.status==='completed');
  }
  const done=(await setup.pipeline.getState()).value;assert.deepEqual(done.timeline.messages.map((message)=>message.kind),['human','question','answer','assistant','human','question','answer','assistant']);
  const humans=done.timeline.messages.filter((message)=>message.kind==='human');assert.equal(humans[0].text,humans[1].text);assert.notEqual(humans[0].id,humans[1].id);assert.equal(done.timeline.messages.filter((message)=>message.kind==='answer').length,2);
 }finally{await setup.pipeline.close();await local.close();}
});

test('prompt repair repro: long real SDK conversation keeps full UI journal without resending it or orphaning refused turns', async () => {
 const replyText='实际长期回复 '+ 'x'.repeat(1800);const local=await server((record,reply)=>completion(reply,protocol(record),replyText));const setup=await fixture(local);
 try{
  for(let index=0;index<40;index++){
   const started=await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'第'+index+'轮明确消息'});assert.equal(started.ok,true,JSON.stringify(started.error));await until(setup.pipeline,(state)=>state.turn?.status==='completed');
  }
  const done=(await setup.pipeline.getState()).value;assert.equal(done.timeline.messages.filter((message)=>message.kind==='human').length,40);assert.equal(done.timeline.messages.filter((message)=>message.kind==='assistant').length,40);assert.ok(JSON.stringify(done.timeline).length>65536);
  assert.ok(local.calls.every((record)=>strings(record.body).filter((text)=>text.startsWith('你是项目唯一ProjectManager。')).every((text)=>text.length<=65536)));
 }finally{await setup.pipeline.close();await local.close();}
});

test('prompt repair: oversized selected context makes no model call or running anchor and later valid input remains usable', async () => {
 const local=await server((record,reply)=>completion(reply,protocol(record),'正常继续'));const setup=await fixture(local);
 try{
  await writeFile(join(setup.root,'selected.txt'),'明确上下文 '+ 'x'.repeat(65000));assert.equal((await setup.pipeline.selectContext({projectId:setup.projectId,resources:['selected.txt']})).ok,true);
  const rejected=await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'保留全部所选上下文'});assert.equal(rejected.error.code,'prompt_budget');assert.equal(local.calls.length,0);const state=(await setup.pipeline.getState()).value;assert.ok(!state.timeline.turns.some((turn)=>turn.status==='running'));assert.equal(state.context.files[0].resource,'selected.txt');
  await setup.pipeline.selectContext({projectId:setup.projectId,resources:[]});assert.equal((await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'较小明确输入'})).ok,true);const done=await until(setup.pipeline,(state)=>state.turn?.status==='completed');assert.equal(done.turn.text,'正常继续');
 }finally{await setup.pipeline.close();await local.close();}
});


// Written for the workflow repair; intentionally not executed in this user-directed turn.
test('pending regression: cancellation and restart restore the original Human requirement and real answered discussion to the next PM SDK call', async () => {
  let asking = true; let nextBody = ''; const local = await server((record, reply) => {
    if (!asking) { nextBody = JSON.stringify(record.body); completion(reply, protocol(record), '真实上下文已保留'); return; }
    const answer = typedResults(record.body).findLast((pair) => pair.result?.tool === 'legion_request_interaction' && pair.result.payload?.interaction?.answer);
    if (answer) completion(reply, protocol(record), '', { payload: { kind: 'question', purpose: 'discussion', title: '后续待取消', text: '是否继续细化？', options: [], allowSupplement: false } }, 'legion_request_interaction', 'question-next');
    else completion(reply, protocol(record), '', { payload: { kind: 'question', purpose: 'discussion', title: '技术选择', text: '需要使用哪个技术？', options: [], allowSupplement: false } }, 'legion_request_interaction', 'question-platform');
  }); const setup = await fixture(local); let restored = null;
  try {
    await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '原始需求：实现 Node 与 TypeScript 项目' }); const waiting = await until(setup.pipeline, (state) => state.turn?.status === 'waiting'); const request = waiting.interactions.find((request) => request.status === 'pending');
    await setup.pipeline.answerInteraction({ projectId: setup.projectId, requestId: request.requestId, version: request.version, requestDigest: request.digest, value: '明确选择 TypeScript' });
    const later = await until(setup.pipeline, (state) => state.turn?.status === 'waiting' && state.interactions.some((request) => request.title === '后续待取消')); await setup.pipeline.cancelTurn({ projectId: setup.projectId, turnId: later.turn.id }); asking = false;
    await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '继续原需求' }); await until(setup.pipeline, (state) => state.turn?.status === 'completed'); assert.ok(nextBody.includes('原始需求：实现 Node 与 TypeScript 项目')); assert.ok(nextBody.includes('明确选择 TypeScript')); assert.ok(nextBody.includes('技术选择'));
    await setup.pipeline.close(); restored = new WorkbenchPipelineImpl({ userDataDir: setup.data , leaseRoot:join(setup.data,'..','isolated-project-leases')}, { profiles: setup.reopenProfiles() }); const selected = await restored.selectProject(setup.root); await restored.sendMessage({ projectId: selected.value.currentProject.id, roleId: 'Supervisor', text: '重启后继续' }); await until(restored, (state) => state.turn?.status === 'completed'); assert.ok(nextBody.includes('原始需求：实现 Node 与 TypeScript 项目')); assert.ok(nextBody.includes('明确选择 TypeScript'));
  } finally { if (restored) await restored.close(); await setup.pipeline.close(); await local.close(); }
});

test('pending regression: architect receives complete original Human context, records actual root listing/text facts and returns one complete instance proposal', async () => {
  let childPrompt = ''; let childContext = ''; let proposed = false; const members = ['Backend', 'Frontend', 'Storage'].map((id) => ({ id, name: id, purpose: '实现本次Node项目', interfaces: ['public interface'], boundary: ['src/' + id.toLowerCase() + '.mjs'], documents: [], revision: 1, enabled: true, status: 'approved' }));
  const local = await server((record, reply) => {
    if (JSON.stringify(record.body.tools).includes('legion_propose_roles')) {
      childPrompt = strings(record.body).find((text) => text.startsWith('你是RoleArchitect。')) ?? childPrompt; childContext = JSON.stringify(record.body); const results = typedResults(record.body);
      if (!results.some((pair) => pair.result?.status === 'listed')) { completion(reply, protocol(record), '开始完整角色设计', { resource: '' }, 'legion_list_files', 'root-list'); return; }
      if (!results.some((pair) => pair.result?.tool === 'legion_propose_roles')) { proposed = true; completion(reply, protocol(record), '', { payload: { id: 'full-team', version: 1, members } }, 'legion_propose_roles', 'full-proposal'); return; }
      completion(reply, protocol(record), '本次完整角色方案已一次提交'); return;
    }
    if (typedResults(record.body).some((pair) => pair.result?.tool === 'legion_design_roles')) { completion(reply, protocol(record), '收到完整待审方案'); return; }
    completion(reply, protocol(record), '', { payload: { instruction: '按已确认上下文给出完整团队' } }, 'legion_design_roles', 'design-team');
  }); local.host.manualArchitect = true; const setup = await fixture(local);
  try {
    await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '原始需求：Node与TypeScript，包括前端、后端和存储' }); const done = await until(setup.pipeline, (state) => state.turn?.status === 'completed'); assert.equal(proposed, true); assert.ok(childContext.includes('原始需求：Node与TypeScript，包括前端、后端和存储')); assert.ok(strings(JSON.parse(childContext)).some((text) => text === '原始需求：Node与TypeScript，包括前端、后端和存储')); assert.ok(childPrompt.includes('四系统固定职责约束')); assert.ok(childPrompt.includes('开发成员可按revision+1修订')); assert.equal(childPrompt.includes('通常1至2名'), false); assert.equal(done.proposals.length, 1); assert.equal(done.proposals[0].members.length, 3);
    const journal = done.memberConversations; const run = journal.runs.find((run) => run.roleId === 'RoleArchitect'); assert.ok(run); assert.equal(run.status, 'completed'); const events = journal.events.filter((event) => event.conversationId === run.id); assert.ok(events.some((event) => event.kind === 'assistant_text' && event.text.includes('开始完整角色设计'))); assert.ok(events.some((event) => event.kind === 'tool_result' && event.tool === 'legion_list_files')); assert.equal(events.filter((event) => event.tool === 'legion_list_files').every((event) => event.resource === null), true); assert.equal(done.timeline.messages.some((message) => message.text.includes('开始完整角色设计')), false);
  } finally { await setup.pipeline.close(); await local.close(); }
});

test('pending regression: generation change while architect is working interrupts only its captured old run and accepts no late text', async () => {
  let designing = false; const local = await server((record, reply) => {
    if (JSON.stringify(record.body.tools).includes('legion_propose_roles')) { designing = true; reply.writeHead(200, { 'content-type': 'text/event-stream' }); sse(reply, { id: 'architect-live', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content: '真实架构文字' }, finish_reason: null }] }); return; }
    completion(reply, protocol(record), '', { payload: { instruction: '完整角色方案' } }, 'legion_design_roles', 'design-stop');
  }); local.host.manualArchitect = true; const setup = await fixture(local);
  try {
    await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '需完整角色方案' }); await until(setup.pipeline, (state) => designing && state.memberConversations.runs.some((run) => run.status === 'running'));
    await setup.pipeline.setDefaultProfile({ profileId: setup.ids[1] }); const stopped = await setup.pipeline.getState(); assert.equal(stopped.value.memberConversations.runs.some((run) => run.status === 'running'), false); assert.ok(stopped.value.memberConversations.runs.some((run) => ['cancelled', 'interrupted'].includes(run.status)));
  } finally { await setup.pipeline.close(); await local.close(); }
});

test('pending regression: unsafe worker write still receives the original denial while member metadata never retains an unsafe path', async () => {
  let candidate; const local = await server((record, reply) => {
    if (isCustomerCall(record.body)) { completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```'); return; }
    if (!hasResult(record.body)) completion(reply, protocol(record), '', { resource: '../outside-denied.txt', content: '不得写入' }); else completion(reply, protocol(record), '权限拒绝后结束');
  }); const setup = await fixture(local); candidate = proposal([setup.ids[0]]);
  try {
    await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '保持精确文件权限' }); const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft'); await setup.pipeline.confirmPlan({ projectId: setup.projectId, planDigest: draft.plan.planDigest }); const done = await until(setup.pipeline, (state) => ['failed', 'invalidated'].includes(state.plan?.status));
    assert.equal(done.tasks[0].results.some((result) => result.success), false); assert.ok(local.calls.flatMap((record) => typedResults(record.body)).some((pair) => pair.result?.status === 'denied' || pair.decision?.outcome === 'deny')); assert.equal(JSON.stringify(done.memberConversations).includes('../outside-denied.txt'), false);
  } finally { await setup.pipeline.close(); await local.close(); }
});


test('actual SDK role-proposal rejection returns a safe field/expected and one corrected complete proposal under unchanged permissions', async () => {
  let validation = null; let tries = 0; const definition = { id: 'BackendTyped', name: '后端', purpose: '维护业务服务', interfaces: ['service API'], boundary: ['src/backend.mjs'], documents: [], revision: 1, enabled: true, status: 'approved' };
  const local = await server((record, reply) => {
    if (JSON.stringify(record.body.tools).includes('legion_propose_roles')) { const result = typedResults(record.body).findLast((pair) => pair.result?.tool === 'legion_propose_roles'); if (result?.result.status === 'completed') { completion(reply, protocol(record), '完整候选已提交'); return; } if (result) { validation = result.result.payload.validation; assert.equal(result.decision.allowed, false); assert.equal(result.result.reason, 'invalid_role_resource'); assert.equal(validation.field, 'members[0].boundary[0]'); assert.equal(JSON.stringify(validation).includes('职责:不能含API secret'), false); } tries += 1; let boundary = ['职责:不能含API secret']; if (result) boundary = ['src/backend.mjs']; completion(reply, protocol(record), '', { payload: { id: 'typed-team', version: 1, members: [{ ...definition, boundary }] } }, 'legion_propose_roles', 'typed-' + tries); return; }
    if (typedResults(record.body).some((pair) => pair.result?.tool === 'legion_design_roles')) { completion(reply, protocol(record), '收到待审完整候选'); return; } completion(reply, protocol(record), '', { payload: { instruction: '根据真实需求一次完整提交' } }, 'legion_design_roles', 'typed-design');
  }); local.host.manualArchitect = true; const setup = await fixture(local);
  try { await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '后端业务需要真实精确文件' }); const done = await until(setup.pipeline, (state) => state.turn?.status === 'completed'); assert.ok(validation); assert.equal(tries, 2); assert.equal(done.proposals.length, 1); assert.equal(done.proposals[0].status, 'pending'); assert.equal(done.organization.members.some((role) => role.id === 'BackendTyped'), false); assert.equal(done.roles.find((role) => role.id === 'RoleArchitect').profileId, setup.ids[0]); assert.equal(done.plan, null); assert.deepEqual(await businessEntries(setup.root), []); } finally { await setup.pipeline.close(); await local.close(); }
});

import { createOrganizationService } from '../../src/services/public/organization.mjs';
async function seedRoleContext(setup, messages) { const projects = createProjectService({ userDataDir: setup.data }); const organization = createOrganizationService({ userDataDir: setup.data }); try { const project = (await projects.select(setup.root)).value; for (const [index, message] of messages.entries()) { const turnId = 'seed-turn-' + index; await organization.beginTurn(project, { turnId, userMessageId: 'seed-human-' + index, continuationAnswerId: null, text: message.text, createdAt: '2026-10-09T00:00:00.000Z' }); await organization.finishTurn(project, { turnId, status: 'cancelled', assistantText: '', messageId: 'seed-end-' + index, createdAt: '2026-10-09T00:00:00.000Z' }); } } finally { await organization.close(); await projects.close(); } }
test('actual SDK automatic tool-less compaction covers old Human, preserves raw archive and restores PM across restart/project isolation', async () => {
  const local = await server((record, reply) => { if (!(record.body.tools?.length)) { assert.equal(record.body.max_tokens ?? record.body.max_completion_tokens, 2048); completion(reply, protocol(record), '模型生成完整摘要：最初目标alpha；最近决定与任务继续保留。'); return; } completion(reply, protocol(record), '正常延续真实上下文'); }); const setup = await fixture(local); let reopened;
  try {
    await seedRoleContext(setup, Array.from({ length: 100 }, (_, index) => ({ role: 'user', text: '最初目标alpha ' + index + ' ' + 'x'.repeat(580) })));
    assert.equal((await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '本次完整新增需求omega' })).ok, true); const first = await until(setup.pipeline, (state) => state.turn?.status === 'completed'); assert.equal(local.calls.filter((record) => !record.body.tools?.length).length, 1); assert.equal(first.timeline.messages.filter((message) => message.kind === 'human').length, 101); assert.equal(first.timeline.messages.findLast((message) => message.kind === 'human').text, '本次完整新增需求omega'); assert.ok(first.roleMemory.entries[0].coveredMessages > 0);
    const body = JSON.stringify(local.calls.findLast((record) => record.body.tools?.length)); assert.match(body, /模型生成完整摘要/u); assert.match(body, /新增需求omega/u); assert.equal(strings(local.calls.findLast((record) => record.body.tools?.length).body).some((text) => text === '最初目标alpha 0 ' + 'x'.repeat(580)), false);
    await setup.pipeline.close(); reopened = new WorkbenchPipelineImpl({ userDataDir: setup.data , leaseRoot:join(setup.data,'..','isolated-project-leases')}, { profiles: setup.reopenProfiles() }); await reopened.selectProject(setup.root); assert.equal((await reopened.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '重启后继续' })).ok, true); await until(reopened, (state) => state.turn?.status === 'completed'); const resumed = JSON.stringify(local.calls.at(-1).body); assert.match(resumed, /模型生成完整摘要/u); assert.match(resumed, /新增需求omega/u); assert.equal(typedResults(local.calls.at(-1).body).length, 0);
    const other = join(setup.location, 'other-customer'); await mkdir(other); const changed = (await reopened.selectProject(other)).value; await reopened.sendMessage({ projectId: changed.currentProject.id, roleId: 'Supervisor', text: '独立项目新需求' }); await until(reopened, (state) => state.turn?.status === 'completed'); assert.equal(JSON.stringify(local.calls.at(-1).body).includes('最初目标alpha'), false); assert.equal(JSON.stringify(local.calls.at(-1).body).includes('新增需求omega'), false);
  } finally { if (reopened) await reopened.close(); await setup.pipeline.close(); await local.close(); }
});
test('actual SDK summary HTTP failure, length finish, overlong output and unexpected tool cannot replace memory or execute tools', async () => {
  for (const mode of ['http', 'length', 'overlong', 'tool']) {
    const local = await server((record, reply) => { if (!record.body.tools?.length) { if (mode === 'http') { reply.writeHead(401, { 'content-type': 'application/json' }); reply.end(JSON.stringify({ error: { message: 'private-summary-sdk-body' } })); return; } if (mode === 'length') { reply.writeHead(200, { 'content-type': 'text/event-stream' }); sse(reply, { id: 'chat', object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content: '看起来完整但实际length' }, finish_reason: null }] }); sse(reply, { id: 'chat', object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'length' }] }); reply.end('data: [DONE]\n\n'); return; } if (mode === 'overlong') completion(reply, protocol(record), 'x'.repeat(8193)); else completion(reply, protocol(record), '', { resource: 'never-write.txt', content: 'forbidden' }, 'legion_write_file'); return; } completion(reply, protocol(record), '保留旧上下文后继续'); }); const setup = await fixture(local);
    try { await seedRoleContext(setup, Array.from({ length: 90 }, (_, index) => ({ role: 'user', text: '必须保留目标' + index + 'x'.repeat(500) }))); const started = await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '当前需求保持完整' }); assert.equal(started.ok, true); const done = await until(setup.pipeline, (state) => state.turn?.status === 'completed'); assert.equal(local.calls.filter((record) => !record.body.tools?.length).length, 1); assert.ok(done.memoryNotices.length); assert.equal(done.roleMemory.entries[0].hasSummary, false); assert.equal(done.roleMemory.entries[0].coveredMessages, 0); assert.equal(done.timeline.messages.filter((message) => message.kind === 'human').length, 91); assert.equal(done.timeline.messages.findLast((message) => message.kind === 'human').text, '当前需求保持完整'); assert.equal(JSON.stringify(done).includes('private-summary-sdk-body'), false); assert.deepEqual(await businessEntries(setup.root), []); }
    finally { await setup.pipeline.close(); await local.close(); }
  }
});
test('actual SDK cancellation during automatic summary preserves original Human and leaves no running turn', async () => {
  let held = false; const local = await server((record, reply) => { if (!record.body.tools?.length) { held = true; return; } completion(reply, protocol(record), '后续正常回复'); }); const setup = await fixture(local);
  try {
    await seedRoleContext(setup, Array.from({ length: 90 }, (_, index) => ({ role: 'user', text: '旧需求' + index + 'x'.repeat(500) }))); await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '取消也不能丢失的当前需求' }); const running = await until(setup.pipeline, (state) => held && state.turn?.status === 'running'); const stopped = await setup.pipeline.cancelTurn({ projectId: setup.projectId, turnId: running.turn.id }); assert.equal(stopped.ok, true); const done = (await setup.pipeline.getState()).value; assert.equal(done.turn.status, 'cancelled'); assert.equal(done.timeline.messages.findLast((message) => message.kind === 'human').text, '取消也不能丢失的当前需求'); assert.equal(done.roleMemory?.entries.some((entry) => entry.hasSummary), false); assert.equal(done.timeline.turns.some((turn) => turn.status === 'running'), false);
  } finally { await setup.pipeline.close(); await local.close(); }
});


test('external profile revision preserves strict stale nonce refusal while no old execution authority is issued', async () => {
  let candidate; const local = await server((record, reply) => completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```')); const setup = await fixture(local); candidate = proposal(setup.ids.slice(0, 1));
  try { await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '提出实际计划' }); const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft' && state.turn?.status === 'completed'); const request = draft.interactions.find((item) => item.purpose === 'execute_plan' && item.status === 'pending'); const { hasSavedKey, ...fields } = (await setup.profiles.list()).value.profiles[0]; assert.equal((await setup.profiles.save({ ...fields, name: '其他窗口更改版本', keyAction: 'keep', apiKey: '' })).ok, true);
    const stale = await setup.pipeline.answerInteraction({ projectId: setup.projectId, requestId: request.requestId, version: request.version, requestDigest: request.digest, value: true }); assert.equal(stale.error.code, 'stale_interaction'); assert.deepEqual(await businessEntries(setup.root), []); assert.equal((await setup.pipeline.getState()).value.tasks.some((task) => task.status === 'running'), false);
  } finally { await setup.pipeline.close(); await local.close(); }
});

test('actual SDK architect compacts old long own replies but receives active current Human verbatim outside the summary call', async () => {
  let designs = 0; let managerRound = 0; const initialBodies = []; const latest = '最新完整需求：所有边界细节XYZ必须原样交付架构师' + 'z'.repeat(1000); const summaries = [];
  const local = await server((record, reply) => {
    const toolText = JSON.stringify(record.body.tools ?? []); const results = typedResults(record.body);
    if (!record.body.tools?.length) { summaries.push(record.body); assert.equal(JSON.stringify(record.body).includes(latest), false); completion(reply, protocol(record), '整理较早架构师任务和回复；保留原接口规划与待审候选。'); return; }
    if (toolText.includes('legion_propose_roles')) {
      if (results.some((pair) => pair.result?.tool === 'legion_propose_roles')) { completion(reply, protocol(record), '完整候选已提交'); return; }
      designs += 1; initialBodies.push(record.body); let text = ''; if (designs === 1) text = '旧架构师真实长回复 ' + 'x'.repeat(45000);
      completion(reply, protocol(record), text, { payload: { id: 'context-candidate-' + designs, version: 1, members: [{ id: 'ContextMember', name: '上下文成员', purpose: '实现真实需求', interfaces: [], boundary: ['src/context.mjs'], documents: [], revision: 1, enabled: true, status: 'approved' }] } }, 'legion_propose_roles', 'proposal-' + designs); return;
    }
    if (results.some((pair) => pair.result?.tool === 'legion_design_roles')) { completion(reply, protocol(record), '已收到完整待审候选'); return; }
    managerRound += 1; completion(reply, protocol(record), '', { payload: { instruction: '只含PM本次委托简报' + managerRound } }, 'legion_design_roles', 'design-' + managerRound);
  }); local.host.manualArchitect = true; const setup = await fixture(local);
  try { await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '最初架构任务' }); await until(setup.pipeline, (state) => state.turn?.status === 'completed'); await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: latest }); const done = await until(setup.pipeline, (state) => state.turn?.status === 'completed');
    assert.equal(designs, 2); assert.equal(summaries.length, 1); assert.ok(strings(initialBodies[1]).some((text) => text === latest)); assert.match(JSON.stringify(initialBodies[1]), /整理较早架构师任务/u); assert.equal(strings(initialBodies[1]).some((text) => text.includes('旧架构师真实长回复')), false); assert.equal(done.timeline.messages.filter((message) => message.kind === 'human').at(-1).text, latest); assert.ok(done.memberConversations.events.some((event) => event.kind === 'assistant_text' && event.text.length >= 45000)); assert.equal(done.proposals.length, 2);
  } finally { await setup.pipeline.close(); await local.close(); }
});

test('actual SDK worker after completed PM plan keeps new18000-char Human intact while compacting its prior45000-char own context', async () => {
  let candidate; let pendingPlan = true; let phase = 1; const starts = []; const summaries = []; const latest = '这轮完整新要求（PM已结束仍未交给Worker0）' + 'q'.repeat(18000);
  const local = await server((record, reply) => {
    if (!record.body.tools?.length) { summaries.push(record.body); assert.equal(JSON.stringify(record.body).includes(latest), false); completion(reply, protocol(record), '前轮Worker0的真实任务输入、写入与检查已整理；历史不表示本轮授权或通过。'); return; }
    const task = taskMetadata(record.body);
    if (task) { if (!hasResult(record.body)) { starts.push(record.body); completion(reply, protocol(record), '', { resource: 'file0.txt', content: '真实内容' + phase }); } else completion(reply, protocol(record), phase === 1 ? 'Worker0前轮真实长回复 ' + 'x'.repeat(45000) : '本轮自测与写入完成'); return; }
    if (pendingPlan) { pendingPlan = false; completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```'); return; }
    completion(reply, protocol(record), '继续等待确切实施确认');
  }); const setup = await fixture(local); candidate = proposal([setup.ids[0]]);
  try {
    await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: '前轮需求' }); let draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft' && state.turn?.status === 'completed'); await setup.pipeline.confirmPlan({ projectId: setup.projectId, planDigest: draft.plan.planDigest }); await until(setup.pipeline, (state) => state.plan?.status === 'completed');
    phase = 2; pendingPlan = true; candidate = proposal([setup.ids[0]]); candidate.tasks[0].instruction = '本轮追加精确修改'; await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: latest }); draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft' && state.turn?.status === 'completed'); assert.equal(draft.turn.status, 'completed');
    await setup.pipeline.confirmPlan({ projectId: setup.projectId, planDigest: draft.plan.planDigest }); const done = await until(setup.pipeline, (state) => state.plan?.status === 'completed'); assert.equal(starts.length, 2); assert.equal(summaries.length, 1); assert.ok(strings(starts[1]).some((text) => text === latest)); assert.equal(typedResults(starts[1]).length, 0); assert.equal(strings(starts[1]).some((text) => text.includes('Worker0前轮真实长回复')), false); assert.equal(done.timeline.messages.filter((message) => message.kind === 'human').at(-1).text, latest); assert.ok(done.memberConversations.events.some((event) => event.kind === 'assistant_text' && event.text.includes('Worker0前轮真实长回复') && event.text.length >= 45000)); assert.equal(done.roleMemory.entries.find((entry) => entry.roleId === 'Worker0').hasSummary, true);
  } finally { await setup.pipeline.close(); await local.close(); }
});

test('actual SDK large producer writes and failed-check edit hand off latest metadata, child reads current bytes with intact Human/canonical then self-checks', async () => {
  const old = 'CORE_OLD_SENTINEL\n' + 'x'.repeat(26000), current = 'CORE_CURRENT_SENTINEL\n' + 'x'.repeat(26000), edited = current.replace('CORE_CURRENT_SENTINEL', 'CORE_EDITED_SENTINEL'); const extraA = 'parentA\n' + 'y'.repeat(26000), extraB = 'parentB\n' + 'z'.repeat(26000); const expectedSHA = createHash('sha256').update(edited, 'utf8').digest('hex'); const human = '完整Human要求：依赖应由继任自主读取，保留全部确认细节' + 'H'.repeat(1500); let candidate; let planned = false; let childInitial = null; let childRead = false; let requestCount = 0;
  const local = await server((record, reply) => {
    const task = taskMetadata(record.body); const results = typedResults(record.body); requestCount += 1;
    const toolMessages = (record.body.messages ?? []).filter((message) => message.role === 'tool'); const validEnvelopes = toolMessages.every((message) => { try { return Boolean(JSON.parse(message.content).result); } catch { return false; } });
    console.log('handoff-stage:' + JSON.stringify({ request: requestCount, task: task?.id ?? 'PM', hostResults: results.length, statuses: results.map((pair) => pair.result.status), validEnvelopes }));
    if (requestCount > 24) { reply.writeHead(401, { 'content-type': 'application/json' }); reply.end(JSON.stringify({ error: { message: 'finite_fixture_request_bound' } })); return; }
    if (!validEnvelopes) { completion(reply, protocol(record), '夹具发现SDK工具错误，立即按失败收束'); return; }
    if (results.some((pair) => pair.result?.status === 'denied' || pair.result?.status === 'error')) { completion(reply, protocol(record), '夹具拒绝重复被拒请求，按真实失败收束'); return; }
    if (!task) { if (!planned) { planned = true; completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```'); } else completion(reply, protocol(record), '等待真实实施确认'); return; }
    const mutations = results.filter((pair) => pair.result?.success === true); const read = results.findLast((pair) => pair.result?.status === 'read' && pair.result.resource === 'file0.txt');
    if (task.id === 'task0') {
      if (mutations.length === 0) completion(reply, protocol(record), '', { resource: 'file0.txt', content: old }, 'legion_write_file', 'write-old');
      else if (mutations.length === 1) completion(reply, protocol(record), '', { resource: 'file0.txt', content: current }, 'legion_write_file', 'write-current');
      else if (mutations.length === 2) completion(reply, protocol(record), '', { resource: 'parent-a.txt', content: extraA }, 'legion_write_file', 'write-parent-a');
      else if (mutations.length === 3) completion(reply, protocol(record), '', { resource: 'parent-b.txt', content: extraB }, 'legion_write_file', 'write-parent-b');
      else if (!read) completion(reply, protocol(record), '', { resource: 'file0.txt', maxBytes: 65536 }, 'legion_read_file', 'read-before-edit');
      else if (mutations.length === 4 && !results.some((pair) => pair.result?.checkId === 'unit-task0')) completion(reply, protocol(record), '', { checkId: 'unit-task0' }, 'legion_run_check', 'first-failed-check');
      else if (mutations.length === 4) { assert.equal(results.findLast((pair) => pair.result?.checkId === 'unit-task0').result.status, 'failed'); completion(reply, protocol(record), '', { resource: 'file0.txt', expectedSha256: read.result.sha256, replacements: [{ oldText: 'CORE_CURRENT_SENTINEL', newText: 'CORE_EDITED_SENTINEL' }] }, 'legion_edit_file', 'edit-final'); }
      else completion(reply, protocol(record), '依赖producer按失败证据修复并重新自测');
      return;
    }
    if (task.id === 'task1') {
      if (!hasResult(record.body)) { childInitial = record.body; const prompt = strings(record.body).find((text) => text.startsWith('Human已确认任务：')); const metadata = JSON.parse(/依赖任务的最新成功变更元数据（不代表当前自测或验收通过）：([^\n]+)/u.exec(prompt)[1]); assert.equal(metadata.length, 3); const latest = metadata.find((output) => output.resource === 'file0.txt'); assert.equal(latest.contentDigest, expectedSHA); assert.equal(latest.action, 'edit_file'); assert.equal(latest.taskId, 'task0'); assert.equal(latest.roleId, 'Worker0'); assert.equal(metadata.some((output) => Object.hasOwn(output, 'content')), false); assert.ok(strings(record.body).some((text) => text === human)); assert.match(prompt, /"purpose":"实现精确任务"/u); assert.equal(JSON.stringify(record.body).includes('CORE_OLD_SENTINEL'), false); assert.equal(JSON.stringify(record.body).includes('CORE_CURRENT_SENTINEL'), false); assert.equal(prompt.length < 65536, true); completion(reply, protocol(record), '', { resource: 'file0.txt', maxBytes: 65536 }, 'legion_read_file', 'child-read-current'); }
      else if (!mutations.length) { assert.ok(read); childRead = true; assert.equal(read.result.text, edited); assert.equal(read.result.sha256, expectedSHA); completion(reply, protocol(record), '', { resource: 'file1.txt', content: '实际读取依赖:CORE_EDITED_SENTINEL\n' + read.result.sha256 }); }
      else completion(reply, protocol(record), '继任完成自己的写入与真实自测');
      return;
    }
    throw new Error('unexpected_fixture_task');
  }); const setup = await fixture(local); candidate = proposal([setup.ids[0], setup.ids[0]]); candidate.tasks[0].writeSet = ['file0.txt', 'parent-a.txt', 'parent-b.txt']; candidate.tasks[0].instruction = '分多文件写依赖，依据真实失败自测局部修复'; candidate.tasks[1].instruction = '自主读取当前依赖，生成自己的输出再自测';
  try {
    await setup.pipeline.sendMessage({ projectId: setup.projectId, roleId: 'Supervisor', text: human }); const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft' && state.turn?.status === 'completed');
    await writeFile(join(setup.root, 'tests/Acceptance/check-task0.test.mjs'), "import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';test('producer verifies actual dependency bytes',()=>{assert.equal(readFileSync('file0.txt','utf8').startsWith('CORE_EDITED_SENTINEL'),true);assert.ok(readFileSync('parent-a.txt','utf8').length>26000);assert.ok(readFileSync('parent-b.txt','utf8').length>26000);});");
    await writeFile(join(setup.root, 'tests/Acceptance/check-task1.test.mjs'), "import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';test('child validates actual current dependency',()=>{const parent=readFileSync('file0.txt','utf8'),child=readFileSync('file1.txt','utf8');assert.ok(child.includes('CORE_EDITED_SENTINEL'));assert.ok(child.includes(createHash('sha256').update(parent,'utf8').digest('hex')));});");
    assert.equal((await setup.pipeline.confirmPlan({ projectId: setup.projectId, planDigest: draft.plan.planDigest })).ok, true); const done = await until(setup.pipeline, (state) => ['completed', 'failed'].includes(state.plan?.status)); assert.equal(done.plan.status, 'completed', JSON.stringify({ tasks: done.tasks, error: done.error })); assert.ok(childInitial); assert.equal(childRead, true); assert.equal(Buffer.byteLength(edited + extraA + extraB, 'utf8') > 65536, true); assert.equal(await readFile(join(setup.root, 'file0.txt'), 'utf8'), edited); assert.ok(done.tasks.every((task) => task.status === 'completed' && task.checkStatus === 'passed')); const producerChecks = done.evidence.filter((entry) => entry.roleId === 'Worker0'); assert.deepEqual(producerChecks.map((entry) => entry.result.status), ['failed', 'passed']); const latest = done.tasks.find((task) => task.id === 'task0').results.filter((result) => result.resource === 'file0.txt'); assert.equal(latest.length, 3); assert.equal(latest.at(-1).action, 'edit_file'); assert.equal(latest.at(-1).contentDigest, expectedSHA);
  } finally { await setup.pipeline.close(); await local.close(); }
});

function isManagerCall(body) { return JSON.stringify(body.tools ?? []).includes('legion_design_roles'); }
function isCustomerCall(body) {
  const tools=(body.tools??[]).map(tool=>tool.function?.name??tool.name).sort();
  const expected=['legion_delegate_pm','legion_list_files','legion_query_memory','legion_query_role_activity','legion_query_role_log','legion_read_file','legion_remember_fact','legion_request_interaction'];
  return JSON.stringify(tools)===JSON.stringify(expected);
}
function isWorkerCall(body) { return JSON.stringify(body.tools ?? []).includes('legion_write_file') && !JSON.stringify(body.tools ?? []).includes('legion_submit_acceptance'); }

function createProjectService(options){return realCreateProjectService({...options,leaseRoot:join(leaseParent(options.userDataDir),'isolated-project-leases')});}

function runtimePlan(plan){return {...plan,schemaVersion:2,tasks:plan.tasks.map(({writeSet,...task})=>({...task,intent:task.intent??'change'}))};}

for(const answer of ['pending',false,true]) test(`first v1 migration: Human ${answer} preserves old bytes or commits new source only after actual confirmation`,async()=>{
 let candidate,planned=false;
 const local=await server((record,reply)=>{
  const task=taskMetadata(record.body);
  if(!task){if(!planned){planned=true;completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');}else completion(reply,protocol(record),'等待真实迁移确认');return;}
  if(!hasResult(record.body))completion(reply,protocol(record),'',{resource:'file0.txt',content:'v2-owned-effect'});
  else completion(reply,protocol(record),'当前角色真实修改完成');
 });
 const setup=await fixture(local);let pipeline;
 try{
  await setup.pipeline.close();
  const path=join(setup.data,'workbench-projects.json');const catalog=JSON.parse(await readFile(path,'utf8'));const original=catalog.projects[0];
  const {legacyBoundPlan}=await import('../../src/models/workbench.mjs');
  const historical=legacyBoundPlan({goal:'历史活动任务',roles:[{id:'OldBuilder',name:'OldBuilder',purpose:'旧职责',profileId:setup.ids[0]}],tasks:[{id:'legacy-task',title:'历史活动任务',roleId:'OldBuilder',profileId:setup.ids[0],dependsOn:[],writeSet:['must-not-be-claimed.txt'],instruction:'历史许可不能复活'}]},{projectId:setup.projectId,organizationVersion:original.organizationVersion,revision:1,profileBindings:[{profileId:setup.ids[0],profileVersion:'a'.repeat(64),contextSnapshotDigest:'b'.repeat(64)}],contextSnapshotDigest:'c'.repeat(64)});
  const owners=new ProjectFileOwners({projectId:setup.projectId,version:'owners-v7',owners:[{resource:'old-owned.txt',roleId:'OldBuilder'}]});
  catalog.schemaVersion=1;catalog.projects=[{...original,schemaVersion:1,fileOwners:owners,planRevision:1,plan:{...historical,status:'running'},tasks:[{id:'legacy-task',title:'历史活动任务',roleId:'OldBuilder',dependsOn:[],writeSet:['must-not-be-claimed.txt'],status:'running',runId:'old-run',results:[],error:null,updatedAt:'2026-10-09T00:00:00.000Z',checkStatus:'not_executed'}]}];delete catalog.projects[0].legacyHistory;
  const oldBytes=Buffer.from(JSON.stringify(catalog));await writeFile(path,oldBytes);
  pipeline=new WorkbenchPipelineImpl({userDataDir:setup.data,leaseRoot:join(setup.data,'..','isolated-project-leases')},{profiles:setup.reopenProfiles()});
  assert.equal((await pipeline.selectProject(setup.root)).ok,true);candidate=proposal([setup.ids[0]]);
  assert.equal((await pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'准备迁移，先展示现有owner和权威catalog来源'})).ok,true);
  const draft=await until(pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed');const request=draft.interactions.find(item=>item.purpose==='execute_plan'&&item.status==='pending');
  assert.ok(request.text.includes('我确认已关闭该项目所有旧版 Legion 实例，并选择上述 catalog 为本项目权威 owner 来源；同意当前计划。'));assert.ok(request.text.includes(setup.data));assert.ok(request.text.includes(setup.root));assert.ok(request.text.includes('old-owned.txt'));assert.ok(request.text.includes('OldBuilder'));
  assert.deepEqual(await readFile(path),oldBytes);assert.equal(draft.fileOwners.ownerOf('must-not-be-claimed.txt'),'');
  const key=createHash('sha256').update(original.workspaceIdentity.deviceId+':'+original.workspaceIdentity.fileId).digest('hex');const marker=join(setup.data,'..','isolated-project-leases',key+'.owner-source.json');
  await assert.rejects(readFile(marker),{code:'ENOENT'});assert.equal((await readdir(setup.data)).some(name=>name.includes('v1-')&&name.endsWith('.backup.json')),false);
  if(answer==='pending')return;
  assert.equal((await pipeline.answerInteraction({projectId:setup.projectId,requestId:request.requestId,version:request.version,requestDigest:request.digest,value:answer})).ok,true);
  if(answer===false){assert.deepEqual(await readFile(path),oldBytes);await assert.rejects(readFile(marker),{code:'ENOENT'});await assert.rejects(readFile(join(setup.root,'file0.txt')),{code:'ENOENT'});return;}
  const done=await until(pipeline,state=>['completed','failed','invalidated'].includes(state.plan?.status));assert.equal(done.plan.status,'completed',JSON.stringify({tasks:done.tasks,error:done.error}));
  const persisted=JSON.parse(await readFile(path,'utf8'));assert.equal(persisted.schemaVersion,2);assert.equal(persisted.projects[0].schemaVersion,2);assert.equal(persisted.projects[0].legacyHistory[0].plan.status,'running');assert.deepEqual(persisted.projects[0].legacyHistory[0].tasks[0].writeSet,['must-not-be-claimed.txt']);assert.equal(done.fileOwners.ownerOf('must-not-be-claimed.txt'),'');assert.equal(done.fileOwners.ownerOf('old-owned.txt'),'OldBuilder');assert.ok(Number(done.fileOwners.version.match(/\d+$/u)[0])>7);
  const backups=(await readdir(setup.data)).filter(name=>name.includes('v1-')&&name.endsWith('.backup.json'));assert.equal(backups.length,1);assert.deepEqual(await readFile(join(setup.data,backups[0])),oldBytes);assert.equal(JSON.parse(await readFile(marker,'utf8')).source.catalogDirCanonicalPath,setup.data);assert.equal(await readFile(join(setup.root,'file0.txt'),'utf8'),'v2-owned-effect');
  assert.equal(done.plan.tasks.some(task=>Object.hasOwn(task,'writeSet')||Object.hasOwn(task,'generatedOutputs')),false);assert.equal((await pipeline.confirmPlan({projectId:setup.projectId,planDigest:historical.planDigest})).ok,false);
 }finally{if(pipeline)await pipeline.close();await setup.pipeline.close();await local.close();}
});


test('a later same-role real mutation with identical bytes invalidates earlier check evidence',async()=>{
 let candidate,planned=false;
 const local=await server((record,reply)=>{
  const task=taskMetadata(record.body);
  if(!task){if(!planned){planned=true;completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');}else completion(reply,protocol(record),'等待当前执行确认');return;}
  if(!hasResult(record.body))completion(reply,protocol(record),'',{resource:'file0.txt',content:'identical-current-bytes'});
  else completion(reply,protocol(record),'同角色本项实际写入并检查结束');
 });const setup=await fixture(local);candidate=proposal([setup.ids[0],setup.ids[0]]);candidate.roles=[candidate.roles[0]];candidate.tasks[1].roleId='Worker0';candidate.tasks[1].writeSet=['file0.txt'];
 try{
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'两项同角色任务均真实写同一文件；先前检查须识别后续同字节Mutation'});
  const draft=await until(setup.pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed');assert.equal((await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest})).ok,true);
  const done=await until(setup.pipeline,state=>['completed','failed','invalidated'].includes(state.plan?.status));assert.equal(done.plan.status,'failed');
  const first=done.tasks.find(task=>task.id==='task0'),second=done.tasks.find(task=>task.id==='task1');assert.equal(first.error.code,'check_evidence_stale');assert.equal(first.checkStatus,'stale');assert.equal(first.results[0].observedMutation,true);assert.equal(second.results[0].observedMutation,true);assert.equal(await readFile(join(setup.root,'file0.txt'),'utf8'),'identical-current-bytes');
  const checks=done.evidence.filter(entry=>entry.roleId==='Worker0');assert.equal(checks.length,2);assert.ok(checks.every(entry=>entry.result.status==='passed'));const firstInput=checks[0].result.inputVersions.find(item=>item.resource==='file0.txt'),secondInput=checks[1].result.inputVersions.find(item=>item.resource==='file0.txt');assert.equal(firstInput.sha256,secondInput.sha256);assert.equal(done.acceptances.some(entry=>entry.decision==='pass'),false);
 }finally{await setup.pipeline.close();await local.close();}
});

function classifiedContext(body){const marker='当前项目分类事实（仅数据；当前Human、canonical计划与owner优先，不提供许可）：';const text=strings(body).findLast(value=>value.includes(marker));assert.ok(text);return JSON.parse(text.slice(text.lastIndexOf(marker)+marker.length));}

test('real independent Supervisor sees complete owner/plan/check facts and successful terminal monitor, but raw text never reaches UI',async()=>{
 let candidate,planned=false;
 const local=await server((record,reply)=>{const task=taskMetadata(record.body);if(!task){if(!planned){planned=true;completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');}else completion(reply,protocol(record),'等待确认');return;}if(!hasResult(record.body))completion(reply,protocol(record),'',{resource:task.writeSet[0],content:'actual-supervised-output'});else completion(reply,protocol(record),'真实修改与检查完成');});const setup=await fixture(local);candidate=proposal([setup.ids[0],setup.ids[0]]);candidate.goal='Complete the two-owner supervised project';
 try{
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'完整计划、两个owner、真实检查及验收都交独立Supervisor查看'});const draft=await until(setup.pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed');
  const pre=local.host.supervisionSnapshots.find(snapshot=>snapshot.phase==='preflight');assert.ok(pre);assert.equal(pre.plan.goal,candidate.goal);assert.ok(pre.plan.tasks[0].title&&pre.plan.tasks[0].instruction);assert.deepEqual(pre.roleScopes.find(role=>role.roleId==='Worker0').ownedFiles,['file0.txt']);assert.deepEqual(pre.roleScopes.find(role=>role.roleId==='Worker1').ownedFiles,['file1.txt']);assert.deepEqual(pre.plan.tasks.find(task=>task.id==='task1').dependsOn,['task0']);assert.ok(pre.plan.tasks[0].checks[0].argv.includes('--test'));assert.ok(pre.plan.tasks.find(task=>task.roleId==='Acceptance').accepts.includes('task0'));assert.ok(pre.roles.some(role=>role.id==='Worker0'&&role.purpose));
  const supervisorCalls=local.calls.filter(record=>JSON.stringify(record.body.tools).includes('legion_submit_supervision'));assert.ok(supervisorCalls.length>=2);for(const record of supervisorCalls)assert.equal(/legion_write_file|legion_edit_file|legion_run_check|legion_request_shell/u.test(JSON.stringify(record.body.tools)),false);
  await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest});const done=await until(setup.pipeline,state=>state.plan?.status==='completed');
  for(let i=0;i<300&&!local.host.supervisionSnapshots.some(snapshot=>snapshot.phase==='monitor'&&snapshot.execution.every(task=>task.status==='completed'));i++)await delay(5);
  const monitor=local.host.supervisionSnapshots.find(snapshot=>snapshot.phase==='monitor'&&snapshot.execution.every(task=>task.status==='completed'));assert.ok(monitor);assert.ok(monitor.checks.every(check=>check.status==='passed'&&check.executed));assert.ok(monitor.acceptances.some(item=>item.decision==='pass'));assert.equal(JSON.stringify(done).includes('SUPERVISOR_PRIVATE_RAW_TEXT_CANARY'),false);assert.ok(done.memberConversations.runs.some(run=>run.roleId==='Supervisor'&&run.channel==='su_customer'));assert.ok(done.memberConversations.runs.some(run=>run.roleId==='Supervisor'&&run.channel==='supervision_preflight'));assert.equal(done.memberConversations.events.some(event=>event.kind==='assistant_text'&&done.memberConversations.runs.find(run=>run.id===event.conversationId)?.channel==='supervision_preflight'),false);
 }finally{await setup.pipeline.close();await local.close();}
});

test('text-only Supervisor preflight remains incomplete and cannot expose execution confirmation or grant',async()=>{
 let candidate,planned=false;const local=await server((record,reply)=>{if(!planned){planned=true;completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');}else completion(reply,protocol(record),'等待合法预检');});const setup=await fixture(local);local.host.supervisionMode='text-only';candidate=proposal([setup.ids[0]]);
 try{await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'预检文字不算 typed建议'});const failed=await until(setup.pipeline,state=>state.error?.code==='preflight_incomplete'&&state.turn?.status==='completed');assert.equal(failed.error.code,'preflight_incomplete');assert.equal(failed.supervisions.find(item=>item.phase==='preflight').status,'failed');assert.equal(failed.supervisions.find(item=>item.phase==='preflight').advice,null);assert.equal(failed.interactions.some(request=>request.purpose==='execute_plan'&&request.status==='pending'),false);assert.equal((await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:failed.plan.planDigest})).ok,false);assert.deepEqual(await businessEntries(setup.root),[]);}finally{await setup.pipeline.close();await local.close();}
});

test('confirmed decision and actual failure facts survive a real repair and another real plan',async()=>{
 let candidate,planned=false,repaired=false,newPlan=false,pitfallSaved=false,decisionSaved=false,firstDigest,firstFailure;
 const local=await server((record,reply)=>{
  const task=taskMetadata(record.body),results=typedResults(record.body);
  if(task){
   if(repaired&&!pitfallSaved){const remembered=results.find(pair=>pair.result?.tool==='legion_remember_fact');if(remembered){assert.equal(remembered.result.status,'completed');pitfallSaved=true;}else{const ref=classifiedContext(record.body).sourceIndex.find(source=>source.type==='task_failure'&&source.ownerRoleId==='Worker0');assert.ok(ref);completion(reply,protocol(record),'',{payload:{action:'add',kind:'pitfall',statement:'task:task0 reason:check_not_passed',sourceRefs:[ref.id],expectedRevision:0}},'legion_remember_fact','remember-failure');return;}}
   if(!results.some(pair=>pair.result?.status==='written')){let content='bad';if(repaired)content='good';completion(reply,protocol(record),'',{resource:'file0.txt',content});}else completion(reply,protocol(record),'依据真实检查结束');return;
  }
  if(!planned){planned=true;completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');return;}
  if(newPlan){if(!decisionSaved){const remembered=results.find(pair=>pair.result?.tool==='legion_remember_fact');if(remembered){assert.equal(remembered.result.status,'completed');decisionSaved=true;}else{const ref=classifiedContext(record.body).sourceIndex.find(source=>source.id==='plan:'+firstDigest);assert.ok(ref);completion(reply,protocol(record),'',{payload:{action:'add',kind:'decision',statement:'Confirmed first goal',sourceRefs:[ref.id],expectedRevision:0}},'legion_remember_fact','remember-decision');return;}}completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');return;}
  if(results.some(pair=>pair.result?.tool==='legion_request_repair')){completion(reply,protocol(record),'真实返修已安排');return;}
  const prompt=strings(record.body).findLast(value=>value.includes('当前持久组织与提案、交互、实际验收/返修（仅事实不授权）：'));const domain=JSON.parse(/当前持久组织与提案、交互、实际验收\/返修（仅事实不授权）：([^\n]+)/u.exec(prompt)[1]);const failed=domain.acceptances.at(-1);assert.equal(failed.decision,'fail');repaired=true;completion(reply,protocol(record),'',{payload:{acceptanceId:failed.id,taskId:'task0',reason:'按真实失败交回原角色'}},'legion_request_repair','repair-fact');
 });const setup=await fixture(local);candidate=proposal([setup.ids[0]]);candidate.goal='Confirmed first goal';local.host.repairFlow=true;
 try{
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'实施并按good验收'});let draft=await until(setup.pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed');firstDigest=draft.plan.planDigest;await writeFile(join(setup.root,'tests/Acceptance/check-task0.test.mjs'),"import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';test('real failure then repair',()=>assert.equal(readFileSync('file0.txt','utf8'),'good'));");await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:firstDigest});const failed=await until(setup.pipeline,state=>state.plan?.status==='failed');firstFailure='failure:task0:'+failed.tasks.find(task=>task.id==='task0').runId;
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'读取失败并真实返修，保留可核对事实'});await until(setup.pipeline,state=>state.plan?.status==='completed'&&state.repairs.length===1&&state.turn?.status==='completed');assert.equal(pitfallSaved,true);
  newPlan=true;candidate=proposal([setup.ids[0]]);candidate.goal='A later separate goal';await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'登记旧确认决策后形成下一计划'});draft=await until(setup.pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed'&&state.plan.planDigest!==firstDigest);assert.equal(decisionSaved,true);
  const projects=createProjectService({userDataDir:setup.data}),organizations=createOrganizationService({userDataDir:setup.data});try{const project=(await projects.catalog()).value.projects.find(item=>item.id===setup.projectId);const registry=await organizations.memorySources(project);assert.ok(registry.sources.some(source=>source.id===firstFailure&&source.type==='task_failure'));assert.ok(registry.sources.some(source=>source.id==='plan:'+firstDigest&&source.type==='confirmed_plan'));const {createMemoryService}=await import('../../src/services/public/memory.mjs');const facts=createMemoryService({userDataDir:setup.data});try{const view=await facts.query(project,{}, {projectId:project.id,roleId:'Acceptance',instanceId:'reader',runId:'current-read'},registry);assert.ok(view.facts.some(fact=>fact.kind==='pitfall'&&fact.ownerRoleId==='Worker0'));assert.ok(view.facts.some(fact=>fact.kind==='decision'&&fact.statement==='Confirmed first goal'));assert.equal(JSON.stringify(draft).includes('task:task0 reason:check_not_passed'),false);}finally{await facts.close();}}finally{await projects.close();await organizations.close();}
 }finally{await setup.pipeline.close();await local.close();}
});


test('parallel real SDK: different owners overlap, queued Checks complete and metadata retains all instances/results', async () => {
 let candidate; const waiting=[]; const seen=new Set(); let simultaneous=false;
 const local=await server((record,reply)=>{
   if(isCustomerCall(record.body))return completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');
   const task=taskMetadata(record.body);
   if(!hasResult(record.body)){
     seen.add(task.id); waiting.push(()=>completion(reply,protocol(record),'',{resource:'file'+task.id.slice(-1)+'.txt',content:'parallel-'+task.id}));
     if(seen.size===3){simultaneous=true;for(const release of waiting)release();}
   }else completion(reply,protocol(record),'当前真实输出已完成');
 });const setup=await fixture(local);candidate=proposal(setup.ids,true);
 try{
  assert.equal((await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'三个独占角色并行实施'})).ok,true);
  const draft=await until(setup.pipeline,state=>state.turn?.status==='completed');assert.equal(draft.plan.status,'draft');
  assert.equal((await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest})).ok,true);
  const done=await until(setup.pipeline,state=>['completed','failed','invalidated'].includes(state.plan.status));
  assert.equal(simultaneous,true);assert.equal(done.plan.status,'completed',JSON.stringify(done.tasks));
  assert.equal(new Set(done.tasks.map(task=>task.runId)).size,4);
  for(const task of done.tasks){assert.equal(task.status,'completed');assert.equal(task.checkStatus,'passed');assert.ok(task.evidenceIds.length);assert.ok(task.results.some(result=>result.success&&result.observedMutation));}
  for(let i=0;i<3;i++)assert.equal(await readFile(join(setup.root,'file'+i+'.txt'),'utf8'),'parallel-task'+i);
  const stored=JSON.parse(await readFile(join(setup.data,'workbench-projects.json'),'utf8')).projects.find(project=>project.id===setup.projectId);
  assert.deepEqual(stored.tasks.map(task=>({id:task.id,runId:task.runId,results:task.results,evidenceIds:task.evidenceIds})),done.tasks.map(task=>({id:task.id,runId:task.runId,results:task.results,evidenceIds:task.evidenceIds})));
 }finally{await setup.pipeline.close();await local.close();}
});

test('parallel real SDK: same-role independent tasks remain serial while another owner overlaps',async()=>{
 let candidate;let setup;let overlap=false;let firstFinished=false;const starts=[];const held=new Map();
 const local=await server(async(record,reply)=>{
  if(isCustomerCall(record.body))return completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');
  const task=taskMetadata(record.body);
  if(!hasResult(record.body)){
   starts.push(task.id);
   if(task.id==='task0')held.set(task.id,()=>completion(reply,protocol(record),'',{resource:'file0.txt',content:'same-role-first'}));
   if(task.id==='task2')held.set(task.id,()=>completion(reply,protocol(record),'',{resource:'file2.txt',content:'other-role'}));
   if(held.size===2&&!overlap){overlap=true;for(const release of held.values())release();}
   if(task.id==='task1'){const current=(await setup.pipeline.getState()).value.tasks.find(task=>task.id==='task0');assert.equal(current.status,'completed');assert.equal(current.checkStatus,'passed');firstFinished=true;assert.equal(firstFinished,true);completion(reply,protocol(record),'',{resource:'file1.txt',content:'same-role-second'});}
  }else{if(task.id==='task0'&&typedResults(record.body).some(pair=>pair.result?.tool==='legion_run_check'))firstFinished=true;completion(reply,protocol(record),'完成');}
 });setup=await fixture(local);candidate=proposal(setup.ids,true);candidate.roles=candidate.roles.filter(role=>role.id!=='Worker1');candidate.tasks[1].roleId='Worker0';candidate.tasks[1].profileId=setup.ids[0];
 try{
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'同角色串行其他角色可重叠'});const draft=await until(setup.pipeline,state=>state.turn?.status==='completed');assert.equal(draft.plan.status,'draft',JSON.stringify(draft.error));
  assert.equal((await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest})).ok,true);
  const done=await until(setup.pipeline,state=>['completed','failed','invalidated'].includes(state.plan.status));assert.equal(overlap,true);assert.equal(firstFinished,true);assert.deepEqual(starts.slice(0,2).sort(),['task0','task2']);assert.equal(starts[2],'task1');assert.equal(done.plan.status,'completed',JSON.stringify(done.tasks));
 }finally{await setup.pipeline.close();await local.close();}
});

test('parallel real SDK: Human cancellation revokes every overlapping instance before any late mutation',async()=>{
 let candidate;const held=[];const local=await server((record,reply)=>{
  if(isCustomerCall(record.body))return completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');
  held.push({record,reply});
 });const setup=await fixture(local);candidate=proposal(setup.ids,true);
 try{
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'取消三个活动角色'});const draft=await until(setup.pipeline,state=>state.turn?.status==='completed');
  assert.equal((await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest})).ok,true);
  await until(setup.pipeline,state=>state.tasks.filter(task=>task.status==='running').length===3&&held.length===3);assert.equal(held.length,3);
  const stopped=await setup.pipeline.stopExecution({projectId:setup.projectId});assert.equal(stopped.ok,true);assert.equal(stopped.value.plan.status,'invalidated');assert.equal(stopped.value.tasks.some(task=>task.status==='running'),false);
  for(const {record,reply} of held)if(!reply.destroyed)completion(reply,protocol(record),'',{resource:desiredFile(record.body),content:'forbidden-late-output'});
  await delay(20);assert.deepEqual(await businessEntries(setup.root),['.ans']);const audit=await readFile(join(setup.root,'.ans/events/index.jsonl'),'utf8');assert.equal(audit.includes('mutation_success'),false);for(let i=0;i<3;i++)await assert.rejects(readFile(join(setup.root,'file'+i+'.txt')),{code:'ENOENT'});
  const second=createWorkbenchPipeline({userDataDir:setup.data,leaseRoot:join(setup.data,'..','isolated-project-leases')});try{const reselected=await second.selectProject(setup.root);assert.equal(reselected.ok,true,reselected.error?.code??'safe');}finally{await second.close();}
 }finally{await setup.pipeline.close();await local.close();}
});

test('public Node factory uses environment profile for actual SDK PM without Electron or key persistence',async()=>{
 const local=await server((record,reply)=>{assert.equal(record.headers.authorization,'Bearer node-fixture-secret');assert.equal(isCustomerCall(record.body),true);completion(reply,'openai-completions','环境模型已讨论需求');});
 const location=await mkdtemp(join(base,'fixtures','headless-node-'));const root=join(location,'customer');const data=join(location,'private');await mkdir(root);
 const pipeline=createHeadlessWorkbenchPipeline({userDataDir:data,leaseRoot:join(location,'leases'),profile:{protocol:'openai-completions',provider:'node',modelId:'local',baseUrl:local.url+'/p0',env:{LEGION_API_KEY:'node-fixture-secret'}}});
 try{
  const selected=await pipeline.selectProject(root);assert.equal(selected.ok,true,JSON.stringify(selected));const projectId=selected.value.currentProject.id;assert.equal(selected.value.defaultProfileId,'environment');assert.equal(JSON.stringify(selected).includes('node-fixture-secret'),false);
  assert.equal((await pipeline.sendMessage({projectId,roleId:'Supervisor',text:'直接从Node讨论项目'})).ok,true);const done=await until(pipeline,state=>state.turn?.status==='completed'||state.turn?.status==='failed');assert.equal(done.turn.status,'completed',JSON.stringify(done.error));assert.ok(local.calls.length);
  assert.equal((await readdir(data)).some(name=>name.includes('settings')),false);for(const name of await readdir(data))if(name.endsWith('.json'))assert.equal((await readFile(join(data,name),'utf8')).includes('node-fixture-secret'),false);
 }finally{await pipeline.close();await local.close();}
});

test('parallel real SDK: Shell snapshot and another owner Mutation share Host commit queue without baseline relaxation',async()=>{
 let candidate;let setup;let other=null;let reviewSeen=false;let checkedPendingWrite=false;let published=false;
 const local=await server(async(record,reply)=>{
  const tools=record.body.tools.map(tool=>tool.function?.name??tool.name);
  if(tools.includes('legion_review_shell')){
   const results=typedResults(record.body);
   if(results.some(pair=>pair.result?.tool==='legion_review_shell')){reply.synthetic=true;completion(reply,protocol(record),'审核完成');return;}
   reviewSeen=true;assert.ok(other);const pending=other;other=null;completion(pending.reply,protocol(pending.record),'',{resource:'file1.txt',content:'other-owner-after-shell'});
   await delay(75);await assert.rejects(readFile(join(setup.root,'file1.txt')),{code:'ENOENT'});checkedPendingWrite=true;
   const prompt=strings(record.body).find(text=>text.startsWith('你是当前ProjectManager，审查'));
   assert.ok(prompt);const data=JSON.parse(prompt.split('真实请求及原角色任务：')[1].split('\n')[0]);
   reply.synthetic=true;completion(reply,protocol(record),'批准当前真实准备快照',{requestId:data.request.requestId,requestDigest:data.requestDigest,revision:data.revision,approved:true,reason:'只发布Worker0独占file0.txt'},'legion_review_shell','parallel-review');return;
  }
  if(isCustomerCall(record.body))return completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');
  const task=taskMetadata(record.body);const results=typedResults(record.body);
  if(task.id==='task1'){
   if(!hasResult(record.body)){other={record,reply};return;}
   completion(reply,protocol(record),'另一owner完成');return;
  }
  if(!hasResult(record.body)){
   for(let wait=0;!other&&wait<200;wait++)await delay(5);assert.ok(other);
   completion(reply,protocol(record),'',{command:'printf shell-owned > file0.txt',cwd:'',reason:'创建本角色独占源码',generatedEffects:[],network:'none',timeoutSeconds:30},'legion_request_shell','parallel-shell');return;
  }
  const shell=results.find(pair=>pair.result?.requestDigest);assert.ok(shell);assert.equal(shell.result.status,'published',JSON.stringify(shell));published=true;
  if(!results.some(pair=>pair.result?.checkId==='unit-task0'))completion(reply,protocol(record),'',{checkId:'unit-task0'},'legion_run_check','parallel-shell-check');
  else{reply.synthetic=true;completion(reply,protocol(record),'源码发布及实际检查通过');}
 });setup=await fixture(local);candidate=proposal(setup.ids.slice(0,2),true);
 try{
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'Shell审核执行期间其他owner正常提出写入'});const draft=await until(setup.pipeline,state=>state.turn?.status==='completed');assert.equal(draft.plan.status,'draft');
  assert.equal((await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest})).ok,true);
  const done=await until(setup.pipeline,state=>['completed','failed','invalidated'].includes(state.plan.status));assert.equal(reviewSeen,true);assert.equal(checkedPendingWrite,true);assert.equal(published,true);assert.equal(done.plan.status,'completed',JSON.stringify(done.tasks));
  assert.equal(await readFile(join(setup.root,'file0.txt'),'utf8'),'shell-owned');assert.equal(await readFile(join(setup.root,'file1.txt'),'utf8'),'other-owner-after-shell');assert.equal(done.tasks.every(task=>task.checkStatus==='passed'),true);
 }finally{await setup.pipeline.close();await local.close();}
});


async function assertNoKnownKey(root,key,fragment=null){
 for(const entry of await readdir(root,{withFileTypes:true})){
  const path=join(root,entry.name);assert.equal(entry.isSymbolicLink(),false);
  if(entry.isDirectory())await assertNoKnownKey(path,key,fragment);
  else if(entry.isFile()){const bytes=await readFile(path);assert.equal(bytes.includes(Buffer.from(key)),false,'known key persisted');if(fragment)assert.equal(bytes.includes(Buffer.from(fragment)),false,'unvalidated delta persisted');}
 }
}
function streamedChunks(reply,chunks){
 reply.writeHead(200,{'content-type':'text/event-stream'});
 for(const content of chunks)sse(reply,{choices:[{index:0,delta:{role:'assistant',content},finish_reason:null}]});
 sse(reply,{choices:[{index:0,delta:{},finish_reason:'stop'}]});reply.end('data: [DONE]\n\n');
}
test('known key: public Node initial state/history and Human message/answer reject without recording or grants',async()=>{
 const key=randomBytes(24).toString('hex');let calls=0;
 const local=await server((record,reply)=>{calls++;completion(reply,protocol(record),'安全合法回复');});local.host.knownKey=key;const setup=await fixture(local);
 try{
  const before=(await setup.pipeline.getState()).value;
  const denied=await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'Human '+key});assert.equal(denied.error.code,'sensitive_output');assert.equal(calls,0);
  const after=(await setup.pipeline.getState()).value;assert.deepEqual(after.history,before.history);assert.equal(JSON.stringify(after).includes(key),false);
  assert.equal((await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'正常非敏感 Human 原文 '+ '文'.repeat(45000)})).ok,true);
  const done=await until(setup.pipeline,state=>state.turn?.status==='completed');assert.ok(done.history.messages.some(message=>message.text.includes('文'.repeat(45000))));
  await assertNoKnownKey(setup.data,key);await assertNoKnownKey(setup.root,key);
 }finally{await setup.pipeline.close();await local.close();}
});
test('known key: actual SDK split deltas stay private before whole-key rejection and clean next turn is unchanged',async()=>{
 const key=randomBytes(24).toString('hex'),half=key.slice(0,24);let sent=false;let release=null;let safe=false;
 const local=await server((record,reply)=>{
  if(safe){completion(reply,protocol(record),'非敏感完整回复');return;}
  reply.writeHead(200,{'content-type':'text/event-stream'});sse(reply,{choices:[{index:0,delta:{role:'assistant',content:half},finish_reason:null}]});sent=true;
  release=()=>{sse(reply,{choices:[{index:0,delta:{content:key.slice(24)},finish_reason:null}]});sse(reply,{choices:[{index:0,delta:{},finish_reason:'stop'}]});reply.end('data: [DONE]\n\n');};
 });local.host.knownKey=key;const setup=await fixture(local);
 try{
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'安全需求'});
  await until(setup.pipeline,state=>state.turn?.status==='running'&&sent);await delay(20);
  const pending=(await setup.pipeline.getState()).value;assert.equal(pending.turn.text,'');assert.equal(JSON.stringify(pending).includes(half),false);await assertNoKnownKey(setup.data,key,half);release();
  const failed=await until(setup.pipeline,state=>state.turn?.status==='failed');assert.equal(failed.error.code,'sensitive_output');assert.equal(JSON.stringify(failed).includes(key),false);await assertNoKnownKey(setup.data,key,half);
  safe=true;const cleanSend=await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'继续安全需求'});assert.equal(cleanSend.ok,true,cleanSend.error?.code);const next=await until(setup.pipeline,state=>state.turn?.status==='completed');assert.equal(next.history.messages.at(-1).text,'非敏感完整回复');await assertNoKnownKey(setup.data,key);
 }finally{await setup.pipeline.close();await local.close();}
});
for(const mode of ['interaction','role-proposal','worker-write','worker-edit','member-delta','supervisor'])test('known key: real SDK '+mode+' cannot enter persistence/DTO/controlled source',async()=>{
 const key=randomBytes(24).toString('hex');let candidate;let setup;
 const local=await server((record,reply)=>{
  const tools=JSON.stringify(record.body.tools);
  if(mode==='supervisor'&&tools.includes('legion_submit_supervision')){streamedChunks(reply,[key.slice(0,24),key.slice(24)]);return;}
  if(mode==='role-proposal'&&tools.includes('legion_propose_roles')){
   const plan=local.host.plan;completion(reply,protocol(record),'',{payload:{id:'poison-role',version:1,members:[{id:'Worker0',name:'Worker0',purpose:key,interfaces:[],boundary:['file0.txt'],documents:[],revision:1,enabled:true,status:'approved'}]}},'legion_propose_roles','bad-role');return;
  }
  if(!taskMetadata(record.body)){
   if(mode==='role-proposal'&&typedResults(record.body).some(pair=>pair.result?.tool==='legion_design_roles')){completion(reply,protocol(record),'拒绝该角色提案，不授权');return;}
   if(mode==='interaction'){completion(reply,protocol(record),'',{payload:{kind:'question',purpose:'discussion',title:'key '+key,text:'x',options:[],allowSupplement:false}},'legion_request_interaction','bad-question');return;}
   completion(reply,protocol(record),String.fromCharCode(96).repeat(3)+'legion-plan\n'+JSON.stringify(candidate)+'\n'+String.fromCharCode(96).repeat(3));return;
  }
  if(mode==='member-delta'){streamedChunks(reply,[key.slice(0,24),key.slice(24)]);return;}
  if(mode==='worker-edit'){completion(reply,protocol(record),'',{resource:'file0.txt',expectedSha256:createHash('sha256').update(key.slice(0,24)+'placeholder').digest('hex'),replacements:[{oldText:'placeholder',newText:key.slice(24)}]},'legion_edit_file','bad-edit');return;}
  completion(reply,protocol(record),'',{resource:'file0.txt',content:key},'legion_write_file','bad-write');
 });
 local.host.knownKey=key;local.host.rejectKeyMode=mode;setup=await fixture(local);candidate=proposal([setup.ids[0]]);
 try{
  if(mode==='worker-edit')await writeFile(join(setup.root,'file0.txt'),key.slice(0,24)+'placeholder');
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'安全项目需求'});
  const initial=await until(setup.pipeline,state=>['completed','failed'].includes(state.turn?.status));
  if(['worker-write','worker-edit','member-delta'].includes(mode)){
   assert.equal(initial.plan.status,'draft');assert.equal((await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:initial.plan.planDigest})).ok,true);
   const done=await until(setup.pipeline,state=>['invalidated','failed'].includes(state.plan.status));assert.equal(done.tasks.some(task=>task.results.some(result=>result.observedMutation)),false);assert.equal(JSON.stringify(done).includes(key),false);
  }else if(mode==='role-proposal'){assert.equal(initial.plan,null);assert.ok(local.calls.flatMap(record=>typedResults(record.body)).some(pair=>pair.result?.reason==='sensitive_output'));}else if(mode==='supervisor'){assert.equal(initial.turn.status,'failed');assert.equal(initial.error.code,'sensitive_output');assert.ok(initial.supervisions.some(entry=>entry.phase==='preflight'&&entry.status==='failed'&&entry.advice===null));assert.equal(initial.interactions.some(entry=>entry.purpose==='execute_plan'&&entry.status==='pending'),false);assert.ok(initial.tasks.every(task=>task.runId===null));}else assert.equal(initial.turn.status,'failed');
  const state=(await setup.pipeline.getState()).value;assert.equal(JSON.stringify(state).includes(key),false);await assertNoKnownKey(setup.data,key);await assertNoKnownKey(setup.root,key);
 }finally{await setup.pipeline.close();await local.close();}
});

test('known key: actual Human question answer rejects before record while legitimate original answer resumes same request',async()=>{
 const key=randomBytes(24).toString('hex');const local=await server((record,reply)=>{
  if(typedResults(record.body).some(pair=>pair.result?.tool==='legion_request_interaction'))completion(reply,protocol(record),'已使用完整合法答案');
  else completion(reply,protocol(record),'',{payload:{kind:'question',purpose:'discussion',title:'补充需求',text:'请提供合法原文',options:[],allowSupplement:false}},'legion_request_interaction','human-key-question');
 });local.host.knownKey=key;const setup=await fixture(local);
 try{
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'询问需求'});
  const waiting=await until(setup.pipeline,state=>state.interactions.some(request=>request.status==='pending'));
  const request=waiting.interactions.find(item=>item.status==='pending'),input={projectId:setup.projectId,requestId:request.requestId,version:request.version,requestDigest:request.digest};
  const file=join(setup.data,'workbench-organization',setup.projectId+'.json'),before=await readFile(file);
  assert.equal((await setup.pipeline.answerInteraction({...input,value:key})).error.code,'sensitive_output');assert.deepEqual(await readFile(file),before);
  const original='合法原文无需改字：'+ '文'.repeat(1000);assert.equal((await setup.pipeline.answerInteraction({...input,value:original})).ok,true);
  const done=await until(setup.pipeline,state=>state.turn?.status==='completed');assert.equal(done.interactions.find(item=>item.requestId===request.requestId).answer.value,original);await assertNoKnownKey(setup.data,key);
 }finally{await setup.pipeline.close();await local.close();}
});
test('known key: pre-existing customer read is denied to SDK without changing original file',async()=>{
 const key=randomBytes(24).toString('hex');let denied=false;const local=await server((record,reply)=>{
  const result=typedResults(record.body).find(pair=>pair.result?.resource==='existing.txt');
  if(result){assert.equal(result.result.status,'denied');assert.equal(result.result.reason,'sensitive_output');assert.equal(JSON.stringify(record.body).includes(key),false);denied=true;completion(reply,protocol(record),'不传播该读取内容');}
  else completion(reply,protocol(record),'',{resource:'existing.txt'},'legion_read_file','guarded-read');
 });local.host.knownKey=key;const setup=await fixture(local);const original='已有客户原字节 '+key;
 try{
  await writeFile(join(setup.root,'existing.txt'),original);
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'读取合法名称文件'});
  await until(setup.pipeline,state=>state.turn?.status==='completed');assert.equal(denied,true);assert.equal(await readFile(join(setup.root,'existing.txt'),'utf8'),original);await assertNoKnownKey(setup.data,key);
 }finally{await setup.pipeline.close();await local.close();}
});
test('known key: real Check stdout/stderr reconstruction is blocked by private factory keys before Host persistence',async()=>{
 const key=randomBytes(24).toString('hex');let candidate;const local=await server((record,reply)=>{
  if(isCustomerCall(record.body))completion(reply,protocol(record),String.fromCharCode(96).repeat(3)+'legion-plan\n'+JSON.stringify(candidate)+'\n'+String.fromCharCode(96).repeat(3));
  else if(!hasResult(record.body))completion(reply,protocol(record),'',{resource:'file0.txt',content:'safe-source'});
  else completion(reply,protocol(record),'按实际拒绝结束');
 });local.host.knownKey=key;const setup=await fixture(local);candidate=proposal([setup.ids[0]]);
 try{
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'实际检查输出不得回显已知key'});
  const draft=await until(setup.pipeline,state=>state.turn?.status==='completed');
  await writeFile(join(setup.root,'tests/Acceptance/check-task0.test.mjs'),"process.stdout.write('"+key.slice(0,24)+"');setTimeout(()=>process.stderr.write('"+key.slice(24)+"'),20);");
  assert.equal((await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest})).ok,true);
  const done=await until(setup.pipeline,state=>['failed','invalidated'].includes(state.plan.status));assert.equal(done.tasks[0].checkStatus,'error');assert.ok(done.evidence.some(entry=>entry.result.reason==='known_key_output_rejected'));assert.equal(JSON.stringify(done).includes(key),false);await assertNoKnownKey(setup.data,key);await assertNoKnownKey(setup.root,key);
 }finally{await setup.pipeline.close();await local.close();}
});
test('known key: native Shell stdout/stderr reconstruction is denied before logs and publication',async()=>{
 const key=randomBytes(24).toString('hex');let candidate;let observed=null;const local=await server((record,reply)=>{
  const tools=record.body.tools.map(tool=>tool.function?.name??tool.name),results=typedResults(record.body);
  if(tools.includes('legion_review_shell')){
   if(results.some(pair=>pair.result?.tool==='legion_review_shell')){completion(reply,protocol(record),'安全审核完成');return;}
   const prompt=strings(record.body).find(text=>text.startsWith('你是当前ProjectManager，审查')),data=JSON.parse(prompt.split('真实请求及原角色任务：')[1].split('\n')[0]);
   completion(reply,protocol(record),'批准受控输出验证',{requestId:data.request.requestId,requestDigest:data.requestDigest,revision:1,approved:true,reason:'只验证不污染输出'},'legion_review_shell','safe-review');return;
  }
  if(isCustomerCall(record.body)){completion(reply,protocol(record),String.fromCharCode(96).repeat(3)+'legion-plan\n'+JSON.stringify(candidate)+'\n'+String.fromCharCode(96).repeat(3));return;}
  const result=results.find(pair=>pair.result?.requestDigest);
  if(result){observed=result;completion(reply,protocol(record),'按真实拒绝结束');}
  else completion(reply,protocol(record),'',{command:"printf '"+key.slice(0,24)+"'; printf '"+key.slice(24)+"' >&2",cwd:'',reason:'受控双流检查',generatedEffects:[],network:'none',timeoutSeconds:30},'legion_request_shell','guarded-shell');
 });local.host.knownKey=key;const setup=await fixture(local);candidate=proposal([setup.ids[0]]);
 try{
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'不让已知key流出运行日志'});const draft=await until(setup.pipeline,state=>state.turn?.status==='completed');
  assert.equal((await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest})).ok,true);
  const done=await until(setup.pipeline,state=>['failed','invalidated'].includes(state.plan.status));assert.ok(observed);assert.equal(observed.result.reason,'shell_known_key_output_rejected');assert.notEqual(observed.result.status,'published');assert.equal(JSON.stringify(done).includes(key),false);await assertNoKnownKey(setup.data,key);await assertNoKnownKey(setup.root,key);
 }finally{await setup.pipeline.close();await local.close();}
});


for(const mode of ['fact','acceptance'])test('known key: real '+mode+' control request is rejected before durable typed record',async()=>{
 const key=randomBytes(24).toString('hex');let candidate;const local=await server((record,reply)=>{
  if(isCustomerCall(record.body)){completion(reply,protocol(record),String.fromCharCode(96).repeat(3)+'legion-plan\n'+JSON.stringify(candidate)+'\n'+String.fromCharCode(96).repeat(3));return;}
  const task=taskMetadata(record.body);
  if(mode==='fact'){completion(reply,protocol(record),'',{payload:{action:'add',kind:'decision',statement:key,sourceRefs:['plan:placeholder'],expectedRevision:0}},'legion_remember_fact','bad-fact');return;}
  if(task.roleId==='Acceptance'){
   const check=typedResults(record.body).find(pair=>pair.result?.checkId==='unit-zz-acceptance');
   completion(reply,protocol(record),'',{payload:{taskId:task.id,evidenceIds:[check.result.requestId],decision:'fail',issues:[{taskId:'task0',resource:'file0.txt',expected:'good',actual:key,reproduction:'legion_run_check unit-task0'}]}},'legion_submit_acceptance','bad-acceptance');return;
  }
  if(!hasResult(record.body))completion(reply,protocol(record),'',{resource:'file0.txt',content:'safe-before-acceptance'});else completion(reply,protocol(record),'合法开发完成');
 });local.host.knownKey=key;local.host.rejectKeyMode=mode;const setup=await fixture(local);candidate=proposal([setup.ids[0]]);
 try{
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'按真实记录检查工具字段'});
  const draft=await until(setup.pipeline,state=>state.turn?.status==='completed');assert.equal((await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest})).ok,true);
  const done=await until(setup.pipeline,state=>['failed','invalidated'].includes(state.plan.status));assert.equal(JSON.stringify(done).includes(key),false);assert.equal(done.acceptances.length,0);
  if(mode==='fact')assert.equal(done.tasks[0].results.length,0);else assert.equal(await readFile(join(setup.root,'file0.txt'),'utf8'),'safe-before-acceptance');
  await assertNoKnownKey(setup.data,key);await assertNoKnownKey(setup.root,key);
 }finally{await setup.pipeline.close();await local.close();}
});
test('known key: automatic summary cannot replace safe role memory with split credential text',async()=>{
 const key=randomBytes(24).toString('hex');let turn=0;let summarySeen=false;const local=await server((record,reply)=>{
  if(!(record.body.tools?.length)){summarySeen=true;streamedChunks(reply,[key.slice(0,24),key.slice(24)]);return;}
  turn++;completion(reply,protocol(record),'完整旧非敏感回复'+ '旧'.repeat(turn===1?45000:100));
 });local.host.knownKey=key;const setup=await fixture(local);
 try{
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'第一轮真实需求'});await until(setup.pipeline,state=>state.turn?.status==='completed');
  const file=join(setup.data,'workbench-organization',setup.projectId+'.json'),old=JSON.parse(await readFile(file,'utf8')).roleMemories;
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'新的非敏感 Human 原文'+ '新'.repeat(18000)});
  const done=await until(setup.pipeline,state=>state.turn?.status==='failed');assert.equal(summarySeen,true);assert.equal(done.error.code,'sensitive_output');
  const current=JSON.parse(await readFile(file,'utf8')).roleMemories;assert.deepEqual(current,old);await assertNoKnownKey(setup.data,key);
 }finally{await setup.pipeline.close();await local.close();}
});


test('known key: public Node getState initializes guard before refusing old contaminated history with zero SDK call',async()=>{
 const key=randomBytes(24).toString('hex');let calls=0;const local=await server((record,reply)=>{calls++;completion(reply,protocol(record),'合法回复');});local.host.knownKey=key;const setup=await fixture(local);
 try{
  await setup.pipeline.close();
  const {historyDocument}=await import('../../src/models/workbench.mjs');const file=join(setup.data,'workbench-history',setup.projectId+'.json');await mkdir(join(setup.data,'workbench-history'),{recursive:true});
  const old=JSON.stringify(historyDocument({schemaVersion:1,projectId:setup.projectId,roleId:'ProjectManager',history:{messages:[{role:'assistant',text:key}]}}));await writeFile(file,old);
  const reopened=createHeadlessWorkbenchPipeline({userDataDir:setup.data,leaseRoot:join(setup.data,'..','isolated-project-leases'),profile:{protocol:'openai-completions',provider:'local',modelId:'local',baseUrl:local.url+'/p0',env:{LEGION_API_KEY:key}}});
  try{
   const initial=await reopened.getState();assert.equal(initial.ok,true);assert.equal(JSON.stringify(initial).includes(key),false);
   const selected=await reopened.selectProject(setup.root);assert.equal(selected.error.code,'sensitive_output');assert.equal(await readFile(file,'utf8'),old);assert.equal(calls,0);
   const state=await reopened.getState();assert.equal(JSON.stringify(state).includes(key),false);assert.equal(state.value.currentProject,null);
  }finally{await reopened.close();}
 }finally{await setup.pipeline.close();await local.close();}
});

test('known key: Human profile metadata/root commands reject before invalidation or persistence',async()=>{
 const key=randomBytes(24).toString('hex');const local=await server((record,reply)=>completion(reply,protocol(record),'合法'));local.host.knownKey=key;const setup=await fixture(local);
 try{
  const catalog=join(setup.data,'workbench-projects.json'),org=join(setup.data,'workbench-organization',setup.projectId+'.json'),beforeCatalog=await readFile(catalog),beforeOrg=await readFile(org);
  const denied=await setup.pipeline.saveProfile({name:key,protocol:'openai-completions',provider:'local',modelId:'local',baseUrl:local.url+'/p0',keyAction:'keep',apiKey:''});assert.equal(denied.error.code,'sensitive_output');
  assert.equal((await setup.pipeline.selectProject(join(setup.root,key))).error.code,'sensitive_output');
  assert.equal((await setup.pipeline.setDefaultProfile({profileId:key})).error.code,'sensitive_output');
  assert.deepEqual(await readFile(catalog),beforeCatalog);assert.deepEqual(await readFile(org),beforeOrg);assert.equal(local.calls.length,0);await assertNoKnownKey(setup.data,key);
 }finally{await setup.pipeline.close();await local.close();}
});

test('public getState exposes pending and completed current-plan Supervisor typed advice/results without private text or keys',async()=>{
 const key=randomBytes(24).toString('hex');let candidate;const local=await server((record,reply)=>{
  if(isCustomerCall(record.body))completion(reply,protocol(record),String.fromCharCode(96).repeat(3)+'legion-plan\n'+JSON.stringify(candidate)+'\n'+String.fromCharCode(96).repeat(3));
  else if(!hasResult(record.body))completion(reply,protocol(record),'',{resource:'file0.txt',content:'safe-supervised-source'});else completion(reply,protocol(record),'已完成');
 });local.host.knownKey=key;local.host.holdSupervisionPhase='monitor';const setup=await fixture(local);candidate=proposal([setup.ids[0]]);
 try{
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'公开当前计划安全监督结果'});
  const draft=await until(setup.pipeline,state=>state.turn?.status==='completed');assert.equal(draft.supervisions.find(item=>item.phase==='preflight').status,'completed');
  await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest});
  const pending=await until(setup.pipeline,state=>state.plan?.status==='completed'&&state.supervisions.some(item=>item.phase==='monitor'&&item.status==='pending')&&local.host.releaseSupervision);
  const row=pending.supervisions.find(item=>item.phase==='monitor');assert.equal(row.advice,null);assert.ok(row.resultStates.tasks.every(task=>task.status==='completed'));assert.ok(row.resultStates.checks.every(check=>check.status==='passed'));assert.ok(row.resultStates.acceptances.some(item=>item.decision==='pass'));
  for(const token of [key,'SUPERVISOR_PRIVATE_RAW_TEXT_CANARY','instanceId','runId','sourceDigests','knownKeys'])assert.equal(JSON.stringify(pending.supervisions).includes(token),false);
  local.host.releaseSupervision();const completed=await until(setup.pipeline,state=>state.supervisions.some(item=>item.phase==='monitor'&&item.status==='completed'));assert.equal(completed.plan.status,'completed');const advice=completed.supervisions.find(item=>item.phase==='monitor').advice;assert.equal(advice.recommendation,'proceed');assert.equal(advice.findings[0].reason,'当前有来源检查与验收摘要');assert.ok(advice.findings[0].sourceRefs.length);
  await assertNoKnownKey(setup.data,key);assert.equal(JSON.stringify(completed).includes(key),false);assert.equal(JSON.stringify(completed).includes('SUPERVISOR_PRIVATE_RAW_TEXT_CANARY'),false);
  const other=join(setup.location,'other-supervision-project');await mkdir(other);const selected=await setup.pipeline.selectProject(other);assert.deepEqual(selected.value.supervisions,[]);
 }finally{await setup.pipeline.close();await local.close();}
});

test('public getState reports failed async monitor with no advice while completed tasks remain successful',async()=>{
 let candidate;const local=await server((record,reply)=>{
  if(isCustomerCall(record.body))completion(reply,protocol(record),String.fromCharCode(96).repeat(3)+'legion-plan\n'+JSON.stringify(candidate)+'\n'+String.fromCharCode(96).repeat(3));
  else if(!hasResult(record.body))completion(reply,protocol(record),'',{resource:'file0.txt',content:'completed-source'});else completion(reply,protocol(record),'合法完成');
 });const setup=await fixture(local);candidate=proposal([setup.ids[0]]);local.host.supervisionFailurePhase='monitor';
 try{
  await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'后台监督失败不推翻完成'});const draft=await until(setup.pipeline,state=>state.turn?.status==='completed');
  await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest});
  const done=await until(setup.pipeline,state=>state.plan?.status==='completed'&&state.supervisions.some(item=>item.phase==='monitor'&&item.status==='failed'));
  const row=done.supervisions.find(item=>item.phase==='monitor');assert.equal(row.advice,null);assert.equal(done.tasks.every(task=>task.status==='completed'&&task.checkStatus==='passed'),true);assert.ok(row.resultStates.acceptances.some(item=>item.decision==='pass'));assert.equal(JSON.stringify(row).includes('只有文字'),false);assert.equal(done.supervisions.find(item=>item.phase==='preflight').status,'completed');
 }finally{await setup.pipeline.close();await local.close();}
});

test('Su real self log pagination survives its own query journal and exposes action metadata only',async()=>{
 let pages=[],activity=null;const local=await server((record,reply)=>{const results=typedResults(record.body);const logs=results.filter(pair=>pair.result?.tool==='legion_query_role_log');const listed=results.find(pair=>pair.result?.resource==='.');if(!listed){completion(reply,protocol(record),'',{resource:'.',limit:20},'legion_list_files','list-self');return;}if(!logs.length){completion(reply,protocol(record),'',{payload:{roleId:'Supervisor',limit:1}},'legion_query_role_log','page-one');return;}if(logs.length===1){assert.equal(logs[0].result.status,'completed',logs[0].result.reason);pages[0]=logs[0].result.payload;assert.ok(pages[0].nextCursor);completion(reply,protocol(record),'',{payload:{roleId:'Supervisor',limit:1,cursor:pages[0].nextCursor}},'legion_query_role_log','page-two');return;}assert.equal(logs[1].result.status,'completed',logs[1].result.reason);pages[1]=logs[1].result.payload;completion(reply,protocol(record),'真实日志已读取');});const setup=await fixture(local);
 try{assert.equal((await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'ProjectManager',text:'不再接受直接PM客户消息'})).ok,false);assert.equal((await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'查看自己的行动日志'})).ok,true);const done=await until(setup.pipeline,state=>state.turn?.status==='completed');assert.equal(pages.length,2);assert.equal(pages[0].sourceDigest,pages[1].sourceDigest);assert.notEqual(pages[0].events[0].id,pages[1].events[0].id);assert.equal(JSON.stringify(pages).includes('assistant_text'),false);assert.equal(JSON.stringify(pages).includes('credentials'),false);assert.equal(done.plan,null);assert.equal(done.roles.find(role=>role.id==='Supervisor').boundary.length,0);}finally{await setup.pipeline.close();await local.close();}
});

test('failed selftest immediately accepts complete new Human draft while background finalize cannot write customer memory',async()=>{
 let candidate;let planned=0;let armed=true;let newHumanStarted=false;let monitorInstance;let markMonitor;const monitorReady=new Promise(resolve=>markMonitor=resolve);let enterForeground,releaseForeground;const foregroundEntered=new Promise(resolve=>enterForeground=resolve),foregroundReleased=new Promise(resolve=>releaseForeground=resolve);const runs=new Map(),writes=[];
 const local=await server((record,reply)=>{const task=taskMetadata(record.body);if(!task){planned++;completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');return;}if(!hasResult(record.body))completion(reply,protocol(record),'',{resource:task.writeSet[0],content:'actual output before selftest failure'});else completion(reply,protocol(record),'真实检查失败保留');});
 local.host.failCheck=true;local.host.organizationFactory=data=>{const real=createOrganizationService({userDataDir:data});return {...real,beginMemberRun:async(...args)=>{runs.set(args[1].id,args[1]);return real.beginMemberRun(...args);},finishMemberRun:async(...args)=>{const run=runs.get(args[1].conversationId);const state=await real.finishMemberRun(...args);if(armed&&run?.channel==='supervision_monitor'){monitorInstance=run.instanceId;markMonitor();await foregroundEntered;}return state;},saveRoleMemory:async(...args)=>{const input=args[1],actor=args[2];writes.push({channel:input.channel,instanceId:actor.instanceId});if(armed&&newHumanStarted&&input.roleId==='Supervisor'&&input.channel==='su_customer'&&actor.instanceId!==monitorInstance){await monitorReady;enterForeground();await foregroundReleased;}const result=await real.saveRoleMemory(...args);if(armed&&actor.instanceId===monitorInstance){armed=false;releaseForeground();}return result;}};};
 const setup=await fixture(local);candidate=proposal([setup.ids[0]]);
 try{await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'执行真实失败的selftest'});await until(setup.pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed');await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:(await setup.pipeline.getState()).value.plan.planDigest});const failed=await until(setup.pipeline,state=>state.plan?.status==='failed');assert.equal(failed.tasks[0].checkStatus,'failed');const human='失败后立即形成新草案：'+'完整客户需求'.repeat(2000);local.host.failCheck=false;newHumanStarted=true;const sent=await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:human});assert.equal(sent.ok,true);const done=await until(setup.pipeline,state=>['completed','failed'].includes(state.turn?.status));assert.equal(done.turn.status,'completed',done.turn.error?.code);assert.equal(done.plan.status,'draft');assert.ok(done.timeline.messages.some(message=>message.kind==='human'&&message.text===human));assert.ok(monitorInstance);assert.equal(writes.filter(write=>write.instanceId===monitorInstance&&write.channel==='su_customer').length,0);assert.ok(writes.some(write=>write.instanceId===monitorInstance&&write.channel==='supervision_monitor'));assert.ok(planned>=2);
 }finally{armed=false;markMonitor();enterForeground();releaseForeground();await setup.pipeline.close();await local.close();}
});

test('real Su in-flight SSE cancellation preserves Human and continues on the same instance without partial history',async()=>{
 let hang=true;const human='Cancel this turn',partial='Unfinished response stays private';
 const local=await server((record,reply)=>{assert.equal(isCustomerCall(record.body),true);if(hang){reply.writeHead(200,{'content-type':'text/event-stream'});sse(reply,{id:'partial',object:'chat.completion.chunk',choices:[{index:0,delta:{role:'assistant',content:partial},finish_reason:null}]});reply.write(': wait\n\n');}else completion(reply,protocol(record),'Continue safely');});local.host.manualCustomer=true;
 const setup=await fixture(local);
 try{const started=await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:human});assert.equal(started.ok,true);await until(setup.pipeline,state=>state.turn?.status==='running'&&local.calls.length===1);const cancelled=await setup.pipeline.cancelTurn({projectId:setup.projectId,turnId:started.value.turn.id});assert.equal(cancelled.ok,true);assert.equal(cancelled.value.turn.status,'cancelled');assert.deepEqual(cancelled.value.history.messages,[{role:'user',text:human}]);assert.equal(JSON.stringify(cancelled.value.timeline).includes(partial),false);hang=false;assert.equal((await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'Continue'})).ok,true);const done=await until(setup.pipeline,state=>['completed','failed'].includes(state.turn?.status));assert.equal(done.turn.status,'completed',JSON.stringify({error:done.turn.error,calls:local.calls.length}));assert.equal(local.calls.length,2);assert.deepEqual(done.history.messages.map(item=>item.text),[human,'Continue','Continue safely']);assert.equal(JSON.stringify(local.calls[1].body).includes(partial),false);assert.equal(done.plan,null);assert.deepEqual(done.tasks,[]);const state=JSON.parse(await readFile(join(setup.data,'workbench-organization',setup.projectId+'.json'),'utf8'));assert.equal(new Set(state.memberConversations.runs.filter(run=>run.channel==='su_customer').map(run=>run.instanceId)).size,1);
 }finally{await setup.pipeline.close();await local.close();}
});

test('real Su one PM delegation handles two actual Human questions, repeated resume is idempotent and old/conflicting refs never resume a new waiter',async()=>{
 const refs=[],answerRefs=[],observed=[];let pmAnswered=0;const local=await server((record,reply)=>{
  const results=typedResults(record.body);
  if(isCustomerCall(record.body)){
   const finished=results.filter(pair=>pair.result?.tool==='legion_delegate_pm'&&pair.result.status==='completed'&&pair.result.payload?.kind==='result_ref');
   if(finished.length===1){completion(reply,protocol(record),'',{payload:{action:'resume',delegationId:finished[0].result.payload.delegationId,humanAnswerRef:answerRefs[1]}},'legion_delegate_pm','resume-identical');return;}
   if(finished.length===2){assert.deepEqual(finished[1].result.payload,finished[0].result.payload);const conflicts=results.filter(pair=>pair.result?.tool==='legion_delegate_pm'&&pair.result.status==='denied');if(conflicts.length<2){completion(reply,protocol(record),'',{payload:{action:'resume',delegationId:finished[0].result.payload.delegationId,humanAnswerRef:'forged-answer-ref'}},'legion_delegate_pm','resume-conflict');return;}assert.equal(conflicts.length,2);assert.ok(conflicts.every(pair=>pair.result.reason==='stale_interaction'));completion(reply,protocol(record),'两次真实答复与重复恢复都已核验');return;}
   const waiting=results.findLast(pair=>pair.result?.tool==='legion_delegate_pm'&&pair.result.status==='completed'&&pair.result.payload?.kind==='needs_human');
   if(waiting){const ref=waiting.result.payload.questionRef;if(!refs.includes(ref))refs.push(ref);const index=refs.indexOf(ref),title='后台PM原问题'+(index+1);
    if(index===1&&!results.some(pair=>pair.result?.tool==='legion_delegate_pm'&&pair.result.status==='denied')){completion(reply,protocol(record),'',{payload:{action:'resume',delegationId:waiting.result.payload.delegationId,humanAnswerRef:answerRefs[0]}},'legion_delegate_pm','old-answer-for-new-question');return;}
    const answer=results.findLast(pair=>pair.result?.tool==='legion_request_interaction'&&pair.result.payload?.interaction?.title===title);
    if(!answer){completion(reply,protocol(record),'',{payload:{questionRef:ref}},'legion_request_interaction','present-real-'+index);return;}
    assert.equal(answer.result.status,'completed');answerRefs[index]=answer.result.payload.humanAnswerRef;completion(reply,protocol(record),'',{payload:{action:'resume',delegationId:waiting.result.payload.delegationId,humanAnswerRef:answerRefs[index]}},'legion_delegate_pm','resume-real-'+index);return;
   }
   const source=classifiedContext(record.body).sourceIndex.findLast(item=>item.type==='human');completion(reply,protocol(record),'',{payload:{action:'start',purpose:'plan',instruction:'获取两次真实补充后形成有限建议',sourceRefs:[source.id]}},'legion_delegate_pm','start-real');return;
  }
  assert.equal(isManagerCall(record.body),true);const answers=results.filter(pair=>pair.result?.tool==='legion_request_interaction');if(answers.length===2){pmAnswered=2;observed[1]=answers[1].result.payload.interaction.answer.value;assert.equal(answers[1].result.payload.humanAnswerRef,answerRefs[1]);completion(reply,protocol(record),'基于两次真实Human原文完成建议');return;}
  if(answers.length===1){pmAnswered=1;observed[0]=answers[0].result.payload.interaction.answer.value;assert.equal(answers[0].result.payload.humanAnswerRef,answerRefs[0]);}
  const number=answers.length+1;completion(reply,protocol(record),'',{payload:{kind:'question',purpose:'discussion',title:'后台PM原问题'+number,text:'请保留第'+number+'次精确补充原文',options:[],allowSupplement:false}},'legion_request_interaction','private-question-'+number);
 });local.host.manualCustomer=true;const setup=await fixture(local);const originals=['真实Human第一补充原文：'+'详细细节'.repeat(1000),'真实Human第二补充原文：'+'第二细节'.repeat(1000)];
 try{await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'需要后台规划与两次客户补充'});
  for(let index=0;index<2;index++){const waiting=await until(setup.pipeline,state=>state.turn?.status==='waiting'&&state.interactions.some(item=>item.status==='pending'&&item.title==='后台PM原问题'+(index+1)));const request=waiting.interactions.find(item=>item.status==='pending'&&item.title==='后台PM原问题'+(index+1));assert.equal(request.text,'请保留第'+(index+1)+'次精确补充原文');assert.equal(request.origin.roleId,'Supervisor');assert.equal((await setup.pipeline.answerInteraction({projectId:setup.projectId,requestId:request.requestId,version:request.version,requestDigest:request.digest,value:originals[index]})).ok,true);}
  const done=await until(setup.pipeline,state=>state.turn?.status==='completed');assert.deepEqual(observed,originals);assert.equal(pmAnswered,2);assert.equal(refs.length,2);assert.notEqual(refs[0],refs[1]);assert.equal(done.plan,null);for(const text of originals)assert.ok(done.timeline.messages.some(item=>item.kind==='answer'&&item.text.includes(text)));assert.equal(JSON.stringify(done.memberConversations).includes('基于两次真实Human原文完成建议'),false);const record=JSON.parse(await readFile(join(setup.data,'workbench-organization',setup.projectId+'.json'),'utf8'));assert.equal(record.delegations.entries.length,1);assert.equal(record.memberConversations.runs.filter(run=>run.roleId==='ProjectManager'&&run.channel==='pm_delegate').length,1);assert.equal(record.memberConversations.events.filter(event=>event.kind==='tool_result'&&event.tool==='legion_request_interaction'&&record.memberConversations.runs.find(run=>run.id===event.conversationId)?.roleId==='ProjectManager').length,2);await assert.rejects(readFile(join(setup.data,'workbench-history',setup.projectId+'.json')),{code:'ENOENT'});
 }finally{await setup.pipeline.close();await local.close();}
});

test('confirmed and executing Su reads both owners and real activity/log without revoking overlapping worker grants; background channels also read',async()=>{
 let candidate,planned=false,released=false;const held=new Map();let observedActivity=null;const local=await server((record,reply)=>{
  const task=taskMetadata(record.body),results=typedResults(record.body);
  if(task){if(!results.some(pair=>pair.result?.success)){completion(reply,protocol(record),'',{resource:task.writeSet[0],content:'owner-'+task.id});return;}if(!released&&!results.some(pair=>pair.result?.checkId)){held.set(task.id,{record,reply});return;}assert.ok(results.some(pair=>pair.result?.resource==='file0.txt'&&pair.result.status==='read'));completion(reply,protocol(record),'基于真实检查完成');return;}
  assert.equal(isCustomerCall(record.body),true);
  if(!planned){planned=true;completion(reply,protocol(record),'```legion-plan\n'+JSON.stringify(candidate)+'\n```');return;}
  const activity=results.find(pair=>pair.result?.tool==='legion_query_role_activity');if(!activity){completion(reply,protocol(record),'',{payload:{}},'legion_query_role_activity','live-activity');return;}assert.equal(activity.result.status,'completed');observedActivity=activity.result.payload;
  for(const resource of ['file0.txt','file1.txt'])if(!results.some(pair=>pair.result?.resource===resource)){completion(reply,protocol(record),'',{resource,maxBytes:4096},'legion_read_file','live-read-'+resource);return;}
  for(const resource of ['file0.txt','file1.txt'])assert.equal(results.find(pair=>pair.result?.resource===resource).result.status,'read');
  if(!results.some(pair=>pair.result?.tool==='legion_query_role_log')){completion(reply,protocol(record),'',{payload:{roleId:'Worker0',limit:20}},'legion_query_role_log','live-log');return;}
  const log=results.find(pair=>pair.result?.tool==='legion_query_role_log');assert.equal(log.result.status,'completed');assert.ok(log.result.payload.events.some(event=>event.tool==='legion_write_file'&&event.kind==='tool_result'));completion(reply,protocol(record),'已读取两个owner文件和真实进度日志');
 });local.host.supervisionRead=true;const setup=await fixture(local);candidate=proposal([setup.ids[0],setup.ids[0]],true);
 try{await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'两个owner并行实现'});const draft=await until(setup.pipeline,state=>state.plan?.status==='draft'&&state.turn?.status==='completed');assert.equal((await setup.pipeline.confirmPlan({projectId:setup.projectId,planDigest:draft.plan.planDigest})).ok,true);const running=await until(setup.pipeline,state=>held.size===2&&state.tasks.filter(task=>task.roleId!=='Acceptance').every(task=>task.status==='running'));const runIds=running.tasks.filter(task=>task.roleId!=='Acceptance').map(task=>task.runId);const owners=running.fileOwners.digest;
  assert.equal((await setup.pipeline.sendMessage({projectId:setup.projectId,roleId:'Supervisor',text:'只读当前两个文件、进度和日志'})).ok,true);const answer=await until(setup.pipeline,state=>state.turn?.status==='completed');assert.ok(observedActivity.tasks.filter(task=>task.roleId!=='Acceptance').every(task=>task.status==='running'));assert.equal(answer.plan.status,'running');assert.equal(answer.fileOwners.digest,owners);assert.deepEqual(answer.tasks.filter(task=>task.roleId!=='Acceptance').map(task=>task.runId),runIds);assert.ok(answer.tasks.filter(task=>task.roleId!=='Acceptance').every(task=>task.status==='running'));
  released=true;for(const {record,reply}of held.values())completion(reply,protocol(record),'',{resource:'file0.txt',maxBytes:4096},'legion_read_file','worker-read-after-Su');const done=await until(setup.pipeline,state=>state.plan?.status==='completed');assert.ok(done.tasks.every(task=>task.checkStatus==='passed'));assert.equal(done.acceptances.at(-1).decision,'pass');await until(setup.pipeline,state=>state.supervisions.some(item=>item.phase==='monitor'&&item.status==='completed'));assert.deepEqual([...local.host.supervisionReads].sort(),['monitor','preflight']);
 }finally{released=true;await setup.pipeline.close();await local.close();}
});
