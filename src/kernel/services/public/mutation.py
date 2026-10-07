from kernel.services.abstract.mutation import MutationService, MutationError

def create_mutation_service(workspace=None, *, _authority=None) -> MutationService:
    from kernel.services.impl.mutation import _MutationService
    return _MutationService(workspace, _authority)

__all__ = ["MutationService", "MutationError", "create_mutation_service"]
