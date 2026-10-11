import { organizationProviderOptions } from '../abstract/organization.mjs';
import { OrganizationProviderImpl } from '../impl/organization.mjs';
/** Public write forwards the optional AbortSignal unchanged to the atomic commit owner. */
export function createOrganizationProvider(options) {
  const provider = new OrganizationProviderImpl(organizationProviderOptions(options));
  return Object.freeze(Object.fromEntries(['read', 'write', 'snapshotInputs', 'inventory', 'shellConfiguration', 'appendShellArchive', 'checkConfiguration', 'close'].map((name) => [name, provider[name].bind(provider)])));
}
