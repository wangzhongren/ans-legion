"""Controlled local runtime. Private authority is never returned by this API."""
from threading import RLock
from kernel.models.core import (ActionProposal, AgentSession, RoleBoundary, Outcome,
    PolicyDecision, MutationResult, Event, _RuntimeAuthority)
from kernel.services.public.policy import create_policy_service
from kernel.services.public.mutation import create_mutation_service, MutationError


class PermissionRuntime:
    def __init__(self, workspace, boundaries, sessions, organization_version):
        boundary_values = boundaries
        session_values = sessions
        if isinstance(boundaries, dict):
            boundary_values = boundaries.values()
        if isinstance(sessions, dict):
            session_values = sessions.values()
        boundary_map = {}
        session_map = {}
        for boundary in boundary_values:
            if not isinstance(boundary, RoleBoundary) or boundary.role_id in boundary_map:
                raise ValueError("invalid_or_duplicate_boundary")
            boundary_map[boundary.role_id] = boundary
        for session in session_values:
            if not isinstance(session, AgentSession) or session.session_id in session_map:
                raise ValueError("invalid_or_duplicate_session")
            session_map[session.session_id] = session
        if not isinstance(organization_version, str) or not organization_version:
            raise ValueError("invalid_version")
        self.__authority = _RuntimeAuthority(session_map, boundary_map, organization_version)
        self.__policy = create_policy_service()
        self.__mutation = create_mutation_service(workspace, _authority=self.__authority)
        self.__lock = RLock()
        self.__closed = False

    def _evaluate(self, proposal):
        sessions, boundaries, version, tasks = self.__authority.snapshot()
        if not isinstance(proposal, ActionProposal):
            return self.__policy.evaluate(proposal,None,None,version,"inactive",tuple(boundaries))
        session = proposal.session
        return self.__policy.evaluate(proposal,boundaries.get(session.role_id),
            sessions.get(session.session_id),version,tasks.get(session.task_id,"unknown"),tuple(boundaries))

    @staticmethod
    def _event(proposal, kind, decision=None, reason="", observed=False):
        outcome = ""
        if decision is not None:
            outcome = decision.outcome.value
            reason = decision.reason
        if not isinstance(proposal, ActionProposal):
            return Event(0,kind,"","","","","","",outcome,reason,observed)
        session = proposal.session
        version = session.organization_version
        if decision is not None:
            version = decision.organization_version
        return Event(0,kind,session.role_id,session.task_id,version,
            proposal.resource,proposal.digest,proposal.proposal_id,outcome,reason,observed)

    @staticmethod
    def _result(proposal, status, reason, observed=False, audit_failed=False):
        resource = ""
        digest = ""
        if isinstance(proposal, ActionProposal):
            resource = proposal.resource
            digest = proposal.digest
        return MutationResult(False,status,reason,resource,digest,observed,audit_failed)

    def prepare(self, proposal):
        """Audit and decide. Return decision and opaque single-use permit or None."""
        with self.__lock:
            decision = self._evaluate(proposal)
            if self.__closed:
                return PolicyDecision(Outcome.DENY,"runtime_closed",decision.proposal_digest,decision.organization_version),None
            try:
                self.__mutation.record_event(self._event(proposal,"proposal"))
                self.__mutation.record_event(self._event(proposal,"decision",decision))
            except MutationError:
                return PolicyDecision(Outcome.DENY,"audit_unavailable",decision.proposal_digest,decision.organization_version,decision.boundary_digest),None
            if decision.outcome != Outcome.ALLOW:
                return decision,None
            try:
                return decision,self.__authority.issue(proposal,decision)
            except (PermissionError, ValueError):
                return PolicyDecision(Outcome.DENY,"authorization_changed",decision.proposal_digest,decision.organization_version),None

    def _failure_event(self, proposal, result):
        try:
            self.__mutation.record_event(self._event(proposal,"mutation_failure",reason=result.reason,observed=result.observed_mutation))
        except MutationError:
            return self._result(proposal,"audit_failed","result_audit_failed",result.observed_mutation,True)
        return result

    def execute(self, proposal, permit=None):
        """Recheck current policy and consume the permit; never accept a decision."""
        with self.__lock:
            if self.__closed:
                return self._result(proposal,"denied","runtime_closed")
            decision = self._evaluate(proposal)
            if decision.outcome != Outcome.ALLOW:
                try:
                    self.__mutation.record_event(self._event(proposal,"decision",decision))
                except MutationError:
                    return self._result(proposal,"audit_failed","decision_audit_failed",audit_failed=True)
                return self._failure_event(proposal,self._result(proposal,"denied",decision.reason))
            result = self.__mutation.execute(proposal,permit)
            if result.status == "denied":
                return self._failure_event(proposal,result)
            return result

    def submit(self, proposal):
        """Complete proposal → decision → mutation workflow."""
        with self.__lock:
            decision, permit = self.prepare(proposal)
            if decision.outcome != Outcome.ALLOW:
                if decision.reason == "audit_unavailable":
                    return decision,self._result(proposal,"audit_failed","proposal_or_decision_audit_failed",audit_failed=True)
                if decision.reason == "runtime_closed":
                    return decision,self._result(proposal,"denied",decision.reason)
                return decision,self._failure_event(proposal,self._result(proposal,"denied",decision.reason))
            return decision,self.execute(proposal,permit)

    def update_version(self, organization_version):
        with self.__lock:
            self.__authority.update_version(organization_version)

    def update_boundary(self, boundary):
        if not isinstance(boundary, RoleBoundary):
            raise ValueError("invalid_boundary")
        with self.__lock:
            self.__authority.update_boundary(boundary)

    def set_task_status(self, task_id, status):
        with self.__lock:
            self.__authority.update_task(task_id,status)

    def events(self):
        with self.__lock:
            return self.__mutation.events()

    def read_file(self, resource):
        with self.__lock:
            return self.__mutation.read_file(resource)

    def close(self):
        with self.__lock:
            if not self.__closed:
                self.__mutation.close()
                self.__closed = True

    def __enter__(self):
        return self

    def __exit__(self, exception_type, exception, traceback):
        self.close()


__all__ = ["PermissionRuntime"]
