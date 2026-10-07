/** Trusted host workbench Models: explicit exports only, no effects or private wiring. */
export { ContextReadConfirmation, ContextSnapshot, ConfirmedTaskGrant, MutationVerification,
  createWorkbenchAuthority, isWorkbenchMutationAuthority } from './src/kernel/models/workbench.mjs';
export { PiConnection, PiConnectionProfile, AgentScope, AgentConfig, TaskDispatchContext,
  AgentInstance, PiEventType, PiTextDelta, PiConversationHistory, PiConversationCheckpoint,
  PiToolRequest, PiToolResult, PiRunResult } from './src/kernel/models/agent.mjs';
export { AgentSession, RoleBoundary, ActionProposal, PolicyDecision, ExecutionPermit,
  MutationResult, Event, Outcome, normalizeResource, normalizeScope, digestValue } from './src/kernel/models/core.mjs';
