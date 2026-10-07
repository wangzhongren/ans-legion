"""Two local variants of one controlled-parameter contract, without vendor IO."""
from collections.abc import Mapping

from adapters.services.abstract.proposal import ProposalService
from kernel.models.core import ActionProposal, AgentSession


def _validate_session(session):
    if not isinstance(session, AgentSession):
        raise ValueError("session must be AgentSession")
    for field_name in ("session_id", "role_id", "task_id", "organization_version"):
        value = getattr(session, field_name, None)
        if not isinstance(value, str) or not value.strip():
            raise ValueError("session identity must contain nonempty strings")


def _convert(tool, parameters, session):
    if not isinstance(tool, str) or tool != "legion_write_file":
        raise ValueError("unsupported tool")
    if not isinstance(parameters, Mapping):
        raise ValueError("parameters must be a mapping")
    _validate_session(session)
    for field_name in ("proposal_id", "resource", "content"):
        if field_name not in parameters:
            raise ValueError("missing parameter: " + field_name)
    # Only these fields are consumed. Claimed role, task, action and capability
    # cannot replace the trusted session or the controlled operation.
    return ActionProposal(
        proposal_id=parameters["proposal_id"], action="write_file",
        resource=parameters["resource"], content=parameters["content"],
        tool="legion_write_file", capability="write_file", session=session,
    )


class _CodexAdapter(ProposalService):
    """Local CodexAdapter; accepts the pinned controlled-tool parameters only."""

    def convert(self, tool: str, parameters: Mapping[str, object],
                session: AgentSession) -> ActionProposal:
        return _convert(tool, parameters, session)


class _ClaudeAdapter(ProposalService):
    """Local ClaudeAdapter; shares the controlled-tool safety contract."""

    def convert(self, tool: str, parameters: Mapping[str, object],
                session: AgentSession) -> ActionProposal:
        return _convert(tool, parameters, session)
