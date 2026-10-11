import test from "node:test";
import assert from "node:assert/strict";
import { ShellRequest,ShellReview,ShellAuthorization,FileBaseline,ShellResult,_createShellExecutionAuthority } from "../../src/kernel/models/shell.mjs";
import { digestValue } from "../../src/kernel/models/core.mjs";
test("shell request freezes precise command and denies hidden identity/unsafe effects",()=>{
 const request=new ShellRequest({requestId:"q",runId:"r",command:"printf test | cat",reason:"build"});
 assert.equal(request.timeoutSeconds,300);assert.equal(request.network,"none");assert.ok(Object.isFrozen(request));
 for(const extra of [{roleId:"PM"},{generatedEffects:[".ans/"]},{cwd:"../"},{timeoutSeconds:901}])assert.throws(()=>new ShellRequest({...request,...extra}));
 assert.notEqual(request.digest,new ShellRequest({...request,command:"printf changed"}).digest);
});
test("present and absent baseline are distinct and missing content cannot fake absence",()=>{
 assert.throws(()=>new FileBaseline({resource:"a",state:"absent",sha256:"a".repeat(64)}));
 assert.throws(()=>new FileBaseline({resource:"nested/.env",state:"absent"}));
 const file=new FileBaseline({resource:"a",state:"absent"});assert.equal(file.sha256,null);assert.equal(file.byteLength,0);
});
test("model construction does not create an execution permit; opaque one-use binding rejects replay",()=>{
 const request=new ShellRequest({requestId:"q",runId:"r",command:"true",reason:"test"});
 const review=new ShellReview({requestId:"q",requestDigest:request.digest,revision:1,approved:true,reason:"exact"});
 const auth=new ShellAuthorization({authorizationId:"a",projectId:"p",prepareId:"p",organizationVersion:"v",roleId:"K",taskId:"t",sessionId:"s",instanceId:"i",runId:"r",profileVersion:"pv",expiresAt:new Date(Date.now()+60000).toISOString(),requestDigest:request.digest,reviewDigest:review.digest,planDigest:"a".repeat(64),contextSnapshotDigest:"b".repeat(64),fileOwners:{projectId:"p",version:"v1",owners:[]},fileOwnersDigest:digestValue({projectId:"p",version:"v1",owners:[]}),artifactScopes:[],snapshotDigest:digestValue([]),generationDigest:digestValue([]),workspaceIdentity:{canonicalPath:"/project",deviceId:"1",fileId:"2"},inputVersions:[],ownerGeneration:"v1",generatedEffects:[]});
 const authority=_createShellExecutionAuthority(),signal=new AbortController().signal;
 assert.throws(()=>authority.consume(request,auth,Object.freeze({}),Date.now()));
 const permit=authority.issue(request,auth,review,signal,Date.now());authority.consume(request,auth,permit,Date.now());assert.throws(()=>authority.consume(request,auth,permit,Date.now()));assert.throws(()=>authority.issue(request,auth,review,signal,Date.now()));
 assert.ok(!JSON.stringify(auth).includes("token"));
});
test("Shell exit zero cannot manufacture Check evidence or ready without real execution",()=>{
 assert.throws(()=>new ShellResult({requestId:"q",runId:"r",requestDigest:"a".repeat(64),status:"ready_for_publication",reason:"fake",executed:false,exitCode:null,logsTruncated:false,generationDigest:digestValue([]),startedAt:"now",finishedAt:"now"}));
});

test("new SDK requests cannot self-bind identity; review uses exact immutable digest and revision",async()=>{
 const {PiToolRequest,AgentControlDecision,AgentControlResult,PiToolResult}=await import("../../src/kernel/models/agent.mjs");const request=new PiToolRequest({requestId:"host",runId:"run",toolCallId:"call",tool:"legion_request_shell",parameters:{command:"npm run build",reason:"compile"}});assert.equal(request.parameters.cwd,"");assert.throws(()=>new PiToolRequest({...request,parameters:{...request.parameters,roleId:"PM"}}));
 const review=new PiToolRequest({requestId:"review-tool",runId:"pm-run",toolCallId:"review",tool:"legion_review_shell",parameters:{requestId:"host",requestDigest:"a".repeat(64),revision:1,approved:false,reason:"scope"}});assert.equal(review.parameters.approved,false);
 const decision=new AgentControlDecision({allowed:true,reason:"saved",requestId:review.requestId,runId:review.runId,tool:review.tool});const result=new AgentControlResult({requestId:review.requestId,runId:review.runId,tool:review.tool,status:"completed",reason:"saved",payload:{reviewedRequestId:"host"}});assert.ok(new PiToolResult({requestId:review.requestId,runId:review.runId,decision,result}));
});

test("explicit generated artifact cannot disguise another owner's source or unowned authored inventory",()=>{
 const request=new ShellRequest({requestId:"q",runId:"r",command:"echo attack > src/foreign.mjs",reason:"attempt",generatedEffects:["src/"]});const review=new ShellReview({requestId:"q",requestDigest:request.digest,revision:1,approved:true,reason:"pure approval is insufficient"});const owners={projectId:"p",version:"v1",owners:[{resource:"src/foreign.mjs",roleId:"Other"}]};
 const value={authorizationId:"a",projectId:"p",prepareId:"p",organizationVersion:"v",roleId:"K",taskId:"t",sessionId:"s",instanceId:"i",runId:"r",profileVersion:"pv",expiresAt:new Date(Date.now()+60000).toISOString(),requestDigest:request.digest,reviewDigest:review.digest,planDigest:"a".repeat(64),contextSnapshotDigest:"b".repeat(64),fileOwnersDigest:digestValue(owners),fileOwners:owners,authoredResources:["src/foreign.mjs"],artifactScopes:[{scope:"src/",kind:"build"}],snapshotDigest:digestValue([]),generationDigest:digestValue([]),workspaceIdentity:{canonicalPath:"/project",deviceId:"1",fileId:"2"},inputVersions:[],ownerGeneration:"v1",generatedEffects:["src/"]};assert.throws(()=>new ShellAuthorization(value),/generated_effect_overlaps_authored_source/);
 const empty={projectId:"p",version:"v1",owners:[]};assert.throws(()=>new ShellAuthorization({...value,fileOwners:empty,fileOwnersDigest:digestValue(empty),authoredResources:["src/unowned.mjs"]}),/generated_effect_overlaps_authored_source/);assert.throws(()=>new ShellAuthorization({...value,fileOwners:empty,fileOwnersDigest:digestValue(empty),authoredResources:undefined}),/complete_authored_inventory_required/);
});

test("binary publication is Host-only canonical bytes with strict text exclusivity and SHA",async()=>{
 const {ActionProposal,AgentSession}=await import("../../src/kernel/models/core.mjs");const {createHash}=await import("node:crypto");const session=new AgentSession({sessionId:"s",roleId:"K",taskId:"t",organizationVersion:"v"});const bytes=Buffer.from([255,0,128,89]);const options={proposalId:"p",action:"write_file",resource:"asset.png",tool:"legion_shell_publish",capability:"request_shell",session,runId:"r",expectedBaseline:{resource:"asset.png",state:"absent",sha256:null,byteLength:0},executable:false,contentBase64:bytes.toString("base64")};const proposal=new ActionProposal(options);assert.equal(proposal.contentDigest,createHash("sha256").update(bytes).digest("hex"));assert.equal(proposal.contentByteLength,4);
 for(const extra of [{content:""},{content:"text"},{contentBase64:"/wCAWQ"},{contentBase64:"%%%"},{tool:"legion_write_file",capability:"write_file"},{action:"edit_file"}])assert.throws(()=>new ActionProposal({...options,...extra}));
});

function timeFixture() {
 const observedAtMs=1700000000000,request=new ShellRequest({requestId:"time",runId:"r",command:"true",reason:"fixture"});const review=new ShellReview({requestId:request.requestId,requestDigest:request.digest,revision:1,approved:true,reason:"exact"});const owners={projectId:"p",version:"v1",owners:[]};
 const authorization=new ShellAuthorization({authorizationId:"time",projectId:"p",prepareId:"p",organizationVersion:"v",roleId:"K",taskId:"t",sessionId:"s",instanceId:"i",runId:"r",profileVersion:"pv",expiresAt:new Date(observedAtMs+1000).toISOString(),requestDigest:request.digest,reviewDigest:review.digest,planDigest:"a".repeat(64),contextSnapshotDigest:"b".repeat(64),fileOwnersDigest:digestValue(owners),fileOwners:owners,artifactScopes:[],snapshotDigest:digestValue([]),generationDigest:digestValue([]),workspaceIdentity:{canonicalPath:"/project",deviceId:"1",fileId:"2"},inputVersions:[],ownerGeneration:"v1",generatedEffects:[]});return {observedAtMs,request,review,authorization,signal:new AbortController().signal};
}
test("pure execution Model uses supplied time and rejects invalid facts/expiry without reading live clock",t=>{
 const f=timeFixture();t.mock.method(Date,"now",()=>{throw new Error("Model attempted clock effect");});const authority=_createShellExecutionAuthority();
 for(const fact of [undefined,NaN,Infinity,-1,1.5])assert.throws(()=>authority.issue(f.request,f.authorization,f.review,f.signal,fact),/valid_observed_time_fact_required/);
 assert.throws(()=>authority.issue(f.request,f.authorization,f.review,f.signal,f.observedAtMs+1000),/invalid_shell_binding/);
 const permit=authority.issue(f.request,f.authorization,f.review,f.signal,f.observedAtMs);assert.throws(()=>authority.consume(f.request,f.authorization,permit,f.observedAtMs+1000),/invalid_or_replayed_shell_permit/);assert.throws(()=>authority.consume(f.request,f.authorization,permit,f.observedAtMs),/invalid_or_replayed_shell_permit/);
 const second=_createShellExecutionAuthority(),bad=second.issue(f.request,f.authorization,f.review,f.signal,f.observedAtMs);assert.throws(()=>second.consume(f.request,f.authorization,bad,NaN),/valid_observed_time_fact_required/);assert.throws(()=>second.consume(f.request,f.authorization,bad,f.observedAtMs),/invalid_or_replayed_shell_permit/);
});
