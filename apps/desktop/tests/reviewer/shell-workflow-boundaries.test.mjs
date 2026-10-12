/** Independent finite Host ledger/structure checks; no SDK request, OS command or GUI. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ShellRequest, ShellReview, AgentInstance, AgentScope, PiConnection, PiConnectionProfile } from 'legion-runtime/workbench-models';
import { createPiAgentService } from 'legion-runtime/services/pi-agent';
import { createProjectService } from '../../src/services/public/project.mjs';
import { createOrganizationService } from '../../src/services/public/organization.mjs';
import { governedWireDTO } from '../../src/models/workbench.mjs';
import { createShellWorkflow, enqueueShellWorkflow, updateShellWorkflow, interruptShellWorkflow,
  shellWorkflowDocument, publicShellWorkflow } from '../../src/models/interaction.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
const stage=join(root,'.ans/runtime/legion-desktop-command-center-v1/Reviewer/fixtures');
const hash='a'.repeat(64), now=()=>new Date().toISOString();
async function directory(t){
  await fs.mkdir(stage,{recursive:true});
  const path=await fs.mkdtemp(join(stage,'shell-contract-'));
  t.after(async()=>{
    assert.ok(relative(stage,path).startsWith('shell-contract-') && !relative(stage,path).includes(sep));
    async function guard(current){const metadata=await fs.lstat(current);assert.ok(!metadata.isSymbolicLink());
      if(metadata.isDirectory())for(const item of await fs.readdir(current))await guard(join(current,item));}
    await guard(path);await fs.rm(path,{recursive:true});
  });return path;
}
function entry(projectId=hash, changes={}){
  const request=new ShellRequest({requestId:'shell-request',runId:'run',command:'printf fixture',reason:'Exact fixture'});
  return {id:request.requestId,revision:1,request,requestDigest:request.digest,
    origin:{projectId,roleId:'Worker',taskId:'task',sessionId:'session',instanceId:'worker',runId:'run'},
    bindings:{planDigest:hash,organizationDigest:hash,organizationVersion:'v1',roleDigest:hash,
      roleRevision:1,profileVersion:hash,contextSnapshotDigest:hash,fileOwnersDigest:hash,epoch:0},
    preparation:null,status:'pending',review:null,reviewer:null,reviewText:'',
    output:{stdout:'',stderr:'',truncated:false},result:null,publication:null,
    createdAt:now(),expiresAt:new Date(Date.now()+60000).toISOString(),updatedAt:now(),...changes};
}
const reviewer={instanceId:'pm-review',sessionId:'pm-session',runId:'pm-run',profileVersion:hash};
const approval=(value)=>new ShellReview({requestId:value.id,requestDigest:value.requestDigest,
  revision:value.revision,approved:true,reason:'Exact independent fixture'});

test('Shell journal cannot revive consumed/interrupted grants and public facts exclude Host bindings',()=>{
  const value=entry(); let journal=enqueueShellWorkflow(createShellWorkflow(hash),value);
  assert.throws(()=>enqueueShellWorkflow(journal,value),/duplicate_shell_request/u);
  assert.throws(()=>enqueueShellWorkflow(createShellWorkflow('b'.repeat(64)),value),/actor_forbidden/u);
  journal=updateShellWorkflow(journal,value.id,{status:'reviewing',updatedAt:now()});
  journal=updateShellWorkflow(journal,value.id,{status:'approved',review:approval(value),reviewer,updatedAt:now()});
  journal=updateShellWorkflow(journal,value.id,{status:'consumed',updatedAt:now()});
  assert.throws(()=>updateShellWorkflow(journal,value.id,{status:'approved'}),/invalid_shell_phase/u);
  const restored=interruptShellWorkflow(shellWorkflowDocument(JSON.parse(JSON.stringify(journal))),now());
  assert.equal(restored.requests[0].status,'interrupted');
  assert.throws(()=>updateShellWorkflow(restored,value.id,{status:'approved'}),/invalid_shell_phase/u);
  const facts=publicShellWorkflow(restored)[0];
  assert.equal(facts.roleId,'Worker');assert.equal(facts.runId,'run');
  for(const field of ['bindings','preparation','publication','authorization','receipt','permit'])assert.ok(!(field in facts));
  assert.throws(()=>shellWorkflowDocument({...journal,requests:[{...journal.requests[0],receipt:{}}],digest:undefined}),
    (error)=>error.name==='DesktopValidationError' && error.code==='invalid_input');
});

test('real public SDK factory rejects non-PM review capability before creating a model run',async(t)=>{
  const cwd=await directory(t);
  await assert.rejects(createPiAgentService({instance:new AgentInstance({instanceId:'worker',sessionId:'session',
    roleId:'Worker',name:'Worker',taskId:'task',organizationVersion:'v1'}),
    proxy:new PiConnection({provider:'review-local',model:'fixture'}),
    scope:new AgentScope({write:[],tools:['legion_review_shell']}),cwd,lifecycle:'single_run',
    connection:new PiConnectionProfile({profileId:'profile',profileVersion:'v1',protocol:'openai-completions',
      provider:'review-local',model:'fixture',baseUrl:'http://127.0.0.1:1/v1'}),credentials:{apiKey:'fixture-only'}}),
    /shell_review_requires_project_manager/u);
});

test('real persisted Host ledger enforces PM exact review, requester identity and one CAS claim',async(t)=>{
  const path=await directory(t),data=join(path,'user-data'),workspace=join(path,'workspace');
  await fs.mkdir(data);await fs.mkdir(workspace);
  const projects=createProjectService({userDataDir:data,leaseRoot:join(path,'leases')}),organizations=createOrganizationService({userDataDir:data});
  t.after(async()=>{await organizations.close();await projects.close();});
  const selected=await projects.select(workspace);assert.equal(selected.ok,true);
  const project=(await projects.catalog()).value.projects.find((item)=>item.workspaceIdentity.canonicalPath===workspace);
  assert.ok(project);let state=await organizations.load(project);
  state=await organizations.submitProposal(project,{id:'roles',version:1,members:[{id:'Worker',name:'Worker',
    purpose:'Own fixture only',boundary:['a.txt'],interfaces:[],documents:[],revision:1,enabled:true,status:'approved'}]},
    {projectId:project.id,roleId:'RoleArchitect',instanceId:'architect'});
  const proposal=state.ledger.proposals.at(-1);
  state=await organizations.reviewProposal(project,{proposalId:proposal.id,version:proposal.version,digest:proposal.digest,
    organizationRevision:state.organization.revision,organizationDigest:state.organization.digest,decision:'approve',reason:'Fixture'},
    {projectId:project.id,roleId:'ProjectManager',instanceId:'pm'});
  const member=state.organization.members.find((item)=>item.id==='Worker');
  const value=entry(project.id);value.bindings={...value.bindings,roleDigest:member.digest,roleRevision:member.revision,
    organizationDigest:state.organization.digest};
  const actor={projectId:project.id,roleId:'Worker',instanceId:'worker'},pm={projectId:project.id,roleId:'ProjectManager',instanceId:reviewer.instanceId};
  await organizations.enqueueShell(project,value,actor);
  await organizations.shellPhase(project,value.id,{status:'reviewing',updatedAt:now()},actor);
  await assert.rejects(async()=>organizations.reviewShell(project,value.id,approval(value),reviewer,actor),/actor_forbidden/u);
  await assert.rejects(async()=>organizations.reviewShell(project,value.id,new ShellReview({...approval(value),revision:2}),reviewer,pm),/stale_shell_review/u);
  await organizations.reviewShell(project,value.id,approval(value),reviewer,pm);
  await assert.rejects(async()=>organizations.claimShell(project,value.id,{...actor,instanceId:'other'}),/actor_forbidden/u);
  const claims=await Promise.allSettled([organizations.claimShell(project,value.id,actor),organizations.claimShell(project,value.id,actor)]);
  assert.equal(claims.filter((result)=>result.status==='fulfilled').length,1);
  const rejected=claims.find((result)=>result.status==='rejected');assert.match(rejected.reason.code??rejected.reason.message,/invalid_or_replayed_shell/u);
  await organizations.interruptShell(project);
  await assert.rejects(async()=>organizations.claimShell(project,value.id,actor),/invalid_or_replayed_shell/u);
  assert.equal((await organizations.load(project)).shellWorkflow.requests[0].status,'interrupted');
  const wireInput=(input)=>governedWireDTO({organization:state.organization,evidence:[{
    id:'evidence',roleId:'Worker',taskId:'task',planDigest:hash,result:{checkId:'check',status:'passed',
      reason:'Finite wire fixture',executed:true,testCount:1,exitCode:0,inputVersions:[input],stdout:'',stderr:'',
      startedAt:now(),finishedAt:now(),logsTruncated:false,environment:null}}]}).evidence[0].result.inputVersions[0];
  const absent={resource:'old.bin',state:'absent',sha256:null,byteLength:0};
  assert.deepEqual(wireInput(absent),absent);
  const present={resource:'old.bin',state:'present',sha256:hash,byteLength:3,executable:false};
  assert.deepEqual(wireInput(present),present);
  for(const input of [{...absent,sha256:hash},{...absent,byteLength:1},{...absent,executable:false},
    {...absent,state:'missing'},{...absent,state:undefined},{...absent,authorization:{}},
    {...present,sha256:null},{...present,byteLength:-1}]) assert.throws(()=>wireInput(input));
});

test('Host Shell review uses an independent PM queue; exact source inventory publishes only through Mutation',async()=>{
  const pipeline=await fs.readFile(join(root,'apps/desktop/src/pipelines/workbench.mjs'),'utf8');
  const queue=pipeline.slice(pipeline.indexOf('  #queueShellReview('),pipeline.indexOf('  async #reviewShell('));
  assert.match(queue,/this\.#shellReviewTail\.then\(\(\) => this\.#reviewShell\(operation\)\)/u);
  assert.doesNotMatch(queue,/this\.#tail|#enqueue|#endManager/u);
  const review=pipeline.slice(pipeline.indexOf('  async #reviewShell('),pipeline.indexOf('  async #requestShell('));
  assert.match(review,/roleId: 'ProjectManager', taskId: 'shell-review'/u);
  assert.match(review,/new AgentScope\(\{ write: \[\], tools: \['legion_review_shell'\] \}\)/u);
  assert.match(review,/event\.request\.tool !== 'legion_review_shell' \|\| review/u);
  assert.match(review,/value\.requestId !== request\.requestId \|\| value\.requestDigest !== request\.digest \|\| value\.revision !== 1/u);
  assert.doesNotMatch(review,/#endManager\(|#ensureManager\(/u);
  assert.match(pipeline,/from 'legion-runtime\/services\/shell'/u);
  assert.doesNotMatch(pipeline,/from ['"][^'"]*(?:providers\/(?:public|impl)\/shell|models\/shell|_registerShellPublication)/u);
  assert.match(pipeline,/inventory\.allFiles\.map\(\(item\) => item\.resource\)/u);
  assert.match(pipeline,/\.\.\.active\.fileOwners\.owners\.map\(\(item\) => item\.resource\)/u);
  assert.match(pipeline,/binding\.mutation\.execute\(proposal, binding\.controller\.issueShellPublication\(proposal, receipt, service\.observeTime\(\)\)\)/u);
  assert.match(pipeline,/expectedBaseline: candidate\.baseline/u);
});

test('partial recovery requires new Human plan, actual task checks and current generation; old records remain',async()=>{
  const service=await fs.readFile(join(root,'apps/desktop/src/services/impl/organization.mjs'),'utf8');
  const recovery=service.slice(service.indexOf('  async completeShellRecovery('),service.indexOf('  async shellRecoveryInputs('));
  assert.match(recovery,/project\.plan\?\.status !== 'completed' \|\| !recoveryAuthorized/u);
  assert.match(recovery,/await this\.currentEvidence\(project, task\)/u);
  assert.match(recovery,/item\.digest === current/u);
  assert.match(recovery,/result\.contentDigest !== input\.sha256/u);
  assert.match(recovery,/if \(!recoveryAuthorized\(actual, project, recovery\)\)/u);
  assert.match(recovery,/status: 'recovered', recovery: \{ planDigest: project\.plan\.planDigest/u);
  assert.match(recovery,/await this\.verifyRetainedRecoveryOutputs\(project, project\.plan\.tasks\.find\(\(item\) => item\.id === task\.id\), task\.retainedOutputs\)/u);
  assert.ok(recovery.indexOf('await this.verifyRetainedRecoveryOutputs(')<recovery.indexOf('return this.#mutate('));
  assert.match(recovery,/retainedOutputs: project\.tasks\.flatMap\(task=>task\.retainedOutputs\?\?\[\]\)\.filter\(fact=>fact\.sourceRequestId===entry\.id\)/u);
  assert.doesNotMatch(recovery,/unlink|\.rm\(|withdraw|result:.*status: 'published'/u);
  const retained=service.slice(service.indexOf('function retainedPublication('),service.indexOf('function planArtifactScopes('));
  assert.match(retained,/result\.success&&result\.observedMutation&&!result\.auditFailed/u);
  assert.match(retained,/project\.fileOwners\.ownerOf\(candidate\.resource\)!==task\.roleId/u);
  assert.match(retained,/baseline\.sha256!==candidate\.sha256 \|\| baseline\.byteLength!==candidate\.byteLength \|\| baseline\.executable!==candidate\.executable/u);
  assert.match(retained,/!result\.tombstone \|\| result\.tombstone\.priorSha256!==candidate\.baseline\.sha256/u);
  const verify=service.slice(service.indexOf('  async verifyRetainedRecoveryOutputs('),service.indexOf('  shellPhase('));
  assert.match(verify,/fact\.humanRequestId!==human\.requestId \|\| fact\.humanRequestDigest!==human\.digest/u);
  assert.match(verify,/digestValue\(fact\.baseline\)!==digestValue\(baseline\)/u);
  assert.match(verify,/result\.proposalDigest!==fact\.sourceProposalDigest/u);
  const authorized=service.slice(service.indexOf('function recoveryAuthorized('));
  assert.match(authorized,/request\.purpose === 'execute_plan' && request\.status === 'answered' && request\.answer\?\.value === true/u);
  assert.match(authorized,/entry\.bindings\.planDigest !== project\.plan\.planDigest/u);
  assert.match(authorized,/task\.roleId === entry\.origin\.roleId && task\.id===entry\.origin\.taskId && project\.fileOwners\.ownerOf\(candidate\.resource\)===task\.roleId/u);
  assert.match(authorized,/entry\.request\.generatedEffects\.every/u);
});
