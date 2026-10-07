import io
import tempfile
from pathlib import Path
import unittest
from dataclasses import FrozenInstanceError, replace
from contextlib import redirect_stdout
from kernel.models.core import AgentSession, ActionProposal, RoleBoundary, ExecutionPermit, PolicyDecision, Outcome
from kernel.pipelines.permission import PermissionRuntime
from kernel.interface.demo import run_demo, main

class RuntimeTests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory()
        self.root=Path(self.temporary.name)
        self.session=AgentSession("s","Backend","task","v1")
        self.boundary=RoleBoundary("Backend",write_scope=("backend/",),capabilities={"write_file"},tools={"legion_write_file"})
        self.proposal=ActionProposal("p","write_file","backend/a.py","content","legion_write_file","write_file",self.session)
        self.runtime=PermissionRuntime(self.root,[self.boundary],[self.session],"v1")

    def tearDown(self):
        self.runtime.close()
        self.temporary.cleanup()

    def test_public_prepare_execute_replay_and_forged_allow(self):
        decision,permit=self.runtime.prepare(self.proposal)
        fake=PolicyDecision(Outcome.ALLOW,"fake",self.proposal.digest,"v1",self.boundary.digest)
        self.assertFalse(self.runtime.execute(self.proposal,fake).success)
        self.assertFalse(self.runtime.execute(self.proposal,ExecutionPermit([])).success)
        self.assertTrue(self.runtime.execute(self.proposal,permit).success)
        self.assertFalse(self.runtime.execute(self.proposal,permit).success)
        self.assertEqual(self.runtime.read_file("backend/a.py"),"content")

    def test_public_content_target_identity_revalidation(self):
        for changes in ({"content":"changed"},{"resource":"backend/b.py"},{"session":replace(self.session,role_id="Admin")}):
            decision,permit=self.runtime.prepare(self.proposal)
            result=self.runtime.execute(replace(self.proposal,**changes),permit)
            self.assertFalse(result.success)
        self.assertFalse((self.root/"backend/a.py").exists())

    def test_updates_permanently_invalidate_permits(self):
        for update in ("version","boundary","task"):
            decision,permit=self.runtime.prepare(self.proposal)
            if update == "version":
                self.runtime.update_version("v2")
                self.runtime.update_version("v1")
            if update == "boundary":
                self.runtime.update_boundary(replace(self.boundary,write_scope=()))
                self.runtime.update_boundary(self.boundary)
            if update == "task":
                self.runtime.set_task_status("task","completed")
                self.runtime.set_task_status("task","active")
            self.assertFalse(self.runtime.execute(self.proposal,permit).success)
        self.assertFalse((self.root/"backend/a.py").exists())

    def test_nonexecuting_outcomes(self):
        outside=replace(self.proposal,resource="frontend/login.vue")
        for boundary,outcome in ((replace(self.boundary,required_approvals={"write_file"}),Outcome.REQUIRE_APPROVAL),
                                 (replace(self.boundary,allow_scope_expansion=True),Outcome.REQUIRE_SCOPE_EXPANSION)):
            self.runtime.update_boundary(boundary)
            decision,result=self.runtime.submit(outside)
            self.assertEqual(decision.outcome,outcome)
            self.assertFalse(result.observed_mutation)
        frontend=RoleBoundary("Frontend")
        self.runtime.update_boundary(frontend)
        self.runtime.update_boundary(replace(self.boundary,handoff_targets=("Frontend",)))
        decision,result=self.runtime.submit(outside)
        self.assertEqual(decision.outcome,Outcome.REQUIRE_HANDOFF)
        self.assertFalse((self.root/outside.resource).exists())

    def test_control_plane_deny_with_boundary_claim(self):
        self.runtime.update_boundary(replace(self.boundary,write_scope=(".ans/",".codex/","backend/")))
        for resource in (".ANS/organization/config.json",".codex/config","backend/../escape"):
            decision,result=self.runtime.submit(replace(self.proposal,resource=resource))
            self.assertEqual(decision.outcome,Outcome.DENY)
            self.assertFalse(result.observed_mutation)

    def test_invalid_identity_input_and_closed_lifecycle(self):
        decision,result=self.runtime.submit(None)
        self.assertEqual(decision.outcome,Outcome.DENY)
        self.assertFalse(result.success)
        unknown=replace(self.session,session_id="unknown")
        decision,result=self.runtime.submit(replace(self.proposal,session=unknown))
        self.assertEqual(decision.reason,"invalid_identity")
        self.runtime.close()
        self.runtime.close()
        decision,result=self.runtime.submit(self.proposal)
        self.assertEqual(decision.reason,"runtime_closed")
        self.assertFalse(result.success)

class DemoTests(unittest.TestCase):
    def test_demo_connected_layers(self):
        report=run_demo()
        observations=report["observations"]
        self.assertEqual(len(observations),6)
        self.assertEqual(observations[0]["status"],"written")
        self.assertTrue(all(item["decision"] == "DENY" for item in observations[1:]))
        self.assertTrue(report["frontend_preserved"])
        self.assertTrue(report["backend_written"])
        self.assertEqual(len(report["events"]),23)

    def test_cli_output(self):
        output=io.StringIO()
        with redirect_stdout(output):
            main()
        self.assertIn("frontend_preserved=True",output.getvalue())
        self.assertIn('"kind": "mutation_success"',output.getvalue())
        self.assertIn('"case": "stale-version"',output.getvalue())

if __name__ == "__main__":
    unittest.main()
