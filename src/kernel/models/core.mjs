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

function scopeCollection(value, name) {
  return Object.freeze(immutableStrings(value, name).map((scope) => normalizeScope(scope)));
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
  if (boundary.requiredApprovals.includes(action)) return true;
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
      "capability", "session", "runId"]);
    for (const field of ["proposalId", "action", "resource", "tool", "capability"]) {
      this[field] = modelString(options[field], field);
    }
    this.content = modelString(options.content, "content", { empty: true });
    if (!(options.session instanceof AgentSession)) throw new TypeError("session must be AgentSession");
    this.session = options.session;
    this.runId = modelString(options.runId ?? "", "runId", { empty: true });
    Object.freeze(this);
  }

  get contentDigest() { return createHash("sha256").update(this.content, "utf8").digest("hex"); }
  get digest() {
    const session = this.session;
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
      "observedMutation", "auditFailed"]);
    const { success, status, reason, resource = "", proposalDigest = "", observedMutation = false,
      auditFailed = false } = options;
    if (typeof success !== "boolean" || typeof observedMutation !== "boolean" || typeof auditFailed !== "boolean") {
      throw new TypeError("mutation flags must be boolean");
    }
    if (!["written", "denied", "failed", "audit_failed"].includes(status)) throw new TypeError("invalid_status");
    if (success && (status !== "written" || !observedMutation || auditFailed)) {
      throw new TypeError("invalid_success_observation");
    }
    this.success = success;
    this.status = status;
    this.reason = modelString(reason, "reason");
    this.resource = modelString(resource, "resource", { empty: true });
    this.proposalDigest = modelString(proposalDigest, "proposalDigest", { empty: true });
    this.observedMutation = observedMutation;
    this.auditFailed = auditFailed;
    Object.freeze(this);
  }
}

export class Event {
  constructor(options) {
    const fields = ["sequence", "kind", "roleId", "taskId", "organizationVersion", "resource",
      "proposalDigest", "correlationId", "outcome", "reason", "observedMutation", "recordedAt"];
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
    Object.freeze(this);
  }
}

/** Validate the immutable role/task/instance grant intersection, without external effects. */
export function validateInstanceGrant(boundary, dispatchContext, scope) {
  if (!(boundary instanceof RoleBoundary)) throw new TypeError("invalid_boundary");
  if (boundary.roleId !== dispatchContext.roleId) throw new TypeError("dispatch_role_mismatch");
  modelString(dispatchContext.taskId, "taskId");
  modelString(dispatchContext.organizationVersion, "organizationVersion");
  const writeSet = Object.freeze(immutableStrings(dispatchContext.writeSet, "writeSet").map((resource) =>
    normalizeResource(resource)));
  const taskTools = immutableStrings(dispatchContext.tools, "task tools");
  const write = immutableStrings(scope.write, "scope write").map((value) => normalizeScope(value, { allowControlPlane: false }));
  const deny = immutableStrings(scope.deny, "scope deny").map((value) => normalizeScope(value));
  const tools = immutableStrings(scope.tools, "scope tools");
  const taskFiles = writeSet.map((resource) => normalizeResource(resource).toLowerCase());
  for (const requested of write) {
    if (requested.endsWith("/")) throw new TypeError("directory_not_exact_task_scope");
    if (!taskFiles.includes(requested.toLowerCase())) throw new TypeError("outside_task_scope");
    if (!boundary.writeScope.some((allowed) => scopeContains(allowed, requested))) {
      throw new TypeError("outside_role_scope");
    }
    if ([...boundary.denyScope, ...deny].some((blocked) => scopeContains(blocked, requested))) {
      throw new TypeError("explicit_deny");
    }
  }
  for (const tool of tools) {
    if (tool !== "legion_write_file" || !boundary.tools.includes(tool) || !taskTools.includes(tool)) {
      throw new TypeError("outside_tool_grant");
    }
    if (!boundary.capabilities.includes("write_file")) throw new TypeError("missing_capability");
  }
  const grant = { roleId: boundary.roleId, taskId: dispatchContext.taskId,
    organizationVersion: dispatchContext.organizationVersion, writeSet, taskTools,
    write: Object.freeze(write), deny: Object.freeze(deny), tools };
  return Object.freeze(grant);
}

class RuntimeAuthority {
  #sessions = new Map();
  #boundaries = new Map();
  #tasks = new Map();
  #version;
  #permits = new Map();
  #receipts = new Map();
  #instances = new Map();
  #sessionInstances = new Map();

  constructor({ sessions = [], boundaries = [], organizationVersion }) {
    this.#version = modelString(organizationVersion, "organizationVersion");
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

  snapshot() {
    return Object.freeze({ sessions: Object.freeze([...this.#sessions.values()]),
      boundaries: Object.freeze([...this.#boundaries.values()]), organizationVersion: this.#version,
      taskStatuses: Object.freeze([...this.#tasks].map(([taskId, status]) => Object.freeze({ taskId, status }))) });
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
    const grant = validateInstanceGrant(this.#boundaries.get(session.roleId), dispatchContext, scope);
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
    const writeSet = immutableStrings(dispatchContext.writeSet, "writeSet");
    for (const resource of writeSet) normalizeResource(resource);
    immutableStrings(dispatchContext.tools, "tools");
    this.#invalidate((binding) => binding.session.taskId === dispatchContext.taskId);
    for (const instance of this.#instances.values()) {
      if (instance.session.taskId === dispatchContext.taskId) instance.status = "cancelled";
    }
  }

  #validate(proposal, binding) {
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
    normalizeResource(proposal.resource);
    if (proposal.action !== "write_file" || proposal.tool !== "legion_write_file" ||
        proposal.capability !== "write_file") throw new TypeError("unsupported_action_tool_or_capability");
    if (!boundary.tools.includes(proposal.tool) || !boundary.capabilities.includes(proposal.capability)) {
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
      if (!grant.write.some((allowed) => scopeContains(allowed, proposal.resource)) ||
          !grant.writeSet.some((allowed) => allowed.toLowerCase() === normalizeResource(proposal.resource).toLowerCase())) {
        throw new TypeError("outside_instance_or_task_scope");
      }
      if (!grant.tools.includes(proposal.tool) || !grant.taskTools.includes(proposal.tool)) throw new TypeError("outside_tool_grant");
    }
    if (requiresApproval(boundary, proposal.action, proposal.resource)) throw new TypeError("approval_required");
  }

  issue(proposal, decision) {
    if (!(proposal instanceof ActionProposal) || !(decision instanceof PolicyDecision) ||
        decision.outcome !== Outcome.ALLOW || decision.proposalDigest !== proposal.digest) {
      throw new TypeError("bound_allow_required");
    }
    const binding = { session: proposal.session, proposalDigest: proposal.digest,
      boundaryDigest: decision.boundaryDigest, version: decision.organizationVersion, instanceId: "", grantDigest: "" };
    const instanceId = this.#sessionInstances.get(proposal.session.sessionId);
    if (instanceId !== undefined) {
      binding.instanceId = instanceId;
      binding.grantDigest = this.#instances.get(instanceId).grantDigest;
    }
    this.#validate(proposal, binding);
    const permit = new ExecutionPermit();
    this.#permits.set(permit, Object.freeze(binding));
    return permit;
  }

  consume(proposal, permit) {
    const binding = this.#permits.get(permit);
    this.#permits.delete(permit);
    if (!(permit instanceof ExecutionPermit) || binding === undefined) throw new TypeError("invalid_or_replayed_permit");
    this.#validate(proposal, binding);
    const receipt = Object.freeze({});
    this.#receipts.set(receipt, binding);
    return receipt;
  }

  recheck(proposal, receipt) {
    const binding = this.#receipts.get(receipt);
    if (binding === undefined) throw new TypeError("invalid_or_revoked_receipt");
    this.#validate(proposal, binding);
  }

  release(receipt) { this.#receipts.delete(receipt); }
}

/** Internal trusted Runtime wiring. Public Provider factories remain powerless by default. */
export function _createRuntimeAuthority(options) { return new RuntimeAuthority(options); }
export function _isRuntimeAuthority(value) { return value instanceof RuntimeAuthority; }
