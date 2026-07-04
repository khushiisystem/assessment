"""
Subscription & Registration APIs for the SaaS platform.
Handles:
- Unified registration (individual + organization)
- Subscription plan management
- Plan upgrade/downgrade
- Usage tracking
- Organization admin user creation
"""
import logging
import secrets
import string

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.db import transaction
from django.template.loader import render_to_string
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from organization.models import Organization

from .models import (
    SubscriptionPlan,
    SubscriptionUsage,
    UserSubscription,
)

logger = logging.getLogger(__name__)
User = get_user_model()


def _generate_secure_password(length=14):
    """Generate a cryptographically secure password."""
    alphabet = string.ascii_letters + string.digits + "!@#$%&"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _generate_unique_username(base: str) -> str:
    """Generate a unique username from a base string."""
    username = slugify(base).replace("-", "")[:30] or "user"
    if not User.objects.filter(username=username).exists():
        return username
    counter = 1
    while User.objects.filter(username=f"{username}{counter}").exists():
        counter += 1
    return f"{username}{counter}"


# ─────────────────────────────────────────────────────────────────────
# Unified Registration: Individual + Organization from same endpoint
# ─────────────────────────────────────────────────────────────────────


class UnifiedRegisterAPIView(APIView):
    """
    POST /v1/api/register/unified/

    Supports two account_type values:
    - "individual": Creates a personal account with free tier subscription.
    - "organization": Creates an organization + org_admin user, sends credentials via email.

    Individual fields: first_name, last_name, email, password, tech_stack[]
    Organization fields: org_name, org_type, org_email, org_phone, admin_first_name, admin_last_name, admin_email, admin_password (optional)
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        account_type = request.data.get("account_type", "").strip().lower()

        if account_type == "individual":
            return self._register_individual(request.data)
        elif account_type == "organization":
            return self._register_organization(request.data)
        else:
            return Response(
                {"errors": {"account_type": "Must be 'individual' or 'organization'."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @transaction.atomic
    def _register_individual(self, data):
        """Register an individual user with free tier subscription."""
        first_name = (data.get("first_name") or "").strip()
        last_name = (data.get("last_name") or "").strip()
        email = (data.get("email") or "").strip().lower()
        password = data.get("password", "")
        tech_stack = data.get("tech_stack", [])

        # Validation
        errors = {}
        if not first_name:
            errors["first_name"] = "First name is required."
        if not last_name:
            errors["last_name"] = "Last name is required."
        if not email:
            errors["email"] = "Email is required."
        else:
            try:
                validate_email(email)
            except Exception:
                errors["email"] = "Enter a valid email address."
            if not errors.get("email") and User.objects.filter(email=email).exists():
                errors["email"] = "An account with this email already exists."
        if not password or len(password) < 8:
            errors["password"] = "Password must be at least 8 characters."
        if not isinstance(tech_stack, list):
            errors["tech_stack"] = "Tech stack must be a list."

        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        username = _generate_unique_username(f"{first_name}{last_name}")

        user = User.objects.create_user(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            password=password,
            role="candidate",
            is_individual=True,
            tech_stack=tech_stack if isinstance(tech_stack, list) else [],
        )

        # Auto-assign Free Tier subscription
        self._assign_free_plan(user)

        # Assign initial assessments immediately for "WOW" factor
        from .utils import assign_initial_free_assessments
        assign_initial_free_assessments(user)

        # Send welcome email asynchronously
        self._send_welcome_email(user, email)

        # Generate tokens for auto-login
        tokens = self._get_tokens_for_user(user)

        return Response(
            {
                "message": "Account created successfully!",
                "username": username,
                "email": email,
                "account_type": "individual",
                "access": tokens["access"],
                "refresh": tokens["refresh"],
                "user": {
                    "id": user.id,
                    "name": user.full_name,
                    "email": user.email,
                    "role": user.role,
                    "organization_id": user.organization_id,
                    "is_individual": True,
                },
            },
            status=status.HTTP_201_CREATED,
        )

    @transaction.atomic
    def _register_organization(self, data):
        """Register an organization + create org_admin user."""
        # Organization fields
        org_name = (data.get("org_name") or "").strip()
        org_type = (data.get("org_type") or "Company").strip()
        org_email = (data.get("org_email") or "").strip().lower()
        org_phone = (data.get("org_phone") or "").strip()
        org_website = (data.get("org_website") or "").strip()

        # Admin fields
        admin_first_name = (data.get("admin_first_name") or "").strip()
        admin_last_name = (data.get("admin_last_name") or "").strip()
        admin_email = (data.get("admin_email") or org_email).strip().lower()
        admin_password = data.get("admin_password", "")

        # Validation
        errors = {}
        if not org_name:
            errors["org_name"] = "Organization name is required."
        elif Organization.objects.filter(name__iexact=org_name).exists():
            errors["org_name"] = "An organization with this name already exists."
        if not org_email:
            errors["org_email"] = "Organization email is required."
        else:
            try:
                validate_email(org_email)
            except Exception:
                errors["org_email"] = "Enter a valid email address."
        if not admin_first_name:
            errors["admin_first_name"] = "Admin first name is required."
        if not admin_last_name:
            errors["admin_last_name"] = "Admin last name is required."
        if not admin_email:
            errors["admin_email"] = "Admin email is required."
        else:
            try:
                validate_email(admin_email)
            except Exception:
                errors["admin_email"] = "Enter a valid admin email."
            if not errors.get("admin_email") and User.objects.filter(email=admin_email).exists():
                errors["admin_email"] = "An account with this admin email already exists."

        if org_type not in ("Institute", "Company", "Other"):
            errors["org_type"] = "Organization type must be Institute, Company, or Other."

        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        # Generate password if not provided
        generated_password = None
        if not admin_password or len(admin_password) < 8:
            generated_password = _generate_secure_password()
            admin_password = generated_password

        # Create Organization
        org = Organization.objects.create(
            name=org_name,
            organization_type=org_type,
            primary_email=org_email,
            phone=org_phone,
            website=org_website if org_website else None,
            status="Active",
        )

        # Create Org Admin User
        username = _generate_unique_username(f"{admin_first_name}{admin_last_name}")
        admin_user = User.objects.create_user(
            username=username,
            email=admin_email,
            first_name=admin_first_name,
            last_name=admin_last_name,
            password=admin_password,
            role="org_admin",
            is_individual=False,
            is_staff=True,
            organization=org,
        )

        # Send credentials email
        self._send_org_credentials_email(admin_user, admin_email, admin_password, org)

        # Generate tokens for auto-login
        tokens = self._get_tokens_for_user(admin_user)

        return Response(
            {
                "message": "Organization created successfully!",
                "organization": {
                    "id": org.id,
                    "name": org.name,
                    "slug": org.slug,
                },
                "admin": {
                    "username": username,
                    "email": admin_email,
                },
                "account_type": "organization",
                "access": tokens["access"],
                "refresh": tokens["refresh"],
                "user": {
                    "id": admin_user.id,
                    "name": admin_user.full_name,
                    "email": admin_user.email,
                    "role": admin_user.role,
                    "organization_id": admin_user.organization_id,
                    "is_individual": False,
                },
            },
            status=status.HTTP_201_CREATED,
        )

    def _get_tokens_for_user(self, user):
        from rest_framework_simplejwt.tokens import RefreshToken
        refresh = RefreshToken.for_user(user)
        # Add custom claims to match LoginSerializer
        refresh['role'] = user.role
        refresh['name'] = user.full_name
        refresh['organization_id'] = user.organization_id
        
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }

    def _assign_free_plan(self, user):
        """Assign the free subscription plan to a user."""
        try:
            free_plan = SubscriptionPlan.objects.all_for_super_admin().filter(
                plan_type="free", is_active=True
            ).first()
            if free_plan:
                sub = UserSubscription.objects.create(
                    user=user,
                    plan=free_plan,
                    is_active=True,
                    end_date=None,
                )
                user.subscription = sub
                user.save(update_fields=["subscription"])
        except Exception as e:
            logger.warning(f"Could not assign Free Tier to {user.email}: {e}")

    def _send_welcome_email(self, user, email):
        """Send welcome email to individual user."""
        try:
            from core.tasks import send_email_async

            send_email_async.delay(
                subject="Welcome to the Platform!",
                message=(
                    f"Hi {user.first_name},\n\n"
                    f"Your account has been created successfully.\n"
                    f"You are on the Free Tier plan.\n\n"
                    f"Login at: {settings.FRONTEND_URL.rstrip('/')}/login\n\n"
                    f"Regards,\nSkilTechy Team"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
            )
        except Exception as e:
            # Fallback to sync email if Celery not available
            try:
                send_mail(
                    subject="Welcome to the Platform!",
                    message=(
                        f"Hi {user.first_name},\n\n"
                        f"Your account has been created successfully.\n"
                        f"You are on the Free Tier plan.\n\n"
                        f"Login at: {settings.FRONTEND_URL.rstrip('/')}/login\n\n"
                        f"Regards,\nSkilTechy Team"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                    fail_silently=True,
                    html_message=render_to_string(
                        "emails/subscription_welcome.html",
                        {
                            "first_name": user.first_name,
                            "login_url": f"{settings.FRONTEND_URL.rstrip('/')}/login",
                        },
                    ),
                )
            except Exception:
                logger.warning(f"Welcome email failed for {email}: {e}")

    def _send_org_credentials_email(self, user, email, password, org):
        """Send login credentials to the organization admin."""
        try:
            from core.tasks import send_email_async

            send_email_async.delay(
                subject=f"Your Organization Account - {org.name}",
                message=(
                    f"Hi {user.first_name},\n\n"
                    f"Your organization '{org.name}' has been successfully registered.\n\n"
                    f"Here are your login credentials:\n"
                    f"{'─' * 40}\n"
                    f"Email: {email}\n"
                    f"Password: {password}\n"
                    f"Role: Organization Admin\n"
                    f"{'─' * 40}\n\n"
                    f"Login at: {settings.FRONTEND_URL.rstrip('/')}/login\n\n"
                    f"For security, please change your password after first login.\n\n"
                    f"Regards,\nSkilTechy Team"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
            )
        except Exception:
            # Fallback to sync
            try:
                send_mail(
                    subject=f"Your Organization Account - {org.name}",
                    message=(
                        f"Hi {user.first_name},\n\n"
                        f"Your organization '{org.name}' has been successfully registered.\n\n"
                        f"Here are your login credentials:\n"
                        f"{'─' * 40}\n"
                        f"Email: {email}\n"
                        f"Password: {password}\n"
                        f"Role: Organization Admin\n"
                        f"{'─' * 40}\n\n"
                        f"Login at: {settings.FRONTEND_URL.rstrip('/')}/login\n\n"
                        f"For security, please change your password after first login.\n\n"
                        f"Regards,\nSkilTechy Team"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                    fail_silently=True,
                    html_message=render_to_string(
                        "emails/subscription_org_credentials.html",
                        {
                            "first_name": user.first_name,
                            "organization_name": org.name,
                            "email": email,
                            "password": password,
                            "login_url": f"{settings.FRONTEND_URL.rstrip('/')}/login",
                        },
                    ),
                )
            except Exception as e:
                logger.warning(f"Org credentials email failed for {email}: {e}")


# ─────────────────────────────────────────────────────────────────────
# Subscription Plan Management APIs
# ─────────────────────────────────────────────────────────────────────


class SubscriptionPlanListView(APIView):
    """
    GET /v1/api/subscription/plans/
    Public endpoint - lists all active subscription plans.
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        plans = SubscriptionPlan.objects.all_for_super_admin().filter(is_active=True).order_by("price")
        data = [
            {
                "id": p.id,
                "name": p.name,
                "plan_type": p.plan_type,
                "price": str(p.price),
                "duration_months": p.duration_months,
                "assessments_per_month": p.assessments_per_month,
                "ai_interviews_per_month": p.ai_interviews_per_month,
                "free_assessments_per_week": p.free_assessments_per_week,
                "free_ai_assessments_per_week": p.free_ai_assessments_per_week,
            }
            for p in plans
        ]
        return Response(data)


class MySubscriptionView(APIView):
    """
    GET /v1/api/subscription/me/
    Returns current user's subscription details and usage stats.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from organization.context import set_tenant_context, clear_tenant_context

        user = request.user
        sub = getattr(user, "subscription", None)

        if not sub:
            return Response(
                {"subscription": None, "usage": None},
                status=status.HTTP_200_OK,
            )

        now = timezone.now()

        # Bypass tenant isolation – subscription data is user-scoped,
        # not org-scoped, but SubscriptionUsage extends TenantModel.
        prev_ctx = {
            "org_id": getattr(user, "organization_id", None),
            "is_super": user.is_superuser or getattr(user, "role", None) == "super_admin",
            "is_individual": getattr(user, "is_individual", False),
        }
        set_tenant_context(None, is_super_admin=True)

        try:
            # Get current month usage
            usage_data = None
            try:
                usage = SubscriptionUsage.objects.filter(
                    user=user,
                    month=now.month,
                    year=now.year,
                ).first()
                if usage and usage.subscription != sub:
                    usage.subscription = sub
                    usage.save(update_fields=["subscription"])
                usage_data = {
                    "assessments_used": usage.assessments_used if usage else 0,
                    "ai_interviews_used": usage.ai_interviews_used if usage else 0,
                    "assessments_limit": sub.plan.assessments_per_month,
                    "ai_interviews_limit": sub.plan.ai_interviews_per_month,
                }
            except Exception:
                pass

            return Response(
                {
                    "subscription": {
                        "id": sub.id,
                        "plan_name": sub.plan.name,
                        "plan_type": sub.plan.plan_type,
                        "price": str(sub.plan.price),
                        "start_date": sub.start_date.isoformat() if sub.start_date else None,
                        "end_date": sub.end_date.isoformat() if sub.end_date else None,
                        "is_active": sub.is_active,
                        "is_valid": sub.is_valid(),
                    },
                    "usage": usage_data,
                }
            )
        finally:
            set_tenant_context(
                organization_id=prev_ctx["org_id"],
                is_super_admin=prev_ctx["is_super"],
                is_individual=prev_ctx["is_individual"],
            )


class UpgradeSubscriptionView(APIView):
    """
    POST /v1/api/subscription/upgrade/
    Upgrade user's subscription to a paid plan.
    Body: { "plan_id": <int> }

    In production, this would integrate with a payment gateway (Razorpay/Stripe).
    For now, it directly upgrades after validation.
    """

    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        user = request.user
        plan_id = request.data.get("plan_id")

        if not plan_id:
            return Response(
                {"error": "plan_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.is_individual and user.role != 'org_admin':
            return Response(
                {"error": "Only admins can manage organization subscriptions. Contact your admin."},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            plan = SubscriptionPlan.objects.all_for_super_admin().get(id=plan_id, is_active=True)
        except SubscriptionPlan.DoesNotExist:
            return Response(
                {"error": "Invalid or inactive plan."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if plan.plan_type == "free":
            return Response(
                {"error": "Cannot upgrade to free plan. Use downgrade endpoint."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Bypass tenant isolation for subscription operations
        from organization.context import set_tenant_context
        prev_ctx = {
            "org_id": getattr(user, "organization_id", None),
            "is_super": user.is_superuser or getattr(user, "role", None) == "super_admin",
            "is_individual": getattr(user, "is_individual", False),
        }
        set_tenant_context(None, is_super_admin=True)

        try:
            # Deactivate current subscription
            current_sub = getattr(user, "subscription", None)
            if current_sub:
                current_sub.is_active = False
                current_sub.save(update_fields=["is_active"])

            # Calculate end date based on plan duration
            from dateutil.relativedelta import relativedelta

            now = timezone.now()
            end_date = now + relativedelta(months=plan.duration_months)

            # Create new subscription
            new_sub = UserSubscription.objects.create(
                user=user,
                plan=plan,
                is_active=True,
                end_date=end_date,
            )

            user.subscription = new_sub
            user.save(update_fields=["subscription"])
        finally:
            set_tenant_context(
                organization_id=prev_ctx["org_id"],
                is_super_admin=prev_ctx["is_super"],
                is_individual=prev_ctx["is_individual"],
            )

        # Send confirmation email
        try:
            from core.tasks import send_email_async

            send_email_async.delay(
                subject=f"Subscription Upgraded - {plan.name}",
                message=(
                    f"Hi {user.first_name or user.username},\n\n"
                    f"Your subscription has been upgraded to {plan.name}.\n\n"
                    f"Plan Details:\n"
                    f"- Assessments per month: {plan.assessments_per_month}\n"
                    f"- AI Interviews per month: {plan.ai_interviews_per_month}\n"
                    f"- Valid until: {end_date.strftime('%B %d, %Y')}\n\n"
                    f"Regards,\nSkilTechy Team"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
            )
        except Exception:
            pass

        return Response(
            {
                "message": f"Subscription upgraded to {plan.name} successfully!",
                "subscription": {
                    "id": new_sub.id,
                    "plan_name": plan.name,
                    "plan_type": plan.plan_type,
                    "start_date": new_sub.start_date.isoformat(),
                    "end_date": new_sub.end_date.isoformat(),
                    "is_active": True,
                },
            },
            status=status.HTTP_200_OK,
        )


class CancelSubscriptionView(APIView):
    """
    POST /v1/api/subscription/cancel/
    Cancel current paid subscription and downgrade to free tier.
    """

    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        user = request.user
        current_sub = getattr(user, "subscription", None)

        if not current_sub or not current_sub.is_active:
            return Response(
                {"error": "No active subscription to cancel."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if current_sub.plan.plan_type == "free":
            return Response(
                {"error": "Cannot cancel a free plan."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Deactivate current subscription
        current_sub.is_active = False
        current_sub.save(update_fields=["is_active"])

        # Assign free plan
        free_plan = SubscriptionPlan.objects.all_for_super_admin().filter(plan_type="free", is_active=True).first()
        if free_plan:
            new_sub = UserSubscription.objects.create(
                user=user,
                plan=free_plan,
                is_active=True,
                end_date=None,
            )
            user.subscription = new_sub
            user.save(update_fields=["subscription"])

        return Response(
            {"message": "Subscription cancelled. You are now on the Free Tier."},
            status=status.HTTP_200_OK,
        )


# ─────────────────────────────────────────────────────────────────────
# Organization Admin - User Management
# ─────────────────────────────────────────────────────────────────────


class OrgAdminCreateUserView(APIView):
    """
    POST /v1/api/org/users/create/
    Lets organization staff invite users:
      - org_admin / super_admin can create Managers and Candidates
      - manager can create Candidates
    Sends login credentials via email.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user

        # Permission check: org_admin / super_admin / manager may invite users.
        if user.role not in ("org_admin", "super_admin", "manager") and not user.is_superuser:
            return Response(
                {"error": "You do not have permission to create users."},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = request.data
        first_name = (data.get("first_name") or "").strip()
        last_name = (data.get("last_name") or "").strip()
        email = (data.get("email") or "").strip().lower()
        role = (data.get("role") or "candidate").strip().lower()
        phone = (data.get("phone") or "").strip()
        profile = (data.get("profile") or "").strip()

        # Validation. What the caller may create depends on their own role:
        #   manager                -> candidate only
        #   org_admin / super_admin -> candidate or manager
        errors = {}
        if user.role == "manager" and not user.is_superuser:
            allowed_roles = ("candidate",)
        else:
            allowed_roles = ("candidate", "manager")
        if not first_name:
            errors["first_name"] = "First name is required."
        if not last_name:
            errors["last_name"] = "Last name is required."
        if not email:
            errors["email"] = "Email is required."
        else:
            try:
                validate_email(email)
            except Exception:
                errors["email"] = "Enter a valid email address."
            if not errors.get("email") and User.objects.filter(email=email).exists():
                errors["email"] = "A user with this email already exists."
        if role not in allowed_roles:
            errors["role"] = f"Role must be one of: {', '.join(allowed_roles)}."

        if errors:
            return Response({"errors": errors}, status=status.HTTP_400_BAD_REQUEST)

        # Generate secure password
        password = _generate_secure_password()
        username = _generate_unique_username(f"{first_name}{last_name}")

        # Determine organization
        org = user.organization

        # Enforce the org's candidate invite limit (only applies to candidates).
        if role == "candidate" and org and getattr(org, "candidate_limit", None) is not None:
            current = User.objects.filter(organization=org, role="candidate").count()
            if current >= org.candidate_limit:
                return Response(
                    {"detail": f"Candidate limit reached ({org.candidate_limit}). Contact your platform administrator to raise it."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            new_user = User.objects.create_user(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                password=password,
                role=role,
                phone=phone,
                profile=profile,
                is_individual=False,
                is_staff=(role == "org_admin"),
                organization=org,
                created_by=user,
            )

        # Send credentials email SYNCHRONOUSLY (no Celery worker dependency).
        # .delay() silently no-ops when no worker is running; send directly so
        # the credentials actually reach the new user. Errors are logged.
        email_sent = False
        try:
            role_display = dict(User.ROLE_CHOICES).get(role, role)
            send_mail(
                subject=f"Account Created - {org.name if org else 'Platform'}",
                message=(
                    f"Hi {first_name},\n\n"
                    f"An account has been created for you on the assessment platform.\n\n"
                    f"Your credentials:\n"
                    f"{'─' * 40}\n"
                    f"Email: {email}\n"
                    f"Password: {password}\n"
                    f"Role: {role_display}\n"
                    f"Organization: {org.name if org else 'N/A'}\n"
                    f"{'─' * 40}\n\n"
                    f"Login at: {settings.FRONTEND_URL.rstrip('/')}/login\n\n"
                    f"Please change your password after first login.\n\n"
                    f"Regards,\nSkilTechy Team"
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
                html_message=render_to_string(
                    "emails/subscription_account_created.html",
                    {
                        "first_name": first_name,
                        "email": email,
                        "password": password,
                        "role_display": role_display,
                        "organization_name": org.name if org else "N/A",
                        "login_url": f"{settings.FRONTEND_URL.rstrip('/')}/login",
                    },
                ),
            )
            email_sent = True
        except Exception as e:
            logger.warning(f"User creation email failed for {email}: {e}")

        return Response(
            {
                "message": (
                    f"User created successfully. Credentials sent to {email}."
                    if email_sent
                    else f"User created, but the credentials email could not be sent to {email}."
                ),
                "email_sent": email_sent,
                "user": {
                    "id": new_user.id,
                    "username": username,
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": role,
                    "organization_id": org.id if org else None,
                },
            },
            status=status.HTTP_201_CREATED,
        )


class OrgAdminListUsersView(APIView):
    """
    GET /v1/api/org/users/
    List all users in the org admin's organization.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if user.role not in ("org_admin", "super_admin") and not user.is_superuser:
            return Response(
                {"error": "Permission denied."},
                status=status.HTTP_403_FORBIDDEN,
            )

        org = user.organization
        if not org and not user.is_superuser:
            return Response(
                {"error": "No organization found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        qs = User.objects.filter(organization=org).order_by("-created_at") if org else User.objects.none()

        # Allow super_admin to see all
        if user.is_superuser:
            qs = User.objects.all().order_by("-created_at")

        # Optional role filter, e.g. ?role=manager powers the Managers page.
        role_filter = (request.query_params.get("role") or "").strip().lower()
        if role_filter:
            qs = qs.filter(role=role_filter)

        # Pagination
        page = int(request.query_params.get("page", 1))
        page_size = min(int(request.query_params.get("page_size", 50)), 100)
        start = (page - 1) * page_size
        end = start + page_size

        total = qs.count()
        users = qs[start:end]

        data = [
            {
                "id": u.id,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "email": u.email,
                "role": u.role,
                "is_active": u.is_active,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]

        return Response(
            {
                "results": data,
                "total": total,
                "page": page,
                "page_size": page_size,
            }
        )
