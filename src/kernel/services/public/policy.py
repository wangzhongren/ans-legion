from kernel.services.abstract.policy import PolicyService

def create_policy_service() -> PolicyService:
    from kernel.services.impl.policy import _PolicyService
    return _PolicyService()

__all__ = ["PolicyService", "create_policy_service"]
