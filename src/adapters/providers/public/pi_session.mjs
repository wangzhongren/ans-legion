/** Project Shell: host-owned deferred request/review, final typed publication only.
 * Both lifecycles support active budgets paused during host waits; cancel rejects pending.
 * No execution permit, binary body, or SDK native Shell is exposed. */
import { PiSessionProvider } from "../abstract/pi_session.mjs";
import { _PiSessionProvider } from "../impl/pi_session.mjs";

export { PiSessionProvider };
/** Own Provider contract; scope-selected AgentTools and SDK capabilities remain private. */
export async function createPiSessionProvider(options) {
  return PiSessionProvider.assert(await _PiSessionProvider.create(options));
}
