import os
import logging
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings
from django.urls import reverse
from .models import CandidateAIAssessment
logger = logging.getLogger(__name__)

def send_ai_assessment_notification(candidate_ai_assessment):
    """
    Send email notification to candidate about AI assessment assignment
    """
    try:
        logger.info("Preparing to send AI assessment notification email")
        candidate = candidate_ai_assessment.candidate
        ai_assessment = candidate_ai_assessment.ai_assessment
        
        # Prepare email context
        context = {
            'candidate_name': candidate.get_full_name() or candidate.username,
            'assessment_title': ai_assessment.title,
            'role_type': ai_assessment.get_role_type_display(),
            'experience_level': ai_assessment.get_experience_level_display(),
            'num_questions': ai_assessment.num_questions,
            'start_date': ai_assessment.start_date,
            'end_date': ai_assessment.end_date,
            'instructions': ai_assessment.instructions,
            'assessment_url': f"{settings.SITE_URL}/candidate/assessment/{ai_assessment.id}/introduction/" if hasattr(settings, 'SITE_URL') else f"{settings.SITE_URL}/candidate/assessment/{ai_assessment.id}/introduction/",
            'features': {
                'voice_recording': ai_assessment.enable_voice_recording,
                'camera': ai_assessment.enable_camera,
            }
        }
        
        # Render email templates
        subject = f'AI Interview Assignment: {ai_assessment.title}'
        html_message = render_to_string('emails/ai_assessment_notification.html', context)
        plain_message = strip_tags(html_message)
        
        # Send email
        logger.info("Sending AI assessment notification email to: %s", candidate.email)
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[candidate.email],
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f"AI Assessment notification sent to {candidate.email}")
        return True
        
    except Exception as e:
        logger.exception("Error sending AI assessment notification: {e}")
        return False

def send_ai_assessment_reminder(candidate_ai_assessment):
    """
    Send reminder email to candidate about pending AI assessment
    """
    try:
        candidate = candidate_ai_assessment.candidate
        ai_assessment = candidate_ai_assessment.ai_assessment
        
        # Check if assessment is still valid
        if ai_assessment.is_expired():
            logger.info("AI assessment has expired for candidate: %s", candidate.email)
            return False
            
        context = {
            'candidate_name': candidate.get_full_name() or candidate.username,
            'assessment_title': ai_assessment.title,
            'end_date': ai_assessment.end_date,
            'assessment_url': f"{settings.SITE_URL}/candidate/ai-assessment/{ai_assessment.id}/running/" if hasattr(settings, 'SITE_URL') else f"{settings.SITE_URL}/candidate/ai-assessment/{ai_assessment.id}/running/",
        }
        
        subject = f'Reminder: AI Interview - {ai_assessment.title}'
        html_message = render_to_string('emails/ai_assessment_reminder.html', context)
        plain_message = strip_tags(html_message)
        logger.info("Sending AI assessment reminder email to: %s", candidate.email)
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[candidate.email],
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f"AI Assessment reminder sent to {candidate.email}")
        return True
        
    except Exception as e:
        logger.exception("Error sending AI assessment reminder: {e}")
        return False

def send_ai_assessment_completion_notification(candidate_ai_assessment):
    """
    Send notification to admin when candidate completes AI assessment
    """
    try:
        candidate = candidate_ai_assessment.candidate
        ai_assessment = candidate_ai_assessment.ai_assessment
        admin = candidate_ai_assessment.assigned_by
        
        context = {
            'admin_name': admin.get_full_name() or admin.username,
            'candidate_name': candidate.get_full_name() or candidate.username,
            'candidate_email': candidate.email,
            'assessment_title': ai_assessment.title,
            'overall_score': candidate_ai_assessment.overall_score,
            'technical_score': candidate_ai_assessment.technical_score,
            'communication_score': candidate_ai_assessment.communication_score,
            'problem_solving_score': candidate_ai_assessment.problem_solving_score,
            'completion_time': candidate_ai_assessment.end_time,
            'results_url': f"{settings.SITE_URL}/admin/results/ai-assessment/{ai_assessment.id}/" if hasattr(settings, 'SITE_URL') else f"{settings.SITE_URL}/admin/results/ai-assessment/{ai_assessment.id}/",
        }
        
        subject = f'AI Interview Completed: {candidate.get_full_name() or candidate.username} - {ai_assessment.title}'
        html_message = render_to_string('emails/ai_assessment_completion.html', context)
        plain_message = strip_tags(html_message)
        logger.info("Sending AI assessment completion notification email to: %s", admin.email)
        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[admin.email],
            html_message=html_message,
            fail_silently=False,
        )
        
        logger.info(f"AI Assessment completion notification sent to {admin.email}")
        return True
        
    except Exception as e:
        logger.exception("Error sending AI assessment completion notification: {e}")
        return False
