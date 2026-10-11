import { randomUUID } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import nodeFs, { promises as fs } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { digestValue } from "../../src/kernel/models/core.mjs";
import { spawn } from "node:child_process";
import { createShellProvider } from "../../src/kernel/providers/public/shell.mjs";
import { ShellRequest,ShellReview,ShellAuthorization,ShellDecision,_createShellExecutionAuthority } from "../../src/kernel/models/shell.mjs";
const generated=fileURLToPath(new URL("../../.ans/runtime/legion-cli-role-owned-v2/KernelEngineer/fixtures/",import.meta.url));
async function fixture(t,command,options={}){
 const {factoryArtifacts,factoryKnownKeys=[],...requestOptions}=options;
 let artifacts=factoryArtifacts;if(artifacts===undefined)artifacts=(requestOptions.generatedEffects ?? []).map(scope=>({scope,kind:"build"}));
 await fs.mkdir(generated,{recursive:true});const base=await fs.mkdtemp(join(generated,"shell-provider-"));const root=join(base,"workspace");const output=join(base,"private");await fs.mkdir(root);await fs.mkdir(output);await fs.writeFile(join(root,"owned.txt"),"original");await fs.writeFile(join(root,"other.txt"),"other");
 const authority=_createShellExecutionAuthority();const provider=createShellProvider({workspaceRoot:root,outputRoot:output,lockRoot:output,runtimeExecutable:process.execPath,artifactScopes:artifacts,knownKeys:factoryKnownKeys,_authority:authority});
 const request=new ShellRequest({requestId:"q",runId:"r",command,reason:"fixture",...requestOptions});const preparation=await provider.prepare(request);const review=new ShellReview({requestId:"q",requestDigest:request.digest,revision:1,approved:true,reason:"fixture approved"});const stat=await fs.lstat(root,{bigint:true});
 const fileOwners={projectId:"p",version:"v1",owners:[{resource:"created.txt",roleId:"KernelEngineer"},{resource:"other.txt",roleId:"Other"},{resource:"owned.txt",roleId:"KernelEngineer"}]};
 const auth=new ShellAuthorization({authorizationId:"auth",projectId:"p",prepareId:preparation.prepareId,organizationVersion:"v",roleId:"KernelEngineer",taskId:"t",sessionId:"s",instanceId:"i",runId:"r",profileVersion:"pv",expiresAt:new Date(Date.now()+60000).toISOString(),requestDigest:request.digest,reviewDigest:review.digest,planDigest:"a".repeat(64),contextSnapshotDigest:"b".repeat(64),authoredResources:fileOwners.owners.map(item=>item.resource),fileOwners,fileOwnersDigest:digestValue(fileOwners),artifactScopes:artifacts.filter(artifact=>request.generatedEffects.includes(artifact.scope)),snapshotDigest:preparation.snapshotDigest,generationDigest:preparation.generationDigest,workspaceIdentity:{canonicalPath:root,deviceId:String(stat.dev),fileId:String(stat.ino)},inputVersions:preparation.inputVersions,ownerGeneration:"v1",generatedEffects:request.generatedEffects});
 t.after(async()=>{await provider.close();await fs.rm(base,{recursive:true});});
 async function run(){await provider.acquire(auth);return await provider.run(request,auth,authority.issue(request,auth,review,new AbortController().signal,Date.now()));}
 let counter=0;
 async function next(command,generatedEffects) {
   counter+=1;const request=new ShellRequest({requestId:"next-"+counter,runId:"r",command,reason:"fixture",generatedEffects});const preparation=await provider.prepare(request);const review=new ShellReview({requestId:request.requestId,requestDigest:request.digest,revision:1,approved:true,reason:"exact fixture"});
   const authoredResources=new Set(fileOwners.owners.map(item=>item.resource));
   for(const file of preparation.inputVersions)if(!artifacts.some(artifact=>file.resource.startsWith(artifact.scope)))authoredResources.add(file.resource);
   const authorization=new ShellAuthorization({...auth,authorizationId:"next-auth-"+counter,prepareId:preparation.prepareId,requestDigest:request.digest,reviewDigest:review.digest,inputVersions:preparation.inputVersions,snapshotDigest:preparation.snapshotDigest,generationDigest:preparation.generationDigest,generatedEffects,artifactScopes:artifacts.filter(artifact=>generatedEffects.includes(artifact.scope)),authoredResources:[...authoredResources]});
   async function execute(){await provider.acquire(authorization);return await provider.run(request,authorization,authority.issue(request,authorization,review,new AbortController().signal,Date.now()));}
   return {request,preparation,review,authorization,execute};
 }
 return {root,output,provider,request,preparation,review,auth,authority,run,base,next};
}
test("actual Shell pipeline/Node child executes only in mirror and returns candidate metadata",async(t)=>{
 const f=await fixture(t,`printf changed | cat > owned.txt; node -e "require('node:fs').writeFileSync('created.txt','child')"`);const value=await f.run();assert.equal(value.status,"ready_for_publication",JSON.stringify(value));assert.equal(value.exitCode,0);assert.equal(value.executed,true);assert.deepEqual(value.candidates.map(x=>x.resource),["created.txt","owned.txt"]);assert.equal(await fs.readFile(join(f.root,"owned.txt"),"utf8"),"original");assert.equal(await f.provider.readCandidate(f.preparation.prepareId,"owned.txt"),"changed");
});
test("forged permit denies execution and non-owner mirror change denies every candidate",async(t)=>{
 const f=await fixture(t,"echo wrong > other.txt; echo owned > owned.txt");const forged=await f.provider.run(f.request,f.auth,Object.freeze({}));assert.equal(forged.status,"denied");assert.equal(forged.executed,false);const result=await f.run();assert.equal(result.status,"error",JSON.stringify(result));assert.equal(result.reason,"shell_candidate_file_owner_mismatch");assert.equal(result.candidates.length,0);assert.equal(await fs.readFile(join(f.root,"other.txt"),"utf8"),"other");
});
test("no-follow mirror rejects hardlinks and escaping source/approved dependency links",async(t)=>{
 const f=await fixture(t,"true");await fs.link(join(f.root,"owned.txt"),join(f.root,"alias.txt"));await assert.rejects(f.provider.prepare(new ShellRequest({...f.request,requestId:"hard"})),/unsafe_shell_regular_file/);
 await fs.unlink(join(f.root,"alias.txt"));await fs.symlink(join(f.root,"owned.txt"),join(f.root,"source-link"));await assert.rejects(f.provider.prepare(new ShellRequest({...f.request,requestId:"link"})),/shell_source_symlink/);
});
test("original workspace/control paths/env/device/Mach operations are inaccessible",async(t)=>{
 const f=await fixture(t,"true");await fs.mkdir(join(f.root,".ans"));await fs.writeFile(join(f.root,".ans/canary"),"synthetic");
 const q=new ShellRequest({...f.request,requestId:"isolation",command:`node -e 'const fs=require("node:fs"),assert=require("node:assert/strict"); for(const p of ${JSON.stringify([join(f.root,"owned.txt"),join(f.root,".ans/canary"),join(f.output,"unknown"),"/dev/disk0"] )})assert.throws(()=>fs.readFileSync(p)); assert.equal(process.env.OPENAI_API_KEY,undefined);assert.equal(process.env.SSH_AUTH_SOCK,undefined);assert.throws(()=>fs.linkSync("owned.txt","hard"));process.stdout.write("isolated")'`});
 const p=await f.provider.prepare(q);const review=new ShellReview({...f.review,requestId:q.requestId,requestDigest:q.digest});const auth=new ShellAuthorization({...f.auth,authorizationId:"isolation",prepareId:p.prepareId,requestDigest:q.digest,reviewDigest:review.digest,inputVersions:p.inputVersions,snapshotDigest:p.snapshotDigest,generationDigest:p.generationDigest});await f.provider.acquire(auth);const result=await f.provider.run(q,auth,f.authority.issue(q,auth,review,new AbortController().signal,Date.now()));assert.equal(result.status,"ready_for_publication",JSON.stringify(result));assert.equal(result.stdout,"isolated");
});
test("background escaped child is reaped and cannot report success; unrelated process survives",async(t)=>{
 const unrelated=spawn("/bin/sleep",["30"],{stdio:"ignore"});t.after(()=>{if(unrelated.exitCode===null)unrelated.kill("SIGKILL");});
 const f=await fixture(t,`node -e 'const c=require("node:child_process").spawn("/bin/sleep",["25"],{detached:true,stdio:"ignore"});console.log(c.pid);c.unref()'`);const result=await f.run();assert.equal(result.status,"error",JSON.stringify(result));assert.equal(result.reason,"shell_background_processes");const child=Number(result.stdout.trim());assert.ok(child>1);assert.throws(()=>process.kill(child,0),error=>error.code==="ESRCH");assert.equal(unrelated.exitCode,null);assert.doesNotThrow(()=>process.kill(unrelated.pid,0));
});
test("timeout and cancellation terminate detached children, without publishing mirror writes",async(t)=>{
 const f=await fixture(t,`echo private > owned.txt; node -e 'require("node:child_process").spawn("/bin/sleep",["20"],{detached:true,stdio:"ignore"});setInterval(()=>{},1000)'`,{timeoutSeconds:2});const value=await f.run();assert.equal(value.status,"cancelled",JSON.stringify(value));assert.equal(value.candidates.length,0);assert.equal(await fs.readFile(join(f.root,"owned.txt"),"utf8"),"original");
});

test("real offline npm installation and build produce safe internal bin link and explicit generated publication",async(t)=>{
 const f=await fixture(t,"true",{generatedEffects:["dist/","node_modules/"]});
 await fs.mkdir(join(f.root,"local"));await fs.writeFile(join(f.root,"package.json"),JSON.stringify({name:"fixture",version:"1.0.0",scripts:{build:"node -e \"require('node:fs').mkdirSync('dist',{recursive:true});require('node:fs').writeFileSync('dist/result.txt','built')\""}}));await fs.writeFile(join(f.root,"local/package.json"),JSON.stringify({name:"fixture-local",version:"1.0.0",bin:{"fixture-bin":"bin.js"}}));await fs.writeFile(join(f.root,"local/bin.js"),"#!/usr/bin/env node\nconsole.log('local')\n");
 const request=new ShellRequest({...f.request,requestId:"npm",command:"npm install ./local --install-links --no-save --package-lock=false --ignore-scripts --no-audit --no-fund && npm run build"});const preparation=await f.provider.prepare(request);const review=new ShellReview({...f.review,requestId:request.requestId,requestDigest:request.digest});const auth=new ShellAuthorization({...f.auth,authorizationId:"npm-auth",prepareId:preparation.prepareId,requestDigest:request.digest,reviewDigest:review.digest,inputVersions:preparation.inputVersions,snapshotDigest:preparation.snapshotDigest,generationDigest:preparation.generationDigest});await f.provider.acquire(auth);const result=await f.provider.run(request,auth,f.authority.issue(request,auth,review,new AbortController().signal,Date.now()));assert.equal(result.status,"ready_for_publication",JSON.stringify(result));assert.equal(result.candidates.length,0);const published=await f.provider.publishGenerated(preparation.prepareId,auth);assert.equal(published.status,"published",JSON.stringify(published));assert.equal(await fs.readFile(join(f.root,"dist/result.txt"),"utf8"),"built");const bin=join(f.root,"node_modules/.bin/fixture-bin");assert.equal((await fs.lstat(bin)).isSymbolicLink(),true);assert.ok((await fs.realpath(bin)).startsWith(join(f.root,"node_modules")+"/"));assert.notEqual(result.generationDigest,preparation.generationDigest);
});

test("none denies networking while explicitly approved localhost reaches only a controlled fixture",async(t)=>{
 const {createServer}=await import("node:http");const server=createServer((q,r)=>r.end("fixture-local"));await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));const port=server.address().port;
 const denied=await fixture(t,`node -e 'const net=require("node:net");const s=net.connect(${port},"127.0.0.1");s.on("error",e=>{if(!["EPERM","EACCES"].includes(e.code))process.exit(2);console.log("denied")});s.on("connect",()=>process.exit(3))'`);assert.equal((await denied.run()).stdout.trim(),"denied");
 const allowed=await fixture(t,`node -e 'require("node:http").get("http://127.0.0.1:${port}",r=>r.pipe(process.stdout)).on("error",()=>process.exit(2))'`,{network:"localhost"});const result=await allowed.run();assert.equal(result.status,"ready_for_publication",JSON.stringify(result));assert.equal(result.stdout,"fixture-local");
});
test("bounded sanitized preview and cancellation keep all mirror changes private",async(t)=>{
 const f=await fixture(t,`node -e 'process.stdout.write("\\u001b[31m"+"x".repeat(100000)+"\\u001b[0m")'`);const result=await f.run();assert.equal(result.status,"ready_for_publication",JSON.stringify(result));assert.equal(result.logsTruncated,true);assert.ok(Buffer.byteLength(result.stdout+result.stderr)<=8192);assert.equal(result.stdout.includes("\u001b"),false);
 const g=await fixture(t,`node -e 'setInterval(()=>{},1000)'`);await g.provider.acquire(g.auth);const controller=new AbortController();const pending=g.provider.run(g.request,g.auth,g.authority.issue(g.request,g.auth,g.review,controller.signal,Date.now()),{signal:controller.signal});setTimeout(()=>controller.abort(),1200);const cancelled=await pending;assert.equal(cancelled.status,"cancelled",JSON.stringify(cancelled));assert.equal(cancelled.candidates.length,0);
});
test("project lock serializes different providers and revocation cancels a waiter",async(t)=>{
 const f=await fixture(t,"true");const second=createShellProvider({workspaceRoot:f.root,outputRoot:f.output,lockRoot:f.output,runtimeExecutable:process.execPath,_authority:f.authority});t.after(()=>second.close());const request=new ShellRequest({...f.request,requestId:"second"});const preparation=await second.prepare(request);const review=new ShellReview({...f.review,requestId:request.requestId,requestDigest:request.digest});const auth=new ShellAuthorization({...f.auth,authorizationId:"second",prepareId:preparation.prepareId,requestDigest:request.digest,reviewDigest:review.digest,inputVersions:preparation.inputVersions,snapshotDigest:preparation.snapshotDigest,generationDigest:preparation.generationDigest});await f.provider.acquire(f.auth);const controller=new AbortController();const waiting=second.acquire(auth,{signal:controller.signal});setTimeout(()=>controller.abort(),50);await assert.rejects(waiting,/shell_cancelled/);await f.provider.release(f.preparation.prepareId);await second.acquire(auth);await second.release(preparation.prepareId);
});
test("generated publication interruption journals partial state and version-checked recovery withdraws actual writes",async(t)=>{
 const f=await fixture(t,"mkdir -p dist cache; echo built > dist/result.txt; echo cache > cache/value.txt",{generatedEffects:["cache/","dist/"]});const result=await f.run();assert.equal(result.status,"ready_for_publication",JSON.stringify(result));
 const originalRename=nodeFs.renameSync;let injected=false;t.mock.method(nodeFs,"renameSync",(source,target)=>{if(!injected && target===join(f.root,"dist")){injected=true;throw Object.assign(new Error("fixture interruption"),{code:"EIO"});}return originalRename(source,target);});
 const published=await f.provider.publishGenerated(f.preparation.prepareId,f.auth);assert.equal(published.status,"partial_published",JSON.stringify(published));assert.deepEqual(published.resources,["cache"]);assert.equal((JSON.parse(await fs.readFile(published.journalRef,"utf8"))).state,"partial_published");t.mock.restoreAll();
 const recovered=await f.provider.recoverGenerated(f.preparation.prepareId);assert.equal(recovered.status,"recovered_withdrawn");await assert.rejects(fs.lstat(join(f.root,"cache")),error=>error.code==="ENOENT");assert.equal(await fs.readFile(join(f.root,"owned.txt"),"utf8"),"original");
});

test("actual separate Host processes share the same project resource lock",async(t)=>{
 const f=await fixture(t,"true");await f.provider.acquire(f.auth);
 const providerModule=new URL("../../src/kernel/providers/public/shell.mjs",import.meta.url).href;const modelModule=new URL("../../src/kernel/models/shell.mjs",import.meta.url).href;
 const source=`import {createShellProvider} from ${JSON.stringify(providerModule)};import {ShellRequest,ShellAuthorization} from ${JSON.stringify(modelModule)};const provider=createShellProvider(${JSON.stringify({workspaceRoot:f.root,outputRoot:f.output,lockRoot:f.output,runtimeExecutable:process.execPath})});const request=new ShellRequest(${JSON.stringify(f.request)});const p=await provider.prepare(request);const auth=new ShellAuthorization({...${JSON.stringify(f.auth)},prepareId:p.prepareId,inputVersions:p.inputVersions,snapshotDigest:p.snapshotDigest,generationDigest:p.generationDigest});console.log('waiting');await provider.acquire(auth);console.log('acquired');await provider.release(p.prepareId);await provider.close();`;
 const child=spawn(process.execPath,["--input-type=module","-e",source],{stdio:["ignore","pipe","pipe"]});let out="",err="";child.stdout.on("data",b=>out+=b.toString());child.stderr.on("data",b=>err+=b.toString());t.after(()=>{if(child.exitCode===null)child.kill("SIGKILL");});
 for(let i=0;i<100 && !out.includes("waiting");i++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(out.includes("waiting"),err);await new Promise(resolve=>setTimeout(resolve,80));assert.equal(out.includes("acquired"),false);await f.provider.release(f.preparation.prepareId);const code=await new Promise(resolve=>child.once("close",resolve));assert.equal(code,0,err);assert.ok(out.includes("acquired"));
});


async function installedDependencies(t) {
 const f=await fixture(t,"true",{factoryArtifacts:[{scope:"node_modules/",kind:"dependencies"},{scope:"dist/",kind:"build"}]});
 await fs.mkdir(join(f.root,"local"));await fs.writeFile(join(f.root,"package.json"),JSON.stringify({name:"readonly-build",version:"1.0.0",scripts:{build:"mkdir -p dist && fixture-bin > dist/result.txt"}}));await fs.writeFile(join(f.root,"local/package.json"),JSON.stringify({name:"fixture-local",version:"1.0.0",bin:{"fixture-bin":"bin.js"}}));await fs.writeFile(join(f.root,"local/bin.js"),"#!/usr/bin/env node\nconsole.log('readonly dependency')\n");
 const install=await f.next("npm install ./local --install-links --no-save --package-lock=false --ignore-scripts --no-audit --no-fund",["node_modules/"]);const result=await install.execute();assert.equal(result.status,"ready_for_publication",JSON.stringify(result));const published=await f.provider.publishGenerated(install.preparation.prepareId,install.authorization);assert.equal(published.status,"published",JSON.stringify(published));await f.provider.release(install.preparation.prepareId);return f;
}
async function dependencyState(root) {
 const entries=[];
 async function visit(resource) {
   const path=join(root,resource),stat=await fs.lstat(path);
   if(stat.isDirectory()){entries.push({resource,kind:"directory",mode:stat.mode&0o777});for(const name of (await fs.readdir(path)).sort())await visit(resource+"/"+name);}
   else if(stat.isSymbolicLink())entries.push({resource,kind:"link",target:await fs.readlink(path)});
   else {assert.ok(stat.isFile());assert.equal(stat.nlink,1);entries.push({resource,kind:"file",mode:stat.mode&0o777,sha256:digestValue((await fs.readFile(path)).toString("base64"))});}
 }
 await visit("node_modules");return entries;
}

test("existing validated dependency bin is read without approving or replacing node_modules",async(t)=>{
 const f=await installedDependencies(t);const before=await dependencyState(f.root);const identity=await fs.stat(join(f.root,"node_modules"));const build=await f.next("npm run build",["dist/"]);assert.deepEqual(build.request.generatedEffects,["dist/"]);assert.deepEqual(build.authorization.generatedEffects,["dist/"]);const result=await build.execute();assert.equal(result.status,"ready_for_publication",JSON.stringify(result));assert.deepEqual(result.generatedEffects,["dist/"]);assert.equal(result.candidates.length,0);const published=await f.provider.publishGenerated(build.preparation.prepareId,build.authorization);assert.equal(published.status,"published",JSON.stringify(published));assert.deepEqual(published.resources,["dist"]);assert.equal(published.generationDigest,result.generationDigest);assert.equal(await fs.readFile(join(f.root,"dist/result.txt"),"utf8"),"readonly dependency\n");assert.deepEqual(await dependencyState(f.root),before);assert.equal((await fs.stat(join(f.root,"node_modules"))).ino,identity.ino);
});

test("only-dist command changes to dependency file/link/mode/directory reject the complete batch",async(t)=>{
 const f=await installedDependencies(t);const before=await dependencyState(f.root);
 for(const command of ["echo mutation >> node_modules/fixture-local/bin.js","rm node_modules/.bin/fixture-bin; ln -s ../fixture-local/package.json node_modules/.bin/fixture-bin","chmod 600 node_modules/fixture-local/bin.js","mkdir node_modules/read-only-directory"]) {
   const build=await f.next("mkdir -p dist; echo unpublishable > dist/result.txt; "+command,["dist/"]);const result=await build.execute();assert.equal(result.status,"error",JSON.stringify(result));assert.equal(result.reason,"shell_readonly_dependency_changed");assert.equal(result.candidates.length,0);assert.deepEqual(result.generatedEffects,[]);await assert.rejects(f.provider.publishGenerated(build.preparation.prepareId,build.authorization),/shell_generated_publication_unavailable/);await f.provider.release(build.preparation.prepareId);assert.deepEqual(await dependencyState(f.root),before);await assert.rejects(fs.lstat(join(f.root,"dist")),error=>error.code==="ENOENT");
 }
});

test("approval pins readonly links even when redirected targets have identical content",async(t)=>{
 const f=await installedDependencies(t);const first=join(f.root,"node_modules/fixture-local/bin.js"),same=join(f.root,"node_modules/fixture-local/same.js");await fs.copyFile(first,same);await fs.chmod(same,(await fs.stat(first)).mode&0o777);
 const before=await f.next("npm run build",["dist/"]);const link=join(f.root,"node_modules/.bin/fixture-bin");await fs.unlink(link);await fs.symlink("../fixture-local/same.js",link);assert.deepEqual(await fs.readFile(first),await fs.readFile(same));const after=await f.next("npm run build",["dist/"]);assert.equal(after.preparation.snapshotDigest,before.preparation.snapshotDigest);assert.notEqual(after.preparation.generationDigest,before.preparation.generationDigest);await assert.rejects(f.provider.acquire(before.authorization),/shell_input_changed/);await assert.rejects(fs.lstat(join(f.root,"dist")),error=>error.code==="ENOENT");
});

test("dependency read declarations preserve undeclared/escaping/hardlink/credential rejection",async(t)=>{
 const f=await installedDependencies(t);const undeclared=createShellProvider({workspaceRoot:f.root,outputRoot:f.output,lockRoot:f.output,runtimeExecutable:process.execPath,artifactScopes:[{scope:"dist/",kind:"build"}]});t.after(()=>undeclared.close());await assert.rejects(undeclared.prepare(new ShellRequest({requestId:"undeclared",runId:"r",command:"npm run build",reason:"fixture",generatedEffects:["dist/"]})),/shell_source_symlink/);
 const link=join(f.root,"node_modules/.bin/fixture-bin");await fs.unlink(link);await fs.symlink("../../owned.txt",link);await assert.rejects(f.next("npm run build",["dist/"]),/shell_escaping_symlink/);await fs.unlink(link);await fs.symlink("../fixture-local/missing.js",link);await assert.rejects(f.next("npm run build",["dist/"]),/shell_broken_or_cyclic_link/);await fs.unlink(link);await fs.symlink("fixture-bin",link);await assert.rejects(f.next("npm run build",["dist/"]),/shell_broken_or_cyclic_link/);await fs.unlink(link);await fs.symlink("../fixture-local/bin.js",link);await fs.link(join(f.root,"owned.txt"),join(f.root,"node_modules/hard"));await assert.rejects(f.next("npm run build",["dist/"]),/unsafe_shell_regular_file/);await fs.unlink(join(f.root,"node_modules/hard"));await fs.writeFile(join(f.root,"node_modules/fixture-local/.env"),"synthetic-only");await fs.unlink(link);await fs.symlink("../fixture-local/.env",link);await assert.rejects(f.next("npm run build",["dist/"]),/restricted_resource/);
});


test("public Service returns unexecuted stale for an approved readonly dependency link change",async(t)=>{
 const {createShellService}=await import("../../src/kernel/services/public/shell.mjs");const f=await installedDependencies(t);const first=join(f.root,"node_modules/fixture-local/bin.js"),same=join(f.root,"node_modules/fixture-local/same.js");await fs.copyFile(first,same);await fs.chmod(same,(await fs.stat(first)).mode&0o777);const host=new AbortController();
 const service=createShellService({workspaceRoot:f.root,outputRoot:f.output,lockRoot:f.output,runtimeExecutable:process.execPath,artifactScopes:[{scope:"node_modules/",kind:"dependencies"},{scope:"dist/",kind:"build"}],authorizationValidator:{async validate(request,authorization,review){return {decision:new ShellDecision({requestId:request.requestId,runId:request.runId,requestDigest:request.digest,allowed:true,reason:"exact controlled approval"}),authorization,review,signal:host.signal};}}});t.after(()=>service.close());const request=new ShellRequest({requestId:"service-stale",runId:"r",command:"npm run build",reason:"fixture",generatedEffects:["dist/"]});const prep=await service.prepare(request),review=new ShellReview({requestId:request.requestId,requestDigest:request.digest,revision:1,approved:true,reason:"fixture"});const auth=new ShellAuthorization({...f.auth,authorizationId:"service-stale",prepareId:prep.prepareId,requestDigest:request.digest,reviewDigest:review.digest,inputVersions:prep.inputVersions,snapshotDigest:prep.snapshotDigest,generationDigest:prep.generationDigest,generatedEffects:["dist/"],artifactScopes:[{scope:"dist/",kind:"build"}]});const link=join(f.root,"node_modules/.bin/fixture-bin");await fs.unlink(link);await fs.symlink("../fixture-local/same.js",link);const result=await service.run(request,auth,review);assert.equal(result.result.status,"stale",JSON.stringify(result));assert.equal(result.result.reason,"shell_input_changed");assert.equal(result.result.executed,false);await assert.rejects(fs.lstat(join(f.root,"dist")),error=>error.code==="ENOENT");
});

test("actual Provider consumption observes current expiry instead of the issue-time fact",async(t)=>{
 const f=await fixture(t,"echo must-not-run > owned.txt");await f.provider.acquire(f.auth);const auth=new ShellAuthorization({...f.auth,authorizationId:"expires-before-consume",expiresAt:new Date(Date.now()+60000).toISOString()});const permit=f.authority.issue(f.request,auth,f.review,new AbortController().signal,f.provider.observeTime());const real=Date.now;const expires=Date.parse(auth.expiresAt);t.mock.method(Date,"now",()=>expires);const result=await f.provider.run(f.request,auth,permit);assert.equal(result.executed,false);assert.equal(result.status,"denied");assert.equal(await fs.readFile(join(f.root,"owned.txt"),"utf8"),"original");t.mock.restoreAll();assert.ok(real()<expires);const replay=await f.provider.run(f.request,auth,permit);assert.equal(replay.executed,false);assert.equal(replay.status,"denied");
});

async function assertNoKnownRunFile(directory, key) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await assertNoKnownRunFile(path, key);
    else if (entry.isFile()) assert.equal((await fs.readFile(path)).includes(Buffer.from(key)), false, "private run file contains known value");
  }
}

test("Shell refuses known-key customer input before mirror copying and never changes original bytes", async (t) => {
  const key = randomUUID(); const f = await fixture(t, "true", { factoryKnownKeys: [key] });
  const original = Buffer.from("original-"+key); await fs.writeFile(join(f.root, "owned.txt"), original);
  await assert.rejects(f.provider.prepare(new ShellRequest({ requestId: "secret-input", runId: "r", command: "true", reason: "fixture" })), /shell_known_key_input_rejected/);
  assert.equal(digestValue([...await fs.readFile(join(f.root, "owned.txt"))]), digestValue([...original]));
  await assertNoKnownRunFile(f.output, key);
});

test("Shell guards actual split stdout/stderr before callbacks and private output.json", async (t) => {
  for (const stream of ["stdout", "stderr", "mixed"]) {
    const key = randomUUID();
    let firstStream = stream; let lastStream = stream;
    if (stream === "mixed") { firstStream = "stdout"; lastStream = "stderr"; }
    const command = `node -e 'const value=String.fromCharCode(${[...key].map(c=>c.charCodeAt(0)).join(',')});process.${firstStream}.write(value.slice(0,12));setTimeout(()=>process.${lastStream}.write(value.slice(12)),100)'`;
    const f = await fixture(t, command, { factoryKnownKeys: [key] }); const chunks = [];
    await f.provider.acquire(f.auth);
    const result = await f.provider.run(f.request, f.auth, f.authority.issue(f.request, f.auth, f.review, new AbortController().signal, Date.now()), { onOutput: event => chunks.push(event.text) });
    assert.equal(result.executed, true); assert.equal(result.reason, "shell_known_key_output_rejected");
    assert.equal(JSON.stringify(result).includes(key), false); assert.equal(chunks.join('').includes(key), false);
    await assertNoKnownRunFile(f.output, key);
    assert.equal(await fs.readFile(join(f.root, "owned.txt"), "utf8"), "original");
  }
});
