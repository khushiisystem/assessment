from django.contrib import admin
from .models import (
    Technology,
    Question,
    Assignment,
    Completion,
)


# Technology Admin
@admin.register(Technology)
class TechnologyAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at")
    search_fields = ("name",)
    ordering = ("-created_at",)


# Question Admin
@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = (
        "question",
        "technology",
        "difficulty",
        "module_level",
        "is_active",
    )
    list_filter = ("technology", "difficulty", "module_level", "is_active")
    search_fields = ("question", "answer")
    ordering = ("technology", "difficulty")
    list_select_related = ("technology",)


# Assignment Admin
@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "technology",
        "assigned_by",
        "assigned_at",
        "due_at",
    )
    list_filter = ("technology", "assigned_at", "due_at")
    search_fields = ("user__email", "technology__name")
    ordering = ("-assigned_at",)
    list_select_related = ("user", "technology", "assigned_by")


# Completion Admin
@admin.register(Completion)
class CompletionAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "question",
        "completed_at",
    )
    list_filter = ("question__technology", "completed_at")
    search_fields = ("user__email", "question__question")
    ordering = ("-completed_at",)
    list_select_related = ("user", "question")
