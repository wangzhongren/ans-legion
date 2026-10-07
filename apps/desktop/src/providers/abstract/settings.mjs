import { DesktopValidationError, exactObject } from '../../models/desktop.mjs';

/**
 * Settings capability: read/write a validated encrypted document; encryptKey and
 * decryptKey are main-process-only operations. Every operation returns Result.
 * Missing storage is empty; corrupt storage and unavailable encryption differ.
 * Public creation accepts plain options only, never injected infrastructure.
 * @typedef {{read: Function, write: Function, encryptKey: Function, decryptKey: Function, newId: Function}} SettingsCapability
 */
export function settingsOptions(options) {
  exactObject(options, ['userDataDir']);
  if (typeof options.userDataDir !== 'string' || !options.userDataDir || options.userDataDir.length > 32767) throw new DesktopValidationError();
  return Object.freeze({ userDataDir: options.userDataDir });
}
