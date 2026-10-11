import { exactObject, DesktopValidationError } from '../../models/desktop.mjs';
/** Shared Host lease across CLI/Desktop processes. Production creates with no options:
 * fixed same-user private root; userDataDir is rejected. leaseRoot is only an isolated
 * trusted test-host override and MUST NOT be derived from CLI/userData/project data.
 * acquire(absoluteWorkspaceRoot), assertCurrent(opaqueHandle), release(handle), close().
 * Host holds the handle for all execution and owner-generation CAS; checks current
 * persisted owner mapping before each protected commit while still holding this lease.
 * No stale-lock reclamation: a crash leaves execution closed until operator recovery. */
export function projectLeaseOptions(options = {}) {
  exactObject(options, ['leaseRoot']);
  if (options.leaseRoot !== undefined && (typeof options.leaseRoot !== 'string' || !options.leaseRoot)) throw new DesktopValidationError();
  return Object.freeze({ leaseRoot: options.leaseRoot });
}
