"""Supported local Service API; concrete adapter variants are internal."""
from adapters.services.abstract.proposal import ProposalService


def create_codex_adapter() -> ProposalService:
    """Create the local CodexAdapter controlled-parameter variant."""
    from adapters.services.impl.proposal import _CodexAdapter
    return _CodexAdapter()


def create_claude_adapter() -> ProposalService:
    """Create the local ClaudeAdapter controlled-parameter variant."""
    from adapters.services.impl.proposal import _ClaudeAdapter
    return _ClaudeAdapter()


__all__ = ["ProposalService", "create_codex_adapter", "create_claude_adapter"]
