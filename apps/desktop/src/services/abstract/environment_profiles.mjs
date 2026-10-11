import { exactObject, profileFields, DesktopValidationError } from '../../models/desktop.mjs';
/** Profiles-compatible headless capability: list, assign, resolveConnection, getProbeState, close.
 * A single immutable process profile serves any role; unknown profile IDs fail closed.
 * save/delete are read-only failures; probes require the existing explicit probe workflow.
 * env is a trusted host environment source, never a model/renderer/project-provided object. */
export function environmentProfilesOptions(options) {
  exactObject(options, ['profileId', 'name', 'protocol', 'provider', 'modelId', 'baseUrl', 'env']);
  profileFields({ id: options.profileId ?? 'environment', name: options.name ?? 'Environment', protocol: options.protocol, provider: options.provider, modelId: options.modelId, baseUrl: options.baseUrl });
  if (options.env !== undefined && (!options.env || typeof options.env !== 'object' || Array.isArray(options.env))) throw new DesktopValidationError();
  return options;
}
