"""
Management command to seed default subscription plans.
Run once: python manage.py seed_subscription_plans
"""
from django.core.management.base import BaseCommand
from core.models import SubscriptionPlan


DEFAULT_PLANS = [
    {
        "name": "Free",
        "plan_type": "free",
        "price": "0.00",
        "duration_months": 0,
        "assessments_per_month": 0,
        "ai_interviews_per_month": 0,
        "free_assessments_per_week": 2,
        "free_ai_assessments_per_week": 1,
        "is_active": True,
    },
    {
        "name": "Pro Monthly",
        "plan_type": "monthly",
        "price": "999.00",
        "duration_months": 1,
        "assessments_per_month": 25,
        "ai_interviews_per_month": 10,
        "free_assessments_per_week": 0,
        "free_ai_assessments_per_week": 0,
        "is_active": True,
    },
    {
        "name": "Pro Yearly",
        "plan_type": "yearly",
        "price": "9999.00",
        "duration_months": 12,
        "assessments_per_month": 50,
        "ai_interviews_per_month": 25,
        "free_assessments_per_week": 0,
        "free_ai_assessments_per_week": 0,
        "is_active": True,
    },
]


class Command(BaseCommand):
    help = "Seed default subscription plans (Free, Pro Monthly, Pro Yearly)."

    def handle(self, *args, **options):
        from organization.context import set_tenant_context
        set_tenant_context(None, is_super_admin=True)

        created_count = 0
        for plan_data in DEFAULT_PLANS:
            plan, created = SubscriptionPlan.objects.get_or_create(
                plan_type=plan_data["plan_type"],
                defaults=plan_data,
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"  Created: {plan.name}"))
                created_count += 1
            else:
                self.stdout.write(f"  Already exists: {plan.name}")

        if created_count:
            self.stdout.write(self.style.SUCCESS(f"\n{created_count} plan(s) created."))
        else:
            self.stdout.write("All default plans already exist.")
