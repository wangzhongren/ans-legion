import tempfile
from pathlib import Path
import unittest
from dataclasses import replace
from unittest.mock import patch
from kernel.models.core import AgentSession, ActionProposal, RoleBoundary, PolicyDecision, ExecutionPermit, Outcome, _RuntimeAuthority
from kernel.providers.public.storage import create_storage_provider
from kernel.services.public.policy import create_policy_service
from kernel.services.public.mutation import create_mutation_service
from kernel.pipelines.permission import PermissionRuntime

class ProviderGateTests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory()
        self.root=Path(self.temporary.name)
        self.session=AgentSession("s","Backend","task","v1")
        self.boundary=RoleBoundary("Backend",write_scope=("backend/",),capabilities={"write_file"},tools={"legion_write_file"})
        self.proposal=ActionProposal("p","write_file","backend/a.py","ok","legion_write_file","write_file",self.session)
        self.authority=_RuntimeAuthority({"s":self.session},{"Backend":self.boundary},"v1")
        self.storage=create_storage_provider(self.root,_authority=self.authority)

    def tearDown(self):
        self.storage.close()
        self.temporary.cleanup()

    def permit(self,proposal=None):
        if proposal is None:
            proposal=self.proposal
        decision=create_policy_service().evaluate(proposal,self.boundary,self.session,"v1")
        return self.authority.issue(proposal,decision)

    def test_direct_provider_has_no_authority(self):
        raw=create_storage_provider(self.root)
        fake=PolicyDecision(Outcome.ALLOW,"fake",self.proposal.digest,"v1",self.boundary.digest)
        for permit in (None, fake, ExecutionPermit(object())):
            self.assertFalse(raw.write(self.proposal,permit).observed_mutation)
        self.assertFalse((self.root/"backend/a.py").exists())

    def test_direct_mutation_service_cannot_trust_forged_allow(self):
        service=create_mutation_service(self.root)
        decision=PolicyDecision(Outcome.ALLOW,"fake",self.proposal.digest,"v1",self.boundary.digest)
        self.assertFalse(service.execute(self.proposal,decision).success)
        self.assertFalse(service.execute(self.proposal,ExecutionPermit(object())).success)
        self.assertFalse((self.root/"backend/a.py").exists())

    def test_service_provider_wiring(self):
        service=create_mutation_service(self.root,_authority=self.authority)
        self.assertTrue(service.execute(self.proposal,self.permit()).success)
        self.assertEqual(service.read_file("backend/a.py"),"ok")

    def test_authentic_write_replay_and_forgery(self):
        permit=self.permit()
        self.assertTrue(self.storage.write(self.proposal,permit).success)
        self.assertEqual((self.root/"backend/a.py").read_text(),"ok")
        self.assertFalse(self.storage.write(self.proposal,permit).success)
        self.assertFalse(self.storage.write(self.proposal,ExecutionPermit(object())).success)
        authentic=self.permit()
        self.assertFalse(self.storage.write(self.proposal,ExecutionPermit(authentic.token)).success)

    def test_content_resource_identity_and_proposal_digest(self):
        for changes in ({"content":"changed"},{"resource":"backend/b.py"},{"proposal_id":"other"},{"session":replace(self.session,task_id="other")}):
            self.assertFalse(self.storage.write(replace(self.proposal,**changes),self.permit()).success)
        self.assertFalse((self.root/"backend/a.py").exists())

    def test_approval_revalidation_rejects_forged_allow_for_aliases(self):
        for condition in ("backend/approved.txt", "BACKEND\\APPROVED.TXT", "write_file"):
            boundary=replace(self.boundary,required_approvals={condition})
            authority=_RuntimeAuthority({"s":self.session},{"Backend":boundary},"v1")
            for resource in ("backend/approved.txt", "BACKEND/APPROVED.TXT", "backend\\approved.txt"):
                proposal=replace(self.proposal,resource=resource)
                forged=PolicyDecision(Outcome.ALLOW,"forged",proposal.digest,"v1",boundary.digest)
                with self.subTest(condition=condition,resource=resource), self.assertRaisesRegex(PermissionError,"approval_required"):
                    authority.issue(proposal,forged)
        self.assertFalse((self.root/"backend").exists())

    def test_runtime_canonical_approvals_never_create_target(self):
        boundary=replace(self.boundary,required_approvals={"backend/approved.txt"})
        with PermissionRuntime(self.root,[boundary],[self.session],"v1") as runtime:
            for resource in ("backend/approved.txt", "BACKEND/APPROVED.TXT", "backend\\approved.txt"):
                decision,result=runtime.submit(replace(self.proposal,resource=resource))
                self.assertEqual(decision.outcome,Outcome.REQUIRE_APPROVAL)
                self.assertFalse(result.success)
                self.assertFalse(result.observed_mutation)
            self.assertEqual([event.kind for event in runtime.events()],
                ["proposal","decision","mutation_failure"]*3)
        self.assertFalse((self.root/"backend").exists())

    def test_added_path_approval_blocks_prepared_permit(self):
        permit=self.permit()
        self.authority.update_boundary(replace(self.boundary,required_approvals={"BACKEND\\A.PY"}))
        result=self.storage.write(self.proposal,permit)
        self.assertFalse(result.observed_mutation)
        self.assertFalse((self.root/"backend").exists())

    def test_version_boundary_and_task_revalidate(self):
        for change in ("version","boundary","task"):
            authority=_RuntimeAuthority({"s":self.session},{"Backend":self.boundary},"v1")
            decision=create_policy_service().evaluate(self.proposal,self.boundary,self.session,"v1")
            permit=authority.issue(self.proposal,decision)
            storage=create_storage_provider(self.root,_authority=authority)
            if change == "version":
                authority.update_version("v2")
            if change == "boundary":
                authority.update_boundary(replace(self.boundary,write_scope=()))
            if change == "task":
                authority.update_task("task","completed")
            self.assertFalse(storage.write(self.proposal,permit).success)

    def test_path_control_plane_and_escape(self):
        for resource in (".ANS/organization/file", "../outside", "C:/outside", ".codex/config"):
            self.assertFalse(self.storage.write(replace(self.proposal,resource=resource),ExecutionPermit(object())).success)

    def test_links_rejected(self):
        (self.root/"backend").mkdir()
        outside=self.root/"outside"
        outside.mkdir()
        link=self.root/"backend/link"
        try:
            link.symlink_to(outside,target_is_directory=True)
        except OSError:
            with patch("kernel.providers.impl.storage._LocalStorageProvider._linked",return_value=True):
                self.assertFalse(self.storage.write(self.proposal,self.permit()).success)
            return
        proposal=replace(self.proposal,resource="backend/link/file")
        self.assertFalse(self.storage.write(proposal,self.permit(proposal)).success)
        self.assertFalse((outside/"file").exists())

    def test_case_preserves_actual_target(self):
        (self.root/"Backend").mkdir()
        (self.root/"Backend/A.py").write_text("old")
        self.assertTrue(self.storage.write(self.proposal,self.permit()).success)
        self.assertEqual((self.root/"Backend/A.py").read_text(),"ok")

    def test_write_failure_audited_and_target_preserved(self):
        (self.root/"backend").mkdir()
        target=self.root/"backend/a.py"
        target.write_text("old")
        with patch("kernel.providers.impl.storage.os.replace",side_effect=OSError("secret error")):
            result=self.storage.write(self.proposal,self.permit())
        self.assertEqual(result.status,"failed")
        self.assertFalse(result.observed_mutation)
        self.assertEqual(target.read_text(),"old")
        self.assertEqual(self.storage.read_events()[-1].kind,"mutation_failure")
        self.assertNotIn("secret error",(self.root/".ans/events/index.jsonl").read_text())

if __name__ == "__main__":
    unittest.main()
