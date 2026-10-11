import { ShellService } from "../abstract/shell.mjs";
import { createShellProvider, ShellProviderError } from "../../providers/public/shell.mjs";
import { ShellRequest, ShellAuthorization, ShellReview, ShellDecision, ShellResult,
  _createShellExecutionAuthority, _createShellPublicationReceipt } from "../../models/shell.mjs";
import { modelRecord, MutationResult } from "../../models/core.mjs";

export class _ShellService extends ShellService {
  #provider;#validator;#authority;#closing=new AbortController();#closed=false;#runs=new Set();#requests=new Map();#used=new Set();
  constructor(options){
    super();modelRecord(options,"shell service options",["workspaceRoot","runtimeExecutable","outputRoot","authorizationValidator","lockRoot","npmCli","previewMaxBytes","artifactScopes","knownKeys"]);
    if(typeof options.authorizationValidator?.validate!=="function")throw new TypeError("trusted_shell_authorization_validator_required");
    this.#validator=options.authorizationValidator;this.#authority=_createShellExecutionAuthority();
    this.#provider=createShellProvider({workspaceRoot:options.workspaceRoot,runtimeExecutable:options.runtimeExecutable,outputRoot:options.outputRoot,lockRoot:options.lockRoot,npmCli:options.npmCli,previewMaxBytes:options.previewMaxBytes,artifactScopes:options.artifactScopes,knownKeys:options.knownKeys,_authority:this.#authority});Object.freeze(this);
  }
  observeTime(){return this.#provider.observeTime();}
  #signal(signal){if(signal!==undefined && !(signal instanceof AbortSignal))throw new TypeError("invalid_signal");const values=[this.#closing.signal];if(signal!==undefined)values.push(signal);return AbortSignal.any(values);}
  async prepare(request,{signal}={}) {
    if(!(request instanceof ShellRequest))throw new TypeError("typed_shell_request_required");if(this.#closed)throw new TypeError("shell_service_closed");
    if(this.#requests.has(request.requestId))throw new TypeError("duplicate_shell_request_id");
    const start=this.observeTime();const preparation=await this.#provider.prepare(request,{signal:this.#signal(signal)});this.#requests.set(request.requestId,{request,preparation,result:null,receipt:null,live:null,prepareMilliseconds:this.observeTime()-start,budgetTimer:null});return preparation;
  }
  #decision(request,allowed,reason){return new ShellDecision({requestId:request.requestId,runId:request.runId,requestDigest:request.digest,allowed,reason});}
  async #validate(request,authorization,review,phase,signal){
    if(signal.aborted)throw new TypeError("shell_validation_cancelled");
    const pending=this.#validator.validate(request,authorization,review,{phase,signal});
    const value=await new Promise((resolve,reject)=>{
      const abort=()=>reject(new TypeError("shell_validation_cancelled"));
      Promise.resolve(pending).then(result=>{signal.removeEventListener("abort",abort);resolve(result);},error=>{signal.removeEventListener("abort",abort);reject(error);});
      if(signal.aborted)abort();else signal.addEventListener("abort",abort,{once:true});
    });
    if(!(value?.decision instanceof ShellDecision) || value.decision.requestId!==request.requestId || value.decision.runId!==request.runId || value.decision.requestDigest!==request.digest)throw new TypeError("invalid_host_shell_validation");
    if(value.decision.allowed && (value.authorization!==authorization || value.review!==review || !(value.signal instanceof AbortSignal)))throw new TypeError("live_host_shell_authorization_required");
    if(signal.aborted)throw new TypeError("shell_validation_cancelled");return value;
  }
  async #run(request,authorization,review,{signal,onOutput}={}) {
    const progressAbort=new AbortController();const progress=[];let progressError=false;
    const output=(value)=>{if(onOutput===undefined)return;let pending;try{pending=onOutput(value);}catch(error){progressError=true;progressAbort.abort();return;}const handled=Promise.resolve(pending).catch(error=>{progressError=true;progressAbort.abort();});progress.push(handled);};
    const budget=new AbortController();const entry=this.#requests.get(request.requestId);
    const combined=AbortSignal.any([this.#signal(signal),progressAbort.signal,budget.signal]);
    const denied=(status,reason)=>Object.freeze({decision:this.#decision(request,false,reason),result:this.#provider.notExecuted(request,status,reason)});
    if(this.#closed || combined.aborted)return denied("cancelled","shell_cancelled");
    if(entry===undefined || entry.request!==request || entry.preparation.prepareId!==authorization.prepareId || request.digest!==authorization.requestDigest || review.digest!==authorization.reviewDigest || review.requestDigest!==request.digest || review.requestId!==request.requestId || authorization.runId!==request.runId || !review.approved || this.#used.has(authorization.authorizationId))return denied("denied","invalid_or_replayed_shell_authorization");
    entry.budgetTimer=setTimeout(()=>budget.abort(),Math.max(1,request.timeoutSeconds*1000-entry.prepareMilliseconds));
    let validation;
    try {validation=await this.#validate(request,authorization,review,"approve",combined);}catch(error){clearTimeout(entry.budgetTimer);if(combined.aborted)return denied("cancelled","shell_cancelled_or_timeout");return denied("denied","shell_authorization_verification_failed");}
    if(!validation.decision.allowed){clearTimeout(entry.budgetTimer);return Object.freeze({decision:validation.decision,result:this.#provider.notExecuted(request,"denied",validation.decision.reason)});}
    const live=AbortSignal.any([combined,validation.signal]);
    try {
      await this.#provider.acquire(authorization,{signal:live});
      validation=await this.#validate(request,authorization,review,"consume",live);
      if(!validation.decision.allowed || validation.signal.aborted || live.aborted)return denied("stale","shell_authorization_changed");
      entry.live=AbortSignal.any([live,validation.signal]);
      const permit=this.#authority.issue(request,authorization,review,entry.live,this.observeTime());this.#used.add(authorization.authorizationId);
      let result=await this.#provider.run(request,authorization,permit,{signal:entry.live,onOutput:output});
      await Promise.all(progress);
      if(progressError)result=new ShellResult({...result,status:"error",reason:"shell_output_channel_failed",candidates:[],generatedEffects:[]});
      if(!(result instanceof ShellResult) || result.requestDigest!==request.digest || result.requestId!==request.requestId || result.runId!==request.runId)throw new TypeError("invalid_shell_provider_result");
      if(result.status==="ready_for_publication") {
        validation=await this.#validate(request,authorization,review,"publication",entry.live);
        if(!validation.decision.allowed || validation.signal.aborted || entry.live.aborted)result=new ShellResult({...result,status:"stale",reason:"shell_authorization_changed",candidates:[],generatedEffects:[]});
        else {entry.receipt=_createShellPublicationReceipt({request,authorization,review,result,signal:entry.live,observedAtMs:this.observeTime()});entry.authorization=authorization;entry.review=review;}
      }
      entry.result=result;
      return Object.freeze({decision:this.#decision(request,true,result.reason),result});
    }catch(error){let reason="shell_infrastructure_error";if(error instanceof ShellProviderError)reason=error.message;if(combined.aborted)return denied("cancelled","shell_cancelled_or_timeout");return denied("error",reason);}
    finally{if(entry.receipt===null){clearTimeout(entry.budgetTimer);await this.#provider.release(authorization.prepareId);}}
  }
  async run(request,authorization,review,options={}) {
    if(!(request instanceof ShellRequest) || !(authorization instanceof ShellAuthorization) || !(review instanceof ShellReview))throw new TypeError("typed_shell_request_authorization_review_required");
    const promise=this.#run(request,authorization,review,options);this.#runs.add(promise);try{return await promise;}finally{this.#runs.delete(promise);}
  }
  async readCandidate(requestId,resource){const entry=this.#requests.get(requestId);if(entry?.receipt===null || entry===undefined || entry.live.aborted)throw new TypeError("shell_publication_unavailable");const validation=await this.#validate(entry.request,entry.authorization,entry.review,"publication",entry.live);if(!validation.decision.allowed || validation.signal.aborted)throw new TypeError("shell_publication_revoked");return await this.#provider.readCandidate(entry.preparation.prepareId,resource);}
  async readCandidateData(requestId,resource){
    const entry=this.#requests.get(requestId);if(entry===undefined || entry.receipt===null || entry.live.aborted)throw new TypeError("shell_publication_unavailable");
    const validation=await this.#validate(entry.request,entry.authorization,entry.review,"publication",entry.live);if(!validation.decision.allowed || validation.signal.aborted)throw new TypeError("shell_publication_revoked");
    return await this.#provider.readCandidateData(entry.preparation.prepareId,resource);
  }
  /** Host-only opaque receipt, excluded from ShellResult/PiToolResult/history. */
  async publicationReceipt(requestId){const entry=this.#requests.get(requestId);if(entry?.receipt===null || entry===undefined || entry.live.aborted)throw new TypeError("shell_publication_unavailable");const validation=await this.#validate(entry.request,entry.authorization,entry.review,"publication",entry.live);if(!validation.decision.allowed || validation.signal.aborted)throw new TypeError("shell_publication_revoked");return entry.receipt;}
  async publishGenerated(requestId,{signal}={}) {
    const entry=this.#requests.get(requestId);if(entry===undefined || entry.receipt===null || entry.live.aborted)throw new TypeError("shell_publication_unavailable");
    const validation=await this.#validate(entry.request,entry.authorization,entry.review,"publication",entry.live);if(!validation.decision.allowed || validation.signal.aborted)throw new TypeError("shell_publication_revoked");
    return await this.#provider.publishGenerated(entry.preparation.prepareId,entry.authorization,{signal:AbortSignal.any([entry.live,this.#signal(signal)])});
  }
  async recoverGenerated(requestId){const entry=this.#requests.get(requestId);if(entry===undefined)throw new TypeError("shell_recovery_request_unknown");return await this.#provider.recoverGenerated(entry.preparation.prepareId);}
  async finishPublication(requestId,{results,generatedResult}={}) {
    const entry=this.#requests.get(requestId);if(entry===undefined)return;
    let final=entry.result;
    try {
      if(results!==undefined) {
        if(!Array.isArray(results) || results.some(item=>!(item instanceof MutationResult)))throw new TypeError("typed_source_publication_results_required");
        const publishedResources=[];const seen=new Set();
        for(const result of results) {
          const candidate=entry.result.candidates.find(item=>item.resource===result.resource);
          if(candidate===undefined || seen.has(result.resource))throw new TypeError("unknown_or_duplicate_publication_result");seen.add(result.resource);
          if(result.observedMutation) {
            if(candidate.action!=="delete" && result.contentDigest!==candidate.sha256)throw new TypeError("published_sha_mismatch");
            if(candidate.action==="delete" && result.tombstone?.priorSha256!==candidate.baseline.sha256)throw new TypeError("published_tombstone_mismatch");
            publishedResources.push({resource:result.resource,action:candidate.action,sha256:candidate.sha256,missing:candidate.action==="delete"});
          }
        }
        let status="published";let reason="shell_publication_completed";
        if(results.length!==entry.result.candidates.length || results.some(result=>!result.success) || (entry.result.generatedEffects.length!==0 && generatedResult?.status!=="published")){status="partial_published";reason="shell_publication_incomplete";}
        if(generatedResult!==undefined)for(const resource of generatedResult.resources ?? [])publishedResources.push({resource,action:"generated",sha256:null,missing:false});
        if(entry.live.aborted){status="partial_published";reason="shell_publication_revoked_or_timeout";}
        final=new ShellResult({...entry.result,status,reason,publishedResources,finishedAt:new Date(this.observeTime()).toISOString()});
        await this.#provider.recordSourcePublication(entry.preparation.prepareId,final);
      }
    }finally{clearTimeout(entry.budgetTimer);await this.#provider.release(entry.preparation.prepareId);entry.receipt=null;}
    entry.result=final;return final;
  }
  async close(){if(this.#closed)return;this.#closed=true;this.#closing.abort();this.#authority.revoke();await Promise.allSettled([...this.#runs]);for(const entry of this.#requests.values())clearTimeout(entry.budgetTimer);await this.#provider.close();}
}
