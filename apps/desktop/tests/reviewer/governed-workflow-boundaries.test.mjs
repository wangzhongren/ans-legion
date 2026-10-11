/** Independent public-boundary checks for the customer approved governed workflow. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectService } from '../../src/services/public/project.mjs';
import { createOrganizationService } from '../../src/services/public/organization.mjs';
import { createWorkbenchPipeline } from '../../src/pipelines/workbench.mjs';
import { FIXED_ROLE_DUTIES, createOrganization, createRoleProposal, reviewRoleProposal,
  approvedRoleDocument, migrateLegacyOrganization } from '../../src/models/organization.mjs';
import { createInteraction, answerInteraction, closeInteraction, invalidateInteraction,
  createInteractionQueue, enqueueInteraction, restoreInteractionQueue } from '../../src/models/interaction.mjs';
import { taskState, workbenchInput, governedDTO } from '../../src/models/workbench.mjs';
import { CheckSpec, CheckRequest, CheckAuthorization, CheckDecision, ProjectFileOwners,
  PiToolRequest, digestValue } from 'legion-runtime/workbench-models';
import { createCheckService } from 'legion-runtime/services/check';
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const generated = join(projectRoot, '.ans/runtime/legion-cli-role-owned-v2/Reviewer');
const projectId = 'a'.repeat(64);
const actor = (roleId, id = roleId) => ({ projectId, roleId, instanceId: id });
function definition(id, boundary, revision = 1) {
  return { id, name: id, purpose: FIXED_ROLE_DUTIES[id] ?? 'Own exact output', interfaces: [],
    boundary, documents: [], revision, enabled: true, status: 'approved' };
}
function reviewed(base, members) {
  const proposal = createRoleProposal(base, { id: 'roles', version: 1, members }, actor('RoleArchitect'));
  return reviewRoleProposal(base, proposal, { proposalId: proposal.id, version: proposal.version, digest: proposal.digest,
    organizationRevision: base.revision, organizationDigest: base.digest, decision: 'approve', reason: '' }, actor('ProjectManager'));
}
async function fixture(t) {
  await fs.mkdir(join(generated, 'fixtures'), { recursive: true }); await fs.mkdir(join(generated, 'user-data'), { recursive: true });
  const directory = await fs.mkdtemp(join(generated, 'fixtures', 'review-governed-'));
  const root = join(directory, 'customer'); const data = await fs.mkdtemp(join(generated, 'user-data', 'review-governed-'));
  await fs.mkdir(join(root, 'tests/Acceptance'), { recursive: true }); await fs.mkdir(join(root, '.ans/private'), { recursive: true });
  await fs.writeFile(join(root, 'value.mjs'), 'export const value = 1;'); await fs.writeFile(join(root, 'package.json'), '{"type":"module"}');
  await fs.writeFile(join(root, '.ans/private/secret'), 'review-private-control');
  await fs.writeFile(join(root, 'tests/Acceptance/value.test.mjs'), "import test from 'node:test';import assert from 'node:assert/strict';import {value} from '../../value.mjs';test('value matches acceptance',()=>assert.equal(value,1));");
  const projects = createProjectService({ userDataDir: data, leaseRoot:join(directory,'leases') }); const selected = await projects.select(root); assert.equal(selected.ok, true);
  const raw = selected.value; const spec = new CheckSpec({ checkId: 'unit', kind: 'node-test', argv: ['--test', 'tests/Acceptance/value.test.mjs'],
    testResources: ['tests/Acceptance/value.test.mjs'], inputResources: ['tests/Acceptance/value.test.mjs', 'value.mjs', 'package.json'],
    outputResources: [], timeoutSeconds: 10, network: 'none', logMaxBytes: 8192 });
  const developer = { id: 'development', roleId: 'Builder', dependsOn: [], intent:'change', checks: [spec] };
  const acceptance = { id: 'acceptance', roleId: 'Acceptance', dependsOn: ['development'], intent:'verify', checks: [spec], accepts: ['development'] };
  const project = { ...raw, tasks:[{...developer,runId:null,results:[]},{...acceptance,runId:null,results:[]}], fileOwners: new ProjectFileOwners({ projectId: raw.id, version: '1', owners: [{ resource: 'value.mjs', roleId: 'Builder' }] }),
    plan: { schemaVersion:2, planDigest: 'b'.repeat(64), tasks: [developer, acceptance], governance: { maxRepairRounds: 2 } } };
  const organizations = createOrganizationService({ userDataDir: data }); await organizations.load(project);
  const live = new AbortController(); let allowed = true;
  const checks = createCheckService({ ...await organizations.checkConfiguration(project), authorizationValidator: { validate: async (request, authorization) => ({
    decision: new CheckDecision({ allowed: allowed && !live.signal.aborted, reason: 'review_host_validation', requestId: request.requestId, runId: request.runId, checkId: request.checkId, authorizationDigest: authorization.digest }),
    authorization, signal: live.signal }) } });
  t.after(async () => { live.abort(); await checks.close(); await organizations.close(); await projects.close(); });
  return { root, data, project, organizations, checks, live, developer, acceptance, spec, setAllowed(value) { allowed = value; } };
}
async function run(f, roleId, taskId, id, spec = f.spec) {
  const authorization = new CheckAuthorization({ authorizationId: id, confirmationId: 'confirmed-human', workspaceIdentity: f.project.workspaceIdentity,
    planDigest: f.project.plan.planDigest, organizationVersion: f.project.organizationVersion, roleId, taskId, sessionId: roleId + '-session', instanceId: roleId + '-instance',
    runId: id + '-run', profileVersion: 'connection-v1', fileOwnersDigest: f.project.fileOwners.digest, approvedChecks: [spec], inputVersions: await f.organizations.snapshotInputs(f.project, spec.inputResources) });
  const pair = await f.checks.run(new CheckRequest({ requestId: id, runId: authorization.runId, checkId: spec.checkId }), authorization);
  await f.organizations.recordCheck(f.project, id, authorization, pair.result, { projectId: f.project.id, roleId, instanceId: authorization.instanceId });
  return pair;
}

test('fixed duties and exact actor fields reject architect/Acceptance business scope and payload identities', () => {
  const base = createOrganization(projectId);
  for (const [id, boundary, code] of [['ProjectManager', ['src/a.mjs'], 'manager_business_write'], ['RoleArchitect', ['src/a.mjs'], 'architect_business_write'], ['Acceptance', ['src/a.mjs'], 'acceptance_business_write']]) {
    assert.throws(() => createRoleProposal(base, { id: 'invalid', version: 1, members: [definition(id, boundary, 2)] }, actor('RoleArchitect')), { code });
  }
  assert.throws(() => createRoleProposal(base, { id: 'invalid', version: 1, members: [definition('Builder', ['value.mjs'])] }, actor('ProjectManager')), { code: 'actor_forbidden' });
  for (const tool of ['legion_design_roles', 'legion_propose_roles', 'legion_review_roles', 'legion_request_interaction', 'legion_submit_acceptance', 'legion_request_repair']) {
    assert.equal(new PiToolRequest({ requestId: 'valid', runId: 'run', toolCallId: 'sdk-call', tool, parameters: { payload: {} } }).tool, tool);
    assert.throws(() => new PiToolRequest({ requestId: 'r', runId: 'run', toolCallId: 'sdk-call', tool, parameters: { payload: {}, roleId: 'ProjectManager' } }), TypeError);
  }
  assert.throws(() => new PiToolRequest({ requestId: 'r', runId: 'run', toolCallId: 'sdk-call', tool: 'legion_run_check', parameters: { checkId: 'unit', command: 'node test.mjs', actor: 'Acceptance' } }), TypeError);
  assert.equal(workbenchInput('answerInteraction', { projectId, requestId: 'r', version: 1, requestDigest: 'c'.repeat(64), value: true, actor: 'Human' }).ok, false);
});

test('PM reviews exact proposal; publication uses current approved bytes; members persist across proposals', () => {
  const base = createOrganization(projectId); const member = definition('Builder', ['value.mjs']);
  member.documents = [{ resource: 'docs/roles/Builder/boundary.md', contentDigest: 'c'.repeat(64), summary: 'exact scope' }];
  const proposal = createRoleProposal(base, { id: 'roles', version: 1, members: [member] }, actor('RoleArchitect'));
  const input = { proposalId: proposal.id, version: 1, digest: proposal.digest, organizationRevision: 0, organizationDigest: base.digest, decision: 'approve', reason: '' };
  assert.throws(() => reviewRoleProposal(base, proposal, { ...input, digest: 'd'.repeat(64) }, actor('ProjectManager')), { code: 'stale_proposal' });
  assert.throws(() => reviewRoleProposal(base, proposal, input, actor('RoleArchitect')), { code: 'actor_forbidden' });
  const result = reviewRoleProposal(base, proposal, input, actor('ProjectManager'));
  assert.throws(() => reviewRoleProposal(result.organization, result.proposal, input, actor('ProjectManager')), { code: 'proposal_already_reviewed' });
  const publish = { proposalId: proposal.id, version: 1, digest: proposal.digest, resource: member.documents[0].resource, contentDigest: member.documents[0].contentDigest };
  assert.equal(approvedRoleDocument(result.organization, result.proposal, publish, actor('RoleArchitect')).resource, publish.resource);
  assert.throws(() => approvedRoleDocument(result.organization, result.proposal, { ...publish, contentDigest: 'e'.repeat(64) }, actor('RoleArchitect')), { code: 'document_not_approved' });
  const later = reviewed(result.organization, [definition('Other', ['other.mjs'])]).organization;
  assert.equal(later.members.find((item) => item.id === 'Builder').digest, result.organization.members.find((item) => item.id === 'Builder').digest);
  assert.equal(later.fileOwners.find((item) => item.resource === 'value.mjs').roleId, 'Builder');
});

test('legacy observation preserves IDs and owner without inventing approval or software pass', () => {
  const legacy = migrateLegacyOrganization(projectId, { members: [{ id: 'Builder', name: 'Builder' }], fileOwners: [{ resource: 'value.mjs', roleId: 'Builder' }] });
  assert.equal(legacy.status, 'legacy'); assert.equal(legacy.members.find((item) => item.id === 'Builder').status, 'legacy');
  assert.equal(legacy.members.find((item) => item.id === 'Builder').revision, 0);
  const observed = taskState({ id: 'old', title: 'old', roleId: 'Builder', dependsOn: [], intent:'change', status: 'completed', checkStatus: 'not_executed' });
  assert.equal(observed.checkStatus, 'not_executed'); assert.notEqual(observed.acceptanceStatus, 'pass');
  assert.throws(() => taskState({ ...observed, checkStatus: 'model_says_passed' }), /invalid_input/);
});

test('interaction nonce binds project/version/context; close and restore keep unanswered request; replay cannot change answer', () => {
  const origin = { roleId: 'ProjectManager', instanceId: 'pm', runId: 'run', toolRequestId: 'tool' };
  for (const [kind, value, options] of [['confirmation', false, []], ['question', 'Actual human response', []], ['choice', { optionId: 'a', text: '' }, [{ id: 'a', label: 'A' }]]]) {
    const bindings = { organizationRevision: 1, organizationDigest: 'b'.repeat(64), contextDigest: 'c'.repeat(64) };
    const request = createInteraction({ requestId: 'request-' + kind, projectId, version: 1, kind, purpose: 'discussion', title: 'Answer', text: 'Human answer required', options,
      allowSupplement: false, bindings, createdOrder: 1, createdAt: '2026-10-08T09:00:00.000Z' }, origin);
    assert.equal(closeInteraction(request).status, 'pending');
    const restored = restoreInteractionQueue(enqueueInteraction(createInteractionQueue(projectId), request));
    assert.equal(restored.queue.requests[0].status, 'pending'); assert.equal(restored.resumeToolResponses, false);
    const input = { requestId: request.requestId, projectId, version: 1, requestDigest: request.digest, answerId: 'answer', answeredAt: '2026-10-08T09:01:00.000Z', value };
    assert.throws(() => answerInteraction(request, { ...input, requestDigest: 'd'.repeat(64) }, { projectId, roleId: 'Human' }, bindings), { code: 'stale_interaction' });
    assert.throws(() => answerInteraction(request, input, { projectId, roleId: 'ProjectManager' }, bindings), { code: 'answer_actor_forbidden' });
    assert.throws(() => answerInteraction(request, input, { projectId, roleId: 'Human' }, { ...bindings, contextDigest: 'e'.repeat(64) }), { code: 'stale_interaction' });
    const answered = answerInteraction(request, input, { projectId, roleId: 'Human' }, bindings);
    assert.equal(answerInteraction(answered, input, { projectId, roleId: 'Human' }, bindings).status, answered.status);
    assert.throws(() => answerInteraction(answered, { ...input, answerId: 'replay' }, { projectId, roleId: 'Human' }, bindings), { code: 'interaction_already_answered' });
    assert.throws(() => answerInteraction(invalidateInteraction(request, 'cancelled'), input, { projectId, roleId: 'Human' }, bindings), { code: 'interaction_invalidated' });
  }
});

test('persistent organization validates approval, exact boundaries, independent acceptance and check input coverage', async (t) => {
  const f = await fixture(t); const service = f.organizations; const pm = { projectId: f.project.id, roleId: 'ProjectManager', instanceId: 'pm' };
  const architect = { projectId: f.project.id, roleId: 'RoleArchitect', instanceId: 'architect' };
  // This fixture begins as a legacy observed project because it already has a persisted owner.
  let state = await service.load(f.project);
  const candidates = [definition('Builder', ['value.mjs'], 1), definition('Acceptance', [], 1)];
  state = await service.submitProposal(f.project, { id: 'review-roles', version: 1, members: candidates }, architect);
  const proposal = state.ledger.proposals.at(-1);
  state = await service.reviewProposal(f.project, { proposalId: proposal.id, version: 1, digest: proposal.digest, organizationRevision: state.organization.revision,
    organizationDigest: state.organization.digest, decision: 'approve', reason: '' }, pm);
  const roles = state.organization.members.filter((item) => ['Builder', 'Acceptance'].includes(item.id)).map(({ id, name, purpose, revision, digest }) => ({ id, name, purpose, revision, digest }));
  const plan = { schemaVersion:2, roles, tasks: [f.developer, f.acceptance], governance: { organizationRevision: state.organization.revision, organizationDigest: state.organization.digest, maxRepairRounds: 2 } };
  assert.equal((await service.validatePlan(f.project, plan)).organization.digest, state.organization.digest);
  await assert.rejects(service.validatePlan(f.project, { ...plan, governance: undefined }), { code: 'approved_organization_required' });
  await assert.rejects(service.validatePlan(f.project, { ...plan, roles: roles.map((item) => ({ ...item, digest: 'f'.repeat(64) })) }), { code: 'approved_role_required' });
  await assert.rejects(service.validatePlan(f.project, { ...plan, tasks: [{ ...f.developer, writeSet: ['other.mjs'] }, f.acceptance] }), { code: 'invalid_plan' });
  await assert.rejects(service.validatePlan(f.project, { ...plan, tasks: [{ ...f.developer, checks: [] }, f.acceptance] }), { code: 'task_checks_required' });
  await assert.rejects(service.validatePlan(f.project, { ...plan, tasks: [f.developer] }), { code: 'independent_acceptance_required' });
  await assert.rejects(service.validatePlan(f.project, { ...plan, tasks: [f.developer, { ...f.acceptance, accepts: [] }] }), { code: 'acceptance_coverage_required' });
  const restarted = createOrganizationService({ userDataDir: f.data });
  try { assert.equal((await restarted.load(f.project)).organization.digest, state.organization.digest); } finally { await restarted.close(); }
});

test('public checks reject arbitrary commands and unapproved execution; actual current evidence goes stale', async (t) => {
  const f = await fixture(t);
  assert.throws(() => new CheckSpec({ ...f.spec, argv: ['--eval', 'process.exit(0)'] }), /fixed_node_test_argv_required/);
  f.setAllowed(false); const denied = await run(f, 'Builder', 'development', 'denied');
  assert.equal(denied.decision.allowed, false); assert.equal(denied.result.executed, false); assert.deepEqual(denied.result.actualArgv, []);
  f.setAllowed(true); const pair = await run(f, 'Builder', 'development', 'developer-current');
  assert.equal(pair.result.status, 'passed', JSON.stringify(pair)); assert.ok(pair.result.testCount > 0);
  assert.equal(pair.result.environment.platform, 'darwin'); assert.equal(pair.result.environment.network, 'none');
  assert.equal((await f.organizations.currentEvidence(f.project, f.developer))[0].id, 'developer-current');
  f.project.tasks[0].results.push({resource:'value.mjs',success:true,observedMutation:true});
  await assert.rejects(f.organizations.currentEvidence(f.project,f.developer),{code:'check_evidence_stale'});
  const refreshed=await run(f,'Builder','development','developer-after-same-bytes');assert.equal(refreshed.result.status,'passed');
  await fs.writeFile(join(f.root, 'value.mjs'), 'export const value = 2;');
  await assert.rejects(f.organizations.currentEvidence(f.project, f.developer), { code: 'check_evidence_stale' });
  const failed = await run(f, 'Builder', 'development', 'developer-failed'); assert.equal(failed.result.status, 'failed');
  await assert.rejects(f.organizations.currentEvidence(f.project, f.developer), { code: 'check_not_passed' });
});

test('real macOS check denies candidate writes, control reads and child processes within declared Node mode', async (t) => {
  const f = await fixture(t); const name = 'tests/Acceptance/isolation.test.mjs';
  await fs.writeFile(join(f.root, name), `import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {spawnSync} from 'node:child_process';
 test('candidate and control boundaries',()=>{assert.throws(()=>readFileSync('.ans/private/secret'));assert.throws(()=>writeFileSync('value.mjs','tampered'));const child=spawnSync(process.execPath,['-e','process.exit(0)']);assert.ok(child.error);assert.equal(child.error.code,'EPERM');});`);
  const spec = new CheckSpec({ ...f.spec, checkId: 'isolation', argv: ['--test', name], testResources: [name], inputResources: [name, 'value.mjs', 'package.json'] });
  const pair = await run(f, 'Acceptance', 'acceptance', 'isolation-run', spec);
  assert.equal(pair.result.status, 'passed', JSON.stringify(pair)); assert.equal(pair.result.testCount, 1);
  assert.equal(await fs.readFile(join(f.root, 'value.mjs'), 'utf8'), 'export const value = 1;');
  assert.equal(pair.result.stdout.includes('review-private-control'), false); assert.equal(pair.result.stderr.includes('review-private-control'), false);
});

test('Acceptance binds its real failure and PM repair to original owner/scope/checks and approved round limit', async (t) => {
  const f = await fixture(t); await fs.writeFile(join(f.root, 'value.mjs'), 'export const value = 2;');
  const failed = await run(f, 'Acceptance', 'acceptance', 'acceptance-failed'); assert.equal(failed.result.status, 'failed');
  const acceptanceActor = { projectId: f.project.id, roleId: 'Acceptance', instanceId: 'Acceptance-instance' };
  const input = { taskId: 'acceptance', evidenceIds: ['acceptance-failed'], decision: 'fail', issues: [{ taskId: 'development', resource: 'value.mjs', expected: '1', actual: '2', reproduction: 'run unit' }] };
  await assert.rejects(f.organizations.submitAcceptance(f.project, { ...input, decision: 'pass', issues: [] }, acceptanceActor), { code: 'check_not_passed' });
  await assert.rejects(f.organizations.submitAcceptance(f.project, input, { ...acceptanceActor, roleId: 'Builder' }), { code: 'actor_forbidden' });
  await assert.rejects(f.organizations.submitAcceptance(f.project, { ...input, issues: [{ ...input.issues[0], resource: 'other.mjs' }] }, acceptanceActor), { code: 'acceptance_issue_owner_mismatch' });
  let state = await f.organizations.submitAcceptance(f.project, input, acceptanceActor);
  const pm = { projectId: f.project.id, roleId: 'ProjectManager', instanceId: 'pm' };
  for (let round = 1; round <= 2; round += 1) {
    const id = state.acceptances.at(-1).id;
    await assert.rejects(f.organizations.requestRepair(f.project, { acceptanceId: id, taskId: 'development', reason: 'repair' }, acceptanceActor), { code: 'actor_forbidden' });
    state = await f.organizations.requestRepair(f.project, { acceptanceId: id, taskId: 'development', reason: 'repair' }, pm);
    const repair = state.repairs.at(-1); assert.equal(repair.roleId, 'Builder'); assert.equal(repair.round, round); assert.equal(Object.hasOwn(repair,'writeSet'),false); assert.equal(digestValue(repair.checks), digestValue(f.developer.checks));
    let replayCode = 'repair_already_requested'; if (round === 2) replayCode = 'repair_limit_reached';
    await assert.rejects(f.organizations.requestRepair(f.project, { acceptanceId: id, taskId: 'development', reason: 'replay' }, pm), { code: replayCode });
    state = await f.organizations.submitAcceptance(f.project, input, acceptanceActor);
  }
  await assert.rejects(f.organizations.requestRepair(f.project, { acceptanceId: state.acceptances.at(-1).id, taskId: 'development', reason: 'third' }, pm), { code: 'repair_limit_reached' });
  await fs.writeFile(join(f.root, 'value.mjs'), 'export const value = 1;');
  await assert.rejects(f.organizations.requestRepair(f.project, { acceptanceId: state.acceptances.at(-1).id, taskId: 'development', reason: 'stale' }, pm), { code: 'check_evidence_stale' });
  await run(f, 'Builder', 'development', 'development-repaired'); await run(f, 'Acceptance', 'acceptance', 'acceptance-current');
  state = await f.organizations.submitAcceptance(f.project, { taskId: 'acceptance', evidenceIds: ['acceptance-current'], decision: 'pass', issues: [] }, acceptanceActor);
  assert.equal(state.acceptances.at(-1).decision, 'pass');
  assert.equal(JSON.stringify(governedDTO(state)).includes('review-private-control'), false);
});


test('empty execution and direct fd3 count records cannot become check pass', async (t) => {
  const f = await fixture(t);
  const cases = [
    ['empty', "process.stdout.write('1..1\\n# tests 1\\n# pass 1\\n');", 'no_tests_executed'],
    ['counterfeit', "import {writeSync} from 'node:fs';writeSync(3,JSON.stringify({type:'test:pass',name:'forged',nesting:0})+'\\n');", null]
  ];
  for (const [id, content, reason] of cases) {
    const name = 'tests/Acceptance/' + id + '.mjs'; await fs.writeFile(join(f.root, name), content);
    const spec = new CheckSpec({ ...f.spec, checkId: id, argv: ['--test', name], testResources: [name], inputResources: [name, 'package.json'] });
    const pair = await run(f, 'Acceptance', 'acceptance', id + '-run', spec);
    assert.equal(pair.result.executed, true); assert.equal(pair.result.status, 'error');
    assert.equal(pair.result.testCount, 0);
    if (reason) assert.equal(pair.result.reason, reason);
  }
});

test('Check known-key declared input fails before child execution and retains customer bytes',async(t)=>{
 const f=await fixture(t),key='reviewer-check-known-canary';const content='export const value = "'+key+'";';await fs.writeFile(join(f.root,'value.mjs'),content);
 const live=new AbortController();const service=createCheckService({...await f.organizations.checkConfiguration(f.project),knownKeys:[key],authorizationValidator:{validate:async(request,authorization)=>({decision:new CheckDecision({allowed:true,reason:'reviewer',requestId:request.requestId,runId:request.runId,checkId:request.checkId,authorizationDigest:authorization.digest}),authorization,signal:live.signal})}});t.after(()=>service.close());
 const authorization=new CheckAuthorization({authorizationId:'known',confirmationId:'human',workspaceIdentity:f.project.workspaceIdentity,planDigest:f.project.plan.planDigest,organizationVersion:f.project.organizationVersion,roleId:'Builder',taskId:'development',sessionId:'s',instanceId:'i',runId:'r',profileVersion:'v',fileOwnersDigest:f.project.fileOwners.digest,approvedChecks:[f.spec],inputVersions:await f.organizations.snapshotInputs(f.project,f.spec.inputResources)});
 const pair=await service.run(new CheckRequest({requestId:'known',runId:'r',checkId:f.spec.checkId}),authorization);assert.equal(pair.result.executed,false);assert.equal(pair.result.reason,'known_key_input_rejected');assert.ok(!JSON.stringify(pair).includes(key));assert.equal(await fs.readFile(join(f.root,'value.mjs'),'utf8'),content);
});
