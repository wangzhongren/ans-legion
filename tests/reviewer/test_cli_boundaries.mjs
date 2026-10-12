/** Independent Reviewer executable boundaries for the installed CLI v2 contract. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {promises as fs} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createHeadlessWorkbenchPipeline} from '../../apps/desktop/src/pipelines/workbench.mjs';
import {createProjectLeaseProvider} from '../../apps/desktop/src/providers/public/project_lease.mjs';
import {assertKnownKeyFree,workbenchInput} from '../../apps/desktop/src/models/workbench.mjs';
import {AgentScope,TaskDispatchContext,ProjectFileOwners} from '../../workbench.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const stage=join(root,'.ans/runtime/legion-desktop-command-center-v1/Reviewer');
async function fixture(t){await fs.mkdir(join(stage,'fixtures'),{recursive:true});const base=await fs.mkdtemp(join(stage,'fixtures','cli-review-'));t.after(async()=>{assert.equal((await fs.lstat(base)).isSymbolicLink(),false);await fs.rm(base,{recursive:true});});return base;}
test('production Node closure is complete, uses one Pipeline and excludes Electron',async()=>{
 const metadata=JSON.parse(await fs.readFile(join(root,'package.json'),'utf8'));
 assert.equal(metadata.version,'1.3.1');assert.equal(metadata.exports['./headless-workbench'],'./apps/desktop/src/pipelines/workbench.mjs');
 const visited=new Set();async function visit(path){if(visited.has(path))return;visited.add(path);const source=await fs.readFile(path,'utf8');for(const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/gu)){const spec=match[1];if(spec==='electron'){assert.equal(path,join(root,'apps/desktop/src/providers/impl/settings.mjs'));assert.match(source,/async function electronEncryption/u);continue;}if(spec.startsWith('.')){const target=resolve(dirname(path),spec);const from=path.slice(root.length+1),to=target.slice(root.length+1);
 if(from.includes('/pipelines/')&&!to.includes('/models/'))assert.ok(to.includes('/services/public/'),from+' -> '+to);
 if(from.includes('/services/')&&to.includes('/providers/'))assert.ok(to.includes('/providers/public/'),from+' -> '+to);
 if(from.includes('/services/impl/')&&to.includes('/services/'))assert.ok(to.includes('/services/abstract/'),from+' -> '+to);
 if(from.includes('/providers/')&&to.includes('/services/'))assert.fail(from+' calls Service');
 await visit(target);}else if(spec.startsWith('legion-runtime/')){const target=metadata.exports['./'+spec.slice(15)];assert.ok(target,spec);await visit(resolve(root,target));}}}
 await visit(join(root,'bin/legion.mjs'));assert.ok(visited.has(join(root,'bin/chat.mjs')));assert.ok(visited.has(join(root,'apps/desktop/src/pipelines/workbench.mjs')));
 for(const path of visited){const relative=path.slice(root.length+1);assert.ok(metadata.files.includes(relative)||relative.startsWith('src/kernel/')||relative.startsWith('src/adapters/'),relative);}
});
test('role owner dispatch rejects legacy fields and private keys in Model values',()=>{
 const owners=new ProjectFileOwners({projectId:'review',version:'1',owners:[{resource:'a.txt',roleId:'Worker'}]});
 const fields={roleId:'Worker',taskId:'t',organizationVersion:'v',fileOwnersDigest:owners.digest,ownerGeneration:owners.version,tools:['legion_write_file']};
 assert.throws(()=>new TaskDispatchContext({...fields,writeSet:['a.txt']}),TypeError);assert.throws(()=>new TaskDispatchContext({...fields,knownKeys:['key']}),TypeError);
 assert.throws(()=>new AgentScope({write:[],tools:[],knownKeys:['key']}),TypeError);
 assert.equal(workbenchInput('getState',{knownKeys:['key']}).ok,false);
 const key='canary-'+createHash('sha256').update('reviewer-known-key').digest('hex');
 assert.throws(()=>assertKnownKeyFree({private:{summary:key}},[key]),{code:'sensitive_output'});
 const text='完整Human文字\n'.repeat(2000);assert.equal(assertKnownKeyFree(text,[key]),text);
});
test('one physical workspace has one cross-instance execution lease',async(t)=>{
 const base=await fixture(t),workspace=join(base,'project'),leaseRoot=join(base,'leases');await fs.mkdir(workspace);
 const a=createProjectLeaseProvider({leaseRoot}),b=createProjectLeaseProvider({leaseRoot});t.after(async()=>{await a.close();await b.close();});
 const acquired=await a.acquire(workspace);assert.equal(acquired.ok,true);assert.equal((await b.acquire(workspace)).error.code,'lease_busy');
 assert.equal((await a.assertCurrent(acquired.value)).ok,true);await a.release(acquired.value);const next=await b.acquire(workspace);assert.equal(next.ok,true);await b.release(next.value);
});
test('public Headless Host warms environment key before first catalog DTO and rejects Human key',async(t)=>{
 const base=await fixture(t),workspace=join(base,'project');await fs.mkdir(workspace);
 const key='reviewer-in-memory-key';const host=createHeadlessWorkbenchPipeline({userDataDir:join(base,'data'),leaseRoot:join(base,'leases'),profile:{profileId:'environment',protocol:'openai-completions',provider:'reviewer',modelId:'fixture',baseUrl:'http://127.0.0.1:1/v1',env:{LEGION_API_KEY:key}}});
 t.after(()=>host.close());const state=await host.getState();assert.equal(state.ok,true);assert.ok(!JSON.stringify(state).includes(key));const selected=await host.selectProject(workspace);assert.equal(selected.ok,true);const id=selected.value.currentProject.id;
 const rejected=await host.sendMessage({projectId:id,roleId:'Supervisor',text:key});assert.equal(rejected.ok,false);assert.equal(rejected.error.code,'sensitive_output');
 const data=await fs.readFile(join(base,'data','workbench-projects.json'),'utf8');assert.ok(!data.includes(key));await host.close();
});

test('Shell known-key input rejects before copying original customer bytes to the mirror',async(t)=>{
 const {createShellService}=await import('../../src/kernel/services/public/shell.mjs');const {ShellRequest}=await import('../../workbench.mjs');
 const base=await fixture(t),workspace=join(base,'customer'),outputRoot=join(base,'output');await fs.mkdir(workspace);await fs.mkdir(outputRoot);
 const lockRoot=join(base,'locks');await fs.mkdir(lockRoot);
 const key='reviewer-shell-known-canary';await fs.writeFile(join(workspace,'ordinary.txt'),key);
 const service=createShellService({workspaceRoot:workspace,runtimeExecutable:process.execPath,outputRoot,lockRoot,knownKeys:[key],authorizationValidator:{validate(){throw new Error('must not execute');}}});t.after(()=>service.close());
 await assert.rejects(service.prepare(new ShellRequest({requestId:'known',runId:'r',command:'cat ordinary.txt',reason:'Independent input guard'})),/shell_known_key_input_rejected/u);
 assert.equal(await fs.readFile(join(workspace,'ordinary.txt'),'utf8'),key);
 async function scan(path){for(const entry of await fs.readdir(path,{withFileTypes:true})){const child=join(path,entry.name);if(entry.isDirectory())await scan(child);else if(entry.isFile())assert.equal((await fs.readFile(child)).includes(Buffer.from(key)),false,child);}}
 await scan(outputRoot);
});

test('channel summaries and sources cannot cross from background into Su customer history',async()=>{
 const I=await import('../../apps/desktop/src/models/interaction.mjs'),W=await import('../../apps/desktop/src/models/workbench.mjs');const id='a'.repeat(64),now='2026-10-11T00:00:00.000Z';
 const entries=['su_customer','supervision_preflight','supervision_monitor'].map((channel,index)=>({roleId:'Supervisor',channel,revision:1,summary:'watermark-'+channel,covered:[],messages:[],sourceDigest:'b'.repeat(64),updatedAt:now}));entries.push({roleId:'ProjectManager',channel:'pm_delegate',revision:1,summary:'private-PM-watermark',covered:[],messages:[],sourceDigest:'c'.repeat(64),updatedAt:now});
 const domain={timeline:I.createConversationTimeline(id),customerTimeline:I.createCustomerTimeline(id),queue:I.createInteractionQueue(id),memberConversations:I.createMemberConversations(id),roleMemories:I.roleMemoriesDocument({schemaVersion:2,projectId:id,revision:1,entries}),shellWorkflow:I.createShellWorkflow(id),supervisions:[]};
 for(const channel of ['su_customer','supervision_preflight','supervision_monitor']){const p=W.prepareRoleContext(domain,'Supervisor','safe prompt',null,null,channel);assert.equal(p.summary,'watermark-'+channel);const text=JSON.stringify(p.history);assert.ok(!text.includes('private-PM-watermark'));for(const other of ['su_customer','supervision_preflight','supervision_monitor'].filter(x=>x!==channel))assert.ok(!text.includes('watermark-'+other));}
 assert.throws(()=>I.memoryChannel('ProjectManager','su_customer'),{code:'invalid_memory_channel'});assert.throws(()=>I.memoryChannel('Supervisor','pm_delegate'),{code:'invalid_memory_channel'});
});
test('role log cursor pins project/filter/boundary and excludes private text with bounded pages',async()=>{
 const I=await import('../../apps/desktop/src/models/interaction.mjs'),W=await import('../../apps/desktop/src/models/workbench.mjs'),id='a'.repeat(64),digest='b'.repeat(64),now='2026-10-11T00:00:00.000Z';
 let journal=I.beginMemberConversation(I.createMemberConversations(id),{id:'run',roleId:'Worker',channel:'member_task',taskId:'t',instanceId:'i',runId:'r',planDigest:digest,startedAt:now});
 const event=(n,kind='tool_result',text='')=>({id:'event'+n,conversationId:'run',kind,text,tool:kind==='tool_result'?'legion_read_file':null,requestId:kind==='tool_result'?'request'+n:null,resource:kind==='tool_result'?'ordinary.txt':null,checkId:null,status:null,reason:null,digest:null,createdAt:now});
 for(let n=0;n<55;n++)journal=I.appendMemberConversation(journal,event(n));journal=I.appendMemberConversation(journal,event(55,'assistant_text','private-model-watermark'));journal=I.appendMemberConversation(journal,event(56,'host_briefing','private-host-watermark'));
 const project={id,plan:{planDigest:digest}},domain={memberConversations:journal};const first=W.roleLogPage(domain,project,{roleId:'Worker',limit:50});assert.equal(first.events.length,50);assert.ok(Buffer.byteLength(JSON.stringify(first))<=32768);assert.ok(!JSON.stringify(first).includes('watermark'));
 const next=W.roleLogPage(domain,project,{roleId:'Worker',limit:50,cursor:first.nextCursor});assert.equal(next.events.length,5);assert.equal(next.nextCursor,null);
 const appended={memberConversations:I.appendMemberConversation(journal,event(57))};assert.deepEqual(W.roleLogPage(appended,project,{roleId:'Worker',cursor:first.nextCursor,limit:50}),next);
 for(const changed of [{...project,id:'c'.repeat(64)},project]){const input=changed===project?{roleId:'Other',cursor:first.nextCursor}:{roleId:'Worker',cursor:first.nextCursor};assert.throws(()=>W.roleLogPage(domain,changed,input),{code:'stale_cursor'});}
 const updated=I.memberConversations({...journal,events:journal.events.map(x=>x.id==='event0'?{...x,resource:'changed.txt'}:x),digest:undefined});assert.throws(()=>W.roleLogPage({memberConversations:updated},project,{roleId:'Worker',cursor:first.nextCursor}),{code:'stale_cursor'});
});
test('current CLI request selection rejects obsolete A identity and never consumes its answer for B',async()=>{
 const {selectInteraction,discardInteractionError,interactionIdentity}=await import('../../bin/chat.mjs');const id='a'.repeat(64);const A={projectId:id,requestId:'A',version:1,digest:'1'.repeat(64),status:'pending',purpose:'execute_plan',bindings:{planDigest:'2'.repeat(64)},createdOrder:1};const B={...A,requestId:'B',digest:'3'.repeat(64),bindings:{planDigest:'4'.repeat(64)},createdOrder:2};const state={currentProject:{id},plan:{planDigest:B.bindings.planDigest},interactions:[A,B]};
 assert.equal(selectInteraction(state).requestId,'B');assert.equal(discardInteractionError('stale_interaction'),true);assert.equal(discardInteractionError('organization_busy'),false);const rejected=new Set([interactionIdentity(A)]);assert.equal(selectInteraction(state,rejected).requestId,'B');assert.notEqual(interactionIdentity({...B,version:2}),interactionIdentity(B));
});

test('pure image references preserve old text JSON and cannot carry IO or authorization',async()=>{
 const M=await import('../../workbench.mjs');const data='iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==',bytes=Buffer.from(data,'base64'),fields={projectId:'review_image',attachmentId:'image1',sha256:createHash('sha256').update(bytes).digest('hex'),mimeType:'image/png',byteLength:bytes.length,width:2,height:2};
 const ref=new M.PiImageReference(fields),image=new M.PiImageInput({ref,data});assert.ok(Object.isFrozen(ref)&&Object.isFrozen(image));assert.throws(()=>new M.PiImageReference({...fields,path:'/private/file'}),TypeError);assert.throws(()=>new M.PiImageReference({...fields,ownerRoleId:'Worker'}),TypeError);assert.throws(()=>new M.PiImageReference({...fields,resolver:()=>{throw Error('effect');}}),TypeError);assert.throws(()=>new M.PiImageInput({ref,data:data.slice(0,-4)}),TypeError);
 const old={messages:[{role:'user',text:'old exact text'},{role:'assistant',text:'old exact answer'}]};assert.equal(JSON.stringify(new M.PiConversationHistory(old)),JSON.stringify(old));const history=new M.PiConversationHistory({messages:[{role:'user',text:'',imageRefs:[ref]}]});assert.deepEqual(history.messages[0].imageRefs[0],ref);assert.ok(!JSON.stringify(history).includes(data));assert.throws(()=>new M.PiConversationHistory({messages:[{role:'assistant',text:'fake',imageRefs:[ref]}]}),TypeError);
 const owners=new M.ProjectFileOwners({projectId:'review_image',version:'1',owners:[]});assert.throws(()=>new M.TaskDispatchContext({roleId:'Supervisor',taskId:'t',organizationVersion:'v',fileOwnersDigest:owners.digest,ownerGeneration:owners.version,tools:[],imageRefs:[ref]}),TypeError);
});
test('image blob preview is project/ref/SHA bound and never enters ordinary Host state',async(t)=>{
 const base=await fixture(t),workspace=join(base,'project');await fs.mkdir(workspace);const key='review-image-private-key',data='iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGP4z8AARAwQCgAf7gP9i18U1AAAAABJRU5ErkJggg==';
 const {createWorkbenchPipeline}=await import('../../apps/desktop/src/pipelines/workbench.mjs');const host=createWorkbenchPipeline({userDataDir:join(base,'data'),leaseRoot:join(base,'leases')});t.after(()=>host.close());for(const method of ['stageImage','discardImage','readImagePreview'])assert.equal(typeof host[method],'function','real Desktop public factory missing '+method);const selected=await host.selectProject(workspace);assert.equal(selected.ok,true);const id=selected.value.currentProject.id;
 const staged=await host.stageImage({projectId:id,mimeType:'image/png',data});assert.equal(staged.ok,true,JSON.stringify(staged));assert.deepEqual(Object.keys(staged.value).sort(),['ref']);const ref=staged.value.ref;assert.equal(ref.projectId,id);assert.equal(ref.width,2);const preview=await host.readImagePreview({projectId:id,ref});assert.equal(preview.ok,true);assert.equal(preview.value.data,data);assert.equal(preview.value.ref.sha256,createHash('sha256').update(Buffer.from(data,'base64')).digest('hex'));
 const { _dispatchDesktopIpc }=await import('../../apps/desktop/src/interface/main.mjs'),frame={url:'file:///review/image.html'},window={isDestroyed:()=>false,webContents:{mainFrame:frame}},event={sender:window.webContents,senderFrame:frame};const pixel=await _dispatchDesktopIpc(event,window,frame.url,'readImagePreview',{projectId:id,ref},host);assert.equal(pixel.ok,true);assert.deepEqual(Object.keys(pixel.value).sort(),['data','ref']);
 const wrong=await host.readImagePreview({projectId:id,ref:{...ref,projectId:'b'.repeat(64)}});assert.equal(wrong.ok,false);const changed=await host.readImagePreview({projectId:id,ref:{...ref,sha256:'c'.repeat(64)}});assert.equal(changed.ok,false);assert.equal((await _dispatchDesktopIpc(event,window,frame.url,'stageImage',{projectId:id,mimeType:'image/png',data,path:'/private/file'},host)).ok,false);
 const state=await host.getState();assert.equal(state.ok,true);assert.ok(!JSON.stringify(state).includes(data));assert.ok(!JSON.stringify(state).includes('workbench-attachments'));assert.ok(!JSON.stringify(state).includes(key));assert.equal(state.value.fileOwners.owners.length,0);assert.deepEqual(await fs.readdir(workspace),[]);
 assert.equal((await host.discardImage({projectId:id,ref})).ok,true);assert.equal((await host.readImagePreview({projectId:id,ref})).ok,false);await host.close();
});
