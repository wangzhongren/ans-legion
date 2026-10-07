/** Pure confirmation values and opaque authority state. No infrastructure or callbacks. */
import { AgentSession, RoleBoundary, ActionProposal, modelRecord, modelString, immutableStrings,
  normalizeResource, digestValue, _createRuntimeAuthority } from "./core.mjs";
import { AgentScope, TaskDispatchContext } from "./agent.mjs";

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
    modelRecord(file, "context file", ["resource", "byteLength", "sha256"]);
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
      "organizationVersion", "roleId", "taskId", "writeSet", "tools", "profileVersion", "contextSnapshotDigest"]);
    for (const field of ["confirmationId", "organizationVersion", "roleId", "taskId", "profileVersion"]) {
      this[field] = modelString(options[field], field);
    }
    this.workspaceIdentity = identity(options.workspaceIdentity);
    this.planDigest = sha(options.planDigest, "planDigest");
    this.contextSnapshotDigest = sha(options.contextSnapshotDigest, "contextSnapshotDigest");
    this.writeSet = exactFiles(options.writeSet, "writeSet");
    this.tools = immutableStrings(options.tools, "tools");
    if (this.tools.length !== 1 || this.tools[0] !== "legion_write_file") {
      throw new TypeError("confirmed_execution_write_tool_required");
    }
    Object.freeze(this);
  }
  get digest() {
    return digestValue({ ...this, workspaceIdentity: identityDigest(this.workspaceIdentity),
      writeSet: resourceKeys(this.writeSet), tools: [...this.tools].sort() });
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
  modelRecord(options, "workbench authority", ["workspaceIdentity", "organizationVersion", "profileVersion", "boundaries"]);
  const workspaceIdentity = identity(options.workspaceIdentity);
  const organizationVersion = modelString(options.organizationVersion, "organizationVersion");
  const profileVersion = modelString(options.profileVersion, "profileVersion");
  if (!Array.isArray(options.boundaries) || options.boundaries.some((boundary) => !(boundary instanceof RoleBoundary))) {
    throw new TypeError("typed_boundaries_required");
  }
  const inner = _createRuntimeAuthority({ boundaries: [...options.boundaries], organizationVersion });
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
    return sessions.get(proposal.session);
  }
  function snapshot(instanceId) {
    valid();
    const binding = instances.get(instanceId);
    if (binding === undefined) throw new TypeError("unknown_instance");
    return Object.freeze({ ...inner.instanceSnapshot(instanceId), workbenchGrant: binding.grant });
  }
  const controller = Object.freeze({
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
          !sameFiles(dispatchContext.writeSet, grant.writeSet) ||
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
    revoke(reason) { modelString(reason, "revocation reason"); invalidate(); }
  });
  const mutationAuthority = Object.freeze({
    consume(proposal, permit) {
      valid();
      const receipt = inner.consume(proposal, permit);
      const binding = registered(proposal);
      const grant = binding.grant;
      receipts.set(receipt, new MutationVerification({ workspaceIdentity, organizationVersion, profileVersion,
        planDigest: grant.planDigest, contextSnapshotDigest: grant.contextSnapshotDigest, contextFiles: binding.context.files }));
      return receipt;
    },
    recheck(proposal, receipt) {
      registered(proposal);
      const verification = receipts.get(receipt);
      if (verification === undefined) throw new TypeError("invalid_or_revoked_receipt");
      inner.recheck(proposal, receipt);
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
