import { lstat, mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { settingsOptions } from '../abstract/settings.mjs';
import { LIMITS, emptySettings, settingsDocument, success, failure, textValue } from '../../models/desktop.mjs';

async function electronEncryption() {
  const electron = await import('electron');
  return electron.safeStorage;
}

/** Internal implementation export is for focused infrastructure tests only. */
export class SettingsProviderImpl {
  #directory;
  #file;
  #encryption;
  constructor(options, encryptionSource = electronEncryption) {
    const checked = settingsOptions(options);
    if (!isAbsolute(checked.userDataDir)) throw new TypeError('userDataDir must be absolute');
    this.#directory = checked.userDataDir;
    this.#file = join(this.#directory, 'desktop-settings.json');
    this.#encryption = encryptionSource;
  }
  newId() { return randomUUID(); }

  async read() {
    try {
      const info = await lstat(this.#file);
      if (!info.isFile() || info.isSymbolicLink() || info.size > LIMITS.fileBytes) return failure('settings_corrupt');
      const content = await readFile(this.#file, 'utf8');
      try { return success(settingsDocument(JSON.parse(content))); }
      catch { return failure('settings_corrupt'); }
    } catch (error) {
      if (error.code === 'ENOENT') {
        try {
          const directory = await lstat(this.#directory);
          if (!directory.isDirectory() || directory.isSymbolicLink()) return failure('settings_unavailable');
        } catch (directoryError) {
          if (directoryError.code !== 'ENOENT') return failure('settings_unavailable');
        }
        return success(emptySettings());
      }
      return failure('settings_unavailable');
    }
  }

  async write(document) {
    let data;
    try { data = JSON.stringify(settingsDocument(document)); }
    catch { return failure('settings_corrupt'); }
    const temporary = join(this.#directory, `.desktop-settings-${randomUUID()}.tmp`);
    try {
      await mkdir(this.#directory, { recursive: true });
      try {
        const info = await lstat(this.#file);
        if (!info.isFile() || info.isSymbolicLink()) return failure('settings_unavailable');
      } catch (error) {
        if (error.code !== 'ENOENT') return failure('settings_unavailable');
      }
      await writeFile(temporary, data, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
      await rename(temporary, this.#file);
      return success(null);
    } catch {
      try { await unlink(temporary); }
      catch (cleanupError) {
        if (cleanupError.code !== 'ENOENT') return failure('settings_unavailable');
      }
      return failure('settings_unavailable');
    }
  }

  async #crypto() {
    try {
      const encryption = await this.#encryption();
      if (!encryption || !encryption.isEncryptionAvailable()) return failure('encryption_unavailable');
      return { ok: true, value: encryption };
    } catch { return failure('encryption_unavailable'); }
  }

  async encryptKey(apiKey) {
    let key;
    try { key = textValue(apiKey, 'apiKey', 8192); }
    catch { return failure('invalid_input', 'apiKey'); }
    const crypto = await this.#crypto();
    if (!crypto.ok) return crypto;
    try {
      const encrypted = crypto.value.encryptString(key);
      if (!Buffer.isBuffer(encrypted) || encrypted.length === 0 || encrypted.length > 24576) return failure('encryption_failed');
      return success(encrypted.toString('base64'));
    } catch { return failure('encryption_failed'); }
  }

  async decryptKey(ciphertext) {
    if (ciphertext === null) return failure('key_required');
    if (typeof ciphertext !== 'string' || ciphertext.length === 0 || ciphertext.length > 32768 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(ciphertext)) return failure('decryption_failed');
    const crypto = await this.#crypto();
    if (!crypto.ok) return crypto;
    try {
      const key = crypto.value.decryptString(Buffer.from(ciphertext, 'base64'));
      return success(textValue(key, 'apiKey', 8192));
    } catch { return failure('decryption_failed'); }
  }
}
