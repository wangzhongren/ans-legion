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
  randomBytes
} from 'node:crypto';
import {
  setTimeout as delay
} from 'node:timers/promises';
import {
  WorkbenchPipelineImpl,
  createWorkbenchPipeline
} from '../../src/pipelines/workbench.mjs';
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
const base = resolve(projectRoot, `.ans/runtime/legion-desktop-workbench-v2/${roleDirectory}`);
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
} function completion(reply, protocol, text, tool = null) {
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
          id: 'call1',
          type: 'function',
          function: {
            name: 'legion_write_file',
            arguments: JSON.stringify(tool)
          }
        }]
      };
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
      call_id: 'call1',
      name: 'legion_write_file',
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
        id: 'call1',
        name: 'legion_write_file',
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
  const sockets = new Set();
  const instance = createServer(async (request, reply) => {
    let raw = ''; for await (const chunk of request) raw += chunk; const body = JSON.parse(raw); const record = {
      url: request.url,
      body,
      headers: request.headers
    }; calls.push(record); try {
      await handler(record, reply);
    } catch (error) {
      reply.destroy(error);
    }
  });
  instance.on('connection', (socket) => {
    sockets.add(socket); socket.once('close', () => sockets.delete(socket));
  });
  await new Promise((done, reject) => {
    instance.once('error', reject); instance.listen(0, '127.0.0.1', done);
  });
  return {
    calls,
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
    userDataDir: data
  }, {
    profiles
  });
  const selected = await pipeline.selectProject(root);
  assert.equal(selected.ok, true);
  const projectId = selected.value.currentProject.id;
  assert.deepEqual(selected.value.roles, []);
  assert.equal((await pipeline.setDefaultProfile({
    profileId: ids[0]
  })).ok, true);
  return {
    root,
    data,
    location,
    profiles,
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
  } assert.fail('bounded condition did not complete');
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
} test('actual SDK: first Human message creates PM, two rounds tools=[]; three profile protocols execute confirmed dynamic DAG with real audit', async () => {
  let candidate; let discussion = 0; const local = await server((record, reply) => {
    if (!record.body.tools?.length) {
      discussion += 1; let text = '请确认详细需求'; if (discussion === 2) text = '方案\n```legion-plan\n' + JSON.stringify(candidate) + '\n```'; completion(reply, protocol(record), text);
    } else {
      assert.equal(record.body.tools.length, 1); if (hasResult(record.body)) completion(reply, protocol(record), '已按主机结果完成'); else completion(reply, protocol(record), '', {
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
        roleId: 'ProjectManager',
        text
      })).ok, true); await until(setup.pipeline, (state) => state.turn?.status === 'completed' || state.turn?.status === 'failed');
    } const draft = (await setup.pipeline.getState()).value; assert.equal(draft.turn.status, 'completed', JSON.stringify(draft.error)); assert.equal(draft.plan.status, 'draft'); assert.equal(draft.history.messages.length, 4); assert.equal(draft.roles.length, 4); assert.deepEqual(await readdir(setup.root), []); assert.equal(draft.plan.profileBindings.length, 3); assert.equal(new Set(draft.plan.profileBindings.map((item) => item.profileVersion)).size, 3); assert.equal((await setup.pipeline.confirmPlan({
      projectId: setup.projectId,
      planDigest: '0'.repeat(64)
    })).error.code, 'plan_changed'); assert.equal((await setup.pipeline.confirmPlan({
      projectId: setup.projectId,
      planDigest: draft.plan.planDigest
    })).ok, true); const done = await until(setup.pipeline, (state) => ['completed', 'failed', 'invalidated'].includes(state.plan.status)); assert.equal(done.plan.status, 'completed', JSON.stringify(done)); assert.deepEqual(done.tasks.map((task) => task.status), ['completed', 'completed', 'completed']); for (const task of done.tasks) {
      assert.equal(task.checkStatus, 'not_executed'); assert.equal(task.results[0].observedMutation, true); assert.equal(await readFile(join(setup.root, task.writeSet[0]), 'utf8'), '真实客户写入');
    } const audit = await readFile(join(setup.root, '.ans/events/index.jsonl'), 'utf8'); assert.ok(audit.includes('mutation_success')); assert.ok(audit.includes('agent_run_completed')); assert.equal(local.calls.length, 8); assert.equal(local.calls.slice(0, 2).every((record) => !record.body.tools?.length), true); for (const record of local.calls) {
      const index = Number(/^\/p(\d)/u.exec(record.url)[1]); let credential = record.headers.authorization; if (index === 2) credential = record.headers['x-api-key']; assert.ok(credential.includes(`localhost-key-${index}`));
    } const history = await readFile(join(setup.data, 'workbench-history', `${setup.projectId}.json`), 'utf8'); for (const forbidden of ['localhost-key-', 'Human明确选择的上下文', 'credentials', 'permit']) assert.equal(history.includes(forbidden), false);
  } finally {
    await setup.pipeline.close(); await local.close();
  }
});
test('same confirmed plan: changed context revokes all profile authorities, independent nodes stay blocked after old SHA restoration', async () => {
  let candidate; let setup; let touched = false; const local = await server(async (record, reply) => {
    if (!record.body.tools?.length) completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```'); else if (!hasResult(record.body)) {
      if (!touched) {
        touched = true; await writeFile(join(setup.root, 'context.txt'), '变更内容');
      } completion(reply, protocol(record), '', {
        resource: desiredFile(record.body),
        content: '不得写入'
      });
    } else completion(reply, protocol(record), '结束');
  }); setup = await fixture(local); candidate = proposal(setup.ids, true); await writeFile(join(setup.root, 'context.txt'), '原内容'); try {
    assert.equal((await setup.pipeline.selectContext({
      projectId: setup.projectId,
      resources: ['context.txt']
    })).ok, true); await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'ProjectManager',
      text: '只参考所选文件'
    }); const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft'); assert.equal((await setup.pipeline.confirmPlan({
      projectId: setup.projectId,
      planDigest: draft.plan.planDigest
    })).ok, true); const done = await until(setup.pipeline, (state) => state.plan?.status === 'invalidated'); await writeFile(join(setup.root, 'context.txt'), '原内容'); assert.equal((await setup.pipeline.confirmPlan({
      projectId: setup.projectId,
      planDigest: draft.plan.planDigest
    })).error.code, 'plan_changed'); assert.equal(done.tasks.slice(1).every((task) => task.status === 'blocked'), true); assert.equal(local.calls.filter((record) => record.body.tools?.length).length, 1); assert.equal((await readdir(setup.root)).some((name) => /^file/u.test(name)), false);
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
      roleId: 'ProjectManager',
      text: '旧项目秘密需求'
    }); await until(setup.pipeline, (state) => state.turn?.status === 'running'); const next = join(setup.location, 'second'); await mkdir(next); const selected = await setup.pipeline.selectProject(next); assert.equal(selected.ok, true); const secondId = selected.value.currentProject.id; assert.notEqual(secondId, setup.projectId); assert.equal(selected.value.history.messages.length, 0); hang = false; await setup.pipeline.sendMessage({
      projectId: secondId,
      roleId: 'ProjectManager',
      text: '新项目需求'
    }); const done = await until(setup.pipeline, (state) => state.turn?.status === 'completed'); assert.deepEqual(done.history.messages.map((item) => item.text), ['新项目需求', '第二个项目回复']); assert.equal(JSON.stringify(local.calls.at(-1).body).includes('旧项目秘密需求'), false); assert.equal((await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'ProjectManager',
      text: '旧事件'
    })).error.code, 'project_missing'); assert.deepEqual(await readdir(setup.root), []); await setup.pipeline.close(); assert.equal((await setup.pipeline.close()).ok, true); const restarted = new WorkbenchPipelineImpl({
      userDataDir: setup.data
    }); const state = await restarted.selectProject(next); assert.equal(state.ok, true); assert.deepEqual(state.value.history.messages, done.history.messages); assert.equal(state.value.turn, null); assert.equal((await restarted.confirmPlan({
      projectId: secondId,
      planDigest: 'a'.repeat(64)
    })).error.code, 'plan_changed'); await restarted.close();
  } finally {
    await setup.pipeline.close(); await local.close();
  }
});
test('profile revision change invalidates draft; arbitrary callbacks and direct execution IPC are rejected', async () => {
  let candidate; const local = await server((record, reply) => completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```')); const setup = await fixture(local); candidate = proposal(setup.ids.slice(0, 1)); try {
    await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'ProjectManager',
      text: '计划'
    }); const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft'); const first = (await setup.profiles.list()).value.profiles[0]; const {
      hasSavedKey,
      ...fields
    } = first; assert.equal((await setup.profiles.save({
      ...fields,
      name: '连接版本改变',
      keyAction: 'keep',
      apiKey: ''
    })).ok, true); assert.equal((await setup.pipeline.confirmPlan({
      projectId: setup.projectId,
      planDigest: draft.plan.planDigest
    })).error.code, 'plan_changed'); assert.deepEqual(await readdir(setup.root), []); assert.throws(() => createWorkbenchPipeline({
      userDataDir: setup.data,
      streamSimple: () => {
      }
    })); const facade = createWorkbenchPipeline({
      userDataDir: setup.data
    }); assert.equal(Object.hasOwn(facade, 'startAgent'), false); await facade.close();
  } finally {
    await setup.pipeline.close(); await local.close();
  }
});
test('completed SDK text without tools is failed target generation; actual run audit remains completed and checks unexecuted', async () => {
  let candidate; const local = await server((record, reply) => {
    let text = '我已完成所有文件和检查'; if (!record.body.tools?.length) text = '```legion-plan\n' + JSON.stringify(candidate) + '\n```'; completion(reply, protocol(record), text);
  }); const setup = await fixture(local); candidate = proposal(setup.ids.slice(0, 1)); try {
    await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'ProjectManager',
      text: '生成文件'
    }); const draft = await until(setup.pipeline, (state) => state.plan?.status === 'draft'); await setup.pipeline.confirmPlan({
      projectId: setup.projectId,
      planDigest: draft.plan.planDigest
    }); const done = await until(setup.pipeline, (state) => state.plan?.status === 'failed'); assert.equal(done.tasks[0].status, 'failed'); assert.equal(done.tasks[0].error.code, 'task_outputs_missing'); assert.deepEqual(done.tasks[0].results, []); assert.equal(done.tasks[0].checkStatus, 'not_executed'); assert.equal((await readdir(setup.root)).includes('file0.txt'), false); const audit = await readFile(join(setup.root, '.ans/events/index.jsonl'), 'utf8'); assert.ok(audit.includes('agent_run_completed')); assert.equal(audit.includes('mutation_success'), false);
  } finally {
    await setup.pipeline.close(); await local.close();
  }
});
test('stop revokes at entry while queue awaits slow state; wrong project cannot cancel; late tool never commits', async () => {
  let candidate; let held; const local = await server((record, reply) => {
    if (!record.body.tools?.length) completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```'); else held = {
      record,
      reply
    };
  }); const setup = await fixture(local); candidate = proposal(setup.ids.slice(0, 1)); try {
    await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'ProjectManager',
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
    }); await delay(30); unblock(); await slow; const stopped = await stopping; assert.equal(stopped.ok, true); assert.equal(stopped.value.plan.status, 'invalidated'); assert.equal((await readdir(setup.root)).includes('file0.txt'), false);
  } finally {
    await setup.pipeline.close(); await local.close();
  }
});
test('close invalidates in-flight confirmation before active assignment; idempotent close emits no execution request', async () => {
  let candidate; const local = await server((record, reply) => completion(reply, protocol(record), '```legion-plan\n' + JSON.stringify(candidate) + '\n```')); const setup = await fixture(local); candidate = proposal(setup.ids.slice(0, 1)); try {
    await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'ProjectManager',
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
    }); await waiting; const closed = setup.pipeline.close(); setup.profiles.resolveConnection = original; unblock(); assert.equal((await confirming).ok, false); assert.equal((await closed).ok, true); assert.equal((await setup.pipeline.close()).ok, true); assert.equal(local.calls.length, 1); assert.deepEqual(await readdir(setup.root), []);
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
      roleId: 'ProjectManager',
      text: '停止这轮'
    }); const cancelled = await setup.pipeline.cancelTurn({
      projectId: setup.projectId,
      turnId: sent.value.turn.id
    }); assert.equal(cancelled.value.turn.status, 'cancelled'); assert.equal(cancelled.value.history.messages.length, 0); hanging = false; await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'ProjectManager',
      text: '继续'
    }); const done = await until(setup.pipeline, (state) => state.turn?.status === 'completed'); assert.deepEqual(done.history.messages.map((item) => item.text), ['继续', '继续回复']); hanging = true; await setup.pipeline.sendMessage({
      projectId: setup.projectId,
      roleId: 'ProjectManager',
      text: '关闭'
    }); assert.equal((await setup.pipeline.close()).ok, true);
  } finally {
    await setup.pipeline.close(); await local.close();
  }
});
