from django.db import migrations


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


def seed_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model("core", "SubscriptionPlan")
    for plan_data in DEFAULT_PLANS:
        SubscriptionPlan.objects.get_or_create(
            plan_type=plan_data["plan_type"],
            defaults=plan_data,
        )


def remove_plans(apps, schema_editor):
    SubscriptionPlan = apps.get_model("core", "SubscriptionPlan")
    SubscriptionPlan.objects.filter(
        plan_type__in=["free", "monthly", "yearly"]
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_plans, reverse_code=remove_plans),
    ]
