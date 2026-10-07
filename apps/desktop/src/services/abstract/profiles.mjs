import { DesktopValidationError, exactObject } from '../../models/desktop.mjs';

/**
 * Profiles business capability: list(), save(profileInput), delete(profileId),
 * assign({projectId,roleId,profileId|null}), testConnection(profileId),
 * cancelProbe(probeId), getProbeState(), close(). Public results contain only
 * profile/assignment/probe DTOs. Role existence is supplied by Workspace in the
 * Pipeline; this Service never calls a peer Service or changes organization.
 * resolveConnection(profileId) is main-process private: typed PiConnectionProfile,
 * deterministic stored-fields profileVersion and decrypted credentials. Settings
 * format is unchanged; no secrets are present in list()/save() DTOs.
 * @typedef {{list:Function,save:Function,delete:Function,assign:Function,resolveConnection:Function,testConnection:Function,cancelProbe:Function,getProbeState:Function,close:Function}} ProfilesCapability
 */
export function profilesOptions(options) {
  exactObject(options, ['userDataDir', 'probeTimeoutMs']);
  if (typeof options.userDataDir !== 'string' || !options.userDataDir) throw new DesktopValidationError();
  let probeTimeoutMs = options.probeTimeoutMs;
  if (probeTimeoutMs === undefined) probeTimeoutMs = 10000;
  if (!Number.isInteger(probeTimeoutMs) || probeTimeoutMs < 50 || probeTimeoutMs > 30000) throw new DesktopValidationError();
  return Object.freeze({ userDataDir: options.userDataDir, probeTimeoutMs });
}
