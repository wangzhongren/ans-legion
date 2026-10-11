import {
  exactObject
} from '../../models/desktop.mjs';
import {
  WorkbenchValidationError
} from '../../models/workbench.mjs';
/** Host-only catalog(), select(root), saveProject(private document), setDefaultProfile(id),
 * readContext(branded input), newId/now/close. Every catalog mutation supplies the read digest
 * to Provider for locked compare-and-swap; Service keeps business decisions.
 * acquireExecution(project) returns PRIVATE pure leaseContext; releaseExecution(project)
 * is called only after all owned Mutation/Check/Shell instances drain. assertExecution
 * verifies the original handle and immutable owner-source binding. ownerSource describes
 * the Human-visible physical catalog source; migrationPending reports a readonly v1 view.
 * saveProject options confirmMigration/bindOwnerSource are trusted Host-only: only the
 * CURRENT actual Human execute_plan true may set them, after displaying the exit statement.
 * leaseRoot is only a trusted isolated test-host override, never product CLI userData.
 */
export function projectServiceOptions(options) {
  exactObject(options, ['userDataDir', 'leaseRoot']);
  if (typeof options.userDataDir !== 'string' || !options.userDataDir) throw new WorkbenchValidationError();
  if(options.leaseRoot!==undefined&&(typeof options.leaseRoot!=='string'||!options.leaseRoot))throw new WorkbenchValidationError();
  return Object.freeze({
    userDataDir: options.userDataDir, leaseRoot: options.leaseRoot
  });
}
