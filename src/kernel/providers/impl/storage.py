from dataclasses import asdict, replace
import json
from datetime import datetime, timezone, timedelta
import os
from pathlib import Path
import stat
import tempfile
from threading import RLock
from kernel.providers.abstract.storage import StorageProvider, StorageError
from kernel.models.core import ActionProposal, Event, MutationResult, normalize_resource, _RuntimeAuthority


class _LocalStorageProvider(StorageProvider):
    def __init__(self, workspace, authority):
        self.__temporary = None
        if workspace is None:
            self.__temporary = tempfile.TemporaryDirectory(prefix="legion-demo-")
            workspace = self.__temporary.name
        self.__root = Path(workspace).absolute()
        if not self.__root.is_dir() or self._linked(self.__root):
            raise StorageError("invalid_workspace")
        self.__root = self.__root.resolve()
        self.__authority = None
        if isinstance(authority, _RuntimeAuthority):
            self.__authority = authority
        self.__lock = RLock()
        self.__closed = False

    @staticmethod
    def _linked(path):
        metadata = path.lstat()
        if stat.S_ISLNK(metadata.st_mode):
            return True
        attributes = getattr(metadata, "st_file_attributes", 0)
        return bool(attributes & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 1024))

    def _target(self, resource):
        normalized = normalize_resource(resource)
        current = self.__root
        for component in normalized.split("/"):
            if current.exists():
                if self._linked(current) or not current.is_dir():
                    raise ValueError("unsafe_parent")
                matches = [entry for entry in current.iterdir() if entry.name.casefold() == component.casefold()]
                if len(matches) > 1:
                    raise ValueError("ambiguous_case")
                if matches:
                    current = matches[0]
                else:
                    current = current / component
            else:
                current = current / component
            if current.exists() or current.is_symlink():
                if self._linked(current):
                    raise ValueError("linked_target")
        current.resolve().relative_to(self.__root)
        return current

    def _audit_directory(self, create=False):
        current = self.__root
        if not current.is_dir() or self._linked(current):
            raise StorageError("audit_unavailable")
        for component in (".ans", "events"):
            if current.exists():
                matches = [entry for entry in current.iterdir() if entry.name.casefold() == component.casefold()]
                if len(matches) > 1:
                    raise StorageError("audit_unavailable")
                if matches:
                    current = matches[0]
                else:
                    current = current / component
            else:
                current = current / component
            if current.exists() or current.is_symlink():
                if self._linked(current) or not current.is_dir():
                    raise StorageError("audit_unavailable")
            elif create:
                current.mkdir()
                if self._linked(current):
                    raise StorageError("audit_unavailable")
        current.resolve().relative_to(self.__root)
        return current

    def _audit_path(self, filename="index.jsonl", create=False):
        path = self._audit_directory(create) / filename
        if path.exists() or path.is_symlink():
            if self._linked(path) or not path.is_file():
                raise StorageError("audit_unavailable")
        path.resolve().relative_to(self.__root)
        return path

    @staticmethod
    def _read_event_file(path):
        if not path.exists():
            return ()
        return tuple(Event(**json.loads(line)) for line in path.read_text(encoding="utf-8").splitlines())

    def read_events(self):
        with self.__lock:
            try:
                path = self._audit_path()
                events = self._read_event_file(path)
                grouped = {}
                for sequence, event in enumerate(events, 1):
                    if event.sequence != sequence:
                        raise ValueError("nonsequential_event")
                    recorded = datetime.fromisoformat(event.recorded_at)
                    if recorded.tzinfo is None:
                        raise ValueError("missing_timezone")
                    date = recorded.date().isoformat()
                    grouped.setdefault(date, []).append(event)
                directory = self._audit_directory()
                if directory.exists():
                    for entry in directory.iterdir():
                        if entry.name != "index.jsonl":
                            if entry.name not in {date + ".jsonl" for date in grouped}:
                                raise ValueError("unindexed_audit_file")
                for date, expected in grouped.items():
                    daily_path = self._audit_path(date + ".jsonl")
                    if self._read_event_file(daily_path) != tuple(expected):
                        raise ValueError("daily_index_mismatch")
                return events
            except (OSError, ValueError, TypeError, json.JSONDecodeError) as error:
                raise StorageError("audit_unavailable") from error

    def append_event(self, event):
        with self.__lock:
            try:
                if self.__closed or self.__authority is None:
                    raise StorageError("runtime_authority_required")
                timestamp = datetime.now(timezone(timedelta(hours=8)))
                recorded = replace(event, sequence=len(self.read_events()) + 1,
                    recorded_at=timestamp.isoformat(timespec="microseconds"))
                index = self._audit_path(create=True)
                daily = self._audit_path(timestamp.date().isoformat() + ".jsonl")
                line = json.dumps(asdict(recorded), ensure_ascii=True, sort_keys=True) + "\n"
                for path in (index, daily):
                    with path.open("a", encoding="utf-8", newline="\n") as stream:
                        stream.write(line)
                        stream.flush()
                        os.fsync(stream.fileno())
                return recorded
            except (OSError, ValueError, TypeError) as error:
                raise StorageError("audit_unavailable") from error

    @staticmethod
    def _event(proposal, kind, reason="", observed=False):
        session = proposal.session
        return Event(0, kind, session.role_id, session.task_id, session.organization_version,
                     proposal.resource, proposal.digest, proposal.proposal_id,
                     reason=reason, observed_mutation=observed)

    def write(self, proposal, permit=None):
        if not isinstance(proposal, ActionProposal):
            return MutationResult(False, "denied", "invalid_proposal", "", "")
        def result(success, status, reason, observed=False, audit_failed=False):
            return MutationResult(success,status,reason,proposal.resource,proposal.digest,observed,audit_failed)
        with self.__lock:
            try:
                if self.__closed or self.__authority is None:
                    raise PermissionError("runtime_authority_required")
                self.__authority.consume(proposal, permit)
                target = self._target(proposal.resource)
                if target.exists() and not target.is_file():
                    raise ValueError("target_not_file")
            except (PermissionError, ValueError, OSError):
                return result(False, "denied", "invalid_or_stale_authorization")
            try:
                self.append_event(self._event(proposal, "mutation_intent"))
            except StorageError:
                return result(False, "audit_failed", "intent_audit_failed", audit_failed=True)
            temporary_path = None
            observed = False
            failure_reason = ""
            try:
                target.parent.mkdir(parents=True, exist_ok=True)
                target = self._target(proposal.resource)
                with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="", dir=target.parent, delete=False, prefix=".legion-write-") as temporary:
                    temporary_path = Path(temporary.name)
                    temporary.write(proposal.content)
                    temporary.flush()
                    os.fsync(temporary.fileno())
                target = self._target(proposal.resource)
                os.replace(temporary_path, target)
                temporary_path = None
                observed = True
            except (OSError, ValueError):
                failure_reason = "write_failed"
            finally:
                if temporary_path is not None:
                    try:
                        temporary_path.unlink(missing_ok=True)
                    except OSError:
                        failure_reason = "write_failed_cleanup_failed"
            kind = "mutation_failure"
            if observed:
                kind = "mutation_success"
            try:
                self.append_event(self._event(proposal, kind, failure_reason, observed))
            except StorageError:
                return result(False, "audit_failed", "result_audit_failed", observed, True)
            if observed:
                return result(True, "written", "write_completed", True)
            return result(False, "failed", failure_reason)

    def read_file(self, resource):
        with self.__lock:
            try:
                return self._target(resource).read_text(encoding="utf-8")
            except (OSError, ValueError) as error:
                raise StorageError("read_failed") from error

    def close(self):
        with self.__lock:
            if not self.__closed:
                if self.__temporary is not None:
                    self.__temporary.cleanup()
                self.__closed = True
