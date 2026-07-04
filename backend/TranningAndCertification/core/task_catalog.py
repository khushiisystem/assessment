"""
Whitelisted background task catalog.

The rest of the application should refer to these short activity keys instead
of hardcoding Celery task names throughout views.  Each entry maps a business
activity to the actual Celery task discovered by the worker.
"""
from __future__ import annotations

from typing import Any, Dict


BACKGROUND_TASK_CATALOG: Dict[str, Dict[str, Any]] = {
    "test_dynamic_task": {
        "label": "Test Dynamic Task",
        "description": "Small smoke-test task used to verify dynamic Celery routing.",
        "task_name": "core.test_dynamic_task",
        "queue": "celery",
        "required_fields": ["name"],
        "allowed_roles": ["super_admin", "org_admin", "manager"],
    },
    "process_intro_video": {
        "label": "Process Introduction Video",
        "description": "Persist and process a candidate introduction video in the background.",
        "task_name": "AI_assessment.tasks.process_intro_video_upload",
        "queue": "video_processing",
        "required_fields": ["assignment_id", "video_data"],
        "allowed_roles": ["candidate"],
    },
    "process_answer_recording": {
        "label": "Process Answer Recording",
        "description": "Store and transcribe a candidate answer recording.",
        "task_name": "AI_assessment.tasks.process_answer_recording",
        "queue": "audio_processing",
        "required_fields": ["assignment_id", "question_number", "audio_data"],
        "optional_fields": ["question_text", "question_type"],
        "allowed_roles": ["candidate"],
    },
    "process_answer_transcription": {
        "label": "Process Answer Transcription",
        "description": "Transcribe an already stored answer recording.",
        "task_name": "AI_assessment.tasks.process_answer_transcription",
        "queue": "audio_processing",
        "required_fields": ["assignment_id", "question_number"],
        "allowed_roles": ["super_admin", "org_admin", "manager"],
    },
    "process_video_upload": {
        "label": "Process Interview Video",
        "description": "Persist and process a final interview video in the background.",
        "task_name": "AI_assessment.tasks.process_video_upload",
        "queue": "video_processing",
        "required_fields": ["assignment_id"],
        "optional_fields": ["s3_url", "video_data"],
        "allowed_roles": ["candidate"],
    },
    "generate_ai_report": {
        "label": "Generate AI Assessment Report",
        "description": "Generate the assessment report for a completed AI interview.",
        "task_name": "AI_assessment.tasks.generate_assessment_report",
        "queue": "report_generation",
        "required_fields": ["assignment_id"],
        "allowed_roles": ["super_admin", "org_admin", "manager"],
    },
    "orchestrate_ai_completion": {
        "label": "Complete AI Assessment",
        "description": "Run completion orchestration, including transcription and report generation.",
        "task_name": "AI_assessment.tasks.orchestrate_assessment_completion",
        "queue": "assessment",
        "required_fields": ["assignment_id"],
        "allowed_roles": ["candidate"],
    },
    "process_ai_assessment_s3_handoff": {
        "label": "Process AI Assessment S3 Handoff",
        "description": "Send an S3 input manifest to the standalone worker; Django remains the only DB writer.",
        "task_name": "background_tasks.execute_task",
        "queue": "assessment",
        "required_fields": ["task_name", "payload"],
        "allowed_roles": ["candidate", "super_admin", "org_admin", "manager"],
    },
}
