from django.db import migrations

# Promote this account to super_admin. Idempotent and safe: if the user does
# not exist (e.g. on a fresh DB) it simply does nothing.
TARGET_EMAIL = "hr@zecdata.com"


def make_super_admin(apps, schema_editor):
    User = apps.get_model("core", "User")
    User.objects.filter(email__iexact=TARGET_EMAIL).update(role="super_admin")


def noop(apps, schema_editor):
    # No reverse: we don't know the previous role, and demoting on rollback
    # would be surprising. Intentionally a no-op.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0002_seed_subscription_plans"),
    ]

    operations = [
        migrations.RunPython(make_super_admin, noop),
    ]
