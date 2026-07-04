from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    User, Category, Question, TestCase, Assessment, AssessmentQuestion,
    CandidateAssessment, Response, ProctoringIncident, Feedback, UserActivityLog,
    SQLDataset, SQLQuestion, SQLTestCase, OTPVerification,
    SubscriptionPlan, UserSubscription, SubscriptionUsage,
)


# ==========================
# User Model (Custom Admin)
# ==========================

class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'role', 'organization', 'profile', 'resume_s3_url', 'is_active', 'is_staff', 'date_joined')
    list_filter = ('role', 'is_active', 'is_staff', 'is_superuser')
    search_fields = ('username', 'email', 'first_name', 'last_name', 'phone')
    ordering = ('-date_joined',)

    fieldsets = UserAdmin.fieldsets + (
        ('Additional Info', {'fields': ('role', 'organization', 'phone', 'resume_s3_url', 'profile' )}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('Additional Info', {'fields': ('email', 'first_name', 'last_name', 'role', 'organization', 'phone', 'resume_s3_url', 'profile' )}),
    )

admin.site.register(User, CustomUserAdmin)


# ==========================
# Category
# ==========================

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name',)
    search_fields = ('name',)


# ==========================
# TestCase Inline for Questions
# ==========================

class TestCaseInline(admin.TabularInline):
    model = TestCase
    extra = 0
    fields = ('input_data', 'expected_output', 'points', 'is_hidden', 'dummy')
    readonly_fields = ('created_at',)


# ==========================
# Question
# ==========================

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    inlines = [TestCaseInline]
    list_display = ('title', 'question_type', 'category', 'difficulty', 'marks', 'created_by')
    list_filter = ('question_type', 'category', 'difficulty', 'created_at')
    search_fields = ('title', 'description', 'tags')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)


# ==========================
# Assessment
# ==========================

@admin.register(Assessment)
class AssessmentAdmin(admin.ModelAdmin):
    list_display = ('title', 'created_by', 'start_date', 'end_date', 'is_active')
    list_filter = ('is_active', 'start_date', 'end_date')
    search_fields = ('title', 'description')
    filter_horizontal = ('categories',)
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-start_date',)


# ==========================
# AssessmentQuestion
# ==========================

@admin.register(AssessmentQuestion)
class AssessmentQuestionAdmin(admin.ModelAdmin):
    list_display = ('assessment', 'question', 'section', 'section_time', 'order')
    list_filter = ('section',)
    search_fields = ('assessment__title', 'question__title')


# ==========================
# CandidateAssessment
# ==========================

@admin.register(CandidateAssessment)
class CandidateAssessmentAdmin(admin.ModelAdmin):
    list_display = ('candidate', 'assessment', 'status', 'start_time', 'end_time', 'score', 'percentage')
    list_filter = ('status', 'assessment__title', 'assigned_date')
    search_fields = ('candidate__username', 'assessment__title')
    date_hierarchy = 'assigned_date'
    readonly_fields = ('assigned_date', 'score', 'percentage', 'total_marks')


# ==========================
# Response
# ==========================

@admin.register(Response)
class ResponseAdmin(admin.ModelAdmin):
    list_display = ('candidate', 'assessment', 'question', 'is_correct', 'marks_obtained', 'responded_at')
    list_filter = ('is_correct', 'responded_at', 'assessment')
    search_fields = ('candidate__username', 'question__title')
    readonly_fields = ('responded_at',)


# ==========================
# ProctoringIncident
# ==========================

@admin.register(ProctoringIncident)
class ProctoringIncidentAdmin(admin.ModelAdmin):
    list_display = ('candidate', 'assessment', 'incident_type', 'timestamp', 'severity', 'email_sent')
    list_filter = ('incident_type', 'severity', 'timestamp', 'email_sent')
    search_fields = ('candidate__username', 'details')
    readonly_fields = ('timestamp',)


# ==========================
# Feedback
# ==========================

@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ('candidate', 'assessment', 'rating', 'submitted_at')
    list_filter = ('rating', 'submitted_at')
    search_fields = ('candidate__username', 'comments')
    readonly_fields = ('submitted_at',)


# ==========================
# UserActivityLog
# ==========================

@admin.register(UserActivityLog)
class UserActivityLogAdmin(admin.ModelAdmin):
    list_display = ('user', 'action_type', 'action_description', 'url', 'method', 'ip_address', 'is_success', 'timestamp', 'duration_ms')
    list_filter = ('action_type', 'is_success', 'method', 'timestamp', 'user__role')
    search_fields = ('user__username', 'action_description', 'url', 'ip_address', 'error_message')
    readonly_fields = ('user', 'action_type', 'action_description', 'url', 'method', 'ip_address', 
                      'user_agent', 'object_type', 'object_id', 'extra_data', 'status_code', 
                      'is_success', 'error_message', 'timestamp', 'duration_ms')
    date_hierarchy = 'timestamp'
    ordering = ('-timestamp',)
    
    # Make it read-only (logs should not be edited)
    def has_add_permission(self, request):
        return False
    
    def has_change_permission(self, request, obj=None):
        return False
    
    def has_delete_permission(self, request, obj=None):
        # Only superusers can delete logs
        return request.user.is_superuser
    
    # Custom display methods
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        # Optimize query with select_related
        return qs.select_related('user')
    
    # Add custom actions
    actions = ['export_as_csv']
    
    def export_as_csv(self, request, queryset):
        """Export selected logs as CSV"""
        import csv
        from django.http import HttpResponse
        from django.utils import timezone
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="activity_logs_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv"'
        
        writer = csv.writer(response)
        writer.writerow(['Timestamp', 'User', 'Action Type', 'Description', 'URL', 'Method', 'IP Address', 'Success', 'Duration (ms)'])
        
        for log in queryset:
            writer.writerow([
                log.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                log.user.username if log.user else 'Anonymous',
                log.get_action_type_display(),
                log.action_description,
                log.url,
                log.method,
                log.ip_address,
                'Yes' if log.is_success else 'No',
                log.duration_ms or '',
            ])
        
        return response
    
    export_as_csv.short_description = "Export selected logs as CSV"


@admin.register(SQLDataset)
class SQLDatasetAdmin(admin.ModelAdmin):
    list_display = ("name", "engine", "created_at")
    search_fields = ("name", "engine")
    list_filter = ("engine", "created_at")


@admin.register(SQLQuestion)
class SQLQuestionAdmin(admin.ModelAdmin):
    list_display = ("question", "dataset", "strict_column_order", "float_tolerance", "max_rows")
    search_fields = ("question__title", "dataset__name")
    list_filter = ("dataset__engine",)


@admin.register(SQLTestCase)
class SQLTestCaseAdmin(admin.ModelAdmin):
    list_display = ("question", "points", "is_hidden", "created_at")
    list_filter = ("is_hidden", "created_at")
    search_fields = ("question__title",)


@admin.register(OTPVerification)
class OTPVerificationAdmin(admin.ModelAdmin):
    list_display = ("phone", "email", "otp_code", "otp_type", "is_verified", "created_at", "expires_at")
    list_filter = ("otp_type", "is_verified", "created_at")
    search_fields = ("phone", "email", "otp_code")


# ==========================
# Subscription Admin
# ==========================

@admin.register(SubscriptionPlan)
class SubscriptionPlanAdmin(admin.ModelAdmin):
    list_display = ("name", "plan_type", "price", "duration_months", "assessments_per_month", "ai_interviews_per_month", "is_active")
    list_filter = ("plan_type", "is_active")
    search_fields = ("name",)
    list_editable = ("is_active",)
    ordering = ("price",)


@admin.register(UserSubscription)
class UserSubscriptionAdmin(admin.ModelAdmin):
    list_display = ("user", "plan", "is_active", "start_date", "end_date")
    list_filter = ("is_active", "plan")
    search_fields = ("user__email", "user__username")
    ordering = ("-start_date",)
    raw_id_fields = ("user",)


@admin.register(SubscriptionUsage)
class SubscriptionUsageAdmin(admin.ModelAdmin):
    list_display = ("user", "month", "year", "assessments_used", "ai_interviews_used")
    list_filter = ("year", "month")
    search_fields = ("user__email",)
    ordering = ("-year", "-month")
