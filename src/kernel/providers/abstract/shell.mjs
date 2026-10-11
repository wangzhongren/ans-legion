/** Shell infrastructure receives opaque lower authority, never business callbacks. */
export class ShellProviderError extends Error {}
export class ShellProvider {
  constructor() { if (new.target === ShellProvider) throw new TypeError("abstract_shell_provider"); }
  static assert(value) {
    if (!(value instanceof ShellProvider) || ["observeTime", "prepare","acquire","run","readCandidate","release","close"].some((name) => typeof value[name] !== "function")) throw new TypeError("invalid_shell_provider");
    return value;
  }
}
