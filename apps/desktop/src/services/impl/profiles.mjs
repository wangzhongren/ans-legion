import { profilesOptions } from '../abstract/profiles.mjs';
import { createSettingsProvider } from '../../providers/public/settings.mjs';
import { createProbeProvider } from '../../providers/public/probe.mjs';
import { LIMITS, profileInput, profileDTO, profilesDTO, probeDTO, projectIdentifier, identifier, exactObject, settingsDocument, success, failure, validationFailure } from '../../models/desktop.mjs';
import { PiConnectionProfile } from 'legion-runtime/workbench-models';
import { profileVersion } from '../../models/workbench.mjs';

function providerFailure(result) { return failure(result.error?.code, result.error?.field); }

/** Lower-layer doubles are accepted only by focused internal tests. */
export class ProfilesServiceImpl {
  #settings;
  #probe;
  #tail = Promise.resolve();
  #closed = false;
  constructor(options, providers = null) {
    const checked = profilesOptions(options);
    if (providers) {
      this.#settings = providers.settings;
      this.#probe = providers.probe;
    } else {
      this.#settings = createSettingsProvider({ userDataDir: checked.userDataDir });
      this.#probe = createProbeProvider({ timeoutMs: checked.probeTimeoutMs });
    }
  }

  async list() {
    await this.#tail;
    if (this.#closed) return failure('closed');
    try {
      const read = await this.#settings.read();
      if (!read.ok) return providerFailure(read);
      return success(profilesDTO(settingsDocument(read.value)));
    } catch { return failure('internal_error'); }
  }

  #mutate(action) {
    const pending = this.#tail.then(async () => {
      if (this.#closed) return failure('closed');
      try {
        const read = await this.#settings.read();
        if (!read.ok) return providerFailure(read);
        return await action(settingsDocument(read.value));
      } catch (error) { return validationFailure(error); }
    });
    this.#tail = pending.then(() => undefined);
    return pending;
  }

  save(raw) {
    let input;
    try { input = profileInput(raw); }
    catch (error) { return Promise.resolve(validationFailure(error)); }
    return this.#mutate(async (document) => {
      let old = null;
      if (input.id !== null) {
        old = document.profiles.find((profile) => profile.id === input.id);
        if (!old) return failure('not_found');
      }
      if (!old && document.profiles.length >= LIMITS.profiles) return failure('profile_limit');
      let id = input.id;
      let keyCiphertext = null;
      if (old) keyCiphertext = old.keyCiphertext;
      if (id === null) id = this.#settings.newId();
      if (input.keyAction === 'clear') keyCiphertext = null;
      if (input.keyAction === 'replace') {
        const encrypted = await this.#settings.encryptKey(input.apiKey);
        if (!encrypted.ok) return providerFailure(encrypted);
        keyCiphertext = encrypted.value;
      }
      const profile = { id, name: input.name, protocol: input.protocol, provider: input.provider, modelId: input.modelId, baseUrl: input.baseUrl, keyCiphertext };
      if (input.imageCapability !== undefined) profile.imageCapability = input.imageCapability;
      const profiles = document.profiles.filter((item) => item.id !== id);
      profiles.push(profile);
      const written = await this.#settings.write(settingsDocument({ schemaVersion: 1, profiles, assignments: document.assignments }));
      if (!written.ok) return providerFailure(written);
      return success(profileDTO(profile));
    });
  }

  delete(profileId) {
    try { identifier(profileId, 'profileId'); }
    catch (error) { return Promise.resolve(validationFailure(error)); }
    return this.#mutate(async (document) => {
      if (!document.profiles.some((profile) => profile.id === profileId)) return failure('not_found');
      const updated = settingsDocument({ schemaVersion: 1, profiles: document.profiles.filter((profile) => profile.id !== profileId), assignments: document.assignments.filter((assignment) => assignment.profileId !== profileId) });
      const result = await this.#settings.write(updated);
      if (!result.ok) return providerFailure(result);
      return success(profilesDTO(updated));
    });
  }

  assign(raw) {
    let projectId;
    let roleId;
    let profileId = null;
    try {
      exactObject(raw, ['projectId', 'roleId', 'profileId']);
      projectId = projectIdentifier(raw.projectId);
      roleId = identifier(raw.roleId, 'roleId');
      if (raw.profileId !== null) profileId = identifier(raw.profileId, 'profileId');
    } catch (error) { return Promise.resolve(validationFailure(error)); }
    return this.#mutate(async (document) => {
      if (profileId !== null && !document.profiles.some((profile) => profile.id === profileId)) return failure('not_found');
      const assignments = document.assignments.filter((item) => item.projectId !== projectId || item.roleId !== roleId);
      if (profileId !== null) assignments.push({ projectId, roleId, profileId });
      const updated = settingsDocument({ ...document, assignments });
      const result = await this.#settings.write(updated);
      if (!result.ok) return providerFailure(result);
      return success(profilesDTO(updated));
    });
  }

  /** Main-process private capability. Never forward this result to renderer/history. */
  async resolveConnection(profileId) {
    try {
      identifier(profileId); await this.#tail; if (this.#closed) return failure('closed');
      const read = await this.#settings.read(); if (!read.ok) return providerFailure(read);
      const stored = settingsDocument(read.value).profiles.find((item) => item.id === profileId); if (!stored) return failure('not_found');
      const decrypted = await this.#settings.decryptKey(stored.keyCiphertext); if (!decrypted.ok) return providerFailure(decrypted);
      if (this.#closed) return failure('closed');
      const metadata = { input: ['text'] }; if (stored.imageCapability === 'supported') metadata.input.push('image');
      return success({ connection: new PiConnectionProfile({ profileId: stored.id, profileVersion: profileVersion(stored), protocol: stored.protocol, provider: stored.provider, model: stored.modelId, baseUrl: stored.baseUrl, modelMetadata: metadata }), credentials: { apiKey: decrypted.value } });
    } catch (error) { return validationFailure(error); }
  }
  async testConnection(profileId) {
    try { identifier(profileId, 'profileId'); }
    catch (error) { return validationFailure(error); }
    await this.#tail;
    if (this.#closed) return failure('closed');
    try {
      const read = await this.#settings.read();
      if (!read.ok) return providerFailure(read);
      const document = settingsDocument(read.value);
      const profile = document.profiles.find((item) => item.id === profileId);
      if (!profile) return failure('not_found');
      const decrypted = await this.#settings.decryptKey(profile.keyCiphertext);
      if (!decrypted.ok) return providerFailure(decrypted);
      if (this.#closed) return failure('closed');
      const result = await this.#probe.run({ profile: profileDTO(profile), apiKey: decrypted.value });
      if (!result.ok) return providerFailure(result);
      return success(probeDTO(result.value));
    } catch { return failure('internal_error'); }
  }

  cancelProbe(probeId) {
    try {
      identifier(probeId, 'probeId');
      const result = this.#probe.cancel(probeId);
      if (!result.ok) return providerFailure(result);
      return success(null);
    } catch (error) { return validationFailure(error); }
  }
  getProbeState() {
    try { return success(probeDTO(this.#probe.state())); }
    catch { return failure('internal_error'); }
  }
  close() {
    this.#closed = true;
    try {
      const result = this.#probe.close();
      if (!result.ok) return providerFailure(result);
      return success(null);
    } catch { return failure('internal_error'); }
  }
}
