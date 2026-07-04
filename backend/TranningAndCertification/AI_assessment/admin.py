from django.contrib import admin
from .models import (
    AIAssessment,
    # AIVoiceAnalysis,
    CandidateAIAssessment,
    AIInterviewResponse,
    Question,
    Profile,
    QuestionProfile
)


# ============================
# Inline for AI Interview Responses
# ============================

class AIInterviewResponseInline(admin.TabularInline):
    model = AIInterviewResponse
    extra = 0
    readonly_fields = ('question_number', 'question_text', 'answer_text', 'response_time', 'responded_at')
    can_delete = False


# ============================
# Admin for AIAssessment
# ============================

@admin.register(AIAssessment)
class AIAssessmentAdmin(admin.ModelAdmin):
    list_display = ('title', 'role_type', 'experience_level', 'start_date', 'end_date', 'is_active')
    list_filter = ('role_type', 'experience_level', 'is_active', 'start_date', 'end_date')
    search_fields = ('title', 'description')
    date_hierarchy = 'start_date'
    ordering = ('-start_date',)
    readonly_fields = ('created_at', 'updated_at')


# ============================
# Admin for CandidateAIAssessment
# ============================

@admin.register(CandidateAIAssessment)
class CandidateAIAssessmentAdmin(admin.ModelAdmin):
    list_display = (
        'candidate',
        'ai_assessment',
        'status',
        'assigned_date',
        'start_time',
        'end_time',
        'overall_score',
        'multiple_faces_count',
        'gaze_violation_count',
        'total_proctor_warnings',
        # 'voice_flow_risk_level',
        # 'voice_flow_risk_score',
    )

    list_filter = (
        'status',
        'assigned_date',
        'ai_assessment__role_type',
    )

    search_fields = (
        'candidate__username',
        'ai_assessment__title',
        'resume_text',
    )

    date_hierarchy = 'assigned_date'

    inlines = [AIInterviewResponseInline]

    readonly_fields = (
        'assigned_date',
        'technical_score',
        'communication_score',
        'problem_solving_score',
        'overall_score',
        'technical_feedback',
        'problem_solving_feedback',
        'strengths_feedback',
        'improvement_feedback',
        'overall_feedback',
        'gesture_analysis',
        'communication_metrics',
        'cheating_alerts',
        # 'voice_flow_analysis',
        # 'voice_flow_risk_score',
        # 'voice_flow_risk_level',
        'multiple_faces_count',
        'gaze_violation_count',
        'total_proctor_warnings',
    )


# ============================
# Admin for AIInterviewResponse
# ============================

@admin.register(AIInterviewResponse)
class AIInterviewResponseAdmin(admin.ModelAdmin):
    list_display = ('candidate_assessment', 'question_number', 'response_time', 'responded_at')
    list_filter = ('candidate_assessment__ai_assessment__title',)
    search_fields = ('question_text', 'answer_text')
    ordering = ('candidate_assessment', 'question_number')
    readonly_fields = ('responded_at',)


# @admin.register(AIVoiceAnalysis)
# class AIVoiceAnalysisAdmin(admin.ModelAdmin):
#     list_display = (
#         'candidate_assessment',
#         'question_number',
#         'risk_level',
#         'overall_risk_score',
#         'longest_pause_seconds',
#         'speech_rate_wpm',
#         'updated_at',
#     )
#     list_filter = ('risk_level', 'candidate_assessment__ai_assessment__title')
#     search_fields = (
#         'candidate_assessment__candidate__username',
#         'candidate_assessment__ai_assessment__title',
#         'response__question_text',
#     )
#     ordering = ('candidate_assessment', 'question_number')
#     readonly_fields = ('created_at', 'updated_at')


# ============================
# Admin for Profile
# ============================

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('name', 'profile_key', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('name', 'profile_key', 'description')
    ordering = ('name',)
    readonly_fields = ('created_at', 'updated_at')


# ============================
# Inline for QuestionProfile
# ============================

class QuestionProfileInline(admin.TabularInline):
    model = QuestionProfile
    extra = 1
    raw_id_fields = ('profile',)


# ============================
# Admin for Question
# ============================

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('question_short', 'complexity_level', 'is_active', 'created_by', 'created_at')
    list_filter = ('complexity_level', 'is_active', 'created_at')
    search_fields = ('question',)
    ordering = ('-created_at',)
    readonly_fields = ('created_at', 'created_by', 'updated_at', 'updated_by')
    inlines = [QuestionProfileInline]
    
    fieldsets = (
        ('Question Details', {
            'fields': ('question', 'complexity_level', 'is_active')
        }),
        ('Audit Trail', {
            'fields': ('created_by', 'created_at', 'updated_by', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def question_short(self, obj):
        return obj.question[:80] + '...' if len(obj.question) > 80 else obj.question
    question_short.short_description = 'Question'
    
    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


# ============================
# Admin for QuestionProfile
# ============================

@admin.register(QuestionProfile)
class QuestionProfileAdmin(admin.ModelAdmin):
    list_display = ('question_short', 'profile', 'created_at')
    list_filter = ('profile', 'created_at')
    search_fields = ('question__question', 'profile__name')
    ordering = ('-created_at',)
    readonly_fields = ('created_at',)
    
    def question_short(self, obj):
        return obj.question.question[:60] + '...' if len(obj.question.question) > 60 else obj.question.question
    question_short.short_description = 'Question'
