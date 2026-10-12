import { dirname as leaseParent } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectService as realCreateProjectService } from '../../src/services/public/project.mjs';
import { createOrganizationService } from '../../src/services/public/organization.mjs';
import { createCheckService } from 'legion-runtime/services/check';
import { CheckSpec, CheckRequest, CheckAuthorization, CheckDecision, ProjectFileOwners, digestValue } from 'legion-runtime/workbench-models';
const generated = fileURLToPath(new URL('../../../../.ans/runtime/legion-desktop-command-center-v1/DesktopEngineer/', import.meta.url));
await mkdir(join(generated, 'fixtures'), { recursive: true }); await mkdir(join(generated, 'user-data'), { recursive: true });
async function fixture() {
 const directory = await mkdtemp(join(generated, 'fixtures', 'acceptance-')); const root = join(directory, 'customer'); await mkdir(join(root, 'tests/Acceptance'), { recursive: true });
 await writeFile(join(root, 'src.mjs'), 'export const value = 1;'); await writeFile(join(root, 'package.json'), '{"type":"module"}');
 await writeFile(join(root, 'tests/Acceptance/check.test.mjs'), "import test from 'node:test';import assert from 'node:assert/strict';import {value} from '../../src.mjs';test('actual value',()=>assert.equal(value,1));");
 const data = await mkdtemp(join(generated, 'user-data', 'acceptance-')); const projects = createProjectService({userDataDir:data}); const raw = (await projects.select(root)).value;
 const spec = new CheckSpec({ checkId: 'unit', kind: 'node-test', argv: ['--test', 'tests/Acceptance/check.test.mjs'], testResources: ['tests/Acceptance/check.test.mjs'], inputResources: ['tests/Acceptance/check.test.mjs', 'src.mjs', 'package.json'], outputResources: [], timeoutSeconds: 10, network: 'none', logMaxBytes: 4096 });
 const ownerTask = { id: 'development', dependsOn:[], roleId: 'Builder', intent:'change', checks: [spec] }; const acceptanceTask = { id: 'acceptance', roleId: 'Acceptance', intent:'verify', checks: [spec], accepts: ['development'], dependsOn: ['development'] };
 const project = { ...raw,tasks:[{...ownerTask,results:[]},{...acceptanceTask,results:[]}], fileOwners: new ProjectFileOwners({projectId:raw.id,version:'owners-v1',owners:[{resource:'src.mjs',roleId:'Builder'}]}), plan: {schemaVersion:2,planDigest:'a'.repeat(64),tasks:[ownerTask,acceptanceTask],governance:{maxRepairRounds:2}} };
 const service = createOrganizationService({userDataDir:data}); await service.load(project); const controller = new AbortController();
 const runtime = createCheckService({...await service.checkConfiguration(project),authorizationValidator:{validate:async(request,authorization)=>({decision:new CheckDecision({allowed:!controller.signal.aborted,reason:'test_host_confirmed',requestId:request.requestId,runId:request.runId,checkId:request.checkId,authorizationDigest:authorization.digest}),authorization,signal:controller.signal})}});
 return {root,data,projects,service,controller,runtime,project,spec,ownerTask,acceptanceTask};
}
async function run(f, roleId, taskId, id) {
 const authorization = new CheckAuthorization({ authorizationId:id,confirmationId:'human-confirmation',workspaceIdentity:f.project.workspaceIdentity,planDigest:f.project.plan.planDigest,organizationVersion:f.project.organizationVersion,roleId,taskId,sessionId:roleId+'-session',instanceId:roleId+'-instance',runId:id+'-run',profileVersion:'profile-v1',fileOwnersDigest:f.project.fileOwners.digest,approvedChecks:[f.spec],inputVersions:await f.service.snapshotInputs(f.project,f.spec.inputResources)});
 const pair = await f.runtime.run(new CheckRequest({requestId:id,runId:authorization.runId,checkId:'unit'}),authorization);
 await f.service.recordCheck(f.project,id,authorization,pair.result,{projectId:f.project.id,roleId,instanceId:authorization.instanceId}); return pair;
}
async function close(f) {f.controller.abort();await f.runtime.close();await f.service.close();await f.projects.close();}

test('actual check failure cannot complete; current passing evidence becomes stale when dependency changes', async () => {
 const f = await fixture(); try {
 const first = await run(f,'Builder','development','dev-pass'); assert.equal(first.result.status,'passed',JSON.stringify(first.result)); assert.ok(first.result.testCount > 0); assert.equal(first.result.environment.isolation,'macos-seatbelt+node-events-v1+no-child-process');
 assert.equal((await f.service.currentEvidence(f.project,f.ownerTask))[0].id,'dev-pass');
 await assert.rejects(f.service.currentEvidence({...f.project,tasks:[{id:'development',runId:'next-attempt'}]},f.ownerTask),{code:'check_not_passed'});
 await writeFile(join(f.root,'src.mjs'),'export const value = 2;'); await assert.rejects(f.service.currentEvidence(f.project,f.ownerTask),{code:'check_evidence_stale'});
 const failed = await run(f,'Builder','development','dev-fail'); assert.equal(failed.result.status,'failed'); await assert.rejects(f.service.currentEvidence(f.project,f.ownerTask,['dev-pass']),{code:'check_not_passed'}); await assert.rejects(f.service.currentEvidence(f.project,f.ownerTask),{code:'check_not_passed'});
 } finally {await close(f);}
});

test('Acceptance uses its own real evidence; PM repairs only original owner/scope/checks and stops at confirmed limit', async () => {
 const f = await fixture(); try {
 await writeFile(join(f.root,'src.mjs'),'export const value = 2;'); const failure=await run(f,'Acceptance','acceptance','accept-fail'); assert.equal(failure.result.status,'failed');
 const actor={projectId:f.project.id,roleId:'Acceptance',instanceId:'Acceptance-instance'};
 const report={taskId:'acceptance',evidenceIds:['accept-fail'],decision:'fail',issues:[{taskId:'development',resource:'src.mjs',expected:'1',actual:'2',reproduction:'运行unit'}]};
 await assert.rejects(f.service.submitAcceptance(f.project,{...report,decision:'pass',issues:[]},actor),{code:'check_not_passed'});
 await assert.rejects(f.service.submitAcceptance(f.project,{...report,issues:[{...report.issues[0],resource:'other.mjs'}]},actor),{code:'acceptance_issue_owner_mismatch'});
 let state=await f.service.submitAcceptance(f.project,report,actor);let acceptance=state.acceptances.at(-1);
 const pm={projectId:f.project.id,roleId:'ProjectManager',instanceId:'pm'};
 await assert.rejects(f.service.requestRepair(f.project,{acceptanceId:acceptance.id,taskId:'development',reason:'修复'},actor),{code:'actor_forbidden'});
 state=await f.service.requestRepair(f.project,{acceptanceId:acceptance.id,taskId:'development',reason:'修正实际值'},pm); const repair=state.repairs.at(-1); assert.equal(repair.roleId,'Builder');assert.equal(Object.hasOwn(repair,'writeSet'),false);assert.equal(repair.ownerGeneration,f.project.fileOwners.version);assert.equal(digestValue(repair.checks),digestValue(f.ownerTask.checks));
 await assert.rejects(f.service.requestRepair(f.project,{acceptanceId:acceptance.id,taskId:'development',reason:'重复'},pm),{code:'repair_already_requested'});
 state=await f.service.submitAcceptance(f.project,report,actor); acceptance=state.acceptances.at(-1); await f.service.requestRepair(f.project,{acceptanceId:acceptance.id,taskId:'development',reason:'第二次'},pm);
 state=await f.service.submitAcceptance(f.project,report,actor); acceptance=state.acceptances.at(-1); await assert.rejects(f.service.requestRepair(f.project,{acceptanceId:acceptance.id,taskId:'development',reason:'第三次'},pm),{code:'repair_limit_reached'});
 await writeFile(join(f.root,'src.mjs'),'export const value = 1;');await run(f,'Builder','development','dev-repair');const passing=await run(f,'Acceptance','acceptance','accept-pass');assert.equal(passing.result.status,'passed');
 state=await f.service.submitAcceptance(f.project,{taskId:'acceptance',evidenceIds:['accept-pass'],decision:'pass',issues:[]},actor);assert.equal(state.acceptances.at(-1).decision,'pass');
 }finally{await close(f);}
});

function createProjectService(options){return realCreateProjectService({...options,leaseRoot:join(leaseParent(options.userDataDir),'isolated-project-leases')});}
