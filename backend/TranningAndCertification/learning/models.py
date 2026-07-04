from django.db import models
from django.conf import settings
import uuid
# from new_core.models import User
from core.models import User
from organization.models import Organization, TenantModel



class Technology(TenantModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    category = models.CharField(blank=True, null=True, max_length=100)
    description = models.TextField(blank=True, null=True)
    icon = models.ImageField(upload_to='technology_icons/', null=True, blank=True)
    icon_key = models.CharField(max_length=200, null=True, blank=True, help_text="Iconify icon ID, e.g. logos:react")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_global = models.BooleanField(default=False)
    visible_to_organizations = models.ManyToManyField(
        Organization,
        blank=True,
        related_name="shared_technologies",
    )

    def __str__(self):
        return self.name




class Question(TenantModel):
    DIFFICULTY_CHOICES = (
        ('Easy', 'Easy'),
        ('Medium', 'Medium'),
        ('Hard', 'Hard'),
    )

    technology = models.ForeignKey(
        Technology,
        on_delete=models.CASCADE,
        related_name='questions',
        null=True,  # ✅ temporarily allow nulls
        blank=True
    )

    MODULE_LEVEL_CHOICES = [
        ("beginner", "Beginner"),
        ("basic", "Basic"),
        ("intermediate", "Intermediate"),
        ("advanced", "Advanced"),
    ]

    module_level = models.CharField(
        max_length=20,
        choices=MODULE_LEVEL_CHOICES,
        default="beginner"
    )


    question = models.TextField(help_text="Enter the question text.")
    answer = models.TextField(help_text="Write the correct answer.")
    difficulty = models.CharField(max_length=10, choices=DIFFICULTY_CHOICES, default='Easy')
    is_active = models.BooleanField(default=True)

    # 🆕 New fields
    reference_link = models.URLField(blank=True, null=True, help_text="Optional link to notes or reference.")
    task_description = models.TextField(blank=True, null=True, help_text="Small task or assignment related to this question.")
    task_file = models.FileField(
        upload_to='question_tasks/',
        blank=True,
        null=True,
        help_text="Upload a ZIP or project folder related to this question."
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Q{self.pk} - {self.technology.name}"


class Assignment(TenantModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assignments')
    technology = models.ForeignKey(Technology, on_delete=models.CASCADE)
    question = models.ForeignKey(Question, on_delete=models.SET_NULL, null=True, blank=True)
    assigned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='assigned_items')
    assigned_at = models.DateTimeField(auto_now_add=True)
    due_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)


class Completion(TenantModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='completions')
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='completions')
    completed_at = models.DateTimeField(auto_now_add=True)
    class Meta:
        unique_together = ('user', 'question')




class UserTechnologyProgress(TenantModel):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='technologies_progress')
    technology = models.ForeignKey(Technology, on_delete=models.CASCADE)
    progress = models.FloatField(default=0)
    completed = models.IntegerField(default=0)
    total = models.IntegerField(default=0)
    user_notes = models.TextField(null=True, blank=True)

    class Meta:
        unique_together = ('user', 'technology')

    def __str__(self):
        return f"{self.user.name} - {self.technology.name}"
