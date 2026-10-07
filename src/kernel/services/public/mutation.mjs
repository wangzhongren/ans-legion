import { MutationService, MutationError } from "../abstract/mutation.mjs";
import { _MutationService } from "../impl/mutation.mjs";
export { MutationService, MutationError };
export function createMutationService(options) { return new _MutationService(options); }
