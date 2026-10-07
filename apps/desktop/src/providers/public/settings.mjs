import { settingsOptions } from '../abstract/settings.mjs';
import { SettingsProviderImpl } from '../impl/settings.mjs';

export function createSettingsProvider(options) {
  const provider = new SettingsProviderImpl(settingsOptions(options));
  return Object.freeze({ read: provider.read.bind(provider), write: provider.write.bind(provider), encryptKey: provider.encryptKey.bind(provider), decryptKey: provider.decryptKey.bind(provider), newId: provider.newId.bind(provider) });
}
