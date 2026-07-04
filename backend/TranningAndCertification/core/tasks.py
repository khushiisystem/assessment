"""
Celery tasks for the core app.
Handles automated weekly assessment assignment, subscription expiration,
and expired assessment updates.
"""
import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def assign_weekly_assessments_task(self):
    """
    Assign weekly free assessments to all individual free-tier subscribers.
    Runs every Monday at midnight via Celery Beat.
    """
    from datetime import timedelta

    from AI_assessment.models import AIAssessment, CandidateAIAssessment
    from core.models import Assessment, CandidateAssessment, User
    from core.utils import send_assignment_notification
    from organization.context import set_tenant_context, clear_tenant_context

    try:
        # Bypass tenant isolation to see all data
        set_tenant_context(None, is_super_admin=True)

        free_subscribers = User.objects.filter(
            is_individual=True,
            organization__isnull=True,
            subscription__plan__plan_type="free",
            subscription__is_active=True,
            is_active=True,
        )

        now = timezone.now()
        one_week_ago = now - timedelta(days=7)
        expiry_date = now + timedelta(days=7)
        admin_user = User.objects.filter(is_superuser=True).first()

        if not admin_user:
            logger.error("No superuser found for weekly assessment assignment")
            return {"assigned": 0, "users_processed": 0, "error": "No admin user"}

        assigned_count = 0
        users_count = free_subscribers.count()
        logger.info(f"Weekly assignment: processing {users_count} free tier subscribers")

        for user in free_subscribers.iterator():
            # Regular assessment
            recent_regular = CandidateAssessment.objects.filter(
                candidate=user, assigned_date__gte=one_week_ago
            ).exists()

            if not recent_regular:
                assessment = Assessment.objects.filter(
                    is_active=True, is_global=True
                ).order_by("?").first()
                if not assessment:
                    assessment = Assessment.objects.filter(is_active=True).order_by("?").first()

                if assessment:
                    # Ensure the assessment window is active
                    if assessment.end_date < now:
                        assessment.start_date = now
                        assessment.end_date = expiry_date
                        assessment.save(update_fields=['start_date', 'end_date'])

                    ca, created = CandidateAssessment.objects.get_or_create(
                        candidate=user,
                        assessment=assessment,
                        defaults={"assigned_by": admin_user},
                    )
                    if created:
                        assigned_count += 1
                        logger.info(f"Weekly: Assigned regular '{assessment.title}' to {user.email}")
                        try:
                            send_assignment_notification(ca)
                        except Exception as e:
                            logger.warning(f"Email failed for {user.email}: {e}")

            # AI assessment
            recent_ai = CandidateAIAssessment.objects.filter(
                candidate=user, assigned_date__gte=one_week_ago
            ).exists()

            if not recent_ai:
                ai_assessment = AIAssessment.objects.filter(
                    is_active=True, is_global=True
                ).order_by("?").first()
                if not ai_assessment:
                    ai_assessment = AIAssessment.objects.filter(is_active=True).order_by("?").first()

                if ai_assessment:
                    # Ensure the AI assessment window is active
                    if ai_assessment.end_date < now:
                        ai_assessment.start_date = now
                        ai_assessment.end_date = expiry_date
                        ai_assessment.save(update_fields=['start_date', 'end_date'])

                    user_skills = user.tech_stack or []
                    ca_ai, created = CandidateAIAssessment.objects.get_or_create(
                        candidate=user,
                        ai_assessment=ai_assessment,
                        defaults={
                            "assigned_by": admin_user,
                            "resume_text": ", ".join(user_skills) if user_skills else "General technical skills",
                        },
                    )
                    if created:
                        assigned_count += 1
                        logger.info(f"Weekly: Assigned AI '{ai_assessment.title}' to {user.email}")

        logger.info(f"Weekly assignment complete: {assigned_count} assessments assigned to {users_count} users.")
        return {"assigned": assigned_count, "users_processed": users_count}

    except Exception as exc:
        logger.exception("Weekly assessment assignment failed")
        raise self.retry(exc=exc)
    finally:
        clear_tenant_context()


@shared_task(bind=True, max_retries=2, default_retry_delay=120)
def expire_subscriptions_task(self):
    """
    Check for expired subscriptions and deactivate them.
    Downgrade paid users back to free tier automatically.
    Runs daily at 1 AM.
    """
    from core.models import SubscriptionPlan, UserSubscription

    try:
        now = timezone.now()

        # Find expired active subscriptions
        expired_subs = UserSubscription.objects.filter(
            is_active=True,
            end_date__isnull=False,
            end_date__lt=now,
        ).select_related("user", "plan")

        deactivated_count = 0
        downgraded_count = 0

        # Get the free plan for downgrade
        free_plan = SubscriptionPlan.objects.filter(plan_type="free", is_active=True).first()

        for sub in expired_subs.iterator():
            sub.is_active = False
            sub.save(update_fields=["is_active"])
            deactivated_count += 1

            # Downgrade user to free tier if free plan exists
            if free_plan and sub.user.is_individual:
                new_sub = UserSubscription.objects.create(
                    user=sub.user,
                    plan=free_plan,
                    is_active=True,
                    end_date=None,  # Free tier doesn't expire
                )
                sub.user.subscription = new_sub
                sub.user.save(update_fields=["subscription"])
                downgraded_count += 1

                # Send notification email
                try:
                    from django.conf import settings as django_settings
                    from django.core.mail import send_mail
                    from django.template.loader import render_to_string

                    upgrade_url = f"{django_settings.FRONTEND_URL.rstrip('/')}/candidate/subscription"

                    send_mail(
                        subject="Subscription Expired - Downgraded to Free Tier",
                        message=(
                            f"Hi {sub.user.first_name or sub.user.username},\n\n"
                            f"Your {sub.plan.name} subscription has expired.\n"
                            f"You have been downgraded to the Free Tier.\n\n"
                            f"To continue with full access, please upgrade your plan at:\n"
                            f"{upgrade_url}\n\n"
                            f"Regards,\nSkilTechy Team"
                        ),
                        from_email=django_settings.DEFAULT_FROM_EMAIL,
                        recipient_list=[sub.user.email],
                        fail_silently=True,
                        html_message=render_to_string(
                            "emails/reminder_subscription_expired.html",
                            {
                                "user_name": sub.user.first_name or sub.user.username,
                                "plan_name": sub.plan.name,
                                "upgrade_url": upgrade_url,
                            },
                        ),
                    )
                except Exception as e:
                    logger.warning(f"Expiration email failed for {sub.user.email}: {e}")

        logger.info(f"Subscription expiration: {deactivated_count} deactivated, {downgraded_count} downgraded.")
        return {"deactivated": deactivated_count, "downgraded": downgraded_count}

    except Exception as exc:
        logger.exception("Subscription expiration task failed")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def update_expired_assessments_task(self):
    """
    Update status of expired in_progress assessments.
    Runs every 15 minutes.
    """
    from core.models import CandidateAssessment

    try:
        in_progress = CandidateAssessment.objects.filter(
            status="in_progress"
        ).select_related("assessment", "candidate")

        updated_count = 0
        for ca in in_progress.iterator():
            if ca.check_and_update_expired_status():
                updated_count += 1

        if updated_count:
            logger.info(f"Updated {updated_count} expired assessments.")
        return {"updated": updated_count}

    except Exception as exc:
        logger.exception("Expired assessments update failed")
        raise self.retry(exc=exc)


@shared_task(ignore_result=True)
def send_email_async(subject, message, from_email, recipient_list):
    """
    Send email asynchronously via Celery to avoid blocking requests.
    """
    from django.core.mail import send_mail

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=from_email,
            recipient_list=recipient_list,
            fail_silently=False,
        )
    except Exception as e:
        logger.exception(f"Async email send failed: {e}")
