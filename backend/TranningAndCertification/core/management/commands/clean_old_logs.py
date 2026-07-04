"""
Management command to clean old activity logs
Usage: python manage.py clean_old_logs --days 90
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from core.models import UserActivityLog


class Command(BaseCommand):
    help = 'Delete activity logs older than specified days (default: 90 days)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=5,
            help='Delete logs older than this many days (default: 90)',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be deleted without actually deleting',
        )

    def handle(self, *args, **options):
        days = options['days']
        dry_run = options['dry_run']
        
        cutoff_date = timezone.now() - timedelta(days=days)
        
        # Get logs to delete
        old_logs = UserActivityLog.objects.filter(timestamp__lt=cutoff_date)
        count = old_logs.count()
        
        if count == 0:
            self.stdout.write(
                self.style.SUCCESS(f'No logs older than {days} days found.')
            )
            return
        
        if dry_run:
            self.stdout.write(
                self.style.WARNING(
                    f'DRY RUN: Would delete {count} logs older than {days} days '
                    f'(before {cutoff_date.strftime("%Y-%m-%d %H:%M:%S")})'
                )
            )
            
            # Show sample of logs that would be deleted
            sample_logs = old_logs[:5]
            self.stdout.write('\nSample logs that would be deleted:')
            for log in sample_logs:
                self.stdout.write(
                    f'  - {log.timestamp.strftime("%Y-%m-%d %H:%M:%S")} | '
                    f'{log.user.username if log.user else "Anonymous"} | '
                    f'{log.get_action_type_display()}'
                )
            
            if count > 5:
                self.stdout.write(f'  ... and {count - 5} more')
        else:
            # Actually delete the logs
            deleted_count, _ = old_logs.delete()
            
            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully deleted {deleted_count} logs older than {days} days '
                    f'(before {cutoff_date.strftime("%Y-%m-%d %H:%M:%S")})'
                )
            )
