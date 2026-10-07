from kernel.services.abstract.policy import PolicyService
from kernel.models.core import ActionProposal, Outcome, PolicyDecision, normalize_resource, scope_contains, requires_approval

class _PolicyService(PolicyService):
    def evaluate(self, proposal, boundary, trusted_session, current_version, task_status="active", known_roles=()):
        if not isinstance(proposal, ActionProposal):
            return PolicyDecision(Outcome.DENY, "invalid_proposal", "", current_version)
        boundary_digest = ""
        if boundary is not None:
            boundary_digest = boundary.digest
        def decision(outcome, reason, target=""):
            return PolicyDecision(outcome, reason, proposal.digest, current_version, boundary_digest, target)
        session = proposal.session
        if trusted_session is None or session is not trusted_session:
            return decision(Outcome.DENY, "invalid_identity")
        if boundary is None or boundary.role_id != session.role_id:
            return decision(Outcome.DENY, "unknown_role")
        if task_status != "active":
            return decision(Outcome.DENY, "task_inactive")
        if session.organization_version != current_version:
            return decision(Outcome.DENY, "version_mismatch")
        if proposal.action != "write_file" or proposal.tool != "legion_write_file" or proposal.capability != "write_file":
            return decision(Outcome.DENY, "unsupported_action_tool_or_capability")
        if proposal.tool not in boundary.tools or proposal.capability not in boundary.capabilities:
            return decision(Outcome.DENY, "missing_tool_or_capability")
        try:
            normalize_resource(proposal.resource)
        except ValueError:
            return decision(Outcome.DENY, "unsafe_resource")
        if any(scope_contains(scope, proposal.resource) for scope in boundary.deny_scope):
            return decision(Outcome.DENY, "explicit_deny")
        if requires_approval(boundary, proposal.action, proposal.resource):
            return decision(Outcome.REQUIRE_APPROVAL, "approval_required")
        if not any(scope_contains(scope, proposal.resource) for scope in boundary.write_scope):
            for target in boundary.handoff_targets:
                if target in known_roles and target != session.role_id:
                    return decision(Outcome.REQUIRE_HANDOFF, "outside_scope", target)
            if boundary.allow_scope_expansion:
                return decision(Outcome.REQUIRE_SCOPE_EXPANSION, "outside_scope")
            return decision(Outcome.DENY, "outside_write_scope")
        return decision(Outcome.ALLOW, "within_boundary")
