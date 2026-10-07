import { randomUUID } from 'node:crypto';
import { normalizeContext } from '@earendil-works/pi-ai';
import { streamSimple as completions } from '@earendil-works/pi-ai/api/openai-completions';
import { streamSimple as responses } from '@earendil-works/pi-ai/api/openai-responses';
import { streamSimple as messages } from '@earendil-works/pi-ai/api/anthropic-messages';
import { probeOptions } from '../abstract/probe.mjs';
import { exactObject, profileDTO, textValue, probeDTO, success, failure, safeError, validationFailure } from '../../models/desktop.mjs';

function fixedProtocol(protocol) {
  switch (protocol) {
    case 'openai-completions': return completions;
    case 'openai-responses': return responses;
    case 'anthropic-messages': return messages;
    default: return null;
  }
}

function errorCode(message) {
  if (typeof message === 'string' && /(?:\b401\b|\b403\b|unauthorized|authentication|invalid.api.key)/iu.test(message)) return 'probe_authentication';
  return 'probe_failed';
}

export class ProbeProviderImpl {
  #timeout;
  #active = null;
  #closed = false;
  #state = probeDTO({ status: 'idle' });
  constructor(options) { this.#timeout = probeOptions(options).timeoutMs; }
  state() { return this.#state; }
  cancel(probeId) {
    if (!this.#active || this.#active.id !== probeId) return failure('not_found');
    this.#active.reason = 'probe_cancelled';
    this.#active.controller.abort();
    return success(null);
  }
  close() {
    this.#closed = true;
    if (this.#active) this.cancel(this.#active.id);
    return success(null);
  }

  async run(input) {
    if (this.#closed) return failure('closed');
    if (this.#active) return failure('probe_busy');
    let profile;
    let apiKey;
    try {
      exactObject(input, ['profile', 'apiKey']);
      profile = profileDTO(input.profile);
      apiKey = textValue(input.apiKey, 'apiKey', 8192);
    } catch (error) { return validationFailure(error); }
    const id = randomUUID();
    const start = Date.now();
    const startedAt = new Date(start).toISOString();
    const controller = new AbortController();
    const active = { id, controller, reason: null };
    this.#active = active;
    this.#state = probeDTO({ id, profileId: profile.id, status: 'running', startedAt });
    let finishAbort;
    const aborted = new Promise((resolve) => { finishAbort = resolve; });
    const onAbort = () => finishAbort({ stopReason: 'aborted' });
    controller.signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => {
      active.reason = 'probe_timeout';
      controller.abort();
    }, this.#timeout);
    let code = null;
    try {
      // Probe-only metadata: deliberately not a model capability/cost claim.
      const model = { id: profile.modelId, name: 'Desktop connection probe', api: profile.protocol, provider: 'desktop-probe', baseUrl: profile.baseUrl, reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 8192, maxTokens: 16, compat: { supportsStore: false, supportsFinishReason: true, supportsDeveloperRole: false } };
      const context = normalizeContext({ messages: [{ role: 'user', content: 'Reply OK.', timestamp: start }], tools: [] });
      const stream = fixedProtocol(profile.protocol);
      const result = await Promise.race([stream(model, context, { apiKey, signal: controller.signal, timeoutMs: this.#timeout, maxTokens: 16, maxRetries: 0, cacheRetention: 'none', toolChoice: 'none' }).result(), aborted]);
      if (active.reason) code = active.reason;
      else if (result.stopReason === 'aborted') code = 'probe_cancelled';
      else if (result.stopReason === 'error') code = errorCode(result.errorMessage);
      else if (!['stop', 'length'].includes(result.stopReason) || !Array.isArray(result.content) || !result.content.some((block) => block.type === 'text' && typeof block.text === 'string' && block.text.trim())) code = 'probe_protocol';
    } catch (error) {
      code = active.reason;
      if (!code) code = errorCode(error?.message);
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', onAbort);
      this.#active = null;
    }
    let status = 'success';
    let error = null;
    if (code) { status = 'failed'; error = safeError(code); }
    if (code === 'probe_cancelled') status = 'cancelled';
    const finish = Date.now();
    this.#state = probeDTO({ id, profileId: profile.id, status, startedAt, finishedAt: new Date(finish).toISOString(), latencyMs: finish - start, error });
    return success(this.#state);
  }
}
