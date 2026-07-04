import logging

from django.conf import settings
from django.template.loader import render_to_string
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Organization
from .permissions import IsSuperAdmin
from .serializers import OrganizationSerializer

logger = logging.getLogger(__name__)


def _unique_username(seed: str) -> str:
    from core.models import User

    base = "".join(ch for ch in (seed or "user").split("@")[0] if ch.isalnum()) or "user"
    candidate, i = base, 1
    while User.objects.filter(username=candidate).exists():
        i += 1
        candidate = f"{base}{i}"
    return candidate


class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def get_permissions(self):
        # Allow public access for list action (for signup form)
        if self.action == 'list':
            return []
        return super().get_permissions()

    @action(detail=True, methods=["post"], url_path="invite-admin")
    def invite_admin(self, request, pk=None):
        """Create (or attach) an org_admin for THIS organization and return a
        signed invite link so they can set their own password. Super admin only.
        """
        from core.models import User

        org = self.get_object()
        email = (request.data.get("email") or "").strip().lower()
        first_name = (request.data.get("first_name") or "").strip()
        last_name = (request.data.get("last_name") or "").strip()

        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        existing = User.objects.filter(email__iexact=email).first()
        if existing:
            # Promote/attach an existing account to this org as admin.
            existing.role = "org_admin"
            existing.organization = org
            existing.is_staff = True
            existing.is_active = True
            existing.is_individual = False
            if first_name and not existing.first_name:
                existing.first_name = first_name
            if last_name and not existing.last_name:
                existing.last_name = last_name
            existing.save()
            user = existing
        else:
            user = User(
                username=_unique_username(email),
                email=email,
                first_name=first_name,
                last_name=last_name,
                role="org_admin",
                organization=org,
                is_staff=True,
                is_active=True,
                is_individual=False,
            )
            # No usable password until they accept the invite and set one.
            user.set_unusable_password()
            user.save()

        # One-time invite link: default_token_generator bakes in the password hash
        # + last_login, so the token stops working the moment the admin sets their
        # password (i.e. it can't be reused after a successful setup).
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes

        uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        invite_link = f"{settings.FRONTEND_URL.rstrip('/')}/accept-invite?token={uidb64}.{token}"

        # Send the invite email SYNCHRONOUSLY (no Celery worker dependency).
        # Best-effort: the link is also returned, so the flow works even if SMTP
        # is down. Real SMTP errors are logged (fail_silently=False) for diagnosis.
        email_sent = False
        try:
            from django.core.mail import send_mail

            send_mail(
                subject=f"You're invited to administer {org.name}",
                message=(
                    f"Hi {first_name or 'there'},\n\n"
                    f"You've been invited as an administrator for {org.name}.\n\n"
                    f"Set your password and get started:\n{invite_link}\n\n"
                    f"This is a single-use link — it stops working once you've set your password.\n\nRegards,\nSkilTechy Team"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
                html_message=render_to_string(
                    "emails/org_admin_invite.html",
                    {
                        "first_name": first_name or "there",
                        "organization_name": org.name,
                        "invite_link": invite_link,
                    },
                ),
            )
            email_sent = True
        except Exception as e:
            logger.warning(f"Invite email failed for {email}: {e}")

        return Response(
            {
                "detail": "Invitation created.",
                "email": email,
                "invite_link": invite_link,
                "email_sent": email_sent,
            },
            status=status.HTTP_201_CREATED,
        )
