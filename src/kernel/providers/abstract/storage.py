from abc import ABC, abstractmethod
from kernel.models.core import MutationResult, Event

class StorageError(RuntimeError):
    """Safe error category; no raw filesystem exception or content in audit."""

class StorageProvider(ABC):
    @abstractmethod
    def write(self, proposal, permit=None) -> MutationResult:
        """Requires an authentic single-use runtime permit. Raw calls fail closed."""

    @abstractmethod
    def append_event(self, event: Event) -> Event:
        """Append a numbered JSONL event, flush and fsync; raises StorageError."""

    @abstractmethod
    def read_events(self) -> tuple[Event, ...]:
        """Read validated sequential events; raises StorageError on corruption."""

    @abstractmethod
    def read_file(self, resource: str) -> str:
        """Safe workspace-relative read for runtime observations."""

    @abstractmethod
    def close(self):
        """Release a managed temporary workspace; safe to repeat."""
