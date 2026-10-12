import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { createFauxCore, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";
import * as api from "../../src/adapters/services/public/pi_agent.mjs";
import { createProposalService } from "../../src/adapters/services/public/proposal.mjs";
import { AgentSession, PolicyDecision, MutationResult, Outcome } from "../../src/kernel/models/core.mjs";
import { AgentInstance, AgentScope, PiConnection, PiConnectionProfile, PiToolResult, PiConversationCheckpoint,
  PiConversationHistory, PiImageReference, PiImageInput, ProjectReadDecision, ProjectReadResult, AgentControlDecision, AgentControlResult } from "../../src/kernel/models/agent.mjs";

const roleRoot = resolve(".ans/runtime/legion-governed-workflow-v1/AgentAdapterEngineer");
const fixtureRoot = resolve(roleRoot, "fixtures/pi-service");
mkdirSync(fixtureRoot, { recursive: true });
mkdirSync(resolve(roleRoot, "tmp"), { recursive: true });
for (const name of ["TMPDIR", "TEMP", "TMP"]) process.env[name] = resolve(roleRoot, "tmp");

function options() {
  const core = createFauxCore({ provider: "service-fixture", models: [{ id: "model" }] });
  core.setResponses([fauxAssistantMessage(fauxToolCall("legion_write_file", { resource: "backend/x.mjs", content: "text" }),
    { stopReason: "toolUse" }), fauxAssistantMessage("done")]);
  const model = core.models[0];
  return { instance: new AgentInstance({ instanceId: "instance", name: "worker", sessionId: "trusted",
    roleId: "Backend", taskId: "task", organizationVersion: "v3" }),
    proxy: new PiConnection({ provider: "service-fixture", model: "model" }),
    scope: new AgentScope({ write: ["backend/x.mjs"], tools: ["legion_write_file"] }), cwd: fixtureRoot,
    modelProviders: { "service-fixture": { api: core.api, apiKey: "offline", baseUrl: "https://legion.invalid",
      streamSimple: core.streamSimple, models: [{ id: model.id, name: model.name, input: model.input,
        reasoning: model.reasoning, cost: model.cost, contextWindow: model.contextWindow, maxTokens: model.maxTokens }] } } };
}
async function event(service, type) {
  for (;;) {
    const value = await service.next_event("run", { signal: AbortSignal.timeout(5000) });
    if (value.type === type || value.type.startsWith("run_f") || value.type === "run_cancelled") return value;
  }
}
test("public Pi factory returns own frozen contract and hides lower layer", async () => {
  assert.deepEqual(Object.keys(api).sort(), ["PiAgentService", "createPiAgentService"].sort());
  assert.throws(() => new api.PiAgentService(), TypeError);
  const service = await api.createPiAgentService(options());
  try {
    assert.ok(service instanceof api.PiAgentService);
    assert.ok(Object.isFrozen(service));
    for (const name of ["provider", "session", "modelRuntime", "permit", "receipt", "authorization", "readCandidateData", "submit"]) assert.equal(service[name], undefined);
  } finally { await service.close(); }
});
test("real Service -> Provider queue composes pure proposal and preserves request identity", async () => {
  const service = await api.createPiAgentService(options());
  try {
    assert.equal(service.start_run("run", "write"), undefined);
    const { request } = await event(service, "tool_request");
    const session = new AgentSession({ sessionId: "trusted", roleId: "Backend", taskId: "task", organizationVersion: "v3" });
    const proposal = createProposalService().convert(request, session);
    assert.equal(proposal.session, session);
    assert.equal(proposal.runId, "run");
    const result = new PiToolResult({ requestId: request.requestId, runId: request.runId,
      decision: new PolicyDecision({ outcome: Outcome.DENY, reason: "outside_scope", proposalDigest: proposal.digest, organizationVersion: "v3" }),
      result: new MutationResult({ success: false, status: "denied", reason: "outside_scope", resource: proposal.resource, proposalDigest: proposal.digest }) });
    service.respond_tool(request, result);
    const terminal = await event(service, "run_finished");
    assert.equal(terminal.result.toolResults[0], result);
    assert.equal(terminal.result.assistantText, "done");
    assert.throws(() => service.respond_tool(request, result), /invalid_or_late/);
  } finally { await service.close(); }
});
test("Service cancellation releases real pending tool and rejects new run", async () => {
  const service = await api.createPiAgentService(options());
  try {
    service.start_run("run", "write");
    await event(service, "tool_request");
    await service.cancel();
    assert.equal((await event(service, "run_cancelled")).result.status, "cancelled");
    assert.throws(() => service.start_run("new", "new"), /not_ready/);
    await service.close(); await service.close();
  } finally { await service.close(); }
});

test("own Service passes typed conversation deltas/history, reusable turns and permanent close", async () => {
  const setup = options();
  setup.lifecycle = "conversation";
  setup.scope = new AgentScope({ tools: [], write: [] });
  const core = createFauxCore({ provider: "service-fixture", models: [{ id: "model" }], tokensPerSecond: 0 });
  core.setResponses([fauxAssistantMessage("one"), fauxAssistantMessage("two")]);
  setup.modelProviders["service-fixture"].streamSimple = core.streamSimple;
  const service = await api.createPiAgentService(setup);
  async function finish(runId) {
    const values = [];
    for (;;) {
      const value = await service.next_event(runId, { signal: AbortSignal.timeout(5000) });
      values.push(value);
      if (value.type === "run_finished" || value.type === "run_failed" || value.type === "run_cancelled") return values;
    }
  }
  try {
    service.start_run("first", "Human1");
    const first = await finish("first");
    assert.equal(first.at(-1).result.assistantText, "one");
    assert.ok(first.some((value) => value.type === "text_delta"));
    await service.cancel_turn("first");
    service.start_run("second", "Human2");
    const second = await finish("second");
    assert.equal(second.at(-1).result.assistantText, "two");
    const history = service.get_history();
    const checkpoint = new PiConversationCheckpoint({ instance: setup.instance,
      profileId: "legacy:service-fixture/model", profileVersion: setup.instance.organizationVersion, history });
    await service.restore_history(checkpoint);
    assert.equal(service.get_history(), history);
    assert.equal(core.state.callCount, 2);
    await service.close(); await service.close();
    assert.throws(() => service.start_run("closed", "Human3"), /not_ready/);
  } finally { await service.close(); }
});
test("Service restores typed plain history once for a fresh single_run with its current write tool", async () => {
  const setup = options();
  const core = createFauxCore({ provider: "service-fixture", models: [{ id: "model" }] });
  core.setResponses([fauxAssistantMessage(fauxToolCall("legion_write_file",
    { resource: "backend/x.mjs", content: "new task" }), { stopReason: "toolUse" }), fauxAssistantMessage("done")]);
  setup.modelProviders["service-fixture"].streamSimple = core.streamSimple;
  const service = await api.createPiAgentService(setup);
  const history = new PiConversationHistory({ messages: [
    { role: "user", text: "previous task" }, { role: "assistant", text: "saved plain notes" }
  ] });
  const checkpoint = new PiConversationCheckpoint({ instance: setup.instance,
    profileId: "legacy:service-fixture/model", profileVersion: setup.instance.organizationVersion, history });
  try {
    await service.restore_history(checkpoint);
    await assert.rejects(service.restore_history(checkpoint), /single_run_history_restore_unavailable/);
    service.start_run("run", "current confirmed task");
    const { request } = await event(service, "tool_request");
    assert.equal(request.tool, "legion_write_file");
    const result = new PiToolResult({ requestId: request.requestId, runId: request.runId,
      decision: new PolicyDecision({ outcome: Outcome.ALLOW, reason: "current_task_allowed",
        proposalDigest: "digest", organizationVersion: "v3" }),
      result: new MutationResult({ success: true, status: "written", reason: "written",
        resource: request.parameters.resource, proposalDigest: "digest", observedMutation: true }) });
    service.respond_tool(request, result);
    const terminal = await event(service, "run_finished");
    assert.equal(terminal.result.status, "completed");
    assert.equal(terminal.result.assistantText, "done");
    await assert.rejects(service.restore_history(checkpoint), /single_run_history_restore_unavailable/);
  } finally { await service.close(); }
});
test("Service relays a typed read request and result in read-only conversation", async () => {
  const setup = options();
  setup.lifecycle = "conversation";
  setup.scope = new AgentScope({ write: [], tools: ["legion_list_files", "legion_read_file"] });
  const core = createFauxCore({ provider: "service-fixture", models: [{ id: "model" }] });
  core.setResponses([fauxAssistantMessage(fauxToolCall("legion_list_files", { resource: "" }),
    { stopReason: "toolUse" }), fauxAssistantMessage("one file")]);
  setup.modelProviders["service-fixture"].streamSimple = core.streamSimple;
  const service = await api.createPiAgentService(setup);
  try {
    service.start_run("run", "what is here?");
    const { request } = await event(service, "tool_request");
    assert.equal(request.tool, "legion_list_files");
    const result = new PiToolResult({ requestId: request.requestId, runId: request.runId,
      decision: new ProjectReadDecision({ allowed: true, reason: "read_allowed" }),
      result: new ProjectReadResult({ status: "listed", reason: "listed", resource: "",
        entries: [{ name: "main.mjs", kind: "file" }] }) });
    service.respond_tool(request, result);
    const end = await event(service, "run_finished");
    assert.equal(end.result.assistantText, "one file");
    assert.deepEqual(end.result.toolResults, [result]);
    assert.deepEqual(service.get_history().messages,
      [{ role: "user", text: "what is here?" }, { role: "assistant", text: "one file" }]);
  } finally { await service.close(); }
});
test("Service converts a real edit tool request using the trusted Session", async () => {
  const setup = options();
  const sha256 = "a".repeat(64);
  setup.scope = new AgentScope({ write: ["backend/x.mjs"], tools: ["legion_edit_file"] });
  const core = createFauxCore({ provider: "service-fixture", models: [{ id: "model" }] });
  core.setResponses([fauxAssistantMessage(fauxToolCall("legion_edit_file", { resource: "backend/x.mjs",
    expectedSha256: sha256, replacements: [{ oldText: "old", newText: "new" }] }),
  { stopReason: "toolUse" }), fauxAssistantMessage("edited")]);
  setup.modelProviders["service-fixture"].streamSimple = core.streamSimple;
  const service = await api.createPiAgentService(setup);
  try {
    service.start_run("run", "edit my file");
    const { request } = await event(service, "tool_request");
    assert.equal(request.tool, "legion_edit_file");
    const trustedSession = new AgentSession({ sessionId: "trusted", roleId: "Backend",
      taskId: "task", organizationVersion: "v3" });
    const proposal = createProposalService().convert(request, trustedSession);
    assert.equal(proposal.session, trustedSession);
    assert.equal(proposal.action, "edit_file");
    assert.equal(proposal.tool, "legion_edit_file");
    assert.equal(proposal.capability, "write_file");
    assert.equal(proposal.expectedSha256, sha256);
    assert.deepEqual(proposal.replacements, [{ oldText: "old", newText: "new" }]);
    const result = new PiToolResult({ requestId: request.requestId, runId: request.runId,
      decision: new PolicyDecision({ outcome: Outcome.ALLOW, reason: "allowed",
        proposalDigest: proposal.digest, organizationVersion: "v3" }),
      result: new MutationResult({ success: true, status: "written", reason: "written",
        resource: proposal.resource, proposalDigest: proposal.digest, observedMutation: true }) });
    service.respond_tool(request, result);
    const terminal = await event(service, "run_finished");
    assert.equal(terminal.result.assistantText, "edited");
    assert.deepEqual(terminal.result.toolResults, [result]);
  } finally { await service.close(); }
});


test("public Service relays Su delegate needs_human without granting Mutation",async()=>{
  const setup=options();const payload={action:"resume",delegationId:"host-delegation",humanAnswerRef:"host-answer"};
  const core=createFauxCore({provider:"service-fixture",models:[{id:"model"}]});
  core.setResponses([fauxAssistantMessage(fauxToolCall("legion_delegate_pm",{payload}),{stopReason:"toolUse"}),fauxAssistantMessage("Waiting for actual Human")]);
  setup.modelProviders["service-fixture"].streamSimple=core.streamSimple;
  setup.scope=new AgentScope({write:[],tools:["legion_delegate_pm"]});setup.lifecycle="conversation";
  const service=await api.createPiAgentService(setup);
  try{
    service.start_run("run","Resume recorded delegation");const {request}=await event(service,"tool_request");
    assert.deepEqual(request.parameters,{payload});
    const binding={requestId:request.requestId,runId:"run",tool:request.tool};
    const pair=new PiToolResult({requestId:binding.requestId,runId:binding.runId,decision:new AgentControlDecision({...binding,allowed:true,reason:"host_checked"}),result:new AgentControlResult({...binding,status:"completed",reason:"awaiting_human",payload:{kind:"needs_human",questionRef:"host-question",status:"awaiting_human"}})});
    service.respond_tool(request,pair);const end=await event(service,"run_finished");
    assert.equal(end.result.status,"completed");assert.deepEqual(end.result.toolResults,[pair]);
    assert.equal(end.result.toolResults[0].result instanceof MutationResult,false);
  }finally{await service.close();}
});

test("public Service partial SSE cancellation restores Human-only history and sends new request",async()=>{
  const bodies=[];
  const server=createServer(async(request,reply)=>{
    const chunks=[];for await(const chunk of request)chunks.push(chunk);
    const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));bodies.push(body);
    reply.writeHead(200,{"content-type":"text/event-stream"});
    let text="Continue safely";if(bodies.length===1)text="cancelled-service-partial";
    const chunk={id:"service",object:"chat.completion.chunk",model:body.model,choices:[{index:0,delta:{role:"assistant",content:text},finish_reason:null}]};
    reply.write("data: "+JSON.stringify(chunk)+"\n\n");
    if(bodies.length===1){reply.write(": waiting\n\n");return;}
    reply.end("data: "+JSON.stringify({...chunk,choices:[{index:0,delta:{},finish_reason:"stop"}]})+"\n\ndata: [DONE]\n\n");
  });
  await new Promise(done=>server.listen(0,"127.0.0.1",done));
  const instance=new AgentInstance({instanceId:"service-Su",sessionId:"service-session",roleId:"Supervisor",taskId:"customer-project",organizationVersion:"v3",name:"Supervisor"});
  const connection=new PiConnectionProfile({profileId:"service-profile",profileVersion:"service-version",protocol:"openai-completions",provider:"service-local",model:"service-model",baseUrl:"http://127.0.0.1:"+server.address().port+"/v1"});
  let service;
  try{
    service=await api.createPiAgentService({instance,connection,credentials:{apiKey:"local-test-key"},proxy:new PiConnection({provider:connection.provider,model:connection.model}),
      scope:new AgentScope({write:[],tools:["legion_list_files","legion_read_file","legion_remember_fact","legion_query_memory","legion_request_interaction","legion_delegate_pm","legion_query_role_activity","legion_query_role_log"]}),cwd:fixtureRoot,lifecycle:"conversation"});
    const human="Cancel this turn; preserve this complete Human request";
    service.start_run("run","Host briefing\nHuman message:\n"+human);
    const partial=await event(service,"text_delta");assert.equal(partial.type,"text_delta");assert.equal(partial.delta.text,"cancelled-service-partial");
    await service.cancel_turn("run");assert.equal((await event(service,"run_cancelled")).result.status,"cancelled");
    const history=new PiConversationHistory({messages:[{role:"user",text:human}]});
    await service.restore_history(new PiConversationCheckpoint({instance,profileId:connection.profileId,profileVersion:connection.profileVersion,history}));
    service.start_run("continued","Continue");let end;
    for(;;){const e=await service.next_event("continued",{signal:AbortSignal.timeout(5000)});if(["run_finished","run_failed","run_cancelled"].includes(e.type)){end=e;break;}}
    assert.equal(end.result.status,"completed");assert.equal(bodies.length,2);
    assert.match(JSON.stringify(bodies[1]),/Cancel this turn; preserve this complete Human request/);
    assert.doesNotMatch(JSON.stringify(bodies[1]),/cancelled-service-partial|Host briefing/);
    assert.deepEqual(service.get_history().messages,[{role:"user",text:human},{role:"user",text:"Continue"},{role:"assistant",text:"Continue safely"}]);
  }finally{if(service)await service.close();server.closeAllConnections();await new Promise(done=>server.close(done));}
});

const serviceImageBytes = ["iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==", "/9j/4AAQSkZJRgABAQAASABIAAD/4QBMRXhpZgAATU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAAqADAAQAAAABAAAAAgAAAAD/7QA4UGhvdG9zaG9wIDMuMAA4QklNBAQAAAAAAAA4QklNBCUAAAAAABDUHYzZjwCyBOmACZjs+EJ+/8AAEQgAAgACAwEiAAIRAQMRAf/EAB8AAAEFAQEBAQEBAAAAAAAAAAABAgMEBQYHCAkKC//EALUQAAIBAwMCBAMFBQQEAAABfQECAwAEEQUSITFBBhNRYQcicRQygZGhCCNCscEVUtHwJDNicoIJChYXGBkaJSYnKCkqNDU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6g4SFhoeIiYqSk5SVlpeYmZqio6Slpqeoqaqys7S1tre4ubrCw8TFxsfIycrS09TV1tfY2drh4uPk5ebn6Onq8fLz9PX29/j5+v/EAB8BAAMBAQEBAQEBAQEAAAAAAAABAgMEBQYHCAkKC//EALURAAIBAgQEAwQHBQQEAAECdwABAgMRBAUhMQYSQVEHYXETIjKBCBRCkaGxwQkjM1LwFWJy0QoWJDThJfEXGBkaJicoKSo1Njc4OTpDREVGR0hJSlNUVVZXWFlaY2RlZmdoaWpzdHV2d3h5eoKDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uLj5OXm5+jp6vLz9PX29/j5+v/bAEMAAgICAgICAwICAwUDAwMFBgUFBQUGCAYGBgYGCAoICAgICAgKCgoKCgoKCgwMDAwMDA4ODg4ODw8PDw8PDw8PD//bAEMBAgICBAQEBwQEBxALCQsQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEP/dAAQAAf/aAAwDAQACEQMRAD8A+L6KKK/lM/38P//Z"];
function imageServiceSse(protocol, text, model) {
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

for(const protocol of ["openai-completions","openai-responses","anthropic-messages"]){
  test("public Service "+protocol+" forwards typed pixels and reference-only restore options",async()=>{
    const directory=mkdtempSync(resolve(fixtureRoot,"images-")),bodies=[];
    const server=createServer(async(request,reply)=>{
      const chunks=[];for await(const chunk of request)chunks.push(chunk);
      const body=JSON.parse(Buffer.concat(chunks).toString("utf8"));bodies.push(body);
      reply.writeHead(200,{"content-type":"text/event-stream"});reply.end(imageServiceSse(protocol,"Image received",body.model));
    });
    await new Promise(done=>server.listen(0,"127.0.0.1",done));
    const instance=new AgentInstance({instanceId:"image-service",sessionId:"image-service-session",roleId:"Supervisor",taskId:"customer-image",organizationVersion:"v3",name:"Supervisor"});
    const connection=new PiConnectionProfile({profileId:"image-profile",profileVersion:"image-version",protocol,provider:"image-service",model:"image-model",baseUrl:"http://127.0.0.1:"+server.address().port+"/v1",modelMetadata:{input:["text","image"]}});
    const images=serviceImageBytes.map((data,index)=>{const bytes=Buffer.from(data,"base64");let mimeType="image/png";if(index===1)mimeType="image/jpeg";
      return new PiImageInput({ref:new PiImageReference({projectId:"service_project",attachmentId:"service_"+index,sha256:createHash("sha256").update(bytes).digest("hex"),mimeType,byteLength:bytes.length,width:2,height:2}),data});});
    let service;
    try{
      service=await api.createPiAgentService({instance,connection,credentials:{apiKey:"service-test-key"},proxy:new PiConnection({provider:connection.provider,model:connection.model}),scope:new AgentScope({write:[],tools:[]}),cwd:directory,lifecycle:"conversation"});
      service.start_run("run","",{images});assert.equal((await event(service,"run_finished")).result.status,"completed");
      const history=service.get_history();assert.deepEqual(history.messages[0].imageRefs,images.map(image=>image.ref));
      await service.restore_history(new PiConversationCheckpoint({instance,profileId:connection.profileId,profileVersion:connection.profileVersion,history}),{images});
      service.start_run("continued","Refer to the original image");
      let done;for(;;){const e=await service.next_event("continued",{signal:AbortSignal.timeout(5000)});if(["run_finished","run_failed","run_cancelled"].includes(e.type)){done=e;break;}}
      assert.equal(done.result.status,"completed");assert.equal(bodies.length,2);
      for(const body of bodies){
        let messages=body.messages;if(protocol==="openai-responses")messages=body.input;
        const actual=[];
        for(const message of messages){if(message.role!=="user"||!Array.isArray(message.content))continue;
          for(const block of message.content){let data,mimeType;
            if(block.type==="image"){data=block.source.data;mimeType=block.source.media_type;}
            else if(block.type==="image_url"||block.type==="input_image"){
              let url=block.image_url;if(typeof url!=="string")url=url.url;
              const match=/^data:(image\/(?:png|jpeg));base64,(.*)$/.exec(url);assert.ok(match);mimeType=match[1];data=match[2];
            }else continue;
            actual.push({mimeType,sha256:createHash("sha256").update(Buffer.from(data,"base64")).digest("hex")});
          }
        }
        assert.deepEqual(actual,images.map(image=>({mimeType:image.ref.mimeType,sha256:image.ref.sha256})));
      }
      assert.doesNotMatch(JSON.stringify(history),/"data"|base64|service-test-key/);
    }finally{if(service)await service.close();server.closeAllConnections();await new Promise(done=>server.close(done));rmdirSync(directory);}
  });
}
