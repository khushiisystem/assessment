from django.db import models

from .context import current_organization_id, current_user_is_super_admin, current_user_is_individual


class TenantQuerySet(models.QuerySet):
    def for_current_tenant(self):
        from django.db.models import Q
        if current_user_is_super_admin.get():
            return self
        org_id = current_organization_id.get()
        if org_id is None:
            if current_user_is_individual.get():
                if not hasattr(self.model, 'is_global') and not hasattr(self.model, 'visible_to_organizations'):
                    return self
                q = Q(organization_id__isnull=True)
                if hasattr(self.model, 'is_global'):
                    q |= Q(is_global=True)
                if hasattr(self.model, 'visible_to_organizations'):
                    q |= Q(visible_to_organizations__isnull=False)
                return self.filter(q).distinct()
            return self.none()
        
        # Basic filter for the organization's own data
        #q_filter = Q(organization_id=org_id)
        
        q_filter = (
            Q(organization_id=org_id) |
            Q(organization_id__isnull=True)
        )

        # Include global content if the model supports it
        if hasattr(self.model, "is_global"):
            q_filter |= Q(is_global=True)
            
        # Include content specifically shared with this organization
        if hasattr(self.model, "visible_to_organizations"):
            q_filter |= Q(visible_to_organizations=org_id)
        return self.filter(q_filter).distinct()


class TenantManager(models.Manager):
    def get_queryset(self):
        queryset = TenantQuerySet(self.model, using=self._db)
        if hasattr(self.model, "organization_id"):
            return queryset.for_current_tenant()
        return queryset

    def all_for_super_admin(self):
        return TenantQuerySet(self.model, using=self._db)
