from kernel.providers.abstract.storage import StorageProvider, StorageError

def create_storage_provider(workspace=None, *, _authority=None) -> StorageProvider:
    from kernel.providers.impl.storage import _LocalStorageProvider
    return _LocalStorageProvider(workspace, _authority)

__all__ = ["StorageProvider", "StorageError", "create_storage_provider"]
