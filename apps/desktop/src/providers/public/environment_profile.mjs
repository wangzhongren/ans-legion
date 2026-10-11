import { EnvironmentProfileProviderImpl } from '../impl/environment_profile.mjs';
export function createEnvironmentProfileProvider(options) {
  const provider = new EnvironmentProfileProviderImpl(options);
  return Object.freeze({ read: provider.read.bind(provider), resolve: provider.resolve.bind(provider), close: provider.close.bind(provider) });
}
