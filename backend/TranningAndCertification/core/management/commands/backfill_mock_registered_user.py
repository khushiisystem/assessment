from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from mock_interview.models import MockSession


class Command(BaseCommand):
    help = (
        "Backfill registered_user FK on existing MockSessions by matching "
        "candidate_email to a registered core.User (role=candidate)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Print what would be updated without saving.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        User = get_user_model()

        sessions = MockSession.objects.filter(
            registered_user__isnull=True,
            candidate_email__isnull=False,
        ).exclude(candidate_email='')

        self.stdout.write(f"Found {sessions.count()} sessions without a registered_user link.\n")

        updated = 0
        skipped = 0

        for session in sessions:
            try:
                user = User.objects.get(email__iexact=session.candidate_email, role='candidate')
            except User.DoesNotExist:
                skipped += 1
                continue
            except User.MultipleObjectsReturned:
                self.stdout.write(
                    self.style.WARNING(
                        f"  Skipped session #{session.id} — multiple users found for {session.candidate_email}"
                    )
                )
                skipped += 1
                continue

            if dry_run:
                self.stdout.write(
                    f"  [dry-run] Session #{session.id} ({session.stack}) -> user {user.email} (id={user.id})"
                )
            else:
                session.registered_user = user
                session.save(update_fields=['registered_user'])

            updated += 1

        if dry_run:
            self.stdout.write(self.style.SUCCESS(f"\nDry run complete. Would update {updated}, skip {skipped}."))
        else:
            self.stdout.write(self.style.SUCCESS(f"\nDone. Updated {updated} sessions, skipped {skipped} (no matching user)."))
