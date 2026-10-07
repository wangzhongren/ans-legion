import { PiSessionProvider } from "../abstract/pi_session.mjs";
import { _PiSessionProvider } from "../impl/pi_session.mjs";

export { PiSessionProvider };
/** Own Provider contract; all real SDK capabilities remain private. */
export async function createPiSessionProvider(options) {
  return PiSessionProvider.assert(await _PiSessionProvider.create(options));
}
