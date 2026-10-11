import { exactObject, profileFields, textValue } from '../../models/desktop.mjs';
/** Trusted Host only. Read LEGION_API_KEY once; never write it, log it, or expose it in list DTOs.
 * read() returns non-secret profile + random process credential generation.
 * resolve(profileId) returns credentials only to the adjacent Service; close() erases references. */
export function environmentProfileOptions(options) {
  exactObject(options, ['profileId', 'name', 'protocol', 'provider', 'modelId', 'baseUrl', 'env']);
  const fields = profileFields({ id: options.profileId ?? 'environment', name: options.name ?? 'Environment', protocol: options.protocol, provider: options.provider, modelId: options.modelId, baseUrl: options.baseUrl });
  if (options.env !== undefined) {
    if (!options.env || typeof options.env !== 'object' || Array.isArray(options.env)) throw new TypeError('Invalid environment source');
  }
  return { ...fields, env: options.env };
}
export function environmentKey(env) { return textValue(env.LEGION_API_KEY, 'apiKey', 8192); }
