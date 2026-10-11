import { PolicyService } from "../abstract/policy.mjs";
import { ActionProposal, RoleBoundary, Outcome, PolicyDecision, normalizeResource, normalizeProjectReadResource, scopeContains,
  requiresApproval, validateInstanceGrant, digestValue, assertRuntimeOwner, _shellPublicationBinding } from "../../models/core.mjs";
import { AgentScope, TaskDispatchContext, ProjectReadRequest, ProjectReadDecision, AgentTools } from "../../models/agent.mjs";
import { ConfirmedTaskGrant } from "../../models/workbench.mjs";

export class _PolicyService extends PolicyService {
  constructor() { super(); Object.freeze(this); }
  validateScope(boundary, dispatchContext, scope, fileOwners) {
    if (!(dispatchContext instanceof TaskDispatchContext) || !(scope instanceof AgentScope)) {
      throw new TypeError("typed_scope_context_required");
    }
    const grant = validateInstanceGrant(boundary, dispatchContext, scope, fileOwners);
    if (scope.tools.length === 0) {
      if (scope.write.length !== 0 || dispatchContext.tools.length !== 0) {
        throw new TypeError("toolless_scope_must_have_no_task_writes");
      }
      return grant;
    }
    const read = ["legion_list_files", "legion_read_file"];
    const requestedRead = read.filter((tool) => scope.tools.includes(tool));
    if (requestedRead.length === 1) throw new TypeError("both_read_tools_required");
    if (scope.tools.some((tool) => !AgentTools.includes(tool))) {
      throw new TypeError("unsupported_tool");
    }
    if (!scope.tools.includes("legion_write_file") && !scope.tools.includes("legion_edit_file") && !scope.tools.includes("legion_request_shell") &&
        (scope.write.length !== 0 ||
        dispatchContext.tools.includes("legion_write_file") || dispatchContext.tools.includes("legion_edit_file"))) {
      throw new TypeError("read_only_scope_must_have_no_task_writes");
    }
    return grant;
  }

  evaluateRead(request, { boundary, session, trustedSession, currentVersion, taskStatus = "active",
    instance, dispatchContext } = {}) {
    const answer = (allowed, reason) => new ProjectReadDecision({ allowed, reason });
    if (!(request instanceof ProjectReadRequest)) return answer(false, "invalid_read_request");
    if (session !== trustedSession) return answer(false, "invalid_identity");
    if (!(boundary instanceof RoleBoundary) || boundary.roleId !== session?.roleId) return answer(false, "unknown_role");
    if (taskStatus !== "active") return answer(false, "task_inactive");
    if (session.organizationVersion !== currentVersion) return answer(false, "version_mismatch");
    if (!boundary.readScope.includes(".") || !boundary.capabilities.includes("read_project") ||
        !boundary.tools.includes(request.tool)) return answer(false, "missing_project_read_grant");
    try {
      normalizeProjectReadResource(request.resource, { allowRoot: request.tool === "legion_list_files" });
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      if (error.message === "restricted_resource") return answer(false, "restricted_resource");
      return answer(false, "unsafe_resource");
    }
    if (request.resource !== "" && boundary.denyScope.some((scope) => scopeContains(scope, request.resource))) {
      return answer(false, "explicit_deny");
    }
    if (!(dispatchContext instanceof TaskDispatchContext) || session.roleId !== dispatchContext.roleId ||
        session.taskId !== dispatchContext.taskId || session.organizationVersion !== dispatchContext.organizationVersion ||
        !dispatchContext.tools.includes(request.tool)) return answer(false, "outside_tool_grant");
    if (instance === undefined || instance.session !== session || instance.status !== "running" ||
        instance.runId !== request.runId) return answer(false, "instance_or_run_changed");
    if (!instance.grant.tools.includes(request.tool) || !instance.grant.taskTools.includes(request.tool)) {
      return answer(false, "outside_tool_grant");
    }
    if (request.resource !== "" && instance.grant.deny.some((scope) => scopeContains(scope, request.resource))) {
      return answer(false, "instance_deny");
    }
    return answer(true, "within_project_read_scope");
  }

  evaluate(proposal, { boundary, trustedSession, currentVersion, taskStatus = "active",
    knownRoles = [], instance, dispatchContext, fileOwners, publicationReceipt, observedAtMs } = {}) {
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
      if (approved.fileOwnersDigest !== instance.grant.fileOwnersDigest || approved.ownerGeneration !== instance.grant.ownerGeneration ||
          digestValue([...approved.tools].sort()) !== digestValue([...instance.grant.taskTools].sort())) {
        return decision(Outcome.DENY, "confirmed_task_scope_mismatch");
      }
    }
    const write = proposal.action === "write_file" && proposal.tool === "legion_write_file";
    const edit = proposal.action === "edit_file" && proposal.tool === "legion_edit_file";
    let shell=false;let grantedTool=proposal.tool;
    if(proposal.tool==="legion_shell_publish") {
      try {_shellPublicationBinding(publicationReceipt,proposal,observedAtMs);shell=true;grantedTool="legion_request_shell";}
      catch(error){if(!(error instanceof TypeError))throw error;return decision(Outcome.DENY,"invalid_shell_publication_receipt");}
    }
    if ((!write && !edit && !shell) || (!shell && proposal.capability !== "write_file")) {
      return decision(Outcome.DENY, "unsupported_action_tool_or_capability");
    }
    if (!boundary.tools.includes(grantedTool) || !boundary.capabilities.includes(proposal.capability)) {
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
      if (!dispatchContext.tools.includes(grantedTool)) return decision(Outcome.DENY, "outside_tool_grant");
    }
    if (instance !== undefined) {
      if (instance.session !== session || instance.status !== "running" || instance.runId !== proposal.runId) {
        return decision(Outcome.DENY, "instance_or_run_changed");
      }
      const grant = instance.grant;
      if (grant.deny.some((scope) => scopeContains(scope, proposal.resource))) {
        return decision(Outcome.DENY, "instance_deny");
      }
      if (!grant.write.some((file) => normalizeResource(file).toLowerCase() === normalizeResource(proposal.resource).toLowerCase())) {
        return decision(Outcome.DENY, "outside_instance_or_task_scope");
      }
      if (!grant.tools.includes(grantedTool) || !grant.taskTools.includes(grantedTool)) {
        return decision(Outcome.DENY, "outside_tool_grant");
      }
    }
    const ownerSnapshot = fileOwners ?? instance?.grant.fileOwners;
    const ownerBinding = dispatchContext ?? instance?.grant ?? (fileOwners && { fileOwnersDigest: fileOwners.digest, ownerGeneration: fileOwners.version });
    if (ownerBinding === undefined) return decision(Outcome.DENY, "owner_binding_required");
    try { assertRuntimeOwner(ownerSnapshot, ownerBinding, proposal.resource, session.roleId); }
    catch (error) {
      if (!(error instanceof TypeError)) throw error;
      return decision(Outcome.DENY, error.message);
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
