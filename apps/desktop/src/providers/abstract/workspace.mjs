import { DesktopValidationError, exactObject } from '../../models/desktop.mjs';

/**
 * Read-only capability: read({force:false}) -> Result<finite workspace source records>.
 * Task documents <=16MiB/4096 fully checked events; refresh <=64MiB.
 * Cache reuses only fully verified task chain/rendering at identical dev/ino,
 * size, mtime and ctime; manual force re-reads SHA chain. Source observedAt is
 * distinct from verifiedAt; cached does not imply a fresh hash verification.
 * Plain workspaceRoot is supplied by the main-process project selection only.
 * Reads fixed project/current organization, declared role/card/boundary files,
 * direct scheduling Markdown entries and bounded event index/daily references.
 * No recursive scan, arbitrary file request, process/permission mutation.
 * Missing optional task/audit records are explicit sources; malformed or linked
 * inputs return unavailable records, never assumed-success or online status.
 */
export function workspaceOptions(options) {
  exactObject(options, ['workspaceRoot']);
  if (typeof options.workspaceRoot !== 'string' || !options.workspaceRoot || options.workspaceRoot.length > 32767) throw new DesktopValidationError();
  return Object.freeze({ workspaceRoot: options.workspaceRoot });
}
