"""Shared Service contract exercised through both supported public factories."""
from collections import UserDict
from dataclasses import FrozenInstanceError
import builtins
import socket
import subprocess
import unittest
from unittest.mock import patch

from adapters.services.public import proposal as public_api
from adapters.services.public.proposal import (
    ProposalService, create_claude_adapter, create_codex_adapter,
)
from kernel.models.core import ActionProposal, AgentSession


FACTORIES = (create_codex_adapter, create_claude_adapter)


class SharedProposalContract(unittest.TestCase):
    def setUp(self):
        self.session = AgentSession("session-1", "Backend", "task-1", "legion-v1")
        self.parameters = {"proposal_id": "proposal-1", "resource": "backend/app.py",
                           "content": "print('你好')\n"}

    def test_factories_expose_own_service_contract_and_distinct_variants(self):
        codex = create_codex_adapter()
        claude = create_claude_adapter()
        self.assertIsInstance(codex, ProposalService)
        self.assertIsInstance(claude, ProposalService)
        self.assertIsNot(type(codex), type(claude))
        self.assertEqual(public_api.__all__,
                         ["ProposalService", "create_codex_adapter", "create_claude_adapter"])
        self.assertFalse(hasattr(public_api, "_CodexAdapter"))
        self.assertFalse(hasattr(public_api, "_ClaudeAdapter"))

    def test_conversion_preserves_exact_session_and_controlled_fields(self):
        for factory in FACTORIES:
            with self.subTest(factory=factory.__name__):
                result = factory().convert("legion_write_file", self.parameters, self.session)
                self.assertIsInstance(result, ActionProposal)
                self.assertIs(result.session, self.session)
                self.assertEqual(result.proposal_id, "proposal-1")
                self.assertEqual(result.resource, "backend/app.py")
                self.assertEqual(result.content, "print('你好')\n")
                self.assertEqual((result.action, result.tool, result.capability),
                                 ("write_file", "legion_write_file", "write_file"))

    def test_output_and_session_are_immutable(self):
        for factory in FACTORIES:
            with self.subTest(factory=factory.__name__):
                result = factory().convert("legion_write_file", self.parameters, self.session)
                with self.assertRaises(FrozenInstanceError):
                    result.content = "changed"
                with self.assertRaises(FrozenInstanceError):
                    result.session.role_id = "Admin"

    def test_same_input_has_stable_digest_across_both_variants(self):
        results = [factory().convert("legion_write_file", self.parameters, self.session)
                   for factory in FACTORIES]
        self.assertEqual(results[0].digest, results[1].digest)
        self.assertEqual(results[0].content_digest, results[1].content_digest)
        for factory in FACTORIES:
            self.assertEqual(factory().convert("legion_write_file", self.parameters,
                                              self.session).digest, results[0].digest)

    def test_authority_claims_cannot_override_trusted_input(self):
        claims = {"role_id": "Admin", "task_id": "other-task", "organization_version": "v999",
                  "session": AgentSession("fake", "Admin", "other", "v999"),
                  "session_id": "fake", "role": "Admin", "task": "other",
                  "action": "shell", "capability": "all", "tool": "shell", "unknown": object()}
        parameters = {**self.parameters, **claims}
        for factory in FACTORIES:
            with self.subTest(factory=factory.__name__):
                result = factory().convert("legion_write_file", parameters, self.session)
                expected = factory().convert("legion_write_file", self.parameters, self.session)
                self.assertIs(result.session, self.session)
                self.assertEqual(result.digest, expected.digest)
                self.assertEqual(result.action, "write_file")
                self.assertEqual(result.capability, "write_file")

    def test_empty_content_and_mapping_supported_without_normalization(self):
        parameters = UserDict({**self.parameters, "content": "", "resource": "backend\\app.py"})
        for factory in FACTORIES:
            with self.subTest(factory=factory.__name__):
                result = factory().convert("legion_write_file", parameters, self.session)
                self.assertEqual(result.content, "")
                self.assertEqual(result.resource, "backend\\app.py")

    def test_missing_required_fields_rejected(self):
        for factory in FACTORIES:
            for field_name in self.parameters:
                parameters = dict(self.parameters)
                del parameters[field_name]
                with self.subTest(factory=factory.__name__, field=field_name):
                    with self.assertRaises(ValueError):
                        factory().convert("legion_write_file", parameters, self.session)

    def test_invalid_field_types_and_empty_identity_rejected(self):
        invalid_values = {
            "proposal_id": (None, 1, True, [], {}, "", " \t"),
            "resource": (None, 1, True, [], {}, "", " \n"),
            "content": (None, 1, True, [], {}, b"text"),
        }
        for factory in FACTORIES:
            for field_name, values in invalid_values.items():
                for value in values:
                    with self.subTest(factory=factory.__name__, field=field_name, value=value):
                        with self.assertRaises(ValueError):
                            factory().convert("legion_write_file",
                                              {**self.parameters, field_name: value}, self.session)

    def test_invalid_parameter_container_rejected(self):
        for factory in FACTORIES:
            for parameters in (None, [], (), 1, True, "{}", b"{}"):
                with self.subTest(factory=factory.__name__, parameters=parameters):
                    with self.assertRaises(ValueError):
                        factory().convert("legion_write_file", parameters, self.session)

    def test_invalid_or_uncontrolled_tools_rejected(self):
        for factory in FACTORIES:
            for tool in (None, 1, True, [], {}, "", "shell", "write_file",
                         "LEGION_WRITE_FILE", "legion_write_file "):
                with self.subTest(factory=factory.__name__, tool=tool):
                    with self.assertRaises(ValueError):
                        factory().convert(tool, self.parameters, self.session)

    def test_invalid_session_types_rejected(self):
        for factory in FACTORIES:
            for session in (None, 1, True, "Backend", {},
                            {"session_id": "session-1", "role_id": "Backend",
                             "task_id": "task-1", "organization_version": "legion-v1"}):
                with self.subTest(factory=factory.__name__, session=session):
                    with self.assertRaises(ValueError):
                        factory().convert("legion_write_file", self.parameters, session)

    def test_malformed_session_identity_rejected(self):
        for factory in FACTORIES:
            for field_name in ("session_id", "role_id", "task_id", "organization_version"):
                for value in (None, 3, "", " \t"):
                    session = AgentSession("s", "Backend", "t", "legion-v1")
                    # Simulate a malformed host object; ordinary frozen assignment fails.
                    object.__setattr__(session, field_name, value)
                    with self.subTest(factory=factory.__name__, field=field_name, value=value):
                        with self.assertRaises(ValueError):
                            factory().convert("legion_write_file", self.parameters, session)

    def test_input_mutation_does_not_change_returned_proposal(self):
        for factory in FACTORIES:
            parameters = dict(self.parameters)
            result = factory().convert("legion_write_file", parameters, self.session)
            digest = result.digest
            self.assertEqual(parameters, self.parameters)
            parameters["content"] = "changed"
            parameters["resource"] = "frontend/login.vue"
            self.assertEqual(result.digest, digest)
            self.assertEqual(result.content, self.parameters["content"])

    def test_conversion_performs_no_file_network_or_process_effects(self):
        # Modules are already imported: the observed operation is factory + convert.
        with patch.object(builtins, "open", side_effect=AssertionError("file effect")), \
             patch.object(socket, "socket", side_effect=AssertionError("network effect")), \
             patch.object(subprocess, "Popen", side_effect=AssertionError("process effect")):
            for factory in FACTORIES:
                result = factory().convert("legion_write_file", self.parameters, self.session)
                self.assertIs(result.session, self.session)
                with self.assertRaises(ValueError):
                    factory().convert("shell", self.parameters, self.session)


if __name__ == "__main__":
    unittest.main()
