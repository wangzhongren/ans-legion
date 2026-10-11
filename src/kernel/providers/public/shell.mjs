import { ShellProvider, ShellProviderError } from "../abstract/shell.mjs";
import { _MacOSShellProvider } from "../impl/shell.mjs";
export { ShellProvider, ShellProviderError };
export function createShellProvider(options) { return new _MacOSShellProvider(options); }
