import { CheckService } from "../abstract/check.mjs";
import { _CheckService } from "../impl/check.mjs";
export { CheckService };
export function createCheckService(options) { return new _CheckService(options); }
