from django.db import migrations, models


def migrate_roles_forward(apps, schema_editor):
    """Move the roles being retired onto the new set.

    faculty / examiner were the assessment-creating staff roles, so they map to
    the new `manager` role. employee / bda are being removed entirely; the
    safest landing for them is the least-privileged `candidate` role.
    """
    User = apps.get_model("core", "User")
    User.objects.filter(role__in=["faculty", "examiner"]).update(role="manager")
    User.objects.filter(role__in=["employee", "bda"]).update(role="candidate")


def migrate_roles_backward(apps, schema_editor):
    """Best-effort reverse: managers created here can't be told apart from
    genuine managers, so reverse only restores the choice set (no data move)."""
    # Intentionally a no-op for data — we cannot distinguish migrated users.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_alter_user_is_individual"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="role",
            field=models.CharField(
                max_length=20,
                default="candidate",
                choices=[
                    ("super_admin", "Super Admin"),
                    ("org_admin", "Organization Admin"),
                    ("manager", "Manager"),
                    ("candidate", "Candidate"),
                ],
            ),
        ),
        migrations.RunPython(migrate_roles_forward, migrate_roles_backward),
    ]
