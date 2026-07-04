from django.conf import settings
from django.db import models
from django.utils import timezone
import time
from organization.models import TenantModel


def current_timestamp():
    return int(time.time())

class Difficulty(models.TextChoices):
    EASY = 'easy', 'Easy'
    MEDIUM = 'medium', 'Medium'
    HARD = 'hard', 'Hard'


class Question(TenantModel):
    text = models.TextField()
    ideal_answer = models.TextField()
    stack = models.CharField(max_length=100)
    difficulty = models.CharField(max_length=20, choices=Difficulty.choices, default=Difficulty.MEDIUM)
    created_at = models.BigIntegerField(default=current_timestamp)
    updated_at = models.BigIntegerField(default=current_timestamp)


    class Meta:
        db_table = 'mock_interview_question'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.stack} - {self.text[:50]}"

    def save(self, *args, **kwargs):
        if self.stack:
            self.stack = self.stack.strip()
        self.updated_at = int(time.time())
        if not self.created_at:
            self.created_at = int(time.time())
        super().save(*args, **kwargs)


class InterviewTemplate(TenantModel):
    name = models.CharField(max_length=255)
    questions = models.JSONField(default=list)  # List of question IDs
    created_at = models.BigIntegerField(default=current_timestamp)
    updated_at = models.BigIntegerField(default=current_timestamp)

    class Meta:
        db_table = 'mock_interview_template'
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.updated_at = int(time.time())
        if not self.created_at:
            self.created_at = int(time.time())
        super().save(*args, **kwargs)


class CandidateInterviewer(TenantModel):
    name = models.CharField(max_length=255)
    email = models.EmailField()
    created_at = models.BigIntegerField(default=current_timestamp)
    updated_at = models.BigIntegerField(default=current_timestamp)


    class Meta:
        db_table = 'mock_interview_candidate_interviewer'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.email})"

    def save(self, *args, **kwargs):
        self.updated_at = int(time.time())
        if not self.created_at:
            self.created_at = int(time.time())
        super().save(*args, **kwargs)


class Candidate(TenantModel):
    name = models.CharField(max_length=255)
    email = models.EmailField()
    created_at = models.BigIntegerField(default=current_timestamp)
    updated_at = models.BigIntegerField(default=current_timestamp)


    class Meta:
        db_table = 'mock_interview_candidate'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.email})"

    def save(self, *args, **kwargs):
        self.updated_at = int(time.time())
        if not self.created_at:
            self.created_at = int(time.time())
        super().save(*args, **kwargs)


class MockSession(TenantModel):
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
    ]

    candidate_name = models.CharField(max_length=255)
    candidate_email = models.EmailField(blank=True, null=True)
    candidate = models.ForeignKey(
        Candidate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sessions'
    )
    candidate_interviewer_name = models.CharField(max_length=255, blank=True, null=True)
    candidate_interviewer_email = models.EmailField(blank=True, null=True)
    candidate_interviewer = models.ForeignKey(
        CandidateInterviewer,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sessions'
    )
    registered_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='mock_sessions'
    )
    stack = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    version_label = models.CharField(max_length=100)
    questions = models.JSONField(default=list)  # List of question IDs
    responses = models.JSONField(default=dict)  # Dict mapping question_id to response
    overall_feedback = models.TextField(blank=True, null=True)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.BigIntegerField(default=current_timestamp)
    updated_at = models.BigIntegerField(default=current_timestamp)


    class Meta:
        db_table = 'mock_interview_session'
        ordering = ['-created_at']
        verbose_name = 'Mock Session'
        verbose_name_plural = 'Mock Sessions'

    def __str__(self):
        return f"{self.candidate_name} - {self.stack} ({self.status})"

    def save(self, *args, **kwargs):
        self.updated_at = int(time.time())
        if not self.created_at:
            self.created_at = int(time.time())
        super().save(*args, **kwargs)
