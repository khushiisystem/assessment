from rest_framework.authentication import TokenAuthentication
from rest_framework_simplejwt.authentication import JWTAuthentication

from .context import clear_tenant_context, set_tenant_context


def _apply_tenant_context_from_user(user) -> None:
    if not user or not user.is_authenticated:
        clear_tenant_context()
        return

    is_super_admin = bool(
        user.is_superuser
        or getattr(user, "role", None) == "super_admin"
    )
    is_individual = getattr(user, "is_individual", False)
    set_tenant_context(
        organization_id=getattr(user, "organization_id", None),
        is_super_admin=is_super_admin,
        is_individual=is_individual,
    )


class TenantJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if not result:
            return result
        user, token = result
        _apply_tenant_context_from_user(user)
        return user, token


class TenantTokenAuthentication(TokenAuthentication):
    def authenticate(self, request):
        result = super().authenticate(request)
        if not result:
            return result
        user, token = result
        _apply_tenant_context_from_user(user)
        return user, token
