import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createAgentSession, createExtensionRuntime, ModelRuntime, SessionManager,
  SettingsManager } from "@earendil-works/pi-coding-agent";
import { InMemoryCredentialStore, Type } from "@earendil-works/pi-ai";
import { streamSimple as completionsStream } from "@earendil-works/pi-ai/api/openai-completions";
import { streamSimple as responsesStream } from "@earendil-works/pi-ai/api/openai-responses";
import { streamSimple as anthropicStream } from "@earendil-works/pi-ai/api/anthropic-messages";
import { PiSessionProvider } from "../abstract/pi_session.mjs";
import { modelRecord, modelString, PolicyDecision, MutationResult } from "../../../kernel/models/core.mjs";
import { AgentInstance, AgentScope, PiConnection, PiConnectionProfile, PiEventType, PiTextDelta,
  PiConversationHistory, PiConversationCheckpoint, PiToolRequest, PiToolResult, PiRunResult } from "../../../kernel/models/agent.mjs";
import { ProjectReadDecision, ProjectReadResult, AgentTools, AgentControlTools,
  AgentControlDecision, AgentControlResult } from "../../../kernel/models/agent.mjs";
import { ShellRequest, ShellDecision, ShellResult } from "../../../kernel/models/shell.mjs";
import { CheckDecision, CheckResult } from "../../../kernel/models/check.mjs";

const LIMITS = Object.freeze({ maxQueueEvents: 256, maxTextCharsPerTurn: 65536,
  maxOutputTokens: 8192, turnTimeoutMs: 180000 });
const STREAMS = Object.freeze({ "openai-completions": completionsStream,
  "openai-responses": responsesStream, "anthropic-messages": anthropicStream });
const WRITE_TOOLS = Object.freeze(["legion_write_file", "legion_edit_file"]);
const READ_TOOLS = Object.freeze(["legion_list_files", "legion_read_file"]);

// JSON Schema describes depth and local limits; PiToolRequest enforces the aggregate
// node/UTF-8 budgets and rejects getters, effects, credentials and caller claims.
function controlParameters() {
  const definitions = {};
  const forbidden = ["__proto__", "constructor", "prototype", "apiKey", "credentials", "token",
    "callerRoleId", "callerSessionId", "callerInstanceId"];
  for (let depth = 8; depth >= 0; depth -= 1) {
    const object = { type: "object", maxProperties: 4096,
      propertyNames: { not: { enum: forbidden } }, additionalProperties: false };
    const array = { type: "array", maxItems: 0 };
    if (depth < 8) {
      const child = { $ref: "#/properties/payload/$defs/value" + (depth + 1) };
      object.additionalProperties = child;
      array.items = child; array.maxItems = 4096;
    }
    definitions["value" + depth] = { anyOf: [{ type: "null" }, { type: "boolean" },
      { type: "number" }, { type: "string", maxLength: 65536 }, object, array] };
  }
  // Anthropic's SDK mapping preserves property schemas, but omits root $defs.
  const payload = { ...definitions.value0.anyOf[4], $defs: definitions };
  return Type.Unsafe({ type: "object", properties: { payload },
    required: ["payload"], additionalProperties: false });
}

function controlledTool(name, execute) {
  if (["legion_delegate_pm", "legion_query_role_activity", "legion_query_role_log"].includes(name)) {
    const id = Type.String({ minLength: 1, maxLength: 200 });
    const filters = { roleId: Type.Optional(id), taskId: Type.Optional(id),
      planDigest: Type.Optional(Type.String({ pattern: "^[a-f0-9]{64}$" })) };
    let payload = Type.Object(filters, { additionalProperties: false });
    let description = "Query actual role activity from the host using optional roleId/taskId/planDigest filters. Returns bounded current facts, not raw conversations or invented progress. Filters do not claim caller identity.";
    if (name === "legion_query_role_log") {
      payload = Type.Object({ ...filters, roleId: id, cursor: Type.Optional(Type.String({ minLength: 1, maxLength: 4096 })),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })) }, { additionalProperties: false });
      description = "Read one safe page of actual role action metadata using roleId and optional taskId/planDigest/cursor/limit (host default 20, maximum 50). The host binds the cursor snapshot and returns stale_cursor when changed. No raw assistant text, prompts, tool bodies, credentials or private memory; no log writes. Result budget is 32 KiB.";
    }
    if (name === "legion_delegate_pm") {
      const start = { action: Type.Literal("start"), instruction: Type.String({ minLength: 1, maxLength: 8192 }),
        sourceRefs: Type.Array(id, { maxItems: 32 }) };
      payload = Type.Union([
        Type.Object({ ...start, purpose: Type.Union([Type.Literal("plan"), Type.Literal("role_design")]) }, { additionalProperties: false }),
        Type.Object({ ...start, purpose: Type.Literal("repair"), acceptanceId: id, taskId: id }, { additionalProperties: false }),
        Type.Object({ action: Type.Literal("resume"), delegationId: id, humanAnswerRef: id }, { additionalProperties: false })
      ]);
      description = "Delegate to the background PM only through the host-bound customer Su channel. Start with purpose plan/role_design/repair, instruction and registered sourceRefs; repair also requires acceptanceId/taskId. Resume only with a host delegationId and actual humanAnswerRef. Never supply an answer/value or caller/profile/owner. needs_human means waiting, not task completion: use legion_request_interaction payload questionRef to present the host question unchanged. Only the host creates execute_plan confirmation and grants. Instruction limit is 8192 UTF-8 bytes, enforced by Model/host; this tool grants no mutation authority.";
    }
    return { name, label: "Legion host-bound Su control", description,
      parameters: Type.Object({ payload }, { additionalProperties: false }), executionMode: "sequential", execute };
  }
  if (name === "legion_request_shell") {
    return { name, label: "Legion PM reviewed project Shell",
      description: "Request this exact command for PM review. The host binds your task and runs it in an isolated copy, returning the final publication outcome. Shell exit zero is not a passed check.",
      parameters: Type.Object({ command: Type.String({ minLength: 1, maxLength: 65536 }),
        cwd: Type.Optional(Type.String()), reason: Type.String({ minLength: 1 }),
        generatedEffects: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { maxItems: 64 })),
        network: Type.Optional(Type.Union([Type.Literal("none"), Type.Literal("localhost"), Type.Literal("external")])),
        timeoutSeconds: Type.Optional(Type.Integer({ minimum: 1, maximum: 900 })) },
      { additionalProperties: false }), executionMode: "sequential", execute };
  }
  if (name === "legion_review_shell") {
    return { name, label: "Legion PM exact Shell review",
      description: "Approve or refuse the exact host request ID, digest and revision. Only the host validates this decision; approval text alone grants nothing.",
      parameters: Type.Object({ requestId: Type.String({ minLength: 1 }),
        requestDigest: Type.String({ pattern: "^[a-f0-9]{64}$" }),
        revision: Type.Integer({ minimum: 1, maximum: Number.MAX_SAFE_INTEGER }),
        approved: Type.Boolean(), reason: Type.String({ minLength: 1 }) },
      { additionalProperties: false }), executionMode: "sequential", execute };
  }
  if (name === "legion_run_check") {
    return { name, label: "Legion approved software check",
      description: "Request one approved check ID. The host validates the live task and returns real execution evidence.",
      parameters: Type.Object({ checkId: Type.String({ minLength: 1 }) },
        { additionalProperties: false }), executionMode: "sequential", execute };
  }
  if (AgentControlTools.includes(name)) {
    const descriptions = {
      legion_remember_fact: "Submit your own project fact addition, revision or retraction in payload: action (add/revise/retract), factId when revising, kind (pitfall/decision/preference), statement, sourceRefs and expectedRevision. The host binds the real author, validates registered sources and revision, and returns the actual fact status. This does not change file ownership or grant permission.",
      legion_query_memory: "Query effective project facts from all roles using payload kind (pitfall/decision/preference), cursor and limit when needed. The host binds the project and returns a bounded fact view with source labels; private summaries and credentials are excluded. This read does not authorize a fact revision or file change.",
      legion_submit_supervision: "Submit a supervision suggestion using payload phase, planDigest, findings (severity, taskIds, sourceRefs, reason) and recommendation. The host validates the real Supervisor, current plan and registered sources. Suggestions do not issue grants, alter ownership, execute tasks or mark tasks complete."
    };
    let description = "Submit bounded workflow data. The host binds the real caller, validates permissions and returns the actual outcome.";
    if (Object.hasOwn(descriptions, name)) description = descriptions[name];
    return { name, label: "Legion governed workflow", description,
      parameters: controlParameters(), executionMode: "sequential", execute };
  }
  if (name === "legion_write_file") {
    return { name, label: "Legion controlled write",
      description: "Propose text for a relative resource; the host checks and executes permissions.",
      parameters: Type.Object({ resource: Type.String({ minLength: 1 }), content: Type.String() },
        { additionalProperties: false }), executionMode: "sequential", execute };
  }
  if (name === "legion_edit_file") {
    return { name, label: "Legion controlled edit",
      description: "Propose exact text replacements for an existing project file using its full-file SHA-256. The host checks ownership, current content and permission before editing.",
      parameters: Type.Object({ resource: Type.String({ minLength: 1 }),
        expectedSha256: Type.String({ pattern: "^[a-f0-9]{64}$" }),
        replacements: Type.Array(Type.Object({ oldText: Type.String({ minLength: 1 }),
          newText: Type.String() }, { additionalProperties: false }), { minItems: 1, maxItems: 16 }) },
      { additionalProperties: false }), executionMode: "sequential", execute };
  }
  if (name === "legion_list_files") {
    return { name, label: "Legion project directory listing",
      description: "List one page of ordinary entries in the current project. Use an empty resource for the project root; the host checks the path and read permission.",
      parameters: Type.Object({ resource: Type.String(), cursor: Type.Optional(Type.String()),
        limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })) },
      { additionalProperties: false }), executionMode: "sequential", execute };
  }
  return { name, label: "Legion project text reading",
    description: "Read a bounded UTF-8 text segment from a project-relative file. Continue with nextLine until complete; the host checks the path and read permission.",
    parameters: Type.Object({ resource: Type.String({ minLength: 1 }),
      startLine: Type.Optional(Type.Integer({ minimum: 1 })),
      maxBytes: Type.Optional(Type.Integer({ minimum: 1, maximum: 65536 })) },
    { additionalProperties: false }), executionMode: "sequential", execute };
}

function emptyResources(systemPrompt) {
  const runtime = createExtensionRuntime();
  // All SDK discovery/extension hooks intentionally remain empty.
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => systemPrompt, getSystemPromptSource: () => undefined,
    getAppendSystemPrompt: () => [], getAppendSystemPromptSources: () => [],
    extendResources: () => {}, reload: async () => {},
  };
}
function abortError() { return new DOMException("pi_operation_cancelled", "AbortError"); }
function checkSignal(signal) {
  if (signal !== undefined && !(signal instanceof AbortSignal)) throw new TypeError("invalid_signal");
  signal?.throwIfAborted();
}
function literalKey(key) {
  modelString(key, "literal apiKey");
  if (key.startsWith("!") || key.includes("$")) throw new TypeError("literal_credentials_required");
  return key;
}
function safeModelError(message) {
  const text = String(message.errorMessage ?? "");
  if (/\b(401|403)\b|authentication_error|unauthorized|invalid.api.key/i.test(text)) return "pi_auth_error";
  if (/connection error|fetch failed|ECONN|EACCES|ENOTFOUND/i.test(text)) return "pi_network_error";
  if (/stream ended without|invalid json|unexpected.*response/i.test(text)) return "pi_protocol_error";
  return "pi_model_error";
}
function providerConfig(input) {
  modelRecord(input, "model provider", ["api", "baseUrl", "apiKey", "models", "streamSimple"]);
  const api = modelString(input.api, "provider api");
  const baseUrl = modelString(input.baseUrl, "provider baseUrl");
  const apiKey = literalKey(input.apiKey);
  if (!Array.isArray(input.models) || input.models.length === 0) throw new TypeError("models_required");
  if (typeof input.streamSimple !== "function") throw new TypeError("streamSimple_required");
  return { api, baseUrl, apiKey, models: structuredClone(input.models), streamSimple: input.streamSimple };
}
function plainConfig(connection, credentials, proxy) {
  if (!(connection instanceof PiConnectionProfile) || connection.provider !== proxy.provider ||
      connection.model !== proxy.model) throw new TypeError("typed_matching_connection_required");
  modelRecord(credentials, "private credentials", ["apiKey"]);
  const apiKey = literalKey(credentials.apiKey);
  // These defaults are SDK operational placeholders, never a price/capability claim.
  const metadata = connection.modelMetadata ?? {};
  const model = { id: connection.model, name: connection.model, reasoning: false, input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 32768,
    maxTokens: LIMITS.maxOutputTokens, ...structuredClone(metadata) };
  return { api: connection.protocol, baseUrl: connection.baseUrl, apiKey, models: [model],
    streamSimple: STREAMS[connection.protocol] };
}
function limits(input = {}) {
  modelRecord(input, "budgets", Object.keys(LIMITS));
  const result = { ...LIMITS, ...input };
  for (const key of Object.keys(LIMITS)) {
    if (!Number.isSafeInteger(result[key]) || result[key] < 1 || result[key] > LIMITS[key]) {
      throw new TypeError("invalid_pi_budget");
    }
  }
  if (result.maxQueueEvents < 2) throw new TypeError("invalid_pi_queue_budget");
  return Object.freeze(result);
}
function storedAssistant(text, model) {
  return { role: "assistant", content: [{ type: "text", text }], api: model.api,
    provider: model.provider, model: model.id, stopReason: "stop", timestamp: Date.now(),
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
}

export class _PiSessionProvider extends PiSessionProvider {
  #session;
  #unsubscribe;
  #sessionOptions;
  #instance;
  #profileId;
  #profileVersion;
  #tools = [];
  #lifecycle = "single_run";
  #limits = LIMITS;
  #history = new PiConversationHistory({ messages: [] });
  #state = "ready";
  #closed = false;
  #terminated = false;
  #runId;
  #runDone = false;
  #usedRuns = new Set();
  #runPromise;
  #cancelPromise;
  #turnCancelPromise;
  #closePromise;
  #restorePromise;
  #historyRestored = false;
  #cancelled = false;
  #failureCode = "";
  #queue = [];
  #waiters = [];
  #pending = new Map();
  #toolCalls = new Set();
  #toolResults = [];
  #assistantText = "";
  #deltaChars = 0;
  #modelError = "";
  #activeTimer;
  #activeStartedAt;
  #activeRemainingMs = 0;

  static async create(options) {
    const provider = new _PiSessionProvider();
    try {
      await provider.#initialize(options);
      Object.freeze(provider);
      return provider;
    } catch (error) {
      await provider.close();
      throw error;
    }
  }
  async #initialize(options) {
    modelRecord(options, "Pi provider options", ["instance", "proxy", "scope", "cwd", "modelProviders",
      "signal", "connection", "credentials", "lifecycle", "budgets"]);
    if (!(options.instance instanceof AgentInstance) || !(options.proxy instanceof PiConnection) ||
        !(options.scope instanceof AgentScope)) throw new TypeError("typed_pi_configuration_required");
    this.#instance = options.instance;
    this.#lifecycle = options.lifecycle ?? "single_run";
    if (!["single_run", "conversation"].includes(this.#lifecycle)) throw new TypeError("invalid_lifecycle");
    const conversation = this.#lifecycle === "conversation";
    const granted = options.scope.tools;
    if (granted.some((name) => !AgentTools.includes(name)) ||
        new Set(granted).size !== granted.length) throw new TypeError("unsupported_controlled_tool");
    if (granted.includes("legion_review_shell") && this.#instance.roleId !== "ProjectManager") {
      throw new TypeError("shell_review_requires_project_manager");
    }
    this.#limits = limits(options.budgets);
    if (conversation) {
      if (granted.some((name) => WRITE_TOOLS.includes(name)) || options.scope.write.length !== 0) {
        throw new TypeError("conversation_must_be_toolless");
      }
    } else {
      if (!granted.some((name) => WRITE_TOOLS.includes(name) || AgentControlTools.includes(name) ||
          name === "legion_run_check" || name === "legion_request_shell")) {
        throw new TypeError("only_controlled_write_tool_supported");
      }
    }
    this.#tools = AgentTools.filter((name) => granted.includes(name));
    const cwd = resolve(modelString(options.cwd, "cwd"));
    checkSignal(options.signal);
    const legacy = options.modelProviders !== undefined;
    const plain = options.connection !== undefined || options.credentials !== undefined;
    if (legacy === plain) throw new TypeError("connection_inputs_must_be_exclusive");
    let config;
    if (plain) {
      config = plainConfig(options.connection, options.credentials, options.proxy);
      this.#profileId = options.connection.profileId;
      this.#profileVersion = options.connection.profileVersion;
    } else {
      const providers = options.modelProviders;
      if (providers === null || typeof providers !== "object" || Array.isArray(providers) ||
          !Object.hasOwn(providers, options.proxy.provider)) throw new TypeError("unknown_model_provider");
      config = providerConfig(providers[options.proxy.provider]);
      this.#profileId = "legacy:" + options.proxy.provider + "/" + options.proxy.model;
      this.#profileVersion = this.#instance.organizationVersion;
    }
    if (!config.models.some((model) => model.id === options.proxy.model)) throw new TypeError("unknown_model");
    {
      const originalStream = config.streamSimple;
      const budget = this.#limits;
      config.streamSimple = (model, context, input) => originalStream(model, context, {
        ...input, maxTokens: budget.maxOutputTokens, maxRetries: 0,
        timeoutMs: Math.max(1, Math.ceil(this.#remainingActiveBudget())) });
    }
    const credentials = new InMemoryCredentialStore();
    await credentials.modify(options.proxy.provider, async () => ({ type: "api_key", key: config.apiKey }));
    checkSignal(options.signal);
    const modelRuntime = await ModelRuntime.create({ credentials, modelsPath: null,
      refreshOnCreate: false, allowModelNetwork: false });
    checkSignal(options.signal);
    modelRuntime.registerProvider(options.proxy.provider, config);
    const model = modelRuntime.getModel(options.proxy.provider, options.proxy.model);
    if (model === undefined) throw new TypeError("unknown_model");
    const settingsManager = SettingsManager.inMemory({ compaction: { enabled: false },
      retry: { enabled: false }, cacheWarming: "off" });
    let systemPrompt = "Discuss the current request using only granted Legion tools.";
    if (this.#tools.length === 0) systemPrompt = "Discuss requirements without tools or file access.";
    if (this.#tools.some((name) => WRITE_TOOLS.includes(name))) {
      systemPrompt += " Propose changes only to your current role-owned exact files using granted write or edit tools.";
    }
    if (this.#tools.some((name) => READ_TOOLS.includes(name))) {
      systemPrompt += " Use granted Legion read tools to inspect ordinary files in the current project. " +
        "Reading does not authorize writing. A denied read gives no file content.";
    }
    if (this.#tools.some((name) => AgentControlTools.includes(name) || name === "legion_run_check")) {
      systemPrompt += " Use only granted Legion workflow tools. The host determines your identity and approval; " +
        "report only its real outcomes. A check takes only an approved checkId; control tools take only payload.";
    }
    systemPrompt += " Current role-owned exact files supplied by the host: " + JSON.stringify(options.scope.write) +
      ". Denied scope: " + JSON.stringify(options.scope.deny) + ". Granted tools for this task: " + JSON.stringify(this.#tools) +
      ". The host enforces current ownership and permissions; identity claims never grant authority. " +
      "Memory and supervision tools return control results and do not change file ownership or grant source permissions.";
    if (this.#tools.includes("legion_delegate_pm")) {
      systemPrompt += " PM delegation is an internal request, not execution approval. Report awaiting_human/failed/stale accurately. " +
        "For a host questionRef use legion_request_interaction without rewriting the question; resume only with a real host humanAnswerRef. " +
        "Only the host presents and accepts Human execute_plan confirmation.";
    }
    if (this.#tools.includes("legion_query_role_activity") || this.#tools.includes("legion_query_role_log")) {
      systemPrompt += " Explain role status and logs only from host facts and safe action metadata. " +
        "Refresh stale cursors; never infer progress percentages or treat control completed as development completion.";
    }
    const tools = this.#tools;
    const customTools = tools.map((name) => controlledTool(name,
      (toolCallId, parameters, signal) => this.#executeTool(name, toolCallId, parameters, signal)));
    this.#sessionOptions = { cwd, agentDir: cwd, model, modelRuntime, thinkingLevel: "off",
      resourceLoader: emptyResources(systemPrompt), settingsManager, tools,
      excludeTools: ["mcp__*", "codemode", "tool_search"], customTools };
    await this.#createSession(this.#history, options.signal);
  }
  async #createSession(history, signal) {
    const manager = SessionManager.inMemory(this.#sessionOptions.cwd);
    for (const message of history.messages) {
      if (message.role === "user") {
        manager.appendMessage({ role: "user", content: message.text, timestamp: Date.now() });
      } else manager.appendMessage(storedAssistant(message.text, this.#sessionOptions.model));
    }
    const created = await createAgentSession({ ...this.#sessionOptions, sessionManager: manager });
    const session = created.session;
    this.#session = session;
    const expected = this.#sessionOptions.tools;
    for (const actual of [session.getActiveToolNames(), session.getCallableToolNames(),
      session.getAllTools().map((tool) => tool.name)]) {
      if (actual.length !== expected.length || actual.some((name) => !expected.includes(name))) {
        throw new TypeError("unexpected_sdk_tool_loadout");
      }
    }
    checkSignal(signal);
    if (this.#closed || this.#terminated) throw abortError();
  }
  #observe(event) {
    if (this.#runId === undefined || this.#closed || this.#runDone) return;
    if (event.type === "message_end" && event.message.role === "assistant") {
      const text = [];
      for (const block of event.message.content) {
        if (block.type === "text") text.push(block.text);
        if ((this.#lifecycle === "conversation" || block.name === "legion_request_shell" ||
            AgentControlTools.includes(block.name)) && block.type === "toolCall" && !this.#tools.includes(block.name)) {
          this.#failTurn("pi_unexpected_tool_call");
        }
      }
      const value = text.join("");
      if (value.length > this.#limits.maxTextCharsPerTurn) {
        this.#failTurn("pi_text_budget");
      } else this.#assistantText = value;
      if (event.message.stopReason === "error") this.#modelError = safeModelError(event.message);
      if (event.message.stopReason === "aborted") this.#modelError = "pi_model_aborted";
      if (event.message.stopReason === "length") this.#modelError = "pi_model_error";
    }
    if (this.#lifecycle === "conversation" && !this.#cancelled && this.#failureCode === "" &&
        event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      const text = event.assistantMessageEvent.delta;
      this.#deltaChars += text.length;
      if (this.#deltaChars > this.#limits.maxTextCharsPerTurn) this.#failTurn("pi_text_budget");
      else this.#enqueue(Object.freeze({ type: PiEventType.TEXT_DELTA,
        delta: new PiTextDelta({ runId: this.#runId, text }) }));
    }
    if (["agent_start", "tool_execution_start", "tool_execution_end", "agent_settled"].includes(event.type) &&
        !this.#cancelled && this.#failureCode === "") {
      this.#enqueue(Object.freeze({ type: PiEventType.RUN_EVENT, runId: this.#runId, eventType: event.type }));
    }
  }
  #failTurn(code) {
    if (this.#failureCode !== "" || this.#runDone) return;
    this.#failureCode = code;
    this.#pauseActiveBudget();
    this.#settlePending(abortError());
    // Schedule abort outside the synchronous SDK event delivery; no upward callback.
    queueMicrotask(() => {
      this.#session?.abort().catch(() => { this.#failureCode = "pi_abort_failed"; });
    });
  }
  #enqueue(event, terminal = false) {
    const waiter = this.#waiters.shift();
    if (waiter !== undefined) { waiter.detach(); waiter.resolve(event); return; }
    if (!terminal) {
      if (event.type === PiEventType.TEXT_DELTA) {
        const previous = this.#queue.at(-1);
        if (previous?.type === PiEventType.TEXT_DELTA && previous.delta.runId === event.delta.runId) {
          this.#queue[this.#queue.length - 1] = Object.freeze({ type: PiEventType.TEXT_DELTA,
            delta: new PiTextDelta({ runId: event.delta.runId, text: previous.delta.text + event.delta.text }) });
          return;
        }
      }
      if (this.#queue.length >= this.#limits.maxQueueEvents - 1) { this.#failTurn("pi_queue_budget"); return; }
    }
    this.#queue.push(event);
  }
  async #executeTool(tool, toolCallId, parameters, signal) {
    if (this.#closed || this.#state !== "running" || this.#cancelled || !this.#tools.includes(tool)) throw abortError();
    modelString(toolCallId, "toolCallId");
    checkSignal(signal);
    if (this.#toolCalls.has(toolCallId)) throw new TypeError("duplicate_tool_call");
    const request = new PiToolRequest({ requestId: randomUUID(), runId: this.#runId,
      toolCallId, tool, parameters });
    this.#toolCalls.add(toolCallId);
    return await new Promise((resolveResult, rejectResult) => {
      const pending = { resolve: resolveResult, reject: rejectResult, detach: () => {} };
      const onAbort = () => {
        if (this.#pending.delete(request)) {
          pending.detach(); this.#resumeActiveBudget(); rejectResult(abortError());
        }
      };
      pending.detach = () => signal?.removeEventListener("abort", onAbort);
      this.#pending.set(request, pending);
      this.#pauseActiveBudget();
      signal?.addEventListener("abort", onAbort, { once: true });
      this.#enqueue(Object.freeze({ type: PiEventType.TOOL_REQUEST, request }));
    });
  }
  start_run(runId, prompt) {
    if (this.#closed || this.#terminated || !["ready", "idle"].includes(this.#state)) {
      throw new TypeError("pi_instance_not_ready");
    }
    modelString(runId, "runId"); modelString(prompt, "prompt");
    if (this.#lifecycle === "single_run" && this.#runId !== undefined) throw new TypeError("pi_instance_not_ready");
    if (this.#usedRuns.has(runId)) throw new TypeError("run_id_reused");
    if (this.#queue.length !== 0 || this.#waiters.length !== 0) throw new TypeError("previous_run_events_pending");
    if (this.#lifecycle === "conversation") {
      if (prompt.length > this.#limits.maxTextCharsPerTurn || this.#history.messages.length >= 255) {
        throw new TypeError("history_or_prompt_budget");
      }
      this.#history = new PiConversationHistory({ messages: [...this.#history.messages, { role: "user", text: prompt }] });
    }
    this.#usedRuns.add(runId);
    this.#runId = runId; this.#runDone = false; this.#cancelled = false; this.#failureCode = "";
    this.#modelError = ""; this.#assistantText = ""; this.#deltaChars = 0; this.#toolResults = [];
    this.#toolCalls.clear();
    this.#turnCancelPromise = undefined;
    this.#state = "running";
    // Bind each SDK listener to its originating run. Unsubscription alone cannot guard an already queued listener.
    this.#unsubscribe = this.#session.subscribe((event) => {
      if (this.#runId === runId && !this.#runDone) this.#observe(event);
    });
    this.#runPromise = this.#run(prompt);
  }
  async #run(prompt) {
    let status = "completed"; let errorCode = "";
    this.#activeRemainingMs = this.#limits.turnTimeoutMs;
    this.#resumeActiveBudget();
    try {
      await this.#session.prompt(prompt, { expandPromptTemplates: false });
      await this.#session.waitForIdle();
      if (this.#modelError !== "") { status = "failed"; errorCode = this.#modelError; }
    } catch (error) {
      status = "failed"; errorCode = "pi_run_failed";
      if (error?.name === "AbortError") errorCode = "pi_model_aborted";
    } finally { this.#pauseActiveBudget(); }
    if (this.#cancelled) { status = "cancelled"; errorCode = "pi_run_cancelled"; }
    if (this.#failureCode !== "") { status = "failed"; errorCode = this.#failureCode; }
    this.#settlePending(abortError());
    if (this.#lifecycle === "conversation" && status === "completed") {
      try {
        this.#history = new PiConversationHistory({ messages: [...this.#history.messages,
          { role: "assistant", text: this.#assistantText }] });
      } catch (error) { status = "failed"; errorCode = "pi_history_budget"; }
    }
    if (this.#lifecycle === "single_run" || this.#terminated || this.#closed) {
      try { this.#dispose(); } catch (error) { status = "failed"; errorCode = "pi_cleanup_failed"; }
      this.#state = status;
    } else {
      this.#unsubscribe?.(); this.#unsubscribe = undefined;
      this.#state = "idle";
    }
    this.#runDone = true;
    const result = new PiRunResult({ runId: this.#runId, status, assistantText: this.#assistantText,
      toolResults: this.#toolResults, errorCode });
    let type = PiEventType.RUN_FINISHED;
    if (status === "failed") type = PiEventType.RUN_FAILED;
    if (status === "cancelled") type = PiEventType.RUN_CANCELLED;
    this.#enqueue(Object.freeze({ type, result }), true);
  }
  #dispose() {
    this.#unsubscribe?.(); this.#unsubscribe = undefined;
    const session = this.#session; this.#session = undefined;
    session?.dispose();
  }
  #remainingActiveBudget() {
    if (this.#activeStartedAt === undefined) return this.#activeRemainingMs;
    return Math.max(0, this.#activeRemainingMs - (performance.now() - this.#activeStartedAt));
  }
  #pauseActiveBudget() {
    this.#activeRemainingMs = this.#remainingActiveBudget();
    clearTimeout(this.#activeTimer);
    this.#activeTimer = undefined; this.#activeStartedAt = undefined;
  }
  #resumeActiveBudget() {
    if (this.#activeStartedAt !== undefined || this.#pending.size > 0 ||
        this.#closed || this.#cancelled || this.#failureCode !== "" || this.#state !== "running") return;
    if (this.#activeRemainingMs <= 0) { this.#failTurn("pi_turn_timeout"); return; }
    this.#activeStartedAt = performance.now();
    this.#activeTimer = setTimeout(() => this.#failTurn("pi_turn_timeout"), this.#activeRemainingMs);
  }
  #settlePending(error) {
    for (const pending of this.#pending.values()) { pending.detach(); pending.reject(error); }
    this.#pending.clear();
    this.#queue = this.#queue.filter((event) => event.type !== PiEventType.TOOL_REQUEST);
  }
  async next_event(runId, { signal } = {}) {
    if (runId !== this.#runId || this.#runId === undefined) throw new TypeError("unknown_run");
    if (this.#closed) throw new TypeError("pi_instance_closed");
    checkSignal(signal);
    if (this.#queue.length > 0) return this.#queue.shift();
    if (this.#runDone) throw new TypeError("run_events_exhausted");
    if (this.#waiters.length !== 0) throw new TypeError("one_event_consumer_required");
    return await new Promise((resolveEvent, rejectEvent) => {
      const waiter = { resolve: resolveEvent, reject: rejectEvent, detach: () => {} };
      const onAbort = () => {
        const index = this.#waiters.indexOf(waiter);
        if (index !== -1) this.#waiters.splice(index, 1);
        waiter.detach(); rejectEvent(abortError());
      };
      waiter.detach = () => signal?.removeEventListener("abort", onAbort);
      this.#waiters.push(waiter); signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
  respond_tool(request, result) {
    const pending = this.#pending.get(request);
    let matching = false;
    if (request instanceof PiToolRequest && result instanceof PiToolResult && this.#tools.includes(request.tool)) {
      if (WRITE_TOOLS.includes(request.tool)) {
        matching = result.decision instanceof PolicyDecision && result.result instanceof MutationResult &&
          result.decision.proposalDigest === result.result.proposalDigest &&
          result.result.resource === request.parameters.resource;
      } else if (READ_TOOLS.includes(request.tool) &&
          result.decision instanceof ProjectReadDecision && result.result instanceof ProjectReadResult) {
        matching = result.result.resource === request.parameters.resource &&
          (result.decision.allowed || result.result.status === "denied") &&
          (result.result.status === "denied" ||
            (request.tool === "legion_list_files" && result.result.status === "listed") ||
            (request.tool === "legion_read_file" && result.result.status === "read"));
      } else if (request.tool === "legion_request_shell") {
        const shell = new ShellRequest({ requestId: request.requestId, runId: request.runId,
          ...request.parameters });
        matching = result.decision instanceof ShellDecision && result.result instanceof ShellResult &&
          result.decision.requestDigest === shell.digest && result.result.requestDigest === shell.digest &&
          result.result.status !== "ready_for_publication";
      } else if (request.tool === "legion_run_check") {
        matching = result.decision instanceof CheckDecision && result.result instanceof CheckResult &&
          result.decision.checkId === request.parameters.checkId && result.result.checkId === request.parameters.checkId;
      } else if (AgentControlTools.includes(request.tool)) {
        matching = result.decision instanceof AgentControlDecision && result.result instanceof AgentControlResult &&
          result.decision.tool === request.tool && result.result.tool === request.tool;
      }
    }
    if (this.#closed || this.#cancelled || this.#state !== "running" || pending === undefined ||
        !(request instanceof PiToolRequest) || !(result instanceof PiToolResult) ||
        request.runId !== this.#runId || result.runId !== request.runId || result.requestId !== request.requestId ||
        !matching) throw new TypeError("invalid_or_late_tool_response");
    this.#pending.delete(request); pending.detach(); this.#toolResults.push(result);
    this.#resumeActiveBudget();
    const details = { decision: result.decision, result: result.result };
    pending.resolve({ content: [{ type: "text", text: JSON.stringify(details) }], details });
  }
  get_history() {
    if (this.#lifecycle !== "conversation" || this.#closed) throw new TypeError("conversation_history_unavailable");
    return this.#history;
  }
  async restore_history(checkpoint) {
    const conversationRestore = this.#lifecycle === "conversation" &&
      ["ready", "idle"].includes(this.#state);
    const singleRunRestore = this.#lifecycle === "single_run" && this.#state === "ready" &&
      this.#runId === undefined && this.#usedRuns.size === 0 && !this.#historyRestored;
    if (this.#closed || this.#terminated || (!conversationRestore && !singleRunRestore) ||
        this.#queue.length !== 0 || this.#waiters.length !== 0 || this.#pending.size !== 0) {
      if (this.#lifecycle === "conversation") throw new TypeError("conversation_not_idle");
      throw new TypeError("single_run_history_restore_unavailable");
    }
    if (!(checkpoint instanceof PiConversationCheckpoint) ||
        Object.keys(this.#instance).some((key) => checkpoint.instance[key] !== this.#instance[key]) ||
        checkpoint.profileId !== this.#profileId || checkpoint.profileVersion !== this.#profileVersion) {
      throw new TypeError("history_binding_mismatch");
    }
    this.#state = "restoring";
    this.#restorePromise = this.#restoreHistory(checkpoint.history);
    return await this.#restorePromise;
  }
  async #restoreHistory(history) {
    this.#dispose();
    try {
      await this.#createSession(history);
      if (this.#closed || this.#terminated) { this.#dispose(); throw abortError(); }
      this.#history = history;
      if (this.#lifecycle === "single_run") this.#historyRestored = true;
      this.#state = this.#lifecycle === "single_run" ? "ready" : "idle";
    } catch (error) {
      this.#terminated = true; this.#dispose(); this.#state = "failed"; throw error;
    }
  }
  cancel_turn(runId) {
    if (this.#closed || this.#terminated || this.#lifecycle !== "conversation" ||
        runId !== this.#runId || this.#runId === undefined) return Promise.reject(new TypeError("invalid_turn_cancel"));
    if (this.#turnCancelPromise === undefined) this.#turnCancelPromise = this.#abortTurn();
    return this.#turnCancelPromise;
  }
  async #abortTurn() {
    if (this.#runDone) return;
    this.#cancelled = true; this.#state = "cancelling"; this.#settlePending(abortError());
    try { await this.#session?.abort(); }
    finally { await this.#runPromise; }
  }
  cancel() {
    if (this.#cancelPromise === undefined) this.#cancelPromise = this.#cancelInstance();
    return this.#cancelPromise;
  }
  async #cancelInstance() {
    this.#terminated = true;
    try {
      await this.#abortTurn();
      try { await this.#restorePromise; }
      catch (error) { if (error?.name !== "AbortError") throw error; }
    }
    finally { this.#dispose(); if (this.#runId === undefined) this.#state = "cancelled"; }
  }
  close() {
    if (this.#closePromise === undefined) this.#closePromise = this.#close();
    return this.#closePromise;
  }
  async #close() {
    this.#closed = true;
    try { await this.cancel(); }
    finally {
      try { this.#dispose(); }
      finally {
        this.#queue.length = 0; this.#toolCalls.clear();
        for (const waiter of this.#waiters.splice(0)) { waiter.detach(); waiter.reject(abortError()); }
      }
    }
  }
}

