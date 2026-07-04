"""
Usage tracking utilities.

Call these functions when a user consumes a subscription resource
(takes an assessment, starts an AI interview) to increment the usage counter.
"""
import logging

from django.utils import timezone

logger = logging.getLogger(__name__)


def increment_assessment_usage(user):
    """
    Increment the assessment usage counter for the current month.
    Call this after a candidate starts/takes an assessment.
    """
    from core.models import SubscriptionUsage

    if not getattr(user, "is_individual", False):
        return  # Org users don't have individual limits

    sub = getattr(user, "subscription", None)
    if not sub or not sub.is_active:
        return

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
    usage.assessments_used += 1
    usage.save(update_fields=["assessments_used"])
    logger.info(
        f"Usage: {user.email} assessments_used={usage.assessments_used} "
        f"(limit={sub.plan.assessments_per_month})"
    )


def increment_ai_interview_usage(user):
    """
    Increment the AI interview usage counter for the current month.
    Call this when a candidate completes an AI interview session.
    """
    from core.models import SubscriptionUsage

    if not getattr(user, "is_individual", False):
        return

    sub = getattr(user, "subscription", None)
    if not sub or not sub.is_active:
        return

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
    usage.ai_interviews_used += 1
    usage.save(update_fields=["ai_interviews_used"])
    logger.info(
        f"Usage: {user.email} ai_interviews_used={usage.ai_interviews_used} "
        f"(limit={sub.plan.ai_interviews_per_month})"
    )


def get_usage_summary(user):
    """
    Get usage summary for a user's current billing period.
    Returns dict with usage info, or None if not applicable.
    """
    from core.models import SubscriptionUsage

    sub = getattr(user, "subscription", None)
    if not sub or not sub.is_active:
        return None

    now = timezone.now()
    try:
        usage = SubscriptionUsage.objects.get(
            user=user,
            month=now.month,
            year=now.year,
        )
        if usage.subscription != sub:
            usage.subscription = sub
            usage.save(update_fields=["subscription"])
    except SubscriptionUsage.DoesNotExist:
        usage = None

    plan = sub.plan
    return {
        "assessments_used": usage.assessments_used if usage else 0,
        "assessments_limit": plan.assessments_per_month,
        "ai_interviews_used": usage.ai_interviews_used if usage else 0,
        "ai_interviews_limit": plan.ai_interviews_per_month,
        "plan_name": plan.name,
        "plan_type": plan.plan_type,
    }
