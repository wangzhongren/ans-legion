import { CheckProvider, CheckProviderError } from "../abstract/check.mjs";
import { CheckRequest, CheckAuthorization, CheckResult } from "../../models/check.mjs";
import { modelRecord, modelString, digestValue } from "../../models/core.mjs";
import { realpathSync, lstatSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from "node:fs";
import { resolve, join, dirname, isAbsolute } from "node:path";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { StringDecoder } from "node:string_decoder";

const sandbox = "/usr/bin/sandbox-exec";
function path(value, field) {
  modelString(value, field);
  if (!isAbsolute(value) || /[\x00-\x1f]/.test(value)) throw new TypeError("absolute_check_config_required");
  return resolve(value);
}
function physical(value) {
  if (realpathSync(value) !== value) throw new CheckProviderError("linked_check_path");
  const parts = value.split("/");
  let current = "/";
  for (const part of parts.filter(Boolean)) {
    current = join(current, part);
    if (lstatSync(current).isSymbolicLink()) throw new CheckProviderError("linked_check_path");
  }
  return lstatSync(value, { bigint: true });
}
function rootIdentity(value) {
  const stat = physical(value);
  if (!stat.isDirectory()) throw new CheckProviderError("unsafe_workspace");
  return Object.freeze({ canonicalPath: value, deviceId: String(stat.dev), fileId: String(stat.ino) });
}
function equalRoot(first, second) {
  return first.canonicalPath === second.canonicalPath && first.deviceId === second.deviceId && first.fileId === second.fileId;
}
function quote(value) { return JSON.stringify(value); }
function regexp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function abortError() { const error = new Error("check_cancelled"); error.name = "AbortError"; return error; }
function checkSignal(signal) {
  if (signal !== undefined && !(signal instanceof AbortSignal)) throw new TypeError("invalid_signal");
}
function safeError(error) {
  if (error instanceof CheckProviderError) return error.message;
  if (error?.code === "ENOENT") return "input_unavailable";
  if (error?.code === "EACCES" || error?.code === "EPERM") return "check_access_denied";
  return "check_infrastructure_error";
}

// Node's event reporter separates test stdout from runner events. A file wrapper is not an explicit test case.
const fixedNodeArguments = Object.freeze(["--permission", "--allow-fs-read=*", "--allow-fs-write=*", "--allow-child-process"]);
const runtimeGuardProbe = `const assert = require('node:assert/strict');
assert.equal(typeof process.permission?.has, 'function');
assert.equal(process.permission.has('inspector'), false);
assert.throws(() => new (require('node:inspector').Session)().connect(), error => error.code === 'ERR_ACCESS_DENIED');
assert.throws(() => process.binding('fs'), error => error.code === 'ERR_ACCESS_DENIED');
assert.throws(() => process.dlopen({exports:{}}, '/__legion_disabled_probe.node'), error => error.code === 'ERR_DLOPEN_DISABLED');
assert.throws(() => new (require('node:worker_threads').Worker)('0', {eval:true}), error => error.code === 'ERR_ACCESS_DENIED');
process.stdout.write(process.version);`;
const reporterSource = `import { readSync, closeSync, writeSync } from 'node:fs';
import { createHmac, createSecretKey, Hmac } from 'node:crypto';
import { Stream, Readable, Writable, Duplex, Transform } from 'node:stream';
import { EventEmitter } from 'node:events';
const stringify = JSON.stringify;
const nativeCreateHmac = createHmac;
const nativeWriteSync = writeSync;
const create = Object.create;
const apply = Reflect.apply;
const slice = Function.call.bind(String.prototype.slice);
const update = Hmac.prototype.update;
const digest = Hmac.prototype.digest;
const bytes = Buffer.alloc(32);
let offset = 0;
while (offset < 32) {
  const count = readSync(4, bytes, offset, 32 - offset, null);
  if (count === 0) throw new Error('reporter_key_unavailable');
  offset += count;
}
closeSync(4);
const key = createSecretKey(bytes);
bytes.fill(0);
let owner;
for (const [type,names] of [[EventEmitter,['emit','on','once']],[Readable,['push','read','pipe','unpipe','destroy']],[Writable,['write','end','destroy']],[Transform,['_write']]]) {
  for (const name of names) {
    const descriptor = Object.getOwnPropertyDescriptor(type.prototype,name);
    if (descriptor !== undefined) Object.defineProperty(type.prototype,name,{...descriptor,writable:false,configurable:false});
  }
}
for (const type of [Readable, Writable, Duplex, Transform]) {
  for (const name of Reflect.ownKeys(type.prototype)) {
    const descriptor = Object.getOwnPropertyDescriptor(type.prototype,name);
    if (descriptor.get !== undefined || descriptor.set !== undefined) {
      Object.defineProperty(type.prototype,name,{...descriptor,configurable:false});
    }
  }
}
let sequence = 0;
function send(record) {
  const body = stringify(record);
  const hmac = nativeCreateHmac('sha256', key);
  apply(update, hmac, [body]);
  const frame = create(null);
  frame.body = body;
  frame.mac = apply(digest, hmac, ['hex']);
  nativeWriteSync(3, stringify(frame) + '\\n');
}
export default class Reporter extends Transform {
  constructor() {
    super({writableObjectMode:true});
    if (owner !== undefined) throw new Error('reporter_already_reserved');
    owner = this;
    const initialized = create(null);
    initialized.type = 'reporter:ready'; initialized.sequence = sequence++;
    send(initialized);
  }
  _transform(event, encoding, callback) {
    if (this !== owner) throw new Error('invalid_reporter_owner');
    if (!['test:pass','test:fail','test:stdout','test:stderr'].includes(event.type)) { callback(); return; }
    const data = event.data;
    const record = create(null);
    record.sequence = sequence++;
    record.type = event.type;
    record.name = '';
    if (typeof data.name === 'string') record.name = slice(data.name,0,4096);
    record.nesting = data.nesting;
    record.detailsType = data.details?.type ?? '';
    record.skip = data.skip === true || typeof data.skip === 'string';
    record.todo = data.todo === true || typeof data.todo === 'string';
    const message = data.message ?? '';
    record.message = '';
    record.truncated = false;
    if (typeof message === 'string') {
      record.message = slice(message,0,262144); record.truncated = message.length > 262144;
    }
    if (event.type === 'test:fail') {
      const reason = data.details?.error?.message;
      if (typeof reason === 'string') record.message = slice(reason,0,262144);
    }
    send(record);
    callback();
  }
}
Object.freeze(Reporter.prototype);
`;


function privateKnownKeys(values = []) {
  if (!Array.isArray(values) || values.length > 256 || values.some(value => typeof value !== "string" || value.length === 0 || Buffer.byteLength(value) > 4096)) throw new TypeError("invalid_private_known_keys");
  return Object.freeze([...new Set(values)].map(value => Buffer.from(value, "utf8")));
}
function knownValue(bytes, keys) { return keys.some(key => bytes.includes(key)); }
function privateOrderedKeyStream(keys, emit, reject) {
  const entries = []; let total = 0; const hold = Math.max(0, ...keys.map(key => key.length - 1));
  function drain(count) {
    while (count > 0 && entries.length > 0) {
      const entry = entries[0]; const length = Math.min(count, entry.bytes.length);
      emit(entry.kind, entry.bytes.subarray(0, length)); count -= length; total -= length;
      if (length === entry.bytes.length) entries.shift(); else entry.bytes = entry.bytes.subarray(length);
    }
  }
  return {
    push(kind, bytes) {
      entries.push({ kind, bytes: Buffer.from(bytes) }); total += bytes.length;
      if (knownValue(Buffer.concat(entries.map(entry => entry.bytes)), keys)) { entries.length = 0; total = 0; reject(); }
      drain(Math.max(0, total - hold));
    },
    end() { if (knownValue(Buffer.concat(entries.map(entry => entry.bytes)), keys)) reject(); drain(total); }
  };
}
function privateKeyStream(keys, emit, reject) {
  let tail = Buffer.alloc(0); const hold = Math.max(0, ...keys.map(key => key.length - 1));
  return {
    push(bytes) {
      const value = Buffer.concat([tail, Buffer.from(bytes)]);
      if (knownValue(value, keys)) { tail = Buffer.alloc(0); reject(); }
      const count = Math.max(0, value.length - hold);
      tail = Buffer.from(value.subarray(count));
      if (count > 0) emit(value.subarray(0, count));
    },
    end() { const value = tail; tail = Buffer.alloc(0); if (knownValue(value, keys)) reject(); if (value.length > 0) emit(value); }
  };
}

export class _MacOSCheckProvider extends CheckProvider {
  #knownKeys; #root; #runtime; #output; #lockRoot; #identity; #outputIdentity; #runtimeStamp; #closed = false; #active = new Set();
  constructor(options) {
    super();
    modelRecord(options, "check provider options", ["workspaceRoot", "runtimeExecutable", "outputRoot", "lockRoot", "knownKeys"]);
    this.#knownKeys = privateKnownKeys(options.knownKeys);
    this.#root = path(options.workspaceRoot, "workspaceRoot");
    this.#runtime = path(options.runtimeExecutable, "runtimeExecutable");
    this.#output = path(options.outputRoot, "outputRoot");
    if(options.lockRoot!==undefined){this.#lockRoot=path(options.lockRoot,"lockRoot");rootIdentity(this.#lockRoot);}
    if (process.platform !== "darwin") { Object.freeze(this); return; }
    this.#runtime = realpathSync(this.#runtime);
    this.#identity = rootIdentity(this.#root);
    this.#outputIdentity = rootIdentity(this.#output);
    const runtimeStat = physical(this.#runtime);
    if (!runtimeStat.isFile()) throw new TypeError("check_runtime_file_required");
    this.#runtimeStamp = [runtimeStat.dev, runtimeStat.ino, runtimeStat.ctimeNs].join(":");
    // Approved outputs are segregated from all candidate inputs, even when hosted in a task's runtime tree.
    if (this.#output === this.#root) throw new TypeError("check_output_must_be_separate");
    Object.freeze(this);
  }
  #inputs(authorization) {
    if (!equalRoot(rootIdentity(this.#root), this.#identity) || !equalRoot(this.#identity, authorization.workspaceIdentity)) {
      throw new CheckProviderError("root_identity_changed");
    }
    if (!equalRoot(rootIdentity(this.#output), this.#outputIdentity)) throw new CheckProviderError("output_identity_changed");
    const runtime = physical(this.#runtime);
    if ([runtime.dev, runtime.ino, runtime.ctimeNs].join(":") !== this.#runtimeStamp) throw new CheckProviderError("runtime_changed");
    const versions = [];
    const identities = [];
    for (const input of authorization.inputVersions) {
      const file = join(this.#root, input.resource);
      if(input.state==="absent") {
        let stat;
        try {stat=lstatSync(file);}catch(error){if(error.code!=="ENOENT")throw error;}
        if(stat!==undefined)throw new CheckProviderError("input_changed");
        let ancestor=dirname(file);while(ancestor.startsWith(this.#root+"/")){try{physical(ancestor);break;}catch(error){if(error.code!=="ENOENT")throw error;ancestor=dirname(ancestor);}}
        versions.push(Object.freeze({resource:input.resource,state:"absent",sha256:null,byteLength:0}));identities.push(input.resource+":absent");continue;
      }
      const stat = physical(file);
      if (!stat.isFile()) throw new CheckProviderError("input_not_file");
      const data = readFileSync(file);
      if (knownValue(data, this.#knownKeys)) throw new CheckProviderError("known_key_input_rejected");
      const after = physical(file);
      if (stat.ino !== after.ino || stat.ctimeNs !== after.ctimeNs || stat.mtimeNs !== after.mtimeNs ||
          stat.size !== after.size) throw new CheckProviderError("input_changed");
      const sha256 = createHash("sha256").update(data).digest("hex");
      if (input.sha256 !== sha256 || input.byteLength !== data.byteLength) throw new CheckProviderError("input_changed");
      versions.push(Object.freeze({ resource: input.resource, sha256, byteLength: data.byteLength }));
      identities.push([input.resource, String(after.dev), String(after.ino), String(after.ctimeNs), String(after.mtimeNs)].join(":"));
    }
    return { versions, identity: identities.join("\n") };
  }
  #profile(runRoot, spec, reporter, authorization) {
    const output = join(runRoot, "outputs");
    const temp = join(runRoot, "tmp");
    const allowRead = ["/System", "/usr/lib", "/usr/share", "/dev", output, temp];
    const lines = ["(version 1)", "(deny default)", '(import "dyld-support.sb")', "(allow syscall*)", "(deny syscall-unix (syscall-number SYS_setsid SYS_setpgid SYS_link SYS_linkat))", "(allow mach-bootstrap)", "(deny process-fork)",
      "(allow process-exec (literal " + quote(this.#runtime) + "))", "(allow signal (target same-sandbox))",
      "(allow sysctl-read)", "(allow mach-lookup)", "(allow file-read-metadata)",
      "(allow file-map-executable)", "(allow process-info* (target self))"];
    for (const allowed of allowRead) lines.push("(allow file-read* (subpath " + quote(allowed) + "))");
    lines.push("(allow file-read* (literal " + quote(reporter) + ") (literal " + quote(this.#runtime) + "))");
    if (this.#runtime.endsWith("/Electron")) {
      lines.push("(allow file-read* (subpath " + quote(resolve(dirname(this.#runtime), "../Frameworks")) + "))");
    }
    lines.push("(allow file-read* (literal " + quote(this.#root) + "))");
    for (const input of authorization.inputVersions) {
      lines.push("(allow file-read* (literal " + quote(join(this.#root, input.resource)) + "))");
      let parent = dirname(join(this.#root, input.resource));
      while (parent !== this.#root && parent.startsWith(this.#root + "/")) {
        lines.push("(allow file-read* (literal " + quote(parent) + "))");
        parent = dirname(parent);
      }
    }
    lines.push('(allow file-read-data file-write-data (subpath "/dev/fd"))');
    lines.push("(allow file-write* (subpath " + quote(temp) + ") (literal \"/dev/null\"))");
    for (const resource of spec.outputResources) {
      const full = join(output, resource);
      let parents = dirname(full);
      if (resource.endsWith("/")) parents = full;
      mkdirSync(parents, { recursive: true });
      physical(resolve(parents));
      let filter = "literal";
      if (resource.endsWith("/")) filter = "subpath";
      lines.push("(allow file-write* (" + filter + " " + quote(full.replace(/\/$/, "")) + "))");
    }
    const protectedNames = "\\.(ans|git|agents|codex|aws|ssh|docker|kube|gnupg|azure|gcloud|terraform|terraform\\.d)";
    const root = regexp(this.#root);
    // Profile regexes cover protected components at every depth inside this candidate.
    lines.push('(deny file-read* file-write* (regex #' + quote('^' + root + '/(.*/)?' + protectedNames + '(/|$)') + '))');
    lines.push('(deny file-read* file-write* (regex #' + quote('^' + root + '/(.*/)?(\\.env(\\..*)?|\\.npmrc|\\.netrc|\\.git-credentials|id_rsa|id_ed25519|[^/]*\\.(pem|key|p12|pfx|jks|keystore))$') + '))');
    if (spec.network === "localhost") lines.push('(allow network* (local ip "localhost:*") (remote ip "localhost:*"))');
    return lines.join("\n");
  }
  #terminate(child) {
    // The fixed runner executes tests in process; macOS denies every child process creation.
    try { process.kill(-child.pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; }
  }
  async #spawn(argv, env, profile, { signal, timeoutSeconds, onData, onTick, onSpawn, reporterKey }) {
    if (signal?.aborted || this.#closed) throw abortError();
    return await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(sandbox, ["-p", profile, ...argv], { cwd: this.#root, env, detached: true,
        stdio: ["ignore", "pipe", "pipe", "pipe", "pipe"] });
      child.stdio[4].on("error", () => stop("reporter_key_pipe_failed"));
      if (reporterKey !== undefined) child.stdio[4].end(reporterKey); else child.stdio[4].end();
      if (child.pid !== undefined) onSpawn?.();
      let termination = ""; let settled = false;
      const stop = (reason) => {
        if (settled || termination !== "") return;
        termination = reason;
        if (child.pid !== undefined) this.#terminate(child);
      };
      const handle = { stop, child };
      this.#active.add(handle);
      const cancel = () => stop("cancelled");
      signal?.addEventListener("abort", cancel, { once: true });
      const timeout = setTimeout(() => stop("timeout"), timeoutSeconds * 1000);
      const poll = setInterval(() => {
        try { onTick?.(); } catch (error) { stop(safeError(error)); }
      }, 50);
      const finish = () => {
        settled = true; clearTimeout(timeout); clearInterval(poll);
        signal?.removeEventListener("abort", cancel); this.#active.delete(handle);
      };
      const outputFailure = error => {
        let reason = "invalid_reporter_events";
        if (error instanceof CheckProviderError && error.message === "known_key_output_rejected") reason = error.message;
        stop(reason);
      };
      child.stdout.on("data", (chunk) => { try { onData("stdout", chunk); } catch (error) { outputFailure(error); } });
      child.stderr.on("data", (chunk) => { try { onData("stderr", chunk); } catch (error) { outputFailure(error); } });
      child.stdio[3].on("data", (chunk) => { try { onData("events", chunk); } catch (error) { outputFailure(error); } });
      child.once("error", (error) => { finish(); rejectPromise(error); });
      child.once("close", (code) => {
        // Terminate any remaining members after the runner exits as well as on cancellation.
        if (child.pid !== undefined) this.#terminate(child);
        finish(); resolvePromise({ exitCode: code, termination, signalCode: child.signalCode });
      });
    });
  }
  async #acquireLock(signal,timeoutSeconds) {
    if(this.#lockRoot===undefined)return undefined;
    physical(this.#lockRoot);const lock=join(this.#lockRoot,digestValue(this.#identity));const nonce=randomBytes(32).toString("hex");const end=Date.now()+timeoutSeconds*1000;
    for(;;){if(signal?.aborted || this.#closed)throw abortError();try{mkdirSync(lock,{mode:0o700});break;}catch(error){if(error.code!=="EEXIST")throw error;if(Date.now()>=end)throw new CheckProviderError("check_resource_lock_timeout");await new Promise(resolve=>setTimeout(resolve,25));}}
    writeFileSync(join(lock,"owner"),nonce,{flag:"wx",mode:0o600});return {lock,nonce};
  }
  #releaseLock(lease){if(lease===undefined)return;physical(lease.lock);if(readFileSync(join(lease.lock,"owner"),"utf8")!==lease.nonce)throw new CheckProviderError("check_lock_owner_changed");unlinkSync(join(lease.lock,"owner"));rmdirSync(lease.lock);}
  get runtimeExecutable() { return this.#runtime; }
  notExecuted(request, authorization, status, reason) {
    const spec = authorization.approvedChecks.find((value) => value.checkId === request.checkId);
    const time = new Date().toISOString();
    return new CheckResult({ requestId: request.requestId, runId: request.runId, checkId: request.checkId,
      authorizationDigest: authorization.digest, specDigest: spec?.digest ?? digestValue({ checkId: request.checkId }),
      status, reason, executed: false, actualArgv: [], exitCode: null, testCount: 0, stdout: "", stderr: "",
      logsTruncated: false, inputVersions: [], environment: null, startedAt: time, finishedAt: time });
  }
  async run(request, authorization, { signal } = {}) {
    if (!(request instanceof CheckRequest) || !(authorization instanceof CheckAuthorization)) {
      throw new TypeError("typed_check_request_authorization_required");
    }
    checkSignal(signal);
    const startedAt = new Date().toISOString();
    const spec = authorization.approvedChecks.find((value) => value.checkId === request.checkId);
    if (spec === undefined || request.runId !== authorization.runId) throw new TypeError("check_authorization_binding_mismatch");
    let lease;let inputVersions = []; let baseline; let executed = false; let actualArgv = []; let environment = null;
    let stdout = ""; let stderr = ""; let logsTruncated = false; let testCount = 0;
    const finish = (status, reason, exitCode = null) => new CheckResult({ requestId: request.requestId,
      runId: request.runId, checkId: request.checkId, authorizationDigest: authorization.digest, specDigest: spec.digest,
      status, reason, executed, actualArgv, exitCode, testCount, stdout, stderr, logsTruncated, inputVersions,
      environment, startedAt, finishedAt: new Date().toISOString() });
    const store = (kind, text) => {
      const existing = Buffer.byteLength(stdout + stderr, "utf8");
      const data = Buffer.from(text, "utf8");
      const remaining = Math.max(0, spec.logMaxBytes - existing);
      let content = data.subarray(0, remaining).toString("utf8");
      while (Buffer.byteLength(content, "utf8") > remaining) content = content.slice(0, -1);
      if (data.byteLength > remaining) logsTruncated = true;
      if (kind === "stdout") stdout += content; else stderr += content;
    };
    const storedDecoders = { stdout: new StringDecoder("utf8"), stderr: new StringDecoder("utf8") };
    const rejectKey = () => { stdout = ""; stderr = ""; throw new CheckProviderError("known_key_output_rejected"); };
    const streams = Object.fromEntries(["stdout", "stderr"].map(kind => [kind, privateKeyStream(this.#knownKeys, bytes => store(kind, storedDecoders[kind].write(bytes)), rejectKey)]));
    const ordered = privateOrderedKeyStream(this.#knownKeys, (kind, bytes) => streams[kind].push(bytes), rejectKey);
    const append = (kind, text) => ordered.push(kind, Buffer.from(text, "utf8"));
    try {
      if (this.#closed || signal?.aborted) return finish("cancelled", "check_cancelled");
      if (process.platform !== "darwin") return finish("unsupported", "macos_isolation_required");
      lease=await this.#acquireLock(signal,spec.timeoutSeconds);
      baseline = this.#inputs(authorization); inputVersions = baseline.versions;
      if (!lstatSync(sandbox).isFile()) return finish("unsupported", "sandbox_unavailable");
      if (!/^(node|Electron)$/.test(this.#runtime.split("/").at(-1))) return finish("unsupported", "node_runtime_required");
      const runRoot = mkdtempSync(join(this.#output, "check-")); physical(runRoot);
      const temp = join(runRoot, "tmp"); const output = join(runRoot, "outputs");
      mkdirSync(temp); mkdirSync(output);
      const reporter = join(runRoot, "reporter.mjs"); writeFileSync(reporter, reporterSource, { flag: "wx", mode: 0o400 });
      const profile = this.#profile(runRoot, spec, reporter, authorization);
      const env = { PATH: "/usr/bin:/bin", LANG: "en_US.UTF-8", TMPDIR: temp, TMP: temp, TEMP: temp,
        ELECTRON_RUN_AS_NODE: "1", LEGION_CHECK_OUTPUT_ROOT: output };
      let version = ""; let probeError = "";
      const probe = await this.#spawn([this.#runtime, ...fixedNodeArguments, "--test-isolation=none", "--eval", runtimeGuardProbe], env, profile, { signal, timeoutSeconds: Math.min(3, spec.timeoutSeconds),
        onData(kind, chunk) { if (kind === "stdout") version = (version + chunk.toString("utf8")).slice(0, 256); else probeError = (probeError + chunk.toString("utf8")).slice(0, 1024); },
        onTick: () => { if (this.#inputs(authorization).identity !== baseline.identity) throw new CheckProviderError("input_changed"); } });
      if (probe.termination === "cancelled" || probe.termination === "timeout") return finish("cancelled", probe.termination);
      if (probe.termination !== "") return finish("stale", probe.termination);
      if (probe.exitCode !== 0 || !/^v\d+\.\d+\.\d+\s*$/.test(version)) {
        append("stderr", probeError + "runtime_probe_exit=" + String(probe.exitCode) + ";signal=" + String(probe.signalCode));
        return finish("unsupported", "isolation_or_node_runtime_unavailable");
      }
      // Fixed host reporter is infrastructure configuration, never a model-provided command or reporter.
      const runnerArgv = [this.#runtime, ...fixedNodeArguments, "--test-isolation=none", "--test-reporter=" + reporter, ...spec.argv];
      const runnerEnvironment = { platform: process.platform, runtime: "node", runtimeVersion: version.trim(),
        isolation: "macos-seatbelt+node-events-v1+no-child-process", network: spec.network };
      let pending = "";
      const reporterKey = randomBytes(32);
      let expectedSequence = 0;
      let ready = false;
      let failures = 0;
      const eventsDecoder = new StringDecoder("utf8");
      const errorDecoder = new StringDecoder("utf8");
      const outputDecoder = new StringDecoder("utf8");
      const wrappers = new Set(spec.testResources.flatMap((resource) => [resource, join(this.#root, resource)]));
      const remaining = spec.timeoutSeconds - (Date.now() - Date.parse(startedAt)) / 1000;
      if (remaining <= 0) return finish("cancelled", "timeout");
      const outcome = await this.#spawn(runnerArgv, env, profile, { signal, timeoutSeconds: remaining, reporterKey,
        onSpawn: () => { executed = true; actualArgv = runnerArgv; environment = runnerEnvironment; },
        onTick: () => { if (this.#inputs(authorization).identity !== baseline.identity) throw new CheckProviderError("input_changed"); },
        onData: (kind, chunk) => {
          if (kind === "stderr") { append(kind, errorDecoder.write(chunk)); return; }
          if (kind === "stdout") { append(kind, outputDecoder.write(chunk)); return; }
          pending += eventsDecoder.write(chunk);
          if (Buffer.byteLength(pending, "utf8") > 2097152) throw new CheckProviderError("invalid_reporter_events");
          let end;
          while ((end = pending.indexOf("\n")) >= 0) {
            const frame = JSON.parse(pending.slice(0, end)); pending = pending.slice(end + 1);
            if (frame === null || typeof frame !== "object" || typeof frame.body !== "string" ||
                typeof frame.mac !== "string" || !/^[a-f0-9]{64}$/.test(frame.mac)) {
              throw new CheckProviderError("unauthenticated_reporter_events");
            }
            const expected = createHmac("sha256", reporterKey).update(frame.body).digest();
            if (!timingSafeEqual(expected, Buffer.from(frame.mac, "hex"))) throw new CheckProviderError("unauthenticated_reporter_events");
            const event = JSON.parse(frame.body);
            if (knownValue(Buffer.from(JSON.stringify(event)), this.#knownKeys)) rejectKey();
            if (event.sequence !== expectedSequence++) throw new CheckProviderError("invalid_reporter_sequence");
            if (event.type === "reporter:ready") {
              if (ready || event.sequence !== 0) throw new CheckProviderError("invalid_reporter_sequence");
              ready = true; continue;
            }
            if (!ready) throw new CheckProviderError("reporter_not_initialized");
            if (event.type === "test:fail") failures += 1;
            if (["test:pass", "test:fail"].includes(event.type) && event.detailsType !== "suite" &&
                !event.skip && !event.todo && !wrappers.has(event.name)) testCount += 1;
            if (["test:stdout", "test:stderr", "test:fail"].includes(event.type)) append("stdout", event.message);
            if (event.truncated === true) logsTruncated = true;
          }
        } });
      pending += eventsDecoder.end();
      append("stderr", errorDecoder.end());
      append("stdout", outputDecoder.end());
      ordered.end(); streams.stdout.end(); streams.stderr.end(); store("stdout", storedDecoders.stdout.end()); store("stderr", storedDecoders.stderr.end());
      reporterKey.fill(0);
      if (outcome.termination === "cancelled" || outcome.termination === "timeout") return finish("cancelled", outcome.termination, outcome.exitCode);
      if (outcome.termination === "known_key_output_rejected") { stdout = ""; stderr = ""; return finish("error", "known_key_output_rejected", outcome.exitCode); }
      if (outcome.termination !== "") {
        if (outcome.termination === "invalid_reporter_events") return finish("error", outcome.termination, outcome.exitCode);
        return finish("stale", outcome.termination, outcome.exitCode);
      }
      if (this.#inputs(authorization).identity !== baseline.identity) return finish("stale", "input_changed", outcome.exitCode);
      if (pending !== "") return finish("error", "incomplete_reporter_events", outcome.exitCode);
      if (outcome.exitCode === null) return finish("error", "runner_terminated", null);
      if (outcome.exitCode !== 0) return finish("failed", "tests_failed", outcome.exitCode);
      if (!ready) return finish("error", "reporter_not_initialized", 0);
      if (failures !== 0) return finish("error", "test_failures_observed", 0);
      if (testCount === 0) return finish("error", "no_tests_executed", 0);
      return finish("passed", "tests_passed", 0);
    } catch (error) {
      if (error?.name === "AbortError") return finish("cancelled", "check_cancelled");
      const reason = safeError(error);
      if (["root_identity_changed", "input_changed", "input_unavailable", "linked_check_path", "output_identity_changed", "runtime_changed"].includes(reason)) return finish("stale", reason);
      if (!executed && (error?.code === "ENOENT" || error?.code === "EPERM")) return finish("unsupported", "isolation_unavailable");
      return finish("error", reason);
    } finally { this.#releaseLock(lease); }
  }
  async close() {
    this.#closed = true;
    const running = [...this.#active];
    for (const handle of running) handle.stop("cancelled");
    await Promise.all(running.map(({ child }) => new Promise((resolvePromise) => {
      if (child.exitCode !== null || child.signalCode !== null) resolvePromise(); else child.once("close", resolvePromise);
    })));
  }
}
