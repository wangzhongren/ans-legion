import {
  exactObject
} from '../../models/desktop.mjs';
import {
  WorkbenchValidationError
} from '../../models/workbench.mjs';
/** Host-only catalog(), select(root), saveProject(private document), setDefaultProfile(id), readContext(branded input), newId/now/close. */
export function projectServiceOptions(options) {
  exactObject(options, ['userDataDir']);
  if (typeof options.userDataDir !== 'string' || !options.userDataDir) throw new WorkbenchValidationError();
  return Object.freeze({
    userDataDir: options.userDataDir
  });
}
