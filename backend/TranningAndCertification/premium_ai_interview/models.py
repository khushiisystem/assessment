import uuid
import time
from django.db import models


def current_timestamp():
    return int(time.time())


class AIInterviewSession(models.Model):
    DIFFICULTY_CHOICES = [
        ('easy', 'Easy'),
        ('medium', 'Medium'),
        ('hard', 'Hard'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('completed', 'Completed'),
    ]

    session_id = models.UUIDField(default=uuid.uuid4, unique=True, db_index=True)
    candidate_name = models.CharField(max_length=255)
    candidate_email = models.EmailField(blank=True, default='')
    role = models.CharField(max_length=100, blank=True, default='')
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default='medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    interview_mode = models.CharField(max_length=20, default='role')  # role | resume | hybrid
    resume_data = models.JSONField(null=True, blank=True)
    conversation = models.JSONField(default=list)
    scores = models.JSONField(default=list)
    question_number = models.IntegerField(default=0)
    max_questions = models.IntegerField(default=5)
    overall_score = models.FloatField(null=True, blank=True)
    final_report = models.JSONField(null=True, blank=True)
    audio_recordings = models.JSONField(default=list, blank=True)
    interview_video_url = models.URLField(blank=True, default='')
    interview_video_key = models.CharField(max_length=1024, blank=True, default='')
    created_at = models.BigIntegerField(default=current_timestamp)
    updated_at = models.BigIntegerField(default=current_timestamp)

    class Meta:
        db_table = 'ai_interview_session'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.candidate_name} - {self.role} ({self.status})"

    def save(self, *args, **kwargs):
        self.updated_at = int(time.time())
        super().save(*args, **kwargs)
