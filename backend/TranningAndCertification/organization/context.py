from contextvars import ContextVar


current_organization_id: ContextVar[int | None] = ContextVar(
    "current_organization_id",
    default=None,
)
current_user_is_super_admin: ContextVar[bool] = ContextVar(
    "current_user_is_super_admin",
    default=False,
)
current_user_is_individual: ContextVar[bool] = ContextVar(
    "current_user_is_individual",
    default=False,
)


def set_tenant_context(organization_id: int | None, is_super_admin: bool, is_individual: bool = False) -> None:
    current_organization_id.set(organization_id)
    current_user_is_super_admin.set(is_super_admin)
    current_user_is_individual.set(is_individual)


def clear_tenant_context() -> None:
    set_tenant_context(organization_id=None, is_super_admin=False, is_individual=False)
