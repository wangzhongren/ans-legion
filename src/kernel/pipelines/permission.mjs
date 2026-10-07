/** One cohesive permission/agent Pipeline; all infrastructure is reached through public Services. */
import { createPolicyService } from "../services/public/policy.mjs";
import { createMutationService, MutationError } from "../services/public/mutation.mjs";
import { createProposalService } from "../../adapters/services/public/proposal.mjs";
import { createPiAgentService } from "../../adapters/services/public/pi_agent.mjs";
import { ActionProposal, AgentSession, RoleBoundary, PolicyDecision, MutationResult, Event, Outcome,
  modelRecord, modelString, _createRuntimeAuthority } from "../models/core.mjs";
import { AgentConfig, AgentInstance, TaskDispatchContext, PiToolRequest, PiToolResult, PiRunResult,
  PiEventType } from "../models/agent.mjs";

function providersFromArray(values) {
  if (!Array.isArray(values)) throw new TypeError("modelProviders_must_be_array");
  const record = Object.create(null);
  for (const entry of values) {
    modelRecord(entry, "modelProvider", ["provider", "api", "baseUrl", "apiKey", "models", "streamSimple"]);
    const provider = modelString(entry.provider, "provider");
    if (Object.hasOwn(record, provider)) throw new TypeError("duplicate_model_provider");
    for (const field of ["api", "baseUrl", "apiKey"]) modelString(entry[field], field);
    if (entry.apiKey.startsWith("!") || entry.apiKey.includes("$")) throw new TypeError("literal_credentials_required");
    if (!Array.isArray(entry.models) || entry.models.length === 0) throw new TypeError("models_required");
    if (typeof entry.streamSimple !== "function") throw new TypeError("streamSimple_required");
    const ids = new Set();
    const models = entry.models.map((model) => {
      const id = modelString(model.id, "model id");
      if (ids.has(id)) throw new TypeError("duplicate_model");
      ids.add(id);
      return Object.freeze(structuredClone(model));
    });
    record[provider] = Object.freeze({ api: entry.api, baseUrl: entry.baseUrl, apiKey: entry.apiKey,
      models: Object.freeze(models), streamSimple: entry.streamSimple });
  }
  return Object.freeze(record);
}
function eventFor(proposal, kind, decision, reason = "", observedMutation = false) {
  let fields = { kind, reason, observedMutation };
  if (proposal instanceof ActionProposal) fields = { ...fields, roleId: proposal.session.roleId,
    taskId: proposal.session.taskId, organizationVersion: proposal.session.organizationVersion,
    resource: proposal.resource, proposalDigest: proposal.digest, correlationId: proposal.proposalId };
  if (decision !== undefined) fields = { ...fields, organizationVersion: decision.organizationVersion,
    outcome: decision.outcome, reason: decision.reason };
  return new Event(fields);
}
function failedResult(proposal, status, reason, observedMutation = false, auditFailed = false) {
  let resource = ""; let proposalDigest = "";
  if (proposal instanceof ActionProposal) { resource = proposal.resource; proposalDigest = proposal.digest; }
  return new MutationResult({ success: false, status, reason, resource, proposalDigest, observedMutation, auditFailed });
}

export class PermissionRuntime {
  #authority; #policy; #mutation; #proposal; #providers; #dispatch;
  #records = new Map(); #names = new Set(); #sessionInstances = new Map();
  #closed = false; #fault = false; #epoch = 0; #closePromise;
  constructor(options) {
    modelRecord(options, "runtime options", ["workspace", "boundaries", "sessions", "organizationVersion", "dispatchContext", "modelProviders"]);
    if (!Array.isArray(options.boundaries) || !Array.isArray(options.sessions ?? [])) {
      throw new TypeError("boundaries_and_sessions_must_be_arrays");
    }
    const boundaries = options.boundaries.map((value) => {
      if (value instanceof RoleBoundary) return value;
      return new RoleBoundary(value);
    });
    const sessions = (options.sessions ?? []).map((value) => {
      if (value instanceof AgentSession) return value;
      return new AgentSession(value);
    });
    this.#providers = providersFromArray(options.modelProviders ?? []);
    if (options.dispatchContext !== undefined) {
      this.#dispatch = options.dispatchContext;
      if (!(this.#dispatch instanceof TaskDispatchContext)) this.#dispatch = new TaskDispatchContext(this.#dispatch);
      if (this.#dispatch.organizationVersion !== options.organizationVersion ||
          !boundaries.some((boundary) => boundary.roleId === this.#dispatch.roleId)) throw new TypeError("invalid_dispatch_context");
    }
    this.#authority = _createRuntimeAuthority({ sessions, boundaries, organizationVersion: options.organizationVersion });
    this.#policy = createPolicyService();
    this.#proposal = createProposalService();
    this.#mutation = createMutationService({ workspace: options.workspace, _authority: this.#authority });
    Object.freeze(this);
  }
  #evaluate(proposal) {
    const snapshot = this.#authority.snapshot();
    let session; let instance;
    if (proposal instanceof ActionProposal) {
      session = proposal.session;
      const id = this.#sessionInstances.get(session.sessionId);
      if (id !== undefined) instance = this.#authority.instanceSnapshot(id);
    }
    return this.#policy.evaluate(proposal, { boundary: this.#authority.boundary(session?.roleId),
      trustedSession: this.#authority.trustedSession(session?.sessionId), currentVersion: snapshot.organizationVersion,
      taskStatus: this.#authority.taskStatus(session?.taskId), knownRoles: snapshot.boundaries.map((b) => b.roleId),
      instance, dispatchContext: this.#dispatch });
  }
  #deny(proposal, reason) {
    const prior = this.#evaluate(proposal);
    return new PolicyDecision({ ...prior, outcome: Outcome.DENY, reason });
  }
  #revokeAll() {
    this.#epoch += 1;
    this.#authority.updateVersion(this.#authority.snapshot().organizationVersion);
    for (const record of this.#records.values()) record.controller.abort();
  }
  async #audit(events) {
    try { return await this.#mutation.recordEvents(events); }
    catch (error) {
      if (!(error instanceof MutationError)) throw error;
      this.#fault = true; this.#revokeAll(); throw error;
    }
  }
  async prepare(proposal) {
    let decision = this.#evaluate(proposal);
    if (this.#closed || this.#fault) {
      let reason = "runtime_closed";
      if (this.#fault) reason = "audit_unavailable";
      return Object.freeze({ decision: this.#deny(proposal, reason), permit: undefined });
    }
    try { await this.#audit([eventFor(proposal, "proposal"), eventFor(proposal, "decision", decision)]); }
    catch (error) {
      if (!(error instanceof MutationError)) throw error;
      return Object.freeze({ decision: this.#deny(proposal, "audit_unavailable"), permit: undefined });
    }
    if (decision.outcome !== Outcome.ALLOW) return Object.freeze({ decision, permit: undefined });
    try {
      if (this.#closed || this.#fault) throw new TypeError("authorization_changed");
      const permit = this.#authority.issue(proposal, decision);
      return Object.freeze({ decision, permit });
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      decision = this.#deny(proposal, "authorization_changed");
      return Object.freeze({ decision, permit: undefined });
    }
  }
  async #failureAudit(proposal, result) {
    try { await this.#audit([eventFor(proposal, "mutation_failure", undefined, result.reason, result.observedMutation)]); }
    catch (error) {
      if (!(error instanceof MutationError)) throw error;
      return failedResult(proposal, "audit_failed", "result_audit_failed", result.observedMutation, true);
    }
    return result;
  }
  async execute(proposal, permit) {
    if (this.#fault) return failedResult(proposal, "audit_failed", "audit_unavailable", false, true);
    if (this.#closed) return failedResult(proposal, "denied", "runtime_closed");
    const decision = this.#evaluate(proposal);
    if (decision.outcome !== Outcome.ALLOW) {
      try { await this.#audit([eventFor(proposal, "decision", decision)]); }
      catch (error) {
        if (!(error instanceof MutationError)) throw error;
        return failedResult(proposal, "audit_failed", "decision_audit_failed", false, true);
      }
      return await this.#failureAudit(proposal, failedResult(proposal, "denied", decision.reason));
    }
    const result = await this.#mutation.execute(proposal, permit);
    if (result.auditFailed) { this.#fault = true; this.#revokeAll(); }
    if (result.status === "denied") return await this.#failureAudit(proposal, result);
    return result;
  }
  async submit(proposal) {
    const prepared = await this.prepare(proposal);
    const decision = prepared.decision;
    let result;
    if (decision.outcome === Outcome.ALLOW) result = await this.execute(proposal, prepared.permit);
    else if (decision.reason === "audit_unavailable") result = failedResult(proposal, "audit_failed", "proposal_or_decision_audit_failed", false, true);
    else if (decision.reason === "runtime_closed") result = failedResult(proposal, "denied", "runtime_closed");
    else result = await this.#failureAudit(proposal, failedResult(proposal, "denied", decision.reason));
    return Object.freeze({ decision, result });
  }

  async createAgent(input) {
    if (this.#closed || this.#fault) throw new TypeError("runtime_unavailable");
    if (this.#dispatch === undefined) throw new TypeError("dispatch_context_required");
    const config = new AgentConfig(input);
    if (this.#names.has(config.name)) throw new TypeError("duplicate_agent_name");
    const version = this.#authority.snapshot().organizationVersion;
    if (version !== this.#dispatch.organizationVersion) throw new TypeError("stale_dispatch_context");
    this.#policy.validateScope(this.#authority.boundary(this.#dispatch.roleId), this.#dispatch, config.scope);
    if (!Object.hasOwn(this.#providers, config.proxy.provider)) throw new TypeError("unknown_model_provider");
    if (!this.#providers[config.proxy.provider].models.some((model) => model.id === config.proxy.model)) throw new TypeError("unknown_model");
    const session = new AgentSession({ sessionId: this.#mutation.createIdentity(), roleId: this.#dispatch.roleId,
      taskId: this.#dispatch.taskId, organizationVersion: version });
    const instance = new AgentInstance({ instanceId: this.#mutation.createIdentity(), name: config.name, ...session });
    this.#authority.registerInstance({ instanceId: instance.instanceId, session, dispatchContext: this.#dispatch, scope: config.scope });
    const epoch = this.#epoch;
    const record = { instance, session, config, controller: new AbortController(), service: undefined,
      creation: undefined, activeRun: undefined, status: "creating", results: [], runId: "" };
    this.#names.add(config.name); this.#records.set(instance.instanceId, record);
    this.#sessionInstances.set(session.sessionId, instance.instanceId);
    try {
      record.creation = createPiAgentService({ instance, proxy: config.proxy, scope: config.scope,
        cwd: this.#mutation.workspace(), modelProviders: this.#providers, signal: record.controller.signal });
      record.service = await record.creation;
      if (this.#closed || this.#fault || this.#epoch !== epoch || record.controller.signal.aborted ||
          this.#authority.instanceSnapshot(instance.instanceId).status !== "ready") throw new TypeError("creation_revoked");
      await this.#audit([this.#agentEvent(record, "agent_created")]);
      if (this.#closed || this.#fault || this.#epoch !== epoch || record.controller.signal.aborted) throw new TypeError("creation_revoked");
      record.status = "ready";
      return instance;
    } catch (error) {
      record.status = "failed";
      this.#authority.finishRun(instance.instanceId, "failed");
      if (record.service !== undefined) await record.service.close();
      throw error;
    }
  }
  #agentEvent(record, kind, reason = "") {
    return new Event({ kind, roleId: record.session.roleId, taskId: record.session.taskId,
      organizationVersion: record.session.organizationVersion, correlationId: record.runId || record.instance.instanceId, reason });
  }
  #record(instanceId) {
    const record = this.#records.get(instanceId);
    if (record === undefined) throw new TypeError("unknown_instance");
    return record;
  }
  async runAgent(instanceId, options) {
    const record = this.#record(instanceId);
    modelRecord(options, "run options", ["taskId", "prompt"]);
    if (options.taskId !== record.session.taskId) throw new TypeError("task_mismatch");
    modelString(options.prompt, "prompt");
    if (this.#closed || this.#fault || record.status !== "ready") throw new TypeError("instance_not_ready");
    record.runId = this.#mutation.createIdentity();
    this.#authority.beginRun(instanceId, record.runId); record.status = "running";
    record.activeRun = this.#runAgent(record, options.prompt);
    return await record.activeRun;
  }
  async #runAgent(record, prompt) {
    const instanceId = record.instance.instanceId;
    let final;
    try {
      await this.#audit([this.#agentEvent(record, "agent_run_started")]);
      if (record.controller.signal.aborted) throw new DOMException("run_cancelled", "AbortError");
      record.service.start_run(record.runId, prompt);
      const requests = new Set();
      for (;;) {
        const event = await record.service.next_event(record.runId, { signal: record.controller.signal });
        if (event.type === PiEventType.TOOL_REQUEST) {
          const request = event.request;
          if (!(request instanceof PiToolRequest) || request.runId !== record.runId || requests.has(request.requestId)) {
            throw new TypeError("invalid_tool_request");
          }
          requests.add(request.requestId);
          const proposal = this.#proposal.convert(request, record.session);
          const outcome = await this.submit(proposal);
          const response = new PiToolResult({ requestId: request.requestId, runId: request.runId, ...outcome });
          record.results.push(response);
          if (record.controller.signal.aborted || this.#fault || this.#closed) break;
          record.service.respond_tool(request, response);
        } else if (event.type === PiEventType.RUN_EVENT) {
          if (event.runId !== record.runId || !["agent_start", "tool_execution_start", "tool_execution_end", "agent_settled"].includes(event.eventType)) {
            throw new TypeError("invalid_run_event");
          }
          await this.#audit([this.#agentEvent(record, "agent_run_event", event.eventType)]);
        } else {
          if (![PiEventType.RUN_FINISHED, PiEventType.RUN_FAILED, PiEventType.RUN_CANCELLED].includes(event.type) ||
              !(event.result instanceof PiRunResult) || event.result.runId !== record.runId ||
              event.result.toolResults.length !== record.results.length ||
              event.result.toolResults.some((result, index) => result !== record.results[index])) throw new TypeError("invalid_terminal_event");
          final = event.result; break;
        }
      }
      if (final === undefined) {
        let status = "failed"; let errorCode = "kernel_audit_failed";
        if (record.controller.signal.aborted && !this.#fault) { status = "cancelled"; errorCode = "kernel_run_cancelled"; }
        final = new PiRunResult({ runId: record.runId, status, toolResults: record.results, errorCode });
      }
    } catch (error) {
      let status = "failed"; let errorCode = "kernel_run_failed";
      if (record.controller.signal.aborted && !this.#fault) { status = "cancelled"; errorCode = "kernel_run_cancelled"; }
      if (this.#fault) errorCode = "kernel_audit_failed";
      final = new PiRunResult({ runId: record.runId, status, toolResults: record.results, errorCode });
    } finally {
      this.#authority.finishRun(instanceId, "closed");
      record.status = "closed";
      await record.service.close();
    }
    if (!this.#fault) {
      try { await this.#audit([this.#agentEvent(record, "agent_run_" + final.status, final.errorCode)]); }
      catch (error) {
        if (!(error instanceof MutationError)) throw error;
        final = new PiRunResult({ ...final, status: "failed", errorCode: "kernel_audit_failed" });
      }
    }
    return final;
  }
  async #stop(record) {
    record.controller.abort();
    if (record.service !== undefined) { await record.service.cancel(); await record.service.close(); return; }
    if (record.creation !== undefined && record.status === "creating") {
      const [outcome] = await Promise.allSettled([record.creation]);
      if (outcome.status === "fulfilled") await outcome.value.close();
      else if (outcome.reason?.name !== "AbortError") throw outcome.reason;
    }
  }
  cancelAgent(instanceId) {
    const record = this.#record(instanceId);
    this.#authority.revokeInstance(instanceId); record.controller.abort();
    if (record.status !== "closed" && record.status !== "failed") record.status = "cancelled";
    return this.#stop(record);
  }
  closeAgent(instanceId) { return this.cancelAgent(instanceId); }
  updateVersion(version) {
    this.#authority.updateVersion(version); this.#epoch += 1;
    for (const record of this.#records.values()) record.controller.abort();
    return Promise.all([...this.#records.values()].map((record) => this.#stop(record)));
  }
  updateBoundary(boundary) {
    if (!(boundary instanceof RoleBoundary)) boundary = new RoleBoundary(boundary);
    this.#authority.updateBoundary(boundary); this.#epoch += 1;
    const records = [...this.#records.values()].filter((record) => record.session.roleId === boundary.roleId);
    for (const record of records) record.controller.abort();
    return Promise.all(records.map((record) => this.#stop(record)));
  }
  setTaskStatus(taskId, status) {
    this.#authority.setTaskStatus(taskId, status); this.#epoch += 1;
    const records = [...this.#records.values()].filter((record) => record.session.taskId === taskId);
    for (const record of records) record.controller.abort();
    return Promise.all(records.map((record) => this.#stop(record)));
  }
  async events() { return await this.#mutation.events(); }
  async readFile(resource) { return await this.#mutation.readFile(resource); }
  close() {
    if (this.#closePromise !== undefined) return this.#closePromise;
    this.#closed = true; this.#revokeAll();
    this.#closePromise = this.#close(); return this.#closePromise;
  }
  async #close() {
    const records = [...this.#records.values()];
    const stopped = await Promise.allSettled(records.map((record) => this.#stop(record)));
    // Run finalization owns terminal audit and never waits on Runtime.close.
    const finished = await Promise.allSettled(records.map((record) => record.activeRun));
    try {
      for (const outcome of [...stopped, ...finished]) {
        if (outcome.status === "rejected") throw outcome.reason;
      }
    } finally { await this.#mutation.close(); }
  }
}

export async function runPermissionDemo() {
  const backend = new AgentSession({ sessionId: "backend", roleId: "Backend", taskId: "demo", organizationVersion: "v3" });
  const frontend = new AgentSession({ sessionId: "frontend", roleId: "Frontend", taskId: "demo", organizationVersion: "v3" });
  const boundary = new RoleBoundary({ roleId: "Backend", writeScope: ["backend/"], denyScope: ["backend/private/"], tools: ["legion_write_file"], capabilities: ["write_file"] });
  const runtime = new PermissionRuntime({ workspace: null, boundaries: [boundary,
    new RoleBoundary({ roleId: "Frontend", writeScope: ["frontend/"], tools: ["legion_write_file"], capabilities: ["write_file"] })],
    sessions: [backend, frontend], organizationVersion: "v3" });
  function proposal(proposalId, resource, session, extra = {}) { return new ActionProposal({ proposalId, resource, session,
    action: "write_file", content: "backend content", tool: "legion_write_file", capability: "write_file", ...extra }); }
  try {
    await runtime.submit(proposal("seed", "frontend/login.vue", frontend, { content: "frontend original" }));
    const scenarios = [proposal("allowed", "backend/main.mjs", backend), proposal("outside", "frontend/login.vue", backend),
      proposal("tool", "backend/tool.mjs", backend, { tool: "bash" }), proposal("capability", "backend/cap.mjs", backend, { capability: "execute" }),
      proposal("deny", "backend/private/x.mjs", backend)];
    const rows = [];
    for (const p of scenarios) { const value = await runtime.submit(p); rows.push(Object.freeze({ scenario: p.proposalId, ...value })); }
    await runtime.updateVersion("v4");
    const stale = await runtime.submit(proposal("version", "backend/stale.mjs", backend));
    rows.push(Object.freeze({ scenario: "version", ...stale }));
    return Object.freeze({ rows: Object.freeze(rows), backendWritten: await runtime.readFile("backend/main.mjs") === "backend content",
      frontendPreserved: await runtime.readFile("frontend/login.vue") === "frontend original", events: await runtime.events() });
  } finally { await runtime.close(); }
}
