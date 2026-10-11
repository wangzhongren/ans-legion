import { randomUUID } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createCheckProvider, CheckProvider } from "../../src/kernel/providers/public/check.mjs";
import { CheckSpec, CheckRequest, CheckAuthorization } from "../../src/kernel/models/check.mjs";

const generated = fileURLToPath(new URL("../../.ans/runtime/legion-cli-role-owned-v2/KernelEngineer/tmp/", import.meta.url));
async function fixture(t, source, specOptions = {}, runtimeExecutable = process.execPath, knownKeys = []) {
  await fs.mkdir(generated, { recursive: true });
  const base = await fs.mkdtemp(join(generated, "provider-"));
  const root = join(base, "candidate"); const output = join(base, "evidence");
  await fs.mkdir(root); await fs.mkdir(output); await fs.mkdir(join(root, "tests"));
  await fs.writeFile(join(root, "tests/unit.mjs"), source);
  const rootStat = await fs.lstat(root, { bigint: true });
  const spec = new CheckSpec({ checkId: "unit", kind: "node-test", argv: ["--test", "tests/unit.mjs"],
    testResources: ["tests/unit.mjs"], inputResources: ["tests/unit.mjs"], timeoutSeconds: 5, ...specOptions });
  const authorization = new CheckAuthorization({ authorizationId: "host", confirmationId: "human",
    workspaceIdentity: { canonicalPath: root, deviceId: String(rootStat.dev), fileId: String(rootStat.ino) },
    planDigest: "a".repeat(64), fileOwnersDigest: "b".repeat(64), organizationVersion: "v1", profileVersion: "p1",
    roleId: "Acceptance", taskId: "task", sessionId: "s", instanceId: "i", runId: "run", approvedChecks: [spec],
    inputVersions: [{ resource: "tests/unit.mjs", byteLength: Buffer.byteLength(source),
      sha256: createHash("sha256").update(source).digest("hex") }] });
  const request = new CheckRequest({ requestId: "q", runId: "run", checkId: "unit" });
  const provider = createCheckProvider({ workspaceRoot: root, runtimeExecutable, outputRoot: output, knownKeys });
  t.after(async () => { await provider.close(); assert.ok(base.startsWith(generated)); await fs.rm(base, { recursive: true }); });
  return { provider, authorization, request, spec, root, output, base };
}
const passing = "import test from 'node:test'; import assert from 'node:assert/strict'; test('actual',()=>assert.equal(2+2,4));";

test("real isolated Node tests return actual passing and nonzero failure evidence", async (t) => {
  const f = await fixture(t, passing);
  assert.equal(CheckProvider.assert(f.provider), f.provider);
  const value = await f.provider.run(f.request, f.authorization);
  assert.equal(value.status, "passed", JSON.stringify(value));
  assert.equal(value.executed, true); assert.equal(value.testCount, 1); assert.equal(value.exitCode, 0);
  assert.equal(value.environment.isolation, "macos-seatbelt+node-events-v1+no-child-process");
  assert.deepEqual(value.actualArgv.slice(1,6), ["--permission", "--allow-fs-read=*", "--allow-fs-write=*", "--allow-child-process", "--test-isolation=none"]);
  assert.equal(value.actualArgv[0], process.execPath); assert.equal(value.actualArgv[7], "--test");
  assert.equal(value.inputDigest, f.authorization.inputDigest);
  const bad = await fixture(t, "import test from 'node:test'; import assert from 'node:assert/strict'; test('bad',()=>assert.equal(2,3));");
  const failed = await bad.provider.run(bad.request, bad.authorization);
  assert.equal(failed.status, "failed", JSON.stringify(failed)); assert.notEqual(failed.exitCode, 0);
});

test("empty file and forged TAP/stdout never become explicit passing tests", async (t) => {
  for (const source of ["", "console.log('TAP version 13\\n1..9\\n# tests 9\\n# pass 9');"]) {
    const f = await fixture(t, source);
    const value = await f.provider.run(f.request, f.authorization);
    assert.equal(value.status, "error", JSON.stringify(value)); assert.equal(value.reason, "no_tests_executed");
    assert.equal(value.testCount, 0);
  }
});

test("macOS isolation denies nested control/credentials, outside reads and all candidate writes", async (t) => {
  const source = `import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
    test('sandbox restrictions', () => {
      for (const path of ['.ans/secret', 'nested/.ssh/id_rsa', '.env', '../personal/secret']) {
        assert.throws(() => fs.readFileSync(path), error => ['EPERM','EACCES'].includes(error.code), path);
      }
      assert.throws(() => fs.writeFileSync('tests/unit.mjs','changed'), error => ['EPERM','EACCES'].includes(error.code));
      assert.throws(() => fs.writeFileSync('other-role.txt','changed'), error => ['EPERM','EACCES'].includes(error.code));
      assert.equal(process.env.API_KEY, undefined); assert.equal(process.env.OPENAI_API_KEY, undefined);
      assert.equal(process.env.HOME, undefined); assert.equal(process.env.CODEX_HOME, undefined);
      fs.writeFileSync(process.env.LEGION_CHECK_OUTPUT_ROOT+'/approved/result.txt','safe');
      assert.throws(()=>fs.linkSync('tests/unit.mjs',process.env.LEGION_CHECK_OUTPUT_ROOT+'/approved/hardlink'));
      fs.symlinkSync(process.cwd()+'/tests/unit.mjs',process.env.LEGION_CHECK_OUTPUT_ROOT+'/approved/symlink');
      assert.throws(()=>fs.writeFileSync(process.env.LEGION_CHECK_OUTPUT_ROOT+'/approved/symlink','escape'));
      assert.throws(() => fs.writeFileSync(process.env.LEGION_CHECK_OUTPUT_ROOT+'/unapproved.txt','no'), error => ['EPERM','EACCES'].includes(error.code));
    });`;
  const f = await fixture(t, source, { outputResources: ["approved/"] });
  await fs.mkdir(join(f.root, ".ans")); await fs.writeFile(join(f.root, ".ans/secret"), "private");
  await fs.mkdir(join(f.root, "nested/.ssh"), { recursive: true }); await fs.writeFile(join(f.root, "nested/.ssh/id_rsa"), "private");
  await fs.writeFile(join(f.root, ".env"), "private"); await fs.writeFile(join(f.root, "other-role.txt"), "original");
  await fs.mkdir(join(f.base, "personal")); await fs.writeFile(join(f.base, "personal/secret"), "private");
  const value = await f.provider.run(f.request, f.authorization);
  assert.equal(value.status, "passed", JSON.stringify(value));
  assert.equal(await fs.readFile(join(f.root, "other-role.txt"), "utf8"), "original");
  const run = (await fs.readdir(f.output))[0];
  assert.equal(await fs.readFile(join(f.output, run, "outputs/approved/result.txt"), "utf8"), "safe");
});

test("none forbids networking and localhost supports a real local protocol exchange", async (t) => {
  const denied = await fixture(t, `import test from 'node:test'; import assert from 'node:assert/strict'; import net from 'node:net';
    test('network blocked', async()=> {
      const server=net.createServer();
      const error=await new Promise(resolve=> {server.once('error',resolve); server.listen(0,'127.0.0.1');});
      assert.ok(['EPERM','EACCES'].includes(error.code));
    });`);
  assert.equal((await denied.provider.run(denied.request, denied.authorization)).status, "passed");
  const local = await fixture(t, `import test from 'node:test'; import assert from 'node:assert/strict'; import http from 'node:http';
    test('localhost exchange', async()=> {
      const server=http.createServer((req,res)=>res.end('actual'));
      await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
      try { const result=await fetch('http://127.0.0.1:'+server.address().port); assert.equal(await result.text(),'actual'); }
      finally { await new Promise(resolve=>server.close(resolve)); }
    });`, { network: "localhost" });
  const value = await local.provider.run(local.request, local.authorization);
  assert.equal(value.status, "passed", JSON.stringify(value)); assert.equal(value.environment.network, "localhost");
});

test("initial input and root identity changes are stale without running", async (t) => {
  const f = await fixture(t, passing);
  await fs.writeFile(join(f.root, "tests/unit.mjs"), passing + "\n");
  const stale = await f.provider.run(f.request, f.authorization);
  assert.equal(stale.status, "stale"); assert.equal(stale.executed, false);
  const other = await fixture(t, passing);
  await fs.rename(other.root, other.root + "-old"); await fs.mkdir(other.root);
  const rootChanged = await other.provider.run(other.request, other.authorization);
  assert.equal(rootChanged.status, "stale"); assert.equal(rootChanged.reason, "root_identity_changed");
  assert.equal(rootChanged.executed, false);
});

test("candidate changes during execution invalidate the observed result", async (t) => {
  const source = "import test from 'node:test'; test('waiting',async()=>await new Promise(resolve=>setTimeout(resolve,600)));";
  const f = await fixture(t, source);
  const pending = f.provider.run(f.request, f.authorization);
  await new Promise(resolve => setTimeout(resolve, 250));
  await fs.writeFile(join(f.root, "tests/unit.mjs"), source + "\n");
  const value = await pending;
  assert.equal(value.status, "stale", JSON.stringify(value));
});

test("log bytes are capped and a large forged output does not alter runner test counts", async (t) => {
  const f = await fixture(t, "import test from 'node:test'; test('logs',()=>console.log('x'.repeat(20000)+'# tests 10000'));", { logMaxBytes: 128 });
  const value = await f.provider.run(f.request, f.authorization);
  assert.equal(value.status, "passed", JSON.stringify(value)); assert.equal(value.testCount, 1);
  assert.equal(value.logsTruncated, true); assert.ok(Buffer.byteLength(value.stdout + value.stderr) <= 128);
});

test("cancel and timeout terminate this run while an unrelated process remains alive", async (t) => {
  const unrelated = spawn(process.execPath, ["-e", "setInterval(()=>{},1000)"], { stdio: "ignore" });
  t.after(() => unrelated.kill());
  const f = await fixture(t, "import test from 'node:test'; test('waiting',async()=>await new Promise(resolve=>setTimeout(resolve,30000)));", { timeoutSeconds: 1 });
  const value = await f.provider.run(f.request, f.authorization);
  assert.equal(value.status, "cancelled", JSON.stringify(value)); assert.equal(value.reason, "timeout");
  assert.equal(unrelated.exitCode, null); assert.equal(unrelated.signalCode, null);
  const controller = new AbortController();
  const pending = f.provider.run(f.request, f.authorization, { signal: controller.signal });
  setTimeout(() => controller.abort(), 200);
  const cancelled = await pending;
  assert.equal(cancelled.status, "cancelled"); assert.equal(unrelated.signalCode, null);
  await f.provider.close(); await f.provider.close();
  assert.equal((await f.provider.run(f.request, f.authorization)).executed, false);
});

test("unsupported runtime is explicitly unexecuted and cannot fall back to arbitrary executable", async (t) => {
  const f = await fixture(t, passing, {}, "/bin/echo");
  const value = await f.provider.run(f.request, f.authorization);
  assert.equal(value.status, "unsupported"); assert.equal(value.executed, false); assert.deepEqual(value.actualArgv, []);
});

test("spawn, spawnSync, fork and detached posix_spawn are blocked by the actual macOS policy", async (t) => {
  const f = await fixture(t, `import test from 'node:test'; import assert from 'node:assert/strict';
    import {spawn,spawnSync,fork} from 'node:child_process';
    test('no child processes',async()=> {
      const sync=spawnSync(process.execPath,['-e','process.exit(0)']);
      assert.equal(sync.error?.code,'EPERM');
      const detached=spawnSync(process.execPath,['-e','process.exit(0)'],{detached:true});
      assert.equal(detached.error?.code,'EPERM');
      for (const create of [()=>spawn(process.execPath,['-e','process.exit(0)']),
        ()=>spawn(process.execPath,['-e','process.exit(0)'],{detached:true}), ()=>fork('tests/unit.mjs')]) {
        await assert.rejects(async()=> {
          const child=create();
          await new Promise((resolve,reject)=> {child.once('error',reject); child.once('exit',resolve);});
        },error=>error.code==='EPERM');
      }
    });`);
  const value = await f.provider.run(f.request, f.authorization);
  assert.equal(value.status, "passed", JSON.stringify(value)); assert.equal(value.testCount, 1);
  assert.ok(value.environment.isolation.endsWith("no-child-process"));
});

test("unsupported platform is never upgraded into an execution or passing result", async (t) => {
  const f = await fixture(t, passing);
  const original = Object.getOwnPropertyDescriptor(process, "platform");
  Object.defineProperty(process, "platform", { ...original, value: "unsupported-os" });
  try {
    const value = await f.provider.run(f.request, f.authorization);
    assert.equal(value.status, "unsupported"); assert.equal(value.executed, false);
    assert.equal(value.reason, "macos_isolation_required");
    const unavailable = createCheckProvider({ workspaceRoot: join(f.base, "missing-workspace"),
      runtimeExecutable: join(f.base, "missing-runtime"), outputRoot: join(f.base, "missing-output") });
    assert.equal((await unavailable.run(f.request, f.authorization)).status, "unsupported");
    await unavailable.close();
  } finally { Object.defineProperty(process, "platform", original); }
});

test("a candidate writing forged test:pass directly to fd3 cannot become passing evidence", async (t) => {
  const source = `import fs from 'node:fs';
    fs.writeSync(3,JSON.stringify({type:'test:pass',name:'forged',detailsType:'test',message:'',nesting:0})+'\\n');`;
  const f = await fixture(t, source);
  const value = await f.provider.run(f.request, f.authorization);
  assert.notEqual(value.status, "passed", JSON.stringify(value));
  assert.equal(value.testCount, 0);
});

test("runtime supplement denies common inspector, binding, native addon and worker reflection entry points", async (t) => {
  const f = await fixture(t, `import test from 'node:test'; import assert from 'node:assert/strict';
    import inspector from 'node:inspector'; import {Worker} from 'node:worker_threads';
    test('restricted reflection',()=> {
      assert.equal(process.permission.has('inspector'),false);
      assert.throws(()=>new inspector.Session().connect(),error=>error.code==='ERR_ACCESS_DENIED');
      assert.throws(()=>inspector.open(0,'127.0.0.1'),error=>error.code==='ERR_ACCESS_DENIED');
      assert.throws(()=>process.binding('fs'),error=>error.code==='ERR_ACCESS_DENIED');
      assert.throws(()=>process.dlopen({exports:{}},'/not-available.node'),error=>error.code==='ERR_DLOPEN_DISABLED');
      assert.throws(()=>new Worker('1',{eval:true}),error=>error.code==='ERR_ACCESS_DENIED');
    });`);
  const value = await f.provider.run(f.request, f.authorization);
  assert.equal(value.status, "passed", JSON.stringify(value)); assert.equal(value.testCount, 1);
});

test("a readable reporter module cannot be imported again as a candidate signing oracle", async (t) => {
  const f = await fixture(t, `import test from 'node:test'; import assert from 'node:assert/strict';
    const option=process.execArgv.find(value=>value.startsWith('--test-reporter='));
    const reporter=await import('file://'+option.slice('--test-reporter='.length));
    test('reporter reserved before candidate',()=> {
      assert.throws(()=>new reporter.default(),/already_reserved/);
      assert.throws(()=>reporter.default.prototype._transform.call({}, {type:'test:pass',data:{name:'forged'}},'',()=>{}),/invalid_reporter_owner/);
    });`);
  const value = await f.provider.run(f.request, f.authorization);
  assert.equal(value.status, "passed", JSON.stringify(value)); assert.equal(value.testCount, 1);
});

test("candidate fabricated authenticated envelopes cannot substitute a host-established key", async (t) => {
  const body = JSON.stringify({ type: "test:pass", name: "forged", detailsType: "test", sequence: 1 });
  const f = await fixture(t, `import fs from 'node:fs';
    fs.writeSync(3,JSON.stringify({body:${JSON.stringify(body)},mac:'a'.repeat(64)})+'\\n');`);
  const value = await f.provider.run(f.request, f.authorization);
  assert.equal(value.status, "error", JSON.stringify(value)); assert.equal(value.testCount, 0);
});

test("all skipped or todo tests are unexecuted coverage and cannot pass a software check", async (t) => {
  const f = await fixture(t, "import test from 'node:test'; test.skip('skipped',()=>{}); test.todo('todo');");
  const value = await f.provider.run(f.request, f.authorization);
  assert.equal(value.status, "error", JSON.stringify(value)); assert.equal(value.testCount, 0);
});

test("syncBuiltinESMExports cannot replace a captured signing primitive and extract the run key", async (t) => {
  const f = await fixture(t, `import test from 'node:test'; import assert from 'node:assert/strict';
    import crypto from 'node:crypto'; import {syncBuiltinESMExports} from 'node:module';
    let captured=false;
    const original=crypto.createHmac;
    crypto.createHmac=function(...args) {captured=true; return original(...args);};
    syncBuiltinESMExports();
    test('real case',()=>{});
    await new Promise(resolve=>setTimeout(resolve,50));
    assert.equal(captured,false,'candidate replacement must not receive the reporter key');`);
  const value = await f.provider.run(f.request, f.authorization);
  assert.equal(value.status, "passed", JSON.stringify(value)); assert.equal(value.testCount, 1);
});

test("replacing a stream completion hook cannot acquire the active reporter as a signing oracle", async (t) => {
  const f = await fixture(t, `import {Writable} from 'node:stream';
    const original=Writable.prototype.end;
    Writable.prototype.end=function(...args) {
      if (this.constructor.name==='Reporter') this._transform({type:'test:pass',data:{name:'forged',details:{type:'test'}}},'',()=>{});
      return original.apply(this,args);
    };`);
  const value = await f.provider.run(f.request, f.authorization);
  assert.notEqual(value.status, "passed", JSON.stringify(value)); assert.equal(value.testCount, 0);
});

test("actual Electron Node mode receives fixed permission arguments and returns real pass/failure", async (t) => {
  const electron = fileURLToPath(new URL("../../apps/desktop/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron", import.meta.url));
  const source = `import test from 'node:test'; import assert from 'node:assert/strict';
    test('Electron actual Node mode',()=> {
      assert.match(process.versions.electron,/^44\\.6\\./);
      assert.equal(typeof process.permission.has,'function');
      assert.equal(process.permission.has('inspector'),false);
      assert.equal(process.env.NODE_OPTIONS,undefined);
    });`;
  const f = await fixture(t, source, {}, electron);
  const value = await f.provider.run(f.request, f.authorization);
  assert.equal(value.status, "passed", JSON.stringify(value)); assert.equal(value.testCount, 1);
  assert.match(value.environment.runtimeVersion, /^v24\.21\./);
  assert.equal(value.actualArgv[0], electron);
  assert.deepEqual(value.actualArgv.slice(1,6), ["--permission", "--allow-fs-read=*", "--allow-fs-write=*", "--allow-child-process", "--test-isolation=none"]);
  const failed = await fixture(t, "import test from 'node:test'; import assert from 'node:assert/strict'; test('bad',()=>assert.equal(1,2));", {}, electron);
  const result = await failed.provider.run(failed.request, failed.authorization);
  assert.equal(result.status, "failed", JSON.stringify(result)); assert.notEqual(result.exitCode, 0);
});

test("explicitly authorized absent input stays absent through the original independent Node check",async(t)=>{
 const f=await fixture(t,"import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';test('approved deletion',()=>assert.equal(fs.existsSync('deleted.txt'),false));");
 const spec=new CheckSpec({...f.spec,inputResources:[...f.spec.inputResources,"deleted.txt"]});const authorization=new CheckAuthorization({...f.authorization,approvedChecks:[spec],inputVersions:[...f.authorization.inputVersions,{resource:"deleted.txt",state:"absent",sha256:null,byteLength:0}],generationDigest:"d".repeat(64)});const result=await f.provider.run(f.request,authorization);assert.equal(result.status,"passed",JSON.stringify(result));assert.equal(result.testCount,1);assert.equal(result.inputVersions.find(item=>item.resource==="deleted.txt").state,"absent");
 await fs.writeFile(join(f.root,"deleted.txt"),"unapproved recreation");const stale=await f.provider.run(f.request,authorization);assert.equal(stale.status,"stale");assert.equal(stale.executed,false);
});

async function assertNoKnownRunFile(directory, key) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await assertNoKnownRunFile(path, key);
    else if (entry.isFile()) assert.equal((await fs.readFile(path)).includes(Buffer.from(key)), false, "private run file contains known value");
  }
}

test("private known key rejects static Check input before spawn and leaves customer bytes intact", async (t) => {
  const key = randomUUID(); const source = passing + '\n// '+ key;
  const f = await fixture(t, source, {}, process.execPath, [key]);
  const original = createHash("sha256").update(await fs.readFile(join(f.root, "tests/unit.mjs"))).digest("hex");
  const result = await f.provider.run(f.request, f.authorization);
  assert.equal(result.executed, false); assert.equal(result.reason, "known_key_input_rejected");
  assert.equal(JSON.stringify(result).includes(key), false);
  assert.equal(createHash("sha256").update(await fs.readFile(join(f.root, "tests/unit.mjs"))).digest("hex"), original);
  await assertNoKnownRunFile(f.output, key);
});

test("real Check child split stdout and reporter event values are rejected before result construction", async (t) => {
  for (const stream of ["stdout", "stderr"]) {
    const key = randomUUID();
    const source = `import test from 'node:test'; test('output',async()=>{const value=String.fromCharCode(${[...key].map(c=>c.charCodeAt(0)).join(',')}); process.${stream}.write(value.slice(0,17));await new Promise(r=>setTimeout(r,80));process.${stream}.write(value.slice(17));});`;
    assert.equal(source.includes(key), false);
    const f = await fixture(t, source, {}, process.execPath, [key]);
    const result = await f.provider.run(f.request, f.authorization);
    assert.equal(result.executed, true); assert.equal(result.status, "error"); assert.equal(result.reason, "known_key_output_rejected");
    assert.equal(JSON.stringify(result).includes(key), false);
    await assertNoKnownRunFile(f.output, key);
    assert.equal(createHash("sha256").update(await fs.readFile(join(f.root, "tests/unit.mjs"))).digest("hex"), createHash("sha256").update(source).digest("hex"));
  }
});
