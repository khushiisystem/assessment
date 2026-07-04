from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import CandidateAssessment


class Command(BaseCommand):
    help = 'Update status of expired in_progress assessments to completed'

    def handle(self, *args, **options):
        # Get all in_progress assessments
        in_progress_assessments = CandidateAssessment.objects.filter(
            status='in_progress'
        ).select_related('assessment', 'candidate')
        
        updated_count = 0
        
        for assessment in in_progress_assessments:
            if assessment.check_and_update_expired_status():
                updated_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Updated: {assessment.candidate.username} - {assessment.assessment.title}'
                    )
                )
        
        if updated_count > 0:
            self.stdout.write(
                self.style.SUCCESS(
                    f'\nSuccessfully updated {updated_count} expired assessment(s)'
                )
            )
        else:
            self.stdout.write(
                self.style.WARNING('No expired assessments found')
            )
