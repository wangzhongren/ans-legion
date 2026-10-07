"""Immutable Legion contracts and internal authorization invariants; no effects."""
from dataclasses import dataclass, field
from enum import Enum
import hashlib
import json


def _nonempty(value, name):
    if not isinstance(value, str) or not value.strip():
        raise ValueError(name + " must be a nonempty string")


def _collection(values, name, representation):
    if isinstance(values, (str, bytes, bytearray)):
        raise ValueError(name + " must be a collection, not a scalar string")
    try:
        return representation(values)
    except TypeError as error:
        raise ValueError(name + " must be a collection") from error


class Outcome(str, Enum):
    ALLOW = "ALLOW"
    DENY = "DENY"
    REQUIRE_APPROVAL = "REQUIRE_APPROVAL"
    REQUIRE_HANDOFF = "REQUIRE_HANDOFF"
    REQUIRE_SCOPE_EXPANSION = "REQUIRE_SCOPE_EXPANSION"


@dataclass(frozen=True)
class RoleBoundary:
    role_id: str
    read_scope: tuple[str, ...] = ()
    write_scope: tuple[str, ...] = ()
    deny_scope: tuple[str, ...] = ()
    capabilities: frozenset[str] = frozenset()
    tools: frozenset[str] = frozenset()
    required_approvals: frozenset[str] = frozenset()
    handoff_targets: tuple[str, ...] = ()
    allow_scope_expansion: bool = False

    def __post_init__(self):
        _nonempty(self.role_id, "role_id")
        for name in ("read_scope", "write_scope", "deny_scope", "handoff_targets"):
            values = _collection(getattr(self, name), name, tuple)
            for value in values:
                _nonempty(value, name)
            object.__setattr__(self, name, values)
        for name in ("capabilities", "tools", "required_approvals"):
            values = _collection(getattr(self, name), name, frozenset)
            for value in values:
                _nonempty(value, name)
            object.__setattr__(self, name, values)
        for approval in self.required_approvals:
            if approval != "write_file":
                normalize_resource(approval)
        if not isinstance(self.allow_scope_expansion, bool):
            raise ValueError("allow_scope_expansion must be boolean")

    @property
    def digest(self):
        data = {"role": self.role_id, "read": self.read_scope, "write": self.write_scope,
                "deny": self.deny_scope, "capabilities": sorted(self.capabilities),
                "tools": sorted(self.tools), "approvals": sorted(self.required_approvals),
                "handoff": self.handoff_targets, "expansion": self.allow_scope_expansion}
        return _digest(data)


@dataclass(frozen=True)
class AgentSession:
    session_id: str
    role_id: str
    task_id: str
    organization_version: str

    def __post_init__(self):
        for name in ("session_id", "role_id", "task_id", "organization_version"):
            _nonempty(getattr(self, name), name)


@dataclass(frozen=True)
class ActionProposal:
    proposal_id: str
    action: str
    resource: str
    content: str
    tool: str
    capability: str
    session: AgentSession

    def __post_init__(self):
        for name in ("proposal_id", "action", "resource", "tool", "capability"):
            _nonempty(getattr(self, name), name)
        if not isinstance(self.content, str) or not isinstance(self.session, AgentSession):
            raise ValueError("content must be text and session must be AgentSession")

    @property
    def content_digest(self):
        return hashlib.sha256(self.content.encode("utf-8")).hexdigest()

    @property
    def digest(self):
        session = self.session
        return _digest([self.proposal_id, self.action, self.resource, self.content_digest,
                        self.tool, self.capability, session.session_id, session.role_id,
                        session.task_id, session.organization_version])


def _digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=True, sort_keys=True,
                                     separators=(",", ":")).encode()).hexdigest()


def normalize_resource(resource):
    """Platform independent lexical gate; actual filesystem gate is Provider owned."""
    if not isinstance(resource, str) or not resource or "\x00" in resource:
        raise ValueError("invalid_resource")
    normalized = resource.replace("\\", "/")
    if normalized.startswith("/") or ":" in normalized:
        raise ValueError("absolute_resource")
    parts = normalized.split("/")
    if any(part in ("", ".", "..") or part.rstrip(" .") != part for part in parts):
        raise ValueError("invalid_component")
    if any(part.casefold().split(".")[0] in {"con", "prn", "aux", "nul", *["com"+str(n) for n in range(1,10)], *["lpt"+str(n) for n in range(1,10)]} for part in parts):
        raise ValueError("reserved_component")
    if parts[0].casefold() in {".ans", ".git", ".agents", ".codex", ".aws"}:
        raise ValueError("control_plane")
    return "/".join(parts)


def scope_contains(scope, resource):
    try:
        candidate = normalize_resource(resource).casefold()
        allowed = normalize_resource(scope.rstrip("/")).casefold()
    except ValueError:
        return False
    if scope.endswith("/"):
        return candidate.startswith(allowed + "/")
    return candidate == allowed


def requires_approval(boundary, action, resource):
    """Shared canonical resource identity for policy and permit revalidation."""
    if action in boundary.required_approvals:
        return True
    candidate = normalize_resource(resource).casefold()
    for approval in boundary.required_approvals:
        if approval == "write_file":
            continue
        if normalize_resource(approval).casefold() == candidate:
            return True
    return False


@dataclass(frozen=True)
class PolicyDecision:
    outcome: Outcome
    reason: str
    proposal_digest: str
    organization_version: str
    boundary_digest: str = ""
    handoff_target: str = ""


@dataclass(frozen=True)
class ExecutionPermit:
    """Opaque handle. Construction creates no authority."""
    token: object = field(repr=False)


@dataclass(frozen=True)
class MutationResult:
    success: bool
    status: str
    reason: str
    resource: str
    proposal_digest: str
    observed_mutation: bool = False
    audit_failed: bool = False


@dataclass(frozen=True)
class Event:
    sequence: int
    kind: str
    role_id: str
    task_id: str
    organization_version: str
    resource: str
    proposal_digest: str
    correlation_id: str
    outcome: str = ""
    reason: str = ""
    observed_mutation: bool = False
    recorded_at: str = ""


class _RuntimeAuthority:
    """Private runtime-owned state, pure invariants; no Service callbacks or effects."""
    def __init__(self, sessions, boundaries, version):
        self.__sessions = dict(sessions)
        self.__boundaries = dict(boundaries)
        self.__version = version
        self.__tasks = {session.task_id: "active" for session in sessions.values()}
        self.__permits = {}

    def snapshot(self):
        return dict(self.__sessions), dict(self.__boundaries), self.__version, dict(self.__tasks)

    def update_version(self, version):
        _nonempty(version, "version")
        self.__version = version
        self.__permits.clear()

    def update_boundary(self, boundary):
        self.__boundaries[boundary.role_id] = boundary
        self.__permits.clear()

    def update_task(self, task_id, status):
        if status not in {"active", "completed", "cancelled"}:
            raise ValueError("invalid_task_status")
        self.__tasks[task_id] = status
        self.__permits.clear()

    def issue(self, proposal, decision):
        if decision.outcome != Outcome.ALLOW or decision.proposal_digest != proposal.digest:
            raise PermissionError("allow_required")
        self._validate(proposal, decision.boundary_digest, decision.organization_version)
        permit = ExecutionPermit(object())
        self.__permits[permit.token] = (permit, proposal.digest, decision.boundary_digest, decision.organization_version)
        return permit

    def _validate(self, proposal, boundary_digest, version):
        session = proposal.session
        if self.__sessions.get(session.session_id) is not session:
            raise PermissionError("identity_changed")
        if self.__tasks.get(session.task_id) != "active":
            raise PermissionError("task_inactive")
        if version != self.__version or session.organization_version != self.__version:
            raise PermissionError("version_changed")
        boundary = self.__boundaries.get(session.role_id)
        if boundary is None or boundary.digest != boundary_digest:
            raise PermissionError("boundary_changed")
        normalize_resource(proposal.resource)
        if proposal.action != "write_file" or proposal.tool != "legion_write_file" or proposal.capability != "write_file":
            raise PermissionError("unsupported_action")
        if proposal.tool not in boundary.tools or proposal.capability not in boundary.capabilities:
            raise PermissionError("capability_changed")
        if any(scope_contains(scope, proposal.resource) for scope in boundary.deny_scope):
            raise PermissionError("explicit_deny")
        if not any(scope_contains(scope, proposal.resource) for scope in boundary.write_scope):
            raise PermissionError("outside_write_scope")
        if requires_approval(boundary, proposal.action, proposal.resource):
            raise PermissionError("approval_required")

    def consume(self, proposal, permit):
        if not isinstance(permit, ExecutionPermit):
            raise PermissionError("invalid_permit")
        try:
            recorded = self.__permits.pop(permit.token, None)
        except TypeError as error:
            raise PermissionError("invalid_permit") from error
        if recorded is None or recorded[0] is not permit:
            raise PermissionError("invalid_or_replayed_permit")
        if proposal.digest != recorded[1]:
            raise PermissionError("proposal_changed")
        self._validate(proposal, recorded[2], recorded[3])


__all__ = ["RoleBoundary", "AgentSession", "ActionProposal", "PolicyDecision", "Outcome",
           "ExecutionPermit", "MutationResult", "Event", "normalize_resource", "scope_contains", "requires_approval"]
