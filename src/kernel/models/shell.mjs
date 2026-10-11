/** Pure Shell values and opaque in-process authority. Model construction never proves PM approval. */
import { modelRecord, modelString, normalizeProjectReadResource, digestValue, _registerShellPublication, _assertObservedAtMs } from "./core.mjs";

export function shellSha(value, field = "sha256") {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new TypeError("invalid_" + field);
  return value;
}
function bounded(value, name, min, max) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new TypeError(name + "_budget");
  return value;
}
export function shellEffects(value = []) {
  if (!Array.isArray(value) || value.length > 64) throw new TypeError("shell_effect_budget");
  const seen = new Set();
  const result = value.map((item) => {
    if (typeof item !== "string" || !item.endsWith("/")) throw new TypeError("exact_generated_directory_required");
    const resource = normalizeProjectReadResource(item.slice(0,-1)) + "/";
    const key = resource.toLowerCase();
    if (seen.has(key) || [...seen].some((prior) => key.startsWith(prior) || prior.startsWith(key))) {
      throw new TypeError("overlapping_generated_effect");
    }
    seen.add(key); return resource;
  });
  return Object.freeze(result.sort());
}
export class FileBaseline {
  constructor(value) {
    modelRecord(value, "FileBaseline", ["resource", "state", "sha256", "byteLength", "executable"]);
    this.resource = normalizeProjectReadResource(value.resource);
    if (!["present", "absent"].includes(value.state)) throw new TypeError("invalid_baseline_state");
    this.state = value.state;
    this.sha256 = null; this.byteLength = 0;
    if (this.state === "present") {
      this.sha256 = shellSha(value.sha256);
      this.byteLength = bounded(value.byteLength,"byteLength",0,Number.MAX_SAFE_INTEGER);
    } else if ((value.sha256 !== undefined && value.sha256 !== null) || (value.byteLength !== undefined && value.byteLength !== 0)) {
      throw new TypeError("absent_baseline_has_content");
    }
    if(value.executable!==undefined){if(this.state!=="present" || typeof value.executable!=="boolean")throw new TypeError("invalid_baseline_executable");this.executable=value.executable;}
    Object.freeze(this);
  }
  get digest() { return digestValue(this); }
}
export function shellBaselines(value) {
  if (!Array.isArray(value) || value.length > 1000000) throw new TypeError("shell_input_budget");
  const seen = new Set();
  const result = value.map((item) => {
    let file = item;
    if (!(file instanceof FileBaseline)) file = new FileBaseline(item);
    const key = file.resource.toLowerCase();
    if (seen.has(key)) throw new TypeError("duplicate_baseline_alias");
    seen.add(key); return file;
  });
  return Object.freeze(result.sort((a,b) => a.resource.localeCompare(b.resource)));
}
export class ShellRequest {
  constructor(value) {
    modelRecord(value,"ShellRequest",["requestId","runId","command","cwd","reason","generatedEffects","network","timeoutSeconds"]);
    for (const key of ["requestId","runId","command","reason"]) this[key] = modelString(value[key],key);
    if (Buffer.byteLength(this.command,"utf8") > 65536 || this.command.includes("\0")) throw new TypeError("shell_command_budget");
    this.cwd = value.cwd ?? "";
    if (this.cwd !== "") this.cwd = normalizeProjectReadResource(this.cwd);
    this.generatedEffects = shellEffects(value.generatedEffects);
    this.network = value.network ?? "none";
    if (!["none","localhost","external"].includes(this.network)) throw new TypeError("invalid_shell_network");
    this.timeoutSeconds = bounded(value.timeoutSeconds ?? 300,"timeoutSeconds",1,900);
    Object.freeze(this);
  }
  get digest() { return digestValue(this); }
}
export class ShellReview {
  constructor(value) {
    modelRecord(value,"ShellReview",["requestId","requestDigest","revision","approved","reason"]);
    this.requestId = modelString(value.requestId,"requestId");
    this.requestDigest = shellSha(value.requestDigest,"requestDigest");
    this.revision = bounded(value.revision,"revision",1,Number.MAX_SAFE_INTEGER);
    if (typeof value.approved !== "boolean") throw new TypeError("shell_review_boolean_required");
    this.approved = value.approved; this.reason = modelString(value.reason,"reason"); Object.freeze(this);
  }
  get digest() { return digestValue(this); }
}
export class ShellPreparation {
  constructor(value) {
    modelRecord(value,"ShellPreparation",["prepareId","requestId","requestDigest","actualCwd","inputVersions","generationDigest"]);
    for (const field of ["prepareId","requestId","actualCwd"]) this[field] = modelString(value[field],field);
    this.requestDigest = shellSha(value.requestDigest,"requestDigest");
    this.inputVersions = shellBaselines(value.inputVersions);
    this.generationDigest = shellSha(value.generationDigest,"generationDigest");
    Object.freeze(this);
  }
  get snapshotDigest() { return digestValue(this.inputVersions); }
  get digest() { return digestValue(this); }
}
export function shellArtifacts(values=[]) {
 if(!Array.isArray(values) || values.length>64)throw new TypeError("shell_artifact_budget");
 const scopes=shellEffects(values.map(value=>value.scope));
 return Object.freeze(scopes.map(scope=>{const value=values.find(item=>item.scope===scope);modelRecord(value,"artifact",["scope","kind"]);if(!["dependencies","build"].includes(value.kind))throw new TypeError("invalid_artifact_kind");return Object.freeze({scope,kind:value.kind});}));
}
export class ShellAuthorization {
  constructor(value) {
    const fields = ["authorizationId","projectId","prepareId","organizationVersion","roleId","taskId","sessionId","instanceId","runId","profileVersion","expiresAt"];
    const hashes = ["requestDigest","reviewDigest","planDigest","contextSnapshotDigest","fileOwnersDigest","snapshotDigest","generationDigest"];
    modelRecord(value,"ShellAuthorization",[...fields,...hashes,"workspaceIdentity","ownerGeneration","generatedEffects","inputVersions","fileOwners","artifactScopes","authoredResources"]);
    for (const field of fields) this[field] = modelString(value[field],field);
    for (const field of hashes) this[field] = shellSha(value[field],field);
    const identity = modelRecord(value.workspaceIdentity,"workspaceIdentity",["canonicalPath","deviceId","fileId"]);
    if (typeof identity.canonicalPath !== "string" || (!identity.canonicalPath.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(identity.canonicalPath)) || identity.canonicalPath.includes("\0")) {
      throw new TypeError("invalid_workspace_identity");
    }
    for (const field of ["deviceId","fileId"]) {
      if (typeof identity[field] !== "string" || !/^[0-9]+$/.test(identity[field])) throw new TypeError("invalid_workspace_identity");
    }
    this.workspaceIdentity = Object.freeze({canonicalPath:identity.canonicalPath.replaceAll("\\","/"),deviceId:identity.deviceId,fileId:identity.fileId});
    this.ownerGeneration = modelString(value.ownerGeneration, "ownerGeneration");
    this.generatedEffects = shellEffects(value.generatedEffects);
    this.artifactScopes=shellArtifacts(value.artifactScopes);
    if(this.generatedEffects.some(scope=>!this.artifactScopes.some(artifact=>artifact.scope===scope)))throw new TypeError("generated_effect_not_approved_artifact");
    const owners=modelRecord(value.fileOwners,"fileOwners",["projectId","version","owners"]);
    if(owners.projectId!==this.projectId || !Array.isArray(owners.owners))throw new TypeError("shell_file_owners_required");
    const version=modelString(owners.version,"owner version"),aliases=new Set();
    const entries=owners.owners.map(item=>{modelRecord(item,"owner",["resource","roleId"]);const resource=normalizeProjectReadResource(item.resource);const key=resource.toLowerCase();if(aliases.has(key))throw new TypeError("duplicate_owner_alias");aliases.add(key);return Object.freeze({resource,roleId:modelString(item.roleId,"owner role")});}).sort((a,b)=>a.resource.toLowerCase().localeCompare(b.resource.toLowerCase()));
    this.fileOwners=Object.freeze({projectId:this.projectId,version,owners:Object.freeze(entries)});
    if(digestValue({projectId:this.projectId,version,owners:entries.map(item=>({resource:item.resource.toLowerCase(),roleId:item.roleId}))})!==this.fileOwnersDigest)throw new TypeError("shell_file_owners_digest_mismatch");
    if(this.ownerGeneration!==version)throw new TypeError("stale_file_owners");
    let authored=value.authoredResources;
    if(authored===undefined){if(this.generatedEffects.length!==0)throw new TypeError("complete_authored_inventory_required");authored=entries.map(item=>item.resource);}
    if(!Array.isArray(authored))throw new TypeError("complete_authored_inventory_required");
    this.authoredResources=Object.freeze(authored.map(resource=>normalizeProjectReadResource(resource)).sort());
    if(entries.some(item=>!this.authoredResources.includes(item.resource)))throw new TypeError("incomplete_authored_inventory");
    if(this.generatedEffects.some(scope=>this.authoredResources.some(resource=>(resource.toLowerCase()===scope.slice(0,-1).toLowerCase() || resource.toLowerCase().startsWith(scope.toLowerCase())))))throw new TypeError("generated_effect_overlaps_authored_source");
    if(this.generatedEffects.some(scope=>entries.some(item=>(item.resource.toLowerCase()===scope.slice(0,-1).toLowerCase() || item.resource.toLowerCase().startsWith(scope.toLowerCase())))))throw new TypeError("generated_effect_overlaps_authored_source");
    this.inputVersions = shellBaselines(value.inputVersions);
    if (digestValue(this.inputVersions) !== this.snapshotDigest) throw new TypeError("snapshot_digest_mismatch");
    if (!Number.isFinite(Date.parse(this.expiresAt)) || new Date(this.expiresAt).toISOString() !== this.expiresAt) throw new TypeError("invalid_shell_expiry");
    Object.freeze(this);
  }
  get digest() { return digestValue(this); }
}
export class ShellDecision {
  constructor(value) {
    modelRecord(value,"ShellDecision",["requestId","runId","requestDigest","allowed","reason"]);
    this.requestId = modelString(value.requestId,"requestId"); this.runId = modelString(value.runId,"runId");
    this.requestDigest = shellSha(value.requestDigest,"requestDigest");
    if (typeof value.allowed !== "boolean") throw new TypeError("invalid_shell_decision");
    this.allowed = value.allowed; this.reason = modelString(value.reason,"reason"); Object.freeze(this);
  }
}
export class ShellCandidate {
  constructor(value) {
    modelRecord(value,"ShellCandidate",["resource","action","baseline","sha256","byteLength","executable","encoding"]);
    this.resource = normalizeProjectReadResource(value.resource);
    if (!["create","replace","delete"].includes(value.action)) throw new TypeError("invalid_shell_candidate_action");
    this.action = value.action; this.baseline = new FileBaseline(value.baseline);
    if (this.baseline.resource !== this.resource || (this.action === "create") !== (this.baseline.state === "absent")) {
      throw new TypeError("candidate_baseline_mismatch");
    }
    this.sha256 = null; this.byteLength = 0;
    if (this.action !== "delete") {
      this.sha256 = shellSha(value.sha256); this.byteLength = bounded(value.byteLength,"byteLength",0,2097152);
    }
    this.executable = value.executable === true;
    this.encoding=value.encoding ?? "utf8";if(!["utf8","base64"].includes(this.encoding))throw new TypeError("invalid_candidate_encoding");Object.freeze(this);
  }
  get digest() { return digestValue(this); }
}
export class ShellResult {
  constructor(value) {
    modelRecord(value,"ShellResult",["requestId","runId","requestDigest","status","reason","executed","exitCode","stdout","stderr","logsTruncated","candidates","generatedEffects","generationDigest","actualCwd","startedAt","finishedAt","publishedResources","logRef"]);
    for (const field of ["requestId","runId","reason","startedAt","finishedAt"]) this[field] = modelString(value[field],field);
    this.requestDigest = shellSha(value.requestDigest,"requestDigest");
    if (!["ready_for_publication","published","partial_published","failed","denied","cancelled","stale","unsupported","error"].includes(value.status)) throw new TypeError("invalid_shell_status");
    this.status = value.status;
    if (typeof value.executed !== "boolean" || typeof value.logsTruncated !== "boolean") throw new TypeError("shell_result_flags_required");
    this.executed = value.executed; this.logsTruncated = value.logsTruncated;
    this.exitCode = value.exitCode;
    if (this.exitCode !== null) bounded(this.exitCode,"exitCode",0,255);
    if (!this.executed && this.exitCode !== null) throw new TypeError("unexecuted_shell_exit");
    this.stdout = modelString(value.stdout ?? "","stdout",{empty:true}); this.stderr = modelString(value.stderr ?? "","stderr",{empty:true});
    if (Buffer.byteLength(this.stdout+this.stderr,"utf8") > 65536) throw new TypeError("shell_response_log_budget");
    this.candidates = Object.freeze((value.candidates ?? []).map((candidate) => new ShellCandidate(candidate)));
    this.generatedEffects = shellEffects(value.generatedEffects);
    this.generationDigest = shellSha(value.generationDigest,"generationDigest");
    this.actualCwd = modelString(value.actualCwd ?? "","actualCwd",{empty:true});
    if (["ready_for_publication","published","partial_published"].includes(this.status) && (!this.executed || this.exitCode !== 0)) throw new TypeError("shell_ready_needs_execution");
    if (!["ready_for_publication","published","partial_published"].includes(this.status) && this.candidates.length !== 0) throw new TypeError("failed_shell_has_candidates");
    this.publishedResources=Object.freeze((value.publishedResources ?? []).map(item=>{
      modelRecord(item,"published resource",["resource","action","sha256","missing"]);const resource=normalizeProjectReadResource(item.resource);
      if(!["create","replace","delete","generated"].includes(item.action))throw new TypeError("invalid_published_action");let sha256=null;if(item.sha256!==null && item.sha256!==undefined)sha256=shellSha(item.sha256);
      if(typeof item.missing!=="boolean")throw new TypeError("published_missing_flag_required");return Object.freeze({resource,action:item.action,sha256,missing:item.missing});
    }));
    this.logRef=modelString(value.logRef ?? "","logRef",{empty:true});Object.freeze(this);
  }
  get digest() { return digestValue(this); }
}

const authorities = new WeakSet();
/** Lower opaque capability, retained only by trusted Service/Provider; never exposed to SDK or renderer. */
export function _createShellExecutionAuthority() {
  const issued = new Map(); const consumed = new Set();
  const authority = Object.freeze({
    issue(request,authorization,review,signal,observedAtMs) {
      _assertObservedAtMs(observedAtMs);
      if (!(request instanceof ShellRequest) || !(authorization instanceof ShellAuthorization) || !(review instanceof ShellReview) || !(signal instanceof AbortSignal)) {
        throw new TypeError("typed_shell_execution_required");
      }
      if (signal.aborted || !review.approved || request.digest !== review.requestDigest || request.requestId !== review.requestId ||
          authorization.requestDigest !== request.digest || authorization.reviewDigest !== review.digest || authorization.runId !== request.runId ||
          Date.parse(authorization.expiresAt) <= observedAtMs || consumed.has(authorization.authorizationId)) throw new TypeError("invalid_shell_binding");
      const permit = Object.freeze({});
      issued.set(permit,{request,authorization,review,signal}); return permit;
    },
    consume(request,authorization,permit,observedAtMs) {
      const binding = issued.get(permit); issued.delete(permit);
      _assertObservedAtMs(observedAtMs);
      if (binding === undefined || binding.request !== request || binding.authorization !== authorization || binding.signal.aborted ||
          Date.parse(authorization.expiresAt) <= observedAtMs || consumed.has(authorization.authorizationId)) throw new TypeError("invalid_or_replayed_shell_permit");
      consumed.add(authorization.authorizationId); return binding.signal;
    },
    revoke() { issued.clear(); }
  });
  authorities.add(authority); return authority;
}
export function _isShellExecutionAuthority(value) { return authorities.has(value); }

/** Internal typed producer, invoked only after real Service execution and live Host verification. */
export function _createShellPublicationReceipt(value) {
 const {request,authorization,review,result,signal,observedAtMs}=value;
 _assertObservedAtMs(observedAtMs);
 if(!(request instanceof ShellRequest) || !(authorization instanceof ShellAuthorization) || !(review instanceof ShellReview) || !(result instanceof ShellResult) || !(signal instanceof AbortSignal) || signal.aborted || Date.parse(authorization.expiresAt)<=observedAtMs || result.status!=="ready_for_publication" || result.requestDigest!==request.digest || authorization.reviewDigest!==review.digest)throw new TypeError("actual_shell_publication_required");
 return _registerShellPublication(value);
}
