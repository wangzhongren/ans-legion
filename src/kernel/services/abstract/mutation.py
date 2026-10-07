from abc import ABC, abstractmethod
from kernel.models.core import MutationResult, Event

class MutationError(RuntimeError):
    """Safe Service error category for unavailable storage/audit."""

class MutationService(ABC):
    @abstractmethod
    def execute(self, proposal, permit=None) -> MutationResult:
        """Execute a bound permit; no policy evaluation or authority grant."""

    @abstractmethod
    def record_event(self, event: Event) -> Event:
        """Record workflow audit metadata; raise MutationError on failure."""

    @abstractmethod
    def events(self) -> tuple[Event, ...]:
        """Return numbered audit events."""

    @abstractmethod
    def read_file(self, resource: str) -> str:
        """Read a safe workspace resource for observations."""

    @abstractmethod
    def close(self):
        """Release owned storage."""
