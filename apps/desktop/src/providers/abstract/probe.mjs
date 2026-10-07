import { DesktopValidationError, exactObject } from '../../models/desktop.mjs';

/**
 * Probe capability: run({profile, apiKey}) -> sanitized Result<ProbeDTO>;
 * state(), cancel(probeId), close(). Single active request, total deadline,
 * no tools/retries, no SDK output or key in results. close is idempotent.
 * @typedef {{run: Function, state: Function, cancel: Function, close: Function}} ProbeCapability
 */
export function probeOptions(options = {}) {
  exactObject(options, ['timeoutMs']);
  let timeoutMs = options.timeoutMs;
  if (timeoutMs === undefined) timeoutMs = 10000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 30000) throw new DesktopValidationError();
  return Object.freeze({ timeoutMs });
}
