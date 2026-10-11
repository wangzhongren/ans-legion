import { ShellService } from "../abstract/shell.mjs";
import { _ShellService } from "../impl/shell.mjs";
export { ShellService };
export function createShellService(options) { return new _ShellService(options); }
