/** Inference-only fixture: real Pi owns Sessions, loop and tool execution. */
import assert from "node:assert/strict";
import { createFauxCore, fauxAssistantMessage, fauxToolCall } from "@earendil-works/pi-ai";

export function controlledTool(resource, content, id = "tool-call") {
  return fauxAssistantMessage(fauxToolCall("legion_write_file", { resource, content }, { id }), { stopReason: "toolUse" });
}

export function createControlledModel(scripts, provider = "controlled-integration") {
  const api = "faux-legion-integration";
  const metadata = createFauxCore({ api, provider, models: [{ id: "offline" }], tokensPerSecond: 0 });
  const calls = [];
  const sessions = new Map();
  const models = metadata.models.map(({ id, name, reasoning, input, cost, contextWindow, maxTokens }) =>
    ({ id, name, reasoning, input, cost, contextWindow, maxTokens }));
  const config = {
    provider, api, baseUrl: "https://legion.invalid", apiKey: "integration-fixture-credential", models,
    streamSimple(model, context, options) {
      assert.equal(typeof options?.sessionId, "string", "actual SDK session routing ID required");
      assert.ok(options.sessionId.length > 0);
      const optionKeys = Object.keys(options);
      for (const forbidden of ["runtime", "submit", "writeFile", "permit", "authority"]) {
        assert.ok(!optionKeys.includes(forbidden));
      }
      let state = sessions.get(options.sessionId);
      if (state === undefined) {
        const user = context.messages.find((message) => message.role === "user");
        assert.ok(user, "actual Pi transcript must contain its prompt");
        const userText = JSON.stringify(user.content);
        const markers = Object.keys(scripts).filter((marker) => userText.includes(marker));
        assert.equal(markers.length, 1, "first prompt selects one finite independent script");
        const marker = markers[0];
        const core = createFauxCore({ api, provider, models: [{ id: "offline" }], tokensPerSecond: 0 });
        core.setResponses([...scripts[marker]]);
        state = { marker, core, calls: 0 };
        sessions.set(options.sessionId, state);
      }
      state.calls += 1;
      calls.push(Object.freeze({ sessionId: options.sessionId, marker: state.marker, provider: model.provider,
        modelId: model.id, optionKeys: Object.freeze(optionKeys), transcript: JSON.stringify(context) }));
      return state.core.streamSimple(model, context, options);
    },
  };
  return Object.freeze({ config, calls, sessions });
}

/** Test-owned response barrier. No Runtime, filesystem or execution callback enters inference. */
export function createResponseBarrier(message) {
  let entered;
  let released;
  let waiting;
  const started = new Promise((resolve) => { entered = resolve; });
  const gate = new Promise((resolve) => { released = resolve; });
  return Object.freeze({
    started,
    release: () => released(),
    async response(context, options) {
      entered();
      const signal = options?.signal;
      signal?.throwIfAborted();
      waiting = new Promise((resolve, reject) => {
        const aborted = () => reject(new DOMException("controlled_model_aborted", "AbortError"));
        signal?.addEventListener("abort", aborted, { once: true });
        gate.then(() => { signal?.removeEventListener("abort", aborted); resolve(); });
      });
      await waiting;
      signal?.throwIfAborted();
      return message;
    },
  });
}

export { fauxAssistantMessage, fauxToolCall };
