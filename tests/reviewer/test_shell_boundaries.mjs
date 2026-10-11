/** Independent finite Shell structure/value contracts; no native process or model request. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as models from '../../workbench.mjs';
import * as shellApi from '../../src/kernel/services/public/shell.mjs';
import { AgentSession, ActionProposal, digestValue, _consumeShellPublication,
  _shellPublicationBinding } from '../../src/kernel/models/core.mjs';
import { PiToolRequest } from '../../src/kernel/models/agent.mjs';
import { _createShellExecutionAuthority, _createShellPublicationReceipt } from '../../src/kernel/models/shell.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = (path) => fs.readFile(resolve(root, path), 'utf8');
const hash = 'a'.repeat(64);
const request = () => new models.ShellRequest({ requestId: 'review-shell', runId: 'run',
  command: 'printf fixture', reason: 'Finite review fixture' });
function authorization(req, review, changes = {}) {
  const owners = { projectId: 'project', version: 'v1', owners: [{ resource: 'a.txt', roleId: 'Worker' }] };
  return new models.ShellAuthorization({ authorizationId: 'authorization', projectId: 'project',
    prepareId: 'prepare', organizationVersion: 'v1', roleId: 'Worker', taskId: 'task',
    sessionId: 'session', instanceId: 'worker', runId: 'run', profileVersion: 'profile-v1',
    expiresAt: new Date(Date.now() + 60000).toISOString(), requestDigest: req.digest,
    reviewDigest: review.digest, planDigest: hash, contextSnapshotDigest: hash,
    fileOwnersDigest: digestValue(owners), snapshotDigest: digestValue([]), generationDigest: hash,
    workspaceIdentity: { canonicalPath: root, deviceId: '1', fileId: '2' }, ownerGeneration: owners.version,
    generatedEffects: [], inputVersions: [], fileOwners: owners, artifactScopes: [], ...changes });
}
function review(req) { return new models.ShellReview({ requestId: req.requestId,
  requestDigest: req.digest, revision: 1, approved: true, reason: 'Exact fixture only' }); }

test('Shell public package exports only approved Service and Model values, never private authority', async () => {
  const metadata = JSON.parse(await source('package.json'));
  assert.equal(metadata.version, '1.1.3');
  assert.deepEqual(Object.keys(metadata.exports).sort(), ['.', './workbench-models',
    './services/policy', './services/mutation', './services/read', './services/proposal',
    './services/pi-agent', './services/check', './services/shell', './headless-workbench'].sort());
  assert.equal(metadata.exports['./services/shell'], './src/kernel/services/public/shell.mjs');
  assert.deepEqual(Object.keys(shellApi).sort(), ['ShellService', 'createShellService']);
  assert.deepEqual(Object.keys(models).sort(), JSON.parse(await source('.ans/runtime/legion-cli-role-owned-v2/ProjectManager/packaging/su-frontdoor-memory-repair-v1/package-smoke.json')).modelExports.sort());
  for (const name of ['ShellRequest','ShellReview','ShellPreparation','ShellAuthorization','ShellDecision',
    'ShellCandidate','ShellResult','FileBaseline','shellEffects','shellArtifacts','shellBaselines']) assert.equal(typeof models[name], 'function');
  assert.ok(!Object.keys(models).some((name) => name.startsWith('_') || /Shell.*(?:Receipt|Authority)/u.test(name)));
  for (const name of ['_createShellExecutionAuthority','_createShellPublicationReceipt',
    '_registerShellPublication','_consumeShellPublication','_shellPublicationBinding']) assert.ok(!Object.hasOwn(models,name));
  assert.throws(() => shellApi.createShellService({}), /trusted_shell_authorization_validator_required/u);
});

test('Shell layers use own contracts and the adjacent public Provider; Provider never calls upward', async () => {
  const service = await source('src/kernel/services/impl/shell.mjs');
  const imports = [...service.matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1]);
  assert.deepEqual(imports.sort(), ['../abstract/shell.mjs','../../providers/public/shell.mjs',
    '../../models/shell.mjs','../../models/core.mjs'].sort());
  assert.match(service, /observeTime\(\)\{return this\.#provider\.observeTime\(\);\}/u);
  const provider = await source('src/kernel/providers/impl/shell.mjs');
  const providerImports = [...provider.matchAll(/from\s+["']([^"']+)["']/gu)].map((match) => match[1]);
  assert.ok(providerImports.every((path) => path.startsWith('node:') ||
    ['../abstract/shell.mjs','../../models/shell.mjs','../../models/core.mjs'].includes(path)));
  assert.doesNotMatch(provider, /import\s*\(|\beval\s*\(/u);
  assert.match(provider, /process\.platform!=="darwin"\s*\|\|\s*this\.#disabled\)return this\.notExecuted\(request,"unsupported","macos_shell_isolation_required"/u);
  assert.match(provider, /this\.#disabled=true;fail\("shell_cleanup_timeout"\)/u);
  assert.match(provider, /\["\/usr\/bin\/sandbox-exec","-p",this\.#profile\(entry,request\),"\/bin\/zsh","-f","-c",request\.command\]/u);
  assert.match(provider, /shell_readonly_dependency_changed/u);
  // Static fail-close contract only; the platform execution probes belong to Kernel/Tester gates.
});

test('SDK request values cannot carry role identity, private publication, binary write or delete authority', () => {
  const req = request();
  assert.equal(req.network, 'none'); assert.equal(req.timeoutSeconds, 300);
  for (const field of ['roleId','permit','authorization','receipt'])
    assert.throws(() => new models.ShellRequest({ ...req, [field]: 'forged' }), TypeError);
  assert.throws(() => new models.ShellRequest({ ...req, command: 'x'.repeat(65537) }), /shell_command_budget/u);
  assert.throws(() => new models.ShellRequest({ ...req, cwd: '../outside' }), TypeError);
  const tool = { requestId:'tool', runId:'run', toolCallId:'call' };
  for (const name of ['legion_delete_file','legion_shell_publish'])
    assert.throws(() => new PiToolRequest({ ...tool, tool:name, parameters:{resource:'a.txt'} }), TypeError);
  assert.throws(() => new PiToolRequest({ ...tool, tool:'legion_write_file',
    parameters:{resource:'a.txt',content:'fixture',contentBase64:'Zm9yZ2Vk'} }), TypeError);
});

test('Shell authorization binds exact owner, artifact and complete authored inventory', () => {
  const req=request(), decision=review(req); const valid=authorization(req,decision);
  assert.equal(valid.ownerGeneration,'v1'); assert.equal(Object.hasOwn(valid,'writeSet'),false);
  assert.equal(new models.ProjectFileOwners(authorization(req,decision,{roleId:'Other'}).fileOwners).ownerOf('a.txt'),'Worker');
  assert.throws(() => authorization(req,decision,{writeSet:['a.txt','A.txt']}), /unknown field writeSet/u);
  assert.throws(() => authorization(req,decision,{fileOwnersDigest:'b'.repeat(64)}), /shell_file_owners_digest_mismatch/u);
  assert.throws(() => authorization(req,decision,{generatedEffects:['build/']}), /generated_effect_not_approved_artifact/u);
  const artifact={generatedEffects:['build/'],artifactScopes:[{scope:'build/',kind:'build'}]};
  assert.throws(() => authorization(req,decision,artifact), /complete_authored_inventory_required/u);
  assert.throws(() => authorization(req,decision,{...artifact,authoredResources:[]}), /incomplete_authored_inventory/u);
  assert.throws(() => authorization(req,decision,{...artifact,authoredResources:['a.txt','build/authored.txt']}), /generated_effect_overlaps_authored_source/u);
  assert.deepEqual(authorization(req,decision,{...artifact,authoredResources:['a.txt']}).generatedEffects,['build/']);
});

test('Host internal typed permit and publication receipt consume exact candidate once; no forged receipt', () => {
  // Trusted fixture construction tests the opaque binding contract, not actual OS execution.
  const req=request(), decision=review(req), grant=authorization(req,decision), signal=new AbortController();
  const authority=_createShellExecutionAuthority();
  assert.throws(() => authority.issue(req,grant,decision,signal.signal), /valid_observed_time_fact_required/u);
  assert.throws(() => authority.consume(req,grant,{},Date.now()), /invalid_or_replayed_shell_permit/u);
  const permit=authority.issue(req,grant,decision,signal.signal,Date.now());
  assert.equal(authority.consume(req,grant,permit,Date.now()),signal.signal);
  assert.throws(() => authority.consume(req,grant,permit,Date.now()), /invalid_or_replayed_shell_permit/u);
  assert.throws(() => authority.issue(req,grant,decision,signal.signal,Date.now()), /invalid_shell_binding/u);
  const content='finite bytes'; const sha=createHash('sha256').update(content).digest('hex');
  const baseline=new models.FileBaseline({resource:'a.txt',state:'absent',sha256:null,byteLength:0});
  const candidate=new models.ShellCandidate({resource:'a.txt',action:'create',baseline,sha256:sha,
    byteLength:Buffer.byteLength(content),executable:false,encoding:'utf8'});
  const result=new models.ShellResult({requestId:req.requestId,runId:req.runId,requestDigest:req.digest,
    status:'ready_for_publication',reason:'fixture',executed:true,exitCode:0,stdout:'',stderr:'',
    logsTruncated:false,candidates:[candidate],generatedEffects:[],generationDigest:hash,
    actualCwd:root,startedAt:new Date().toISOString(),finishedAt:new Date().toISOString()});
  const receipt=_createShellPublicationReceipt({request:req,authorization:grant,review:decision,result,
    signal:signal.signal,observedAtMs:Date.now()});
  assert.deepEqual(Object.keys(receipt),[]);
  const session=new AgentSession({sessionId:'session',roleId:'Worker',taskId:'task',organizationVersion:'v1'});
  const proposal=new ActionProposal({proposalId:'publication',tool:'legion_shell_publish',capability:'request_shell',
    action:'write_file',resource:'a.txt',content,executable:false,expectedBaseline:baseline,session,runId:'run'});
  assert.throws(() => _consumeShellPublication({},proposal,Date.now()), /invalid_or_revoked_shell_publication/u);
  assert.equal(_consumeShellPublication(receipt,proposal,Date.now()).candidate.sha256,sha);
  assert.throws(() => _consumeShellPublication(receipt,proposal,Date.now()), /shell_candidate_replayed/u);
  signal.abort(); assert.throws(() => _shellPublicationBinding(receipt,proposal,Date.now()), /invalid_or_revoked_shell_publication/u);
  assert.throws(() => new models.ShellResult({...result,receipt}),TypeError);
});
