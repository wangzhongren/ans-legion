/** Project Shell: host-owned deferred request/review, final typed publication only.
 * Both lifecycles support active budgets paused during host waits; cancel rejects pending.
 * No execution permit, binary body, or SDK native Shell is exposed. */
/** One trusted instance's Pi lifecycle, immutable typed queue and deferred host responses.
 * Supports read, mutation, check and control results; a fresh single_run may restore one
 * typed plain-text checkpoint before start_run. Cancellation releases host waits. */
export class PiAgentService {
  constructor() {
    if (new.target === PiAgentService) throw new TypeError("abstract_pi_service");
  }
  static assert(value) {
    if (!(value instanceof PiAgentService)) throw new TypeError("invalid_pi_service");
    for (const method of ["start_run", "next_event", "respond_tool", "cancel_turn", "get_history", "restore_history", "cancel", "close"]) {
      if (typeof value[method] !== "function") throw new TypeError("missing_service_method");
    }
    return value;
  }
}
