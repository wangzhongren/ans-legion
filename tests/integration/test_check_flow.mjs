import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createCheckService } from '../../src/kernel/services/public/check.mjs';
import { CheckSpec, CheckRequest, CheckAuthorization, CheckDecision } from '../../src/kernel/models/check.mjs';
import { generated, guard, ownedDirectory, removeOwned } from '../../apps/desktop/tests/integration/workbench-flow.test.mjs';

async function fixture(t, source, approved = true) {
  const base = await ownedDirectory('fixtures', 'independent-check-');
  const root = join(base, 'customer'); const outputRoot = join(base, 'output'); await fs.mkdir(root); await fs.mkdir(outputRoot);
  await fs.writeFile(join(root, 'actual.test.mjs'), source);
  const physical = await fs.lstat(root, { bigint: true }); const live = new AbortController();
  const spec = new CheckSpec({ checkId: 'independent', kind: 'node-test', argv: ['--test', 'actual.test.mjs'],
    testResources: ['actual.test.mjs'], inputResources: ['actual.test.mjs'], outputResources: [], timeoutSeconds: 5, network: 'none', logMaxBytes: 4096 });
  const authorization = new CheckAuthorization({ authorizationId: 'trusted-independent', confirmationId: 'actual-human',
    workspaceIdentity: { canonicalPath: root, deviceId: String(physical.dev), fileId: String(physical.ino) }, planDigest: 'a'.repeat(64), fileOwnersDigest: 'b'.repeat(64), organizationVersion: 'organization-v1',
    profileVersion: 'profile-v1', roleId: 'Acceptance', taskId: 'acceptance', sessionId: 'session', instanceId: 'instance', runId: 'run', approvedChecks: [spec],
    inputVersions: [{ resource: 'actual.test.mjs', byteLength: Buffer.byteLength(source), sha256: createHash('sha256').update(source).digest('hex') }] });
  const runtimeExecutable = fileURLToPath(new URL('../../apps/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron', import.meta.url));
  const service = createCheckService({ workspaceRoot: root, runtimeExecutable, outputRoot, authorizationValidator: { validate: async (request, candidate) => ({
    decision: new CheckDecision({ allowed: approved && candidate === authorization && !live.signal.aborted, reason: 'independent_trusted_host', requestId: request.requestId, runId: request.runId, checkId: request.checkId, authorizationDigest: candidate.digest }), authorization, signal: live.signal }) } });
  const request = new CheckRequest({ requestId: 'request', runId: 'run', checkId: 'independent' });
  t.after(async () => { live.abort(); await service.close(); await removeOwned(base, join(generated, 'fixtures')); });
  return { service, authorization, request, root, live };
}

test('public check service executes installed Electron Node and authentic real assertions', async t => {
  const f = await fixture(t, "import test from 'node:test';import assert from 'node:assert/strict';test('actual runtime',()=>{assert.ok(process.versions.electron);assert.equal(process.env.NODE_OPTIONS,undefined);assert.ok(process.permission);assert.equal(7*6,42);});");
  const pair = await f.service.run(f.request, f.authorization);
  assert.equal(pair.result.status, 'passed', JSON.stringify(pair.result)); assert.equal(pair.result.testCount, 1); assert.equal(pair.result.executed, true);
  assert.equal(pair.result.environment.isolation, 'macos-seatbelt+node-events-v1+no-child-process'); assert.equal(pair.result.actualArgv.at(-1), 'actual.test.mjs');
  assert.equal(pair.result.authorizationDigest, f.authorization.digest); assert.equal(pair.result.inputDigest, f.authorization.inputDigest);
});

test('failed/empty/forged-check logs cannot become independent passing evidence', async t => {
  for (const [source, expected] of [
    ["import test from 'node:test';import assert from 'node:assert/strict';test('actual fail',()=>assert.equal(1,2));", 'failed'],
    ["console.log('TAP version 13\\nok 1 - fictional pass\\n1..1\\n# tests 1\\n# pass 1');", 'error'],
    ["import fs from 'node:fs';fs.writeSync(3,JSON.stringify({type:'test:pass',data:{name:'forged',details:{type:'test'}}})+'\\n');", 'error']
  ]) { const f = await fixture(t, source); const result = (await f.service.run(f.request, f.authorization)).result; assert.equal(result.status, expected, JSON.stringify(result)); assert.equal(result.executed, true); }
});

test('typed model and changed input cannot substitute current host approval', async t => {
  const source = "import test from 'node:test';test('actual',()=>{});";
  const denied = await fixture(t, source, false); assert.equal((await denied.service.run(denied.request, denied.authorization)).result.executed, false);
  const f = await fixture(t, source); await fs.writeFile(join(f.root, 'actual.test.mjs'), source + '// changed');
  const result = (await f.service.run(f.request, f.authorization)).result; assert.notEqual(result.status, 'passed'); assert.equal(result.status, 'stale');
});

test('actual sandbox denies unapproved file writes and process creation inside check', async t => {
  const f = await fixture(t, "import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {spawnSync} from 'node:child_process';test('sandbox',()=>{assert.throws(()=>fs.writeFileSync('unapproved.txt','escape'));assert.ok(spawnSync('/usr/bin/true').error);assert.equal(process.env.HOME,undefined);assert.equal(process.env.CODEX_HOME,undefined);});");
  const result = (await f.service.run(f.request, f.authorization)).result; assert.equal(result.status, 'passed', JSON.stringify(result));
  await assert.rejects(fs.stat(join(f.root, 'unapproved.txt')), { code: 'ENOENT' });
});

test('host revoke stops actual check and cannot reuse terminal approval', async t => {
  const f = await fixture(t, "import test from 'node:test';test('long real check',async()=>await new Promise(resolve=>setTimeout(resolve,30000)));");
  const pending = f.service.run(f.request, f.authorization); setTimeout(() => f.live.abort(), 300);
  const result = (await pending).result; assert.equal(result.status, 'stale'); assert.equal((await f.service.run(f.request, f.authorization)).result.executed, false);
});
