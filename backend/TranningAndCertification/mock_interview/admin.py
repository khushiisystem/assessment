from django.contrib import admin
from .models import Question, InterviewTemplate, Candidate, MockSession, CandidateInterviewer


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['id', 'text_preview', 'stack', 'difficulty', 'created_at']
    list_filter = ['stack', 'difficulty']
    search_fields = ['text', 'ideal_answer', 'stack']
    ordering = ['-created_at']

    def text_preview(self, obj):
        return obj.text[:50] + '...' if len(obj.text) > 50 else obj.text
    text_preview.short_description = 'Question'


@admin.register(InterviewTemplate)
class InterviewTemplateAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'question_count', 'created_at']
    search_fields = ['name']
    ordering = ['-created_at']

    def question_count(self, obj):
        return len(obj.questions) if obj.questions else 0
    question_count.short_description = 'Questions'


@admin.register(Candidate)
class CandidateAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'email', 'session_count', 'created_at']
    search_fields = ['name', 'email']
    ordering = ['-created_at']

    def session_count(self, obj):
        return obj.sessions.count()
    session_count.short_description = 'Sessions'


@admin.register(CandidateInterviewer)
class CandidateInterviewerAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'email', 'session_count', 'created_at']
    search_fields = ['name', 'email']
    ordering = ['-created_at']

    
    def session_count(self, obj):
        return obj.sessions.count()
    session_count.short_description = 'Sessions'

@admin.register(MockSession)
class MockSessionAdmin(admin.ModelAdmin):
    list_display = ['id', 'candidate_name', 'candidate_interviewer_name', 'stack', 'status', 'created_at', 'scheduled_at']
    list_filter = ['status', 'stack']
    search_fields = ['candidate_name', 'stack', 'candidate_interviewer_name']
    ordering = ['-created_at']
    raw_id_fields = ['candidate', 'candidate_interviewer']
