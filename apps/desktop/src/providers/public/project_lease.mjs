import { ProjectLeaseProviderImpl } from '../impl/project_lease.mjs';
export function createProjectLeaseProvider(options = {}) {
  const provider = new ProjectLeaseProviderImpl(options);
  return Object.freeze({ acquire: provider.acquire.bind(provider), assertCurrent: provider.assertCurrent.bind(provider), release: provider.release.bind(provider), close: provider.close.bind(provider) });
}
