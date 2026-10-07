import { profilesOptions } from '../abstract/profiles.mjs';
import { ProfilesServiceImpl } from '../impl/profiles.mjs';

export function createProfilesService(options) {
  const service = new ProfilesServiceImpl(profilesOptions(options));
  return Object.freeze({ list: service.list.bind(service), save: service.save.bind(service), delete: service.delete.bind(service), assign: service.assign.bind(service), resolveConnection: service.resolveConnection.bind(service), testConnection: service.testConnection.bind(service), cancelProbe: service.cancelProbe.bind(service), getProbeState: service.getProbeState.bind(service), close: service.close.bind(service) });
}
