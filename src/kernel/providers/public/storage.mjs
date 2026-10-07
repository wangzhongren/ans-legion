import { StorageProvider, StorageError } from "../abstract/storage.mjs";
import { _LocalStorageProvider } from "../impl/storage.mjs";
export { StorageProvider, StorageError };
export function createStorageProvider(options) { return new _LocalStorageProvider(options); }
