import { DesktopValidationError, exactObject } from '../../models/desktop.mjs';

/**
 * observe({assignments,force}) returns bounded workbench observation with 4096
 * audit records and observedAt/verifiedAt/cached source timestamps. Compatibility
 * refresh({assignments,force}) returns the old 300-audit DTO or explicit overflow.
 * Business capability: refresh({assignments: AssignmentDTO[]}) returns only a
 * WorkspaceDTO; state() returns the last projected snapshot; close() is safe to
 * repeat. Pipeline supplies saved assignments, never a peer-Service callback.
 * Governance acceptance, task record state and runtime audit remain separate.
 * Individual unavailable sources are retained explicitly. A stale preserved
 * snapshot is marked status=unavailable with its old lastValidAt and new
 * observedAt. This existing Model representation makes no liveness claim.
 */
export function workspaceServiceOptions(options) {
  exactObject(options, ['workspaceRoot']);
  if (typeof options.workspaceRoot !== 'string' || !options.workspaceRoot) throw new DesktopValidationError();
  return Object.freeze({ workspaceRoot: options.workspaceRoot });
}
