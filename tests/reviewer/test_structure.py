"""Independent architecture and normal-public-API security regressions."""
import ast
from dataclasses import FrozenInstanceError, replace
from datetime import datetime, timedelta
import importlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from adapters.services.public.proposal import create_codex_adapter, create_claude_adapter
from kernel.models.core import (ActionProposal, AgentSession, Event, ExecutionPermit,
                                Outcome, PolicyDecision, RoleBoundary)
from kernel.pipelines.permission import PermissionRuntime
from kernel.providers.public.storage import create_storage_provider, StorageError
from kernel.services.public.mutation import create_mutation_service, MutationError

PROJECT = Path(__file__).resolve().parents[2]


class StructureTests(unittest.TestCase):
    def test_layer_edges_and_model_effects(self):
        for path in sorted((PROJECT / "src").rglob("*.py")):
            tree = ast.parse(path.read_text(encoding="utf-8"))
            relative = path.relative_to(PROJECT / "src").as_posix()
            for node in ast.walk(tree):
                imports = []
                if isinstance(node, ast.Import):
                    imports = [alias.name for alias in node.names]
                if isinstance(node, ast.ImportFrom):
                    imports = [node.module or ""]
                    self.assertFalse(any(alias.name == "*" for alias in node.names), relative)
                for module in imports:
                    with self.subTest(path=relative, module=module):
                        if relative.startswith("kernel/models/"):
                            self.assertNotIn(module.split(".")[0],
                                             {"os", "time", "datetime", "random", "secrets", "uuid", "tempfile", "pathlib", "subprocess", "socket", "threading"})
                            self.assertFalse(module.startswith(("kernel.services", "kernel.providers", "kernel.pipelines", "kernel.interface", "adapters")))
                        if relative.startswith("kernel/interface/"):
                            self.assertFalse(module.startswith(("kernel.services", "kernel.providers")))
                        if relative.startswith("kernel/pipelines/"):
                            self.assertFalse(module.startswith(("kernel.providers", "kernel.interface")))
                            if module.startswith("kernel.services"):
                                self.assertIn(".public.", module)
                        if "/services/impl/" in relative:
                            self.assertNotIn(module.split(".")[0], {"os", "tempfile", "pathlib", "subprocess", "socket", "datetime"})
                            self.assertFalse(module.startswith(("kernel.pipelines", "kernel.interface")))
                            if module.startswith("kernel.providers"):
                                self.assertIn(".public.", module)
                        if relative.startswith("kernel/providers/"):
                            self.assertFalse(module.startswith(("kernel.services", "kernel.pipelines", "kernel.interface")))
                        if relative.startswith("adapters/") and module.startswith("kernel."):
                            self.assertEqual(module, "kernel.models.core")
                        if "/abstract/" in relative:
                            self.assertNotIn(".impl.", module)
                            self.assertNotIn(".public.", module)

    def test_no_ternary_or_swallowed_exception_or_foreign_private_fields(self):
        for path in (PROJECT / "src").rglob("*.py"):
            for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
                self.assertNotIsInstance(node, ast.IfExp, str(path))
                if isinstance(node, ast.ExceptHandler):
                    self.assertFalse(all(isinstance(item, ast.Pass) for item in node.body), str(path))
                if isinstance(node, ast.Attribute) and node.attr.startswith("__") and not node.attr.endswith("__"):
                    self.assertIsInstance(node.value, ast.Name, str(path))
                    self.assertEqual(node.value.id, "self", str(path))

    def test_public_exports_are_supported_contracts_and_factories(self):
        expected = {
            "kernel.services.public.policy": {"PolicyService", "create_policy_service"},
            "kernel.services.public.mutation": {"MutationService", "MutationError", "create_mutation_service"},
            "kernel.providers.public.storage": {"StorageProvider", "StorageError", "create_storage_provider"},
            "adapters.services.public.proposal": {"ProposalService", "create_codex_adapter", "create_claude_adapter"},
        }
        for name, exports in expected.items():
            module = importlib.import_module(name)
            self.assertEqual(set(module.__all__), exports)
            self.assertEqual({item for item in vars(module) if not item.startswith("_")}, exports)

    def test_single_exact_source_owner_and_three_part_layers(self):
        configuration = json.loads((PROJECT / ".ans/project.json").read_text(encoding="utf-8"))
        for path in (PROJECT / "src").rglob("*.py"):
            relative = path.relative_to(PROJECT).as_posix()
            owners = [role for role, config in configuration["roles"].items() if relative in config["writeFiles"]]
            self.assertEqual(len(owners), 1, relative)
            if "/services/" in relative or "/providers/" in relative:
                self.assertIn(path.parent.name, {"abstract", "public", "impl"})
                for subdivision in ("abstract", "public", "impl"):
                    self.assertTrue((path.parent.parent / subdivision / path.name).is_file())

    def test_mutation_has_no_policy_callbacks_or_peer_service_calls(self):
        path = PROJECT / "src/kernel/services/impl/mutation.py"
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module.startswith("kernel.services"):
                self.assertEqual(node.module, "kernel.services.abstract.mutation")
            if isinstance(node, ast.Name):
                self.assertNotIn(node.id, {"policy", "evaluate", "policy_callback", "PermissionRuntime"})


class PublicSecurityTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="legion-review-", dir=str(PROJECT.parent))
        self.root = Path(self.temporary.name)
        self.session = AgentSession("session", "Backend", "task", "v1")
        self.boundary = RoleBoundary("Backend", write_scope=("backend/",),
                                     deny_scope=("backend/private/",),
                                     capabilities={"write_file"}, tools={"legion_write_file"})
        self.proposal = ActionProposal("proposal", "write_file", "backend/new/file.txt", "secret-review-content",
                                       "legion_write_file", "write_file", self.session)
        self.runtime = PermissionRuntime(self.root, [self.boundary], [self.session], "v1")

    def tearDown(self):
        self.runtime.close()
        self.temporary.cleanup()

    def test_raw_public_factories_cannot_mutate_with_forged_authority(self):
        fake = PolicyDecision(Outcome.ALLOW, "forged", self.proposal.digest, "v1", self.boundary.digest)
        for factory, operation in ((create_mutation_service, "execute"), (create_storage_provider, "write")):
            raw = factory(self.root)
            self.addCleanup(raw.close)
            for permit in (None, fake, ExecutionPermit(object()), ExecutionPermit([])):
                result = getattr(raw, operation)(self.proposal, permit)
                self.assertFalse(result.success)
                self.assertFalse(result.observed_mutation)
            self.assertFalse((self.root / "backend").exists())

    def test_raw_public_audit_append_requires_authority(self):
        event = Event(0, "proposal", "Backend", "task", "v1", "file", "digest", "correlation")
        provider = create_storage_provider(self.root)
        service = create_mutation_service(self.root)
        self.addCleanup(provider.close)
        self.addCleanup(service.close)
        with self.assertRaises(StorageError):
            provider.append_event(event)
        with self.assertRaises(MutationError):
            service.record_event(event)
        self.assertFalse((self.root / ".ans").exists())

    def test_runtime_rejects_forged_decision_permits_and_replay(self):
        fake = PolicyDecision(Outcome.ALLOW, "forged", self.proposal.digest, "v1", self.boundary.digest)
        for permit in (None, fake, ExecutionPermit(object()), ExecutionPermit([])):
            self.assertFalse(self.runtime.execute(self.proposal, permit).observed_mutation)
        decision, permit = self.runtime.prepare(self.proposal)
        self.assertEqual(decision.outcome, Outcome.ALLOW)
        self.assertTrue(self.runtime.execute(self.proposal, permit).success)
        self.assertFalse(self.runtime.execute(self.proposal, permit).success)
        self.assertEqual(self.runtime.read_file(self.proposal.resource), self.proposal.content)

    def test_permit_binds_content_resource_id_and_identity(self):
        for changes in ({"content": "other"}, {"resource": "backend/other.txt"}, {"proposal_id": "other"},
                        {"session": replace(self.session)}, {"session": replace(self.session, task_id="other")}):
            with self.subTest(changes=changes):
                decision, permit = self.runtime.prepare(self.proposal)
                self.assertEqual(decision.outcome, Outcome.ALLOW)
                self.assertFalse(self.runtime.execute(replace(self.proposal, **changes), permit).observed_mutation)
        self.assertFalse((self.root / "backend").exists())

    def test_session_is_frozen_and_registration_requires_object_identity(self):
        with self.assertRaises(FrozenInstanceError):
            self.session.role_id = "Admin"
        decision, result = self.runtime.submit(replace(self.proposal, session=replace(self.session)))
        self.assertEqual(decision.reason, "invalid_identity")
        self.assertFalse(result.observed_mutation)

    def test_adapter_claims_cannot_grant_authority(self):
        parameters = {"proposal_id": "adapter", "resource": "frontend/login.vue", "content": "bad",
                      "role_id": "Admin", "task_id": "privileged", "organization_version": "v999",
                      "capability": "admin", "action": "shell", "session": replace(self.session, role_id="Admin")}
        for factory in (create_codex_adapter, create_claude_adapter):
            proposal = factory().convert("legion_write_file", parameters, self.session)
            self.assertIs(proposal.session, self.session)
            self.assertEqual(proposal.capability, "write_file")
            decision, result = self.runtime.submit(proposal)
            self.assertEqual(decision.outcome, Outcome.DENY)
            self.assertFalse(result.observed_mutation)

    def test_default_boundary_has_no_write_scope(self):
        self.runtime.update_boundary(RoleBoundary("Backend", tools={"legion_write_file"}, capabilities={"write_file"}))
        decision, result = self.runtime.submit(self.proposal)
        self.assertEqual(decision.outcome, Outcome.DENY)
        self.assertFalse(result.observed_mutation)

    def test_scalar_restriction_fields_are_rejected_before_authorization(self):
        for field, value in (("deny_scope", "backend/private/"), ("required_approvals", "write_file")):
            with self.subTest(field=field), self.assertRaises(ValueError):
                RoleBoundary("Backend", write_scope=("backend/",), tools={"legion_write_file"},
                             capabilities={"write_file"}, **{field: value})

    def test_deny_first_and_case_separator_aliases(self):
        self.runtime.update_boundary(replace(self.boundary, required_approvals={"write_file"},
                                             handoff_targets=("Frontend",), allow_scope_expansion=True))
        for resource in ("backend/private/secret.txt", "BACKEND/PRIVATE/SECRET.TXT", "backend\\private\\secret.txt"):
            decision, result = self.runtime.submit(replace(self.proposal, resource=resource))
            self.assertEqual(decision.reason, "explicit_deny")
            self.assertEqual(decision.outcome, Outcome.DENY)
            self.assertFalse(result.observed_mutation)

    def test_path_approval_cannot_be_bypassed_by_case_or_separator(self):
        self.runtime.update_boundary(replace(self.boundary, required_approvals={"backend/approved.txt"}))
        for resource in ("backend/approved.txt", "BACKEND/APPROVED.TXT", "backend\\approved.txt"):
            with self.subTest(resource=resource):
                decision, result = self.runtime.submit(replace(self.proposal, resource=resource))
                self.assertEqual(decision.outcome, Outcome.REQUIRE_APPROVAL)
                self.assertFalse(result.observed_mutation)
        self.assertFalse((self.root / "backend").exists())

    def test_control_plane_absolute_traversal_and_devices_fail_closed(self):
        resources = (".ans/organization/file", ".ANS/events/index.jsonl", ".git/config", ".GIT/config",
                     ".agents/file", ".codex/config", ".aws/credentials", "../outside", "backend/../file",
                     "C:/outside", "/outside", "\\\\server\\share\\file", "backend/CON.txt", "backend/file. ")
        for resource in resources:
            with self.subTest(resource=resource):
                decision, result = self.runtime.submit(replace(self.proposal, resource=resource))
                self.assertEqual(decision.outcome, Outcome.DENY)
                self.assertFalse(result.observed_mutation)
        self.assertFalse((self.root / "backend").exists())

    def test_task_version_and_boundary_roundtrips_permanently_invalidate(self):
        for transition in ("task", "version", "boundary"):
            decision, permit = self.runtime.prepare(self.proposal)
            self.assertEqual(decision.outcome, Outcome.ALLOW)
            if transition == "task":
                self.runtime.set_task_status("task", "completed")
                self.runtime.set_task_status("task", "active")
            if transition == "version":
                self.runtime.update_version("v2")
                self.runtime.update_version("v1")
            if transition == "boundary":
                self.runtime.update_boundary(replace(self.boundary, write_scope=()))
                self.runtime.update_boundary(self.boundary)
            self.assertFalse(self.runtime.execute(self.proposal, permit).observed_mutation)
        self.assertFalse((self.root / "backend").exists())

    def test_business_target_reparse_detection(self):
        from kernel.providers.impl.storage import _LocalStorageProvider
        (self.root / "backend").mkdir()
        original = _LocalStorageProvider._linked
        def linked(path):
            if path.name == "backend":
                return True
            return original(path)
        with patch.object(_LocalStorageProvider, "_linked", staticmethod(linked)):
            decision, result = self.runtime.submit(self.proposal)
        self.assertEqual(decision.outcome, Outcome.ALLOW)
        self.assertFalse(result.observed_mutation)
        self.assertFalse((self.root / self.proposal.resource).exists())

    def test_event_index_daily_metadata_and_content_absence(self):
        decision, result = self.runtime.submit(self.proposal)
        self.assertTrue(result.success)
        self.runtime.submit(replace(self.proposal, resource="frontend/login.vue"))
        events = self.runtime.events()
        self.assertEqual([item.sequence for item in events], list(range(1, 8)))
        self.assertEqual([item.kind for item in events], ["proposal", "decision", "mutation_intent", "mutation_success", "proposal", "decision", "mutation_failure"])
        for event in events:
            self.assertEqual(datetime.fromisoformat(event.recorded_at).utcoffset(), timedelta(hours=8))
            self.assertEqual((event.role_id, event.task_id, event.organization_version), ("Backend", "task", "v1"))
            self.assertEqual(event.correlation_id, self.proposal.proposal_id)
        directory = self.root / ".ans/events"
        index = (directory / "index.jsonl").read_text(encoding="utf-8")
        daily = directory / (datetime.fromisoformat(events[0].recorded_at).date().isoformat() + ".jsonl")
        self.assertEqual(index, daily.read_text(encoding="utf-8"))
        self.assertNotIn(self.proposal.content, index)
        self.assertNotIn('"content"', index)

    def test_daily_index_split_closes_gate(self):
        self.assertTrue(self.runtime.submit(self.proposal)[1].success)
        event = self.runtime.events()[0]
        daily = self.root / ".ans/events" / (datetime.fromisoformat(event.recorded_at).date().isoformat() + ".jsonl")
        daily.write_text("", encoding="utf-8")
        with self.assertRaises(MutationError):
            self.runtime.events()
        decision, result = self.runtime.submit(replace(self.proposal, resource="backend/second/file.txt"))
        self.assertTrue(result.audit_failed)
        self.assertFalse(result.observed_mutation)
        self.assertFalse((self.root / "backend/second").exists())

    def test_intent_append_failure_creates_no_business_directory(self):
        original = Path.open
        appends = []
        def failing(path, *args, **kwargs):
            if args and args[0] == "a":
                appends.append(path.name)
                if len(appends) == 5:
                    raise OSError("private-review-error")
            return original(path, *args, **kwargs)
        with patch.object(Path, "open", failing):
            decision, result = self.runtime.submit(self.proposal)
        self.assertEqual(decision.outcome, Outcome.ALLOW)
        self.assertTrue(result.audit_failed)
        self.assertFalse(result.observed_mutation)
        self.assertFalse((self.root / "backend").exists())
        self.assertNotIn("private-review-error", (self.root / ".ans/events/index.jsonl").read_text(encoding="utf-8"))

    def test_result_daily_append_failure_reports_observed_mutation(self):
        original = Path.open
        appends = []
        def failing(path, *args, **kwargs):
            if args and args[0] == "a" and path.name != "index.jsonl":
                appends.append(path)
                if len(appends) == 4:
                    raise OSError("private-review-error")
            return original(path, *args, **kwargs)
        with patch.object(Path, "open", failing):
            decision, result = self.runtime.submit(self.proposal)
        self.assertFalse(result.success)
        self.assertTrue(result.audit_failed)
        self.assertTrue(result.observed_mutation)
        self.assertEqual(self.runtime.read_file(self.proposal.resource), self.proposal.content)
        next_result = self.runtime.submit(replace(self.proposal, resource="backend/after/file.txt"))[1]
        self.assertTrue(next_result.audit_failed)
        self.assertFalse(next_result.observed_mutation)
        self.assertFalse((self.root / "backend/after").exists())

    def test_audit_root_and_parent_reparse_fail_closed(self):
        from kernel.providers.impl.storage import _LocalStorageProvider
        (self.root / ".ans/events").mkdir(parents=True)
        original = _LocalStorageProvider._linked
        for target in (self.root, self.root / ".ans", self.root / ".ans/events"):
            def linked(path):
                if path == target:
                    return True
                return original(path)
            with self.subTest(target=target), patch.object(_LocalStorageProvider, "_linked", staticmethod(linked)):
                decision, result = self.runtime.submit(self.proposal)
                self.assertTrue(result.audit_failed)
                self.assertFalse(result.observed_mutation)
        self.assertFalse((self.root / "backend").exists())


if __name__ == "__main__":
    unittest.main()
