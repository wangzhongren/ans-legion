export class StorageError extends Error {}
/** Infrastructure contract; public factories have no execution authority by default. */
export class StorageProvider {
  constructor() { if (new.target === StorageProvider) throw new TypeError("abstract_storage_provider"); }
  static assert(value) {
    const methods = ["write", "appendEvents", "readEvents", "readFile", "createIdentity", "workspace", "close"];
    if (!(value instanceof StorageProvider) || methods.some((method) => typeof value[method] !== "function")) {
      throw new TypeError("invalid_storage_provider");
    }
    return value;
  }
}
