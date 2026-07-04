from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from core.models import User, Assessment, CandidateAssessment, UserSubscription
from AI_assessment.models import AIAssessment, CandidateAIAssessment
from core.utils import send_assignment_notification
from organization.context import set_tenant_context, clear_tenant_context

# Note: AI assessment notification import might vary based on your app structure
try:
    from AI_assessment.views import send_ai_assessment_notification
except ImportError:
    send_ai_assessment_notification = None

class Command(BaseCommand):
    help = 'Assign weekly free assessments to individual subscribers'

    def handle(self, *args, **kwargs):
        self.stdout.write("Starting weekly assessment assignment...")
        
        # Bypass tenant isolation to see all individual users across the system
        set_tenant_context(None, is_super_admin=True)

        try:
            self._do_assignment()
        finally:
            clear_tenant_context()

    def _do_assignment(self):
        # 1. Find all active free-tier individual users (not part of any organization)
        free_subscribers = User.objects.filter(
            is_individual=True,
            organization__isnull=True,
            subscription__plan__plan_type='free',
            subscription__is_active=True,
            is_active=True,
        )

        self.stdout.write(f"Found {free_subscribers.count()} free tier individual subscribers.")

        today = timezone.now()
        one_week_ago = today - timedelta(days=7)

        # Get a system admin for the 'assigned_by' field
        admin_user = User.objects.filter(is_superuser=True).first()
        if not admin_user:
            self.stderr.write("ERROR: No superuser found. Cannot assign assessments.")
            return

        for user in free_subscribers:
            self.stdout.write(f"Processing user: {user.email}")
            
            # 2. Check if already assigned this week
            recent_regular = CandidateAssessment.objects.filter(
                candidate=user, 
                assigned_date__gte=one_week_ago
            ).exists()
            
            recent_ai = CandidateAIAssessment.objects.filter(
                candidate=user, 
                assigned_date__gte=one_week_ago
            ).exists()

            # 3. Assign Regular Assessment if needed
            if not recent_regular:
                self.assign_assessment(user, 'regular', admin_user)
            else:
                self.stdout.write(f"  - Regular assessment already assigned this week.")
            
            # 4. Assign AI Assessment if needed
            if not recent_ai:
                self.assign_assessment(user, 'ai', admin_user)
            else:
                self.stdout.write(f"  - AI assessment already assigned this week.")

    def assign_assessment(self, user, assessment_type, admin_user):
        # Match based on user's tech_stack if available
        user_skills = user.tech_stack or []
        
        now = timezone.now()
        # Weekly assessments are valid for 7 days
        expiry_date = now + timedelta(days=7)

        if assessment_type == 'regular':
            # Pick an active assessment
            # We filter for global assessments to ensure they are intended for individuals
            assessment = Assessment.objects.filter(is_active=True, is_global=True).order_by('?').first()
            if not assessment:
                 assessment = Assessment.objects.filter(is_active=True).order_by('?').first()

            if assessment:
                # Ensure visibility in UI by updating assessment window
                if assessment.end_date < now:
                    assessment.start_date = now
                    assessment.end_date = expiry_date
                    assessment.save(update_fields=['start_date', 'end_date'])

                ca, created = CandidateAssessment.objects.get_or_create(
                    candidate=user,
                    assessment=assessment,
                    defaults={'assigned_by': admin_user}
                )
                if created:
                    self.stdout.write(f"  + Assigned Regular: {assessment.title} (Visible until {expiry_date})")
                    try:
                        send_assignment_notification(ca)
                    except Exception as e:
                        self.stderr.write(f"  ! Email failed: {str(e)}")
            else:
                self.stderr.write(f"  ! No active regular assessments found in the system.")
        
        else:
            # AI Assessment assignment
            ai_assessment = AIAssessment.objects.filter(is_active=True, is_global=True).order_by('?').first()
            if not ai_assessment:
                ai_assessment = AIAssessment.objects.filter(is_active=True).order_by('?').first()

            if ai_assessment:
                # Ensure visibility in UI by updating assessment window
                if ai_assessment.end_date < now:
                    ai_assessment.start_date = now
                    ai_assessment.end_date = expiry_date
                    ai_assessment.save(update_fields=['start_date', 'end_date'])

                ca_ai, created = CandidateAIAssessment.objects.get_or_create(
                    candidate=user,
                    ai_assessment=ai_assessment,
                    defaults={
                        'assigned_by': admin_user,
                        'resume_text': ", ".join(user_skills) if user_skills else "General technical skills"
                    }
                )
                if created:
                    self.stdout.write(f"  + Assigned AI: {ai_assessment.title} (Visible until {expiry_date})")
                    if send_ai_assessment_notification:
                        try:
                            send_ai_assessment_notification(ca_ai)
                        except Exception as e:
                            self.stderr.write(f"  ! AI Email failed: {str(e)}")
            else:
                self.stderr.write(f"  ! No active AI assessments found in the system.")
