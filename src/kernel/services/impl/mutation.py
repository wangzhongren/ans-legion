from kernel.services.abstract.mutation import MutationService, MutationError
from kernel.providers.public.storage import create_storage_provider, StorageError

class _MutationService(MutationService):
    def __init__(self, workspace, authority):
        self.__storage = create_storage_provider(workspace, _authority=authority)

    def execute(self, proposal, permit=None):
        return self.__storage.write(proposal, permit)

    def record_event(self, event):
        try:
            return self.__storage.append_event(event)
        except StorageError as error:
            raise MutationError("audit_unavailable") from error

    def events(self):
        try:
            return self.__storage.read_events()
        except StorageError as error:
            raise MutationError("audit_unavailable") from error

    def read_file(self, resource):
        try:
            return self.__storage.read_file(resource)
        except StorageError as error:
            raise MutationError("read_failed") from error

    def close(self):
        self.__storage.close()
