import { ShellProvider, ShellProviderError } from "../abstract/shell.mjs";
import { ShellRequest, ShellAuthorization, ShellPreparation, ShellResult, ShellCandidate, FileBaseline,
  _isShellExecutionAuthority, shellArtifacts } from "../../models/shell.mjs";
import { modelRecord, modelString, normalizeProjectReadResource, digestValue } from "../../models/core.mjs";
import nodeFs, { promises as fs, constants, existsSync, realpathSync, lstatSync, readFileSync, readdirSync, renameSync } from "node:fs";
import { resolve, join, dirname, relative, isAbsolute } from "node:path";
import { StringDecoder } from "node:string_decoder";
import { spawn } from "node:child_process";
import { randomUUID, createHash } from "node:crypto";

// Host-only helper. Permission signature identifies the inherited OS sandbox, independent of ancestry/group.
// sandbox_init/apply/extension MAC calls remain default-denied except dyld's fixed check operation.
const nativeSource = `#include <libproc.h>
#include <sandbox.h>
#include <unistd.h>
#include <signal.h>
#include <sys/wait.h>
#include <spawn.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <errno.h>
#include <fcntl.h>
#include <servers/bootstrap.h>
#include <mach/mach.h>
#include <sys/sysctl.h>
extern int sandbox_check(pid_t,const char*,int,...);
extern void *sandbox_compile_string(const char*,void*,char**);
extern int sandbox_apply(void*);
extern void sandbox_free_profile(void*);
extern char **environ;
int main(int argc,char **argv){
 if(argc==2 && strcmp(argv[1],"security")==0){mach_port_t port=MACH_PORT_NULL;int keychain=bootstrap_look_up(bootstrap_port,"com.apple.securityd",&port);if(keychain==0)mach_port_deallocate(mach_task_self(),port);port=MACH_PORT_NULL;int launch=bootstrap_look_up(bootstrap_port,"com.apple.launchd",&port);if(launch==0)mach_port_deallocate(mach_task_self(),port);int task=task_for_pid(mach_task_self(),getppid(),&port);if(task==0)mach_port_deallocate(mach_task_self(),port);size_t size=0;int args=sysctlbyname("kern.procargs2",NULL,&size,NULL,0);int extra=fcntl(3,F_GETFD);int uid=setuid(0);int gid=setgid(0);printf("uid=%d gid=%d keychain=%d launch=%d task=%d procargs=%d fd3=%d\\n",uid,gid,keychain,launch,task,args,extra);if(uid==0 || gid==0 || keychain==0 || launch==0 || task==0 || args==0 || extra!=-1)return 4;return 0;}
 if(argc==2 && strcmp(argv[1],"nested")==0){char *err=NULL;int rc=sandbox_init("(version 1)(deny default)",0,&err);if(err)sandbox_free_error(err);err=NULL;void *compiled=sandbox_compile_string("(version 1)(deny default)",NULL,&err);if(!compiled)return 5;int applied=sandbox_apply(compiled);sandbox_free_profile(compiled);if(err)sandbox_free_error(err);printf("nested=%d apply=%d\\n",rc,applied);if(rc==0 || applied==0)return 3;return 0;}
 if(argc==2 && strcmp(argv[1],"escape")==0){posix_spawnattr_t attr;posix_spawnattr_init(&attr);posix_spawnattr_setflags(&attr,POSIX_SPAWN_SETPGROUP);posix_spawnattr_setpgroup(&attr,0);pid_t pid=0;char *args[]={"/bin/sleep","20",NULL};posix_spawn_file_actions_t fa;posix_spawn_file_actions_init(&fa);posix_spawn_file_actions_addopen(&fa,1,"/dev/null",O_WRONLY,0);posix_spawn_file_actions_addopen(&fa,2,"/dev/null",O_WRONLY,0);int rc=posix_spawn(&pid,"/bin/sleep",&fa,&attr,args,environ);printf("spawn=%d child=%d group=%d parent=%d\\n",rc,pid,getpgid(pid),getpgrp());fflush(stdout);return rc;}
 if(argc!=4)return 64;
 int capacity=proc_listallpids(NULL,0)+4096;pid_t *pids=calloc(capacity,sizeof(pid_t));if(!pids)return 65;
 int count=proc_listallpids(pids,capacity*sizeof(pid_t));if(count<=0){free(pids);return 66;}
 for(int i=0;i<count && i<capacity;i++){pid_t pid=pids[i];if(pid<=1 || pid==getpid())continue;
  if(sandbox_check(pid,"file-read-data",1,argv[1])!=0 || sandbox_check(pid,"file-read-data",1,argv[2])!=1)continue;
  struct proc_bsdinfo before,after;if(proc_pidinfo(pid,PROC_PIDTBSDINFO,0,&before,sizeof(before))!=sizeof(before))continue;
  if(sandbox_check(pid,"file-read-data",1,argv[1])!=0 || sandbox_check(pid,"file-read-data",1,argv[2])!=1)continue;
  if(proc_pidinfo(pid,PROC_PIDTBSDINFO,0,&after,sizeof(after))!=sizeof(after) || before.pbi_start_tvsec!=after.pbi_start_tvsec || before.pbi_start_tvusec!=after.pbi_start_tvusec)continue;
  printf("%d %llu %llu\\n",pid,(unsigned long long)after.pbi_start_tvsec,(unsigned long long)after.pbi_start_tvusec);
  int sig=0;if(strcmp(argv[3],"freeze")==0)sig=SIGSTOP;else if(strcmp(argv[3],"kill")==0)sig=SIGKILL;
  if(sig!=0 && kill(pid,sig)!=0 && errno!=ESRCH){free(pids);return 67;}
 }
 free(pids);return 0;
}`;
function requireNames(directory){return readdirSync(directory);}
function fail(reason) { throw new ShellProviderError(reason); }
function inside(root,path) { return path === root || path.startsWith(root + "/"); }
function physical(path) {
  const absolute=resolve(path);
  if (realpathSync(absolute)!==absolute) fail("linked_shell_path");
  let current=absolute;
  for (;;) { if(lstatSync(current).isSymbolicLink()) fail("linked_shell_path");const parent=dirname(current);if(parent===current)break;current=parent; }
  return lstatSync(absolute,{bigint:true});
}
function rootIdentity(path) { const stat=physical(path);if(!stat.isDirectory())fail("shell_root_not_directory");return {canonicalPath:path,deviceId:String(stat.dev),fileId:String(stat.ino)}; }
function sha(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function safeReason(error) {
  if(error instanceof ShellProviderError)return error.message;
  if(error?.code==="ENOENT")return "shell_input_unavailable";
  if(["EPERM","EACCES"].includes(error?.code))return "shell_access_denied";
  return "shell_infrastructure_error";
}
function scrub(text) { return text.replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g,"").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,"").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g,""); }
function sleep(ms,signal) { return new Promise((res,rej)=>{const timer=setTimeout(done,ms);function done(){signal?.removeEventListener("abort",abort);res();}function abort(){clearTimeout(timer);signal?.removeEventListener("abort",abort);rej(new ShellProviderError("shell_cancelled"));}if(signal?.aborted)abort();else signal?.addEventListener("abort",abort,{once:true});}); }
async function regularBytes(path) {
  const before=await fs.lstat(path,{bigint:true});
  if(!before.isFile() || before.nlink!==1n || (before.mode & 0o6000n)!==0n)fail("unsafe_shell_regular_file");
  const fd=await fs.open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const opened=await fd.stat({bigint:true});
    if(opened.size>1073741824n)fail("shell_file_budget");
    const data=await fd.readFile();const after=await fd.stat({bigint:true});const current=await fs.lstat(path,{bigint:true});
    if(["dev","ino","size","mtimeNs","ctimeNs","nlink"].some((key)=>before[key]!==opened[key] || opened[key]!==after[key] || after[key]!==current[key]))fail("shell_input_changed");
    return {data,sha256:sha(data),byteLength:data.length,executable:(before.mode & 0o111n)!==0n};
  } finally { await fd.close(); }
}
function allowedEffect(resource,effects) { return effects.find((scope)=>resource===scope.slice(0,-1) || resource.startsWith(scope)); }
async function tree(root,effects,{excludeProtected=false,copyTo,signal,knownKeys=[]}={}) {
  const files=new Map();const directories=new Set();let bytes=0;let count=0;
  async function visit(resource) {
    if(signal?.aborted)fail("shell_cancelled");
    if(count>1000000)fail("shell_snapshot_budget");
    const path=join(root,resource);
    if(resource!=="") {
      try { normalizeProjectReadResource(resource); }
      catch(error){if(error instanceof TypeError && excludeProtected)return;throw error;}
    }
    const stat=await fs.lstat(path,{bigint:true});
    if((stat.mode & 0o6000n)!==0n)fail("unsafe_shell_permissions");
    if(stat.isDirectory()) {
      directories.add(resource);count+=1;
      if(resource!=="")files.set(resource,{kind:"directory",sha256:digestValue({kind:"directory"}),byteLength:0,executable:false});
      if(copyTo)await fs.mkdir(join(copyTo,resource),{recursive:true,mode:0o700});
      const names=await fs.readdir(path);const aliases=new Set();
      for(const name of names.sort()) {
        const key=name.toLowerCase();if(aliases.has(key))fail("shell_ambiguous_case");aliases.add(key);
        let child=name;if(resource!=="")child=resource+"/"+name;await visit(child);
      }
      const after=await fs.lstat(path,{bigint:true});
      if(["dev","ino","mtimeNs","ctimeNs"].some((key)=>stat[key]!==after[key]))fail("shell_input_changed");
    } else if(stat.isSymbolicLink()) {
      const scope=allowedEffect(resource,effects);if(scope===undefined)fail("shell_source_symlink");
      const target=await fs.readlink(path);
      if(isAbsolute(target))fail("shell_absolute_symlink");
      let resolved;
      try {resolved=await fs.realpath(path);} catch(error){throw new ShellProviderError("shell_broken_or_cyclic_link",{cause:error});}
      if(!inside(join(root,scope.slice(0,-1)),resolved))fail("shell_escaping_symlink");
      normalizeProjectReadResource(relative(root,resolved));
      const real=await fs.lstat(resolved,{bigint:true});if(!real.isFile() || real.nlink!==1n)fail("unsafe_shell_link_target");
      files.set(resource,{kind:"symlink",target,sha256:sha(Buffer.from(target)),byteLength:0,executable:false});
      if(copyTo) {await fs.mkdir(dirname(join(copyTo,resource)),{recursive:true});await fs.symlink(target,join(copyTo,resource));}
    } else if(stat.isFile()) {
      const data=await regularBytes(path);if(copyTo && knownValue(data.data,knownKeys))fail("shell_known_key_input_rejected");files.set(resource,{kind:"file",sha256:data.sha256,byteLength:data.byteLength,executable:data.executable});bytes+=data.byteLength;count+=1;
      if(bytes>4294967296 || count>1000000)fail("shell_snapshot_budget");
      if(copyTo)await fs.writeFile(join(copyTo,resource),data.data,{flag:"wx",mode:0o600});
      if(copyTo && data.executable)await fs.chmod(join(copyTo,resource),0o700);
    } else fail("shell_special_file");
  }
  await visit("");return {files,directories};
}
function baselines(files) { return [...files].filter(([,value])=>value.kind==="file").map(([resource,value])=>new FileBaseline({resource,state:"present",sha256:value.sha256,byteLength:value.byteLength,executable:value.executable})); }
function generation(files,effects) { return digestValue([...files].filter(([resource])=>allowedEffect(resource,effects)!==undefined).map(([resource,value])=>({resource,kind:value.kind,sha256:value.sha256,target:value.target,executable:value.executable}))); }


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

export class _MacOSShellProvider extends ShellProvider {
  #knownKeys;#root;#output;#runtime;#privileged=new Set();#authority;#identity;#outputIdentity;#prepared=new Map();#closed=false;#active=new Set();#native;#nativePromise;#disabled=false;#lockRoot;#npm;#previewMax;#artifacts;
  constructor(options) {
    super();modelRecord(options,"shell provider options",["workspaceRoot","runtimeExecutable","outputRoot","_authority","lockRoot","npmCli","previewMaxBytes","artifactScopes","knownKeys"]);
    for(const field of ["workspaceRoot","runtimeExecutable","outputRoot"])if(!isAbsolute(modelString(options[field],field)))throw new TypeError("absolute_shell_config_required");
    this.#knownKeys=privateKnownKeys(options.knownKeys);
    this.#root=resolve(options.workspaceRoot);this.#output=resolve(options.outputRoot);this.#runtime=realpathSync(options.runtimeExecutable);
    this.#identity=rootIdentity(this.#root);this.#outputIdentity=rootIdentity(this.#output);
    if(typeof options.lockRoot!=="string" || !isAbsolute(options.lockRoot))throw new TypeError("trusted_project_lock_root_required");
    this.#lockRoot=resolve(options.lockRoot);rootIdentity(this.#lockRoot);
    this.#artifacts=shellArtifacts(options.artifactScopes);
    this.#previewMax=options.previewMaxBytes ?? 8192;
    if(!Number.isSafeInteger(this.#previewMax) || this.#previewMax<1 || this.#previewMax>65536)throw new TypeError("shell_preview_budget");
    this.#npm=null;
    let npmCli=options.npmCli;
    if(npmCli===undefined){const installed=resolve(dirname(this.#runtime),"../lib/node_modules/npm/bin/npm-cli.js");if(existsSync(installed))npmCli=installed;}
    if(npmCli!==undefined){this.#npm=realpathSync(npmCli);if(!physical(this.#npm).isFile())throw new TypeError("trusted_npm_cli_file_required");}
    if(this.#root===this.#output || inside(this.#output,this.#root))throw new TypeError("separate_shell_output_required");
    if(options._authority!==undefined && !_isShellExecutionAuthority(options._authority))throw new TypeError("branded_shell_authority_required");
    this.#authority=options._authority;
    if(process.platform==="darwin")for(const directory of ["/bin","/usr/bin"])for(const name of requireNames(directory)) {
      const file=join(directory,name);const stat=lstatSync(file);
      if(stat.isFile() && (stat.mode & 0o6000)!==0)this.#privileged.add(file);
    }
    Object.freeze(this);
  }
  observeTime(){return Date.now();}
  #roots(){if(digestValue(rootIdentity(this.#root))!==digestValue(this.#identity) || digestValue(rootIdentity(this.#output))!==digestValue(this.#outputIdentity))fail("shell_root_identity_changed");}
  async #command(argv,{cwd,env,signal,timeout=10000,onOutput,onExit}={}) {
    return await new Promise((resolvePromise,rejectPromise)=>{
      const child=spawn(argv[0],argv.slice(1),{cwd,env,stdio:["ignore","pipe","pipe"],detached:false});let stdout="";let stderr="";let stopped=false;let channelError=false;let totalBytes=0;let exitHook=Promise.resolve();
      const stop=()=>{stopped=true;if(child.pid!==undefined)child.kill("SIGKILL");};const timer=setTimeout(stop,timeout);
      signal?.addEventListener("abort",stop,{once:true});
      let keyRejected=false;
      const rejectKey=()=>{keyRejected=true;stdout="";stderr="";throw new ShellProviderError("shell_known_key_output_rejected");};
      const decoders={stdout:new StringDecoder("utf8"),stderr:new StringDecoder("utf8")};
      const storedDecoders={stdout:new StringDecoder("utf8"),stderr:new StringDecoder("utf8")};
      const store=(kind,chunk)=>{
        const text=storedDecoders[kind].write(chunk);const clean=Buffer.from(text);
        const limited=clean.subarray(0,Math.max(0,1048576-totalBytes));totalBytes+=limited.length;
        if(kind==="stdout")stdout+=limited.toString("utf8");else stderr+=limited.toString("utf8");
        if(clean.length>0)onOutput?.(kind,clean);
      };
      const cleanOrdered=privateOrderedKeyStream(this.#knownKeys,store,rejectKey);
      const sanitized=Object.fromEntries(["stdout","stderr"].map(kind=>[kind,privateKeyStream(this.#knownKeys,bytes=>cleanOrdered.push(kind,bytes),rejectKey)]));
      const guarded=Object.fromEntries(["stdout","stderr"].map(kind=>[kind,privateKeyStream(this.#knownKeys,bytes=>sanitized[kind].push(Buffer.from(scrub(decoders[kind].write(bytes)))),rejectKey)]));
      const rawOrdered=privateOrderedKeyStream(this.#knownKeys,(kind,bytes)=>guarded[kind].push(bytes),rejectKey);
      const data=(kind,chunk)=>{if(keyRejected)return;try{rawOrdered.push(kind,chunk);}catch(error){channelError=true;stop();}};
      child.stdout.on("data",chunk=>data("stdout",chunk));child.stderr.on("data",chunk=>data("stderr",chunk));
      const cleanup=()=>{clearTimeout(timer);signal?.removeEventListener("abort",stop);};
      child.once("exit",()=>{exitHook=Promise.resolve(onExit?.()).catch(error=>{channelError=true;stop();});});
      child.once("error",error=>{cleanup();rejectPromise(error);});child.once("close",async code=>{await exitHook;try{if(!keyRejected){rawOrdered.end();for(const kind of ["stdout","stderr"]){guarded[kind].end();sanitized[kind].push(Buffer.from(scrub(decoders[kind].end())));sanitized[kind].end();}cleanOrdered.end();}}catch(error){channelError=true;stop();}cleanup();resolvePromise({code,stdout,stderr,stopped,channelError,keyRejected,pid:child.pid});});
    });
  }
  async #nativeHelper(){
    if(this.#nativePromise!==undefined)return await this.#nativePromise;
    this.#nativePromise=(async()=>{
      const directory=await fs.mkdtemp(join(this.#output,"shell-native-"));const source=join(directory,"membership.c");const executable=join(directory,"membership");
      await fs.writeFile(source,nativeSource,{flag:"wx",mode:0o600});
      const compiler="/Library/Developer/CommandLineTools/usr/bin/clang";const sdk="/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk";
      const value=await this.#command([compiler,"-w","-isysroot",sdk,"-o",executable,source,"-lsandbox"],{cwd:directory,env:{PATH:"/usr/bin:/bin",TMPDIR:directory},timeout:20000});
      if(value.code!==0)fail("shell_native_supervisor_unavailable");await fs.chmod(executable,0o500);this.#native=executable;return executable;
    })();return await this.#nativePromise;
  }
  #profile(entry,request,{probe=false}={}) {
    const quote=JSON.stringify;
    const lines=['(version 1)','(deny default)','(import "dyld-support.sb")','(allow syscall*)','(deny syscall-unix (syscall-number SYS_setsid SYS_setpgid SYS_link SYS_linkat SYS_setuid SYS_setgid SYS_setreuid SYS_setregid SYS_setgroups))','(deny file-link)','(allow process-fork)','(allow process-exec)','(allow signal (target same-sandbox))','(allow process-info* (target self))','(allow sysctl-read (sysctl-name-regex #"^(hw\\.|kern\\.(ostype|osrelease|osversion|version|maxfilesperproc|hostname)$|machdep\\.cpu\\.)"))'];
    for(const file of this.#privileged)lines.push('(deny process-exec (literal '+quote(file)+'))');
    for(const file of ["/usr/bin/sudo","/usr/bin/su","/usr/bin/login","/usr/bin/crontab","/usr/bin/at","/usr/bin/batch","/System/Library/CoreServices/RemoteManagement/ARDAgent.app/Contents/MacOS/ARDAgent"])lines.push('(deny process-exec (literal '+quote(file)+'))');
    for(const path of ["/System/Library","/usr/lib","/usr/share","/bin","/usr/bin",entry.mirror,entry.home,entry.temp])lines.push('(allow file-read* file-map-executable (subpath '+quote(path)+'))');
    lines.push('(allow file-read* file-map-executable (literal '+quote(this.#runtime)+'))');
    if(this.#runtime.endsWith("/Electron")) {
      const frameworks=resolve(dirname(this.#runtime),"../Frameworks");physical(frameworks);lines.push('(allow file-read* file-map-executable (subpath '+quote(frameworks)+'))');
    }
    if(this.#npm!==null)lines.push('(allow file-read* (subpath '+quote(resolve(dirname(this.#npm),".."))+'))');
    const ancestors=new Set();
    for(const path of [this.#runtime,this.#npm,entry.mirror,entry.home,entry.temp,entry.positive,probe && this.#native].filter(Boolean)) {
      let parent=dirname(path);for(;;){ancestors.add(parent);const next=dirname(parent);if(next===parent)break;parent=next;}
    }
    for(const parent of ancestors)lines.push('(allow file-read-metadata (literal '+quote(parent)+'))');
    lines.push('(allow file-read-data (literal '+quote(entry.positive)+'))');
    if(probe)lines.push('(allow file-read* file-map-executable (literal '+quote(this.#native)+'))');
    lines.push('(allow file-write* (subpath '+quote(entry.mirror)+') (subpath '+quote(entry.home)+') (subpath '+quote(entry.temp)+'))');
    lines.push('(allow file-read-data file-write-data (literal "/dev/null") (subpath "/dev/fd"))','(allow file-read-data (literal "/dev/urandom") (literal "/dev/random"))');
    const protectedPattern='/(\\.ans|\\.git|\\.agents|\\.codex|\\.aws|\\.ssh|\\.docker|\\.kube|\\.gnupg|\\.azure|\\.gcloud|\\.terraform|\\.terraform\\.d)(/|$)|/(\\.env(\\.[^/]*)?|\\.npmrc|\\.netrc|_netrc|\\.pypirc|\\.git-credentials|\\.authinfo(\\.gpg)?|\\.pgpass|\\.my\\.cnf|\\.s3cfg|\\.boto|id_rsa|id_ed25519|id_ecdsa|id_dsa|[^/]*\\.(pem|key|p12|pfx|jks|keystore))(/|$)';
    // Protected rules are anchored to the mirror only; Host-private runtime paths never grant original workspace access.
    const escaped=entry.mirror.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    lines.push('(deny file-read* file-write* (regex #'+quote('^'+escaped+'(/.*)?'+protectedPattern)+'))');
    lines.push('(deny file-read* file-write* (subpath '+quote(this.#root)+'))');
    // Mirror may live under original .ans: deny original ordinary paths individually rather than shadow private projection.
    if(inside(this.#root,entry.mirror))lines.pop();
    if(request.network==="localhost")lines.push('(allow network* (local ip "localhost:*") (remote ip "localhost:*"))');
    if(request.network==="external") {
      lines.push('(allow network* (local ip) (remote ip))');
      for(const file of ["/etc/resolv.conf","/private/etc/resolv.conf","/etc/hosts","/private/etc/hosts"])lines.push('(allow file-read* (literal '+quote(file)+'))');
    }
    return lines.join("\n");
  }
  async #members(entry,action="scan") {
    const value=await this.#command([this.#native,entry.positive,entry.negative,action],{env:{PATH:"/usr/bin:/bin"},timeout:3000});
    if(value.code!==0 || value.stopped)fail("shell_membership_supervisor_failed");
    return value.stdout.trim().split("\n").filter(Boolean).map(line=>{if(!/^\d+ \d+ \d+$/.test(line))fail("shell_membership_protocol_invalid");return line;});
  }
  async #reap(entry){
    const deadline=Date.now()+30000;
    for(;;){await this.#members(entry,"freeze");await this.#members(entry,"kill");const left=await this.#members(entry);if(left.length===0)return;if(Date.now()>=deadline){this.#disabled=true;fail("shell_cleanup_timeout");}await sleep(20);}
  }
  async #probe(entry,request,signal){
    const profile=this.#profile(entry,new ShellRequest({...request,network:"none"}),{probe:true});
    const env={PATH:"/usr/bin:/bin",HOME:entry.home,TMPDIR:entry.temp};
    const nested=await this.#command(["/usr/bin/sandbox-exec","-p",profile,this.#native,"nested"],{env,signal});
    if(nested.code!==0 || nested.stdout.trim()!=="nested=-1 apply=-1")fail("shell_nested_isolation_unavailable");
    const security=await this.#command(["/usr/bin/sandbox-exec","-p",profile,this.#native,"security"],{env,signal});
    if(security.code!==0 || !/^uid=-1 gid=-1 keychain=\d+ launch=\d+ task=\d+ procargs=-1 fd3=-1\s*$/.test(security.stdout))fail("shell_ipc_probe_failed");
    const escaped=await this.#command(["/usr/bin/sandbox-exec","-p",profile,this.#native,"escape"],{env,signal});
    if(escaped.code!==0 || !/^spawn=0 child=\d+ group=\d+ parent=\d+\s*$/.test(escaped.stdout))fail("shell_subprocess_probe_failed");
    const members=await this.#members(entry);if(members.length===0)fail("shell_membership_probe_failed");
    await this.#reap(entry);
    const runtime=await this.#command(["/usr/bin/sandbox-exec","-p",this.#profile(entry,request),this.#runtime,"-e","process.stdout.write('runtime-ok')"],{env:{...env,ELECTRON_RUN_AS_NODE:"1"},signal});
    if(runtime.code!==0 || runtime.stdout!=="runtime-ok")fail("shell_runtime_probe_failed");
  }
  #inputScopes(request) {
    const scopes=new Set(request.generatedEffects);
    for(const artifact of this.#artifacts)if(artifact.kind==="dependencies")scopes.add(artifact.scope);
    return Object.freeze([...scopes].sort());
  }
  #readonlyDependencyScopes(request) {
    return Object.freeze(this.#artifacts.filter(artifact=>artifact.kind==="dependencies" && !request.generatedEffects.includes(artifact.scope)).map(artifact=>artifact.scope));
  }
  async prepare(request,{signal}={}) {
    if(!(request instanceof ShellRequest))throw new TypeError("typed_shell_request_required");
    const budget=new AbortController();const signals=[budget.signal];if(signal!==undefined)signals.push(signal);const combined=AbortSignal.any(signals);const start=Date.now();const timer=setTimeout(()=>budget.abort(),request.timeoutSeconds*1000);
    try{const result=await this.#prepare(request,{signal:combined});this.#prepared.get(result.prepareId).prepareMilliseconds=Date.now()-start;return result;}finally{clearTimeout(timer);}
  }
  async #prepare(request,{signal}={}) {
    if(!(request instanceof ShellRequest))throw new TypeError("typed_shell_request_required");
    if(this.#closed || signal?.aborted)fail("shell_cancelled");this.#roots();
    if(request.generatedEffects.some(scope=>!this.#artifacts.some(artifact=>artifact.scope===scope)))fail("shell_effect_not_in_plan");
    for(const name of await fs.readdir(this.#output)) {
      if(!name.startsWith("shell-run-"))continue;const journal=join(this.#output,name,"publication.json");let record;
      try{record=JSON.parse(await fs.readFile(journal,"utf8"));}catch(error){if(error.code==="ENOENT")record={state:"none"};else throw new ShellProviderError("shell_recovery_journal_invalid",{cause:error});}
      if(["partial_published","publishing"].includes(record.state))fail("shell_publication_recovery_required");
      const sourceJournal=join(this.#output,name,"source-publication.json");let source;
      try{source=JSON.parse(await fs.readFile(sourceJournal,"utf8"));}catch(error){if(error.code!=="ENOENT")throw new ShellProviderError("shell_recovery_journal_invalid",{cause:error});}
      if(source?.state==="partial_published")fail("shell_source_publication_recovery_required");
    }
    const runRoot=await fs.mkdtemp(join(this.#output,"shell-run-"));physical(runRoot);
    const mirror=join(runRoot,"project");const home=join(runRoot,"home");const temp=join(runRoot,"tmp");
    for(const path of [mirror,home,temp])await fs.mkdir(path,{mode:0o700});
    const inputScopes=this.#inputScopes(request),readonlyDependencyScopes=this.#readonlyDependencyScopes(request);
    const before=await tree(this.#root,inputScopes,{excludeProtected:true,copyTo:mirror,knownKeys:this.#knownKeys,signal});
    const prepareId=randomUUID();const inputVersions=baselines(before.files);const generationDigest=generation(before.files,inputScopes);
    const writeGenerationDigest=generation(before.files,request.generatedEffects),readonlyDependencyDigest=generation(before.files,readonlyDependencyScopes);
    const actualCwd=join(mirror,request.cwd);if(!physical(actualCwd).isDirectory())fail("shell_cwd_not_directory");
    const preparation=new ShellPreparation({prepareId,requestId:request.requestId,requestDigest:request.digest,actualCwd,inputVersions,generationDigest});
    const positive=join(runRoot,"membership-positive");const negative=join(runRoot,"membership-negative");
    await fs.writeFile(positive,"membership",{flag:"wx",mode:0o400});await fs.writeFile(negative,"outside",{flag:"wx",mode:0o400});
    this.#prepared.set(prepareId,{runRoot,mirror,home,temp,positive,negative,preparation,before,request,inputScopes,readonlyDependencyScopes,writeGenerationDigest,readonlyDependencyDigest,candidates:[],lease:null,finished:false});
    return preparation;
  }
  async acquire(authorization,{signal}={}) {
    if(!(authorization instanceof ShellAuthorization))throw new TypeError("typed_shell_authorization_required");
    const entry=this.#prepared.get(authorization.prepareId);if(entry===undefined)fail("shell_preparation_unknown");
    if(entry.lease!==null)fail("shell_lease_already_acquired");
    const lockRoot=this.#lockRoot;await fs.mkdir(lockRoot,{recursive:true,mode:0o700});physical(lockRoot);
    const lock=join(lockRoot,digestValue(this.#identity));const until=Math.min(Date.parse(authorization.expiresAt),Date.now()+entry.request.timeoutSeconds*1000);
    for(;;){try{await fs.mkdir(lock,{mode:0o700});break;}catch(error){if(error.code!=="EEXIST")throw error;if(Date.now()>=until)fail("shell_resource_lock_timeout");await sleep(25,signal);}}
    const lease=randomUUID();await fs.writeFile(join(lock,"owner"),lease,{flag:"wx",mode:0o600});entry.lease={lock,lease};
    try {
      this.#roots();if(digestValue(this.#identity)!==digestValue(authorization.workspaceIdentity) || authorization.requestDigest!==entry.request.digest || authorization.snapshotDigest!==entry.preparation.snapshotDigest || authorization.generationDigest!==entry.preparation.generationDigest)fail("shell_authorization_snapshot_mismatch");
      if(authorization.artifactScopes.some(artifact=>!this.#artifacts.some(approved=>approved.scope===artifact.scope && approved.kind===artifact.kind)))fail("shell_artifact_plan_changed");
      if(authorization.generatedEffects.some(effect=>!entry.request.generatedEffects.includes(effect)) || entry.request.generatedEffects.some(effect=>!authorization.generatedEffects.includes(effect)))fail("shell_effect_scope_changed");
      const current=await tree(this.#root,entry.inputScopes,{excludeProtected:true,signal});
      if(digestValue(baselines(current.files))!==entry.preparation.snapshotDigest || generation(current.files,entry.inputScopes)!==entry.preparation.generationDigest)fail("shell_input_changed");
    }catch(error){await this.release(authorization.prepareId);throw error;}
  }
  notExecuted(request,status,reason,entry){if(["shell_input_changed","shell_generation_changed","shell_root_identity_changed","shell_authorization_snapshot_mismatch"].includes(reason))status="stale";const now=new Date().toISOString();return new ShellResult({requestId:request.requestId,runId:request.runId,requestDigest:request.digest,status,reason,executed:false,exitCode:null,stdout:"",stderr:"",logsTruncated:false,candidates:[],generatedEffects:[],generationDigest:digestValue([]),actualCwd:entry?.preparation.actualCwd ?? "",startedAt:now,finishedAt:now});}
  async run(request,authorization,permit,{signal,onOutput}={}) {
    if(!(request instanceof ShellRequest) || !(authorization instanceof ShellAuthorization))throw new TypeError("typed_shell_execution_required");
    const entry=this.#prepared.get(authorization.prepareId);if(this.#authority===undefined)return this.notExecuted(request,"denied","shell_execution_authority_required",entry);
    let live;try{live=this.#authority.consume(request,authorization,permit,this.observeTime());}catch(error){if(!(error instanceof TypeError))throw error;return this.notExecuted(request,"denied","invalid_or_replayed_shell_permit",entry);}
    if(entry===undefined || entry.request!==request || entry.lease===null || entry.finished)return this.notExecuted(request,"denied","shell_preparation_binding_changed",entry);
    if(process.platform!=="darwin" || this.#disabled)return this.notExecuted(request,"unsupported","macos_shell_isolation_required",entry);
    const startedAt=new Date().toISOString();const combined=AbortSignal.any([live,...[signal].filter(Boolean)]);const controller=new AbortController();const runningSignal=AbortSignal.any([combined,controller.signal]);const timeout=setTimeout(()=>controller.abort(),Math.max(1,request.timeoutSeconds*1000-(entry.prepareMilliseconds ?? 0)));
    let executed=false;let output="";let errors="";let truncated=false;let exitCode=null;let status="error";let reason="shell_infrastructure_error";
    let done;const completion=new Promise(resolve=>{done=resolve;});
    const active={entry,controller,completion};this.#active.add(active);let background=false;
    const append=(kind,chunk)=>{const text=scrub(chunk.toString("utf8"));let remaining=this.#previewMax-Buffer.byteLength(output+errors,"utf8");const data=Buffer.from(text);let part=data.subarray(0,Math.max(0,remaining)).toString("utf8");while(Buffer.byteLength(part)>remaining)part=part.slice(0,-1);if(data.length>remaining)truncated=true;if(kind==="stdout")output+=part;else errors+=part;onOutput?.(Object.freeze({stream:kind,text:part,truncated}));};
    try {
      await this.#nativeHelper();await this.#probe(entry,request,runningSignal);
      if(runningSignal.aborted)fail("shell_cancelled");
      const runtimeBin=join(entry.home,"bin");await fs.mkdir(runtimeBin,{recursive:true});
      await fs.writeFile(join(runtimeBin,"node"),'#!/bin/zsh -f\nexec '+JSON.stringify(this.#runtime)+' "$@"\n',{mode:0o700,flag:"wx"});
      const env={PATH:runtimeBin+":/usr/bin:/bin",LANG:"en_US.UTF-8",HOME:entry.home,TMPDIR:entry.temp,TMP:entry.temp,TEMP:entry.temp,npm_config_cache:join(entry.home,"npm-cache"),npm_config_userconfig:join(entry.home,"no-user-npmrc"),npm_config_globalconfig:join(entry.home,"no-global-npmrc"),ELECTRON_RUN_AS_NODE:"1",NODE_DISABLE_COMPILE_CACHE:"1"};
      if(this.#npm!==null)await fs.writeFile(join(runtimeBin,"npm"),'#!/bin/zsh -f\nexec '+JSON.stringify(this.#runtime)+' '+JSON.stringify(this.#npm)+' "$@"\n',{mode:0o700,flag:"wx"});
      if(Date.parse(authorization.expiresAt)<=this.observeTime())return this.notExecuted(request,"denied","shell_authorization_expired",entry);
      executed=true;entry.authorization=authorization;
      const result=await this.#command(["/usr/bin/sandbox-exec","-p",this.#profile(entry,request),"/bin/zsh","-f","-c",request.command],{cwd:entry.preparation.actualCwd,env,signal:runningSignal,timeout:request.timeoutSeconds*1000,onOutput:append,onExit:async()=>{const members=await this.#members(entry);if(members.length!==0)background=true;await this.#reap(entry);}});
      if(result.keyRejected)fail("shell_known_key_output_rejected");
      if(knownValue(Buffer.from(scrub(result.stdout)+scrub(result.stderr)),this.#knownKeys))fail("shell_known_key_output_rejected");
      exitCode=result.code;if(exitCode===null)exitCode=137;
      const log=join(entry.runRoot,"output.json");const fd=await fs.open(log,"wx",0o600);try{await fd.writeFile(JSON.stringify({stdout:scrub(result.stdout),stderr:scrub(result.stderr),truncated:truncated || Buffer.byteLength(result.stdout+result.stderr)>=1048576}));await fd.sync();}finally{await fd.close();}
      entry.logRef=log;
      const remaining=await this.#members(entry);await this.#reap(entry);
      if(result.channelError){status="error";reason="shell_output_channel_failed";this.#disabled=true;}
      else if(runningSignal.aborted || result.stopped){status="cancelled";reason="shell_cancelled_or_timeout";}
      else if(background || remaining.length!==0){status="error";reason="shell_background_processes";}
      else if(result.code!==0){status="failed";reason="shell_command_failed";}
      else {
        const after=await tree(entry.mirror,entry.inputScopes,{signal:runningSignal});const candidates=[];
        if(generation(after.files,entry.readonlyDependencyScopes)!==entry.readonlyDependencyDigest)fail("shell_readonly_dependency_changed");
        const all=new Set([...entry.before.files.keys(),...after.files.keys()]);
        for(const resource of [...all].sort()) {
          const before=entry.before.files.get(resource);const file=after.files.get(resource);
          if(before?.kind==="directory" || file?.kind==="directory") {
            if((before!==undefined && before.kind!=="directory") || (file!==undefined && file.kind!=="directory"))fail("shell_source_directory_type_changed");continue;
          }
          if(before?.sha256===file?.sha256 && before?.kind===file?.kind && before?.executable===file?.executable)continue;
          if(allowedEffect(resource,authorization.generatedEffects)!==undefined)continue;
          if(!authorization.fileOwners.owners.some(item=>item.resource.toLowerCase()===resource.toLowerCase() && item.roleId===authorization.roleId))fail("shell_candidate_file_owner_mismatch");
          if(file!==undefined && file.kind!=="file")fail("shell_source_symlink");
          let baseline=new FileBaseline({resource,state:"absent"});let action="create";
          if(before!==undefined){baseline=new FileBaseline({resource,state:"present",sha256:before.sha256,byteLength:before.byteLength,executable:before.executable});action="replace";}
          if(file===undefined)action="delete";
          let encoding="utf8";
          if(file!==undefined){const bytes=(await regularBytes(join(entry.mirror,resource))).data;try{new TextDecoder("utf-8",{fatal:true}).decode(bytes);if(bytes.includes(0))encoding="base64";}catch(error){if(!(error instanceof TypeError))throw error;encoding="base64";}}
          const candidate=new ShellCandidate({resource,action,baseline,sha256:file?.sha256,byteLength:file?.byteLength,executable:file?.executable,encoding});
          candidates.push(candidate);
        }
        const current=await tree(this.#root,entry.inputScopes,{excludeProtected:true,signal:runningSignal});if(digestValue(baselines(current.files))!==entry.preparation.snapshotDigest || generation(current.files,entry.inputScopes)!==entry.preparation.generationDigest)fail("shell_input_changed");
        entry.after=after;entry.candidates=candidates;entry.publicationReady=true;status="ready_for_publication";reason="ready_for_publication";
      }
    }catch(error){reason=safeReason(error);if(runningSignal.aborted || reason==="shell_cancelled"){status="cancelled";}else if(["shell_input_changed","shell_root_identity_changed"].includes(reason)){status="stale";}else if(!executed){status="unsupported";}}
    finally {clearTimeout(timeout);entry.finished=true;if(this.#native!==undefined){try{await this.#reap(entry);}catch(error){status="error";reason=safeReason(error);this.#disabled=true;}}this.#active.delete(active);done();}
    let candidates=[];let generatedEffects=[];let generationDigest=entry.preparation.generationDigest;
    if(status==="ready_for_publication"){candidates=entry.candidates;generatedEffects=authorization.generatedEffects;generationDigest=generation(entry.after.files,entry.inputScopes);}
    return new ShellResult({requestId:request.requestId,runId:request.runId,requestDigest:request.digest,status,reason,executed,exitCode,stdout:output,stderr:errors,logsTruncated:truncated,candidates,generatedEffects,generationDigest,actualCwd:entry.preparation.actualCwd,logRef:"shell-output:"+request.requestId,startedAt,finishedAt:new Date().toISOString()});
  }
  async readCandidateData(prepareId,resource){
    const entry=this.#prepared.get(prepareId);const candidate=entry?.candidates.find(value=>value.resource===resource);if(candidate===undefined || candidate.action==="delete")fail("shell_candidate_unavailable");
    const data=await regularBytes(join(entry.mirror,resource));if(data.sha256!==candidate.sha256)fail("shell_candidate_changed");
    if(candidate.encoding==="base64")return Object.freeze({encoding:"base64",contentBase64:data.data.toString("base64")});
    return Object.freeze({encoding:"utf8",content:new TextDecoder("utf-8",{fatal:true}).decode(data.data)});
  }
  async readCandidate(prepareId,resource){const value=await this.readCandidateData(prepareId,resource);if(value.encoding!=="utf8")fail("shell_binary_candidate_requires_host_data_api");return value.content;}
  async publishGenerated(prepareId,authorization,{signal}={}) {
    const entry=this.#prepared.get(prepareId);
    if(entry===undefined || !entry.publicationReady || entry.authorization!==authorization || entry.lease===null || signal?.aborted)fail("shell_generated_publication_unavailable");
    if(Date.parse(authorization.expiresAt)<=this.observeTime())fail("shell_authorization_expired");
    this.#roots();const current=await tree(this.#root,entry.inputScopes,{excludeProtected:true,signal});
    if(generation(current.files,entry.readonlyDependencyScopes)!==entry.readonlyDependencyDigest)fail("shell_input_changed");
    if(generation(current.files,authorization.generatedEffects)!==entry.writeGenerationDigest)fail("shell_generation_changed");
    const records=[];const journal=join(entry.runRoot,"publication.json");
    const persist=async(state)=>{const record={requestId:entry.request.requestId,authorizationDigest:authorization.digest,state,records,generationDigest:generation(entry.after.files,entry.inputScopes)};const tmp=journal+".tmp";const fd=await fs.open(tmp,"w",0o600);try{await fd.writeFile(JSON.stringify(record));await fd.sync();}finally{await fd.close();}await fs.rename(tmp,journal);};
    await persist("staging");
    try {
      for(const scope of authorization.generatedEffects) {
        if(signal?.aborted)fail("shell_publication_cancelled");
        const resource=scope.slice(0,-1);const source=join(entry.mirror,resource);const target=join(this.#root,resource);
        const staged=join(entry.runRoot,"generated-"+randomUUID());const backup=join(entry.runRoot,"backup-"+randomUUID());
        await fs.mkdir(staged,{mode:0o700});
        let sourceExists=true;try{await fs.lstat(source);}catch(error){if(error.code!=="ENOENT")throw error;sourceExists=false;}
        if(!sourceExists)fail("shell_generated_directory_missing");
        await tree(source,[""],{copyTo:staged,signal});
        const actual=await tree(entry.mirror,entry.inputScopes,{signal});if(generation(actual.files,entry.readonlyDependencyScopes)!==entry.readonlyDependencyDigest)fail("shell_readonly_dependency_changed");
        if(generation(actual.files,authorization.generatedEffects)!==generation(entry.after.files,authorization.generatedEffects))fail("shell_generated_candidate_changed");
        let parent=dirname(target);
        while(inside(this.#root,parent)){let info;try{info=await fs.lstat(parent);}catch(error){if(error.code!=="ENOENT")throw error;}if(info!==undefined && (!info.isDirectory() || info.isSymbolicLink()))fail("unsafe_generated_parent");if(parent===this.#root)break;parent=dirname(parent);}
        await fs.mkdir(dirname(target),{recursive:true});
        let exists=false;try{const info=await fs.lstat(target);if(!info.isDirectory() || info.isSymbolicLink())fail("unsafe_generated_target");exists=true;}catch(error){if(error.code!=="ENOENT")throw error;}
        const record={resource,phase:"prepared",backup,staged,priorExists:exists,candidateDigest:generation(entry.after.files,[scope])};records.push(record);await persist("publishing");
        if(exists){if(signal?.aborted)fail("shell_publication_cancelled");if(Date.parse(authorization.expiresAt)<=this.observeTime())fail("shell_authorization_expired");nodeFs.renameSync(target,backup);record.phase="backed_up";await persist("publishing");}
        if(signal?.aborted)fail("shell_publication_cancelled");if(Date.parse(authorization.expiresAt)<=this.observeTime())fail("shell_authorization_expired");physical(dirname(target));nodeFs.renameSync(staged,target);record.phase="published";await persist("publishing");
      }
      await persist("published");entry.generatedPublished=true;
      return Object.freeze({status:"published",resources:Object.freeze(records.map(item=>item.resource)),generationDigest:generation(entry.after.files,entry.inputScopes),journalRef:journal});
    }catch(error){await persist("partial_published");this.#disabled=true;return Object.freeze({status:"partial_published",reason:safeReason(error),resources:Object.freeze(records.filter(item=>item.phase==="published").map(item=>item.resource)),generationDigest:generation(entry.after.files,entry.inputScopes),journalRef:journal});}
  }
  async recordSourcePublication(prepareId,result) {
    const entry=this.#prepared.get(prepareId);if(entry===undefined)fail("shell_preparation_unknown");const file=join(entry.runRoot,"source-publication.json");const fd=await fs.open(file,"wx",0o600);try{await fd.writeFile(JSON.stringify({requestId:result.requestId,state:result.status,publishedResources:result.publishedResources}));await fd.sync();}finally{await fd.close();}
    if(result.status==="partial_published")this.#disabled=true;
  }
  async recoverGenerated(prepareId) {
    const entry=this.#prepared.get(prepareId);if(entry===undefined || entry.lease===null)fail("shell_recovery_lease_required");
    const journal=join(entry.runRoot,"publication.json");const record=JSON.parse(await fs.readFile(journal,"utf8"));
    if(!["partial_published","publishing"].includes(record.state))fail("shell_recovery_not_required");
    const recovered=[];
    for(const item of [...record.records].reverse()) {
      const target=join(this.#root,item.resource);physical(dirname(target));
      if(item.phase==="published") {
        const current=await tree(this.#root,entry.inputScopes,{excludeProtected:true});
        if(generation(current.files,[item.resource+"/"])!==item.candidateDigest)fail("shell_recovery_version_changed");
        const discarded=join(entry.runRoot,"withdrawn-"+randomUUID());await fs.rename(target,discarded);
      }
      if(["published","backed_up"].includes(item.phase) && item.priorExists) {
        let exists=false;try{await fs.lstat(target);exists=true;}catch(error){if(error.code!=="ENOENT")throw error;}
        if(exists)fail("shell_recovery_target_changed");physical(item.backup);await fs.rename(item.backup,target);
      }
      recovered.push(item.resource);
    }
    record.state="recovered_withdrawn";record.recovered=recovered;const fd=await fs.open(journal,"w",0o600);try{await fd.writeFile(JSON.stringify(record));await fd.sync();}finally{await fd.close();}
    this.#disabled=false;return Object.freeze({status:"recovered_withdrawn",resources:Object.freeze(recovered),journalRef:journal});
  }
  async release(prepareId){const entry=this.#prepared.get(prepareId);if(entry?.lease===null || entry===undefined)return;const {lock,lease}=entry.lease;if(await fs.readFile(join(lock,"owner"),"utf8")!==lease)fail("shell_lock_owner_changed");physical(lock);await fs.unlink(join(lock,"owner"));await fs.rmdir(lock);entry.lease=null;}
  async close(){if(this.#closed)return;this.#closed=true;for(const {controller} of this.#active)controller.abort();await Promise.all([...this.#active].map(value=>value.completion));for(const [id] of this.#prepared)await this.release(id);}
}
