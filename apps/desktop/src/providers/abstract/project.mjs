import {
  exactObject
} from '../../models/desktop.mjs';
import {
  WorkbenchValidationError
} from '../../models/workbench.mjs';
/** Private host effects: catalog read and digest-CAS write under a userData lock, root identity,
 * branded bounded context read, IDs/time. No Service business callback or controller.
 * ownerSource(project) describes source directory identity; assertOwnerSource(project,true)
 * binds a 0600/wx immutable physical-workspace marker. executionContext(root) returns
 * PRIVATE holder nonce/native identities. All v2 writes lock commit mutex before catalog
 * lock. Migrating v1 first saves exact old bytes before binding marker and atomic CAS.
 * leaseRoot is a trusted fixture override only. No nonce is serialized in catalog/DTO.
 */
export function projectProviderOptions(options) {
  exactObject(options, ['userDataDir', 'leaseRoot']);
  if (typeof options.userDataDir !== 'string' || !options.userDataDir) throw new WorkbenchValidationError();
  if(options.leaseRoot!==undefined&&(typeof options.leaseRoot!=='string'||!options.leaseRoot))throw new WorkbenchValidationError();
  return Object.freeze({
    userDataDir: options.userDataDir, leaseRoot: options.leaseRoot
  });
}
