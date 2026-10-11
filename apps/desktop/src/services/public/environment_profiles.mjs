import { EnvironmentProfilesServiceImpl } from '../impl/environment_profiles.mjs';
export function createEnvironmentProfilesService(options) {
  const service = new EnvironmentProfilesServiceImpl(options);
  return Object.freeze({ list: service.list.bind(service), assign: service.assign.bind(service), resolveConnection: service.resolveConnection.bind(service), save: service.save.bind(service), delete: service.delete.bind(service), testConnection: service.testConnection.bind(service), cancelProbe: service.cancelProbe.bind(service), getProbeState: service.getProbeState.bind(service), close: service.close.bind(service) });
}
