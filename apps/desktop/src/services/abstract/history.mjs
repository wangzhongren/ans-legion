import {
  exactObject
} from '../../models/desktop.mjs';
import {
  WorkbenchValidationError
} from '../../models/workbench.mjs';
/** load({projectId,workspaceIdentity}), save({projectId,workspaceIdentity,history}); no permits, pending plans, credentials or tool envelopes. */
export function historyServiceOptions(options) {
  exactObject(options, ['userDataDir']);
  if (typeof options.userDataDir !== 'string' || !options.userDataDir) throw new WorkbenchValidationError();
  return Object.freeze({
    userDataDir: options.userDataDir
  });
}
