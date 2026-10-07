import tempfile
from pathlib import Path
import unittest
from dataclasses import replace
from unittest.mock import patch
from kernel.models.core import AgentSession, ActionProposal, RoleBoundary, Outcome, Event
from kernel.pipelines.permission import PermissionRuntime
from kernel.providers.public.storage import create_storage_provider, StorageError

class EventTests(unittest.TestCase):
    def setUp(self):
        self.temporary=tempfile.TemporaryDirectory()
        self.root=Path(self.temporary.name)
        self.session=AgentSession("s","Backend","task","v1")
        self.boundary=RoleBoundary("Backend",write_scope=("backend/",),capabilities={"write_file"},tools={"legion_write_file"})
        self.proposal=ActionProposal("p","write_file","backend/a.py","secret raw content","legion_write_file","write_file",self.session)
        self.runtime=PermissionRuntime(self.root,[self.boundary],[self.session],"v1")

    def tearDown(self):
        self.runtime.close()
        self.temporary.cleanup()

    def test_success_sequence_and_no_content(self):
        decision,result=self.runtime.submit(self.proposal)
        self.assertEqual(decision.outcome,Outcome.ALLOW)
        self.assertTrue(result.success)
        events=self.runtime.events()
        self.assertEqual([e.kind for e in events],["proposal","decision","mutation_intent","mutation_success"])
        self.assertEqual([e.sequence for e in events],[1,2,3,4])
        self.assertTrue(all(e.proposal_digest == self.proposal.digest for e in events))
        self.assertNotIn(self.proposal.content,(self.root/".ans/events/index.jsonl").read_text())

    def test_denied_path_has_correlated_failure(self):
        proposal=replace(self.proposal,resource="frontend/login.vue")
        decision,result=self.runtime.submit(proposal)
        self.assertEqual(decision.outcome,Outcome.DENY)
        self.assertFalse(result.observed_mutation)
        events=self.runtime.events()
        self.assertEqual([e.kind for e in events],["proposal","decision","mutation_failure"])
        self.assertTrue(all(e.resource == proposal.resource for e in events))
        self.assertFalse((self.root/proposal.resource).exists())

    def test_intent_audit_failure_before_write(self):
        from kernel.providers.impl.storage import _LocalStorageProvider
        original=_LocalStorageProvider.append_event
        def failing(provider,event):
            if event.kind == "mutation_intent":
                raise StorageError("audit_unavailable")
            return original(provider,event)
        with patch.object(_LocalStorageProvider,"append_event",failing):
            decision,result=self.runtime.submit(self.proposal)
        self.assertEqual(decision.outcome,Outcome.ALLOW)
        self.assertTrue(result.audit_failed)
        self.assertFalse(result.observed_mutation)
        self.assertFalse((self.root/"backend").exists())

    def test_result_audit_failure_reports_observed_mutation(self):
        from kernel.providers.impl.storage import _LocalStorageProvider
        original=_LocalStorageProvider.append_event
        def failing(provider,event):
            if event.kind == "mutation_success":
                raise StorageError("audit_unavailable")
            return original(provider,event)
        with patch.object(_LocalStorageProvider,"append_event",failing):
            decision,result=self.runtime.submit(self.proposal)
        self.assertFalse(result.success)
        self.assertEqual(result.status,"audit_failed")
        self.assertTrue(result.audit_failed)
        self.assertTrue(result.observed_mutation)
        self.assertEqual((self.root/"backend/a.py").read_text(),self.proposal.content)

    def test_proposal_audit_failure_closes_gate(self):
        (self.root/".ans/events").mkdir(parents=True)
        (self.root/".ans/events/index.jsonl").mkdir()
        decision,result=self.runtime.submit(self.proposal)
        self.assertEqual(decision.reason,"audit_unavailable")
        self.assertTrue(result.audit_failed)
        self.assertFalse((self.root/"backend/a.py").exists())

    def test_corrupt_audit_closes_gate(self):
        (self.root/".ans/events").mkdir(parents=True)
        (self.root/".ans/events/index.jsonl").write_text('{"broken":true}\n')
        decision,result=self.runtime.submit(self.proposal)
        self.assertTrue(result.audit_failed)
        self.assertFalse(result.observed_mutation)

    def test_index_daily_timestamp_mirror(self):
        self.runtime.submit(self.proposal)
        events=self.runtime.events()
        from datetime import datetime, timedelta
        recorded=datetime.fromisoformat(events[0].recorded_at)
        self.assertEqual(recorded.utcoffset(),timedelta(hours=8))
        index=self.root/".ans/events/index.jsonl"
        daily=self.root/".ans/events"/(recorded.date().isoformat()+".jsonl")
        self.assertEqual(index.read_text(),daily.read_text())
        daily.write_text("")
        decision,result=self.runtime.submit(replace(self.proposal,proposal_id="next"))
        self.assertTrue(result.audit_failed)
        self.assertEqual(decision.reason,"audit_unavailable")

    def test_audit_parent_reparse_detection(self):
        from kernel.providers.impl.storage import _LocalStorageProvider
        original=_LocalStorageProvider._linked
        for name in (self.root.name,".ans","events"):
            with self.subTest(component=name):
                (self.root/".ans/events").mkdir(parents=True,exist_ok=True)
                def linked(path):
                    if path.name == name:
                        return True
                    return original(path)
                with patch.object(_LocalStorageProvider,"_linked",staticmethod(linked)):
                    decision,result=self.runtime.submit(self.proposal)
                self.assertTrue(result.audit_failed)
                self.assertFalse((self.root/"backend/a.py").exists())

    def test_daily_actual_append_error_after_observed_write(self):
        original=Path.open
        daily_appends=[]
        def failing(path,*args,**kwargs):
            if args and args[0] == "a" and path.name != "index.jsonl":
                daily_appends.append(path)
                if len(daily_appends) == 4:
                    raise OSError("daily unavailable")
            return original(path,*args,**kwargs)
        with patch.object(Path,"open",failing):
            decision,result=self.runtime.submit(self.proposal)
        self.assertTrue(result.audit_failed)
        self.assertTrue(result.observed_mutation)
        self.assertEqual(self.runtime.read_file("backend/a.py"),self.proposal.content)
        next_decision,next_result=self.runtime.submit(replace(self.proposal,proposal_id="next"))
        self.assertTrue(next_result.audit_failed)
        self.assertFalse(next_result.observed_mutation)

    def test_raw_provider_cannot_write_audit(self):
        raw=create_storage_provider(self.root)
        with self.assertRaises(StorageError):
            raw.append_event(Event(0,"proposal","r","t","v","file","digest","correlation"))
        self.assertFalse((self.root/".ans/events/index.jsonl").exists())

    def test_revalidation_and_replay_are_audited(self):
        decision,permit=self.runtime.prepare(self.proposal)
        self.runtime.set_task_status("task","completed")
        result=self.runtime.execute(self.proposal,permit)
        self.assertFalse(result.success)
        self.assertEqual(result.reason,"task_inactive")
        self.assertEqual(self.runtime.events()[-1].kind,"mutation_failure")

if __name__ == "__main__":
    unittest.main()
