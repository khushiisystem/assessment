from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone
import os
import uuid
from organization.models import Organization, TenantModel

def candidate_photo_path(instance, filename):
    ext = filename.split('.')[-1]
    filename = f"{instance.username}_{uuid.uuid4().hex[:8]}.{ext}"
    return os.path.join('candidates', filename)


class User(AbstractUser):
    ROLE_CHOICES = (
        ('super_admin', 'Super Admin'),
        ('org_admin', 'Organization Admin'),
        ('manager', 'Manager'),
        ('candidate', 'Candidate'),
    )
    
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='candidate')
    username = models.CharField(max_length=150, unique=True)
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=200, blank=True)
    avatar = models.URLField(max_length=500, blank=True, null=True)
    phone = models.CharField(max_length=15, blank=True)
    resume_s3_url = models.URLField(max_length=500, blank=True, null=True)  # S3 URL for resume
    profile = models.TextField(blank=True, null=True)  # Technical profile/skills
    professional_summary = models.TextField(blank=True, null=True)  # Professional summary
    tech_stack = models.JSONField(default=list, blank=True)  # List of technologies/skills
    services_worked_on = models.JSONField(default=list, blank=True)  # List of services
    payment_methods_used = models.JSONField(default=list, blank=True)  # List of payment methods
    projects = models.JSONField(default=list, blank=True)  # List of projects
    # Track when an admin (or system) reactivated a temporary user so we can
    # start a fresh 24-hour window without needing any cron/commands.
    admin_reactivated_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
    )
    # Subscription fields
    is_individual = models.BooleanField(default=True, help_text="True if user is an individual subscriber (isolated), False if part of an organization")
    subscription = models.OneToOneField('UserSubscription', on_delete=models.SET_NULL, null=True, blank=True, related_name='user_profile')
    created_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_users')

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    # @property
    # def is_primary_user(self):
    #     """Check if user is primary based on email domain"""
    #     if not self.email:
    #         return False
    #     domain = self.email.split('@')[-1].lower()
    #     return domain in ['zecdata.com', 'technomancerai.com', 'bestpeers.com']

    # def should_be_disabled(self):
    #     """
    #     Check if temporary user should be disabled after 24 hours.

    #     Rules:
    #     - Primary users (whitelisted domains) are never auto-disabled.
    #     - Temporary users get 24 hours from creation.
    #     - If an admin reactivates a user (is_active from False -> True),
    #       they get a fresh 24-hour window from that reactivation time.
    #     """
    #     if self.is_primary_user:
    #         return False

    #     from datetime import timedelta

    #     # If admin has reactivated the account, use that as the reference;
    #     # otherwise fall back to initial creation time.
    #     reference_time = self.admin_reactivated_at or self.date_joined
    #     if not reference_time:
    #         return False

    #     return timezone.now() > reference_time + timedelta(hours=24)

    # def disable_if_expired(self):
    #     """Disable the user if they are temporary and expired"""
    #     if self.should_be_disabled() and self.is_active:
    #         self.is_active = False
    #         self.save(update_fields=['is_active'])

    # def save(self, *args, **kwargs):
    #     """
    #     Override save to detect when an admin (or system) reactivates a
    #     temporary account and start a new 24-hour window automatically.

    #     This keeps everything fully automated without any management
    #     commands or cron jobs.
    #     """
    #     if self.pk:
    #         try:
    #             old = User.objects.get(pk=self.pk)
    #         except User.DoesNotExist:
    #             old = None
    #         else:
    #             # If previously inactive and now active, and not a primary user,
    #             # treat this as an admin reactivation and reset the timer.
    #             if not old.is_active and self.is_active and not self.is_primary_user:
    #                 self.admin_reactivated_at = timezone.now()

    #     super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"

class Category(TenantModel):
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    
    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = "Categories"

class Question(TenantModel):
    QUESTION_TYPES = (
        ('mcq_single', 'MCQ (Single Correct)'),
        ('mcq_multiple', 'MCQ (Multiple Correct)'),
        ('coding', 'Coding'),
        ('sql', 'SQL'),
        ('subjective', 'Subjective'),
        ('fill_blank', 'Fill in the Blanks'),
        ('true_false', 'True/False'),
        ('MCQ', 'MCQ'),
    )
    
    DIFFICULTY_CHOICES = (
        ('easy', 'Easy'),
        ('medium', 'Medium'),
        ('hard', 'Hard'),
    )
    
    title = models.CharField(max_length=500)
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPES)
    category = models.ForeignKey(Category, on_delete=models.CASCADE)
    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES)
    marks = models.PositiveIntegerField(default=1)
    description = models.TextField(blank=True)
    # Coding questions ke liye extra fields
    sample_input = models.TextField(blank=True)
    sample_output = models.TextField(blank=True)
    # MCQ options ke liye
    option1 = models.CharField(max_length=500, blank=True)
    option2 = models.CharField(max_length=500, blank=True)
    option3 = models.CharField(max_length=500, blank=True)
    option4 = models.CharField(max_length=500, blank=True)
    option5 = models.CharField(max_length=500, blank=True)
    correct_answer = models.TextField(blank=True)  # Comma separated for multiple correct; optional for coding
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    tags = models.CharField(max_length=500, blank=True)  # Comma separated tags
    
    def __str__(self):
        return f"{self.title} ({self.get_difficulty_display()})"
    
    def get_correct_answers_list(self):
        if self.question_type in ['mcq_multiple', 'fill_blank']:
            return [ans.strip() for ans in self.correct_answer.split(',')]
        return [self.correct_answer]

class TestCase(TenantModel):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='testcases')
    input_data = models.TextField(blank=True)          # stdin for this test
    expected_output = models.TextField(blank=True)
    points = models.FloatField(default=1.0)
    is_hidden = models.BooleanField(default=True)     # hidden from candidate UI
    created_at = models.DateTimeField(auto_now_add=True)

    dummy = models.BooleanField(default=False)  # 👈 Add this temporarily

    def __str__(self):
        return f"TC for Q{self.question.id} (points={self.points})"


class Assessment(TenantModel):
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    categories = models.ManyToManyField(Category)
    questions = models.ManyToManyField(Question, through='AssessmentQuestion')
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    duration = models.PositiveIntegerField(help_text="Total minutes")  # Total time in minutes
    start_date = models.DateTimeField()
    end_date = models.DateTimeField()
    shuffle_questions = models.BooleanField(default=True)
    shuffle_options = models.BooleanField(default=True)
    instructions = models.TextField(blank=True)
    passing_percentage = models.FloatField(default=0, help_text="Minimum percentage (0-100) required to earn a certificate. 0 means no certificate.")
    is_global = models.BooleanField(default=False)
    visible_to_organizations = models.ManyToManyField(
        Organization,
        blank=True,
        related_name="shared_assessments",
    )

    def __str__(self):
        return self.title
    
    def is_ongoing(self):
        now = timezone.now()
        return self.start_date <= now <= self.end_date
    
    def is_upcoming(self):
        return timezone.now() < self.start_date
    
    def is_expired(self):
        return timezone.now() > self.end_date

class AssessmentQuestion(TenantModel):
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    section = models.CharField(max_length=100, default="Main")
    section_time = models.PositiveIntegerField(default=0)  # Section-specific time in minutes
    order = models.PositiveIntegerField(default=0)
    
    class Meta:
        unique_together = ('assessment', 'question')
        ordering = ['order']
    def __str__(self):
        return f"{self.assessment.title}: Q{self.question.id} - {self.question.title} "

class CandidateAssessment(TenantModel):
    candidate = models.ForeignKey(User, on_delete=models.CASCADE)
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE)
    assigned_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assigned_assessments')
    assigned_date = models.DateTimeField(auto_now_add=True)
    start_time = models.DateTimeField(null=True, blank=True)
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=(
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('expired', 'Expired')
    ), default='assigned')
    score = models.FloatField(default=0)
    total_marks = models.FloatField(default=0)
    percentage = models.FloatField(default=0)
    
    class Meta:
        unique_together = ('candidate', 'assessment')
    
    def calculate_score(self):
        """Calculate total score and percentage for the assessment"""
        # Ensure total_marks is sum of ALL questions in the assessment (not only answered ones)
        total_marks = self.assessment.questions.aggregate(total=models.Sum('marks'))['total'] or 0

        # Get all responses by this candidate for this assessment
        responses = Response.objects.filter(
            candidate=self.candidate,
            assessment=self.assessment
        ).select_related('question')

        # Auto-evaluate MCQ-like questions if not evaluated
        evaluated_count = 0
        for response in responses:
            if response.question.question_type in ['mcq_single', 'mcq_multiple', 'true_false', 'fill_blank']:
                if response.is_correct is None or response.marks_obtained == 0:
                    try:
                        response.evaluate_mcq()
                        evaluated_count += 1
                    except Exception as e:
                        print(f"Error evaluating response {response.id}: {e}")

        print(f"DEBUG calculate_score: Evaluated {evaluated_count} MCQs")
        
        # Refresh responses to get updated marks
        responses = Response.objects.filter(
            candidate=self.candidate,
            assessment=self.assessment
        )

        # Sum obtained marks from responses (responses for unattempted questions won't exist -> 0)
        obtained_marks = responses.aggregate(total=models.Sum('marks_obtained'))['total'] or 0

        print(f"DEBUG calculate_score: Total={total_marks}, Obtained={obtained_marks}, Responses={responses.count()}")

        # Update fields on CandidateAssessment
        self.total_marks = total_marks
        self.score = obtained_marks
        self.percentage = (obtained_marks / total_marks * 100) if total_marks > 0 else 0.0

        self.save(update_fields=['total_marks', 'score', 'percentage'])
        return self.score

    def evaluate_all_mcqs(self):
        """Evaluate all MCQ questions in the assessment"""
        responses = Response.objects.filter(
            candidate=self.candidate,
            assessment=self.assessment,
            question__question_type__in=['mcq_single', 'mcq_multiple', 'true_false', 'fill_blank']
        )
        
        for response in responses:
            if response.is_correct is None:
                response.evaluate_mcq()
        
        return responses.count()
    
    def check_and_update_expired_status(self):
        """Check if assessment has expired and update status accordingly"""
        from datetime import timedelta
        
        # If already completed or expired, no need to check
        if self.status in ['completed', 'expired']:
            return False
        
        # Check if assessment end_date has passed
        if self.assessment.is_expired():
            if self.status == 'in_progress':
                # Auto-submit the assessment
                self.status = 'completed'
                self.end_time = timezone.now()
                self.calculate_score()
                self.save()
                return True
            else:
                # Mark as expired if not started
                self.status = 'expired'
                self.save()
                return True
        
        # Check if individual assessment duration has expired (for in_progress only)
        if self.status == 'in_progress' and self.start_time:
            duration_minutes = self.assessment.duration
            expected_end_time = self.start_time + timedelta(minutes=duration_minutes)
            
            if timezone.now() > expected_end_time:
                # Auto-submit the assessment
                self.status = 'completed'
                self.end_time = timezone.now()
                self.calculate_score()
                self.save()
                return True
        
        return False
    
class Response(TenantModel):
    candidate = models.ForeignKey(User, on_delete=models.CASCADE)
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.CASCADE)
    answer = models.TextField(blank=True)
    code_language = models.CharField(max_length=50, blank=True)  # For coding questions
    is_correct = models.BooleanField(null=True)  # Null means not evaluated yet
    marks_obtained = models.FloatField(default=0)
    feedback = models.TextField(blank=True)  # Examiner feedback
    responded_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('candidate', 'assessment', 'question')
    
    def evaluate_mcq(self):
        if self.question.question_type not in ['mcq_single', 'mcq_multiple', 'coding' ,'true_false', 'fill_blank']:
            return False

        # Import here to avoid circular import at module load time
        from .utils import evaluate_answer

        print(f"DEBUG evaluate_mcq: Q{self.question.id} Type={self.question.question_type}")
        print(f"  User Answer: '{self.answer}'")
        print(f"  Correct Answer: '{self.question.correct_answer}'")
        
        self.is_correct = evaluate_answer(self.question, self.answer)
        self.marks_obtained = self.question.marks if self.is_correct else 0
        
        print(f"  Is Correct: {self.is_correct}, Marks: {self.marks_obtained}/{self.question.marks}")
        
        self.save()
        return self.is_correct

class ProctoringIncident(TenantModel):
    candidate = models.ForeignKey(User, on_delete=models.CASCADE)
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE)
    incident_type = models.CharField(max_length=50, choices=(
        ('tab_switch', 'Tab Switch'),
        ('fullscreen_exit', 'Fullscreen Exit'),
        ('copy_paste', 'Copy Paste Attempt'),
        ('multiple_faces', 'Multiple Faces Detected'),
        ('no_face', 'No Face Detected'),
        ('phone_detected', 'Phone Detected'),
        ('suspicious_eye_movement', 'Suspicious Eye Movement'),
        ('looking_away', 'Looking Away from Screen'),
    ))
    timestamp = models.DateTimeField(auto_now_add=True)
    details = models.TextField(blank=True)
    screenshot_s3_url = models.URLField(max_length=500, blank=True, null=True, help_text="S3 URL for proctoring screenshot")
    severity = models.CharField(max_length=20, choices=(
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ), default='medium')
    email_sent = models.BooleanField(default=False)
    
    class Meta:
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.candidate.username} - {self.get_incident_type_display()} at {self.timestamp}"

class Feedback(TenantModel):
    candidate = models.ForeignKey(User, on_delete=models.CASCADE)
    assessment = models.ForeignKey(Assessment, on_delete=models.CASCADE)
    rating = models.PositiveIntegerField(choices=((1, '1'), (2, '2'), (3, '3'), (4, '4'), (5, '5')))
    comments = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('candidate', 'assessment')

class InstructionTemplate(TenantModel):
    """Reusable instruction templates for assessments"""
    name = models.CharField(max_length=200, help_text="Template name (e.g., 'Standard MCQ Instructions')")
    description = models.TextField(blank=True, help_text="Brief description of this template")
    content = models.TextField(help_text="The instruction text content")
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_default = models.BooleanField(default=False, help_text="Set as default template")
    
    class Meta:
        ordering = ['-is_default', '-created_at']
    
    def __str__(self):
        return self.name
    

class UserActivityLog(TenantModel):
    """Track all user activities for audit and analytics"""
    
    ACTION_TYPES = (
        ('login', 'Login'),
        ('logout', 'Logout'),
        ('view', 'View Page'),
        ('create', 'Create'),
        ('update', 'Update'),
        ('delete', 'Delete'),
        ('submit', 'Submit'),
        ('download', 'Download'),
        ('upload', 'Upload'),
        ('assessment_start', 'Assessment Started'),
        ('assessment_submit', 'Assessment Submitted'),
        ('answer_save', 'Answer Saved'),
        ('code_run', 'Code Executed'),
        ('proctoring_incident', 'Proctoring Incident'),
        ('api_call', 'API Call'),
        ('error', 'Error Occurred'  ),
        ('other', 'Other'),
    )
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True, related_name='activity_logs')
    action_type = models.CharField(max_length=50, choices=ACTION_TYPES, db_index=True)
    action_description = models.CharField(max_length=500, blank=True)
    
    # Request details
    url = models.CharField(max_length=500, blank=True)
    method = models.CharField(max_length=10, blank=True)  # GET, POST, PUT, DELETE, etc.
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    # Additional context
    object_type = models.CharField(max_length=100, blank=True, help_text="Model name (e.g., Assessment, Question)")
    object_id = models.PositiveIntegerField(null=True, blank=True, help_text="ID of the object being acted upon")
    extra_data = models.JSONField(null=True, blank=True, help_text="Additional context data")
    
    # Status
    status_code = models.PositiveIntegerField(null=True, blank=True)
    is_success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)
    
    # Timing
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True, help_text="Request duration in milliseconds")
    
    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['-timestamp', 'user']),
            models.Index(fields=['action_type', '-timestamp']),
            models.Index(fields=['user', 'action_type', '-timestamp']),
        ]
        verbose_name = "User Activity Log"
        verbose_name_plural = "User Activity Logs"
    
    def __str__(self):
        user_str = self.user.username if self.user else "Anonymous"
        return f"{user_str} - {self.get_action_type_display()} at {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}"
    
    @classmethod
    def log_activity(cls, user, action_type, action_description='', **kwargs):
        """
        Convenience method to create activity log
        
        Usage:
            UserActivityLog.log_activity(
                user=request.user,
                action_type='assessment_start',
                action_description='Started Python Assessment',
                object_type='Assessment',
                object_id=assessment.id,
                extra_data={'assessment_title': assessment.title}
            )
        """
        return cls.objects.create(
            user=user,
            action_type=action_type,
            action_description=action_description,
            **kwargs
        )
# --- SQL Dataset + Question + TestCase ---

class SQLDataset(TenantModel):
    """
    Stores a dataset (schema + seed) and engine information.
    Admin must provide engine-compatible DDL / seed SQL.
    """
    ENGINE_CHOICES = (
        ('sqlite', 'SQLite'),
        ('mysql', 'MySQL'),
        ('postgres', 'PostgreSQL'),
    )

    name = models.CharField(max_length=120, unique=True)
    engine = models.CharField(
        max_length=20,
        choices=ENGINE_CHOICES,
        default='sqlite'
    )
    schema_ddl = models.TextField(help_text="CREATE TABLE ...; multiple statements allowed (engine-specific).")
    seed_sql = models.TextField(blank=True, help_text="INSERT ...; multiple statements allowed (engine-specific).")
    created_at = models.DateTimeField(auto_now_add=True)
    is_global = models.BooleanField(default=False)
    visible_to_organizations = models.ManyToManyField(
        Organization,
        blank=True,
        related_name="shared_sql_datasets",
    )

    def __str__(self):
        return f"{self.name} ({self.engine})"


class SQLQuestion(TenantModel):
    """
    SQL-specific metadata for a Question (one-to-one).
    Reference_solution should be a SELECT statement.
    """
    question = models.OneToOneField('core.Question', on_delete=models.CASCADE, related_name='sqlmeta')
    dataset = models.ForeignKey(SQLDataset, on_delete=models.PROTECT)
    reference_solution = models.TextField(help_text="Reference SELECT statement (used for grading).")
    strict_column_order = models.BooleanField(default=False)
    float_tolerance = models.FloatField(default=0.0)
    max_rows = models.PositiveIntegerField(default=5000)

    def __str__(self):
        return f"SQLMeta for Q{self.question.id}"


class SQLTestCase(TenantModel):
    """
    Per-testcase optional setup SQL, points and hidden flag.
    setup_sql runs after dataset seed.
    """
    question = models.ForeignKey('core.Question', on_delete=models.CASCADE, related_name='sql_testcases')
    setup_sql = models.TextField(blank=True, help_text="Setup SQL that runs after dataset seed (optional).")
    points = models.FloatField(default=1.0)
    is_hidden = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"SQL TC for Q{self.question.id} (points={self.points})"


class OTPVerification(models.Model):
    """
    OTP verification model for candidate registration and password reset
    """
    OTP_TYPES = (
        ('registration', 'Registration'),
        ('password_reset', 'Password Reset'),
    )
    
    phone = models.CharField(max_length=15)
    email = models.EmailField(blank=True, null=True)
    otp_code = models.CharField(max_length=6)
    otp_type = models.CharField(max_length=20, choices=OTP_TYPES)
    is_verified = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    
    # Store registration data temporarily
    temp_data = models.JSONField(blank=True, null=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"OTP {self.otp_code} for {self.phone} ({self.otp_type})"
    
    def time_left(self):
        """Return remaining time in seconds before OTP expiry"""
        remaining = self.expires_at - timezone.now()
        return remaining.total_seconds()


    def is_expired(self):
        return timezone.now() > self.expires_at
    
    @classmethod
    def generate_otp(cls):
        import random
        return str(random.randint(100000, 999999))


class SubscriptionPlan(TenantModel):
    PLAN_TYPES = (
        ('free', 'Free'),
        ('monthly', 'Monthly Paid'),
        ('yearly', 'Yearly Paid'),
    )
    
    name = models.CharField(max_length=100)
    plan_type = models.CharField(max_length=20, choices=PLAN_TYPES, default='free')
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    duration_months = models.PositiveIntegerField(default=0, help_text="0 for free, 1 for monthly, 12 for yearly")
    
    # Limits
    assessments_per_month = models.PositiveIntegerField(default=4, help_text="Total assessments allowed per month")
    ai_interviews_per_month = models.PositiveIntegerField(default=2, help_text="Total AI interviews allowed per month")
    
    # Free tier specific (weekly)
    free_assessments_per_week = models.PositiveIntegerField(default=1)
    free_ai_assessments_per_week = models.PositiveIntegerField(default=1)
    
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.get_plan_type_display()})"


class UserSubscription(TenantModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='subscriptions')
    plan = models.ForeignKey(SubscriptionPlan, on_delete=models.PROTECT)
    start_date = models.DateTimeField(auto_now_add=True)
    end_date = models.DateTimeField(null=True, blank=True, help_text="Null for lifetime free tier")
    is_active = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.user.email} - {self.plan.name}"
    
    def is_valid(self):
        if not self.is_active:
            return False
        if self.end_date and timezone.now() > self.end_date:
            return False
        return True


class SubscriptionUsage(TenantModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='usage_records')
    subscription = models.ForeignKey(UserSubscription, on_delete=models.CASCADE)
    month = models.PositiveIntegerField()
    year = models.PositiveIntegerField()
    
    assessments_used = models.PositiveIntegerField(default=0)
    ai_interviews_used = models.PositiveIntegerField(default=0)
    
    class Meta:
        unique_together = ('user', 'month', 'year')

    def __str__(self):
        return f"Usage for {self.user.email} - {self.month}/{self.year}"