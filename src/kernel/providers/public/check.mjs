import { CheckProvider, CheckProviderError } from "../abstract/check.mjs";
import { _MacOSCheckProvider } from "../impl/check.mjs";
export { CheckProvider, CheckProviderError };
export function createCheckProvider(options) { return new _MacOSCheckProvider(options); }
