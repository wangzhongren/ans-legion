/** Shared immutable contracts and pure authorization invariants. No infrastructure effects. */
import { createHash } from "node:crypto";

export function modelRecord(value, name, allowedKeys) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(name + " must be a record");
  }
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) throw new TypeError(name + ": unknown field " + key);
  }
  return value;
}

export function modelString(value, name, { empty = false } = {}) {
  if (typeof value !== "string") throw new TypeError(name + " must be text");
  if (!empty && value.trim().length === 0) throw new TypeError(name + " must be nonempty");
  return value;
}

export function immutableStrings(value, name) {
  if (typeof value === "string" || value === null || value === undefined ||
      typeof value[Symbol.iterator] !== "function") {
    throw new TypeError(name + " must be a collection of strings");
  }
  const copied = [];
  for (const item of value) {
    modelString(item, name);
    if (!copied.includes(item)) copied.push(item);
  }
  return Object.freeze(copied);
}

export function digestValue(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

export const Outcome = Object.freeze({
  ALLOW: "ALLOW", DENY: "DENY", REQUIRE_APPROVAL: "REQUIRE_APPROVAL",
  REQUIRE_HANDOFF: "REQUIRE_HANDOFF", REQUIRE_SCOPE_EXPANSION: "REQUIRE_SCOPE_EXPANSION",
});

const controlPlanes = Object.freeze([".ans", ".git", ".agents", ".codex", ".aws"]);
const credentialDirectories = new Set([".ssh", ".docker", ".kube", ".gnupg", ".azure",
  ".gcloud", ".terraform", ".terraform.d"]);
const credentialFiles = new Set([".npmrc", ".netrc", "_netrc", ".pypirc", ".git-credentials",
  ".authinfo", ".authinfo.gpg", ".pgpass", ".my.cnf", ".s3cfg", ".boto"]);
const privateKeyNames = new Set(["id_rsa", "id_ed25519", "id_ecdsa", "id_dsa"]);
const devices = new Set(["con", "prn", "aux", "nul"]);
for (let index = 1; index <= 9; index += 1) {
  devices.add("com" + index);
  devices.add("lpt" + index);
}

export function normalizeResource(resource, { allowControlPlane = false } = {}) {
  modelString(resource, "resource");
  const normalized = resource.replaceAll("\\", "/");
  if (normalized.startsWith("/") || normalized.includes(":")) throw new TypeError("absolute_resource");
  const parts = normalized.split("/");
  for (const component of parts) {
    if (component === "" || component === "." || component === ".." ||
        /[. ]$/.test(component) || /[\x00-\x1f<>|"*?]/.test(component)) {
      throw new TypeError("invalid_component");
    }
    if (devices.has(component.toLowerCase().split(".")[0])) throw new TypeError("reserved_component");
  }
  if (!allowControlPlane && controlPlanes.includes(parts[0].toLowerCase())) {
    throw new TypeError("control_plane");
  }
  return normalized;
}

/** Model-visible project reads exclude control and common credential paths at every depth. */
export function normalizeProjectReadResource(resource, { allowRoot = false } = {}) {
  if (resource === "" && allowRoot) return "";
  const normalized = normalizeResource(resource, { allowControlPlane: true });
  for (const part of normalized.split("/")) {
    const lower = part.toLowerCase();
    if (controlPlanes.includes(lower) || credentialDirectories.has(lower) || credentialFiles.has(lower) ||
        lower === ".env" || lower.startsWith(".env.") ||
        /\.(pem|key|p12|pfx|jks|keystore)$/.test(lower) ||
        privateKeyNames.has(lower)) {
      throw new TypeError("restricted_resource");
    }
  }
  return normalized;
}

export function normalizeScope(scope, { allowControlPlane = true } = {}) {
  modelString(scope, "scope");
  const normalized = scope.replaceAll("\\", "/");
  if (normalized.endsWith("/")) {
    return normalizeResource(normalized.slice(0, -1), { allowControlPlane }) + "/";
  }
  return normalizeResource(normalized, { allowControlPlane });
}

export function scopeContains(scope, resource) {
  const candidate = normalizeResource(resource).toLowerCase();
  const allowed = normalizeScope(scope).toLowerCase();
  if (allowed.endsWith("/")) return candidate.startsWith(allowed);
  return candidate === allowed;
}

function writeScopesOverlap(first, second) {
  const left = normalizeScope(first).toLowerCase();
  const right = normalizeScope(second).toLowerCase();
  if (left === right) return true;
  if (left.endsWith("/") && right.startsWith(left)) return true;
  if (right.endsWith("/") && left.startsWith(right)) return true;
  return false;
}

/** Different roles cannot own the same write path, including directory descendants. */
export function assertDistinctRoleWriteScopes(boundaries) {
  if (!Array.isArray(boundaries) || boundaries.some((boundary) => !(boundary instanceof RoleBoundary))) {
    throw new TypeError("typed_boundaries_required");
  }
  for (let index = 0; index < boundaries.length; index += 1) {
    for (let other = index + 1; other < boundaries.length; other += 1) {
      if (boundaries[index].roleId === boundaries[other].roleId) continue;
      for (const first of boundaries[index].writeScope) {
        for (const second of boundaries[other].writeScope) {
          if (writeScopesOverlap(first, second)) throw new TypeError("cross_role_write_scope_overlap");
        }
      }
    }
  }
}

function scopeCollection(value, name) {
  return Object.freeze(immutableStrings(value, name).map((scope) => {
    if (name === "readScope" && scope === ".") return scope;
    return normalizeScope(scope);
  }));
}

export class RoleBoundary {
  constructor(options) {
    const fields = ["roleId", "readScope", "writeScope", "denyScope", "capabilities", "tools",
      "requiredApprovals", "handoffTargets", "allowScopeExpansion"];
    modelRecord(options, "RoleBoundary", fields);
    const { roleId, readScope = [], writeScope = [], denyScope = [], capabilities = [], tools = [],
      requiredApprovals = [], handoffTargets = [], allowScopeExpansion = false } = options;
    this.roleId = modelString(roleId, "roleId");
    this.readScope = scopeCollection(readScope, "readScope");
    this.writeScope = scopeCollection(writeScope, "writeScope");
    this.denyScope = scopeCollection(denyScope, "denyScope");
    this.capabilities = immutableStrings(capabilities, "capabilities");
    this.tools = immutableStrings(tools, "tools");
    this.requiredApprovals = immutableStrings(requiredApprovals, "requiredApprovals");
    for (const approval of this.requiredApprovals) {
      if (approval !== "write_file") normalizeResource(approval);
    }
    this.handoffTargets = immutableStrings(handoffTargets, "handoffTargets");
    if (typeof allowScopeExpansion !== "boolean") throw new TypeError("allowScopeExpansion must be boolean");
    this.allowScopeExpansion = allowScopeExpansion;
    Object.freeze(this);
  }

  get digest() {
    return digestValue({ roleId: this.roleId, read: [...this.readScope].sort(), write: [...this.writeScope].sort(),
      deny: [...this.denyScope].sort(), capabilities: [...this.capabilities].sort(),
      tools: [...this.tools].sort(), approvals: [...this.requiredApprovals].sort(),
      handoff: [...this.handoffTargets].sort(), expansion: this.allowScopeExpansion });
  }
}

export function requiresApproval(boundary, action, resource) {
  if (!(boundary instanceof RoleBoundary)) throw new TypeError("invalid_boundary");
  if (boundary.requiredApprovals.includes(action) ||
      (["edit_file","delete_file"].includes(action) && boundary.requiredApprovals.includes("write_file"))) return true;
  const candidate = normalizeResource(resource).toLowerCase();
  for (const approval of boundary.requiredApprovals) {
    if (approval !== "write_file" && normalizeResource(approval).toLowerCase() === candidate) return true;
  }
  return false;
}

export class AgentSession {
  constructor(options) {
    modelRecord(options, "AgentSession", ["sessionId", "roleId", "taskId", "organizationVersion"]);
    for (const field of ["sessionId", "roleId", "taskId", "organizationVersion"]) {
      this[field] = modelString(options[field], field);
    }
    Object.freeze(this);
  }
}

export class ActionProposal {
  constructor(options) {
    modelRecord(options, "ActionProposal", ["proposalId", "action", "resource", "content", "tool",
      "capability", "session", "runId", "expectedSha256", "replacements", "expectedBaseline", "executable", "contentBase64"]);
    for (const field of ["proposalId", "action", "resource", "tool", "capability"]) {
      this[field] = modelString(options[field], field);
    }
    if(options.expectedBaseline!==undefined) {
      const baseline=modelRecord(options.expectedBaseline,"expectedBaseline",["resource","state","sha256","byteLength","executable"]);
      if(normalizeProjectReadResource(baseline.resource)!==this.resource || !["present","absent"].includes(baseline.state))throw new TypeError("invalid_publication_baseline");
      let sha256=null;let byteLength=0;
      if(baseline.state==="present") {
        if(typeof baseline.sha256!=="string" || !/^[a-f0-9]{64}$/.test(baseline.sha256) || !Number.isSafeInteger(baseline.byteLength) || baseline.byteLength<0)throw new TypeError("invalid_publication_baseline");
        sha256=baseline.sha256;byteLength=baseline.byteLength;
      } else if((baseline.sha256!==undefined && baseline.sha256!==null) || (baseline.byteLength!==undefined && baseline.byteLength!==0))throw new TypeError("invalid_publication_baseline");
      const value={resource:this.resource,state:baseline.state,sha256,byteLength};if(baseline.executable!==undefined){if(typeof baseline.executable!=="boolean" || baseline.state!=="present")throw new TypeError("invalid_publication_baseline");value.executable=baseline.executable;}this.expectedBaseline=Object.freeze(value);
    }
    if(options.contentBase64!==undefined) {
      if(this.tool!=="legion_shell_publish" || this.action!=="write_file" || options.content!==undefined || typeof options.contentBase64!=="string" || options.contentBase64.length>2796204)throw new TypeError("invalid_binary_publication");
      const bytes=Buffer.from(options.contentBase64,"base64");
      if(bytes.byteLength>2097152 || bytes.toString("base64")!==options.contentBase64)throw new TypeError("noncanonical_binary_publication");
      this.contentBase64=options.contentBase64;
    }
    if(options.executable!==undefined){if(this.tool!=="legion_shell_publish" || this.action!=="write_file" || typeof options.executable!=="boolean")throw new TypeError("invalid_publication_executable");this.executable=options.executable;}
    if(this.action==="delete_file") {
      if(this.expectedBaseline?.state!=="present" || (options.content!==undefined && options.content!=="") || options.replacements!==undefined || options.expectedSha256!==undefined)throw new TypeError("delete_requires_exact_present_baseline");
      this.content="";
    } else if (this.action === "edit_file") {
      if (options.content !== undefined && options.content !== "") throw new TypeError("edit_content_must_be_omitted");
      this.content = "";
      if (typeof options.expectedSha256 !== "string" || !/^[a-f0-9]{64}$/.test(options.expectedSha256)) {
        throw new TypeError("expected_sha256_required");
      }
      this.expectedSha256 = options.expectedSha256;
      if (!Array.isArray(options.replacements) || options.replacements.length < 1 || options.replacements.length > 16) {
        throw new TypeError("edit_replacement_budget");
      }
      const oldTexts = new Set();
      let bytes = 0;
      this.replacements = Object.freeze(options.replacements.map((replacement) => {
        modelRecord(replacement, "edit replacement", ["oldText", "newText"]);
        if (typeof replacement.oldText !== "string" || replacement.oldText.length === 0) {
          throw new TypeError("oldText must be nonempty");
        }
        const oldText = replacement.oldText;
        const newText = modelString(replacement.newText, "newText", { empty: true });
        if (oldTexts.has(oldText)) throw new TypeError("duplicate_old_text");
        oldTexts.add(oldText);
        bytes += Buffer.byteLength(oldText, "utf8") + Buffer.byteLength(newText, "utf8");
        if (bytes > 2097152) throw new TypeError("edit_replacement_budget");
        return Object.freeze({ oldText, newText });
      }));
    } else {
      if (options.expectedSha256 !== undefined || options.replacements !== undefined) {
        throw new TypeError("unexpected_edit_fields");
      }
      this.content="";if(this.contentBase64===undefined)this.content = modelString(options.content, "content", { empty: true });
    }
    if (!(options.session instanceof AgentSession)) throw new TypeError("session must be AgentSession");
    this.session = options.session;
    this.runId = modelString(options.runId ?? "", "runId", { empty: true });
    Object.freeze(this);
  }

  get contentByteLength() {if(this.contentBase64!==undefined)return Buffer.from(this.contentBase64,"base64").byteLength;return Buffer.byteLength(this.content,"utf8");}
  get contentDigest() {
    if(this.contentBase64!==undefined)return createHash("sha256").update(Buffer.from(this.contentBase64,"base64")).digest("hex");
    if (this.action === "edit_file") return digestValue(this.replacements);
    if(this.action==="delete_file")return digestValue({resource:this.resource,state:"absent",priorSha256:this.expectedBaseline.sha256});
    return createHash("sha256").update(this.content, "utf8").digest("hex");
  }
  get digest() {
    const session = this.session;
    if(this.expectedBaseline!==undefined)return digestValue([this.proposalId,this.action,this.resource,this.contentDigest,this.expectedBaseline,this.executable,this.tool,this.capability,session.sessionId,session.roleId,session.taskId,session.organizationVersion,this.runId]);
    if (this.action === "edit_file") return digestValue([this.proposalId, this.action, this.resource,
      this.expectedSha256, this.replacements, this.tool, this.capability, session.sessionId, session.roleId,
      session.taskId, session.organizationVersion, this.runId]);
    return digestValue([this.proposalId, this.action, this.resource, this.contentDigest, this.tool,
      this.capability, session.sessionId, session.roleId, session.taskId, session.organizationVersion, this.runId]);
  }
}

export class PolicyDecision {
  constructor(options) {
    modelRecord(options, "PolicyDecision", ["outcome", "reason", "proposalDigest", "organizationVersion",
      "boundaryDigest", "handoffTarget"]);
    if (!Object.values(Outcome).includes(options.outcome)) throw new TypeError("invalid_outcome");
    this.outcome = options.outcome;
    this.reason = modelString(options.reason, "reason");
    this.proposalDigest = modelString(options.proposalDigest, "proposalDigest", { empty: true });
    this.organizationVersion = modelString(options.organizationVersion, "organizationVersion");
    this.boundaryDigest = modelString(options.boundaryDigest ?? "", "boundaryDigest", { empty: true });
    this.handoffTarget = modelString(options.handoffTarget ?? "", "handoffTarget", { empty: true });
    Object.freeze(this);
  }
}

/** Construction alone never creates authorization. Identity is opaque; no token is exposed. */
export class ExecutionPermit {
  constructor() { Object.freeze(this); }
}

export class MutationResult {
  constructor(options) {
    modelRecord(options, "MutationResult", ["success", "status", "reason", "resource", "proposalDigest",
      "observedMutation", "auditFailed", "contentDigest", "missing", "tombstone"]);
    const { success, status, reason, resource = "", proposalDigest = "", observedMutation = false,
      auditFailed = false } = options;
    if (typeof success !== "boolean" || typeof observedMutation !== "boolean" || typeof auditFailed !== "boolean") {
      throw new TypeError("mutation flags must be boolean");
    }
    if (!["written", "deleted", "denied", "failed", "audit_failed"].includes(status)) throw new TypeError("invalid_status");
    if (success && (!["written","deleted"].includes(status) || !observedMutation || auditFailed)) {
      throw new TypeError("invalid_success_observation");
    }
    this.success = success;
    this.status = status;
    this.reason = modelString(reason, "reason");
    this.resource = modelString(resource, "resource", { empty: true });
    this.proposalDigest = modelString(proposalDigest, "proposalDigest", { empty: true });
    if (options.contentDigest !== undefined) {
      this.contentDigest = modelString(options.contentDigest, "contentDigest");
      if (!/^[a-f0-9]{64}$/.test(this.contentDigest)) throw new TypeError("invalid_content_digest");
    }
    this.observedMutation = observedMutation;
    this.auditFailed = auditFailed;
    if(options.missing!==undefined) {
      if(typeof options.missing!=="boolean" || (options.missing && (!observedMutation || !["deleted","audit_failed"].includes(status))))throw new TypeError("invalid_missing_observation");
      this.missing=options.missing;
    }
    if(options.tombstone!==undefined) {
      const tombstone=modelRecord(options.tombstone,"tombstone",["resource","priorSha256","proposalDigest"]);
      if(!observedMutation || !["deleted","audit_failed"].includes(status) || tombstone.resource!==this.resource || typeof tombstone.priorSha256!=="string" || !/^[a-f0-9]{64}$/.test(tombstone.priorSha256) || tombstone.proposalDigest!==this.proposalDigest)throw new TypeError("invalid_deletion_tombstone");
      this.tombstone=Object.freeze({...tombstone});
    }
    Object.freeze(this);
  }
}

export class Event {
  constructor(options) {
    const fields = ["sequence", "kind", "roleId", "taskId", "organizationVersion", "resource",
      "proposalDigest", "correlationId", "outcome", "reason", "observedMutation", "recordedAt", "contentDigest"];
    modelRecord(options, "Event", fields);
    const { sequence = 0, kind, observedMutation = false } = options;
    if (!Number.isSafeInteger(sequence) || sequence < 0) throw new TypeError("invalid_sequence");
    if (typeof observedMutation !== "boolean") throw new TypeError("invalid_observation");
    this.sequence = sequence;
    this.kind = modelString(kind, "kind");
    for (const field of ["roleId", "taskId", "organizationVersion", "resource", "proposalDigest",
      "correlationId", "outcome", "reason", "recordedAt"]) {
      this[field] = modelString(options[field] ?? "", field, { empty: true });
    }
    this.observedMutation = observedMutation;
    if (options.contentDigest !== undefined) {
      this.contentDigest = modelString(options.contentDigest, "contentDigest");
      if (!/^[a-f0-9]{64}$/.test(this.contentDigest)) throw new TypeError("invalid_content_digest");
    }
    Object.freeze(this);
  }
}

/** Validate exact role ownership and immutable task tools/instance binding, without external effects. */
const controlledCapabilities = Object.freeze({ legion_request_shell:"request_shell", legion_review_shell:"review_shell", legion_run_check: "run_check",
  legion_design_roles: "design_roles", legion_propose_roles: "propose_roles", legion_review_roles: "review_roles",
  legion_request_interaction: "request_interaction", legion_submit_acceptance: "submit_acceptance",
  legion_remember_fact: "remember_fact", legion_query_memory: "query_memory", legion_submit_supervision: "submit_supervision",
  legion_request_repair: "request_repair", legion_delegate_pm: "delegate_pm",
  legion_query_role_activity: "query_role_activity", legion_query_role_log: "query_role_log" });

// Runtime grant snapshots are immutable data, not execution authority. Check Service still requires typed host approval.
function runtimeChecks(values = []) {
  if (!Array.isArray(values) || values.length > 64) throw new TypeError("checks_collection_or_budget");
  const ids = new Set();
  return Object.freeze(values.map((value) => {
    modelRecord(value, "runtime check", ["checkId", "kind", "argv", "testResources", "inputResources",
      "outputResources", "timeoutSeconds", "network", "logMaxBytes"]);
    const checkId = modelString(value.checkId, "checkId");
    if (ids.has(checkId)) throw new TypeError("duplicate_check_id");
    ids.add(checkId);
    if (value.kind !== "node-test") throw new TypeError("unsupported_check_kind");
    const copy = { checkId, kind: value.kind };
    for (const field of ["testResources", "inputResources", "outputResources"]) {
      if (!Array.isArray(value[field]) || value[field].length > 1024) throw new TypeError("invalid_check_resources");
      copy[field] = Object.freeze(value[field].map((resource) => {
        if (field === "outputResources" && resource.endsWith("/")) {
          return normalizeProjectReadResource(resource.slice(0, -1)) + "/";
        }
        return normalizeProjectReadResource(resource);
      }));
    }
    if (copy.testResources.length === 0 || copy.inputResources.length === 0 ||
        copy.testResources.some((resource) => resource.startsWith("-") || !copy.inputResources.includes(resource)) ||
        !Array.isArray(value.argv) || value.argv[0] !== "--test" ||
        value.argv.length !== copy.testResources.length + 1 ||
        copy.testResources.some((resource, index) => value.argv[index + 1] !== resource) ||
        !Number.isSafeInteger(value.timeoutSeconds) || value.timeoutSeconds < 1 || value.timeoutSeconds > 300 ||
        !["none", "localhost"].includes(value.network) || !Number.isSafeInteger(value.logMaxBytes) ||
        value.logMaxBytes < 1 || value.logMaxBytes > 1048576) throw new TypeError("invalid_runtime_check_spec");
    copy.argv = Object.freeze([...value.argv]);
    copy.timeoutSeconds = value.timeoutSeconds; copy.network = value.network; copy.logMaxBytes = value.logMaxBytes;
    return Object.freeze(copy);
  }));
}

/** Pure exact ownership check shared by all runtime grants. */
export function runtimeFileOwners(value) {
  if (value === undefined || value === null) throw new TypeError("file_owners_required");
  const projectId = modelString(value.projectId, "projectId");
  const version = modelString(value.version, "ownerGeneration");
  if (!Array.isArray(value.owners) || value.owners.length > 10000) throw new TypeError("invalid_file_owners");
  const aliases = new Set();
  const owners = value.owners.map(item => {
    modelRecord(item, "owner", ["resource", "roleId"]);
    const resource = normalizeResource(item.resource);
    if (resource.endsWith("/") || aliases.has(resource.toLowerCase())) throw new TypeError("duplicate_or_directory_owner");
    aliases.add(resource.toLowerCase());
    return Object.freeze({ resource, roleId: modelString(item.roleId, "roleId") });
  }).sort((a,b) => a.resource.toLowerCase().localeCompare(b.resource.toLowerCase()));
  const digest = digestValue({ projectId, version, owners: owners.map(item => ({ resource: item.resource.toLowerCase(), roleId: item.roleId })) });
  return Object.freeze({ projectId, version, owners: Object.freeze(owners), digest });
}
export function assertRuntimeOwner(fileOwners, binding, resource, roleId) {
  const owners = runtimeFileOwners(fileOwners);
  if (binding.fileOwnersDigest !== owners.digest || binding.ownerGeneration !== owners.version) throw new TypeError("stale_file_owners");
  const key = normalizeResource(resource).toLowerCase();
  if (!owners.owners.some(item => item.resource.toLowerCase() === key && item.roleId === roleId)) throw new TypeError("file_owner_mismatch");
  return true;
}

export function validateInstanceGrant(boundary, dispatchContext, scope, fileOwners) {
  if (!(boundary instanceof RoleBoundary)) throw new TypeError("invalid_boundary");
  if (boundary.roleId !== dispatchContext.roleId) throw new TypeError("dispatch_role_mismatch");
  modelString(dispatchContext.taskId, "taskId");
  modelString(dispatchContext.organizationVersion, "organizationVersion");
  if (Object.hasOwn(dispatchContext, "writeSet")) throw new TypeError("legacy_task_grant_rejected");
  const owners = runtimeFileOwners(fileOwners);
  if (dispatchContext.fileOwnersDigest !== owners.digest || dispatchContext.ownerGeneration !== owners.version) throw new TypeError("stale_file_owners");
  const taskTools = immutableStrings(dispatchContext.tools, "task tools");
  const write = immutableStrings(scope.write, "scope write").map((value) => normalizeScope(value, { allowControlPlane: false }));
  const deny = immutableStrings(scope.deny, "scope deny").map((value) => normalizeScope(value));
  const tools = immutableStrings(scope.tools, "scope tools");
  if (write.length === 0 && tools.some((tool) => ["legion_write_file", "legion_edit_file"].includes(tool))) {
    throw new TypeError("empty_owner_scope_cannot_grant_write_tool");
  }
  const taskChecks = runtimeChecks(dispatchContext.checks);
  const checks = runtimeChecks(scope.checks);
  if (checks.some((check) => !taskChecks.some((approved) => digestValue(check) === digestValue(approved)))) {
    throw new TypeError("outside_check_grant");
  }
  const effectScopes=(values=[])=>Object.freeze(immutableStrings(values,"generatedEffects").map(value=>{if(!value.endsWith("/"))throw new TypeError("exact_generated_directory_required");return normalizeProjectReadResource(value.slice(0,-1))+"/";}));
  const taskEffects=effectScopes(dispatchContext.generatedEffects),effects=effectScopes(scope.generatedEffects);
  if(effects.some(effect=>!taskEffects.includes(effect)))throw new TypeError("outside_generated_effect_grant");
  const ownedFiles = owners.owners.filter(item => item.roleId === boundary.roleId).map(item => item.resource.toLowerCase());
  if (tools.some(tool => ["legion_write_file", "legion_edit_file", "legion_request_shell"].includes(tool)) &&
      digestValue([...write].map(value => value.toLowerCase()).sort()) !== digestValue([...ownedFiles].sort())) {
    throw new TypeError("complete_role_owner_scope_required");
  }
  for (const requested of write) {
    if (requested.endsWith("/")) throw new TypeError("directory_not_exact_owner_scope");
    if (!ownedFiles.includes(requested.toLowerCase())) throw new TypeError("file_owner_mismatch");
    if (!boundary.writeScope.some((allowed) => scopeContains(allowed, requested))) {
      throw new TypeError("outside_role_scope");
    }
    if ([...boundary.denyScope, ...deny].some((blocked) => scopeContains(blocked, requested))) {
      throw new TypeError("explicit_deny");
    }
  }
  for (const tool of tools) {
    if (!boundary.tools.includes(tool) || !taskTools.includes(tool)) {
      throw new TypeError("outside_tool_grant");
    }
    if (tool === "legion_write_file" || tool === "legion_edit_file") {
      if (!boundary.capabilities.includes("write_file")) throw new TypeError("missing_capability");
    } else if (["legion_list_files", "legion_read_file"].includes(tool)) {
      if (!boundary.readScope.includes(".") || !boundary.capabilities.includes("read_project")) {
        throw new TypeError("missing_project_read_grant");
      }
    } else if (Object.hasOwn(controlledCapabilities, tool)) {
      if (!boundary.capabilities.includes(controlledCapabilities[tool])) throw new TypeError("missing_capability");
      if (tool === "legion_run_check" && checks.length === 0) throw new TypeError("missing_check_grant");
    } else throw new TypeError("unsupported_tool");
  }
  const grant = { roleId: boundary.roleId, taskId: dispatchContext.taskId,
    organizationVersion: dispatchContext.organizationVersion, fileOwnersDigest: owners.digest, ownerGeneration: owners.version, fileOwners: owners, taskTools,
    write: Object.freeze(write), deny: Object.freeze(deny), tools };
  if (dispatchContext.checks !== undefined || scope.checks !== undefined) { grant.taskChecks = taskChecks; grant.checks = checks; }
  if(dispatchContext.generatedEffects!==undefined || scope.generatedEffects!==undefined){grant.taskGeneratedEffects=taskEffects;grant.generatedEffects=effects;}
  if(dispatchContext.generationDigest!==undefined)grant.generationDigest=dispatchContext.generationDigest;
  return Object.freeze(grant);
}

class RuntimeAuthority {
  #sessions = new Map();
  #boundaries = new Map();
  #tasks = new Map();
  #version;
  #fileOwners;
  #ownersRevoked = false;
  #permits = new Map();
  #receipts = new Map();
  #instances = new Map();
  #sessionInstances = new Map();

  constructor({ sessions = [], boundaries = [], organizationVersion, fileOwners }) {
    this.#fileOwners = runtimeFileOwners(fileOwners);
    this.#version = modelString(organizationVersion, "organizationVersion");
    assertDistinctRoleWriteScopes(boundaries);
    for (const session of sessions) {
      if (!(session instanceof AgentSession) || this.#sessions.has(session.sessionId)) {
        throw new TypeError("invalid_or_duplicate_session");
      }
      this.#sessions.set(session.sessionId, session);
      this.#tasks.set(session.taskId, "active");
    }
    for (const boundary of boundaries) {
      if (!(boundary instanceof RoleBoundary) || this.#boundaries.has(boundary.roleId)) {
        throw new TypeError("invalid_or_duplicate_boundary");
      }
      this.#boundaries.set(boundary.roleId, boundary);
    }
  }

  #fileOwnersBinding() { return { fileOwnersDigest: this.#fileOwners.digest, ownerGeneration: this.#fileOwners.version }; }
  invalidateOwnership(reason) { modelString(reason, "ownership reason"); this.#ownersRevoked = true; this.updateVersion(this.#version); }
  ownerBinding(proposal) {
    if (this.#ownersRevoked) throw new TypeError("file_ownership_revoked");
    assertRuntimeOwner(this.#fileOwners, this.#fileOwnersBinding(), proposal.resource, proposal.session.roleId);
    return Object.freeze({ ...this.#fileOwnersBinding(), projectId: this.#fileOwners.projectId, roleId: proposal.session.roleId, resource: proposal.resource });
  }
  assertFileOwners(current) {
    if (runtimeFileOwners(current).digest !== this.#fileOwners.digest) { this.updateVersion(this.#version); throw new TypeError("stale_file_owners"); }
  }

  snapshot() {
    return Object.freeze({ sessions: Object.freeze([...this.#sessions.values()]),
      boundaries: Object.freeze([...this.#boundaries.values()]), organizationVersion: this.#version,
      fileOwners: this.#fileOwners, taskStatuses: Object.freeze([...this.#tasks].map(([taskId, status]) => Object.freeze({ taskId, status }))) });
  }

  trustedSession(sessionId) { return this.#sessions.get(sessionId); }
  boundary(roleId) { return this.#boundaries.get(roleId); }
  taskStatus(taskId) { return this.#tasks.get(taskId); }

  #invalidate(predicate) {
    for (const [permit, binding] of this.#permits) {
      if (predicate(binding)) this.#permits.delete(permit);
    }
    for (const [receipt, binding] of this.#receipts) {
      if (predicate(binding)) this.#receipts.delete(receipt);
    }
  }

  updateVersion(version) {
    this.#version = modelString(version, "organizationVersion");
    this.#invalidate(() => true);
    for (const instance of this.#instances.values()) instance.status = "cancelled";
  }

  updateBoundary(boundary) {
    if (!(boundary instanceof RoleBoundary)) throw new TypeError("invalid_boundary");
    assertDistinctRoleWriteScopes([...this.#boundaries.values()].filter((entry) => entry.roleId !== boundary.roleId)
      .concat(boundary));
    this.#boundaries.set(boundary.roleId, boundary);
    this.#invalidate((binding) => binding.session.roleId === boundary.roleId);
    for (const instance of this.#instances.values()) {
      if (instance.session.roleId === boundary.roleId) instance.status = "cancelled";
    }
  }

  setTaskStatus(taskId, status) {
    modelString(taskId, "taskId");
    if (!["active", "completed", "cancelled"].includes(status)) throw new TypeError("invalid_task_status");
    this.#tasks.set(taskId, status);
    this.#invalidate((binding) => binding.session.taskId === taskId);
    for (const instance of this.#instances.values()) {
      if (instance.session.taskId === taskId) instance.status = "cancelled";
    }
  }

  registerInstance({ instanceId, session, dispatchContext, scope }) {
    if (this.#ownersRevoked) throw new TypeError("file_ownership_revoked");
    modelString(instanceId, "instanceId");
    if (!(session instanceof AgentSession)) throw new TypeError("invalid_session");
    if (this.#instances.has(instanceId) || this.#sessionInstances.has(session.sessionId)) {
      throw new TypeError("duplicate_instance_or_session");
    }
    if (this.#sessions.has(session.sessionId) && this.#sessions.get(session.sessionId) !== session) {
      throw new TypeError("invalid_identity");
    }
    if (session.roleId !== dispatchContext.roleId || session.taskId !== dispatchContext.taskId ||
        session.organizationVersion !== dispatchContext.organizationVersion ||
        session.organizationVersion !== this.#version) throw new TypeError("dispatch_identity_mismatch");
    const grant = validateInstanceGrant(this.#boundaries.get(session.roleId), dispatchContext, scope, this.#fileOwners);
    if (this.#tasks.has(session.taskId) && this.#tasks.get(session.taskId) !== "active") {
      throw new TypeError("task_inactive");
    }
    this.#sessions.set(session.sessionId, session);
    this.#tasks.set(session.taskId, "active");
    this.#instances.set(instanceId, { session, grant, grantDigest: digestValue(grant), status: "ready", runId: "" });
    this.#sessionInstances.set(session.sessionId, instanceId);
    return this.instanceSnapshot(instanceId);
  }

  instanceSnapshot(instanceId) {
    const instance = this.#instances.get(instanceId);
    if (instance === undefined) throw new TypeError("unknown_instance");
    return Object.freeze({ instanceId, session: instance.session, grant: instance.grant,
      grantDigest: instance.grantDigest, status: instance.status, runId: instance.runId });
  }

  beginRun(instanceId, runId) {
    modelString(runId, "runId");
    const instance = this.#instances.get(instanceId);
    if (instance === undefined || instance.status !== "ready") throw new TypeError("instance_not_ready");
    if (this.#tasks.get(instance.session.taskId) !== "active" ||
        instance.session.organizationVersion !== this.#version) throw new TypeError("stale_instance");
    if (instance.grant.write.length !== 0 && [...this.#instances.values()].some(other =>
      other !== instance && other.status === "running" && other.session.roleId === instance.session.roleId && other.grant.write.length !== 0)) {
      throw new TypeError("role_write_run_already_active");
    }
    instance.status = "running";
    instance.runId = runId;
    return this.instanceSnapshot(instanceId);
  }

  finishRun(instanceId, status) {
    if (!["completed", "cancelled", "failed", "closed"].includes(status)) throw new TypeError("invalid_instance_status");
    const instance = this.#instances.get(instanceId);
    if (instance === undefined) throw new TypeError("unknown_instance");
    instance.status = status;
    this.#invalidate((binding) => binding.session === instance.session);
    return this.instanceSnapshot(instanceId);
  }

  revokeInstance(instanceId) { return this.finishRun(instanceId, "cancelled"); }

  updateTaskGrant(dispatchContext) {
    modelString(dispatchContext.taskId, "taskId");
    if (Object.hasOwn(dispatchContext, "writeSet")) throw new TypeError("legacy_task_grant_rejected");
    if (dispatchContext.fileOwnersDigest !== this.#fileOwners.digest || dispatchContext.ownerGeneration !== this.#fileOwners.version) throw new TypeError("stale_file_owners");
    immutableStrings(dispatchContext.tools, "tools");
    this.#invalidate((binding) => binding.session.taskId === dispatchContext.taskId);
    for (const instance of this.#instances.values()) {
      if (instance.session.taskId === dispatchContext.taskId) instance.status = "cancelled";
    }
  }

  #validate(proposal, binding, observedAtMs) {
    if (this.#ownersRevoked) throw new TypeError("file_ownership_revoked");
    if (!(proposal instanceof ActionProposal)) throw new TypeError("invalid_proposal");
    const session = proposal.session;
    if (this.#sessions.get(session.sessionId) !== session || binding.session !== session) {
      throw new TypeError("invalid_identity");
    }
    if (this.#tasks.get(session.taskId) !== "active") throw new TypeError("task_inactive");
    if (this.#version !== binding.version || session.organizationVersion !== this.#version) {
      throw new TypeError("version_changed");
    }
    const boundary = this.#boundaries.get(session.roleId);
    if (boundary === undefined || boundary.digest !== binding.boundaryDigest) throw new TypeError("boundary_changed");
    if (proposal.digest !== binding.proposalDigest) throw new TypeError("proposal_changed");
    assertRuntimeOwner(this.#fileOwners, this.#fileOwnersBinding(), proposal.resource, session.roleId);
    normalizeResource(proposal.resource);
    const write = proposal.action === "write_file" && proposal.tool === "legion_write_file";
    const edit = proposal.action === "edit_file" && proposal.tool === "legion_edit_file";
    let shell=false;let grantedTool=proposal.tool;
    if(proposal.tool==="legion_shell_publish") {
      _shellPublicationBinding(binding.publicationReceipt,proposal,observedAtMs);shell=true;grantedTool="legion_request_shell";
    }
    if ((!write && !edit && !shell) || (!shell && proposal.capability !== "write_file")) {
      throw new TypeError("unsupported_action_tool_or_capability");
    }
    if (!boundary.tools.includes(grantedTool) || !boundary.capabilities.includes(proposal.capability)) {
      throw new TypeError("missing_tool_or_capability");
    }
    if (boundary.denyScope.some((blocked) => scopeContains(blocked, proposal.resource))) throw new TypeError("explicit_deny");
    if (!boundary.writeScope.some((allowed) => scopeContains(allowed, proposal.resource))) throw new TypeError("outside_role_scope");
    const instanceId = this.#sessionInstances.get(session.sessionId);
    if (instanceId !== undefined) {
      const instance = this.#instances.get(instanceId);
      if (instance.status !== "running" || proposal.runId !== instance.runId ||
          binding.instanceId !== instanceId || binding.grantDigest !== instance.grantDigest) {
        throw new TypeError("instance_or_run_changed");
      }
      const grant = instance.grant;
      if (grant.deny.some((blocked) => scopeContains(blocked, proposal.resource))) throw new TypeError("instance_deny");
      assertRuntimeOwner(this.#fileOwners, grant, proposal.resource, session.roleId);
      if (!grant.write.some((allowed) => allowed.toLowerCase() === normalizeResource(proposal.resource).toLowerCase())) {
        throw new TypeError("outside_instance_or_task_scope");
      }
      if (!grant.tools.includes(grantedTool) || !grant.taskTools.includes(grantedTool)) throw new TypeError("outside_tool_grant");
    }
    if (requiresApproval(boundary, proposal.action, proposal.resource)) throw new TypeError("approval_required");
  }

  issue(proposal, decision, publicationReceipt, observedAtMs) {
    if (!(proposal instanceof ActionProposal) || !(decision instanceof PolicyDecision) ||
        decision.outcome !== Outcome.ALLOW || decision.proposalDigest !== proposal.digest) {
      throw new TypeError("bound_allow_required");
    }
    const binding = { session: proposal.session, proposalDigest: proposal.digest,
      boundaryDigest: decision.boundaryDigest, version: decision.organizationVersion, instanceId: "", grantDigest: "", publicationReceipt };
    const instanceId = this.#sessionInstances.get(proposal.session.sessionId);
    if (instanceId !== undefined) {
      binding.instanceId = instanceId;
      binding.grantDigest = this.#instances.get(instanceId).grantDigest;
    }
    this.#validate(proposal, binding, observedAtMs);
    const permit = new ExecutionPermit();
    this.#permits.set(permit, Object.freeze(binding));
    return permit;
  }

  consume(proposal, permit, observedAtMs) {
    const binding = this.#permits.get(permit);
    this.#permits.delete(permit);
    if (!(permit instanceof ExecutionPermit) || binding === undefined) throw new TypeError("invalid_or_replayed_permit");
    this.#validate(proposal, binding, observedAtMs);
    if(binding.publicationReceipt!==undefined)_consumeShellPublication(binding.publicationReceipt,proposal,observedAtMs);
    const receipt = Object.freeze({});
    this.#receipts.set(receipt, binding);
    return receipt;
  }

  recheck(proposal, receipt, observedAtMs) {
    const binding = this.#receipts.get(receipt);
    if (binding === undefined) throw new TypeError("invalid_or_revoked_receipt");
    this.#validate(proposal, binding, observedAtMs);
  }

  release(receipt) { this.#receipts.delete(receipt); }
}

/** Internal trusted Runtime wiring. Public Provider factories remain powerless by default. */
export function _createRuntimeAuthority(options) { return new RuntimeAuthority(options); }
export function _isRuntimeAuthority(value) { return value instanceof RuntimeAuthority; }

const publicationReceipts = new WeakMap();
/** Internal trusted producer; not part of package Model/SDK public exports. */
export function _registerShellPublication(value) {
 const receipt=Object.freeze({});publicationReceipts.set(receipt,{...value,used:new Set()});return receipt;
}
export function _shellPublicationBinding(receipt,proposal,observedAtMs) {
  _assertObservedAtMs(observedAtMs);
  const value=publicationReceipts.get(receipt);
  if(value===undefined || value.signal.aborted || Date.parse(value.authorization.expiresAt)<=observedAtMs)throw new TypeError("invalid_or_revoked_shell_publication");
  const candidate=value.result.candidates.find(item=>item.resource===proposal.resource);
  let action="write_file";if(candidate?.action==="delete")action="delete_file";
  if(candidate===undefined || proposal.tool!=="legion_shell_publish" || proposal.capability!=="request_shell" || proposal.action!==action || proposal.session.roleId!==value.authorization.roleId || proposal.session.taskId!==value.authorization.taskId || proposal.session.sessionId!==value.authorization.sessionId || proposal.session.organizationVersion!==value.authorization.organizationVersion || proposal.runId!==value.authorization.runId || !value.authorization.fileOwners.owners.some(item=>item.resource.toLowerCase()===proposal.resource.toLowerCase() && item.roleId===proposal.session.roleId) || digestValue(proposal.expectedBaseline)!==candidate.baseline.digest)throw new TypeError("shell_publication_binding_mismatch");
  if(action==="write_file" && (proposal.executable!==candidate.executable || candidate.sha256!==proposal.contentDigest || proposal.contentByteLength!==candidate.byteLength || (proposal.contentBase64!==undefined)!==(candidate.encoding==="base64")))throw new TypeError("shell_candidate_content_mismatch");
  return Object.freeze({authorization:value.authorization,candidate});
}
export function _consumeShellPublication(receipt,proposal,observedAtMs) {
  const binding=_shellPublicationBinding(receipt,proposal,observedAtMs);const value=publicationReceipts.get(receipt);
  if(value.used.has(proposal.resource))throw new TypeError("shell_candidate_replayed");value.used.add(proposal.resource);return binding;
}

/** Deterministic validation of an explicitly supplied trusted operational time fact. */
export function _assertObservedAtMs(value) {
 if(!Number.isSafeInteger(value) || value<0)throw new TypeError("valid_observed_time_fact_required");
 return value;
}
