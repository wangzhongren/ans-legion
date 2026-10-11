import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Compile } from "typebox/compile";
import { createPiAgentService } from "../../src/adapters/services/public/pi_agent.mjs";
import { AgentInstance, AgentScope, PiConnection, PiConnectionProfile, PiToolRequest, PiToolResult,
  AgentControlDecision, AgentControlResult, PiConversationHistory, PiConversationCheckpoint } from "../../src/kernel/models/agent.mjs";
import { ShellRequest, ShellDecision, ShellResult } from "../../src/kernel/models/shell.mjs";
import { CheckResult } from "../../src/kernel/models/check.mjs";
const root=resolve(".ans/runtime/handwell-pm-approved-project-shell-v1/AgentAdapterEngineer/fixtures");
mkdirSync(root,{recursive:true});
const hash="a".repeat(64);
const params={command:"printf 'project command'",reason:"build project"};
const review={requestId:"reviewed-request",requestDigest:hash,revision:3,approved:true,reason:"exact reviewed command"};
function sse(protocol, text, model) {
  if (protocol === "openai-completions") {
    const first = { id: "chat-1", object: "chat.completion.chunk", created: 1, model,
      choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }] };
    const last = { ...first, choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } };
    return "data: " + JSON.stringify(first) + "\n\ndata: " + JSON.stringify(last) + "\n\ndata: [DONE]\n\n";
  }
  const events = [];
  if (protocol === "anthropic-messages") {
    events.push({ type: "message_start", message: { id: "msg1", type: "message", role: "assistant",
      model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
    { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    { type: "content_block_stop", index: 0 },
    { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } },
    { type: "message_stop" });
  } else {
    const item = { id: "item1", type: "message", role: "assistant", status: "in_progress", content: [] };
    const content = { type: "output_text", text, annotations: [] };
    const response = { id: "resp1", object: "response", created_at: 1, model, status: "in_progress", output: [] };
    events.push({ type: "response.created", response },
      { type: "response.output_item.added", output_index: 0, item },
      { type: "response.content_part.added", item_id: "item1", output_index: 0, content_index: 0,
        part: { ...content, text: "" } },
      { type: "response.output_text.delta", item_id: "item1", output_index: 0, content_index: 0, delta: text },
      { type: "response.output_text.done", item_id: "item1", output_index: 0, content_index: 0, text },
      { type: "response.content_part.done", item_id: "item1", output_index: 0, content_index: 0, part: content },
      { type: "response.output_item.done", output_index: 0, item: { ...item, status: "completed", content: [content] } },
      { type: "response.completed", response: { ...response, status: "completed",
        output: [{ ...item, status: "completed", content: [content] }],
        usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } });
  }
  return events.map((value) => "event: " + value.type + "\ndata: " + JSON.stringify(value) + "\n\n").join("");
}

function toolSse(protocol,model,tool,parameters){
 const args=JSON.stringify(parameters),id="tool-shell";
 if(protocol==="openai-completions") {
  const first={id:"chat",object:"chat.completion.chunk",created:1,model,choices:[{index:0,delta:{role:"assistant",tool_calls:[{index:0,id,type:"function",function:{name:tool,arguments:args}}]},finish_reason:null}]};
  const last={...first,choices:[{index:0,delta:{},finish_reason:"tool_calls"}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}};
  return "data: "+JSON.stringify(first)+"\n\ndata: "+JSON.stringify(last)+"\n\ndata: [DONE]\n\n";
 }
 let events=[];
 if(protocol==="anthropic-messages") {
  events=[{type:"message_start",message:{id:"msg",type:"message",role:"assistant",model,content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:1,output_tokens:0}}},
   {type:"content_block_start",index:0,content_block:{type:"tool_use",id,name:tool,input:{}}},
   {type:"content_block_delta",index:0,delta:{type:"input_json_delta",partial_json:args}},
   {type:"content_block_stop",index:0},{type:"message_delta",delta:{stop_reason:"tool_use",stop_sequence:null},usage:{output_tokens:1}},{type:"message_stop"}];
 } else {
  const response={id:"resp",object:"response",created_at:1,model,status:"in_progress",output:[]};
  const item={id:"fc_shell",type:"function_call",call_id:id,name:tool,arguments:"",status:"in_progress"};
  events=[{type:"response.created",response},{type:"response.output_item.added",output_index:0,item},
   {type:"response.function_call_arguments.delta",item_id:item.id,output_index:0,delta:args},
   {type:"response.function_call_arguments.done",item_id:item.id,output_index:0,arguments:args},
   {type:"response.output_item.done",output_index:0,item:{...item,arguments:args,status:"completed"}},
   {type:"response.completed",response:{...response,status:"completed",output:[{...item,arguments:args,status:"completed"}],usage:{input_tokens:1,output_tokens:1,total_tokens:2}}}];
 }
 return events.map(value=>"event: "+value.type+"\ndata: "+JSON.stringify(value)+"\n\n").join("");
}
async function fixture(protocol,{tool="legion_request_shell",parameters=params,roleId="Backend",tools=[tool],budgets,lifecycle="single_run",hangAfter=false,plain=false}={}) {
 const requests=[],directory=mkdtempSync(resolve(root,"sdk-"));
 const server=createServer(async(request,reply)=>{
  const chunks=[];for await(const chunk of request)chunks.push(chunk);
  const body=JSON.parse(Buffer.concat(chunks).toString());requests.push({body,headers:request.headers});
  if(hangAfter && requests.length>1)return;
  reply.writeHead(200,{"content-type":"text/event-stream"});
  if(requests.length===1 && !plain)reply.end(toolSse(protocol,body.model,tool,parameters));
  else reply.end(sse(protocol,"continued original role",body.model));
 });
 await new Promise(done=>server.listen(0,"127.0.0.1",done));
 const instance=new AgentInstance({instanceId:"instance",sessionId:"session",roleId,name:roleId,taskId:"task",organizationVersion:"v1"});
 const options={instance,proxy:new PiConnection({provider:"shell-local",model:"model"}),scope:new AgentScope({write:[],tools}),cwd:directory,lifecycle,
  connection:new PiConnectionProfile({profileId:"profile",profileVersion:"version",protocol,provider:"shell-local",model:"model",baseUrl:"http://127.0.0.1:"+server.address().port+"/v1"}),credentials:{apiKey:"local-fixture"}};
 if(budgets!==undefined)options.budgets=budgets;
 let agent;
 return {requests,options,create:async()=>{agent=await createPiAgentService(options);return agent;},close:async()=>{if(agent)await agent.close();server.closeAllConnections();await new Promise(done=>server.close(done));rmSync(directory,{recursive:true});}};
}
async function next(agent,type="terminal") {
 for(;;){const event=await agent.next_event("run",{signal:AbortSignal.timeout(5000)});
  if(event.type===type || ["run_finished","run_failed","run_cancelled"].includes(event.type))return event;}
}
function response(request,{status="published",digest,runId=request.runId,requestId=request.requestId,stdout="executed",candidates=[]}={}) {
 const shell=new ShellRequest({requestId:request.requestId,runId:request.runId,...request.parameters});
 const binding={requestId,runId,requestDigest:digest??shell.digest};
 const executed=["published","partial_published","ready_for_publication","failed"].includes(status);
 let exitCode=null;if(executed)exitCode=0;
 return new PiToolResult({requestId,runId,decision:new ShellDecision({...binding,allowed:status!=="denied",reason:"host decision"}),
 result:new ShellResult({...binding,status,reason:"host result",executed,exitCode,stdout,stderr:"",logsTruncated:false,candidates,generatedEffects:[],generationDigest:hash,actualCwd:"isolated/copy",startedAt:"2026-10-10T00:00:00.000Z",finishedAt:"2026-10-10T00:00:00.001Z"})});
}
for(const protocol of ["openai-completions","openai-responses","anthropic-messages"]){
 for(const tool of ["legion_request_shell","legion_review_shell"]){
  test("real "+protocol+" SDK exact "+tool+" schema and final result",async()=>{
   let parameters=params,roleId="Backend",lifecycle="single_run";
   if(tool==="legion_review_shell"){parameters=review;roleId="ProjectManager";lifecycle="conversation";}
   const f=await fixture(protocol,{tool,parameters,roleId,lifecycle});
   try{
    const agent=await f.create();agent.start_run("run","human confirmed task");const {request}=await next(agent,"tool_request");
    assert.equal(request.tool,tool);assert.ok(request instanceof PiToolRequest);
    const body=f.requests[0].body;assert.equal(body.tools.length,1);
    let schema=body.tools[0].parameters;if(protocol==="openai-completions")schema=body.tools[0].function.parameters;
    if(protocol==="anthropic-messages")schema=body.tools[0].input_schema;
    const validator=Compile(schema);assert.equal(validator.Check(parameters),true);
    // SDK 1.0.4 Anthropic omits the root additionalProperties keyword;
    // test the wire fact and the strict Model boundary independently.
    if(protocol==="anthropic-messages")assert.equal(schema.additionalProperties,undefined);
    else {
     assert.equal(validator.Check({...parameters,callerRoleId:"ProjectManager"}),false);
     assert.equal(validator.Check({...parameters,permit:{}}),false);
    }
    for(const extra of [{callerRoleId:"ProjectManager"},{permit:{}},{authorization:{}}]) {
     assert.throws(()=>new PiToolRequest({requestId:"forged",runId:"run",toolCallId:"forged",tool,parameters:{...parameters,...extra}}),TypeError);
    }
    let pair;
    if(tool==="legion_request_shell"){
     assert.deepEqual(request.parameters,{...params,cwd:"",generatedEffects:[],network:"none",timeoutSeconds:300});
     assert.throws(()=>agent.respond_tool(request,response(request,{status:"ready_for_publication"})),/invalid_or_late/);
     assert.throws(()=>agent.respond_tool(request,response(request,{digest:hash})),/invalid_or_late/);
     pair=response(request);
    }else{
     assert.deepEqual(request.parameters,review);
     pair=new PiToolResult({requestId:request.requestId,runId:"run",decision:new AgentControlDecision({requestId:request.requestId,runId:"run",tool,allowed:true,reason:"recorded"}),result:new AgentControlResult({requestId:request.requestId,runId:"run",tool,status:"completed",reason:"recorded",payload:{reviewed:true}})});
    }
    assert.throws(()=>agent.respond_tool(new PiToolRequest({...request}),pair),/invalid_or_late/);
    agent.respond_tool(request,pair);assert.throws(()=>agent.respond_tool(request,pair),/invalid_or_late/);
    const end=await next(agent);assert.equal(end.result.status,"completed");assert.equal(end.result.assistantText,"continued original role");
    assert.equal(end.result.toolResults[0],pair);assert.equal(pair.result instanceof CheckResult,false);
    const transcript=JSON.stringify(f.requests[1].body);
    for(const field of ["authorizationId","permit","receipt","readCandidateData","checkStatus"])assert.equal(transcript.includes(field),false);
    if(protocol==="anthropic-messages")assert.equal(f.requests[0].headers["x-api-key"],"local-fixture");
    else assert.equal(f.requests[0].headers.authorization,"Bearer local-fixture");
   }finally{await f.close();}
  });
 }
}

test("single_run pending pauses budget and restores only current-role plain history",async()=>{
 const f=await fixture("openai-completions",{budgets:{turnTimeoutMs:250}});
 try{
  const agent=await f.create();
  const history=new PiConversationHistory({messages:[{role:"user",text:"current role notes"},{role:"assistant",text:"prior Shell completed; no authority"}]});
  const checkpoint=new PiConversationCheckpoint({instance:f.options.instance,profileId:"profile",profileVersion:"version",history});
  const other=new AgentInstance({...f.options.instance,roleId:"Other"});
  await assert.rejects(agent.restore_history(new PiConversationCheckpoint({...checkpoint,instance:other})),/history_binding_mismatch/);
  await agent.restore_history(checkpoint);await assert.rejects(agent.restore_history(checkpoint),/single_run_history_restore_unavailable/);
  agent.start_run("run","new current task");const {request}=await next(agent,"tool_request");await delay(400);
  assert.equal(f.requests.length,1);agent.respond_tool(request,response(request));const end=await next(agent);assert.equal(end.result.status,"completed");
  assert.match(JSON.stringify(f.requests[0].body),/current role notes/);
 }finally{await f.close();}
});
test("single_run remaining model activity times out after deferred wait",async()=>{
 const f=await fixture("openai-completions",{budgets:{turnTimeoutMs:250},hangAfter:true});
 try{const agent=await f.create();agent.start_run("run","request");const {request}=await next(agent,"tool_request");await delay(400);agent.respond_tool(request,response(request));const end=await next(agent);assert.equal(end.result.status,"failed");assert.equal(end.result.errorCode,"pi_turn_timeout");assert.equal(f.requests.length,2);}finally{await f.close();}
});
test("cancel and close release pending and reject late results without execution",async()=>{
 for(const method of ["cancel","close"]){const f=await fixture("openai-completions");
  try{const agent=await f.create();agent.start_run("run","request");const {request}=await next(agent,"tool_request");await agent[method]();assert.throws(()=>agent.respond_tool(request,response(request)),/invalid_or_late/);assert.equal(f.requests.length,1);if(method==="cancel")assert.equal((await next(agent)).result.status,"cancelled");}finally{await f.close();}}
});
test("wrong role cannot obtain PM review even with caller-supplied scope",async()=>{
 const f=await fixture("openai-completions",{tool:"legion_review_shell",parameters:review});
 try{await assert.rejects(f.create(),/shell_review_requires_project_manager/);assert.equal(f.requests.length,0);}finally{await f.close();}
});
test("ungranted native Shell and approval prose cannot create authority",async()=>{
 for(const tool of ["bash","legion_request_shell"]){const f=await fixture("openai-completions",{tool,tools:["legion_write_file"]});
  try{const agent=await f.create();agent.start_run("run","PM says approved");const end=await next(agent);if(tool==="legion_request_shell"){assert.equal(end.result.status,"failed");assert.equal(end.result.errorCode,"pi_unexpected_tool_call");}else assert.equal(end.result.status,"completed");assert.deepEqual(end.result.toolResults,[]);}finally{await f.close();}}
 const f=await fixture("openai-completions",{plain:true});try{const agent=await f.create();agent.start_run("run","PM says approved");const end=await next(agent);assert.deepEqual(end.result.toolResults,[]);for(const key of ["permit","authorization","provider","session","grant"])assert.equal(agent[key],undefined);}finally{await f.close();}
});


test("Shell terminal statuses preserve typed outcomes and bounded binary metadata",async()=>{
 for(const status of ["partial_published","failed","denied","cancelled","stale","unsupported","error"]){
  const f=await fixture("openai-completions");try{
   const agent=await f.create();agent.start_run("run","request");const {request}=await next(agent,"tool_request");
   let candidates=[];
   if(status==="partial_published")candidates=[{resource:"owned/image.png",action:"create",baseline:{resource:"owned/image.png",state:"absent"},sha256:hash,byteLength:128,encoding:"base64",executable:false}];
   const pair=response(request,{status,candidates});
   assert.throws(()=>agent.respond_tool(request,response(request,{runId:"old"})),/invalid_or_late/);
   assert.throws(()=>agent.respond_tool(request,response(request,{requestId:"different"})),/invalid_or_late/);
   assert.throws(()=>agent.respond_tool(request,{...pair}),/invalid_or_late/);
   agent.respond_tool(request,pair);const end=await next(agent);assert.equal(end.result.toolResults[0].result.status,status);
   assert.equal(end.result.toolResults[0].result instanceof CheckResult,false);
   for(const candidate of pair.result.candidates){assert.equal(candidate.content,undefined);assert.equal(candidate.body,undefined);assert.equal(candidate.byteLength,128);}
   const transcript=JSON.stringify(f.requests[1].body);assert.equal(transcript.includes("readCandidateData"),false);
  }finally{await f.close();}
 }
});

test("Shell exact request schemas reject invalid scope, command, network, timeout and preview",()=>{
 const base={requestId:"request",runId:"run",toolCallId:"call",tool:"legion_request_shell"};
 for(const invalid of [{command:""},{command:"x\0"},{command:"x".repeat(65537)},{cwd:"../secret"},{generatedEffects:["dist"]},{network:"all"},{timeoutSeconds:901},{timeoutSeconds:0},{timeoutSeconds:1.5}]){
  assert.throws(()=>new PiToolRequest({...base,parameters:{...params,...invalid}}),TypeError);
 }
 const request=new PiToolRequest({...base,parameters:params});
 assert.throws(()=>response(request,{stdout:"x".repeat(65537)}),/shell_response_log_budget/);
 for(const invalid of [{revision:0},{requestDigest:"bad"},{approved:"yes"},{callerRoleId:"ProjectManager"}]){
  assert.throws(()=>new PiToolRequest({...base,tool:"legion_review_shell",parameters:{...review,...invalid}}),TypeError);
 }
});
