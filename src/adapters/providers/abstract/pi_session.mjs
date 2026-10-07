/** Infrastructure contract: own queue and deferred tools, never Kernel callbacks. */
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
