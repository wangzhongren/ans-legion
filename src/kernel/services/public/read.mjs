import { ReadService } from "../abstract/read.mjs";
import { _ReadService } from "../impl/read.mjs";
export { ReadService };
export function createReadService(options) { return new _ReadService(options); }
