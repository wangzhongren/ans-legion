import { PolicyService } from "../abstract/policy.mjs";
import { ActionProposal, RoleBoundary, Outcome, PolicyDecision, normalizeResource, scopeContains,
  requiresApproval, validateInstanceGrant, digestValue } from "../../models/core.mjs";
import { AgentScope, TaskDispatchContext } from "../../models/agent.mjs";
import { ConfirmedTaskGrant } from "../../models/workbench.mjs";

export class _PolicyService extends PolicyService {
  constructor() { super(); Object.freeze(this); }
  validateScope(boundary, dispatchContext, scope) {
    if (!(dispatchContext instanceof TaskDispatchContext) || !(scope instanceof AgentScope)) {
      throw new TypeError("typed_scope_context_required");
    }
    const grant = validateInstanceGrant(boundary, dispatchContext, scope);
    if (scope.tools.length === 0) {
      if (scope.write.length !== 0 || dispatchContext.writeSet.length !== 0 || dispatchContext.tools.length !== 0) {
        throw new TypeError("toolless_scope_must_have_no_task_writes");
      }
      return grant;
    }
    if (scope.tools.length !== 1 || scope.tools[0] !== "legion_write_file") {
      throw new TypeError("only_controlled_write_tool_supported");
    }
    return grant;
  }

  evaluate(proposal, { boundary, trustedSession, currentVersion, taskStatus = "active",
    knownRoles = [], instance, dispatchContext } = {}) {
    let boundaryDigest = "";
    if (boundary instanceof RoleBoundary) boundaryDigest = boundary.digest;
    let proposalDigest = "";
    if (proposal instanceof ActionProposal) proposalDigest = proposal.digest;
    const decision = (outcome, reason, handoffTarget = "") => new PolicyDecision({
      outcome, reason, proposalDigest, organizationVersion: currentVersion, boundaryDigest, handoffTarget });
    if (!(proposal instanceof ActionProposal)) return decision(Outcome.DENY, "invalid_proposal");
    const session = proposal.session;
    if (session !== trustedSession) return decision(Outcome.DENY, "invalid_identity");
    if (!(boundary instanceof RoleBoundary) || boundary.roleId !== session.roleId) {
      return decision(Outcome.DENY, "unknown_role");
    }
    if (taskStatus !== "active") return decision(Outcome.DENY, "task_inactive");
    if (session.organizationVersion !== currentVersion) return decision(Outcome.DENY, "version_mismatch");
    if (instance?.workbenchGrant !== undefined) {
      const approved = instance.workbenchGrant;
      if (!(approved instanceof ConfirmedTaskGrant) || approved.roleId !== session.roleId ||
          approved.taskId !== session.taskId || approved.organizationVersion !== currentVersion) {
        return decision(Outcome.DENY, "confirmed_task_binding_mismatch");
      }
      const canonicalFiles = (files) => files.map((file) => normalizeResource(file).toLowerCase()).sort();
      if (digestValue(canonicalFiles(approved.writeSet)) !== digestValue(canonicalFiles(instance.grant.writeSet)) ||
          digestValue([...approved.tools].sort()) !== digestValue([...instance.grant.taskTools].sort())) {
        return decision(Outcome.DENY, "confirmed_task_scope_mismatch");
      }
    }
    if (proposal.action !== "write_file" || proposal.tool !== "legion_write_file" ||
        proposal.capability !== "write_file") return decision(Outcome.DENY, "unsupported_action_tool_or_capability");
    if (!boundary.tools.includes(proposal.tool) || !boundary.capabilities.includes(proposal.capability)) {
      return decision(Outcome.DENY, "missing_tool_or_capability");
    }
    try { normalizeResource(proposal.resource); }
    catch (error) {
      if (!(error instanceof TypeError)) throw error;
      return decision(Outcome.DENY, "unsafe_resource");
    }
    if (boundary.denyScope.some((scope) => scopeContains(scope, proposal.resource))) {
      return decision(Outcome.DENY, "explicit_deny");
    }
    if (dispatchContext !== undefined) {
      if (!(dispatchContext instanceof TaskDispatchContext) || session.roleId !== dispatchContext.roleId ||
          session.taskId !== dispatchContext.taskId || session.organizationVersion !== dispatchContext.organizationVersion) {
        return decision(Outcome.DENY, "dispatch_identity_mismatch");
      }
      if (!dispatchContext.writeSet.some((file) => scopeContains(file, proposal.resource))) {
        return decision(Outcome.DENY, "outside_task_scope");
      }
      if (!dispatchContext.tools.includes(proposal.tool)) return decision(Outcome.DENY, "outside_tool_grant");
    }
    if (instance !== undefined) {
      if (instance.session !== session || instance.status !== "running" || instance.runId !== proposal.runId) {
        return decision(Outcome.DENY, "instance_or_run_changed");
      }
      const grant = instance.grant;
      if (grant.deny.some((scope) => scopeContains(scope, proposal.resource))) {
        return decision(Outcome.DENY, "instance_deny");
      }
      if (!grant.write.some((scope) => scopeContains(scope, proposal.resource)) ||
          !grant.writeSet.some((file) => scopeContains(file, proposal.resource))) {
        return decision(Outcome.DENY, "outside_instance_or_task_scope");
      }
      if (!grant.tools.includes(proposal.tool) || !grant.taskTools.includes(proposal.tool)) {
        return decision(Outcome.DENY, "outside_tool_grant");
      }
    }
    if (requiresApproval(boundary, proposal.action, proposal.resource)) {
      return decision(Outcome.REQUIRE_APPROVAL, "approval_required");
    }
    if (!boundary.writeScope.some((scope) => scopeContains(scope, proposal.resource))) {
      for (const target of boundary.handoffTargets) {
        if (target !== session.roleId && knownRoles.includes(target)) {
          return decision(Outcome.REQUIRE_HANDOFF, "outside_scope", target);
        }
      }
      if (boundary.allowScopeExpansion) return decision(Outcome.REQUIRE_SCOPE_EXPANSION, "outside_scope");
      return decision(Outcome.DENY, "outside_write_scope");
    }
    return decision(Outcome.ALLOW, "within_boundary");
  }
}
