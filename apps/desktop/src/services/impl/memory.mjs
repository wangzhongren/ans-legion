import { assertKnownKeyFree } from '../../models/workbench.mjs';
import { createMemoryProvider } from '../../providers/public/memory.mjs';
import { memoryServiceOptions } from '../abstract/memory.mjs';
import { memoryInput,memoryQuery,memoryDocument,emptyMemory,currentFacts,sensitiveMemoryText,MemoryValidationError,MEMORY_LIMITS } from '../../models/memory.mjs';
function fail(code){throw new MemoryValidationError(code);}
function actorAllowed(project,actor,registry){if(actor.projectId!==project.id||registry.projectId!==project.id||!registry.roles.includes(actor.roleId)||!actor.instanceId||!actor.runId)fail('actor_forbidden');}
function validSource(source,secrets){return source&&source.status==='active'&&!source.values.some(value=>sensitiveMemoryText(value,secrets));}
function staleView(document,registry,secrets){const latest=new Set(currentFacts(document).map(item=>item.factId+'@'+item.revision));let changed=false;const facts=document.facts.map(item=>{if(item.status!=='active'||!latest.has(item.factId+'@'+item.revision))return item;const valid=!sensitiveMemoryText(item.statement,secrets)&&item.sourceRefs.every((ref,index)=>{const source=registry.sources.find(src=>src.id===ref);if(source===undefined)return true;return validSource(source,secrets)&&source.digest===item.sourceDigests[index];});if(valid)return item;changed=true;return {...item,status:'stale'};});if(!changed)return document;return memoryDocument({...document,revision:document.revision+1,facts,digest:undefined});}
export class MemoryServiceImpl{
 #provider;#tail=Promise.resolve();#closed=false;
 constructor(options,provider=null){this.#provider=provider??createMemoryProvider(memoryServiceOptions(options));}
 #mutate(project,action,signal,secrets=[]){const operation=this.#tail.then(async()=>{if(this.#closed)fail('closed');if(signal?.aborted)fail('stale_action');const raw=await this.#provider.read(project,secrets),document=assertKnownKeyFree(raw??emptyMemory(project.id),secrets);const next=await action(document);if(next.document!==document){let expected=null;if(raw)expected=raw.digest;await this.#provider.write(assertKnownKeyFree(next.document,secrets),project,expected,signal,secrets);}if(signal?.aborted)fail('stale_action');return assertKnownKeyFree(next.value,secrets);});this.#tail=operation.then(()=>undefined,()=>undefined);return operation;}
 async remember(project,raw,actor,registry,secrets=[],signal=null){assertKnownKeyFree(raw,secrets);const input=memoryInput(raw);actorAllowed(project,actor,registry);return this.#mutate(project,async(document)=>{
  const previous=currentFacts(document).find(item=>item.factId===input.factId);
  if(input.action!=='add'){if(!previous||previous.ownerRoleId!==actor.roleId)fail('memory_owner_mismatch');if(previous.revision!==input.expectedRevision)fail('stale_memory_revision');}
  let sources=[],statement,kind,status='active';
  if(input.action==='retract'){statement=previous.statement;kind=previous.kind;status='retracted';sources=previous.sourceRefs.map((id,index)=>({id,digest:previous.sourceDigests[index]}));}
  else{
   statement=input.statement;kind=input.kind;if(sensitiveMemoryText(statement,secrets))fail('sensitive_memory');
   sources=input.sourceRefs.map(ref=>registry.sources.find(item=>item.id===ref));if(sources.some(source=>!validSource(source,secrets)||source.projectId!==project.id))fail('invalid_memory_source');
   if(kind==='pitfall'){if(sources.some(source=>!['check_failure','acceptance_issue','task_failure'].includes(source.type)||source.ownerRoleId!==actor.roleId))fail('memory_source_kind');}
   if(kind==='decision'&&sources.some(source=>!['human','answer','preference_answer','confirmed_plan'].includes(source.type)))fail('memory_source_kind');
   if(kind==='preference'&&sources.some(source=>!['human','preference_answer'].includes(source.type)))fail('memory_source_kind');
   if(!sources.some(source=>source.values.some(value=>value.includes(statement))))fail('memory_statement_not_observed');
  }
  let factId=this.#provider.newId(),revision=1,supersedes=null;if(previous){factId=previous.factId;revision=previous.revision+1;supersedes=factId+'@'+previous.revision;}
  const item={factId,projectId:project.id,ownerRoleId:actor.roleId,kind,statement,sourceRefs:sources.map(source=>source.id),sourceDigests:sources.map(source=>source.digest),createdAt:this.#provider.now(),revision,status,supersedes};
  const next=memoryDocument({...document,revision:document.revision+1,facts:[...document.facts,item],digest:undefined});return {document:next,value:{factId,revision,status}};
 },signal,secrets);}
 async query(project,raw,actor,registry,secrets=[],signal=null){assertKnownKeyFree(raw,secrets);const input=memoryQuery(raw);actorAllowed(project,actor,registry);return this.#mutate(project,async(document)=>{
  const next=staleView(document,registry,secrets);let offset=0;if(input.cursor!==null){const [digest,index]=input.cursor.split(':');if(digest!==next.digest||!/^\d+$/u.test(index))fail('stale_memory_cursor');offset=Number(index);}
  const available=currentFacts(next).filter(item=>item.status==='active'&&(input.kind===null||item.kind===input.kind)).sort((a,b)=>a.factId.localeCompare(b.factId));if(offset>available.length)fail('stale_memory_cursor');
  const facts=available.slice(offset,offset+input.limit).map(item=>({factId:item.factId,ownerRoleId:item.ownerRoleId,kind:item.kind,statement:item.statement,revision:item.revision,sources:item.sourceRefs.map(ref=>{const source=registry.sources.find(item=>item.id===ref);let label='Historical registered source';if(source)label=source.label;return {id:ref,label};})}));let cursor=null;if(offset+facts.length<available.length)cursor=next.digest+':'+(offset+facts.length);return {document:next,value:{facts,cursor,total:available.length}};
 },signal,secrets);}
 async inspect(project,raw,registry,secrets=[],signal=null){
  assertKnownKeyFree(raw,secrets);const input=memoryQuery(raw);
  if(registry.projectId!==project.id)fail('memory_project_mismatch');
  await this.#tail;if(this.#closed)fail('closed');if(signal?.aborted)fail('stale_action');
  const stored=await this.#provider.read(project,secrets),view=staleView(assertKnownKeyFree(stored??emptyMemory(project.id),secrets),registry,secrets);
  let offset=0;if(input.cursor!==null){const [digest,index]=input.cursor.split(':');if(digest!==view.digest||!/^(?:0|[1-9][0-9]*)$/u.test(index))fail('stale_memory_cursor');offset=Number(index);}
  const available=currentFacts(view).filter(item=>item.status!=='retracted'&&(input.kind===null||item.kind===input.kind)).sort((a,b)=>a.factId.localeCompare(b.factId));
  if(offset>available.length||signal?.aborted)fail('stale_memory_cursor');
  const facts=available.slice(offset,offset+input.limit).map(item=>({factId:item.factId,ownerRoleId:item.ownerRoleId,kind:item.kind,statement:item.statement,revision:item.revision,status:item.status,sources:item.sourceRefs.map(ref=>{const source=registry.sources.find(candidate=>candidate.id===ref);return {id:ref,label:source?.label??'历史来源'};})}));
  let cursor=null;if(offset+facts.length<available.length)cursor=view.digest+':'+(offset+facts.length);
  return assertKnownKeyFree({facts,cursor,total:available.length,sourceDigest:view.digest},secrets);
 }
 async close(){this.#closed=true;await this.#tail;this.#provider.close();}
}
