import { PolicyService } from "../abstract/policy.mjs";
import { _PolicyService } from "../impl/policy.mjs";
export { PolicyService };
export function createPolicyService() { return new _PolicyService(); }
