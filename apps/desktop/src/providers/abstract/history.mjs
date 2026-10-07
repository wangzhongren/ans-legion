import {
  exactObject
} from '../../models/desktop.mjs';
import {
  WorkbenchValidationError
} from '../../models/workbench.mjs';
/** Typed text history only; project identity is private host data used to isolate storage. */
export function historyProviderOptions(options) {
  exactObject(options, ['userDataDir']);
  if (typeof options.userDataDir !== 'string' || !options.userDataDir) throw new WorkbenchValidationError();
  return Object.freeze({
    userDataDir: options.userDataDir
  });
}
