"""Local controlled-tool conversion contract; authority remains Kernel owned."""
from abc import ABC, abstractmethod
from collections.abc import Mapping

from kernel.models.core import ActionProposal, AgentSession


class ProposalService(ABC):
    @abstractmethod
    def convert(self, tool: str, parameters: Mapping[str, object],
                session: AgentSession) -> ActionProposal:
        """Return a proposal preserving session identity; invalid input raises ValueError.

        Unknown parameters never supply authority. Conversion performs no effects.
        The caller supplies the trusted session; Kernel authenticates its registry.
        """
