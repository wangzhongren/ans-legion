import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createServer} from 'node:http';
import {spawn,spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {join,resolve,dirname} from 'node:path';
import {homedir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const generated=join(root,'.ans/runtime/legion-desktop-command-center-v1/Tester');
const tar=join(root,'.ans/runtime/legion-desktop-command-center-v1/ProjectManager/packaging/er-ge-display-name-v1-final-v2-a689a7d63d7dfc26/legion-runtime-1.2.3.tgz');
const expectedTar='98953815f443fdfda082cce94561d0c77b15141f6db511feb607ebd4ff0b62f4';
const hash=v=>createHash('sha256').update(v).digest('hex');
const strings=v=>typeof v==='string'?[v]:Array.isArray(v)?v.flatMap(strings):v&&typeof v==='object'?Object.values(v).flatMap(strings):[];
const results=body=>strings(body).flatMap(s=>{try{const x=JSON.parse(s);return x.result?[x]:[];}catch{return [];}});
const taskOf=body=>{const s=strings(body).find(s=>s.startsWith('Human已确认任务：'));return s?JSON.parse(s.split('\n')[0].slice('Human已确认任务：'.length)):null;};
async function files(dir){const out=[];for(const item of await fs.readdir(dir,{withFileTypes:true})){assert.equal(item.isSymbolicLink(),false);const path=join(dir,item.name);if(item.isDirectory())out.push(...await files(path));else if(item.isFile())out.push(path);}return out;}
async function until(fn,label){for(let i=0;i<1200;i++){if(await fn())return;await delay(20);}assert.fail('timeout '+label);}
async function absent(path){try{await fs.lstat(path);return false;}catch(e){if(e.code==='ENOENT')return true;throw e;}}
async function id(path){const s=await fs.lstat(path,{bigint:true});assert.equal(s.isSymbolicLink(),false);return {deviceId:String(s.dev),fileId:String(s.ino)};}
async function fresh(kind,prefix){const base=join(generated,kind);await fs.mkdir(base,{recursive:true,mode:0o700});assert.equal(await fs.realpath(base),base);return fs.mkdtemp(join(base,'er-ge-'+prefix));}
async function consumer(){const dir=await fresh('packaging','independent-consumer-');assert.equal(hash(await fs.readFile(tar)),expectedTar);const spec='file:'+tar;const lock=JSON.parse(await fs.readFile(join(root,'package-lock.json'),'utf8'));lock.name='tester-independent';lock.version='1.2.3';lock.packages['']={name:lock.name,version:lock.version,dependencies:{'legion-runtime':spec}};const integrity='sha512-'+createHash('sha512').update(await fs.readFile(tar)).digest('base64');lock.packages['node_modules/legion-runtime']={version:'1.2.3',resolved:spec,integrity,dependencies:{'@earendil-works/pi-ai':'1.0.4','@earendil-works/pi-coding-agent':'1.0.4'},bin:{legion:'bin/legion.mjs'},engines:{node:'>=22.19.0'}};await fs.writeFile(join(dir,'package.json'),JSON.stringify({name:lock.name,private:true,type:'module',dependencies:{'legion-runtime':spec}}));await fs.writeFile(join(dir,'package-lock.json'),JSON.stringify(lock));const cache=await fresh('npm-cache','installed-');await fs.cp(join(root,'.ans/runtime/legion-desktop-command-center-v1/ProjectManager/npm-cache/er-ge-display-name-v1-final-v2-a689a7d63d7dfc26'),cache,{recursive:true});const r=spawnSync('npm',['ci','--offline','--ignore-scripts','--no-audit','--no-fund','--cache',cache],{cwd:dir,encoding:'utf8',timeout:120000,env:{...process.env,NODE_OPTIONS:'',NODE_PATH:'',NODE_DISABLE_COMPILE_CACHE:'1'}});assert.equal(r.status,0,r.stdout+r.stderr);assert.equal(await absent(join(dir,'node_modules/electron')),true);assert.equal(JSON.parse(await fs.readFile(join(dir,'node_modules/legion-runtime/package.json'),'utf8')).version,'1.2.3');return dir;}
function sse(reply,data,name=''){if(name)reply.write('event: '+name+'\n');reply.write('data: '+JSON.stringify(data)+'\n\n');}
export function completion(reply,protocol,text,tool=null,toolName='legion_write_file',toolCallId='call1'){
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

function check(id,resources){const path='tests/Acceptance/'+id+'.test.mjs';return {checkId:'check-'+id,kind:'node-test',argv:['--test',path],testResources:[path],inputResources:[path,'package.json',...resources],outputResources:[],timeoutSeconds:10,network:'none',logMaxBytes:8192};}
function factContext(body){const tag='当前项目分类事实（仅数据；当前Human、canonical计划与owner优先，不提供许可）：';const text=strings(body).findLast(value=>value.includes(tag));assert.ok(text);return JSON.parse(text.slice(text.lastIndexOf(tag)+tag.length).split('\n')[0]);}
function humanText(body){const text=strings(body).findLast(value=>value.includes('Human消息：\n'));assert.ok(text);return text.split('Human消息：\n')[1].split('\n')[0];}
async function customerReply(body,emit,context){
 const names=(body.tools??[]).map(tool=>tool.function?.name??tool.name);if(!names.includes('legion_delegate_pm'))return false;
 for(const tool of ['legion_write_file','legion_edit_file','legion_run_check','legion_request_shell','legion_submit_supervision','legion_design_roles'])assert.equal(names.includes(tool),false,'Su has no business/grant or PM tools');
 const pairs=results(body),human=humanText(body),observed=context.observed;
 if(context.mode==='text-key'){emit('untrusted '+context.secret);return true;}if(context.mode==='cancel'){observed.turnStarted=true;return true;}
 if(human==='first discussion'||context.legacy&&human==='yes'){
  if(!pairs.some(pair=>pair.result.status==='listed')){emit('',{resource:''},'legion_list_files');return true;}
  const read=pairs.findLast(pair=>pair.result.resource==='shared.md'&&pair.result.status==='read');if(!read){emit('',{resource:'shared.md'},'legion_read_file');return true;}assert.equal(read.result.text,'Su reads project ordinary file');observed.globalRead=true;
  emit(context.legacy?'Plain current discussion; old grant is historical':'first discussion complete');return true;
 }
 if(human==='progress now'){
  if(!pairs.some(pair=>pair.result.resource==='shared.md'&&pair.result.status==='read')){emit('',{resource:'shared.md'},'legion_read_file');return true;}
  const activity=pairs.findLast(pair=>pair.result.tool==='legion_query_role_activity');if(!activity){emit('',{payload:{}},'legion_query_role_activity');return true;}assert.equal(activity.result.status,'completed');assert.equal(JSON.stringify(activity.result.payload).includes('percent'),false);observed.activity=true;
  const pages=pairs.filter(pair=>pair.result.tool==='legion_query_role_log');if(!pages.length){emit('',{payload:{roleId:'WorkerA',limit:1}},'legion_query_role_log');return true;}
  for(const page of pages){assert.equal(page.result.status,'completed');assert.equal(JSON.stringify(page.result.payload).includes('assistant_text'),false);assert.equal(JSON.stringify(page.result.payload).includes(context.secret),false);}
  if(pages.length===1){assert.ok(pages[0].result.payload.nextCursor);emit('',{payload:{roleId:'WorkerA',limit:1,cursor:pages[0].result.payload.nextCursor}},'legion_query_role_log');return true;}
  assert.equal(pages[0].result.payload.sourceDigest,pages[1].result.payload.sourceDigest);assert.notEqual(pages[0].result.payload.events[0].id,pages[1].result.payload.events[0].id);observed.twoPages=true;
  emit('progress inspected without revoke');for(const send of context.held.values())send();context.held.clear();return true;
 }
 if(context.isolated?.()){assert.equal(factContext(body).facts.some(fact=>fact.statement==='first discussion'),false);observed.projectIsolation=true;emit('independent project has no old fact');return true;}
 if(context.mode==='stale-confirm'&&context.stage()==='planned'){emit('old confirmation cannot grant permission');return true;}
 const finished=pairs.filter(pair=>pair.result.tool==='legion_delegate_pm'&&pair.result.status==='completed'&&['result_ref','plan_ref'].includes(pair.result.payload?.kind));
 if(finished.length){if(context.mode==='double-draft'&&!observed.secondDraftStarted){observed.secondDraftStarted=true;const source=factContext(body).sourceIndex.findLast(item=>item.type==='human');assert.ok(source);emit('',{payload:{action:'start',purpose:'plan',instruction:'Revise the current draft before Human confirms; Human must answer the new draft independently',sourceRefs:[source.id]}},'legion_delegate_pm');return true;}if(context.mode==='double-draft'){emit('two current drafts reviewed by background PM');return true;}const last=finished[0].result.payload;const record=context.questions.get(last.delegationId);if(finished.length===1&&record?.answers.length===2){emit('',{payload:{action:'resume',delegationId:last.delegationId,humanAnswerRef:record.answers[1]}},'legion_delegate_pm');return true;}if(finished.length===2){assert.deepEqual(finished[1].result.payload,last);observed.idempotentResume=true;}emit('background PM current result received');return true;}
 const waiting=pairs.findLast(pair=>pair.result.tool==='legion_delegate_pm'&&pair.result.status==='completed'&&pair.result.payload?.kind==='needs_human');
 if(waiting){const ref=waiting.result.payload;let record=context.questions.get(ref.delegationId);if(!record){record={refs:[],answers:[]};context.questions.set(ref.delegationId,record);}if(!record.refs.includes(ref.questionRef))record.refs.push(ref.questionRef);const index=record.refs.indexOf(ref.questionRef);
  if(index===1&&!pairs.some(pair=>pair.result.tool==='legion_delegate_pm'&&pair.result.status==='denied')){emit('',{payload:{action:'resume',delegationId:ref.delegationId,humanAnswerRef:record.answers[0]}},'legion_delegate_pm');return true;}
  const denied=pairs.find(pair=>pair.result.tool==='legion_delegate_pm'&&pair.result.status==='denied');if(denied){assert.equal(denied.result.reason,'stale_interaction');observed.oldAnswerRefDenied=true;}
  const answer=pairs.findLast(pair=>pair.result.tool==='legion_request_interaction'&&pair.result.payload?.interaction?.title==='Independent PM question '+(index+1));
  if(!answer){emit('',{payload:{questionRef:ref.questionRef}},'legion_request_interaction');return true;}assert.equal(answer.result.payload.interaction.answer.value,'original exact answer '+(index+1));record.answers[index]=answer.result.payload.humanAnswerRef;observed.humanQuestions=record.answers.length;
  emit('',{payload:{action:'resume',delegationId:ref.delegationId,humanAnswerRef:record.answers[index]}},'legion_delegate_pm');return true;
 }
 const last=pairs.findLast(pair=>pair.result.tool==='legion_delegate_pm');if(last){assert.equal(last.result.status,'completed');assert.fail('unexpected delegation result kind '+last.result.payload?.kind+' '+last.result.payload?.code);}
 const source=factContext(body).sourceIndex.findLast(item=>item.type==='human');assert.ok(source);let purpose='plan',extra={};
 if(context.mode==='repair'){purpose='repair';const catalog=JSON.parse(await fs.readFile(join(context.data,'workbench-projects.json'),'utf8'));const project=catalog.projects.find(item=>item.workspaceIdentity.canonicalPath===context.workspace);const domain=JSON.parse(await fs.readFile(join(context.data,'workbench-organization',project.id+'.json'),'utf8'));const acceptance=domain.acceptances.at(-1);if(acceptance?.decision==='fail')extra={acceptanceId:acceptance.id,taskId:'a'};else purpose='plan';}
 emit('',{payload:{action:'start',purpose,instruction:'Original Human requires '+human,sourceRefs:[source.id],...extra}},'legion_delegate_pm');return true;
}
async function installedScenario(consumer,protocol,mode='normal'){
 const location=await fresh('fixtures','installed-'),workspace=join(location,'project'),data=join(location,'private');await fs.mkdir(workspace);await fs.mkdir(join(workspace,'tests/Acceptance'),{recursive:true});await fs.writeFile(join(workspace,'package.json'),'{}');await fs.writeFile(join(workspace,'shared.md'),'Su reads project ordinary file');
 const ids=mode==='serial'?['a','b','c']:['a','b'];for(const name of ids)await fs.writeFile(join(workspace,'tests/Acceptance',name+'.test.mjs'),"import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';test('current',()=>assert.equal(fs.readFileSync('"+name+".txt','utf8'),'actual-"+name+"'));" );
 if(mode==='repair')await fs.writeFile(join(workspace,'tests/Acceptance/a.test.mjs'),"import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';test('developer structure',()=>assert.equal(fs.readFileSync('a.txt','utf8').startsWith('actual-a'),true));");
 const identity={canonicalPath:await fs.realpath(workspace),...await id(workspace)},key=hash(identity.deviceId+':'+identity.fileId),leaseRoot=join(homedir(),'.legion-project-leases'),lock=join(leaseRoot,key),marker=join(leaseRoot,key+'.owner-source.json');assert.equal(await absent(lock),true);assert.equal(await absent(marker),true);
 const secret='tester-known-key-'+randomUUID();let stage='discussion',organization,repair=false,turns=0,plannedCandidate,isolatedProject=false,transfer=false;const observed={tasks:[],phases:[],queries:0,facts:0,recalls:0,denials:0,overlap:false};const held=new Map(),questions=new Map();const partial='CANCELLED_PARTIAL_'+randomUUID(),continueHuman='Continue exact Human after cancellation '+randomUUID();let child,output='',error='',closed=false,markerRecord=null,scenarioError=null;
 const server=createServer(async(req,res)=>{try{let bytes='';for await(const b of req)bytes+=b;const body=JSON.parse(bytes);assert.ok(req.headers.authorization?.includes(secret)||req.headers['x-api-key']===secret);const names=(body.tools??[]).map(x=>x.function?.name??x.name),pairs=results(body),task=taskOf(body);const emit=(text='',params=null,name='legion_write_file')=>completion(res,protocol,text,params,name,randomUUID());
 if(mode==='cancel'){assert.ok(names.includes('legion_delegate_pm'));observed.cancelHttpCalls=(observed.cancelHttpCalls??0)+1;if(observed.cancelHttpCalls===1){assert.equal(humanText(body),'first discussion');res.writeHead(200,{'content-type':'text/event-stream'});res.write('data: '+JSON.stringify({id:'cancel-partial',object:'chat.completion.chunk',choices:[{index:0,delta:{role:'assistant',content:partial},finish_reason:null}]})+'\n\n');res.write(': wait\n\n');observed.turnStarted=true;return;}assert.equal(observed.cancelHttpCalls,2);assert.equal(humanText(body),continueHuman);assert.equal(strings(body).some(text=>text.includes(partial)),false,'cancelled partial never enters continuation SDK body');assert.equal(body.messages.filter(message=>message.role==='user'&&strings(message.content).join('')==='first discussion').length,1,'complete cancelled Human occurs once in SDK history');for(const message of body.messages){assert.notEqual(message.role,'tool');for(const field of ['tool_calls','tool_call_id','permit','authorization','controller'])assert.equal(Object.hasOwn(message,field),false);}emit('Continue completed safely');return;}
 if(await customerReply(body,emit,{mode,secret,observed,held,questions,data,workspace:identity.canonicalPath,stage:()=>stage,isolated:()=>isolatedProject}))return;
 if(names.includes('legion_submit_supervision')){assert.equal(names.includes('legion_write_file'),false);const prompt=strings(body).find(x=>x.startsWith('你是Supervisor。')),snap=JSON.parse(prompt.split('监督输入：')[1].split('\n')[0]);observed.phases.push(snap.phase);if(!pairs.some(x=>x.result.tool==='legion_submit_supervision'))emit('',{payload:{phase:snap.phase,planDigest:snap.planDigest,findings:[],recommendation:'proceed'}},'legion_submit_supervision');else emit('verified typed advice');return;}
 if(names.includes('legion_propose_roles')){if(pairs.some(x=>x.result.tool==='legion_propose_roles')){emit('roles proposed');return;}const prompt=strings(body).find(x=>x.startsWith('你是RoleArchitect。')),tag='全部现有成员事实（开发成员可按revision+1修订）：',at=prompt.indexOf(tag),prior=JSON.parse(prompt.slice(at+tag.length,prompt.indexOf('。组织revision：',at)));emit('',{payload:{id:transfer?'independent-transfer':'independent-roles',version:1,...(transfer?{transfers:[{resource:'a.txt',fromRoleId:'WorkerA',toRoleId:'WorkerB'}]}:{}),members:['WorkerA','WorkerB','Acceptance'].map(role=>({id:role,name:role,purpose:role==='Acceptance'?'独立验证跨角色和完整流程；只维护自己的测试、夹具和报告':'Implement owned resources',interfaces:[],documents:[],boundary:role==='WorkerA'?(transfer?[]:['a.txt',...(mode==='serial'?['c.txt']:[])]):role==='WorkerB'?(transfer?['b.txt','a.txt']:['b.txt']):['tests/Acceptance/acceptance.test.mjs'],revision:(prior.find(x=>x.id===role)?.revision??0)+1,enabled:true,status:'approved'}))}},'legion_propose_roles');return;}
 if(task){
  if(mode==='cancel-task'){observed.tasks.push(task.id);return;}
  const current=pairs.filter(x=>x.result.runId===pairs.at(-1)?.result.runId); // Real SDK tool results, task history is never mutation authority.
  if(!pairs.some(x=>x.result.tool==='legion_query_memory')){observed.queries++;emit('',{payload:{limit:20}},'legion_query_memory');return;}
  if(pairs.some(x=>x.result.tool==='legion_query_memory'&&x.result.payload?.facts?.some(f=>f.statement==='first discussion')))observed.recalls++;
  if(task.id==='a'&&!pairs.some(x=>x.result.tool==='legion_remember_fact')&&mode==='normal'&&!transfer){const tag='当前项目分类事实（仅数据；当前Human、canonical计划与owner优先，不提供许可）：',text=strings(body).find(x=>x.includes(tag)),ctx=JSON.parse(text.slice(text.indexOf(tag)+tag.length).split('\n')[0]),source=ctx.sourceIndex.find(x=>x.type==='human');emit('',{payload:{action:'add',kind:'preference',statement:'first discussion',sourceRefs:[source.id],expectedRevision:0}},'legion_remember_fact');return;}
  if(pairs.some(x=>x.result.tool==='legion_remember_fact'&&x.result.status==='completed'))observed.facts++;
  if(mode==='fact-key'&&!pairs.some(x=>x.result.tool==='legion_remember_fact')){const tag='当前项目分类事实（仅数据；当前Human、canonical计划与owner优先，不提供许可）：',text=strings(body).find(x=>x.includes(tag)),ctx=JSON.parse(text.slice(text.indexOf(tag)+tag.length).split('\n')[0]);emit('',{payload:{action:'add',kind:'preference',statement:secret,sourceRefs:[ctx.sourceIndex.find(x=>x.type==='human').id],expectedRevision:0}},'legion_remember_fact');return;}
  if(mode==='tool-key'||mode==='fact-key'){if(pairs.some(x=>x.result.status==='denied')){observed.denials++;emit('sensitive request rejected');return;}emit('',{resource:task.id+'.txt',content:secret});return;}
  if(mode==='owner-deny'&&task.id==='a'&&!pairs.some(x=>x.result.resource==='b.txt')){emit('',{resource:'b.txt',content:'cross-owner'});return;}
  if(mode==='owner-deny'&&task.id==='a'){const denied=pairs.find(x=>x.result.resource==='b.txt');assert.equal(denied.result.success,false);observed.denials++;}

  const resource=task.accepts?.length?'tests/Acceptance/acceptance.test.mjs':task.id+'.txt';
  if(!pairs.some(x=>x.result.success&&x.result.resource===resource)){
   if(task.accepts?.length){emit('',{resource,content:"import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';test('independent',()=>{"+ids.map(x=>"assert.equal(fs.readFileSync('"+x+".txt','utf8'),'actual-"+x+"');").join('')+"});"});return;}
   observed.tasks.push(task.id);const send=()=>emit('',{resource,content:mode==='repair'&&task.id==='a'&&!repair?'actual-a-incomplete':'actual-'+task.id});
   if(!repair&&!transfer&&['a','b'].includes(task.id)){held.set(task.id,send);if(held.has('a')&&held.has('b')){observed.overlap=true;assert.equal(observed.tasks.includes('c'),false);}return;}
   if(task.id==='c'){const current=JSON.parse(await fs.readFile(join(data,'workbench-projects.json'),'utf8')).projects.find(x=>x.workspaceIdentity.canonicalPath===identity.canonicalPath);assert.equal(current.tasks.find(x=>x.id==='a').status,'completed','same-role next inference waits for full first task completion');observed.sameRoleSerialized=true;}send();return;
  }
  const result=pairs.findLast(x=>x.result.checkId==='check-'+task.id);if(!result){emit('',{checkId:'check-'+task.id},'legion_run_check');return;}
  if(task.accepts?.length&&!pairs.some(x=>x.result.tool==='legion_submit_acceptance')){const fail=mode==='repair'&&!repair;assert.equal(result.result.status,fail?'failed':'passed');if(fail)observed.actualAcceptanceFailure=true;emit('',{payload:{taskId:task.id,evidenceIds:[result.result.requestId],decision:fail?'fail':'pass',issues:fail?[{taskId:'a',resource:'a.txt',expected:'independent accepted current output',actual:'actual customer-contract check failed: exit '+result.result.exitCode,reproduction:'run check-a'}]:[]}},'legion_submit_acceptance');return;}
  emit('task actually checked');return;
 }
 if(stage==='transfer-request'){stage='design';emit('',{payload:{instruction:'Transfer a.txt from WorkerA to WorkerB; Human must confirm exact ownership difference'}},'legion_design_roles');return;}
 if(stage==='discussion'){const answers=pairs.filter(pair=>pair.result.tool==='legion_request_interaction');if(answers.length<2){const number=answers.length+1;emit('',{payload:{kind:'question',purpose:'discussion',title:'Independent PM question '+number,text:'Keep exact Human question '+number,options:[],allowSupplement:false}},'legion_request_interaction');return;}for(let index=0;index<2;index++){assert.equal(answers[index].result.payload.interaction.answer.value,'original exact answer '+(index+1));}observed.originalPMAnswers=true;stage='design';emit('',{payload:{instruction:'Create independent persistent role owners'}},'legion_design_roles');return;}
 if(stage==='design'){const proposal=pairs.findLast(x=>x.result.tool==='legion_design_roles')?.result.payload.proposal;stage='review';emit('',{payload:{proposalId:proposal.id,version:proposal.version,digest:proposal.digest,organizationRevision:proposal.baseRevision,organizationDigest:proposal.baseDigest,decision:'approve',reason:'reviewed independent current ownership'}},'legion_review_roles');return;}
 if(stage==='review'){organization=pairs.findLast(x=>x.result.tool==='legion_review_roles')?.result.payload.organization;stage='planned';const roles=(transfer?['WorkerB','Acceptance']:['WorkerA','WorkerB','Acceptance']).map(role=>{const r=organization.members.find(x=>x.id===role);return{id:role,name:r.name,purpose:r.purpose,revision:r.revision,digest:r.digest,profileId:'environment'};});const activeIds=transfer?['a']:ids;const tasks=activeIds.map(name=>({id:name,title:'write '+name,roleId:transfer||name==='b'?'WorkerB':'WorkerA',profileId:'environment',intent:'change',dependsOn:[],instruction:'write '+name+'.txt',checks:[check(name,[name+'.txt'])]}));tasks.push({id:'acceptance',title:'independent acceptance',roleId:'Acceptance',profileId:'environment',intent:'change',dependsOn:activeIds,accepts:activeIds,instruction:'independent current check',checks:[check('acceptance',ids.map(x=>x+'.txt'))]});plannedCandidate={schemaVersion:2,goal:'independent installed '+mode,roles,tasks,...(transfer?{transfers:[{resource:'a.txt',fromRoleId:'WorkerA',toRoleId:'WorkerB'}]}:{}),governance:{organizationRevision:organization.revision,organizationDigest:organization.digest,maxRepairRounds:2}};emit('```legion-plan\n'+JSON.stringify(plannedCandidate)+'\n```');return;}
 if(isolatedProject){const tag='当前项目分类事实（仅数据；当前Human、canonical计划与owner优先，不提供许可）：',text=strings(body).find(x=>x.includes(tag)),ctx=JSON.parse(text.slice(text.indexOf(tag)+tag.length).split('\n')[0]);assert.equal(ctx.facts.some(x=>x.statement==='first discussion'),false);observed.projectIsolation=true;emit('independent project has no old fact');return;}
 if(mode==='double-draft'&&stage==='planned'){stage='second-draft';emit('```legion-plan\n'+JSON.stringify({...plannedCandidate,goal:'SECOND_CURRENT_DRAFT_REQUIRES_NEW_HUMAN'})+'\n```');return;}
 if(mode==='normal'&&stage==='planned'){if(!pairs.some(x=>x.result.tool==='legion_query_memory')){emit('',{payload:{limit:20}},'legion_query_memory');return;}const result=pairs.findLast(x=>x.result.tool==='legion_query_memory');assert.ok(result.result.payload.facts.some(x=>x.statement==='first discussion'));observed.crossPlanRecall=true;stage='memory-read';emit('```legion-plan\n'+JSON.stringify({...plannedCandidate,goal:'second plan preserves classified fact'})+'\n```');return;}
 if(mode==='repair'&&!repair){const tag='当前Host事实：',text=strings(body).find(x=>x.includes(tag)),domain=JSON.parse(text.slice(text.indexOf(tag)+tag.length).split('\n')[0]);repair=true;emit('',{payload:{acceptanceId:domain.acceptances.at(-1).id,taskId:'a',reason:'independent Acceptance requests original owner correction'}},'legion_request_repair');return;}
 emit('next discussion preserves classified fact');
 }catch(e){if(!observed.failure)observed.failure=e.message;res.destroy();}});await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const env={...process.env,LEGION_API_KEY:secret,LEGION_PROTOCOL:protocol,LEGION_PROVIDER:'tester',LEGION_MODEL:'tester-local',LEGION_BASE_URL:'http://127.0.0.1:'+server.address().port+'/v1',NODE_OPTIONS:'',NODE_PATH:'',NODE_DISABLE_COMPILE_CACHE:'1'};
 function start(userData=data,project=workspace){output='';error='';closed=false;child=spawn(join(consumer,'node_modules/.bin/legion'),['chat','--project',project,'--user-data',userData],{cwd:consumer,env,stdio:['pipe','pipe','pipe']});child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>error+=b);child.on('close',()=>closed=true);child.on('error',e=>{error+=e.message;closed=true;});}
 async function capture(){if(await absent(marker))return;const bytes=await fs.readFile(marker),source=JSON.parse(bytes),info=await id(marker);assert.deepEqual(source.workspace,identity);assert.equal(source.source.catalogDirCanonicalPath,await fs.realpath(data));assert.deepEqual({deviceId:source.source.dirDeviceId,fileId:source.source.dirFileId},await id(data));const catalog=JSON.parse(await fs.readFile(join(data,'workbench-projects.json'),'utf8'));assert.ok(catalog.projects.some(p=>p.id===source.source.projectId));assert.equal(source.source.filename,'workbench-projects.json');markerRecord={bytes,info,root:await id(leaseRoot)};}
 async function stop(){if(!closed){child.stdin.write('/exit\n');await until(()=>closed,'tracked CLI exit');}assert.equal(output.includes(secret)||error.includes(secret),false);}
 try{start();await until(()=>output.includes('二哥>')||closed,'CLI prompt');assert.equal(closed,false,error);assert.ok(output.includes('二哥 · /cancel 取消 · /exit 退出'));assert.equal(output.includes('Su>'),false);child.stdin.write('first discussion\n');
 if(mode==='cancel'){await until(()=>observed.turnStarted,'in-flight model');child.stdin.write('/cancel\n');await until(()=>output.includes('Cancelled'),'cancel turn');const samePid=child.pid;child.stdin.write(continueHuman+'\n');await until(()=>output.includes('Continue completed safely'),'same CLI continued real HTTP response');assert.equal(child.pid,samePid);assert.equal(closed,false);assert.equal(observed.cancelHttpCalls,2);const catalog=JSON.parse(await fs.readFile(join(data,'workbench-projects.json'),'utf8'));const project=catalog.projects.find(item=>item.workspaceIdentity.canonicalPath===identity.canonicalPath);const domain=JSON.parse(await fs.readFile(join(data,'workbench-organization',project.id+'.json'),'utf8'));assert.deepEqual(domain.customerTimeline.messages.filter(item=>item.kind==='human').map(item=>item.text),['first discussion',continueHuman]);const completedIds=new Set(domain.customerTimeline.turns.filter(turn=>turn.status==='completed').map(turn=>turn.id));assert.deepEqual(domain.customerTimeline.messages.filter(item=>item.kind==='assistant'&&completedIds.has(item.turnId)).map(item=>item.text),['Continue completed safely']);assert.deepEqual(domain.customerTimeline.turns.map(item=>item.status),['cancelled','completed']);assert.equal(JSON.stringify(domain.roleMemories).includes(partial),false,'partial never enters private checkpoint/summary');for(const message of domain.customerTimeline.messages.filter(item=>item.text.includes(partial)))assert.equal(domain.customerTimeline.turns.find(turn=>turn.id===message.turnId).status,'cancelled','partial is only a cancellation journal fact');const models=await import(pathToFileURL(join(consumer,'node_modules/legion-runtime/apps/desktop/src/models/workbench.mjs')).href);const history=models.projectConversationContext(domain).history.messages;assert.deepEqual(history.map(message=>message.text),['first discussion',continueHuman,'Continue completed safely']);assert.equal(JSON.stringify(history).includes(partial),false,'actual public history projection excludes cancelled partial');assert.equal(domain.delegations.entries.length,0);assert.equal(domain.queue.requests.length,0);assert.equal(observed.tasks.length,0);assert.equal(project.plan,null);assert.equal(await absent(join(workspace,'a.txt')),true);assert.equal(output.includes(partial),false);for(const path of await files(data)){if(path.endsWith(project.id+'.json')&&path.includes('workbench-organization'))continue;assert.equal((await fs.readFile(path)).includes(Buffer.from(partial)),false,'partial not persisted outside cancellation journal '+path);}const runs=domain.memberConversations.runs.filter(run=>run.roleId==='Supervisor'&&run.channel==='su_customer');assert.equal(runs.length,2);assert.equal(runs[0].instanceId,runs[1].instanceId);assert.deepEqual(runs.map(run=>run.status),['cancelled','completed']);observed.cancelContinueSameInstance=true;}
 else if(mode==='text-key'){await until(()=>output.includes('sensitive_output'),'known-key model rejection');}
 else {await until(()=>output.includes('first discussion complete'),'real discussion');child.stdin.write('yes\n');for(let index=0;index<2;index++){await until(()=>output.includes('Keep exact Human question '+(index+1)),'real PM question '+index);child.stdin.write('original exact answer '+(index+1)+'\n');}await until(()=>output.includes('确认实施计划'),'current readable confirmation');assert.ok(output.includes('a.txt')&&output.includes('b.txt')&&output.includes('WorkerA')&&output.includes('WorkerB'));assert.equal(await absent(join(workspace,'a.txt')),true);await capture();if(mode==='double-draft'){await until(async()=>{const catalog=JSON.parse(await fs.readFile(join(data,'workbench-projects.json'),'utf8'));const current=catalog.projects.find(item=>item.workspaceIdentity.canonicalPath===identity.canonicalPath);if(current.plan.goal!=='SECOND_CURRENT_DRAFT_REQUIRES_NEW_HUMAN')return false;const domain=JSON.parse(await fs.readFile(join(data,'workbench-organization',current.id+'.json'),'utf8'));return domain.queue.requests.some(item=>item.purpose==='execute_plan'&&item.status==='pending'&&item.bindings.planDigest===current.plan.planDigest);},'second legitimate Host confirmation persisted');const doubleCatalog=JSON.parse(await fs.readFile(join(data,'workbench-projects.json'),'utf8'));const doubleProject=doubleCatalog.projects.find(item=>item.workspaceIdentity.canonicalPath===identity.canonicalPath);const doubleDomain=JSON.parse(await fs.readFile(join(data,'workbench-organization',doubleProject.id+'.json'),'utf8'));const drafts=doubleDomain.queue.requests.filter(item=>item.purpose==='execute_plan');assert.equal(drafts.length,2);assert.notEqual(drafts[0].bindings.planDigest,drafts[1].bindings.planDigest);assert.equal(drafts[1].bindings.planDigest,doubleProject.plan.planDigest);child.stdin.write('yes\n');await until(()=>output.includes('Refused: stale_interaction'),'old exact draft answer rejected');assert.equal(observed.tasks.length,0,'old yes never grants current draft');assert.equal(await absent(join(workspace,'a.txt')),true);await until(()=>output.includes('SECOND_CURRENT_DRAFT_REQUIRES_NEW_HUMAN'),'CLI presents current draft after refusing old exact request');child.stdin.write('no\n');await until(async()=>{const catalog=JSON.parse(await fs.readFile(join(data,'workbench-projects.json'),'utf8'));const current=catalog.projects.find(item=>item.workspaceIdentity.canonicalPath===identity.canonicalPath);const domain=JSON.parse(await fs.readFile(join(data,'workbench-organization',current.id+'.json'),'utf8'));return domain.queue.requests.some(item=>item.purpose==='execute_plan'&&item.bindings.planDigest===current.plan.planDigest&&item.status==='rejected');},'new Human no persisted for current B');assert.equal(observed.tasks.length,0);assert.equal(await absent(join(workspace,'a.txt')),true);await stop();return {protocol,mode,oldYesNotReplayed:true,currentHumanRejectedB:true};}if(mode==='stale-confirm'){await stop();start();await until(()=>output.includes('Answer>'),'historical confirmation remains visible');child.stdin.write('yes\n');await until(()=>output.includes('Refused: stale_interaction'),'historical confirmation refused under current binding');assert.equal(observed.tasks.length,0);assert.equal(await absent(join(workspace,'a.txt')),true);await stop();return {protocol,mode,oldConfirmationRevoked:true};}child.stdin.write('yes\n');await until(async()=>{if(await absent(marker))return false;await capture();return true;},'capture this run exact marker before execution observations');
 if(mode==='cancel-task'){await until(()=>observed.tasks.length>0,'running workers');child.stdin.write('/cancel\n');await until(()=>output.includes('Cancelled'),'cancel workers');await delay(100);assert.equal(await absent(join(workspace,'a.txt')),true);}
 else {await until(()=>observed.overlap||output.includes('Delivery:'),'different owner actual in-flight');if(observed.overlap){const before=JSON.parse(await fs.readFile(join(data,'workbench-projects.json'),'utf8')).projects.find(item=>item.workspaceIdentity.canonicalPath===identity.canonicalPath);child.stdin.write('progress now\n');await until(()=>output.includes('progress inspected without revoke'),'Su in-flight read/activity/two pages');const after=JSON.parse(await fs.readFile(join(data,'workbench-projects.json'),'utf8')).projects.find(item=>item.id===before.id);assert.equal(after.plan.planDigest,before.plan.planDigest);assert.equal(after.fileOwners.version,before.fileOwners.version);assert.deepEqual(after.tasks.map(item=>item.runId),before.tasks.map(item=>item.runId));}await until(()=>output.includes('Delivery:'),'actual delivery');await capture();if(mode==='repair'){assert.match(output,/Delivery: failed/);child.stdin.write('repair original owner\n');await until(()=>output.includes('Delivery: completed'),'repair delivery');}if(['normal','serial','repair'].includes(mode)){assert.match(output,/Delivery: completed/);assert.match(output,/Acceptance.*pass/);assert.match(output,/二哥监控: completed/);assert.equal(observed.overlap,true);assert.equal(observed.twoPages,true);assert.equal(observed.oldAnswerRefDenied,true);assert.equal(observed.humanQuestions,2);assert.equal(observed.originalPMAnswers,true);for(const x of ids)assert.equal(await fs.readFile(join(workspace,x+'.txt'),'utf8'),'actual-'+x);assert.ok(observed.phases.includes('preflight')&&observed.phases.includes('monitor'));}else {assert.doesNotMatch(output,/Delivery: completed/);if(mode!=='owner-deny')assert.equal(await absent(join(workspace,'a.txt')),true);}if(mode==='owner-deny')assert.ok(observed.denials>0);}
 }
 await capture();await stop();const transcript={stdout:output,stderr:error};if(!['cancel-task','fact-key','tool-key'].includes(mode))assert.ok(output.includes('二哥: '),'real customer reply prefix');
 if(mode==='normal'){const before=observed.tasks.length;start();await until(()=>output.includes('二哥>'),'restart prompt');assert.equal(observed.tasks.length,before,'restart never replays completed tasks');const oldPlan=JSON.parse(await fs.readFile(join(data,'workbench-projects.json'),'utf8')).projects.find(x=>x.workspaceIdentity.canonicalPath===identity.canonicalPath).plan.planDigest;child.stdin.write('new plan conversation\n');await until(()=>output.includes('确认实施计划'),'second current Human plan');const current=JSON.parse(await fs.readFile(join(data,'workbench-projects.json'),'utf8')).projects.find(x=>x.workspaceIdentity.canonicalPath===identity.canonicalPath);assert.notEqual(current.plan.planDigest,oldPlan);assert.equal(observed.crossPlanRecall,true);child.stdin.write('no\n');await until(()=>output.includes('Delivery:'),'second plan rejected');await stop();transfer=true;stage='transfer-request';start();await until(()=>output.includes('二哥>'),'new transfer discussion');child.stdin.write('transfer the current owned file\n');await until(()=>output.includes('确认实施计划'),'explicit transfer confirmation');const beforeTransfer=JSON.parse(await fs.readFile(join(data,'workbench-projects.json'),'utf8')).projects.find(x=>x.id===current.id);assert.equal(beforeTransfer.fileOwners.owners.find(x=>x.resource==='a.txt').roleId,'WorkerA');assert.equal(beforeTransfer.plan.fileOwnership.transfers[0].toRoleId,'WorkerB');assert.ok(output.includes('WorkerA')&&output.includes('WorkerB')&&output.includes('a.txt'));child.stdin.write('yes\n');await until(()=>output.includes('Delivery: completed'),'confirmed transfer actual write');const afterTransfer=JSON.parse(await fs.readFile(join(data,'workbench-projects.json'),'utf8')).projects.find(x=>x.id===current.id);assert.equal(afterTransfer.fileOwners.owners.find(x=>x.resource==='a.txt').roleId,'WorkerB');assert.notEqual(afterTransfer.fileOwners.version,beforeTransfer.fileOwners.version);observed.confirmedTransfer=true;const completedCount=observed.tasks.length;await stop();const otherProject=join(location,'isolated-project');await fs.mkdir(otherProject);isolatedProject=true;start(data,otherProject);await until(()=>output.includes('二哥>'),'different project');child.stdin.write('isolate memory\n');await until(()=>output.includes('independent project has no old fact'),'project memory isolation');assert.equal(observed.projectIsolation,true);await stop();isolatedProject=false;start(join(location,'other-private'));await until(()=>closed,'different catalog source rejection');assert.match(error,/cli_request_failed/);assert.equal(observed.tasks.length,completedCount);}
 for(const path of await files(location))assert.equal((await fs.readFile(path)).includes(Buffer.from(secret)),false,'known key persisted '+path);
 assert.equal(transcript.stdout.includes(secret)||transcript.stderr.includes(secret),false);const evidence={protocol,mode,tarSha256:expectedTar,installedBinary:true,observed,knownKeyAbsent:true};await fs.writeFile(join(location,'evidence.json'),JSON.stringify(evidence));return evidence;
 }catch(caught){scenarioError=caught;throw caught;}finally{if(!output.includes(secret)&&!error.includes(secret))await fs.writeFile(join(location,'cli-output.json'),JSON.stringify({stdout:output,stderr:error,protocol,mode,failure:observed.failure??null,observed}));if(child&&!closed){child.kill('SIGTERM');await until(()=>closed,'close tracked CLI');}server.closeAllConnections();await new Promise(done=>server.close(done));if(markerRecord){assert.equal(await absent(lock),true,'unknown active lease retained');assert.deepEqual(await id(leaseRoot),markerRecord.root);assert.deepEqual(await id(marker),markerRecord.info);assert.equal((await fs.lstat(marker)).mode&0o777,0o600);assert.deepEqual(await fs.readFile(marker),markerRecord.bytes);assert.deepEqual({canonicalPath:await fs.realpath(workspace),...await id(workspace)},identity);await fs.unlink(marker);}else if(!await absent(marker)){await fs.writeFile(join(location,'retained-marker.json'),JSON.stringify({marker,reason:'identity was not captured before failure; preserved'}));if(!scenarioError)assert.fail('unproven marker retained');}}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))test('independent installed CLI three protocols and adversarial current-owner lifecycle',{timeout:290000},async()=>{const dir=await consumer(),evidence=[];for(const protocol of ['openai-completions','openai-responses','anthropic-messages'])evidence.push(await installedScenario(dir,protocol));for(const mode of ['serial','owner-deny','repair','cancel','cancel-task','text-key','tool-key','fact-key','stale-confirm','double-draft'])evidence.push(await installedScenario(dir,'openai-completions',mode));evidence.push(await legacyReadOnly(dir));const report=await fresh('evidence','installed-');await fs.writeFile(join(report,'flows.json'),JSON.stringify({tarSha256:expectedTar,evidence},null,2));});

async function legacyReadOnly(consumer){
 const location=await fresh('fixtures','legacy-installed-'),workspace=join(location,'project'),data=join(location,'private');await fs.mkdir(workspace);await fs.mkdir(data);await fs.mkdir(join(workspace,'tests/Acceptance'),{recursive:true});await fs.writeFile(join(workspace,'package.json'),'{}');await fs.writeFile(join(workspace,'shared.md'),'Su reads project ordinary file');await fs.writeFile(join(workspace,'owned.txt'),'historical bytes');
 const contract="import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';test('actual migrated current contract',()=>assert.equal(fs.readFileSync('owned.txt','utf8'),'migrated current bytes'));";await fs.writeFile(join(workspace,'tests/Acceptance/developer.test.mjs'),contract);await fs.writeFile(join(workspace,'tests/Acceptance/acceptance.test.mjs'),contract);
 const models=await import(pathToFileURL(join(consumer,'node_modules/legion-runtime/apps/desktop/src/models/workbench.mjs')).href);const {FIXED_ROLE_DUTIES}=await import(pathToFileURL(join(consumer,'node_modules/legion-runtime/apps/desktop/src/models/organization.mjs')).href);
 const identity={canonicalPath:await fs.realpath(workspace),...await id(workspace)},projectId=models.identityKey(identity),key=hash(identity.deviceId+':'+identity.fileId),leaseRoot=join(homedir(),'.legion-project-leases'),lock=join(leaseRoot,key),marker=join(leaseRoot,key+'.owner-source.json');assert.equal(await absent(lock),true);assert.equal(await absent(marker),true);
 const plan=models.legacyBoundPlan({goal:'old pending writeSet',roles:[{id:'Builder',name:'legacy',purpose:'legacy historical only',profileId:'environment'}],tasks:[{id:'old',title:'old write',roleId:'Builder',profileId:'environment',dependsOn:[],writeSet:['owned.txt'],instruction:'old instruction'}]},{projectId,organizationVersion:'legacy-v1',revision:1,profileBindings:[{profileId:'environment',profileVersion:'a'.repeat(64),contextSnapshotDigest:'b'.repeat(64)}],contextSnapshotDigest:'b'.repeat(64)});
 const catalog=models.legacyCatalogDocument({schemaVersion:1,defaultProfileId:null,projects:[{schemaVersion:1,id:projectId,name:'legacy',workspaceIdentity:identity,organizationVersion:'legacy-v1',manager:null,planRevision:1,plan:{...plan,status:'running'},context:{files:[],verifiedAt:null},tasks:[],fileOwners:{projectId,version:'owners-v1',owners:[{resource:'owned.txt',roleId:'Builder'}]}}]});const bytes=JSON.stringify(catalog),path=join(data,'workbench-projects.json');await fs.writeFile(path,bytes);
 const secret='legacy-known-'+randomUUID();let stage='chat',calls=0,organization;const observed={legacyReadOnly:false,migrationConfirmed:false,checkRuns:0,acceptance:false,supervisor:false};const questions=new Map(),held=new Map();
 const server=createServer(async(req,res)=>{try{let raw='';for await(const b of req)raw+=b;const body=JSON.parse(raw);calls++;const names=(body.tools??[]).map(x=>x.function?.name??x.name),pairs=results(body),task=taskOf(body);const emit=(text='',params=null,name='legion_write_file')=>completion(res,'openai-completions',text,params,name,randomUUID());
 if(await customerReply(body,emit,{mode:'legacy',legacy:true,secret,observed,held,questions,data,workspace:identity.canonicalPath,stage:()=>stage}))return;
 if(names.includes('legion_submit_supervision')){assert.equal(names.includes('legion_write_file'),false);const prompt=strings(body).find(x=>x.startsWith('你是Supervisor。')),snapshot=JSON.parse(prompt.split('监督输入：')[1].split('\n')[0]);if(!pairs.some(x=>x.result.tool==='legion_submit_supervision'))emit('',{payload:{phase:snapshot.phase,planDigest:snapshot.planDigest,findings:[],recommendation:'proceed'}},'legion_submit_supervision');else{observed.supervisor=true;emit('migration typed supervision');}return;}
 if(names.includes('legion_propose_roles')){if(pairs.some(x=>x.result.tool==='legion_propose_roles')){emit('current complete roles proposed');return;}const prompt=strings(body).find(x=>x.startsWith('你是RoleArchitect。')),tag='全部现有成员事实（开发成员可按revision+1修订）：',at=prompt.indexOf(tag),prior=JSON.parse(prompt.slice(at+tag.length,prompt.indexOf('。组织revision：',at)));emit('',{payload:{id:'current-migration-roles',version:1,members:prior.map(role=>({id:role.id,name:role.name,purpose:FIXED_ROLE_DUTIES[role.id]??'Implement owned.txt under current Human plan',interfaces:[],documents:[],boundary:role.id==='Builder'?['owned.txt']:role.id==='Acceptance'?['tests/Acceptance/acceptance.test.mjs']:[],revision:role.revision+1,enabled:true,status:'approved'}))}},'legion_propose_roles');return;}
 if(task){assert.equal(task.id==='old',false,'old grant never dispatched');if(task.id==='developer'&&!pairs.some(x=>x.result.success&&x.result.resource==='owned.txt')){emit('',{resource:'owned.txt',content:'migrated current bytes'});return;}const checkId=task.checks[0].checkId,result=pairs.findLast(x=>x.result.checkId===checkId);if(!result){emit('',{checkId},'legion_run_check');return;}assert.equal(result.result.status,'passed');observed.checkRuns++;if(task.accepts?.length&&!pairs.some(x=>x.result.tool==='legion_submit_acceptance')){emit('',{payload:{taskId:task.id,evidenceIds:[result.result.requestId],decision:'pass',issues:[]}},'legion_submit_acceptance');return;}if(task.accepts?.length)observed.acceptance=true;emit('actual migrated task checked');return;}
 assert.equal(names.includes('legion_write_file'),false);
 if(stage==='chat'){emit('Plain current discussion; old grant is historical');return;}
 if(stage==='design'){stage='review';emit('',{payload:{instruction:'Approve current complete legacy owner duties and fixed roles for explicit Human migration'}},'legion_design_roles');return;}
 if(stage==='review'){const proposal=pairs.findLast(x=>x.result.tool==='legion_design_roles').result.payload.proposal;stage='plan';emit('',{payload:{proposalId:proposal.id,version:proposal.version,digest:proposal.digest,organizationRevision:proposal.baseRevision,organizationDigest:proposal.baseDigest,decision:'approve',reason:'Current explicit owners and independent acceptance'}},'legion_review_roles');return;}
 if(stage==='plan'){organization=pairs.findLast(x=>x.result.tool==='legion_review_roles').result.payload.organization;stage='planned';const roles=['Builder','Acceptance'].map(id=>{const role=organization.members.find(x=>x.id===id);return{id,name:role.name,purpose:role.purpose,revision:role.revision,digest:role.digest,profileId:'environment'};});const tasks=[{id:'developer',title:'current approved migration implementation',roleId:'Builder',profileId:'environment',intent:'change',dependsOn:[],instruction:'write owned.txt with migrated current bytes',checks:[check('developer',['owned.txt'])]},{id:'acceptance',title:'independent current migration contract',roleId:'Acceptance',profileId:'environment',intent:'verify',dependsOn:['developer'],accepts:['developer'],instruction:'run independent migration check',checks:[check('acceptance',['owned.txt'])]}];emit('```legion-plan\n'+JSON.stringify({schemaVersion:2,goal:'Human closes old instances and selects authoritative catalog',roles,tasks,governance:{organizationRevision:organization.revision,organizationDigest:organization.digest,maxRepairRounds:2}})+'\n```');return;}emit('current migration conversation');
 }catch(e){observed.fixtureError=e.message;res.destroy();}});await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const env={...process.env,LEGION_API_KEY:secret,LEGION_PROTOCOL:'openai-completions',LEGION_PROVIDER:'tester',LEGION_MODEL:'tester-local',LEGION_BASE_URL:'http://127.0.0.1:'+server.address().port+'/v1',NODE_OPTIONS:'',NODE_PATH:''};let output='',error='',closed=false,markerRecord;
 const child=spawn(join(consumer,'node_modules/.bin/legion'),['chat','--project',workspace,'--user-data',data],{cwd:consumer,env,stdio:['pipe','pipe','pipe']});child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>error+=b);child.on('close',()=>closed=true);
 try{await until(()=>output.includes('二哥>'),'validated old read-only view');assert.equal(output.includes('Answer>'),false,'legacy running plan provides no active confirmation');assert.equal(output.includes('Delivery: completed'),false);child.stdin.write('yes\n');await until(()=>output.includes('old grant is historical'),'ordinary yes cannot revive old grant');assert.ok(calls>=1);assert.equal(await fs.readFile(path,'utf8'),bytes);assert.equal(await fs.readFile(join(workspace,'owned.txt'),'utf8'),'historical bytes');observed.legacyReadOnly=true;
 stage='design';child.stdin.write('migrate through a new current Human plan\n');await until(()=>output.includes('确认实施计划'),'actual current migration confirmation');assert.ok(output.includes('我确认已关闭该项目所有旧版 Legion 实例'));assert.ok(output.includes('catalog 为本项目权威 owner 来源'));assert.ok(output.includes(identity.canonicalPath)&&output.includes('owned.txt')&&output.includes('Builder'));assert.equal(await fs.readFile(path,'utf8'),bytes);assert.equal(await fs.readFile(join(workspace,'owned.txt'),'utf8'),'historical bytes');child.stdin.write('yes\n');await until(()=>output.includes('Delivery: completed'),'actual current migration execution');observed.migrationConfirmed=true;
 const sourceBytes=await fs.readFile(marker),source=JSON.parse(sourceBytes);assert.deepEqual(source.workspace,identity);assert.equal(source.source.catalogDirCanonicalPath,await fs.realpath(data));assert.deepEqual({deviceId:source.source.dirDeviceId,fileId:source.source.dirFileId},await id(data));assert.equal(source.source.projectId,projectId);assert.equal(source.source.filename,'workbench-projects.json');markerRecord={bytes:sourceBytes,identity:await id(marker),root:await id(leaseRoot)};
 const migrated=JSON.parse(await fs.readFile(path,'utf8'));assert.equal(migrated.schemaVersion,2);const project=migrated.projects.find(x=>x.id===projectId);assert.equal(project.schemaVersion,2);assert.equal(project.plan.schemaVersion,2);assert.equal(project.plan.status,'completed');assert.ok(project.legacyHistory.some(item=>JSON.stringify(item).includes(plan.planDigest)&&JSON.stringify(item).includes('writeSet')));assert.equal(await fs.readFile(join(workspace,'owned.txt'),'utf8'),'migrated current bytes');assert.ok(observed.checkRuns>=2&&observed.acceptance&&observed.supervisor);
 const backups=(await fs.readdir(data)).filter(name=>/^workbench-projects-v1-.*\.backup\.json$/.test(name));assert.equal(backups.length,1);assert.equal(await fs.readFile(join(data,backups[0]),'utf8'),bytes);child.stdin.write('/exit\n');await until(()=>closed,'migration tracked CLI close');assert.equal(output.includes(secret)||error.includes(secret),false);for(const file of await files(location))assert.equal((await fs.readFile(file)).includes(Buffer.from(secret)),false);await fs.writeFile(join(location,'migration.json'),JSON.stringify(observed));return {legacySchema:1,validatedOldDigest:true,oldBytesBackedUp:true,oldGrantInvalidated:true,...observed};
 }finally{if(!output.includes(secret)&&!error.includes(secret))await fs.writeFile(join(location,'cli-output.json'),JSON.stringify({stdout:output,stderr:error,fixtureError:observed.fixtureError??null}));if(!closed){child.kill('SIGTERM');await until(()=>closed,'migration tracked exit');}server.closeAllConnections();await new Promise(done=>server.close(done));assert.equal(await absent(lock),true,'active migration lease retained');if(markerRecord){assert.deepEqual(await id(leaseRoot),markerRecord.root);assert.deepEqual(await id(marker),markerRecord.identity);assert.equal((await fs.lstat(marker)).mode&0o777,0o600);assert.deepEqual(await fs.readFile(marker),markerRecord.bytes);assert.deepEqual({canonicalPath:await fs.realpath(workspace),...await id(workspace)},identity);await fs.unlink(marker);}else assert.equal(await absent(marker),true,'unproven migration marker retained');}
}
