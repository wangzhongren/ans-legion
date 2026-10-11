/** Project Shell: host-owned deferred request/review, final typed publication only.
 * Both lifecycles support active budgets paused during host waits; cancel rejects pending.
 * No execution permit, binary body, or SDK native Shell is exposed. */
import { PiAgentService } from "../abstract/pi_agent.mjs";
import { _PiAgentService } from "../impl/pi_agent.mjs";

export { PiAgentService };
/** Own Service contract; scope selects controlled tools, including workflow/check tools.
 * Plain connection/credentials or legacy modelProviders are mutually exclusive. */
export async function createPiAgentService(options) {
  return PiAgentService.assert(await _PiAgentService.create(options));
}
