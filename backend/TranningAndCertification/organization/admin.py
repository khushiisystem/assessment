from django.contrib import admin
from django.conf import settings
from django.core.mail import send_mail

from .models import Organization


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "short_name",
        "organization_type",
        "status",
        "primary_email",
        "phone",
        "slug",
        "is_active",
        "created_at",
        "updated_at",
    )
    list_filter = ("organization_type", "status", "is_active")
    search_fields = ("name", "short_name", "legal_name", "slug", "primary_email", "phone")

    def save_model(self, request, obj, form, change):
        """Send a welcome email and create org_admin for new organizations."""
        from core.models import User
        from core.utils import generate_password, send_email

        is_new = obj.pk is None  # True only when creating, not editing
        super().save_model(request, obj, form, change)

        if is_new and obj.primary_email:
            try:
                # Check if a user with this email already exists
                user = User.objects.filter(email=obj.primary_email).first()
                password = "Password already set (Existing user)"
                
                if not user:
                    # Create a new org_admin user
                    password = generate_password(12)
                    user = User.objects.create_user(
                        username=obj.primary_email,
                        email=obj.primary_email,
                        password=password,
                        name=obj.name,
                        role='org_admin',
                        organization=obj,
                    )
                else:
                    # Link existing user to organization if not already linked
                    if not user.organization:
                        user.organization = obj
                        user.role = 'org_admin'
                        user.save()

                # Get configuration from settings to avoid hardcoding
                frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
                login_url = f"{frontend_url}/login"
                platform_name = getattr(settings, 'PLATFORM_NAME', 'Online Assessment')

                context = {
                    "organization_name": obj.name,
                    "organization_type": obj.organization_type,
                    "short_name": obj.short_name or 'N/A',
                    "email": obj.primary_email,
                    "password": password,
                    "login_url": login_url,
                    "platform_name": platform_name,
                }
                
                send_email(
                    subject=f'Welcome to {platform_name} — {obj.name}',
                    recipients=[obj.primary_email],
                    template='emails/organization_welcome.html',
                    context=context
                )
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Failed to send org welcome email or create user for {obj.primary_email}: {e}")
