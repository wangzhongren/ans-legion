/** Project Shell: host-owned deferred request/review, final typed publication only.
 * Both lifecycles support active budgets paused during host waits; cancel rejects pending.
 * No execution permit, binary body, or SDK native Shell is exposed. */
/** Own SDK queue, typed deferred results, bounded conversation budget and plain history restore.
 * Conversation checkpoints restore while idle; one single_run checkpoint is allowed before its first run.
 * Host waits pause conversation time; cancel/close settle pending. No host permission callbacks. */
export class PiSessionProvider {
  constructor() {
    if (new.target === PiSessionProvider) throw new TypeError("abstract_pi_provider");
  }
  static assert(value) {
    if (!(value instanceof PiSessionProvider)) throw new TypeError("invalid_pi_provider");
    for (const method of ["start_run", "next_event", "respond_tool", "cancel_turn", "get_history", "restore_history", "cancel", "close"]) {
      if (typeof value[method] !== "function") throw new TypeError("missing_provider_method");
    }
    return value;
  }
}
