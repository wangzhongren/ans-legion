/** Immutable configuration and Pi interchange values; no SDK, callbacks, or effects. */
import { createHash } from "node:crypto";
import { AgentSession, PolicyDecision, MutationResult, modelRecord, modelString, immutableStrings,
  normalizeResource, normalizeScope, digestValue } from "./core.mjs";
import { shellEffects, shellSha, ShellRequest, ShellReview, ShellDecision, ShellResult } from "./shell.mjs";
import { CheckRequest, CheckDecision, CheckResult, checkSpecs } from "./check.mjs";

export const AgentControlTools = Object.freeze(["legion_design_roles", "legion_propose_roles",
  "legion_review_roles", "legion_request_interaction", "legion_submit_acceptance", "legion_request_repair", "legion_review_shell", "legion_remember_fact", "legion_query_memory", "legion_submit_supervision",
  "legion_delegate_pm", "legion_query_role_activity", "legion_query_role_log"]);
export const AgentTools = Object.freeze(["legion_write_file", "legion_edit_file", "legion_list_files",
  "legion_read_file", "legion_run_check", "legion_request_shell", ...AgentControlTools]);

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
      const input = Object.getOwnPropertyDescriptor(options.modelMetadata, "input");
      if (input !== undefined) {
        if (!Object.hasOwn(input, "value")) throw new TypeError("invalid_model_input_capabilities");
        const capabilities = imageArray(input.value, "model input", 2);
        if (capabilities.length === 0 || capabilities.some(value => !["text", "image"].includes(value)) || new Set(capabilities).size !== capabilities.length) throw new TypeError("invalid_model_input_capabilities");
      }
      this.modelMetadata = plainValue(options.modelMetadata);
    }
    Object.freeze(this);
  }
}

export class AgentScope {
  constructor(options) {
    modelRecord(options, "AgentScope", ["write", "deny", "tools", "checks", "generatedEffects", "generationDigest"]);
    const { write = [], deny = [], tools = [] } = options;
    this.write = Object.freeze(immutableStrings(write, "write").map((value) =>
      normalizeScope(value, { allowControlPlane: false })));
    this.deny = Object.freeze(immutableStrings(deny, "deny").map((value) => normalizeScope(value)));
    this.tools = immutableStrings(tools, "tools");
    if (options.checks !== undefined) this.checks = checkSpecs(options.checks);
    if(options.generatedEffects!==undefined)this.generatedEffects=shellEffects(options.generatedEffects);
    if(options.generationDigest!==undefined)this.generationDigest=shellSha(options.generationDigest,"generationDigest");
    Object.freeze(this);
  }

  get digest() {
    const value = { write: [...this.write].sort(), deny: [...this.deny].sort(), tools: [...this.tools].sort() };
    if (this.checks !== undefined) value.checks = this.checks;
    if(this.generatedEffects!==undefined)value.generatedEffects=this.generatedEffects;
    if(this.generationDigest!==undefined)value.generationDigest=this.generationDigest;
    return digestValue(value);
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
    if (this.lifecycle === "conversation" && (this.scope.write.length !== 0 ||
        this.scope.tools.includes("legion_write_file") || this.scope.tools.includes("legion_edit_file"))) {
      throw new TypeError("conversation_must_be_toolless_or_read_only");
    }
    Object.freeze(this);
  }
}

export class TaskDispatchContext {
  constructor(options) {
    modelRecord(options, "TaskDispatchContext", ["roleId", "taskId", "organizationVersion", "fileOwnersDigest", "ownerGeneration", "tools", "checks", "generatedEffects", "generationDigest"]);
    for (const field of ["roleId", "taskId", "organizationVersion"]) {
      this[field] = modelString(options[field], field);
    }
    this.fileOwnersDigest = shellSha(options.fileOwnersDigest, "fileOwnersDigest");
    this.ownerGeneration = modelString(options.ownerGeneration, "ownerGeneration");
    this.tools = immutableStrings(options.tools, "tools");
    if (options.checks !== undefined) this.checks = checkSpecs(options.checks);
    if(options.generatedEffects!==undefined)this.generatedEffects=shellEffects(options.generatedEffects);
    if(options.generationDigest!==undefined)this.generationDigest=shellSha(options.generationDigest,"generationDigest");
    Object.freeze(this);
  }

  get digest() {
    const value = { roleId: this.roleId, taskId: this.taskId, organizationVersion: this.organizationVersion,
      fileOwnersDigest: this.fileOwnersDigest, ownerGeneration: this.ownerGeneration, tools: [...this.tools].sort() };
    if (this.checks !== undefined) value.checks = this.checks;
    if(this.generatedEffects!==undefined)value.generatedEffects=this.generatedEffects;
    if(this.generationDigest!==undefined)value.generationDigest=this.generationDigest;
    return digestValue(value);
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

/** Pure image values only. Decoder, private storage, source binding and SDK effects belong to owners. */
const imageReferenceValues = new WeakSet();
const imageInputValues = new WeakSet();
function imageRecord(value, name, fields) {
  if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype || Object.getOwnPropertySymbols(value).length !== 0) throw new TypeError("plain_image_value_required");
  modelRecord(value, name, fields);
  for (const key of Object.getOwnPropertyNames(value)) {
    if (!fields.includes(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value")) throw new TypeError("image_effect_field_rejected");
  }
  return value;
}
function imageArray(value, name, max) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max || Reflect.ownKeys(value).length !== value.length + 1) throw new TypeError(name + "_collection_budget");
  const result = [];
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (descriptor === undefined || !Object.hasOwn(descriptor, "value")) throw new TypeError("image_effect_field_rejected");
    result.push(descriptor.value);
  }
  return result;
}
export class PiImageReference {
  constructor(options) {
    imageRecord(options, "PiImageReference", ["projectId", "attachmentId", "sha256", "mimeType", "byteLength", "width", "height"]);
    for (const field of ["projectId", "attachmentId"]) {
      if (typeof options[field] !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(options[field])) throw new TypeError("invalid_image_identifier");
      this[field] = options[field];
    }
    this.sha256 = shellSha(options.sha256, "image sha256");
    if (!["image/png", "image/jpeg"].includes(options.mimeType)) throw new TypeError("unsupported_image_mime");
    this.mimeType = options.mimeType;
    if (!Number.isSafeInteger(options.byteLength) || options.byteLength < 1 || options.byteLength > 4194304) throw new TypeError("image_byte_budget");
    this.byteLength = options.byteLength;
    for (const field of ["width", "height"]) {
      if (!Number.isSafeInteger(options[field]) || options[field] < 1 || options[field] > 8192) throw new TypeError("image_dimension_budget");
      this[field] = options[field];
    }
    if (this.width * this.height > 16000000) throw new TypeError("image_pixel_budget");
    Object.freeze(this); imageReferenceValues.add(this);
  }
}
export class PiImageInput {
  constructor(options) {
    imageRecord(options, "PiImageInput", ["ref", "data"]);
    if (!imageReferenceValues.has(options.ref)) throw new TypeError("typed_image_reference_required");
    this.ref = options.ref;
    if (typeof options.data !== "string" || options.data.length !== 4 * Math.ceil(this.ref.byteLength / 3) ||
        !/^[A-Za-z0-9+/]*={0,2}$/.test(options.data)) throw new TypeError("invalid_image_base64");
    const bytes = Buffer.from(options.data, "base64");
    if (bytes.toString("base64") !== options.data) throw new TypeError("noncanonical_image_base64");
    if (bytes.byteLength !== this.ref.byteLength || createHash("sha256").update(bytes).digest("hex") !== this.ref.sha256) throw new TypeError("image_content_mismatch");
    this.data = options.data;
    Object.freeze(this); imageInputValues.add(this);
  }
  static assertCollection(images, options = {}) {
    imageRecord(options, "image collection options", ["mode"]);
    const mode = options.mode ?? "turn";
    let count = 4; let budget = 8388608;
    if (mode === "restore") { count = 8; budget = 16777216; }
    else if (mode !== "turn") throw new TypeError("invalid_image_collection_mode");
    const values = imageArray(images, "images", count); const ids = new Set(); let projectId; let bytes = 0;
    for (const image of values) {
      if (!imageInputValues.has(image)) throw new TypeError("typed_image_input_required");
      if (ids.has(image.ref.attachmentId)) throw new TypeError("duplicate_image_reference");
      ids.add(image.ref.attachmentId);
      if (projectId !== undefined && image.ref.projectId !== projectId) throw new TypeError("image_project_mismatch");
      projectId = image.ref.projectId; bytes += image.ref.byteLength;
    }
    if (bytes > budget) throw new TypeError("image_collection_byte_budget");
    return Object.freeze(values);
  }
}

export class PiConversationHistory {
  constructor(options) {
    modelRecord(options, "PiConversationHistory", ["messages"]);
    if (!Array.isArray(options.messages) || options.messages.length > 256) {
      throw new TypeError("history_collection_or_budget");
    }
    let chars = 0; let imageProjectId;
    const imageIds = new Map();
    const messages = [];
    for (const message of options.messages) {
      modelRecord(message, "history message", ["role", "text", "imageRefs"]);
      if (!["user", "assistant"].includes(message.role)) throw new TypeError("text_history_only");
      const text = modelString(message.text, "text", { empty: true });
      chars += text.length;
      if (text.length > 65536 || chars > 2097152) throw new TypeError("history_text_budget");
      const entry = { role: message.role, text };
      if (message.imageRefs !== undefined) {
        if (message.role !== "user") throw new TypeError("user_image_history_only");
        const refs = imageArray(message.imageRefs, "history images", 4);
        if (refs.length === 0) throw new TypeError("nonempty_image_refs_required");
        const seen = new Set(); let bytes = 0;
        entry.imageRefs = Object.freeze(refs.map(value => {
          let ref = value;
          if (!imageReferenceValues.has(ref)) ref = new PiImageReference(value);
          if (seen.has(ref.attachmentId)) throw new TypeError("duplicate_image_reference");
          seen.add(ref.attachmentId); bytes += ref.byteLength;
          if (imageProjectId !== undefined && ref.projectId !== imageProjectId) throw new TypeError("image_project_mismatch");
          imageProjectId = ref.projectId;
          const prior = imageIds.get(ref.attachmentId);
          if (prior !== undefined && digestValue(prior) !== digestValue(ref)) throw new TypeError("image_reference_changed");
          imageIds.set(ref.attachmentId, ref);
          return ref;
        }));
        if (bytes > 8388608) throw new TypeError("image_collection_byte_budget");
      }
      messages.push(Object.freeze(entry));
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
    if (this.tool === "legion_write_file") {
      const parameters = modelRecord(options.parameters, "parameters", ["resource", "content"]);
      this.parameters = Object.freeze({ resource: modelString(parameters.resource, "resource"),
        content: modelString(parameters.content, "content", { empty: true }) });
    } else if (this.tool === "legion_edit_file") {
      const parameters = modelRecord(options.parameters, "parameters", ["resource", "expectedSha256", "replacements"]);
      const resource = modelString(parameters.resource, "resource");
      if (typeof parameters.expectedSha256 !== "string" || !/^[a-f0-9]{64}$/.test(parameters.expectedSha256)) {
        throw new TypeError("expected_sha256_required");
      }
      if (!Array.isArray(parameters.replacements) || parameters.replacements.length < 1 ||
          parameters.replacements.length > 16) throw new TypeError("edit_replacement_budget");
      const seen = new Set();
      let bytes = 0;
      const replacements = parameters.replacements.map((item) => {
        modelRecord(item, "edit replacement", ["oldText", "newText"]);
        if (typeof item.oldText !== "string" || item.oldText.length === 0 || typeof item.newText !== "string") {
          throw new TypeError("invalid_edit_replacement");
        }
        if (seen.has(item.oldText)) throw new TypeError("duplicate_old_text");
        seen.add(item.oldText);
        bytes += Buffer.byteLength(item.oldText, "utf8") + Buffer.byteLength(item.newText, "utf8");
        if (bytes > 2097152) throw new TypeError("edit_replacement_budget");
        return Object.freeze({ oldText: item.oldText, newText: item.newText });
      });
      this.parameters = Object.freeze({ resource, expectedSha256: parameters.expectedSha256,
        replacements: Object.freeze(replacements) });
    } else if (this.tool === "legion_list_files" || this.tool === "legion_read_file") {
      const request = new ProjectReadRequest({ requestId: this.requestId, runId: this.runId,
        tool: this.tool, ...options.parameters });
      if (this.tool === "legion_list_files") {
        this.parameters = Object.freeze({ resource: request.resource, cursor: request.cursor, limit: request.limit });
      } else {
        this.parameters = Object.freeze({ resource: request.resource, startLine: request.startLine,
          maxBytes: request.maxBytes });
      }
    } else if(this.tool==="legion_request_shell") {
      const parameters=modelRecord(options.parameters,"parameters",["command","cwd","reason","generatedEffects","network","timeoutSeconds"]);
      const request=new ShellRequest({requestId:this.requestId,runId:this.runId,...parameters});
      this.parameters=Object.freeze({command:request.command,cwd:request.cwd,reason:request.reason,generatedEffects:request.generatedEffects,network:request.network,timeoutSeconds:request.timeoutSeconds});
    } else if(this.tool==="legion_review_shell") {
      const review=new ShellReview(options.parameters);this.parameters=Object.freeze({...review});
    } else if (this.tool === "legion_run_check") {
      const parameters = modelRecord(options.parameters, "parameters", ["checkId"]);
      const request = new CheckRequest({ requestId: this.requestId, runId: this.runId, checkId: parameters.checkId });
      this.parameters = Object.freeze({ checkId: request.checkId });
    } else if (AgentControlTools.includes(this.tool)) {
      const parameters = modelRecord(options.parameters, "parameters", ["payload"]);
      this.parameters = Object.freeze({ payload: suControlPayload(this.tool, parameters.payload) });
    } else throw new TypeError("unsupported_tool");
    Object.freeze(this);
  }
}

/** A read has no mutation proposal, permit, or audit payload. */
export class ProjectReadRequest {
  constructor(options) {
    modelRecord(options, "ProjectReadRequest", ["requestId", "runId", "tool", "resource", "cursor",
      "limit", "startLine", "maxBytes"]);
    this.requestId = modelString(options.requestId, "requestId");
    this.runId = modelString(options.runId, "runId");
    if (!["legion_list_files", "legion_read_file"].includes(options.tool)) throw new TypeError("invalid_read_tool");
    this.tool = options.tool;
    this.resource = modelString(options.resource ?? "", "resource", { empty: true });
    this.cursor = modelString(options.cursor ?? "", "cursor", { empty: true });
    this.limit = options.limit ?? 200;
    this.startLine = options.startLine ?? 1;
    this.maxBytes = options.maxBytes ?? 65536;
    if (!Number.isSafeInteger(this.limit) || this.limit < 1 || this.limit > 200 ||
        !Number.isSafeInteger(this.startLine) || this.startLine < 1 ||
        !Number.isSafeInteger(this.maxBytes) || this.maxBytes < 1 || this.maxBytes > 65536) {
      throw new TypeError("read_budget");
    }
    if (this.tool === "legion_list_files" && (options.startLine !== undefined || options.maxBytes !== undefined)) {
      throw new TypeError("unexpected_list_parameters");
    }
    if (this.tool === "legion_read_file" && (this.resource === "" || options.cursor !== undefined || options.limit !== undefined)) {
      throw new TypeError("unexpected_file_parameters");
    }
    Object.freeze(this);
  }
}

export class ProjectReadDecision {
  constructor(options) {
    modelRecord(options, "ProjectReadDecision", ["allowed", "reason"]);
    if (typeof options.allowed !== "boolean") throw new TypeError("invalid_read_decision");
    this.allowed = options.allowed;
    this.reason = modelString(options.reason, "reason");
    Object.freeze(this);
  }
}

export class ProjectReadResult {
  constructor(options) {
    modelRecord(options, "ProjectReadResult", ["status", "reason", "resource", "entries", "nextCursor",
      "text", "nextLine", "complete", "byteLength", "sha256"]);
    if (!["listed", "read", "denied"].includes(options.status)) throw new TypeError("invalid_read_status");
    this.status = options.status;
    this.reason = modelString(options.reason, "reason");
    this.resource = modelString(options.resource ?? "", "resource", { empty: true });
    this.entries = Object.freeze((options.entries ?? []).map((entry) => {
      modelRecord(entry, "read entry", ["name", "kind"]);
      if (!["file", "directory"].includes(entry.kind)) throw new TypeError("invalid_entry_kind");
      return Object.freeze({ name: modelString(entry.name, "name"), kind: entry.kind });
    }));
    this.nextCursor = modelString(options.nextCursor ?? "", "nextCursor", { empty: true });
    this.text = modelString(options.text ?? "", "text", { empty: true });
    this.nextLine = options.nextLine ?? 0;
    this.complete = options.complete ?? false;
    this.byteLength = options.byteLength ?? 0;
    if (options.sha256 !== undefined) {
      if (this.status !== "read" || typeof options.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(options.sha256)) {
        throw new TypeError("invalid_read_sha256");
      }
      this.sha256 = options.sha256;
    }
    if (!Number.isSafeInteger(this.nextLine) || this.nextLine < 0 ||
        !Number.isSafeInteger(this.byteLength) || this.byteLength < 0 || this.byteLength > 65536 ||
        typeof this.complete !== "boolean") throw new TypeError("invalid_read_result");
    if (this.status === "read" && Buffer.byteLength(this.text, "utf8") !== this.byteLength) {
      throw new TypeError("read_byte_length_mismatch");
    }
    if (this.status !== "listed" && this.entries.length !== 0) throw new TypeError("unexpected_entries");
    if (this.status !== "read" && (this.text !== "" || this.byteLength !== 0)) throw new TypeError("unexpected_text");
    Object.freeze(this);
  }
}

/** Bounded interchange data; Desktop validates domain fields and host-bound caller identity. */
function controlPayload(value) {
  let nodes = 0;
  function copy(item, depth) {
    nodes += 1;
    if (depth > 8 || nodes > 4096) throw new TypeError("control_payload_budget");
    if (item === null || typeof item === "boolean") return item;
    if (typeof item === "number" && Number.isFinite(item)) return item;
    if (typeof item === "string") {
      if (item.length > 65536) throw new TypeError("control_payload_budget");
      return item;
    }
    if (Array.isArray(item)) {
      if (Object.getPrototypeOf(item) !== Array.prototype || Object.getOwnPropertySymbols(item).length !== 0 ||
          Object.keys(item).length !== item.length || item.length > 4096) {
        throw new TypeError("plain_control_array_required");
      }
      const result = [];
      for (let index = 0; index < item.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
        if (descriptor === undefined || !Object.hasOwn(descriptor, "value")) {
          throw new TypeError("secret_effect_or_caller_control_field");
        }
        result.push(copy(descriptor.value, depth + 1));
      }
      return Object.freeze(result);
    }
    if (typeof item !== "object" || Object.getPrototypeOf(item) !== Object.prototype ||
        Object.getOwnPropertySymbols(item).length !== 0) throw new TypeError("plain_control_payload_required");
    const result = {};
    for (const key of Object.keys(item)) {
      const descriptor = Object.getOwnPropertyDescriptor(item, key);
      if (!Object.hasOwn(descriptor, "value") || ["__proto__", "constructor", "prototype", "apiKey",
          "credentials", "token", "callerRoleId", "callerSessionId", "callerInstanceId"].includes(key)) {
        throw new TypeError("secret_effect_or_caller_control_field");
      }
      result[key] = copy(descriptor.value, depth + 1);
    }
    return Object.freeze(result);
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("plain_control_payload_required");
  }
  const result = copy(value, 0);
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > 262144) throw new TypeError("control_payload_budget");
  return result;
}

/** Su domain data only: Host separately binds provenance, channel, snapshots and Human answers. */
function suControlPayload(tool, value) {
  const payload = controlPayload(value);
  const text = (value, field, max = 200) => {
    modelString(value, field);
    if (value.length > max) throw new TypeError("su_control_field_budget");
  };
  if (tool === "legion_delegate_pm") {
    if (payload.action === "start") {
      modelRecord(payload, "delegate start", ["action", "purpose", "instruction", "sourceRefs", "acceptanceId", "taskId"]);
      if (!["plan", "role_design", "repair"].includes(payload.purpose)) throw new TypeError("invalid_delegation_purpose");
      modelString(payload.instruction, "instruction");
      if (Buffer.byteLength(payload.instruction, "utf8") > 8192) throw new TypeError("delegation_instruction_budget");
      if (!Array.isArray(payload.sourceRefs) || payload.sourceRefs.length > 32) throw new TypeError("delegation_source_budget");
      for (const ref of payload.sourceRefs) text(ref, "sourceRef");
      if (payload.purpose === "repair") { text(payload.acceptanceId, "acceptanceId"); text(payload.taskId, "taskId"); }
      else if (Object.hasOwn(payload, "acceptanceId") || Object.hasOwn(payload, "taskId")) throw new TypeError("unexpected_repair_selector");
    } else if (payload.action === "resume") {
      modelRecord(payload, "delegate resume", ["action", "delegationId", "humanAnswerRef"]);
      text(payload.delegationId, "delegationId"); text(payload.humanAnswerRef, "humanAnswerRef");
    } else throw new TypeError("invalid_delegation_action");
  } else if (["legion_query_role_activity", "legion_query_role_log"].includes(tool)) {
    let fields = ["roleId", "taskId", "planDigest"];
    if (tool === "legion_query_role_log") fields = [...fields, "cursor", "limit"];
    modelRecord(payload, "role query", fields);
    if (tool === "legion_query_role_log" || payload.roleId !== undefined) text(payload.roleId, "roleId");
    if (payload.taskId !== undefined) text(payload.taskId, "taskId");
    if (payload.planDigest !== undefined) shellSha(payload.planDigest, "planDigest");
    if (payload.cursor !== undefined) {
      modelString(payload.cursor, "cursor");
      if (Buffer.byteLength(payload.cursor, "utf8") > 4096) throw new TypeError("role_log_cursor_budget");
    }
    if (payload.limit !== undefined && (!Number.isSafeInteger(payload.limit) || payload.limit < 1 || payload.limit > 50)) throw new TypeError("role_log_page_budget");
  }
  return payload;
}

export class AgentControlDecision {
  constructor(options) {
    modelRecord(options, "AgentControlDecision", ["allowed", "reason", "requestId", "runId", "tool"]);
    if (typeof options.allowed !== "boolean") throw new TypeError("invalid_control_decision");
    this.allowed = options.allowed;
    for (const field of ["reason", "requestId", "runId", "tool"]) this[field] = modelString(options[field], field);
    if (!AgentControlTools.includes(this.tool)) throw new TypeError("invalid_control_tool");
    Object.freeze(this);
  }
}

export class AgentControlResult {
  constructor(options) {
    modelRecord(options, "AgentControlResult", ["requestId", "runId", "tool", "status", "reason", "payload"]);
    for (const field of ["requestId", "runId", "tool", "reason"]) this[field] = modelString(options[field], field);
    if (!AgentControlTools.includes(this.tool)) throw new TypeError("invalid_control_tool");
    if (!["completed", "denied", "cancelled", "stale", "error"].includes(options.status)) {
      throw new TypeError("invalid_control_status");
    }
    this.status = options.status;
    this.payload = controlPayload(options.payload ?? {});
    if (["legion_query_role_activity", "legion_query_role_log"].includes(this.tool) &&
        Buffer.byteLength(JSON.stringify(this.payload), "utf8") > 32768) throw new TypeError("role_query_result_budget");
    Object.freeze(this);
  }
}

export class PiToolResult {
  constructor(options) {
    modelRecord(options, "PiToolResult", ["requestId", "runId", "decision", "result"]);
    this.requestId = modelString(options.requestId, "requestId");
    this.runId = modelString(options.runId, "runId");
    const write = options.decision instanceof PolicyDecision && options.result instanceof MutationResult;
    const read = options.decision instanceof ProjectReadDecision && options.result instanceof ProjectReadResult;
    const check = options.decision instanceof CheckDecision && options.result instanceof CheckResult;
    const control = options.decision instanceof AgentControlDecision && options.result instanceof AgentControlResult;
    const shell=options.decision instanceof ShellDecision && options.result instanceof ShellResult;
    if (check || control || shell) {
      if (options.decision.requestId !== this.requestId || options.result.requestId !== this.requestId ||
          options.decision.runId !== this.runId || options.result.runId !== this.runId) {
        throw new TypeError("tool_result_identity_mismatch");
      }
      if (check && (options.decision.checkId !== options.result.checkId ||
          options.decision.authorizationDigest !== options.result.authorizationDigest)) {
        throw new TypeError("check_result_binding_mismatch");
      }
      if(shell && (options.decision.requestDigest!==options.result.requestDigest || (!options.decision.allowed && options.result.executed)))throw new TypeError("shell_result_binding_mismatch");
      if (control && options.decision.tool !== options.result.tool) throw new TypeError("control_result_tool_mismatch");
      if (check && !options.decision.allowed && options.result.executed) throw new TypeError("denied_check_cannot_execute");
      if (control && !options.decision.allowed && options.result.status === "completed") {
        throw new TypeError("denied_control_cannot_complete");
      }
    }
    if (!write && !read && !check && !control && !shell) {
      throw new TypeError("typed matching decision and result required");
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
