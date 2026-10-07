import { PiAgentService } from "../abstract/pi_agent.mjs";
import { _PiAgentService } from "../impl/pi_agent.mjs";

export { PiAgentService };
/** Own Service contract; plain connection/credentials or legacy modelProviders are mutually exclusive. */
export async function createPiAgentService(options) {
  return PiAgentService.assert(await _PiAgentService.create(options));
}
