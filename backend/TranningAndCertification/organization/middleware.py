from .context import clear_tenant_context, set_tenant_context


class TenantContextMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        org_id = None
        is_super_admin = False
        is_individual = False

        if user and user.is_authenticated:
            is_super_admin = bool(
                user.is_superuser
                or getattr(user, "role", None) == "super_admin"
            )
            org_id = getattr(user, "organization_id", None)
            is_individual = getattr(user, "is_individual", False)
            import logging
            mw_logger = logging.getLogger("organization.middleware")
            mw_logger.debug(f"MW DEBUG: user={user.email}, role={getattr(user, 'role', 'N/A')}, is_super_attr={user.is_superuser}, is_super_calc={is_super_admin}, org_id={org_id}")

        set_tenant_context(organization_id=org_id, is_super_admin=is_super_admin, is_individual=is_individual)
        try:
            return self.get_response(request)
        finally:
            clear_tenant_context()
