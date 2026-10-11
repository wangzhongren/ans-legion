import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { Compile } from "typebox/compile";
import { createPiAgentService } from "../../src/adapters/services/public/pi_agent.mjs";
import { AgentInstance, AgentScope, PiConnection, PiConnectionProfile, PiToolRequest, PiToolResult,
  AgentControlTools, AgentControlDecision, AgentControlResult } from "../../src/kernel/models/agent.mjs";
import { PolicyDecision, MutationResult, Outcome } from "../../src/kernel/models/core.mjs";

const root = resolve(".ans/runtime/legion-cli-role-owned-v2/AgentAdapterEngineer/fixtures");
mkdirSync(root, { recursive: true });
const tools = ["legion_remember_fact", "legion_query_memory", "legion_submit_supervision"];
const payloads = {
  legion_remember_fact: { action: "add", kind: "pitfall", statement: "Recheck after owner transfer", sourceRefs: ["host-source-1"], expectedRevision: 0 },
  legion_query_memory: { kind: "decision", cursor: "", limit: 10 },
  legion_submit_supervision: { phase: "preflight", planDigest: "a".repeat(64), findings: [{ severity: "warn", taskIds: ["task"], sourceRefs: ["host-source-1"], reason: "Wait for current checks" }], recommendation: "revise" }
};
const protocols = ["openai-completions", "openai-responses", "anthropic-messages"];
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
 const args=JSON.stringify(parameters),id="tool-control";
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
  const item={id:"fc_control",type:"function_call",call_id:id,name:tool,arguments:"",status:"in_progress"};
  events=[{type:"response.created",response},{type:"response.output_item.added",output_index:0,item},
   {type:"response.function_call_arguments.delta",item_id:item.id,output_index:0,delta:args},
   {type:"response.function_call_arguments.done",item_id:item.id,output_index:0,arguments:args},
   {type:"response.output_item.done",output_index:0,item:{...item,arguments:args,status:"completed"}},
   {type:"response.completed",response:{...response,status:"completed",output:[{...item,arguments:args,status:"completed"}],usage:{input_tokens:1,output_tokens:1,total_tokens:2}}}];
 }
 return events.map(value=>"event: "+value.type+"\ndata: "+JSON.stringify(value)+"\n\n").join("");
}

async function fixture(protocol, { tool = tools[0], parameters = { payload: payloads[tool] },
  granted = [tool], lifecycle = "single_run", failure = false, hangAfter = false, budgets } = {}) {
  const directory = mkdtempSync(resolve(root, "controls-"));
  const requests = [], interrupted = [];
  const server = createServer(async (request, reply) => {
    reply.on("close", () => { if (!reply.writableEnded) interrupted.push(request.url); });
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    requests.push({ body, headers: request.headers, path: request.url });
    if (failure) {
      reply.writeHead(401, { "content-type": "application/json" });
      reply.end(JSON.stringify({ error: { type: "authentication_error", message: "private-provider-key" } }));
      return;
    }
    if (hangAfter && requests.length > 1) return;
    reply.writeHead(200, { "content-type": "text/event-stream" });
    if (requests.length % 2 === 1) reply.end(toolSse(protocol, body.model, tool, parameters));
    else reply.end(sse(protocol, "Host result received", body.model));
  });
  await new Promise(done => server.listen(0, "127.0.0.1", done));
  let roleId = "Backend";
  if (tool === "legion_submit_supervision") roleId = "Supervisor";
  const options = {
    instance: new AgentInstance({ instanceId: "instance", sessionId: "session", roleId, name: roleId, taskId: "task", organizationVersion: "v2" }),
    proxy: new PiConnection({ provider: "controls-local", model: "model" }),
    scope: new AgentScope({ write: [], tools: granted }), cwd: directory, lifecycle,
    connection: new PiConnectionProfile({ profileId: "profile", profileVersion: "v2", protocol, provider: "controls-local", model: "model", baseUrl: "http://127.0.0.1:" + server.address().port + "/v1" }),
    credentials: { apiKey: "local-control-key" }
  };
  if (budgets !== undefined) options.budgets = budgets;
  let agent;
  return { requests, interrupted, options,
    create: async () => { agent = await createPiAgentService(options); return agent; },
    close: async () => {
      if (agent !== undefined) await agent.close();
      server.closeAllConnections(); await new Promise(done => server.close(done));
      rmSync(directory, { recursive: true });
    } };
}
async function next(agent, runId = "run", type = "terminal") {
  for (;;) {
    const event = await agent.next_event(runId, { signal: AbortSignal.timeout(5000) });
    if (event.type === type || ["run_finished", "run_failed", "run_cancelled"].includes(event.type)) return event;
  }
}
function response(request, { status = "completed", tool = request.tool, requestId = request.requestId, runId = request.runId } = {}) {
  const allowed = status === "completed" || status === "cancelled";
  return new PiToolResult({ requestId, runId,
    decision: new AgentControlDecision({ requestId, runId, tool, allowed, reason: "host_decision" }),
    result: new AgentControlResult({ requestId, runId, tool, status, reason: "host_" + status,
      payload: { factId: "fact-1", revision: 2, hostStatus: status } }) });
}
function wireTools(body) {
  return body.tools.map(tool => {
    if (tool.function !== undefined) return { name: tool.function.name, schema: tool.function.parameters, description: tool.function.description };
    return { name: tool.name, schema: tool.parameters ?? tool.input_schema, description: tool.description };
  });
}

for (const protocol of protocols) {
  for (const tool of tools) {
    test(protocol + " actual " + tool + " typed status, precise schema and continuation", async () => {
      for (const status of ["completed", "denied", "cancelled", "stale", "error"]) {
        const f = await fixture(protocol, { tool });
        try {
          const agent = await f.create(); agent.start_run("run", "Use current role controls");
          const event = await next(agent, "run", "tool_request");
          assert.equal(event.type, "tool_request");
          const request = event.request;
          assert.ok(request instanceof PiToolRequest); assert.equal(request.tool, tool);
          assert.deepEqual(request.parameters, { payload: payloads[tool] });
          assert.equal(AgentControlTools.includes(tool), true);
          const registered = wireTools(f.requests[0].body);
          assert.deepEqual(registered.map(item => item.name), [tool]);
          const schema = registered[0].schema, validator = Compile(schema);
          assert.deepEqual(Object.keys(schema.properties), ["payload"]);
          assert.deepEqual(schema.required, ["payload"]);
          assert.equal(validator.Check(request.parameters), true);
          assert.match(registered[0].description, /host/i);
          if (protocol === "anthropic-messages") assert.equal(schema.additionalProperties, undefined);
          else {
            assert.equal(schema.additionalProperties, false);
            assert.equal(validator.Check({ ...request.parameters, callerRoleId: "Other" }), false);
          }
          for (const extra of [{ callerRoleId: "Other" }, { permit: {} }, { ownerGeneration: "forged" }]) {
            assert.throws(() => new PiToolRequest({ ...request, parameters: { ...request.parameters, ...extra } }), TypeError);
          }
          for (const wrong of [{ runId: "old" }, { requestId: "other" }, { tool: tools.find(name => name !== tool) }]) {
            assert.throws(() => agent.respond_tool(request, response(request, wrong)), /invalid_or_late/);
          }
          const pair = response(request, { status });
          assert.throws(() => agent.respond_tool(new PiToolRequest({ ...request }), pair), /invalid_or_late/);
          assert.throws(() => agent.respond_tool(request, { ...pair }), /invalid_or_late/);
          const mutation = new PiToolResult({ requestId: request.requestId, runId: request.runId,
            decision: new PolicyDecision({ outcome: Outcome.ALLOW, reason: "ok", proposalDigest: "digest", organizationVersion: "v2" }),
            result: new MutationResult({ success: true, status: "written", reason: "written", resource: "x.mjs", proposalDigest: "digest", observedMutation: true }) });
          assert.throws(() => agent.respond_tool(request, mutation), /invalid_or_late/);
          agent.respond_tool(request, pair);
          assert.throws(() => agent.respond_tool(request, pair), /invalid_or_late/);
          const end = await next(agent);
          assert.equal(end.result.status, "completed");
          assert.equal(end.result.assistantText, "Host result received");
          assert.deepEqual(end.result.toolResults, [pair]);
          assert.equal(f.requests.length, 2);
          const transcript = JSON.stringify(f.requests[1].body);
          assert.match(transcript, new RegExp("host_" + status));
          assert.match(transcript, /fact-1/);
          assert.doesNotMatch(JSON.stringify(end), /local-control-key|private-provider-key/);
        } finally { await f.close(); }
      }
    });

    test(protocol + " " + tool + " pending cancellation revokes late typed response", async () => {
      for (const method of ["cancel_turn", "cancel", "close"]) {
        const f = await fixture(protocol, { tool, lifecycle: "conversation" });
        try {
          const agent = await f.create(); agent.start_run("run", "Wait for Host");
          const { request } = await next(agent, "run", "tool_request");
          await agent[method]("run");
          assert.throws(() => agent.respond_tool(request, response(request)), /invalid_or_late/);
          assert.equal(f.requests.length, 1);
          if (method !== "close") assert.equal((await next(agent)).result.status, "cancelled");
          if (method === "cancel_turn") {
            agent.start_run("next", "Fresh run after cancellation");
            assert.equal((await next(agent, "next")).result.status, "completed");
            assert.equal(f.requests.length, 2);
          } else assert.throws(() => agent.start_run("next", "No restart"), /not_ready/);
        } finally { await f.close(); }
      }
    });
  }

  test(protocol + " Supervisor conversation keeps memory and supervision tools across real turns", async () => {
    const f = await fixture(protocol, { tool: "legion_submit_supervision", granted: tools, lifecycle: "conversation" });
    try {
      const agent = await f.create();
      for (const runId of ["first", "second"]) {
        agent.start_run(runId, "Supervise current plan " + runId);
        const { request } = await next(agent, runId, "tool_request");
        const pair = response(request); agent.respond_tool(request, pair);
        const end = await next(agent, runId);
        assert.equal(end.result.status, "completed"); assert.equal(end.result.toolResults[0], pair);
      }
      assert.equal(f.requests.length, 4);
      assert.deepEqual(wireTools(f.requests[2].body).map(item => item.name).sort(), [...tools].sort());
      assert.match(JSON.stringify(f.requests[2].body), /Supervise current plan first/);
      assert.match(JSON.stringify(f.requests[2].body), /Host result received/);
    } finally { await f.close(); }
  });

  test(protocol + " ungranted or forged control calls never become Host pending", async () => {
    for (const [tool, parameters, granted] of [
      [tools[0], { payload: payloads[tools[0]] }, [tools[1]]],
      [tools[1], { payload: payloads[tools[1]] }, [tools[2]]],
      [tools[2], { payload: payloads[tools[2]] }, [tools[0]]],
      [tools[0], { payload: { callerRoleId: "Other" } }, [tools[0]]],
      [tools[0], { payload: payloads[tools[0]], permit: {} }, [tools[0]]]
    ]) {
      const f = await fixture(protocol, { tool, parameters, granted });
      try {
        const agent = await f.create(); agent.start_run("run", "Invalid call");
        // Reading every event guarantees a tool_request cannot be skipped by a terminal helper.
        let terminal;
        for (;;) {
          const event = await agent.next_event("run", { signal: AbortSignal.timeout(5000) });
          assert.notEqual(event.type, "tool_request");
          if (["run_finished", "run_failed", "run_cancelled"].includes(event.type)) { terminal = event; break; }
        }
        if (!granted.includes(tool)) {
          assert.equal(terminal.result.status, "failed");
          assert.equal(terminal.result.errorCode, "pi_unexpected_tool_call");
        } else {
          assert.equal(terminal.result.status, "completed");
          assert.match(JSON.stringify(f.requests[1].body), /error|invalid|field|validation/i);
        }
        assert.deepEqual(terminal.result.toolResults, []);
      } finally { await f.close(); }
    }
  });

  test(protocol + " safe authentication error and resumed HTTP timeout", async () => {
    const bad = await fixture(protocol, { failure: true });
    try {
      const agent = await bad.create(); agent.start_run("run", "Authenticate");
      const end = await next(agent);
      assert.equal(end.result.status, "failed"); assert.equal(end.result.errorCode, "pi_auth_error");
      assert.doesNotMatch(JSON.stringify(end), /private-provider-key|local-control-key/);
      assert.equal(bad.requests.length, 1);
    } finally { await bad.close(); }
    const slow = await fixture(protocol, { hangAfter: true, budgets: { turnTimeoutMs: 300 } });
    try {
      const agent = await slow.create(); agent.start_run("run", "Timeout after Host");
      const { request } = await next(agent, "run", "tool_request");
      await delay(400); assert.equal(slow.requests.length, 1);
      agent.respond_tool(request, response(request));
      const end = await next(agent);
      assert.equal(end.result.status, "failed"); assert.equal(end.result.errorCode, "pi_turn_timeout");
      assert.equal(slow.requests.length, 2);
    } finally { await slow.close(); }
  });

  test(protocol + " cancellation aborts HTTP after control response without retries", async () => {
    for (const method of ["cancel_turn", "cancel", "close"]) {
      const f = await fixture(protocol, { lifecycle: "conversation", hangAfter: true });
      try {
        const agent = await f.create(); agent.start_run("run", "Control then network wait");
        const { request } = await next(agent, "run", "tool_request");
        agent.respond_tool(request, response(request));
        for (let attempt = 0; attempt < 100 && f.requests.length < 2; attempt += 1) await delay(10);
        assert.equal(f.requests.length, 2);
        await agent[method]("run");
        assert.throws(() => agent.respond_tool(request, response(request)), /invalid_or_late/);
        for (let attempt = 0; attempt < 100 && f.interrupted.length === 0; attempt += 1) await delay(10);
        assert.equal(f.interrupted.length, 1); assert.equal(f.requests.length, 2);
        if (method !== "close") assert.equal((await next(agent)).result.status, "cancelled");
      } finally { await f.close(); }
    }
  });
}

for (const protocol of protocols) {
  test(protocol + " memory revision and retraction relay plain source and revision data", async () => {
    for (const [action, kind] of [["revise", "decision"], ["retract", "preference"]]) {
      const payload = { action, factId: "fact-owned", kind, statement: "Current registered source", sourceRefs: ["host-answer"], expectedRevision: 2 };
      const f = await fixture(protocol, { tool: "legion_remember_fact", parameters: { payload } });
      try {
        const agent = await f.create(); agent.start_run("run", "Submit own fact " + action);
        const { request } = await next(agent, "run", "tool_request");
        assert.deepEqual(request.parameters, { payload });
        assert.equal(Object.hasOwn(request.parameters.payload, "ownerRoleId"), false);
        const pair = response(request); agent.respond_tool(request, pair);
        const end = await next(agent);
        assert.equal(end.result.status, "completed"); assert.deepEqual(end.result.toolResults, [pair]);
        assert.match(JSON.stringify(f.requests[1].body), /host-answer/);
      } finally { await f.close(); }
    }
  });
}

for (const protocol of protocols) {
  test(protocol + " independent same-role instances reject each other's control request", async () => {
    const a = await fixture(protocol, { tool: "legion_query_memory" });
    const b = await fixture(protocol, { tool: "legion_query_memory" });
    b.options.instance = new AgentInstance({ ...b.options.instance, instanceId: "instance-B", sessionId: "session-B" });
    try {
      const [first, second] = await Promise.all([a.create(), b.create()]);
      first.start_run("run", "First independent context"); second.start_run("run", "Second independent context");
      const [ea, eb] = await Promise.all([next(first, "run", "tool_request"), next(second, "run", "tool_request")]);
      assert.notEqual(ea.request.requestId, eb.request.requestId);
      assert.throws(() => first.respond_tool(eb.request, response(eb.request)), /invalid_or_late/);
      assert.throws(() => second.respond_tool(ea.request, response(ea.request)), /invalid_or_late/);
      first.respond_tool(ea.request, response(ea.request)); second.respond_tool(eb.request, response(eb.request));
      const [endA, endB] = await Promise.all([next(first), next(second)]);
      assert.equal(endA.result.status, "completed"); assert.equal(endB.result.status, "completed");
      assert.equal(endA.result.toolResults[0].requestId, ea.request.requestId);
      assert.equal(endB.result.toolResults[0].requestId, eb.request.requestId);
      assert.doesNotMatch(JSON.stringify(a.requests[1].body), /Second independent context/);
      assert.doesNotMatch(JSON.stringify(b.requests[1].body), /First independent context/);
    } finally { await Promise.all([a.close(), b.close()]); }
  });
}

const suCases = [
  ["legion_delegate_pm", {action:"start",purpose:"plan",instruction:"Plan the recorded request",sourceRefs:["human:one"]}],
  ["legion_delegate_pm", {action:"start",purpose:"role_design",instruction:"Design roles",sourceRefs:[]}],
  ["legion_delegate_pm", {action:"start",purpose:"repair",instruction:"Repair failed acceptance",sourceRefs:["acceptance:one"],acceptanceId:"acceptance-one",taskId:"task-one"}],
  ["legion_delegate_pm", {action:"resume",delegationId:"host-delegation",humanAnswerRef:"host-answer"}],
  ["legion_query_role_activity", {}],
  ["legion_query_role_log", {roleId:"Backend",taskId:"task-one",planDigest:"a".repeat(64),limit:20,cursor:"host-cursor"}]
];
const frontTools = ["legion_list_files","legion_read_file","legion_remember_fact","legion_query_memory","legion_request_interaction","legion_delegate_pm","legion_query_role_activity","legion_query_role_log"];
const backTools = ["legion_list_files","legion_read_file","legion_remember_fact","legion_query_memory","legion_query_role_activity","legion_query_role_log","legion_submit_supervision"];

for (const protocol of protocols) {
  test(protocol + " Su finite schema and actual start/resume/query typed continuation", async () => {
    for (const [tool,payload] of suCases) {
      for (const status of ["completed","denied","stale","error","cancelled"]) {
        const f = await fixture(protocol,{tool,parameters:{payload},lifecycle:"conversation"});
        try {
          const agent=await f.create();agent.start_run("run","Use Host-bound Su tool");
          const {request}=await next(agent,"run","tool_request");
          assert.equal(request.tool,tool);assert.deepEqual(request.parameters,{payload});
          const schema=wireTools(f.requests[0].body)[0].schema,validator=Compile(schema);
          assert.equal(validator.Check({payload}),true);
          for(const extra of [{projectId:"forged"},{callerRoleId:"Supervisor"},{profile:"forged"},{owner:[]}]) {
            assert.equal(validator.Check({payload:{...payload,...extra}}),false);
            assert.throws(()=>new PiToolRequest({...request,parameters:{payload:{...payload,...extra}}}),TypeError);
          }
          if(protocol==="anthropic-messages")assert.equal(schema.additionalProperties,undefined);
          else assert.equal(validator.Check({payload,permit:{}}),false);
          assert.throws(()=>new PiToolRequest({...request,parameters:{payload,permit:{}}}),TypeError);
          let safePayload={snapshotRevision:1,events:[{eventId:"event",tool:"legion_read_file",resource:"backend/x.mjs",status:"read",createdAt:"2026-10-11T00:00:00Z"}],nextCursor:null};
          if(tool==="legion_delegate_pm")safePayload={kind:"needs_human",delegationId:"host-delegation",questionRef:"host-question",status:"awaiting_human"};
          const binding={requestId:request.requestId,runId:request.runId,tool};
          let allowed=false;if(status==="completed"||status==="cancelled")allowed=true;
          const pair=new PiToolResult({requestId:binding.requestId,runId:binding.runId,decision:new AgentControlDecision({...binding,allowed,reason:"host_checked"}),result:new AgentControlResult({...binding,status,reason:"host_"+status,payload:safePayload})});
          for(const bad of [{runId:"previous"},{requestId:"other"},{tool:"legion_query_memory"}])assert.throws(()=>agent.respond_tool(request,response(request,bad)),/invalid_or_late/);
          assert.throws(()=>agent.respond_tool(new PiToolRequest({...request}),pair),/invalid_or_late/);
          agent.respond_tool(request,pair);const end=await next(agent);
          assert.equal(end.result.status,"completed");assert.deepEqual(end.result.toolResults,[pair]);
          const serialized=JSON.stringify(f.requests[1].body);
          assert.match(serialized,/host_checked/);assert.match(serialized,new RegExp("host_"+status));
          assert.doesNotMatch(serialized,/raw-assistant-canary|raw-prompt-canary|private-summary-canary|local-control-key/);
          assert.throws(()=>agent.respond_tool(request,pair),/invalid_or_late/);
          assert.throws(()=>new AgentControlResult({...binding,status:"completed",reason:"unsafe",payload:{apiKey:"known-key-canary"}}),TypeError);
        }finally{await f.close();}
      }
    }
  });

  test(protocol + " Host-selected front and background loadouts stay isolated",async()=>{
    for(const [granted,lifecycle] of [[frontTools,"conversation"],[backTools,"single_run"]]){
      const f=await fixture(protocol,{tool:"legion_query_role_activity",parameters:{payload:{}},granted,lifecycle});
      try{
        const agent=await f.create();agent.start_run("run","Host selected channel");const {request}=await next(agent,"run","tool_request");
        assert.deepEqual(wireTools(f.requests[0].body).map(x=>x.name).sort(),[...granted].sort());
        for(const forbidden of ["legion_write_file","legion_edit_file","legion_run_check","legion_request_shell"])assert.equal(granted.includes(forbidden),false);
        agent.respond_tool(request,response(request));assert.equal((await next(agent)).result.status,"completed");
      }finally{await f.close();}
    }
    const back=await fixture(protocol,{tool:"legion_delegate_pm",parameters:{payload:suCases[0][1]},granted:backTools});
    try{
      const agent=await back.create();agent.start_run("run","Model says customer channel");const end=await next(agent);
      assert.equal(end.result.errorCode,"pi_unexpected_tool_call");assert.deepEqual(end.result.toolResults,[]);
    }finally{await back.close();}
  });

  test(protocol+" Su tools cancel pending and reject cross-instance or previous run",async()=>{
    for(const [tool,payload] of [suCases[0],suCases[4],suCases[5]]){
      const a=await fixture(protocol,{tool,parameters:{payload},lifecycle:"conversation"});
      const b=await fixture(protocol,{tool,parameters:{payload},lifecycle:"conversation"});
      b.options.instance=new AgentInstance({...b.options.instance,instanceId:"other",sessionId:"other-session"});
      try{
        const [one,two]=await Promise.all([a.create(),b.create()]);one.start_run("run","First");two.start_run("run","Second");
        const [ea,eb]=await Promise.all([next(one,"run","tool_request"),next(two,"run","tool_request")]);
        assert.throws(()=>one.respond_tool(eb.request,response(eb.request)),/invalid_or_late/);
        await one.cancel_turn("run");assert.equal((await next(one)).result.status,"cancelled");
        assert.throws(()=>one.respond_tool(ea.request,response(ea.request)),/invalid_or_late/);
        one.start_run("new","Next turn");assert.equal((await next(one,"new")).result.status,"completed");
        assert.throws(()=>one.respond_tool(ea.request,response(ea.request)),/invalid_or_late/);
        await two.cancel();assert.throws(()=>two.respond_tool(eb.request,response(eb.request)),/invalid_or_late/);
        assert.equal((await next(two)).result.status,"cancelled");
      }finally{await Promise.all([a.close(),b.close()]);}
    }
  });
}

test("Su schema character limits do not replace Model UTF-8 or query result budgets",()=>{
  const request=(tool,payload)=>new PiToolRequest({requestId:"req",runId:"run",toolCallId:"call",tool,parameters:{payload}});
  assert.throws(()=>request("legion_delegate_pm",{...suCases[0][1],instruction:"界".repeat(2731)}),/delegation_instruction_budget/);
  assert.throws(()=>request("legion_query_role_log",{roleId:"Backend",cursor:"界".repeat(1366)}),/role_log_cursor_budget/);
  for(const payload of [
    {...suCases[0][1],humanAnswerRef:"forged"},{...suCases[0][1],taskId:"task"},
    {...suCases[3][1],value:true},{action:"start",purpose:"repair",instruction:"repair",sourceRefs:[]},
    {...suCases[0][1],sourceRefs:Array(33).fill("source")}
  ])assert.throws(()=>request("legion_delegate_pm",payload),TypeError);
  for(const payload of [{roleId:"Backend",limit:51},{roleId:"Backend",limit:0},{roleId:"Backend",limit:1.5},{roleId:"Backend",planDigest:"bad"},{}])assert.throws(()=>request("legion_query_role_log",payload),TypeError);
  for(const tool of ["legion_query_role_activity","legion_query_role_log"])assert.throws(()=>new AgentControlResult({requestId:"req",runId:"run",tool,status:"completed",reason:"host",payload:{text:"界".repeat(11000)}}),/role_query_result_budget/);
});

for(const protocol of protocols){
  test(protocol+" questionRef uses existing control bridge; closing Su tools revokes pending",async()=>{
    const question=await fixture(protocol,{tool:"legion_request_interaction",parameters:{payload:{questionRef:"host-question"}},lifecycle:"conversation"});
    try{
      const agent=await question.create();agent.start_run("run","Present original Host question");const {request}=await next(agent,"run","tool_request");
      assert.deepEqual(request.parameters,{payload:{questionRef:"host-question"}});
      agent.respond_tool(request,response(request));assert.equal((await next(agent)).result.status,"completed");
    }finally{await question.close();}
    for(const [tool,payload] of [suCases[0],suCases[4],suCases[5]]){
      const f=await fixture(protocol,{tool,parameters:{payload}});
      try{
        const agent=await f.create();agent.start_run("run","Await Host");const {request}=await next(agent,"run","tool_request");
        await agent.close();await agent.close();assert.throws(()=>agent.respond_tool(request,response(request)),/invalid_or_late/);assert.equal(f.requests.length,1);
      }finally{await f.close();}
    }
  });
}
