/** One trusted instance's Pi lifecycle and immutable queue contract. */
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
