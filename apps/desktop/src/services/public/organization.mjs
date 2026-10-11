import { organizationServiceOptions } from '../abstract/organization.mjs';
import { OrganizationServiceImpl } from '../impl/organization.mjs';
export function createOrganizationService(options) {
  const service = new OrganizationServiceImpl(organizationServiceOptions(options));
  return Object.freeze(Object.fromEntries(['invalidateCustomerTurn','migrate','queryRoleActivity','queryRoleLog','saveDelegation','captureMemorySources','memorySources','recordSupervision','load', 'completeShellRecovery', 'shellRecoveryInputs', 'previewRetainedRecovery', 'retainedRecoveryOutputs', 'verifyRetainedRecoveryOutputs', 'enqueueShell', 'shellPhase', 'reviewShell', 'appendShellReview', 'claimShell', 'interruptShell', 'shellOutput', 'inventory', 'shellConfiguration', 'saveRoleMemory', 'seedConversation', 'beginMemberRun', 'appendMemberEvent', 'finishMemberRun', 'beginTurn', 'resumeTurn', 'appendText', 'finishTurn', 'submitProposal', 'reviewProposal', 'validatePublication', 'validatePlan', 'enqueue', 'answer', 'invalidate', 'snapshotInputs', 'checkConfiguration', 'recordCheck', 'currentEvidence', 'submitAcceptance', 'requestRepair', 'close'].map((name) => [name, service[name].bind(service)])));
}
