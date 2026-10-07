import {
  exactObject
} from '../../models/desktop.mjs';
import {
  WorkbenchValidationError
} from '../../models/workbench.mjs';
/** Private host effects: catalog read/write, root identity, branded bounded context read, IDs/time. No controller/callback. */
export function projectProviderOptions(options) {
  exactObject(options, ['userDataDir']);
  if (typeof options.userDataDir !== 'string' || !options.userDataDir) throw new WorkbenchValidationError();
  return Object.freeze({
    userDataDir: options.userDataDir
  });
}
