import { digestValue } from 'legion-runtime/workbench-models';
import { exactObject, identifier, projectIdentifier, textValue, immutable, timestamp } from './desktop.mjs';
export const FACT_KINDS=Object.freeze(['pitfall','decision','preference']);
export const MEMORY_LIMITS=Object.freeze({facts:512,statement:512,sources:8,query:50,injection:12000});
export class MemoryValidationError extends Error{constructor(code='invalid_memory'){super(code);this.code=code;}}
function fail(code){throw new MemoryValidationError(code);}
function integer(value){if(!Number.isSafeInteger(value)||value<0)fail('invalid_memory_revision');return value;}
function sha(value){if(typeof value!=='string'||!/^[a-f0-9]{64}$/u.test(value))fail('invalid_memory_source');return value;}
function strings(value,max){if(!Array.isArray(value)||value.length>max)fail('memory_budget');return value.map(item=>textValue(item,'',200));}
export function memoryInput(value){
 exactObject(value,['action','factId','kind','statement','sourceRefs','expectedRevision']);if(!['add','revise','retract'].includes(value.action))fail('invalid_memory');
 const result={action:value.action,expectedRevision:integer(value.expectedRevision)};
 if(value.action==='add'){if(value.factId!==undefined||result.expectedRevision!==0)fail('invalid_memory_revision');}
 else result.factId=identifier(value.factId);
 if(value.action!=='retract'){if(!FACT_KINDS.includes(value.kind))fail('invalid_memory');result.kind=value.kind;result.statement=textValue(value.statement,'',MEMORY_LIMITS.statement);result.sourceRefs=strings(value.sourceRefs,MEMORY_LIMITS.sources);if(!result.sourceRefs.length||new Set(result.sourceRefs).size!==result.sourceRefs.length)fail('invalid_memory_source');}
 else if(value.kind!==undefined||value.statement!==undefined||value.sourceRefs!==undefined)fail('invalid_memory');
 return immutable(result);
}
export function memoryQuery(value={}){exactObject(value,['kind','cursor','limit']);if(value.kind!==undefined&&!FACT_KINDS.includes(value.kind))fail('invalid_memory');let limit=value.limit??20;if(!Number.isSafeInteger(limit)||limit<1||limit>MEMORY_LIMITS.query)fail('memory_budget');let cursor=null;if(value.cursor!==undefined)cursor=textValue(value.cursor,'',100);return immutable({kind:value.kind??null,cursor,limit});}
function fact(value){
 exactObject(value,['factId','projectId','ownerRoleId','kind','statement','sourceRefs','sourceDigests','createdAt','revision','status','supersedes']);
 if(!FACT_KINDS.includes(value.kind)||!['active','retracted','stale'].includes(value.status))fail('invalid_memory');
 const refs=strings(value.sourceRefs,MEMORY_LIMITS.sources),digests=strings(value.sourceDigests,MEMORY_LIMITS.sources).map(sha);if(refs.length!==digests.length||!refs.length)fail('invalid_memory_source');
 let supersedes=null;if(value.supersedes!==null){supersedes=textValue(value.supersedes,'',160);if(!/^[A-Za-z0-9_.-]+@[1-9][0-9]*$/u.test(supersedes))fail('invalid_memory_revision');}
 const createdAt=timestamp(value.createdAt);if(!createdAt||value.revision<1)fail('invalid_memory');
 return immutable({factId:identifier(value.factId),projectId:projectIdentifier(value.projectId),ownerRoleId:identifier(value.ownerRoleId),kind:value.kind,statement:textValue(value.statement,'',MEMORY_LIMITS.statement),sourceRefs:refs,sourceDigests:digests,createdAt,revision:integer(value.revision),status:value.status,supersedes});
}
export function memoryDocument(value){exactObject(value,['schemaVersion','projectId','revision','facts','digest']);if(value.schemaVersion!==1||!Array.isArray(value.facts)||value.facts.length>MEMORY_LIMITS.facts)fail('memory_budget');const projectId=projectIdentifier(value.projectId),facts=value.facts.map(fact);const latest=new Map();for(const item of facts){if(item.projectId!==projectId)fail('memory_project_mismatch');const old=latest.get(item.factId);if(old){if(item.ownerRoleId!==old.ownerRoleId||item.revision!==old.revision+1||item.supersedes!==old.factId+'@'+old.revision)fail('invalid_memory_revision');}else if(item.revision!==1||item.supersedes!==null)fail('invalid_memory_revision');latest.set(item.factId,item);}const fields={schemaVersion:1,projectId,revision:integer(value.revision),facts},digest=digestValue(fields);if(value.digest!==undefined&&value.digest!==digest)fail('memory_corrupt');return immutable({...fields,digest});}
export function emptyMemory(projectId){return memoryDocument({schemaVersion:1,projectId,revision:0,facts:[]});}
export function currentFacts(document){return [...new Map(document.facts.map(item=>[item.factId,item])).values()];}
export function sensitiveMemoryText(text,secrets=[]){if(typeof text!=='string')return true;if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|Bearer\s+\S+|\bsk-[A-Za-z0-9_-]{6,}|\b(?:api[_-]?key|token|secret|password)\s*[:=]\s*\S+/iu.test(text))return true;return secrets.some(secret=>typeof secret==='string'&&secret.length>0&&text.includes(secret));}
export function supervisionInput(value){exactObject(value,['phase','planDigest','findings','recommendation']);if(!['preflight','monitor'].includes(value.phase)||!['proceed','revise'].includes(value.recommendation)||!Array.isArray(value.findings)||value.findings.length>32)fail('invalid_supervision');return immutable({phase:value.phase,planDigest:sha(value.planDigest),recommendation:value.recommendation,findings:value.findings.map(item=>{exactObject(item,['severity','taskIds','sourceRefs','reason']);if(!['info','warn','block'].includes(item.severity))fail('invalid_supervision');return {severity:item.severity,taskIds:strings(item.taskIds,64).map(id=>identifier(id)),sourceRefs:strings(item.sourceRefs,8),reason:textValue(item.reason,'',512)};})});}

export function registeredMemorySource(value){
 exactObject(value,['id','projectId','type','ownerRoleId','values','label','status','digest']);
 if(!['confirmed_plan','task_failure'].includes(value.type)||!['active','revoked'].includes(value.status)||!Array.isArray(value.values)||value.values.length>16)fail('invalid_memory_source');
 let ownerRoleId=null;if(value.ownerRoleId!==null)ownerRoleId=identifier(value.ownerRoleId);
 const fields={projectId:projectIdentifier(value.projectId),id:textValue(value.id,'',200),type:value.type,ownerRoleId,values:value.values.map(item=>textValue(item,'',1000)),status:value.status};
 if(digestValue(fields)!==sha(value.digest))fail('invalid_memory_source');return immutable({...fields,label:textValue(value.label,'',200),digest:value.digest});
}
