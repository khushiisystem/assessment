"""
Usage Enforcement Middleware for SaaS Subscription Limits.

Intercepts requests to protected endpoints (assessments, AI interviews)
and blocks them if the user has exceeded their subscription plan limits.
"""
import logging
import re

from django.http import JsonResponse
from django.utils import timezone

logger = logging.getLogger(__name__)

# URL patterns that consume assessment quota
ASSESSMENT_CONSUME_PATTERNS = [
    re.compile(r"^/v1/assessment/\d+/take/$"),
    re.compile(r"^/v1/candidate-assessment/\d+/take/$"),
]

# URL patterns that consume AI interview quota
AI_INTERVIEW_CONSUME_PATTERNS = [
    re.compile(r"^/v1/api/ai/upload-audio/$"),
    re.compile(r"^/v1/ai-assessment/save-answer/$"),
    re.compile(r"^/v1/my-admin/ai-assessments/\d+/assign/$"),
]


class UsageEnforcementMiddleware:
    """
    Middleware that enforces subscription usage limits.
    
    - Individual users: checks their personal subscription limits
    - Organization users: checks org-level limits (if applicable)
    - Super admins: never throttled
    
    When a limit is reached, returns a 429 Too Many Requests response
    with a JSON body explaining which limit was exceeded.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Only enforce on authenticated users making POST/GET to consume endpoints
        user = getattr(request, "user", None)
        if not user or not getattr(user, "is_authenticated", False):
            return self.get_response(request)

        # Super admins and org users managed by org_admin are exempt
        if getattr(user, "is_superuser", False):
            return self.get_response(request)
        if getattr(user, "role", "") in ("super_admin",):
            return self.get_response(request)

        # Only enforce on individual subscribers
        if not getattr(user, "is_individual", False):
            return self.get_response(request)

        path = request.path

        # Check assessment quota
        if request.method in ("GET", "POST") and self._matches(path, ASSESSMENT_CONSUME_PATTERNS):
            enforcement = self._check_assessment_limit(user)
            if enforcement:
                return enforcement

        # Check AI interview quota
        if request.method == "POST" and self._matches(path, AI_INTERVIEW_CONSUME_PATTERNS):
            enforcement = self._check_ai_interview_limit(user)
            if enforcement:
                return enforcement

        return self.get_response(request)

    def _matches(self, path, patterns):
        return any(p.match(path) for p in patterns)

    def _check_assessment_limit(self, user):
        """Check if user has exceeded their assessment quota."""
        from core.models import SubscriptionUsage, UserSubscription

        sub = getattr(user, "subscription", None)
        if not sub or not sub.is_active:
            return self._limit_response(
                "No active subscription. Please subscribe to take assessments.",
                "assessment",
            )

        if not sub.is_valid():
            return self._limit_response(
                "Your subscription has expired. Please renew to continue.",
                "assessment",
            )

        plan = sub.plan
        now = timezone.now()

        usage, created = SubscriptionUsage.objects.get_or_create(
            user=user,
            month=now.month,
            year=now.year,
            defaults={
                "subscription": sub,
                "assessments_used": 0,
                "ai_interviews_used": 0,
            },
        )
        if not created and usage.subscription != sub:
            usage.subscription = sub
            usage.save(update_fields=["subscription"])

        # Check monthly limit
        if usage.assessments_used >= plan.assessments_per_month:
            return self._limit_response(
                f"Monthly assessment limit reached ({plan.assessments_per_month}). "
                f"Upgrade your plan for more assessments.",
                "assessment",
                limit=plan.assessments_per_month,
                used=usage.assessments_used,
            )

        # For free tier, also check weekly limit
        if plan.plan_type == "free":
            week_usage = self._get_weekly_usage(user, "assessment")
            if week_usage >= plan.free_assessments_per_week:
                return self._limit_response(
                    f"Weekly free assessment limit reached ({plan.free_assessments_per_week}). "
                    f"Upgrade to a paid plan for more.",
                    "assessment",
                    limit=plan.free_assessments_per_week,
                    used=week_usage,
                    period="weekly",
                )

        return None

    def _check_ai_interview_limit(self, user):
        """Check if user has exceeded their AI interview quota."""
        from core.models import SubscriptionUsage, UserSubscription

        sub = getattr(user, "subscription", None)
        if not sub or not sub.is_active:
            return self._limit_response(
                "No active subscription. Please subscribe to use AI interviews.",
                "ai_interview",
            )

        if not sub.is_valid():
            return self._limit_response(
                "Your subscription has expired. Please renew to continue.",
                "ai_interview",
            )

        plan = sub.plan
        now = timezone.now()

        usage, created = SubscriptionUsage.objects.get_or_create(
            user=user,
            month=now.month,
            year=now.year,
            defaults={
                "subscription": sub,
                "assessments_used": 0,
                "ai_interviews_used": 0,
            },
        )
        if not created and usage.subscription != sub:
            usage.subscription = sub
            usage.save(update_fields=["subscription"])

        if usage.ai_interviews_used >= plan.ai_interviews_per_month:
            return self._limit_response(
                f"Monthly AI interview limit reached ({plan.ai_interviews_per_month}). "
                f"Upgrade your plan for more.",
                "ai_interview",
                limit=plan.ai_interviews_per_month,
                used=usage.ai_interviews_used,
            )

        # Free tier weekly check
        if plan.plan_type == "free":
            week_usage = self._get_weekly_usage(user, "ai_interview")
            if week_usage >= plan.free_ai_assessments_per_week:
                return self._limit_response(
                    f"Weekly free AI interview limit reached ({plan.free_ai_assessments_per_week}). "
                    f"Upgrade to a paid plan for more.",
                    "ai_interview",
                    limit=plan.free_ai_assessments_per_week,
                    used=week_usage,
                    period="weekly",
                )

        return None

    def _get_weekly_usage(self, user, usage_type):
        """
        Count usage in the current ISO week by looking at actual activity.
        """
        from datetime import timedelta

        from core.models import CandidateAssessment

        now = timezone.now()
        week_start = now - timedelta(days=now.weekday())
        week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)

        if usage_type == "assessment":
            return CandidateAssessment.objects.filter(
                candidate=user,
                start_time__gte=week_start,
                status__in=["in_progress", "completed"],
            ).count()
        elif usage_type == "ai_interview":
            # Count AI assessment attempts this week
            from AI_assessment.models import AIAssessmentResult

            try:
                return AIAssessmentResult.objects.filter(
                    candidate=user,
                    created_at__gte=week_start,
                ).count()
            except Exception:
                return 0
        return 0

    def _limit_response(self, message, resource_type, limit=None, used=None, period="monthly"):
        """Return a 429 Too Many Requests JSON response."""
        data = {
            "error": "usage_limit_exceeded",
            "message": message,
            "resource_type": resource_type,
            "period": period,
        }
        if limit is not None:
            data["limit"] = limit
        if used is not None:
            data["used"] = used

        return JsonResponse(data, status=429)
