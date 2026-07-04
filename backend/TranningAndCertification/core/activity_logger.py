"""
Utility helpers for structured activity logging in the DRF-based new_core app.

These helpers wrap the ``UserActivityLog.log_activity`` classmethod and should
be used from API views whenever you need to capture domain-specific events
such as assessment lifecycle actions, code execution, or administrative tasks.
NOTE: This module has been disabled to reduce database load
"""

'''
from .models import UserActivityLog


def log_login(user, request, success=True):
    """Log user login attempt (success or failure)."""
    return UserActivityLog.log_activity(
        user=user if success else None,
        action_type='login',
        action_description=f"User {'logged in' if success else 'login failed'}",
        url=request.path,
        method=request.method,
        ip_address=get_client_ip(request),
        user_agent=_get_user_agent(request),
        is_success=success,
    )


def log_logout(user, request):
    """Log user logout."""
    return UserActivityLog.log_activity(
        user=user,
        action_type='logout',
        action_description="User logged out",
        url=request.path,
        method=request.method,
        ip_address=get_client_ip(request),
        user_agent=_get_user_agent(request),
    )


def log_assessment_start(user, assessment, request):
    """Log when a user starts an assessment."""
    return UserActivityLog.log_activity(
        user=user,
        action_type='assessment_start',
        action_description=f"Started assessment: {assessment.title}",
        url=request.path,
        method=request.method,
        ip_address=get_client_ip(request),
        object_type='Assessment',
        object_id=assessment.id,
        extra_data={
            'assessment_title': assessment.title,
            'assessment_duration': assessment.duration,
        },
    )


def log_assessment_submit(user, assessment, candidate_assessment, request):
    """Log when a user submits an assessment."""
    return UserActivityLog.log_activity(
        user=user,
        action_type='assessment_submit',
        action_description=f"Submitted assessment: {assessment.title}",
        url=request.path,
        method=request.method,
        ip_address=get_client_ip(request),
        object_type='CandidateAssessment',
        object_id=candidate_assessment.id,
        extra_data={
            'assessment_title': assessment.title,
            'score': candidate_assessment.score,
            'percentage': candidate_assessment.percentage,
            'total_marks': candidate_assessment.total_marks,
        },
    )


def log_answer_save(user, question, assessment, answer, request):
    """Log when a user saves an answer."""
    return UserActivityLog.log_activity(
        user=user,
        action_type='answer_save',
        action_description=f"Saved answer for question: {question.title[:100]}",
        url=request.path,
        method=request.method,
        ip_address=get_client_ip(request),
        object_type='Question',
        object_id=question.id,
        extra_data={
            'question_id': question.id,
            'assessment_id': assessment.id,
            'question_type': question.question_type,
            'answer_length': len(str(answer)),
        },
    )


def log_code_execution(user, question, language, request, success=True, error=None):
    """Log when a user runs code for a question."""
    return UserActivityLog.log_activity(
        user=user,
        action_type='code_run',
        action_description=f"Executed {language} code for question: {question.title[:100]}",
        url=request.path,
        method=request.method,
        ip_address=get_client_ip(request),
        object_type='Question',
        object_id=question.id,
        is_success=success,
        error_message=str(error) if error else '',
        extra_data={
            'language': language,
            'question_id': question.id,
        },
    )


def log_proctoring_incident(user, assessment, incident_type, details, request):
    """Log proctoring incidents."""
    return UserActivityLog.log_activity(
        user=user,
        action_type='proctoring_incident',
        action_description=f"Proctoring incident: {incident_type}",
        url=request.path,
        method=request.method,
        ip_address=get_client_ip(request),
        object_type='Assessment',
        object_id=assessment.id,
        extra_data={
            'incident_type': incident_type,
            'details': details,
            'assessment_id': assessment.id,
        },
    )


def log_candidate_create(admin_user, candidate, request):
    """Log when admin creates a new candidate."""
    return UserActivityLog.log_activity(
        user=admin_user,
        action_type='create',
        action_description=f"Created candidate: {candidate.username}",
        url=request.path,
        method=request.method,
        ip_address=get_client_ip(request),
        object_type='User',
        object_id=candidate.id,
        extra_data={
            'candidate_username': candidate.username,
            'candidate_email': candidate.email,
        },
    )


def log_candidate_delete(admin_user, candidate_username, candidate_id, request):
    """Log when admin deletes a candidate."""
    return UserActivityLog.log_activity(
        user=admin_user,
        action_type='delete',
        action_description=f"Deleted candidate: {candidate_username}",
        url=request.path,
        method=request.method,
        ip_address=get_client_ip(request),
        object_type='User',
        object_id=candidate_id,
        extra_data={
            'candidate_username': candidate_username,
        },
    )


def log_assessment_create(admin_user, assessment, request):
    """Log when admin creates an assessment."""
    return UserActivityLog.log_activity(
        user=admin_user,
        action_type='create',
        action_description=f"Created assessment: {assessment.title}",
        url=request.path,
        method=request.method,
        ip_address=get_client_ip(request),
        object_type='Assessment',
        object_id=assessment.id,
        extra_data={
            'assessment_title': assessment.title,
            'duration': assessment.duration,
            'total_questions': assessment.questions.count(),
        },
    )


def log_assessment_assign(admin_user, assessment, candidates_count, request):
    """Log when admin assigns assessment to candidates."""
    return UserActivityLog.log_activity(
        user=admin_user,
        action_type='create',
        action_description=f"Assigned assessment '{assessment.title}' to {candidates_count} candidate(s)",
        url=request.path,
        method=request.method,
        ip_address=get_client_ip(request),
        object_type='Assessment',
        object_id=assessment.id,
        extra_data={
            'assessment_title': assessment.title,
            'candidates_count': candidates_count,
        },
    )


def log_question_create(admin_user, question, request):
    """Log when admin creates a question."""
    return UserActivityLog.log_activity(
        user=admin_user,
        action_type='create',
        action_description=f"Created question: {question.title}",
        url=request.path,
        method=request.method,
        ip_address=get_client_ip(request),
        object_type='Question',
        object_id=question.id,
        extra_data={
            'question_type': question.question_type,
            'difficulty': question.difficulty,
            'marks': question.marks,
        },
    )


def log_bulk_import(admin_user, object_type, count, request, success=True, errors=None):
    """Log bulk import operations."""
    return UserActivityLog.log_activity(
        user=admin_user,
        action_type='upload',
        action_description=f"Bulk imported {count} {object_type}(s)",
        url=request.path,
        method=request.method,
        ip_address=get_client_ip(request),
        is_success=success,
        error_message=str(errors) if errors else '',
        extra_data={
            'object_type': object_type,
            'count': count,
            'errors': errors if errors else None,
        },
    )


def log_export(admin_user, object_type, format_type, request):
    """Log export operations."""
    return UserActivityLog.log_activity(
        user=admin_user,
        action_type='download',
        action_description=f"Exported {object_type} as {format_type}",
        url=request.path,
        method=request.method,
        ip_address=get_client_ip(request),
        extra_data={
            'object_type': object_type,
            'format': format_type,
        },
    )


def log_api_call(user, endpoint, method, request, success=True, error=None):
    """Log API calls with outcome information."""
    return UserActivityLog.log_activity(
        user=user if user and user.is_authenticated else None,
        action_type='api_call',
        action_description=f"API call: {method} {endpoint}",
        url=request.path,
        method=method,
        ip_address=get_client_ip(request),
        is_success=success,
        error_message=str(error) if error else '',
        extra_data={'endpoint': endpoint},
    )


def get_client_ip(request):
    """Extract client IP address from request."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def _get_user_agent(request):
    """Safely extract a trimmed user-agent string."""
    return request.META.get('HTTP_USER_AGENT', '')[:500]
'''

