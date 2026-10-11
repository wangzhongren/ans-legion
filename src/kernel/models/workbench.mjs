/** Pure confirmation values and opaque authority state. No infrastructure or callbacks. */
import { AgentSession, RoleBoundary, ActionProposal, modelRecord, modelString, immutableStrings,
  normalizeResource, normalizeProjectReadResource, digestValue, _createRuntimeAuthority, _shellPublicationBinding, PolicyDecision, Outcome } from "./core.mjs";
import { shellArtifacts } from "./shell.mjs";
import { checkSpecs } from "./check.mjs";
import { AgentScope, TaskDispatchContext, AgentTools } from "./agent.mjs";

const reads = new WeakMap();
const mutationBrands = new WeakSet();
const failures = Object.freeze(["root_identity_changed", "context_changed", "verification_unavailable"]);

function sha(value, name) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new TypeError(name + " must be SHA256");
  return value;
}

function identity(value) {
  modelRecord(value, "workspaceIdentity", ["canonicalPath", "deviceId", "fileId"]);
  const canonicalPath = modelString(value.canonicalPath, "canonicalPath").replaceAll("\\", "/");
  if (!canonicalPath.startsWith("/") && !/^[A-Za-z]:\//.test(canonicalPath)) {
    throw new TypeError("absolute_workspace_identity_required");
  }
  if (canonicalPath.split("/").some((part) => part === "." || part === "..") || canonicalPath.includes("\0")) {
    throw new TypeError("invalid_workspace_identity");
  }
  for (const field of ["deviceId", "fileId"]) {
    if (typeof value[field] !== "string" || !/^(0|[1-9][0-9]*)$/.test(value[field])) {
      throw new TypeError("invalid_workspace_file_identity");
    }
  }
  if (value.fileId === "0") throw new TypeError("unavailable_workspace_file_identity");
  return Object.freeze({ canonicalPath, deviceId: value.deviceId, fileId: value.fileId });
}

function identityDigest(value) {
  const normalized = identity(value);
  return digestValue({ ...normalized, canonicalPath: normalized.canonicalPath.toLowerCase() });
}

export class FileOwnershipError extends Error {
  constructor(reason, resource = "", ownerRoleId = "") {
    super(reason);
    this.name = "FileOwnershipError";
    this.reason = reason;
    this.resource = resource;
    this.ownerRoleId = ownerRoleId;
  }
}

function ownerEntry(value, name) {
  modelRecord(value, name, ["resource", "roleId"]);
  const resource = normalizeProjectReadResource(value.resource);
  if (resource.endsWith("/")) throw new TypeError("directory_owner_not_allowed");
  return Object.freeze({ resource, roleId: modelString(value.roleId, "roleId") });
}

/** Versioned per-project exact-file ownership; no filesystem access or global state. */
export class ProjectFileOwners {
  constructor(options) {
    modelRecord(options, "ProjectFileOwners", ["projectId", "version", "owners"]);
    this.projectId = modelString(options.projectId, "projectId");
    this.version = modelString(options.version, "version");
    if (!Array.isArray(options.owners)) throw new TypeError("owners_must_be_array");
    const seen = new Set();
    this.owners = Object.freeze(options.owners.map((item) => {
      const entry = ownerEntry(item, "file owner");
      const key = entry.resource.toLowerCase();
      if (seen.has(key)) throw new TypeError("duplicate_owner_alias");
      seen.add(key);
      return entry;
    }).sort((a, b) => a.resource.toLowerCase().localeCompare(b.resource.toLowerCase())));
    Object.freeze(this);
  }
  ownerOf(resource) {
    const key = normalizeProjectReadResource(resource).toLowerCase();
    return this.owners.find((item) => item.resource.toLowerCase() === key)?.roleId ?? "";
  }
  get digest() {
    return digestValue({ projectId: this.projectId, version: this.version,
      owners: this.owners.map((item) => ({ resource: item.resource.toLowerCase(), roleId: item.roleId })) });
  }
}

export class FileOwnershipTransfer {
  constructor(options) {
    modelRecord(options, "FileOwnershipTransfer", ["resource", "fromRoleId", "toRoleId"]);
    this.resource = normalizeProjectReadResource(options.resource);
    if (this.resource.endsWith("/")) throw new TypeError("directory_transfer_not_allowed");
    this.fromRoleId = modelString(options.fromRoleId, "fromRoleId");
    this.toRoleId = modelString(options.toRoleId, "toRoleId");
    if (this.fromRoleId === this.toRoleId) throw new TypeError("transfer_roles_must_differ");
    Object.freeze(this);
  }
}

/** Customer-visible claims and transfers bind a single atomic ownership transition. */
export class FileOwnershipPlan {
  constructor(options) {
    modelRecord(options, "FileOwnershipPlan", ["projectId", "baseVersion", "baseDigest", "nextVersion",
      "claims", "transfers"]);
    this.projectId = modelString(options.projectId, "projectId");
    this.baseVersion = modelString(options.baseVersion, "baseVersion");
    this.baseDigest = sha(options.baseDigest, "baseDigest");
    this.nextVersion = modelString(options.nextVersion, "nextVersion");
    if (this.nextVersion === this.baseVersion) throw new TypeError("ownership_version_must_advance");
    if (!Array.isArray(options.claims) || !Array.isArray(options.transfers ?? [])) {
      throw new TypeError("ownership_collections_required");
    }
    const claims = new Map();
    for (const item of options.claims) {
      const entry = ownerEntry(item, "file claim");
      const key = entry.resource.toLowerCase();
      const prior = claims.get(key);
      if (prior !== undefined && prior.roleId !== entry.roleId) {
        throw new FileOwnershipError("cross_role_claim", entry.resource, prior.roleId);
      }
      if (prior === undefined) claims.set(key, entry);
    }
    this.claims = Object.freeze([...claims.values()].sort((a, b) =>
      a.resource.toLowerCase().localeCompare(b.resource.toLowerCase())));
    const transfers = new Map();
    for (const item of options.transfers ?? []) {
      const transfer = item instanceof FileOwnershipTransfer ? item : new FileOwnershipTransfer(item);
      const key = transfer.resource.toLowerCase();
      if (transfers.has(key)) throw new TypeError("duplicate_transfer_alias");
      transfers.set(key, transfer);
    }
    this.transfers = Object.freeze([...transfers.values()].sort((a, b) =>
      a.resource.toLowerCase().localeCompare(b.resource.toLowerCase())));
    Object.freeze(this);
  }
  get digest() {
    return digestValue({ projectId: this.projectId, baseVersion: this.baseVersion,
      baseDigest: this.baseDigest, nextVersion: this.nextVersion,
      claims: this.claims.map((item) => ({ resource: item.resource.toLowerCase(), roleId: item.roleId })),
      transfers: this.transfers.map((item) => ({ resource: item.resource.toLowerCase(),
        fromRoleId: item.fromRoleId, toRoleId: item.toRoleId })) });
  }
}

export function applyFileOwnershipPlan(current, plan) {
  if (!(current instanceof ProjectFileOwners) || !(plan instanceof FileOwnershipPlan)) {
    throw new TypeError("typed_file_ownership_required");
  }
  if (current.projectId !== plan.projectId || current.version !== plan.baseVersion ||
      current.digest !== plan.baseDigest) throw new FileOwnershipError("stale_file_owners");
  const owners = new Map(current.owners.map((item) => [item.resource.toLowerCase(), item]));
  const claims = new Map(plan.claims.map((item) => [item.resource.toLowerCase(), item]));
  const transfers = new Map(plan.transfers.map((item) => [item.resource.toLowerCase(), item]));
  for (const transfer of plan.transfers) {
    const key = transfer.resource.toLowerCase();
    const prior = owners.get(key);
    if (prior === undefined) throw new FileOwnershipError("transfer_without_owner", transfer.resource);
    if (prior.roleId !== transfer.fromRoleId) {
      throw new FileOwnershipError("transfer_from_mismatch", transfer.resource, prior.roleId);
    }
    if (claims.get(key)?.roleId !== transfer.toRoleId) {
      throw new FileOwnershipError("transfer_without_claim", transfer.resource, prior.roleId);
    }
  }
  for (const claim of plan.claims) {
    const key = claim.resource.toLowerCase();
    const prior = owners.get(key);
    const transfer = transfers.get(key);
    if (prior !== undefined && prior.roleId !== claim.roleId && transfer === undefined) {
      throw new FileOwnershipError("file_owned_by_other_role", claim.resource, prior.roleId);
    }
    if ((prior === undefined || prior.roleId === claim.roleId) && transfer !== undefined) {
      throw new FileOwnershipError("unnecessary_transfer", claim.resource, prior?.roleId ?? "");
    }
    owners.set(key, Object.freeze({ resource: claim.resource, roleId: claim.roleId }));
  }
  return new ProjectFileOwners({ projectId: current.projectId, version: plan.nextVersion,
    owners: [...owners.values()] });
}

export function assertFileOwner(snapshot, { projectId, version, resource, roleId }) {
  if (!(snapshot instanceof ProjectFileOwners)) throw new TypeError("typed_file_owners_required");
  if (snapshot.projectId !== projectId || snapshot.version !== version) {
    throw new FileOwnershipError("stale_file_owners", resource);
  }
  const ownerRoleId = snapshot.ownerOf(resource);
  if (ownerRoleId === "") throw new FileOwnershipError("unowned_file", resource);
  if (ownerRoleId !== roleId) throw new FileOwnershipError("file_owned_by_other_role", resource, ownerRoleId);
  return true;
}

function exactFiles(value, name, maximum = Infinity) {
  // Unlike legacy collections, aliases and repeated entries must not consume a hidden budget.
  if (!Array.isArray(value)) throw new TypeError(name + " must be an array");
  const result = [];
  const keys = new Set();
  for (const item of value) {
    const resource = normalizeResource(item);
    const key = resource.toLowerCase();
    if (keys.has(key)) throw new TypeError("duplicate_resource_alias");
    keys.add(key);
    result.push(resource);
  }
  if (result.length > maximum) throw new TypeError("context_file_budget");
  return Object.freeze(result);
}

function resourceKeys(files) { return files.map((resource) => resource.toLowerCase()).sort(); }
function sameFiles(first, second) { return digestValue(resourceKeys(first)) === digestValue(resourceKeys(second)); }

function contextFiles(value) {
  if (!Array.isArray(value) || value.length > 16) throw new TypeError("context_file_budget");
  let total = 0;
  const result = [];
  for (const file of value) {
    modelRecord(file, "context file", ["resource", "byteLength", "sha256", "state"]);
    if(file.state==="absent") {
      if(file.sha256!==null || file.byteLength!==0)throw new TypeError("absent_context_has_content");
      const resource=normalizeProjectReadResource(file.resource);result.push(Object.freeze({resource,state:"absent",sha256:null,byteLength:0}));continue;
    }
    if(file.state!==undefined && file.state!=="present")throw new TypeError("invalid_context_baseline_state");
    const resource = normalizeResource(file.resource);
    if (!Number.isSafeInteger(file.byteLength) || file.byteLength < 0 || file.byteLength > 262144) {
      throw new TypeError("context_byte_budget");
    }
    total += file.byteLength;
    if (total > 2097152) throw new TypeError("context_total_budget");
    result.push(Object.freeze({ resource, byteLength: file.byteLength, sha256: sha(file.sha256, "sha256") }));
  }
  exactFiles(result.map((file) => file.resource), "context files", 16);
  result.sort((a, b) => {
    const first = a.resource.toLowerCase(); const second = b.resource.toLowerCase();
    if (first < second) return -1;
    if (first > second) return 1;
    return 0;
  });
  return Object.freeze(result);
}

export class ContextReadConfirmation {
  constructor(options) {
    modelRecord(options, "ContextReadConfirmation", ["confirmationId", "workspaceIdentity",
      "organizationVersion", "profileVersion", "contextReadSet"]);
    for (const field of ["confirmationId", "organizationVersion", "profileVersion"]) {
      this[field] = modelString(options[field], field);
    }
    this.workspaceIdentity = identity(options.workspaceIdentity);
    this.contextReadSet = exactFiles(options.contextReadSet, "contextReadSet", 16);
    Object.freeze(this);
  }
  get digest() {
    return digestValue({ confirmationId: this.confirmationId, workspace: identityDigest(this.workspaceIdentity),
      organizationVersion: this.organizationVersion, profileVersion: this.profileVersion,
      contextReadSet: resourceKeys(this.contextReadSet) });
  }
  static assertForRead(readAuthorization, options) {
    modelRecord(options, "read binding", ["workspaceIdentity", "organizationVersion", "profileVersion", "resources"]);
    const entry = reads.get(readAuthorization);
    if (entry === undefined || entry.state.invalid) throw new TypeError("invalid_read_authorization");
    const confirmation = entry.confirmation;
    if (identityDigest(options.workspaceIdentity) !== identityDigest(confirmation.workspaceIdentity) ||
        options.organizationVersion !== confirmation.organizationVersion ||
        options.profileVersion !== confirmation.profileVersion) throw new TypeError("read_binding_changed");
    const resources = exactFiles(options.resources, "resources", 16);
    if (resources.some((resource) => !confirmation.contextReadSet.some((allowed) =>
      allowed.toLowerCase() === resource.toLowerCase()))) throw new TypeError("outside_context_read_set");
    return Object.freeze({ workspaceIdentity: confirmation.workspaceIdentity,
      organizationVersion: confirmation.organizationVersion, profileVersion: confirmation.profileVersion,
      confirmationDigest: confirmation.digest, resources });
  }
}

export class ContextSnapshot {
  constructor(options) {
    modelRecord(options, "ContextSnapshot", ["confirmationDigest", "workspaceIdentity", "organizationVersion",
      "profileVersion", "files"]);
    this.confirmationDigest = sha(options.confirmationDigest, "confirmationDigest");
    this.workspaceIdentity = identity(options.workspaceIdentity);
    this.organizationVersion = modelString(options.organizationVersion, "organizationVersion");
    this.profileVersion = modelString(options.profileVersion, "profileVersion");
    this.files = contextFiles(options.files);
    Object.freeze(this);
  }
  get digest() {
    return digestValue({ confirmationDigest: this.confirmationDigest, workspace: identityDigest(this.workspaceIdentity),
      organizationVersion: this.organizationVersion, profileVersion: this.profileVersion,
      files: this.files.map((file) => ({ ...file, resource: file.resource.toLowerCase() })) });
  }
}

export class ConfirmedTaskGrant {
  constructor(options) {
    modelRecord(options, "ConfirmedTaskGrant", ["confirmationId", "workspaceIdentity", "planDigest",
      "organizationVersion", "roleId", "taskId", "ownerGeneration", "tools", "profileVersion", "contextSnapshotDigest",
      "fileOwnersDigest", "checks", "generatedEffects", "generationDigest", "artifactScopes"]);
    for (const field of ["confirmationId", "organizationVersion", "roleId", "taskId", "profileVersion"]) {
      this[field] = modelString(options[field], field);
    }
    this.workspaceIdentity = identity(options.workspaceIdentity);
    this.planDigest = sha(options.planDigest, "planDigest");
    this.contextSnapshotDigest = sha(options.contextSnapshotDigest, "contextSnapshotDigest");
    this.fileOwnersDigest = sha(options.fileOwnersDigest, "fileOwnersDigest");
    this.ownerGeneration = modelString(options.ownerGeneration, "ownerGeneration");
    this.generatedEffects=Object.freeze((options.generatedEffects ?? []).map(value=>{if(typeof value!=="string" || !value.endsWith("/"))throw new TypeError("exact_generated_directory_required");return normalizeProjectReadResource(value.slice(0,-1))+"/";}));
    this.artifactScopes=shellArtifacts(options.artifactScopes);
    if(this.generatedEffects.some(scope=>!this.artifactScopes.some(item=>item.scope===scope)))throw new TypeError("generated_effect_not_approved_artifact");
    if(options.generationDigest!==undefined)this.generationDigest=sha(options.generationDigest,"generationDigest");
    this.tools = immutableStrings(options.tools, "tools");
    if (options.checks !== undefined) this.checks = checkSpecs(options.checks);
    const readTools = ["legion_list_files", "legion_read_file"];
    const readCount = readTools.filter((tool) => this.tools.includes(tool)).length;
    const hasSourceTools=this.tools.some(tool=>["legion_write_file","legion_edit_file"].includes(tool));
    const hasWrite=hasSourceTools || this.tools.includes("legion_request_shell");
    if ((readCount !== 0 && readCount !== 2) || this.tools.some((tool) => !AgentTools.includes(tool))) {
      throw new TypeError("confirmed_execution_write_tool_required");
    }
    if (this.tools.includes("legion_run_check") && (this.checks === undefined || this.checks.length === 0)) {
      throw new TypeError("confirmed_checks_required");
    }
    Object.freeze(this);
  }
  get digest() {
    return digestValue({ ...this, workspaceIdentity: identityDigest(this.workspaceIdentity),
      tools: [...this.tools].sort() });
  }
}

export class MutationVerification {
  constructor(options) {
    modelRecord(options, "MutationVerification", ["workspaceIdentity", "organizationVersion", "profileVersion",
      "planDigest", "contextSnapshotDigest", "contextFiles"]);
    this.workspaceIdentity = identity(options.workspaceIdentity);
    this.organizationVersion = modelString(options.organizationVersion, "organizationVersion");
    this.profileVersion = modelString(options.profileVersion, "profileVersion");
    this.planDigest = sha(options.planDigest, "planDigest");
    this.contextSnapshotDigest = sha(options.contextSnapshotDigest, "contextSnapshotDigest");
    this.contextFiles = contextFiles(options.contextFiles);
    Object.freeze(this);
  }
}

export function isWorkbenchMutationAuthority(value) { return mutationBrands.has(value); }

/** Trusted host calls controller; only the lower branded capability reaches Mutation/Storage. */
export function createWorkbenchAuthority(options) {
  modelRecord(options, "workbench authority", ["workspaceIdentity", "organizationVersion", "profileVersion",
    "boundaries", "fileOwners"]);
  const workspaceIdentity = identity(options.workspaceIdentity);
  const organizationVersion = modelString(options.organizationVersion, "organizationVersion");
  const profileVersion = modelString(options.profileVersion, "profileVersion");
  if (!Array.isArray(options.boundaries) || options.boundaries.some((boundary) => !(boundary instanceof RoleBoundary))) {
    throw new TypeError("typed_boundaries_required");
  }
  const fileOwners = options.fileOwners;
  if (!(fileOwners instanceof ProjectFileOwners)) {
    throw new TypeError("typed_file_owners_required");
  }
  const inner = _createRuntimeAuthority({ boundaries: [...options.boundaries], organizationVersion, fileOwners });
  const state = { invalid: false };
  const readHandles = new Set();
  const usedConfirmationIds = new Set();
  const snapshots = new Map();
  const approvals = new Map();
  const instances = new Map();
  const sessions = new Map();
  const receipts = new Map();
  function valid() { if (state.invalid) throw new TypeError("workbench_authority_revoked"); }
  function matches(value) {
    if (identityDigest(value.workspaceIdentity) !== identityDigest(workspaceIdentity) ||
        value.organizationVersion !== organizationVersion || value.profileVersion !== profileVersion) {
      throw new TypeError("workbench_binding_mismatch");
    }
  }
  function once(id) {
    if (usedConfirmationIds.has(id)) throw new TypeError("confirmation_replayed");
    usedConfirmationIds.add(id);
  }
  function invalidate() {
    if (state.invalid) return;
    state.invalid = true;
    inner.updateVersion(organizationVersion);
    for (const handle of readHandles) reads.delete(handle);
    readHandles.clear(); snapshots.clear(); approvals.clear(); receipts.clear();
  }
  function registered(proposal) {
    valid();
    if (!(proposal instanceof ActionProposal) || !sessions.has(proposal.session)) {
      throw new TypeError("confirmed_session_required");
    }
    if (fileOwners !== undefined) assertFileOwner(fileOwners, { projectId: fileOwners.projectId,
      version: fileOwners.version, resource: proposal.resource, roleId: proposal.session.roleId });
    return sessions.get(proposal.session);
  }
  function snapshot(instanceId) {
    valid();
    const binding = instances.get(instanceId);
    if (binding === undefined) throw new TypeError("unknown_instance");
    return Object.freeze({ ...inner.instanceSnapshot(instanceId), workbenchGrant: binding.grant });
  }
  const controller = Object.freeze({
    assertFileOwners(current) {
      valid();
      if (!(current instanceof ProjectFileOwners)) throw new TypeError("typed_file_owners_required");
      if (fileOwners === undefined || current.digest !== fileOwners.digest) {
        invalidate();
        throw new FileOwnershipError("stale_file_owners");
      }
      return true;
    },
    confirmContextRead(confirmation) {
      valid();
      if (!(confirmation instanceof ContextReadConfirmation)) throw new TypeError("typed_read_confirmation_required");
      matches(confirmation); once(confirmation.confirmationId);
      const handle = Object.freeze({});
      reads.set(handle, { state, confirmation }); readHandles.add(handle);
      return handle;
    },
    checkContextRead(readAuthorization, resource) {
      valid();
      if (!readHandles.has(readAuthorization)) throw new TypeError("foreign_read_authorization");
      return ContextReadConfirmation.assertForRead(readAuthorization, { workspaceIdentity,
        organizationVersion, profileVersion, resources: [resource] });
    },
    bindContextSnapshot(readAuthorization, value) {
      valid();
      if (!(value instanceof ContextSnapshot) || !readHandles.has(readAuthorization)) {
        throw new TypeError("typed_snapshot_and_read_authorization_required");
      }
      const entry = reads.get(readAuthorization);
      matches(value);
      if (value.confirmationDigest !== entry.confirmation.digest ||
          !sameFiles(value.files.map((file) => file.resource), entry.confirmation.contextReadSet)) {
        throw new TypeError("snapshot_confirmation_mismatch");
      }
      if (entry.snapshot !== undefined) throw new TypeError("snapshot_already_bound");
      entry.snapshot = value;
      snapshots.set(value.digest, value);
      return value;
    },
    confirmTask(grant) {
      valid();
      if (!(grant instanceof ConfirmedTaskGrant)) throw new TypeError("typed_task_grant_required");
      matches(grant);
      const context = snapshots.get(grant.contextSnapshotDigest);
      if (context === undefined) throw new TypeError("bound_context_snapshot_required");
      if (inner.boundary(grant.roleId) === undefined) throw new TypeError("unknown_role");
      if (grant.tools.some(tool => ["legion_write_file", "legion_edit_file"].includes(tool)) &&
          !fileOwners.owners.some(item => item.roleId === grant.roleId)) throw new FileOwnershipError("file_owned_by_other_role");
      if (fileOwners !== undefined) {
        if (grant.fileOwnersDigest !== fileOwners.digest || grant.ownerGeneration !== fileOwners.version) throw new FileOwnershipError("stale_file_owners");

      } else if (grant.fileOwnersDigest !== undefined) throw new FileOwnershipError("stale_file_owners");
      once(grant.confirmationId);
      const approval = Object.freeze({});
      approvals.set(approval, { grant, context });
      return approval;
    },
    registerInstance({ taskApproval, instanceId, session, dispatchContext, scope }) {
      valid();
      const binding = approvals.get(taskApproval);
      approvals.delete(taskApproval);
      if (binding === undefined) throw new TypeError("invalid_or_replayed_task_approval");
      const grant = binding.grant;
      if (!(session instanceof AgentSession) || !(dispatchContext instanceof TaskDispatchContext) ||
          !(scope instanceof AgentScope) || session.roleId !== grant.roleId || session.taskId !== grant.taskId ||
          session.organizationVersion !== grant.organizationVersion || dispatchContext.roleId !== grant.roleId ||
          dispatchContext.taskId !== grant.taskId || dispatchContext.organizationVersion !== grant.organizationVersion ||
          dispatchContext.fileOwnersDigest !== grant.fileOwnersDigest || dispatchContext.ownerGeneration !== grant.ownerGeneration ||
          digestValue(dispatchContext.checks ?? []) !== digestValue(grant.checks ?? []) ||
          digestValue(dispatchContext.generatedEffects ?? [])!==digestValue(grant.generatedEffects ?? []) ||
          (scope.generatedEffects ?? []).some(effect=>!(grant.generatedEffects ?? []).includes(effect)) ||
          (scope.checks ?? []).some((spec) => !(grant.checks ?? []).some((approved) => approved.digest === spec.digest)) ||
          digestValue([...dispatchContext.tools].sort()) !== digestValue([...grant.tools].sort())) {
        throw new TypeError("confirmed_task_binding_mismatch");
      }
      inner.registerInstance({ instanceId, session, dispatchContext, scope });
      instances.set(instanceId, binding); sessions.set(session, binding);
      return snapshot(instanceId);
    },
    instanceSnapshot: snapshot,
    beginRun(instanceId, runId) { valid(); inner.beginRun(instanceId, runId); return snapshot(instanceId); },
    finishRun(instanceId, status) { valid(); inner.finishRun(instanceId, status); return snapshot(instanceId); },
    issue(proposal, decision) { registered(proposal); return inner.issue(proposal, decision); },
    issueShellPublication(proposal,publicationReceipt,observedAtMs) {
      const task=registered(proposal);const publication=_shellPublicationBinding(publicationReceipt,proposal,observedAtMs);
      if(publication.authorization.planDigest!==task.grant.planDigest || publication.authorization.contextSnapshotDigest!==task.grant.contextSnapshotDigest || publication.authorization.fileOwnersDigest!==task.grant.fileOwnersDigest || identityDigest(publication.authorization.workspaceIdentity)!==identityDigest(workspaceIdentity))throw new TypeError("shell_publication_context_changed");
      const boundary=inner.boundary(proposal.session.roleId);
      const decision=new PolicyDecision({outcome:Outcome.ALLOW,reason:"host_shell_publication",proposalDigest:proposal.digest,organizationVersion,boundaryDigest:boundary.digest});
      return inner.issue(proposal,decision,publicationReceipt,observedAtMs);
    },
    revoke(reason) { modelString(reason, "revocation reason"); invalidate(); }
  });
  const mutationAuthority = Object.freeze({
    invalidateOwnership(reason) { modelString(reason, "ownership reason"); invalidate(); },
    ownerBinding(proposal) { registered(proposal); return Object.freeze({ ...inner.ownerBinding(proposal), workspaceIdentity }); },
    consume(proposal, permit, observedAtMs) {
      valid();
      const receipt = inner.consume(proposal, permit, observedAtMs);
      const binding = registered(proposal);
      const grant = binding.grant;
      receipts.set(receipt, new MutationVerification({ workspaceIdentity, organizationVersion, profileVersion,
        planDigest: grant.planDigest, contextSnapshotDigest: grant.contextSnapshotDigest, contextFiles: binding.context.files }));
      return receipt;
    },
    recheck(proposal, receipt, observedAtMs) {
      registered(proposal);
      const verification = receipts.get(receipt);
      if (verification === undefined) throw new TypeError("invalid_or_revoked_receipt");
      inner.recheck(proposal, receipt, observedAtMs);
      return verification;
    },
    release(receipt, releaseOptions = {}) {
      modelRecord(releaseOptions, "release options", ["verificationFailure"]);
      if (releaseOptions.verificationFailure !== undefined) {
        if (!failures.includes(releaseOptions.verificationFailure)) throw new TypeError("invalid_verification_failure");
        if (!receipts.has(receipt)) throw new TypeError("foreign_or_revoked_receipt");
        invalidate();
        return;
      }
      receipts.delete(receipt); inner.release(receipt);
    }
  });
  mutationBrands.add(mutationAuthority);
  return Object.freeze({ controller, mutationAuthority });
}
