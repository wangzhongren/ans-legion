/** Project Shell: host-owned deferred request/review, final typed publication only.
 * Both lifecycles support active budgets paused during host waits; cancel rejects pending.
 * No execution permit, binary body, or SDK native Shell is exposed. */
import { PiAgentService } from "../abstract/pi_agent.mjs";
import { createPiSessionProvider } from "../../providers/public/pi_session.mjs";
import { PiEventType, PiToolRequest, PiRunResult, PiTextDelta, PiConversationHistory } from "../../../kernel/models/agent.mjs";

export class _PiAgentService extends PiAgentService {
  #provider;
  constructor(provider) {
    super();
    this.#provider = provider;
    Object.freeze(this);
  }
  static async create(options) { return new _PiAgentService(await createPiSessionProvider(options)); }
  start_run(runId, prompt) { return this.#provider.start_run(runId, prompt); }
  async next_event(runId, options) {
    const event = await this.#provider.next_event(runId, options);
    if (!Object.isFrozen(event) || !Object.values(PiEventType).includes(event.type)) {
      throw new TypeError("invalid_pi_event");
    }
    if (event.type === PiEventType.TOOL_REQUEST &&
        (!(event.request instanceof PiToolRequest) || event.request.runId !== runId)) {
      throw new TypeError("invalid_pi_request");
    }
    if (event.type === PiEventType.TEXT_DELTA &&
        (!(event.delta instanceof PiTextDelta) || event.delta.runId !== runId)) {
      throw new TypeError("invalid_pi_delta");
    }
    if ([PiEventType.RUN_FINISHED, PiEventType.RUN_FAILED, PiEventType.RUN_CANCELLED].includes(event.type) &&
        (!(event.result instanceof PiRunResult) || event.result.runId !== runId)) {
      throw new TypeError("invalid_pi_run_result");
    }
    return event;
  }
  respond_tool(request, result) { return this.#provider.respond_tool(request, result); }
  cancel_turn(runId) { return this.#provider.cancel_turn(runId); }
  get_history() {
    const history = this.#provider.get_history();
    if (!(history instanceof PiConversationHistory)) throw new TypeError("invalid_pi_history");
    return history;
  }
  restore_history(checkpoint) { return this.#provider.restore_history(checkpoint); }
  cancel() { return this.#provider.cancel(); }
  close() { return this.#provider.close(); }
}
