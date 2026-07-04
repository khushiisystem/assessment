from rest_framework import permissions, viewsets


class TenantScopedQuerysetMixin:
    """
    Applies organization scoping for non-super admins.
    """

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not user.is_authenticated:
            return queryset.none()
        if user.is_superuser or user.is_staff or getattr(user, "role", None) == "super_admin":
            return queryset
        return queryset.filter(organization_id=user.organization_id)


class TenantSerializerMixin:
    """
    Ensures organization is auto-populated from request user.
    """

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated and "organization" not in validated_data:
            validated_data["organization_id"] = request.user.organization_id
        return super().create(validated_data)


class IsTenantMember(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser or user.is_staff or getattr(user, "role", None) == "super_admin":
            return True
        return getattr(obj, "organization_id", None) == user.organization_id


class TenantModelViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated, IsTenantMember]
