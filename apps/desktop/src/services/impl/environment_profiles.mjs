import { environmentProfilesOptions } from '../abstract/environment_profiles.mjs';
import { createEnvironmentProfileProvider } from '../../providers/public/environment_profile.mjs';
import { PiConnectionProfile } from 'legion-runtime/workbench-models';
import { success, failure, profilesDTO, probeDTO, assignmentDTO, identifier, validationFailure } from '../../models/desktop.mjs';
export class EnvironmentProfilesServiceImpl {
  #provider; #assignments = []; #closed = false;
  constructor(options) { this.#provider = createEnvironmentProfileProvider(environmentProfilesOptions(options)); }
  async list() {
    const result = this.#provider.read();
    if (!result.ok) return result;
    return success(profilesDTO({ profiles: [result.value.profile], assignments: this.#assignments }));
  }
  async resolveConnection(profileId) {
    try { identifier(profileId, 'profileId'); } catch (error) { return validationFailure(error); }
    const result = this.#provider.resolve(profileId);
    if (!result.ok) return result;
    const { profile, profileVersion, credentials } = result.value;
    return success({ connection: new PiConnectionProfile({ profileId: profile.id, profileVersion, protocol: profile.protocol, provider: profile.provider, model: profile.modelId, baseUrl: profile.baseUrl }), credentials });
  }
  async assign(raw) {
    if (this.#closed) return failure('closed');
    let input;
    try {
      if (raw.profileId === null) input = assignmentDTO({ ...raw, profileId: 'environment' });
      else input = assignmentDTO(raw);
    } catch (error) { return validationFailure(error); }
    if (raw.profileId !== null) {
      const result = this.#provider.resolve(input.profileId);
      if (!result.ok) return result;
    }
    this.#assignments = this.#assignments.filter((item) => item.projectId !== input.projectId || item.roleId !== input.roleId);
    if (raw.profileId !== null) this.#assignments.push(input);
    return this.list();
  }
  save() { return Promise.resolve(failure('profile_read_only')); }
  delete() { return Promise.resolve(failure('profile_read_only')); }
  testConnection() { return Promise.resolve(failure('unknown_operation')); }
  cancelProbe() { return failure('not_found'); }
  getProbeState() { return success(probeDTO({ status: 'idle' })); }
  close() { this.#closed = true; this.#assignments = []; return this.#provider.close(); }
}
