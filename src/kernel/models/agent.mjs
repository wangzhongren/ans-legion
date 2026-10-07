/** Immutable configuration and Pi interchange values; no SDK, callbacks, or effects. */
import { AgentSession, PolicyDecision, MutationResult, modelRecord, modelString, immutableStrings,
  normalizeResource, normalizeScope, digestValue } from "./core.mjs";

export class PiConnection {
  constructor(options) {
    modelRecord(options, "PiConnection", ["provider", "model"]);
    this.provider = modelString(options.provider, "provider");
    this.model = modelString(options.model, "model");
    Object.freeze(this);
  }
}

function plainValue(value, depth = 0) {
  if (depth > 8) throw new TypeError("metadata_too_deep");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map((item) => plainValue(item, depth + 1)));
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError("plain_metadata_required");
  }
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (["apiKey", "credentials", "token", "streamSimple", "__proto__"].includes(key)) {
      throw new TypeError("secret_or_effect_metadata");
    }
    result[key] = plainValue(item, depth + 1);
  }
  return Object.freeze(result);
}

export class PiConnectionProfile {
  constructor(options) {
    modelRecord(options, "PiConnectionProfile", ["profileId", "profileVersion", "protocol", "provider",
      "model", "baseUrl", "modelMetadata"]);
    for (const field of ["profileId", "profileVersion", "protocol", "provider", "model", "baseUrl"]) {
      this[field] = modelString(options[field], field);
    }
    if (!["openai-completions", "openai-responses", "anthropic-messages"].includes(this.protocol)) {
      throw new TypeError("unsupported_protocol");
    }
    const url = new URL(this.baseUrl);
    if (url.username !== "" || url.password !== "" || !["https:", "http:"].includes(url.protocol)) {
      throw new TypeError("invalid_base_url");
    }
    this.modelMetadata = null;
    if (options.modelMetadata !== undefined && options.modelMetadata !== null) {
      modelRecord(options.modelMetadata, "modelMetadata", ["id", "name", "api", "provider", "baseUrl",
        "reasoning", "input", "cost", "contextWindow", "maxTokens", "compat"]);
      for (const [field, expected] of [["id", this.model], ["api", this.protocol],
        ["provider", this.provider], ["baseUrl", this.baseUrl]]) {
        if (options.modelMetadata[field] !== undefined && options.modelMetadata[field] !== expected) {
          throw new TypeError("metadata_connection_mismatch");
        }
      }
      this.modelMetadata = plainValue(options.modelMetadata);
    }
    Object.freeze(this);
  }
}

export class AgentScope {
  constructor(options) {
    modelRecord(options, "AgentScope", ["write", "deny", "tools"]);
    const { write = [], deny = [], tools = [] } = options;
    this.write = Object.freeze(immutableStrings(write, "write").map((value) =>
      normalizeScope(value, { allowControlPlane: false })));
    this.deny = Object.freeze(immutableStrings(deny, "deny").map((value) => normalizeScope(value)));
    this.tools = immutableStrings(tools, "tools");
    Object.freeze(this);
  }

  get digest() {
    return digestValue({ write: [...this.write].sort(), deny: [...this.deny].sort(), tools: [...this.tools].sort() });
  }
}

export class AgentConfig {
  constructor(options) {
    modelRecord(options, "AgentConfig", ["name", "proxy", "scope", "lifecycle"]);
    this.name = modelString(options.name, "name");
    this.proxy = options.proxy;
    if (!(this.proxy instanceof PiConnection)) this.proxy = new PiConnection(options.proxy);
    this.scope = options.scope;
    if (!(this.scope instanceof AgentScope)) this.scope = new AgentScope(options.scope);
    this.lifecycle = options.lifecycle ?? "single_run";
    if (!["single_run", "conversation"].includes(this.lifecycle)) throw new TypeError("invalid_lifecycle");
    if (this.lifecycle === "conversation" && (this.scope.tools.length !== 0 || this.scope.write.length !== 0)) {
      throw new TypeError("conversation_must_be_toolless");
    }
    Object.freeze(this);
  }
}

export class TaskDispatchContext {
  constructor(options) {
    modelRecord(options, "TaskDispatchContext", ["roleId", "taskId", "organizationVersion", "writeSet", "tools"]);
    for (const field of ["roleId", "taskId", "organizationVersion"]) {
      this[field] = modelString(options[field], field);
    }
    this.writeSet = Object.freeze(immutableStrings(options.writeSet, "writeSet").map((resource) =>
      normalizeResource(resource)));
    this.tools = immutableStrings(options.tools, "tools");
    Object.freeze(this);
  }

  get digest() {
    return digestValue({ roleId: this.roleId, taskId: this.taskId, organizationVersion: this.organizationVersion,
      writeSet: [...this.writeSet].sort(), tools: [...this.tools].sort() });
  }
}

/** Identity value only. Interface owns the operational run/cancel/close façade. */
export class AgentInstance {
  constructor(options) {
    const fields = ["instanceId", "name", "sessionId", "roleId", "taskId", "organizationVersion"];
    modelRecord(options, "AgentInstance", fields);
    for (const field of fields) this[field] = modelString(options[field], field);
    Object.freeze(this);
  }

  matchesSession(session) {
    return session instanceof AgentSession && this.sessionId === session.sessionId &&
      this.roleId === session.roleId && this.taskId === session.taskId &&
      this.organizationVersion === session.organizationVersion;
  }
}

export const PiEventType = Object.freeze({
  TOOL_REQUEST: "tool_request", RUN_EVENT: "run_event", RUN_FINISHED: "run_finished",
  RUN_FAILED: "run_failed", RUN_CANCELLED: "run_cancelled", TEXT_DELTA: "text_delta",
});

export class PiTextDelta {
  constructor(options) {
    modelRecord(options, "PiTextDelta", ["runId", "text"]);
    this.runId = modelString(options.runId, "runId");
    this.text = modelString(options.text, "text", { empty: true });
    if (this.text.length > 65536) throw new TypeError("text_delta_budget");
    Object.freeze(this);
  }
}

export class PiConversationHistory {
  constructor(options) {
    modelRecord(options, "PiConversationHistory", ["messages"]);
    if (!Array.isArray(options.messages) || options.messages.length > 256) {
      throw new TypeError("history_collection_or_budget");
    }
    let chars = 0;
    const messages = [];
    for (const message of options.messages) {
      modelRecord(message, "history message", ["role", "text"]);
      if (!["user", "assistant"].includes(message.role)) throw new TypeError("text_history_only");
      const text = modelString(message.text, "text", { empty: true });
      chars += text.length;
      if (text.length > 65536 || chars > 2097152) throw new TypeError("history_text_budget");
      messages.push(Object.freeze({ role: message.role, text }));
    }
    this.messages = Object.freeze(messages);
    Object.freeze(this);
  }
}

export class PiConversationCheckpoint {
  constructor(options) {
    modelRecord(options, "PiConversationCheckpoint", ["instance", "profileId", "profileVersion", "history"]);
    if (!(options.instance instanceof AgentInstance)) throw new TypeError("typed_instance_required");
    this.instance = options.instance;
    this.profileId = modelString(options.profileId, "profileId");
    this.profileVersion = modelString(options.profileVersion, "profileVersion");
    this.history = options.history;
    if (!(this.history instanceof PiConversationHistory)) this.history = new PiConversationHistory(options.history);
    Object.freeze(this);
  }
}

export class PiToolRequest {
  constructor(options) {
    modelRecord(options, "PiToolRequest", ["requestId", "runId", "toolCallId", "tool", "parameters"]);
    for (const field of ["requestId", "runId", "toolCallId", "tool"]) {
      this[field] = modelString(options[field], field);
    }
    const parameters = modelRecord(options.parameters, "parameters", ["resource", "content"]);
    this.parameters = Object.freeze({
      resource: modelString(parameters.resource, "resource"),
      content: modelString(parameters.content, "content", { empty: true }),
    });
    Object.freeze(this);
  }
}

export class PiToolResult {
  constructor(options) {
    modelRecord(options, "PiToolResult", ["requestId", "runId", "decision", "result"]);
    this.requestId = modelString(options.requestId, "requestId");
    this.runId = modelString(options.runId, "runId");
    if (!(options.decision instanceof PolicyDecision) || !(options.result instanceof MutationResult)) {
      throw new TypeError("typed decision and mutation result required");
    }
    this.decision = options.decision;
    this.result = options.result;
    Object.freeze(this);
  }
}

export class PiRunResult {
  constructor(options) {
    modelRecord(options, "PiRunResult", ["runId", "status", "assistantText", "toolResults", "errorCode"]);
    this.runId = modelString(options.runId, "runId");
    if (!["completed", "cancelled", "failed"].includes(options.status)) throw new TypeError("invalid_run_status");
    this.status = options.status;
    this.assistantText = modelString(options.assistantText ?? "", "assistantText", { empty: true });
    const values = options.toolResults ?? [];
    if (typeof values === "string" || values === null || typeof values[Symbol.iterator] !== "function") {
      throw new TypeError("toolResults must be a collection");
    }
    const results = [];
    const requestIds = new Set();
    for (const result of values) {
      if (!(result instanceof PiToolResult) || result.runId !== this.runId || requestIds.has(result.requestId)) {
        throw new TypeError("invalid_duplicate_or_foreign_tool_result");
      }
      requestIds.add(result.requestId);
      results.push(result);
    }
    this.toolResults = Object.freeze(results);
    this.errorCode = modelString(options.errorCode ?? "", "errorCode", { empty: true });
    Object.freeze(this);
  }
}
