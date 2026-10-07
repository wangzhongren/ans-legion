import unittest
from dataclasses import replace
from kernel.models.core import AgentSession, ActionProposal, RoleBoundary, Outcome
from kernel.services.public.policy import create_policy_service

class PolicyTests(unittest.TestCase):
    def setUp(self):
        self.session=AgentSession("s","Backend","task","v1")
        self.proposal=ActionProposal("p","write_file","backend/a.py","ok","legion_write_file","write_file",self.session)
        self.boundary=RoleBoundary("Backend",write_scope=("backend/",),deny_scope=("backend/secret/",),capabilities={"write_file"},tools={"legion_write_file"})
        self.policy=create_policy_service()

    def evaluate(self, proposal=None, boundary=None, **kw):
        if proposal is None:
            proposal=self.proposal
        if boundary is None:
            boundary=self.boundary
        return self.policy.evaluate(proposal,boundary,self.session,kw.pop("current_version","v1"),**kw)

    def test_allow_and_outside_default_deny(self):
        self.assertEqual(self.evaluate().outcome,Outcome.ALLOW)
        self.assertEqual(self.evaluate(replace(self.proposal,resource="frontend/login.vue")).outcome,Outcome.DENY)

    def test_identity_task_version(self):
        self.assertEqual(self.evaluate(replace(self.proposal,session=replace(self.session,role_id="Admin"))).reason,"invalid_identity")
        self.assertEqual(self.evaluate(task_status="completed").reason,"task_inactive")
        self.assertEqual(self.evaluate(current_version="v2").reason,"version_mismatch")
        self.assertEqual(self.policy.evaluate(self.proposal,None,self.session,"v1").reason,"unknown_role")

    def test_invalid_and_control_plane(self):
        self.assertEqual(self.policy.evaluate(None,None,None,"v1").outcome,Outcome.DENY)
        for resource in (".ANS/organization/x", ".codex/config", "../backend/a", "C:/backend/a"):
            self.assertEqual(self.evaluate(replace(self.proposal,resource=resource)).outcome,Outcome.DENY)

    def test_missing_tool_capability_and_unsupported(self):
        for boundary in (replace(self.boundary,tools=()),replace(self.boundary,capabilities=())):
            self.assertEqual(self.evaluate(boundary=boundary).reason,"missing_tool_or_capability")
        self.assertEqual(self.evaluate(replace(self.proposal,tool="shell")).outcome,Outcome.DENY)

    def test_deny_precedes_approval_and_handoff(self):
        boundary=replace(self.boundary,required_approvals={"write_file"},handoff_targets=("Frontend",),allow_scope_expansion=True)
        self.assertEqual(self.evaluate(replace(self.proposal,resource="backend/secret/key"),boundary).reason,"explicit_deny")
        self.assertEqual(self.evaluate(boundary=boundary).outcome,Outcome.REQUIRE_APPROVAL)

    def test_resource_approval_matches_case_and_separator_aliases(self):
        for condition in ("backend/approved.txt", "BACKEND\\APPROVED.TXT"):
            boundary=replace(self.boundary,required_approvals={condition})
            for resource in ("backend/approved.txt", "BACKEND/APPROVED.TXT", "backend\\approved.txt"):
                with self.subTest(condition=condition,resource=resource):
                    decision=self.evaluate(replace(self.proposal,resource=resource),boundary)
                    self.assertEqual(decision.outcome,Outcome.REQUIRE_APPROVAL)
                    self.assertEqual(decision.reason,"approval_required")
            self.assertEqual(self.evaluate(boundary=boundary).outcome,Outcome.ALLOW)

    def test_canonical_approval_preserves_action_and_deny_priority(self):
        action_boundary=replace(self.boundary,required_approvals={"write_file"})
        self.assertEqual(self.evaluate(boundary=action_boundary).outcome,Outcome.REQUIRE_APPROVAL)
        boundary=replace(self.boundary,required_approvals={"backend/secret/key"})
        for resource in ("backend/secret/key", "BACKEND/SECRET/KEY", "backend\\secret\\key"):
            self.assertEqual(self.evaluate(replace(self.proposal,resource=resource),boundary).reason,"explicit_deny")

    def test_handoff_and_scope_expansion(self):
        outside=replace(self.proposal,resource="frontend/a")
        boundary=replace(self.boundary,handoff_targets=("Unknown","Frontend"),allow_scope_expansion=True)
        self.assertEqual(self.evaluate(outside,boundary,known_roles=("Backend","Frontend")).handoff_target,"Frontend")
        self.assertEqual(self.evaluate(outside,boundary,known_roles=("Backend",)).outcome,Outcome.REQUIRE_SCOPE_EXPANSION)

if __name__ == "__main__":
    unittest.main()
