import { exactObject } from '../../models/desktop.mjs';
/** PM timeline/queue and isolated non-PM member event journals commit together with CAS; History is only an SDK text projection.
 * beginMemberRun/appendMemberEvent/finishMemberRun bind project/role/task/instance/run and whitelist metadata, never prompts or read/file bodies. saveRoleMemory(project,{roleId,expectedRevision,summary,covered,messages,sourceDigest,updatedAt},actor,signal) verifies current validated sources and entry revision under original document CAS; no raw tools/authorization/checkpoint enters the public DTO. Trusted actors are supplied separately by the host. No payload can authorize itself. */
export function organizationServiceOptions(value) { exactObject(value, ['userDataDir']); if (typeof value.userDataDir !== 'string' || !value.userDataDir) throw new TypeError('user_data_required'); return Object.freeze({ userDataDir: value.userDataDir }); }

/** Host-only Shell ledger/review/claim/output/recovery and inventory/configuration operations; renderer has only finite getState facts. Recovery requires a different Human-confirmed plan and current baselines, never old permits. */

/** previewRetainedRecovery(project) is readonly Human disclosure; retainedRecoveryOutputs(project,task,approvedBaselines,actor) and verifyRetainedRecoveryOutputs(project,task,facts) derive/check recovery-only Host observations from real prior publication and current owner/baseline. No SDK/IPC self-report or MutationResult substitution; legacy task metadata without retainedOutputs remains valid. */


/** memorySources(project) derives trusted source IDs/digests and limited labels; captureMemorySources(project,secrets,signal)
 * preserves safe immutable confirmed-plan/task-failure snapshots before replacing a plan or resetting a failed run.
 * The snapshots are not memory facts and never restore grants. Raw SDK output and current secrets are excluded.
 * recordSupervision stores only Host-validated typed advice or a safe not_completed code; no task/owner mutation.
 * load first validates old three-role schema/digest, then CAS migrates the fourth fixed Supervisor and invalidates pending execution. */

/** Su frontdoor: migrate(project,knownSecrets,signal) validates original v1 digest then CAS commits v2.
 * queryRoleActivity/queryRoleLog(project,input,actor) are model-only facts with a trusted Supervisor actor.
 * inspectRoleActivity/inspectRoleLog are separate customer reads bound by the Host to its selected project; neither returns member text.
 * Log cursors pin filtered records up to a stable boundary, not Org revision.
 * saveDelegation(project,entry,customerActor,signal) stores only trusted bounded binding/protocol state; no grant/credential or duplicated progress store.
 * saveRoleMemory includes a trusted channel. History is readonly; all current customer messages belong to customerTimeline.
 */
