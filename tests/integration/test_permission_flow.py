"""Finite independent v1 flows using public adapters, runtime and real files."""
from contextlib import contextmanager
from dataclasses import asdict, replace
from datetime import datetime, timedelta
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from adapters.services.public.proposal import create_codex_adapter, create_claude_adapter
from kernel.interface.demo import run_demo
from kernel.models.core import AgentSession, ExecutionPermit, Outcome, RoleBoundary
from kernel.pipelines.permission import PermissionRuntime
from kernel.services.public.mutation import MutationError


WORKSPACE_PARENT = Path(__file__).resolve().parents[3]
FACTORIES = (create_codex_adapter, create_claude_adapter)
SECRET_CONTENT = "integration-body-秘密-should-not-be-audit-data"
ALLOWED_KINDS = ("proposal", "decision", "mutation_intent", "mutation_success")
DENIED_KINDS = ("proposal", "decision", "mutation_failure")


class PermissionFlowTests(unittest.TestCase):
    @contextmanager
    def fixture(self, factory):
        temporary = tempfile.TemporaryDirectory(prefix="legion-integration-", dir=WORKSPACE_PARENT)
        root = Path(temporary.name)
        self.assertEqual(root.resolve().parent, WORKSPACE_PARENT.resolve())
        backend = AgentSession("backend-session", "Backend", "backend-task", "v1")
        frontend = AgentSession("frontend-session", "Frontend", "frontend-task", "v1")
        stale = AgentSession("stale-session", "Backend", "stale-task", "v0")
        unknown = AgentSession("unknown-session", "Unknown", "unknown-task", "v1")
        boundary = RoleBoundary("Backend", write_scope=("backend/",),
                                deny_scope=("backend/private/",),
                                tools={"legion_write_file"}, capabilities={"write_file"})
        frontend_boundary = RoleBoundary("Frontend", write_scope=("frontend/",),
                                         tools={"legion_write_file"}, capabilities={"write_file"})
        try:
            with PermissionRuntime(root, [boundary, frontend_boundary],
                                   [backend, frontend, stale, unknown], "v1") as runtime:
                yield factory(), runtime, root, backend, frontend, stale, unknown, boundary
        finally:
            temporary.cleanup()
            self.assertFalse(root.exists(), "controlled temporary workspace must be cleaned")

    @staticmethod
    def proposal(adapter, trusted_session, resource="backend/new/file.txt", proposal_id="integration", **claims):
        parameters = {"proposal_id": proposal_id, "resource": resource, "content": SECRET_CONTENT}
        parameters.update(claims)
        return adapter.convert("legion_write_file", parameters, trusted_session)

    def assert_nonexecuting(self, decision, result, outcome, reason):
        self.assertEqual((decision.outcome, decision.reason), (outcome, reason))
        self.assertEqual((result.success, result.status, result.observed_mutation, result.audit_failed),
                         (False, "denied", False, False))

    def assert_audit(self, runtime, root, expected):
        events = runtime.events()
        self.assertEqual(len(events), sum(len(kinds) for proposal, kinds, version in expected))
        self.assertEqual([event.sequence for event in events], list(range(1, len(events) + 1)))
        offset = 0
        for proposal, kinds, decision_version in expected:
            group = events[offset:offset + len(kinds)]
            self.assertEqual([event.kind for event in group], list(kinds))
            for event in group:
                self.assertEqual((event.role_id, event.task_id, event.resource,
                                  event.proposal_digest, event.correlation_id),
                                 (proposal.session.role_id, proposal.session.task_id, proposal.resource,
                                  proposal.digest, proposal.proposal_id))
                version = proposal.session.organization_version
                if event.kind == "decision":
                    version = decision_version
                self.assertEqual(event.organization_version, version)
                self.assertEqual(datetime.fromisoformat(event.recorded_at).utcoffset(), timedelta(hours=8))
            offset += len(kinds)
        audit_root = root / ".ans/events"
        index_text = (audit_root / "index.jsonl").read_text(encoding="utf-8")
        self.assertEqual([json.loads(line) for line in index_text.splitlines()], [asdict(event) for event in events])
        grouped = {}
        for event in events:
            date = datetime.fromisoformat(event.recorded_at).date().isoformat()
            grouped.setdefault(date, []).append(asdict(event))
        self.assertEqual({path.name for path in audit_root.iterdir()},
                         {"index.jsonl", *[date + ".jsonl" for date in grouped]})
        for date, records in grouped.items():
            daily_text = (audit_root / (date + ".jsonl")).read_text(encoding="utf-8")
            self.assertEqual([json.loads(line) for line in daily_text.splitlines()], records)
            self.assertNotIn("integration-body", daily_text)
            self.assertNotIn('"content"', daily_text)
        self.assertNotIn("integration-body", index_text)
        return events

    def test_both_adapters_write_backend_preserve_frontend_and_match(self):
        observations = []
        for factory in FACTORIES:
            with self.subTest(adapter=factory.__name__), self.fixture(factory) as fixture:
                adapter, runtime, root, backend, frontend, stale, unknown, boundary = fixture
                setup = self.proposal(adapter, frontend, "frontend/login.vue", "frontend-setup", content="original login")
                self.assertTrue(runtime.submit(setup)[1].success)
                allowed = self.proposal(adapter, backend)
                decision, result = runtime.submit(allowed)
                self.assertEqual(decision.outcome, Outcome.ALLOW)
                self.assertEqual((result.success, result.status, result.observed_mutation, result.audit_failed),
                                 (True, "written", True, False))
                self.assertEqual(result.proposal_digest, allowed.digest)
                self.assertIs(allowed.session, backend)
                self.assertEqual(allowed.content_digest, hashlib.sha256(SECRET_CONTENT.encode()).hexdigest())
                self.assertEqual(runtime.read_file(allowed.resource), SECRET_CONTENT)
                self.assertEqual((root / allowed.resource).read_text(encoding="utf-8"), SECRET_CONTENT)
                denied = self.proposal(adapter, backend, "frontend/login.vue", "denied-frontend")
                denied_decision, denied_result = runtime.submit(denied)
                self.assert_nonexecuting(denied_decision, denied_result, Outcome.DENY, "outside_write_scope")
                self.assertEqual(runtime.read_file(setup.resource), "original login")
                self.assertEqual((root / setup.resource).read_text(encoding="utf-8"), "original login")
                events = self.assert_audit(runtime, root,
                    [(setup, ALLOWED_KINDS, "v1"), (allowed, ALLOWED_KINDS, "v1"), (denied, DENIED_KINDS, "v1")])
                self.assertEqual(events[5].outcome, "ALLOW")
                self.assertEqual(events[9].outcome, "DENY")
                self.assertTrue(events[7].observed_mutation)
                self.assertFalse(events[10].observed_mutation)
                observations.append((allowed.digest, denied.digest, decision, result, denied_decision, denied_result))
        self.assertEqual(observations[0], observations[1])

    def test_parameter_authority_claims_cannot_change_trusted_identity(self):
        for factory in FACTORIES:
            with self.subTest(adapter=factory.__name__), self.fixture(factory) as fixture:
                adapter, runtime, root, backend, frontend, stale, unknown, boundary = fixture
                proposal = self.proposal(adapter, backend, "frontend/login.vue", role="Frontend", role_id="Frontend",
                    session=frontend, session_id=frontend.session_id, task_id=frontend.task_id,
                    organization_version="v999", action="shell", capability="admin", tool="shell", authority="ALLOW")
                self.assertIs(proposal.session, backend)
                self.assertEqual((proposal.action, proposal.capability, proposal.tool),
                                 ("write_file", "write_file", "legion_write_file"))
                decision, result = runtime.submit(proposal)
                self.assert_nonexecuting(decision, result, Outcome.DENY, "outside_write_scope")
                self.assertFalse((root / "frontend").exists())
                self.assert_audit(runtime, root, [(proposal, DENIED_KINDS, "v1")])

    def test_session_copy_unregistered_and_unknown_role_fail_closed(self):
        for factory in FACTORIES:
            with self.subTest(adapter=factory.__name__), self.fixture(factory) as fixture:
                adapter, runtime, root, backend, frontend, stale, unknown, boundary = fixture
                identities = [(replace(backend), "invalid_identity"),
                              (replace(backend, session_id="unregistered"), "invalid_identity"),
                              (unknown, "unknown_role")]
                expected = []
                for number, (session, reason) in enumerate(identities):
                    proposal = self.proposal(adapter, session, proposal_id="identity-" + str(number))
                    self.assert_nonexecuting(*runtime.submit(proposal), Outcome.DENY, reason)
                    expected.append((proposal, DENIED_KINDS, "v1"))
                self.assertFalse((root / "backend").exists())
                self.assert_audit(runtime, root, expected)

    def test_adapter_rejects_unknown_tool_without_runtime_effects(self):
        for factory in FACTORIES:
            with self.subTest(adapter=factory.__name__), self.fixture(factory) as fixture:
                adapter, runtime, root, backend, frontend, stale, unknown, boundary = fixture
                with self.assertRaises(ValueError):
                    adapter.convert("shell", {"proposal_id": "bad", "resource": "backend/file", "content": SECRET_CONTENT}, backend)
                self.assertEqual(runtime.events(), ())
                self.assertEqual(list(root.iterdir()), [])

    def test_runtime_rejects_unsupported_action_tool_capability_and_missing_rights(self):
        for factory in FACTORIES:
            with self.subTest(adapter=factory.__name__), self.fixture(factory) as fixture:
                adapter, runtime, root, backend, frontend, stale, unknown, boundary = fixture
                proposal = self.proposal(adapter, backend)
                expected = []
                for field, value in (("action", "shell"), ("tool", "shell"), ("capability", "network")):
                    altered = replace(proposal, proposal_id=field, **{field: value})
                    self.assert_nonexecuting(*runtime.submit(altered), Outcome.DENY, "unsupported_action_tool_or_capability")
                    expected.append((altered, DENIED_KINDS, "v1"))
                for field in ("tools", "capabilities"):
                    runtime.update_boundary(replace(boundary, **{field: frozenset()}))
                    missing = replace(proposal, proposal_id="missing-" + field)
                    self.assert_nonexecuting(*runtime.submit(missing), Outcome.DENY, "missing_tool_or_capability")
                    expected.append((missing, DENIED_KINDS, "v1"))
                self.assertFalse((root / "backend").exists())
                self.assert_audit(runtime, root, expected)

    def test_explicit_deny_and_control_plane_traversal_preserve_targets(self):
        for factory in FACTORIES:
            with self.subTest(adapter=factory.__name__), self.fixture(factory) as fixture:
                adapter, runtime, root, backend, frontend, stale, unknown, boundary = fixture
                sentinel = root / ".ans/organization/config.json"
                sentinel.parent.mkdir(parents=True)
                sentinel.write_text("organization preserved", encoding="utf-8")
                runtime.update_boundary(replace(boundary, required_approvals={"write_file"},
                    handoff_targets=("Frontend",), allow_scope_expansion=True))
                expected = []
                cases = [("BACKEND\\PRIVATE\\key.txt", "explicit_deny"),
                         (".ANS/organization/config.json", "unsafe_resource"),
                         ("backend/../outside.txt", "unsafe_resource"), ("../outside.txt", "unsafe_resource")]
                for number, (resource, reason) in enumerate(cases):
                    proposal = self.proposal(adapter, backend, resource, "denial-" + str(number))
                    self.assert_nonexecuting(*runtime.submit(proposal), Outcome.DENY, reason)
                    expected.append((proposal, DENIED_KINDS, "v1"))
                self.assertEqual(sentinel.read_text(encoding="utf-8"), "organization preserved")
                self.assertFalse((root / "backend").exists())
                self.assertFalse((root / "outside.txt").exists())
                self.assert_audit(runtime, root, expected)

    def test_stale_version_has_complete_denied_audit_with_current_decision_version(self):
        for factory in FACTORIES:
            with self.subTest(adapter=factory.__name__), self.fixture(factory) as fixture:
                adapter, runtime, root, backend, frontend, stale, unknown, boundary = fixture
                proposal = self.proposal(adapter, stale)
                self.assert_nonexecuting(*runtime.submit(proposal), Outcome.DENY, "version_mismatch")
                self.assertFalse((root / "backend").exists())
                self.assert_audit(runtime, root, [(proposal, DENIED_KINDS, "v1")])

    def test_approval_alias_regression_and_action_approval_never_execute(self):
        for factory in FACTORIES:
            with self.subTest(adapter=factory.__name__), self.fixture(factory) as fixture:
                adapter, runtime, root, backend, frontend, stale, unknown, boundary = fixture
                runtime.update_boundary(replace(boundary, required_approvals={"backend/approved.txt"}))
                expected = []
                for number, resource in enumerate(("backend/approved.txt", "BACKEND/APPROVED.TXT", "backend\\approved.txt")):
                    proposal = self.proposal(adapter, backend, resource, "approval-" + str(number))
                    self.assert_nonexecuting(*runtime.submit(proposal), Outcome.REQUIRE_APPROVAL, "approval_required")
                    expected.append((proposal, DENIED_KINDS, "v1"))
                runtime.update_boundary(replace(boundary, required_approvals={"write_file"}))
                action = self.proposal(adapter, backend, proposal_id="action-approval")
                self.assert_nonexecuting(*runtime.submit(action), Outcome.REQUIRE_APPROVAL, "approval_required")
                expected.append((action, DENIED_KINDS, "v1"))
                self.assertFalse((root / "backend").exists())
                self.assert_audit(runtime, root, expected)

    def test_handoff_expansion_and_unknown_target_do_not_create_files(self):
        for factory in FACTORIES:
            with self.subTest(adapter=factory.__name__), self.fixture(factory) as fixture:
                adapter, runtime, root, backend, frontend, stale, unknown, boundary = fixture
                cases = [(replace(boundary, handoff_targets=("Frontend",), allow_scope_expansion=True), Outcome.REQUIRE_HANDOFF, "Frontend"),
                         (replace(boundary, allow_scope_expansion=True), Outcome.REQUIRE_SCOPE_EXPANSION, ""),
                         (replace(boundary, handoff_targets=("Absent",)), Outcome.DENY, "")]
                expected = []
                for number, (updated, outcome, target) in enumerate(cases):
                    runtime.update_boundary(updated)
                    proposal = self.proposal(adapter, backend, "frontend/login.vue", "routing-" + str(number))
                    decision, result = runtime.submit(proposal)
                    reason = "outside_scope"
                    if outcome == Outcome.DENY:
                        reason = "outside_write_scope"
                    self.assert_nonexecuting(decision, result, outcome, reason)
                    self.assertEqual(decision.handoff_target, target)
                    expected.append((proposal, DENIED_KINDS, "v1"))
                self.assertFalse((root / "frontend").exists())
                self.assert_audit(runtime, root, expected)

    def test_scalar_restriction_regression_rejects_before_runtime_authorization(self):
        for factory in FACTORIES:
            with self.subTest(adapter=factory.__name__), self.fixture(factory) as fixture:
                adapter, runtime, root, backend, frontend, stale, unknown, boundary = fixture
                runtime.update_boundary(replace(boundary, required_approvals={"write_file"}))
                for field, scalar in (("deny_scope", "backend/private/"), ("required_approvals", "write_file"),
                                      ("deny_scope", b"backend/private/"), ("required_approvals", bytearray(b"write_file"))):
                    with self.subTest(field=field, scalar_type=type(scalar).__name__), self.assertRaises(ValueError):
                        replace(boundary, **{field: scalar})
                denied = self.proposal(adapter, backend, "backend/private/key.txt", "restriction-deny")
                approved = self.proposal(adapter, backend, proposal_id="restriction-approval")
                self.assert_nonexecuting(*runtime.submit(denied), Outcome.DENY, "explicit_deny")
                self.assert_nonexecuting(*runtime.submit(approved), Outcome.REQUIRE_APPROVAL, "approval_required")
                self.assertFalse((root / "backend").exists())
                self.assert_audit(runtime, root, [(denied, DENIED_KINDS, "v1"), (approved, DENIED_KINDS, "v1")])

    def test_prepare_execute_single_use_and_modified_content_binding(self):
        for factory in FACTORIES:
            with self.subTest(adapter=factory.__name__), self.fixture(factory) as fixture:
                adapter, runtime, root, backend, frontend, stale, unknown, boundary = fixture
                proposal = self.proposal(adapter, backend)
                decision, permit = runtime.prepare(proposal)
                self.assertEqual(decision.outcome, Outcome.ALLOW)
                self.assertIsInstance(permit, ExecutionPermit)
                self.assertFalse((root / "backend").exists())
                self.assert_audit(runtime, root, [(proposal, ("proposal", "decision"), "v1")])
                altered = replace(proposal, content="modified integration content")
                self.assertFalse(runtime.execute(altered, permit).observed_mutation)
                self.assertFalse(runtime.execute(proposal, permit).observed_mutation)
                self.assertFalse(runtime.execute(proposal, ExecutionPermit(object())).observed_mutation)
                self.assertFalse((root / "backend").exists())
                decision, fresh = runtime.prepare(proposal)
                self.assertTrue(runtime.execute(proposal, fresh).success)
                self.assertFalse(runtime.execute(proposal, fresh).observed_mutation)
                self.assertEqual(runtime.read_file(proposal.resource), SECRET_CONTENT)
                self.assertEqual((root / proposal.resource).read_text(encoding="utf-8"), SECRET_CONTENT)
                self.assert_audit(runtime, root, [
                    (proposal, ("proposal", "decision"), "v1"),
                    (altered, ("mutation_failure",), "v1"),
                    (proposal, ("mutation_failure", "mutation_failure"), "v1"),
                    (proposal, ALLOWED_KINDS, "v1"), (proposal, ("mutation_failure",), "v1")])

    def test_trusted_state_transitions_and_roundtrips_revoke_old_permits(self):
        for factory in FACTORIES:
            with self.subTest(adapter=factory.__name__), self.fixture(factory) as fixture:
                adapter, runtime, root, backend, frontend, stale, unknown, boundary = fixture
                expected = []
                for transition in ("task", "boundary", "version"):
                    proposal = self.proposal(adapter, backend, proposal_id="transition-" + transition)
                    decision, permit = runtime.prepare(proposal)
                    self.assertEqual(decision.outcome, Outcome.ALLOW)
                    expected.append((proposal, ("proposal", "decision"), "v1"))
                    if transition == "task":
                        runtime.set_task_status(backend.task_id, "completed")
                        reason = "task_inactive"
                    if transition == "boundary":
                        runtime.update_boundary(replace(boundary, write_scope=()))
                        reason = "outside_write_scope"
                    if transition == "version":
                        runtime.update_version("v2")
                        reason = "version_mismatch"
                    result = runtime.execute(proposal, permit)
                    self.assertEqual((result.status, result.reason, result.observed_mutation), ("denied", reason, False))
                    version = "v1"
                    if transition == "version":
                        version = "v2"
                    expected.append((proposal, ("decision", "mutation_failure"), version))
                    if transition == "task":
                        runtime.set_task_status(backend.task_id, "active")
                    if transition == "boundary":
                        runtime.update_boundary(boundary)
                    if transition == "version":
                        runtime.update_version("v1")
                    self.assertFalse(runtime.execute(proposal, permit).observed_mutation)
                    expected.append((proposal, ("mutation_failure",), "v1"))
                self.assertFalse((root / "backend").exists())
                self.assert_audit(runtime, root, expected)

    def test_existing_non_directory_parent_preserved_before_write(self):
        for factory in FACTORIES:
            with self.subTest(adapter=factory.__name__), self.fixture(factory) as fixture:
                adapter, runtime, root, backend, frontend, stale, unknown, boundary = fixture
                proposal = self.proposal(adapter, backend)
                (root / "backend").mkdir()
                (root / "backend/new").write_text("existing non-directory", encoding="utf-8")
                decision, result = runtime.submit(proposal)
                self.assertEqual(decision.outcome, Outcome.ALLOW)
                self.assertEqual((result.success, result.status, result.observed_mutation), (False, "denied", False))
                self.assertEqual((root / "backend/new").read_text(encoding="utf-8"), "existing non-directory")
                self.assert_audit(runtime, root, [(proposal, DENIED_KINDS, "v1")])

    def test_replace_failure_preserves_previous_content_and_records_failure(self):
        for factory in FACTORIES:
            with self.subTest(adapter=factory.__name__), self.fixture(factory) as fixture:
                adapter, runtime, root, backend, frontend, stale, unknown, boundary = fixture
                original = self.proposal(adapter, backend, content="original backend")
                self.assertTrue(runtime.submit(original)[1].success)
                attempted = self.proposal(adapter, backend, proposal_id="replace-failure")
                with patch("os.replace", side_effect=OSError("integration-private-error")):
                    decision, result = runtime.submit(attempted)
                self.assertEqual(decision.outcome, Outcome.ALLOW)
                self.assertEqual((result.success, result.status, result.observed_mutation, result.audit_failed),
                                 (False, "failed", False, False))
                self.assertEqual(runtime.read_file(original.resource), "original backend")
                self.assertEqual((root / original.resource).read_text(encoding="utf-8"), "original backend")
                self.assertEqual([path.name for path in (root / "backend/new").iterdir()], ["file.txt"])
                self.assert_audit(runtime, root, [(original, ALLOWED_KINDS, "v1"),
                    (attempted, ("proposal", "decision", "mutation_intent", "mutation_failure"), "v1")])
                self.assertNotIn("integration-private-error", (root / ".ans/events/index.jsonl").read_text(encoding="utf-8"))

    def test_actual_intent_append_failure_prevents_directory_creation(self):
        for factory in FACTORIES:
            with self.subTest(adapter=factory.__name__), self.fixture(factory) as fixture:
                adapter, runtime, root, backend, frontend, stale, unknown, boundary = fixture
                proposal = self.proposal(adapter, backend)
                original_open = Path.open
                def failed_append(path, mode="r", *args, **kwargs):
                    if path == root / ".ans/events/index.jsonl" and mode == "a":
                        raise OSError("integration-private-error")
                    return original_open(path, mode, *args, **kwargs)
                # Prepare the real permit before failing the next infrastructure append.
                decision, permit = runtime.prepare(proposal)
                with patch.object(Path, "open", failed_append):
                    result = runtime.execute(proposal, permit)
                self.assertEqual((result.success, result.status, result.audit_failed, result.observed_mutation),
                                 (False, "audit_failed", True, False))
                self.assertFalse((root / "backend").exists())
                self.assert_audit(runtime, root, [(proposal, ("proposal", "decision"), "v1")])
                self.assertNotIn("integration-private-error", (root / ".ans/events/index.jsonl").read_text(encoding="utf-8"))

    def test_result_audit_failure_reports_real_write_and_blocks_next_action(self):
        for factory in FACTORIES:
            with self.subTest(adapter=factory.__name__), self.fixture(factory) as fixture:
                adapter, runtime, root, backend, frontend, stale, unknown, boundary = fixture
                proposal = self.proposal(adapter, backend)
                decision, permit = runtime.prepare(proposal)
                original_open = Path.open
                daily_appends = []
                def fail_result_daily(path, mode="r", *args, **kwargs):
                    if path.parent == root / ".ans/events" and path.name != "index.jsonl" and mode == "a":
                        daily_appends.append(path)
                        if len(daily_appends) == 2:
                            raise OSError("integration-private-error")
                    return original_open(path, mode, *args, **kwargs)
                with patch.object(Path, "open", fail_result_daily):
                    result = runtime.execute(proposal, permit)
                self.assertEqual((result.success, result.status, result.audit_failed, result.observed_mutation),
                                 (False, "audit_failed", True, True))
                self.assertEqual(runtime.read_file(proposal.resource), SECRET_CONTENT)
                self.assertEqual((root / proposal.resource).read_text(encoding="utf-8"), SECRET_CONTENT)
                with self.assertRaises(MutationError):
                    runtime.events()
                subsequent = self.proposal(adapter, backend, "backend/after/file.txt", "after-audit-failure")
                next_decision, next_result = runtime.submit(subsequent)
                self.assertEqual(next_decision.reason, "audit_unavailable")
                self.assertEqual((next_result.audit_failed, next_result.observed_mutation), (True, False))
                self.assertFalse((root / "backend/after").exists())
                index_text = (root / ".ans/events/index.jsonl").read_text(encoding="utf-8")
                records = [json.loads(line) for line in index_text.splitlines()]
                self.assertEqual([record["kind"] for record in records], list(ALLOWED_KINDS))
                self.assertEqual(records[-1]["observed_mutation"], True)
                self.assertNotIn("integration-private-error", index_text)
                self.assertNotIn("integration-body", index_text)

    def test_original_interface_demo_runs_connected_runtime_regression(self):
        report = run_demo()
        self.assertTrue(report["backend_written"])
        self.assertTrue(report["frontend_preserved"])
        observations = report["observations"]
        self.assertEqual([item["decision"] for item in observations], ["ALLOW", "DENY", "DENY", "DENY", "DENY", "DENY"])
        self.assertEqual([item["status"] for item in observations], ["written", "denied", "denied", "denied", "denied", "denied"])
        self.assertEqual([item["observed_mutation"] for item in observations], [True, False, False, False, False, False])
        self.assertEqual([item["reason"] for item in observations], ["within_boundary", "outside_write_scope",
            "unsupported_action_tool_or_capability", "unsupported_action_tool_or_capability", "explicit_deny", "version_mismatch"])
        events = report["events"]
        self.assertEqual(len(events), 23)
        self.assertEqual([event["sequence"] for event in events], list(range(1, 24)))
        self.assertEqual([event["kind"] for event in events], list(ALLOWED_KINDS) * 2 + list(DENIED_KINDS) * 5)
        for event in events:
            self.assertEqual(datetime.fromisoformat(event["recorded_at"]).utcoffset(), timedelta(hours=8))
            self.assertNotIn("content", event)


if __name__ == "__main__":
    unittest.main()
