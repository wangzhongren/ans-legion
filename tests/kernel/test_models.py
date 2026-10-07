import unittest
from dataclasses import FrozenInstanceError, replace
from kernel.models.core import AgentSession, ActionProposal, RoleBoundary, normalize_resource, scope_contains

class ModelTests(unittest.TestCase):
    def setUp(self):
        self.session = AgentSession("s", "Backend", "task", "v1")
        self.proposal = ActionProposal("p", "write_file", "backend/a.py", "ok", "legion_write_file", "write_file", self.session)

    def test_session_immutable(self):
        with self.assertRaises(FrozenInstanceError):
            self.session.role_id = "Admin"

    def test_invalid_models(self):
        with self.assertRaises(ValueError):
            AgentSession("", "Backend", "task", "v1")
        with self.assertRaises(ValueError):
            replace(self.proposal, content=b"bytes")

    def test_digest_binds_every_input(self):
        for changes in ({"content":"other"},{"resource":"backend/b.py"},{"proposal_id":"q"},{"session":replace(self.session,task_id="other")},{"tool":"other"}):
            self.assertNotEqual(self.proposal.digest, replace(self.proposal, **changes).digest)

    def test_boundary_copies_mutable_input(self):
        values=["backend/"]
        boundary=RoleBoundary("Backend", write_scope=values)
        values.append("frontend/")
        self.assertEqual(boundary.write_scope,("backend/",))

    def test_collection_fields_reject_scalar_strings_and_noncollections(self):
        fields=("read_scope","write_scope","deny_scope","handoff_targets","capabilities","tools","required_approvals")
        for name in fields:
            for value in ("write_file", "", b"write_file", bytearray(b"write_file"), None, 7):
                with self.subTest(field=name,value=value), self.assertRaises(ValueError):
                    RoleBoundary("Backend",**{name:value})

    def test_approval_conditions_validate_relative_resource(self):
        for resource in ("../backend/a", "C:/backend/a", "/backend/a", ".ANS/organization/file", "backend//a", "backend/a. "):
            with self.subTest(resource=resource), self.assertRaises(ValueError):
                RoleBoundary("Backend",required_approvals={resource})
        boundary=RoleBoundary("Backend",required_approvals={"write_file", "BACKEND\\APPROVED.TXT"})
        self.assertEqual(boundary.required_approvals,frozenset({"write_file","BACKEND\\APPROVED.TXT"}))

    def test_lexical_path_and_scope(self):
        self.assertTrue(scope_contains("BACKEND/", "backend/file.py"))
        self.assertFalse(scope_contains("backend/", "backend-other/file.py"))
        for resource in ("../outside", "C:/outside", "/absolute", ".ANS/organization/x", ".git/config", "backend/a. ", "backend/CON.txt", "backend//a"):
            with self.subTest(resource=resource), self.assertRaises(ValueError):
                normalize_resource(resource)

if __name__ == "__main__":
    unittest.main()
