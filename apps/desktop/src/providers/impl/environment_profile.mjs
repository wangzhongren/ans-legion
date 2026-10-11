import { randomUUID, createHash } from 'node:crypto';
import { environmentProfileOptions, environmentKey } from '../abstract/environment_profile.mjs';
import { profileDTO, success, failure } from '../../models/desktop.mjs';
export class EnvironmentProfileProviderImpl {
  #profile; #apiKey; #version; #closed = false;
  constructor(options) {
    const checked = environmentProfileOptions(options);
    const env = checked.env ?? process.env;
    this.#apiKey = environmentKey(env);
    this.#profile = profileDTO({ ...checked, hasSavedKey: true });
    // Random credential generation binds a process without persisting a key hash.
    this.#version = createHash('sha256').update(JSON.stringify([this.#profile, randomUUID()])).digest('hex');
  }
  read() {
    if (this.#closed) return failure('closed');
    return success({ profile: this.#profile, profileVersion: this.#version });
  }
  resolve(profileId) {
    if (this.#closed) return failure('closed');
    if (profileId !== this.#profile.id) return failure('not_found');
    return success({ profile: this.#profile, profileVersion: this.#version, credentials: { apiKey: this.#apiKey } });
  }
  close() { this.#closed = true; this.#apiKey = null; return success(null); }
}
