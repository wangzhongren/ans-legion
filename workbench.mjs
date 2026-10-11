/** Trusted host workbench Models: explicit exports only, no effects or private wiring. */
export { ContextReadConfirmation, ContextSnapshot, ConfirmedTaskGrant, MutationVerification,
  createWorkbenchAuthority, isWorkbenchMutationAuthority, FileOwnershipError, ProjectFileOwners,
  FileOwnershipTransfer, FileOwnershipPlan, applyFileOwnershipPlan, assertFileOwner } from './src/kernel/models/workbench.mjs';
export { PiConnection, PiConnectionProfile, AgentScope, AgentConfig, TaskDispatchContext,
  AgentInstance, PiEventType, PiTextDelta, PiConversationHistory, PiConversationCheckpoint,
  PiToolRequest, PiToolResult, PiRunResult } from './src/kernel/models/agent.mjs';
export { ProjectReadRequest, ProjectReadDecision, ProjectReadResult } from './src/kernel/models/agent.mjs';
export { AgentSession, RoleBoundary, ActionProposal, PolicyDecision, ExecutionPermit,
  MutationResult, Event, Outcome, normalizeResource, normalizeScope, normalizeProjectReadResource,
  assertDistinctRoleWriteScopes, digestValue } from './src/kernel/models/core.mjs';
export { CheckSpec, CheckRequest, CheckAuthorization, CheckDecision, CheckResult, checkSpecs } from './src/kernel/models/check.mjs';
export { AgentControlDecision, AgentControlResult, AgentControlTools, AgentTools } from './src/kernel/models/agent.mjs';
export { ShellRequest, ShellReview, ShellPreparation, ShellAuthorization, ShellDecision, ShellCandidate, ShellResult, FileBaseline,
  shellEffects, shellArtifacts, shellBaselines } from './src/kernel/models/shell.mjs';
