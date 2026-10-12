import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { resolve, join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { chatOptions, deliverySummary, selectInteraction, interactionIdentity, discardInteractionError } from '../../bin/chat.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const packaging=join(root,'.ans/runtime/legion-desktop-command-center-v1/ProjectManager/packaging/desktop-image-input-v1-facade-repair-20261012');
const generated=join(root,'.ans/runtime/legion-desktop-command-center-v1/ProjectManager/fixtures/desktop-image-input-v1-facade-repair-20261012');
const keyGuardSources=['src/kernel/services/impl/check.mjs','src/kernel/services/impl/shell.mjs','src/kernel/providers/impl/check.mjs','src/kernel/providers/impl/shell.mjs'];
const strings=value=>typeof value==='string'?[value]:Array.isArray(value)?value.flatMap(strings):value&&typeof value==='object'?Object.values(value).flatMap(strings):[];
const results=body=>strings(body).flatMap(text=>{try{const p=JSON.parse(text);return p.result?[p]:[];}catch{return [];}});
const taskOf=body=>{const text=strings(body).find(text=>text.startsWith('Human已确认任务：'));return text?JSON.parse(text.split('\n')[0].slice('Human已确认任务：'.length)):null;};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function allFiles(directory){const out=[];for(const e of await fs.readdir(directory,{withFileTypes:true})){assert.equal(e.isSymbolicLink(),false);const p=join(directory,e.name);if(e.isDirectory())out.push(...await allFiles(p));else out.push(p);}return out;}
async function waitFor(predicate,description){for(let i=0;i<1600;i++){if(predicate())return;await delay(20);}assert.fail('timeout: '+description);}
async function isolatedConsumer(){await fs.mkdir(packaging,{recursive:true});const dir=await fs.mkdtemp(join(packaging,'cli-consumer-'));const smoke=JSON.parse(await fs.readFile(join(packaging,'package-smoke.json'),'utf8'));const spec='file:'+smoke.tarball;
const lock=JSON.parse(await fs.readFile(join(root,'package-lock.json'),'utf8'));lock.name='installed-cli-test';lock.version='1.3.1';lock.packages['']={name:lock.name,version:lock.version,dependencies:{'legion-runtime':spec}};lock.packages['node_modules/legion-runtime']={version:'1.3.1',resolved:spec,integrity:smoke.integrity,dependencies:{'@earendil-works/pi-ai':'1.0.4','@earendil-works/pi-coding-agent':'1.0.4'},bin:{legion:'bin/legion.mjs'},engines:{node:'>=22.19.0'}};
await fs.writeFile(join(dir,'package.json'),JSON.stringify({name:lock.name,private:true,type:'module',dependencies:{'legion-runtime':spec}}));await fs.writeFile(join(dir,'package-lock.json'),JSON.stringify(lock));
const install=spawnSync('npm',['ci','--offline','--ignore-scripts','--no-audit','--no-fund','--cache',join(root,'.ans/runtime/legion-desktop-command-center-v1/ProjectManager/npm-cache/desktop-image-input-v1-facade-repair-20261012')],{cwd:dir,encoding:'utf8',env:{...process.env,NODE_OPTIONS:'',NODE_PATH:''},timeout:120000});assert.equal(install.status,0,install.stdout+install.stderr);await assert.rejects(fs.stat(join(dir,'node_modules/electron')),e=>e.code==='ENOENT');
for(const file of keyGuardSources)assert.equal(hash(await fs.readFile(join(dir,'node_modules/legion-runtime',file))),smoke.keyGuardSources[file]);return dir;}
function sse(reply,data,name=''){if(name)reply.write('event: '+name+'\n');reply.write('data: '+JSON.stringify(data)+'\n\n');}
function completion(reply,protocol,text,tool=null,toolName='legion_write_file',toolCallId='call1'){
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
}
function partialCompletion(reply, protocol) {
  reply.writeHead(200, { 'content-type': 'text/event-stream' });
  const text = 'UNFINISHED_CANCEL_CHUNK';
  if (protocol === 'openai-completions') sse(reply, { id: 'partial', object: 'chat.completion.chunk', model: 'local', choices: [{ index: 0, delta: { role: 'assistant', content: text }, finish_reason: null }] });
  else if (protocol === 'openai-responses') {
    sse(reply, { type: 'response.created', response: { id: 'partial', status: 'in_progress', output: [] } }, 'response.created');
    sse(reply, { type: 'response.output_item.added', output_index: 0, item: { id: 'partial-item', type: 'message', role: 'assistant', status: 'in_progress', content: [] } }, 'response.output_item.added');
    sse(reply, { type: 'response.content_part.added', output_index: 0, content_index: 0, item_id: 'partial-item', part: { type: 'output_text', text: '', annotations: [] } }, 'response.content_part.added');
    sse(reply, { type: 'response.output_text.delta', output_index: 0, content_index: 0, item_id: 'partial-item', delta: text }, 'response.output_text.delta');
  } else {
    sse(reply, { type: 'message_start', message: { id: 'partial', type: 'message', role: 'assistant', model: 'local', content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } }, 'message_start');
    sse(reply, { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }, 'content_block_start');
    sse(reply, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }, 'content_block_delta');
  }
}
const duties={Acceptance:'独立验证跨角色和完整流程；只维护自己的测试、夹具和报告'};
function specification(id,files){const resource='tests/Acceptance/'+id+'.test.mjs';return {checkId:'check-'+id,kind:'node-test',argv:['--test',resource],testResources:[resource],inputResources:[resource,'package.json',...files],outputResources:[],timeoutSeconds:10,network:'none',logMaxBytes:8192};}
async function scenario(consumer,protocol,mode='normal') {
  const location=await fs.mkdtemp(join(generated,'installed-chat-'));const workspace=join(location,'customer'),data=join(location,'private');await fs.mkdir(workspace);await fs.mkdir(join(workspace,'tests/Acceptance'),{recursive:true});await fs.writeFile(join(workspace,'shared.md'),'global project read');await fs.writeFile(join(workspace,'package.json'),'{"name":"cli-customer","type":"module"}');
  for(const id of ['a','b'])await fs.writeFile(join(workspace,'tests/Acceptance/'+id+'.test.mjs'),"import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';test('current file',()=>assert.equal(readFileSync('"+id+".txt','utf8'),'actual-"+id+"'));\n");
  if(mode==='failure-next')await fs.writeFile(join(workspace,'tests/Acceptance/a.test.mjs'),"import test from 'node:test';import assert from 'node:assert/strict';test('actual contract failure',()=>assert.fail('customer contract deliberately fails'));");
  const secret='legion-current-key-'+randomUUID();let turns=0,organization=null;const observed={calls:0,supervision:[],taskStarts:new Set(),queries:0,remembered:0,recalled:0,globalRead:0,activity:0,logs:0,question:0};const held=[];let stage='discussion';let plannedCandidate;let secondDraft;let waitingMonitor;
  const server=createServer(async(req,res)=>{try{let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);observed.calls++;assert.ok(req.headers.authorization?.includes(secret)||req.headers['x-api-key']===secret);const toolNames=(body.tools??[]).map(t=>t.function?.name??t.name);const pairs=results(body);const task=taskOf(body);const emit=(text,parameters=null,name='legion_write_file')=>completion(res,protocol,text,parameters,name,randomUUID());
    if(toolNames.includes('legion_delegate_pm')) {
      if(mode==='failure-next'&&JSON.stringify(body).includes('New requirement immediately after failure')){observed.nextHttp=true;if(waitingMonitor){waitingMonitor();waitingMonitor=null;}}
      if(mode==='text-key'){emit('model returned '+secret);return;}if(mode==='cancel'){if(observed.calls===1){partialCompletion(res,protocol);observed.partialSent=true;return;}assert.equal(observed.calls,2);assert.ok(JSON.stringify(body).includes('first discussion'));assert.ok(JSON.stringify(body).includes('Continue'));assert.equal(JSON.stringify(body).includes('UNFINISHED_CANCEL_CHUNK'),false);assert.equal(pairs.length,0);emit('continued actual Su reply');return;}
      const prompt=strings(body).findLast(text=>text.includes('Human消息：\n'));let human='';if(prompt)human=prompt.split('Human消息：\n')[1].split('\n')[0];
      if(human==='first discussion'){
        if(!pairs.some(p=>p.result.status==='listed')){emit('',{resource:''},'legion_list_files');return;}
        const read=pairs.findLast(p=>p.result.status==='read'&&p.result.resource==='shared.md');if(!read){emit('',{resource:'shared.md'},'legion_read_file');return;}assert.equal(read.result.text,'global project read');observed.globalRead++;emit('first discussion complete');return;
      }
      if(human==='progress now'){
        const activity=pairs.findLast(p=>p.result.tool==='legion_query_role_activity');if(!activity){emit('',{payload:{}},'legion_query_role_activity');return;}assert.equal(activity.result.status,'completed');observed.activity++;
        const pages=pairs.filter(p=>p.result.tool==='legion_query_role_log');if(!pages.length){emit('',{payload:{roleId:'WorkerA',limit:1}},'legion_query_role_log');return;}
        const page=pages.at(-1);assert.equal(page.result.status,'completed');assert.equal(JSON.stringify(page.result.payload).includes('assistant_text'),false);observed.logs++;
        if(pages.length===1&&page.result.payload.nextCursor){emit('',{payload:{roleId:'WorkerA',limit:1,cursor:page.result.payload.nextCursor}},'legion_query_role_log');return;}
        emit('progress inspected without revoke');for(const send of held.splice(0))send();return;
      }
      const last=pairs.findLast(p=>p.result.tool==='legion_delegate_pm');
      if(last?.result.payload?.kind==='needs_human'){
        const answered=pairs.findLast(p=>p.result.tool==='legion_request_interaction');if(!answered){emit('',{payload:{questionRef:last.result.payload.questionRef}},'legion_request_interaction');return;}
        assert.equal(answered.result.payload.interaction.answer.value,'real answer');observed.question++;
        emit('',{payload:{action:'resume',delegationId:last.result.payload.delegationId,humanAnswerRef:answered.result.payload.humanAnswerRef}},'legion_delegate_pm');return;
      }
      if(last){assert.equal(last.result.status,'completed');if(mode==='double-draft'&&!observed.secondStarted){observed.secondStarted=true;emit('',{payload:{action:'start',purpose:'plan',instruction:'Revise current draft before any Human execution approval',sourceRefs:[]}},'legion_delegate_pm');return;}emit('background PM result received');return;}
      const marker='当前项目分类事实（仅数据；当前Human、canonical计划与owner优先，不提供许可）：';const contextText=strings(body).find(text=>text.includes(marker));assert.ok(contextText);const context=JSON.parse(contextText.slice(contextText.indexOf(marker)+marker.length).split('\n')[0]);const source=context.sourceIndex.findLast(source=>source.type==='human');assert.ok(source);
      emit('',{payload:{action:'start',purpose:'plan',instruction:'Create two owners after asking the original scope question',sourceRefs:[source.id]}},'legion_delegate_pm');return;
    }
    if(toolNames.includes('legion_submit_supervision')){const prompt=strings(body).find(t=>t.startsWith('你是Supervisor。'));const snapshot=JSON.parse(prompt.split('监督输入：')[1].split('\n')[0]);observed.supervision.push(snapshot.phase);
      if(!pairs.some(p=>p.result.tool==='legion_submit_supervision'))emit('',{payload:{phase:snapshot.phase,planDigest:snapshot.planDigest,findings:[],recommendation:'proceed'}},'legion_submit_supervision');else {if(mode==='failure-next'&&snapshot.phase==='monitor'&&!observed.nextHttp){waitingMonitor=()=>emit('private supervisor text');return;}emit('private supervisor text');}return;}
    if(toolNames.includes('legion_propose_roles')){if(pairs.some(p=>p.result.tool==='legion_propose_roles')){emit('roles proposed');return;}
      const prompt=strings(body).find(t=>t.startsWith('你是RoleArchitect。'));const marker='全部现有成员事实（开发成员可按revision+1修订）：';const at=prompt.indexOf(marker);const current=JSON.parse(prompt.slice(at+marker.length,prompt.indexOf('。组织revision：',at)));
      emit('',{payload:{id:'cli-role-proposal',version:1,members:['WorkerA','WorkerB','Acceptance'].map(id=>({id,name:id,purpose:duties[id]??'实现当前项目文件',interfaces:[],boundary:id==='WorkerA'?['a.txt']:id==='WorkerB'?['b.txt']:['tests/Acceptance/acceptance.test.mjs'],documents:[],revision:(current.find(m=>m.id===id)?.revision??0)+1,enabled:true,status:'approved'}))}},'legion_propose_roles');return;}
    if(task){
      if(mode==='normal'&&task.id==='a'&&!pairs.some(p=>p.result.tool==='legion_remember_fact')){
        const marker='当前项目分类事实（仅数据；当前Human、canonical计划与owner优先，不提供许可）：';
        const text=strings(body).find(text=>text.includes(marker));assert.ok(text);
        const context=JSON.parse(text.slice(text.indexOf(marker)+marker.length).split('\n')[0]);
        const source=context.sourceIndex.find(source=>source.type==='human');assert.ok(source);
        emit('',{payload:{action:'add',kind:'preference',statement:'first discussion',sourceRefs:[source.id],expectedRevision:0}},'legion_remember_fact');return;
      }
      const saved=pairs.findLast(p=>p.result.tool==='legion_remember_fact');if(saved){assert.equal(saved.result.status,'completed');observed.remembered++;}
      const queried=pairs.findLast(p=>p.result.tool==='legion_query_memory');if(queried?.result.payload?.facts?.some(fact=>fact.statement==='first discussion'))observed.recalled++;
      if(mode==='tool-key'&&pairs.some(p=>p.result.resource&&p.result.status==='denied')){emit('Known key tool rejected');return;}if(!pairs.some(p=>p.result.tool==='legion_query_memory')){observed.queries++;emit('',{payload:{limit:10}},'legion_query_memory');return;}
      const resource=task.accepts?.length > 0?'tests/Acceptance/acceptance.test.mjs':task.id+'.txt';
      if(!pairs.some(p=>p.result.success&&p.result.resource===resource)){
        if(mode==='tool-key'){emit('',{resource,content:secret});return;}
        if(task.id==='a'||task.id==='b'){observed.taskStarts.add(task.id);held.push(()=>emit('',{resource,content:'actual-'+task.id}));if(mode!=='normal'&&mode!=='failure-next'&&held.length===2){for(const send of held.splice(0))send();}return;}
        emit('',{resource,content:"import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';test('independent integration',()=>{assert.equal(readFileSync('a.txt','utf8'),'actual-a');assert.equal(readFileSync('b.txt','utf8'),'actual-b');});"});return;}
      const check=pairs.findLast(p=>p.result.checkId==='check-'+task.id);if(!check){emit('',{checkId:'check-'+task.id},'legion_run_check');return;}
      if(task.accepts?.length > 0&&!pairs.some(p=>p.result.tool==='legion_submit_acceptance')){emit('',{payload:{taskId:task.id,evidenceIds:[check.result.requestId],decision:'pass',issues:[]}},'legion_submit_acceptance');return;}
      emit('actual task completed');return;}
    if(mode==='failure-next'&&stage==='planned'){emit('```legion-plan\n'+JSON.stringify({...plannedCandidate,goal:'NEW_AFTER_FAILURE_CURRENT_CONFIRMATION'})+'\n```');return;}
    if(mode==='double-draft'&&stage==='planned'){secondDraft=()=>emit('```legion-plan\n'+JSON.stringify({...plannedCandidate,goal:'SECOND_CURRENT_DRAFT_REQUIRES_NEW_HUMAN'})+'\n```');return;}
    if(stage==='discussion'){stage='pm-question';emit('',{payload:{kind:'question',purpose:'discussion',title:'PM original scope question',text:'Confirm desired outputs before role design',options:[],allowSupplement:false}},'legion_request_interaction');return;}
    if(stage==='pm-question'){stage='design';emit('',{payload:{instruction:'Create two independent owners and Acceptance'}},'legion_design_roles');return;}
    if(stage==='design'){const proposal=pairs.findLast(p=>p.result.tool==='legion_design_roles')?.result.payload.proposal;assert.ok(proposal);stage='review';emit('',{payload:{proposalId:proposal.id,version:proposal.version,digest:proposal.digest,organizationRevision:proposal.baseRevision,organizationDigest:proposal.baseDigest,decision:'approve',reason:'current roles'}},'legion_review_roles');return;}
    if(stage==='review'){organization=pairs.findLast(p=>p.result.tool==='legion_review_roles')?.result.payload.organization;assert.ok(organization);stage='planned';const roles=['WorkerA','WorkerB','Acceptance'].map(id=>{const member=organization.members.find(m=>m.id===id);return {id,name:member.name,purpose:member.purpose,revision:member.revision,digest:member.digest,profileId:'environment'};});
      const tasks=['a','b'].map(id=>({id,title:'write '+id,roleId:id==='a'?'WorkerA':'WorkerB',profileId:'environment',intent:'change',dependsOn:[],instruction:'write '+id+'.txt with actual-'+id,checks:[specification(id,[id+'.txt'])]}));tasks.push({id:'acceptance',title:'independent acceptance',roleId:'Acceptance',profileId:'environment',intent:'change',dependsOn:['a','b'],accepts:['a','b'],instruction:'verify both outputs',checks:[{...specification('acceptance',['a.txt','b.txt']),argv:['--test','tests/Acceptance/acceptance.test.mjs'],testResources:['tests/Acceptance/acceptance.test.mjs'],inputResources:['tests/Acceptance/acceptance.test.mjs','package.json','a.txt','b.txt']}]});
      plannedCandidate={schemaVersion:2,goal:'installed CLI independent owners',roles,tasks,governance:{organizationRevision:organization.revision,organizationDigest:organization.digest,maxRepairRounds:2}};emit('```legion-plan\n'+JSON.stringify(plannedCandidate)+'\n```');return;}
    emit('ready for next request');
  }catch(error){res.destroy();observed.error=error.message;}});
  await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done);});
  const stat=await fs.stat(workspace,{bigint:true});const identity={canonicalPath:await fs.realpath(workspace),deviceId:String(stat.dev),fileId:String(stat.ino)};const fixtureKey=hash(Buffer.from(identity.deviceId+':'+identity.fileId));const leaseRoot=join(homedir(),'.legion-project-leases'),marker=join(leaseRoot,fixtureKey+'.owner-source.json');
  await assert.rejects(fs.lstat(marker),e=>e.code==='ENOENT');await assert.rejects(fs.lstat(join(leaseRoot,fixtureKey)),e=>e.code==='ENOENT');
  const env={...process.env,LEGION_API_KEY:secret,LEGION_PROTOCOL:protocol,LEGION_PROVIDER:'local',LEGION_MODEL:'local',LEGION_BASE_URL:'http://127.0.0.1:'+server.address().port+'/v1',NODE_OPTIONS:'',NODE_PATH:''};
  let out='',err='';const child=spawn(join(consumer,'node_modules/.bin/legion'),['chat','--project',workspace,'--user-data',data],{cwd:consumer,env,stdio:['pipe','pipe','pipe']});child.stdout.on('data',b=>{out+=b;});child.stderr.on('data',b=>{err+=b;});let exit=null;child.on('close',code=>{exit=code;});
  try{
    await waitFor(()=>out.includes('二哥>'),'initial customer prompt');assert.ok(out.includes('二哥 · /cancel 取消 · /exit 退出'));assert.equal(out.includes('Legion Su')||out.includes('Su>'),false);child.stdin.write('first discussion\n');
    if(mode==='cancel'){await waitFor(()=>observed.partialSent,'partial SSE in flight');child.stdin.write('/cancel\n');await waitFor(()=>out.includes('Cancelled'),'cancel completed');child.stdin.write('Continue\n');await waitFor(()=>observed.calls===2&&out.includes('continued actual Su reply'),'actual second HTTP and completed Su reply');assert.equal(observed.calls,2);assert.equal(out.includes('UNFINISHED_CANCEL_CHUNK'),false);}
    else if(mode==='text-key'){await waitFor(()=>out.includes('Failure: sensitive_output'),'known-key text failure');}
    else {await waitFor(()=>out.includes('first discussion complete'),'first actual model reply');child.stdin.write('implement plan\n');await waitFor(()=>out.includes('PM original scope question')&&out.includes('Answer>'),'PM question via Su');child.stdin.write('real answer\n');await waitFor(()=>out.includes('Answer> yes / no'),'Human confirmation');assert.ok(out.includes('a.txt')&&out.includes('b.txt')&&out.includes('WorkerA')&&out.includes('WorkerB'));await assert.rejects(fs.stat(join(workspace,'a.txt')),e=>e.code==='ENOENT');if(mode==='double-draft'){await waitFor(()=>!!secondDraft,'second PM draft ready');secondDraft();let current=false;for(let attempt=0;attempt<400;attempt++){const catalog=JSON.parse(await fs.readFile(join(data,'workbench-projects.json'),'utf8'));current=catalog.projects.some(project=>project.plan?.goal==='SECOND_CURRENT_DRAFT_REQUIRES_NEW_HUMAN');if(current)break;await delay(20);}assert.equal(current,true);child.stdin.write('yes\n');await waitFor(()=>out.includes('Refused: stale_interaction'),'old A actual Host refusal');assert.equal(observed.taskStarts.size,0);await assert.rejects(fs.stat(join(workspace,'a.txt')),error=>error.code==='ENOENT');await waitFor(()=>out.includes('SECOND_CURRENT_DRAFT_REQUIRES_NEW_HUMAN'),'current B presentation');assert.equal(observed.taskStarts.size,0);child.stdin.write('no\n');await waitFor(()=>out.includes('Delivery:')||out.includes('human_rejected'),'new B separate Human refusal');child.stdin.write('/exit\n');await waitFor(()=>exit!==null,'double-draft close');assert.equal(exit,0,err);await fs.writeFile(join(location,'result.json'),JSON.stringify({protocol,mode,oldYesNotReplayed:true,currentBPresented:true,zeroOldWrites:true}));return {protocol,mode,oldYesNotReplayed:true,currentBPresented:true,zeroOldWrites:true};}child.stdin.write('yes\n');if(mode==='normal'||mode==='failure-next'){await waitFor(()=>observed.taskStarts.size===2,'two owners in flight');child.stdin.write('progress now\n');await waitFor(()=>out.includes('progress inspected without revoke'),'foreground progress response');}if(mode==='failure-next'){
        let failed=false;for(let attempt=0;attempt<800;attempt++){const catalog=JSON.parse(await fs.readFile(join(data,'workbench-projects.json'),'utf8'));failed=catalog.projects.some(project=>project.plan?.status==='failed');if(failed)break;await delay(20);}assert.equal(failed,true);child.stdin.write('New requirement immediately after failure\n');
        await waitFor(()=>observed.nextHttp,'actual new Human HTTP while monitor finalize is held');await waitFor(()=>out.includes('NEW_AFTER_FAILURE_CURRENT_CONFIRMATION'),'new current draft confirmation');assert.equal(out.includes('stale_role_memory'),false);child.stdin.write('no\n');child.stdin.write('/exit\n');await waitFor(()=>exit!==null,'failed-plan next Human close');assert.equal(exit,0,err);const row={protocol,mode,actualCheckFailed:true,nextActualHttp:true,newCurrentDraft:true};await fs.writeFile(join(location,'result.json'),JSON.stringify(row));return row;
      }await waitFor(()=>out.includes('Delivery:'),'delivery result');
      if(mode==='normal'){assert.match(out,/Delivery: completed/);assert.match(out,/二哥监控: completed/);assert.equal(await fs.readFile(join(workspace,'a.txt'),'utf8'),'actual-a');assert.equal(await fs.readFile(join(workspace,'b.txt'),'utf8'),'actual-b');assert.equal(observed.taskStarts.size,2);assert.ok(observed.queries>=3);assert.ok(observed.globalRead>0&&observed.activity>0&&observed.logs>0&&observed.question>0);assert.ok(observed.remembered>0&&observed.recalled>0);assert.ok(observed.supervision.includes('preflight')&&observed.supervision.includes('monitor'));assert.match(out,/Acceptance.*pass/);}
      else {assert.doesNotMatch(out,/Delivery: completed/);await assert.rejects(fs.stat(join(workspace,'a.txt')),e=>e.code==='ENOENT');}}
    child.stdin.write('/exit\n');await waitFor(()=>exit!==null,'CLI close');assert.equal(exit,0,err);assert.equal(out.includes(secret)||err.includes(secret),false);
    for(const dir of [data,workspace])for(const file of await allFiles(dir))assert.equal((await fs.readFile(file)).includes(Buffer.from(secret)),false,'known key persisted:'+file);
    assert.equal((await fs.readdir(data)).some(name=>name.includes('settings')),false);if(mode==='cancel'){
      let persisted='';
      for(const file of await allFiles(data)){
        const text=await fs.readFile(file,'utf8');persisted+=text;
        if(file.endsWith('.json')){
          const document=JSON.parse(text);
          if(document.customerTimeline){
            assert.equal(JSON.stringify(document.roleMemories).includes('UNFINISHED_CANCEL_CHUNK'),false);
            for(const message of document.customerTimeline.messages){
              if(!message.text.includes('UNFINISHED_CANCEL_CHUNK'))continue;
              assert.equal(message.kind,'assistant');const turn=document.customerTimeline.turns.find(turn=>turn.id===message.turnId);assert.ok(turn);assert.equal(turn.status,'cancelled');
            }
          }else assert.equal(text.includes('UNFINISHED_CANCEL_CHUNK'),false,'partial outside cancelled journal');
        }
      }
      assert.ok(persisted.includes('first discussion')&&persisted.includes('Continue'));assert.equal(observed.taskStarts.size,0);
    }
    const evidence={protocol,mode,calls:observed.calls,queries:observed.queries,globalRead:observed.globalRead,activity:observed.activity,logs:observed.logs,question:observed.question,remembered:observed.remembered,recalled:observed.recalled,supervision:observed.supervision,actualInstalledBinary:true,noElectron:true,knownKeyAbsent:true,parallelOwners:observed.taskStarts.size};await fs.writeFile(join(location,'result.json'),JSON.stringify(evidence,null,2));return evidence;
  }finally{
    if(!out.includes(secret)&&!err.includes(secret))await fs.writeFile(join(location,'cli-output.json'),JSON.stringify({stdout:out,stderr:err,modelError:observed.error??null}));
    if(exit===null){child.stdin.write('/exit\n');await waitFor(()=>exit!==null,'cleanup CLI');}server.closeAllConnections();await new Promise(done=>server.close(done));
    let bytes;try{bytes=await fs.readFile(marker);}catch(error){if(error.code!=='ENOENT')throw error;}
    if(bytes){const source=JSON.parse(bytes);assert.deepEqual(source.workspace,identity);assert.equal(source.source.catalogDirCanonicalPath,await fs.realpath(data));assert.equal(source.source.filename,'workbench-projects.json');const catalogStat=await fs.stat(data,{bigint:true});assert.equal(source.source.dirDeviceId,String(catalogStat.dev));assert.equal(source.source.dirFileId,String(catalogStat.ino));const info=await fs.lstat(marker);assert.equal(info.isSymbolicLink(),false);assert.equal(info.mode&0o777,0o600);await assert.rejects(fs.lstat(join(leaseRoot,fixtureKey)),e=>e.code==='ENOENT');assert.deepEqual(await fs.readFile(marker),bytes);await fs.unlink(marker);}
  }
}
test('CLI options reject user lease injection and delivery never invents monitor success',()=>{assert.throws(()=>chatOptions(['--lease-root','/tmp']),/invalid_cli_options/);assert.match(deliverySummary({plan:{status:'completed'},tasks:[]}),/二哥监控: not_completed/);const current=deliverySummary({plan:{status:'completed',planDigest:'current'},tasks:[],evidence:[{id:'old',planDigest:'old',checkId:'OLD_CHECK',status:'passed'}],acceptances:[{id:'old',planDigest:'old',taskId:'OLD_ACCEPTANCE',decision:'pass'}]});assert.equal(current.includes('OLD_CHECK')||current.includes('OLD_ACCEPTANCE'),false);const oldRun=deliverySummary({plan:{status:'completed',planDigest:'current'},tasks:[{id:'task',runId:'new',evidenceIds:['old-proof']}],evidence:[{id:'old-proof',taskId:'task',planDigest:'current',result:{checkId:'OLD_RUN',runId:'old',status:'passed',executed:true}}]});assert.equal(oldRun.includes('OLD_RUN'),false);assert.match(oldRun,/Evidence omitted: 1/);});
test('installed production CLI three protocols, multi-round Human owner confirmation, parallel workers, Checks, Acceptance, memory query, Supervisor; cancel and known-key text/tool failures', {timeout:240000}, async()=>{
 const consumer=await isolatedConsumer();const evidence=[];
 for(const protocol of ['openai-completions','openai-responses','anthropic-messages'])evidence.push(await scenario(consumer,protocol));
 for(const protocol of ['openai-completions','openai-responses','anthropic-messages'])evidence.push(await scenario(consumer,protocol,'cancel'));
 for(const mode of ['text-key','tool-key','double-draft','failure-next'])evidence.push(await scenario(consumer,'openai-completions',mode));
 await fs.writeFile(join(packaging,'installed-cli-flow.json'),JSON.stringify(evidence,null,2)+'\n');
});

test('interaction selection preserves discussion bindings, picks current plan and excludes only exact permanently stale identities',()=>{
 const a={requestId:'A',version:1,digest:'a',projectId:'project',status:'pending',purpose:'execute_plan',createdOrder:1,bindings:{planDigest:'A'}};
 const b={...a,requestId:'B',digest:'b',createdOrder:2,bindings:{planDigest:'B'}};
 const state={currentProject:{id:'project'},plan:{planDigest:'B'},interactions:[a,b]};assert.equal(selectInteraction(state).requestId,'B');
 const discussion={...a,requestId:'discussion',purpose:'discussion',createdOrder:3,bindings:{profileVersion:'its-own-profile'}};assert.equal(selectInteraction({...state,interactions:[a,b,discussion]}).requestId,'discussion');
 const unavailable=new Set([interactionIdentity(discussion)]);assert.equal(selectInteraction({...state,interactions:[a,b,discussion]},unavailable).requestId,'B');
 assert.equal(discardInteractionError('organization_busy'),false);assert.equal(discardInteractionError('stale_interaction'),true);assert.equal(discardInteractionError('interaction_invalidated'),true);assert.equal(discardInteractionError('stale_file_owners'),true);
 assert.equal(selectInteraction({...state,interactions:[a]}),undefined);
});
