/** Isolated execution infrastructure; receives already validated authorization data, never host callbacks. */
export class CheckProviderError extends Error {}
export class CheckProvider {
  constructor() { if (new.target === CheckProvider) throw new TypeError("abstract_check_provider"); }
  static assert(value) {
    if (!(value instanceof CheckProvider) || ["run", "notExecuted", "close"].some((name) => typeof value[name] !== "function")) {
      throw new TypeError("invalid_check_provider");
    }
    return value;
  }
}
