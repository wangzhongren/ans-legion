from abc import ABC, abstractmethod
from kernel.models.core import PolicyDecision

class PolicyService(ABC):
    @abstractmethod
    def evaluate(self, proposal, boundary, trusted_session, current_version, task_status="active", known_roles=()) -> PolicyDecision:
        """Pure decision. Does not issue a permit or perform effects."""
